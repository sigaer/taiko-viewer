import { instant } from './context.ts';

export const BENCHMARK_PROTOCOL = { version: 'viewer-offline/1', horizonMs: 7 * 86400000, repeatWindowMs: 14 * 86400000, minPlays: 2, requiredSuccessFraction: 1 } as const;
export type BenchmarkItem = { chartKey: string; songIdentity: string; targetScore: number | null; predictedScore: number | null;
  probability: number | null; actionable: boolean; genre: string | null };
export type BenchmarkDecision = {
  id: string; player: string; at: string; k: number; inputsComplete: boolean; exposureHistoryComplete: boolean;
  catalogRevision: string; scoreRevision: string; predictorVersion: string;
  features: { occurredAt: string; availableAt: string }[];
  activeGoalId: string | null; items: BenchmarkItem[];
};
export type PlayLabel = { id: string; player: string; chartKey: string; at: string; availableAt: string;
  kind: 'identifiable-play' | 'snapshot' | 'click'; score: number; evidenceRef: string };
export type GoalLabel = { player: string; goalId: string; at: string; availableAt: string;
  outcome: 'completed' | 'active' | 'inconclusive'; evidenceRef: string };
export type BenchmarkDataset = { kind: 'synthetic-harness' | 'temporal-labeled-cohort'; revision: string; freezeAt: string;
  decisions: BenchmarkDecision[]; plays: PlayLabel[]; goals: GoalLabel[];
  priorExposures?: { player: string; chartKey: string; at: string }[] };
function ratio(numerator: number, denominator: number, unknownCount = 0) {
  return { value: denominator ? numerator / denominator : null, numerator, denominator, unknownCount, status: denominator ? 'available' : 'unavailable' };
}
const validScore = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** Labels are separate from feature inputs. No DB, online requests or model fitting. */
export function evaluateRecommendations(data: BenchmarkDataset) {
  if (data.decisions.length > 10000 || data.plays.length > 100000 || data.goals.length > 10000 || (data.priorExposures?.length || 0) > 100000) throw new Error('benchmark-size-limit');
  const freeze = instant(data.freezeAt);
  const decisions = [...data.decisions].sort((a,b) => instant(a.at) - instant(b.at) || a.id.localeCompare(b.id));
  const ids = new Set<string>();
  const valid: BenchmarkDecision[] = [], exclusions: { id: string; reason: string }[] = [];
  for (const d of decisions) {
    if (ids.has(d.id)) throw new Error('duplicate-decision-id');
    ids.add(d.id);
    if (!Number.isInteger(d.k) || d.k < 1 || d.k > 50 || d.items.length > d.k || new Set(d.items.map(i => i.chartKey)).size !== d.items.length) throw new Error('invalid-slate');
    const time = instant(d.at);
    if (!d.catalogRevision || !d.scoreRevision || !d.predictorVersion || !d.features.length || d.features.some(f => instant(f.occurredAt) > time || instant(f.availableAt) > time)) { exclusions.push({ id: d.id, reason: 'feature-leakage-or-provenance' }); continue; }
    if (time + BENCHMARK_PROTOCOL.horizonMs > freeze) { exclusions.push({ id: d.id, reason: 'immature-window' }); continue; }
    if (d.items.some(i => (i.targetScore !== null && (!validScore(i.targetScore) || i.targetScore <= 0)) || (i.predictedScore !== null && !validScore(i.predictedScore))
      || (i.probability !== null && (!Number.isFinite(i.probability) || i.probability < 0 || i.probability > 1)))) throw new Error('invalid-prediction');
    valid.push(d);
  }
  const playIds = new Set<string>(), plays: PlayLabel[] = [];
  let excludedLabels = 0;
  for (const p of data.plays) {
    if (playIds.has(p.id)) throw new Error('duplicate-play-id');
    playIds.add(p.id);
    if (p.kind !== 'identifiable-play' || !p.evidenceRef || !validScore(p.score) || instant(p.availableAt) > freeze || instant(p.availableAt) < instant(p.at)) { excludedLabels++; continue; }
    plays.push(p);
  }
  plays.sort((a,b) => instant(a.at) - instant(b.at) || a.id.localeCompare(b.id));
  const key = (player: string, chart: string) => JSON.stringify([player, chart]);
  const indexedPlays = new Map<string, PlayLabel[]>(), indexedGoals = new Map<string, GoalLabel[]>(), indexedExposures = new Map<string, number[]>();
  for (const p of plays) { const k = key(p.player, p.chartKey); if (!indexedPlays.has(k)) indexedPlays.set(k, []); indexedPlays.get(k)!.push(p); }
  for (const g of data.goals) { const k = key(g.player, g.goalId); if (!indexedGoals.has(k)) indexedGoals.set(k, []); indexedGoals.get(k)!.push(g); }
  for (const e of data.priorExposures || []) { const k = key(e.player, e.chartKey); if (!indexedExposures.has(k)) indexedExposures.set(k, []); indexedExposures.get(k)!.push(instant(e.at)); }
  const usedPlays = new Set<string>(), goalsSeen = new Set<string>();
  let emitted = 0, requested = 0, reachable = 0, resolved = 0, actionable = 0, complete = 0;
  let absError = 0, squaredError = 0, bias = 0, scoreCount = 0;
  let brier = 0, probabilityCount = 0, distinctPairs = 0, pairs = 0, repeats = 0, repeatDenominator = 0;
  let goalCount = 0, goalResolved = 0, goalCompleted = 0, knownGenres = 0;
  const uniqueCharts = new Set<string>(), prior = new Map<string, number>();
  const bins = Array.from({ length: 5 }, (_, index) => ({ lower: index / 5, upper: (index + 1) / 5, count: 0, probabilitySum: 0, successSum: 0 }));
  for (const d of valid) {
    const at = instant(d.at), until = at + BENCHMARK_PROTOCOL.horizonMs;
    requested += d.k; emitted += d.items.length;
    if (d.inputsComplete) { complete++; if (d.items.some(i => i.actionable)) actionable++; }
    for (let x = 0; x < d.items.length; x++) {
      for (let y = x + 1; y < d.items.length; y++) { pairs++; if (d.items[x].songIdentity !== d.items[y].songIdentity) distinctPairs++; }
      const item = d.items[x]; uniqueCharts.add(item.chartKey); if (item.genre) knownGenres++;
      const exposureKey = key(d.player, item.chartKey);
      if (d.exposureHistoryComplete) {
        repeatDenominator++;
        let previous = prior.get(exposureKey) ?? -Infinity;
        for (const t of indexedExposures.get(exposureKey) || []) if (t < at && t > previous) previous = t;
        if (previous !== undefined && at - previous <= BENCHMARK_PROTOCOL.repeatWindowMs) repeats++;
      }
      prior.set(exposureKey, at);
      // Earliest eligible exposure owns a play; never count one play as independent repeated evidence.
      const labels: PlayLabel[] = [];
      for (const p of indexedPlays.get(exposureKey) || []) {
        if (instant(p.at) > until) break;
        if (!usedPlays.has(p.id) && instant(p.at) > at) labels.push(p);
        if (labels.length === BENCHMARK_PROTOCOL.minPlays) break;
      }
      labels.forEach(p => usedPlays.add(p.id));
      const first = labels[0];
      if (first && item.predictedScore !== null) {
        const error = item.predictedScore - first.score; absError += Math.abs(error); squaredError += error ** 2; bias += error; scoreCount++;
      }
      // Calibration target is first identifiable play, not repeated-stability probability.
      if (first && item.probability !== null && item.targetScore !== null) {
        const success = Number(first.score >= item.targetScore), p = item.probability;
        brier += (p - success) ** 2; probabilityCount++;
        const bin = bins[Math.min(4, Math.floor(p * 5))]; bin.count++; bin.probabilitySum += p; bin.successSum += success;
      }
      if (labels.length >= BENCHMARK_PROTOCOL.minPlays && item.targetScore !== null) {
        resolved++; if (labels.filter(p => p.score >= item.targetScore!).length / labels.length >= BENCHMARK_PROTOCOL.requiredSuccessFraction) reachable++;
      }
    }
    if (d.activeGoalId) {
      const goalKey = key(d.player, d.activeGoalId);
      if (!goalsSeen.has(goalKey)) {
        goalsSeen.add(goalKey); goalCount++;
        const labels = (indexedGoals.get(goalKey) || []).filter(g => g.evidenceRef
          && instant(g.at) > at && instant(g.at) <= until && instant(g.availableAt) >= instant(g.at) && instant(g.availableAt) <= freeze)
          .sort((a,b) => instant(a.at) - instant(b.at));
        const final = labels.find(g => g.outcome === 'completed') || labels.at(-1);
        if (final && (final.outcome === 'completed' || final.outcome === 'active' && instant(final.at) === until)) { goalResolved++; if (final.outcome === 'completed') goalCompleted++; }
      }
    }
  }
  return {
    protocol: BENCHMARK_PROTOCOL, datasetKind: data.kind, datasetRevision: data.revision, freezeAt: data.freezeAt,
    algorithmPromotion: 'not-authorized', decisions: { total: decisions.length, accepted: valid.length, excluded: exclusions }, excludedLabels,
    reachabilityPrecisionAtK: { conservativeLowerBound: ratio(reachable, emitted, emitted - resolved), conditional: ratio(reachable, resolved, emitted - resolved), labelCoverage: ratio(resolved, emitted), emitted, requested },
    actionableCoverage: ratio(actionable, complete, valid.length - complete), slotCoverage: ratio(emitted, requested),
    scorePredictionError: { mae: scoreCount ? absError / scoreCount : null, rmse: scoreCount ? Math.sqrt(squaredError / scoreCount) : null,
      bias: scoreCount ? bias / scoreCount : null, denominator: scoreCount, unknownCount: emitted - scoreCount },
    predictionCalibration: { brier: probabilityCount ? brier / probabilityCount : null, denominator: probabilityCount, unknownCount: emitted - probabilityCount,
      status: probabilityCount ? 'available' : 'unavailable', bins: bins.map(b => ({ lower: b.lower, upper: b.upper, count: b.count, meanProbability: b.count ? b.probabilitySum / b.count : null, observedRate: b.count ? b.successSum / b.count : null })) },
    recommendationDiversity: { distinctSongPairs: ratio(distinctPairs, pairs), uniqueChartRatio: ratio(uniqueCharts.size, emitted), genreCoverage: ratio(knownGenres, emitted) },
    repeatRate: ratio(repeats, repeatDenominator, emitted - repeatDenominator),
    goalProgression: { completed: goalCompleted, completionRate: ratio(goalCompleted, goalResolved, goalCount - goalResolved), observationCoverage: ratio(goalResolved, goalCount), causalClaim: false }
  };
}
