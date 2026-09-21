import { performance } from "node:perf_hooks";
import { createError } from "h3";
import { getAccountDb } from "../../utils/account-db.ts";
import { getCurrentBindingRow } from "../../internal/account/shared.ts";
import { getPlayerGrowthOverview } from "../account/growth.ts";
import { getGrowthHistory } from "../growth-history/service.ts";
import { readGrowthMeasurementCoverage, readGrowthMeasurements } from "../growth-history/measurements.ts";
import { buildSkillPassport } from "./composer.ts";
import { passportHistoryRange, type SkillPassportRange } from "./range.ts";

export async function getSkillPassport(userId: number, range: SkillPassportRange) {
  const startedAt = performance.now();
  const initialBinding = await getCurrentBindingRow(userId);
  if (!initialBinding) throw createError({ statusCode: 400, statusMessage: "请先绑定鼓众 ID" });
  const profileId = String(initialBinding.id);

  const overviewStartedAt = performance.now();
  const overview = await getPlayerGrowthOverview(userId).catch(error => {
    console.info("[growth-passport] current Growth unavailable", { error: error instanceof Error ? error.message : String(error) });
    return null;
  });
  const overviewDurationMs = performance.now() - overviewStartedAt;
  if (overview?.profileId && String(overview.profileId) !== profileId) throw createError({ statusCode: 409, statusMessage: "profile-changed" });

  const db = getAccountDb();
  let measurementQueryMs = 0;
  let recentHistoryMs = 0;
  const measurementStartedAt = performance.now();
  const measurementsPromise = Promise.all([
    readGrowthMeasurements(db, userId, Number(initialBinding.id), range.fromUtc, range.toExclusiveUtc),
    readGrowthMeasurementCoverage(db, userId, Number(initialBinding.id))
  ]).then(result => {
    measurementQueryMs = performance.now() - measurementStartedAt;
    return result;
  });
  const historyStartedAt = performance.now();
  const historyPromise = getGrowthHistory(userId, passportHistoryRange(range), { includeMeasurements: false }).then(result => {
    recentHistoryMs = performance.now() - historyStartedAt;
    return result;
  });
  const [[measurements, measurementCoverage], history] = await Promise.all([measurementsPromise, historyPromise]);
  const finalBinding = await getCurrentBindingRow(userId);
  if (!finalBinding || String(finalBinding.id) !== profileId || history.profileId !== profileId) throw createError({ statusCode: 409, statusMessage: "profile-changed" });

  let composeTiming = { dailySamplingMs: 0, segmentBuildMs: 0, milestoneComposeMs: 0 };
  const recap = buildSkillPassport({ profileId, range, measurements, measurementCoverage, history, overview }, timing => { composeTiming = timing; });
  const serializedBytes = Buffer.byteLength(JSON.stringify(recap));
  console.info("[growth-passport] compose", {
    requestedDays: range.requestedDays,
    measurementQueryMs: Math.round(measurementQueryMs),
    recentHistoryMs: Math.round(recentHistoryMs),
    dailySamplingMs: Math.round(composeTiming.dailySamplingMs),
    segmentBuildMs: Math.round(composeTiming.segmentBuildMs),
    milestoneComposeMs: Math.round(composeTiming.milestoneComposeMs),
    overviewDurationMs: Math.round(overviewDurationMs),
    totalDurationMs: Math.round(performance.now() - startedAt),
    measurementRows: measurements.length,
    dailyPoints: recap.segments.reduce((sum, segment) => sum + segment.points.length, 0),
    segmentCount: recap.segments.length,
    recentFactCount: history.facts.length,
    milestoneCount: recap.milestones.length,
    responseBytes: serializedBytes,
    recentFactsState: recap.coverage.recentFactsState
  });
  return recap;
}
