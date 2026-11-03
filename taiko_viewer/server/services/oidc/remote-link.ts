import type { Pool, PoolConnection } from "mysql2/promise";
import type { DbRow } from "../../utils/account-db";
import { getAccountDb } from "../../utils/account-db";
import { randomBytes } from "node:crypto";
import type { OidcProvider } from "./config";
import { linkOurTaiko, type LinkResult } from "./ourtaiko-link";

export type RemoteLinkIntent = {
  operationId: string;
  status: "not_requested" | "pending" | "linked" | "failed";
  issuer: string;
  subject: string;
};

/** Read-only server handoff; operation ID is local audit correlation. The remote
 * protocol's idempotency key is the exact Application + subject + externalId. */
export async function readRemoteLinkIntent(db: Pool | PoolConnection, userId: number, issuer: string): Promise<RemoteLinkIntent | null> {
  const [rows] = await db.execute<DbRow<{ remote_link_operation_id: string; remote_link_status: RemoteLinkIntent["status"]; subject: Buffer }>[]>(
    "SELECT remote_link_operation_id, remote_link_status, subject FROM web_external_identities WHERE user_id = ? AND issuer = ? AND status = 'active'", [userId, issuer]);
  const row = rows[0];
  return row ? { operationId: row.remote_link_operation_id, status: row.remote_link_status, issuer, subject: row.subject.toString("utf8") } : null;
}

type Identity = { remote_link_operation_id: string; remote_link_status: string; external_id: string };
type Attempt = { attempt_id: string; service_id: string; outcome: string; leased: number; cooling: number };

/** Only the validated fresh-OIDC callback invokes this. There is deliberately
 * no session-only HTTP retry endpoint, background worker or persisted token. */
export async function completeOurTaikoLink(provider: OidcProvider, userId: number, subject: string, assertSession: (db: PoolConnection) => Promise<void>): Promise<string> {
  if (provider.id !== "ourtaiko" || !provider.remoteLinkEnabled) return "not_requested";
  for (let retry = 0; retry < 2; retry++) {
    const db = await getAccountDb().getConnection();
    const attemptId = randomBytes(32).toString("hex");
    let identity: Identity;
    try {
      await db.beginTransaction();
      await assertSession(db);
      const [rows] = await db.execute<DbRow<Identity>[]>(`SELECT remote_link_operation_id, remote_link_status, CAST(user_id AS CHAR) external_id
        FROM web_external_identities WHERE user_id=? AND issuer=? AND subject=? AND status='active' FOR UPDATE`, [userId, provider.issuer, subject]);
      if (!rows.length) { await db.rollback(); return "pending"; }
      identity = rows[0];
      const [attempts] = await db.execute<DbRow<Attempt>[]>(`SELECT attempt_id, service_id, outcome, lease_until>NOW() leased, retry_at>NOW() cooling
        FROM web_oidc_remote_link_attempts WHERE operation_id=? ORDER BY created_at DESC, attempt_id DESC LIMIT 1 FOR UPDATE`, [identity.remote_link_operation_id]);
      const previous = attempts[0];
      if (previous && previous.service_id !== provider.clientId) { await db.rollback(); return "failed"; }
      if (identity.remote_link_status === "linked") { await db.rollback(); return "linked"; }
      if (previous && ((previous.outcome === "pending" && previous.leased) || previous.cooling)) { await db.rollback(); return identity.remote_link_status; }
      if (previous?.outcome === "pending") await db.execute("UPDATE web_oidc_remote_link_attempts SET outcome='unknown', error_code='lease_expired' WHERE attempt_id=?", [previous.attempt_id]);
      await db.execute(`INSERT INTO web_oidc_remote_link_attempts (attempt_id, operation_id, issuer, subject, service_id, external_id, outcome, lease_until)
        VALUES (?,?,?,?,?,?,'pending',DATE_ADD(NOW(), INTERVAL 2 MINUTE))`, [attemptId, identity.remote_link_operation_id, provider.issuer, subject, provider.clientId, identity.external_id]);
      await db.execute("UPDATE web_external_identities SET remote_link_status='pending' WHERE remote_link_operation_id=?", [identity.remote_link_operation_id]);
      await db.commit();
    } catch (error) { await db.rollback(); throw error; }
    finally { db.release(); }

    // No connection, transaction or Session row lock remains held here.
    const result: LinkResult = await linkOurTaiko(provider, subject, identity.external_id);
    const confirmation = await getAccountDb().getConnection();
    try {
      await confirmation.beginTransaction();
      // The remote fact belongs to the immutable pair, regardless of browser
      // logout during HTTP. Session delivery is checked separately afterwards.
      await confirmation.execute("SELECT id FROM web_external_identities WHERE remote_link_operation_id=? FOR UPDATE", [identity.remote_link_operation_id]);
      const [latest] = await confirmation.execute<DbRow<{ attempt_id: string }>[]>("SELECT attempt_id FROM web_oidc_remote_link_attempts WHERE operation_id=? ORDER BY created_at DESC, attempt_id DESC LIMIT 1 FOR UPDATE", [identity.remote_link_operation_id]);
      if (latest[0]?.attempt_id !== attemptId) { await confirmation.rollback(); return "pending"; }
      await confirmation.execute(`UPDATE web_oidc_remote_link_attempts SET outcome=?, error_code=?, remote_linked_at=?,
        retry_at=IF(? IS NULL,NULL,DATE_ADD(NOW(), INTERVAL ? SECOND)) WHERE attempt_id=?`, [result.outcome, result.code || null, result.linkedAt || null, result.retryAfter ?? null, result.retryAfter ?? null, attemptId]);
      await confirmation.execute("UPDATE web_external_identities SET remote_link_status=? WHERE remote_link_operation_id=?", [result.outcome === "unknown" ? "pending" : result.outcome, identity.remote_link_operation_id]);
      await confirmation.commit();
    } catch {
      await confirmation.rollback().catch(() => {});
      // A remote commit can precede this failure. Keep the durable pending lease
      // and exact pair; a later fresh authorization safely repeats that pair.
      return "pending";
    } finally { confirmation.release(); }
    if (result.outcome !== "unknown" || retry === 1) return result.outcome === "unknown" ? "pending" : result.outcome;
  }
  return "pending";
}
