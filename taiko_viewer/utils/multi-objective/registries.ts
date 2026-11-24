/** B4 offline/1 closed registries. Capability means output validation, not a runnable predictor. */
import type { IntentType, Target, ValidationIssue } from './contracts.ts';
import * as s from './shape.ts';
import { isObject } from './common.ts';
export const INTENTS = ['score_improvement', 'crown_completion', 'dimension_training', 'discovery', 'challenge'] as const;
export const DIMENSIONS = ['big_song', 'stamina', 'speed', 'accuracy_power', 'rhythm', 'complex'] as const;
export const SUBTYPES = Object.freeze({
  score_pb: 'score_improvement', score_target: 'score_improvement', rank_upgrade: 'score_improvement',
  clear: 'crown_completion', full_combo: 'crown_completion', dondaful_combo: 'crown_completion', ng_reduction: 'crown_completion',
  dimension_practice: 'dimension_training', interest_discovery: 'discovery', level_matched_discovery: 'discovery', dan_task: 'challenge', event_task: 'challenge',
} satisfies Record<string, IntentType>);
const base = { horizon: s.one('near_term', 'long_term'), definitionVersion: s.one('target/1') };
const targets: Record<string, s.Shape> = {
  score: s.object({ ...base, kind: s.one('score'), threshold: s.integer(1), comparison: s.one('gte'), baselineRef: s.nullable(s.str) }),
  rank: s.object({ ...base, kind: s.one('rank'), threshold: s.integer(1, 8), comparison: s.one('gte'), requirementRef: s.nullable(s.str) }),
  crown: s.object({ ...base, kind: s.one('crown'), crown: s.one('clear', 'full_combo', 'dondaful_combo') }),
  ng_reduction: s.object({ ...base, kind: s.one('ng_reduction'), baselineRef: s.str, threshold: s.integer(), comparison: s.one('lte'), total: s.integer(1) }),
  dimension_practice: s.object({ ...base, kind: s.one('dimension_practice'), dimension: s.object({ namespace: s.one('viewer-six-dimension'), key: s.one(...DIMENSIONS), schemaVersion: s.one('viewer-six-dimension/1') }), practiceDefinitionRef: s.str, loadEvidenceRef: s.str }),
  task_requirement: s.object({ ...base, kind: s.one('task_requirement'), taskId: s.str, taskVersion: s.str, requirementId: s.str, requirementRef: s.str }),
  task_completion: s.object({ ...base, horizon: s.one('long_term'), kind: s.one('task_completion'), taskId: s.str, taskVersion: s.str, requirementRefs: s.strings }),
};
export const targetShape: s.Shape = (v, p, issues) => {
  if (isObject(v) && v.kind === 'explore_chart') {
    const fields = { ...base, kind: s.one('explore_chart'), discoveryMode: s.one('interest', 'level_matched'), coverageRef: s.str, relevanceRef: s.str };
    s.object(v.discoveryMode === 'level_matched' ? { ...fields, loadEvidenceRef: s.str } : fields)(v, p, issues);
  } else if (isObject(v) && typeof v.kind === 'string' && Object.hasOwn(targets, v.kind)) targets[v.kind]!(v, p, issues);
  else issues.push({ path: p, code: 'TARGET_UNSUPPORTED' });
};
export function validateIntentTargetCombination(intent: unknown, subtype: unknown, target: unknown): ValidationIssue[] {
  const issues = s.inspect(targetShape, target);
  if (issues.length) return issues;
  const t = target as Target;
  if (typeof subtype !== 'string' || !Object.hasOwn(SUBTYPES, subtype) || SUBTYPES[subtype as keyof typeof SUBTYPES] !== intent) return [{ path: 'intentType/subtype', code: 'INTENT_SUBTYPE_UNSUPPORTED' }];
  const correct = (['score_pb', 'score_target'].includes(subtype) && t.kind === 'score') || (subtype === 'rank_upgrade' && t.kind === 'rank')
    || (['clear', 'full_combo', 'dondaful_combo'].includes(subtype) && t.kind === 'crown' && t.crown === subtype)
    || (subtype === 'ng_reduction' && t.kind === 'ng_reduction' && t.threshold < t.total)
    || (subtype === 'dimension_practice' && t.kind === 'dimension_practice')
    || (subtype === 'interest_discovery' && t.kind === 'explore_chart' && t.discoveryMode === 'interest')
    || (subtype === 'level_matched_discovery' && t.kind === 'explore_chart' && t.discoveryMode === 'level_matched')
    || (['dan_task', 'event_task'].includes(subtype) && (t.kind === 'task_requirement' || t.kind === 'task_completion') && (t.kind !== 'task_completion' || t.requirementRefs.length > 0));
  if (!correct) issues.push({ path: 'target', code: 'INTENT_TARGET_MISMATCH' });
  return issues;
}
const goalTypes = { 'score-pb': 'score_pb', 'ng-reduced': 'ng_reduction', clear: 'clear', fc: 'full_combo', df: 'dondaful_combo', 'rank-upgrade': 'rank_upgrade' } as const;
export function getGoalTypeCapability(goalType: string) {
  const subtype = Object.hasOwn(goalTypes, goalType) ? goalTypes[goalType as keyof typeof goalTypes] : null;
  return { goalType, subtype, completionSupported: subtype !== null, completionImplementation: subtype ? 'existing:utils/goalEvaluation.ts' : null, canCreateGoal: false as const, reason: subtype ? 'OFFLINE_NO_ACCEPTANCE_AUTHORITY' : 'GOAL_TYPE_UNSUPPORTED' };
}
export function evaluatorCapability(subtype: string) {
  if (!Object.hasOwn(SUBTYPES, subtype)) return null;
  return Object.freeze({ evaluatorId: `b4-contract:${subtype}`, evaluatorVersion: '1', subtype,
    scope: subtype === 'interest_discovery' ? 'interest_relevance' : 'target_actionability',
    outputValidationOnly: true, predictionImplementation: null, goalCreationAuthorized: false });
}
/** Core estimator rule's existing semantics, not a universal neighbor-count threshold. */
export const PREDICTION_RULE = 'core-estimator/pool-distance-extrapolation/1';
export const PREDICTION_MODEL = 'core-estimator/1';
