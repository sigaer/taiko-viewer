import test from 'node:test';
import assert from 'node:assert/strict';
import { crown, dimension, levelDiscovery, taskFixture } from './type-fixtures.ts';
import { seal, fixture, type Fixture } from './fixtures.ts';
import { validateCandidate } from '../../utils/multi-objective/candidate.ts';
const codes = (f: Fixture) => validateCandidate(f.candidates[0], f.context).issues.map(i => i.code);
test('Review: already met NG goal cannot remain actionable', () => {
  const f = crown('ng_reduction'); f.evidence.find(r => r.ref.id === 'snapshot-1')!.payload.ng = 8; seal(f); assert.ok(codes(f).includes('TARGET_ALREADY_MET'));
});
test('Review: authoritative rank already reached without relying on score mapping', () => {
  const f = fixture(), c = f.candidates[0]!; c.subtype = 'rank_upgrade'; c.target = { kind: 'rank', threshold: 5, comparison: 'gte', requirementRef: null, horizon: 'near_term', definitionVersion: 'target/1' }; c.readiness = 'not_actionable'; c.actionability.confidence.level = 'unknown'; c.actionability.reasonCodes = ['SCORE_RANK_MAPPING_MISSING']; c.actionability.missingEvidence = ['rank.requirement']; seal(f); assert.ok(codes(f).includes('TARGET_ALREADY_MET'));
});
test('Review: multiple snapshots cannot hide an acquired crown in D', () => {
  const f = crown(), c = f.candidates[0]!, r = structuredClone(f.evidence.find(r => r.ref.id === 'snapshot-1')!);
  r.ref.id = 'snapshot-extra'; (r.payload.crowns as any).full_combo = true; f.evidence.push(r); c.playerEvidence.snapshotRefs.push(r.ref.id); c.readiness = 'not_actionable'; c.actionability.confidence.level = 'unknown'; seal(f);
  assert.ok(codes(f).includes('TARGET_ALREADY_MET')); assert.ok(codes(f).includes('CURRENT_SNAPSHOT_CONFLICT'));
});
test('Review: unplayed cannot coexist with a known positive PB', () => {
  const f = levelDiscovery(), c = f.candidates[0]!; c.playerEvidence.snapshotRefs = []; c.playerEvidence.recordState = 'unplayed_confirmed'; f.evidence.find(r => r.ref.id === 'coverage-1')!.payload.recordPresent = false; seal(f); assert.ok(codes(f).includes('RECORD_STATE_CONFLICT'));
});
test('Review: explicit training focus does not authorize a weakness claim', () => {
  const f = dimension(); f.candidates[0]!.actionability.reasonCodes = ['DIMENSION_WEAKNESS_CORROBORATED']; seal(f); assert.ok(codes(f).includes('WEAKNESS_EVALUATOR_UNAVAILABLE'));
});
test('Review: type-specific reasons and limitations cannot be replaced by another type', () => {
  const f = dimension(); f.candidates[0]!.actionability.reasonCodes = ['CROWN_FC_NEAR_EVIDENCE']; f.candidates[0]!.actionability.limitations = ['anything']; seal(f); assert.ok(codes(f).includes('REASON_CODE_TYPE_MISMATCH')); assert.ok(codes(f).includes('TYPE_LIMITATIONS_REQUIRED'));
});
for (const [name, make, id] of [['coverage', levelDiscovery, 'coverage-1'], ['attempt window', () => crown(), 'attempt-window'], ['task progress', taskFixture, 'task']] as const) test(`Review: ${name} internal timestamp cannot postdate own knowledge`, () => {
  const f = make(), r = f.evidence.find(r => r.ref.id === id)!; r.ref.knownAt = '2026-11-23T00:00:00.000Z'; r.ref.observedAt = r.ref.knownAt; seal(f); assert.ok(codes(f).includes('PAYLOAD_TIME_AFTER_KNOWLEDGE'));
});
test('Review: NG baseline mode must be comparable, null cannot be inferred', () => {
  const f = crown('ng_reduction'); f.evidence.find(r => r.ref.id === 'baseline-ng')!.payload.mode = null; seal(f); assert.ok(codes(f).includes('CROWN_BASELINE_MODE_UNVERIFIED'));
});
