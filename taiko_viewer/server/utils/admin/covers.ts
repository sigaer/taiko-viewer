import { access, readdir, unlink } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { createError } from "h3";
import { getOssClient } from "~/server/internal/account/shared";
import { createAdminBackupSnapshot } from "./backup";
import { recordAdminAction } from "./audit";
import { getAdminManagedPaths, writeFileAtomic } from "./shared";
import { exportAdminSongs } from "./songs";

const normalizeText = (value: unknown) => String(value || "").trim();

const toSongId = (value: unknown) => {
  const parsed = Number(value || 0);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createError({ statusCode: 400, statusMessage: "歌曲 ID 无效" });
  }
  return parsed;
};

const getCoverFilePath = (songId: number) => join(getAdminManagedPaths().coverDir, `${songId}.png`);

const getCoverPublicUrl = (songId: number) => {
  const runtimeConfig = useRuntimeConfig();
  const apiBase = String(runtimeConfig.public.apiBase || "https://static.sakura-bot.cn").replace(/\/$/, "");
  return `${apiBase}/cover/${songId}.png`;
};

const ensureSongExists = async (songId: number) => {
  const songs = await exportAdminSongs();
  const song = songs.find((item) => Number(item.id) === songId);
  if (!song) {
    throw createError({ statusCode: 404, statusMessage: "歌曲不存在" });
  }
  return song;
};

const coverFileExists = async (songId: number) => {
  try {
    await access(getCoverFilePath(songId), fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
};

const uploadCoverToOss = async (songId: number, filePath: string) => {
  const client = getOssClient();
  const objectKey = `cover/${songId}.png`;
  await client.put(objectKey, filePath);
  return objectKey;
};

const deleteCoverFromOss = async (songId: number) => {
  const client = getOssClient();
  await client.delete(`cover/${songId}.png`);
};

export const listAdminCovers = async (query: {
  keyword?: unknown;
  hasCover?: unknown;
  page?: unknown;
  pageSize?: unknown;
}) => {
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(100, Math.max(10, Number(query.pageSize || 20)));
  const keyword = normalizeText(query.keyword).toLowerCase();
  const hasCoverFilter =
    query.hasCover === undefined || query.hasCover === null || query.hasCover === ""
      ? null
      : String(query.hasCover) === "1";
  const [songs, coverNames] = await Promise.all([
    exportAdminSongs(),
    readdir(getAdminManagedPaths().coverDir).catch(() => [])
  ]);
  const coverSet = new Set(
    coverNames
      .filter((name) => /^\d+\.png$/i.test(name))
      .map((name) => Number(name.replace(/\.png$/i, "")))
      .filter((value) => Number.isInteger(value) && value > 0)
  );
  const rows = songs
    .map((song) => ({
      songId: Number(song.id),
      title: song.song_name,
      titleJp: song.song_name_jp,
      type: song.type,
      hasCover: coverSet.has(Number(song.id)),
      coverUrl: coverSet.has(Number(song.id)) ? getCoverPublicUrl(Number(song.id)) : ""
    }))
    .filter((row) => {
      if (hasCoverFilter !== null && row.hasCover !== hasCoverFilter) return false;
      if (!keyword) return true;
      return [row.title, row.titleJp, row.type, String(row.songId)]
        .filter(Boolean)
        .some((value) => String(value || "").toLowerCase().includes(keyword));
    });
  const start = (page - 1) * pageSize;
  return {
    total: rows.length,
    page,
    pageSize,
    items: rows.slice(start, start + pageSize)
  };
};

export const uploadAdminCover = async (input: {
  actor: { id: number; username: string };
  songId: number;
  fileName: string;
  contentType?: string;
  buffer: Buffer;
  replace?: boolean;
}) => {
  const song = await ensureSongExists(input.songId);
  const filePath = getCoverFilePath(input.songId);
  const existed = await coverFileExists(input.songId);
  if (existed && !input.replace) {
    throw createError({ statusCode: 409, statusMessage: "封面已存在，请使用替换模式" });
  }

  await createAdminBackupSnapshot({
    category: "mutations",
    label: `cover-${input.songId}`,
    reason: existed ? `replace-cover-${input.songId}` : `create-cover-${input.songId}`,
    actorId: String(input.actor.id),
    actorName: input.actor.username,
    sources: [
      {
        path: filePath,
        optional: true
      }
    ]
  });

  const nextBuffer = await sharp(input.buffer)
    .resize(400, 400, {
      fit: "cover"
    })
    .png()
    .toBuffer();
  await writeFileAtomic(filePath, nextBuffer);
  const objectKey = await uploadCoverToOss(input.songId, filePath);
  await recordAdminAction({
    actorType: "admin",
    actorId: String(input.actor.id),
    actorName: input.actor.username,
    source: "admin-web",
    targetType: "song-cover",
    targetKey: String(input.songId),
    action: existed ? "update" : "create",
    extra: {
      songId: input.songId,
      songTitle: song.song_name,
      fileName: input.fileName,
      contentType: input.contentType || "",
      objectKey
    }
  });
  return {
    songId: input.songId,
    coverUrl: getCoverPublicUrl(input.songId),
    objectKey
  };
};

export const deleteAdminCover = async (actor: { id: number; username: string }, songIdInput: unknown) => {
  const songId = toSongId(songIdInput);
  const song = await ensureSongExists(songId);
  const filePath = getCoverFilePath(songId);
  const existed = await coverFileExists(songId);
  if (!existed) {
    throw createError({ statusCode: 404, statusMessage: "封面不存在" });
  }

  await createAdminBackupSnapshot({
    category: "mutations",
    label: `cover-${songId}`,
    reason: `delete-cover-${songId}`,
    actorId: String(actor.id),
    actorName: actor.username,
    sources: [
      {
        path: filePath
      }
    ]
  });
  await unlink(filePath);
  await deleteCoverFromOss(songId);
  await recordAdminAction({
    actorType: "admin",
    actorId: String(actor.id),
    actorName: actor.username,
    source: "admin-web",
    targetType: "song-cover",
    targetKey: String(songId),
    action: "delete",
    extra: {
      songId,
      songTitle: song.song_name
    }
  });
  return { ok: true };
};
