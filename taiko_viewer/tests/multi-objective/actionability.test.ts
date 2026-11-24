import test from 'node:test';
import assert from 'node:assert/strict';
import { seal, interest, fixture, type Fixture } from './fixtures.ts';
import { crown, levelDiscovery, dimension, taskFixture } from './type-fixtures.ts';
import { validateCandidate } from '../../utils/multi-objective/candidate.ts';
const issues = (f: Fixture) => validateCandidate(f.candidates[0], f.context).issues.map(i => i.code);
const valid = (f: Fixture) => assert.deepEqual(issues(f), []);
test('R06 dedicated level-fit validates independently of interest', () => {
  const f = levelDiscovery(); valid(f);
  f.evidence.find(r => r.ref.id === 'load-1')!.payload.targetHash = 'a'.repeat(64); seal(f); assert.ok(issues(f).includes('LOAD_FIT_EVIDENCE_INVALID'));
  f.evidence = f.evidence.filter(r => r.ref.id !== 'load-1'); seal(f); assert.ok(issues(f).includes('LOAD_FIT_EVIDENCE_INVALID'));
});
test('R06/R08 level-fit needs both Rating and prediction samples', () => {
  const f = levelDiscovery(); f.candidates[0]!.playerEvidence.predictionSamples = null; seal(f); assert.ok(issues(f).includes('PREDICTION_SAMPLE_EVIDENCE_MISSING'));
  const g = levelDiscovery(); g.candidates[0]!.playerEvidence.ratingSamples = null; seal(g); assert.ok(issues(g).includes('RATING_SAMPLE_INSUFFICIENT'));
});
test('T04 score evaluator cannot impersonate FC/DF output', () => {
  for (const subtype of ['full_combo', 'dondaful_combo'] as const) { const f = fixture(), c = f.candidates[0]!; c.intentType = 'crown_completion'; c.subtype = subtype; c.target = { kind: 'crown', crown: subtype, horizon: 'near_term', definitionVersion: 'target/1' }; seal(f); assert.ok(issues(f).includes('CROWN_ATTEMPTS_MISSING')); c.actionability.evaluatorId = 'b4-contract:score_target'; assert.ok(issues(f).includes('EVALUATOR_UNREGISTERED')); }
});
for (const subtype of ['clear', 'full_combo', 'dondaful_combo', 'ng_reduction'] as const) test(`T05 ${subtype} distinct three-attempt evidence / two-attempt stretch`, () => {
  const f = crown(subtype); valid(f);
  f.candidates[0]!.playerEvidence.attemptRefs = ['attempt-2', 'attempt-3']; f.evidence.find(r => r.ref.id === 'attempt-window')!.payload.attemptRefs = ['attempt-2', 'attempt-3'];
  seal(f); assert.ok(issues(f).includes('CROWN_ATTEMPTS_MISSING'));
  f.candidates[0]!.readiness = 'reasonable_stretch'; f.candidates[0]!.actionability.confidence.level = 'medium'; f.candidates[0]!.actionability.reasonCodes = ['CROWN_BOUNDED_STRETCH']; seal(f); valid(f);
});
test('T05 aggregate combo, duplicate attempt, cherry-picked window and one-day ready rejected', () => {
  const a = crown(); a.candidates[0]!.playerEvidence.recordSemantics = 'aggregate_or_unknown'; assert.ok(issues(a).includes('AGGREGATE_NOT_ATTEMPT'));
  const b = crown(); b.evidence.find(r => r.ref.id === 'attempt-2')!.payload.attemptId = 'play-1'; seal(b); assert.ok(issues(b).includes('CROWN_ATTEMPT_SCOPE_INVALID'));
  const c = crown(); c.evidence = c.evidence.filter(r => r.ref.id !== 'attempt-window'); seal(c); assert.ok(issues(c).includes('CROWN_ATTEMPT_WINDOW_UNVERIFIED'));
  const d = crown(); for (const r of d.evidence.filter(r => r.ref.kind === 'attempt')) r.ref.occurredAt = '2026-11-23T00:00:00.000Z'; seal(d); assert.ok(issues(d).includes('CROWN_ATTEMPTS_MISSING'));
});
test('T06 Clear gauge requirement cannot be substituted by score; NG totals must match', () => {
  const a = crown('clear'); a.evidence.find(r => r.ref.id === 'attempt-3')!.payload.clearRequirement = null; seal(a); assert.ok(issues(a).includes('CROWN_NEAR_CONTRACT_FAILED'));
  const b = crown('ng_reduction'); b.evidence.find(r => r.ref.id === 'baseline-ng')!.payload.total = 999; seal(b); assert.ok(issues(b).includes('CROWN_BASELINE_INCOMPARABLE'));
});
test('T07 explicit dimension focus needs player, chart and independent load fit', () => {
  const f = dimension(); valid(f);
  f.candidates[0]!.chartEvidence.verifiedDimensions = []; seal(f); assert.ok(issues(f).includes('DIMENSION_CHART_MISSING'));
  const g = dimension(); g.evidence.find(r => r.ref.id === 'growth')!.payload.globalConsistency = 'unknown'; seal(g); assert.ok(issues(g).includes('DIMENSION_PLAYER_INCONSISTENT'));
  const h = dimension(); h.evidence = h.evidence.filter(r => r.ref.id !== 'focus'); seal(h); assert.ok(issues(h).includes('DIMENSION_FOCUS_OR_WEAKNESS_UNSUPPORTED'));
});
test('T08 coverage complete / queried missing / unknown remain distinct', () => {
  const f = interest(fixture()), c = f.candidates[0]!, cov = f.evidence.find(r => r.ref.id === 'coverage-1')!;
  valid(f);
  cov.payload.queryExecuted = true; cov.payload.recordPresent = false; cov.payload.completeness = 'partial'; c.playerEvidence.recordState = 'no_score_record'; seal(f); valid(f);
  cov.payload.completeness = 'complete'; cov.payload.absenceSemantics = 'unplayed'; cov.payload.noFilters = true; cov.payload.from = '2000-01-01T00:00:00.000Z'; cov.payload.to = c.asOf; c.playerEvidence.recordState = 'unplayed_confirmed'; seal(f); valid(f);
  cov.payload.difficultyScope = [5]; seal(f); assert.ok(issues(f).includes('UNPLAYED_COVERAGE_UNVERIFIED'));
});
test('T09 real definition and progress required; expired task rejected', () => {
  const f = taskFixture(); valid(f); f.evidence.find(r => r.ref.id === 'task')!.payload.validTo = '2026-11-01T00:00:00.000Z'; seal(f); assert.ok(issues(f).includes('TASK_EXPIRED_OR_FUTURE'));
  const g = taskFixture(); delete g.evidence.find(r => r.ref.id === 'task')!.payload.progressRevision; seal(g); assert.ok(issues(g).length);
});
test('T10 same-attempt task never inferred from independent historical PBs', () => {
  const f = taskFixture(); f.candidates[0]!.readiness = 'ready_now'; f.candidates[0]!.actionability.confidence.level = 'high'; f.candidates[0]!.actionability.missingEvidence = []; seal(f); assert.ok(issues(f).includes('TASK_ACTIONABILITY_EVALUATOR_UNAVAILABLE'));
});
