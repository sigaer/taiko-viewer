import type { PlayerRatingIntelligence } from '../../types/recommendation-intelligence.ts';
import type { PlayerGrowthState, GrowthHistoryResponse, GrowthMeasurement } from '../../types/player-growth.ts';
import type { GoalEvaluationResponse } from '../../types/goal-evaluation.ts';

export const DECISION_VERSION = 'viewer-player-decision/1' as const;
export type Snapshot<T> = { profileId: string; observedAt: string; revision: string | null; value: T };
export type DecisionPreferences = {
  // Explicit, request-scoped intent. No click-derived ability or new preference store.
  preferredChartKeys: readonly string[];
  excludedChartKeys: readonly string[];
  focus: 'skill-match' | 'growth' | 'goal' | 'discovery' | 'breakthrough';
};
export function instant(value: string): number {
  const parts = typeof value === 'string' ? value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/) : null;
  if (!parts || Number(parts[2]) < 1 || Number(parts[2]) > 12 || Number(parts[3]) < 1
    || Number(parts[3]) > new Date(Date.UTC(Number(parts[1]), Number(parts[2]), 0)).getUTCDate()
    || Number(parts[4]) > 23 || Number(parts[5]) > 59 || Number(parts[6]) > 59
    || !Number.isFinite(Date.parse(value))) throw new Error('invalid-decision-time');
  return Date.parse(value);
}
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export type DecisionInput = {
  ownerId: string; profileId: string; asOf: string; recentFrom: string;
  catalogRevision: string; scoreRevision: string;
  rating?: Snapshot<PlayerRatingIntelligence>;
  growth?: Snapshot<PlayerGrowthState>;
  history?: Snapshot<GrowthHistoryResponse>;
  goals?: Snapshot<GoalEvaluationResponse>;
  preferences?: Snapshot<DecisionPreferences>;
};

/** Read-only projection. No service imports: some existing overview reads persist measurements. */
export function buildPlayerDecisionContext(input: DecisionInput) {
  const end = instant(input.asOf), start = instant(input.recentFrom);
  if (start > end || !input.ownerId || !input.profileId || !input.catalogRevision || !input.scoreRevision) throw new Error('invalid-decision-scope');
  const diagnostics: string[] = [];
  function accept<T>(name: string, source?: Snapshot<T>): T | null {
    if (!source) { diagnostics.push(`${name}:missing`); return null; }
    try {
      if (source.profileId !== input.profileId || instant(source.observedAt) > end) throw new Error();
    } catch { diagnostics.push(`${name}:identity-or-time`); return null; }
    return source.value;
  }
  const rating = accept('rating', input.rating);
  const growth = accept('growth', input.growth);
  const historyValue = accept('history', input.history);
  const history = historyValue?.profileId === input.profileId ? historyValue : null;
  if (history && (history.measurements.length > 10000 || history.facts.length > 100000)) throw new Error('context-size-limit');
  const goalValue = accept('goals', input.goals);
  const goals = goalValue?.profileId === input.profileId ? goalValue : null;
  if (historyValue && !history) diagnostics.push('history:payload-profile');
  if (goalValue && !goals) diagnostics.push('goals:payload-profile');
  const preferences = accept('preferences', input.preferences);
  const ratingValid = !!rating && rating.model === 'v1' && rating.aggregation === 'per-dimension-top20' && rating.topN === 20 && rating.duplicateHandling === 'preserve'
    && Number.isSafeInteger(rating.sampleCount) && rating.sampleCount >= 0
    && (rating.overallRating === null || finite(rating.overallRating) && rating.overallRating >= 0)
    && rating.dimensions.every(d => finite(d.value) && d.value >= 0) && new Set(rating.dimensions.map(d => d.key)).size === rating.dimensions.length;
  const currentRating = input.rating?.revision === input.scoreRevision && ratingValid ? rating : null;
  const currentGrowth = input.growth?.revision === input.scoreRevision ? growth : null;
  if (rating && !currentRating) diagnostics.push('rating:score-revision');
  if (growth && !currentGrowth) diagnostics.push('growth:score-revision');
  const growthConsistent = !currentRating || !currentGrowth || currentRating.overallRating === currentGrowth.overallRating
    && currentRating.dimensions.every(d => currentGrowth.skills.some(s => s.key === d.key && s.value === d.value));
  if (!growthConsistent) diagnostics.push('growth:rating-disagreement');
  function inWindow(value: string | null | undefined) {
    try { const t = instant(value!); return t >= start && t <= end; } catch { return false; }
  }
  const groups = new Map<string, GrowthMeasurement[]>();
  for (const m of history?.measurements || []) {
    if (m.ownerId !== input.ownerId || m.bindingId !== input.profileId || !inWindow(m.capturedAt)) { diagnostics.push('measurement:identity-or-time'); continue; }
    groups.set(m.id, [...(groups.get(m.id) || []), m]);
  }
  const measurements = [...groups.values()].flatMap(group => {
    if (group.some(m => JSON.stringify(m) !== JSON.stringify(group[0]))) { diagnostics.push('measurement:conflicting-id'); return []; }
    return [group[0]];
  }).sort((a, b) => instant(a.capturedAt) - instant(b.capturedAt) || a.id.localeCompare(b.id));
  const first = measurements[0], last = measurements.at(-1);
  // No mixing algorithm/model eras, even if the first and last happen to match.
  const comparable = !!first && !!last && instant(first.capturedAt) < instant(last.capturedAt)
    && !!first.modelRevision && measurements.every(m => m.availabilityState === 'ready'
      && m.measurementVersion === first.measurementVersion && m.algorithmVersion === first.algorithmVersion && m.modelRevision === first.modelRevision);
  const delta = comparable && finite(first.rating) && finite(last.rating) ? last.rating - first.rating : null;
  let historyWindowCovered = false;
  if (history) {
    try {
      // History ranges are inclusive Shanghai calendar days, not UTC instants.
      const from = instant(`${history.range.from}T00:00:00+08:00`);
      const toExclusive = instant(`${history.range.to}T00:00:00+08:00`) + 86400000;
      historyWindowCovered = from <= start && toExclusive > end;
    } catch { /* Unknown coverage remains explicit. */ }
    if (!historyWindowCovered) diagnostics.push('history:requested-window-not-covered');
  }
  const facts = (history?.facts || []).filter(f => {
    // Knowledge time, never a backdated event timestamp, controls replay inclusion.
    const knownAt = f.temporal.confirmedAt || f.temporal.observedAt;
    if (f.ownerId !== input.ownerId || f.bindingId !== input.profileId || !inWindow(knownAt)) return false;
    for (const t of [f.temporal.confirmedAt, f.temporal.observedAt, f.temporal.occurredAt]) {
      if (t) { try { if (instant(t) > end) return false; } catch { return false; } }
    }
    return true;
  });
  return {
    version: DECISION_VERSION, ownerId: input.ownerId, profileId: input.profileId,
    asOf: input.asOf, catalogRevision: input.catalogRevision, scoreRevision: input.scoreRevision,
    longTerm: { rating: currentRating, growthState: currentGrowth, growthConsistent, v2: null, v2Status: 'separate-model-not-supplied' as const },
    recent: { from: input.recentFrom, to: input.asOf, measurements, factKeys: [...new Set(facts.map(f => f.factKey))].sort(),
      factSemantics: 'recently-known-fact-references' as const,
      comparison: { comparable, ratingDelta: delta, measurementIds: comparable ? [first.id, last.id] : [],
        model: first ? { measurementVersion: first.measurementVersion, algorithmVersion: first.algorithmVersion, modelRevision: first.modelRevision } : null,
        currentModelCompatibility: 'unknown' as const, reason: comparable ? 'compatible-history' : 'insufficient-or-unverifiable-history' },
      performanceAvailability: 'observations-only' as const, sessionIdentifiability: 'not-inferred' as const },
    goals, preferences,
    confidence: { ratingSampleCount: currentRating?.sampleCount ?? 0,
      historyWindowCovered, originalCoverage: history?.coverage || null,
      measurementCoverage: historyWindowCovered ? history!.coverage.measurementState : 'unknown', scoreHistoryCoverage: historyWindowCovered ? history!.coverage.scoreHistoryState : 'unknown',
      observedAt: input.rating?.observedAt || null, diagnostics: [...new Set(diagnostics)] },
    sources: Object.fromEntries(['rating', 'growth', 'history', 'goals', 'preferences'].map(key => {
      const source = input[key as 'rating']; return [key, source ? { revision: source.revision, observedAt: source.observedAt } : null];
    }))
  };
}
export type PlayerDecisionContext = ReturnType<typeof buildPlayerDecisionContext>;
