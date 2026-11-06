import { httpsUrl, type OidcProvider } from "./config";
import { normalizeEmail } from "../../internal/account/shared";
import type { AccountEmailProfile } from "./account-profile";
import { getAccountDb, type DbRow } from "../../utils/account-db";

export const OURTAIKO_ORIGIN = "https://sso.ourtaiko.org";
export const OURTAIKO_LOOKUP_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 32 * 1024;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "[::1]", "localhost"]);

export class OurTaikoProfileError extends Error {
  constructor(readonly code: "ourtaiko_email_unverified" | "ourtaiko_rate_limited" | "provider_unavailable" = "provider_unavailable", readonly retryAfter?: number) {
    super(code);
  }
}

export function assertOurTaikoSubject(sub: unknown): asserts sub is string {
  if (typeof sub !== "string" || !/^[0-9a-f]{32}$/.test(sub)) throw new OurTaikoProfileError();
}

export function canonicalExternalId(value: unknown): value is string {
  return typeof value === "string" && /^[1-9][0-9]{0,19}$/.test(value) && BigInt(value) <= 18446744073709551615n;
}

export async function ourTaikoTarget(provider: OidcProvider, operation: "lookup" | "link") {
  const issuer = httpsUrl(provider.issuer);
  if (issuer.origin !== OURTAIKO_ORIGIN) {
    // Local mock support is gated by actual test DB identity, not a URL override
    // or an environment name alone. No other staging/remote origin is accepted.
    if (!LOOPBACK_HOSTS.has(issuer.hostname) || process.env.TAIKO_ALLOW_TEST_DB_MUTATION !== "1") throw new OurTaikoProfileError();
    const [rows] = await getAccountDb().query<DbRow<{ name: string }>[]>("SELECT DATABASE() AS name");
    if (!rows[0]?.name?.endsWith("_test")) throw new OurTaikoProfileError();
  }
  return new URL(`/internal/v1/external/${operation}`, issuer.origin);
}

export const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
export const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k));

export async function readOurTaikoJson(response: Response): Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") || "") || !response.body) {
    await response.body?.cancel().catch(() => {});
    throw new OurTaikoProfileError();
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0, text = "", complete = false;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) { complete = true; break; }
      bytes += next.value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) throw new OurTaikoProfileError();
      text += decoder.decode(next.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    if (!complete) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/** Only call after OIDC signature/issuer/audience/nonce validation. Never pass
 * an access token, callback body, user-supplied URL, or request headers here. */
export async function lookupOurTaikoProfile(provider: OidcProvider, verifiedSubject: string, withExternalId = false): Promise<AccountEmailProfile> {
  try {
    assertOurTaikoSubject(verifiedSubject);
    if (provider.id !== "ourtaiko" || !provider.clientSecret || provider.tokenEndpointAuthMethod === "none") throw new OurTaikoProfileError();
    const target = await ourTaikoTarget(provider, "lookup");
    const response = await fetch(target, {
      method: "POST", redirect: "error", credentials: "omit", cache: "no-store",
      headers: { "content-type": "application/json; charset=utf-8", accept: "application/json", "x-service-id": provider.clientId, "x-service-key": provider.clientSecret },
      body: JSON.stringify({ id: verifiedSubject, ...(withExternalId ? { withExternalId: true } : {}) }), signal: AbortSignal.timeout(OURTAIKO_LOOKUP_TIMEOUT_MS)
    });
    const payload = await readOurTaikoJson(response);
    if (!object(payload) || !exactKeys(payload, ["code", "message", "data"]) || typeof payload.code !== "string" || typeof payload.message !== "string") throw new OurTaikoProfileError();
    if (response.status !== 200) {
      const errors: Record<string, number> = { REQUEST_INVALID: 400, SERVICE_UNAUTHORIZED: 401, SERVICE_FORBIDDEN: 403, NOT_FOUND: 404, EMAIL_UNVERIFIED: 409, ALREADY_LINKED: 409, RATE_LIMITED: 429, UNAVAILABLE: 503 };
      if (payload.data !== null || errors[payload.code] !== response.status) throw new OurTaikoProfileError();
      if (payload.code === "EMAIL_UNVERIFIED") throw new OurTaikoProfileError("ourtaiko_email_unverified");
      if (payload.code === "RATE_LIMITED") {
        const retry = response.headers.get("retry-after") || "";
        if (!/^[0-9]{1,8}$/.test(retry)) throw new OurTaikoProfileError();
        throw new OurTaikoProfileError("ourtaiko_rate_limited", Math.max(1, Math.min(3600, Number(retry))));
      }
      // NOT_FOUND includes lack of visibility/disabled users. Never disclose it
      // separately, or return provider-supplied text (including service errors).
      throw new OurTaikoProfileError();
    }
    const data = payload.data;
    if (payload.code !== "OK" || payload.message !== "" || !object(data) || !exactKeys(data, ["id", "nickname", "email", "emailVerified", ...(withExternalId ? ["externalId"] : [])]) || data.id !== verifiedSubject || typeof data.nickname !== "string" || typeof data.email !== "string" || typeof data.emailVerified !== "boolean") throw new OurTaikoProfileError();
    if (withExternalId && data.externalId !== null && !canonicalExternalId(data.externalId)) throw new OurTaikoProfileError();
    if (!data.emailVerified) throw new OurTaikoProfileError("ourtaiko_email_unverified");
    if (!data.email || data.email.length > 255 || /[\x00-\x20\x7f]/.test(data.email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw new OurTaikoProfileError();
    const email = normalizeEmail(data.email);
    return { source: "ourtaiko_external_lookup", email, emailVerified: true, ...(withExternalId ? { externalId: data.externalId as string | null } : {}) };
  } catch (error) {
    // No response body, mail, credential, token or network error cause is logged.
    if (error instanceof OurTaikoProfileError) throw error;
    throw new OurTaikoProfileError();
  }
}
