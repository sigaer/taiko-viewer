import { createError } from "h3";
import { getCurrentBindingRow, getRuntimePaths } from "~/server/internal/account/shared";
import { captureBindingIdentity, assertBindingIdentity } from "../../internal/account/binding-identity.ts";
import { getDomainScoreReader } from "../taiko-domain/read.ts";
import { withDomainScoreRead } from "../taiko-domain/publication.ts";
import { runPythonJson } from "./python-compute.ts";
export { runPythonJson, runGrowthPythonJson } from "./python-compute.ts";
import type { OrdinaryRecommendationsPayload, PlayerRatingIntelligence, TargetRecommendationKey, TargetRecommendationsPayload } from "~/types/recommendation-intelligence";

type PersonalRecommendationPayload = OrdinaryRecommendationsPayload & {
  items: Array<OrdinaryRecommendationsPayload["items"][number] & { song_id: number; is_unplayed: boolean }>;
};

export const withPersonalScoreRead = async <T>(userId: number, task: (binding: NonNullable<Awaited<ReturnType<typeof getCurrentBindingRow>>>) => Promise<T>) => {
  const binding = await getCurrentBindingRow(userId);
  if (!binding) throw createError({ statusCode: 400, statusMessage: "请先绑定鼓众 ID" });
  const expected = captureBindingIdentity(binding);
  return withDomainScoreRead(binding.taiko_id, async () => {
    assertBindingIdentity(expected, await getCurrentBindingRow(userId));
    if (!await getDomainScoreReader().currentExists(binding.taiko_id)) {
      throw createError({ statusCode: 404, statusMessage: "未找到本地成绩数据，请先在「多端同步」更新数据" });
    }
    const result = await task(binding);
    assertBindingIdentity(expected, await getCurrentBindingRow(userId));
    return result;
  });
};

export const getPersonalRatingSummary = (userId: number): Promise<PlayerRatingIntelligence> => withPersonalScoreRead(userId, async binding => {
  const { repoRoot } = getRuntimePaths();
  const payload = (await runPythonJson(["rating", binding.taiko_id, "--rating-data", `${repoRoot}/songs/rating_structured_with_ids.json`])) as Omit<PlayerRatingIntelligence, "current" | "scoreCount">;
  return { ...payload, current: payload.overallRating, scoreCount: payload.sampleCount };
});

export const getPersonalRecommendations = (userId: number): Promise<PersonalRecommendationPayload> => withPersonalScoreRead(userId, async binding => {
  const payload = (await runPythonJson(["ordinary", binding.taiko_id, "--basis", "rating", "--limit", "3"])) as OrdinaryRecommendationsPayload;
  return {
    ...payload,
    items: payload.items.map((item) => ({ ...item, song_id: item.songId, is_unplayed: item.isUnplayed }))
  };
});

export const getPersonalDimensionRecommendations = (userId: number, dimension: string): Promise<PersonalRecommendationPayload> => withPersonalScoreRead(userId, async binding => {
  const payload = (await runPythonJson(["ordinary", binding.taiko_id, "--basis", dimension, "--limit", "3"])) as OrdinaryRecommendationsPayload;
  return {
    ...payload,
    items: payload.items.map((item) => ({ ...item, song_id: item.songId, is_unplayed: item.isUnplayed }))
  };
});

export const getTargetRecommendations = (userId: number, target: TargetRecommendationKey, star?: string): Promise<TargetRecommendationsPayload> => withPersonalScoreRead(userId, async binding => {
  const args = ["target", binding.taiko_id, "--target", target, "--limit", "20"];
  if (star) args.push("--star", star);
  return (await runPythonJson(args)) as TargetRecommendationsPayload;
});
