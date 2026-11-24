import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fixture, interest, seal, stretch, portfolio, record, type Fixture } from './fixtures.ts';
import { goalFixture } from './goal-fixtures.ts';
import { levelDiscovery } from './type-fixtures.ts';
import { hash } from '../../utils/multi-objective/common.ts';
import { createDecisionId } from '../../utils/multi-objective/context.ts';
import { composeRecommendationSlate, createComposeInputsHash } from '../../utils/multi-objective/composer.ts';
import { classifyPriorityGroup, createSlateCardId, validatePrioritySlate } from '../../utils/multi-objective/priority.ts';
import { resolveCanonicalChartIdentity } from '../../utils/multi-objective/identity.ts';
import type { MultiObjectiveCandidate, SlateCard, PriorityGroup } from '../../utils/multi-objective/contracts.ts';
function compose(f: Fixture) { const r = composeRecommendationSlate(f.candidates, f.context, f.options); assert.ok(r.ok, JSON.stringify(r.issues)); return r.value; }
function card(c: MultiObjectiveCandidate, group: PriorityGroup = 'A'): SlateCard {
  const value: SlateCard = { cardId: '', decisionId: c.decisionId, chartId: c.chartId, identityGroup: c.identityGroup, candidateIds: [c.candidateId], primaryCandidateId: c.candidateId, priorityGroup: group, primaryReadiness: c.readiness, goalLinks: c.goalLinks, supplementalCandidateIds: [], dedupSuppressedCandidateIds: [], repeatReasonCode: null };
  value.cardId = createSlateCardId(value); return value;
}
for (const N of [0, 1, 2, 3, 5]) test(`P01 planned A gate N=${N}`, () => {
  const f = fixture(N), required = Math.ceil(N / 2); f.candidates.slice(required).forEach(stretch); seal(f);
  const gate = validatePrioritySlate(f.candidates.map(c => card(c)), f.candidates);
  assert.equal(gate.N, N); assert.equal(gate.minReady, required); assert.equal(gate.hardGatePassed, true); assert.equal(gate.rate, N ? required / N : null); assert.equal(gate.scope, 'planned_slate'); assert.equal(gate.actualExposureVerified, false);
});
test('P02 R=1 S=8 K=5 shrinks A to 2; only stretch produces empty A', () => {
  const f = fixture(9); f.candidates.slice(1).forEach(stretch); seal(f); const out = compose(f);
  assert.equal(out.groups.A.length, 2); assert.equal(out.qualityGate.R, 1); assert.equal(out.qualityGate.S, 1); assert.equal(out.shortage.A, 3);
  f.candidates.forEach(stretch); seal(f); const g = compose(f); assert.equal(g.groups.A.length, 0); assert.equal(g.qualityGate.rate, null); assert.ok(g.groups.B.length > 0);
});
test('P03 A rejects not_actionable and long_term; D-only interest independent of horizon', () => {
  const f = interest(fixture()); const c = f.candidates[0]!;
  let gate = validatePrioritySlate([card(c)], f.candidates); assert.equal(gate.hardGatePassed, false); assert.ok(gate.violations.includes('A_NOT_ACTIONABLE'));
  c.target.horizon = 'long_term'; seal(f); assert.equal(classifyPriorityGroup(c), 'D');
  const g = fixture(); g.candidates[0]!.target.horizon = 'long_term'; seal(g); gate = validatePrioritySlate([card(g.candidates[0]!)], g.candidates); assert.ok(gate.violations.includes('A_LONG_TERM'));
});
test('P04 every ready-first prefix valid; stretch-only filtered plan fails', () => {
  const f = fixture(5); f.candidates.slice(3).forEach(stretch); seal(f); const out = compose(f);
  for (let n = 0; n <= out.groups.A.length; n++) assert.equal(validatePrioritySlate(out.groups.A.slice(0, n), f.candidates).hardGatePassed, true);
  assert.equal(validatePrioritySlate(out.groups.A.filter(c => c.primaryReadiness === 'reasonable_stretch'), f.candidates).hardGatePassed, false);
});
test('P05 50% passes without requiring 70%; card hash tamper rejected', () => {
  const f = fixture(2); stretch(f.candidates[1]!); seal(f); const out = compose(f);
  assert.equal(out.qualityGate.hardGatePassed, true); assert.equal(out.qualityGate.optimizationTargetMet, false);
  out.groups.A[0]!.cardId = hash('forged'); assert.ok(validatePrioritySlate(out.groups.A, f.candidates).violations.includes('CARD_ID_MISMATCH'));
});
test('C01 multi-target Chart aggregates two independent Goals; score is primary despite high DF priority', () => {
  const f = goalFixture(), before = hash(f), out = compose(f);
  assert.equal(hash(f), before); assert.equal(out.groups.A.length, 1); const c = out.groups.A[0]!;
  assert.equal(c.candidateIds.length, 2); assert.equal(c.goalLinks.length, 2); assert.equal(c.primaryCandidateId, f.candidates[0]!.candidateId);
  assert.equal(c.goalLinks.find(g => g.goalId === 'goal-df')!.actionability.readiness, 'not_actionable');
  const df = f.candidates[1]!; f.options.primaryActionByChart[df.chartId] = { intentType: df.intentType, subtype: df.subtype, targetHash: df.targetHash }; seal(f);
  const override = compose(f); assert.equal(override.groups.A.length, 0); assert.equal(override.groups.C.length, 1); assert.equal(override.groups.C[0]!.primaryCandidateId, f.candidates[1]!.candidateId);
});
test('C02 same song different chart deduplicates and retains suppression diagnostics', () => {
  const f = fixture(), original = f.candidates[0]!, other = structuredClone(original), row = f.context.catalog.charts['1:4']!;
  f.context.catalog.charts['1:5'] = { ...row, chartId: row.songId + ':course:5', difficulty: 5 };
  const r = resolveCanonicalChartIdentity(f.context.catalog, { namespace: 'wahlap', sourceId: '1', difficulty: 5, catalogRevision: f.context.catalogRevision, region: 'CN', businessPolicy: 'cn_current_playable', modelProfile: null }); assert.equal(r.status, 'RESOLVED');
  if (r.status !== 'RESOLVED') return;
  Object.assign(other, { chartId: r.value.chartId, difficultyType: 5, identityMappingRef: r.value.identityMappingRef, legacyChartKey: '1:5' });
  const mapping = new Map<string, string>();
  for (const e of [...f.evidence]) if (e.ref.chartId === original.chartId) {
    const copy = structuredClone(e); mapping.set(e.ref.id, e.ref.id + '-ura'); copy.ref.id += '-ura'; copy.ref.chartId = other.chartId;
    if (copy.payload.type === 'score_estimate') { const samples = copy.payload.samples as any; samples.estimateRef += '-ura'; samples.chartId = other.chartId; samples.evidenceRefs = ['catalog-1-ura']; }
    f.evidence.push(copy);
  }
  other.source.evidenceRefs = ['catalog-1-ura']; other.playerEvidence.snapshotRefs = ['snapshot-1-ura']; other.playerEvidence.estimateRef = 'estimate-1-ura'; other.chartEvidence.catalogRef = 'catalog-1-ura'; other.playerEvidence.predictionSamples = structuredClone(f.evidence.find(e => e.ref.id === 'estimate-1-ura')!.payload.samples as any);
  other.actionability.evidenceRefs = ['rating', 'estimate-1-ura']; other.actionability.confidence.basisRefs = ['rating', 'estimate-1-ura']; f.candidates.push(other); seal(f);
  const out = compose(f); assert.equal(out.groups.A.length, 1); assert.equal(out.groups.A[0]!.dedupSuppressedCandidateIds.length, 1); assert.ok(out.diagnostics.some(d => d.reasonCode === 'SONG_DEDUP'));
});
test('C03 type preference never promotes interest; supported types may be absent', () => {
  const f = fixture(2); interest(f, 1); f.options.typePreferences.discovery = 100; seal(f);
  const out = compose(f); assert.equal(out.groups.A.length, 1); assert.equal(out.groups.D.length, 1); assert.equal(out.groups.A[0]!.primaryCandidateId, f.candidates[0]!.candidateId);
});
test('I02 level-matched Discovery can join A while interest remains D', () => { const f = levelDiscovery(); assert.equal(compose(f).groups.A.length, 1); });
test('C04 actual exposure repeat penalized; incomplete and legacy keys remain unknown', () => {
  const f = fixture(2), c = f.candidates[0]!;
  f.options.capacities.A = 1; f.options.history.items = [{ profileId: c.profileId, chartId: c.chartId, identityGroup: c.identityGroup, at: '2026-11-23T00:00:00.000Z', targetHash: c.targetHash }]; seal(f);
  const out = compose(f); assert.equal(out.groups.A[0]!.primaryCandidateId, f.candidates[1]!.candidateId); assert.equal(out.groups.B[0]!.repeatReasonCode, 'QUALIFIED_SHORTAGE');
  f.options.history.items[0]!.chartId = '1:4'; seal(f); assert.equal(compose(f).repeatHistory, 'unknown');
  f.options.history = { completeFrom: null, through: null, items: [] }; seal(f); assert.equal(compose(f).repeatHistory, 'unknown');
});
test('R10 B3 report bytes preserved; unresolved historical keys cannot prove novelty', () => {
  for (const [name, expected] of [['existing-baseline.json', 'ed6ed2b0f0bfce8ef197536a0e81f32a9115d133b235f5dd69d8e3b02b53f36f'], ['offline-benchmark.json', 'acf208e6efb5a62b44e9b4a33f526c52e7cab03574c02400d114b90337e57bbc']]) {
    const bytes = readFileSync(new URL(`../../../docs/batch3/evidence/${name}`, import.meta.url)); assert.equal(createHash('sha256').update(bytes).digest('hex'), expected);
  }
});
test('C06 deterministic under candidate, evidence, alias, row and history reordering', () => {
  const f = fixture(10); f.candidates.slice(6).forEach(stretch);
  f.options.history.items = f.candidates.slice(0, 2).map(c => ({ profileId: c.profileId, chartId: c.chartId, identityGroup: c.identityGroup, at: '2026-11-23T00:00:00.000Z', targetHash: c.targetHash })); seal(f);
  const expected = compose(f), decision = f.context.decisionId;
  for (let n = 0; n < 8; n++) {
    f.candidates.reverse(); f.evidence.reverse(); f.context.catalog.sourceAliases.reverse(); f.context.catalog.charts = Object.fromEntries(Object.entries(f.context.catalog.charts).reverse()); f.options.history.items.reverse();
    assert.equal(createComposeInputsHash(f.options), f.context.decisionInputsHash); assert.equal(createDecisionId(f.context), decision); assert.deepEqual(compose(f), expected);
  }
});
test('C06 budgets, invalid options, future history are explicit errors', () => {
  const f = fixture(); assert.equal(composeRecommendationSlate(Array(5001).fill(f.candidates[0]), f.context, f.options).ok, false);
  f.options.capacities.A = 51; assert.equal(composeRecommendationSlate(f.candidates, f.context, f.options).ok, false);
  f.options.capacities.A = 1; f.options.maxTotal = 51; assert.equal(composeRecommendationSlate(f.candidates, f.context, f.options).ok, false);
  f.options.maxTotal = 1; f.options.history.through = '2026-11-25T00:00:00.000Z'; seal(f); assert.equal(composeRecommendationSlate(f.candidates, f.context, f.options).ok, false);
});
test('duplicates collapse, conflicting ID rejects both, shortages never fill with invalid candidates', () => {
  const f = fixture(); f.candidates.push(structuredClone(f.candidates[0]!)); assert.equal(compose(f).groups.A.length, 1);
  f.candidates[1]!.readiness = 'not_actionable'; const out = compose(f); assert.equal(out.groups.A.length, 0); assert.ok(out.diagnostics.some(d => d.reasonCode === 'CANDIDATE_ID_CONFLICT'));
});
test('A/B/C/D total and per-group capacity; empty input returns null A rate', () => {
  const f = fixture(20); f.options.maxTotal = 3; seal(f); const out = compose(f); assert.equal(Object.values(out.groups).flat().length, 3);
  const empty = fixture(0); const none = compose(empty); assert.equal(none.qualityGate.rate, null); assert.equal(none.qualityGate.hardGatePassed, true);
});
test('manual active priority then order govern equally ready candidates; paused Goal supplies no boost', () => {
  const f = fixture(3), p = portfolio(f);
  for (const [n, c] of f.candidates.entries()) {
    const baselineRef = `baseline-${n}`; c.subtype = 'score_pb'; c.target = { kind: 'score', threshold: 900001, comparison: 'gte', baselineRef, horizon: 'near_term', definitionVersion: 'target/1' }; c.targetHash = hash(c.target); c.actionability.targetHash = c.targetHash; c.actionability.evaluatorId = 'b4-contract:score_pb';
    f.evidence.push(record(baselineRef, 'goal_baseline', 'goal-portfolio', c.chartId, c.catalogRevision, { type: 'goal_baseline', goalType: 'score-pb', highScore: 900000, total: null, ng: null, mode: null, platform: null }));
    p.goals.push({ id: `goal-${n}`, profileId: c.profileId, chartId: c.chartId, identityMappingRef: c.identityMappingRef, goalType: 'score-pb', goalRevision: '1', baselineRef, target: structuredClone(c.target), targetHash: c.targetHash, lifecycleStatus: 'active', availability: 'available', userPriority: n === 0 ? 1 : 3, userOrder: n === 1 ? 5 : 1, actionability: structuredClone(c.actionability), evaluationRef: null });
  }
  seal(f); assert.deepEqual(compose(f).groups.A.map(c => c.chartId), [f.candidates[2]!.chartId, f.candidates[1]!.chartId, f.candidates[0]!.chartId]);
  p.goals[2]!.lifecycleStatus = 'paused'; seal(f); assert.deepEqual(compose(f).groups.A.map(c => c.chartId), [f.candidates[1]!.chartId, f.candidates[0]!.chartId, f.candidates[2]!.chartId]);
});
test('type preferences rank only within equally qualified actions', () => {
  const f = levelDiscovery(), extra = fixture(2);
  f.context.catalog.charts['2:4'] = extra.context.catalog.charts['2:4']!; f.context.catalog.sourceAliases.push(extra.context.catalog.sourceAliases[1]!);
  f.candidates.push(extra.candidates[1]!); for (const r of extra.evidence) if (!f.evidence.some(e => e.ref.id === r.ref.id)) f.evidence.push(r);
  f.options.capacities.A = 1; f.options.typePreferences.score_improvement = 100; seal(f); assert.equal(compose(f).groups.A[0]!.chartId, f.candidates[1]!.chartId);
  f.options.typePreferences = { discovery: 100 }; seal(f); assert.equal(compose(f).groups.A[0]!.chartId, f.candidates[0]!.chartId);
});
