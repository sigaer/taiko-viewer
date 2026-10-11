import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { createError } from "h3";
import { ensureAccountSchema, getAccountDb } from "../../utils/account-db";
import { assertBindingIdentity, captureBindingIdentity, type BindingIdentity } from "../../internal/account/binding-identity";
import { sourceLifecycleFailure } from "../../internal/account/source-lifecycle";
import { PublicationUnavailableError } from "../../infrastructure/taiko-publication/client";
import { currentScoreScope, withDomainScoreWrite } from "../taiko-domain/publication";
import { deleteBindingsAndGoalsInTransaction } from "../goals/lifecycle";

type Binding = RowDataPacket & BindingIdentity & { user_id: number; is_current: number };
type Receipt = RowDataPacket & { operation_id: string; user_id: number; binding_id: number;
  taiko_id: string; source: string | null; remaining_count: number };
const bindingColumns = "id,user_id,taiko_id,source,manual_account_id,is_current";
const removed = (row: Receipt) => ({ ok: true, removedTaikoId: row.taiko_id, remainingCount: Number(row.remaining_count) });
const missing = () => createError({ statusCode: 404, statusMessage: "未找到该绑定记录" });
function ids(userId: number, bindingIdInput: unknown) {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw createError({ statusCode: 403, statusMessage: "账号归属无效" });
  const bindingId = Number(bindingIdInput || 0);
  if (!Number.isSafeInteger(bindingId) || bindingId <= 0) throw createError({ statusCode: 400, statusMessage: "绑定记录无效" });
  return bindingId;
}
function assertOrdinary(binding: BindingIdentity) {
  if (binding.source === "manual" || binding.manual_account_id) throw createError({ statusCode: 400,
    statusMessage: "手动账号请使用“从 viewer 解绑”或“永久删除”" });
}
function validateReceipt(row: Receipt, userId: number, bindingId: number) {
  if (!/^[a-f0-9]{32}$/.test(row.operation_id) || Number(row.user_id) !== userId || Number(row.binding_id) !== bindingId ||
    !/^[A-Za-z0-9_-]{1,64}$/.test(row.taiko_id) || !Number.isSafeInteger(Number(row.remaining_count)) ||
    Number(row.remaining_count) < 0 || Number(row.remaining_count) > 128 ||
    (row.source !== null && (typeof row.source !== "string" || row.source.length > 16 || row.source === "manual"))) throw new PublicationUnavailableError();
  return row;
}
async function receipt(db: Pool, userId: number, bindingId: number, operationId?: string) {
  const [rows] = await db.execute<Receipt[]>(`SELECT operation_id,user_id,binding_id,taiko_id,source,remaining_count
    FROM web_taiko_binding_revocations WHERE user_id=? AND binding_id=? ${operationId ? "AND operation_id=?" : ""}
    ORDER BY created_at DESC,operation_id DESC LIMIT 1`, operationId ? [userId,bindingId,operationId] : [userId,bindingId]);
  return rows[0] ? validateReceipt(rows[0], userId, bindingId) : undefined;
}
async function lockOwner(connection: PoolConnection, userId: number) {
  const [users] = await connection.execute<RowDataPacket[]>("SELECT id FROM web_user_accounts WHERE id=? FOR UPDATE", [userId]);
  if (!users[0]) throw missing();
  const [rows] = await connection.execute<Binding[]>(`SELECT ${bindingColumns} FROM web_taiko_bindings
    WHERE user_id=? ORDER BY id LIMIT 129 FOR UPDATE`, [userId]);
  if (rows.length > 128) throw new PublicationUnavailableError();
  return rows;
}
async function rollback(connection: PoolConnection) {
  try { await connection.rollback(); } catch { connection.destroy(); }
}
function assertRevocationScope(taikoId: string) {
  const scope = currentScoreScope(taikoId);
  if (!scope || scope.mode !== "write" || scope.staged.size || scope.rollback.length) throw new PublicationUnavailableError();
}
async function selectCurrent(connection: PoolConnection, userId: number, bindingId: number) {
  await connection.execute("UPDATE web_taiko_bindings SET is_current=0 WHERE user_id=?", [userId]);
  await connection.execute("UPDATE web_taiko_bindings SET is_current=1 WHERE id=? AND user_id=?", [bindingId,userId]);
}

export async function removeViewerBinding(userId: number, bindingIdInput: unknown, forceInput?: unknown) {
  const bindingId = ids(userId, bindingIdInput);
  try {
    await ensureAccountSchema();
    const db = getAccountDb();
    const [initial] = await db.execute<Binding[]>(`SELECT ${bindingColumns} FROM web_taiko_bindings WHERE id=? AND user_id=? LIMIT 1`, [bindingId,userId]);
    if (!initial[0]) {
      const [users] = await db.execute<RowDataPacket[]>("SELECT id FROM web_user_accounts WHERE id=? LIMIT 1", [userId]);
      const saved = users[0] && await receipt(db, userId, bindingId);
      if (!saved) throw missing();
      return removed(saved); // Original acknowledgement only, never grants or alters current.
    }
    assertOrdinary(initial[0]);
    const expected = captureBindingIdentity(initial[0]);
    return await withDomainScoreWrite(expected.taiko_id, async () => {
      const operationId = randomUUID().replaceAll("-", "");
      let prepared: Receipt | undefined;
      const connection = await db.getConnection();
      try {
        try {
          await connection.beginTransaction();
          const bindings = await lockOwner(connection, userId);
          const binding = bindings.find(row => Number(row.id) === bindingId);
          if (!binding) {
            // A concurrent committed revocation may have held EX before us.
            const saved = await receipt(db, userId, bindingId);
            if (!saved || saved.taiko_id !== expected.taiko_id || saved.source !== expected.source) throw missing();
            await connection.rollback();
            return removed(saved);
          }
          assertBindingIdentity(expected, binding);
          assertOrdinary(binding);
          if (bindings.length <= 1 && !Boolean(forceInput)) throw createError({ statusCode: 409,
            statusMessage: "这是最后一个绑定 ID，请再次确认后再删除" });
          await deleteBindingsAndGoalsInTransaction(connection, userId, { bindingId });
          await connection.execute("DELETE FROM web_taiko_binding_mydon_showcase_titles WHERE binding_id=?", [bindingId]);
          const remaining = bindings.filter(row => Number(row.id) !== bindingId);
          if (Number(binding.is_current) && remaining[0]) await selectCurrent(connection, userId, Number(remaining[0].id));
          prepared = { operation_id: operationId, user_id: userId, binding_id: bindingId,
            taiko_id: binding.taiko_id, source: binding.source, remaining_count: remaining.length } as Receipt;
          await connection.execute(`INSERT INTO web_taiko_binding_revocations
            (operation_id,user_id,binding_id,taiko_id,source,remaining_count) VALUES (?,?,?,?,?,?)`,
            [operationId,userId,bindingId,binding.taiko_id,binding.source,remaining.length]);
          assertRevocationScope(expected.taiko_id);
          await connection.commit();
        } catch (error) { await rollback(connection); throw error; }
        finally { connection.release(); }
      } catch (error) {
        if (prepared) {
          const saved = await receipt(db, userId, bindingId, operationId);
          if (saved && saved.taiko_id === prepared.taiko_id && saved.source === prepared.source &&
            Number(saved.remaining_count) === Number(prepared.remaining_count)) return removed(saved);
        }
        throw error;
      }
      return removed(prepared!);
    });
  } catch (error) { throw sourceLifecycleFailure(error); }
}

/** Selection is SQL metadata only: lock owner/bindings and never acquire a
 * source lease after SQL. Source-consuming readers separately prove identity.
 */
export async function switchViewerBinding(userId: number, bindingIdInput: unknown) {
  const bindingId = ids(userId, bindingIdInput);
  try {
    await ensureAccountSchema();
    const db = getAccountDb(), connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const bindings = await lockOwner(connection, userId);
      if (!bindings.some(row => Number(row.id) === bindingId)) throw missing();
      await selectCurrent(connection, userId, bindingId);
      await connection.commit();
    } catch (error) { await rollback(connection); throw error; }
    finally { connection.release(); }
    return { ok: true };
  } catch (error) { throw sourceLifecycleFailure(error); }
}
