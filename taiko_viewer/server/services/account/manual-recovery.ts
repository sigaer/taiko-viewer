import { createHash } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { ensureAccountSchema, getAccountDb } from "../../utils/account-db";
import { PublicationUnavailableError } from "../../infrastructure/taiko-publication/client";
import { assertSourceGrantsRevoked, latestSourceLifecycleReceipt, validateSourceLifecycleReceipt, sourceLifecycleFailure,
  LIFECYCLE_RECEIPT_COLUMNS, LIFECYCLE_UUID, type SourceLifecycleReceipt } from "../../internal/account/source-lifecycle";
import { decodeManualRecoveryData, type ManualRecoveryData } from "../../internal/account/manual-recovery-data";
import { insertManualRecovery, preflightManualRecovery } from "../../internal/account/manual-recovery-sql";
import { restoreScoreBackup, scorePublication, verifyScoreBackup, withDomainScoreWrite } from "../taiko-domain/publication";

type FullReceipt = SourceLifecycleReceipt & { sql_backup: unknown; sql_backup_sha256: string };
async function loadReceipt(db: Pool, operationId: string) {
  const [rows] = await db.execute<FullReceipt[]>(
    `SELECT ${LIFECYCLE_RECEIPT_COLUMNS},sql_backup,sql_backup_sha256 FROM taiko_source_lifecycle WHERE operation_id=?`, [operationId]);
  if (!rows[0]) throw new PublicationUnavailableError();
  return validateSourceLifecycleReceipt(rows[0]) as FullReceipt;
}
const restoreNonce = (operationId: string) => createHash("sha256").update("manual-source-restore:" + operationId).digest("hex").slice(0, 32);

async function restoreAuthority(db: Pool, receipt: FullReceipt, data: ManualRecoveryData, nonce: string) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const state = await preflightManualRecovery(connection, receipt, data, true);
    const [rows] = await connection.execute<FullReceipt[]>(
      `SELECT ${LIFECYCLE_RECEIPT_COLUMNS},sql_backup,sql_backup_sha256 FROM taiko_source_lifecycle WHERE operation_id=? FOR UPDATE`, [receipt.operation_id]);
    const current = rows[0];
    if (!current || current.status !== "restoring" || current.sql_backup_sha256 !== receipt.sql_backup_sha256) throw new PublicationUnavailableError();
    decodeManualRecoveryData(current.sql_backup, current.sql_backup_sha256, receipt);
    await insertManualRecovery(connection, data, state);
    await connection.execute(
      "UPDATE taiko_source_lifecycle SET status='restored',published_commit_id=? WHERE operation_id=? AND status='restoring'", [nonce, receipt.operation_id]);
    if (scorePublication(receipt.taiko_id)?.commitId !== nonce) throw new PublicationUnavailableError();
    await connection.commit();
  } catch (error) {
    try { await connection.rollback(); } catch { connection.destroy(); }
    throw error;
  } finally { connection.release(); }
}

async function restoreOperation(db: Pool, operationId: string, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const initial = await loadReceipt(db, operationId);
  return withDomainScoreWrite(initial.taiko_id, async () => {
    signal?.throwIfAborted();
    const receipt = await loadReceipt(db, operationId);
    const latest = await latestSourceLifecycleReceipt(db, receipt.taiko_id);
    if (!latest || latest.operation_id !== operationId) throw new PublicationUnavailableError();
    if (receipt.status === "restored") return { ok: true, operationId };
    if (!["published", "restoring"].includes(receipt.status) || !LIFECYCLE_UUID.test(receipt.published_commit_id || "")) {
      throw new PublicationUnavailableError();
    }
    const data = decodeManualRecoveryData(receipt.sql_backup, receipt.sql_backup_sha256, receipt);
    const backup = await verifyScoreBackup(receipt.taiko_id, receipt.backup_key);
    if (backup.source.commitId !== receipt.source_commit_id || backup.source.sequence !== Number(receipt.source_sequence)) throw new PublicationUnavailableError();
    const nonce = restoreNonce(operationId);
    const view = scorePublication(receipt.taiko_id);
    // A fresh configured recovery root may have no source yet. An existing
    // root must be the exact deletion tombstone or our own resumed restore.
    if (view && !(view.commitId === receipt.published_commit_id && !Object.keys(view.files).length) &&
      !(receipt.status === "restoring" && view.commitId === nonce)) throw new PublicationUnavailableError();
    await preflightManualRecovery(db, receipt, data);
    if (receipt.status === "published") {
      await db.execute("UPDATE taiko_source_lifecycle SET status='restoring' WHERE operation_id=? AND status='published'", [operationId]);
      if ((await loadReceipt(db, operationId)).status !== "restoring") throw new PublicationUnavailableError();
    }
    // Durable restoring prevents a deletion worker from erasing restored C/H.
    // The shared kernel EX remains held until the authority COMMIT completes.
    signal?.throwIfAborted();
    await assertSourceGrantsRevoked(db, receipt);
    const restored = await restoreScoreBackup(receipt.taiko_id, receipt.backup_key, nonce);
    if (restored.commitId !== nonce || !restored.files.current) throw new PublicationUnavailableError();
    signal?.throwIfAborted();
    try { await restoreAuthority(db, receipt, data, nonce); }
    catch (error) {
      const proof = await latestSourceLifecycleReceipt(db, receipt.taiko_id);
      if (!proof || proof.operation_id !== operationId || proof.status !== "restored" || proof.published_commit_id !== nonce) throw error;
    }
    return { ok: true, operationId };
  });
}

/** Trusted migration/recovery operation only. No public API or claim endpoint
 * calls this function; ordinary ownership deletion never automatically undoes.
 */
export async function restoreDeletedManualSource(operationId: string) {
  if (!LIFECYCLE_UUID.test(operationId)) throw new PublicationUnavailableError();
  try {
    await ensureAccountSchema("source");
    return await restoreOperation(getAccountDb(), operationId);
  } catch (error) { throw sourceLifecycleFailure(error); }
}

/** Retry only an already admitted restore; never initiate restoration of a
 * merely published user deletion from a background worker.
 */
export async function recoverOneManualSourceRestoration(signal?: AbortSignal, operationId?: string, existingDb?: Pool) {
  if (operationId && !LIFECYCLE_UUID.test(operationId)) throw new PublicationUnavailableError();
  signal?.throwIfAborted();
  if (!existingDb) await ensureAccountSchema("source");
  signal?.throwIfAborted();
  const db = existingDb || getAccountDb();
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT operation_id FROM taiko_source_lifecycle WHERE status='restoring' AND
      ${operationId ? "operation_id=?" : "(last_attempt_at IS NULL OR last_attempt_at < DATE_SUB(NOW(3),INTERVAL 60 SECOND))"}
      ORDER BY last_attempt_at,created_at,operation_id LIMIT 1`, operationId ? [operationId] : []);
  if (!rows[0]) return { recovered: false };
  await db.execute("UPDATE taiko_source_lifecycle SET attempts=attempts+1,last_attempt_at=NOW(3) WHERE operation_id=? AND status='restoring'", [rows[0].operation_id]);
  await restoreOperation(db, rows[0].operation_id, signal);
  return { recovered: true };
}
