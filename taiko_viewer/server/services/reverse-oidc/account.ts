/** Stable Viewer identity and scope-limited claims.
 * Protocol handling and session-bound consent live in provider.ts/interaction.ts.
 */
import type { Pool } from "mysql2/promise";
import type { DbRow } from "../../utils/account-db";

const DECIMAL_UINT64 = /^[1-9][0-9]{0,19}$/;
const UINT64_MAX = 18446744073709551615n;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function canonicalViewerSubject(input: unknown): string | null {
  if (typeof input !== "string" || !DECIMAL_UINT64.test(input)) return null;
  return BigInt(input) <= UINT64_MAX ? input : null;
}

export type ViewerAccountClaimRow = {
  id: string; // MUST originate from SQL CAST(id AS CHAR), never JS number
  username: string;
  email: string;
  email_verified: number;
};

export function projectViewerOidcClaims(row: ViewerAccountClaimRow, scope: string): Record<string, unknown> {
  const sub = canonicalViewerSubject(row.id);
  if (!sub) throw new Error("Invalid Viewer OIDC subject");
  const result: Record<string, unknown> = { sub };
  const scopes = new Set(scope.split(/\s+/).filter(Boolean));
  if (scopes.has("profile") && typeof row.username === "string" && row.username.length <= 64) {
    result.preferred_username = row.username;
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

export async function findViewerOidcAccount(db: Pick<Pool, "execute">, candidate: unknown) {
  const sub = canonicalViewerSubject(candidate);
  if (!sub) return undefined;
  const [rows] = await db.execute<DbRow<ViewerAccountClaimRow>[]>(
    "SELECT CAST(id AS CHAR) id,username,email,email_verified FROM web_user_accounts WHERE id=CAST(? AS UNSIGNED) LIMIT 1",
    [sub]
  );
  const row = rows[0];
  // CAST the DB integer to string and compare exactly; never let a rounded
  // JavaScript Number become a cross-service identity.
  if (!row || row.id !== sub) return undefined;
  return {
    accountId: sub,
    async claims(_use: "id_token" | "userinfo", scope = "") {
      return projectViewerOidcClaims(row, scope);
    }
  };
}
