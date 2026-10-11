import type { Pool, RowDataPacket } from "mysql2/promise";
import { createError } from "h3";
import { PublicationUnavailableError } from "../../infrastructure/taiko-publication/client.ts";

export type BindingRow = {
  id: number; user_id: number; taiko_id: string; source: "wahlap" | "hiroba" | "manual";
  manual_account_id: string | null; display_name?: string | null; is_current: number;
  verified_title: string | null; verified_titleplate_id: number | null; mydon_showcase_layout: string;
  created_at: string; updated_at: string;
};
export type BindingReadDb = Pick<Pool, "execute">;
const bindingQuery = `SELECT b.*, m.nickname AS display_name FROM web_taiko_bindings b
  LEFT JOIN taiko_manual_accounts m ON CAST(m.taiko_id AS BINARY) = CAST(b.manual_account_id AS BINARY)
  WHERE b.user_id = ? ORDER BY b.is_current DESC, b.id ASC`;

export async function readViewerBindings(db: BindingReadDb, userId: number) {
  const [rows] = await db.execute<(RowDataPacket & BindingRow)[]>(bindingQuery + " LIMIT 129", [userId]);
  if (rows.length > 128) throw new PublicationUnavailableError();
  return rows;
}
export async function readViewerCurrentBinding(db: BindingReadDb, userId: number) {
  const [rows] = await db.execute<(RowDataPacket & BindingRow)[]>(bindingQuery + " LIMIT 1", [userId]);
  return rows[0] || null;
}
export async function requireViewerBindingOwner(db: BindingReadDb, userId: number) {
  const [rows] = await db.execute<RowDataPacket[]>("SELECT id FROM web_user_accounts WHERE id=? LIMIT 1", [userId]);
  if (!rows[0]) throw createError({ statusCode: 404, statusMessage: "用户不存在" });
}
