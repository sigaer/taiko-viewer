import { createError } from "h3";
import { ensureAccountSchema, getAccountDb } from "~/server/utils/account-db";
import type { DbRow } from "~/server/utils/account-db";
import {
  type EditableSongFields,
  type SongMeta,
  type UserdataSong,
  formatLocalTimestamp,
  getChartComboMap,
  getCurrentBindingRow,
  getLockMap,
  getSongCatalog,
  parsePositiveInt,
  readUserdata,
  sanitizeBinding,
  toSongRow,
  writeUserdataWithHistory
} from "../../internal/account/shared";

const SONG_MUTABLE_KEYS = [
  "high_score",
  "best_score_rank",
  "good_cnt",
  "ok_cnt",
  "ng_cnt",
  "pound_cnt",
  "stage_cnt",
  "clear_cnt",
  "full_combo_cnt",
  "dondaful_combo_cnt",
  "combo_cnt"
] as const;

const sanitizeSongValues = (values: EditableSongFields) => {
  const sanitized: Partial<UserdataSong> = {};
  for (const key of SONG_MUTABLE_KEYS) {
    const raw = (values as Record<string, unknown>)[key];
    if (raw === undefined || raw === null || raw === "") continue;
    sanitized[key] = parsePositiveInt(raw);
  }
  return sanitized;
};

const assertSongIdentity = (songNoInput: unknown, levelInput: unknown) => {
  const songNo = Number(songNoInput || 0);
  const level = Number(levelInput || 0);
  if (!Number.isInteger(songNo) || songNo <= 0 || !Number.isInteger(level) || level <= 0 || level > 5) {
    throw createError({ statusCode: 400, statusMessage: "谱面标识无效" });
  }
  return { songNo, level };
};

const assertCatalogChartExists = (meta: SongMeta | undefined, level: number) => {
  if (!meta) return;
  const levelValue = meta[`level_${level}` as keyof SongMeta];
  if (levelValue === undefined || levelValue === null || String(levelValue).trim() === "") {
    throw createError({ statusCode: 400, statusMessage: "该歌曲未收录所选难度" });
  }
};

const validateSongAccuracy = async (songNo: number, level: number, merged: UserdataSong) => {
  try {
    const chartComboMap = await getChartComboMap();
    const totalNotes = Number(chartComboMap.get(`${songNo}:${level}`) || 0);
    if (totalNotes > 0) {
      const goodCnt = parsePositiveInt(merged.good_cnt);
      const okCnt = parsePositiveInt(merged.ok_cnt);
      const dondafulComboCnt = parsePositiveInt(merged.dondaful_combo_cnt);
      const accuracy = dondafulComboCnt > 0 ? 1 : (goodCnt + okCnt * 0.5) / totalNotes;
      if (accuracy > 1) {
        throw createError({
          statusCode: 400,
          statusMessage: `良率不能超过100%（当前 ${(accuracy * 100).toFixed(2)}%，谱面物量 ${totalNotes}）`
        });
      }
    }
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error("[web-account] 校验谱面良率失败", { songNo, level, error });
  }
};

const ensureSongLocked = async (userId: number, taikoId: string, songNo: number, level: number) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  await db.execute(
    `INSERT INTO web_song_locks (user_id, taiko_id, song_no, level, is_locked)
     VALUES (?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE is_locked = 1, updated_at = CURRENT_TIMESTAMP`,
    [userId, taikoId, songNo, level]
  );
};

const removeSongLock = async (userId: number, taikoId: string, songNo: number, level: number) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  await db.execute(
    "DELETE FROM web_song_locks WHERE user_id = ? AND taiko_id = ? AND song_no = ? AND level = ?",
    [userId, taikoId, songNo, level]
  );
};

export const listAccountSongs = async (
  userId: number,
  query: { keyword?: unknown; level?: unknown; page?: unknown; pageSize?: unknown }
) => {
  const binding = await getCurrentBindingRow(userId);
  if (!binding) {
    throw createError({ statusCode: 400, statusMessage: "请先绑定鼓众 ID" });
  }

  const userdata = await readUserdata(binding.taiko_id);
  const catalog = await getSongCatalog();
  const lockedKeys = await getLockMap(userId, binding.taiko_id);
  const keyword = String(query.keyword || "").trim().toLowerCase();
  const levelFilter = Number(query.level || 0);
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(100, Math.max(10, Number(query.pageSize || 25)));

  const rows = (userdata.songs || []).map((song) => toSongRow(song, catalog.map.get(Number(song.song_no)), lockedKeys));
  const filtered = rows.filter((row) => {
    if (levelFilter > 0 && row.level !== levelFilter) return false;
    if (!keyword) return true;
    return (
      row.title.toLowerCase().includes(keyword) ||
      row.titleJp.toLowerCase().includes(keyword) ||
      String(row.songNo).includes(keyword)
    );
  });
  filtered.sort((a, b) => {
    const timeA = new Date(a.updateDatetime || 0).getTime();
    const timeB = new Date(b.updateDatetime || 0).getTime();
    if (timeA !== timeB) return timeB - timeA;
    return b.highScore - a.highScore;
  });

  const start = (page - 1) * pageSize;
  return {
    currentBinding: sanitizeBinding(binding),
    total: filtered.length,
    page,
    pageSize,
    items: filtered.slice(start, start + pageSize)
  };
};

export const updateAccountSong = async (
  userId: number,
  payload: { songNo: unknown; level: unknown; values: EditableSongFields }
) => {
  const binding = await getCurrentBindingRow(userId);
  if (!binding) {
    throw createError({ statusCode: 400, statusMessage: "请先绑定鼓众 ID" });
  }

  const { songNo, level } = assertSongIdentity(payload.songNo, payload.level);
  const sanitized = sanitizeSongValues(payload.values);

  const userdata = await readUserdata(binding.taiko_id);
  const songs = userdata.songs || [];
  const target = songs.find((item) => Number(item.song_no) === songNo && Number(item.level) === level);
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: "未找到该谱面记录" });
  }

  const merged: UserdataSong = { ...target, ...sanitized };
  await validateSongAccuracy(songNo, level, merged);

  Object.assign(target, sanitized);
  const stamp = formatLocalTimestamp();
  target.update_datetime = stamp;
  if (sanitized.high_score !== undefined) {
    target.highscore_datetime = stamp;
  }
  await writeUserdataWithHistory(binding.taiko_id, userdata, "web-account");

  const catalog = await getSongCatalog();
  const lockedKeys = await getLockMap(userId, binding.taiko_id);
  return toSongRow(target, catalog.map.get(songNo), lockedKeys);
};

export const createAccountSong = async (
  userId: number,
  payload: {
    songNo: unknown;
    level: unknown;
    values: EditableSongFields;
    title?: unknown;
    titleJp?: unknown;
  }
) => {
  const binding = await getCurrentBindingRow(userId);
  if (!binding) {
    throw createError({ statusCode: 400, statusMessage: "请先绑定鼓众 ID" });
  }

  const { songNo, level } = assertSongIdentity(payload.songNo, payload.level);
  const customTitle = String(payload.title || "").trim();
  const customTitleJp = String(payload.titleJp || "").trim();
  const sanitized = sanitizeSongValues(payload.values);

  const userdata = await readUserdata(binding.taiko_id);
  const songs = userdata.songs || [];
  const exists = songs.some((item) => Number(item.song_no) === songNo && Number(item.level) === level);
  if (exists) {
    throw createError({ statusCode: 409, statusMessage: "该谱面记录已存在，请直接编辑现有成绩" });
  }

  const catalog = await getSongCatalog();
  const meta = catalog.map.get(songNo);
  assertCatalogChartExists(meta, level);
  if (!meta && !customTitle) {
    throw createError({ statusCode: 400, statusMessage: "未收录曲目请至少填写一个曲名" });
  }

  const stamp = formatLocalTimestamp();
  const newSong: UserdataSong = {
    song_no: songNo,
    level,
    option_flg: [1, 0, 0, "00"],
    highscore_mode: 0,
    update_datetime: stamp,
    highscore_datetime: stamp,
    ...sanitized
  };
  if (!meta) {
    newSong.song_name = customTitle;
    if (customTitleJp) {
      newSong.song_name_jp = customTitleJp;
    }
  }

  await validateSongAccuracy(songNo, level, newSong);

  await ensureSongLocked(userId, binding.taiko_id, songNo, level);
  try {
    songs.push(newSong);
    await writeUserdataWithHistory(binding.taiko_id, userdata, "web-account");
  } catch (error) {
    await removeSongLock(userId, binding.taiko_id, songNo, level).catch((cleanupError) => {
      console.error("[web-account] 回滚新建谱面锁定失败", { songNo, level, cleanupError });
    });
    throw error;
  }

  const lockedKeys = await getLockMap(userId, binding.taiko_id);
  return toSongRow(newSong, meta, lockedKeys);
};

export const setAccountSongLock = async (
  userId: number,
  payload: { songNo: unknown; level: unknown; locked: unknown }
) => {
  await ensureAccountSchema();
  const binding = await getCurrentBindingRow(userId);
  if (!binding) {
    throw createError({ statusCode: 400, statusMessage: "请先绑定鼓众 ID" });
  }
  const { songNo, level } = assertSongIdentity(payload.songNo, payload.level);
  const locked = Boolean(payload.locked);

  const db = getAccountDb();
  if (locked) {
    await db.execute(
      `INSERT INTO web_song_locks (user_id, taiko_id, song_no, level, is_locked)
       VALUES (?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE is_locked = 1, updated_at = CURRENT_TIMESTAMP`,
      [userId, binding.taiko_id, songNo, level]
    );
  } else {
    await db.execute(
      "DELETE FROM web_song_locks WHERE user_id = ? AND taiko_id = ? AND song_no = ? AND level = ?",
      [userId, binding.taiko_id, songNo, level]
    );
  }
  return { locked };
};
