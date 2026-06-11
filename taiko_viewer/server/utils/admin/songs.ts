import { access, readdir } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { createError } from "h3";
import type { SongCatalogItem, RatingContentItem } from "~/types/content";
import { getRatingEntries } from "~/server/services/content";
import { createAdminBackupSnapshot } from "./backup";
import { recordAdminAction } from "./audit";
import { getAdminManagedPaths, readJsonFile, readOptionalJsonFile, writeFileAtomic } from "./shared";
import { getGuideDependencySummary } from "./guides";

type SongAliasEntry = {
  id: number;
  aliases: string[];
  song_name_jp?: string;
};

type AdminSongRow = SongCatalogItem & {
  aliasCount: number;
  hasCover: boolean;
  ratingCount: number;
  guideMusicExists: boolean;
  guideDifficultyCount: number;
};

const SONG_CACHE_TTL_MS = 60 * 1000;

let songCache: { expiresAt: number; items: AdminSongRow[] } | null = null;

const normalizeText = (value: unknown) => String(value || "").trim();

const normalizeNumberOrText = (value: unknown) => {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const parsed = Number(text);
  return Number.isFinite(parsed) && !text.includes("/") ? parsed : text;
};

const normalizeStringArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  return String(value || "")
    .split(/[\n,，/]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeNumberArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeNumberOrText(item));
  }
  return String(value || "")
    .split(/[\n,，/]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => normalizeNumberOrText(item));
};

const toPositiveSongId = (value: unknown) => {
  const parsed = Number(value || 0);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createError({ statusCode: 400, statusMessage: "歌曲 ID 无效" });
  }
  return parsed;
};

const normalizeSongPayload = (payload: Record<string, unknown>): SongCatalogItem & Record<string, unknown> => {
  const id = toPositiveSongId(payload.id);
  const songName = normalizeText(payload.song_name);
  const songNameJp = normalizeText(payload.song_name_jp);
  const type = normalizeText(payload.type);
  if (!songName || !songNameJp || !type) {
    throw createError({ statusCode: 400, statusMessage: "曲名、日文名和分类不能为空" });
  }
  return {
    id,
    sort: Number(payload.sort || 0) || undefined,
    open_day: normalizeText(payload.open_day) || undefined,
    type,
    tag: normalizeText(payload.tag) || undefined,
    song_name: songName,
    song_name_jp: songNameJp,
    subtitle: normalizeText(payload.subtitle) || undefined,
    level_1: normalizeNumberOrText(payload.level_1) || undefined,
    level_2: normalizeNumberOrText(payload.level_2) || undefined,
    level_3: normalizeNumberOrText(payload.level_3) || undefined,
    level_4: normalizeNumberOrText(payload.level_4) || undefined,
    level_5: normalizeNumberOrText(payload.level_5) || undefined,
    isPlayed: Boolean(payload.isPlayed),
    bpm: normalizeText(payload.bpm) || undefined,
    version: normalizeStringArray(payload.version),
    artists: normalizeStringArray(payload.artists),
    max_combo: normalizeNumberArray(payload.max_combo),
    shelf_status: Number(payload.shelf_status ?? 0)
  };
};

const sortSongRows = (items: Array<SongCatalogItem & Record<string, unknown>>) =>
  [...items].sort((a, b) => {
    const sortDiff = Number(a.sort || 0) - Number(b.sort || 0);
    if (sortDiff !== 0) return sortDiff;
    return Number(a.id || 0) - Number(b.id || 0);
  });

const readSongCatalogRaw = async () => {
  const { songDataPath } = getAdminManagedPaths();
  return readJsonFile<Array<SongCatalogItem & Record<string, unknown>>>(songDataPath);
};

const getSongRowsWithMetadata = async () => {
  if (songCache && songCache.expiresAt > Date.now()) {
    return songCache.items;
  }

  const { coverDir } = getAdminManagedPaths();
  const [songs, aliasEntries, ratingEntries, guideSnapshot, coverFiles] = await Promise.all([
    readSongCatalogRaw(),
    readOptionalJsonFile<SongAliasEntry[]>(getAdminManagedPaths().songAliasPath, []),
    getRatingEntries(),
    import("./guides").then((module) => module.getGuideAdminSnapshot()),
    readdir(coverDir).catch(() => [])
  ]);
  const aliasCountMap = new Map(aliasEntries.map((item) => [Number(item.id), Array.isArray(item.aliases) ? item.aliases.length : 0]));
  const ratingCountMap = new Map<number, number>();
  for (const item of ratingEntries as RatingContentItem[]) {
    const songId = Number(item.id || 0);
    if (!songId) continue;
    ratingCountMap.set(songId, Number(ratingCountMap.get(songId) || 0) + 1);
  }
  const guideMusicSet = new Set(guideSnapshot.musics.map((item) => Number(item.id)));
  const guideDifficultyCountMap = new Map<number, number>();
  for (const item of guideSnapshot.difficulties) {
    const songId = Number(item.musicId || 0);
    guideDifficultyCountMap.set(songId, Number(guideDifficultyCountMap.get(songId) || 0) + 1);
  }
  const coverSet = new Set(
    coverFiles
      .filter((name) => /^\d+\.png$/i.test(name))
      .map((name) => Number(name.replace(/\.png$/i, "")))
      .filter((id) => Number.isInteger(id) && id > 0)
  );
  const items = sortSongRows(songs).map((item) => ({
    ...item,
    aliasCount: Number(aliasCountMap.get(Number(item.id)) || 0),
    hasCover: coverSet.has(Number(item.id)),
    ratingCount: Number(ratingCountMap.get(Number(item.id)) || 0),
    guideMusicExists: guideMusicSet.has(Number(item.id)),
    guideDifficultyCount: Number(guideDifficultyCountMap.get(Number(item.id)) || 0)
  }));
  songCache = {
    expiresAt: Date.now() + SONG_CACHE_TTL_MS,
    items
  };
  return items;
};

export const invalidateAdminSongCache = () => {
  songCache = null;
};

export const listAdminSongs = async (query: {
  keyword?: unknown;
  type?: unknown;
  shelfStatus?: unknown;
  page?: unknown;
  pageSize?: unknown;
}) => {
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(100, Math.max(10, Number(query.pageSize || 20)));
  const keyword = normalizeText(query.keyword).toLowerCase();
  const type = normalizeText(query.type);
  const shelfStatus =
    query.shelfStatus === undefined || query.shelfStatus === null || query.shelfStatus === ""
      ? null
      : Number(query.shelfStatus);
  const rows = await getSongRowsWithMetadata();
  const filtered = rows.filter((item) => {
    if (type && item.type !== type) return false;
    if (shelfStatus !== null && Number(item.shelf_status || 0) !== shelfStatus) return false;
    if (!keyword) return true;
    return [
      item.song_name,
      item.song_name_jp,
      item.subtitle,
      item.type,
      String(item.id),
      ...(Array.isArray(item.artists) ? item.artists : []),
      ...(Array.isArray(item.version) ? item.version : [])
    ]
      .filter(Boolean)
      .some((value) => String(value || "").toLowerCase().includes(keyword));
  });
  const typeOptions = Array.from(new Set(rows.map((item) => item.type).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
  const start = (page - 1) * pageSize;
  return {
    total: filtered.length,
    page,
    pageSize,
    typeOptions,
    items: filtered.slice(start, start + pageSize)
  };
};

export const exportAdminSongs = async () => {
  return readSongCatalogRaw();
};

const assertSongDeletionAllowed = async (songId: number) => {
  const rows = await getSongRowsWithMetadata();
  const song = rows.find((item) => Number(item.id) === songId) || null;
  if (!song) {
    throw createError({ statusCode: 404, statusMessage: "未找到该歌曲" });
  }
  const guideDependency = await getGuideDependencySummary(songId);
  const reasons: string[] = [];
  if (song.aliasCount > 0) reasons.push(`仍有 ${song.aliasCount} 条别名`);
  if (song.hasCover) reasons.push("仍存在封面文件");
  if (song.ratingCount > 0) reasons.push(`rating 结构中仍有 ${song.ratingCount} 条记录`);
  if (guideDependency.music) reasons.push("远端攻略歌曲仍存在");
  if (guideDependency.difficulties.length > 0) reasons.push(`远端仍有 ${guideDependency.difficulties.length} 条谱面攻略`);
  if (reasons.length) {
    throw createError({
      statusCode: 409,
      statusMessage: `当前歌曲仍存在依赖，禁止删除：${reasons.join("、")}`
    });
  }
  return song;
};

const persistSongCatalog = async (
  nextSongs: Array<SongCatalogItem & Record<string, unknown>>,
  actor: { id: number; username: string },
  reason: string
) => {
  const { songDataPath } = getAdminManagedPaths();
  await createAdminBackupSnapshot({
    category: "mutations",
    label: "song-data",
    reason,
    actorId: String(actor.id),
    actorName: actor.username,
    sources: [
      {
        path: songDataPath
      }
    ]
  });
  await writeFileAtomic(songDataPath, `${JSON.stringify(sortSongRows(nextSongs), null, 2)}\n`);
  invalidateAdminSongCache();
};

export const createAdminSong = async (
  actor: { id: number; username: string },
  payload: Record<string, unknown>
) => {
  const songs = await readSongCatalogRaw();
  const nextSong = normalizeSongPayload(payload);
  if (songs.some((item) => Number(item.id) === Number(nextSong.id))) {
    throw createError({ statusCode: 409, statusMessage: "该歌曲 ID 已存在" });
  }
  const nextSongs = [...songs, nextSong];
  await persistSongCatalog(nextSongs, actor, `create-song-${nextSong.id}`);
  await recordAdminAction({
    actorType: "admin",
    actorId: String(actor.id),
    actorName: actor.username,
    source: "admin-web",
    targetType: "song-data",
    targetKey: String(nextSong.id),
    action: "create",
    after: nextSong
  });
  return nextSong;
};

export const updateAdminSong = async (
  actor: { id: number; username: string },
  payload: Record<string, unknown>
) => {
  const songs = await readSongCatalogRaw();
  const nextSong = normalizeSongPayload(payload);
  const index = songs.findIndex((item) => Number(item.id) === Number(nextSong.id));
  if (index < 0) {
    throw createError({ statusCode: 404, statusMessage: "未找到该歌曲" });
  }
  const before = songs[index];
  const nextSongs = [...songs];
  nextSongs[index] = {
    ...before,
    ...nextSong
  };
  await persistSongCatalog(nextSongs, actor, `update-song-${nextSong.id}`);
  await recordAdminAction({
    actorType: "admin",
    actorId: String(actor.id),
    actorName: actor.username,
    source: "admin-web",
    targetType: "song-data",
    targetKey: String(nextSong.id),
    action: "update",
    before,
    after: nextSongs[index]
  });
  return nextSongs[index];
};

export const deleteAdminSong = async (actor: { id: number; username: string }, songIdInput: unknown) => {
  const songId = toPositiveSongId(songIdInput);
  const before = await assertSongDeletionAllowed(songId);
  const songs = await readSongCatalogRaw();
  const nextSongs = songs.filter((item) => Number(item.id) !== songId);
  await persistSongCatalog(nextSongs, actor, `delete-song-${songId}`);
  await recordAdminAction({
    actorType: "admin",
    actorId: String(actor.id),
    actorName: actor.username,
    source: "admin-web",
    targetType: "song-data",
    targetKey: String(songId),
    action: "delete",
    before
  });
  return { ok: true };
};

export const getAdminSongDetail = async (songIdInput: unknown) => {
  const songId = toPositiveSongId(songIdInput);
  const rows = await getSongRowsWithMetadata();
  const song = rows.find((item) => Number(item.id) === songId) || null;
  if (!song) {
    throw createError({ statusCode: 404, statusMessage: "未找到该歌曲" });
  }
  return song;
};
