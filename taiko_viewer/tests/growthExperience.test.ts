import test from 'node:test';
import assert from 'node:assert/strict';
import { composeGrowthFeedback } from '../utils/composeGrowthFeedback.ts';
import { passportRangeChoices, passportCoverageSpan, passportTrendStory } from '../utils/passportPresentation.ts';
import type { PlayerGoal } from '../types/player-goal';
import type { GrowthDailyProgress, GrowthEventFact, GrowthFact, RecentGrowthResponse, SkillPassportResponse } from '../types/player-growth';

const change = (type: GrowthEventFact['type'], before: number, after: number): GrowthEventFact => ({ type, before, after, delta: after - before });
const goal = { id: 'goal-1', profileId: '1', songId: 1, difficultyType: 4, status: 'completed', baseline: {}, completionEvidence: { observationRevision: 'new-revision', result: { goalType: 'ng-reduced', before: 1, after: 0, facts: {} } } } as PlayerGoal;
const daily = (facts = [change('ng-reduced', 1, 0), change('score-pb', 980000, 995440)]): GrowthDailyProgress => ({ calendarDay: '2026-10-07', dataMode: 'FULL_HISTORY', attendance: 'played', uniqueCharts: 28, events: [
  { songId: 1, level: 4, title: 'Chosen Song', occurredAt: '2026-10-07', evidence: 'history', evidenceRevision: 'new-revision', importance: 60, facts },
  { songId: 2, level: 4, title: 'Another PB', occurredAt: '2026-10-07', evidence: 'history', importance: 60, facts: [change('score-pb', 900000, 920000)] }
] });
const recentFact = (type: GrowthFact['type'], before: number, after: number, overrides = {}): GrowthFact => ({ id: type, factKey: type, ownerId: '10', bindingId: '1', songId: 1, difficultyType: 4, type, before, after, delta: after - before, evidence: { source: 'score-history', evidenceVersion: 1, sourceRevision: 'new-revision' }, temporal: { attributedDay: '2026-10-07', precision: 'day' }, ...overrides });
const recent = (facts: GrowthFact[]): RecentGrowthResponse => ({ profileId: '1', state: 'new', observedAt: '2026-10-07T06:00:00Z', facts, totalFacts: facts.length, boundary: { acknowledgedToken: null, currentToken: 'boundary', acknowledgeRequired: true, recovered: false } });

test('completed intent keeps its result and same-observation support; unrelated PB stays in Daily; DTOs unchanged', () => {
  const d = daily(), r = recent([recentFact('ng-reduced', 1, 0), recentFact('score-pb', 980000, 995440), recentFact('goal-completed', 1, 0, { goalId: 'goal-1', evidence: { source: 'goal', evidenceVersion: 1 } })]);
  const before = JSON.stringify({ d, r, goal });
  const result = composeGrowthFeedback(goal, d, r);
  assert.deepEqual(result.goalFacts.map(item => item.type), ['ng-reduced', 'score-pb']);
  assert.deepEqual(result.dailyProgress.events.map(item => item.songId), [2]);
  assert.equal(result.additionalPbCount, 1);
  assert.equal(result.dailyProgress.uniqueCharts, 28);
  assert.equal(result.recentFacts.length, 0);
  assert.equal(result.recentSuppressedCount, 3);
  assert.equal(JSON.stringify({ d, r, goal }), before);
});
test('matching Goal/Daily and Goal/Recent are independently deduplicated', () => {
  assert.equal(composeGrowthFeedback(goal, daily()).dailyProgress.events.length, 1);
  assert.equal(composeGrowthFeedback(goal, { ...daily(), events: [] }, recent([recentFact('ng-reduced', 1, 0)])).recentFacts.length, 0);
});
test('same song alone cannot imply support, recommendation causality or another-day duplication', () => {
  const d = daily(); d.events[0]!.evidenceRevision = 'other-revision';
  assert.deepEqual(composeGrowthFeedback(goal, d).goalFacts.map(fact => fact.type), ['ng-reduced']);
  const result = composeGrowthFeedback(null, d, recent([recentFact('score-pb', 980000, 995440, { temporal: { attributedDay: '2026-10-06', precision: 'day' } })]));
  assert.equal(result.goalFacts.length, 0);
  assert.equal(result.dailyProgress.events[0]!.facts.some(fact => fact.type === 'score-pb'), true);
});
test('Recent/Daily dedup retains other same-song facts, another chart, and facts beyond the five rendered', () => {
  const d = daily();
  const r = recent([recentFact('score-pb', 980000, 995440)]);
  assert.deepEqual(composeGrowthFeedback(null, d, r).dailyProgress.events.find(event => event.songId === 1)!.facts.map(fact => fact.type), ['ng-reduced']);
  r.facts[0]!.difficultyType = 5;
  assert.equal(composeGrowthFeedback(null, d, r).dailyProgress.events[0]!.facts.length, 2);
  const crowded = recent(Array.from({ length: 5 }, (_, i) => recentFact('df', 1, 2, { factKey: `df-${i}`, songId: i + 10 })).concat(recentFact('score-pb', 980000, 995440)));
  assert.equal(composeGrowthFeedback(null, d, crowded).dailyProgress.events.find(event => event.songId === 1)!.facts.length, 2);
});
test('active intent prioritizes relevant Recent, does not invent completion; no Goal/Recent-only/Daily-only remain valid', () => {
  const r = recent([recentFact('df', 1, 2, { songId: 2 }), recentFact('score-pb', 980000, 995440)]);
  const active = { ...goal, status: 'active' } as PlayerGoal;
  const result = composeGrowthFeedback(null, daily(), r, active);
  assert.equal(result.recentFacts[0]!.songId, 1);
  assert.equal(result.goalFacts.length, 0);
  assert.equal(composeGrowthFeedback(active, daily()).goalFacts.length, 0);
  assert.equal(composeGrowthFeedback(null, daily()).dailyProgress.events.length, 2);
  assert.equal(composeGrowthFeedback(null, { ...daily(), events: [], attendance: 'not_played' }, r).recentFacts.length, 2);
});
test('different profiles never bridge a Goal and Recent fact', () => {
  const r = recent([recentFact('ng-reduced', 1, 0, { bindingId: '2' })]); r.profileId = '2';
  assert.equal(composeGrowthFeedback(goal, daily(), r).recentFacts.length, 1);
});
for (const [span, expected] of [[4, []], [42, [[30, false], [90, true]]], [120, [[30, false], [90, false], [180, true]]], [250, [[30, false], [90, false], [180, false], [365, true]]], [365, [[30, false], [90, false], [180, false], [365, false]]]] as const) {
  test(`${span}-day coverage offers only meaningful ranges`, () => assert.deepEqual(passportRangeChoices(span).map(item => [item.days, item.all]), expected));
}
test('calendar span uses Shanghai days and does not confuse sparse measurement count with elapsed coverage', () => {
  const coverage = { measurementFrom: '2026-09-30T16:30:00Z', measurementTo: '2026-10-04T14:00:00Z', measurementDays: 2 } as SkillPassportResponse['coverage'];
  assert.equal(passportCoverageSpan(coverage), 4);
  assert.equal(passportCoverageSpan({ ...coverage, measurementFrom: 'invalid' }), 0);
});
test('stable Rating, model break, one point and limited narratives never compare incompatible periods', () => {
  const points = [{ day: '2026-10-06', rating: 10.28 }, { day: '2026-10-07', rating: 10.28 }];
  const p = { current: { readiness: 'ready' }, segments: [{ points: [{ day: '2026-10-01', rating: 8 }] }, { points }], currentSegmentChange: { compatible: true, reason: 'compatible' } } as SkillPassportResponse;
  assert.equal(passportTrendStory(p, 'rating').state, 'stable');
  p.segments[1]!.points[0]!.rating = 10.1;
  const story = passportTrendStory(p, 'rating');
  assert.equal(story.state, 'changed');
  if (story.state === 'changed') assert.equal(story.first.value, 10.1);
  p.currentSegmentChange.compatible = false;
  assert.equal(passportTrendStory(p, 'rating').state, 'accumulating');
  p.current!.readiness = 'limited';
  assert.equal(passportTrendStory(p, 'rating').state, 'limited');
});

test('Daily and Recent with different baselines still render one supporting outcome from the same observation', () => {
  const result = composeGrowthFeedback(goal, daily(), recent([recentFact('score-pb', 970000, 995440)]));
  assert.equal(result.goalFacts.filter(fact => fact.type === 'score-pb').length, 1);
  assert.equal(result.recentFacts.length, 0);
  assert.equal(result.dailyProgress.events.some(event => event.songId === 1), false);
});
