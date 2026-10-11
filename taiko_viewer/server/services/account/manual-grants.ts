import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { createError } from "h3";
import { ensureAccountSchema, getAccountDb } from "../../utils/account-db";
import { assertManualOwner, compactManualBotSlots, getManualAccount, type ManualOwner } from "../../internal/account/manual-ownership";
import { attachManualOwner, lockManualActor, manualActorKey } from "../../internal/account/manual-grants";
import { MANUAL_SOURCE_ID, sourceLifecycleFailure } from "../../internal/account/source-lifecycle";
import { PublicationUnavailableError } from "../../infrastructure/taiko-publication/client";
import { currentScoreScope, withDomainScoreWrite } from "../taiko-domain/publication";
import { deleteBindingsAndGoalsInTransaction } from "../goals/lifecycle";

type Kind = "issue" | "claim" | "detach";
const invalidClaim = () => createError({ statusCode: 400, statusMessage: "认领码错误、已过期或已使用" });
const assertGrantScope = (taikoId: string) => {
  const scope = currentScoreScope(taikoId);
  if (!scope || scope.mode !== "write" || scope.staged.size || scope.rollback.length) throw new PublicationUnavailableError();
};
async function grantTransaction<T>(db: Pool, owner: ManualOwner, taikoId: string, kind: Kind, proofKey: string | null,
  task: (connection: PoolConnection) => Promise<T>): Promise<T> {
  assertGrantScope(taikoId);
  const operationId = randomUUID().replaceAll("-", "");
  const actor = manualActorKey(owner);
  let prepared = false, result: T | undefined;
  const connection = await db.getConnection();
  try {
    try {
      await connection.beginTransaction();
      await lockManualActor(connection, owner);
      result = await task(connection);
      await connection.execute(`INSERT INTO taiko_manual_grant_receipts
        (operation_id,taiko_id,kind,actor_kind,actor_key,proof_key) VALUES (?,?,?,?,?,?)`,
      [operationId, taikoId, kind, owner.kind, actor, proofKey]);
      assertGrantScope(taikoId);
      prepared = true;
      await connection.commit();
    } catch (error) {
      try { await connection.rollback(); } catch { connection.destroy(); }
      throw error;
    } finally { connection.release(); }
  } catch (error) {
    if (prepared) {
      // Exact nonce evidence, never infer COMMIT from a partial binding state.
      const [rows] = await db.execute<RowDataPacket[]>(
        `SELECT operation_id FROM taiko_manual_grant_receipts WHERE operation_id=? AND taiko_id=?
          AND kind=? AND actor_kind=? AND actor_key=? AND proof_key <=> ? LIMIT 1`,
        [operationId, taikoId, kind, owner.kind, actor, proofKey]);
      if (rows[0]) return result as T;
    }
    throw error;
  }
  return result as T;
}
async function inGrantScope<T>(owner: ManualOwner, taikoId: string, task: (db: Pool) => Promise<T>) {
  if (!MANUAL_SOURCE_ID.test(taikoId)) throw createError({ statusCode: 400, statusMessage: "手动账号标识无效" });
  manualActorKey(owner);
  try {
    await ensureAccountSchema();
    const db = getAccountDb();
    return await withDomainScoreWrite(taikoId, () => task(db));
  } catch (error) { throw sourceLifecycleFailure(error); }
}
export async function issueManualGrantCode(owner: ManualOwner, taikoId: string,
  prepare: () => { code: string; hash: string; expiresAt: Date }) {
  return inGrantScope(owner, taikoId, async db => {
    return grantTransaction(db, owner, taikoId, "issue", null, async connection => {
      await assertManualOwner(owner, taikoId, connection);
      const token = prepare();
      if (!/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/.test(token.code) || !/^[a-f0-9]{64}$/.test(token.hash) ||
        !Number.isFinite(token.expiresAt.getTime())) throw new PublicationUnavailableError();
      await connection.execute("DELETE FROM taiko_manual_claim_codes WHERE taiko_id = ? AND consumed_at IS NULL", [taikoId]);
      await connection.execute(`INSERT INTO taiko_manual_claim_codes (taiko_id, code_hash, issued_by, expires_at)
        VALUES (?, ?, ?, ?)`, [taikoId, token.hash, owner.kind, token.expiresAt]);
      return { ok: true, code: token.code, expiresAt: token.expiresAt.toISOString() };
    });
  });
}

export async function consumeManualGrantCode(owner: ManualOwner, hash: string) {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw invalidClaim();
  const actor = manualActorKey(owner);
  try {
    await ensureAccountSchema();
    const db = getAccountDb();
    const [claims] = await db.execute<RowDataPacket[]>(`SELECT id, taiko_id FROM taiko_manual_claim_codes
      WHERE code_hash = ? AND consumed_at IS NULL AND expires_at > NOW() LIMIT 1`, [hash]);
    if (!claims[0]) {
      const [receipts] = await db.execute<RowDataPacket[]>(`SELECT taiko_id FROM taiko_manual_grant_receipts
        WHERE kind='claim' AND proof_key=? AND actor_kind=? AND actor_key=? ORDER BY created_at DESC,operation_id DESC LIMIT 1`, [hash, owner.kind, actor]);
      if (!receipts[0] || !MANUAL_SOURCE_ID.test(receipts[0].taiko_id)) throw invalidClaim();
      return await withDomainScoreWrite(receipts[0].taiko_id, () => replayOwnedClaim(db, owner, receipts[0].taiko_id, hash, invalidClaim));
    }
    const claim = claims[0], taikoId = String(claim.taiko_id);
    if (!MANUAL_SOURCE_ID.test(taikoId) || !Number.isSafeInteger(Number(claim.id)) || Number(claim.id) <= 0) throw new PublicationUnavailableError();
    return await withDomainScoreWrite(taikoId, async () => {
      // Both requests may have selected an unused code before waiting for EX.
      // A same-actor committed replay neither consumes again nor changes current.
      const [fresh] = await db.execute<RowDataPacket[]>(`SELECT id FROM taiko_manual_claim_codes
        WHERE id=? AND taiko_id=? AND code_hash=? AND consumed_at IS NULL AND expires_at > NOW() LIMIT 1`, [claim.id, taikoId, hash]);
      if (!fresh[0]) return replayOwnedClaim(db, owner, taikoId, hash,
        () => createError({ statusCode: 409, statusMessage: "认领码已被使用" }));
      return grantTransaction(db, owner, taikoId, "claim", hash, async connection => {
        const account = await getManualAccount(taikoId, connection);
        const [result] = await connection.execute(`UPDATE taiko_manual_claim_codes SET consumed_at = NOW()
          WHERE id = ? AND taiko_id = ? AND code_hash = ? AND consumed_at IS NULL AND expires_at > NOW()`, [claim.id, taikoId, hash]);
        if (!Number((result as { affectedRows?: number }).affectedRows || 0)) throw createError({ statusCode: 409, statusMessage: "认领码已被使用" });
        await attachManualOwner(connection, owner, taikoId);
        return { ok: true, taikoId, nickname: account.nickname };
      });
    });
  } catch (error) { throw sourceLifecycleFailure(error); }
}

async function replayOwnedClaim(db: Pool, owner: ManualOwner, taikoId: string, hash: string, failure: () => Error) {
  const [receipts] = await db.execute<RowDataPacket[]>(`SELECT operation_id FROM taiko_manual_grant_receipts
    WHERE kind='claim' AND taiko_id=? AND proof_key=? AND actor_kind=? AND actor_key=? LIMIT 1`, [taikoId, hash, owner.kind, manualActorKey(owner)]);
  const [used] = await db.execute<RowDataPacket[]>("SELECT id FROM taiko_manual_claim_codes WHERE code_hash=? AND taiko_id=? AND consumed_at IS NOT NULL LIMIT 1", [hash, taikoId]);
  if (!receipts[0] || !used[0]) throw failure();
  try {
    const account = await assertManualOwner(owner, taikoId, db);
    return { ok: true, taikoId, nickname: account.nickname };
  } catch (error) {
    if ([403, 404].includes(Number((error as { statusCode?: number }).statusCode))) throw failure();
    throw error;
  }
}

export async function detachManualGrant(owner: ManualOwner, taikoId: string) {
  return inGrantScope(owner, taikoId, async db => {
    try { await assertManualOwner(owner, taikoId, db); }
    catch (error) {
      if (Number((error as { statusCode?: number }).statusCode) !== 403) throw error;
      const [receipts] = await db.execute<RowDataPacket[]>(`SELECT operation_id FROM taiko_manual_grant_receipts
        WHERE taiko_id=? AND kind='detach' AND actor_kind=? AND actor_key=? LIMIT 1`, [taikoId, owner.kind, manualActorKey(owner)]);
      if (receipts[0]) return { ok: true };
      throw error;
    }
    return grantTransaction(db, owner, taikoId, "detach", null, async connection => {
      const account = await assertManualOwner(owner, taikoId, connection);
      const [viewerRows] = await connection.execute<RowDataPacket[]>("SELECT id,user_id FROM web_taiko_bindings WHERE taiko_id=? AND source='manual' ORDER BY user_id,id LIMIT 129 FOR UPDATE", [taikoId]);
      const [botRows] = await connection.execute<RowDataPacket[]>("SELECT qq,row_id FROM bind WHERE id=? AND source='manual' ORDER BY qq,row_id LIMIT 129 FOR UPDATE", [taikoId]);
      if (viewerRows.length > 128 || botRows.length > 128) throw new PublicationUnavailableError();
      if ((owner.kind === "viewer" && !botRows.length) || (owner.kind === "bot" && !viewerRows.length)) {
        throw createError({ statusCode: 409, statusMessage: "这是最后一个持有端，请使用永久删除并二次确认" });
      }
      if (owner.kind === "viewer") {
        await deleteBindingsAndGoalsInTransaction(connection, owner.userId, { taikoId, source: "manual" });
        for (const binding of viewerRows) if (Number(binding.user_id) === owner.userId) {
          await connection.execute("DELETE FROM web_taiko_binding_mydon_showcase_titles WHERE binding_id=?", [binding.id]);
        }
        const [remaining] = await connection.execute<RowDataPacket[]>("SELECT id FROM web_taiko_bindings WHERE user_id=? ORDER BY id LIMIT 1", [owner.userId]);
        if (remaining[0]) {
          await connection.execute("UPDATE web_taiko_bindings SET is_current = 0 WHERE user_id = ?", [owner.userId]);
          await connection.execute("UPDATE web_taiko_bindings SET is_current = 1 WHERE id = ?", [remaining[0].id]);
        }
      } else {
        const key = manualActorKey(owner);
        await connection.execute("DELETE FROM bind WHERE qq = ? AND id = ? AND source = 'manual'", [key, taikoId]);
        const remaining = botRows.filter(row => row.qq !== key);
        const principal = remaining.find(row => row.qq === account.bot_identity_key) || remaining[0];
        await connection.execute("UPDATE taiko_manual_accounts SET bot_identity_key = ? WHERE taiko_id = ?", [principal?.qq || null, taikoId]);
        await compactManualBotSlots(connection, key);
      }
      return { ok: true };
    });
  });
}
