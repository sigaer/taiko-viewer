import type { CohortPriorArtifact, Comparison, EvidenceScope } from '../../../utils/prediction-evidence/types.ts';
import { adaptCohortArtifact, cohortArtifactHash } from '../../../utils/prediction-evidence/artifact.ts';
import { adaptPersonalEstimate, compareEvidence } from '../../../utils/prediction-evidence/personal.ts';
import fixture from './synthetic-preview.json' with { type: 'json' };

export type PreviewState = 'available' | 'missing' | 'sparse' | 'revision';
/** Candidate-only fixture; contains no account, score-reader, Goal writer, or database dependency. */
export function syntheticPredictionPreview(state: PreviewState): Comparison {
  const scope: EvidenceScope = { canonicalChartId: fixture.chart, chartRevision: 'synthetic-chart/1',
    profileId: 'synthetic-preview', playerProfileRevision: 'synthetic-profile/1', scoreRevision: 'synthetic-score/1',
    catalogRevision: 'synthetic-catalog/b43-v1' };
  const personal = adaptPersonalEstimate(scope, {
    canonicalChartId: scope.canonicalChartId, chartRevision: scope.chartRevision, playerProfileRevision: scope.playerProfileRevision,
    profileId: scope.profileId, scoreRevision: scope.scoreRevision, catalogRevision: scope.catalogRevision,
    sourceHash: fixture.sourceSha256, modelVersion: `bot-core/${fixture.coreVersion}/${fixture.sourceCommit}`,
    generatedAt: fixture.clock, featureCutoff: fixture.clock,
    evidenceRefs: ['synthetic-fixture/b43-v1', `core-tree:${fixture.coreTree}`],
    estimate: { song_id: 1, level: 4, current_score: null, reliability: fixture.reliability,
      data_sufficiency: fixture.dataSufficiency, stable: { score: fixture.stable }, pb: fixture.pb === null ? null : { score: fixture.pb } }
  }, { songId: 1, difficultyType: 4 }, fixture.clock);
  personal.limitations.push('SYNTHETIC_PROFILE_NOT_YOUR_PREDICTION');
  const artifact: CohortPriorArtifact | null = state === 'missing' ? null : structuredClone(fixture.artifact) as CohortPriorArtifact;
  if (artifact && state === 'revision') artifact.chartRevision = 'synthetic-chart/other';
  if (artifact && state === 'sparse') {
    artifact.ratingGrid[0]!.distinctPlayerCount = 3;
    artifact.ratingGrid[0]!.effectiveSampleSize = 2.5;
    artifact.ratingGrid[0]!.observed = { fc: null, df: null, clear: null };
  }
  if (artifact && state !== 'available') artifact.artifactHash = cohortArtifactHash(artifact);
  const cohort = adaptCohortArtifact(artifact, scope, { rating: fixture.rating,
    ratingDefinition: fixture.ratingDefinition, region: 'SYNTHETIC', ruleset: 'synthetic-score/1',
    asOf: fixture.clock, populationScopeRevision: 'synthetic-disjoint/1', allowSynthetic: true });
  return compareEvidence(scope, personal, cohort.evidence, cohort.sample);
}
