/** Stable Viewer identity and scope-limited claims.
 * Protocol handling and session-bound consent live in provider.ts/interaction.ts.
 */
import type { Pool } from "mysql2/promise";
import type { DbRow } from "../../utils/account-db";

const DECIMAL_UINT64 = /^[1-9][0-9]{0,19}$/;
const UINT64_MAX = 18446744073709551615n;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const OURTAIKO_IDENTITY_ISSUER = "https://sso.ourtaiko.org";

export function canonicalViewerSubject(input: unknown): string | null {
  if (typeof input !== "string" || !DECIMAL_UINT64.test(input)) return null;
  return BigInt(input) <= UINT64_MAX && BigInt(input).toString() === input ? input : null;
}

export type ViewerAccountClaimRow = {
  id: string; // MUST originate from SQL CAST(id AS CHAR), never JS number
  username: string;
  email: string;
  email_verified: number;
  ourtaiko_subject?: string | null;
};

export function projectViewerOidcClaims(row: ViewerAccountClaimRow, scope: string, clientId = ""): Record<string, unknown> {
  const sub = canonicalViewerSubject(row.id);
  if (!sub) throw new Error("Invalid Viewer OIDC subject");
  const result: Record<string, unknown> = { sub };
  const scopes = new Set(scope.split(/\s+/).filter(Boolean));
  if (clientId !== "OurTaiko") return result;
  if (scopes.has("profile") && typeof row.username === "string" && row.username.length <= 64) {
    result.preferred_username = row.username;
  }
  if (scopes.has("profile") && row.ourtaiko_subject != null) {
    // A local identity is a collision hint, never proof of a confirmed remote link.
    // Fail closed on corrupt mappings rather than permitting accidental signup.
    if (typeof row.ourtaiko_subject !== "string" || row.ourtaiko_subject.length !== 32 || !/^[a-f0-9]{32}$/.test(row.ourtaiko_subject))
      throw new Error("Invalid OurTaiko identity mapping");
    result.ourtaiko_sub = row.ourtaiko_subject;
  }
  if (scopes.has("email")) {
    const isVerified = Boolean(row.email_verified === 1 &&
      typeof row.email === "string" && row.email.length > 0 && row.email.length <= 255 &&
      EMAIL.test(row.email));
    result.email_verified = isVerified;
    if (isVerified) result.email = row.email;
  }
  return result;
}

export async function findViewerOidcAccount(db: Pick<Pool, "execute">, candidate: unknown, clientId = "") {
  const sub = canonicalViewerSubject(candidate);
  if (!sub || clientId !== "OurTaiko") return undefined;
  const [rows] = await db.execute<DbRow<ViewerAccountClaimRow>[]>(
    `SELECT CAST(a.id AS CHAR) id,a.username,a.email,a.email_verified,CAST(i.subject AS CHAR) ourtaiko_subject
      FROM web_user_accounts a LEFT JOIN web_external_identities i
        ON i.user_id=a.id AND i.issuer=?
      WHERE a.id=CAST(? AS UNSIGNED) LIMIT 1`,
    [OURTAIKO_IDENTITY_ISSUER, sub]
  );
  const row = rows[0];
  // CAST the DB integer to string and compare exactly; never let a rounded
  // JavaScript Number become a cross-service identity.
  if (!row || row.id !== sub) return undefined;
  return {
    accountId: sub,
    async claims(_use: "id_token" | "userinfo", scope = "") {
      return projectViewerOidcClaims(row, scope, clientId);
    }
  };
}
