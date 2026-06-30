import { createHash } from "node:crypto";
import { createReadStream, constants as fsConstants } from "node:fs";
import { access, readdir, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { createError, getHeader, getRequestIP, setHeader, type H3Event } from "h3";
import type { RowDataPacket } from "mysql2/promise";
import { getContentRuntimePaths } from "~/server/services/content/runtime";
import { getDeveloperTokenRowByHash, readDeveloperBearerToken, touchDeveloperToken } from "~/server/internal/account/developer";
import { ensureAccountSchema, getAccountDb } from "~/server/utils/account-db";

type FileInfo = {
  filename: string;
  size: number;
  sha256: string;
  updatedAt: string;
};

type FileInfoCache = {
  mtimeMs: number;
  info: FileInfo;
};

type UsageRow = RowDataPacket & {
  request_count: number;
};

const fileInfoCache = new Map<string, FileInfoCache>();
const RESOURCE_FILES = {
  "core-assets": "taiko-bot-core-assets.zip",
  "cover-assets": "taiko-bot-cover-assets.zip",
  "dress-assets": "taiko-bot-dress-assets.zip",
  "nameplate-assets": "taiko-bot-nameplate-assets.zip",
  "fumens-assets": "taiko-bot-fumens-assets.zip",
  "fumens-renamed": "taiko-bot-fumens-renamed.zip"
} as const;
const ASSET_BUNDLE_FILE = "taiko-bot-assets.zip";

const DATASET_PATH_RESOLVERS = {
  song_data: () => getContentRuntimePaths().songDataPath,
  song_alias: () => resolve(getContentRuntimePaths().repoRoot, "songs", "song_alias.json"),
  rating_structured_with_ids: () => getContentRuntimePaths().ratingStructPath,
  region_map: () => resolve(getContentRuntimePaths().repoRoot, "songs", "region_map.json"),
  music_donda_list: () => resolve(getContentRuntimePaths().repoRoot, "songs", "music_donda_list.json"),
  song_difficulty: () => resolve(getContentRuntimePaths().repoRoot, "songs", "song_difficulty.json"),
  song_score: () => resolve(getContentRuntimePaths().repoRoot, "songs", "song_score.json"),
  song_data_with_roll: () => getContentRuntimePaths().songDataPath,
  taiko_goku_onis: () => resolve(getContentRuntimePaths().repoRoot, "songs", "taiko_goku_onis.json"),
  grade_dojo_nijiiro_2025_simple: () =>
    resolve(getContentRuntimePaths().repoRoot, "songs", "grade_dojo_nijiiro_2025_simple.json"),
  grade_dojo_nijiiro_history_simple: () =>
    resolve(getContentRuntimePaths().repoRoot, "songs", "grade_dojo_nijiiro_history_simple.json"),
  analyze_result_filtered: () => resolve(getContentRuntimePaths().repoRoot, "songs", "analyze_result_filtered.json"),
  tja_note_counts: () => resolve(getContentRuntimePaths().repoRoot, "songs", "tja_note_counts.json"),
  city: () => resolve(getContentRuntimePaths().repoRoot, "city.json"),
  twso: () => resolve(getContentRuntimePaths().repoRoot, "songs", "twso_data.json")
} as const;

export type TaikoDatasetName = keyof typeof DATASET_PATH_RESOLVERS;
export type TaikoResourceName = keyof typeof RESOURCE_FILES;

const normalizeIpAddress = (value: string) => String(value || "").trim().replace(/^::ffff:/, "") || "unknown";

const getTaikoOpenConfig = () => {
  const runtimeConfig = useRuntimeConfig();
  return {
    resourceDir: String(
      runtimeConfig.taikoOpenResourceDir || process.env.TAIKO_OPEN_RESOURCE_DIR || "/home/sigaer/taiko-open-resources"
    ),
    dailyLimit: Math.max(
      1,
      Number(
        runtimeConfig.taikoOpenAnonymousDailyLimit ||
          runtimeConfig.taikoOpenDailyLimit ||
          process.env.TAIKO_OPEN_ANONYMOUS_DAILY_LIMIT ||
          process.env.TAIKO_OPEN_DAILY_LIMIT ||
          100
      )
    ),
    developerDailyLimit: Math.max(
      1,
      Number(
        runtimeConfig.taikoOpenDeveloperDailyLimit ||
          process.env.TAIKO_OPEN_DEVELOPER_DAILY_LIMIT ||
          2500
      )
    )
  };
};

const buildViewerOrigin = (event: H3Event) => {
  const forwardedProto = String(getHeader(event, "x-forwarded-proto") || "").split(",")[0].trim();
  const host =
    String(getHeader(event, "x-forwarded-host") || getHeader(event, "host") || "viewer.sakura-bot.cn")
      .split(",")[0]
      .trim() || "viewer.sakura-bot.cn";
  const proto = /^(127\.0\.0\.1|localhost)/.test(host) ? "http" : forwardedProto || "https";
  return `${proto}://${host}`;
};

const ensureReadableFile = async (filePath: string) => {
  try {
    await access(filePath, fsConstants.R_OK);
  } catch {
    throw createError({ statusCode: 404, statusMessage: `文件不存在：${filePath}` });
  }
};

const hashFileSha256 = async (filePath: string) =>
  new Promise<string>((resolvePromise, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolvePromise(hash.digest("hex")));
  });

const getFileInfo = async (filePath: string): Promise<FileInfo> => {
  const fileStat = await stat(filePath);
  const cacheKey = resolve(filePath);
  const cached = fileInfoCache.get(cacheKey);
  if (cached && cached.mtimeMs === fileStat.mtimeMs) {
    return cached.info;
  }
  const info = {
    filename: basename(filePath),
    size: fileStat.size,
    sha256: await hashFileSha256(filePath),
    updatedAt: fileStat.mtime.toISOString()
  };
  fileInfoCache.set(cacheKey, { mtimeMs: fileStat.mtimeMs, info });
  return info;
};

const getUsageDayKey = () => new Date().toISOString().slice(0, 10);

const resolveDeveloperQuotaToken = async (event: H3Event, requireToken: boolean) => {
  const authHeader = String(getHeader(event, "authorization") || "").trim();
  if (!authHeader) {
    if (requireToken) {
      throw createError({ statusCode: 401, statusMessage: "缺少开发者 token" });
    }
    return null;
  }
  const token = readDeveloperBearerToken(event);
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: "开发者 token 格式无效" });
  }
  const row = await getDeveloperTokenRowByHash(token);
  if (!row) {
    throw createError({ statusCode: 401, statusMessage: "开发者 token 无效或已失效" });
  }
  await touchDeveloperToken(row.id);
  return row;
};

export const enforceTaikoOpenQuota = async (
  event: H3Event,
  apiName: string,
  options: { requireDeveloperToken?: boolean } = {}
) => {
  await ensureAccountSchema();
  const developerToken = await resolveDeveloperQuotaToken(event, Boolean(options.requireDeveloperToken));
  const requestIp = normalizeIpAddress(
    getRequestIP(event, { xForwardedFor: true }) || event.node.req.socket.remoteAddress || "unknown"
  );
  const quotaSubject = developerToken ? `token:${developerToken.id}` : `ip:${requestIp}`;
  const config = getTaikoOpenConfig();
  const limit = developerToken ? config.developerDailyLimit : config.dailyLimit;
  const dayKey = getUsageDayKey();
  const db = getAccountDb();
  const [rows] = await db.execute<UsageRow[]>(
    "SELECT request_count FROM web_taiko_open_api_daily_usage WHERE ip_address = ? AND api_name = ? AND day_key = ? LIMIT 1",
    [quotaSubject, apiName, dayKey]
  );
  const currentCount = Number(rows[0]?.request_count || 0);
  if (currentCount >= limit) {
    throw createError({ statusCode: 429, statusMessage: `当日请求次数已达上限（${limit}）` });
  }
  if (rows.length) {
    await db.execute(
      "UPDATE web_taiko_open_api_daily_usage SET request_count = request_count + 1 WHERE ip_address = ? AND api_name = ? AND day_key = ?",
      [quotaSubject, apiName, dayKey]
    );
  } else {
    await db.execute(
      "INSERT INTO web_taiko_open_api_daily_usage (ip_address, api_name, day_key, request_count) VALUES (?, ?, ?, 1)",
      [quotaSubject, apiName, dayKey]
    );
  }
  const nextCount = currentCount + 1;
  setHeader(event, "X-Taiko-Api-Limit", String(limit));
  setHeader(event, "X-Taiko-Api-Remaining", String(Math.max(0, limit - nextCount)));
  setHeader(event, "X-Taiko-Api-Day", dayKey);
  return { requestIp, limit, requestCount: nextCount, developerToken };
};

export const resolveTaikoDatasetFile = async (name: string) => {
  const resolver = DATASET_PATH_RESOLVERS[name as TaikoDatasetName];
  if (!resolver) {
    throw createError({ statusCode: 400, statusMessage: `不支持的数据集：${name}` });
  }
  const filePath = resolver();
  await ensureReadableFile(filePath);
  return { filePath, name: name as TaikoDatasetName };
};

export const resolveTaikoResourceFile = async (name: string) => {
  const resourceFile = RESOURCE_FILES[name as TaikoResourceName];
  if (!resourceFile) {
    throw createError({ statusCode: 400, statusMessage: `不支持的资源包：${name}` });
  }
  const filePath = resolve(getTaikoOpenConfig().resourceDir, resourceFile);
  await ensureReadableFile(filePath);
  return { filePath, name: name as TaikoResourceName, filename: resourceFile };
};

export const resolveTaikoAssetBundleFile = async () => {
  const filePath = resolve(getTaikoOpenConfig().resourceDir, ASSET_BUNDLE_FILE);
  await ensureReadableFile(filePath);
  const info = await getFileInfo(filePath);
  return {
    filePath,
    filename: ASSET_BUNDLE_FILE,
    info
  };
};

export const buildTaikoOpenManifest = async (event: H3Event) => {
  const origin = buildViewerOrigin(event);
  const datasets: Record<string, Record<string, string | number>> = {};
  for (const [name, resolver] of Object.entries(DATASET_PATH_RESOLVERS)) {
    const filePath = resolver();
    try {
      await ensureReadableFile(filePath);
      const info = await getFileInfo(filePath);
      datasets[name] = {
        filename: info.filename,
        size: info.size,
        sha256: info.sha256,
        updatedAt: info.updatedAt,
        url: `${origin}/api/taiko/data/${name}`
      };
    } catch {
      // Skip missing optional file.
    }
  }

  const resources: Record<string, Record<string, string | number>> = {};
  for (const [name, filename] of Object.entries(RESOURCE_FILES)) {
    const filePath = resolve(getTaikoOpenConfig().resourceDir, filename);
    try {
      await ensureReadableFile(filePath);
      const info = await getFileInfo(filePath);
      resources[name] = {
        filename: info.filename,
        size: info.size,
        sha256: info.sha256,
        updatedAt: info.updatedAt,
        url: `${origin}/api/taiko/resources/${name}`
      };
    } catch {
      // Skip archives that have not been generated yet.
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    datasets,
    resources,
    limits: {
      anonymousPerApiPerDay: getTaikoOpenConfig().dailyLimit,
      developerPerApiPerDay: getTaikoOpenConfig().developerDailyLimit
    }
  };
};

export const listAvailableTaikoResourceFiles = async () => {
  const resourceDir = resolve(getTaikoOpenConfig().resourceDir);
  try {
    const files = await readdir(resourceDir);
    return files.filter((file) => file.endsWith(".zip")).sort();
  } catch {
    return [];
  }
};
