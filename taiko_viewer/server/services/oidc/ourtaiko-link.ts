import type { OidcProvider } from "./config";
import { assertOurTaikoSubject, exactKeys, object, ourTaikoTarget, readOurTaikoJson } from "./ourtaiko-profile";

export type LinkResult = { outcome: "linked" | "failed" | "unknown"; code?: string; retryAfter?: number; linkedAt?: string };

/** Request-local fresh OIDC authorization is enforced by the callback caller.
 * OurTaiko checks its own token ledger; no OAuth token belongs in this request. */
export async function linkOurTaiko(provider: OidcProvider, subject: string, externalId: string): Promise<LinkResult> {
  try {
    assertOurTaikoSubject(subject);
    if (provider.id !== "ourtaiko" || !provider.remoteLinkEnabled || !provider.clientSecret || provider.tokenEndpointAuthMethod === "none" ||
      !/^[1-9][0-9]{0,19}$/.test(externalId) || BigInt(externalId) > 18446744073709551615n) return { outcome: "failed", code: "invalid_configuration" };
    const response = await fetch(await ourTaikoTarget(provider, "link"), {
      method: "POST", redirect: "error", credentials: "omit", cache: "no-store",
      headers: { "content-type": "application/json; charset=utf-8", accept: "application/json", "x-service-id": provider.clientId, "x-service-key": provider.clientSecret },
      body: JSON.stringify({ id: subject, externalId }), signal: AbortSignal.timeout(8_000)
    });
    const payload = await readOurTaikoJson(response);
    if (!object(payload) || !exactKeys(payload, ["code", "message", "data"]) || typeof payload.code !== "string" || typeof payload.message !== "string") return { outcome: "unknown", code: "invalid_response" };
    if (response.status === 200) {
      const data = payload.data;
      if (payload.code !== "OK" || payload.message !== "" || !object(data) || !exactKeys(data, ["id", "externalId", "linkedAt"]) || data.id !== subject || data.externalId !== externalId ||
        typeof data.linkedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(data.linkedAt) || !Number.isFinite(Date.parse(data.linkedAt))) return { outcome: "unknown", code: "invalid_response" };
      return { outcome: "linked", linkedAt: data.linkedAt };
    }
    const statuses: Record<string, number> = { REQUEST_INVALID: 400, SERVICE_UNAUTHORIZED: 401, SERVICE_FORBIDDEN: 403, NOT_FOUND: 404, ALREADY_LINKED: 409, RATE_LIMITED: 429, UNAVAILABLE: 503 };
    if (payload.data !== null || statuses[payload.code] !== response.status) return { outcome: "unknown", code: "invalid_response" };
    if (payload.code === "UNAVAILABLE") return { outcome: "unknown", code: "unavailable" };
    if (payload.code === "RATE_LIMITED") {
      const retry = response.headers.get("retry-after") || "";
      if (!/^[0-9]{1,8}$/.test(retry)) return { outcome: "unknown", code: "invalid_response" };
      return { outcome: "failed", code: "rate_limited", retryAfter: Math.max(1, Math.min(3600, Number(retry))) };
    }
    const codes: Record<string, string> = { ALREADY_LINKED: "conflict", NOT_FOUND: "reauthorize", SERVICE_UNAUTHORIZED: "service_rejected", SERVICE_FORBIDDEN: "service_rejected", REQUEST_INVALID: "request_rejected" };
    return { outcome: "failed", code: codes[payload.code] };
  } catch {
    // Never log upstream text, transport errors, credentials or request bodies.
    return { outcome: "unknown", code: "transport_unknown" };
  }
}
