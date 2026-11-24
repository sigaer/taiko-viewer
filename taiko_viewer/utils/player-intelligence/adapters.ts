import type { RecommendationToolPayload } from '../../types/recommendation-tool.ts';
import type { PlayerDecisionContext } from './context.ts';
import { instant } from './context.ts';
import type { ChartFeature, MatchCandidate } from './matching.ts';
import { matchesActiveScorePbGoal } from './goal-target.ts';

/** Existing core ChartScoreEstimate wire fields, projected without changing its calculation. */
export type ExistingScoreEstimate = {
  song_id: number; level: number; current_score: number | null; reliability: number; data_sufficiency: string;
  stable: { score: number } | null; pb: { score: number } | null;
};
export type EstimateSnapshot = {
  profileId: string; scoreRevision: string; catalogRevision: string; sourceHash: string;
  generatedAt: string; featureCutoff: string; modelVersion: string; evidenceRefs: string[];
  estimate: ExistingScoreEstimate;
};

/** Offline seam for existing ordinary order plus independently produced stable estimates. */
export function adaptExistingCandidates(context: PlayerDecisionContext, ordinary: RecommendationToolPayload,
  charts: readonly ChartFeature[], estimates: readonly EstimateSnapshot[], targets: ReadonlyMap<string, number>): MatchCandidate[] {
  if (ordinary.profileId !== context.profileId || ordinary.scoreRevision !== context.scoreRevision || instant(ordinary.generatedAt) > instant(context.asOf)) throw new Error('ordinary-scope');
  if (ordinary.items.length > 50 || charts.length > 5000 || estimates.length > 5000) throw new Error('adapter-size-limit');
  const chartMap = new Map(charts.map(c => [c.key, c]));
  const estimateMap = new Map(estimates.map(e => [`${e.estimate.song_id}:${e.estimate.level}`, e]));
  if (chartMap.size !== charts.length || estimateMap.size !== estimates.length) throw new Error('ambiguous-chart-or-estimate');
  return ordinary.items.flatMap((row, index) => {
    const key = `${row.songId}:${row.level}`, chart = chartMap.get(key), target = targets.get(key);
    if (!chart || target === undefined) return [];
    const source = estimateMap.get(key), estimate = source?.estimate;
    const active = context.goals?.outcome === 'active' ? context.goals.activeGoal : null;
    return [{ chart, targetScore: target, baselineRank: index + 1, isUnplayed: row.isUnplayed,
      goalId: matchesActiveScorePbGoal(active, context.profileId, { songId: row.songId, difficultyType: row.level, targetScore: target }) ? active!.id : undefined,
      currentBestScore: estimate?.current_score ?? null,
      reach: source && estimate ? { profileId: source.profileId, chartKey: key, scoreRevision: source.scoreRevision,
        catalogRevision: source.catalogRevision, sourceHash: source.sourceHash, generatedAt: source.generatedAt, featureCutoff: source.featureCutoff,
        modelVersion: source.modelVersion, evidenceRefs: source.evidenceRefs,
        // Core reliability is 0..100; confidence remains evidence quality, never success probability.
        confidence: estimate.reliability / 100, dataSufficiency: estimate.data_sufficiency,
        stableScore: estimate.stable?.score ?? null, pbScore: estimate.pb?.score ?? null } : null }];
  });
}
