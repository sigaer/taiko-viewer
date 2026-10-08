import type { GrowthFact, GrowthHistoryResponse, GrowthMeasurement } from '../../types/player-growth.ts';
import { resolveSkillPassportRange } from '../../server/services/growth-passport/range.ts';

export const recoveryNow = new Date('2026-10-08T04:00:00Z');
export const recoveryDimensions = (value = 10) => ({ big_song: value, stamina: value, speed: value, accuracy_power: value - .4, rhythm: value, complex: value });
export const recoveryFact = (key: string, type: GrowthFact['type'], day: string | null, overrides: Partial<GrowthFact> = {}): GrowthFact => ({
  id: key, factKey: key, ownerId: '7', bindingId: '2', type, title: `Song ${key}`, songId: 100, difficultyType: 4,
  before: 900000, after: 910000, delta: 10000,
  evidence: { source: type === 'goal-completed' ? 'goal' : 'score-history', sourceRevision: key, evidenceVersion: 1 },
  temporal: { attributedDay: day, occurredAt: null, observedAt: `${day || '2026-08-10'}T04:00:00Z`, precision: day ? 'day' : 'observation' },
  ...overrides
});
export function recoveryFlood() {
  return [
    recoveryFact('july-fc', 'fc', '2026-07-15', { songId: 201, before: 0, after: 1, delta: 1 }),
    recoveryFact('august-ng', 'ng-reduced', '2026-08-10', { songId: 202, before: 8, after: 4, delta: -4 }),
    recoveryFact('august-goal', 'goal-completed', null, { songId: 202, goalId: 'g1', goalType: 'ng-reduced', before: 8, after: 4, delta: -4, evidence: { source: 'goal', sourceRevision: 'august-ng', evidenceVersion: 1 } }),
    recoveryFact('september-rank', 'rank-upgrade', '2026-09-12', { songId: 203, before: 4, after: 5, delta: 1 }),
    recoveryFact('september-ng', 'ng-reduced', '2026-09-12', { songId: 203, before: 3, after: 1, delta: -2 }),
    ...Array.from({ length: 8 }, (_, i) => recoveryFact(`october-pb-${i}`, 'score-pb', '2026-10-06', { songId: 300 + i, delta: 1000 * (i + 1), after: 900000 + 1000 * (i + 1) }))
  ];
}
export const recoveryMeasurement = (id: string, day: string, overrides: Partial<GrowthMeasurement> = {}): GrowthMeasurement => ({
  id, ownerId: '7', bindingId: '2', capturedAt: `${day}T04:00:00Z`, scoreRevision: id,
  measurementVersion: 1, algorithmVersion: 'growth-v1', modelRevision: 'model-a', rating: 10,
  dimensions: recoveryDimensions(), focus: 'accuracy_power', sampleCount: 60, availabilityState: 'ready', ...overrides
});
export function recoveryInput(facts = recoveryFlood(), measurements = [recoveryMeasurement('1', '2026-10-05'), recoveryMeasurement('2', '2026-10-08')]) {
  const range = resolveSkillPassportRange({}, recoveryNow);
  const history: GrowthHistoryResponse = {
    profileId: '2', range: { from: range.recentFrom, to: range.to, maxDays: 90, timezone: 'Asia/Shanghai' }, facts, measurements: [],
    coverage: { scoreHistoryFrom: range.recentFrom, scoreHistoryTo: range.to, scoreHistoryState: 'complete', measurementFrom: null, measurementTo: null, measurementState: 'unknown' }
  };
  return { profileId: '2', range, measurements, history, overview: null, measurementCoverage: { measurementFrom: measurements[0]?.capturedAt || null, measurementTo: measurements.at(-1)?.capturedAt || null, measurementDays: measurements.length } };
}
export function recoveryBenchmarkFacts() {
  const types: GrowthFact['type'][] = ['score-pb', 'ng-reduced', 'combo-improved', 'clear', 'fc', 'df', 'rank-upgrade'];
  return Array.from({ length: 3000 }, (_, i) => {
    const day = new Date(Date.parse('2026-07-11T00:00:00Z') + (i % 90) * 86400000).toISOString().slice(0, 10);
    const type = types[i % types.length]!;
    return recoveryFact(`fact-${i}`, type, day, { songId: 100 + Math.floor(i / 3), before: type === 'ng-reduced' ? 8 : type === 'score-pb' ? 900000 : 1, after: type === 'ng-reduced' ? i % 8 : type === 'score-pb' ? 900001 + i : 2, delta: type === 'ng-reduced' ? i % 8 - 8 : type === 'score-pb' ? i + 1 : 1 });
  });
}
