import { recoveryFact as fact, recoveryInput, recoveryMeasurement as measurement } from './passportRecovery.ts';

export const finalPeriod = { from: '2026-07-11', to: '2026-10-08' };
export const fourAccuracyPoints = (independent = false) => ['2026-09-20', '2026-09-28', '2026-09-29', '2026-10-07'].map((day, i) => {
  const row = measurement(`four-${i}`, day, { modelRevision: independent ? `revision-${i}` : 'model-a' });
  row.dimensions.accuracy_power = [10.42, 10.42, 10.44, 10.48][i]!;
  return row;
});
export const finalFlood = () => [
  ...Array.from({ length: 8 }, (_, i) => fact(`tiny-pb-${i}`, 'score-pb', '2026-10-06', { songId: 300 + i, before: 950000, after: 950100 + i * 50, delta: 100 + i * 50 })),
  fact('early-fc', 'fc', '2026-07-15', { songId: 201, before: 0, after: 1, delta: 1 }),
  fact('early-df', 'df', '2026-08-10', { songId: 202, before: 1, after: 2, delta: 1 }),
  fact('rank', 'rank-upgrade', '2026-09-12', { songId: 203, before: 7, after: 8, delta: 1 }),
  fact('rank-pb', 'score-pb', '2026-09-12', { songId: 203, before: 1001000, after: 1005940, delta: 4940 }),
  fact('rank-ng', 'ng-reduced', '2026-09-12', { songId: 203, before: 1, after: 0, delta: -1 }),
  fact('large-pb', 'score-pb', '2026-09-13', { songId: 204, before: 965680, after: 1005060, delta: 39380 }),
  fact('goal', 'goal-completed', null, { songId: 205, goalId: 'goal', goalType: 'fc', before: 0, after: 1, delta: 1, temporal: { observedAt: '2026-08-11T04:00:00Z', attributedDay: null, precision: 'observation' } })
];
export const finalCases = () => ({
  flood: finalFlood(),
  sameDay: [fact('weak-early', 'score-pb', '2026-07-15', { before: 950000, after: 950001, delta: 1 }), ...(['fc', 'df', 'rank-upgrade'] as const).map((type, i) => fact(`strong-${type}`, type, '2026-10-06', { songId: 600 + i, before: type === 'rank-upgrade' ? 7 : type === 'df' ? 1 : 0, after: type === 'rank-upgrade' ? 8 : type === 'df' ? 2 : 1, delta: 1 }))],
  weak: Array.from({ length: 8 }, (_, i) => fact(`weak-${i}`, i % 2 ? 'combo-improved' : 'score-pb', '2026-10-06', { songId: 700 + i, before: i % 2 ? 500 : 950000, after: i % 2 ? 501 : 950001, delta: 1 })),
  ng: [[1,0], [21,5], [14,2], [5,4]].map(([before,after],i) => fact(`ng-${before}-${after}`, 'ng-reduced', '2026-10-06', { songId: 800 + i, before, after, delta: after! - before! })),
  calibration: [[700000,705000], [950000,955000], [965680,1005060], [950000,950001], [950000,951000]].map(([before,after],i) => fact(`calibration-${i}`, 'score-pb', '2026-10-06', { songId: 900 + i, before, after, delta: after! - before! })),
  mixed: [fact('mixed-pb', 'score-pb', '2026-10-06'), fact('mixed-fc', 'fc', '2026-10-06', { before: 0, after: 1, delta: 1 }), fact('mixed-ng', 'ng-reduced', '2026-10-06', { before: 5, after: 0, delta: -5 })],
  evidence: [fact('no-baseline', 'score-pb', '2026-10-06', { before: null }), fact('bad-rank', 'rank-upgrade', '2026-10-06', { songId: 101, before: 7, after: 99 }), fact('missing-rank-before', 'rank-upgrade', '2026-10-06', { songId: 102, before: null, after: 8 }), fact('no-evidence', 'fc', '2026-10-06', { songId: 103, before: 0, after: 1, evidence: { source: 'score-history', evidenceVersion: 0 } })]
});
export function finalBrowserInput(scenario: string) {
  const cases = finalCases();
  const rows = scenario === 'empty' || scenario === 'weak' ? [] : scenario === 'ceiling' ? Array.from({length:365}, (_,i) => measurement(`ceiling-${i}`, new Date(Date.UTC(2025,9,9+i)).toISOString().slice(0,10))) : fourAccuracyPoints(scenario === 'singletons');
  const facts = scenario === 'empty' ? [] : scenario === 'weak' ? cases.weak : scenario === 'ceiling' ? [...finalFlood(), ...Array.from({length:40},(_,i)=>fact(`ceiling-fc-${i}`,'fc',`2026-09-${String(10+i%20).padStart(2,'0')}`,{songId:1200+i,before:0,after:1,delta:1}))] : finalFlood();
  const input = recoveryInput(facts, rows);
  if (scenario === 'empty') input.history.coverage.scoreHistoryState = 'partial';
  if (scenario === 'unknown') input.history.coverage.scoreHistoryState = 'unknown';
  if (scenario === 'truncated') input.history.coverage.scoreHistoryState = 'truncated';
  return input;
}
