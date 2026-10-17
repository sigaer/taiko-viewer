import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { createError } from "h3";
import { ensureAccountSchema, getAccountDb } from "../../utils/account-db";
import { assertManualOwner, compactManualBotSlots, normalizeManualIdentityKey, type ManualOwner } from "../../internal/account/manual-ownership";
import { deleteBindingsAndGoalsInTransaction } from "../goals/lifecycle";
import { clearScoreSource, createScoreBackup, currentScoreScope, purgeScoreBackupArchives, scorePublication, withDomainScoreWrite } from "../taiko-domain/publication";
import { PublicationUnavailableError } from "../../infrastructure/taiko-publication/client";
import { encodeSqlRecoveryBackup } from "../../infrastructure/taiko-publication/sql-backup";
import { assertSourceGrantsRevoked as assertRevoked, latestSourceLifecycleReceipt as latestReceipt, validateSourceLifecycleReceipt as validateReceipt,
  LIFECYCLE_UUID as UUID, MANUAL_SOURCE_ID as MANUAL_ID, LIFECYCLE_RECEIPT_COLUMNS as RECEIPT_COLUMNS, sourceLifecycleFailure, type SourceLifecycleReceipt as Receipt } from "../../internal/account/source-lifecycle";

const MAX_OWNERS = 128;
const MAX_BACKUP_ROWS = 10_000;
const MAX_SQL_BACKUP_BYTES = 8 * 1024 * 1024;

const actorKey = (owner: ManualOwner) => {
  if (owner.kind === "bot") return normalizeManualIdentityKey(owner.identityKey);
  if (!Number.isSafeInteger(owner.userId) || owner.userId <= 0) throw createError({ statusCode: 403, statusMessage: "账号归属无效" });
  return String(owner.userId);
};

// Row/byte limits are checked before revoking authority. Private recovery data
// stays in SQL and never appears in API responses, worker queries or logs.
async function backupRows(connection: PoolConnection, table: string, predicate: string, args: Array<string | number>) {
  const allowed = new Set(["web_player_goals", "web_growth_measurements", "web_growth_recent_cursors", "web_song_locks", "web_taiko_binding_mydon_showcase_titles"]);
  if (!allowed.has(table)) throw new PublicationUnavailableError();
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT * FROM ${table} WHERE ${predicate} LIMIT ${MAX_BACKUP_ROWS + 1} FOR UPDATE`, args);
  if (rows.length > MAX_BACKUP_ROWS) throw new PublicationUnavailableError();
  return rows;
}

async function revokeInOneTransaction(db: Pool, owner: ManualOwner, taikoId: string, operationId: string, backup: Awaited<ReturnType<typeof createScoreBackup>>) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [owners] = await connection.execute<RowDataPacket[]>(
      "SELECT DISTINCT user_id FROM web_taiko_bindings WHERE taiko_id=? AND source='manual' ORDER BY user_id LIMIT 129", [taikoId]);
    if (owners.length > MAX_OWNERS) throw new PublicationUnavailableError();
    const userIds = owners.map(row => Number(row.user_id));
    if (userIds.some(id => !Number.isSafeInteger(id) || id <= 0)) throw new PublicationUnavailableError();
    for (const userId of userIds) {
      await connection.execute("SELECT id FROM web_user_accounts WHERE id=? FOR UPDATE", [userId]);
      await connection.execute("SELECT id FROM web_taiko_bindings WHERE user_id=? ORDER BY id FOR UPDATE", [userId]);
    }
    // Current locking reads avoid using an old REPEATABLE READ owner snapshot.
    const [bindings] = await connection.execute<RowDataPacket[]>(
      "SELECT * FROM web_taiko_bindings WHERE taiko_id=? AND source='manual' ORDER BY user_id,id FOR UPDATE", [taikoId]);
    if (bindings.some(row => !userIds.includes(Number(row.user_id)))) throw new PublicationUnavailableError();
    const account = await assertManualOwner(owner, taikoId, connection);
    const [botBindings] = await connection.execute<RowDataPacket[]>(
      "SELECT * FROM bind WHERE id=? AND source='manual' ORDER BY qq,row_id LIMIT 129 FOR UPDATE", [taikoId]);
    if (botBindings.length > MAX_OWNERS) throw new PublicationUnavailableError();
    const bindingIds = bindings.map(row => Number(row.id));
    if (bindingIds.some(id => !Number.isSafeInteger(id) || id <= 0)) throw new PublicationUnavailableError();
    const products: Record<string, RowDataPacket[]> = {};
    for (const [name, table] of Object.entries({ goals: "web_player_goals", measurements: "web_growth_measurements", cursors: "web_growth_recent_cursors", titles: "web_taiko_binding_mydon_showcase_titles" })) {
      products[name] = bindingIds.length ? await backupRows(connection, table,
        `binding_id IN (${bindingIds.map(() => "?").join(",")})`, bindingIds) : [];
    }
    products.locks = await backupRows(connection, "web_song_locks", "taiko_id=?", [taikoId]);
    const sqlBackup = encodeSqlRecoveryBackup({ schema: 1, manualAccount: account, bindings, botBindings, products });
    if (Buffer.byteLength(sqlBackup) > MAX_SQL_BACKUP_BYTES) throw new PublicationUnavailableError();
    await connection.execute(
      `INSERT INTO taiko_source_lifecycle
        (operation_id,taiko_id,kind,actor_kind,actor_key,backup_key,source_commit_id,source_sequence,sql_backup,sql_backup_sha256)
        VALUES (?,?,'manual-delete',?,?,?,?,?,?,?)`,
      [operationId, taikoId, owner.kind, actorKey(owner), backup.backupKey, backup.source.commitId, backup.source.sequence, sqlBackup, createHash("sha256").update(sqlBackup).digest("hex")]);
    for (const userId of userIds) {
      await deleteBindingsAndGoalsInTransaction(connection, userId, { taikoId, source: "manual" });
      // Explicitly remove showcase rows too: scoped privacy cleanup does not
      // rely solely on FK cascade being present in a migration/test database.
    }
    for (const bindingId of bindingIds) await connection.execute(
      "DELETE FROM web_taiko_binding_mydon_showcase_titles WHERE binding_id=?", [bindingId]);
    await connection.execute("DELETE FROM web_song_locks WHERE taiko_id=?", [taikoId]);
    await connection.execute("DELETE FROM bind WHERE id=? AND source='manual'", [taikoId]);
    await connection.execute("DELETE FROM taiko_manual_claim_codes WHERE taiko_id=?", [taikoId]);
    await connection.execute("DELETE FROM taiko_manual_accounts WHERE taiko_id=?", [taikoId]);
    for (const userId of userIds) {
      await connection.execute("UPDATE web_taiko_bindings SET is_current=0 WHERE user_id=?", [userId]);
      const [remaining] = await connection.execute<RowDataPacket[]>(
        "SELECT id FROM web_taiko_bindings WHERE user_id=? ORDER BY id LIMIT 1", [userId]);
      if (remaining[0]) await connection.execute("UPDATE web_taiko_bindings SET is_current=1 WHERE id=?", [remaining[0].id]);
    }
    for (const key of [...new Set(botBindings.map(row => String(row.qq)))]) await compactManualBotSlots(connection, key);
    if (scorePublication(taikoId)?.commitId !== backup.source.commitId) throw new PublicationUnavailableError();
    await connection.commit();
  } catch (error) {
    try { await connection.rollback(); }
    catch { connection.destroy(); } // Never return an uncertain transaction to the pool.
    throw error;
  } finally { connection.release(); }
}

async function prepareSourceCleanup(db: Pool, receipt: Receipt) {
  validateReceipt(receipt);
  await assertRevoked(db, receipt);
  const view = scorePublication(receipt.taiko_id);
  if (!view || !(view.commitId === receipt.source_commit_id || (!Object.keys(view.files).length && view.sequence > Number(receipt.source_sequence)))) {
    throw new PublicationUnavailableError();
  }
  if (Object.keys(view.files).length) await clearScoreSource(receipt.taiko_id);
  await purgeScoreBackupArchives(receipt.taiko_id, receipt.backup_key);
}
async function markPublished(db: Pool, receipt: Receipt) {
  await withDomainScoreWrite(receipt.taiko_id, async () => {
    await assertRevoked(db, receipt);
    const view = scorePublication(receipt.taiko_id);
    if (!view || Object.keys(view.files).length || view.sequence <= Number(receipt.source_sequence)) throw new PublicationUnavailableError();
    // Recheck daily cleanup even if the prior source acknowledgement was lost.
    await purgeScoreBackupArchives(receipt.taiko_id, receipt.backup_key);
    await db.execute(
      "UPDATE taiko_source_lifecycle SET status='published',published_commit_id=? WHERE operation_id=? AND status='pending'", [view.commitId, receipt.operation_id]);
  });
}

async function deleteManualSource(owner: ManualOwner, taikoId: string) {
  if (!MANUAL_ID.test(taikoId)) throw createError({ statusCode: 400, statusMessage: "手动账号标识无效" });
  const key = actorKey(owner);
  await ensureAccountSchema("source");
  const db = getAccountDb();
  const receipt = await withDomainScoreWrite(taikoId, async () => {
    let previous = await latestReceipt(db, taikoId);
    if (previous?.status === "restoring") throw new PublicationUnavailableError();
    if (previous && previous.status !== "restored") {
      if (previous.actor_kind !== owner.kind || previous.actor_key !== key) throw createError({ statusCode: 403, statusMessage: "该删除操作不属于当前身份" });
      await prepareSourceCleanup(db, previous);
      return previous;
    }
    await assertManualOwner(owner, taikoId);
    const operationId = randomUUID().replaceAll("-", "");
    const backup = await createScoreBackup(taikoId, randomUUID().replaceAll("-", ""));
    try { await revokeInOneTransaction(db, owner, taikoId, operationId, backup); }
    catch (error) {
      // COMMIT can succeed before its socket acknowledgement is lost. Only a
      // matching durable receipt proves authority was revoked; no undo on doubt.
      previous = await latestReceipt(db, taikoId);
      if (!previous || previous.operation_id !== operationId) throw error;
    }
    const saved = await latestReceipt(db, taikoId);
    if (!saved || saved.operation_id !== operationId) throw new PublicationUnavailableError();
    await prepareSourceCleanup(db, saved);
    return saved;
  });
  await markPublished(db, receipt);
  return { ok: true, backup: receipt.backup_key, operationId: receipt.operation_id };
}

export async function permanentlyDeleteManualSource(owner: ManualOwner, taikoId: string) {
  try { return await deleteManualSource(owner, taikoId); }
  catch (error) { throw sourceLifecycleFailure(error); }
}

/** One source per tick; concurrent processes are fenced again by source EX. */
export async function recoverOneManualSourceDeletion(signal?: AbortSignal, operationId?: string, existingDb?: Pool) {
  if (operationId && !UUID.test(operationId)) throw new PublicationUnavailableError();
  signal?.throwIfAborted();
  if (!existingDb) await ensureAccountSchema("source");
  signal?.throwIfAborted();
  const db = existingDb || getAccountDb();
  const [rows] = await db.execute<Receipt[]>(
    `SELECT ${RECEIPT_COLUMNS} FROM taiko_source_lifecycle WHERE status='pending'
      AND ${operationId ? "operation_id=?" : "(last_attempt_at IS NULL OR last_attempt_at < DATE_SUB(NOW(3),INTERVAL 60 SECOND))"}
      ORDER BY last_attempt_at,created_at,operation_id LIMIT 1`, operationId ? [operationId] : []);
  if (!rows[0]) return { recovered: false };
  // Update only infrastructure metadata before waiting for EX; this statement
  // holds no SQL lock while acquiring source. Failed/obsolete/corrupt work must
  // not permanently monopolize the first queue slot and starve other sources.
  await db.execute(
    "UPDATE taiko_source_lifecycle SET attempts=attempts+1,last_attempt_at=NOW(3) WHERE operation_id=? AND status='pending'", [rows[0].operation_id]);
  const receipt = validateReceipt(rows[0]);
  const prepared = await withDomainScoreWrite(receipt.taiko_id, async () => {
    signal?.throwIfAborted();
    // A different worker may already have completed it while we waited.
    const current = await latestReceipt(db, receipt.taiko_id);
    if (!current || current.operation_id !== receipt.operation_id || current.status !== "pending") return false;
    await prepareSourceCleanup(db, current);
    return true;
  });
  if (!prepared || signal?.aborted) return { recovered: false };
  await markPublished(db, receipt);
  return { recovered: true };
}
