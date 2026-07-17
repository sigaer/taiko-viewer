import type {
  HomeContentPayload,
  RatingContentItem,
  SongCatalogItem,
  SongCatalogPayload,
  SongDetailPayload
} from "~/types/content";
import { getContentRuntimePaths, readCachedJsonFile } from "./runtime";
import { getSongBranchAudioTracks } from "./songBranchAudio";
import { getSongTjaBundleUrl } from "./songTjaBundle";

let songCatalogCache: { mtimeMs: number; data: SongCatalogItem[] } | null = null;
let ratingEntriesCache: { mtimeMs: number; data: RatingContentItem[] } | null = null;

const parseOpenDay = (input?: string) => {
  if (!input) return 0;
  const match = input.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return 0;
  return new Date(Number(match[3]), Number(match[1]) - 1, Number(match[2])).getTime();
};

const normalizeShelfStatus = (value: SongCatalogItem["shelf_status"]) => {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const getSongCatalog = async () => {
  const { songDataPath } = getContentRuntimePaths();
  const result = await readCachedJsonFile<SongCatalogItem[]>(songCatalogCache, songDataPath);
  songCatalogCache = result.cache;
  return result.data;
};

export const getRatingEntries = async () => {
  const { ratingStructPath } = getContentRuntimePaths();
  const result = await readCachedJsonFile<{ songs?: Record<string, RatingContentItem> | RatingContentItem[] }>(
    ratingEntriesCache ? { mtimeMs: ratingEntriesCache.mtimeMs, data: { songs: ratingEntriesCache.data } } : null,
    ratingStructPath
  );
  const payload = result.data;
  const rawSongs = payload?.songs;
  const rows = Array.isArray(rawSongs) ? rawSongs : Object.values(rawSongs || {});
  ratingEntriesCache = {
    mtimeMs: result.cache.mtimeMs,
    data: rows
  };
  return rows;
};

export const getSongCatalogPayload = async (shelfStatus?: number): Promise<SongCatalogPayload> => {
  const songs = await getSongCatalog();
  const filtered =
    shelfStatus === undefined
      ? songs
      : songs.filter((song) => normalizeShelfStatus(song.shelf_status) === shelfStatus);
  return { songs: filtered };
};

export const getSongDetailPayload = async (songId: number): Promise<SongDetailPayload> => {
  const [songs, ratingEntries, branchAudioTracks, tjaBundleUrl] = await Promise.all([
    getSongCatalog(),
    getRatingEntries(),
    getSongBranchAudioTracks(songId),
    getSongTjaBundleUrl(songId)
  ]);
  return {
    song: songs.find((item) => Number(item.id) === songId) || null,
    ratingEntries: ratingEntries.filter((item) => Number(item.id) === songId),
    branchAudioTracks,
    tjaBundleUrl
  };
};

export const getHomeContent = async (): Promise<HomeContentPayload> => {
  const songs = await getSongCatalog();
  const latestSongs = [...songs]
    .filter((song) => normalizeShelfStatus(song.shelf_status) === 0)
    .sort((a, b) => {
      const dateDiff = parseOpenDay(b.open_day) - parseOpenDay(a.open_day);
      if (dateDiff !== 0) return dateDiff;
      return Number(b.id || 0) - Number(a.id || 0);
    })
    .slice(0, 6);
  return { latestSongs };
};
