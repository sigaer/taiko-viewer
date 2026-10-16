import { createError } from "h3";
import { filterKinokoEvents, scoreEventEpoch, scoreTimeIssue, type TimeSummary } from "./kinoko-time";
import type { UserdataPayload, UserdataSong } from "./shared";

const KINOKO_SCORE_ENDPOINT = "https://kinoko.zorua.cn/api/v1/scores/hiroba";
const KINOKO_HISTORY_ENDPOINT = "https://kinoko.zorua.cn/api/v1/scores/kinoko";
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
const MAX_HISTORY_RECORDS = 100_000;
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
  timeSummary: TimeSummary;
};

export type KinokoHistoryFetchResult = {
  playerId: string;
  records: UserdataSong[];
  latestSongs: UserdataSong[];
  receivedBytes: number;
  timeSummary: TimeSummary;
};

const toNonNegativeInteger = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
};

export const sanitizeKinokoSong = (value: unknown): UserdataSong | null => {
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
    if (input[field] !== undefined && input[field] !== null) song[field] = (typeof input[field] === "string" ? input[field].trim() : input[field]) as never;
  }
  if (Array.isArray(input.option_flg)) song.option_flg = input.option_flg.slice(0, 8);
  if (Array.isArray(input.tone_flg)) song.tone_flg = input.tone_flg.slice(0, 8);
  return song;
};

export const getKinokoScoreFingerprint = (song: UserdataSong) =>
  JSON.stringify([
    song.song_no,
    song.level,
    ...SCORE_NUMBER_FIELDS.map((field) => toNonNegativeInteger(song[field])),
    String(song.highscore_datetime || ""),
    String(song.update_datetime || "")
  ]);

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
  if (status === 403) return createError({ statusCode: 403, statusMessage: "该密钥无权读取指定玩家" });
  if (status === 404) return createError({ statusCode: 404, statusMessage: "菌菌控制台中未找到可用账号或成绩" });
  return createError({ statusCode: 502, statusMessage: `菌菌控制台请求失败（HTTP ${status}）` });
};

const fetchKinokoPayload = async (apiKey: string, endpoint: string) => {
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
  return { payload, receivedBytes: Buffer.byteLength(text) };
};

export const fetchKinokoScores = async (apiKey: string, now = new Date()): Promise<KinokoFetchResult> => {
  const { payload, receivedBytes } = await fetchKinokoPayload(apiKey, KINOKO_SCORE_ENDPOINT);

  const playedRecords = payload?.data?.playedRecords;
  const returnedPlayerId = String(playedRecords?.userid || "").trim();
  if (!/^\d{1,20}$/.test(returnedPlayerId)) {
    throw createError({ statusCode: 502, statusMessage: "菌菌控制台未返回有效的默认玩家 ID" });
  }
  const rawSongs = Array.isArray(playedRecords?.scoreInfo) ? playedRecords.scoreInfo : null;
  if (!rawSongs) throw createError({ statusCode: 502, statusMessage: "菌菌控制台返回的成绩结构不正确" });
  const songs = rawSongs.map(sanitizeKinokoSong).filter(Boolean) as UserdataSong[];
  if (songs.length !== rawSongs.length) {
    throw createError({ statusCode: 502, statusMessage: "菌菌控制台返回了无效的成绩记录" });
  }
  const admitted = filterKinokoEvents(songs, now);
  return { playerId: returnedPlayerId, songs: admitted.records, receivedBytes, timeSummary: admitted.timeSummary };
};

export const fetchKinokoHistory = async (apiKey: string, now = new Date()): Promise<KinokoHistoryFetchResult> => {
  const { payload, receivedBytes } = await fetchKinokoPayload(apiKey, KINOKO_HISTORY_ENDPOINT);
  const playedRecords = payload?.data?.playedRecords;
  const returnedPlayerId = String(playedRecords?.player_id || "").trim();
  if (!/^\d{1,20}$/.test(returnedPlayerId)) {
    throw createError({ statusCode: 502, statusMessage: "菌菌控制台未返回有效的默认玩家 ID" });
  }
  const rawGroups = Array.isArray(playedRecords?.scoreInfo) ? playedRecords.scoreInfo : null;
  if (!rawGroups) throw createError({ statusCode: 502, statusMessage: "菌菌控制台返回的历史成绩结构不正确" });

  const records: UserdataSong[] = [];
  const latestSongs: UserdataSong[] = [];
  for (const rawGroup of rawGroups) {
    if (!rawGroup || typeof rawGroup !== "object") {
      throw createError({ statusCode: 502, statusMessage: "菌菌控制台返回了无效的历史分组" });
    }
    const group = rawGroup as Record<string, unknown>;
    const songNo = toNonNegativeInteger(group.song_no);
    const level = toNonNegativeInteger(group.level);
    const rawRecords = Array.isArray(group.scoreInfo) ? group.scoreInfo : null;
    if (songNo <= 0 || level < 1 || level > 5 || !rawRecords?.length) {
      throw createError({ statusCode: 502, statusMessage: "菌菌控制台返回了无效的历史分组" });
    }
    const songs = rawRecords.map(sanitizeKinokoSong).filter(Boolean) as UserdataSong[];
    if (
      songs.length !== rawRecords.length ||
      songs.some((song) => song.song_no !== songNo || song.level !== level)
    ) {
      throw createError({ statusCode: 502, statusMessage: "菌菌控制台返回了无效的历史成绩记录" });
    }
    records.push(...songs);
    if (records.length > MAX_HISTORY_RECORDS) {
      throw createError({ statusCode: 502, statusMessage: "菌菌控制台返回的历史记录过多，已停止迁移" });
    }
  }
  const filtered = filterKinokoEvents(records, now);
  const admitted = filtered.records;
  const latest = new Map<string, UserdataSong>();
  for (const song of admitted) {
    const key = `${song.song_no}:${song.level}`, previous = latest.get(key);
    if (!previous || scoreEventEpoch(song) >= scoreEventEpoch(previous)) latest.set(key, song);
  }
  latestSongs.push(...latest.values());
  return { playerId: returnedPlayerId, records: admitted, latestSongs, receivedBytes, timeSummary: filtered.timeSummary };
};

const maxField = (local: UserdataSong, remote: UserdataSong, field: (typeof CUMULATIVE_FIELDS)[number]) => {
  local[field] = Math.max(toNonNegativeInteger(local[field]), toNonNegativeInteger(remote[field]));
};

/** Keep pre-existing polluted current out of every new full history snapshot.
 * Reconcile through the existing Writer by refusing this import before staging;
 * repair of historical data is a separate operation, never an import side effect.
 */
export const assertKinokoCurrentTime = (userdata: UserdataPayload, now: Date) => {
  if ((userdata.songs || []).some(song => scoreTimeIssue(song, now, false))) {
    throw createError({ statusCode: 409, statusMessage: "现有成绩时间异常，导入已停止，请联系管理员处理", data: { code: "KINOKO_CURRENT_TIME_CONFLICT", published: false } });
  }
};

export const mergeKinokoScores = (userdata: UserdataPayload, remoteSongs: UserdataSong[], now = new Date()) => {
  assertKinokoCurrentTime(userdata, now);
  remoteSongs = filterKinokoEvents(remoteSongs, now).records;
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
    const localEpoch = local.update_datetime || local.highscore_datetime ? scoreEventEpoch(local) : -Infinity;
    const remoteScore = toNonNegativeInteger(remote.high_score);
    const localScore = toNonNegativeInteger(local.high_score);
    if (remoteScore > localScore || (remoteScore === localScore && scoreEventEpoch(remote) > localEpoch)) {
      for (const field of PERFORMANCE_FIELDS) {
        if (remote[field] !== undefined) local[field] = remote[field] as never;
      }
    }
    for (const field of CUMULATIVE_FIELDS) maxField(local, remote, field);
    const remoteUpdatedAt = String(remote.update_datetime || "");
    if (remoteUpdatedAt && scoreEventEpoch(remote) > localEpoch) local.update_datetime = remoteUpdatedAt;
    if (JSON.stringify(local) === before) unchanged += 1;
    else updated += 1;
  }
  userdata.songs = songs;
  return { added, updated, unchanged, total: remoteSongs.length };
};
