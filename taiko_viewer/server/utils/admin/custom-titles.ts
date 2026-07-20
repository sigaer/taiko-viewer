import { createError } from "h3";
import type { PoolConnection, ResultSetHeader } from "mysql2/promise";
import { ensureAccountSchema, getAccountDb } from "~/server/utils/account-db";
import {
  CUSTOM_TITLE_MAX_LENGTH,
  getOfficialTitleKeys,
  normalizeCustomTitleKey,
  normalizeCustomTitleName,
  readAllCustomTitleRows,
  type CustomTitleRow
} from "~/server/utils/custom-titles";
import { safeJsonStringify } from "./shared";
import { exportAdminSongs } from "./songs";

const LEVEL_LABELS: Record<number, string> = { 1: "梅", 2: "竹", 3: "松", 4: "表", 5: "里" };
const ACHIEVEMENT_LABELS = {
  clear: "过关",
  full_combo: "全连",
  all_perfect: "全良"
} as const;
const ACHIEVEMENT_STYLES = {
  clear: "silver",
  full_combo: "gold",
  all_perfect: "rainbow"
} as const;
type AchievementType = keyof typeof ACHIEVEMENT_LABELS;

const normalizeLevel = (value: unknown) => {
  const level = Number(value);
  if (!Number.isInteger(level) || level < 1 || level > 5) {
    throw createError({ statusCode: 400, statusMessage: "难度必须是 level 1–5" });
  }
  return level;
};

const normalizeSongId = (value: unknown) => {
  const songId = Number(value);
  if (!Number.isInteger(songId) || songId <= 0) {
    throw createError({ statusCode: 400, statusMessage: "歌曲 ID 无效" });
  }
  return songId;
};

const normalizeAchievement = (value: unknown): AchievementType => {
  const achievement = String(value || "full_combo").trim() as AchievementType;
  if (!Object.hasOwn(ACHIEVEMENT_LABELS, achievement)) {
    throw createError({ statusCode: 400, statusMessage: "成就必须是过关、全连或全良" });
  }
  return achievement;
};

const validateTitleName = async (value: unknown, currentId?: number) => {
  const titleName = normalizeCustomTitleName(value);
  const titleKey = normalizeCustomTitleKey(titleName);
  if (!titleName) {
    throw createError({ statusCode: 400, statusMessage: "请输入称号名" });
  }
  if (/\p{C}/u.test(titleName)) {
    throw createError({ statusCode: 400, statusMessage: "称号名不能包含控制字符" });
  }
  if ([...titleName].length > CUSTOM_TITLE_MAX_LENGTH) {
    throw createError({ statusCode: 400, statusMessage: `称号名最多 ${CUSTOM_TITLE_MAX_LENGTH} 个字符` });
  }
  if ((await getOfficialTitleKeys()).has(titleKey)) {
    throw createError({ statusCode: 409, statusMessage: "该名称已存在于既有称号中" });
  }
  const rows = await readAllCustomTitleRows();
  if (rows.some((row) => row.title_key === titleKey && Number(row.id) !== Number(currentId || 0))) {
    throw createError({ statusCode: 409, statusMessage: "该自定义称号已存在" });
  }
  return { titleName, titleKey };
};

const resolveSong = async (songId: number, level: number) => {
  const songs = await exportAdminSongs();
  const song = songs.find((item) => Number(item.id) === songId);
  if (!song) {
    throw createError({ statusCode: 404, statusMessage: "歌曲不存在" });
  }
  const chartValue = (song as Record<string, unknown>)[`level_${level}`];
  if (chartValue === undefined || chartValue === null || String(chartValue).trim() === "" || String(chartValue).trim() === "-") {
    throw createError({ statusCode: 400, statusMessage: `该歌曲没有${LEVEL_LABELS[level]}谱` });
  }
  return song;
};

const publicRecord = (row: CustomTitleRow, song: Record<string, any> | null, officialConflict = false) => ({
  id: Number(row.id),
  titleName: row.title_name,
  songId: Number(row.song_id),
  difficultyLevel: Number(row.difficulty_level),
  difficultyLabel: LEVEL_LABELS[Number(row.difficulty_level)] || String(row.difficulty_level),
  achievementType: normalizeAchievement(row.achievement_type),
  achievementLabel: ACHIEVEMENT_LABELS[normalizeAchievement(row.achievement_type)],
  plateStyle: ACHIEVEMENT_STYLES[normalizeAchievement(row.achievement_type)],
  creatorType: row.creator_type,
  creatorId: row.creator_id,
  creatorName: row.creator_name,
  source: row.source,
  groupId: row.group_id || "",
  groupName: row.group_name || "",
  createdAt: String(row.created_at || ""),
  updatedAt: String(row.updated_at || ""),
  officialConflict,
  song: song
    ? {
        id: Number(song.id),
        songName: String(song.song_name || ""),
        songNameJp: String(song.song_name_jp || ""),
        chartLevel: String(song[`level_${Number(row.difficulty_level)}`] || "")
      }
    : null
});

const fetchRow = async (connection: PoolConnection, id: number) => {
  const [rows] = await connection.execute<CustomTitleRow[]>(
    `SELECT id, title_name, title_key, song_id, difficulty_level, achievement_type,
            creator_type, creator_id, creator_name, source, group_id, group_name,
            created_at, updated_at
       FROM taiko_custom_titles WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
};

const writeAudit = async (
  connection: PoolConnection,
  actor: { id: number; username: string },
  action: "create" | "update" | "delete",
  id: number,
  before: unknown,
  after: unknown
) => {
  await connection.execute(
    `INSERT INTO web_admin_action_logs
      (actor_type, actor_id, actor_name, source, target_type, target_key, action, before_json, after_json, extra_json)
     VALUES ('admin', ?, ?, 'admin-web', 'custom-title', ?, ?, ?, ?, NULL)`,
    [
      String(actor.id),
      actor.username,
      String(id),
      action,
      before === undefined ? null : safeJsonStringify(before),
      after === undefined ? null : safeJsonStringify(after)
    ]
  );
};

const translateDbError = (error: any): never => {
  if (String(error?.code || "") === "ER_DUP_ENTRY" || Number(error?.errno || 0) === 1062) {
    throw createError({ statusCode: 409, statusMessage: "该自定义称号已存在" });
  }
  throw error;
};

export const listAdminCustomTitles = async (query: {
  keyword?: unknown;
  level?: unknown;
  achievement?: unknown;
  page?: unknown;
  pageSize?: unknown;
}) => {
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(100, Math.max(10, Number(query.pageSize || 20)));
  const keyword = String(query.keyword || "").trim().toLocaleLowerCase();
  const level = query.level === undefined || query.level === null || query.level === "" ? null : normalizeLevel(query.level);
  const achievement = query.achievement === undefined || query.achievement === null || query.achievement === ""
    ? null
    : normalizeAchievement(query.achievement);
  const [rows, songs, officialKeys] = await Promise.all([
    readAllCustomTitleRows(),
    exportAdminSongs(),
    getOfficialTitleKeys()
  ]);
  const songMap = new Map(songs.map((song) => [Number(song.id), song]));
  const items = rows
    .map((row) => publicRecord(row, songMap.get(Number(row.song_id)) || null, officialKeys.has(row.title_key)))
    .filter((item) => {
      if (level !== null && item.difficultyLevel !== level) return false;
      if (achievement !== null && item.achievementType !== achievement) return false;
      if (!keyword) return true;
      return [
        item.titleName,
        String(item.songId),
        item.song?.songName,
        item.song?.songNameJp,
        item.creatorName,
        item.creatorId,
        item.groupName
      ]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(keyword));
    })
    .sort((a, b) => b.id - a.id);
  const start = (page - 1) * pageSize;
  return { total: items.length, page, pageSize, items: items.slice(start, start + pageSize) };
};

export const createAdminCustomTitle = async (
  actor: { id: number; username: string },
  payload: Record<string, unknown>
) => {
  const songId = normalizeSongId(payload.songId);
  const level = normalizeLevel(payload.level);
  const achievement = normalizeAchievement(payload.achievement);
  const [{ titleName, titleKey }, song] = await Promise.all([
    validateTitleName(payload.titleName),
    resolveSong(songId, level)
  ]);
  await ensureAccountSchema();
  const connection = await getAccountDb().getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO taiko_custom_titles
        (title_name, title_key, song_id, difficulty_level, achievement_type,
         creator_type, creator_id, creator_name, source)
       VALUES (?, ?, ?, ?, ?, 'admin', ?, ?, 'admin-web')`,
      [titleName, titleKey, songId, level, achievement, String(actor.id), actor.username]
    );
    const row = await fetchRow(connection, Number(result.insertId));
    if (!row) throw new Error("created custom title not found");
    const after = publicRecord(row, song);
    await writeAudit(connection, actor, "create", row.id, undefined, after);
    await connection.commit();
    return after;
  } catch (error) {
    await connection.rollback();
    translateDbError(error);
  } finally {
    connection.release();
  }
};

export const updateAdminCustomTitle = async (
  actor: { id: number; username: string },
  payload: Record<string, unknown>
) => {
  const id = Number(payload.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: "称号 ID 无效" });
  }
  const songId = normalizeSongId(payload.songId);
  const level = normalizeLevel(payload.level);
  const achievement = normalizeAchievement(payload.achievement);
  const [{ titleName, titleKey }, song, songs] = await Promise.all([
    validateTitleName(payload.titleName, id),
    resolveSong(songId, level),
    exportAdminSongs()
  ]);
  const songMap = new Map(songs.map((item) => [Number(item.id), item]));
  await ensureAccountSchema();
  const connection = await getAccountDb().getConnection();
  try {
    await connection.beginTransaction();
    const current = await fetchRow(connection, id);
    if (!current) throw createError({ statusCode: 404, statusMessage: "未找到该自定义称号" });
    const before = publicRecord(current, songMap.get(Number(current.song_id)) || null);
    await connection.execute(
      `UPDATE taiko_custom_titles
          SET title_name = ?, title_key = ?, song_id = ?, difficulty_level = ?,
              achievement_type = ?
        WHERE id = ?`,
      [titleName, titleKey, songId, level, achievement, id]
    );
    if (current.title_name !== titleName) {
      await connection.execute(
        `UPDATE web_taiko_binding_mydon_showcase_titles
            SET title_name = ?
          WHERE title_name = ?`,
        [titleName, current.title_name]
      );
    }
    const updated = await fetchRow(connection, id);
    if (!updated) throw new Error("updated custom title not found");
    const after = publicRecord(updated, song);
    await writeAudit(connection, actor, "update", id, before, after);
    await connection.commit();
    return after;
  } catch (error) {
    await connection.rollback();
    translateDbError(error);
  } finally {
    connection.release();
  }
};

export const deleteAdminCustomTitle = async (
  actor: { id: number; username: string },
  payload: Record<string, unknown>
) => {
  const id = Number(payload.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: "称号 ID 无效" });
  }
  const songs = await exportAdminSongs();
  const songMap = new Map(songs.map((item) => [Number(item.id), item]));
  await ensureAccountSchema();
  const connection = await getAccountDb().getConnection();
  try {
    await connection.beginTransaction();
    const current = await fetchRow(connection, id);
    if (!current) throw createError({ statusCode: 404, statusMessage: "未找到该自定义称号" });
    const before = publicRecord(current, songMap.get(Number(current.song_id)) || null);
    await connection.execute(
      "DELETE FROM web_taiko_binding_mydon_showcase_titles WHERE title_name = ?",
      [current.title_name]
    );
    await connection.execute("DELETE FROM taiko_custom_titles WHERE id = ?", [id]);
    await writeAudit(connection, actor, "delete", id, before, undefined);
    await connection.commit();
    return { ok: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
