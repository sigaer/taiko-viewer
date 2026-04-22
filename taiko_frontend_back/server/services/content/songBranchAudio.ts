import { stat } from "node:fs/promises";
import type { SongTrackKey } from "~/types/content";
import { getContentRuntimePaths, readJsonFile } from "./runtime";

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

let branchTrackCache: { mtimeMs: number; data: Record<number, SongTrackKey[]> } | null = null;

const extractBranchTracks = (entry: SongDatabaseEntry): SongTrackKey[] => {
  const courses = entry.courses;
  if (!courses) return [];

  return (Object.entries(courseTrackMap) as Array<[keyof typeof courseTrackMap, SongTrackKey]>)
    .filter(([courseKey]) => Number(courses[courseKey]?.isBranched) === 1)
    .map(([, trackKey]) => trackKey);
};

const getBranchTrackIndex = async () => {
  const { songDatabasePath } = getContentRuntimePaths();

  try {
    const fileStat = await stat(songDatabasePath);
    if (branchTrackCache && branchTrackCache.mtimeMs === fileStat.mtimeMs) {
      return branchTrackCache.data;
    }

    const rows = await readJsonFile<SongDatabaseEntry[]>(songDatabasePath);
    const index: Record<number, SongTrackKey[]> = {};

    rows.forEach((entry) => {
      const songId = Number(entry.songNo);
      if (!Number.isInteger(songId) || songId <= 0) return;

      const branchTracks = extractBranchTracks(entry);
      if (!branchTracks.length) return;

      index[songId] = branchTracks;
    });

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
  return index[songId] || [];
};
