import { createHash } from 'node:crypto';
import type { EstimateSnapshot } from '../player-intelligence/adapters.ts';
import type { Comparison, EvidenceScope, PredictionEvidenceEnvelope } from './types.ts';

const fields = ['canonicalChartId', 'chartRevision', 'profileId', 'playerProfileRevision', 'scoreRevision', 'catalogRevision'] as const;
const timestamp = (s: string) => /^\d{4}-\d\d-\d\dT/.test(s) && Number.isFinite(Date.parse(s));
const score = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100000000;
export const evidenceId = (value: unknown): string => {
  const canonical = (v: any): any => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
};
export function validateEvidence(value: PredictionEvidenceEnvelope): void {
  if (!value || value.schemaVersion !== 'prediction-evidence-v1' || fields.some(k => typeof value[k] !== 'string' || !value[k] || value[k].length > 256)
    || !value.predictionId || !value.modelId || !value.modelVersion || !timestamp(value.createdAt)) throw new Error('invalid-evidence-identity');
  if (!['personal', 'cohort-observation', 'cohort-residual', 'hybrid', 'chart-feature'].includes(value.predictionType)
    || !['available', 'insufficient', 'unavailable'].includes(value.availability)
    || value.target?.kind !== 'best-score-snapshot' || value.target?.unit !== 'score' || value.target?.definitionVersion !== 'best-score-snapshot/1') throw new Error('invalid-evidence-type-or-target');
  if (value.predictionType === 'personal' && value.cohortRevision !== null) throw new Error('personal-cannot-claim-cohort');
  if (value.predictionType !== 'personal' && value.predictionType !== 'chart-feature' && value.availability === 'available' && !value.cohortRevision) throw new Error('cohort-revision-required');
  const numeric = value.predictionType === 'cohort-residual' ? (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 100000000 : score;
  if (value.point !== null && !numeric(value.point)) throw new Error('invalid-point');
  if (value.availability !== 'available' && (value.point !== null || value.distribution.kind !== 'unavailable')) throw new Error('unavailable-cannot-claim-prediction');
  if (value.predictionType === 'chart-feature' && (value.point !== null || value.distribution.kind !== 'unavailable')) throw new Error('feature-is-not-prediction');
  if (value.distribution.kind === 'quantiles') {
    const d = value.distribution;
    if (![d.q25, d.q50, d.q75].every(numeric) || d.q25 > d.q50 || d.q50 > d.q75 || !d.calibrationRevision) throw new Error('invalid-distribution');
  } else if (value.distribution.kind !== 'unavailable' || !value.distribution.reason) throw new Error('invalid-distribution');
  if (value.uncertainty.kind !== 'evidence-quality' || (value.uncertainty.value !== null && (!Number.isFinite(value.uncertainty.value) || value.uncertainty.value < 0 || value.uncertainty.value > 1)) || !value.uncertainty.method) throw new Error('invalid-uncertainty');
  if (!Array.isArray(value.evidenceRefs) || (value.availability === 'available' && !value.evidenceRefs.length) || !Array.isArray(value.limitations)
    || [...value.evidenceRefs, ...value.limitations].some(v => typeof v !== 'string' || v.length > 512)) throw new Error('invalid-provenance');
  if (value.personalScores) {
    const p = value.personalScores;
    if (value.predictionType !== 'personal' || [p.stable, p.pb].some(s => s !== null && !score(s)) || !Number.isFinite(p.reliability) || p.reliability < 0 || p.reliability > 100 || !p.dataSufficiency) throw new Error('invalid-personal-scores');
  }
}

/** Caller resolves canonical identity first; the estimate's legacy ID must match that resolution. */
export type PersonalEstimateEvidence = EstimateSnapshot & Pick<EvidenceScope, 'canonicalChartId' | 'chartRevision' | 'playerProfileRevision'>;
export function adaptPersonalEstimate(scope: EvidenceScope, snapshot: PersonalEstimateEvidence | null,
  identity: { songId: number; difficultyType: number }, asOf: string): PredictionEvidenceEnvelope {
  const wire = snapshot?.estimate;
  const snapshotScore = (s: unknown) => s === null || (!!s && typeof s === 'object' && score((s as {score?: unknown}).score));
  const valid = snapshot && wire && snapshotScore(wire.stable) && snapshotScore(wire.pb)
    && typeof wire.data_sufficiency === 'string' && !!wire.data_sufficiency
    && typeof snapshot.sourceHash === 'string' && !!snapshot.sourceHash
    && typeof snapshot.modelVersion === 'string' && !!snapshot.modelVersion
    && Array.isArray(snapshot.evidenceRefs) && snapshot.evidenceRefs.length > 0 && snapshot.evidenceRefs.length <= 32
    && snapshot.evidenceRefs.every(r => typeof r === 'string' && r.length > 0 && r.length <= 512)
    && snapshot.profileId === scope.profileId && snapshot.scoreRevision === scope.scoreRevision
    && snapshot.canonicalChartId === scope.canonicalChartId && snapshot.chartRevision === scope.chartRevision && snapshot.playerProfileRevision === scope.playerProfileRevision
    && snapshot.catalogRevision === scope.catalogRevision && snapshot.modelVersion && snapshot.sourceHash && snapshot.evidenceRefs.length
    && snapshot.estimate.song_id === identity.songId && snapshot.estimate.level === identity.difficultyType
    && timestamp(snapshot.generatedAt) && timestamp(snapshot.featureCutoff) && timestamp(asOf)
    && Date.parse(snapshot.featureCutoff) <= Date.parse(snapshot.generatedAt) && Date.parse(snapshot.generatedAt) <= Date.parse(asOf)
    && [snapshot.estimate.stable?.score ?? null, snapshot.estimate.pb?.score ?? null].every(s => s === null || score(s))
    && Number.isFinite(snapshot.estimate.reliability) && snapshot.estimate.reliability >= 0 && snapshot.estimate.reliability <= 100;
  const estimate = valid ? snapshot!.estimate : null;
  const value: PredictionEvidenceEnvelope = {
    ...scope, schemaVersion: 'prediction-evidence-v1', predictionId: evidenceId([scope, valid ? snapshot : null, asOf]),
    modelId: 'bot-personal', modelVersion: valid ? snapshot!.modelVersion : 'unknown', predictionType: 'personal', cohortRevision: null,
    target: { kind: 'best-score-snapshot', unit: 'score', definitionVersion: 'best-score-snapshot/1' },
    availability: estimate?.stable ? 'available' : valid ? 'insufficient' : 'unavailable', point: estimate?.stable?.score ?? null,
    ...(estimate ? { personalScores: { stable: estimate.stable?.score ?? null, pb: estimate.pb?.score ?? null,
      reliability: estimate.reliability, dataSufficiency: estimate.data_sufficiency } } : {}),
    distribution: { kind: 'unavailable', reason: 'personal-stable-pb-are-not-calibrated-quantiles' },
    uncertainty: { kind: 'evidence-quality', value: estimate ? estimate.reliability / 100 : null, method: 'bot-reliability-not-probability' },
    evidenceRefs: valid ? [snapshot!.sourceHash, ...snapshot!.evidenceRefs] : ['personal-evidence-unavailable'],
    limitations: ['BEST_SNAPSHOT_NOT_NEXT_ATTEMPT', 'STABLE_POINT_PROXY_FOR_SNAPSHOT', 'STABLE_PB_NOT_QUANTILES', ...(valid ? [] : ['MISSING_OR_MISMATCHED_PERSONAL_EVIDENCE'])], createdAt: asOf
  };
  validateEvidence(value);
  return value;
}

/** Pure read-only comparison. It never accepts or writes a Goal/Baseline. */
export function compareEvidence(scope: EvidenceScope, personal: PredictionEvidenceEnvelope,
  cohort: PredictionEvidenceEnvelope, sample: Comparison['cohortSample']): Comparison {
  for (const [value, type] of [[personal, 'personal'], [cohort, 'cohort-observation']] as const) {
    validateEvidence(value);
    if (value.predictionType !== type || fields.some(k => value[k] !== scope[k])) throw new Error('comparison-scope-or-type-mismatch');
  }
  const hybrid: PredictionEvidenceEnvelope = { ...personal, predictionId: evidenceId([personal.predictionId, cohort.predictionId, 'not-adopted']),
    predictionType: 'hybrid', modelId: 'personal-cohort-residual', modelVersion: 'residual/1', cohortRevision: cohort.cohortRevision,
    availability: 'unavailable', point: null, distribution: { kind: 'unavailable', reason: 'real-heldout-validation-required' },
    uncertainty: { kind: 'evidence-quality', value: null, method: 'not-adopted' }, evidenceRefs: [personal.predictionId, cohort.predictionId],
    limitations: ['SYNTHETIC_EVIDENCE_DOES_NOT_AUTHORIZE_HYBRID'] };
  delete hybrid.personalScores;
  validateEvidence(hybrid);
  return { schemaVersion: 'prediction-comparison-v1', scope: { ...scope }, personal, cohort, hybrid, cohortSample: sample, decision: 'retain-personal' };
}
