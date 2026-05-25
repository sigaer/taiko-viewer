import type {
  GuideDifficultyOption,
  GuidePagePayload,
  GuideSummaryTable,
  GuideTagItem,
  GuideTagItemsPayload
} from "~/types/content";
import {
  GUIDE_DIFFICULTY_OPTIONS,
  GUIDE_SUMMARY_KEYS,
  GUIDE_TAGS,
  getGuideDifficultyOption
} from "~/utils/guide";
import { getContentRuntimePaths, getGuideCacheTtlMs } from "./runtime";
import { normalizeViewerLocale } from "~/server/utils/locale";
import { translateServerMessage } from "~/server/utils/server-messages";

const guideSummaryCache = new Map<string, { expiresAt: number; data: GuidePagePayload }>();
const guideTagItemsCache = new Map<string, { expiresAt: number; data: GuideTagItemsPayload }>();
const GUIDE_TAG_TRANSLATION_KEYS: Record<number, string> = {
  1: "guide.summaryColumns.overPlus",
  2: "guide.summaryColumns.over",
  3: "guide.summaryColumns.strong",
  4: "guide.summaryColumns.middle",
  5: "guide.summaryColumns.weak",
  6: "guide.summaryColumns.under",
  7: "guide.summaryColumns.underMinus"
};

const toGuideTagItem = (input: Record<string, unknown>): GuideTagItem => ({
  id: Number(input.id || 0),
  title: String(input.title || ""),
  bpm: String(input.bpm || ""),
  category: String(input.category || ""),
  tag: String(input.tag || ""),
  feature: String(input.feature || ""),
  noteCount: String(input.noteCount || "")
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
  const now = Date.now();
  const cached = guideTagItemsCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const { guideApiBase } = getContentRuntimePaths();
  const response = await $fetch<{ data?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(
    "/music/musicDetailList",
    {
      baseURL: guideApiBase,
      params: {
        difficultyType: difficulty,
        level,
        levelTag: tagId
      }
    }
  );
  const rows = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : [];
  const payload: GuideTagItemsPayload = {
    difficulty,
    level,
    tagId,
    tagLabel: getGuideTagLabel(normalizedLocale, tagId, tag.label),
    items: rows.map(toGuideTagItem)
  };
  guideTagItemsCache.set(cacheKey, {
    expiresAt: now + getGuideCacheTtlMs(),
    data: payload
  });
  return payload;
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
  const summary = tagPayloads.reduce<GuideSummaryTable>(
    (acc, item) => {
      acc[item.tagLabel] = item.items.length;
      const totalLabel = translateServerMessage(normalizedLocale, "guide.summaryColumns.total", undefined, "合计");
      acc[totalLabel] = (acc[totalLabel] || 0) + item.items.length;
      return acc;
    },
    GUIDE_SUMMARY_KEYS.reduce<GuideSummaryTable>((acc, key) => {
      const translatedKey =
        key === "合计"
          ? translateServerMessage(normalizedLocale, "guide.summaryColumns.total", undefined, key)
          : getGuideTagLabel(
              normalizedLocale,
              GUIDE_TAGS.find((item) => item.label === key)?.id || 0,
              key
            );
      acc[translatedKey] = 0;
      return acc;
    }, {} as GuideSummaryTable)
  );

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
    expiresAt: now + getGuideCacheTtlMs(),
    data: payload
  });
  return payload;
};

export const getGuideTagItemsContent = fetchGuideTagItems;
