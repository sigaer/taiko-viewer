import type { Pool, PoolConnection } from "mysql2/promise";
import type { DbRow } from "../../utils/account-db";

export type RemoteLinkIntent = {
  operationId: string;
  status: "not_requested" | "pending" | "linked" | "failed";
  issuer: string;
  subject: string;
};

/** Server-only handoff contract for a future provider-specific link worker.
 * Stable operationId is the future remote idempotency key. This function only
 * reads local intent; it neither queues nor performs a remote link operation. */
export async function readRemoteLinkIntent(db: Pool | PoolConnection, userId: number, issuer: string): Promise<RemoteLinkIntent | null> {
  const [rows] = await db.execute<DbRow<{ remote_link_operation_id: string; remote_link_status: RemoteLinkIntent["status"]; subject: Buffer }>[]>(
    "SELECT remote_link_operation_id, remote_link_status, subject FROM web_external_identities WHERE user_id = ? AND issuer = ? AND status = 'active'", [userId, issuer]);
  const row = rows[0];
  return row ? { operationId: row.remote_link_operation_id, status: row.remote_link_status, issuer, subject: row.subject.toString("utf8") } : null;
}
