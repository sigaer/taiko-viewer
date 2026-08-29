import { createError } from "h3";
import type { ChartDifficultyVoteValue, ChartUgcReportReason } from "../../../types/ugc.ts";
import { isChartDifficultyVoteValue, UGC_REPORT_REASONS, UGC_TIP_MAX_CODE_POINTS, UGC_USER_MAX_TAGS } from "./constants.ts";

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

export const normalizeTipBody = (value: unknown) => {
  if (typeof value !== "string") throw createError({ statusCode: 400, statusMessage: "提示内容格式无效" });
  const normalized = value
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
  if (!normalized) throw createError({ statusCode: 400, statusMessage: "请输入提示内容" });
  if (/[\u0000-\u0009\u000B-\u001F\u007F]/.test(normalized)) {
    throw createError({ statusCode: 400, statusMessage: "提示内容包含不可用字符" });
  }
  if (Array.from(normalized).length > UGC_TIP_MAX_CODE_POINTS) {
    throw createError({ statusCode: 400, statusMessage: `提示内容最多 ${UGC_TIP_MAX_CODE_POINTS} 个字符` });
  }
  return normalized;
};

export const normalizeReportReason = (value: unknown): ChartUgcReportReason => {
  if (typeof value !== "string" || !UGC_REPORT_REASONS.includes(value as ChartUgcReportReason)) {
    throw createError({ statusCode: 400, statusMessage: "举报原因无效" });
  }
  return value as ChartUgcReportReason;
};

export const normalizeModerationReason = (value: unknown) => {
  const reason = typeof value === "string" ? value.trim() : "";
  if (!reason) throw createError({ statusCode: 400, statusMessage: "请填写处理原因" });
  if (reason.length > 255) throw createError({ statusCode: 400, statusMessage: "处理原因过长" });
  return reason;
};
