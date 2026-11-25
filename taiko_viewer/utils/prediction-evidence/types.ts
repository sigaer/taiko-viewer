/** B4-3 frozen evidence boundary. Stable/PB are never asserted to be quantiles. */
export type PredictionType = 'personal' | 'cohort-observation' | 'cohort-residual' | 'hybrid' | 'chart-feature';
export type Distribution = { kind: 'quantiles'; q25: number; q50: number; q75: number; calibrationRevision: string }
  | { kind: 'unavailable'; reason: string };
export type EvidenceScope = {
  canonicalChartId: string; chartRevision: string; profileId: string;
  playerProfileRevision: string; scoreRevision: string; catalogRevision: string;
};
export type PredictionEvidenceEnvelope = EvidenceScope & {
  schemaVersion: 'prediction-evidence-v1'; predictionId: string; modelId: string; modelVersion: string;
  predictionType: PredictionType; cohortRevision: string | null;
  target: { kind: 'best-score-snapshot'; unit: 'score'; definitionVersion: 'best-score-snapshot/1' };
  availability: 'available' | 'insufficient' | 'unavailable'; point: number | null;
  personalScores?: { stable: number | null; pb: number | null; reliability: number; dataSufficiency: string };
  distribution: Distribution;
  uncertainty: { kind: 'evidence-quality'; value: number | null; method: string };
  evidenceRefs: string[]; limitations: string[]; createdAt: string;
};
export type ObservedRate = { numerator: number; denominator: number; semantics: 'observed-best-snapshot-rate' };
export type CohortNode = {
  rating: number; distinctPlayerCount: number; effectiveSampleSize: number;
  scoreDistribution: Array<{ score: number; weight: number }>;
  scoreQ25: number; scoreQ50: number; scoreQ75: number;
  observed: { fc: ObservedRate | null; df: ObservedRate | null; clear: ObservedRate | null };
  uncertainty: { method: string; standardError: number | null };
  selectionCoverage: { eligiblePlayers: number; observedPlayers: number; limitations: string[] };
};
export type CohortPriorArtifact = {
  schemaVersion: 'cohort-prior-v1'; artifactId: string; sourceRepository: string; sourceCommit: string;
  dataSnapshotRevision: string; catalogRevision: string; region: string; ruleset: string;
  canonicalChartId: string; chartRevision: string; ratingDefinition: string; ratingGrid: CohortNode[];
  modelVersion: string; calibrationVersion: string; generatedAt: string;
  population: { kind: 'synthetic' | 'anonymous-aggregate'; exclusion: 'disjoint-evaluation-population'; scopeRevision: string };
};
export type Comparison = {
  schemaVersion: 'prediction-comparison-v1'; scope: EvidenceScope; personal: PredictionEvidenceEnvelope;
  cohort: PredictionEvidenceEnvelope; hybrid: PredictionEvidenceEnvelope;
  cohortSample: { distinctPlayerCount: number; effectiveSampleSize: number } | null;
  decision: 'retain-personal';
};
