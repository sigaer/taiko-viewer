import { createError } from "h3";
import { hasLegacyScoreEvidence } from "@sakura-taiko/contract";
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
  rebuildUserdataAchievement,
  sanitizeBinding,
  toSongRow,
  withUserdataWriteLock,
  writeUserdataWithHistory
} from "../../internal/account/shared";
import { onScoreRollback } from "../../services/taiko-domain/publication.ts";

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

export const hasEffectiveScoreRecord = hasLegacyScoreEvidence;

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
  query: { keyword?: unknown; level?: unknown; page?: unknown; pageSize?: unknown; scoreOnly?: unknown }
) => {
  const binding = await getCurrentBindingRow(userId);
  if (!binding) {
    throw createError({ statusCode: 400, statusMessage: "请先绑定鼓众 ID" });
  }

  const userdata = await readUserdata(binding.taiko_id);
  const catalog = await getSongCatalog();
  const lockedKeys =
    binding.source === "manual" ? new Set<string>() : await getLockMap(userId, binding.taiko_id);
  const keyword = String(query.keyword || "").trim().toLowerCase();
  const levelFilter = Number(query.level || 0);
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(100, Math.max(10, Number(query.pageSize || 25)));
  const scoreOnly = query.scoreOnly === true || String(query.scoreOnly || "") === "1";

  const rows = (userdata.songs || [])
    .filter((song) => !scoreOnly || hasEffectiveScoreRecord(song))
    .map((song) => toSongRow(song, catalog.map.get(Number(song.song_no)), lockedKeys));
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

export const getAccountSongScores = async (userId: number, songNoInput: unknown) => {
  const songNo = Number(songNoInput || 0);
  if (!Number.isInteger(songNo) || songNo <= 0) {
    throw createError({ statusCode: 400, statusMessage: "歌曲 ID 无效" });
  }

  const binding = await getCurrentBindingRow(userId);
  if (!binding) {
    throw createError({ statusCode: 400, statusMessage: "请先绑定鼓众 ID" });
  }

  const userdata = await readUserdata(binding.taiko_id);
  const catalog = await getSongCatalog();
  const meta = catalog.map.get(songNo);
  const items = (userdata.songs || [])
    .filter((song) => Number(song.song_no) === songNo)
    .map((song) => toSongRow(song, meta, new Set<string>()))
    .sort((a, b) => a.level - b.level);

  return { items };
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

  return withUserdataWriteLock(binding.taiko_id, async () => {
    const liveBinding = await getCurrentBindingRow(userId);
    if (!liveBinding || liveBinding.id !== binding.id || liveBinding.taiko_id !== binding.taiko_id || liveBinding.source !== binding.source) throw createError({ statusCode: 409, statusMessage: "绑定已变更，请重新加载" });
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
    if (binding.source === "manual") rebuildUserdataAchievement(userdata);
    await writeUserdataWithHistory(
      binding.taiko_id,
      userdata,
      binding.source === "manual" ? "manual-score" : "web-account"
    );

    const catalog = await getSongCatalog();
    const lockedKeys = await getLockMap(userId, binding.taiko_id);
    return toSongRow(target, catalog.map.get(songNo), lockedKeys);
  });
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

  return withUserdataWriteLock(binding.taiko_id, async () => {
    const liveBinding = await getCurrentBindingRow(userId);
    if (!liveBinding || liveBinding.id !== binding.id || liveBinding.taiko_id !== binding.taiko_id || liveBinding.source !== binding.source) throw createError({ statusCode: 409, statusMessage: "绑定已变更，请重新加载" });
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

    if (binding.source !== "manual") {
      const previouslyLocked = (await getLockMap(userId, binding.taiko_id)).has(`${songNo}:${level}`);
      await ensureSongLocked(userId, binding.taiko_id, songNo, level);
      if (!previouslyLocked) onScoreRollback(binding.taiko_id, () => removeSongLock(userId, binding.taiko_id, songNo, level));
    }
    songs.push(newSong);
    if (binding.source === "manual") rebuildUserdataAchievement(userdata);
    await writeUserdataWithHistory(
      binding.taiko_id,
      userdata,
      binding.source === "manual" ? "manual-score" : "web-account"
    );

    const lockedKeys = await getLockMap(userId, binding.taiko_id);
    return toSongRow(newSong, meta, lockedKeys);
  });
};

/** Import the scoreInfo payload produced by userdata/songscore.json. */
export const importAccountSongs = async (userId: number, payload: unknown) => {
  const binding = await getCurrentBindingRow(userId);
  if (!binding) throw createError({ statusCode: 400, statusMessage: "请先绑定鼓众 ID" });

  const root = payload && typeof payload === "object" ? payload as Record<string, any> : {};
  const data = root.data && typeof root.data === "object" ? root.data : root;
  const rawItems = Array.isArray(data.scoreInfo) ? data.scoreInfo : Array.isArray(data.songs) ? data.songs : Array.isArray(payload) ? payload : [];
  if (!rawItems.length) throw createError({ statusCode: 400, statusMessage: "未找到 scoreInfo 成绩记录" });
  if (rawItems.length > 20000) throw createError({ statusCode: 413, statusMessage: "成绩记录过多，单次最多导入 20000 条" });

  const catalog = await getSongCatalog();
  const normalized = new Map<string, { songNo: number; level: number; values: EditableSongFields; title?: string; titleJp?: string }>();
  for (const item of rawItems) {
    if (!item || typeof item !== "object") continue;
    const songNo = Number((item as any).song_no ?? (item as any).songNo);
    const level = Number((item as any).level);
    if (!Number.isInteger(songNo) || songNo <= 0 || !Number.isInteger(level) || level < 1 || level > 5) continue;
    const values: EditableSongFields = {};
    for (const key of SONG_MUTABLE_KEYS) {
      if ((item as any)[key] !== undefined) (values as any)[key] = (item as any)[key];
    }
    const detail = (item as any).song_detail || {};
    normalized.set(`${songNo}:${level}`, {
      songNo,
      level,
      values,
      title: String((item as any).song_name || detail.song_name || "").trim() || undefined,
      titleJp: String((item as any).song_name_jp || detail.song_name_jp || "").trim() || undefined
    });
  }
  if (!normalized.size) throw createError({ statusCode: 400, statusMessage: "没有可导入的有效成绩记录" });

  return withUserdataWriteLock(binding.taiko_id, async () => {
    const liveBinding = await getCurrentBindingRow(userId);
    if (!liveBinding || liveBinding.id !== binding.id || liveBinding.taiko_id !== binding.taiko_id || liveBinding.source !== binding.source) throw createError({ statusCode: 409, statusMessage: "绑定已变更，请重新加载" });
    const previouslyLocked = binding.source === "manual" ? new Set<string>() : await getLockMap(userId, binding.taiko_id);
    const userdata = await readUserdata(binding.taiko_id);
    const songs = (userdata.songs ||= []);
    let created = 0;
    let updated = 0;
    for (const entry of normalized.values()) {
      const sanitized = sanitizeSongValues(entry.values);
      const existing = songs.find((row) => Number(row.song_no) === entry.songNo && Number(row.level) === entry.level);
      const stamp = formatLocalTimestamp();
      if (existing) {
        Object.assign(existing, sanitized, { update_datetime: stamp });
        if (sanitized.high_score !== undefined) existing.highscore_datetime = stamp;
        updated += 1;
      } else {
        const meta = catalog.map.get(entry.songNo);
        const song: UserdataSong = {
          song_no: entry.songNo,
          level: entry.level,
          option_flg: [1, 0, 0, "00"],
          highscore_mode: 0,
          update_datetime: stamp,
          highscore_datetime: stamp,
          ...sanitized
        };
        if (!meta && entry.title) song.song_name = entry.title;
        if (!meta && entry.titleJp) song.song_name_jp = entry.titleJp;
        songs.push(song);
        created += 1;
      }
    }
    if (binding.source === "manual") rebuildUserdataAchievement(userdata);
    await writeUserdataWithHistory(binding.taiko_id, userdata, "web-score-import");
    if (binding.source !== "manual") {
      await ensureAccountSchema();
      const db = getAccountDb();
      for (const entry of normalized.values()) {
        await db.execute(
          `INSERT INTO web_song_locks (user_id, taiko_id, song_no, level, is_locked) VALUES (?, ?, ?, ?, 1)
           ON DUPLICATE KEY UPDATE is_locked = 1, updated_at = CURRENT_TIMESTAMP`,
          [userId, binding.taiko_id, entry.songNo, entry.level]
        );
        if (!previouslyLocked.has(`${entry.songNo}:${entry.level}`)) {
          onScoreRollback(binding.taiko_id, () => removeSongLock(userId, binding.taiko_id, entry.songNo, entry.level));
        }
      }
    }
    return { ok: true, total: normalized.size, created, updated, taikoId: binding.taiko_id };
  });
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
  if (binding.source === "manual") {
    throw createError({ statusCode: 400, statusMessage: "手动账号不会被外部同步覆盖，无需设置谱面锁" });
  }
  const locked = Boolean(payload.locked);

  return withUserdataWriteLock(binding.taiko_id, async () => {
    const liveBinding = await getCurrentBindingRow(userId);
    if (!liveBinding || liveBinding.id !== binding.id || liveBinding.taiko_id !== binding.taiko_id || liveBinding.source !== binding.source) throw createError({ statusCode: 409, statusMessage: "绑定已变更，请重新加载" });
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
  });
};
