/** B4 offline/1 validator of frozen evaluator outputs. No score/crown prediction or Goal completion. */
import type { EvidenceRecord, MultiObjectiveCandidate, ValidationContext, ValidationIssue } from './contracts.ts';
import type { EvidenceIndex } from './evidence.ts';
import { coverageIsComplete, scoreEvidenceFailures } from './evidence.ts';
import { evaluatorCapability } from './registries.ts';
import { DAY, same, unique, compare } from './common.ts';
import { actionabilityShape } from './schemas.ts';
import { inspect } from './shape.ts';
import { samePlayScope, validateScorePbBaseline } from './evidence-bindings.ts';
const reasons = new Set(`EVIDENCE_MISSING EVIDENCE_STALE EVIDENCE_SCOPE_MISMATCH EVIDENCE_FUTURE CATALOG_UNAVAILABLE USER_EXCLUDED TARGET_UNSUPPORTED TARGET_ALREADY_MET EVALUATOR_UNREGISTERED
SCORE_STABLE_SUPPORTED SCORE_BOUNDED_STRETCH SCORE_PB_ONLY RATING_SAMPLE_INSUFFICIENT PREDICTION_SAMPLE_INSUFFICIENT PREDICTION_SAMPLE_EVIDENCE_MISSING SCORE_TARGET_INVALID SCORE_TARGET_BINDING_MISMATCH SCORE_RANK_MAPPING_MISSING
CROWN_CLEAR_NEAR_EVIDENCE CROWN_FC_NEAR_EVIDENCE CROWN_DF_NEAR_EVIDENCE CROWN_NG_NEAR_EVIDENCE CROWN_BOUNDED_STRETCH CROWN_ATTEMPTS_MISSING JUDGEMENT_SEMANTICS_UNKNOWN AGGREGATE_NOT_ATTEMPT CROWN_REQUIREMENT_UNKNOWN CROWN_BASELINE_INCOMPARABLE
DIMENSION_PLAYER_CHART_MATCH DIMENSION_EXPLICIT_FOCUS DIMENSION_WEAKNESS_CORROBORATED DIMENSION_LOWEST_ONLY DIMENSION_PLAYER_MISSING DIMENSION_CHART_MISSING DIMENSION_INCONSISTENT DIMENSION_LOAD_UNKNOWN
DISCOVERY_INTEREST_SUPPORTED LEVEL_MATCH_NOT_ASSESSED DISCOVERY_LEVEL_MATCHED DISCOVERY_UNPLAYED_SCOPED DISCOVERY_REVISIT DISCOVERY_NO_SCORE_RECORD DISCOVERY_COVERAGE_UNKNOWN DISCOVERY_RELEVANCE_MISSING DISCOVERY_LOAD_UNKNOWN
TASK_NEXT_REQUIREMENT TASK_COMPOSITE_SUPPORTED TASK_DEFINITION_MISSING TASK_PROGRESS_MISSING TASK_EXPIRED TASK_REQUIREMENT_UNSUPPORTED TASK_LONG_TERM REGISTERED_EVALUATOR_DECLINED`.split(/\s+/));
export function validateActionabilityEvaluation(c: MultiObjectiveCandidate, ctx: ValidationContext, evidence: EvidenceIndex): ValidationIssue[] {
  const issues = inspect(actionabilityShape, c.actionability);
  if (issues.length) return issues;
  const add = (code: string, path = 'actionability') => issues.push({ path, code });
  const a = c.actionability, t = c.target, actionable = a.readiness !== 'not_actionable', stretch = a.readiness === 'reasonable_stretch';
  const capability = evaluatorCapability(c.subtype);
  if (!capability || a.evaluatorId !== capability.evaluatorId || a.evaluatorVersion !== capability.evaluatorVersion || a.evaluationScope !== capability.scope) add('EVALUATOR_UNREGISTERED');
  if (a.targetHash !== c.targetHash || a.policyVersion !== ctx.policyVersion || a.asOf !== ctx.asOf || a.evaluatedAt > ctx.asOf || a.evaluatedAt < c.generatedAt || a.readiness !== c.readiness) add('EVALUATION_SCOPE_MISMATCH');
  if (!a.reasonCodes.length || a.reasonCodes.some(r => !reasons.has(r))) add('REASON_CODE_UNREGISTERED');
  if (!a.limitations.length) add('LIMITATIONS_REQUIRED');
  const mandatoryLimitations: Record<string, string[]> = {
    crown_completion: ['NEAR_EVIDENCE_NOT_CROWN_PROBABILITY', 'STATE_TRANSITION_NOT_SESSION'],
    dimension_training: ['PRACTICE_NOT_ABILITY_GAIN', 'SIX_DIMENSION_ONLY'],
    discovery: ['ABSENCE_SCOPED_TO_SOURCE', 'EXPLORE_NOT_PLAYED'],
    challenge: ['CHART_PROGRESS_NOT_TASK_CLEAR', 'TASK_VERSION_SCOPED'],
  };
  if ((mandatoryLimitations[c.intentType] ?? []).some(code => !a.limitations.includes(code))) add('TYPE_LIMITATIONS_REQUIRED');
  const commonCodes = new Set(['EVIDENCE_MISSING', 'EVIDENCE_STALE', 'EVIDENCE_SCOPE_MISMATCH', 'EVIDENCE_FUTURE', 'CATALOG_UNAVAILABLE', 'USER_EXCLUDED', 'TARGET_UNSUPPORTED', 'TARGET_ALREADY_MET', 'EVALUATOR_UNREGISTERED', 'REGISTERED_EVALUATOR_DECLINED']);
  const allowedPrefixes: Record<string, string[]> = { score_improvement: ['SCORE_', 'RATING_', 'PREDICTION_'], crown_completion: ['CROWN_', 'JUDGEMENT_', 'AGGREGATE_'], dimension_training: ['DIMENSION_', 'RATING_', 'PREDICTION_'], discovery: ['DISCOVERY_', 'LEVEL_MATCH_', 'RATING_', 'PREDICTION_'], challenge: ['TASK_'] };
  if (a.reasonCodes.some(code => !commonCodes.has(code) && !(allowedPrefixes[c.intentType] ?? []).some(p => code.startsWith(p)))) add('REASON_CODE_TYPE_MISMATCH');
  if (a.reasonCodes.includes('DIMENSION_WEAKNESS_CORROBORATED')) add('WEAKNESS_EVALUATOR_UNAVAILABLE');
  const positiveReason: Record<string, string> = { score_pb: stretch ? 'SCORE_BOUNDED_STRETCH' : 'SCORE_STABLE_SUPPORTED', score_target: stretch ? 'SCORE_BOUNDED_STRETCH' : 'SCORE_STABLE_SUPPORTED', rank_upgrade: stretch ? 'SCORE_BOUNDED_STRETCH' : 'SCORE_STABLE_SUPPORTED', clear: stretch ? 'CROWN_BOUNDED_STRETCH' : 'CROWN_CLEAR_NEAR_EVIDENCE', full_combo: stretch ? 'CROWN_BOUNDED_STRETCH' : 'CROWN_FC_NEAR_EVIDENCE', dondaful_combo: stretch ? 'CROWN_BOUNDED_STRETCH' : 'CROWN_DF_NEAR_EVIDENCE', ng_reduction: stretch ? 'CROWN_BOUNDED_STRETCH' : 'CROWN_NG_NEAR_EVIDENCE', dimension_practice: 'DIMENSION_EXPLICIT_FOCUS', level_matched_discovery: 'DISCOVERY_LEVEL_MATCHED' };
  if (actionable && positiveReason[c.subtype] && !a.reasonCodes.includes(positiveReason[c.subtype]!)) add('TYPE_POSITIVE_REASON_REQUIRED');
  for (const id of [...a.evidenceRefs, ...a.confidence.basisRefs]) {
    const r = evidence.get(id);
    if (!r || !c.evidenceRefs.includes(id)) add('EVIDENCE_MISSING');
    else if (r.ref.knownAt > a.evaluatedAt) add('EVALUATION_BEFORE_EVIDENCE');
  }
  if (actionable && (a.missingEvidence.length || !a.evidenceRefs.length || !a.confidence.basisRefs.length || a.confidence.level !== (stretch ? 'medium' : 'high'))) add('CONFIDENCE_SEMANTICS_INVALID');
  if (!actionable && a.evaluationScope === 'target_actionability' && !['low', 'unknown'].includes(a.confidence.level)) add('CONFIDENCE_SEMANTICS_INVALID');
  if (!same(a.reasonCodes, c.diagnostics.reasonCodes) || !same(a.missingEvidence, c.diagnostics.missingEvidence) || !same(a.limitations, c.diagnostics.limitations)) add('DIAGNOSTICS_PROJECTION_MISMATCH');
  const get = (id: string | null) => id ? evidence.get(id)?.payload : undefined;
  const snapshots = c.playerEvidence.snapshotRefs.map(get).filter(p => p?.type === 'score_snapshot');
  if (snapshots.length > 1 && snapshots.some(p => !same(p, snapshots[0]))) add('CURRENT_SNAPSHOT_CONFLICT');
  const current = snapshots[0];
  const crownOwned = (p: Record<string, unknown>, crown: string): boolean => {
    const crowns = p.crowns as Record<string, unknown>;
    return crowns[crown] === true || (crown === 'clear' && (crowns.full_combo === true || crowns.dondaful_combo === true)) || (crown === 'full_combo' && crowns.dondaful_combo === true);
  };
  const used = a.evidenceRefs.map(id => evidence.get(id)).filter(r => r !== undefined);
  const windows = c.intentType === 'crown_completion' ? used.filter(r => r.payload.type === 'attempt_window') : [];
  const window = windows.length === 1 ? windows[0]!.payload : undefined;
  const attempts = c.playerEvidence.attemptRefs.map(id => evidence.get(id)).filter((r): r is EvidenceRecord => r?.payload.type === 'attempt');
  const windowVerified = !!window && same(unique(window.attemptRefs as string[]), unique(c.playerEvidence.attemptRefs))
    && window.to === ctx.asOf && Date.parse(window.from as string) <= Date.parse(ctx.asOf) - 30 * DAY;
  const attemptsScoped = !!window && attempts.length === c.playerEvidence.attemptRefs.length
    && new Set(attempts.map(r => r.payload.attemptId)).size === attempts.length
    && attempts.every(r => samePlayScope(r.payload, window) && !!r.ref.occurredAt
      && r.ref.occurredAt >= (window.from as string) && r.ref.occurredAt <= (window.to as string)
      && Date.parse(ctx.asOf) - Date.parse(r.ref.occurredAt) <= 30 * DAY);
  const currentScoped = snapshots.length > 0 && snapshots.every(p => samePlayScope(p, window));
  const baseline = t.kind === 'ng_reduction' ? get(t.baselineRef) : undefined;
  const baselineScoped = t.kind !== 'ng_reduction' || (baseline?.type === 'goal_baseline' && baseline.goalType === 'ng-reduced' && samePlayScope(baseline, window));
  const crownScoped = windowVerified && attemptsScoped && currentScoped && baselineScoped;
  if (snapshots.some(p => p && ((t.kind === 'score' && typeof p.currentBestScore === 'number' && p.currentBestScore >= t.threshold)
    || (t.kind === 'rank' && typeof p.rank === 'number' && p.rank >= t.threshold)
    || (crownScoped && ((t.kind === 'crown' && crownOwned(p, t.crown))
      || (t.kind === 'ng_reduction' && p.judgeTotal === t.total && typeof p.ng === 'number' && p.ng <= t.threshold)))))) add('TARGET_ALREADY_MET');
  if (actionable && c.chartEvidence.availability !== 'active') add('CATALOG_UNAVAILABLE');
  const requireEvidence = (id: string) => { if (!a.evidenceRefs.includes(id)) add('EVALUATOR_REQUIRED_REF_MISSING'); };
  const loadFit = (id: string) => {
    const load = get(id); requireEvidence(id);
    if (!load || load.type !== 'score_load_fit' || load.targetHash !== c.targetHash || load.policyVersion !== ctx.policyVersion || load.readiness !== c.readiness || load.estimateRef !== c.playerEvidence.estimateRef || load.ratingRef !== c.playerEvidence.ratingRef) { add('LOAD_FIT_EVIDENCE_INVALID'); return; }
    for (const code of scoreEvidenceFailures(c, ctx, evidence, load.scoreTarget as number, stretch)) add(code);
  };
  if (c.subtype === 'interest_discovery') {
    if (actionable || a.evaluationScope !== 'interest_relevance') add('INTEREST_DISCOVERY_D_ONLY');
    if (t.kind !== 'explore_chart' || get(t.relevanceRef)?.type !== 'interest') add('DISCOVERY_RELEVANCE_MISSING');
    else requireEvidence(t.relevanceRef);
    if (!a.reasonCodes.includes('LEVEL_MATCH_NOT_ASSESSED') || !a.limitations.includes('INTEREST_NOT_LEVEL_FIT')) add('INTEREST_SCOPE_DISCLOSURE_REQUIRED');
  }
  if (c.subtype === 'level_matched_discovery' && t.kind === 'explore_chart' && t.discoveryMode === 'level_matched') {
    if (get(t.relevanceRef)?.type !== 'interest') add('DISCOVERY_RELEVANCE_MISSING');
    if (actionable) { requireEvidence(t.relevanceRef); if (!coverageIsComplete(c, ctx, evidence)) add('DISCOVERY_COVERAGE_INSUFFICIENT'); loadFit(t.loadEvidenceRef); }
  }
  if (c.intentType === 'score_improvement') {
    const estimate = get(c.playerEvidence.estimateRef);
    let threshold: number | null = t.kind === 'score' ? t.threshold : null;
    if (t.kind === 'rank' && t.requirementRef) {
      const mapping = get(t.requirementRef);
      if (mapping?.type === 'rank_requirement' && mapping.rank === t.threshold) threshold = mapping.scoreThreshold as number;
    }
    issues.push(...validateScorePbBaseline(c, ctx, evidence));
    if (threshold !== null && estimate?.currentBestScore !== null && typeof estimate?.currentBestScore === 'number' && threshold <= estimate.currentBestScore) add('TARGET_ALREADY_MET');
    if (actionable) {
      if (threshold === null) add('SCORE_RANK_MAPPING_MISSING');
      else for (const code of scoreEvidenceFailures(c, ctx, evidence, threshold, stretch)) add(code);
      if (c.playerEvidence.estimateRef) requireEvidence(c.playerEvidence.estimateRef);
      if (c.playerEvidence.ratingRef) requireEvidence(c.playerEvidence.ratingRef);
      if (!a.limitations.includes('MODEL_ESTIMATE_NOT_ATTEMPT_DISTRIBUTION') || !a.limitations.includes('CONFIDENCE_NOT_SUCCESS_PROBABILITY')) add('SCORE_LIMITATIONS_REQUIRED');
      if (!estimate || a.confidence.sourceReliability?.value !== estimate.reliability || a.confidence.sourceReliability?.modelVersion !== c.playerEvidence.predictionSamples?.modelVersion) add('RELIABILITY_PROJECTION_MISMATCH');
    } else {
      const p = c.playerEvidence.predictionSamples;
      if ((!p || p.stableNeighborCount === null) && (!a.reasonCodes.includes('PREDICTION_SAMPLE_EVIDENCE_MISSING') || !a.missingEvidence.includes('predictionSamples'))) add('PREDICTION_MISSING_DIAGNOSTIC_REQUIRED');
    }
  }
  if (c.intentType === 'crown_completion') {
    if (actionable) {
      if (c.playerEvidence.recordSemantics !== 'verified_attempt') add('AGGREGATE_NOT_ATTEMPT');
      if (!current || (t.kind === 'crown' && (current.crowns as Record<string, unknown>)[t.crown] !== false)) add('CROWN_CURRENT_UNKNOWN');
      if (!windowVerified) add('CROWN_ATTEMPT_WINDOW_UNVERIFIED');
      if (!currentScoped) add('CROWN_CURRENT_SCOPE_UNVERIFIED');
      if (!attemptsScoped) add('CROWN_ATTEMPT_SCOPE_INVALID');
      const ordered = attempts.sort((x, y) => compare(y.ref.occurredAt ?? '', x.ref.occurredAt ?? '') || compare(x.ref.id, y.ref.id));
      if (ordered.length < (stretch ? 2 : 3) || ordered.length > 3 || (!stretch && new Set(ordered.map(r => r.ref.occurredAt?.slice(0, 10))).size < 2)) add('CROWN_ATTEMPTS_MISSING');
      if (t.kind === 'ng_reduction' && (!baseline || baseline.type !== 'goal_baseline' || baseline.goalType !== 'ng-reduced' || !(typeof baseline.ng === 'number' && baseline.ng > 0) || baseline.total !== t.total || t.threshold !== (baseline.ng as number) - 1 || current?.judgeTotal !== t.total)) add('CROWN_BASELINE_INCOMPARABLE');
      if (t.kind === 'ng_reduction' && (!baseline?.mode || !baseline?.platform || baseline.mode !== window?.mode || baseline.platform !== window?.platform || current?.mode !== baseline.mode || current?.platform !== baseline.platform)) add('CROWN_BASELINE_MODE_UNVERIFIED');
      const near = (p: Record<string, unknown>, loose: boolean): boolean => {
        if (t.kind === 'crown' && t.crown === 'full_combo') return (p.ng as number) <= (loose ? 3 : 1);
        if (t.kind === 'crown' && t.crown === 'dondaful_combo') return loose ? (p.ng as number) <= 1 && (p.ng as number) + (p.ok as number) <= 5 : p.ng === 0 && (p.ok as number) <= 2;
        if (t.kind === 'ng_reduction') return p.total === t.total && (p.ng as number) <= t.threshold;
        if (t.kind === 'crown' && t.crown === 'clear') return typeof p.gauge === 'number' && typeof p.gaugeMax === 'number' && p.gaugeMax > 0 && typeof p.clearRequirement === 'number' && p.clearRequirement <= p.gaugeMax && p.gauge <= p.gaugeMax && p.otherClearConditionsKnown === true && p.otherClearConditionsPassed === true && Math.max(0, p.clearRequirement - p.gauge) <= .05 * p.gaugeMax;
        return false;
      };
      if (!ordered.length || (stretch ? !near(ordered[0]!.payload, true) : !ordered.every(r => near(r.payload, false)))) add('CROWN_NEAR_CONTRACT_FAILED');
    }
  }
  if (t.kind === 'dimension_practice' && actionable) {
    const focus = get(t.practiceDefinitionRef);
    if (focus?.type !== 'dimension_focus' || focus.dimension !== t.dimension.key) add('DIMENSION_FOCUS_OR_WEAKNESS_UNSUPPORTED');
    const r = c.playerEvidence.ratingRef ? evidence.get(c.playerEvidence.ratingRef) : undefined;
    const growth = used.filter(x => x.payload.type === 'dimension_measurement' && x.payload.dimension === t.dimension.key);
    const dimensions = r?.payload.dimensions as Record<string, number> | undefined;
    if (!r || !dimensions || !(dimensions[t.dimension.key]! > 0) || !c.playerEvidence.ratingSamples || c.playerEvidence.ratingSamples.sampleCount < 20 || growth.length !== 1 || growth[0]!.ref.modelVersion !== r.ref.modelVersion || growth[0]!.payload.scoreRevision !== c.scoreRevision || growth[0]!.payload.globalConsistency !== 'consistent' || growth[0]!.payload.dimensionConsistency !== 'consistent' || !(growth[0]!.payload.value as number > 0)) add('DIMENSION_PLAYER_INCONSISTENT');
    if (!c.chartEvidence.verifiedDimensions.includes(t.dimension.key) || !c.chartEvidence.featureRefs.some(id => get(id)?.type === 'dimension_feature' && get(id)?.dimension === t.dimension.key)) add('DIMENSION_CHART_MISSING');
    requireEvidence(t.practiceDefinitionRef); loadFit(t.loadEvidenceRef);
  }
  if (c.intentType === 'challenge') {
    const ids = t.kind === 'task_requirement' ? [t.requirementRef] : t.kind === 'task_completion' ? t.requirementRefs : [];
    if (!ids.length) add('TASK_DEFINITION_MISSING');
    for (const id of ids) {
      const task = get(id); requireEvidence(id);
      if (!task || task.type !== 'task' || !('taskId' in t) || task.taskId !== t.taskId || task.taskVersion !== t.taskVersion || task.region !== c.region) { add('TASK_DEFINITION_MISSING'); continue; }
      if (task.validFrom as string > ctx.asOf || task.progressKnownAt as string > ctx.asOf || (task.evergreen === false && (task.validTo === null || task.validTo as string < ctx.asOf))) add('TASK_EXPIRED_OR_FUTURE');
      if (task.completed === true) add('TARGET_ALREADY_MET');
      const reqs = task.requirements as { requirementId: string; chartId: string; completed: boolean }[];
      if (!reqs.length || new Set(reqs.map(r => r.requirementId)).size !== reqs.length || (t.kind === 'task_requirement' && !reqs.some(r => r.requirementId === t.requirementId && r.chartId === c.chartId && !r.completed))) add('TASK_REQUIREMENT_UNSUPPORTED');
    }
    if (actionable) add('TASK_ACTIONABILITY_EVALUATOR_UNAVAILABLE');
  }
  return issues;
}
