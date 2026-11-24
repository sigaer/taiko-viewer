import { fixture, record, seal, interest, NOW, type Fixture } from './fixtures.ts';
import { hash } from '../../utils/multi-objective/common.ts';
export function crown(subtype: 'clear' | 'full_combo' | 'dondaful_combo' | 'ng_reduction' = 'full_combo'): Fixture {
  const f = fixture(), c = f.candidates[0]!;
  c.intentType = 'crown_completion'; c.subtype = subtype;
  c.target = subtype === 'ng_reduction' ? { kind: 'ng_reduction', baselineRef: 'baseline-ng', threshold: 9, total: 1000, comparison: 'lte', horizon: 'near_term', definitionVersion: 'target/1' } : { kind: 'crown', crown: subtype, horizon: 'near_term', definitionVersion: 'target/1' };
  c.playerEvidence.ratingRef = null; c.playerEvidence.estimateRef = null; c.playerEvidence.ratingSamples = null; c.playerEvidence.predictionSamples = null;
  c.playerEvidence.recordSemantics = 'verified_attempt'; c.playerEvidence.attemptRefs = ['attempt-1', 'attempt-2', 'attempt-3'];
  for (let n = 1; n <= 3; n++) {
    const r = record(`attempt-${n}`, 'attempt', 'verified-attempt', c.chartId, c.catalogRevision, { type: 'attempt', attemptId: `play-${n}`, platform: 'synthetic-cabinet', mode: 'normal', verified: true, good: 999, ok: 1, ng: 0, combo: 1000, total: 1000, gauge: 79, gaugeMax: 100, clearRequirement: 80, otherClearConditionsKnown: true, otherClearConditionsPassed: true });
    r.ref.occurredAt = `2026-11-${20 + n}T00:00:00.000Z`; f.evidence.push(r);
  }
  f.evidence.push(record('attempt-window', 'coverage', 'verified-attempt', c.chartId, c.catalogRevision, { type: 'attempt_window', attemptRefs: [...c.playerEvidence.attemptRefs], complete: true, platform: 'synthetic-cabinet', mode: 'normal', from: '2026-10-25T00:00:00.000Z', to: NOW }));
  if (subtype === 'ng_reduction') f.evidence.push(record('baseline-ng', 'goal_baseline', 'goal-portfolio', c.chartId, c.catalogRevision, { type: 'goal_baseline', goalType: 'ng-reduced', highScore: null, total: 1000, ng: 10, platform: 'synthetic-cabinet', mode: 'normal' }));
  c.actionability.evidenceRefs = ['snapshot-1', 'attempt-window', ...c.playerEvidence.attemptRefs]; c.actionability.confidence.basisRefs = ['attempt-window']; c.actionability.confidence.sourceReliability = null;
  c.actionability.reasonCodes = [{ clear: 'CROWN_CLEAR_NEAR_EVIDENCE', full_combo: 'CROWN_FC_NEAR_EVIDENCE', dondaful_combo: 'CROWN_DF_NEAR_EVIDENCE', ng_reduction: 'CROWN_NG_NEAR_EVIDENCE' }[subtype]];
  c.actionability.limitations = ['NEAR_EVIDENCE_NOT_CROWN_PROBABILITY', 'STATE_TRANSITION_NOT_SESSION'];
  return seal(f);
}
export function levelDiscovery(): Fixture {
  const f = fixture(), player = structuredClone(f.candidates[0]!.playerEvidence);
  interest(f); const c = f.candidates[0]!;
  c.playerEvidence = { ...player, coverageRef: 'coverage-1' }; c.subtype = 'level_matched_discovery'; c.readiness = 'ready_now';
  c.target = { kind: 'explore_chart', discoveryMode: 'level_matched', coverageRef: 'coverage-1', relevanceRef: 'interest-1', loadEvidenceRef: 'load-1', horizon: 'near_term', definitionVersion: 'target/1' };
  f.evidence.find(r => r.ref.id === 'coverage-1')!.payload = { type: 'coverage', region: 'CN', queryExecuted: true, completeness: 'complete', absenceSemantics: 'unplayed', from: '2000-01-01T00:00:00.000Z', to: NOW, difficultyScope: [4], noFilters: true, recordPresent: true };
  f.evidence.push(record('load-1', 'estimate', 'core-estimator', c.chartId, c.catalogRevision, { type: 'score_load_fit', targetHash: hash(c.target), scoreTarget: 950000, readiness: 'ready_now', estimateRef: 'estimate-1', ratingRef: 'rating', policyVersion: c.policyVersion }, 'core-estimator/1'));
  c.actionability.evaluationScope = 'target_actionability'; c.actionability.missingEvidence = []; c.actionability.evidenceRefs = ['load-1', 'coverage-1', 'interest-1']; c.actionability.confidence.basisRefs = ['load-1']; c.actionability.reasonCodes = ['DISCOVERY_LEVEL_MATCHED']; c.actionability.limitations = ['EXPLORE_NOT_PLAYED', 'ABSENCE_SCOPED_TO_SOURCE'];
  return seal(f);
}
export function dimension(): Fixture {
  const f = levelDiscovery(), c = f.candidates[0]!;
  c.intentType = 'dimension_training'; c.subtype = 'dimension_practice';
  c.target = { kind: 'dimension_practice', dimension: { namespace: 'viewer-six-dimension', key: 'speed', schemaVersion: 'viewer-six-dimension/1' }, practiceDefinitionRef: 'focus', loadEvidenceRef: 'load-1', horizon: 'near_term', definitionVersion: 'target/1' };
  f.evidence.find(r => r.ref.id === 'load-1')!.payload.targetHash = hash(c.target);
  f.evidence.push(record('focus', 'preference', 'user-preference', c.chartId, c.catalogRevision, { type: 'dimension_focus', dimension: 'speed', explicit: true }));
  f.evidence.push(record('feature', 'chart_feature', 'catalog-authority', c.chartId, c.catalogRevision, { type: 'dimension_feature', dimension: 'speed', namespace: 'viewer-six-dimension', schemaVersion: 'viewer-six-dimension/1', verified: true }));
  f.evidence.push(record('growth', 'growth', 'growth-projection', null, c.catalogRevision, { type: 'dimension_measurement', dimension: 'speed', value: 8, globalConsistency: 'consistent', dimensionConsistency: 'consistent', scoreRevision: c.scoreRevision }, 'rating/1'));
  c.chartEvidence.featureRefs = ['feature']; c.chartEvidence.verifiedDimensions = ['speed'];
  c.actionability.evidenceRefs = ['load-1', 'focus', 'feature', 'growth', 'rating']; c.actionability.reasonCodes = ['DIMENSION_EXPLICIT_FOCUS', 'DIMENSION_PLAYER_CHART_MATCH']; c.actionability.limitations = ['PRACTICE_NOT_ABILITY_GAIN', 'SIX_DIMENSION_ONLY'];
  return seal(f);
}
export function taskFixture(): Fixture {
  const f = fixture(), c = f.candidates[0]!;
  c.intentType = 'challenge'; c.subtype = 'dan_task';
  c.target = { kind: 'task_requirement', taskId: 'dan-synthetic', taskVersion: '1', requirementId: 'r1', requirementRef: 'task', horizon: 'near_term', definitionVersion: 'target/1' };
  f.evidence.push(record('task', 'task', 'task-authority', c.chartId, c.catalogRevision, { type: 'task', taskId: 'dan-synthetic', taskVersion: '1', authorityRef: 'synthetic-authority', sourceHash: hash('task'), region: 'CN', platform: 'synthetic-cabinet', validFrom: '2026-01-01T00:00:00.000Z', validTo: '2026-12-31T00:00:00.000Z', evergreen: false, progressKnownAt: NOW, requirements: [{ requirementId: 'r1', chartId: c.chartId, target: { kind: 'score', threshold: 950000, comparison: 'gte', baselineRef: null, horizon: 'near_term', definitionVersion: 'target/1' }, sameAttempt: true, completed: false }], progressRevision: 'task-progress/1', completed: false }));
  c.readiness = 'not_actionable'; c.actionability.confidence.level = 'unknown'; c.actionability.confidence.basisRefs = ['task']; c.actionability.confidence.sourceReliability = null; c.actionability.evidenceRefs = ['task']; c.actionability.reasonCodes = ['TASK_REQUIREMENT_UNSUPPORTED']; c.actionability.missingEvidence = ['task.actionabilityEvaluator']; c.actionability.limitations = ['CHART_PROGRESS_NOT_TASK_CLEAR', 'TASK_VERSION_SCOPED'];
  return seal(f);
}
