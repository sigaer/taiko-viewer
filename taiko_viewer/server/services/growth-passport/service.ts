import { PublicationUnavailableError } from "../../infrastructure/taiko-publication/client.ts";
import { withDomainScoreRead } from "../taiko-domain/publication.ts";
import { performance } from "node:perf_hooks";
import { createError } from "h3";
import { getAccountDb } from "../../utils/account-db.ts";
import { getCurrentBindingRow, getRuntimePaths } from "../../internal/account/shared.ts";
import { getPlayerGrowthOverview } from "../account/growth.ts";
import { getGrowthHistory } from "../growth-history/service.ts";
import { createGrowthScoreEvidenceRequest, loadGrowthScoreEvidence } from "../growth-history/evidence.ts";
import { readGrowthMeasurementCoverage, readDailyGrowthMeasurements } from "../growth-history/measurements.ts";
import { readDailyAbilityArchive, mergeDailyAbilityMeasurements } from "../growth-history/daily-archive.ts";
import { buildSkillPassport } from "./composer.ts";
import { passportHistoryRange, resolveSkillPassportRange, type SkillPassportRange } from "./range.ts";

export async function getSkillPassport(userId: number, range: SkillPassportRange, options: { shareScoreEvidence?: boolean } = {}) {
  const startedAt = performance.now();
  const initialBinding = await getCurrentBindingRow(userId);
  if (!initialBinding) throw createError({ statusCode: 400, statusMessage: "请先绑定鼓众 ID" });
  return withDomainScoreRead(initialBinding.taiko_id, async () => {
    const profileId = String(initialBinding.id);
    // Request-local reuse revalidates history files before the History read.
    const loadScoreEvidence = options.shareScoreEvidence !== false
      ? createGrowthScoreEvidenceRequest(initialBinding.taiko_id)
      : loadGrowthScoreEvidence;

    const overviewStartedAt = performance.now();
    const overview = await getPlayerGrowthOverview(userId, { loadScoreEvidence }).catch(error => {
      if (error instanceof PublicationUnavailableError) throw error;
      console.info("[growth-passport] current Growth unavailable", { error: error instanceof Error ? error.message : String(error) });
      return null;
    });
    const overviewDurationMs = performance.now() - overviewStartedAt;
    if (overview?.profileId && String(overview.profileId) !== profileId) throw createError({ statusCode: 409, statusMessage: "profile-changed" });

    const db = getAccountDb();
    const sharedRange = resolveSkillPassportRange({ range: 365 }, new Date(`${range.to}T12:00:00+08:00`));
    let measurementQueryMs = 0;
    let recentHistoryMs = 0;
    const measurementStartedAt = performance.now();
    const measurementsPromise = Promise.all([
      readDailyGrowthMeasurements(db, userId, Number(initialBinding.id), sharedRange.fromUtc, sharedRange.toExclusiveUtc),
      readGrowthMeasurementCoverage(db, userId, Number(initialBinding.id)),
      readDailyAbilityArchive(getRuntimePaths().userdataDir, initialBinding.taiko_id, userId, Number(initialBinding.id), sharedRange.from, sharedRange.to)
    ]).then(result => {
      measurementQueryMs = performance.now() - measurementStartedAt;
      return result;
    });
    const historyStartedAt = performance.now();
    const historyPromise = getGrowthHistory(userId, passportHistoryRange(range), { includeMeasurements: false, loadScoreEvidence }).then(result => {
      recentHistoryMs = performance.now() - historyStartedAt;
      return result;
    });
    const [[storedMeasurements, measurementCoverage, archivedMeasurements], history] = await Promise.all([measurementsPromise, historyPromise]);
    const finalBinding = await getCurrentBindingRow(userId);
    if (!finalBinding || String(finalBinding.id) !== profileId || history.profileId !== profileId) throw createError({ statusCode: 409, statusMessage: "profile-changed" });

    const measurements = mergeDailyAbilityMeasurements(storedMeasurements, archivedMeasurements, range.to);
    if (measurements.length) {
      const first = measurements[0]!.capturedAt, last = measurements.at(-1)!.capturedAt;
      if (!measurementCoverage.measurementFrom || first < measurementCoverage.measurementFrom) measurementCoverage.measurementFrom = first;
      if (!measurementCoverage.measurementTo || last > measurementCoverage.measurementTo) measurementCoverage.measurementTo = last;
      measurementCoverage.measurementDays += measurements.length - storedMeasurements.length;
    }
    let composeTiming = { dailySamplingMs: 0, segmentBuildMs: 0, milestoneComposeMs: 0 };
    const recap = buildSkillPassport({ profileId, range, measurements, measurementCoverage, history, overview }, timing => { composeTiming = timing; });
    const serializedBytes = Buffer.byteLength(JSON.stringify(recap));
    console.info("[growth-passport] compose", {
      userId,
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
  });

}

