import type {
  GuidePagePayload,
  GuideSummaryTable,
  GuideTagItem,
  GuideTagItemsPayload
} from "~/types/content";
import {
  GUIDE_SUMMARY_KEY_BY_TAG_ID,
  GUIDE_SUMMARY_KEYS,
  GUIDE_TAGS,
  getGuideDifficultyOption
} from "~/utils/guide";
import { getContentRuntimePaths, getGuideCacheTtlMs } from "./runtime";
import { normalizeViewerLocale } from "~/server/utils/locale";
import { translateServerMessage } from "~/server/utils/server-messages";
import { readPersistentCache, writePersistentCache } from "./persistentCache";

type GuideCacheEntry<T> = { fetchedAt: number; expiresAt: number; data: T };

const guideSummaryCache = new Map<string, GuideCacheEntry<GuidePagePayload>>();
const guideTagItemsCache = new Map<string, GuideCacheEntry<GuideTagItemsPayload>>();
const guideTagLoadPromises = new Map<string, Promise<void>>();
const guideTagRefreshPromises = new Map<string, Promise<GuideTagItemsPayload>>();
const GUIDE_MAX_STALE_MS = 24 * 60 * 60 * 1000;
const GUIDE_TIMEOUT_MS = 8 * 1000;
const GUIDE_TAG_TRANSLATION_KEYS: Record<number, string> = {
  1: "guide.summaryColumns.overPlus",
  2: "guide.summaryColumns.over",
  3: "guide.summaryColumns.strong",
  4: "guide.summaryColumns.middle",
  5: "guide.summaryColumns.weak",
  6: "guide.summaryColumns.under",
  7: "guide.summaryColumns.underMinus"
};

const toGuideTagItem = (
  input: Record<string, unknown>,
  difficulty: number,
  level: number,
  tagId: number,
  index: number
): GuideTagItem => ({
  id: Number(input.id || 0),
  rowKey: `guide-${difficulty}-${level}-${tagId}-${Number(input.id || 0)}-${index}`,
  title: String(input.title || ""),
  bpm: String(input.bpm || ""),
  category: String(input.category || ""),
  tag: String(input.tag || ""),
  feature: String(input.feature || ""),
  noteCount: String(input.noteCount ?? input.note_count ?? "")
});

const getGuideTagLabel = (locale: string, tagId: number, fallback: string) =>
  translateServerMessage(locale, GUIDE_TAG_TRANSLATION_KEYS[tagId], undefined, fallback);

const getDifficultyLabel = (locale: string, difficulty: number, fallback: string) =>
  translateServerMessage(locale, `difficulty.${difficulty}`, undefined, fallback);

const ensureGuideRouteParams = (difficulty: number, level: number, locale: string) => {
  const option = getGuideDifficultyOption(difficulty);
  if (!option) {
    throw createError({
      statusCode: 400,
      statusMessage: translateServerMessage(locale, "guide.invalidDifficulty", undefined, "攻略难度无效")
    });
  }
  if (!Number.isInteger(level) || level <= 0 || level > option.max) {
    throw createError({
      statusCode: 400,
      statusMessage: translateServerMessage(locale, "guide.invalidLevel", undefined, "攻略星级无效")
    });
  }
  return option;
};

const loadGuideTagCache = async (cacheKey: string) => {
  if (guideTagItemsCache.has(cacheKey)) return;
  let pending = guideTagLoadPromises.get(cacheKey);
  if (!pending) {
    pending = (async () => {
      const cached = await readPersistentCache<GuideTagItemsPayload>(`guide-tag-${cacheKey}`);
      if (!cached) return;
      const fetchedAt = Date.parse(cached.savedAt);
      if (!Number.isFinite(fetchedAt) || Date.now() - fetchedAt > GUIDE_MAX_STALE_MS) return;
      guideTagItemsCache.set(cacheKey, {
        fetchedAt,
        expiresAt: fetchedAt + getGuideCacheTtlMs(),
        data: cached.data
      });
    })().finally(() => guideTagLoadPromises.delete(cacheKey));
    guideTagLoadPromises.set(cacheKey, pending);
  }
  await pending;
};

const refreshGuideTagItems = (
  cacheKey: string,
  difficulty: number,
  level: number,
  tagId: number,
  normalizedLocale: string,
  fallbackLabel: string
) => {
  let pending = guideTagRefreshPromises.get(cacheKey);
  if (pending) return pending;
  pending = (async () => {
    const { guideApiBase } = getContentRuntimePaths();
    const response = await $fetch<{ data?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(
      "/music/musicDetailList",
      {
        baseURL: guideApiBase,
        params: { difficultyType: difficulty, level, levelTag: tagId },
        timeout: GUIDE_TIMEOUT_MS,
        retry: 0
      }
    );
    const rows = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : [];
    const payload: GuideTagItemsPayload = {
      difficulty,
      level,
      tagId,
      tagLabel: getGuideTagLabel(normalizedLocale, tagId, fallbackLabel),
      items: rows.map((row, index) => toGuideTagItem(row, difficulty, level, tagId, index))
    };
    const fetchedAt = Date.now();
    guideTagItemsCache.set(cacheKey, {
      fetchedAt,
      expiresAt: fetchedAt + getGuideCacheTtlMs(),
      data: payload
    });
    await writePersistentCache(`guide-tag-${cacheKey}`, payload, new Date(fetchedAt).toISOString());
    return payload;
  })().finally(() => guideTagRefreshPromises.delete(cacheKey));
  guideTagRefreshPromises.set(cacheKey, pending);
  return pending;
};

const fetchGuideTagItems = async (difficulty: number, level: number, tagId: number, locale = "zh") => {
  const normalizedLocale = normalizeViewerLocale(locale);
  const tag = GUIDE_TAGS.find((item) => item.id === tagId);
  if (!tag) {
    throw createError({
      statusCode: 400,
      statusMessage: translateServerMessage(normalizedLocale, "guide.invalidTag", undefined, "攻略标签无效")
    });
  }

  const cacheKey = `${normalizedLocale}:${difficulty}:${level}:${tagId}`;
  await loadGuideTagCache(cacheKey);
  const now = Date.now();
  const cached = guideTagItemsCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }
  if (cached && now - cached.fetchedAt <= GUIDE_MAX_STALE_MS) {
    void refreshGuideTagItems(cacheKey, difficulty, level, tagId, normalizedLocale, tag.label).catch(() => {});
    return cached.data;
  }
  return refreshGuideTagItems(cacheKey, difficulty, level, tagId, normalizedLocale, tag.label);
};

export const getGuidePageContent = async (difficulty: number, level: number, locale = "zh"): Promise<GuidePagePayload> => {
  const normalizedLocale = normalizeViewerLocale(locale);
  const option = ensureGuideRouteParams(difficulty, level, normalizedLocale);
  const cacheKey = `${normalizedLocale}:${difficulty}:${level}`;
  const now = Date.now();
  const cached = guideSummaryCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const tagPayloads = await Promise.all(
    GUIDE_TAGS.map((tag) => fetchGuideTagItems(difficulty, level, tag.id, normalizedLocale))
  );
  const summary = GUIDE_SUMMARY_KEYS.reduce<GuideSummaryTable>((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {} as GuideSummaryTable);

  for (const item of tagPayloads) {
    const summaryKey = GUIDE_SUMMARY_KEY_BY_TAG_ID[item.tagId];
    if (!summaryKey) {
      continue;
    }
    summary[summaryKey] = item.items.length;
    summary.total += item.items.length;
  }

  const payload: GuidePagePayload = {
    difficulty,
    difficultyLabel: getDifficultyLabel(normalizedLocale, difficulty, option.label),
    level,
    summary,
    tags: tagPayloads.map((item) => ({
      id: item.tagId,
      label: item.tagLabel,
      count: item.items.length
    }))
  };
  guideSummaryCache.set(cacheKey, {
    fetchedAt: now,
    expiresAt: now + getGuideCacheTtlMs(),
    data: payload
  });
  return payload;
};

export const getGuideTagItemsContent = fetchGuideTagItems;
