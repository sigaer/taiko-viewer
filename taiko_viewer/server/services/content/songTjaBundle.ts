import { execFile } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { getContentRuntimePaths, readJsonFile } from "./runtime";

const execFileAsync = promisify(execFile);
const songTjaBundleIndexHelperPath = resolve(process.cwd(), "server/services/content/songTjaBundleIndex.py");

type SongTjaMatch = {
  tja_path: string;
  rel_path: string;
};

type SongTjaIndexPayload = {
  tja_root: string;
  song_count: number;
  matched_count: number;
  unresolved_count: number;
  matches: Record<string, SongTjaMatch>;
};

type SongTjaBundleSource = {
  tjaPath: string;
  tjaName: string;
  audioPath: string;
  audioName: string;
};

type RepoPathInfo = {
  tjaRoot: string;
  reportMtimeMs: number;
};

type TjaRootReportPayload = {
  repo?: {
    repo_path?: string;
    user_repo_path?: string;
  };
};

let songTjaIndexCache: { cacheKey: string; data: SongTjaIndexPayload } | null = null;

const defaultTjaRepoCandidates = ["/home/sigaer/git/ESE_autosync", "/home/sigaer/git/ESE"];

const ensureReadablePath = async (filePath: string) => {
  await access(filePath, fsConstants.R_OK);
};

const canReadPath = async (filePath: string) => {
  try {
    await ensureReadablePath(filePath);
    return true;
  } catch {
    return false;
  }
};

const resolveTjaRepoPath = async (reportPath: string): Promise<RepoPathInfo> => {
  let reportMtimeMs = 0;
  const candidates: string[] = [];

  try {
    const reportStat = await stat(reportPath);
    reportMtimeMs = reportStat.mtimeMs;
    const report = await readJsonFile<TjaRootReportPayload>(reportPath);
    candidates.push(String(report.repo?.repo_path || "").trim());
    candidates.push(String(report.repo?.user_repo_path || "").trim());
  } catch {
    // Fall back to the well-known local mirrors when the sync report is absent.
  }

  candidates.push(...defaultTjaRepoCandidates);

  for (const candidate of candidates.filter(Boolean)) {
    if (await canReadPath(candidate)) {
      return {
        tjaRoot: candidate,
        reportMtimeMs
      };
    }
  }

  throw new Error("未找到可读的 ESE TJA 源目录");
};

const loadSongTjaIndex = async (forceRefresh = false): Promise<SongTjaIndexPayload> => {
  const { repoRoot, songDataPath } = getContentRuntimePaths();
  const mergeIndexPath = resolve(repoRoot, "plugins", "utils", "merge_index.py");
  const reportPath = resolve(repoRoot, "logs", "ese_audio_sync_report.json");
  const songDataStat = await stat(songDataPath);
  const { tjaRoot, reportMtimeMs } = await resolveTjaRepoPath(reportPath);
  const cacheKey = [songDataStat.mtimeMs, reportMtimeMs, tjaRoot].join(":");

  if (!forceRefresh && songTjaIndexCache?.cacheKey === cacheKey) {
    return songTjaIndexCache.data;
  }

  await ensureReadablePath(songTjaBundleIndexHelperPath);
  await ensureReadablePath(mergeIndexPath);

  let stdout = "";
  let stderr = "";

  try {
    const result = await execFileAsync(
      "python3",
      [
        songTjaBundleIndexHelperPath,
        "--song-data",
        songDataPath,
        "--tja-root",
        tjaRoot,
        "--merge-index",
        mergeIndexPath
      ],
      {
        maxBuffer: 16 * 1024 * 1024
      }
    );
    stdout = result.stdout;
    stderr = result.stderr;
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string; message?: string };
    const detail = [failure.message, failure.stderr, failure.stdout].filter(Boolean).join("\n").trim();
    throw new Error(`构建歌曲 TJA 索引失败：${detail || "未知错误"}`);
  }

  let payload: SongTjaIndexPayload;
  try {
    payload = JSON.parse(stdout) as SongTjaIndexPayload;
  } catch (error) {
    const detail = [String((error as Error).message || ""), stderr.trim(), stdout.trim()].filter(Boolean).join("\n");
    throw new Error(`解析歌曲 TJA 索引失败：${detail}`);
  }

  songTjaIndexCache = {
    cacheKey,
    data: payload
  };
  return payload;
};

const extractWaveField = (content: string) => {
  const normalized = String(content || "").replace(/^\uFEFF/, "");
  const match = normalized.match(/^\s*WAVE\s*:(.+?)\s*$/im);
  return match?.[1]?.trim() || "";
};

const isPathOutsideBaseDir = (baseDir: string, targetPath: string) => {
  const relPath = relative(baseDir, targetPath);
  return relPath === ".." || relPath.startsWith(`..${sep}`) || isAbsolute(relPath);
};

const resolveBundleSourceFromMatch = async (match: SongTjaMatch): Promise<SongTjaBundleSource | null> => {
  try {
    await ensureReadablePath(match.tja_path);
    const content = await readFile(match.tja_path, "utf-8");
    const waveField = extractWaveField(content);
    if (!waveField) {
      return null;
    }

    const tjaDir = resolve(match.tja_path, "..");
    const audioPath = resolve(tjaDir, waveField);
    if (isPathOutsideBaseDir(tjaDir, audioPath)) {
      return null;
    }

    await ensureReadablePath(audioPath);
    return {
      tjaPath: match.tja_path,
      tjaName: basename(match.tja_path),
      audioPath,
      audioName: basename(audioPath)
    };
  } catch {
    return null;
  }
};

export const resolveSongTjaBundleSource = async (songId: number): Promise<SongTjaBundleSource | null> => {
  const payload = await loadSongTjaIndex();
  const match = payload.matches[String(songId)];
  if (!match) {
    return null;
  }

  const source = await resolveBundleSourceFromMatch(match);
  if (source) {
    return source;
  }

  const refreshedPayload = await loadSongTjaIndex(true);
  const refreshedMatch = refreshedPayload.matches[String(songId)];
  if (!refreshedMatch) {
    return null;
  }
  return resolveBundleSourceFromMatch(refreshedMatch);
};

export const getSongTjaBundleUrl = async (songId: number) => {
  const source = await resolveSongTjaBundleSource(songId);
  return source ? `/api/content/songs/${songId}/tja-package` : null;
};
