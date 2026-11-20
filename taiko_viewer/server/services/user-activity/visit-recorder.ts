import { createHmac } from "node:crypto";
import { activityDayKey, shiftDayKey } from "./daily-activity.ts";
import { DAILY_VISITORS_RETENTION_DAYS } from "./schema.ts";
import { shouldMarkVisitorSuspect, VISITOR_DEVICES_PER_IP_CAP } from "./visit-rules.ts";

type VisitConnection = {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
  execute: (sql: string, params?: unknown[]) => Promise<unknown>;
  release: () => void;
};
type VisitDb = { getConnection: () => Promise<VisitConnection> };

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
  let connection: VisitConnection | undefined;
  let lockName = "";
  let locked = false;
  try {
    const day = activityDayKey(input.now || new Date());
    const visitorKey = visitKey(input.salt, "device", input.deviceId);
    const ipKey = visitKey(input.salt, "ip", input.ip || "unknown");
    connection = await db.getConnection();
    // Serialize admission per database and network across server processes.
    const [locks] = await connection.query(
      "SELECT GET_LOCK(CONCAT('visit:', LEFT(SHA2(DATABASE(),256),16), ':', ?), 1) acquired, CONCAT('visit:', LEFT(SHA2(DATABASE(),256),16), ':', ?) lock_name",
      [ipKey.slice(0, 32), ipKey.slice(0, 32)]
    ) as [Array<{ acquired: number; lock_name: string }>];
    locked = Number(locks[0]?.acquired) === 1;
    if (!locked) return false;
    lockName = locks[0].lock_name;
    const [rows] = (await connection.query(
      `SELECT COUNT(*) AS total FROM (SELECT visitor_key FROM web_daily_visitors
       WHERE day = ? AND ip_key = ? AND visitor_key <> ? LIMIT ${VISITOR_DEVICES_PER_IP_CAP}) AS devices`,
      [day, ipKey, visitorKey]
    )) as [Array<{ total: number }>];
    const suspect = shouldMarkVisitorSuspect(Number(rows?.[0]?.total || 0)) ? 1 : 0;
    await connection.execute(
      `INSERT INTO web_daily_visitors (day, visitor_key, ip_key, user_id, is_suspect)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE user_id = COALESCE(VALUES(user_id), user_id)`,
      [day, visitorKey, ipKey, input.userId, suspect]
    );
    if (lastPurgeDay !== day) {
      lastPurgeDay = day;
      await connection.execute("DELETE FROM web_daily_visitors WHERE day < ? LIMIT 5000", [
        shiftDayKey(day, -DAILY_VISITORS_RETENTION_DAYS)
      ]);
    }
    return true;
  } catch {
    return false;
  } finally {
    if (locked && connection) await connection.query("SELECT RELEASE_LOCK(?)", [lockName]).catch(() => {});
    connection?.release();
  }
};
