import { createError } from "h3";
import { recordAdminAction } from "./audit";
import { fetchTaikoAdminResult } from "./auth";

export type RemoteGuideMusic = {
  id: number;
  title: string;
  titleJp: string;
  bpm: string;
  category: string;
};

export type RemoteGuideDifficulty = {
  id: number;
  musicId: number;
  difficultyType: number;
  level: number;
  levelTag: number;
  tag: string;
  feature: string;
  noteCount: string;
  fumen: string | null;
  maxScore: string;
};

type PagePayload<T> = {
  pageData: T[];
  total: number;
};

type GuideCache = {
  expiresAt: number;
  musics: RemoteGuideMusic[];
  difficulties: RemoteGuideDifficulty[];
};

const GUIDE_CACHE_TTL_MS = 5 * 60 * 1000;

let guideCache: GuideCache | null = null;

const difficultyLabelMap: Record<number, string> = {
  1: "简单",
  2: "普通",
  3: "困难",
  4: "鬼",
  5: "里"
};

const loadAllPages = async <T>(path: string, pageSize = 200) => {
  const firstPage = await fetchTaikoAdminResult<PagePayload<T>>(path, {
    query: {
      page: 1,
      pageSize
    }
  });
  const items = [...(firstPage.pageData || [])];
  const total = Number(firstPage.total || items.length);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  for (let page = 2; page <= totalPages; page += 1) {
    const nextPage = await fetchTaikoAdminResult<PagePayload<T>>(path, {
      query: {
        page,
        pageSize
      }
    });
    items.push(...(nextPage.pageData || []));
  }
  return items;
};

export const invalidateGuideAdminCache = () => {
  guideCache = null;
};

export const getGuideAdminSnapshot = async () => {
  if (guideCache && guideCache.expiresAt > Date.now()) {
    return guideCache;
  }
  const [musics, difficulties] = await Promise.all([
    loadAllPages<RemoteGuideMusic>("/taiko/music/page"),
    loadAllPages<RemoteGuideDifficulty>("/taiko/musicdifficulty/page")
  ]);
  guideCache = {
    expiresAt: Date.now() + GUIDE_CACHE_TTL_MS,
    musics,
    difficulties
  };
  return guideCache;
};

const normalizeKeyword = (value: unknown) => String(value || "").trim().toLowerCase();

const getDifficultyLabel = (difficultyType: number) => difficultyLabelMap[difficultyType] || `难度 ${difficultyType}`;

export const listGuideAdminMusics = async (query: {
  keyword?: unknown;
  category?: unknown;
  page?: unknown;
  pageSize?: unknown;
}) => {
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(100, Math.max(10, Number(query.pageSize || 20)));
  const keyword = normalizeKeyword(query.keyword);
  const category = String(query.category || "").trim();
  const snapshot = await getGuideAdminSnapshot();
  const filtered = snapshot.musics.filter((item) => {
    if (category && item.category !== category) return false;
    if (!keyword) return true;
    return [item.title, item.titleJp, item.bpm, item.category].some((value) =>
      String(value || "").toLowerCase().includes(keyword)
    );
  });
  const categories = Array.from(new Set(snapshot.musics.map((item) => item.category).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
  const start = (page - 1) * pageSize;
  return {
    total: filtered.length,
    page,
    pageSize,
    categories,
    items: filtered.slice(start, start + pageSize)
  };
};

export const listGuideAdminDifficulties = async (query: {
  keyword?: unknown;
  difficultyType?: unknown;
  level?: unknown;
  levelTag?: unknown;
  page?: unknown;
  pageSize?: unknown;
}) => {
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(100, Math.max(10, Number(query.pageSize || 20)));
  const keyword = normalizeKeyword(query.keyword);
  const difficultyType = Number(query.difficultyType || 0);
  const level = Number(query.level || 0);
  const levelTag = Number(query.levelTag || 0);
  const snapshot = await getGuideAdminSnapshot();
  const musicMap = new Map(snapshot.musics.map((item) => [Number(item.id), item]));
  const filtered = snapshot.difficulties
    .map((item) => ({
      ...item,
      music: musicMap.get(Number(item.musicId)) || null,
      difficultyLabel: getDifficultyLabel(Number(item.difficultyType))
    }))
    .filter((item) => {
      if (difficultyType > 0 && Number(item.difficultyType) !== difficultyType) return false;
      if (level > 0 && Number(item.level) !== level) return false;
      if (levelTag > 0 && Number(item.levelTag) !== levelTag) return false;
      if (!keyword) return true;
      return [
        item.music?.title,
        item.music?.titleJp,
        item.difficultyLabel,
        item.tag,
        item.feature,
        item.noteCount,
        String(item.musicId)
      ]
        .filter(Boolean)
        .some((value) => String(value || "").toLowerCase().includes(keyword));
    });
  const start = (page - 1) * pageSize;
  return {
    total: filtered.length,
    page,
    pageSize,
    items: filtered.slice(start, start + pageSize)
  };
};

export const getGuideAdminOverview = async () => {
  const snapshot = await getGuideAdminSnapshot();
  const countsByDifficulty = snapshot.difficulties.reduce<Record<string, number>>((acc, item) => {
    const key = getDifficultyLabel(Number(item.difficultyType));
    acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, {});
  return {
    musicCount: snapshot.musics.length,
    difficultyCount: snapshot.difficulties.length,
    countsByDifficulty
  };
};

export const getGuideDependencySummary = async (songId: number) => {
  const snapshot = await getGuideAdminSnapshot();
  const music = snapshot.musics.find((item) => Number(item.id) === Number(songId)) || null;
  const difficulties = snapshot.difficulties.filter((item) => Number(item.musicId) === Number(songId));
  return {
    music,
    difficulties
  };
};

const assertRequiredText = (value: unknown, message: string) => {
  const text = String(value || "").trim();
  if (!text) {
    throw createError({ statusCode: 400, statusMessage: message });
  }
  return text;
};

const toPositiveInt = (value: unknown, message: string) => {
  const parsed = Number(value || 0);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createError({ statusCode: 400, statusMessage: message });
  }
  return parsed;
};

export const createGuideMusic = async (
  token: string,
  actor: { id: number; username: string },
  payload: Record<string, unknown>
) => {
  const body = {
    id: toPositiveInt(payload.id, "歌曲 ID 无效"),
    title: assertRequiredText(payload.title, "请输入中文曲名"),
    titleJp: assertRequiredText(payload.titleJp, "请输入日文曲名"),
    bpm: assertRequiredText(payload.bpm, "请输入 BPM"),
    category: assertRequiredText(payload.category, "请输入分类")
  };
  await fetchTaikoAdminResult("/taiko/manage/music/add", {
    method: "POST",
    token,
    body
  });
  invalidateGuideAdminCache();
  await recordAdminAction({
    actorType: "admin",
    actorId: String(actor.id),
    actorName: actor.username,
    source: "admin-web",
    targetType: "guide-music",
    targetKey: String(body.id),
    action: "create",
    after: body
  });
  return body;
};

export const updateGuideMusic = async (
  token: string,
  actor: { id: number; username: string },
  payload: Record<string, unknown>
) => {
  const snapshot = await getGuideAdminSnapshot();
  const body = {
    id: toPositiveInt(payload.id, "歌曲 ID 无效"),
    title: assertRequiredText(payload.title, "请输入中文曲名"),
    titleJp: assertRequiredText(payload.titleJp, "请输入日文曲名"),
    bpm: assertRequiredText(payload.bpm, "请输入 BPM"),
    category: assertRequiredText(payload.category, "请输入分类")
  };
  const before = snapshot.musics.find((item) => Number(item.id) === body.id) || null;
  await fetchTaikoAdminResult("/taiko/manage/music/update", {
    method: "PUT",
    token,
    body
  });
  invalidateGuideAdminCache();
  await recordAdminAction({
    actorType: "admin",
    actorId: String(actor.id),
    actorName: actor.username,
    source: "admin-web",
    targetType: "guide-music",
    targetKey: String(body.id),
    action: "update",
    before,
    after: body
  });
  return body;
};

export const deleteGuideMusic = async (
  token: string,
  actor: { id: number; username: string },
  songIdInput: unknown
) => {
  const songId = toPositiveInt(songIdInput, "歌曲 ID 无效");
  const dependency = await getGuideDependencySummary(songId);
  if (dependency.difficulties.length > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: "该攻略歌曲仍有关联谱面攻略，请先删除关联的谱面攻略"
    });
  }
  await fetchTaikoAdminResult("/taiko/manage/music/delete", {
    method: "DELETE",
    token,
    query: {
      id: songId
    }
  });
  invalidateGuideAdminCache();
  await recordAdminAction({
    actorType: "admin",
    actorId: String(actor.id),
    actorName: actor.username,
    source: "admin-web",
    targetType: "guide-music",
    targetKey: String(songId),
    action: "delete",
    before: dependency.music
  });
  return { ok: true };
};

export const createGuideDifficulty = async (
  token: string,
  actor: { id: number; username: string },
  payload: Record<string, unknown>
) => {
  const body = {
    musicId: toPositiveInt(payload.musicId, "歌曲 ID 无效"),
    difficultyType: toPositiveInt(payload.difficultyType, "难度类型无效"),
    level: toPositiveInt(payload.level, "定数无效"),
    levelTag: toPositiveInt(payload.levelTag, "难易偏差无效"),
    tag: assertRequiredText(payload.tag, "请输入标签"),
    feature: assertRequiredText(payload.feature, "请输入攻略正文"),
    noteCount: assertRequiredText(payload.noteCount, "请输入物量"),
    fumen: String(payload.fumen || "").trim() || null,
    maxScore: String(payload.maxScore || "0").trim() || "0"
  };
  await fetchTaikoAdminResult("/taiko/manage/musicdifficulty/add", {
    method: "POST",
    token,
    body
  });
  invalidateGuideAdminCache();
  await recordAdminAction({
    actorType: "admin",
    actorId: String(actor.id),
    actorName: actor.username,
    source: "admin-web",
    targetType: "guide-difficulty",
    targetKey: `${body.musicId}:${body.difficultyType}:${body.level}:${body.levelTag}`,
    action: "create",
    after: body
  });
  return body;
};

export const updateGuideDifficulty = async (
  token: string,
  actor: { id: number; username: string },
  payload: Record<string, unknown>
) => {
  const snapshot = await getGuideAdminSnapshot();
  const body = {
    id: toPositiveInt(payload.id, "谱面攻略 ID 无效"),
    musicId: toPositiveInt(payload.musicId, "歌曲 ID 无效"),
    difficultyType: toPositiveInt(payload.difficultyType, "难度类型无效"),
    level: toPositiveInt(payload.level, "定数无效"),
    levelTag: toPositiveInt(payload.levelTag, "难易偏差无效"),
    tag: assertRequiredText(payload.tag, "请输入标签"),
    feature: assertRequiredText(payload.feature, "请输入攻略正文"),
    noteCount: assertRequiredText(payload.noteCount, "请输入物量"),
    fumen: String(payload.fumen || "").trim() || null,
    maxScore: String(payload.maxScore || "0").trim() || "0"
  };
  const before = snapshot.difficulties.find((item) => Number(item.id) === body.id) || null;
  await fetchTaikoAdminResult("/taiko/manage/musicdifficulty/update", {
    method: "PUT",
    token,
    body
  });
  invalidateGuideAdminCache();
  await recordAdminAction({
    actorType: "admin",
    actorId: String(actor.id),
    actorName: actor.username,
    source: "admin-web",
    targetType: "guide-difficulty",
    targetKey: String(body.id),
    action: "update",
    before,
    after: body
  });
  return body;
};

export const deleteGuideDifficulty = async (
  token: string,
  actor: { id: number; username: string },
  difficultyIdInput: unknown
) => {
  const difficultyId = toPositiveInt(difficultyIdInput, "谱面攻略 ID 无效");
  const snapshot = await getGuideAdminSnapshot();
  const before = snapshot.difficulties.find((item) => Number(item.id) === difficultyId) || null;
  await fetchTaikoAdminResult("/taiko/manage/musicdifficulty/delete", {
    method: "DELETE",
    token,
    query: {
      id: difficultyId
    }
  });
  invalidateGuideAdminCache();
  await recordAdminAction({
    actorType: "admin",
    actorId: String(actor.id),
    actorName: actor.username,
    source: "admin-web",
    targetType: "guide-difficulty",
    targetKey: String(difficultyId),
    action: "delete",
    before
  });
  return { ok: true };
};
