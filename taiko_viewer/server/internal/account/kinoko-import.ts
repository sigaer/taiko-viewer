import { createError } from "h3";
import type { UserdataPayload, UserdataSong } from "./shared";

const KINOKO_SCORE_ENDPOINT = "https://kinoko.zorua.cn/api/v1/scores/hiroba";
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
const SCORE_NUMBER_FIELDS = [
  "high_score",
  "best_score_rank",
  "good_cnt",
  "ok_cnt",
  "ng_cnt",
  "pound_cnt",
  "combo_cnt",
  "stage_cnt",
  "clear_cnt",
  "full_combo_cnt",
  "dondaful_combo_cnt",
  "highscore_mode"
] as const;
const PERFORMANCE_FIELDS = [
  "high_score",
  "good_cnt",
  "ok_cnt",
  "ng_cnt",
  "pound_cnt",
  "combo_cnt",
  "option_flg",
  "tone_flg",
  "highscore_datetime",
  "highscore_mode"
] as const;
const CUMULATIVE_FIELDS = [
  "best_score_rank",
  "stage_cnt",
  "clear_cnt",
  "full_combo_cnt",
  "dondaful_combo_cnt"
] as const;

type KinokoFetchResult = {
  playerId: string;
  songs: UserdataSong[];
  receivedBytes: number;
};

const toNonNegativeInteger = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
};

const sanitizeSong = (value: unknown): UserdataSong | null => {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const songNo = toNonNegativeInteger(input.song_no);
  const level = toNonNegativeInteger(input.level);
  if (songNo <= 0 || level < 1 || level > 5) return null;

  const song: UserdataSong = { song_no: songNo, level };
  for (const field of SCORE_NUMBER_FIELDS) {
    song[field] = toNonNegativeInteger(input[field]);
  }
  for (const field of ["highscore_datetime", "update_datetime"] as const) {
    const text = String(input[field] || "").trim();
    if (text) song[field] = text.slice(0, 64);
  }
  if (Array.isArray(input.option_flg)) song.option_flg = input.option_flg.slice(0, 8);
  if (Array.isArray(input.tone_flg)) song.tone_flg = input.tone_flg.slice(0, 8);
  return song;
};

const readLimitedResponse = async (response: Response) => {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw createError({ statusCode: 502, statusMessage: "菌菌控制台返回的数据过大，已停止导入" });
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
};

const mapKinokoError = (status: number, detail: string) => {
  if (status === 401) return createError({ statusCode: 400, statusMessage: "API 密钥无效或已失效" });
  if (status === 403) return createError({ statusCode: 403, statusMessage: detail || "该密钥无权读取指定玩家" });
  if (status === 404) return createError({ statusCode: 404, statusMessage: detail || "菌菌控制台中未找到可用账号或成绩" });
  return createError({ statusCode: 502, statusMessage: detail || `菌菌控制台请求失败（HTTP ${status}）` });
};

export const fetchKinokoScores = async (apiKey: string): Promise<KinokoFetchResult> => {
  const endpoint = new URL(KINOKO_SCORE_ENDPOINT);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      signal: AbortSignal.timeout(30_000)
    });
  } catch {
    throw createError({ statusCode: 502, statusMessage: "无法连接菌菌控制台，请稍后重试" });
  }

  const text = await readLimitedResponse(response);
  let payload: Record<string, any>;
  try {
    payload = JSON.parse(text) as Record<string, any>;
  } catch {
    throw createError({ statusCode: 502, statusMessage: "菌菌控制台返回了无法解析的数据" });
  }
  if (!response.ok) throw mapKinokoError(response.status, String(payload.detail || "").trim());

  const playedRecords = payload?.data?.playedRecords;
  const returnedPlayerId = String(playedRecords?.userid || "").trim();
  if (!/^\d{1,20}$/.test(returnedPlayerId)) {
    throw createError({ statusCode: 502, statusMessage: "菌菌控制台未返回有效的默认玩家 ID" });
  }
  const rawSongs = Array.isArray(playedRecords?.scoreInfo) ? playedRecords.scoreInfo : null;
  if (!rawSongs) throw createError({ statusCode: 502, statusMessage: "菌菌控制台返回的成绩结构不正确" });
  const songs = rawSongs.map(sanitizeSong).filter(Boolean) as UserdataSong[];
  if (songs.length !== rawSongs.length) {
    throw createError({ statusCode: 502, statusMessage: "菌菌控制台返回了无效的成绩记录" });
  }
  return { playerId: returnedPlayerId, songs, receivedBytes: Buffer.byteLength(text) };
};

const maxField = (local: UserdataSong, remote: UserdataSong, field: (typeof CUMULATIVE_FIELDS)[number]) => {
  local[field] = Math.max(toNonNegativeInteger(local[field]), toNonNegativeInteger(remote[field]));
};

export const mergeKinokoScores = (userdata: UserdataPayload, remoteSongs: UserdataSong[]) => {
  const songs = Array.isArray(userdata.songs) ? userdata.songs : [];
  const songMap = new Map(songs.map((song) => [`${song.song_no}:${song.level}`, song]));
  let added = 0;
  let updated = 0;
  let unchanged = 0;

  for (const remote of remoteSongs) {
    const key = `${remote.song_no}:${remote.level}`;
    const local = songMap.get(key);
    if (!local) {
      const inserted = { ...remote };
      songs.push(inserted);
      songMap.set(key, inserted);
      added += 1;
      continue;
    }
    const before = JSON.stringify(local);
    const remoteScore = toNonNegativeInteger(remote.high_score);
    const localScore = toNonNegativeInteger(local.high_score);
    if (remoteScore > localScore || (remoteScore === localScore && String(remote.update_datetime || "") > String(local.update_datetime || ""))) {
      for (const field of PERFORMANCE_FIELDS) {
        if (remote[field] !== undefined) local[field] = remote[field] as never;
      }
    }
    for (const field of CUMULATIVE_FIELDS) maxField(local, remote, field);
    const remoteUpdatedAt = String(remote.update_datetime || "");
    if (remoteUpdatedAt > String(local.update_datetime || "")) local.update_datetime = remoteUpdatedAt;
    if (JSON.stringify(local) === before) unchanged += 1;
    else updated += 1;
  }
  userdata.songs = songs;
  return { added, updated, unchanged, total: remoteSongs.length };
};
