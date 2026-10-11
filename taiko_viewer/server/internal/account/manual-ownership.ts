import type { Pool } from "mysql2/promise";
import { createError } from "h3";
import { ensureAccountSchema, getAccountDb, type DbRow } from "../../utils/account-db";

export type ManualAccountRow = {
  taiko_id: string; nickname: string; bot_identity_key: string | null; created_by: "viewer" | "bot";
};
export type ManualOwner = { kind: "viewer"; userId: number } | { kind: "bot"; identityKey: string };
type Executor = Pick<Pool, "execute">;

export const normalizeManualIdentityKey = (value: unknown) => {
  const identityKey = String(value || "").trim();
  if (!identityKey || identityKey.length > 191 || !identityKey.includes(":")) {
    throw createError({ statusCode: 400, statusMessage: "身份标识无效" });
  }
  return identityKey;
};

export async function getManualAccount(taikoId: string, connection?: Executor) {
  if (!connection) await ensureAccountSchema();
  const [rows] = await (connection || getAccountDb()).execute<DbRow<ManualAccountRow>[]>(
    "SELECT * FROM taiko_manual_accounts WHERE taiko_id = ? LIMIT 1" + (connection ? " FOR UPDATE" : ""), [taikoId]);
  if (!rows[0]) throw createError({ statusCode: 404, statusMessage: "未找到该手动账号" });
  return rows[0];
}

export async function assertManualOwner(owner: ManualOwner, taikoId: string, connection?: Executor) {
  const db = connection || getAccountDb();
  const [rows] = owner.kind === "viewer"
    ? await db.execute<DbRow<{ total: number }>[]>(
      (connection ? "SELECT 1 AS total FROM web_taiko_bindings" : "SELECT COUNT(*) AS total FROM web_taiko_bindings") +
      " WHERE user_id = ? AND taiko_id = ? AND source = 'manual'" + (connection ? " LIMIT 1 FOR UPDATE" : ""), [owner.userId, taikoId])
    : await db.execute<DbRow<{ total: number }>[]>(
      (connection ? "SELECT 1 AS total FROM bind" : "SELECT COUNT(*) AS total FROM bind") +
      " WHERE qq = ? AND id = ? AND source = 'manual'" + (connection ? " LIMIT 1 FOR UPDATE" : ""), [normalizeManualIdentityKey(owner.identityKey), taikoId]);
  if (!Number(rows[0]?.total || 0)) throw createError({ statusCode: 403,
    statusMessage: owner.kind === "viewer" ? "该手动账号不属于当前用户" : "该手动账号不属于当前身份" });
  return getManualAccount(taikoId, connection);
}

export async function compactManualBotSlots(db: Executor, identityKey: string, preferredTaikoId?: string) {
  const [rows] = await db.execute<DbRow<{ row_id: number; id: string; is_current: number }>[]>(
    "SELECT row_id, id, is_current FROM bind WHERE qq = ? ORDER BY slot_index, row_id", [identityKey]);
  if (!rows.length) return;
  const current = rows.find(row => row.id === preferredTaikoId) || rows.find(row => Number(row.is_current) === 1) || rows[0];
  await db.execute("UPDATE bind SET is_current = 0 WHERE qq = ?", [identityKey]);
  for (const [index, row] of rows.entries()) await db.execute(
    "UPDATE bind SET slot_index = ?, is_current = ? WHERE row_id = ?", [index + 1, row.row_id === current.row_id ? 1 : 0, row.row_id]);
}
