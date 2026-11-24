import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlayerDecisionContext, type DecisionInput } from '../utils/player-intelligence/context.ts';
import { adaptExistingCandidates, type EstimateSnapshot } from '../utils/player-intelligence/adapters.ts';
import { matchCandidates } from '../utils/player-intelligence/matching.ts';
import { projectLivingHome } from '../utils/player-intelligence/next-action.ts';
import { goalBaseline, goalTarget } from '../utils/playerGoal.ts';
import type { PlayerGoal } from '../types/player-goal.ts';
import type { GrowthFact } from '../types/player-growth.ts';
import type { RecommendationToolPayload } from '../types/recommendation-tool.ts';
import type { RatingDimensionKey } from '../types/recommendation-intelligence.ts';
import { at, candidate, decisionInput } from './fixtures/player-intelligence.ts';

const keys: RatingDimensionKey[] = ['big_song', 'stamina', 'speed', 'accuracy_power', 'rhythm', 'complex'];
function completeInput(): DecisionInput {
  const input = decisionInput();
  input.rating!.observedAt = '2026-11-04T00:00:00Z';
  input.rating!.value.dimensions = keys.map(key => ({ key, value: key === 'stamina' ? 5 : 10 }));
  input.growth = { profileId: 'p', revision: 'score-1', observedAt: '2026-11-05T00:00:00Z', value: {
    overallRating: 10, skills: input.rating!.value.dimensions.map(d => ({ ...d })), priorityDimension: 'stamina',
    tiedDimensions: ['stamina'], dataSufficiency: 'ready', basis: 'lowest-valid-dimension', sampleCount: 20
  } };
  input.history = { profileId: 'p', revision: 'history-2', observedAt: '2026-11-06T00:00:00Z', value: {
    profileId: 'p', range: { from: '2026-11-01', to: '2026-11-10', timezone: 'Asia/Shanghai', maxDays: 31 },
    measurements: [], facts: [], coverage: { scoreHistoryFrom: null, scoreHistoryTo: null, scoreHistoryState: 'unknown',
      measurementFrom: null, measurementTo: null, measurementState: 'unknown' }
  } };
  input.goals!.revision = 'goals-3'; input.goals!.observedAt = '2026-11-07T00:00:00Z';
  input.preferences = { profileId: 'p', revision: 'preferences-4', observedAt: '2026-11-08T00:00:00Z',
    value: { preferredChartKeys: [], excludedChartKeys: [], focus: 'growth' } };
  return input;
}
function growthOrder(input: DecisionInput) {
  const first = candidate(1), focused = candidate(2);
  focused.chart.verifiedDimensions = ['stamina'];
  return matchCandidates(buildPlayerDecisionContext(input), [first, focused], { k: 2, region: 'CN' });
}
function activeGoal(): PlayerGoal {
  return { id: 'goal-1', profileId: 'p', songId: 2, difficultyType: 4, title: 'fixture', starLevel: 8,
    goalType: 'score-pb', baselineVersion: 1, baseline: goalBaseline({ high_score: 99 }, 'baseline-score', '2026-11-01T00:00:00Z'),
    source: 'ordinary-recommendation', sourceBasis: 'rating', sourceMode: 'ordinary', sourceRank: 1,
    sourceRevision: 'baseline-score', sourceGeneratedAt: '2026-11-01T00:00:00Z', targetData: goalTarget('score-pb'),
    status: 'active', createdAt: '2026-11-01T00:00:00Z', cancelledAt: null, unavailable: false };
}
function adaptGoal(goal: PlayerGoal, target = 100) {
  const input = decisionInput();
  input.goals!.value = { profileId: 'p', outcome: 'active', activeGoal: goal, recentCompletedGoal: null };
  const context = buildPlayerDecisionContext(input), charts = [candidate(1).chart, candidate(2).chart];
  const ordinary: RecommendationToolPayload = { model: 'v1', basis: 'rating', profileId: 'p', scoreRevision: 'score-1', generatedAt: at, image: null,
    items: charts.map(c => ({ songId: c.songId, level: c.difficultyType, title: 'fixture', isUnplayed: false,
      candidateIndicator: 10, referenceIndicator: 10, deviationRatio: 0, inStrictRange: true,
      starLevel: 8, recommendationToken: '', canCreateGoal: true })) };
  const estimates: EstimateSnapshot[] = charts.map(c => ({ profileId: 'p', scoreRevision: 'score-1', catalogRevision: 'catalog-1', sourceHash: c.sourceHash,
    generatedAt: at, featureCutoff: at, modelVersion: 'synthetic', evidenceRefs: ['fixture:stable'],
    estimate: { song_id: c.songId, level: 4, current_score: 99, reliability: 80, data_sufficiency: 'ok', stable: { score: 200 }, pb: { score: 300 } } }));
  return { context, candidates: adaptExistingCandidates(context, ordinary, charts, estimates, new Map([['1:4', 100], ['2:4', target]])) };
}

test('review provenance: every accepted snapshot retains its own revision and observation time', () => {
  const input = completeInput(), c = buildPlayerDecisionContext(input);
  assert.deepEqual(c.sources, {
    rating: { revision: 'score-1', observedAt: '2026-11-04T00:00:00Z' },
    growth: { revision: 'score-1', observedAt: '2026-11-05T00:00:00Z' },
    history: { revision: 'history-2', observedAt: '2026-11-06T00:00:00Z' },
    goals: { revision: 'goals-3', observedAt: '2026-11-07T00:00:00Z' },
    preferences: { revision: 'preferences-4', observedAt: '2026-11-08T00:00:00Z' }
  });
  assert.equal(c.confidence.observedAt, c.sources.rating!.observedAt);
});
test('review provenance: missing sources remain null and null source revision is preserved', () => {
  const c = buildPlayerDecisionContext(decisionInput());
  assert.equal(c.sources.growth, null); assert.equal(c.sources.history, null); assert.equal(c.sources.preferences, null);
  const input = completeInput(); input.preferences!.revision = null;
  assert.deepEqual(buildPlayerDecisionContext(input).sources.preferences, { revision: null, observedAt: '2026-11-08T00:00:00Z' });
});
test('review provenance: stale rating and growth revisions do not enter accepted provenance', () => {
  const input = completeInput(); input.rating!.revision = 'old-rating'; input.growth!.revision = 'different-growth';
  const c = buildPlayerDecisionContext(input);
  assert.equal(c.sources.rating, null); assert.equal(c.sources.growth, null); assert.equal(c.confidence.observedAt, null);
  assert.equal(c.sources.history!.revision, 'history-2'); assert.equal(c.sources.goals!.revision, 'goals-3');
});
test('review provenance: rejected identity, future time, payload or invalid rating cannot claim a source', () => {
  const input = completeInput(); input.rating!.value.overallRating = NaN; input.growth!.profileId = 'other';
  input.history!.value.profileId = 'other'; input.goals!.value.profileId = 'other'; input.preferences!.observedAt = '2026-11-11T00:00:00Z';
  assert.deepEqual(buildPlayerDecisionContext(input).sources, { rating: null, growth: null, history: null, goals: null, preferences: null });
});
test('review dimensions: empty arrays are unknown, preserve overall Rating and cannot boost growth', () => {
  const input = completeInput(); input.rating!.value.dimensions = []; input.growth!.value.skills = [];
  const c = buildPlayerDecisionContext(input);
  assert.equal(c.longTerm.growthConsistency, 'unknown'); assert.equal(c.longTerm.rating, input.rating!.value);
  assert.ok(Object.values(c.longTerm.dimensionConsistency).every(v => v === 'unknown'));
  const result = growthOrder(input); assert.deepEqual(result.items.map(i => i.chart.key), ['1:4', '2:4']);
  assert.ok(result.items.every(i => !i.explanation.reasonCodes.includes('growth')));
});
test('review dimensions: matching partial evidence never proves whole-profile consistency', () => {
  for (const side of ['rating', 'growth', 'both'] as const) {
    const input = completeInput();
    if (side !== 'growth') input.rating!.value.dimensions = [{ key: 'stamina', value: 5 }];
    if (side !== 'rating') input.growth!.value.skills = [{ key: 'stamina', value: 5 }];
    const c = buildPlayerDecisionContext(input);
    assert.equal(c.longTerm.growthConsistency, 'unknown'); assert.equal(c.longTerm.rating!.overallRating, 10);
    assert.equal(c.longTerm.dimensionConsistency.stamina, 'consistent'); assert.equal(c.longTerm.dimensionConsistency.speed, 'unknown');
    assert.deepEqual(growthOrder(input).items.map(i => i.chart.key), ['1:4', '2:4']);
  }
});
test('review dimensions: complete equal evidence permits only the corresponding verified chart dimension', () => {
  const input = completeInput(), c = buildPlayerDecisionContext(input);
  assert.equal(c.longTerm.growthConsistency, 'consistent');
  assert.ok(Object.values(c.longTerm.dimensionConsistency).every(v => v === 'consistent'));
  const result = growthOrder(input); assert.deepEqual(result.items.map(i => i.chart.key), ['2:4', '1:4']);
  assert.ok(result.items[0].explanation.reasonCodes.includes('growth')); assert.ok(!result.items[1].explanation.reasonCodes.includes('growth'));
});
test('review dimensions: conflicts are inconsistent even when other evidence is missing', () => {
  const input = completeInput(); input.growth!.value.skills.find(d => d.key === 'stamina')!.value = 6;
  assert.equal(buildPlayerDecisionContext(input).longTerm.growthConsistency, 'inconsistent');
  assert.deepEqual(growthOrder(input).items.map(i => i.chart.key), ['1:4', '2:4']);
  input.rating!.value.dimensions = [{ key: 'stamina', value: 5 }];
  assert.equal(buildPlayerDecisionContext(input).longTerm.growthConsistency, 'inconsistent');
});
test('review dimensions: missing sources and zero-filled skills are unknown; limited evidence cannot boost', () => {
  const input = completeInput(); delete input.growth;
  assert.equal(buildPlayerDecisionContext(input).longTerm.growthConsistency, 'unknown');
  const absentRating = completeInput(); delete absentRating.rating;
  assert.equal(buildPlayerDecisionContext(absentRating).longTerm.growthConsistency, 'unknown');
  const zero = completeInput(); zero.rating!.value.dimensions[0].value = 0; zero.growth!.value.skills[0].value = 0;
  assert.equal(buildPlayerDecisionContext(zero).longTerm.growthConsistency, 'unknown');
  const limited = completeInput(); limited.growth!.value.dataSufficiency = 'limited';
  assert.deepEqual(growthOrder(limited).items.map(i => i.chart.key), ['1:4', '2:4']);
});
test('review goal: relative score-pb binds exactly the minimum integer satisfying the existing greater comparison', () => {
  const { context, candidates } = adaptGoal(activeGoal());
  assert.equal(candidates[0].goalId, undefined); assert.equal(candidates[1].goalId, 'goal-1');
  const result = matchCandidates(context, candidates, { k: 2, region: 'CN' });
  assert.deepEqual(result.items.map(i => i.chart.key), ['2:4', '1:4']);
  assert.ok(result.items[0].explanation.reasonCodes.includes('active-goal'));
});
test('review goal: below, equal and higher-than-exact targets never gain a goal marker or reason', () => {
  for (const target of [98, 99, 101, 150, 99.5]) {
    const { context, candidates } = adaptGoal(activeGoal(), target);
    assert.equal(candidates[1].goalId, undefined);
    // The sorter must not trust an injected/stale goalId either.
    candidates[1].goalId = 'goal-1';
    const result = matchCandidates(context, candidates, { k: 2, region: 'CN' });
    assert.deepEqual(result.items.map(i => i.chart.key), ['1:4', '2:4']);
    assert.ok(result.items.every(i => !i.explanation.reasonCodes.includes('active-goal')));
  }
});
test('review goal: mismatched field, direction, value, status and type cannot bind', () => {
  const changes: Partial<PlayerGoal>[] = [
    { targetData: { comparison: 'greater', field: 'ngCnt' } },
    { targetData: { comparison: 'less', field: 'highScore' } },
    { targetData: { comparison: 'present', field: 'highScore' } },
    { targetData: { comparison: 'greater', field: 'highScore', value: 100 } },
    { targetData: { comparison: 'greater', field: 'highScore', value: NaN } },
    { status: 'completed' }, { unavailable: true }, { profileId: 'other' },
    { goalType: 'fc', targetData: goalTarget('fc') }, { goalType: 'df', targetData: goalTarget('df') }
  ];
  for (const change of changes) {
    const { context, candidates } = adaptGoal({ ...activeGoal(), ...change });
    assert.equal(candidates[1].goalId, undefined);
    candidates[1].goalId = 'goal-1';
    assert.ok(matchCandidates(context, candidates, { k: 2, region: 'CN' }).items.every(i => !i.explanation.reasonCodes.includes('active-goal')));
  }
});
test('review goal: explicit bound must restate the baseline; invalid or unrepresentable baseline stays unbound', () => {
  const explicit = activeGoal(); explicit.targetData.value = 99;
  assert.equal(adaptGoal(explicit).candidates[1].goalId, explicit.id);
  for (const baseline of [null, NaN, -1, 99.5, Number.MAX_SAFE_INTEGER]) {
    const goal = activeGoal(); goal.baseline.highScore = baseline;
    assert.equal(adaptGoal(goal).candidates[1].goalId, undefined);
  }
  const missing = activeGoal(); missing.baseline.recordPresent = false;
  assert.equal(adaptGoal(missing).candidates[1].goalId, undefined);
});
function fact(factKey: string, temporal: GrowthFact['temporal']): GrowthFact {
  return { id: factKey, factKey, ownerId: 'u', bindingId: 'p', type: 'score-pb',
    evidence: { source: 'score-history', evidenceVersion: 1 }, temporal };
}
test('review recent facts: a late-confirmed historical PB retains all three clocks in context and Home', () => {
  const input = completeInput(); input.history!.observedAt = at;
  input.history!.value.facts = [fact('old-pb', { occurredAt: '2025-01-01T00:00:00Z', observedAt: '2025-01-02T00:00:00Z', confirmedAt: at, precision: 'instant' })];
  const c = buildPlayerDecisionContext(input), matches = matchCandidates(c, [], { k: 1, region: 'CN' });
  assert.deepEqual(c.recent.factReferences, [{ factKey: 'old-pb', occurredAt: '2025-01-01T00:00:00Z', observedAt: '2025-01-02T00:00:00Z', confirmedAt: at,
    precision: 'instant', knownAt: at, knowledgeBasis: 'confirmedAt' }]);
  const home = projectLivingHome(c, matches, { latestSongKeys: [], eventIds: [], communityIds: [] });
  assert.deepEqual(home.recent.factReferences, c.recent.factReferences);
  assert.deepEqual(home.recent.factKeys, ['old-pb']); assert.equal(home.recent.factSemantics, c.recent.factSemantics);
  assert.equal(home.recent.factSemantics, 'recently-known-fact-references'); assert.equal(home.recent.sessionIdentifiability, 'not-inferred');
});
test('review recent facts: observation-only knowledge never fills missing occurrence or confirmation', () => {
  const input = completeInput(); input.history!.observedAt = at;
  input.history!.value.facts = [fact('observation', { observedAt: at, precision: 'observation' }), fact('event-only', { occurredAt: at, precision: 'instant' })];
  const c = buildPlayerDecisionContext(input);
  assert.deepEqual(c.recent.factKeys, ['observation']);
  assert.deepEqual(c.recent.factReferences, [{ factKey: 'observation', occurredAt: null, observedAt: at, confirmedAt: null,
    precision: 'observation', knownAt: at, knowledgeBasis: 'observedAt' }]);
});
test('review recent facts: future and invalid confirmation are not silently replaced with an earlier observation', () => {
  const input = completeInput(); input.history!.observedAt = at;
  input.history!.value.facts = [
    fact('future', { observedAt: at, confirmedAt: '2026-11-11T00:00:00Z', precision: 'observation' }),
    fact('invalid', { observedAt: at, confirmedAt: '', precision: 'observation' })
  ];
  const c = buildPlayerDecisionContext(input);
  assert.deepEqual(c.recent.factKeys, []); assert.deepEqual(c.recent.factReferences, []);
});
