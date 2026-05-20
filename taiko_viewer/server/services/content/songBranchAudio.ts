import { stat } from "node:fs/promises";
import type { SongTrackKey } from "~/types/content";
import { CONTENT_STATIC_BASE_URL, getContentRuntimePaths, readJsonFile } from "./runtime";

type SongDatabaseCourse = {
  isBranched?: number;
};

type SongDatabaseEntry = {
  songNo?: number | string;
  courses?: Partial<Record<"easy" | "normal" | "hard" | "oni" | "ura", SongDatabaseCourse | null>>;
};

const courseTrackMap: Record<keyof NonNullable<SongDatabaseEntry["courses"]>, SongTrackKey> = {
  easy: "EASY",
  normal: "NORMAL",
  hard: "HARD",
  oni: "ONI",
  ura: "EDIT"
};

type BranchTrackRecord = {
  branchTracks: SongTrackKey[];
  candidateTracks: SongTrackKey[];
};

const branchVariantLabels = ["普通", "玄人", "达人"] as const;

let branchTrackCache: { mtimeMs: number; data: Record<number, BranchTrackRecord> } | null = null;
let branchTrackProbeCache = new Map<string, boolean>();

const extractBranchTracks = (entry: SongDatabaseEntry): SongTrackKey[] => {
  const courses = entry.courses;
  if (!courses) return [];

  return (Object.entries(courseTrackMap) as Array<[keyof typeof courseTrackMap, SongTrackKey]>)
    .filter(([courseKey]) => Number(courses[courseKey]?.isBranched) === 1)
    .map(([, trackKey]) => trackKey);
};

const extractCandidateTracks = (entry: SongDatabaseEntry): SongTrackKey[] => {
  const courses = entry.courses;
  if (!courses) return [];

  return (Object.entries(courseTrackMap) as Array<[keyof typeof courseTrackMap, SongTrackKey]>)
    .filter(([courseKey]) => !!courses[courseKey])
    .map(([, trackKey]) => trackKey);
};

const checkUrlExists = async (url: string) => {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch {
    return false;
  }
};

const probeTrackBranchAudio = async (songId: number, track: SongTrackKey) => {
  const cacheKey = `${songId}:${track}`;
  const cached = branchTrackProbeCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const urls = branchVariantLabels.map(
    (label) => `${CONTENT_STATIC_BASE_URL}/drum/${songId}_${track}_${encodeURIComponent(label)}.mp3`
  );
  const exists = (await Promise.all(urls.map(checkUrlExists))).every(Boolean);
  branchTrackProbeCache.set(cacheKey, exists);
  return exists;
};

const getBranchTrackIndex = async () => {
  const { songDatabasePath } = getContentRuntimePaths();

  try {
    const fileStat = await stat(songDatabasePath);
    if (branchTrackCache && branchTrackCache.mtimeMs === fileStat.mtimeMs) {
      return branchTrackCache.data;
    }

    const rows = await readJsonFile<SongDatabaseEntry[]>(songDatabasePath);
    const index: Record<number, BranchTrackRecord> = {};

    rows.forEach((entry) => {
      const songId = Number(entry.songNo);
      if (!Number.isInteger(songId) || songId <= 0) return;

      index[songId] = {
        branchTracks: extractBranchTracks(entry),
        candidateTracks: extractCandidateTracks(entry)
      };
    });

    branchTrackProbeCache = new Map();
    branchTrackCache = {
      mtimeMs: fileStat.mtimeMs,
      data: index
    };

    return index;
  } catch {
    return branchTrackCache?.data || {};
  }
};

export const getSongBranchAudioTracks = async (songId: number): Promise<SongTrackKey[]> => {
  const index = await getBranchTrackIndex();
  const record = index[songId];
  if (!record) return [];
  if (record.branchTracks.length) return record.branchTracks;
  if (!record.candidateTracks.length) return [];

  const probedTracks = (
    await Promise.all(
      record.candidateTracks.map(async (track) => ((await probeTrackBranchAudio(songId, track)) ? track : null))
    )
  ).filter((track): track is SongTrackKey => !!track);

  if (probedTracks.length) {
    record.branchTracks = probedTracks;
  }

  return probedTracks;
};
