import { constants as fsConstants } from "node:fs";
import { access, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";
import { createError } from "h3";
import { createAdminBackupSnapshot } from "./backup";
import { recordAdminAction } from "./audit";
import { ensureDir, getAdminManagedPaths, getFileMtimeMs, readOptionalJsonFile, writeFileAtomic } from "./shared";
import { exportAdminSongs } from "./songs";

type DrawGuessRecord = {
  id: number;
  song_title: string;
  song_ids: number[];
  uploader_qq: string;
  uploader_nickname: string;
  uploader_group_id: string;
  uploader_group_name: string;
  image_file: string;
  active: boolean;
  guess_correct_count: number;
  guess_wrong_count: number;
  like_count: number;
  report_count: number;
  created_at: string;
};

type DrawGuessDb = {
  next_id: number;
  records: DrawGuessRecord[];
  user_guess_stats: Record<string, Record<string, unknown>>;
};

type DrawGuessListItem = {
  id: number;
  songTitle: string;
  songIds: number[];
  uploaderQq: string;
  uploaderNickname: string;
  uploaderGroupId: string;
  uploaderGroupName: string;
  imageUrl: string;
  imageExists: boolean;
  active: boolean;
  guessCorrectCount: number;
  guessWrongCount: number;
  likeCount: number;
  reportCount: number;
  createdAt: string;
};

const normalizeText = (value: unknown) => String(value || "").trim();

const toPositiveInteger = (value: unknown, label: string) => {
  const parsed = Number(value || 0);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createError({ statusCode: 400, statusMessage: `${label}无效` });
  }
  return parsed;
};

const toNonNegativeInteger = (value: unknown, label: string, fallback = 0) => {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  const parsed = Number(text);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw createError({ statusCode: 400, statusMessage: `${label}必须是非负整数` });
  }
  return parsed;
};

const toBoolean = (value: unknown, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return Boolean(value);
};

const defaultDrawGuessDb = (): DrawGuessDb => ({
  next_id: 1,
  records: [],
  user_guess_stats: {}
});

const normalizeSongIds = (value: unknown) => {
  const values = Array.isArray(value)
    ? value.map((item) => String(item ?? ""))
    : String(value || "")
        .split(/[\n,，\s/]+/)
        .map((item) => item.trim());
  const songIds = Array.from(
    new Set(
      values
        .filter(Boolean)
        .map((item) => {
          const parsed = Number(item);
          if (!Number.isInteger(parsed) || parsed <= 0) {
            throw createError({ statusCode: 400, statusMessage: "歌曲 ID 列表格式不正确" });
          }
          return parsed;
        })
    )
  ).sort((a, b) => a - b);
  if (!songIds.length) {
    throw createError({ statusCode: 400, statusMessage: "请至少提供一个歌曲 ID" });
  }
  return songIds;
};

const normalizeLoadedRecord = (value: unknown): DrawGuessRecord | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = Number(record.id || 0);
  if (!Number.isInteger(id) || id <= 0) return null;
  const songIds = Array.isArray(record.song_ids)
    ? record.song_ids
        .map((item) => Number(item || 0))
        .filter((item) => Number.isInteger(item) && item > 0)
    : [];
  return {
    id,
    song_title: normalizeText(record.song_title),
    song_ids: Array.from(new Set(songIds)).sort((a, b) => a - b),
    uploader_qq: normalizeText(record.uploader_qq),
    uploader_nickname: normalizeText(record.uploader_nickname),
    uploader_group_id: normalizeText(record.uploader_group_id),
    uploader_group_name: normalizeText(record.uploader_group_name),
    image_file: normalizeText(record.image_file) || `images/${id}.png`,
    active: Boolean(record.active ?? true),
    guess_correct_count: Math.max(0, Number(record.guess_correct_count || 0) || 0),
    guess_wrong_count: Math.max(0, Number(record.guess_wrong_count || 0) || 0),
    like_count: Math.max(0, Number(record.like_count || 0) || 0),
    report_count: Math.max(0, Number(record.report_count || 0) || 0),
    created_at: normalizeText(record.created_at) || new Date(0).toISOString().replace(/\.\d{3}Z$/, "Z")
  };
};

const readDrawGuessDb = async () => {
  const { drawGuessDbPath } = getAdminManagedPaths();
  const raw = await readOptionalJsonFile<DrawGuessDb>(drawGuessDbPath, defaultDrawGuessDb());
  const records = Array.isArray(raw.records) ? raw.records.map(normalizeLoadedRecord).filter(Boolean) : [];
  const maxId = records.reduce((max, item) => Math.max(max, item!.id), 0);
  return {
    next_id: Math.max(Number(raw.next_id || 1) || 1, maxId + 1),
    records: records as DrawGuessRecord[],
    user_guess_stats:
      raw.user_guess_stats && typeof raw.user_guess_stats === "object" ? raw.user_guess_stats : {}
  } satisfies DrawGuessDb;
};

const writeDrawGuessDb = async (data: DrawGuessDb) => {
  const { drawGuessDbPath } = getAdminManagedPaths();
  await writeFileAtomic(drawGuessDbPath, `${JSON.stringify(data, null, 2)}\n`);
};

const getDrawGuessImagePath = (record: DrawGuessRecord) => {
  const { drawGuessDataDir } = getAdminManagedPaths();
  return resolve(drawGuessDataDir, record.image_file || `images/${record.id}.png`);
};

const buildDrawGuessImageUrl = async (record: DrawGuessRecord) => {
  const imagePath = getDrawGuessImagePath(record);
  const imageExists = await access(imagePath, fsConstants.R_OK)
    .then(() => true)
    .catch(() => false);
  if (!imageExists) {
    return { imageUrl: "", imageExists: false };
  }
  const version = await getFileMtimeMs(imagePath);
  return {
    imageUrl: `/api/admin/draw-guess/${record.id}/image?v=${Math.max(1, Math.floor(version))}`,
    imageExists: true
  };
};

const resolveSongTitle = async (songIds: number[], titleInput: unknown) => {
  const inputTitle = normalizeText(titleInput);
  const songs = await exportAdminSongs();
  const songMap = new Map(songs.map((item) => [Number(item.id), item]));
  const matchedSongs = songIds.map((songId) => songMap.get(songId)).filter(Boolean);
  if (matchedSongs.length !== songIds.length) {
    const missingIds = songIds.filter((songId) => !songMap.has(songId));
    throw createError({
      statusCode: 404,
      statusMessage: `以下歌曲 ID 不存在：${missingIds.join(", ")}`
    });
  }
  if (inputTitle) return inputTitle;
  const uniqueTitles = Array.from(
    new Set(matchedSongs.map((item) => normalizeText(item?.song_name)).filter(Boolean))
  );
  if (uniqueTitles.length === 1) {
    return uniqueTitles[0];
  }
  throw createError({
    statusCode: 400,
    statusMessage: "多个歌曲 ID 对应多个曲名，请手动填写歌名"
  });
};

const createNormalizedImageBuffer = async (buffer: Buffer) => {
  try {
    return await sharp(buffer).png().toBuffer();
  } catch {
    throw createError({ statusCode: 400, statusMessage: "图片文件无法解析，请重新上传" });
  }
};

const findRecordIndex = (records: DrawGuessRecord[], recordId: number) =>
  records.findIndex((item) => item.id === recordId);

const buildRecordMutation = async (payload: Record<string, unknown>) => {
  const songIds = normalizeSongIds(payload.songIds);
  const songTitle = await resolveSongTitle(songIds, payload.songTitle);
  return {
    song_title: songTitle,
    song_ids: songIds,
    uploader_qq: normalizeText(payload.uploaderQq),
    uploader_nickname: normalizeText(payload.uploaderNickname),
    uploader_group_id: normalizeText(payload.uploaderGroupId),
    uploader_group_name: normalizeText(payload.uploaderGroupName),
    active: toBoolean(payload.active, true),
    guess_correct_count: toNonNegativeInteger(payload.guessCorrectCount, "猜对次数", 0),
    guess_wrong_count: toNonNegativeInteger(payload.guessWrongCount, "猜错次数", 0),
    like_count: toNonNegativeInteger(payload.likeCount, "点赞次数", 0),
    report_count: toNonNegativeInteger(payload.reportCount, "举报次数", 0)
  };
};

export const listAdminDrawGuess = async (query: {
  keyword?: unknown;
  active?: unknown;
  reported?: unknown;
  page?: unknown;
  pageSize?: unknown;
}) => {
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(100, Math.max(10, Number(query.pageSize || 20)));
  const keyword = normalizeText(query.keyword).toLowerCase();
  const activeFilter =
    query.active === undefined || query.active === null || query.active === "" ? null : String(query.active) === "1";
  const reportedFilter =
    query.reported === undefined || query.reported === null || query.reported === ""
      ? null
      : String(query.reported) === "1";
  const data = await readDrawGuessDb();
  const summary = {
    totalRecords: data.records.length,
    activeRecords: data.records.filter((item) => item.active).length,
    inactiveRecords: data.records.filter((item) => !item.active).length,
    reportedRecords: data.records.filter((item) => item.report_count > 0).length,
    guessUsers: Object.keys(data.user_guess_stats || {}).length
  };
  const filtered = data.records
    .filter((record) => {
      if (activeFilter !== null && record.active !== activeFilter) return false;
      if (reportedFilter !== null && (record.report_count > 0) !== reportedFilter) return false;
      if (!keyword) return true;
      return [
        String(record.id),
        record.song_title,
        record.song_ids.join(", "),
        record.uploader_qq,
        record.uploader_nickname,
        record.uploader_group_id,
        record.uploader_group_name
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    })
    .sort((a, b) => b.id - a.id);
  const start = (page - 1) * pageSize;
  const items = await Promise.all(
    filtered.slice(start, start + pageSize).map(async (record) => {
      const image = await buildDrawGuessImageUrl(record);
      return {
        id: record.id,
        songTitle: record.song_title,
        songIds: record.song_ids,
        uploaderQq: record.uploader_qq,
        uploaderNickname: record.uploader_nickname,
        uploaderGroupId: record.uploader_group_id,
        uploaderGroupName: record.uploader_group_name,
        imageUrl: image.imageUrl,
        imageExists: image.imageExists,
        active: record.active,
        guessCorrectCount: record.guess_correct_count,
        guessWrongCount: record.guess_wrong_count,
        likeCount: record.like_count,
        reportCount: record.report_count,
        createdAt: record.created_at
      } satisfies DrawGuessListItem;
    })
  );
  return {
    summary,
    total: filtered.length,
    page,
    pageSize,
    items
  };
};

export const createAdminDrawGuess = async (input: {
  actor: { id: number; username: string };
  payload: Record<string, unknown>;
  file?: { buffer: Buffer; fileName?: string; contentType?: string } | null;
}) => {
  if (!input.file?.buffer?.length) {
    throw createError({ statusCode: 400, statusMessage: "请上传题面图片" });
  }
  const { drawGuessDbPath, drawGuessImageDir } = getAdminManagedPaths();
  const data = await readDrawGuessDb();
  const nextId = data.next_id;
  const nextRecord = {
    id: nextId,
    ...(await buildRecordMutation(input.payload)),
    image_file: `images/${nextId}.png`,
    created_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z")
  } satisfies DrawGuessRecord;
  const imagePath = getDrawGuessImagePath(nextRecord);
  const imageBuffer = await createNormalizedImageBuffer(input.file.buffer);

  await createAdminBackupSnapshot({
    category: "mutations",
    label: `draw-guess-${nextId}`,
    reason: `create-draw-guess-${nextId}`,
    actorId: String(input.actor.id),
    actorName: input.actor.username,
    sources: [
      {
        path: drawGuessDbPath,
        optional: true
      }
    ]
  });

  await ensureDir(drawGuessImageDir);
  await ensureDir(dirname(imagePath));
  await writeFileAtomic(imagePath, imageBuffer);
  data.records.push(nextRecord);
  data.next_id = nextId + 1;
  try {
    await writeDrawGuessDb(data);
  } catch (error) {
    await unlink(imagePath).catch(() => undefined);
    throw error;
  }
  await recordAdminAction({
    actorType: "admin",
    actorId: String(input.actor.id),
    actorName: input.actor.username,
    source: "admin-web",
    targetType: "draw-guess-record",
    targetKey: String(nextId),
    action: "create",
    after: {
      ...nextRecord,
      fileName: input.file.fileName || "",
      contentType: input.file.contentType || ""
    }
  });
  return { id: nextId };
};

export const updateAdminDrawGuess = async (input: {
  actor: { id: number; username: string };
  recordId: unknown;
  payload: Record<string, unknown>;
  file?: { buffer: Buffer; fileName?: string; contentType?: string } | null;
}) => {
  const recordId = toPositiveInteger(input.recordId, "记录 ID ");
  const { drawGuessDbPath } = getAdminManagedPaths();
  const data = await readDrawGuessDb();
  const index = findRecordIndex(data.records, recordId);
  if (index < 0) {
    throw createError({ statusCode: 404, statusMessage: "未找到该题目记录" });
  }
  const before = data.records[index];
  const nextRecord: DrawGuessRecord = {
    ...before,
    ...(await buildRecordMutation(input.payload)),
    id: before.id,
    image_file: before.image_file || `images/${before.id}.png`,
    created_at: before.created_at
  };
  const imagePath = getDrawGuessImagePath(nextRecord);
  const imageBuffer = input.file?.buffer?.length ? await createNormalizedImageBuffer(input.file.buffer) : null;

  await createAdminBackupSnapshot({
    category: "mutations",
    label: `draw-guess-${recordId}`,
    reason: `update-draw-guess-${recordId}`,
    actorId: String(input.actor.id),
    actorName: input.actor.username,
    sources: [
      {
        path: drawGuessDbPath,
        optional: true
      },
      {
        path: imagePath,
        alias: `${recordId}.png`,
        optional: true
      }
    ]
  });

  if (imageBuffer) {
    await ensureDir(dirname(imagePath));
    await writeFileAtomic(imagePath, imageBuffer);
  }
  data.records[index] = nextRecord;
  await writeDrawGuessDb(data);
  await recordAdminAction({
    actorType: "admin",
    actorId: String(input.actor.id),
    actorName: input.actor.username,
    source: "admin-web",
    targetType: "draw-guess-record",
    targetKey: String(recordId),
    action: "update",
    before,
    after: {
      ...nextRecord,
      imageChanged: Boolean(imageBuffer),
      fileName: input.file?.fileName || "",
      contentType: input.file?.contentType || ""
    }
  });
  return { ok: true };
};

export const deleteAdminDrawGuess = async (actor: { id: number; username: string }, recordIdInput: unknown) => {
  const recordId = toPositiveInteger(recordIdInput, "记录 ID ");
  const { drawGuessDbPath } = getAdminManagedPaths();
  const data = await readDrawGuessDb();
  const index = findRecordIndex(data.records, recordId);
  if (index < 0) {
    throw createError({ statusCode: 404, statusMessage: "未找到该题目记录" });
  }
  const before = data.records[index];
  const imagePath = getDrawGuessImagePath(before);

  await createAdminBackupSnapshot({
    category: "mutations",
    label: `draw-guess-${recordId}`,
    reason: `delete-draw-guess-${recordId}`,
    actorId: String(actor.id),
    actorName: actor.username,
    sources: [
      {
        path: drawGuessDbPath,
        optional: true
      },
      {
        path: imagePath,
        alias: `${recordId}.png`,
        optional: true
      }
    ]
  });

  data.records.splice(index, 1);
  await writeDrawGuessDb(data);
  await unlink(imagePath).catch(() => undefined);
  await recordAdminAction({
    actorType: "admin",
    actorId: String(actor.id),
    actorName: actor.username,
    source: "admin-web",
    targetType: "draw-guess-record",
    targetKey: String(recordId),
    action: "delete",
    before
  });
  return { ok: true };
};

export const resolveAdminDrawGuessImage = async (recordIdInput: unknown) => {
  const recordId = toPositiveInteger(recordIdInput, "记录 ID ");
  const data = await readDrawGuessDb();
  const record = data.records.find((item) => item.id === recordId);
  if (!record) {
    throw createError({ statusCode: 404, statusMessage: "未找到该题目记录" });
  }
  const filePath = getDrawGuessImagePath(record);
  try {
    await access(filePath, fsConstants.R_OK);
  } catch {
    throw createError({ statusCode: 404, statusMessage: "题面图片不存在" });
  }
  return {
    filePath,
    contentType: "image/png"
  };
};
