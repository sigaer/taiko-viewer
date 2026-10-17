import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { PublicationUnavailableError } from "../../infrastructure/taiko-publication/client";
import { assertSourceGrantsRevoked, type SourceLifecycleReceipt } from "./source-lifecycle";
import { RECOVERY_PRODUCT_TABLES, recoveryInsert, type ManualRecoveryData, type RecoveryTable, type RecoveryRow } from "./manual-recovery-data";

type Executor = Pick<Pool, "execute">;
/** Validate before file restoration, then repeat as locking reads in the final
 * authority transaction. Existing/new rows are never overwritten or upserted.
 */
export async function preflightManualRecovery(db: Executor, receipt: SourceLifecycleReceipt, data: ManualRecoveryData, locking = false) {
  const suffix = locking ? " FOR UPDATE" : "";
  const viewerCurrent = new Set<number>();
  const botState = new Map<string, { nextSlot: number; current: boolean }>();
  for (const userId of [...new Set(data.bindings.map(row => Number(row.user_id)))].sort((a, b) => a - b)) {
    const [users] = await db.execute<RowDataPacket[]>("SELECT id FROM web_user_accounts WHERE id=?" + suffix, [userId]);
    if (users.length !== 1) throw new PublicationUnavailableError();
    const [bindings] = await db.execute<RowDataPacket[]>("SELECT id,is_current FROM web_taiko_bindings WHERE user_id=? ORDER BY id LIMIT 129" + suffix, [userId]);
    if (bindings.length > 128) throw new PublicationUnavailableError();
    if (bindings.some(row => Number(row.is_current) === 1)) viewerCurrent.add(userId);
  }
  await assertSourceGrantsRevoked(db, receipt);
  for (const key of data.botBindings.map(row => String(row.qq)).sort()) {
    const [rows] = await db.execute<RowDataPacket[]>("SELECT slot_index,is_current FROM bind WHERE qq=? ORDER BY slot_index,row_id LIMIT 129" + suffix, [key]);
    if (rows.length > 128) throw new PublicationUnavailableError();
    const slots = rows.map(row => Number(row.slot_index));
    if (slots.some(slot => !Number.isSafeInteger(slot) || slot <= 0 || slot >= 1_000_000)) throw new PublicationUnavailableError();
    botState.set(key, { nextSlot: Math.max(0, ...slots) + 1, current: rows.some(row => Number(row.is_current) === 1) });
  }
  const groups: Array<[RecoveryTable, RecoveryRow[], string]> = [
    ["web_taiko_bindings", data.bindings, "id"], ["bind", data.botBindings, "row_id"],
    ...Object.entries(RECOVERY_PRODUCT_TABLES).map(([name, table]) => [table, data.products[name as keyof typeof data.products], name === "cursors" ? "binding_id" : "id"] as [RecoveryTable, RecoveryRow[], string])
  ];
  for (const [table, rows, primary] of groups) {
    for (let index = 0; index < rows.length; index += 500) {
      const ids = rows.slice(index, index + 500).map(row => row[primary]);
      const [existing] = await db.execute<RowDataPacket[]>(
        `SELECT ${primary} FROM ${table} WHERE ${primary} IN (${ids.map(() => "?").join(",")}) LIMIT 1${suffix}`, ids);
      if (existing.length) throw new PublicationUnavailableError();
    }
  }
  return { viewerCurrent, botState };
}

export async function insertManualRecovery(connection: PoolConnection, data: ManualRecoveryData, state: Awaited<ReturnType<typeof preflightManualRecovery>>) {
  const insert = async (table: RecoveryTable, row: RecoveryRow) => {
    const statement = recoveryInsert(table, row);
    await connection.execute(statement.sql, statement.values);
  };
  await insert("taiko_manual_accounts", data.manualAccount);
  for (const original of data.bindings) {
    const userId = Number(original.user_id);
    await insert("web_taiko_bindings", { ...original, is_current: state.viewerCurrent.has(userId) ? 0 : 1 });
    state.viewerCurrent.add(userId);
  }
  for (const original of data.botBindings) {
    const target = state.botState.get(String(original.qq));
    if (!target) throw new PublicationUnavailableError();
    await insert("bind", { ...original, slot_index: target.nextSlot++, is_current: target.current ? 0 : 1 });
    target.current = true;
  }
  for (const [name, table] of Object.entries(RECOVERY_PRODUCT_TABLES)) {
    for (const row of data.products[name as keyof typeof data.products]) await insert(table, row);
  }
  // Old one-time claim codes are deliberately not recovery grants.
}
