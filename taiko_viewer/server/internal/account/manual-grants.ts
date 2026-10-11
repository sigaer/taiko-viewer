import type { Pool, RowDataPacket } from "mysql2/promise";
import { createError } from "h3";
import { getManualAccount, compactManualBotSlots, normalizeManualIdentityKey, type ManualOwner } from "./manual-ownership";
import { PublicationUnavailableError } from "../../infrastructure/taiko-publication/client";
type Executor = Pick<Pool, "execute">;

export function manualActorKey(owner: ManualOwner) {
  if (owner.kind === "bot") return normalizeManualIdentityKey(owner.identityKey);
  if (!Number.isSafeInteger(owner.userId) || owner.userId <= 0) throw createError({ statusCode: 403, statusMessage: "账号归属无效" });
  return String(owner.userId);
}
/** Caller owns source EX; take SQL owner rows before account/claim rows. */
export async function lockManualActor(db: Executor, owner: ManualOwner) {
  const key = manualActorKey(owner);
  if (owner.kind === "viewer") {
    const [users] = await db.execute<RowDataPacket[]>("SELECT id FROM web_user_accounts WHERE id=? FOR UPDATE", [owner.userId]);
    if (!users[0]) throw createError({ statusCode: 403, statusMessage: "账号归属无效" });
    const [rows] = await db.execute<RowDataPacket[]>("SELECT id FROM web_taiko_bindings WHERE user_id=? ORDER BY id LIMIT 129 FOR UPDATE", [owner.userId]);
    if (rows.length > 128) throw new PublicationUnavailableError();
  } else {
    const [rows] = await db.execute<RowDataPacket[]>("SELECT row_id FROM bind WHERE qq=? ORDER BY slot_index,row_id LIMIT 129 FOR UPDATE", [key]);
    if (rows.length > 128) throw new PublicationUnavailableError();
  }
}
export async function setManualViewerCurrent(db: Executor, userId: number, taikoId: string) {
  await db.execute("UPDATE web_taiko_bindings SET is_current = 0 WHERE user_id = ?", [userId]);
  await db.execute("UPDATE web_taiko_bindings SET is_current = 1 WHERE user_id = ? AND taiko_id = ?", [userId, taikoId]);
}
// One attachment implementation shared by creation and claim. The current
// legacy creation caller still needs its own coordinated source/SQL migration.
export async function attachManualViewer(db: Executor, userId: number, taikoId: string) {
  const [owners] = await db.execute<RowDataPacket[]>("SELECT user_id FROM web_taiko_bindings WHERE taiko_id = ? LIMIT 1 FOR UPDATE", [taikoId]);
  if (owners[0] && Number(owners[0].user_id) !== userId) throw createError({ statusCode: 409, statusMessage: "该账号已被其他 viewer 用户持有" });
  await db.execute(`INSERT INTO web_taiko_bindings
    (user_id, taiko_id, source, manual_account_id, is_current, verified_title)
    VALUES (?, ?, 'manual', ?, 1, '手动录入')
    ON DUPLICATE KEY UPDATE source = 'manual', manual_account_id = VALUES(manual_account_id)`, [userId, taikoId, taikoId]);
  await setManualViewerCurrent(db, userId, taikoId);
}
export async function attachManualBot(db: Executor, identityKeyInput: unknown, taikoId: string) {
  const identityKey = normalizeManualIdentityKey(identityKeyInput);
  const account = await getManualAccount(taikoId, db);
  if (account.bot_identity_key && account.bot_identity_key !== identityKey) throw createError({ statusCode: 409, statusMessage: "该账号已被其他 bot 身份持有" });
  const [rows] = await db.execute<RowDataPacket[]>("SELECT slot_index FROM bind WHERE qq = ? ORDER BY slot_index LIMIT 129 FOR UPDATE", [identityKey]);
  if (rows.length > 128) throw new PublicationUnavailableError();
  let nextSlot = 1;
  for (const row of rows) {
    const slot = Number(row.slot_index);
    if (!Number.isSafeInteger(slot) || slot <= 0 || slot >= 1_000_000) throw new PublicationUnavailableError();
    nextSlot = Math.max(nextSlot, slot + 1);
  }
  await db.execute(`INSERT INTO bind (qq, id, visible, slot_index, is_current, source)
    VALUES (?, ?, 0, ?, 1, 'manual') ON DUPLICATE KEY UPDATE source = 'manual'`, [identityKey, taikoId, nextSlot]);
  await db.execute("UPDATE taiko_manual_accounts SET bot_identity_key = ? WHERE taiko_id = ?", [identityKey, taikoId]);
  await compactManualBotSlots(db, identityKey, taikoId);
}
export const attachManualOwner = (db: Executor, owner: ManualOwner, taikoId: string) => owner.kind === "viewer"
  ? attachManualViewer(db, owner.userId, taikoId) : attachManualBot(db, owner.identityKey, taikoId);
