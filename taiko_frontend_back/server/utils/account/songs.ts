import { createError } from "h3";
import { DbRow, ensureAccountSchema, getAccountDb } from "~/server/utils/account-db";
import {
  type EditableSongFields,
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

  const songNo = Number(payload.songNo || 0);
  const level = Number(payload.level || 0);
  if (!Number.isInteger(songNo) || songNo <= 0 || !Number.isInteger(level) || level <= 0) {
    throw createError({ statusCode: 400, statusMessage: "谱面标识无效" });
  }

  const allowedKeys = [
    "high_score",
    "best_score_rank",
    "good_cnt",
    "ok_cnt",
    "ng_cnt",
    "stage_cnt",
    "clear_cnt",
    "full_combo_cnt",
    "dondaful_combo_cnt",
    "combo_cnt"
  ] as const;

  const sanitized: Partial<UserdataSong> = {};
  for (const key of allowedKeys) {
    const raw = (payload.values as Record<string, unknown>)[key];
    if (raw === undefined || raw === null || raw === "") continue;
    sanitized[key] = parsePositiveInt(raw);
  }

  const userdata = await readUserdata(binding.taiko_id);
  const songs = userdata.songs || [];
  const target = songs.find((item) => Number(item.song_no) === songNo && Number(item.level) === level);
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: "未找到该谱面记录" });
  }

  const merged: UserdataSong = { ...target, ...sanitized };
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

export const setAccountSongLock = async (
  userId: number,
  payload: { songNo: unknown; level: unknown; locked: unknown }
) => {
  await ensureAccountSchema();
  const binding = await getCurrentBindingRow(userId);
  if (!binding) {
    throw createError({ statusCode: 400, statusMessage: "请先绑定鼓众 ID" });
  }
  const songNo = Number(payload.songNo || 0);
  const level = Number(payload.level || 0);
  const locked = Boolean(payload.locked);
  if (!Number.isInteger(songNo) || songNo <= 0 || !Number.isInteger(level) || level <= 0) {
    throw createError({ statusCode: 400, statusMessage: "谱面标识无效" });
  }

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
