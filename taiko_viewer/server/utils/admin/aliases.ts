import { createError } from "h3";
import { createAdminBackupSnapshot } from "./backup";
import { recordAdminAction } from "./audit";
import { getAdminManagedPaths, readJsonFile, readOptionalJsonFile, writeFileAtomic } from "./shared";
import { exportAdminSongs } from "./songs";

type SongAliasEntry = {
  id: number;
  aliases: string[];
  song_name_jp?: string;
};

type LegacyAliasLogEntry = {
  time: string;
  action: string;
  user_id: string;
  user_nickname?: string;
  group_id?: number;
  group_name?: string;
  song_id: string;
  song_title: string;
  alias: string;
};

const normalizeText = (value: unknown) => String(value || "").trim();

const toSongId = (value: unknown) => {
  const parsed = Number(value || 0);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createError({ statusCode: 400, statusMessage: "歌曲 ID 无效" });
  }
  return parsed;
};

const readAliasEntries = async () => {
  const { songAliasPath } = getAdminManagedPaths();
  return readOptionalJsonFile<SongAliasEntry[]>(songAliasPath, []);
};

const writeAliasEntries = async (
  nextEntries: SongAliasEntry[],
  actor: { id: number; username: string },
  reason: string
) => {
  const { songAliasPath } = getAdminManagedPaths();
  await createAdminBackupSnapshot({
    category: "mutations",
    label: "song-alias",
    reason,
    actorId: String(actor.id),
    actorName: actor.username,
    sources: [
      {
        path: songAliasPath
      }
    ]
  });
  const sorted = [...nextEntries].sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
  await writeFileAtomic(songAliasPath, `${JSON.stringify(sorted, null, 2)}\n`);
};

export const listAdminAliases = async (query: { keyword?: unknown; page?: unknown; pageSize?: unknown }) => {
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(100, Math.max(10, Number(query.pageSize || 20)));
  const keyword = normalizeText(query.keyword).toLowerCase();
  const [songs, entries] = await Promise.all([exportAdminSongs(), readAliasEntries()]);
  const songMap = new Map(songs.map((item) => [Number(item.id), item]));
  const rows = entries
    .map((entry) => ({
      ...entry,
      song: songMap.get(Number(entry.id)) || null,
      aliasCount: Array.isArray(entry.aliases) ? entry.aliases.length : 0
    }))
    .filter((entry) => {
      if (!keyword) return true;
      return [
        String(entry.id),
        entry.song?.song_name,
        entry.song?.song_name_jp,
        ...(entry.aliases || [])
      ]
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

export const listLegacyAliasLogs = async (query: { page?: unknown; pageSize?: unknown }) => {
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(100, Math.max(10, Number(query.pageSize || 20)));
  const { aliasLogPath } = getAdminManagedPaths();
  const logs = await readOptionalJsonFile<LegacyAliasLogEntry[]>(aliasLogPath, []);
  const sorted = [...logs].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  const start = (page - 1) * pageSize;
  return {
    total: sorted.length,
    page,
    pageSize,
    items: sorted.slice(start, start + pageSize)
  };
};

export const createAdminAlias = async (
  actor: { id: number; username: string },
  payload: Record<string, unknown>
) => {
  const songId = toSongId(payload.songId);
  const alias = normalizeText(payload.alias);
  if (!alias) {
    throw createError({ statusCode: 400, statusMessage: "请输入别名" });
  }

  const [songs, entries] = await Promise.all([exportAdminSongs(), readAliasEntries()]);
  const song = songs.find((item) => Number(item.id) === songId);
  if (!song) {
    throw createError({ statusCode: 404, statusMessage: "歌曲不存在，无法新增别名" });
  }

  const nextEntries = [...entries];
  let target = nextEntries.find((item) => Number(item.id) === songId);
  if (!target) {
    target = {
      id: songId,
      aliases: [],
      song_name_jp: song.song_name_jp
    };
    nextEntries.push(target);
  }
  const existingSet = new Set((target.aliases || []).map((item) => item.toLowerCase()));
  if (existingSet.has(alias.toLowerCase())) {
    throw createError({ statusCode: 409, statusMessage: "该别名已存在" });
  }
  const before = {
    ...target,
    aliases: [...(target.aliases || [])]
  };
  target.aliases = [...(target.aliases || []), alias];
  await writeAliasEntries(nextEntries, actor, `create-alias-${songId}`);
  await recordAdminAction({
    actorType: "admin",
    actorId: String(actor.id),
    actorName: actor.username,
    source: "admin-web",
    targetType: "song-alias",
    targetKey: `${songId}:${alias}`,
    action: "create",
    before,
    after: target
  });
  return target;
};

export const updateAdminAlias = async (
  actor: { id: number; username: string },
  payload: Record<string, unknown>
) => {
  const songId = toSongId(payload.songId);
  const oldAlias = normalizeText(payload.oldAlias);
  const newAlias = normalizeText(payload.newAlias);
  if (!oldAlias || !newAlias) {
    throw createError({ statusCode: 400, statusMessage: "旧别名和新别名不能为空" });
  }
  const entries = await readAliasEntries();
  const target = entries.find((item) => Number(item.id) === songId);
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: "未找到该歌曲的别名记录" });
  }
  const aliasIndex = (target.aliases || []).findIndex((item) => item.toLowerCase() === oldAlias.toLowerCase());
  if (aliasIndex < 0) {
    throw createError({ statusCode: 404, statusMessage: "未找到要修改的别名" });
  }
  if ((target.aliases || []).some((item, index) => index !== aliasIndex && item.toLowerCase() === newAlias.toLowerCase())) {
    throw createError({ statusCode: 409, statusMessage: "目标别名已存在" });
  }
  const before = {
    ...target,
    aliases: [...(target.aliases || [])]
  };
  target.aliases[aliasIndex] = newAlias;
  await writeAliasEntries(entries, actor, `update-alias-${songId}`);
  await recordAdminAction({
    actorType: "admin",
    actorId: String(actor.id),
    actorName: actor.username,
    source: "admin-web",
    targetType: "song-alias",
    targetKey: `${songId}:${oldAlias}`,
    action: "update",
    before,
    after: target
  });
  return target;
};

export const deleteAdminAlias = async (
  actor: { id: number; username: string },
  payload: { songId?: unknown; alias?: unknown }
) => {
  const songId = toSongId(payload.songId);
  const alias = normalizeText(payload.alias);
  if (!alias) {
    throw createError({ statusCode: 400, statusMessage: "请选择要删除的别名" });
  }
  const entries = await readAliasEntries();
  const target = entries.find((item) => Number(item.id) === songId);
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: "未找到该歌曲的别名记录" });
  }
  const nextAliases = (target.aliases || []).filter((item) => item.toLowerCase() !== alias.toLowerCase());
  if (nextAliases.length === (target.aliases || []).length) {
    throw createError({ statusCode: 404, statusMessage: "未找到要删除的别名" });
  }
  const before = {
    ...target,
    aliases: [...(target.aliases || [])]
  };
  target.aliases = nextAliases;
  const nextEntries = entries.filter((item) => Number(item.id) !== songId || target.aliases.length > 0);
  if (target.aliases.length > 0 && !nextEntries.includes(target)) {
    nextEntries.push(target);
  }
  await writeAliasEntries(nextEntries, actor, `delete-alias-${songId}`);
  await recordAdminAction({
    actorType: "admin",
    actorId: String(actor.id),
    actorName: actor.username,
    source: "admin-web",
    targetType: "song-alias",
    targetKey: `${songId}:${alias}`,
    action: "delete",
    before,
    after: target.aliases.length > 0 ? target : null
  });
  return { ok: true };
};
