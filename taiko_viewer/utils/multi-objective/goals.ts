/** B4 offline/1 exact, read-only Goal association. Never invokes storage or a completion evaluator. */
import type { GoalLink, MultiObjectiveCandidate, PortfolioGoalSnapshot, SuppressionDiagnostic, ValidationContext, ValidationIssue } from './contracts.ts';
import type { PreparedContext } from './context.ts';
import { prepareValidationContext } from './context.ts';
import { getGoalTypeCapability } from './registries.ts';
import { hash, same, unique, compare } from './common.ts';
import { referencedEvidence, validateEvidenceScope, validateSampleEvidence } from './evidence.ts';
import { validateActionabilityEvaluation } from './actionability.ts';
export function goalToLink(g: PortfolioGoalSnapshot): GoalLink {
  return structuredClone({ goalId: g.id, goalRevision: g.goalRevision, baselineRef: g.baselineRef, targetHash: g.targetHash!, lifecycleStatus: g.lifecycleStatus, availability: g.availability, userPriority: g.userPriority, userOrder: g.userOrder, actionability: g.actionability, evaluationRef: g.evaluationRef });
}
function linkProblems(c: MultiObjectiveCandidate, g: PortfolioGoalSnapshot, prepared: PreparedContext): string[] {
  const { context: ctx, evidence, authority } = prepared;
  const capability = getGoalTypeCapability(g.goalType);
  if (g.chartId === null || g.identityMappingRef === null || g.target === null || g.targetHash === null) return ['LEGACY_GOAL_IDENTITY_OR_TARGET_UNKNOWN'];
  if (capability.subtype !== c.subtype || g.chartId !== c.chartId || g.targetHash !== c.targetHash) return ['GOAL_NOT_EXACT_MATCH'];
  if (g.profileId !== c.profileId || g.targetHash !== hash(g.target) || !same(g.target, c.target)) return ['GOAL_TARGET_SCOPE_MISMATCH'];
  // Different namespace mapping proofs may be valid for the same canonical chart.
  if (!['wahlap', 'catalog-id', 'ourtaiko', 'taikowiki', 'nijiiro'].some(sourceNamespace => authority.verify({ ...c, sourceNamespace, identityMappingRef: g.identityMappingRef! }).length === 0)) return ['GOAL_IDENTITY_UNVERIFIED'];
  const baseline = evidence.get(g.baselineRef);
  if (baseline?.payload.type !== 'goal_baseline' || baseline.payload.goalType !== g.goalType || baseline.ref.chartId !== c.chartId || baseline.ref.profileId !== c.profileId) return ['GOAL_BASELINE_UNVERIFIED'];
  if (g.goalType === 'score-pb' && (c.target.kind !== 'score' || c.target.baselineRef !== g.baselineRef || typeof baseline.payload.highScore !== 'number' || c.target.threshold !== baseline.payload.highScore + 1)) return ['SCORE_TARGET_BINDING_MISMATCH'];
  if (g.goalType === 'ng-reduced' && (c.target.kind !== 'ng_reduction' || c.target.baselineRef !== g.baselineRef)) return ['GOAL_BASELINE_UNVERIFIED'];
  const linked = { ...c, actionability: g.actionability, readiness: g.actionability.readiness, goalIds: [g.id], goalLinks: [goalToLink(g)], diagnostics: { ...c.diagnostics, reasonCodes: g.actionability.reasonCodes, missingEvidence: g.actionability.missingEvidence, limitations: g.actionability.limitations } };
  linked.evidenceRefs = referencedEvidence(linked, evidence);
  return unique([...validateActionabilityEvaluation(linked, ctx, evidence), ...validateEvidenceScope(linked, ctx, evidence), ...validateSampleEvidence(linked, ctx, evidence)].map(i => i.code));
}
export function validateGoalLinks(c: MultiObjectiveCandidate, prepared: PreparedContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [], portfolio = prepared.context.portfolio;
  if (!same(c.goalIds, unique(c.goalLinks.map(g => g.goalId))) || new Set(c.goalLinks.map(g => g.goalId)).size !== c.goalLinks.length) issues.push({ path: 'goalIds', code: 'GOAL_IDS_PROJECTION_MISMATCH' });
  for (const link of c.goalLinks) {
    const g = portfolio?.goals.find(g => g.id === link.goalId);
    if (!g || !same(goalToLink(g), link)) issues.push({ path: link.goalId, code: 'GOAL_LINK_REVISION_OR_STATE_MISMATCH' });
    else for (const code of linkProblems(c, g, prepared)) issues.push({ path: link.goalId, code });
  }
  return issues;
}
export function associateCandidatesWithPortfolio(candidates: readonly MultiObjectiveCandidate[], context: ValidationContext, prepared = prepareValidationContext(context)): { candidates: MultiObjectiveCandidate[]; diagnostics: SuppressionDiagnostic[] } {
  const diagnostics: SuppressionDiagnostic[] = [];
  if (prepared.issues.length || candidates.length > 5000) return { candidates: [], diagnostics: [{ candidateId: null, goalId: null, reasonCode: 'ASSOCIATION_INPUT_INVALID', details: unique(prepared.issues.map(i => i.code)) }] };
  const goals = [...context.portfolio?.goals ?? []].sort((a, b) => compare(a.id, b.id));
  const byChart = new Map<string, PortfolioGoalSnapshot[]>();
  for (const goal of goals) {
    if (!goal.chartId || !goal.identityMappingRef || !goal.target) diagnostics.push({ candidateId: null, goalId: goal.id, reasonCode: 'LEGACY_GOAL_IDENTITY_OR_TARGET_UNKNOWN', details: ['AVAILABILITY_UNKNOWN_NO_GUESS'] });
    else byChart.set(goal.chartId, [...byChart.get(goal.chartId) ?? [], goal]);
  }
  const associated = candidates.map(original => {
    const c = structuredClone(original), links: GoalLink[] = [];
    for (const goal of byChart.get(c.chartId) ?? []) {
      const errors = linkProblems(c, goal, prepared);
      if (errors.length) { if (!errors.includes('GOAL_NOT_EXACT_MATCH')) diagnostics.push({ candidateId: c.candidateId, goalId: goal.id, reasonCode: 'GOAL_ASSOCIATION_REJECTED', details: errors }); }
      else links.push(goalToLink(goal));
    }
    c.goalLinks = links; c.goalIds = links.map(g => g.goalId); c.evidenceRefs = referencedEvidence(c, prepared.evidence);
    return c;
  }).sort((a, b) => compare(a.candidateId, b.candidateId));
  return { candidates: associated, diagnostics };
}
