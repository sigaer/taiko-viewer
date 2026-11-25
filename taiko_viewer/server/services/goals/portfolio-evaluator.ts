import type { PortfolioGoalV2, GoalEvaluationV2 } from '../../../types/goal-portfolio.ts';
import type { GoalObservation } from '../../../utils/goalEvaluation.ts';
import { evaluateGoal } from '../../../utils/goalEvaluation.ts';
import { hash, same } from '../../../utils/multi-objective/common.ts';
import { CREATABLE_GOAL_TYPES, evaluatorGoal, verifyBaseline, targetForBaseline } from './portfolio-domain.ts';
import type { EvaluationUpdate } from './portfolio-store.ts';
export function evaluatePortfolioGoal(ownerId: number, goal: PortfolioGoalV2, observation: GoalObservation, now = new Date().toISOString()): EvaluationUpdate {
    const supported = CREATABLE_GOAL_TYPES.includes(goal.goalType as any) && goal.target !== null && goal.evaluatorVersion === 'goal-evaluator/1' && goal.targetHash === hash(goal.target) && same(goal.target, targetForBaseline(goal.goalType, goal.baseline.value, goal.baseline.evidenceRefs[0]!)) && verifyBaseline(goal, String(ownerId));
    const result = supported ? evaluateGoal({ ...evaluatorGoal(goal), ownerId }, observation) : { outcome: 'inconclusive' as const, reason: 'unsupported' };
    const { capturedAt: _readTime, ...stableState } = observation.state;
    const evaluation: GoalEvaluationV2 = { evaluationId: hash({ goalId: goal.id, baseline: hash(goal.baseline), targetHash: goal.targetHash, observationRevision: observation.revision, observationProvenance: observation.provenance, observationState: stableState, result, evaluatorVersion: goal.evaluatorVersion }), goalId: goal.id, goalRevision: goal.goalRevision, evaluatorVersion: goal.evaluatorVersion, baselineRevision: goal.baseline.sourceRevision, observationRevision: observation.revision, evaluatedAt: now, observationCapturedAt: observation.capturedAt, outcome: supported ? result.outcome : 'unsupported', reasonCodes: [result.reason], evidenceRefs: [...goal.baseline.evidenceRefs, `score:${observation.revision}`], result };
    const completionEvidence = result.outcome === 'completed' ? { evaluationVersion: 1 as const, evaluatedAt: now, observationCapturedAt: observation.capturedAt, observationRevision: observation.revision, baselineRevision: goal.baseline.sourceRevision, source: observation.provenance!.source, provenance: observation.provenance!, result: result.result! } : null;
    return { goal, evaluation, completionEvidence };
}
