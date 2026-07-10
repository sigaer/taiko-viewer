import { constants as fsConstants } from "node:fs";
import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { createError } from "h3";
import type {
  VersionSummaryPayload,
  VersionSummarySongCard,
  VersionSummaryViewModel,
  VersionSummaryKeyword
} from "~/types/account-version-summary";
import { getSongCatalog, getSongCoverUrl } from "~/server/services/content";
import { normalizeViewerLocale } from "~/server/utils/locale";
import {
  enrichBindingWithCurrentTitle,
  execFileAsync,
  getCurrentBindingRow,
  getRuntimePaths,
  sanitizeBinding
} from "~/server/internal/account/shared";
import type { SongCatalogItem } from "~/types/content";
import { buildVersionSummaryPresentation, getVersionSummaryDimensionLabel, getVersionSummaryKeywordTitle } from "./copyGenerator";
import type { RawVersionSummary, RawVersionSummarySong, VersionSummaryLocale } from "./types";
import { listVersionSummaryWindows, resolveVersionSummaryWindow, type VersionSummaryWindow } from "./versionWindows";

const VERSION_SUMMARY_CACHE_SCHEMA = 3;
const COVER_FALLBACK_ID = 1384;
const PYTHON_FALLBACK_MESSAGES = {
  missingHistory: "当前绑定还没有覆盖该版本范围的历史快照，请先同步更多历史数据后再查看版本总结。",
  executionFailed: "版本总结生成失败，请稍后重试。"
};
const KEYWORD_TITLE_KEYS_BY_DIMENSION: Record<string, string> = {
  big_song: "wall_breaker",
  stamina: "endless_drummer",
  speed: "speed_runner",
  accuracy: "precision_tuner",
  rhythm: "rhythm_resonator",
  complex: "complex_hunter"
};

type VersionSummaryCacheEnvelope = {
  cacheSchema: number;
  versionKey: string;
  fingerprint: string;
  historyCount: number;
  latestSnapshotName: string;
  payload: RawVersionSummary;
};

const parsePositiveInt = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
};

const toLocale = (input?: string | null): VersionSummaryLocale =>
  normalizeViewerLocale(input) === "ja" ? "ja" : "zh";

const getUserdataFilePath = (taikoId: string) => {
  const { userdataDir } = getRuntimePaths();
  return resolve(userdataDir, `${taikoId}data.json`);
};

const getUserHistoryDir = (taikoId: string) => {
  const { userdataDir } = getRuntimePaths();
  return resolve(userdataDir, taikoId);
};

const getCachePath = (version: VersionSummaryWindow, taikoId: string) => {
  const { cacheDir } = getRuntimePaths();
  return join(cacheDir, "version-summary", version.key, `${taikoId}.json`);
};

const listSnapshotNames = async (taikoId: string) => {
  const historyDir = getUserHistoryDir(taikoId);
  let names: string[] = [];
  try {
    names = await readdir(historyDir);
  } catch {
    return [];
  }
  return names
    .filter((name) => name.startsWith("data_") && name.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));
};

const getHistoryFingerprint = async (taikoId: string) => {
  const snapshotNames = await listSnapshotNames(taikoId);
  return {
    historyCount: snapshotNames.length,
    latestSnapshotName: snapshotNames.at(-1) || "",
    fingerprint: `${snapshotNames.length}:${snapshotNames.at(-1) || ""}`
  };
};

const extractExecErrorMessage = (error: unknown) => {
  if (!error || typeof error !== "object") return "";
  const payload = error as { stderr?: Buffer | string; stdout?: Buffer | string; message?: string };
  const stderr = Buffer.isBuffer(payload.stderr) ? payload.stderr.toString("utf-8") : String(payload.stderr || "");
  const stdout = Buffer.isBuffer(payload.stdout) ? payload.stdout.toString("utf-8") : String(payload.stdout || "");
  return stderr.trim() || stdout.trim() || String(payload.message || "").trim();
};

const mapPythonError = (message: string): never => {
  if (/no snapshots available|no snapshots in version window/i.test(message)) {
    throw createError({
      statusCode: 404,
      statusMessage: PYTHON_FALLBACK_MESSAGES.missingHistory
    });
  }
  throw createError({
    statusCode: 500,
    statusMessage: message || PYTHON_FALLBACK_MESSAGES.executionFailed
  });
};

const runVersionSummaryPython = async (taikoId: string, version: VersionSummaryWindow): Promise<RawVersionSummary> => {
  const { repoRoot, userdataDir, configPath } = getRuntimePaths();
  const songDataPath = resolve(repoRoot, "songs", "song_data.json");
  const runtimeConfig = useRuntimeConfig();
  const ratingPath = String(
    runtimeConfig.ratingStructPath || process.env.TAIKO_RATING_STRUCT_PATH || resolve(repoRoot, "songs", "rating_structured_with_ids.json")
  );

  const pythonCode = [
    "from plugins.utils.version_summary import build_version_summary",
    "import json, sys",
    "taiko_id = sys.argv[1]",
    "version = json.loads(sys.argv[2])",
    "payload = build_version_summary(",
    "    taiko_id,",
    "    version,",
    "    userdata_dir=sys.argv[3],",
    "    song_data_path=sys.argv[4],",
    "    rating_path=sys.argv[5],",
    ")",
    "sys.stdout.write(json.dumps(payload, ensure_ascii=False))"
  ].join("\n");

  try {
    const result = await execFileAsync("python3", ["-c", pythonCode, taikoId, JSON.stringify(version), userdataDir, songDataPath, ratingPath], {
      cwd: repoRoot,
      env: {
        ...process.env,
        TAIKO_CONFIG_PATH: configPath
      },
      encoding: "utf-8",
      maxBuffer: 16 * 1024 * 1024
    });
    const stdout = String(result.stdout || "").trim();
    if (!stdout) {
      throw createError({ statusCode: 500, statusMessage: PYTHON_FALLBACK_MESSAGES.executionFailed });
    }
    return JSON.parse(stdout) as RawVersionSummary;
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    return mapPythonError(extractExecErrorMessage(error));
  }
};

const runTaikob20KeywordPython = async (taikoId: string) => {
  const { repoRoot, configPath } = getRuntimePaths();
  const runtimeConfig = useRuntimeConfig();
  const ratingPath = String(
    runtimeConfig.ratingStructPath || process.env.TAIKO_RATING_STRUCT_PATH || resolve(repoRoot, "songs", "rating_structured_with_ids.json")
  );

  const pythonCode = [
    "from contextlib import redirect_stdout",
    "from io import StringIO",
    "from pathlib import Path",
    "from plugins.utils.score_calculator import compute_all_from_userdata_records, compute_dim_topN_means, aggregate_topn_value_fn",
    "import json, sys",
    "userdata_path = Path(sys.argv[1])",
    "payload = json.loads(userdata_path.read_text(encoding='utf-8'))",
    "records = payload.get('songs', []) if isinstance(payload, dict) else payload",
    "mapping = {",
    "    '大歌力': 'big_song',",
    "    '体力': 'stamina',",
    "    '高速处理': 'speed',",
    "    '精度力': 'accuracy',",
    "    '节奏处理': 'rhythm',",
    "    '复合处理': 'complex',",
    "}",
    "with redirect_stdout(StringIO()):",
    "    results = compute_all_from_userdata_records(records or [], json_path=sys.argv[2])",
    "    dim_means = compute_dim_topN_means(results, 20) if results else {}",
    "radar = {mapping[key]: round(float(value), 4) for key, value in dim_means.items() if key in mapping}",
    "if not radar:",
    "    sys.stdout.write('{}')",
    "else:",
    "    dimension_key = max(radar, key=radar.get)",
    "    sys.stdout.write(json.dumps({",
    "        'dimensionKey': dimension_key,",
    "        'score': radar[dimension_key],",
    "        'radarValues': radar,",
    "        'rating': round(float(aggregate_topn_value_fn(results, 'AI_rating', 20)), 4),",
    "    }, ensure_ascii=False))"
  ].join("\n");

  try {
    const result = await execFileAsync("python3", ["-c", pythonCode, getUserdataFilePath(taikoId), ratingPath], {
      cwd: repoRoot,
      env: {
        ...process.env,
        TAIKO_CONFIG_PATH: configPath
      },
      encoding: "utf-8",
      maxBuffer: 8 * 1024 * 1024
    });
    const stdout = String(result.stdout || "").trim();
    if (!stdout || stdout === "{}") {
      return null;
    }
    return JSON.parse(stdout) as {
      dimensionKey: string;
      score: number;
      radarValues: Record<string, number>;
      rating: number;
    };
  } catch (error) {
    console.warn("[version-summary] failed to compute taikob20 keyword profile", extractExecErrorMessage(error));
    return null;
  }
};

type RatingDistributionCache = {
  fingerprint: string;
  generatedAt: string;
  ratings: Array<{ taikoId: string; rating: number }>;
};

const getRatingDistribution = async (): Promise<RatingDistributionCache | null> => {
  const { repoRoot, userdataDir, cacheDir, configPath } = getRuntimePaths();
  const names = (await readdir(userdataDir)).filter((name) => /^\d+data\.json$/.test(name)).sort();
  if (names.length < 20) return null;
  const latestStats = await Promise.all(names.map((name) => stat(resolve(userdataDir, name))));
  const fingerprint = `${names.length}:${Math.max(...latestStats.map((item) => item.mtimeMs), 0)}`;
  const cachePath = join(cacheDir, "version-summary", "rating-distribution.json");
  try {
    const cached = JSON.parse(await readFile(cachePath, "utf-8")) as RatingDistributionCache;
    if (cached.fingerprint === fingerprint && cached.ratings?.length >= 20) return cached;
  } catch {}

  const runtimeConfig = useRuntimeConfig();
  const ratingPath = String(runtimeConfig.ratingStructPath || process.env.TAIKO_RATING_STRUCT_PATH || resolve(repoRoot, "songs", "rating_structured_with_ids.json"));
  const pythonCode = [
    "from contextlib import redirect_stdout",
    "from io import StringIO",
    "from pathlib import Path",
    "from plugins.utils.score_calculator import compute_all_from_userdata_records, aggregate_topn_value_fn",
    "import json, sys",
    "root = Path(sys.argv[1])",
    "rows = []",
    "for path in sorted(root.glob('*data.json')):",
    "    try:",
    "        payload = json.loads(path.read_text(encoding='utf-8'))",
    "        records = payload.get('songs', []) if isinstance(payload, dict) else payload",
    "        with redirect_stdout(StringIO()):",
    "            results = compute_all_from_userdata_records(records or [], json_path=sys.argv[2])",
    "            value = float(aggregate_topn_value_fn(results, 'AI_rating', 20)) if results else 0",
    "        if value > 0: rows.append({'taikoId': path.name[:-9], 'rating': round(value, 4)})",
    "    except Exception:",
    "        continue",
    "sys.stdout.write(json.dumps(rows, ensure_ascii=False))"
  ].join("\n");
  try {
    const result = await execFileAsync("python3", ["-c", pythonCode, userdataDir, ratingPath], {
      cwd: repoRoot,
      env: { ...process.env, TAIKO_CONFIG_PATH: configPath },
      encoding: "utf-8",
      timeout: 180_000,
      maxBuffer: 32 * 1024 * 1024
    });
    const ratings = JSON.parse(String(result.stdout || "[]")) as RatingDistributionCache["ratings"];
    if (ratings.length < 20) return null;
    const payload = { fingerprint, generatedAt: new Date().toISOString(), ratings };
    await mkdir(dirname(cachePath), { recursive: true });
    await writeFile(cachePath, JSON.stringify(payload), "utf-8");
    return payload;
  } catch (error) {
    console.warn("[version-summary] failed to build rating distribution", extractExecErrorMessage(error));
    return null;
  }
};

const buildRatingRank = async (taikoId: string, rating: number | undefined) => {
  if (!rating || rating <= 0) return null;
  const distribution = await getRatingDistribution();
  if (!distribution) return null;
  const sorted = [...distribution.ratings].sort((a, b) => b.rating - a.rating);
  const exact = sorted.findIndex((item) => item.taikoId === taikoId);
  const rank = exact >= 0 ? exact + 1 : sorted.filter((item) => item.rating > rating).length + 1;
  const percentile = Math.max(0, Math.min(100, ((sorted.length - rank + 1) / sorted.length) * 100));
  const top = 100 - percentile;
  return {
    rating,
    rank,
    sampleSize: sorted.length,
    percentile: Number(percentile.toFixed(1)),
    tier: top <= 1 ? "top1" : top <= 5 ? "top5" : top <= 20 ? "top20" : top <= 50 ? "top50" : "growing",
    generatedAt: distribution.generatedAt
  };
};

const ensureBindingWithUserdata = async (userId: number) => {
  const binding = await getCurrentBindingRow(userId);
  if (!binding) {
    throw createError({ statusCode: 400, statusMessage: "请先绑定鼓众 ID" });
  }
  try {
    await access(getUserdataFilePath(binding.taiko_id), fsConstants.R_OK);
  } catch {
    throw createError({
      statusCode: 404,
      statusMessage: "未找到本地成绩数据，请先在「多端同步」更新数据"
    });
  }
  return binding;
};

const readCachedSummary = async (version: VersionSummaryWindow, taikoId: string, fingerprint: string) => {
  const cachePath = getCachePath(version, taikoId);
  try {
    await access(cachePath, fsConstants.R_OK);
  } catch {
    return null;
  }

  try {
    const rawText = await readFile(cachePath, "utf-8");
    const envelope = JSON.parse(rawText) as VersionSummaryCacheEnvelope;
    if (
      envelope.cacheSchema !== VERSION_SUMMARY_CACHE_SCHEMA ||
      envelope.versionKey !== version.key ||
      envelope.fingerprint !== fingerprint ||
      !envelope.payload
    ) {
      return null;
    }
    return envelope.payload;
  } catch {
    return null;
  }
};

const writeCachedSummary = async (
  version: VersionSummaryWindow,
  taikoId: string,
  historyInfo: Awaited<ReturnType<typeof getHistoryFingerprint>>,
  payload: RawVersionSummary
) => {
  const cachePath = getCachePath(version, taikoId);
  await mkdir(dirname(cachePath), { recursive: true });
  const envelope: VersionSummaryCacheEnvelope = {
    cacheSchema: VERSION_SUMMARY_CACHE_SCHEMA,
    versionKey: version.key,
    fingerprint: historyInfo.fingerprint,
    historyCount: historyInfo.historyCount,
    latestSnapshotName: historyInfo.latestSnapshotName,
    payload
  };
  await writeFile(cachePath, JSON.stringify(envelope, null, 2), "utf-8");
};

const getOrBuildRawSummary = async (taikoId: string, version: VersionSummaryWindow, forceRefresh: boolean) => {
  const historyInfo = await getHistoryFingerprint(taikoId);
  if (!historyInfo.historyCount) {
    throw createError({ statusCode: 404, statusMessage: PYTHON_FALLBACK_MESSAGES.missingHistory });
  }
  if (!forceRefresh) {
    const cached = await readCachedSummary(version, taikoId, historyInfo.fingerprint);
    if (cached) {
      return cached;
    }
  }
  const payload = await runVersionSummaryPython(taikoId, version);
  await writeCachedSummary(version, taikoId, historyInfo, payload);
  return payload;
};

const resolveSongName = (locale: VersionSummaryLocale, meta: SongCatalogItem | undefined, fallback: string) => {
  const zhName = String(meta?.song_name || "").trim();
  const jaName = String(meta?.song_name_jp || "").trim();
  if (locale === "ja") {
    return jaName || zhName || fallback || `ID ${meta?.id || ""}`.trim();
  }
  return zhName || jaName || fallback || `ID ${meta?.id || ""}`.trim();
};

const resolveSongSubtitle = (meta: SongCatalogItem | undefined) => {
  const subtitle = String(meta?.subtitle || "").trim();
  return subtitle || "";
};

const resolveSongLevel = (meta: SongCatalogItem | undefined, level?: number | null) => {
  if (!level || !meta) return null;
  const value = meta[`level_${level}` as keyof SongCatalogItem];
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildSongCard = (
  locale: VersionSummaryLocale,
  item: RawVersionSummarySong | null,
  songMap: Map<number, SongCatalogItem>,
  options: {
    level?: number | null;
  } = {}
): VersionSummarySongCard | null => {
  if (!item || !parsePositiveInt(item.songNo)) {
    return null;
  }
  const meta = songMap.get(item.songNo);
  return {
    songNo: item.songNo,
    name: resolveSongName(locale, meta, item.songName || `ID ${item.songNo}`),
    subtitle: resolveSongSubtitle(meta),
    coverUrl: getSongCoverUrl(item.songNo || COVER_FALLBACK_ID),
    playCount: item.playCount,
    activeDays: item.activeDays,
    level: resolveSongLevel(meta, options.level ?? null)
  };
};

const buildKeyword = (locale: VersionSummaryLocale, raw: RawVersionSummary["keyword"]): VersionSummaryKeyword | null => {
  if (!raw) return null;
  const dimensionLabel = getVersionSummaryDimensionLabel(locale, raw.dimensionKey);
  const title = getVersionSummaryKeywordTitle(locale, raw.titleKey);
  const body =
    locale === "ja"
      ? `${dimensionLabel} がこの期間の中心です。加重スコアは ${Number(raw.score || 0).toFixed(1)}。`
      : `${dimensionLabel} 是这段时间最鲜明的鼓面倾向，加权分值 ${Number(raw.score || 0).toFixed(1)}。`;
  return {
    dimensionKey: raw.dimensionKey,
    dimensionLabel,
    titleKey: raw.titleKey,
    title,
    score: raw.score,
    radarValues: raw.radarValues || {},
    body
  };
};

const buildTaikob20Keyword = async (locale: VersionSummaryLocale, taikoId: string): Promise<VersionSummaryKeyword | null> => {
  const raw = await runTaikob20KeywordPython(taikoId);
  if (!raw || !raw.dimensionKey) return null;
  const dimensionLabel = getVersionSummaryDimensionLabel(locale, raw.dimensionKey);
  const titleKey = KEYWORD_TITLE_KEYS_BY_DIMENSION[raw.dimensionKey] || "encouragement";
  const title = getVersionSummaryKeywordTitle(locale, titleKey);
  const body =
    locale === "ja"
      ? `現在の taikob20 を見ると、いちばん前に出ている軸は ${dimensionLabel} です。`
      : `按当前 taikob20 的轮廓来看，最先站出来的轴是 ${dimensionLabel}。`;
  return {
    dimensionKey: raw.dimensionKey,
    dimensionLabel,
    titleKey,
    title,
    score: Number(raw.score || 0),
    radarValues: raw.radarValues || {},
    body,
    rating: Number(raw.rating || 0)
  };
};

const buildViewModel = async (
  locale: VersionSummaryLocale,
  raw: RawVersionSummary,
  taikoId: string
): Promise<VersionSummaryViewModel> => {
  const catalog = await getSongCatalog();
  const songMap = new Map<number, SongCatalogItem>(catalog.map((item) => [Number(item.id), item]));

  const favoriteSong = buildSongCard(locale, raw.favoriteSong, songMap);
  const obsessionSong = buildSongCard(locale, raw.obsessionSong, songMap);
  const keyword = buildKeyword(locale, raw.keyword);
  const keywordProfile = await buildTaikob20Keyword(locale, taikoId);
  const ratingRank = await buildRatingRank(taikoId, Number((keywordProfile as (VersionSummaryKeyword & { rating?: number }) | null)?.rating));
  const breakthroughSong =
    raw.breakthrough.songNo && raw.breakthrough.songNo > 0
      ? buildSongCard(
          locale,
          {
            songNo: raw.breakthrough.songNo,
            songName: raw.breakthrough.songName || "",
            playCount: raw.breakthrough.playDelta
          },
          songMap,
          { level: raw.breakthrough.level }
        )
      : null;

  const presentation = buildVersionSummaryPresentation(
    locale,
    raw,
    favoriteSong,
    obsessionSong,
    keyword,
    breakthroughSong,
    Boolean(ratingRank)
  );
  const favoriteShift = raw.favoriteShift
    ? {
        oldFavorite: buildSongCard(locale, raw.favoriteShift.oldFavorite, songMap)!,
        newFavorite: buildSongCard(locale, raw.favoriteShift.newFavorite, songMap)!
      }
    : null;
  const monthlyFavorites = (raw.monthlyFavorites || []).flatMap((item) => {
    const song = buildSongCard(locale, item.song, songMap);
    if (!song) return [];
    const [year, month] = item.month.split("-");
    return [{ ...item, monthLabel: locale === "ja" ? `${year}年${Number(month)}月` : `${year} 年 ${Number(month)} 月`, song }];
  });
  const weekdayLabels = locale === "ja" ? ["月", "火", "水", "木", "金", "土", "日"] : ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const weekdayActivity = raw.weekdayActivity
    ? { ...raw.weekdayActivity, labels: weekdayLabels, topLabel: weekdayLabels[raw.weekdayActivity.topWeekday] || weekdayLabels[0] }
    : null;
  const calendarActivity = raw.calendarActivity
    ? { ...raw.calendarActivity, days: raw.calendarActivity.days.map((day) => ({ ...day, intensity: raw.calendarActivity!.maxPlayCount ? day.playCount / raw.calendarActivity!.maxPlayCount : 0 })) }
    : null;
  const periodLabels = locale === "ja"
    ? { dawn: "深夜", morning: "午前", afternoon: "午後", night: "夜" }
    : { dawn: "凌晨", morning: "上午", afternoon: "下午", night: "晚间" };
  const timeOfDay = raw.timeOfDay
    ? {
        topPeriod: raw.timeOfDay.topPeriod,
        topLabel: periodLabels[raw.timeOfDay.topPeriod as keyof typeof periodLabels] || raw.timeOfDay.topPeriod,
        totalPlays: raw.timeOfDay.totalPlays,
        periods: Object.entries(raw.timeOfDay.periods).map(([key, playCount]) => ({ key, label: periodLabels[key as keyof typeof periodLabels] || key, playCount }))
      }
    : null;
  const lateNightSong = raw.lateNight ? buildSongCard(locale, raw.lateNight.song, songMap) : null;
  const lateNight = raw.lateNight && lateNightSong
    ? { ...raw.lateNight, latestLabel: new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Shanghai" }).format(new Date(raw.lateNight.latestAt)), song: lateNightSong }
    : null;

  return {
    summaryId: raw.summaryId,
    generatedAt: raw.generatedAt,
    user: raw.user,
    version: raw.version,
    coverage: raw.coverage,
    period: raw.period,
    overview: {
      ...raw.overview,
      estimatedTimeText: presentation.estimatedTimeText
    },
    favoriteSong,
    obsessionSong,
    favoriteShift,
    monthlyFavorites,
    weekdayActivity,
    calendarActivity,
    timeOfDay,
    lateNight,
    ratingRank,
    keyword,
    keywordProfile,
    breakthrough: presentation.breakthrough,
    finalTitle: presentation.finalTitle,
    poster: presentation.poster,
    story: presentation.story,
    copy: presentation.copy,
    flags: raw.flags
  };
};

export const getAccountVersionSummaryPayload = async (
  userId: number,
  options: {
    versionKey?: string | null;
    refresh?: boolean;
    locale?: string | null;
  } = {}
): Promise<VersionSummaryPayload> => {
  const locale = toLocale(options.locale);
  const version = resolveVersionSummaryWindow(options.versionKey);
  const bindingRow = await ensureBindingWithUserdata(userId);
  const binding = await enrichBindingWithCurrentTitle(sanitizeBinding(bindingRow));
  const raw = await getOrBuildRawSummary(binding.taikoId, version, Boolean(options.refresh));
  const summary = await buildViewModel(locale, raw, binding.taikoId);

  return {
    availableVersions: listVersionSummaryWindows(),
    selectedVersion: version,
    currentBinding: binding,
    summary
  };
};
