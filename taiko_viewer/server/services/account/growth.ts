import { readRecentCompletedGoal } from '../goals/evaluation-store';
import { readGoalSnapshot } from "../goals/snapshot";
import { readActiveGoal } from "../goals/store";
import { getAccountDb } from "~/server/utils/account-db";
import { goalBaseline, goalOptions, goalChartAvailable } from "~/utils/playerGoal";
import { access, constants as fsConstants } from "node:fs/promises";
import { createError } from "h3";
import type { GrowthDailyProgress, GrowthDataMode, GrowthPlanItem, PlayerGrowthOverview } from "~/types/player-growth";
import { buildPlayerGrowthState, growthCalendarDay } from "~/utils/playerGrowth";
import { deriveDailyProgress } from "~/utils/dailyProgress";
import { resolveDifficultyPresentation } from "~/utils/difficulty";
import { getSongCatalog } from "~/server/services/content";
import { getCurrentBindingRow, getUserdataPath, type UserdataPayload, type UserdataSong } from "~/server/internal/account/shared";
import { runGrowthPythonJson } from "./personal";
import { loadGrowthScoreEvidence } from "../growth-history/evidence";
import { getGrowthModelRevision } from "../growth-history/model-revision";
import { upsertGrowthMeasurement } from "../growth-history/measurements";

const TIMEZONE = "Asia/Shanghai" as const;

const numberValue = (value: unknown) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const chartKey = (song: Pick<UserdataSong, "song_no" | "level">) => `${numberValue(song.song_no)}:${numberValue(song.level)}`;
const scoreValue = (song?: UserdataSong) => numberValue(song?.high_score);
const buildDailyProgress = (current: UserdataPayload, catalog: Awaited<ReturnType<typeof getSongCatalog>>, history: Awaited<ReturnType<typeof loadGrowthScoreEvidence>>["snapshots"]): GrowthDailyProgress => {
  const titles = new Map(catalog.map(song => [Number(song.id), song.song_name]));
  return deriveDailyProgress(current.songs || [], history, growthCalendarDay(new Date(), TIMEZONE), song => titles.get(Number(song.song_no)) || song.song_name || `#${song.song_no}`);
};

export const getPlayerGrowthOverview = async (userId: number): Promise<PlayerGrowthOverview> => {
  const requestStartedAt = performance.now();
  const authStartedAt = performance.now();
  const binding = await getCurrentBindingRow(userId);
  const authDurationMs = performance.now() - authStartedAt;
  if (!binding) throw createError({ statusCode: 400, statusMessage: "请先绑定鼓众 ID" });
  try { await access(getUserdataPath(binding.taiko_id), fsConstants.R_OK); } catch { throw createError({ statusCode: 404, statusMessage: "未找到本地成绩数据，请先在「多端同步」更新数据" }); }
  const scoreStartedAt = performance.now();
  const [snapshot, catalog, scoreEvidence] = await Promise.all([readGoalSnapshot(binding.taiko_id), getSongCatalog(), loadGrowthScoreEvidence(binding.taiko_id)]);
  const history = scoreEvidence.snapshots;
  const { current } = snapshot;
  const scoreDurationMs = performance.now() - scoreStartedAt;
  const mode: GrowthDataMode = history.some((item) => item.full) ? "FULL_HISTORY" : current.songs?.length ? "SNAPSHOT_LIMITED" : "INSUFFICIENT";
  const computePromise = runGrowthPythonJson(binding.taiko_id, mode, 3);
  const computed = await computePromise;
  const stateAggregationStartedAt = performance.now();
  const playerState = buildPlayerGrowthState(computed.playerState.dimensions, computed.playerState.sampleCount, mode, computed.playerState.overallRating);
  const measurementPromise = getGrowthModelRevision()
    .then(modelRevision => upsertGrowthMeasurement(getAccountDb(), { userId, bindingId: Number(binding.id), scoreRevision: snapshot.revision, capturedAt: snapshot.capturedAt, modelRevision, playerState, rawDimensions: computed.playerState.dimensions }))
    .then(result => console.info("[growth-history] measurement upsert", { userId, bindingId: Number(binding.id), result: result.created ? "create" : "hit" }))
    .catch(error => console.error("[growth-history] measurement persistence failed", { userId, bindingId: Number(binding.id), error: error instanceof Error ? error.message : String(error) }));
  const stateAggregationDurationMs = performance.now() - stateAggregationStartedAt;
  const stateDurationMs = stateAggregationDurationMs;
  const progressStartedAt = performance.now();
  const dailyProgressPromise = Promise.resolve().then(() => buildDailyProgress(current, catalog, history));
  const planStartedAt = performance.now();
  const recommendations = computed.todayPlan.items;
  const usedFallback = Boolean(computed.todayPlan.usedFallback);
  const scoreMap = new Map((current.songs || []).map((song) => [chartKey(song), song]));
  const items = recommendations.slice(0, 3).map((item: { songId: number; level: number; title: string; isUnplayed: boolean }) => {
    const song = scoreMap.get(`${item.songId}:${item.level}`);
    const catalogSong = catalog.find((entry) => Number(entry.id) === item.songId) || null;
    const difficulty = resolveDifficultyPresentation(catalogSong, item.level);
    if (!difficulty.difficultyType) return null;
    return { goalOptions: goalOptions(goalBaseline(song, snapshot.revision, snapshot.capturedAt), binding.source, goalChartAvailable(catalogSong || undefined, item.level)), songId: item.songId, difficultyType: difficulty.difficultyType, starLevel: difficulty.starLevel, title: item.title, isUnplayed: item.isUnplayed, targetDimension: playerState.dataSufficiency === "ready" ? playerState.priorityDimension : null, reason: usedFallback ? "general-fallback" as const : "target-dimension" as const, currentBestScore: song ? scoreValue(song) || null : null, currentBestRank: song ? numberValue(song.best_score_rank) || null : null };
  }).filter(Boolean) as GrowthPlanItem[];
  const planDurationMs = performance.now() - planStartedAt;
  const dailyProgress = await dailyProgressPromise;
  await measurementPromise;
  const progressDurationMs = performance.now() - progressStartedAt;
  console.info("[player-growth] overview timing", {
    userId,
    authDurationMs: Math.round(authDurationMs),
    scoreDurationMs: Math.round(scoreDurationMs),
    stateDurationMs: Math.round(stateDurationMs),
    planDurationMs: Math.round(planDurationMs),
    pythonDurationMs: Number(computed.timing?.totalPythonMs || 0),
    pythonTiming: computed.timing || null,
    stateAggregationDurationMs: Math.round(stateAggregationDurationMs),
    progressDurationMs: Math.round(progressDurationMs),
    totalDurationMs: Math.round(performance.now() - requestStartedAt),
    recommendationCount: items.length,
    historyFileCount: history.length,
    historyTotalFileCount: scoreEvidence.totalFiles,
    historyTruncated: scoreEvidence.truncated,
    dataMode: mode,
    recommendationFallback: usedFallback
  });
  const activeGoal = await readActiveGoal(getAccountDb(), userId, binding.id);
  if (activeGoal) activeGoal.unavailable = !goalChartAvailable(catalog.find(s => Number(s.id) === activeGoal.songId), activeGoal.difficultyType);
  return { recentCompletedGoal: activeGoal ? null : await readRecentCompletedGoal(getAccountDb(),userId,Number(binding.id)), profileId: String(binding.id), scoreRevision: snapshot.revision, sourceGeneratedAt: snapshot.capturedAt, activeGoal, playerState, todayPlan: { targetDimension: playerState.dataSufficiency === "ready" ? playerState.priorityDimension : null, items, usedFallback }, dailyProgress, dataStatus: { mode, timezone: TIMEZONE } };
};
