/** B4 offline/1 evidence resolver projections. They preserve provenance; they do not manufacture observations. */
import type { ChartPredictionSampleEvidence, EvidenceRecord, MultiObjectiveCandidate, RatingSampleEvidence, ValidationContext, ValidationIssue } from './contracts.ts';
import { DAY, hash, isObject, same, unique } from './common.ts';
import * as s from './shape.ts';
import { evidenceRefShape, predictionSampleShape, ratingSampleShape, readinessShape } from './schemas.ts';
import { DIMENSIONS, PREDICTION_MODEL, PREDICTION_RULE, targetShape } from './registries.ts';
const dimension = s.one(...DIMENSIONS);
const nullableCount = s.nullable(s.integer());
const shapes: Record<string, { kind: EvidenceRecord['ref']['kind']; source: string; shape: s.Shape }> = {
  catalog: { kind: 'catalog', source: 'catalog-authority', shape: s.object({ type: s.one('catalog'), sourceHash: s.nullable(s.hex) }) },
  rating: { kind: 'rating', source: 'rating-projection', shape: s.object({ type: s.one('rating'), samples: ratingSampleShape, dimensions: s.dictionary(s.number(0, 1000000), 6) }) },
  score_estimate: { kind: 'estimate', source: 'core-estimator', shape: s.object({ type: s.one('score_estimate'), currentBestScore: nullableCount, stableScore: nullableCount, pbScore: nullableCount, scoreUpperBound: s.integer(1), reliability: s.nullable(s.number(0, 1)), samples: predictionSampleShape }) },
  score_snapshot: { kind: 'score_snapshot', source: 'score-projection', shape: s.object({ type: s.one('score_snapshot'), currentBestScore: nullableCount, rank: s.nullable(s.integer(1, 8)), crowns: s.object({ clear: s.nullable(s.bool), full_combo: s.nullable(s.bool), dondaful_combo: s.nullable(s.bool) }), judgeTotal: nullableCount, ng: nullableCount, platform: s.nullable(s.str), mode: s.nullable(s.str) }) },
  coverage: { kind: 'coverage', source: 'coverage-projection', shape: s.object({ type: s.one('coverage'), region: s.one('CN', 'JP'), queryExecuted: s.bool, completeness: s.one('complete', 'partial', 'unknown'), absenceSemantics: s.one('unplayed', 'no_score', 'unknown'), from: s.nullable(s.time), to: s.nullable(s.time), difficultyScope: s.array(s.integer(1, 5), 5, true), noFilters: s.nullable(s.bool), recordPresent: s.nullable(s.bool) }) },
  interest: { kind: 'preference', source: 'user-preference', shape: s.object({ type: s.one('interest'), basis: s.one('explicit_user_interest', 'catalog_relevance'), reason: s.str }) },
  dimension_focus: { kind: 'preference', source: 'user-preference', shape: s.object({ type: s.one('dimension_focus'), dimension, explicit: s.one(true) }) },
  dimension_feature: { kind: 'chart_feature', source: 'catalog-authority', shape: s.object({ type: s.one('dimension_feature'), dimension, namespace: s.one('viewer-six-dimension'), schemaVersion: s.one('viewer-six-dimension/1'), verified: s.one(true) }) },
  dimension_measurement: { kind: 'growth', source: 'growth-projection', shape: s.object({ type: s.one('dimension_measurement'), dimension, value: s.number(0, 1000000), globalConsistency: s.one('consistent', 'inconsistent', 'unknown'), dimensionConsistency: s.one('consistent', 'inconsistent', 'unknown'), scoreRevision: s.str }) },
  score_load_fit: { kind: 'estimate', source: 'core-estimator', shape: s.object({ type: s.one('score_load_fit'), targetHash: s.hex, scoreTarget: s.integer(1), readiness: readinessShape, estimateRef: s.str, ratingRef: s.str, policyVersion: s.str }) },
  goal_baseline: { kind: 'goal_baseline', source: 'goal-portfolio', shape: s.object({ type: s.one('goal_baseline'), goalType: s.str, highScore: nullableCount, total: nullableCount, ng: nullableCount, platform: s.nullable(s.str), mode: s.nullable(s.str) }) },
  rank_requirement: { kind: 'task', source: 'task-authority', shape: s.object({ type: s.one('rank_requirement'), rank: s.integer(1, 8), scoreThreshold: s.integer(1), authorityRef: s.str }) },
  attempt: { kind: 'attempt', source: 'verified-attempt', shape: s.object({ type: s.one('attempt'), attemptId: s.str, platform: s.str, mode: s.str, verified: s.one(true), good: s.integer(), ok: s.integer(), ng: s.integer(), combo: s.integer(), total: s.integer(1), gauge: s.nullable(s.number(0, 1000000)), gaugeMax: s.nullable(s.number(0, 1000000)), clearRequirement: s.nullable(s.number(0, 1000000)), otherClearConditionsKnown: s.bool, otherClearConditionsPassed: s.bool }) },
  attempt_window: { kind: 'coverage', source: 'verified-attempt', shape: s.object({ type: s.one('attempt_window'), attemptRefs: s.array(s.str, 3, true), complete: s.one(true), platform: s.str, mode: s.str, from: s.time, to: s.time }) },
  // Only definition/progress validation is registered in this batch. Composite readiness needs a future dedicated producer.
  task: { kind: 'task', source: 'task-authority', shape: s.object({ type: s.one('task'), taskId: s.str, taskVersion: s.str, authorityRef: s.str, sourceHash: s.hex, region: s.one('CN', 'JP'), platform: s.str, validFrom: s.time, validTo: s.nullable(s.time), evergreen: s.bool, progressKnownAt: s.time, requirements: s.array(s.object({ requirementId: s.str, chartId: s.str, target: targetShape, sameAttempt: s.bool, completed: s.bool }), 100), progressRevision: s.str, completed: s.bool }) },
};
export type EvidenceIndex = ReadonlyMap<string, EvidenceRecord>;
export function prepareEvidence(records: readonly EvidenceRecord[]): { index: EvidenceIndex; issues: ValidationIssue[] } {
  const index = new Map<string, EvidenceRecord>(), issues: ValidationIssue[] = [];
  if (!Array.isArray(records) || records.length > 100000) return { index, issues: [{ path: 'evidence', code: 'EVIDENCE_BUDGET' }] };
  for (let n = 0; n < records.length; n++) {
    const raw: unknown = records[n]!; const path = `evidence[${n}]`;
    if (!isObject(raw) || raw.schemaVersion !== 'b4-evidence/1' || Object.keys(raw).some(k => !['schemaVersion', 'ref', 'payload'].includes(k))) { issues.push({ path, code: 'EVIDENCE_ENVELOPE_INVALID' }); continue; }
    const r = raw as EvidenceRecord;
    const refIssues = s.inspect(evidenceRefShape, r.ref); issues.push(...refIssues.map(i => ({ path: `${path}.ref${i.path}`, code: i.code })));
    if (refIssues.length) continue;
    const spec = isObject(r.payload) && typeof r.payload.type === 'string' && Object.hasOwn(shapes, r.payload.type) ? shapes[r.payload.type]! : null;
    if (!spec) { issues.push({ path, code: 'EVIDENCE_PAYLOAD_UNREGISTERED' }); continue; }
    const payloadIssues = s.inspect(spec.shape, r.payload); issues.push(...payloadIssues.map(i => ({ path: `${path}.payload${i.path}`, code: i.code })));
    if (payloadIssues.length) continue;
    if (r.ref.kind !== spec.kind || r.ref.source !== spec.source) issues.push({ path, code: 'EVIDENCE_NAMESPACE_MISMATCH' });
    if (r.ref.contentHash !== hash(r.payload)) issues.push({ path, code: 'EVIDENCE_CONTENT_HASH_MISMATCH' });
    if (index.has(r.ref.id) && !same(index.get(r.ref.id), r)) issues.push({ path: r.ref.id, code: 'EVIDENCE_ID_CONFLICT' });
    else index.set(r.ref.id, structuredClone(r));
  }
  return { index, issues };
}
export function evidenceDependencies(record: EvidenceRecord): string[] {
  const p = record.payload;
  if (p.type === 'score_estimate') return (p.samples as ChartPredictionSampleEvidence).evidenceRefs;
  if (p.type === 'attempt_window') return p.attemptRefs as string[];
  if (p.type === 'score_load_fit') return [p.estimateRef as string, p.ratingRef as string];
  return [];
}
export function referencedEvidence(c: MultiObjectiveCandidate, index?: EvidenceIndex): string[] {
  const t = c.target, p = c.playerEvidence, a = c.actionability;
  const refs = [...c.source.evidenceRefs, ...p.snapshotRefs, p.ratingRef, p.estimateRef, p.coverageRef, ...p.attemptRefs,
    ...p.predictionSamples?.evidenceRefs ?? [], c.chartEvidence.catalogRef, ...c.chartEvidence.featureRefs, ...a.evidenceRefs, ...a.confidence.basisRefs,
    ...c.goalLinks.flatMap(g => [g.baselineRef, g.evaluationRef, ...g.actionability.evidenceRefs, ...g.actionability.confidence.basisRefs])].filter((x): x is string => x !== null);
  if ('baselineRef' in t && t.baselineRef) refs.push(t.baselineRef);
  if ('requirementRef' in t && t.requirementRef) refs.push(t.requirementRef);
  if ('requirementRefs' in t) refs.push(...t.requirementRefs);
  if ('coverageRef' in t) refs.push(t.coverageRef, t.relevanceRef);
  if ('loadEvidenceRef' in t) refs.push(t.loadEvidenceRef);
  if ('practiceDefinitionRef' in t) refs.push(t.practiceDefinitionRef);
  const found = new Set(refs);
  if (index) for (const id of found) {
    if (found.size > 256) break;
    const r = index.get(id); if (r) for (const dep of evidenceDependencies(r)) found.add(dep);
  }
  return unique([...found]);
}
export function validateEvidenceScope(c: MultiObjectiveCandidate, ctx: ValidationContext, index: EvidenceIndex): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const id of c.evidenceRefs) {
    const r = index.get(id); const add = (code: string) => issues.push({ path: `evidence.${id}`, code });
    if (!r) { add('EVIDENCE_MISSING'); continue; }
    const f = r.ref;
    const global = ['rating', 'growth'].includes(f.kind), publicChart = ['catalog', 'chart_feature'].includes(f.kind);
    if (f.profileId !== (publicChart ? null : ctx.profileId) || (global ? f.chartId !== null : f.chartId !== c.chartId) || (f.catalogRevision !== c.catalogRevision && !(global && f.catalogRevision === null))) add('EVIDENCE_SCOPE_MISMATCH');
    if (f.knownAt > ctx.asOf || [f.occurredAt, f.observedAt, f.confirmedAt].some(t => t !== null && (t > ctx.asOf || t > f.knownAt))) add('EVIDENCE_FUTURE');
    if (f.occurredAt && f.observedAt && f.occurredAt > f.observedAt) add('EVIDENCE_TIME_ORDER');
    for (const field of ['from', 'to', 'progressKnownAt']) if (typeof r.payload[field] === 'string' && r.payload[field] > f.knownAt) add('PAYLOAD_TIME_AFTER_KNOWLEDGE');
    if (r.payload.type === 'score_estimate' && (r.payload.samples as ChartPredictionSampleEvidence).featureCutoff > f.knownAt) add('PAYLOAD_TIME_AFTER_KNOWLEDGE');
    if (typeof r.payload.from === 'string' && typeof r.payload.to === 'string' && r.payload.from > r.payload.to) add('EVIDENCE_TIME_ORDER');
    if (['score_snapshot', 'rating', 'growth', 'estimate'].includes(f.kind) && f.sourceRevision !== c.scoreRevision) add('EVIDENCE_SCORE_REVISION_MISMATCH');
    if (publicChart && f.sourceRevision !== c.catalogRevision) add('EVIDENCE_CATALOG_REVISION_MISMATCH');
    if (f.kind === 'catalog' && r.payload.sourceHash !== c.sourceHash) add('SOURCE_HASH_MISMATCH');
    if (r.payload.type === 'attempt') {
      const p = r.payload;
      if (!f.occurredAt || !f.observedAt || p.total !== (p.good as number) + (p.ok as number) + (p.ng as number) || (p.combo as number) > (p.total as number)) add('ATTEMPT_SEMANTICS_INVALID');
    }
  }
  return issues;
}
export function validateSampleEvidence(c: MultiObjectiveCandidate, ctx: ValidationContext, index: EvidenceIndex): ValidationIssue[] {
  const issues: ValidationIssue[] = [], r = c.playerEvidence.ratingSamples, p = c.playerEvidence.predictionSamples;
  const add = (code: string, path = 'playerEvidence') => issues.push({ path, code });
  if (r) {
    const origin = index.get(r.ratingRef);
    if (r.ratingRef !== c.playerEvidence.ratingRef || r.scoreRevision !== ctx.scoreRevision || origin?.payload.type !== 'rating' || origin.ref.modelVersion !== r.modelVersion || !same(origin.payload.samples, r)) add('RATING_SAMPLE_PROVENANCE_MISMATCH');
  }
  if (p) {
    const origin = index.get(p.estimateRef);
    if (p.estimateRef !== c.playerEvidence.estimateRef || p.chartId !== c.chartId || p.scoreRevision !== ctx.scoreRevision || origin?.payload.type !== 'score_estimate' || origin.ref.modelVersion !== p.modelVersion || !same(origin.payload.samples, p)) add('PREDICTION_SAMPLE_PROVENANCE_MISMATCH');
    if (p.featureCutoff > c.generatedAt || p.featureCutoff > ctx.asOf) add('EVIDENCE_FUTURE');
    if (p.poolCount !== null && [p.stableNeighborCount, p.pbNeighborCount].some(n => n !== null && n > p.poolCount!)) add('PREDICTION_COUNT_INCONSISTENT');
  }
  return issues;
}
export function scoreEvidenceFailures(c: MultiObjectiveCandidate, ctx: ValidationContext, index: EvidenceIndex, threshold: number, stretch: boolean): string[] {
  const errors: string[] = [], r = c.playerEvidence.ratingSamples, p = c.playerEvidence.predictionSamples;
  const estimate = c.playerEvidence.estimateRef ? index.get(c.playerEvidence.estimateRef)?.payload : undefined;
  if (!r || r.sampleCount < 20) errors.push('RATING_SAMPLE_INSUFFICIENT');
  if (!p || p.stableNeighborCount === null || p.targetIdentityExcluded === null || (stretch && p.pbNeighborCount === null)) errors.push('PREDICTION_SAMPLE_EVIDENCE_MISSING');
  else if (p.stableNeighborCount < 1 || p.targetIdentityExcluded !== true || p.dataSufficiency !== 'ok' || (stretch && (!p.pbNeighborCount || p.pbNeighborCount < 1))) errors.push('PREDICTION_SAMPLE_INSUFFICIENT');
  if (p && (p.modelVersion !== PREDICTION_MODEL || p.sufficiencyRuleRef !== PREDICTION_RULE || p.poolKind === 'unknown')) errors.push('PREDICTION_RULE_UNREGISTERED');
  if (p && Date.parse(ctx.asOf) - Date.parse(p.featureCutoff) > 30 * DAY) errors.push('EVIDENCE_STALE');
  if (!estimate || estimate.type !== 'score_estimate' || !estimate.stableScore || estimate.reliability === null || (estimate.reliability as number) < .6) errors.push('SCORE_STABLE_EVIDENCE_MISSING');
  else if (stretch ? (!estimate.pbScore || threshold <= (estimate.stableScore as number) || threshold > (estimate.pbScore as number) || (threshold - (estimate.stableScore as number)) / (estimate.stableScore as number) > .02) : threshold > (estimate.stableScore as number)) errors.push('SCORE_TARGET_OUTSIDE_READINESS_BOUND');
  if (estimate && (estimate.currentBestScore === null || threshold > (estimate.scoreUpperBound as number))) errors.push('SCORE_TARGET_INVALID');
  return unique(errors);
}
export function coverageIsComplete(c: MultiObjectiveCandidate, ctx: ValidationContext, index: EvidenceIndex): boolean {
  const id = c.playerEvidence.coverageRef, p = id ? index.get(id)?.payload : undefined;
  return !!p && p.type === 'coverage' && p.region === c.region && p.queryExecuted === true && p.completeness === 'complete' && p.absenceSemantics === 'unplayed' && p.noFilters === true && Array.isArray(p.difficultyScope) && p.difficultyScope.includes(c.difficultyType) && typeof p.from === 'string' && typeof p.to === 'string' && p.from <= p.to && p.to <= ctx.asOf && p.to >= c.generatedAt && typeof p.recordPresent === 'boolean';
}
