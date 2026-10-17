import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { createError } from "h3";
import { PublicationUnavailableError } from "../../infrastructure/taiko-publication/client";
import type { BindingIdentity } from "./binding-identity";

export type ViewerBindingAuthority = RowDataPacket & BindingIdentity & {
  user_id: number; is_current: number;
  verified_title: string | null; verified_titleplate_id: number | null;
};
export const BINDING_AUTHORITY_COLUMNS = "id,user_id,taiko_id,source,manual_account_id,is_current,verified_title,verified_titleplate_id";
/** SQL metadata only. Callers that consume/mutate a source acquire its lease
 * before this owner lock. Never acquire a source lease from this function.
 */
export async function lockViewerBindingAuthority(connection: PoolConnection, userId: number) {
  const [users] = await connection.execute<RowDataPacket[]>("SELECT id FROM web_user_accounts WHERE id=? FOR UPDATE", [userId]);
  if (!users[0]) throw createError({ statusCode: 404, statusMessage: "未找到该绑定记录" });
  const [rows] = await connection.execute<ViewerBindingAuthority[]>(`SELECT ${BINDING_AUTHORITY_COLUMNS} FROM web_taiko_bindings
    WHERE user_id=? ORDER BY id LIMIT 129 FOR UPDATE`, [userId]);
  if (rows.length > 128) throw new PublicationUnavailableError();
  return rows;
}
export async function rollbackViewerBindingTransaction(connection: PoolConnection) {
  try { await connection.rollback(); } catch { connection.destroy(); }
}
export async function selectViewerCurrentBinding(connection: PoolConnection, userId: number, bindingId: number) {
  await connection.execute("UPDATE web_taiko_bindings SET is_current=0 WHERE user_id=?", [userId]);
  await connection.execute("UPDATE web_taiko_bindings SET is_current=1 WHERE id=? AND user_id=?", [bindingId,userId]);
}
