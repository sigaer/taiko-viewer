// Pure request checks for POST /api/metrics/visit. No imports beyond node:net and
// the shared UA rule so they can be unit-tested without Nuxt or MySQL.
import { isIP } from "node:net";
import { isAutomationUserAgent } from "../../utils/admin/automation-ua.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Max distinct devices one network address may register per day before new ones are marked suspect. */
export const VISITOR_DEVICES_PER_IP_CAP = 20;

export const isVisitorDeviceId = (value: unknown): value is string =>
  typeof value === "string" && value.length === 36 && UUID_PATTERN.test(value);

/**
 * Same-origin only: Sec-Fetch-Site must be "same-origin", or (when the browser
 * did not send it) Origin must match the request host.
 */
export const isSameOriginVisit = (headers: { secFetchSite?: string | null; origin?: string | null; host?: string | null }) => {
  const site = String(headers.secFetchSite || "").trim().toLowerCase();
  if (site) return site === "same-origin";
  const origin = String(headers.origin || "").trim();
  const host = String(headers.host || "").trim().toLowerCase();
  if (!origin || !host) return false;
  try {
    return new URL(origin).host.toLowerCase() === host;
  } catch {
    return false;
  }
};

const LOOPBACK_PEERS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/**
 * Client address for the per-address device cap. Nginx overwrites X-Real-IP with
 * remote_addr, so it is trusted only from a loopback peer; X-Forwarded-For is
 * client-controlled and never used.
 */
export const visitClientIp = (peer: string | null | undefined, realIp: string | null | undefined) => {
  const direct = String(peer || "").trim();
  const forwarded = String(realIp || "").trim();
  if (LOOPBACK_PEERS.has(direct) && isIP(forwarded)) return forwarded;
  return direct || "unknown";
};

export const isCountableUserAgent = (ua: unknown) => {
  const value = String(ua || "").trim();
  return Boolean(value) && value !== "-" && !isAutomationUserAgent(value);
};

/** existingDevices = distinct other visitor keys already seen today for this network address. */
export const shouldMarkVisitorSuspect = (existingDevices: number, cap = VISITOR_DEVICES_PER_IP_CAP) =>
  Number(existingDevices) > cap;
