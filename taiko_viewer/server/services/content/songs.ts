import type {
  HomeContentPayload,
  RatingContentItem,
  SongCatalogItem,
  SongCatalogPayload,
  SongDetailPayload
} from "~/types/content";
import { getContentRuntimePaths, readCachedJsonFile } from "./runtime";
import { getSongBranchAudioVariants } from "./songBranchAudio";
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

export const resolveCatalogSongId = async (id: number) => {
  const songs = await getSongCatalog();
  return Number(songs.find(song => Number(song.id) === id || song.legacy_ids?.includes(id))?.id ?? id);
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

type SongCatalogPageOptions = {
  shelfStatus?: number;
  keyword?: string;
  page?: number;
  pageSize?: number;
  sort?: "catalog" | "open-day-desc";
};

const categorySearchAliases: Record<string, string> = {
  南梦宫原创音乐: "ナムコオリジナル",
  流行音乐: "ポップス",
  儿童音乐: "キッズ",
  古典音乐: "クラシック",
  综合音乐: "バラエティ",
  游戏音乐: "ゲームミュージック",
  博歌乐音乐: "ボーカロイド",
  动漫音乐: "アニメ"
};

const toSongListItem = (song: SongCatalogItem): SongCatalogItem => ({
  id: Number(song.id),
  song_name: String(song.song_name || ""),
  song_name_jp: song.song_name_jp ? String(song.song_name_jp) : undefined,
  open_day: song.open_day ? String(song.open_day) : undefined,
  type: String(song.type || ""),
  bpm: song.bpm === undefined || song.bpm === null ? undefined : String(song.bpm),
  shelf_status: song.shelf_status,
  level_1: song.level_1,
  level_2: song.level_2,
  level_3: song.level_3,
  level_4: song.level_4,
  level_5: song.level_5
});

export const getSongCatalogPagePayload = async (options: SongCatalogPageOptions) => {
  const songs = await getSongCatalog();
  const page = Math.max(1, Math.floor(Number(options.page) || 1));
  const pageSize = Math.min(60, Math.max(12, Math.floor(Number(options.pageSize) || 24)));
  const keyword = String(options.keyword || "").trim().toLocaleLowerCase();

  let filtered = songs.filter(
    (song) => options.shelfStatus === undefined || normalizeShelfStatus(song.shelf_status) === options.shelfStatus
  );

  if (keyword) {
    filtered = filtered.filter((song) =>
      [song.song_name, song.song_name_jp, song.type, categorySearchAliases[String(song.type || "")], song.id]
        .some((value) => String(value ?? "").toLocaleLowerCase().includes(keyword))
    );
  }

  if (options.sort === "open-day-desc") {
    filtered = [...filtered].sort((a, b) => {
      const dateDiff = parseOpenDay(b.open_day) - parseOpenDay(a.open_day);
      return dateDiff || Number(b.id || 0) - Number(a.id || 0);
    });
  }

  const start = (page - 1) * pageSize;
  return {
    total: filtered.length,
    page,
    pageSize,
    songs: filtered.slice(start, start + pageSize).map(toSongListItem)
  };
};

export const getSongDetailPayload = async (songId: number): Promise<SongDetailPayload> => {
  songId = await resolveCatalogSongId(songId);
  const [songs, ratingEntries, branchAudioVariants, tjaBundleUrl] = await Promise.all([
    getSongCatalog(),
    getRatingEntries(),
    getSongBranchAudioVariants(songId),
    getSongTjaBundleUrl(songId)
  ]);
  return {
    song: songs.find((item) => Number(item.id) === songId) || null,
    ratingEntries: ratingEntries.filter((item) => Number(item.id) === songId),
    branchAudioVariants,
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
