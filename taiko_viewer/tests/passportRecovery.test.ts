import test from 'node:test';
import assert from 'node:assert/strict';
import { curateSkillPassportMilestones } from '../server/services/growth-passport/milestones.ts';
import { buildSkillPassport } from '../server/services/growth-passport/composer.ts';
import { selectPassportPeriod } from '../utils/passportPresentation.ts';
import { recoveryFact as fact, recoveryFlood, recoveryInput, recoveryMeasurement as measurement } from './fixtures/passportRecovery.ts';
const period = { from: '2026-07-11', to: '2026-10-08' };

test('same-day eight PBs cannot crowd out FC, matched Goal or rank/NG from three temporal buckets', () => {
  const facts = recoveryFlood(), curated = curateSkillPassportMilestones(facts, period);
  const keys = curated.milestones.flatMap(node => node.factKeys);
  for (const key of ['july-fc', 'august-ng', 'august-goal', 'september-rank', 'september-ng']) assert.ok(keys.includes(key), key);
  assert.equal(curated.milestones.filter(node => node.day === '2026-10-06').length, 2);
  assert.deepEqual(curateSkillPassportMilestones([...facts].reverse(), period), curated);
  assert.ok(curated.milestones.every(node => node.factKeys.every(key => facts.some(fact => fact.factKey === key))));
  assert.equal(curated.milestones.find(node => node.factKeys.includes('august-goal'))?.day, '2026-08-10');
  assert.equal(curated.milestones.find(node => node.factKeys.includes('september-ng'))?.improvements?.length, 2);
});
test('PB + NG + FC merge safely with stable identity and evidence, never across binding or precision', () => {
  const pb = fact('pb', 'score-pb', '2026-10-06');
  const ng = fact('ng', 'ng-reduced', '2026-10-06', { before: 1, after: 0, delta: -1 });
  const fc = fact('fc', 'fc', '2026-10-06', { before: 0, after: 1, delta: 1 });
  const result = curateSkillPassportMilestones([pb, ng, fc, pb], period).milestones[0]!;
  assert.equal(result.primaryType, 'fc'); assert.deepEqual(result.factKeys, ['fc', 'ng', 'pb']);
  assert.deepEqual(result.evidenceRefs?.map(ref => ref.factKey), result.improvements?.map(item => item.factKey));
  assert.equal(curateSkillPassportMilestones([pb, ng], period).milestones[0]?.id, result.id);
  const separate = curateSkillPassportMilestones([pb, { ...ng, bindingId: '3' }], period).milestones;
  assert.equal(separate.length, 2); assert.ok(separate.every(node => node.factKeys.length === 1));
  const precision = curateSkillPassportMilestones([pb, { ...ng, temporal: { ...ng.temporal, precision: 'instant' } }], period).milestones;
  assert.ok(precision.every(node => node.factKeys.length === 1));
});
test('observation-only Goals retain observation day and never link by missing revision or null values', () => {
  const pb = fact('pb', 'score-pb', '2026-08-10', { before: null, after: null, evidence: { source: 'score-history', evidenceVersion: 1 } });
  const goal = fact('goal', 'goal-completed', null, { goalId: 'g1', goalType: 'score-pb', before: null, after: null, evidence: { source: 'goal', evidenceVersion: 1 } });
  const nodes = curateSkillPassportMilestones([pb, goal], period).milestones;
  const observed = nodes.find(node => node.primaryType === 'goal-completed')!;
  assert.equal(observed.day, null); assert.equal(observed.observationOnly, true);
  assert.equal(observed.observedAt, goal.temporal.observedAt);
  assert.ok(nodes.every(node => node.factKeys.length === 1));
});
test('one-day PB only, one-type dates, empty and expired facts do not fabricate breakthroughs', () => {
  const facts = recoveryFlood().filter(fact => fact.type === 'score-pb');
  assert.equal(curateSkillPassportMilestones(facts, period).milestones.length, 2);
  const varied = facts.map((fact, i) => ({ ...fact, temporal: { ...fact.temporal, attributedDay: `2026-09-${String(i + 10).padStart(2, '0')}` } }));
  assert.equal(curateSkillPassportMilestones(varied, period).milestones.length, 2);
  assert.deepEqual(curateSkillPassportMilestones([], period).milestones, []);
  assert.deepEqual(curateSkillPassportMilestones([fact('expired', 'df', '2026-07-10')], period).milestones, []);
  assert.deepEqual(curateSkillPassportMilestones([fact('played', 'played', '2026-10-06')], period).milestones, []);
});
test('selection and expansion preserve capacity and traceable soft-cap exceptions', () => {
  const types = ['df', 'fc', 'clear', 'rank-upgrade', 'ng-reduced', 'score-pb', 'combo-improved'] as const;
  const facts = Array.from({ length: 84 }, (_, i) => fact(`many-${i}`, types[i % 7]!, `2026-${i < 28 ? '07' : i < 56 ? '08' : '09'}-${String(12 + i % 14).padStart(2, '0')}`, { songId: i + 100, ...(['df','fc','clear','rank-upgrade'].includes(types[i%7]!) ? {before:types[i%7]==='clear'?-1:types[i%7]==='rank-upgrade'?7:types[i%7]==='df'?1:0,after:types[i%7]==='clear'?0:types[i%7]==='rank-upgrade'?8:types[i%7]==='df'?2:1,delta:1}:types[i%7]==='ng-reduced'?{before:14,after:2,delta:-12}:{}) }));
  const curated = curateSkillPassportMilestones(facts, period);
  assert.equal(curated.initialIds.length, 8); assert.ok(curated.milestones.length > 8 && curated.milestones.length <= 24);
  assert.ok(curated.milestones.every(node => node.primaryType !== 'combo-improved'));
  assert.deepEqual(curateSkillPassportMilestones([...facts].reverse(),period),curated);
  assert.equal(new Set(curated.milestones.map(node => node.songId)).size, curated.milestones.length);
  const initial = curated.milestones.filter(node => curated.initialIds.includes(node.id));
  assert.equal(new Set(initial.map(node => node.day!.slice(0, 7))).size, 3);
  assert.deepEqual(curated.milestones.map(node => node.day), curated.milestones.map(node => node.day).sort().reverse());
});
test('four views distinguish 30/90 facts and 365 sparse measurements while current status stays fixed', () => {
  const rows = [measurement('old', '2025-11-01', { rating: 8, focus: 'rhythm' }), ...['05','06','07','08'].map(day => measurement(day, `2026-10-${day}`, { rating: 10 + Number(day) / 100 }))];
  const payload = buildSkillPassport(recoveryInput(recoveryFlood(), rows));
  const views = [30, 90, 180, 365].map(days => selectPassportPeriod(payload, days as 30 | 90 | 180 | 365)!);
  assert.deepEqual(views.map(view => view.range.requestedDays), [30,90,180,365]);
  assert.deepEqual(views.map(view => view.range.measurementDays), [4,4,4,5]);
  assert.deepEqual(views.map(view => view.range.factDays), [30,90,90,90]);
  assert.ok(!views[0]!.milestones.some(node => node.factKeys.includes('july-fc')));
  assert.ok(views[1]!.milestones.some(node => node.factKeys.includes('july-fc')));
  assert.deepEqual(views[1]!.milestones, views[3]!.milestones);
  assert.equal(views[3]!.range.from, '2025-10-09');
  assert.ok(views.every(view => view.current === payload.current && view.activeGoal === payload.activeGoal && view.currentNextAction === payload.currentNextAction));
  assert.ok(views[3]!.focusTimeline.some(run => run.focus === 'rhythm'));
});
test('coverage state is preserved without claiming full 180/365 facts', () => {
  for (const state of ['complete','partial','truncated','unknown'] as const) {
    const input = recoveryInput(); input.history.coverage.scoreHistoryState = state;
    const payload = buildSkillPassport(input);
    for (const days of [30,90,180,365] as const) {
      const view = selectPassportPeriod(payload, days)!;
      assert.equal(view.coverage.recentFactsState, state);
      assert.equal(view.coverage.recentFactsFrom, days === 30 ? '2026-09-09' : period.from);
    }
  }
});
test('A→B→A never reconnects across selected periods, and a singleton has no compatible delta', () => {
  const rows = [measurement('a1', '2026-07-15'), measurement('a2', '2026-07-16'), measurement('b', '2026-09-10', { modelRevision: 'model-b' }), measurement('a3', '2026-10-08')];
  const payload = buildSkillPassport(recoveryInput([], rows));
  const view = selectPassportPeriod(payload, 90)!;
  assert.deepEqual(view.segments.map(segment => segment.points.map(point => point.id)), [['a1','a2'],['b'],['a3']]);
  assert.equal(view.currentSegmentChange.compatible, false);
  assert.deepEqual(selectPassportPeriod(payload, 30)?.segments.map(segment => segment.points.map(point => point.id)), [['b'],['a3']]);
});
