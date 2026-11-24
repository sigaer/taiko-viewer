import type { DecisionInput } from '../../utils/player-intelligence/context.ts';
import type { MatchCandidate } from '../../utils/player-intelligence/matching.ts';
import type { BenchmarkDataset } from '../../utils/player-intelligence/benchmark.ts';
export const at = '2026-11-10T00:00:00Z';
export function decisionInput(): DecisionInput {
  return { ownerId: 'u', profileId: 'p', asOf: at, recentFrom: '2026-11-01T00:00:00Z', catalogRevision: 'catalog-1', scoreRevision: 'score-1',
    rating: { profileId: 'p', observedAt: at, revision: 'score-1', value: { model: 'v1', aggregation: 'per-dimension-top20', topN: 20, duplicateHandling: 'preserve', overallRating: 10, sampleCount: 20, dimensions: [], current: 10, scoreCount: 20 } },
    goals: { profileId: 'p', observedAt: at, revision: 'goal-1', value: { profileId: 'p', outcome: 'no-active-goal', activeGoal: null, recentCompletedGoal: null } } };
}
export function candidate(songId = 1): MatchCandidate {
  return { chart: { key: `${songId}:4`, songId, difficultyType: 4, identityGroup: `song-${songId}`, catalogRevision: 'catalog-1', sourceHash: 'a'.repeat(64), availability: 'active', region: 'CN', genre: 'test', star: 8, verifiedDimensions: [], evidenceRefs: ['catalog:1'] },
    reach: { profileId: 'p', chartKey: `${songId}:4`, scoreRevision: 'score-1', catalogRevision: 'catalog-1', sourceHash: 'a'.repeat(64), generatedAt: at, featureCutoff: at, modelVersion: 'synthetic-frozen', dataSufficiency: 'ok', stableScore: 100, pbScore: 120, confidence: 0.8, evidenceRefs: ['fixture:stable'] },
    targetScore: 100, baselineRank: songId, isUnplayed: true };
}
export function benchmarkFixture(): BenchmarkDataset {
  const item = (chartKey: string, predictedScore: number) => ({ chartKey, songIdentity: chartKey, targetScore: predictedScore, predictedScore, probability: null, actionable: true, genre: null });
  const decisions = [
    { id: 'd1', player: 'synthetic', at: '2026-11-01T00:00:00Z', k: 2, inputsComplete: true, exposureHistoryComplete: true, catalogRevision: 'c1', scoreRevision: 's1', predictorVersion: 'synthetic', features: [{ occurredAt: '2026-10-31T00:00:00Z', availableAt: '2026-10-31T00:00:00Z' }], activeGoalId: 'g1', items: [item('A', 100), item('B', 200)] },
    { id: 'd2', player: 'synthetic', at: '2026-11-09T00:00:00Z', k: 2, inputsComplete: true, exposureHistoryComplete: true, catalogRevision: 'c1', scoreRevision: 's2', predictorVersion: 'synthetic', features: [{ occurredAt: '2026-11-08T00:00:00Z', availableAt: '2026-11-08T00:00:00Z' }], activeGoalId: 'g2', items: [item('A', 100), item('C', 300)] }
  ];
  return { kind: 'synthetic-harness', revision: 'metric-oracle/1', freezeAt: '2026-11-20T00:00:00Z', decisions,
    plays: [
      ...['A', 'B'].flatMap((chartKey) => [1,2].map(n => ({ id: `${chartKey}${n}`, player: 'synthetic', chartKey, at: `2026-11-0${n + 1}T00:00:00Z`, availableAt: `2026-11-0${n + 1}T00:00:00Z`, kind: 'identifiable-play' as const, score: chartKey === 'A' ? 110 : 180, evidenceRef: 'synthetic:identifiable' }))),
      { id: 'click', player: 'synthetic', chartKey: 'C', at: '2026-11-10T00:00:00Z', availableAt: '2026-11-10T00:00:00Z', kind: 'click', score: 500, evidenceRef: 'click' },
      { id: 'pb', player: 'synthetic', chartKey: 'C', at: '2026-11-11T00:00:00Z', availableAt: '2026-11-11T00:00:00Z', kind: 'snapshot', score: 500, evidenceRef: 'pb' }
    ], goals: [{ player: 'synthetic', goalId: 'g1', at: '2026-11-04T00:00:00Z', availableAt: '2026-11-04T00:00:00Z', outcome: 'completed', evidenceRef: 'synthetic:goal-evaluation' }] };
}
