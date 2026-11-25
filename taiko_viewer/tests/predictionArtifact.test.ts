import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptCohortArtifact, validateArtifact } from '../utils/prediction-evidence/artifact.ts';
import type { CohortPriorArtifact, EvidenceScope } from '../utils/prediction-evidence/types.ts';

const scope: EvidenceScope = {
  canonicalChartId: 'catalog-chart-a', chartRevision: 'chart-r1', profileId: 'candidate-profile',
  playerProfileRevision: 'profile-r1', scoreRevision: 'score-r1', catalogRevision: 'catalog-r1',
};
const query = { rating: 12, ratingDefinition: 'fixture-rating/1', region: 'fixture', ruleset: 'fixture/1',
  asOf: '2026-11-25T00:00:00Z', populationScopeRevision: 'disjoint-r1', allowSynthetic: true };
function fixture(): CohortPriorArtifact {
  const node = { rating: 10, distinctPlayerCount: 24, effectiveSampleSize: 20,
    scoreDistribution: [{ score: 700_000, weight: 1 }, { score: 800_000, weight: 2 }, { score: 900_000, weight: 1 }],
    scoreQ25: 700_000, scoreQ50: 800_000, scoreQ75: 800_000,
    observed: { fc: { numerator: 2, denominator: 24, semantics: 'observed-best-snapshot-rate' as const }, df: null, clear: null },
    uncertainty: { method: 'fixture-bootstrap/1', standardError: 10_000 },
    selectionCoverage: { eligiblePlayers: 60, observedPlayers: 40, limitations: ['Best-record selection only.'] } };
  return { schemaVersion: 'cohort-prior-v1', artifactId: 'fixture-prior-r1', sourceRepository: 'https://example.invalid/fixture/cohort',
    sourceCommit: 'a'.repeat(40), dataSnapshotRevision: 'snapshot-r1', catalogRevision: 'catalog-r1',
    region: 'fixture', ruleset: 'fixture/1', canonicalChartId: 'catalog-chart-a', chartRevision: 'chart-r1',
    ratingDefinition: 'fixture-rating/1', ratingGrid: [node, { ...structuredClone(node), rating: 20, effectiveSampleSize: 12 }],
    modelVersion: 'fixture-cohort/1', calibrationVersion: 'fixture-cdf/1', generatedAt: '2026-11-24T00:00:00Z',
    population: { kind: 'synthetic', exclusion: 'disjoint-evaluation-population', scopeRevision: 'disjoint-r1' } };
}
function unavailable(input: unknown, reason = 'cohort-artifact-invalid') {
  const result = adaptCohortArtifact(input, scope, query);
  assert.equal(result.evidence.availability, 'unavailable');
  assert.equal(result.evidence.point, null);
  assert.deepEqual(result.evidence.distribution, { kind: 'unavailable', reason });
  assert.equal(result.sample, null);
}

test('anonymous aggregate selects one nearest node and preserves revision and observational provenance', () => {
  const artifact = fixture();
  assert.ok(validateArtifact(artifact));
  const result = adaptCohortArtifact(artifact, scope, query);
  assert.deepEqual(result.sample, { distinctPlayerCount: 24, effectiveSampleSize: 20 });
  assert.equal(result.evidence.predictionType, 'cohort-observation');
  assert.equal(result.evidence.availability, 'available');
  assert.equal(result.evidence.point, 800_000);
  assert.deepEqual(result.evidence.distribution, { kind: 'quantiles', q25: 700_000, q50: 800_000, q75: 800_000, calibrationRevision: 'fixture-cdf/1' });
  assert.equal(result.evidence.scoreRevision, 'score-r1');
  assert.equal(result.evidence.cohortRevision, 'snapshot-r1');
  assert.ok(result.evidence.limitations.some(item => item.includes('not next-play probabilities')));
  assert.equal(adaptCohortArtifact(artifact, scope, { ...query, rating: 15 }).sample?.effectiveSampleSize, 20);
  assert.equal(adaptCohortArtifact(artifact, scope, { ...query, rating: 16 }).sample?.effectiveSampleSize, 12);
  const reordered = Object.fromEntries(Object.entries(artifact).reverse());
  assert.equal(adaptCohortArtifact(reordered, scope, query).evidence.predictionId, result.evidence.predictionId);
  artifact.ratingGrid[0]!.scoreDistribution[0]!.score = 1;
  assert.equal(result.evidence.distribution.kind === 'quantiles' && result.evidence.distribution.q25, 700_000);
});

test('missing artifacts are explicit unavailable without manufactured distributions', () => {
  unavailable(null, 'cohort-artifact-unavailable');
  unavailable(undefined, 'cohort-artifact-unavailable');
});

test('unknown keys at every privacy boundary reject the complete artifact', () => {
  const mutations: Array<(artifact: any) => void> = [
    artifact => { artifact.accountId = 'private'; },
    artifact => { artifact.population.userHmac = 'private'; },
    artifact => { artifact.ratingGrid[0].nickname = 'private'; },
    artifact => { artifact.ratingGrid[0].scoreDistribution[0].playerId = 'private'; },
    artifact => { artifact.ratingGrid[0].observed.fc.individualScores = [1]; },
    artifact => { artifact.ratingGrid[0].uncertainty.predictions = [1]; },
    artifact => { artifact.ratingGrid[0].selectionCoverage.users = ['private']; },
    artifact => { artifact.ratingGrid.accountId = 'private'; },
  ];
  for (const mutate of mutations) { const artifact = fixture(); mutate(artifact); unavailable(artifact); }
});

test('numeric bounds, CDF quantiles, distinct counts and ESS are validated independently', () => {
  const mutations: Array<(artifact: any) => void> = [
    artifact => { artifact.ratingGrid[0].effectiveSampleSize = 25; },
    artifact => { artifact.ratingGrid[0].distinctPlayerCount = 2.5; },
    artifact => { artifact.ratingGrid[0].scoreQ75 = 900_000; },
    artifact => { artifact.ratingGrid[0].scoreDistribution[0].weight = 0; },
    artifact => { artifact.ratingGrid[0].scoreDistribution[0].weight = Infinity; },
    artifact => { artifact.ratingGrid[0].scoreDistribution[0].score = NaN; },
    artifact => { artifact.ratingGrid[0].scoreDistribution.reverse(); },
    artifact => { artifact.ratingGrid[1].rating = 10; },
    artifact => { artifact.ratingGrid[0].observed.fc.numerator = 25; },
    artifact => { artifact.ratingGrid[0].observed.fc.denominator = 25; },
    artifact => { artifact.ratingGrid[0].observed.fc.semantics = 'next-attempt-probability'; },
    artifact => { artifact.ratingGrid[0].selectionCoverage.observedPlayers = 10; },
  ];
  for (const mutate of mutations) { const artifact = fixture(); mutate(artifact); unavailable(artifact); }
});

test('schema, provenance, size, accessors and repository credentials fail closed', () => {
  const mutations: Array<(artifact: any) => void> = [
    artifact => { delete artifact.sourceCommit; },
    artifact => { artifact.sourceCommit = 'unversioned'; },
    artifact => { artifact.schemaVersion = 'cohort-prior-v2'; },
    artifact => { artifact.sourceRepository = 'https://user:secret@example.invalid/cohort'; },
    artifact => { artifact.sourceRepository = 'https://example.invalid/cohort?account=private'; },
    artifact => { artifact.artifactId = 'a'.repeat(129); },
    artifact => { artifact.ratingGrid = Array(65).fill(artifact.ratingGrid[0]); },
    artifact => { artifact.ratingGrid[0].scoreDistribution = Array(257).fill({ score: 1, weight: 1 }); },
    artifact => { Object.defineProperty(artifact, 'artifactId', { get() { throw Error('must not execute'); }, enumerable: true }); },
    artifact => { Object.setPrototypeOf(artifact, { rawUser: 'private' }); },
  ];
  for (const mutate of mutations) { const artifact = fixture(); mutate(artifact); unavailable(artifact); }
});

test('every identity and cohort query revision must match', () => {
  for (const key of ['catalogRevision', 'canonicalChartId', 'chartRevision', 'ratingDefinition', 'region', 'ruleset'] as const) {
    const artifact = fixture(); artifact[key] = 'different'; unavailable(artifact, 'cohort-scope-mismatch');
  }
  const artifact = fixture(); artifact.population.scopeRevision = 'other-population';
  unavailable(artifact, 'cohort-scope-mismatch');
});

test('freshness uses prediction asOf; future, stale and impossible dates are rejected', () => {
  for (const generatedAt of ['2026-11-26T00:00:00Z', '2026-10-24T00:00:00Z']) {
    const artifact = fixture(); artifact.generatedAt = generatedAt; unavailable(artifact, 'cohort-artifact-stale');
  }
  const artifact = fixture(); artifact.generatedAt = '2026-02-30T00:00:00Z'; unavailable(artifact);
  const invalidQuery = adaptCohortArtifact(fixture(), scope, { ...query, rating: NaN });
  assert.equal(invalidQuery.evidence.availability, 'unavailable');
});

test('synthetic input requires an explicit gate and aggregate population attests disjoint scope', () => {
  const disabled = adaptCohortArtifact(fixture(), scope, { ...query, allowSynthetic: false });
  assert.deepEqual(disabled.evidence.distribution, { kind: 'unavailable', reason: 'synthetic-artifact-disabled' });
  const artifact = fixture(); artifact.population.kind = 'anonymous-aggregate';
  assert.equal(adaptCohortArtifact(artifact, scope, { ...query, allowSynthetic: false }).evidence.availability, 'available');
  (artifact.population as any).exclusion = 'self-included'; unavailable(artifact);
});

test('sparse cohort reports sample information without a point estimate', () => {
  const artifact = fixture(); artifact.ratingGrid[0]!.effectiveSampleSize = 4;
  const result = adaptCohortArtifact(artifact, scope, query);
  assert.equal(result.evidence.availability, 'insufficient');
  assert.equal(result.evidence.point, null);
  assert.deepEqual(result.evidence.distribution, { kind: 'unavailable', reason: 'cohort-sample-insufficient' });
  assert.deepEqual(result.sample, { distinctPlayerCount: 24, effectiveSampleSize: 4 });
});
