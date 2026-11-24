import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, interest, seal, stretch, type Fixture } from './fixtures.ts';
import { validateCandidate } from '../../utils/multi-objective/candidate.ts';
import { hash } from '../../utils/multi-objective/common.ts';
const codes = (f: Fixture) => validateCandidate(f.candidates[0], f.context).issues.map(i => i.code);
const valid = (f: Fixture) => assert.deepEqual(codes(f), []);
const mutations: [string, (f: Fixture) => void, string][] = [
  ['schema version', f => { (f.candidates[0] as any).schemaVersion = 'candidate/2'; }, 'ENUM_VALUE'],
  ['unknown field', f => { (f.candidates[0] as any).successProbability = .99; }, 'UNKNOWN_FIELD'],
  ['canonical fabrication', f => { f.candidates[0]!.chartId = 'song:fake:course:4'; }, 'CHART_ID_UNRESOLVED'],
  ['mapping absent', f => { f.candidates[0]!.identityMappingRef = hash('fake'); }, 'IDENTITY_MAPPING_UNVERIFIED'],
  ['namespace', f => { f.candidates[0]!.sourceNamespace = 'numeric'; }, 'IDENTITY_MAPPING_UNVERIFIED'],
  ['catalog revision', f => { f.candidates[0]!.catalogRevision = hash('other'); }, 'CONTEXT_BINDING_MISMATCH'],
  ['policy version', f => { f.candidates[0]!.policyVersion = 'fake'; }, 'CONTEXT_BINDING_MISMATCH'],
  ['target hash', f => { f.candidates[0]!.targetHash = hash('other'); }, 'TARGET_HASH_MISMATCH'],
  ['candidate id', f => { f.candidates[0]!.candidateId = hash('other'); }, 'CANDIDATE_ID_MISMATCH'],
  ['future generatedAt', f => { f.candidates[0]!.generatedAt = '2026-11-25T00:00:00.000Z'; }, 'EVIDENCE_FUTURE'],
  ['invalid timestamp', f => { f.candidates[0]!.asOf = '2026-02-30T00:00:00.000Z'; }, 'EXPECTED_UTC_TIMESTAMP'],
  ['extra evidence', f => { f.candidates[0]!.evidenceRefs.push('fake'); }, 'EVIDENCE_UNION_MISMATCH'],
  ['duplicate evidence', f => { f.candidates[0]!.evidenceRefs.push(f.candidates[0]!.evidenceRefs[0]!); }, 'DUPLICATE_ITEM'],
  ['forged creation capability', f => { f.candidates[0]!.diagnostics.canCreateGoal = true; }, 'OFFLINE_GOAL_CREATION_NOT_AUTHORIZED'],
  ['diagnostic projection', f => { f.candidates[0]!.diagnostics.reasonCodes = ['SCORE_PB_ONLY']; }, 'DIAGNOSTICS_PROJECTION_MISMATCH'],
  ['unknown evaluator', f => { f.candidates[0]!.actionability.evaluatorId = 'score-for-all'; }, 'EVALUATOR_UNREGISTERED'],
  ['evaluator version', f => { f.candidates[0]!.actionability.evaluatorVersion = '2'; }, 'EVALUATOR_UNREGISTERED'],
  ['unknown reason code', f => { f.candidates[0]!.actionability.reasonCodes = ['GUARANTEED_WIN']; }, 'REASON_CODE_UNREGISTERED'],
  ['confidence probability semantics', f => { (f.candidates[0]!.actionability.confidence as any).subject = 'success_probability'; }, 'ENUM_VALUE'],
  ['cross-chart evidence', f => { f.evidence.find(r => r.ref.kind === 'estimate')!.ref.chartId = 'another'; seal(f); }, 'EVIDENCE_SCOPE_MISMATCH'],
  ['cross-profile evidence', f => { f.evidence.find(r => r.ref.kind === 'estimate')!.ref.profileId = 'other'; seal(f); }, 'EVIDENCE_SCOPE_MISMATCH'],
  ['cross-catalog evidence', f => { f.evidence.find(r => r.ref.kind === 'estimate')!.ref.catalogRevision = hash('other'); seal(f); }, 'EVIDENCE_SCOPE_MISMATCH'],
  ['future evidence', f => { f.evidence.find(r => r.ref.kind === 'estimate')!.ref.knownAt = '2026-11-25T00:00:00.000Z'; seal(f); }, 'EVIDENCE_FUTURE'],
  ['illegal producer namespace', f => { f.evidence[0]!.ref.source = 'not-rating-authority'; seal(f); }, 'EVIDENCE_NAMESPACE_MISMATCH'],
  ['payload hash', f => { f.evidence[0]!.payload.dimensions = {}; }, 'EVIDENCE_CONTENT_HASH_MISMATCH'],
  ['conflicting evidence ID', f => { const r = structuredClone(f.evidence[0]!); r.payload.dimensions = {}; f.evidence.push(r); seal(f); }, 'EVIDENCE_ID_CONFLICT'],
  ['score revision', f => { f.evidence[0]!.ref.sourceRevision = 'other'; seal(f); }, 'EVIDENCE_SCORE_REVISION_MISMATCH'],
  ['rating unit is not attempts', f => { (f.candidates[0]!.playerEvidence.ratingSamples as any).unit = 'attempts'; }, 'ENUM_VALUE'],
  ['prediction unit cannot be Rating rows', f => { (f.candidates[0]!.playerEvidence.predictionSamples as any).unit = 'rating_result_rows'; }, 'ENUM_VALUE'],
  ['copy Rating count into prediction', f => { f.candidates[0]!.playerEvidence.predictionSamples!.stableNeighborCount = 200; }, 'PREDICTION_SAMPLE_PROVENANCE_MISMATCH'],
  ['prediction sample revision', f => { f.candidates[0]!.playerEvidence.predictionSamples!.scoreRevision = 'other'; }, 'PREDICTION_SAMPLE_PROVENANCE_MISMATCH'],
  ['future feature cutoff', f => { f.candidates[0]!.playerEvidence.predictionSamples!.featureCutoff = '2026-11-25T00:00:00.000Z'; }, 'EVIDENCE_FUTURE'],
  ['goal projection without portfolio', f => { f.candidates[0]!.goalIds = ['forged']; }, 'GOAL_IDS_PROJECTION_MISMATCH'],
  ['oversized evidence', f => { f.candidates[0]!.evidenceRefs = Array.from({ length: 257 }, (_, n) => String(n)); }, 'ARRAY_BUDGET_OR_TYPE'],
  ['non-finite target', f => { (f.candidates[0]!.target as any).threshold = Infinity; }, 'INTEGER_RANGE'],
  ['unsupported target', f => { (f.candidates[0]!.target as any).kind = 'played'; }, 'TARGET_UNSUPPORTED'],
];
for (const [name, mutate, expected] of mutations) test(`Candidate strict ingress: ${name}`, () => { const f = fixture(); mutate(f); assert.ok(codes(f).includes(expected), JSON.stringify(codes(f))); });
test('R04 Interest Discovery works without Rating, predictions, scoreRevision or raw sourceHash', () => {
  const f = interest(fixture()), c = f.candidates[0]!;
  f.context.scoreRevision = null; c.scoreRevision = null; c.sourceHash = null;
  f.evidence.find(r => r.ref.id === c.chartEvidence.catalogRef)!.payload.sourceHash = null;
  seal(f); valid(f); assert.equal(c.readiness, 'not_actionable'); assert.equal(c.playerEvidence.predictionSamples, null);
});
test('R05 interest high confidence cannot become level fit or a sixth intent', () => {
  const f = interest(fixture()); f.candidates[0]!.readiness = 'ready_now'; f.candidates[0]!.actionability.missingEvidence = []; seal(f);
  assert.ok(codes(f).includes('INTEREST_DISCOVERY_D_ONLY'));
  f.candidates[0]!.intentType = 'personal_goal' as any; assert.ok(codes(f).includes('ENUM_VALUE'));
});
test('R07 prediction samples null remain null, with explicit missing diagnostic', () => {
  const f = fixture(), c = f.candidates[0]!;
  c.playerEvidence.predictionSamples = null; c.readiness = 'not_actionable'; c.actionability.confidence.level = 'unknown';
  c.actionability.missingEvidence = ['predictionSamples']; c.actionability.reasonCodes = ['PREDICTION_SAMPLE_EVIDENCE_MISSING']; seal(f); valid(f);
  assert.equal(c.playerEvidence.predictionSamples, null);
  c.actionability.missingEvidence = []; seal(f); assert.ok(codes(f).includes('PREDICTION_MISSING_DIAGNOSTIC_REQUIRED'));
});
for (const neighbor of [null, 0]) test(`R07 Rating 200 cannot repair target neighbors=${neighbor}`, () => {
  const f = fixture(); f.candidates[0]!.playerEvidence.predictionSamples!.stableNeighborCount = neighbor;
  (f.evidence.find(r => r.ref.kind === 'estimate')!.payload.samples as any).stableNeighborCount = neighbor;
  seal(f); assert.ok(codes(f).includes(neighbor === null ? 'PREDICTION_SAMPLE_EVIDENCE_MISSING' : 'PREDICTION_SAMPLE_INSUFFICIENT'));
});
test('R08 low global Rating fails despite sufficient chart prediction', () => {
  const f = fixture(); f.candidates[0]!.playerEvidence.ratingSamples!.sampleCount = 19;
  (f.evidence[0]!.payload.samples as any).sampleCount = 19; seal(f); assert.ok(codes(f).includes('RATING_SAMPLE_INSUFFICIENT'));
});
test('R09 fewer than 20 neighbors, unknown pool count, preserved Rating duplicates are valid', () => {
  const f = fixture(); valid(f); assert.equal(f.candidates[0]!.playerEvidence.predictionSamples!.stableNeighborCount, 8); assert.equal(f.candidates[0]!.playerEvidence.predictionSamples!.poolCount, null);
});
test('T01 PB-only cannot establish stable readiness', () => { const f = fixture(); f.evidence.find(r => r.ref.kind === 'estimate')!.payload.stableScore = null; seal(f); assert.ok(codes(f).includes('SCORE_STABLE_EVIDENCE_MISSING')); });
test('T02 score boundary ready / <=2% stretch / >2% rejected', () => {
  const f = fixture(), c = f.candidates[0]!; (c.target as any).threshold = 1000000; seal(f); valid(f);
  stretch(c); (c.target as any).threshold = 1020000; seal(f); valid(f);
  (c.target as any).threshold = 1020001; seal(f); assert.ok(codes(f).includes('SCORE_TARGET_OUTSIDE_READINESS_BOUND'));
});
test('T03 legacy score-pb binding only baseline+1 and safe integers', () => {
  for (const delta of [0, 1, 2]) { const f = fixture(), c = f.candidates[0]!; c.subtype = 'score_pb'; (c.target as any).threshold = 900000 + delta; seal(f); assert.equal(codes(f).includes('SCORE_TARGET_BINDING_MISMATCH'), delta !== 1); if (delta === 1) valid(f); }
  const f = fixture(); (f.candidates[0]!.target as any).threshold = Number.MAX_SAFE_INTEGER + 1; assert.ok(codes(f).includes('INTEGER_RANGE'));
});
test('T08 coverage unknown cannot be relabelled unplayed or no-score', () => {
  const f = interest(fixture()); f.candidates[0]!.playerEvidence.recordState = 'unplayed_confirmed'; assert.ok(codes(f).includes('UNPLAYED_COVERAGE_UNVERIFIED'));
  f.candidates[0]!.playerEvidence.recordState = 'no_score_record'; assert.ok(codes(f).includes('NO_SCORE_RECORD_UNVERIFIED'));
});
test('C05 rejected user exclusion and CN Authority cannot authorize JP', () => {
  const f = fixture(); f.context.excludedChartIds = [f.candidates[0]!.chartId]; seal(f); assert.ok(codes(f).includes('USER_EXCLUDED'));
  f.context.excludedChartIds = []; f.context.region = 'JP'; f.candidates[0]!.region = 'JP'; seal(f); assert.ok(codes(f).includes('IDENTITY_MAPPING_UNVERIFIED'));
});
