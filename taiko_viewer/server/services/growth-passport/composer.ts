import type {
  GrowthHistoryResponse,
  GrowthMeasurement,
  GrowthMeasurementDimensions,
  PlayerGrowthOverview,
  SkillPassportFocusRun,
  SkillPassportPoint,
  SkillPassportResponse,
  SkillPassportSegment,
  SkillPassportSegmentChange
} from "../../../types/player-growth.ts";
import { growthCalendarDay, GROWTH_DIMENSION_ORDER } from "../../../utils/playerGrowth.ts";
import { curateSkillPassportMilestones } from "./milestones.ts";
export { buildSkillPassportMilestones } from "./milestones.ts";
import { resolveSkillPassportRange, type SkillPassportRange } from "./range.ts";

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const round = (value: number) => Number(value.toFixed(6));
const stableIdCompare = (left: string, right: string) => left.localeCompare(right, "en", { numeric: true });
const pointCompare = (left: Pick<GrowthMeasurement, "capturedAt" | "id">, right: Pick<GrowthMeasurement, "capturedAt" | "id">) => left.capturedAt.localeCompare(right.capturedAt) || stableIdCompare(left.id, right.id);
const segmentKey = (point: Pick<GrowthMeasurement, "measurementVersion" | "algorithmVersion" | "modelRevision">) => `${point.measurementVersion}\u0000${point.algorithmVersion}\u0000${point.modelRevision || "__missing__"}`;
export function sampleDailyGrowthMeasurements(measurements: GrowthMeasurement[]): SkillPassportPoint[] {
  const representatives = new Map<string, GrowthMeasurement>();
  for (const measurement of [...measurements].sort(pointCompare)) {
    const day = growthCalendarDay(new Date(measurement.capturedAt));
    representatives.set(day, measurement);
  }
  return [...representatives.entries()]
    .map(([day, point]) => ({ ...point, day }))
    .sort((left, right) => left.day.localeCompare(right.day) || pointCompare(left, right));
}

export function buildMeasurementSegments(points: SkillPassportPoint[]): SkillPassportSegment[] {
  const segments: SkillPassportSegment[] = [];
  for (const point of points) {
    const latest = segments.at(-1);
    const key = segmentKey(point);
    const latestKey = latest?.points[0] ? segmentKey(latest.points[0]) : "";
    if (!latest || latestKey !== key) {
      segments.push({
        id: `segment-${segments.length + 1}`,
        measurementVersion: point.measurementVersion,
        algorithmVersion: point.algorithmVersion,
        modelRevision: point.modelRevision,
        from: point.day,
        to: point.day,
        points: [point]
      });
    } else {
      latest.points.push(point);
      latest.to = point.day;
    }
  }
  return segments;
}

export function buildCurrentSegmentChange(segment: SkillPassportSegment | null): SkillPassportSegmentChange {
  const start = segment?.points[0] || null;
  const end = segment?.points.at(-1) || null;
  const base = { start, end, compatible: false, ratingDelta: null, dimensionDeltas: null, primaryDimensionChange: null, focusFrom: start?.focus || null, focusTo: end?.focus || null };
  if (!start || !end || start.id === end.id) return { ...base, reason: "insufficient" };
  if (start.availabilityState !== "ready" || end.availabilityState !== "ready") return { ...base, reason: "limited" };
  const dimensionDeltas = Object.fromEntries(GROWTH_DIMENSION_ORDER.map(key => [key,
    finite(start.dimensions[key]) && finite(end.dimensions[key]) ? round(end.dimensions[key]! - start.dimensions[key]!) : null
  ])) as GrowthMeasurementDimensions;
  const primaryKey = GROWTH_DIMENSION_ORDER
    .filter(key => finite(dimensionDeltas[key]) && Math.abs(dimensionDeltas[key]!) > 1e-6)
    .sort((left, right) => Math.abs(dimensionDeltas[right]!) - Math.abs(dimensionDeltas[left]!) || GROWTH_DIMENSION_ORDER.indexOf(left) - GROWTH_DIMENSION_ORDER.indexOf(right))[0];
  return {
    ...base,
    compatible: true,
    reason: "compatible",
    ratingDelta: finite(start.rating) && finite(end.rating) && Math.abs(end.rating - start.rating) > 1e-6 ? round(end.rating - start.rating) : null,
    dimensionDeltas,
    primaryDimensionChange: primaryKey ? {
      key: primaryKey,
      before: start.dimensions[primaryKey]!,
      after: end.dimensions[primaryKey]!,
      delta: dimensionDeltas[primaryKey]!
    } : null
  };
}

export function buildFocusTimeline(segments: SkillPassportSegment[]): SkillPassportFocusRun[] {
  const runs: SkillPassportFocusRun[] = [];
  for (const segment of segments) {
    for (const point of segment.points) {
      const latest = runs.at(-1);
      if (latest && latest.segmentId === segment.id && latest.focus === point.focus) latest.endedAt = point.day;
      else runs.push({ id: `focus-${runs.length + 1}`, segmentId: segment.id, focus: point.focus, startedAt: point.day, endedAt: point.day, current: false });
    }
  }
  if (runs.length) runs[runs.length - 1]!.current = true;
  return runs;
}

const currentFromOverview = (overview: PlayerGrowthOverview | null, latest: SkillPassportPoint | null): SkillPassportResponse["current"] => {
  if (overview) {
    const dimensions = Object.fromEntries(GROWTH_DIMENSION_ORDER.map(key => [key, overview.playerState.skills.find(item => item.key === key)?.value ?? null])) as GrowthMeasurementDimensions;
    const focus = overview.playerState.dataSufficiency === "insufficient" ? "insufficient-data"
      : overview.playerState.dataSufficiency === "limited" ? "limited"
        : !overview.playerState.priorityDimension || overview.playerState.tiedDimensions.length === GROWTH_DIMENSION_ORDER.length ? "balanced"
          : overview.playerState.priorityDimension;
    return { rating: overview.playerState.overallRating, dimensions, focus, readiness: overview.playerState.dataSufficiency };
  }
  return latest ? { rating: latest.rating, dimensions: latest.dimensions, focus: latest.focus, readiness: latest.availabilityState } : null;
};

export function buildSkillPassport(input: {
  profileId: string;
  range: SkillPassportRange;
  measurements: GrowthMeasurement[];
  measurementCoverage: { measurementFrom: string | null; measurementTo: string | null; measurementDays: number };
  history: GrowthHistoryResponse;
  overview: PlayerGrowthOverview | null;
}, onTiming?: (timing: { dailySamplingMs: number; segmentBuildMs: number; milestoneComposeMs: number }) => void): SkillPassportResponse {
  const dailyStartedAt = performance.now();
  const points = sampleDailyGrowthMeasurements(input.measurements);
  const dailySamplingMs = performance.now() - dailyStartedAt;
  const segmentStartedAt = performance.now();
  const sharedSegments = buildMeasurementSegments(points);
  const ranges = [30, 90, 180, 365] as const;
  const selectedPoints = (from: string, to: string) => points.filter(point => point.day >= from && point.day <= to);
  const periodSegments = (from: string, to: string) => sharedSegments.flatMap(segment => {
    const rows = segment.points.filter(point => point.day >= from && point.day <= to);
    return rows.length ? [{ ...segment, from: rows[0]!.day, to: rows.at(-1)!.day, points: rows }] : [];
  });
  const windows = ranges.map(days => resolveSkillPassportRange({ range: days, dimension: input.range.selectedDimension }, new Date(`${input.range.to}T12:00:00+08:00`)));
  let segmentBuildMs = performance.now() - segmentStartedAt;
  const milestoneStartedAt = performance.now();
  const curation30 = curateSkillPassportMilestones(input.history.facts, { from: windows[0]!.from, to: input.range.to });
  const curation90 = curateSkillPassportMilestones(input.history.facts, { from: input.range.recentFrom, to: input.range.to });
  const milestoneComposeMs = performance.now() - milestoneStartedAt;
  const viewsStartedAt = performance.now();
  const views = Object.fromEntries(windows.map(window => {
    const rows = selectedPoints(window.from, window.to);
    const segments = periodSegments(window.from, window.to);
    const curated = window.requestedDays === 30 ? curation30 : curation90;
    return [window.requestedDays, {
      range: { requestedDays: window.requestedDays, from: window.from, to: window.to, actualFrom: rows[0]?.day || null, actualTo: rows.at(-1)?.day || null,
        measurementDays: rows.length, factDays: window.requestedDays === 30 ? 30 : 90, timezone: 'Asia/Shanghai', selectedDimension: window.selectedDimension },
      recentFactsFrom: window.requestedDays === 30 ? window.from : window.recentFrom,
      recentFactsTo: window.to,
      pointIds: rows.map(point => point.id), milestoneIds: curated.milestones.map(node => node.id), initialMilestoneIds: curated.initialIds,
      currentSegmentChange: buildCurrentSegmentChange(segments.at(-1) || null), focusTimeline: buildFocusTimeline(segments)
    }];
  })) as NonNullable<SkillPassportResponse['shared']>['views'];
  segmentBuildMs += performance.now() - viewsStartedAt;
  const view = views[input.range.requestedDays];
  const milestones = input.range.requestedDays === 30 ? curation30.milestones : curation90.milestones;
  onTiming?.({ dailySamplingMs, segmentBuildMs, milestoneComposeMs });
  return {
    profileId: input.profileId,
    coverage: { ...input.measurementCoverage, recentFactsFrom: view.recentFactsFrom, recentFactsTo: view.recentFactsTo, recentFactsState: input.history.coverage.scoreHistoryState },
    current: currentFromOverview(input.overview, points.at(-1) || null),
    range: view.range, segments: periodSegments(input.range.from, input.range.to),
    currentSegmentChange: view.currentSegmentChange, focusTimeline: view.focusTimeline, milestones, initialMilestoneIds: view.initialMilestoneIds,
    shared: { segments: sharedSegments, milestones: [...new Map([...curation30.milestones, ...curation90.milestones].map(node => [node.id, node])).values()], views },
    activeGoal: input.overview?.activeGoal || null,
    recentCompletedGoal: input.overview?.recentCompletedGoal || null,
    currentNextAction: input.overview ? { focus: currentFromOverview(input.overview, points.at(-1) || null)!.focus, todayPlan: input.overview.todayPlan } : null
  };
}
