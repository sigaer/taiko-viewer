import { instant, type PlayerDecisionContext } from './context.ts';
import type { RatingDimensionKey } from '../../types/recommendation-intelligence.ts';
import { matchesActiveScorePbGoal } from './goal-target.ts';

export type ChartFeature = {
  key: string; songId: number; difficultyType: number; identityGroup: string;
  catalogRevision: string; sourceHash: string; availability: 'active' | 'removed' | 'unknown';
  region: 'CN' | 'JP'; genre: string | null; star: number | null;
  verifiedDimensions: readonly RatingDimensionKey[]; evidenceRefs: readonly string[];
};
export type ReachEvidence = {
  profileId: string; chartKey: string; scoreRevision: string; catalogRevision: string; sourceHash: string;
  generatedAt: string; modelVersion: string; featureCutoff: string;
  dataSufficiency: string; stableScore: number | null; pbScore: number | null;
  confidence: number; evidenceRefs: readonly string[];
};
export type MatchCandidate = {
  chart: ChartFeature; reach: ReachEvidence | null; targetScore: number;
  baselineRank: number; isUnplayed: boolean; goalId?: string; currentBestScore?: number | null;
};
export const MATCH_POLICY = { version: 'viewer-stable-match/1', minConfidence: 0.6, maxEvidenceAgeMs: 30 * 86400000, maxPerSong: 1 } as const;
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

/** Conservative candidate admission, not a new Rating or score predictor. */
export function assessReachability(context: PlayerDecisionContext, candidate: MatchCandidate, region: 'CN' | 'JP') {
  const { chart, reach } = candidate;
  const reasons: string[] = [];
  if (chart.key !== `${chart.songId}:${chart.difficultyType}` || !Number.isSafeInteger(chart.songId) || chart.songId <= 0 || ![1,2,3,4,5].includes(chart.difficultyType)) reasons.push('chart-identity');
  if (!chart.identityGroup || !/^[a-f0-9]{64}$/.test(chart.sourceHash) || !chart.evidenceRefs.length) reasons.push('chart-evidence');
  if (chart.availability !== 'active' || chart.region !== region) reasons.push('unavailable');
  if (chart.catalogRevision !== context.catalogRevision) reasons.push('catalog-revision');
  if (context.preferences?.excludedChartKeys.includes(chart.key)) reasons.push('user-excluded');
  if (!positive(candidate.targetScore) || !positive(candidate.baselineRank)) reasons.push('invalid-target-or-rank');
  if (context.preferences?.focus === 'breakthrough' && (!positive(candidate.currentBestScore) || candidate.targetScore <= candidate.currentBestScore)) reasons.push('breakthrough-target-unproven');
  if (!context.longTerm.rating || context.confidence.ratingSampleCount < 20) reasons.push('player-evidence');
  if (!reach) reasons.push('stable-evidence-missing');
  else {
    if (reach.profileId !== context.profileId || reach.chartKey !== chart.key || reach.scoreRevision !== context.scoreRevision
      || reach.catalogRevision !== context.catalogRevision || reach.sourceHash !== chart.sourceHash) reasons.push('reach-scope');
    if (!reach.modelVersion || !reach.evidenceRefs.length) reasons.push('reach-provenance');
    try {
      const asOf = instant(context.asOf), generated = instant(reach.generatedAt), cutoff = instant(reach.featureCutoff);
      if (cutoff > generated || generated > asOf || asOf - cutoff > MATCH_POLICY.maxEvidenceAgeMs) reasons.push('reach-time');
    } catch { reasons.push('reach-time'); }
    if (!Number.isFinite(reach.confidence) || reach.confidence < MATCH_POLICY.minConfidence || reach.confidence > 1) reasons.push('low-confidence');
    if (reach.dataSufficiency !== 'ok' || !positive(reach.stableScore)) reasons.push('stable-evidence-insufficient');
    else if (candidate.targetScore > reach.stableScore) reasons.push('beyond-stable-target');
  }
  return { eligible: reasons.length === 0, reasons };
}

export function matchCandidates(context: PlayerDecisionContext, candidates: readonly MatchCandidate[], options: { region: 'CN' | 'JP'; k: number; ranking?: 'existing-order' | 'contextual' }) {
  if (!Number.isInteger(options.k) || options.k < 1 || options.k > 50 || candidates.length > 5000) throw new Error('invalid-match-budget');
  const rejected: { key: string; reasons: string[] }[] = [];
  const eligible = candidates.filter(candidate => {
    const result = assessReachability(context, candidate, options.region);
    if (!result.eligible) rejected.push({ key: candidate.chart.key, reasons: result.reasons });
    return result.eligible;
  });
  const focus = context.preferences?.focus || 'skill-match';
  const active = context.goals?.outcome === 'active' ? context.goals.activeGoal : null;
  const goalMatch = (c: MatchCandidate) => !!active && active.id === c.goalId
    && matchesActiveScorePbGoal(active, context.profileId, { songId: c.chart.songId, difficultyType: c.chart.difficultyType, targetScore: c.targetScore });
  const preferred = (c: MatchCandidate) => context.preferences?.preferredChartKeys.includes(c.chart.key) ? 1 : 0;
  const growth = context.longTerm.growthState;
  const growthDimension = context.longTerm.growthConsistency === 'consistent' && growth?.dataSufficiency === 'ready'
    && growth.basis === 'lowest-valid-dimension' && growth.priorityDimension
    && context.longTerm.dimensionConsistency[growth.priorityDimension] === 'consistent' ? growth.priorityDimension : null;
  const focusMatch = (c: MatchCandidate) => focus === 'discovery' ? Number(c.isUnplayed)
    : focus === 'growth' ? Number(!!growthDimension && c.chart.verifiedDimensions.includes(growthDimension))
    : focus === 'goal' ? Number(goalMatch(c)) : 0;
  const contextual = options.ranking !== 'existing-order';
  eligible.sort((a,b) => (contextual ? Number(goalMatch(b)) - Number(goalMatch(a)) || preferred(b) - preferred(a) || focusMatch(b) - focusMatch(a) : 0)
    || a.baselineRank - b.baselineRank || a.chart.key.localeCompare(b.chart.key));
  const seen = new Set<string>();
  const items = eligible.filter(c => {
    if (seen.has(c.chart.identityGroup)) return false;
    seen.add(c.chart.identityGroup); return true;
  }).slice(0, options.k).map(c => ({ ...c,
    explanation: { policyVersion: MATCH_POLICY.version, reasonCodes: ['stable-target', ...(goalMatch(c) ? ['active-goal'] : []), ...(preferred(c) ? ['explicit-preference'] : []), ...(focusMatch(c) ? [focus] : [])],
      evidenceRefs: [...c.chart.evidenceRefs, ...c.reach!.evidenceRefs], limitations: ['no-music-or-pattern-analysis', 'confidence-is-not-success-probability'],
      stableScore: c.reach!.stableScore, targetScore: c.targetScore, confidence: c.reach!.confidence } }));
  return { policyVersion: MATCH_POLICY.version, profileId: context.profileId, scoreRevision: context.scoreRevision, catalogRevision: context.catalogRevision,
    asOf: context.asOf, region: options.region, requestedCount: options.k, eligibleCount: eligible.length, items, rejected,
    shortage: items.length < options.k, mode: focus, ranking: contextual ? 'contextual' : 'existing-order', replacementApproved: false as const };
}
export type MatchResult = ReturnType<typeof matchCandidates>;
