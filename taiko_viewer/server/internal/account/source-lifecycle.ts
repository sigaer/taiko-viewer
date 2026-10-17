import type { Pool, RowDataPacket } from "mysql2/promise";
import { PublicationUnavailableError } from "../../infrastructure/taiko-publication/client";

export type SourceLifecycleReceipt = RowDataPacket & {
  operation_id: string; taiko_id: string; kind: "manual-delete";
  actor_kind: "viewer" | "bot"; actor_key: string; backup_key: string;
  source_commit_id: string; source_sequence: number;
  status: "pending" | "published" | "restoring" | "restored";
  published_commit_id: string | null;
};
export const LIFECYCLE_RECEIPT_COLUMNS = "operation_id,taiko_id,kind,actor_kind,actor_key,backup_key,source_commit_id,source_sequence,status,published_commit_id";
export const LIFECYCLE_UUID = /^[a-f0-9]{32}$/;
export const MANUAL_SOURCE_ID = /^98[0-9]{16}$/;
/** mysql2 errors can retain the entire private INSERT payload. Keep ordinary
 * product/confirmation errors, but do not propagate driver diagnostics/cause.
 */
export function sourceLifecycleFailure(error: unknown) {
  if (error instanceof Error && !("sql" in error || "sqlState" in error || "sqlMessage" in error || "code" in error)) return error;
  return new PublicationUnavailableError();
}
export function validateSourceLifecycleReceipt(value: SourceLifecycleReceipt) {
  if (!LIFECYCLE_UUID.test(value.operation_id) || !LIFECYCLE_UUID.test(value.backup_key) || !LIFECYCLE_UUID.test(value.source_commit_id) ||
    !MANUAL_SOURCE_ID.test(value.taiko_id) || value.kind !== "manual-delete" ||
    !["viewer", "bot"].includes(value.actor_kind) || !value.actor_key || value.actor_key.length > 191 ||
    !Number.isSafeInteger(Number(value.source_sequence)) || Number(value.source_sequence) < 0 ||
    !["pending", "published", "restoring", "restored"].includes(value.status)) throw new PublicationUnavailableError();
  return value;
}
export async function latestSourceLifecycleReceipt(db: Pool, taikoId: string) {
  const [rows] = await db.execute<SourceLifecycleReceipt[]>(
    `SELECT ${LIFECYCLE_RECEIPT_COLUMNS} FROM taiko_source_lifecycle WHERE taiko_id=? ORDER BY created_at DESC,operation_id DESC LIMIT 1`, [taikoId]);
  return rows[0] ? validateSourceLifecycleReceipt(rows[0]) : undefined;
}
export async function assertSourceGrantsRevoked(db: Pick<Pool, "execute">, receipt: SourceLifecycleReceipt) {
  const [[state]] = await db.execute<RowDataPacket[]>(
    `SELECT (SELECT COUNT(*) FROM taiko_manual_accounts WHERE taiko_id=?) +
      (SELECT COUNT(*) FROM web_taiko_bindings WHERE taiko_id=?) +
      (SELECT COUNT(*) FROM bind WHERE id=? AND source='manual') AS grants`,
    [receipt.taiko_id, receipt.taiko_id, receipt.taiko_id]);
  if (Number(state.grants)) throw new PublicationUnavailableError();
}
