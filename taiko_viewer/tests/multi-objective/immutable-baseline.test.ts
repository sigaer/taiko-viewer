/** B4 final review: immutable S1 baseline versus current S2/S3 observations. Synthetic only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { goalFixture } from './goal-fixtures.ts';
import { fixture, seal, type Fixture } from './fixtures.ts';
import { hash, candidateId } from '../../utils/multi-objective/common.ts';
import { validateCandidate } from '../../utils/multi-objective/candidate.ts';
import { associateCandidatesWithPortfolio } from '../../utils/multi-objective/goals.ts';
import { createDecisionId } from '../../utils/multi-objective/context.ts';

const baseline = (f: Fixture) => f.evidence.find(r => r.ref.id === 'baseline-score')!;
const score = (f: Fixture) => f.candidates[0]!;
function advance(f: Fixture, revision: string, day = '25'): Fixture {
  const now = `2026-11-${day}T00:00:00.000Z`;
  f.context.scoreRevision = revision; f.context.asOf = now; f.context.generatedAt = now;
  for (const r of f.evidence) if (['score_snapshot', 'rating', 'estimate', 'growth'].includes(r.ref.kind)) {
    r.ref.sourceRevision = revision; r.ref.knownAt = now; r.ref.observedAt = now;
    if (r.payload.type === 'rating' || r.payload.type === 'score_estimate') (r.payload.samples as Record<string, unknown>).scoreRevision = revision;
  }
  for (const c of f.candidates) {
    c.scoreRevision = revision; c.asOf = now; c.generatedAt = now;
    c.actionability.asOf = now; c.actionability.evaluatedAt = now;
    if (c.playerEvidence.ratingSamples) c.playerEvidence.ratingSamples.scoreRevision = revision;
    if (c.playerEvidence.predictionSamples) c.playerEvidence.predictionSamples.scoreRevision = revision;
    const g = f.context.portfolio?.goals.find(g => g.targetHash === c.targetHash);
    if (g) g.actionability = structuredClone(c.actionability);
  }
  return seal(f);
}
function historical() {
  const f = goalFixture(); f.candidates = [score(f)]; f.context.portfolio!.goals = [f.context.portfolio!.goals[0]!];
  return advance(f, 'scores/2');
}
function assertAccepted(f: Fixture) {
  const before = hash(f);
  assert.deepEqual(validateCandidate(score(f), f.context).issues, []);
  const linked = associateCandidatesWithPortfolio(f.candidates, f.context);
  assert.deepEqual(linked.diagnostics, []); assert.deepEqual(linked.candidates[0]!.goalIds, ['goal-score']);
  assert.deepEqual(validateCandidate(linked.candidates[0], f.context).issues, []);
  assert.equal(hash(f), before, 'validation/association must not change baseline or inputs');
}
function assertRejected(f: Fixture, code?: string) {
  const checked = validateCandidate(score(f), f.context);
  assert.equal(checked.ok, false);
  if (code) assert.ok(checked.issues.some(i => i.code === code), JSON.stringify(checked.issues));
  const linked = associateCandidatesWithPortfolio(f.candidates, f.context);
  assert.ok(linked.candidates.every(c => !c.goalIds.includes('goal-score')));
  assert.ok(linked.diagnostics.length > 0);
}
test('Immutable S1 -> S2: Candidate and Goal association retain S1/900000, target 900001, current S2/900000', () => {
  const f = historical();
  assert.equal(baseline(f).ref.sourceRevision, 'scores/1'); assert.equal(baseline(f).payload.highScore, 900000);
  const target = score(f).target; assert.equal(target.kind === 'score' && target.threshold, 900001);
  assert.equal(score(f).scoreRevision, 'scores/2'); assert.equal(score(f).playerEvidence.predictionSamples!.scoreRevision, 'scores/2');
  assertAccepted(f);
});
test('Immutable baseline survives S2 -> S3 -> S4 without resetting any baseline bytes or commitment', () => {
  const f = historical(), original = hash(baseline(f)), binding = hash(f.context.goalBaselineBindings);
  for (const [revision, day] of [['scores/2', '25'], ['scores/3', '26'], ['scores/4', '27']]) {
    advance(f, revision!, day); assertAccepted(f);
    assert.equal(hash(baseline(f)), original); assert.equal(hash(f.context.goalBaselineBindings), binding);
    assert.equal(f.context.portfolio!.goals[0]!.baselineRef, 'baseline-score');
  }
});
test('Immutable baseline: S2 has reached target, Candidate and association reject further recommendation', () => {
  const f = historical();
  for (const r of f.evidence) if (['score_snapshot', 'score_estimate'].includes(r.payload.type as string)) r.payload.currentBestScore = 900001;
  seal(f); assertRejected(f, 'TARGET_ALREADY_MET'); assert.equal(baseline(f).payload.highScore, 900000);
});
test('Immutable baseline: payload mutation with unchanged digest is rejected', () => {
  const f = historical(); baseline(f).payload.highScore = 920000;
  assertRejected(f, 'EVIDENCE_CONTENT_HASH_MISMATCH');
});
test('Immutable baseline: rehashed mutation plus retargeting cannot replace the frozen Goal baseline', () => {
  const f = historical(), c = score(f), g = f.context.portfolio!.goals[0]!;
  baseline(f).payload.highScore = 920000;
  if (c.target.kind === 'score') c.target.threshold = 920001;
  seal(f); g.target = structuredClone(c.target); g.targetHash = c.targetHash; g.actionability = structuredClone(c.actionability); seal(f);
  assertRejected(f, 'SCORE_BASELINE_IMMUTABILITY_MISMATCH');
});
test('Immutable baseline: rewriting S1 to current S2 is rejected despite a valid payload hash', () => {
  const f = historical(); baseline(f).ref.sourceRevision = 'scores/2'; seal(f);
  assertRejected(f, 'SCORE_BASELINE_SCOPE_MISMATCH');
});
test('Immutable baseline: arbitrary old source revision is not authorized by age', () => {
  const f = historical(); baseline(f).ref.sourceRevision = 'scores/unrelated-old'; seal(f);
  assertRejected(f, 'SCORE_BASELINE_SCOPE_MISMATCH');
});
for (const value of ['', ' ', null]) test(`Immutable baseline: invalid source revision ${String(value)} rejected`, () => {
  const f = historical(); (baseline(f).ref as unknown as Record<string, unknown>).sourceRevision = value; seal(f); assertRejected(f);
});
for (const [field, value] of [['profileId', 'other-player'], ['chartId', 'other-chart']] as const) test(`Immutable baseline: wrong ${field} rejected`, () => {
  const f = historical(); baseline(f).ref[field] = value; seal(f); assertRejected(f, 'SCORE_BASELINE_SCOPE_MISMATCH');
});
test('Immutable baseline: wrong GoalType rejected across revisions', () => {
  const f = historical(); baseline(f).payload.goalType = 'fc'; seal(f); assertRejected(f, 'SCORE_BASELINE_GOAL_TYPE_MISMATCH');
});
test('Immutable baseline: wrong evidence type rejected across revisions', () => {
  const f = historical(), replacement = structuredClone(f.evidence.find(r => r.ref.id === 'estimate-1')!);
  replacement.ref.id = 'baseline-score'; f.evidence = f.evidence.map(r => r.ref.id === 'baseline-score' ? replacement : r); seal(f);
  assertRejected(f, 'SCORE_BASELINE_TYPE_UNSUPPORTED');
});
for (const field of ['ownerId', 'profileId', 'chartId', 'sourceRevision'] as const) test(`Immutable baseline: frozen binding ${field} must match its owner and record`, () => {
  const f = historical(); f.context.goalBaselineBindings = f.context.goalBaselineBindings.map(b => b.baselineRef === 'baseline-score' ? { ...b, [field]: 'unrelated' } : b);
  seal(f); assertRejected(f, 'SCORE_BASELINE_SCOPE_MISMATCH');
});
test('Immutable baseline: wrong context owner cannot consume another owner baseline', () => {
  const f = historical(); f.context.ownerId = 'other-owner'; f.context.portfolio!.ownerId = 'other-owner'; seal(f);
  assertRejected(f, 'SCORE_BASELINE_SCOPE_MISMATCH');
});
test('Immutable baseline: missing frozen binding fails without reconstructing it from current evidence', () => {
  const f = historical(); f.context.goalBaselineBindings = [];
  f.context.decisionId = createDecisionId(f.context); // Do not call the synthetic creation helper.
  score(f).decisionId = f.context.decisionId; score(f).candidateId = candidateId(score(f));
  assertRejected(f, 'SCORE_BASELINE_BINDING_MISSING');
});
test('Immutable baseline: duplicate conflicting binding is rejected', () => {
  const f = historical(); f.context.goalBaselineBindings = [...f.context.goalBaselineBindings, { ...f.context.goalBaselineBindings[0]!, sourceRevision: 'scores/other' }];
  seal(f); assertRejected(f, 'BASELINE_BINDING_CONFLICT');
});
for (const id of ['estimate-1', 'rating', 'snapshot-1']) test(`Current revision: ${id} cannot keep S1 under S2`, () => {
  const f = historical(); f.evidence.find(r => r.ref.id === id)!.ref.sourceRevision = 'scores/1'; seal(f);
  assertRejected(f, 'EVIDENCE_SCORE_REVISION_MISMATCH');
});
for (const id of ['estimate-1', 'rating']) test(`Current revision: ${id} sample payload cannot keep S1 under S2`, () => {
  const f = historical(); (f.evidence.find(r => r.ref.id === id)!.payload.samples as Record<string, unknown>).scoreRevision = 'scores/1'; seal(f);
  assertRejected(f, id === 'rating' ? 'RATING_SAMPLE_PROVENANCE_MISMATCH' : 'PREDICTION_SAMPLE_PROVENANCE_MISMATCH');
});
for (const name of ['predictionSamples', 'ratingSamples'] as const) test(`Current revision: ${name} projection cannot borrow S1 samples under S2`, () => {
  const f = historical(); score(f).playerEvidence[name]!.scoreRevision = 'scores/1'; seal(f);
  assertRejected(f, name === 'ratingSamples' ? 'RATING_SAMPLE_PROVENANCE_MISMATCH' : 'PREDICTION_SAMPLE_PROVENANCE_MISMATCH');
});
test('Current null-ref score_pb: S2 estimate accepted, old S1 estimate rejected', () => {
  const f = fixture(), c = score(f); c.subtype = 'score_pb'; if (c.target.kind === 'score') c.target.threshold = 900001;
  advance(f, 'scores/2'); assert.deepEqual(validateCandidate(c, f.context).issues, []);
  f.evidence.find(r => r.ref.id === 'estimate-1')!.ref.sourceRevision = 'scores/1'; seal(f);
  const issues = validateCandidate(c, f.context).issues;
  assert.ok(issues.some(i => i.code === 'SCORE_BASELINE_SCOPE_MISMATCH'));
  assert.ok(issues.some(i => i.code === 'EVIDENCE_SCORE_REVISION_MISMATCH'));
});
