/** B4 offline/1 frozen decision inputs; prepared once per batch, with explicit time. */
import type { ValidationContext, ValidationIssue } from './contracts.ts';
import { B4_SCHEMA, POLICY_VERSION } from './contracts.ts';
import { hash, isTime, unique, compare } from './common.ts';
import { prepareAuthority } from './identity.ts';
import { prepareEvidence } from './evidence.ts';
import { inspect } from './shape.ts';
import { portfolioShape, goalBaselineBindingsShape } from './schemas.ts';
export function createDecisionId(c: Omit<ValidationContext, 'decisionId'> | ValidationContext): string {
  return hash({ schemaVersion: c.schemaVersion, ownerId: c.ownerId, profileId: c.profileId, region: c.region,
    catalogRevision: c.catalogRevision, scoreRevision: c.scoreRevision, portfolioRevision: c.portfolioRevision,
    policyVersion: c.policyVersion, asOf: c.asOf, generatedAt: c.generatedAt, decisionInputsHash: c.decisionInputsHash,
    evidence: [...c.evidence].map(r => r.ref).sort((a, b) => compare(a.id, b.id)),
    goalBaselineBindings: [...c.goalBaselineBindings ?? []].sort((a, b) => compare(a.baselineRef, b.baselineRef)),
    portfolio: c.portfolio === null ? null : { ...c.portfolio, goals: [...c.portfolio.goals].sort((a, b) => compare(a.id, b.id)) },
    excludedChartIds: unique(c.excludedChartIds) });
}
export function prepareValidationContext(c: ValidationContext) {
  const { index: evidence, issues } = prepareEvidence(c.evidence);
  const add = (code: string) => issues.push({ path: 'context', code });
  const bindingIssues = inspect(goalBaselineBindingsShape, c.goalBaselineBindings);
  issues.push(...bindingIssues);
  if (!bindingIssues.length && new Set(c.goalBaselineBindings.map(b => b.baselineRef)).size !== c.goalBaselineBindings.length) add('BASELINE_BINDING_CONFLICT');
  if (c.schemaVersion !== B4_SCHEMA || c.policyVersion !== POLICY_VERSION || !['CN', 'JP'].includes(c.region) || !c.profileId || !c.ownerId || !/^[a-f0-9]{64}$/.test(c.decisionInputsHash)) add('CONTEXT_VERSION_OR_SCOPE_INVALID');
  if (!isTime(c.asOf) || !isTime(c.generatedAt) || c.generatedAt > c.asOf) add('CONTEXT_TIME_INVALID');
  if (c.catalog.catalogRevision !== c.catalogRevision) add('CATALOG_REVISION_MISMATCH');
  if (c.portfolio === null) { if (c.portfolioRevision !== null) add('PORTFOLIO_REVISION_MISMATCH'); }
  else {
    issues.push(...inspect(portfolioShape, c.portfolio));
    if (c.portfolio.ownerId !== c.ownerId || c.portfolio.profileId !== c.profileId || c.portfolio.portfolioRevision !== c.portfolioRevision || c.portfolio.updatedAt > c.asOf) add('PORTFOLIO_SCOPE_MISMATCH');
    if (new Set(c.portfolio.goals.map(g => g.id)).size !== c.portfolio.goals.length) add('GOAL_ID_CONFLICT');
  }
  try { if (createDecisionId(c) !== c.decisionId) add('DECISION_CONTEXT_HASH_MISMATCH'); }
  catch { add('CONTEXT_NOT_CANONICAL_JSON'); }
  return { context: c, authority: prepareAuthority(c.catalog), evidence, issues: issues as ValidationIssue[] };
}
export type PreparedContext = ReturnType<typeof prepareValidationContext>;
