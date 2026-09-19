import type {
  GrowthFact,
  GrowthFactType,
  GrowthHistoryResponse,
  GrowthMeasurement,
  GrowthMeasurementDimensions,
  WeeklyGrowthHighlight,
  WeeklyGrowthResponse,
  WeeklyGrowthTheme,
  WeeklyGrowthThemeType,
  WeeklyMeasurementChange
} from "../../../types/player-growth.ts";
import { GROWTH_DIMENSION_ORDER } from "../../../utils/playerGrowth.ts";

type GoalAttribution = { goal: GrowthFact; score: GrowthFact | null };
const crownRank: Partial<Record<GrowthFactType, number>> = { clear: 1, fc: 2, df: 3 };
const highlightPriority: Partial<Record<GrowthFactType, number>> = { df: 100, fc: 90, clear: 80, "rank-upgrade": 70, "score-pb": 60, "ng-reduced": 50, "combo-improved": 40, played: 1 };
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const round = (value: number) => Number(value.toFixed(6));
const chartKey = (fact: GrowthFact) => `${fact.songId || 0}:${fact.difficultyType || 0}`;
const deduplicateFacts = (facts: GrowthFact[]) => [...new Map(facts.map(fact => [fact.factKey, fact])).values()];
const compatibleGoalTypes: Record<string, GrowthFactType[]> = {
  played: ["played"],
  "score-pb": ["score-pb"],
  "ng-reduced": ["ng-reduced"],
  clear: ["clear", "fc", "df"],
  fc: ["fc", "df"],
  df: ["df"],
  "rank-upgrade": ["rank-upgrade"]
};

export function matchGoalFactToScoreFact(goal: GrowthFact, scoreFacts: GrowthFact[]): GrowthFact | null {
  if (goal.type !== "goal-completed" || !goal.goalType) return null;
  const allowed = compatibleGoalTypes[goal.goalType] || [];
  const candidates = scoreFacts.filter(score => score.evidence.source === "score-history"
    && score.bindingId === goal.bindingId
    && score.songId === goal.songId
    && score.difficultyType === goal.difficultyType
    && allowed.includes(score.type));
  return candidates.find(score => score.evidence.sourceRevision === goal.evidence.sourceRevision)
    || candidates.find(score => score.before === goal.before && score.after === goal.after)
    || null;
}

export function attributeWeeklyGoals(facts: GrowthFact[], from: string, to: string): GoalAttribution[] {
  const scoreFacts = facts.filter(fact => fact.evidence.source === "score-history" && Boolean(fact.temporal.attributedDay) && fact.temporal.attributedDay! >= from && fact.temporal.attributedDay! <= to);
  return facts.filter(fact => fact.type === "goal-completed").flatMap(goal => {
    if (goal.temporal.attributedDay && goal.temporal.attributedDay >= from && goal.temporal.attributedDay <= to) return [{ goal, score: null }];
    const score = matchGoalFactToScoreFact(goal, scoreFacts);
    return score ? [{ goal, score }] : [];
  });
}

export function buildWeeklyMeasurementChange(measurements: GrowthMeasurement[]): WeeklyMeasurementChange {
  const ordered = [...measurements].sort((left, right) => left.capturedAt.localeCompare(right.capturedAt) || left.id.localeCompare(right.id));
  const start = ordered[0] || null;
  const end = ordered.at(-1) || null;
  const base = { start, end, compatible: false, ratingDelta: null, dimensionDeltas: null, primaryDimension: null, focusFrom: start?.focus || null, focusTo: end?.focus || null };
  if (!start || !end || start.id === end.id) return { ...base, reason: "insufficient" };
  if (start.availabilityState !== "ready" || end.availabilityState !== "ready") return { ...base, reason: "limited" };
  if (start.measurementVersion !== end.measurementVersion) return { ...base, reason: "measurement-version-mismatch" };
  if (start.algorithmVersion !== end.algorithmVersion) return { ...base, reason: "algorithm-mismatch" };
  if (!start.modelRevision || !end.modelRevision || start.modelRevision !== end.modelRevision) return { ...base, reason: "model-mismatch" };
  const dimensions = Object.fromEntries(GROWTH_DIMENSION_ORDER.map(key => [key,
    finite(start.dimensions[key]) && finite(end.dimensions[key]) ? round(end.dimensions[key]! - start.dimensions[key]!) : null
  ])) as GrowthMeasurementDimensions;
  const primaryKey = GROWTH_DIMENSION_ORDER
    .filter(key => finite(dimensions[key]) && Math.abs(dimensions[key]!) > 1e-6)
    .sort((left, right) => Math.abs(dimensions[right]!) - Math.abs(dimensions[left]!) || GROWTH_DIMENSION_ORDER.indexOf(left) - GROWTH_DIMENSION_ORDER.indexOf(right))[0];
  return {
    ...base,
    compatible: true,
    reason: "compatible",
    ratingDelta: finite(start.rating) && finite(end.rating) && Math.abs(end.rating - start.rating) > 1e-6 ? round(end.rating - start.rating) : null,
    dimensionDeltas: dimensions,
    primaryDimension: primaryKey ? {
      key: primaryKey,
      before: start.dimensions[primaryKey]!,
      after: end.dimensions[primaryKey]!,
      delta: dimensions[primaryKey]!
    } : null
  };
}

const themeEvidenceTypes: Partial<Record<WeeklyGrowthThemeType, GrowthFactType[]>> = {
  stability: ["ng-reduced"],
  "score-breakthrough": ["score-pb"],
  "new-crown": ["clear", "fc", "df"],
  "rank-breakthrough": ["rank-upgrade"],
  "goal-follow-through": ["goal-completed"],
  "mixed-growth": ["score-pb", "ng-reduced", "clear", "fc", "df", "rank-upgrade", "goal-completed"],
  "broad-activity": ["played"]
};

function chooseTheme(scoreFacts: GrowthFact[], attributedGoals: GoalAttribution[], coverage: GrowthHistoryResponse["coverage"], measurement: WeeklyMeasurementChange, distinctCharts: number): WeeklyGrowthTheme {
  const measurementIds = measurement.compatible && measurement.start && measurement.end ? [measurement.start.id, measurement.end.id] : [];
  const progressFacts = scoreFacts.filter(fact => fact.type !== "played");
  const evidenceFacts = [...progressFacts, ...attributedGoals.map(item => item.goal)];
  if (!evidenceFacts.length) {
    if (coverage.scoreHistoryState !== "complete") return { type: "limited-coverage", evidenceFactKeys: [], evidenceMeasurementIds: measurementIds, confidence: "low" };
    if (!distinctCharts) return { type: "no-play", evidenceFactKeys: [], evidenceMeasurementIds: measurementIds, confidence: "high" };
    if (measurement.compatible && measurement.focusFrom !== measurement.focusTo) return { type: "focus-change", evidenceFactKeys: [], evidenceMeasurementIds: measurementIds, confidence: "medium" };
    if (measurement.end?.focus === "balanced") return { type: "balanced", evidenceFactKeys: [], evidenceMeasurementIds: measurementIds, confidence: "medium" };
    return { type: distinctCharts >= 3 ? "broad-activity" : "quiet", evidenceFactKeys: scoreFacts.map(fact => fact.factKey), evidenceMeasurementIds: measurementIds, confidence: "medium" };
  }
  const byType = (types: GrowthFactType[]) => evidenceFacts.filter(fact => types.includes(fact.type));
  const ng = byType(["ng-reduced"]);
  const pb = byType(["score-pb"]);
  const crowns = byType(["clear", "fc", "df"]);
  const ranks = byType(["rank-upgrade"]);
  const goals = attributedGoals.map(item => item.goal);
  const categoryCounts = [ng.length, pb.length, crowns.length, ranks.length, goals.length].filter(Boolean);
  const candidates: Array<{ type: WeeklyGrowthThemeType; score: number; evidence: GrowthFact[] }> = [
    { type: "stability", score: ng.length * 42 + ng.reduce((sum, fact) => sum + Math.min(24, Math.abs(fact.delta || 0)), 0), evidence: ng },
    { type: "score-breakthrough", score: pb.length * 38 + (pb.length ? 22 : 0), evidence: pb },
    { type: "new-crown", score: crowns.reduce((sum, fact) => sum + (fact.type === "df" ? 100 : fact.type === "fc" ? 72 : 48), 0), evidence: crowns },
    { type: "rank-breakthrough", score: ranks.length * 64, evidence: ranks },
    { type: "goal-follow-through", score: goals.length * 78, evidence: goals }
  ].filter(candidate => candidate.evidence.length);
  if (categoryCounts.length >= 3 && Math.max(...categoryCounts) / evidenceFacts.length < 0.5) candidates.push({ type: "mixed-growth", score: 58 + evidenceFacts.length * 10, evidence: evidenceFacts });
  if (measurement.compatible && Number(measurement.dimensionDeltas?.accuracy_power || 0) > 0 && ng.length) candidates.find(item => item.type === "stability")!.score += 18;
  candidates.sort((left, right) => right.score - left.score || left.type.localeCompare(right.type));
  const selected = candidates[0]!;
  return {
    type: selected.type,
    evidenceFactKeys: selected.evidence.map(fact => fact.factKey).sort(),
    evidenceMeasurementIds: measurementIds,
    confidence: coverage.scoreHistoryState !== "complete" ? "low" : selected.evidence.length >= 2 || measurementIds.length ? "high" : "medium"
  };
}

function buildHighlights(scoreFacts: GrowthFact[], attributions: GoalAttribution[], theme: WeeklyGrowthTheme): WeeklyGrowthHighlight[] {
  const groups = new Map<string, GrowthFact[]>();
  for (const fact of scoreFacts) {
    if (!fact.songId || !fact.difficultyType) continue;
    groups.set(chartKey(fact), [...(groups.get(chartKey(fact)) || []), fact]);
  }
  const linkedGoals = new Map<string, GrowthFact[]>();
  for (const attribution of attributions) {
    if (!attribution.score) continue;
    linkedGoals.set(chartKey(attribution.score), [...(linkedGoals.get(chartKey(attribution.score)) || []), attribution.goal]);
  }
  const themeTypes = new Set(themeEvidenceTypes[theme.type] || []);
  return [...groups.entries()].map(([key, facts]) => {
    const crown = facts.filter(fact => crownRank[fact.type]).sort((left, right) => crownRank[right.type]! - crownRank[left.type]!)[0];
    const primary = crown || [...facts].sort((left, right) => {
      const themed = Number(themeTypes.has(left.type)) - Number(themeTypes.has(right.type));
      return -themed * 1000 + (highlightPriority[right.type] || 0) - (highlightPriority[left.type] || 0) || Math.abs(right.delta || 0) - Math.abs(left.delta || 0) || left.factKey.localeCompare(right.factKey);
    })[0]!;
    const goals = linkedGoals.get(key) || [];
    const factKeys = [...new Set([...facts.map(fact => fact.factKey), ...goals.map(goal => goal.factKey)])].sort();
    const themeBoost = facts.some(fact => theme.evidenceFactKeys.includes(fact.factKey)) ? 1000 : 0;
    const magnitude = primary.type === "ng-reduced" ? Math.abs(primary.delta || 0) : Math.max(0, primary.delta || 0);
    return {
      highlight: {
        id: `weekly:${key}:${primary.type}`,
        primaryType: primary.type as WeeklyGrowthHighlight["primaryType"],
        factKeys,
        songId: primary.songId!,
        difficultyType: primary.difficultyType!,
        title: primary.title || `#${primary.songId}`,
        before: primary.before ?? null,
        after: primary.after ?? null,
        delta: primary.delta ?? null,
        goalCompleted: goals.length > 0
      },
      score: themeBoost + (highlightPriority[primary.type] || 0) * 10 + magnitude
    };
  }).sort((left, right) => right.score - left.score || left.highlight.id.localeCompare(right.highlight.id)).slice(0, 4).map(item => item.highlight);
}

export function buildWeeklyGrowthRecap(history: GrowthHistoryResponse, week: { from: string; to: string; isCompleteWeek: boolean }, currentNextAction: WeeklyGrowthResponse["currentNextAction"]): WeeklyGrowthResponse {
  const facts = deduplicateFacts(history.facts);
  const scoreFacts = facts.filter(fact => fact.evidence.source === "score-history" && Boolean(fact.temporal.attributedDay) && fact.temporal.attributedDay! >= week.from && fact.temporal.attributedDay! <= week.to);
  const attributions = attributeWeeklyGoals(facts, week.from, week.to);
  const distinctCharts = new Set(scoreFacts.filter(fact => fact.songId && fact.difficultyType).map(chartKey)).size;
  const measurementChange = buildWeeklyMeasurementChange(history.measurements);
  const theme = chooseTheme(scoreFacts, attributions, history.coverage, measurementChange, distinctCharts);
  return {
    profileId: history.profileId,
    week: { ...week, timezone: "Asia/Shanghai" },
    coverage: history.coverage,
    theme,
    highlights: buildHighlights(scoreFacts, attributions, theme),
    measurementChange,
    totals: {
      distinctCharts,
      pb: scoreFacts.filter(fact => fact.type === "score-pb").length,
      fc: scoreFacts.filter(fact => fact.type === "fc").length,
      df: scoreFacts.filter(fact => fact.type === "df").length,
      rankUpgrade: scoreFacts.filter(fact => fact.type === "rank-upgrade").length,
      completedGoals: attributions.length
    },
    currentNextAction
  };
}
