import { access, readFile, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { resolve } from "node:path";

export const CONTENT_CANONICAL_BASE_URL = "https://viewer.sakura-bot.cn";
export const CONTENT_STATIC_BASE_URL = "https://static.sakura-bot.cn";
const GUIDE_CACHE_TTL_MS = 5 * 60 * 1000;

export const getGuideCacheTtlMs = () => GUIDE_CACHE_TTL_MS;

export const getContentRuntimePaths = () => {
  const runtimeConfig = useRuntimeConfig();
  const repoRoot = String(
    runtimeConfig.repoRoot || process.env.TAIKO_REPO_ROOT || resolve(process.cwd(), "..")
  );
  const songDataPath = String(
    runtimeConfig.songDataPath || process.env.TAIKO_SONG_DATA_PATH || resolve(repoRoot, "songs", "song_data.json")
  );
  const ratingStructPath = String(
    runtimeConfig.ratingStructPath ||
      process.env.TAIKO_RATING_STRUCT_PATH ||
      resolve(repoRoot, "songs", "rating_structured_with_ids.json")
  );
  const branchAudioManifestPath = String(
    runtimeConfig.branchAudioManifestPath ||
      process.env.TAIKO_BRANCH_AUDIO_MANIFEST_PATH ||
      resolve(repoRoot, "songs", "branch_audio_manifest.json")
  );
  const dataDir = String(runtimeConfig.dataDir || process.env.TAIKO_FRONTEND_DATA_DIR || "");
  const guideApiBase = String(runtimeConfig.public.guideApiBase || runtimeConfig.public.apiBase || CONTENT_STATIC_BASE_URL);
  return {
    repoRoot,
    songDataPath,
    ratingStructPath,
    branchAudioManifestPath,
    dataDirs: resolveDataDirs(dataDir),
    guideApiBase
  };
};

export const resolveDataDirs = (configuredDir: string) => {
  const cwd = typeof process !== "undefined" ? process.cwd() : "";
  const dirs = [
    configuredDir,
    cwd ? resolve(cwd, "assets/data") : "",
    cwd ? resolve(cwd, "taiko_viewer/assets/data") : ""
  ].filter(Boolean);
  return Array.from(new Set(dirs));
};

export const readJsonFile = async <T>(filePath: string): Promise<T> => {
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content) as T;
};

export const readCachedJsonFile = async <T>(
  cache: { mtimeMs: number; data: T } | null,
  filePath: string
) => {
  const fileStat = await stat(filePath);
  if (cache && cache.mtimeMs === fileStat.mtimeMs) {
    return { cache, data: cache.data };
  }
  const data = await readJsonFile<T>(filePath);
  return {
    cache: {
      mtimeMs: fileStat.mtimeMs,
      data
    },
    data
  };
};

export const findReadableDataFile = async (fileName: string) => {
  const { dataDirs } = getContentRuntimePaths();
  for (const dir of dataDirs) {
    const filePath = resolve(dir, fileName);
    try {
      await access(filePath, fsConstants.R_OK);
      return filePath;
    } catch {
      // Probe next candidate path.
    }
  }
  return "";
};

export const buildCanonicalUrl = (path: string) => {
  const normalized = `/${String(path || "/")
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/+/, "")
    .replace(/\?.*$/, "")
    .replace(/#.*$/, "")}`;
  return `${CONTENT_CANONICAL_BASE_URL}${normalized === "//" ? "/" : normalized}`;
};

export const buildStaticCoverAssetUrl = (songId: number) =>
  `${CONTENT_STATIC_BASE_URL}/cover/${songId}.png`;
