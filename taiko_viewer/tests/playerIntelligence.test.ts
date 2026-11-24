import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlayerDecisionContext } from '../utils/player-intelligence/context.ts';
import { matchCandidates } from '../utils/player-intelligence/matching.ts';
import { projectNextAction, projectLivingHome } from '../utils/player-intelligence/next-action.ts';
import { inspectExternalArtifact } from '../utils/player-intelligence/external-artifact.ts';
import { adaptExistingCandidates } from '../utils/player-intelligence/adapters.ts';
import { decisionInput, candidate, at } from './fixtures/player-intelligence.ts';

test('context preserves V1 authority, refuses stale revisions, and never substitutes a rating', () => {
  const input = decisionInput(); const context = buildPlayerDecisionContext(input);
  assert.equal(context.longTerm.rating, input.rating!.value);
  input.rating!.revision = 'old'; assert.equal(buildPlayerDecisionContext(input).longTerm.rating, null);
  input.rating!.revision = 'score-1'; input.rating!.observedAt = '2026-11-11T00:00:00Z';
  assert.equal(buildPlayerDecisionContext(input).longTerm.rating, null);
  assert.equal(context.recent.sessionIdentifiability, 'not-inferred');
  assert.throws(() => buildPlayerDecisionContext({ ...input, asOf: '2026-11-10' }), /time/);
  assert.throws(() => buildPlayerDecisionContext({ ...input, asOf: '2026-02-30T00:00:00Z' }), /time/);
});
test('recent projections reject future knowledge and cross-owner facts; incompatible models do not yield trend', () => {
  const input = decisionInput();
  const m = { id: 'm1', ownerId: 'u', bindingId: 'p', capturedAt: '2026-11-02T00:00:00Z', scoreRevision: 's0', measurementVersion: 1, algorithmVersion: 'v1', modelRevision: 'model1', rating: 10, dimensions: {} as any, focus: 'balanced' as const, sampleCount: 20, availabilityState: 'ready' as const };
  const fact = { id: 'f1', factKey: 'f1', ownerId: 'u', bindingId: 'p', type: 'score-pb' as const, evidence: { source: 'score-history' as const, evidenceVersion: 1 }, temporal: { occurredAt: '2025-01-01T00:00:00Z', observedAt: at, precision: 'observation' as const } };
  input.history = { profileId: 'p', observedAt: at, revision: 'h1', value: { profileId: 'p', range: { from: '2026-11-01', to: '2026-11-10', timezone: 'Asia/Shanghai', maxDays: 31 }, facts: [fact, { ...fact, factKey: 'future', temporal: { observedAt: '2026-11-11T00:00:00Z', precision: 'observation' } }, { ...fact, ownerId: 'other', factKey: 'other' }], measurements: [m, { ...m, id: 'm2', capturedAt: at, scoreRevision: 'score-1', rating: 11 }], coverage: { scoreHistoryFrom: null, scoreHistoryTo: null, scoreHistoryState: 'partial', measurementFrom: null, measurementTo: null, measurementState: 'unknown' } } };
  const c = buildPlayerDecisionContext(input);
  assert.deepEqual(c.recent.factKeys, ['f1']); assert.equal(c.recent.comparison.ratingDelta, 1);
  assert.equal(c.confidence.scoreHistoryCoverage, 'partial');
  input.history.value.range.from = '2026-11-09';
  assert.equal(buildPlayerDecisionContext(input).confidence.scoreHistoryCoverage, 'unknown');
  input.history.value.measurements[1].modelRevision = 'model2';
  assert.equal(buildPlayerDecisionContext(input).recent.comparison.ratingDelta, null);
  input.history.value.measurements.push({ ...m, rating: 30 });
  assert.equal(buildPlayerDecisionContext(input).recent.measurements.length, 1);
});
test('stable gate never admits PB-only, future, mismatched or low-confidence candidates to fill K', () => {
  const c = buildPlayerDecisionContext(decisionInput());
  const variants = [candidate(1), candidate(2), candidate(3), candidate(4), candidate(5), candidate(6)];
  variants[1].reach!.stableScore = null;
  variants[2].targetScore = 110;
  variants[3].reach!.confidence = 0.1;
  variants[4].reach!.sourceHash = 'b'.repeat(64);
  variants[5].reach!.featureCutoff = '2026-11-11T00:00:00Z';
  const result = matchCandidates(c, variants, { k: 6, region: 'CN' });
  assert.deepEqual(result.items.map(i => i.chart.key), ['1:4']);
  assert.equal(result.shortage, true); assert.equal(result.rejected.length, 5);
  assert.equal(matchCandidates(c, [candidate()], { k: 1, region: 'JP' }).items.length, 0);
});
test('diversity and explicit preferences operate only inside the admitted pool', () => {
  const input = decisionInput(); input.preferences = { profileId: 'p', observedAt: at, revision: null, value: { preferredChartKeys: ['3:4'], excludedChartKeys: ['2:4'], focus: 'discovery' } };
  const c = buildPlayerDecisionContext(input), a = candidate(1), b = candidate(2), d = candidate(3), duplicate = candidate(4);
  duplicate.chart.identityGroup = a.chart.identityGroup;
  assert.deepEqual(matchCandidates(c, [a,b,d,duplicate], { k: 5, region: 'CN' }).items.map(i => i.chart.key), ['3:4', '1:4']);
  assert.deepEqual(matchCandidates(c, [a,b,d,duplicate], { k: 5, region: 'CN', ranking: 'existing-order' }).items.map(i => i.chart.key), ['1:4', '3:4']);
});
test('next action and home retain public content and explicit navigation without fabricating plays', () => {
  const c = buildPlayerDecisionContext(decisionInput()), result = matchCandidates(c, [], { k: 3, region: 'CN' });
  assert.equal(projectNextAction(c, result).kind, 'insufficient-evidence');
  const action = projectNextAction(c, result, { kind: 'inspect-chart', chartKey: '99:5' });
  assert.equal(action.kind, 'inspect-chart'); assert.equal(action.writesFacts, false);
  const home = projectLivingHome(c, result, { latestSongKeys: ['99:5'], eventIds: ['e1'], communityIds: ['post1'] });
  assert.deepEqual(home.eventIds, ['e1']); assert.deepEqual(home.recent.factKeys, []);
  c.goals!.outcome = 'active'; assert.equal(projectNextAction(c, result).kind, 'refresh-evidence');
  assert.equal(projectNextAction(c, { ...result, profileId: 'other' }).kind, 'refresh-evidence');
});
test('completed goals require existing completion evidence, never automatically create successors', () => {
  const c = buildPlayerDecisionContext(decisionInput()), result = matchCandidates(c, [candidate()], { k: 3, region: 'CN' });
  c.goals!.outcome = 'completed';
  c.goals!.recentCompletedGoal = { id: 'g', profileId: 'p', status: 'completed' } as any;
  assert.equal(projectNextAction(c, result).kind, 'refresh-evidence');
  c.goals!.recentCompletedGoal!.completionEvidence = { evaluationVersion: 1 } as any;
  const next = projectNextAction(c, result);
  assert.equal(next.kind, 'review-completed-goal'); assert.deepEqual(next.suggestions, ['1:4']); assert.equal(next.effect, 'navigation-only');
});
test('external draft envelopes quarantine valid unknown schemas and reject stale coverage', () => {
  const scope = { chart: { namespace: 'wahlap', id: '1', difficultyType: 4 }, catalogRevision: 'c1', sourceHash: 'a'.repeat(64) };
  const artifact = { ...scope, envelopeVersion: 'viewer-analysis-artifact-draft/1', analysis: { producer: 'fixture', version: '1', schema: 'unknown-export' }, featureCoverage: { available: ['opaque'], missing: [] }, featurePayload: { opaque: { arbitrary: 1 } }, evidenceReferences: ['artifact:1'], diagnostics: [] };
  assert.equal(inspectExternalArtifact(JSON.stringify(artifact), scope).status, 'quarantined');
  assert.equal(inspectExternalArtifact(JSON.stringify(artifact), scope).usableForMatching, false);
  assert.equal(inspectExternalArtifact(JSON.stringify({ ...artifact, sourceHash: 'b'.repeat(64) }), scope).status, 'rejected');
  artifact.featureCoverage.available = []; assert.equal(inspectExternalArtifact(JSON.stringify(artifact), scope).reason, 'payload-coverage');
  assert.equal(inspectExternalArtifact('x'.repeat(262145), scope).reason, 'size-limit');
});

test('existing ordinary rows require independent estimator evidence; strict range cannot supply it', () => {
  const c = buildPlayerDecisionContext(decisionInput()), chart = candidate().chart;
  const ordinary = { model: 'v1' as const, basis: 'rating', profileId: 'p', scoreRevision: 'score-1', generatedAt: at, image: null,
    items: [{ songId: 1, level: 4, title: 'fixture', isUnplayed: true, candidateIndicator: 10, referenceIndicator: 10, deviationRatio: 0, inStrictRange: true, starLevel: 8, recommendationToken: '', canCreateGoal: false }] };
  const missing = adaptExistingCandidates(c, ordinary, [chart], [], new Map([['1:4', 100]]));
  assert.equal(matchCandidates(c, missing, { k: 1, region: 'CN' }).items.length, 0);
  const source = { profileId: 'p', scoreRevision: 'score-1', catalogRevision: 'catalog-1', sourceHash: chart.sourceHash, generatedAt: at, featureCutoff: at, modelVersion: 'existing-fixture', evidenceRefs: ['estimate:1'],
    estimate: { song_id: 1, level: 4, current_score: 90, reliability: 80, data_sufficiency: 'ok', stable: { score: 100 }, pb: { score: 120 } } };
  const adapted = adaptExistingCandidates(c, ordinary, [chart], [source], new Map([['1:4', 100]]));
  assert.equal(adapted[0].reach!.confidence, 0.8);
  assert.equal(matchCandidates(c, adapted, { k: 1, region: 'CN' }).items.length, 1);
  assert.throws(() => adaptExistingCandidates(c, ordinary, [chart], [source,source], new Map()), /ambiguous/);
});

test('breakthrough does not relax stable reach and user commitments remain review actions', () => {
  const input = decisionInput(); input.preferences = { profileId: 'p', observedAt: at, revision: null, value: { preferredChartKeys: [], excludedChartKeys: [], focus: 'breakthrough' } };
  const c = buildPlayerDecisionContext(input), row = candidate();
  assert.equal(matchCandidates(c, [row], { k: 1, region: 'CN' }).items.length, 0);
  row.currentBestScore = 90; assert.equal(matchCandidates(c, [row], { k: 1, region: 'CN' }).items.length, 1);
  row.targetScore = 110; assert.equal(matchCandidates(c, [row], { k: 1, region: 'CN' }).items.length, 0);
  const empty = matchCandidates(c, [], { k: 1, region: 'CN' });
  c.goals!.outcome = 'active'; c.goals!.activeGoal = { id: 'g', profileId: 'p', status: 'active', songId: 1, difficultyType: 4, unavailable: false } as any;
  assert.equal(projectNextAction(c, empty).kind, 'review-active-goal');
  c.goals!.activeGoal!.unavailable = true; assert.equal(projectNextAction(c, empty).kind, 'resolve-unavailable-goal');
  c.goals!.outcome = 'inconclusive'; assert.equal(projectNextAction(c, empty).kind, 'refresh-evidence');
});

test('late confirmation is recent knowledge, frozen inputs are not mutated, non-finite rating fails closed', () => {
  const input = decisionInput(); input.rating!.value.sampleCount = NaN;
  assert.equal(buildPlayerDecisionContext(input).longTerm.rating, null);
  const clean = decisionInput(); Object.freeze(clean.rating!.value); Object.freeze(clean.rating); Object.freeze(clean);
  const context = buildPlayerDecisionContext(clean), row = candidate();
  Object.freeze(row.chart); Object.freeze(row.reach); Object.freeze(row);
  const before = JSON.stringify(row); matchCandidates(context, Object.freeze([row]), { k: 1, region: 'CN' }); assert.equal(JSON.stringify(row), before);
});
