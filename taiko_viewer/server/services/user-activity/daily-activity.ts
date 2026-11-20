import { dashboardDayKey } from "../../utils/admin/dashboard-time.ts";

/** Beijing calendar day key (YYYY-MM-DD), same bucketing as the admin dashboard. */
export const activityDayKey = (date: Date = new Date()) => dashboardDayKey(date);

/** Shift a YYYY-MM-DD key by whole days (calendar arithmetic, timezone-free). */
export const shiftDayKey = (day: string, deltaDays: number) => {
  const time = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(time)) return day;
  return new Date(time + deltaDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
};

const DEFAULT_MAX_ENTRIES = 50_000;
const DEFAULT_BACKOFF_MS = 5 * 60 * 1000;

/**
 * In-process memo so each account is written at most once per day per process.
 * The set only ever holds the current day and is cleared when the day changes
 * (or if it grows past maxEntries, which merely allows harmless re-inserts).
 */
export const createDailyActivityMemo = (options: { maxEntries?: number; backoffMs?: number } = {}) => {
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const backoffMs = options.backoffMs ?? DEFAULT_BACKOFF_MS;
  let currentDay = "";
  let pausedUntil = 0;
  const seen = new Set<string>();

  return {
    /** Returns true when the caller should write (day, userId); marks it as written. */
    claim(day: string, userId: number | string, now = Date.now()) {
      if (now < pausedUntil) return false;
      if (day !== currentDay) {
        seen.clear();
        currentDay = day;
      }
      const key = `${day}:${userId}`;
      if (seen.has(key)) return false;
      if (seen.size >= maxEntries) seen.clear();
      seen.add(key);
      return true;
    },
    /** A write failed: allow a later retry for this key and pause all writes briefly. */
    release(day: string, userId: number | string, now = Date.now()) {
      seen.delete(`${day}:${userId}`);
      pausedUntil = now + backoffMs;
    },
    get size() {
      return seen.size;
    },
    get day() {
      return currentDay;
    }
  };
};

type ActivityDb = { execute: (sql: string, params: unknown[]) => Promise<unknown> };

const sharedMemo = createDailyActivityMemo();

/**
 * Records that an authenticated account used the site today. Never throws and
 * never rejects: activity tracking must not affect authentication.
 */
export const recordDailyActivity = async (
  db: ActivityDb,
  userId: number | string,
  now: Date = new Date(),
  memo: ReturnType<typeof createDailyActivityMemo> = sharedMemo
) => {
  try {
    const id = Number(userId);
    if (!Number.isSafeInteger(id) || id <= 0) return false;
    const day = activityDayKey(now);
    if (!memo.claim(day, id, now.getTime())) return false;
    try {
      await db.execute("INSERT IGNORE INTO web_user_daily_activity (day, user_id) VALUES (?, ?)", [day, id]);
      return true;
    } catch {
      memo.release(day, id, now.getTime());
      return false;
    }
  } catch {
    return false;
  }
};
