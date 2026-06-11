import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { createInterface } from "node:readline";
import { join } from "node:path";
import type { RowDataPacket } from "mysql2/promise";
import { DbRow, ensureAccountSchema, getAccountDb } from "~/server/utils/account-db";
import { listAdminActionLogs } from "./audit";
import { listAdminBackups } from "./backup";
import { getBotDb, getAdminManagedPaths, getAdminRuntimeConfig, sha1 } from "./shared";
import { isTaikoMethodDisplay } from "./taiko-method-calls";

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

type AccessBucket = {
  pvCount: number;
  homePvCount: number;
  uvHashes: Set<string>;
};

type UploadStatsCache = {
  expiresAt: number;
  totalUploads: number;
  uploads24h: number;
  dailyUploads: Array<{ day: string; count: number }>;
};

const VIEWER_ACCESS_SOURCE = "viewer_access";
const BOT_METHOD_CALL_SOURCE = "bot_method_calls_taiko";
const VIEWER_ACCESS_STATE_KEY = "viewer_access_log";
const BOT_METHOD_CALL_STATE_KEY = "bot_method_calls_taiko";
const DASHBOARD_CACHE_TTL_MS = 60 * 1000;
const UPLOAD_SCAN_CACHE_TTL_MS = 5 * 60 * 1000;
const MONTH_INDEX: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11
};
const STATIC_PATH_PATTERN =
  /^\/(?:_nuxt\/|qqbot-cache\/|favicon|icon\.png|apple-touch-icon|manifest\.webmanifest|robots\.txt|sitemap\.xml)/i;
const STATIC_EXT_PATTERN =
  /\.(?:png|jpe?g|gif|svg|webp|ico|css|js|map|woff2?|ttf|txt|xml|json|mp3|webmanifest)$/i;
const BOT_USER_AGENT_PATTERN =
  /(bot|spider|crawler|crawl|baiduspider|bingbot|headless|scan|zgrab|python-requests|curl\/|wget\/|go-http-client|python-httpx|semrush)/i;

let dashboardCache: { expiresAt: number; data: Awaited<ReturnType<typeof buildDashboardPayload>> } | null =
  null;
let uploadStatsCache: UploadStatsCache | null = null;

const toDate = (value: unknown) => {
  const date = value instanceof Date ? value : new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? null : date;
};

const toDayKey = (value: unknown) => {
  const date = toDate(value);
  return date ? formatDayKey(date) : String(value || "").slice(0, 10);
};

const toDateTimeText = (value: unknown) => {
  const date = toDate(value);
  return date ? date.toISOString().slice(0, 19).replace("T", " ") : String(value || "");
};

const getBucketStart = (date: Date, granularity: "hour" | "day") => {
  const bucket = new Date(date);
  bucket.setMinutes(0, 0, 0);
  if (granularity === "day") {
    bucket.setHours(0, 0, 0, 0);
  }
  return bucket;
};

const formatBucketKey = (date: Date, granularity: "hour" | "day") => {
  const bucket = getBucketStart(date, granularity);
  return `${granularity}:${bucket.toISOString()}`;
};

const formatDayKey = (date: Date) => date.toISOString().slice(0, 10);

const parseNginxLogTime = (raw: string) => {
  const match = raw.match(/^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) [+-]\d{4}$/);
  if (!match) return null;
  const [, day, month, year, hour, minute, second] = match;
  const monthIndex = MONTH_INDEX[month];
  if (monthIndex === undefined) return null;
  const date = new Date(Number(year), monthIndex, Number(day), Number(hour), Number(minute), Number(second));
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const parseViewerAccessLine = (line: string) => {
  const match = line.match(
    /^(?<ip>\S+) \S+ \S+ \[(?<time>[^\]]+)\] "(?<method>[A-Z]+) (?<path>\S+) [^"]+" (?<status>\d{3}) \S+ "(?<ref>[^"]*)" "(?<ua>[^"]*)"/
  );
  if (!match?.groups) return null;
  const parsedTime = parseNginxLogTime(match.groups.time);
  if (!parsedTime) return null;
  return {
    ip: match.groups.ip,
    time: parsedTime,
    method: match.groups.method,
    path: match.groups.path,
    status: Number(match.groups.status || 0),
    userAgent: match.groups.ua || ""
  };
};

const normalizePathname = (rawPath: string) => {
  try {
    const url = new URL(rawPath, "https://viewer.sakura-bot.cn");
    return url.pathname || "/";
  } catch {
    return String(rawPath || "/").split("?")[0] || "/";
  }
};

const isTrackableViewerPageRequest = (path: string, userAgent: string, method: string) => {
  if (method !== "GET") return false;
  if (!path || path.startsWith("/api/")) return false;
  if (STATIC_PATH_PATTERN.test(path)) return false;
  if (STATIC_EXT_PATTERN.test(path)) return false;
  if (BOT_USER_AGENT_PATTERN.test(userAgent)) return false;
  return true;
};

const isHomeRoute = (path: string) => ["/", "/ja", "/ja/"].includes(path);

const decodeMethodName = (methodName: string) => {
  const trimmed = String(methodName || "").trim();
  if (!trimmed) return "未知指令";
  if (trimmed.startsWith("cmd::")) {
    return trimmed.slice(5) || "未知指令";
  }
  return trimmed;
};

const isTaikoMethodCall = (methodName: string) => isTaikoMethodDisplay(decodeMethodName(methodName));

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

const setIngestState = async (sourceKey: string, state: Record<string, unknown>) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  await db.execute(
    `INSERT INTO web_admin_ingest_state (source_key, state_json)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE state_json = VALUES(state_json), updated_at = CURRENT_TIMESTAMP`,
    [sourceKey, JSON.stringify(state)]
  );
};

const upsertRollupRow = async (input: {
  sourceKey: string;
  granularity: "hour" | "day";
  bucketStart: Date;
  metricCount?: number;
  pvCount?: number;
  homePvCount?: number;
  uvHashes?: Set<string>;
}) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  const bucketStart = input.bucketStart.toISOString().slice(0, 19).replace("T", " ");
  const [rows] = await db.execute<DbRow<RollupRow>[]>(
    `SELECT *
     FROM web_admin_access_rollups
     WHERE source_key = ? AND granularity = ? AND bucket_start = ?
     LIMIT 1`,
    [input.sourceKey, input.granularity, bucketStart]
  );
  const existing = rows[0];
  const nextMetricCount = Number(existing?.metric_count || 0) + Number(input.metricCount || 0);
  const nextPvCount = Number(existing?.pv_count || 0) + Number(input.pvCount || 0);
  const nextHomePvCount = Number(existing?.home_pv_count || 0) + Number(input.homePvCount || 0);
  const existingExtra = existing?.extra_json ? (JSON.parse(existing.extra_json) as Record<string, unknown>) : {};
  const uvHashes = new Set<string>(
    Array.isArray(existingExtra?.uvHashes) ? (existingExtra.uvHashes as string[]) : []
  );
  for (const value of input.uvHashes || []) {
    uvHashes.add(value);
  }
  const nextUvCount = uvHashes.size;
  const extraJson = uvHashes.size ? JSON.stringify({ uvHashes: Array.from(uvHashes) }) : null;

  await db.execute(
    `INSERT INTO web_admin_access_rollups
      (source_key, granularity, bucket_start, metric_count, pv_count, uv_count, home_pv_count, extra_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       metric_count = VALUES(metric_count),
       pv_count = VALUES(pv_count),
       uv_count = VALUES(uv_count),
       home_pv_count = VALUES(home_pv_count),
       extra_json = VALUES(extra_json),
       updated_at = CURRENT_TIMESTAMP`,
    [
      input.sourceKey,
      input.granularity,
      bucketStart,
      nextMetricCount,
      nextPvCount,
      nextUvCount,
      nextHomePvCount,
      extraJson
    ]
  );
};

const ingestViewerAccessLog = async () => {
  const state = await getIngestState(VIEWER_ACCESS_STATE_KEY);
  const { viewerAccessLogPath } = getAdminRuntimeConfig();
  let fileStat;
  try {
    fileStat = await stat(viewerAccessLogPath);
  } catch {
    return;
  }

  const size = Number(fileStat.size || 0);
  let offset = Math.max(0, Number(state.offset || 0));
  if (size < offset) {
    offset = 0;
  }
  if (size === offset) {
    return;
  }

  const buckets = new Map<string, AccessBucket & { bucketStart: Date; granularity: "hour" | "day" }>();
  const stream = createReadStream(viewerAccessLogPath, { encoding: "utf-8", start: offset });
  const reader = createInterface({
    input: stream,
    crlfDelay: Infinity
  });

  for await (const line of reader) {
    const parsed = parseViewerAccessLine(line);
    if (!parsed) continue;
    const pathname = normalizePathname(parsed.path);
    if (!isTrackableViewerPageRequest(pathname, parsed.userAgent, parsed.method)) {
      continue;
    }
    const homeHit = isHomeRoute(pathname) ? 1 : 0;
    const uvHash = sha1(parsed.ip);
    for (const granularity of ["hour", "day"] as const) {
      const key = formatBucketKey(parsed.time, granularity);
      const existing = buckets.get(key) || {
        bucketStart: getBucketStart(parsed.time, granularity),
        granularity,
        pvCount: 0,
        homePvCount: 0,
        uvHashes: new Set<string>()
      };
      existing.pvCount += 1;
      existing.homePvCount += homeHit;
      existing.uvHashes.add(uvHash);
      buckets.set(key, existing);
    }
  }

  for (const bucket of buckets.values()) {
    await upsertRollupRow({
      sourceKey: VIEWER_ACCESS_SOURCE,
      granularity: bucket.granularity,
      bucketStart: bucket.bucketStart,
      pvCount: bucket.pvCount,
      homePvCount: bucket.homePvCount,
      uvHashes: bucket.uvHashes
    });
  }

  await setIngestState(VIEWER_ACCESS_STATE_KEY, {
    offset: size,
    size,
    updatedAt: new Date().toISOString()
  });
};

const ingestMethodCalls = async () => {
  const state = await getIngestState(BOT_METHOD_CALL_STATE_KEY);
  let lastId = Math.max(0, Number(state.lastId || 0));
  const botDb = getBotDb();

  while (true) {
    const [rows] = await botDb.execute<
      Array<{
        id: number;
        method_name: string;
        timestamp: string;
      } & RowDataPacket>
    >(
      `SELECT id, method_name, timestamp
       FROM method_calls
       WHERE id > ?
       ORDER BY id ASC
       LIMIT 2000`,
      [lastId]
    );
    if (!rows.length) break;

    const buckets = new Map<
      string,
      { sourceKey: string; granularity: "hour" | "day"; bucketStart: Date; metricCount: number }
    >();

    for (const row of rows) {
      lastId = Math.max(lastId, Number(row.id || 0));
      if (!isTaikoMethodCall(row.method_name)) {
        continue;
      }
      const timestamp = new Date(row.timestamp);
      if (Number.isNaN(timestamp.getTime())) continue;
      for (const granularity of ["hour", "day"] as const) {
        const key = formatBucketKey(timestamp, granularity);
        const existing = buckets.get(key) || {
          sourceKey: BOT_METHOD_CALL_SOURCE,
          granularity,
          bucketStart: getBucketStart(timestamp, granularity),
          metricCount: 0
        };
        existing.metricCount += 1;
        buckets.set(key, existing);
      }
    }

    for (const bucket of buckets.values()) {
      await upsertRollupRow(bucket);
    }
  }

  await setIngestState(BOT_METHOD_CALL_STATE_KEY, {
    lastId,
    updatedAt: new Date().toISOString()
  });
};

const scanUserdataUploadStats = async () => {
  if (uploadStatsCache && uploadStatsCache.expiresAt > Date.now()) {
    return uploadStatsCache;
  }

  const { userdataDir } = getAdminManagedPaths();
  const dailyMap = new Map<string, number>();
  let totalUploads = 0;
  let uploads24h = 0;
  const now = Date.now();

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
          }
          const dayKey = formatDayKey(fileStat.mtime);
          dailyMap.set(dayKey, Number(dailyMap.get(dayKey) || 0) + 1);
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
    .map(([day, count]) => ({ day, count }));

  uploadStatsCache = {
    expiresAt: Date.now() + UPLOAD_SCAN_CACHE_TTL_MS,
    totalUploads,
    uploads24h,
    dailyUploads
  };
  return uploadStatsCache;
};

const getRollupSeries = async (sourceKey: string, granularity: "hour" | "day", limit: number) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  const safeLimit = Math.min(720, Math.max(1, Math.floor(Number(limit) || 1)));
  const [rows] = await db.execute<DbRow<RollupRow>[]>(
    `SELECT *
     FROM web_admin_access_rollups
     WHERE source_key = ? AND granularity = ?
     ORDER BY bucket_start DESC
     LIMIT ${safeLimit}`,
    [sourceKey, granularity]
  );
  return [...rows].reverse();
};

const getTopCommandRows = async (limit = 10) => {
  const botDb = getBotDb();
  const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit) || 10)));
  const [rows] = await botDb.execute<
    Array<{
      method_name: string;
      total: number;
    } & RowDataPacket>
  >(
    `SELECT method_name, COUNT(*) AS total
     FROM method_calls
     WHERE timestamp >= NOW() - INTERVAL 30 DAY
     GROUP BY method_name
     ORDER BY total DESC`
  );
  return rows
    .filter((row) => isTaikoMethodCall(row.method_name))
    .slice(0, safeLimit)
    .map((row) => ({
      name: decodeMethodName(row.method_name),
      count: Number(row.total || 0)
    }));
};

const buildDashboardPayload = async () => {
  await ensureAccountSchema();
  await ingestViewerAccessLog();
  await ingestMethodCalls();

  const db = getAccountDb();
  const [
    viewerCountRows,
    bindRows,
    hirobaRows,
    webBindingRows,
    unboundViewerRows,
    newUserRows,
    newBindingRows,
    accessHourly,
    accessDaily,
    botHourly,
    backupRows,
    recentAuditRows,
    topCommands,
    uploadStats
  ] = await Promise.all([
    db.execute<DbRow<{ total: number }>[]>("SELECT COUNT(*) AS total FROM web_user_accounts"),
    db.execute<DbRow<{ id: string }>[]>("SELECT DISTINCT id FROM bind WHERE is_current = 1"),
    db.execute<DbRow<{ taiko_no: string }>[]>("SELECT DISTINCT taiko_no FROM web_hiroba_credentials"),
    db.execute<DbRow<{ taiko_id: string }>[]>("SELECT DISTINCT taiko_id FROM web_taiko_bindings WHERE is_current = 1"),
    db.execute<DbRow<{ id: number }>[]>(
      `SELECT a.id
       FROM web_user_accounts a
       LEFT JOIN web_taiko_bindings b ON b.user_id = a.id AND b.is_current = 1
       WHERE b.user_id IS NULL`
    ),
    db.execute<DbRow<{ day_key: string; total: number }>[]>(
      `SELECT DATE(created_at) AS day_key, COUNT(*) AS total
       FROM web_user_accounts
       WHERE created_at >= NOW() - INTERVAL 30 DAY
       GROUP BY day_key
       ORDER BY day_key ASC`
    ),
    db.execute<DbRow<{ day_key: string; total: number }>[]>(
      `SELECT DATE(created_at) AS day_key, COUNT(*) AS total
       FROM web_taiko_bindings
       WHERE is_current = 1 AND created_at >= NOW() - INTERVAL 30 DAY
       GROUP BY day_key
       ORDER BY day_key ASC`
    ),
    getRollupSeries(VIEWER_ACCESS_SOURCE, "hour", 48),
    getRollupSeries(VIEWER_ACCESS_SOURCE, "day", 30),
    getRollupSeries(BOT_METHOD_CALL_SOURCE, "hour", 48),
    listAdminBackups(10),
    listAdminActionLogs({ page: 1, pageSize: 8 }),
    getTopCommandRows(10),
    scanUserdataUploadStats()
  ]);

  const viewerUsers = Number(viewerCountRows[0][0]?.total || 0);
  const bindingSet = new Set<string>();
  for (const row of bindRows[0]) bindingSet.add(String(row.id || "").trim());
  for (const row of hirobaRows[0]) bindingSet.add(String(row.taiko_no || "").trim());
  bindingSet.delete("");

  const totalUserSet = new Set<string>(bindingSet);
  for (const row of webBindingRows[0]) {
    totalUserSet.add(String(row.taiko_id || "").trim());
  }
  totalUserSet.delete("");
  const totalUsers = totalUserSet.size + unboundViewerRows[0].length;

  const dailyKeyList = Array.from(
    new Set([
      ...newUserRows[0].map((row) => toDayKey(row.day_key)),
      ...newBindingRows[0].map((row) => toDayKey(row.day_key)),
      ...uploadStats.dailyUploads.map((row) => row.day),
      ...accessDaily.map((row) => toDayKey(row.bucket_start))
    ])
  ).sort((a, b) => a.localeCompare(b));

  const newUsersMap = new Map(newUserRows[0].map((row) => [toDayKey(row.day_key), Number(row.total || 0)]));
  const newBindingsMap = new Map(newBindingRows[0].map((row) => [toDayKey(row.day_key), Number(row.total || 0)]));
  const uploadMap = new Map(uploadStats.dailyUploads.map((row) => [row.day, row.count]));
  const accessDailyMap = new Map(accessDaily.map((row) => [toDayKey(row.bucket_start), row]));

  const accessHourlySeries = accessHourly.map((row) => ({
    bucket: toDateTimeText(row.bucket_start),
    label: toDateTimeText(row.bucket_start).slice(5, 16),
    pv: Number(row.pv_count || 0),
    uv: Number(row.uv_count || 0),
    homePv: Number(row.home_pv_count || 0)
  }));
  const botHourlySeries = botHourly.map((row) => ({
    bucket: toDateTimeText(row.bucket_start),
    label: toDateTimeText(row.bucket_start).slice(5, 16),
    count: Number(row.metric_count || 0)
  }));
  const dailySeries = dailyKeyList.map((day) => ({
    day,
    newUsers: Number(newUsersMap.get(day) || 0),
    newBindings: Number(newBindingsMap.get(day) || 0),
    uploads: Number(uploadMap.get(day) || 0),
    pv: Number(accessDailyMap.get(day)?.pv_count || 0),
    uv: Number(accessDailyMap.get(day)?.uv_count || 0),
    homePv: Number(accessDailyMap.get(day)?.home_pv_count || 0)
  }));

  const pagePv24h = accessHourlySeries.reduce((sum, item) => sum + item.pv, 0);
  const pageUv24h = accessHourlySeries.reduce((sum, item) => sum + item.uv, 0);
  const homePv24h = accessHourlySeries.reduce((sum, item) => sum + item.homePv, 0);
  const botCommands24h = botHourlySeries.reduce((sum, item) => sum + item.count, 0);

  return {
    summary: {
      viewerUsers,
      taikoBindings: bindingSet.size,
      totalUsers,
      totalUploads: uploadStats.totalUploads,
      uploads24h: uploadStats.uploads24h,
      pagePv24h,
      pageUv24h,
      homePv24h,
      botCommands24h,
      recentNewUsers: dailySeries.slice(-7).reduce((sum, item) => sum + item.newUsers, 0)
    },
    trends: {
      accessHourly: accessHourlySeries,
      botHourly: botHourlySeries,
      daily: dailySeries
    },
    topCommands,
    backups: backupRows,
    recentAudits: recentAuditRows.items
  };
};

export const getAdminDashboardPayload = async () => {
  if (dashboardCache && dashboardCache.expiresAt > Date.now()) {
    return dashboardCache.data;
  }
  const data = await buildDashboardPayload();
  dashboardCache = {
    expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS,
    data
  };
  return data;
};
