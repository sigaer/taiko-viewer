import { createError } from "h3";
import type { ChartDifficultyVoteValue } from "../../../types/ugc.ts";
import { isChartDifficultyVoteValue, UGC_USER_MAX_TAGS } from "./constants.ts";

export const normalizeDifficultyVoteValue = (value: unknown): ChartDifficultyVoteValue | null => {
  if (value === null) return null;
  if (!isChartDifficultyVoteValue(value)) {
    throw createError({ statusCode: 400, statusMessage: "体感难度选择无效" });
  }
  return value;
};

export const normalizeUgcTagSlugs = (value: unknown) => {
  if (!Array.isArray(value)) {
    throw createError({ statusCode: 400, statusMessage: "谱面标签格式无效" });
  }
  if (value.some((slug) => typeof slug !== "string" || !slug.trim())) {
    throw createError({ statusCode: 400, statusMessage: "谱面标签格式无效" });
  }
  const slugs = [...new Set(value.map((slug) => String(slug).trim()))];
  if (slugs.length > UGC_USER_MAX_TAGS) {
    throw createError({ statusCode: 400, statusMessage: `最多选择 ${UGC_USER_MAX_TAGS} 个标签` });
  }
  return slugs;
};
