import test from 'node:test';
import assert from 'node:assert/strict';
import { goalFixture } from './goal-fixtures.ts';
import { seal } from './fixtures.ts';
import { associateCandidatesWithPortfolio } from '../../utils/multi-objective/goals.ts';
import { validateCandidate } from '../../utils/multi-objective/candidate.ts';
import { hash } from '../../utils/multi-objective/common.ts';
test('G01 score-pb and DF active Goals keep independent baseline, readiness and revision', () => {
  const f = goalFixture(), before = hash(f), out = associateCandidatesWithPortfolio(f.candidates, f.context);
  assert.equal(out.diagnostics.length, 0, JSON.stringify(out.diagnostics));
  for (const c of out.candidates) assert.deepEqual(validateCandidate(c, f.context).issues, []);
  assert.equal(out.candidates.length, 2); assert.deepEqual(out.candidates.map(c => c.goalIds[0]).sort(), ['goal-df', 'goal-score']);
  assert.equal(new Set(out.candidates.map(c => c.goalLinks[0]!.baselineRef)).size, 2);
  assert.equal(new Set(out.candidates.map(c => c.goalLinks[0]!.actionability.readiness)).size, 2);
  assert.equal(hash(f), before);
});
test('G05 pure association is idempotent; revision forgery rejected (no CAS claim)', () => {
  const f = goalFixture(), a = associateCandidatesWithPortfolio(f.candidates, f.context), b = associateCandidatesWithPortfolio(a.candidates, f.context);
  assert.deepEqual(a, b);
  const c = structuredClone(a.candidates[0]!); c.goalLinks[0]!.goalRevision = 'forged';
  assert.ok(validateCandidate(c, f.context).issues.some(i => i.code === 'GOAL_LINK_REVISION_OR_STATE_MISMATCH'));
});
test('G05 duplicate Goal ID snapshot fails instead of choosing arrival order', () => {
  const f = goalFixture(); f.context.portfolio!.goals.push({ ...f.context.portfolio!.goals[0]!, userPriority: 3 }); seal(f);
  const out = associateCandidatesWithPortfolio(f.candidates, f.context); assert.equal(out.candidates.length, 0); assert.ok(out.diagnostics[0]!.details.includes('GOAL_ID_CONFLICT'));
});
test('G09 paused/completed/cancelled/unavailable retained, never auto-created or updated', () => {
  for (const lifecycleStatus of ['paused', 'completed', 'cancelled'] as const) {
    const f = goalFixture(); f.context.portfolio!.goals[0]!.lifecycleStatus = lifecycleStatus; f.context.portfolio!.goals[1]!.availability = 'unavailable'; seal(f);
    const before = hash(f.context.portfolio), out = associateCandidatesWithPortfolio(f.candidates, f.context);
    assert.equal(hash(f.context.portfolio), before); assert.equal(out.candidates.flatMap(c => c.goalLinks).find(g => g.goalId === 'goal-score')!.lifecycleStatus, lifecycleStatus);
    assert.equal(out.candidates.flatMap(c => c.goalLinks).find(g => g.goalId === 'goal-df')!.availability, 'unavailable');
  }
});
test('R03 old Goal unresolved mapping retained as unknown diagnostic; target mismatch not guessed', () => {
  const f = goalFixture(), legacy = structuredClone(f.context.portfolio!.goals[0]!);
  legacy.id = 'legacy'; legacy.chartId = null; legacy.identityMappingRef = null; legacy.target = null; legacy.targetHash = null; legacy.availability = 'unknown'; f.context.portfolio!.goals.push(legacy); seal(f);
  const out = associateCandidatesWithPortfolio(f.candidates, f.context); assert.ok(out.diagnostics.some(d => d.goalId === 'legacy' && d.reasonCode === 'LEGACY_GOAL_IDENTITY_OR_TARGET_UNKNOWN'));
  assert.equal(f.context.portfolio!.goals.at(-1)!.baselineRef, legacy.baselineRef);
  const bad = f.context.portfolio!.goals[0]!; (bad.target as any).threshold = 900002; bad.targetHash = hash(bad.target); seal(f);
  assert.ok(associateCandidatesWithPortfolio(f.candidates, f.context).candidates.every(c => !c.goalIds.includes('goal-score')));
});
test('T11 played Goal cannot be associated through a supported score target', () => {
  const f = goalFixture(); f.context.portfolio!.goals[0]!.goalType = 'played'; seal(f);
  assert.ok(associateCandidatesWithPortfolio(f.candidates, f.context).candidates.every(c => !c.goalIds.includes('goal-score')));
});
