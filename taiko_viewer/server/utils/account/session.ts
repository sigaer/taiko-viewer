import type { H3Event } from "h3";
import { setCookie } from "h3";
import type { Pool, PoolConnection } from "mysql2/promise";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_TTL_MS, getSecureCookieFlag, toIso } from "../../internal/account/shared";

/** Shared issuance for password and external login; supports atomic account creation. */
export async function createAccountSession(db: Pool | PoolConnection, userId: number) {
  const sessionToken = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.execute("INSERT INTO web_user_sessions (session_token, user_id, expires_at) VALUES (?, ?, ?)", [sessionToken, userId, expiresAt]);
  return { sessionToken, expiresAt: toIso(expiresAt) };
}

export function setAccountSessionCookie(event: H3Event, session: { sessionToken: string; expiresAt: string }) {
  setCookie(event, SESSION_COOKIE_NAME, session.sessionToken, {
    httpOnly: true, sameSite: "lax", secure: getSecureCookieFlag(event), path: "/", expires: new Date(session.expiresAt)
  });
}
