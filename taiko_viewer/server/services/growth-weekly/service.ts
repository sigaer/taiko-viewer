import { performance } from "node:perf_hooks";
import type { WeeklyGrowthResponse } from "../../../types/player-growth.ts";
import { getPlayerGrowthOverview } from "../account/growth.ts";
import { getGrowthHistory } from "../growth-history/service.ts";
import { measurementFocus } from "../growth-history/measurements.ts";
import type { WeeklyGrowthWindow } from "./range.ts";
import { buildWeeklyGrowthRecap } from "./composer.ts";

export async function getWeeklyGrowthRecap(userId: number, window: WeeklyGrowthWindow): Promise<WeeklyGrowthResponse> {
  const startedAt = performance.now();
  const overviewStartedAt = performance.now();
  const overview = await getPlayerGrowthOverview(userId).catch(error => {
    console.error("[growth-weekly] current Growth unavailable", { error: error instanceof Error ? error.message : String(error) });
    return null;
  });
  const overviewDurationMs = performance.now() - overviewStartedAt;
  const history = await getGrowthHistory(userId, window);
  const composeStartedAt = performance.now();
  const currentNextAction = overview ? {
    focus: measurementFocus(overview.playerState),
    todayPlan: overview.todayPlan
  } : null;
  const recap = buildWeeklyGrowthRecap(history, { from: window.from, to: window.to, isCompleteWeek: window.isCompleteWeek }, currentNextAction);
  console.info("[growth-weekly] compose", {
    weekDays: window.days,
    overviewDurationMs: Math.round(overviewDurationMs),
    composeDurationMs: Math.round(performance.now() - composeStartedAt),
    totalDurationMs: Math.round(performance.now() - startedAt),
    factCount: history.facts.length,
    measurementCount: history.measurements.length,
    highlightCount: recap.highlights.length,
    theme: recap.theme.type,
    coverageState: recap.coverage.scoreHistoryState
  });
  return recap;
}
