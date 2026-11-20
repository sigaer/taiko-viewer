import { createHmac } from "node:crypto";
import { activityDayKey, shiftDayKey } from "./daily-activity.ts";
import { DAILY_VISITORS_RETENTION_DAYS } from "./schema.ts";
import { shouldMarkVisitorSuspect } from "./visit-rules.ts";

type VisitDb = {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
  execute: (sql: string, params?: unknown[]) => Promise<unknown>;
};

export const visitKey = (salt: string, kind: "device" | "ip", value: string) =>
  createHmac("sha256", salt).update(`${kind}:${value}`).digest("hex");

let lastPurgeDay = "";

/**
 * Upserts one qualified visit. Callers must already have validated the request.
 * Never throws: metrics must not affect the response.
 */
export const recordVisit = async (
  db: VisitDb,
  input: { salt: string; deviceId: string; ip: string; userId: number | null; now?: Date }
) => {
  try {
    const day = activityDayKey(input.now || new Date());
    const visitorKey = visitKey(input.salt, "device", input.deviceId);
    const ipKey = visitKey(input.salt, "ip", input.ip || "unknown");
    const [rows] = (await db.query(
      "SELECT COUNT(*) AS total FROM web_daily_visitors WHERE day = ? AND ip_key = ? AND visitor_key <> ?",
      [day, ipKey, visitorKey]
    )) as [Array<{ total: number }>];
    const suspect = shouldMarkVisitorSuspect(Number(rows?.[0]?.total || 0)) ? 1 : 0;
    await db.execute(
      `INSERT INTO web_daily_visitors (day, visitor_key, ip_key, user_id, is_suspect)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE user_id = COALESCE(VALUES(user_id), user_id)`,
      [day, visitorKey, ipKey, input.userId, suspect]
    );
    if (lastPurgeDay !== day) {
      lastPurgeDay = day;
      await db.execute("DELETE FROM web_daily_visitors WHERE day < ? LIMIT 5000", [
        shiftDayKey(day, -DAILY_VISITORS_RETENTION_DAYS)
      ]);
    }
    return true;
  } catch {
    return false;
  }
};
