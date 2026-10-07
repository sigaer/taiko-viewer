import type {
  GrowthFact,
  GrowthFactType,
  GrowthHistoryResponse,
  GrowthMeasurement,
  GrowthMeasurementDimensions,
  PlayerGrowthOverview,
  SkillPassportFocusRun,
  SkillPassportMilestone,
  SkillPassportPoint,
  SkillPassportResponse,
  SkillPassportSegment,
  SkillPassportSegmentChange
} from "../../../types/player-growth.ts";
import { growthCalendarDay, GROWTH_DIMENSION_ORDER } from "../../../utils/playerGrowth.ts";
import { matchGoalFactToScoreFact } from "../growth-weekly/composer.ts";
import type { SkillPassportRange } from "./range.ts";

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const round = (value: number) => Number(value.toFixed(6));
const stableIdCompare = (left: string, right: string) => left.localeCompare(right, "en", { numeric: true });
const pointCompare = (left: GrowthMeasurement, right: GrowthMeasurement) => left.capturedAt.localeCompare(right.capturedAt) || stableIdCompare(left.id, right.id);
const segmentKey = (point: GrowthMeasurement) => `${point.measurementVersion}\u0000${point.algorithmVersion}\u0000${point.modelRevision || "__missing__"}`;
const scorePriority: Partial<Record<GrowthFactType, number>> = { df: 100, fc: 90, clear: 80, "rank-upgrade": 72, "score-pb": 64, "ng-reduced": 58, "combo-improved": 48 };
const crownRank: Partial<Record<GrowthFactType, number>> = { clear: 1, fc: 2, df: 3 };
const factTime = (fact: GrowthFact) => fact.temporal.occurredAt || fact.temporal.observedAt || fact.temporal.confirmedAt || "";
const chartDayKey = (fact: GrowthFact) => `${fact.temporal.attributedDay || "_"}:${fact.songId || 0}:${fact.difficultyType || 0}`;

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

type RankedMilestone = { milestone: SkillPassportMilestone; priority: number; magnitude: number; sortTime: string };
const milestoneDay = (milestone: SkillPassportMilestone) => milestone.day
  || (milestone.observedAt ? growthCalendarDay(new Date(milestone.observedAt)) : "");

const primaryScoreFact = (facts: GrowthFact[]) => {
  const crown = facts.filter(fact => crownRank[fact.type]).sort((left, right) => crownRank[right.type]! - crownRank[left.type]! || left.factKey.localeCompare(right.factKey))[0];
  return crown || [...facts].sort((left, right) => (scorePriority[right.type] || 0) - (scorePriority[left.type] || 0) || Math.abs(right.delta || 0) - Math.abs(left.delta || 0) || left.factKey.localeCompare(right.factKey))[0]!;
};

export function buildSkillPassportMilestones(facts: GrowthFact[]): SkillPassportMilestone[] {
  const deduplicated = [...new Map(facts.map(fact => [fact.factKey, fact])).values()];
  const scoreFacts = deduplicated.filter(fact => fact.evidence.source === "score-history" && fact.type !== "played" && fact.temporal.attributedDay && fact.songId && fact.difficultyType);
  const goalFacts = deduplicated.filter(fact => fact.type === "goal-completed");
  const grouped = new Map<string, GrowthFact[]>();
  for (const fact of scoreFacts) grouped.set(chartDayKey(fact), [...(grouped.get(chartDayKey(fact)) || []), fact]);
  const goalLinks = new Map<string, GrowthFact[]>();
  const observationGoals: GrowthFact[] = [];
  for (const goal of goalFacts) {
    const score = matchGoalFactToScoreFact(goal, scoreFacts);
    if (score) goalLinks.set(chartDayKey(score), [...(goalLinks.get(chartDayKey(score)) || []), goal]);
    else observationGoals.push(goal);
  }
  const ranked: RankedMilestone[] = [...grouped.entries()].map(([key, group]) => {
    const primary = primaryScoreFact(group);
    const goals = goalLinks.get(key) || [];
    const magnitude = Math.abs(primary.delta || 0);
    return {
      milestone: {
        id: `milestone:${key}:${primary.type}`,
        primaryType: primary.type as SkillPassportMilestone["primaryType"],
        factKeys: [...new Set([...group.map(fact => fact.factKey), ...goals.map(goal => goal.factKey)])].sort(),
        day: primary.temporal.attributedDay || null,
        observedAt: primary.temporal.observedAt || null,
        timeSemantics: "played",
        title: primary.title || `#${primary.songId}`,
        songId: primary.songId || null,
        difficultyType: primary.difficultyType || null,
        before: primary.before ?? null,
        after: primary.after ?? null,
        delta: primary.delta ?? null,
        goalCompleted: goals.length > 0,
        observationOnly: false
      },
      priority: (scorePriority[primary.type] || 0) + (goals.length ? 8 : 0),
      magnitude,
      sortTime: factTime(primary)
    };
  });
  for (const goal of observationGoals) ranked.push({
    milestone: {
      id: `milestone:goal:${goal.goalId || goal.factKey}`,
      primaryType: "goal-completed",
      factKeys: [goal.factKey],
      day: null,
      observedAt: goal.temporal.observedAt || goal.temporal.confirmedAt || null,
      timeSemantics: "observed",
      title: goal.title || `#${goal.songId || "goal"}`,
      songId: goal.songId || null,
      difficultyType: goal.difficultyType || null,
      before: goal.before ?? null,
      after: goal.after ?? null,
      delta: goal.delta ?? null,
      goalCompleted: true,
      observationOnly: true
    },
    priority: 76,
    magnitude: Math.abs(goal.delta || 0),
    sortTime: factTime(goal)
  });
  return ranked
    // A recent life log must admit new days before older, larger breakthroughs.
    // Significance still decides which same-day chart changes lead the story.
    .sort((left, right) => milestoneDay(right.milestone).localeCompare(milestoneDay(left.milestone))
      || right.priority - left.priority || right.magnitude - left.magnitude || right.sortTime.localeCompare(left.sortTime) || left.milestone.id.localeCompare(right.milestone.id))
    .slice(0, 8)
    .map(item => item.milestone);
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
  const segments = buildMeasurementSegments(points);
  const currentSegment = segments.at(-1) || null;
  const latest = points.at(-1) || null;
  const currentSegmentChange = buildCurrentSegmentChange(currentSegment);
  const focusTimeline = buildFocusTimeline(segments);
  const segmentBuildMs = performance.now() - segmentStartedAt;
  const milestoneStartedAt = performance.now();
  const milestones = buildSkillPassportMilestones(input.history.facts);
  const milestoneComposeMs = performance.now() - milestoneStartedAt;
  onTiming?.({ dailySamplingMs, segmentBuildMs, milestoneComposeMs });
  return {
    profileId: input.profileId,
    coverage: {
      ...input.measurementCoverage,
      recentFactsFrom: input.history.range.from,
      recentFactsTo: input.history.range.to,
      recentFactsState: input.history.coverage.scoreHistoryState
    },
    current: currentFromOverview(input.overview, latest),
    range: {
      requestedDays: input.range.requestedDays,
      actualFrom: points[0]?.day || null,
      actualTo: latest?.day || null,
      timezone: "Asia/Shanghai",
      selectedDimension: input.range.selectedDimension
    },
    segments,
    currentSegmentChange,
    focusTimeline,
    milestones,
    activeGoal: input.overview?.activeGoal || null,
    recentCompletedGoal: input.overview?.recentCompletedGoal || null,
    currentNextAction: input.overview ? { focus: currentFromOverview(input.overview, latest)!.focus, todayPlan: input.overview.todayPlan } : null
  };
}
