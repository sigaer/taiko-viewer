import { createHash, randomBytes } from "node:crypto";
import type { H3Event } from "h3";
import { createError, deleteCookie, getCookie, getHeader, getRouterParam, readBody, sendRedirect, setCookie, setHeader } from "h3";
import type { PoolConnection, ResultSetHeader } from "mysql2/promise";
import { getAccountDb, type DbRow } from "../../utils/account-db";
import { schemaRequirement, validateSchemaTables } from "../../utils/account-schema-runtime";
import { getAccountUserFromEvent, requireAccountUser } from "../../utils/account/auth";
import { createAccountSession, setAccountSessionCookie } from "../../utils/account/session";
import { SESSION_COOKIE_NAME, sha256 } from "../../internal/account/shared";
import { oidcProvider, oidcProviders, safeOidcReturnPath, type OidcProvider } from "./config";
import { client, discoverOidc } from "./protocol";
import { OIDC_TABLES } from "./schema";
import { type AccountEmailProfile, profileFromIdToken } from "./account-profile";
import { assertOurTaikoSubject, lookupOurTaikoProfile, OurTaikoProfileError } from "./ourtaiko-profile";
import { completeOurTaikoLink } from "./remote-link";

type FailureCode = "invalid_transaction" | "session_changed" | "email_required" | "email_conflict" | "identity_conflict" | "provider_unavailable" | "existing_viewer_required";
class OidcFailure extends Error {
  constructor(readonly code: FailureCode) { super(code); }
}
type Transaction = {
  state_hash: string; browser_hash: string; provider_id: string; config_hash: string;
  nonce: string; verifier: string; purpose: "login" | "link"; target_user_id: number | null;
  recovery_subject: Buffer | string | null; recovery_external_id: string | null;
  session_hash: string | null; return_path: string; locale: string;
};
const cookieName = (id: string) => `stv_oidc_${id}`;
const recoveryCookie = "stv_oidc_recovery";
const recoveryCookieOptions = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/api/account/oidc", maxAge: 600 };
// This is a short-lived hint in the existing transaction table, never a login
// credential or a second identity mapping. Confirmation requires fresh OIDC.
async function readRecovery(event: H3Event, provider: OidcProvider) {
  const raw = getCookie(event, recoveryCookie) || "";
  const [state, browser, ...extra] = raw.split(".");
  if (extra.length || !/^[A-Za-z0-9_-]{20,128}$/.test(state || "") || !/^[a-f0-9]{64}$/.test(browser || "")) return null;
  const [rows] = await getAccountDb().execute<DbRow<Transaction>[]>(`SELECT * FROM web_oidc_transactions
    WHERE state_hash=? AND browser_hash=? AND provider_id=? AND config_hash=? AND purpose='login'
    AND consumed_at IS NOT NULL AND expires_at>NOW() AND recovery_subject IS NOT NULL AND recovery_external_id IS NOT NULL`,
    [sha256(state), sha256(browser), provider.id, fingerprint(provider)]);
  return rows[0] || null;
}
async function exactSessionUser(event: H3Event) {
  const [rows] = await getAccountDb().execute<DbRow<{ id: string }>[]>(
    "SELECT CAST(user_id AS CHAR) id FROM web_user_sessions WHERE session_token=? AND expires_at>NOW()",
    [getCookie(event, SESSION_COOKIE_NAME) || ""]);
  return rows[0]?.id;
}
const fingerprint = (provider: OidcProvider) => sha256(JSON.stringify(provider));
const schema = () => validateSchemaTables(getAccountDb(), OIDC_TABLES.map(schemaRequirement), "oidc");
const noStore = (event: H3Event) => {
  setHeader(event, "cache-control", "no-store");
  setHeader(event, "referrer-policy", "no-referrer");
};

export async function listOidcProviders(event: H3Event) {
  noStore(event);
  return { providers: oidcProviders().map(({ id, label }) => ({ id, label })) };
}

export async function oidcBindingStatus(event: H3Event) {
  noStore(event);
  const providers = oidcProviders();
  if (!providers.length) return { providers: [] };
  const user = await requireAccountUser(event);
  await schema();
  const [rows] = await getAccountDb().execute<DbRow<{ issuer: Buffer; status: string; remote_link_status: string; error_code: string | null; outcome: string | null; lease_expired: number | null; service_id: string | null }>[]>(
    `SELECT i.issuer, i.status, i.remote_link_status, a.error_code, a.outcome, a.lease_until<=NOW() lease_expired, a.service_id FROM web_external_identities i
      LEFT JOIN web_oidc_remote_link_attempts a ON a.attempt_id=(SELECT attempt_id FROM web_oidc_remote_link_attempts
        WHERE operation_id=i.remote_link_operation_id ORDER BY created_at DESC, attempt_id DESC LIMIT 1) WHERE i.user_id = ?`, [user.id]
  );
  const ourtaiko = providers.find(p => p.id === "ourtaiko");
  const recovery = ourtaiko ? await readRecovery(event, ourtaiko) : null;
  const recoveryMatches = recovery && await exactSessionUser(event) === recovery.recovery_external_id;
  return { providers: providers.map(({ id, label, issuer, clientId, remoteLinkEnabled }) => {
    const row = rows.find(r => r.issuer.toString("utf8") === issuer);
    const changed = row?.service_id && row.service_id !== clientId;
    return { id, label, recoveryAvailable: id === "ourtaiko" && Boolean(recoveryMatches), recoveryConflict: id === "ourtaiko" && Boolean(recovery && !recoveryMatches), linked: row?.status === "active", remoteLinkEnabled,
      remoteLinkStatus: changed ? "failed" : row?.remote_link_status || "not_requested",
      remoteLinkError: changed ? "application_changed" : row?.error_code || null,
      remoteLinkUnknown: row?.outcome === "unknown" || (row?.outcome === "pending" && Boolean(row.lease_expired)) };
  }) };
}

export async function startOidc(event: H3Event) {
  noStore(event);
  const provider = oidcProvider(getRouterParam(event, "provider") || "");
  // A top-level GET callback is permitted by SameSite=Lax; starts must be an
  // explicit same-origin POST to prevent a cross-site account binding prompt.
  if (getHeader(event, "origin") !== new URL(provider.redirectUri).origin) throw createError({ statusCode: 403, statusMessage: "Invalid origin" });
  const body = await readBody(event);
  if (body?.purpose !== "login" && body?.purpose !== "link") throw createError({ statusCode: 400, statusMessage: "Invalid purpose" });
  const user = body.purpose === "link" ? await requireAccountUser(event) : await getAccountUserFromEvent(event);
  // Browser round trips deliberately use only the existing HttpOnly session cookie.
  const session = user ? getCookie(event, SESSION_COOKIE_NAME) || "" : "";
  if (user && !session) throw createError({ statusCode: 401, statusMessage: "Browser session required" });
  await schema();
  const recovery = body.recover === true && provider.id === "ourtaiko" && body.purpose === "link" ? await readRecovery(event, provider) : null;
  if (body.recover === true && (!recovery || !provider.remoteLinkEnabled || await exactSessionUser(event) !== recovery.recovery_external_id))
    throw createError({ statusCode: 409, statusMessage: "Account confirmation unavailable; sign in to the original Viewer account" });
  let config: Awaited<ReturnType<typeof discoverOidc>>;
  try { config = await discoverOidc(provider); } catch { throw createError({ statusCode: 503, statusMessage: "External login unavailable" }); }
  const state = client.randomState(), nonce = client.randomNonce(), verifier = client.randomPKCECodeVerifier();
  const browser = randomBytes(32).toString("hex");
  const locale = body.locale === "ja" ? "ja" : "zh";
  const returnPath = safeOidcReturnPath(body.redirect, locale === "ja" ? "/ja/account/profile" : "/account/profile");
  const url = client.buildAuthorizationUrl(config, {
    response_type: "code", response_mode: "query", redirect_uri: provider.redirectUri, scope: provider.scopes.join(" "),
    state, nonce, code_challenge: await client.calculatePKCECodeChallenge(verifier), code_challenge_method: "S256",
    ...(body.purpose === "link" ? { prompt: "select_account" } : {})
  });
  const db = getAccountDb();
  // Bounded retention of secrets; expired rows are never accepted, even before cleanup.
  await db.execute("DELETE FROM web_oidc_transactions WHERE expires_at < DATE_SUB(NOW(), INTERVAL 1 DAY) LIMIT 100");
  await db.execute(`INSERT INTO web_oidc_transactions
    (state_hash, browser_hash, provider_id, config_hash, nonce, verifier, purpose, target_user_id, session_hash, return_path, locale, recovery_subject, recovery_external_id, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
  [sha256(state), sha256(browser), provider.id, fingerprint(provider), nonce, verifier, body.purpose,
    user?.id || null, session ? sha256(session) : null, returnPath, locale, recovery?.recovery_subject || null, recovery?.recovery_external_id || null]);
  setCookie(event, cookieName(provider.id), browser, { httpOnly: true, secure: true, sameSite: "lax", path: `/api/account/oidc/${provider.id}`, maxAge: 600 });
  return { authorizationUrl: url.href };
}

async function assertStartingSession(db: PoolConnection, event: H3Event, tx: Transaction) {
  const session = getCookie(event, SESSION_COOKIE_NAME) || "";
  if ((session ? sha256(session) : null) !== tx.session_hash) throw new OidcFailure("session_changed");
  if (tx.session_hash) {
    const [rows] = await db.execute<DbRow<{ user_id: number }>[]>(
      "SELECT user_id FROM web_user_sessions WHERE session_token = ? AND expires_at > NOW() FOR UPDATE", [session]);
    if (!rows.length || rows[0].user_id !== tx.target_user_id) throw new OidcFailure("session_changed");
  } else if (tx.purpose === "link") throw new OidcFailure("session_changed");
}

async function finishIdentity(event: H3Event, provider: OidcProvider, tx: Transaction, sub: string, profile: AccountEmailProfile | null) {
  if (fingerprint(oidcProvider(provider.id)) !== tx.config_hash) throw new OidcFailure("invalid_transaction");
  const db = await getAccountDb().getConnection();
  let newSession: Awaited<ReturnType<typeof createAccountSession>> | undefined;
  let userId: number | undefined;
  try {
    await db.beginTransaction();
    await assertStartingSession(db, event, tx);
    if (tx.recovery_subject && (tx.purpose !== "link" || tx.recovery_subject.toString() !== sub)) throw new OidcFailure("identity_conflict");
    const expected = tx.recovery_external_id || profile?.externalId;
    if (expected) {
      if (tx.purpose !== "link") throw new OidcFailure("existing_viewer_required");
      const [owner] = await db.execute<DbRow<{ id: string }>[]>("SELECT CAST(user_id AS CHAR) id FROM web_user_sessions WHERE session_token=? AND expires_at>NOW()", [getCookie(event, SESSION_COOKIE_NAME) || ""]);
      if (owner[0]?.id !== expected || (profile?.externalId && profile.externalId !== expected)) throw new OidcFailure("identity_conflict");
    }
    const [identities] = await db.execute<DbRow<{ user_id: number; status: string }>[]>(
      "SELECT user_id, status FROM web_external_identities WHERE issuer = ? AND subject = ? FOR UPDATE", [provider.issuer, sub]);
    userId = identities[0]?.user_id;
    if (identities.length) {
      if (identities[0].status !== "active" || (tx.purpose === "link" && userId !== tx.target_user_id)) throw new OidcFailure("identity_conflict");
    } else {
      if (tx.purpose === "link") {
        userId = tx.target_user_id!;
      } else {
        // The existing account schema requires a real recoverable email. Never
        // synthesize an email or turn an unverified claim into local ownership.
        const email = profile?.email || "";
        if (!profile?.emailVerified || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new OidcFailure("email_required");
        const [existing] = await db.execute<DbRow<{ id: number }>[]>("SELECT id FROM web_user_accounts WHERE email = ? OR username = ?", [email, email]);
        if (existing.length) throw new OidcFailure("email_conflict");
        try {
          const [created] = await db.execute<ResultSetHeader>(
            "INSERT INTO web_user_accounts (username, email, password_hash, email_verified) VALUES (?, ?, 'oidc-only', 1)",
            [`viewer_${randomBytes(16).toString("hex")}`, email]);
          userId = created.insertId;
        } catch (error: any) {
          if (error?.code === "ER_DUP_ENTRY") throw new OidcFailure("email_conflict");
          throw error;
        }
      }
      await db.execute(`INSERT INTO web_external_identities
        (user_id, provider_id, issuer, subject, status, remote_link_operation_id) VALUES (?, ?, ?, ?, 'active', ?)`,
      [userId, provider.id, provider.issuer, sub, randomBytes(32).toString("hex")]);
    }
    if (tx.purpose === "login") newSession = await createAccountSession(db, userId!);
    await db.commit();
  } catch (error: any) {
    await db.rollback();
    if (["ER_DUP_ENTRY", "ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"].includes(error?.code)) throw new OidcFailure("identity_conflict");
    throw error;
  } finally { db.release(); }
  return { userId: userId!, newSession };
}

export async function callbackOidc(event: H3Event) {
  noStore(event);
  // Disabled/unknown providers fail before DB access or any account/session changes.
  const provider = oidcProvider(getRouterParam(event, "provider") || "");
  let tx: Transaction | undefined;
  let issuedSession: Awaited<ReturnType<typeof createAccountSession>> | undefined;
  try {
    await schema();
    const incoming = new URL(event.node.req.url || "", new URL(provider.redirectUri).origin);
    const state = incoming.searchParams.get("state") || "";
    const browser = getCookie(event, cookieName(provider.id)) || "";
    if (!/^[A-Za-z0-9_-]{20,128}$/.test(state) || !/^[a-f0-9]{64}$/.test(browser) || [...incoming.searchParams.keys()].some(k => incoming.searchParams.getAll(k).length !== 1)) throw new OidcFailure("invalid_transaction");
    const db = getAccountDb();
    const [claimed] = await db.execute<ResultSetHeader>(`UPDATE web_oidc_transactions SET consumed_at = NOW()
      WHERE state_hash = ? AND browser_hash = ? AND provider_id = ? AND config_hash = ? AND consumed_at IS NULL AND expires_at > NOW()`,
    [sha256(state), sha256(browser), provider.id, fingerprint(provider)]);
    if (claimed.affectedRows !== 1) throw new OidcFailure("invalid_transaction");
    const [rows] = await db.execute<DbRow<Transaction>[]>("SELECT * FROM web_oidc_transactions WHERE state_hash = ?", [sha256(state)]);
    tx = rows[0];
    deleteCookie(event, cookieName(provider.id), { secure: true, httpOnly: true, sameSite: "lax", path: `/api/account/oidc/${provider.id}` });
    // Check before contacting the provider, and recheck under a session row lock
    // inside the final commit to reject logout/account switch during exchange.
    const check = await db.getConnection();
    try { await assertStartingSession(check, event, tx); } finally { check.release(); }
    const config = await discoverOidc(provider);
    const currentUrl = new URL(provider.redirectUri);
    currentUrl.search = incoming.search;
    const tokens = await client.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: tx.verifier, expectedState: state, expectedNonce: tx.nonce, idTokenExpected: true
    });
    const claims = tokens.claims();
    if (!claims) throw new OidcFailure("provider_unavailable");
    // These optional token-endpoint hashes are not mandatory in pure code flow.
    // When present, verify them against the actual code/access token. All allowed
    // signing algorithms use SHA-256; signature validation remains in the library.
    for (const [claim, value] of [["c_hash", incoming.searchParams.get("code")], ["at_hash", tokens.access_token]] as const) {
      if (claims[claim] !== undefined && (typeof value !== "string" || claims[claim] !== createHash("sha256").update(value).digest().subarray(0, 16).toString("base64url"))) throw new OidcFailure("provider_unavailable");
    }
    if (claims.azp !== undefined && claims.azp !== provider.clientId) throw new OidcFailure("provider_unavailable");
    const sub = claims.sub;
    if (typeof sub !== "string" || !/^[\x00-\x7f]{1,255}$/.test(sub)) throw new OidcFailure("provider_unavailable");
    let profile: AccountEmailProfile | null;
    if (provider.id === "ourtaiko") {
      assertOurTaikoSubject(sub);
      // Protocol 0.1 §5.1: established identities log in without another lookup.
      // This is a read-only preflight, outside the final write transaction. If
      // that identity disappears, the final transaction cannot create without a profile.
      const [existing] = tx.purpose === "login"
        ? await db.execute<DbRow<{ user_id: number }>[]>("SELECT user_id FROM web_external_identities WHERE issuer = ? AND subject = ?", [provider.issuer, sub])
        : [[]];
      profile = existing.length ? null : await lookupOurTaikoProfile(provider, sub, true);
    } else profile = profileFromIdToken(claims);
    if (tx.purpose === "login" && profile?.externalId) {
      // Preserve only the verified subject and conflict hint. No OAuth tokens.
      await db.execute("UPDATE web_oidc_transactions SET recovery_subject=?, recovery_external_id=? WHERE state_hash=?", [sub, profile.externalId, tx.state_hash]);
      setCookie(event, recoveryCookie, `${state}.${browser}`, recoveryCookieOptions);
      throw new OidcFailure("existing_viewer_required");
    }
    const identity = await finishIdentity(event, provider, tx, sub, profile);
    issuedSession = identity.newSession;
    const remoteStatus = await completeOurTaikoLink(provider, identity.userId, sub, async connection => {
      if (fingerprint(oidcProvider(provider.id)) !== tx!.config_hash) throw new OidcFailure("invalid_transaction");
      await assertStartingSession(connection, event, tx!);
    });
    // Remote HTTP never controls the target account or changes local identity.
    // Do not deliver a newly issued Session after logout during that request.
    const finalCheck = await db.getConnection();
    try {
      await finalCheck.beginTransaction();
      if (fingerprint(oidcProvider(provider.id)) !== tx.config_hash) throw new OidcFailure("invalid_transaction");
      await assertStartingSession(finalCheck, event, tx);
      if (issuedSession) {
        const [sessions] = await finalCheck.execute<DbRow<{ user_id: number }>[]>("SELECT user_id FROM web_user_sessions WHERE session_token=? AND expires_at>NOW() FOR UPDATE", [issuedSession.sessionToken]);
        if (sessions[0]?.user_id !== identity.userId) throw new OidcFailure("session_changed");
      }
      await finalCheck.commit();
    } catch (error) { await finalCheck.rollback(); throw error; }
    finally { finalCheck.release(); }
    if (issuedSession) setAccountSessionCookie(event, issuedSession);
    issuedSession = undefined;
    if (tx.purpose === "link") deleteCookie(event, recoveryCookie, recoveryCookieOptions);
    // Access/refresh/ID tokens are request-local only and never persisted or returned.
    return sendRedirect(event, provider.remoteLinkEnabled && remoteStatus !== "linked"
      ? `${tx.locale === "ja" ? "/ja" : ""}/account/profile` : safeOidcReturnPath(tx.return_path), 303);
  } catch (error) {
    if (issuedSession) await getAccountDb().execute("DELETE FROM web_user_sessions WHERE session_token=?", [issuedSession.sessionToken]).catch(() => {});
    // Deliberately do not log protocol errors: providers can embed codes/tokens.
    const code = error instanceof OidcFailure || error instanceof OurTaikoProfileError ? error.code : "provider_unavailable";
    if (error instanceof OurTaikoProfileError && error.retryAfter !== undefined) setHeader(event, "retry-after", String(error.retryAfter));
    const prefix = (tx?.locale || getCookie(event, "viewer_locale")) === "ja" ? "/ja" : "";
    const target = tx?.purpose === "link" ? "/account/profile" : "/account/login";
    return sendRedirect(event, `${prefix}${target}?oidc_error=${code}${code === "existing_viewer_required" ? "&redirect=" + encodeURIComponent(prefix + "/account/profile") : ""}`, 303);
  }
}
