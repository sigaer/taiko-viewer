import { randomInt, randomUUID } from "node:crypto";
import { lstat, opendir } from "node:fs/promises";
import { resolve } from "node:path";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { createError } from "h3";
import { ensureAccountSchema, getAccountDb } from "../../utils/account-db";
import type { ManualOwner } from "../../internal/account/manual-ownership";
import { attachManualOwner, lockManualActor, manualActorKey } from "../../internal/account/manual-grants";
import { blankManualUserdata, creationOwner, manualCreationHash, manualCreationPendingKey, normalizeManualNickname,
 validateManualCreation, type ManualCreation } from "../../internal/account/manual-creation-data";
import { LIFECYCLE_UUID, sourceLifecycleFailure } from "../../internal/account/source-lifecycle";
import { formatLocalTimestamp, prepareUserdataPublication } from "../../infrastructure/taiko-publication/writer";
import { PublicationUnavailableError } from "../../infrastructure/taiko-publication/client";
import { currentScoreScope, publishScoreBatch, scorePublication, stageScoreText, withDomainScoreWrite } from "../taiko-domain/publication";

class CreationRedirect extends Error { constructor(readonly operationId: string) { super("Resume admitted creation"); } }
class IdentityCollision extends Error {}
type Executor = Pick<Pool, "execute">;
const columns = `operation_id,taiko_id,actor_kind,actor_key,nickname,status,
 CASE WHEN OCTET_LENGTH(initial_current)<=32768 THEN initial_current ELSE NULL END AS initial_current,
 current_sha256,prior_current,pending_key`;
const resultFor = (row: ManualCreation) => ({ ok: true, taikoId: row.taiko_id, nickname: row.nickname,
 source: "manual", displayName: row.nickname, isManual: true });
function assertCreationScope(taikoId: string) {
 const scope = currentScoreScope(taikoId);
 if (!scope || scope.mode !== "write" || scope.rollback.length || scope.staged.size) throw new PublicationUnavailableError();
 return scope;
}
async function loadCreation(db: Executor, operationId: string, lock = false) {
 const [rows] = await db.execute<ManualCreation[]>(`SELECT ${columns} FROM taiko_manual_creations WHERE operation_id=? LIMIT 1${lock ? " FOR UPDATE" : ""}`, [operationId]);
 return rows[0] ? validateManualCreation(rows[0]) : undefined;
}
function assertActor(row: ManualCreation, owner: ManualOwner, nickname: string) {
 if (row.actor_kind !== owner.kind || row.actor_key !== manualActorKey(owner)) throw createError({ statusCode: 403, statusMessage: "该创建操作不属于当前身份" });
 if (row.nickname !== nickname) throw createError({ statusCode: 409, statusMessage: "创建请求内容已变化" });
}
async function pendingCreation(db: Executor, key: string) {
 const [rows] = await db.execute<RowDataPacket[]>("SELECT operation_id FROM taiko_manual_creations WHERE pending_key=? LIMIT 1", [key]);
 return rows[0]?.operation_id as string | undefined;
}
async function selectedSource(db: Executor, owner: ManualOwner): Promise<string | null> {
 const [rows] = owner.kind === "viewer"
  ? await db.execute<RowDataPacket[]>("SELECT taiko_id AS selected FROM web_taiko_bindings WHERE user_id=? AND is_current=1 ORDER BY id LIMIT 1 FOR UPDATE", [owner.userId])
  : await db.execute<RowDataPacket[]>("SELECT id AS selected FROM bind WHERE qq=? AND is_current=1 ORDER BY slot_index,row_id LIMIT 1 FOR UPDATE", [manualActorKey(owner)]);
 return rows[0] ? String(rows[0].selected) : null;
}
async function assertNoAuthority(db: Executor, taikoId: string) {
 for (const [table, column] of [["taiko_manual_accounts", "taiko_id"], ["web_taiko_bindings", "taiko_id"], ["bind", "id"], ["taiko_source_lifecycle", "taiko_id"]]) {
  const [rows] = await db.execute<RowDataPacket[]>(`SELECT ${column} FROM ${table} WHERE ${column}=? LIMIT 1 FOR UPDATE`, [taikoId]);
  if (rows[0]) throw new PublicationUnavailableError();
 }
}
async function transaction<T>(db: Pool, owner: ManualOwner, taikoId: string, task: (connection: PoolConnection) => Promise<T>) {
 assertCreationScope(taikoId);
 const connection = await db.getConnection();
 try {
  await connection.beginTransaction();
  await lockManualActor(connection, owner);
  const result = await task(connection);
  assertCreationScope(taikoId);
  await connection.commit();
  return result;
 } catch (error) {
  try { await connection.rollback(); } catch { connection.destroy(); }
  throw error;
 } finally { connection.release(); }
}
async function reserveCreation(db: Pool, row: ManualCreation) {
 const owner = creationOwner(row);
 try {
  await transaction(db, owner, row.taiko_id, async connection => {
   const pending = await pendingCreation(connection, row.pending_key!);
   if (pending) throw new CreationRedirect(pending);
   await assertNoAuthority(connection, row.taiko_id);
   const [used] = await connection.execute<RowDataPacket[]>("SELECT operation_id FROM taiko_source_lifecycle WHERE operation_id=? LIMIT 1 FOR UPDATE", [row.operation_id]);
   if (used[0]) throw new PublicationUnavailableError();
   row.prior_current = await selectedSource(connection, owner);
   await connection.execute(`INSERT INTO taiko_manual_creations
    (operation_id,taiko_id,actor_kind,actor_key,nickname,initial_current,current_sha256,prior_current,pending_key)
    VALUES (?,?,?,?,?,?,?,?,?)`, [row.operation_id,row.taiko_id,row.actor_kind,row.actor_key,row.nickname,
    row.initial_current,row.current_sha256,row.prior_current,row.pending_key]);
  });
 } catch (error) {
  // Lost COMMIT acknowledgements require the exact operation and immutable
  // actor/payload proof. A concurrent matching admission is resumed after EX.
  const saved = await loadCreation(db, row.operation_id);
  if (saved && saved.taiko_id === row.taiko_id && saved.actor_kind === row.actor_kind &&
   saved.actor_key === row.actor_key && saved.current_sha256 === row.current_sha256) return saved;
  if (saved) throw new CreationRedirect(saved.operation_id);
  const pending = await pendingCreation(db, row.pending_key!);
  if (pending) throw new CreationRedirect(pending);
  throw error;
 }
 const saved = await loadCreation(db, row.operation_id);
 if (!saved) throw new PublicationUnavailableError();
 return saved;
}
async function assertFreshSource(taikoId: string, admitted = false) {
 const scope = assertCreationScope(taikoId);
 const view = scope.lease.view;
 if ((view && !(admitted && view.sequence === 0 && !Object.keys(view.files).length)) ||
  await scope.reader.currentExists(taikoId) || (await scope.reader.listHistory(taikoId)).length) throw new IdentityCollision();
 // An ID with a legacy daily/archive directory is also occupied, even when C/H
 // are absent. A failed admitted publication may have left an empty directory.
 try {
  const path = resolve(scope.root, taikoId), stat = await lstat(path);
  if (!admitted || !stat.isDirectory() || stat.isSymbolicLink()) throw new IdentityCollision();
  const directory = await opendir(path);
  try {
   let entry, stages = 0;
   while ((entry = await directory.read())) {
    if (++stages > 64 || !entry.isFile() || !new RegExp(`^\\.stage-${taikoId}-[a-f0-9]{32}$`).test(entry.name)) throw new IdentityCollision();
   }
  } finally { await directory.close(); }
 } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
}
function preparedInitialPublication(row: ManualCreation) {
 const data = JSON.parse(row.initial_current);
 const date = new Date(data._meta.ts.replace(" ", "T"));
 if (formatLocalTimestamp(date) !== data._meta.ts) throw new PublicationUnavailableError();
 return prepareUserdataPublication(data, "manual-create", 1, date, row.operation_id);
}
async function verifyInitialPublication(row: ManualCreation) {
 const scope = assertCreationScope(row.taiko_id), view = scope.lease.view;
 if (!view || view.commitId !== row.operation_id || view.sequence !== 1 || Object.keys(view.files).length !== 2 ||
  view.files.current?.sha256 !== row.current_sha256 || await scope.reader.readRawCurrent(row.taiko_id) !== row.initial_current) throw new PublicationUnavailableError();
 const history = await scope.reader.listHistory(row.taiko_id), expected = preparedInitialPublication(row);
 if (history.length !== 1 || `history/${history[0]}` !== expected.historyKey ||
  await scope.reader.readHistory(row.taiko_id, history[0]) !== expected.history) throw new PublicationUnavailableError();
}
async function finishCreation(db: Pool, row: ManualCreation) {
 validateManualCreation(row);
 if (row.status === "ready") return resultFor(row); // Acknowledgement only; never revive a later deletion/detach.
 const owner = creationOwner(row);
 assertCreationScope(row.taiko_id);
 if (owner.kind === "viewer") {
  const [users] = await db.execute<RowDataPacket[]>("SELECT id FROM web_user_accounts WHERE id=? LIMIT 1", [owner.userId]);
  if (!users[0]) throw createError({ statusCode: 403, statusMessage: "账号归属无效" });
 }
 // No owner account/binding exists while pending. Source can only be absent or
 // this operation's exact first publication, never a newer active generation.
 await assertNoAuthority(db, row.taiko_id);
 if (scorePublication(row.taiko_id)?.commitId !== row.operation_id) {
  try { await assertFreshSource(row.taiko_id, true); } catch { throw new PublicationUnavailableError(); }
  const prepared = preparedInitialPublication(row);
  await stageScoreText(row.taiko_id, "current", prepared.current);
  await stageScoreText(row.taiko_id, prepared.historyKey, prepared.history);
  await publishScoreBatch(row.taiko_id, row.operation_id);
 }
 await verifyInitialPublication(row);
 try {
  await transaction(db, owner, row.taiko_id, async connection => {
   const saved = await loadCreation(connection, row.operation_id, true);
   if (!saved || saved.status !== "pending" || saved.current_sha256 !== row.current_sha256 ||
    saved.actor_kind !== row.actor_kind || saved.actor_key !== row.actor_key || saved.taiko_id !== row.taiko_id) throw new PublicationUnavailableError();
   await assertNoAuthority(connection, row.taiko_id);
   const current = await selectedSource(connection, owner);
   await connection.execute("INSERT INTO taiko_manual_accounts (taiko_id,nickname,created_by) VALUES (?,?,?)", [row.taiko_id,row.nickname,row.actor_kind]);
   await attachManualOwner(connection, owner, row.taiko_id, current !== saved.prior_current ? current || undefined : undefined);
   await connection.execute("UPDATE taiko_manual_creations SET status='ready',pending_key=NULL WHERE operation_id=? AND status='pending'", [row.operation_id]);
   if (scorePublication(row.taiko_id)?.commitId !== row.operation_id) throw new PublicationUnavailableError();
  });
 } catch (error) {
  const saved = await loadCreation(db, row.operation_id);
  if (!saved || saved.status !== "ready" || saved.taiko_id !== row.taiko_id || saved.current_sha256 !== row.current_sha256 ||
   saved.actor_kind !== row.actor_kind || saved.actor_key !== row.actor_key) throw error;
 }
 return resultFor(row);
}

/** Optional request UUID supports retries after the HTTP acknowledgement is
 * lost. Legacy requests also resume a matching pending actor/nickname instead
 * of leaving its approved creation behind or allocating a duplicate source.
 */
export async function createManualSource(owner: ManualOwner, nicknameInput: unknown, requestIdInput?: unknown) {
 const nickname = normalizeManualNickname(nicknameInput), actor = manualActorKey(owner);
 const requestId = requestIdInput === undefined || requestIdInput === null ? undefined : String(requestIdInput);
 if (requestId !== undefined && !LIFECYCLE_UUID.test(requestId)) throw createError({ statusCode: 400, statusMessage: "创建请求标识无效" });
 try {
  await ensureAccountSchema();
  const db = getAccountDb();
  const pendingKey = manualCreationPendingKey(owner, nickname);
  let operationId = requestId || await pendingCreation(db, pendingKey) || randomUUID().replaceAll("-", "");
  for (let attempt = 0; attempt < 30; attempt++) {
   const existing = await loadCreation(db, operationId);
   if (existing) {
    assertActor(existing, owner, nickname);
    if (existing.status === "ready") return resultFor(existing);
   }
   const taikoId = existing?.taiko_id || `98${Array.from({ length: 16 }, () => randomInt(0, 10)).join("")}`;
   try {
    return await withDomainScoreWrite(taikoId, async () => {
     if (existing) {
      const fresh = await loadCreation(db, operationId);
      if (!fresh) throw new PublicationUnavailableError();
      assertActor(fresh, owner, nickname);
      return finishCreation(db, fresh);
     }
     await assertFreshSource(taikoId);
     const [used] = await db.execute<RowDataPacket[]>(`SELECT taiko_id FROM taiko_manual_creations WHERE taiko_id=?
      UNION ALL SELECT taiko_id FROM taiko_manual_accounts WHERE taiko_id=?
      UNION ALL SELECT taiko_id FROM taiko_source_lifecycle WHERE taiko_id=? LIMIT 1`, [taikoId,taikoId,taikoId]);
     if (used[0]) throw new IdentityCollision();
     const raw = JSON.stringify(blankManualUserdata(taikoId, nickname, formatLocalTimestamp()), null, 4);
     const row = { operation_id: operationId, taiko_id: taikoId, actor_kind: owner.kind, actor_key: actor, nickname,
      status: "pending", initial_current: raw, current_sha256: manualCreationHash(raw), prior_current: null, pending_key: pendingKey } as ManualCreation;
     return finishCreation(db, await reserveCreation(db, validateManualCreation(row)));
    });
   } catch (error) {
    if (error instanceof CreationRedirect) {
     if (requestId && requestId !== error.operationId) throw createError({ statusCode: 409, statusMessage: "该昵称的档案正在创建，请稍后重试" });
     operationId = error.operationId; continue;
    }
    if (error instanceof IdentityCollision && !existing) continue;
    throw error;
   }
  }
  throw new PublicationUnavailableError();
 } catch (error) { throw sourceLifecycleFailure(error); }
}

export async function recoverOneManualSourceCreation(signal?: AbortSignal, operationId?: string, capturedDb?: Pool) {
 if (operationId && !LIFECYCLE_UUID.test(operationId)) throw new PublicationUnavailableError();
 signal?.throwIfAborted();
 try {
  if (!capturedDb) await ensureAccountSchema();
  const db = capturedDb || getAccountDb();
  const [rows] = await db.execute<RowDataPacket[]>(`SELECT operation_id FROM taiko_manual_creations WHERE status='pending'
   AND ${operationId ? "operation_id=?" : "(last_attempt_at IS NULL OR last_attempt_at < DATE_SUB(NOW(3),INTERVAL 60 SECOND))"}
   ORDER BY last_attempt_at,created_at,operation_id LIMIT 1`, operationId ? [operationId] : []);
  if (!rows[0]) return { recovered: false };
  const id = rows[0].operation_id;
  await db.execute("UPDATE taiko_manual_creations SET attempts=attempts+1,last_attempt_at=NOW(3) WHERE operation_id=? AND status='pending'", [id]);
  signal?.throwIfAborted();
  const saved = await loadCreation(db, id);
  if (!saved) throw new PublicationUnavailableError();
  await withDomainScoreWrite(saved.taiko_id, async () => {
   signal?.throwIfAborted();
   const fresh = await loadCreation(db, id);
   if (!fresh) throw new PublicationUnavailableError();
   await finishCreation(db, fresh);
  });
  return { recovered: true };
 } catch (error) { throw sourceLifecycleFailure(error); }
}
