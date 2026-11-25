import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { RowDataPacket } from "mysql2/promise";
import { ensureAccountSchema, getAccountDb } from "~/server/utils/account-db";
import type { DbRow } from "~/server/utils/account-db";
import { listAdminActionLogs } from "./audit";
import { listAdminBackups } from "./backup";
import { getAdminManagedPaths } from "./shared";
import { getViewerTrafficStore } from "./traffic-runtime";
import { readAdminUserCounts } from "./user-counts";

import { dashboardDayKey as formatDayKey, dashboardRollupTime } from "./dashboard-time";
import { shiftDayKey } from "~/server/services/user-activity/daily-activity";
import { dauSummaryFields, readDailyActivityStats } from "~/server/services/user-activity/activity-stats";

type RollupRow = {
  id: number;
  source_key: string;
  granularity: string;
  bucket_start: string;
  metric_count: number;
  pv_count: number;
  uv_count: number;
  home_pv_count: number;
  extra_json: string | null;
  created_at: string;
  updated_at: string;
} & RowDataPacket;

type IngestStateRow = {
  source_key: string;
  state_json: string;
  updated_at: string;
} & RowDataPacket;

type UploadStatsCache = {
  expiresAt: number;
  totalUploads: number;
  uploads24h: number;
  uploaders24h: number;
  dailyUploads: Array<{ day: string; count: number; uploaders: number }>;
};

const DASHBOARD_CACHE_TTL_MS = 60 * 1000;
const UPLOAD_SCAN_CACHE_TTL_MS = 5 * 60 * 1000;
const TAIKO_COMMAND_TOTAL_SOURCE = "taiko_commands_v2:total";
const TAIKO_COMMAND_PLATFORM_SOURCE_QQ = "taiko_commands_v2:platform:qq_official";
const TAIKO_COMMAND_PLATFORM_SOURCE_ONEBOT = "taiko_commands_v2:platform:onebot_v11";
const TAIKO_COMMAND_COMMAND_SOURCE_PREFIX = "taiko_commands_v2:command:";
const TAIKO_COMMAND_META_STATE_KEY = "taiko_commands_v2_meta";
let dashboardCache: { expiresAt: number; data: Awaited<ReturnType<typeof buildDashboardPayload>> } | null =
  null;
let uploadStatsCache: UploadStatsCache | null = null;

const getIngestState = async (sourceKey: string) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<IngestStateRow>[]>(
    "SELECT * FROM web_admin_ingest_state WHERE source_key = ? LIMIT 1",
    [sourceKey]
  );
  if (!rows.length) return {};
  try {
    return JSON.parse(rows[0].state_json || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
};

const scanUserdataUploadStats = async () => {
  if (uploadStatsCache && uploadStatsCache.expiresAt > Date.now()) {
    return uploadStatsCache;
  }

  const { userdataDir } = getAdminManagedPaths();
  const dailyMap = new Map<string, number>();
  const dailyUploaderMap = new Map<string, Set<string>>();
  const uploaders24hSet = new Set<string>();
  let totalUploads = 0;
  let uploads24h = 0;
  const now = Date.now();
  // Distinct uploader sets are only kept for the window the dashboard shows.
  const uploaderCutoffDay = shiftDayKey(formatDayKey(new Date(now)), -40);

  try {
    const rootEntries = await readdir(userdataDir, { withFileTypes: true });
    for (const entry of rootEntries) {
      if (!entry.isDirectory()) continue;
      const userDir = join(userdataDir, entry.name);
      let fileNames: string[] = [];
      try {
        fileNames = await readdir(userDir);
      } catch {
        continue;
      }
      for (const fileName of fileNames) {
        if (!/^data_.+\.json$/i.test(fileName)) continue;
        totalUploads += 1;
        const fullPath = join(userDir, fileName);
        try {
          const fileStat = await stat(fullPath);
          if (now - fileStat.mtimeMs <= 24 * 60 * 60 * 1000) {
            uploads24h += 1;
            uploaders24hSet.add(entry.name);
          }
          const dayKey = formatDayKey(fileStat.mtime);
          dailyMap.set(dayKey, Number(dailyMap.get(dayKey) || 0) + 1);
          if (dayKey >= uploaderCutoffDay) {
            const uploaders = dailyUploaderMap.get(dayKey) || new Set<string>();
            uploaders.add(entry.name);
            dailyUploaderMap.set(dayKey, uploaders);
          }
        } catch {
          // Ignore deleted or unreadable snapshots.
        }
      }
    }
  } catch {
    // Ignore unreadable userdata root.
  }

  const dailyUploads = Array.from(dailyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30)
    .map(([day, count]) => ({ day, count, uploaders: dailyUploaderMap.get(day)?.size || 0 }));

  uploadStatsCache = {
    expiresAt: Date.now() + UPLOAD_SCAN_CACHE_TTL_MS,
    totalUploads,
    uploads24h,
    uploaders24h: uploaders24hSet.size,
    dailyUploads
  };
  return uploadStatsCache;
};

const getRollupSeries = async (sourceKey: string, granularity: "hour" | "day", limit: number) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  const safeLimit = Math.min(720, Math.max(1, Math.floor(Number(limit) || 1)));
  const [rows] = await db.execute<DbRow<RollupRow>[]>(
    `SELECT DATE_FORMAT(bucket_start, '%Y-%m-%d %H:%i:%s') AS bucket_start,
       pv_count, uv_count, home_pv_count, metric_count
     FROM web_admin_access_rollups
     WHERE source_key = ? AND granularity = ?
     ORDER BY bucket_start DESC
     LIMIT ${safeLimit}`,
    [sourceKey, granularity]
  );
  return [...rows].reverse();
};

const getRollupMetricTotal = async (sourceKey: string, granularity: "hour" | "day", days: number) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<{ total: number }>[]>(
    `SELECT COALESCE(SUM(metric_count), 0) AS total
     FROM web_admin_access_rollups
     WHERE source_key = ? AND granularity = ? AND bucket_start >= NOW() - INTERVAL ? DAY`,
    [sourceKey, granularity, days]
  );
  return Number(rows[0]?.total || 0);
};

const getTopCommandRows = async (limit = 10) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit) || 10)));
  const [rows] = await db.execute<
    Array<{
      source_key: string;
      total: number;
    } & RowDataPacket>
  >(
    `SELECT source_key, COALESCE(SUM(metric_count), 0) AS total
     FROM web_admin_access_rollups
     WHERE source_key LIKE ? AND granularity = 'day' AND bucket_start >= NOW() - INTERVAL 30 DAY
     GROUP BY source_key
     ORDER BY total DESC
     LIMIT ${safeLimit}`,
    [`${TAIKO_COMMAND_COMMAND_SOURCE_PREFIX}%`]
  );
  return rows.map((row) => ({
    name: String(row.source_key || "").replace(TAIKO_COMMAND_COMMAND_SOURCE_PREFIX, "") || "unknown",
    count: Number(row.total || 0)
  }));
};

const getTaikoCommandMeta = async () => {
  const state = await getIngestState(TAIKO_COMMAND_META_STATE_KEY);
  const raw = state.statsStartedAt;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
};

const sumRecentHours = (
  items: Array<{ bucket: string; [key: string]: unknown }>,
  field: string,
  hours = 24
) => {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return items.reduce((sum, item) => {
    const bucketTime = new Date(String(item.bucket || "")).getTime();
    if (Number.isNaN(bucketTime) || bucketTime < cutoff) {
      return sum;
    }
    return sum + Number(item[field] || 0);
  }, 0);
};

const buildDashboardPayload = async () => {
  await ensureAccountSchema();
  const traffic = await getViewerTrafficStore().snapshot();

  const db = getAccountDb();
  const [
    userCounts,
    newUserRows,
    newBindingRows,
    botHourly,
    botHourlyQq,
    botHourlyOnebot,
    backupRows,
    recentAuditRows,
    topCommands,
    uploadStats,
    taikoCommandStatsSince,
    activity
  ] = await Promise.all([
    readAdminUserCounts(db),
    db.execute<DbRow<{ day_key: string; total: number }>[]>(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day_key, COUNT(*) AS total
       FROM web_user_accounts
       WHERE created_at >= NOW() - INTERVAL 30 DAY
       GROUP BY day_key
       ORDER BY day_key ASC`
    ),
    db.execute<DbRow<{ day_key: string; total: number }>[]>(
      `SELECT day_key, SUM(total) AS total
       FROM (
         SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day_key, COUNT(*) AS total
         FROM web_taiko_bindings
         WHERE created_at >= NOW() - INTERVAL 30 DAY
         GROUP BY day_key
         UNION ALL
         SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day_key, COUNT(*) AS total
         FROM bind
         WHERE created_at >= NOW() - INTERVAL 30 DAY
         GROUP BY day_key
       ) AS binding_growth
       GROUP BY day_key
       ORDER BY day_key ASC`
    ),
    getRollupSeries(TAIKO_COMMAND_TOTAL_SOURCE, "hour", 48),
    getRollupSeries(TAIKO_COMMAND_PLATFORM_SOURCE_QQ, "hour", 48),
    getRollupSeries(TAIKO_COMMAND_PLATFORM_SOURCE_ONEBOT, "hour", 48),
    listAdminBackups(10),
    listAdminActionLogs({ page: 1, pageSize: 10, excludeActions: ["read"] }),
    getTopCommandRows(10),
    scanUserdataUploadStats(),
    getTaikoCommandMeta(),
    readDailyActivityStats(getAccountDb())
  ]);

  const dailyKeyList = Array.from(
    new Set([
      ...newUserRows[0].map((row) => row.day_key),
      ...newBindingRows[0].map((row) => row.day_key),
      ...uploadStats.dailyUploads.map((row) => row.day),
      ...traffic.daily.map((row) => row.day),
      ...(activity ? activity.days : [])
    ])
  ).sort((a, b) => a.localeCompare(b));

  const newUsersMap = new Map(newUserRows[0].map((row) => [row.day_key, Number(row.total || 0)]));
  const newBindingsMap = new Map(newBindingRows[0].map((row) => [row.day_key, Number(row.total || 0)]));
  const uploadMap = new Map(uploadStats.dailyUploads.map((row) => [row.day, row.count]));
  const uploaderMap = new Map(uploadStats.dailyUploads.map((row) => [row.day, row.uploaders]));
  const accessDailyMap = new Map(traffic.daily.map((row) => [row.day, row]));

  const accessHourlySeries = traffic.hourly;
  const botHourlySeries = botHourly.map((row) => ({
    ...dashboardRollupTime(row.bucket_start, "bot"),
    count: Number(row.metric_count || 0)
  }));
  const botHourlyQqSeries = botHourlyQq.map((row) => ({
    bucket: dashboardRollupTime(row.bucket_start, "bot").bucket,
    count: Number(row.metric_count || 0)
  }));
  const botHourlyOnebotSeries = botHourlyOnebot.map((row) => ({
    bucket: dashboardRollupTime(row.bucket_start, "bot").bucket,
    count: Number(row.metric_count || 0)
  }));
  const dailySeries = dailyKeyList.map((day) => ({
    day,
    newUsers: Number(newUsersMap.get(day) || 0),
    newBindings: Number(newBindingsMap.get(day) || 0),
    uploads: Number(uploadMap.get(day) || 0),
    uploaders: Number(uploaderMap.get(day) || 0),
    // null = not tracked yet on that day (before the stats start), not zero.
    activeUsers: activity ? activity.activeOn(day) : null,
    pv: Number(accessDailyMap.get(day)?.pv || 0),
    uv: Number(accessDailyMap.get(day)?.uv || 0),
    homePv: Number(accessDailyMap.get(day)?.homePv || 0)
  }));

  const pagePv24h = traffic.pagePv24h;
  const pageUv24h = traffic.pageUv24h;
  const homePv24h = traffic.homePv24h;
  const botCommands24h = sumRecentHours(botHourlySeries, "count", 24);
  const botCommands24hByPlatform = {
    qqOfficial: sumRecentHours(botHourlyQqSeries, "count", 24),
    onebotV11: sumRecentHours(botHourlyOnebotSeries, "count", 24)
  };

  return {
    summary: {
      ...userCounts,
      totalUploads: uploadStats.totalUploads,
      uploads24h: uploadStats.uploads24h,
      pagePv24h,
      pageUv24h,
      homePv24h,
      botCommands24h,
      botCommands24hByPlatform,
      recentNewUsers: dailySeries.slice(-7).reduce((sum, item) => sum + item.newUsers, 0),
      uploaders24h: uploadStats.uploaders24h,
      ...dauSummaryFields(activity)
    },
    trends: {
      accessHourly: accessHourlySeries,
      botHourly: botHourlySeries,
      daily: dailySeries
    },
    topCommands,
    taikoCommandStatsSince,
    dauSince: activity?.since || null,
    trafficQuality: traffic.quality,
    backups: backupRows,
    recentAudits: recentAuditRows.items
  };
};

let dashboardPending: Promise<Awaited<ReturnType<typeof buildDashboardPayload>>> | null = null;
export const getAdminDashboardPayload = async () => {
  if (dashboardCache && dashboardCache.expiresAt > Date.now()) {
    return dashboardCache.data;
  }
  dashboardPending ||= buildDashboardPayload().finally(() => { dashboardPending = null; });
  const data = await dashboardPending;
  dashboardCache = {
    expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS,
    data
  };
  return data;
};
