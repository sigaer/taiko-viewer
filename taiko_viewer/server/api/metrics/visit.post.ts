import { defineEventHandler, getHeader, readRawBody, setResponseStatus } from "h3";
import type { RowDataPacket } from "mysql2/promise";
import { getAccountDb } from "~/server/utils/account-db";
import { setPrivateNoStore } from "~/server/utils/cache-policy";
import { readSessionTokenFromEvent } from "~/server/internal/account/shared";
import { TRAFFIC_SOURCE } from "~/server/utils/admin/traffic-rules";
import { recordVisit } from "~/server/services/user-activity/visit-recorder";
import { isCountableUserAgent, isSameOriginVisit, isVisitorDeviceId, visitClientIp } from "~/server/services/user-activity/visit-rules";

// Qualified-visit beacon (plugins/visit-beacon.client.ts). Always answers 204
// with no body; anything invalid is silently not counted.
let trafficSalt: string | null = null;
const getTrafficSalt = async () => {
  if (trafficSalt) return trafficSalt;
  const [rows] = await getAccountDb().query<RowDataPacket[]>(
    "SELECT state_json FROM web_admin_ingest_state WHERE source_key = ? LIMIT 1",
    [TRAFFIC_SOURCE]
  );
  const salt = rows[0] ? String(JSON.parse(String(rows[0].state_json || "{}")).salt || "") : "";
  // The salt is created by traffic ingestion; until it exists nothing is counted.
  if (salt) trafficSalt = salt;
  return trafficSalt;
};

const lookupSessionUserId = async (token: string) => {
  if (!token) return null;
  // Read-only lookup: last_seen_at is maintained by the normal authenticated requests.
  const [rows] = await getAccountDb().query<RowDataPacket[]>(
    "SELECT user_id FROM web_user_sessions WHERE session_token = ? AND expires_at > NOW() LIMIT 1",
    [token]
  );
  const id = Number(rows[0]?.user_id || 0);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export default defineEventHandler(async (event) => {
  setPrivateNoStore(event);
  setResponseStatus(event, 204);
  try {
    if (
      !isSameOriginVisit({
        secFetchSite: getHeader(event, "sec-fetch-site"),
        origin: getHeader(event, "origin"),
        host: getHeader(event, "x-forwarded-host") || getHeader(event, "host")
      })
    ) return null;
    if (!isCountableUserAgent(getHeader(event, "user-agent"))) return null;
    const raw = await readRawBody(event, "utf8");
    if (!raw || raw.length > 256) return null;
    let deviceId: unknown;
    try {
      deviceId = (JSON.parse(raw) as { d?: unknown })?.d;
    } catch {
      return null;
    }
    if (!isVisitorDeviceId(deviceId)) return null;
    const ip = visitClientIp(event.node.req.socket.remoteAddress, getHeader(event, "x-real-ip"));
    const token = readSessionTokenFromEvent(event);
    // Fire-and-forget so the response never waits on the database.
    void (async () => {
      try {
        const salt = await getTrafficSalt();
        if (!salt) return;
        const userId = await lookupSessionUserId(token).catch(() => null);
        await recordVisit(getAccountDb() as never, { salt, deviceId: deviceId as string, ip, userId });
      } catch {
        // Metrics never affect the response.
      }
    })();
  } catch {
    // Swallow everything; the answer is always 204.
  }
  return null;
});
