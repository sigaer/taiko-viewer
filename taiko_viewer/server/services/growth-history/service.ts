import { performance } from "node:perf_hooks";
import { createError } from "h3";
import type { GrowthCoverageState, GrowthHistoryResponse } from "~/types/player-growth";
import { getAccountDb } from "~/server/utils/account-db";
import { getCurrentBindingRow } from "~/server/internal/account/shared";
import { readGoalSnapshot } from "~/server/services/goals/snapshot";
import { getSongCatalog } from "~/server/services/content";
import { deriveProgressForRange } from "~/utils/dailyProgress";
import { projectScoreFacts, sortGrowthFacts } from "~/utils/growthHistory";
import { growthCalendarDay } from "~/utils/playerGrowth";
import { loadGrowthScoreEvidence } from "./evidence";
import { loadGoalFacts } from "./goals";
import { readGrowthMeasurements } from "./measurements";
import { GROWTH_HISTORY_TIMEZONE } from "./constants";
import { GROWTH_HISTORY_MAX_DAYS, type GrowthHistoryRange } from "./range";

const scoreCoverage = (manual: boolean, fromDay: string, evidence: Awaited<ReturnType<typeof loadGrowthScoreEvidence>>): GrowthCoverageState => {
  if (manual || !evidence.snapshots.length) return "unknown";
  if (evidence.truncated) return "truncated";
  const baseline = evidence.snapshots.some(snapshot => {
    const day = growthCalendarDay(snapshot.timestamp);
    return snapshot.full && Boolean(day) && day <= fromDay;
  });
  return baseline && evidence.invalidFiles === 0 ? "complete" : "partial";
};

export async function getGrowthHistory(userId: number, range: GrowthHistoryRange, options: { includeMeasurements?: boolean } = {}): Promise<GrowthHistoryResponse> {
  const startedAt = performance.now();
  const binding = await getCurrentBindingRow(userId);
  if (!binding) throw createError({ statusCode: 400, statusMessage: "请先绑定鼓众 ID" });
  const db = getAccountDb();
  const measurementPromise = options.includeMeasurements === false
    ? Promise.resolve([])
    : readGrowthMeasurements(db, userId, Number(binding.id), range.fromUtc, range.toExclusiveUtc);
  const goalPromise = loadGoalFacts(db, userId, Number(binding.id), range.fromUtc, range.toExclusiveUtc);
  const manual = binding.source === "manual";
  const evidencePromise = manual ? Promise.resolve({ snapshots: [], totalFiles: 0, filesRead: 0, invalidFiles: 0, truncated: false, fromDay: null, toDay: null }) : loadGrowthScoreEvidence(binding.taiko_id);
  const currentPromise = manual ? Promise.resolve(null) : readGoalSnapshot(binding.taiko_id).catch(() => null);
  const catalogPromise = manual ? Promise.resolve([]) : getSongCatalog();
  const [measurements, goalFacts, evidence, current, catalog] = await Promise.all([measurementPromise, goalPromise, evidencePromise, currentPromise, catalogPromise]);
  const titles = new Map(catalog.map(song => [Number(song.id), song.song_name]));
  const replayStartedAt = performance.now();
  const days = current ? deriveProgressForRange(current.current.songs || [], evidence.snapshots, range.from, range.to, song => titles.get(Number(song.song_no)) || song.song_name || `#${song.song_no}`, current.revision) : [];
  const scoreFacts = manual ? [] : projectScoreFacts(userId, Number(binding.id), days);
  const facts = sortGrowthFacts([...scoreFacts, ...goalFacts]);
  const coverage = {
    scoreHistoryFrom: evidence.fromDay,
    scoreHistoryTo: evidence.toDay,
    scoreHistoryState: scoreCoverage(manual, range.from, evidence),
    measurementFrom: measurements[0]?.capturedAt || null,
    measurementTo: measurements.at(-1)?.capturedAt || null,
    measurementState: measurements.length ? "partial" as const : "unknown" as const
  };
  console.info("[growth-history] replay", {
    userId,
    bindingId: Number(binding.id),
    rangeDays: range.days,
    durationMs: Math.round(performance.now() - replayStartedAt),
    totalDurationMs: Math.round(performance.now() - startedAt),
    snapshotsRead: evidence.snapshots.length,
    filesRead: evidence.filesRead,
    factsEmitted: facts.length,
    measurementsReturned: measurements.length,
    coverageState: coverage.scoreHistoryState
  });
  return {
    profileId: String(binding.id),
    range: { from: range.from, to: range.to, timezone: GROWTH_HISTORY_TIMEZONE, maxDays: GROWTH_HISTORY_MAX_DAYS },
    facts,
    measurements,
    coverage
  };
}
