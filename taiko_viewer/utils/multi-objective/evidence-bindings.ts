/** B4 offline/1 evidence bindings. Explicit baseline refs never fall back. */
import type { MultiObjectiveCandidate, ValidationContext, ValidationIssue } from './contracts.ts';
import type { EvidenceIndex } from './evidence.ts';
import { hash } from './common.ts';

export function samePlayScope(a: Record<string, unknown> | undefined, b: Record<string, unknown> | undefined): boolean {
  return typeof a?.mode === 'string' && a.mode.trim().length > 0
    && typeof a.platform === 'string' && a.platform.trim().length > 0
    && a.mode === b?.mode && a.platform === b?.platform;
}

export function validateScorePbBaseline(c: MultiObjectiveCandidate, ctx: ValidationContext, evidence: EvidenceIndex): ValidationIssue[] {
  if (c.subtype !== 'score_pb' || c.target.kind !== 'score') return [];
  const issues: ValidationIssue[] = [];
  const add = (code: string) => issues.push({ path: 'target.baselineRef', code });
  const explicit = c.target.baselineRef !== null;
  const id = explicit ? c.target.baselineRef : c.playerEvidence.estimateRef;
  const record = id ? evidence.get(id) : undefined;
  if (!record) { add('SCORE_BASELINE_EVIDENCE_MISSING'); return issues; }
  const { ref, payload } = record;
  if (explicit ? payload.type !== 'goal_baseline' || ref.kind !== 'goal_baseline' || ref.source !== 'goal-portfolio'
    : payload.type !== 'score_estimate' || ref.kind !== 'estimate' || ref.source !== 'core-estimator') {
    add('SCORE_BASELINE_TYPE_UNSUPPORTED'); return issues;
  }
  if (explicit && payload.goalType !== 'score-pb') add('SCORE_BASELINE_GOAL_TYPE_MISMATCH');
  if (ref.profileId !== c.profileId || ref.profileId !== ctx.profileId || ref.chartId !== c.chartId
    || ref.catalogRevision !== c.catalogRevision || ref.catalogRevision !== ctx.catalogRevision) add('SCORE_BASELINE_SCOPE_MISMATCH');
  if (explicit) {
    const bindings = ctx.goalBaselineBindings?.filter(b => b.baselineRef === id) ?? [];
    const binding = bindings.length === 1 ? bindings[0] : undefined;
    if (!binding) add('SCORE_BASELINE_BINDING_MISSING');
    else {
      if (binding.ownerId !== ctx.ownerId || binding.profileId !== c.profileId || binding.profileId !== ctx.profileId
        || binding.chartId !== c.chartId || !binding.sourceRevision.trim() || binding.sourceRevision !== ref.sourceRevision) add('SCORE_BASELINE_SCOPE_MISMATCH');
      if (binding.evidenceHash !== hash(record)) add('SCORE_BASELINE_IMMUTABILITY_MISMATCH');
    }
    if (ref.contentHash !== hash(payload)) add('EVIDENCE_CONTENT_HASH_MISMATCH');
  } else if (ctx.scoreRevision === null || ref.sourceRevision !== c.scoreRevision || ref.sourceRevision !== ctx.scoreRevision) add('SCORE_BASELINE_SCOPE_MISMATCH');
  const baseline = explicit ? payload.highScore : payload.currentBestScore;
  if (typeof baseline !== 'number' || !Number.isSafeInteger(baseline) || baseline < 0 || !Number.isSafeInteger(baseline + 1)) add('SCORE_BASELINE_VALUE_INVALID');
  else if (c.target.threshold !== baseline + 1) add('SCORE_TARGET_BINDING_MISMATCH');
  return issues;
}
