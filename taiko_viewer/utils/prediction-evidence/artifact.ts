import { createHash } from 'node:crypto';
import type { CohortNode, CohortPriorArtifact, EvidenceScope, PredictionEvidenceEnvelope } from './types.ts';

export type CohortQuery = {
  rating: number; ratingDefinition: string; region: string; ruleset: string;
  asOf: string; populationScopeRevision: string; allowSynthetic: boolean;
};
type AdaptedCohort = {
  evidence: PredictionEvidenceEnvelope;
  sample: { distinctPlayerCount: number; effectiveSampleSize: number } | null;
};

/** A producer must publish a new revision rather than silently extending this window. */
export const COHORT_MAX_AGE_MS = 31 * 24 * 60 * 60 * 1000;
const MAX_COUNT = 10_000_000;
const MAX_SCORE = 100_000_000;
const MAX_WEIGHT = 1e12;
const MIN_SAMPLE = 5;
const snapshotTarget = { kind: 'best-score-snapshot', unit: 'score', definitionVersion: 'best-score-snapshot/1' } as const;
const limitations = [
  'Best-score snapshots describe recorded best results, not the next attempt.',
  'FC, DF and Clear are observed snapshot rates, not next-play probabilities.',
  'The nearest single published rating node is used; sample counts are not interpolated.',
];

function object(value: unknown, keys: string[]): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const names = Reflect.ownKeys(value);
  return names.length === keys.length && names.every(key =>
    typeof key === 'string' && keys.includes(key) && Object.hasOwn(descriptors[key]!, 'value'));
}
function label(value: unknown, max = 128): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/u.test(value);
}
function array(value: unknown, max: number): value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > max) return false;
  const names = Reflect.ownKeys(value);
  if (names.length !== value.length + 1) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return names.every(key => key === 'length' || (typeof key === 'string' && /^(?:0|[1-9]\d*)$/u.test(key)
    && Number(key) < value.length && Object.hasOwn(descriptors[key]!, 'value')));
}
function finite(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
function count(value: unknown): value is number {
  return finite(value, 0, MAX_COUNT) && Number.isInteger(value);
}
function timestamp(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 19) === value.slice(0, 19);
}
function strings(value: unknown): value is string[] {
  return array(value, 16) && value.every(item => label(item, 240));
}
function observed(value: unknown, population: number): boolean {
  return value === null || (object(value, ['numerator', 'denominator', 'semantics'])
    && count(value.numerator) && count(value.denominator) && value.denominator > 0
    && value.numerator <= value.denominator && value.denominator <= population
    && value.semantics === 'observed-best-snapshot-rate');
}
function quantile(points: Array<{ score: number; weight: number }>, q: number): number {
  const total = points.reduce((sum, point) => sum + point.weight, 0);
  let accumulated = 0;
  for (const point of points) {
    accumulated += point.weight;
    if (accumulated + Number.EPSILON * total >= q * total) return point.score;
  }
  return points[points.length - 1]!.score;
}
function node(value: unknown): value is CohortNode {
  if (!object(value, ['rating', 'distinctPlayerCount', 'effectiveSampleSize', 'scoreDistribution',
    'scoreMean', 'scoreMedian', 'scoreQ25', 'scoreQ50', 'scoreQ75', 'observed', 'uncertainty', 'selectionCoverage'])
    || !finite(value.rating, 0, 100_000) || !count(value.distinctPlayerCount) || value.distinctPlayerCount < 1
    || !finite(value.effectiveSampleSize, 1, value.distinctPlayerCount)
    || !array(value.scoreDistribution, 256) || value.scoreDistribution.length < 1
    || !object(value.observed, ['fc', 'df', 'clear'])
    || !object(value.uncertainty, ['method', 'standardError']) || !label(value.uncertainty.method)
    || !(value.uncertainty.standardError === null || finite(value.uncertainty.standardError, 0, MAX_SCORE))
    || !object(value.selectionCoverage, ['eligiblePlayers', 'observedPlayers', 'limitations'])
    || !count(value.selectionCoverage.eligiblePlayers) || !count(value.selectionCoverage.observedPlayers)
    || value.selectionCoverage.observedPlayers < value.distinctPlayerCount
    || value.selectionCoverage.observedPlayers > value.selectionCoverage.eligiblePlayers
    || !strings(value.selectionCoverage.limitations)) return false;
  const points: Array<{ score: number; weight: number }> = [];
  let previous = -1;
  let total = 0;
  for (const point of value.scoreDistribution) {
    if (!object(point, ['score', 'weight']) || !finite(point.score, 0, MAX_SCORE)
      || !finite(point.weight, Number.MIN_VALUE, MAX_WEIGHT) || point.score <= previous) return false;
    previous = point.score;
    total += point.weight;
    if (!Number.isFinite(total) || total > MAX_WEIGHT) return false;
    points.push({ score: point.score, weight: point.weight });
  }
  const rates = value.observed;
  const mean = points.reduce((sum, point) => sum + point.score * point.weight, 0) / total;
  return total > 0 && finite(value.scoreMean, 0, MAX_SCORE) && Math.abs(value.scoreMean - mean) <= 1e-6
    && value.scoreMedian === value.scoreQ50 && ['fc', 'df', 'clear'].every(key => observed(rates[key], value.distinctPlayerCount as number))
    && value.scoreQ25 === quantile(points, 0.25) && value.scoreQ50 === quantile(points, 0.5)
    && value.scoreQ75 === quantile(points, 0.75);
}
function artifact(value: unknown): value is CohortPriorArtifact {
  if (!object(value, ['schemaVersion', 'artifactHash', 'artifactId', 'sourceRepository', 'sourceCommit', 'dataSnapshotRevision',
    'catalogRevision', 'region', 'ruleset', 'canonicalChartId', 'chartRevision', 'ratingDefinition', 'ratingGrid',
    'modelVersion', 'calibrationVersion', 'generatedAt', 'population']) || value.schemaVersion !== 'cohort-prior-v1'
    || !['artifactId', 'dataSnapshotRevision', 'catalogRevision', 'region', 'ruleset', 'canonicalChartId',
      'chartRevision', 'ratingDefinition', 'modelVersion', 'calibrationVersion'].every(key => label(value[key]))
    || typeof value.artifactHash !== 'string' || !/^sha256:[a-f0-9]{64}$/u.test(value.artifactHash)
    || typeof value.sourceCommit !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(value.sourceCommit)
    || !label(value.sourceRepository, 240) || !timestamp(value.generatedAt)
    || !object(value.population, ['kind', 'exclusion', 'scopeRevision'])
    || !['synthetic', 'anonymous-aggregate'].includes(value.population.kind as string)
    || value.population.exclusion !== 'disjoint-evaluation-population' || !label(value.population.scopeRevision)
    || !array(value.ratingGrid, 64) || value.ratingGrid.length < 1) return false;
  // Repository references cannot carry credentials, query strings, or individual-data URLs.
  try {
    const repository = new URL(value.sourceRepository);
    if (repository.protocol !== 'https:' || repository.username || repository.password || repository.search || repository.hash) return false;
  } catch { return false; }
  let previous = -1;
  return value.ratingGrid.every(item => {
    if (!node(item) || item.rating <= previous) return false;
    previous = item.rating;
    return true;
  });
}
export function validateArtifact(value: unknown): value is CohortPriorArtifact {
  try { return artifact(value) && value.artifactHash === cohortArtifactHash(value); } catch { return false; }
}
function digest(value: unknown): string {
  const canonical = (item: unknown): unknown => Array.isArray(item) ? item.map(canonical)
    : item && typeof item === 'object' ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, child]) => [key, canonical(child)])) : item;
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

export function cohortArtifactHash(value: Omit<CohortPriorArtifact, 'artifactHash'> | CohortPriorArtifact): string {
  const { artifactHash: _ignored, ...payload } = value as CohortPriorArtifact;
  return `sha256:${digest(payload)}`;
}

/** Server-side, aggregate-only adapter. Never return unvalidated artifact data or a partial result. */
export function adaptCohortArtifact(input: unknown, scope: EvidenceScope, query: CohortQuery): AdaptedCohort {
  const base: PredictionEvidenceEnvelope = {
    ...scope, schemaVersion: 'prediction-evidence-v1',
    predictionId: `cohort:${digest([scope, query])}`, modelId: 'rating-matched-cohort-observation',
    modelVersion: 'cohort-adapter/1', predictionType: 'cohort-observation', cohortRevision: null,
    target: snapshotTarget, availability: 'unavailable', point: null,
    distribution: { kind: 'unavailable', reason: 'cohort-artifact-unavailable' },
    uncertainty: { kind: 'evidence-quality', value: null, method: 'effective-sample-size/24' },
    evidenceRefs: [], reasonCodes: ['cohort_unavailable'], limitations: [...limitations], createdAt: query.asOf,
  };
  const unavailable = (reason: string): AdaptedCohort => ({
    evidence: { ...base, reasonCodes: ['cohort_unavailable', reason], distribution: { kind: 'unavailable', reason } }, sample: null,
  });
  if (input === null || input === undefined) return unavailable('cohort-artifact-unavailable');
  // Accessors, hostile prototypes, malformed nesting, and overlarge arrays fail closed.
  try {
    if (!validateArtifact(input)) return unavailable('cohort-artifact-invalid');
    if (!finite(query.rating, 0, 100_000) || !timestamp(query.asOf)
      || typeof query.allowSynthetic !== 'boolean') return unavailable('cohort-query-invalid');
    if (input.catalogRevision !== scope.catalogRevision || input.canonicalChartId !== scope.canonicalChartId
      || input.chartRevision !== scope.chartRevision || input.ratingDefinition !== query.ratingDefinition
      || input.region !== query.region || input.ruleset !== query.ruleset
      || input.population.scopeRevision !== query.populationScopeRevision) return unavailable('cohort-scope-mismatch');
    if (input.population.kind === 'synthetic' && !query.allowSynthetic) return unavailable('synthetic-artifact-disabled');
    const age = Date.parse(query.asOf) - Date.parse(input.generatedAt);
    if (age < 0 || age > COHORT_MAX_AGE_MS) return unavailable('cohort-artifact-stale');
    // On an exact midpoint choose the lower node deterministically. Do not sum overlapping populations.
    const selected = input.ratingGrid.reduce((best, candidate) =>
      Math.abs(candidate.rating - query.rating) < Math.abs(best.rating - query.rating) ? candidate : best);
    const sample = { distinctPlayerCount: selected.distinctPlayerCount, effectiveSampleSize: selected.effectiveSampleSize };
    const sufficient = sample.distinctPlayerCount >= MIN_SAMPLE && sample.effectiveSampleSize >= MIN_SAMPLE;
    return {
      sample,
      evidence: {
        ...base, predictionId: `cohort:${digest([scope, query, input])}`, modelVersion: input.modelVersion,
        reasonCodes: sufficient ? [] : ['cohort_unavailable', 'cohort-sample-insufficient'],
        cohortRevision: input.dataSnapshotRevision, availability: sufficient ? 'available' : 'insufficient',
        point: sufficient ? selected.scoreQ50 : null,
        distribution: sufficient ? { kind: 'quantiles', q25: selected.scoreQ25, q50: selected.scoreQ50,
          q75: selected.scoreQ75, calibrationRevision: input.calibrationVersion }
          : { kind: 'unavailable', reason: 'cohort-sample-insufficient' },
        uncertainty: { kind: 'evidence-quality', value: Math.min(1, sample.effectiveSampleSize / 24), method: 'effective-sample-size/24' },
        evidenceRefs: [`artifact:${input.artifactId}`, input.artifactHash, `source-commit:${input.sourceCommit}`,
          `population-scope:${input.population.scopeRevision}`, `rating-node:${selected.rating}`,
          `uncertainty-method:${selected.uncertainty.method}`],
        limitations: [...limitations, ...selected.selectionCoverage.limitations,
          ...(input.population.kind === 'synthetic' ? ['Synthetic cohort; no claim of real-player predictive performance.'] : [])],
        createdAt: input.generatedAt,
      },
    };
  } catch { return unavailable('cohort-artifact-invalid'); }
}
