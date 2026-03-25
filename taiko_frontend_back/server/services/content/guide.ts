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

const guideSummaryCache = new Map<string, { expiresAt: number; data: GuidePagePayload }>();
const guideTagItemsCache = new Map<string, { expiresAt: number; data: GuideTagItemsPayload }>();

const toGuideTagItem = (input: Record<string, unknown>): GuideTagItem => ({
  id: Number(input.id || 0),
  title: String(input.title || ""),
  bpm: String(input.bpm || ""),
  category: String(input.category || ""),
  tag: String(input.tag || ""),
  feature: String(input.feature || ""),
  noteCount: String(input.noteCount || "")
});

const ensureGuideRouteParams = (difficulty: number, level: number) => {
  const option = getGuideDifficultyOption(difficulty);
  if (!option) {
    throw createError({ statusCode: 400, statusMessage: "攻略难度无效" });
  }
  if (!Number.isInteger(level) || level <= 0 || level > option.max) {
    throw createError({ statusCode: 400, statusMessage: "攻略星级无效" });
  }
  return option;
};

const fetchGuideTagItems = async (difficulty: number, level: number, tagId: number) => {
  const tag = GUIDE_TAGS.find((item) => item.id === tagId);
  if (!tag) {
    throw createError({ statusCode: 400, statusMessage: "攻略标签无效" });
  }

  const cacheKey = `${difficulty}:${level}:${tagId}`;
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
    tagLabel: tag.label,
    items: rows.map(toGuideTagItem)
  };
  guideTagItemsCache.set(cacheKey, {
    expiresAt: now + getGuideCacheTtlMs(),
    data: payload
  });
  return payload;
};

export const getGuidePageContent = async (difficulty: number, level: number): Promise<GuidePagePayload> => {
  const option = ensureGuideRouteParams(difficulty, level);
  const cacheKey = `${difficulty}:${level}`;
  const now = Date.now();
  const cached = guideSummaryCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const tagPayloads = await Promise.all(
    GUIDE_TAGS.map((tag) => fetchGuideTagItems(difficulty, level, tag.id))
  );
  const summary = tagPayloads.reduce<GuideSummaryTable>(
    (acc, item) => {
      acc[item.tagLabel] = item.items.length;
      acc["合计"] += item.items.length;
      return acc;
    },
    GUIDE_SUMMARY_KEYS.reduce<GuideSummaryTable>((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {} as GuideSummaryTable)
  );

  const payload: GuidePagePayload = {
    difficulty,
    difficultyLabel: option.label,
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
