import type { RowDataPacket } from "mysql2/promise";
import { ensureAccountSchema, getAccountDb } from "../../utils/account-db";
import { recoverOneManualSourceDeletion } from "./manual-lifecycle";
import { recoverOneManualSourceRestoration } from "./manual-recovery";
import { LIFECYCLE_UUID } from "../../internal/account/source-lifecycle";
import { PublicationUnavailableError } from "../../infrastructure/taiko-publication/client";

/** One due operation across both queues; restores must already be admitted by
 * the trusted coordinator. Retry timestamps keep failed sources from starving
 * the other kind, without starting two source jobs during a single tick.
 */
export async function recoverOneManualSourceLifecycle(signal?: AbortSignal, operationId?: string) {
  if (operationId && !LIFECYCLE_UUID.test(operationId)) throw new PublicationUnavailableError();
  signal?.throwIfAborted();
  await ensureAccountSchema();
  signal?.throwIfAborted();
  const db = getAccountDb();
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT operation_id,status FROM taiko_source_lifecycle WHERE status IN ('pending','restoring')
      AND ${operationId ? "operation_id=?" : "(last_attempt_at IS NULL OR last_attempt_at < DATE_SUB(NOW(3),INTERVAL 60 SECOND))"}
      ORDER BY last_attempt_at,created_at,operation_id LIMIT 1`, operationId ? [operationId] : []);
  if (!rows[0]) return { recovered: false };
  return rows[0].status === "restoring"
    ? recoverOneManualSourceRestoration(signal, rows[0].operation_id, db)
    : recoverOneManualSourceDeletion(signal, rows[0].operation_id, db);
}
