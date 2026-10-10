import { createError } from "h3";
import { execFileAsync, getCurrentBindingRow, getRuntimePaths } from "~/server/internal/account/shared";
import { getDomainScoreReader } from "../taiko-domain/read.ts";
import type { OrdinaryRecommendationsPayload, PlayerRatingIntelligence, TargetRecommendationKey, TargetRecommendationsPayload } from "~/types/recommendation-intelligence";

type PersonalRecommendationPayload = OrdinaryRecommendationsPayload & {
  items: Array<OrdinaryRecommendationsPayload["items"][number] & { song_id: number; is_unplayed: boolean }>;
};

const ensureBindingWithUserdata = async (userId: number) => {
  const binding = await getCurrentBindingRow(userId);
  if (!binding) throw createError({ statusCode: 400, statusMessage: "请先绑定鼓众 ID" });
  if (!await getDomainScoreReader().currentExists(binding.taiko_id)) {
    throw createError({ statusCode: 404, statusMessage: "未找到本地成绩数据，请先在「多端同步」更新数据" });
  }
  return binding;
};

export const runPythonJson = async (args: string[]) => {
  const { repoRoot } = getRuntimePaths();
  try {
    const result = await execFileAsync("python3", ["-m", "plugins.utils.recommendation_intelligence", ...args], {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 12 * 1024 * 1024
    });
    return JSON.parse(String(result.stdout || ""));
  } catch {
    throw createError({ statusCode: 502, statusMessage: "个人数据计算结果无效" });
  }
};

export const runGrowthPythonJson = async (taikoId: string, dataMode: string, limit = 3) => {
  const { repoRoot } = getRuntimePaths();
  try {
    const result = await execFileAsync("python3", ["-m", "growth_compute", "growth", "--user", taikoId, "--data-mode", dataMode, "--limit", String(limit)], {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 12 * 1024 * 1024,
      env: { ...process.env, TAIKO_COMPUTE_ONLY: "1" }
    });
    return JSON.parse(String(result.stdout || ""));
  } catch {
    throw createError({ statusCode: 502, statusMessage: "个人成长计算结果无效" });
  }
};

export const getPersonalRatingSummary = async (userId: number): Promise<PlayerRatingIntelligence> => {
  const binding = await ensureBindingWithUserdata(userId);
  const { repoRoot } = getRuntimePaths();
  const payload = (await runPythonJson(["rating", binding.taiko_id, "--rating-data", `${repoRoot}/songs/rating_structured_with_ids.json`])) as Omit<PlayerRatingIntelligence, "current" | "scoreCount">;
  return { ...payload, current: payload.overallRating, scoreCount: payload.sampleCount };
};

export const getPersonalRecommendations = async (userId: number): Promise<PersonalRecommendationPayload> => {
  const binding = await ensureBindingWithUserdata(userId);
  const payload = (await runPythonJson(["ordinary", binding.taiko_id, "--basis", "rating", "--limit", "3"])) as OrdinaryRecommendationsPayload;
  return {
    ...payload,
    items: payload.items.map((item) => ({ ...item, song_id: item.songId, is_unplayed: item.isUnplayed }))
  };
};

export const getPersonalDimensionRecommendations = async (userId: number, dimension: string): Promise<PersonalRecommendationPayload> => {
  const binding = await ensureBindingWithUserdata(userId);
  const payload = (await runPythonJson(["ordinary", binding.taiko_id, "--basis", dimension, "--limit", "3"])) as OrdinaryRecommendationsPayload;
  return {
    ...payload,
    items: payload.items.map((item) => ({ ...item, song_id: item.songId, is_unplayed: item.isUnplayed }))
  };
};

export const getTargetRecommendations = async (userId: number, target: TargetRecommendationKey, star?: string): Promise<TargetRecommendationsPayload> => {
  const binding = await ensureBindingWithUserdata(userId);
  const args = ["target", binding.taiko_id, "--target", target, "--limit", "20"];
  if (star) args.push("--star", star);
  return (await runPythonJson(args)) as TargetRecommendationsPayload;
};
