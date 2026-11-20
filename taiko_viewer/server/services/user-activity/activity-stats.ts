import type { Pool, RowDataPacket } from "mysql2/promise";
import { activityDayKey, shiftDayKey } from "./daily-activity.ts";

const isMissingTableError = (error: unknown) => {
  const code = String((error as { code?: unknown })?.code || "");
  return code === "ER_NO_SUCH_TABLE" || Number((error as { errno?: unknown })?.errno) === 1146;
};

/**
 * Daily active users = union of account identities ('u'+user_id) from
 * web_user_daily_activity and non-suspect beacon visitors from web_daily_visitors
 * (identity 'u'+user_id when attributed, else 'd'+visitor_key). Counted in SQL.
 */
export const ACTIVITY_DAILY_SQL = `SELECT DATE_FORMAT(day, '%Y-%m-%d') AS day_key,
    COUNT(DISTINCT ident) AS total,
    COUNT(DISTINCT CASE WHEN ident LIKE 'u%' THEN ident END) AS logged_in
  FROM (
    SELECT day, CONCAT('u', user_id) AS ident FROM web_user_daily_activity WHERE day >= ?
    UNION ALL
    SELECT day, IF(user_id IS NULL, CONCAT('d', visitor_key), CONCAT('u', user_id)) AS ident
    FROM web_daily_visitors WHERE day >= ? AND is_suspect = 0
  ) AS activity
  GROUP BY day
  ORDER BY day ASC`;

// Over a multi-day window a device that was attributed to an account on any day counts as that account.
export const ACTIVITY_WINDOW_SQL = `SELECT
    COUNT(DISTINCT CASE WHEN day >= ? THEN ident END) AS wau,
    COUNT(DISTINCT ident) AS mau
  FROM (
    SELECT day, CONCAT('u', user_id) AS ident FROM web_user_daily_activity WHERE day >= ?
    UNION ALL
    SELECT v.day, COALESCE(CONCAT('u', COALESCE(v.user_id, owner.user_id)), CONCAT('d', v.visitor_key)) AS ident
    FROM web_daily_visitors v
    LEFT JOIN (
      SELECT visitor_key, MAX(user_id) AS user_id
      FROM web_daily_visitors
      WHERE day >= ? AND user_id IS NOT NULL
      GROUP BY visitor_key
    ) AS owner ON owner.visitor_key = v.visitor_key
    WHERE v.day >= ? AND v.is_suspect = 0
  ) AS activity`;

/**
 * Reads DAU/WAU/MAU for the Beijing day of `now`. Returns null while either
 * table has not been created (explicit migration), so the dashboard shows "—".
 */
export const readDailyActivityStats = async (db: Pick<Pool, "query">, now: Date = new Date()) => {
  const today = activityDayKey(now);
  const yesterday = shiftDayKey(today, -1);
  const since30 = shiftDayKey(today, -29);
  const since7 = shiftDayKey(today, -6);
  try {
    const [[dailyRows], [windowRows], [metaRows]] = await Promise.all([
      db.query<RowDataPacket[]>(ACTIVITY_DAILY_SQL, [since30, since30]),
      db.query<RowDataPacket[]>(ACTIVITY_WINDOW_SQL, [since7, since30, since30, since30]),
      db.query<RowDataPacket[]>(
        `SELECT
           (SELECT DATE_FORMAT(MIN(day), '%Y-%m-%d') FROM web_daily_visitors) AS first_day,
           (SELECT COUNT(*) FROM web_daily_visitors WHERE day = ? AND is_suspect = 1) AS suspect_today`,
        [today]
      )
    ]);
    // Beacon launch day: before it nothing is counted (shown as "not counted", not 0).
    const since = metaRows[0]?.first_day ? String(metaRows[0].first_day) : null;
    const byDay = new Map(
      dailyRows.map((row) => [String(row.day_key), { total: Number(row.total || 0), loggedIn: Number(row.logged_in || 0) }])
    );
    const counted = (day: string) => Boolean(since && day >= since);
    const todayRow = byDay.get(today) || { total: 0, loggedIn: 0 };
    return {
      since,
      activeOn: (day: string) => (counted(day) ? Number(byDay.get(day)?.total || 0) : null),
      dauToday: counted(today) ? todayRow.total : null,
      dauYesterday: counted(yesterday) ? Number(byDay.get(yesterday)?.total || 0) : null,
      dauLoggedIn: counted(today) ? todayRow.loggedIn : null,
      dauAnonymous: counted(today) ? Math.max(0, todayRow.total - todayRow.loggedIn) : null,
      wau7d: since ? Number(windowRows[0]?.wau || 0) : null,
      mau30d: since ? Number(windowRows[0]?.mau || 0) : null,
      suspectDevicesToday: Number(metaRows[0]?.suspect_today || 0),
      days: Array.from(byDay.keys()).filter(counted)
    };
  } catch (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
};

export type DailyActivityStats = NonNullable<Awaited<ReturnType<typeof readDailyActivityStats>>>;

/** Dashboard summary fields; all null when the activity tables are missing. */
export const dauSummaryFields = (activity: DailyActivityStats | null) => ({
  dauToday: activity ? activity.dauToday : null,
  dauYesterday: activity ? activity.dauYesterday : null,
  dauLoggedIn: activity ? activity.dauLoggedIn : null,
  dauAnonymous: activity ? activity.dauAnonymous : null,
  wau7d: activity ? activity.wau7d : null,
  mau30d: activity ? activity.mau30d : null,
  suspectDevicesToday: activity ? activity.suspectDevicesToday : null
});
