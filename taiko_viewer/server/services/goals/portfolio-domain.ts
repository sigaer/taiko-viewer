import { randomUUID } from 'node:crypto';
import { createError } from 'h3';
import { hash, same } from '../../../utils/multi-objective/common.ts';
import type { EvidenceRecord, GoalBaselineBinding, Target } from '../../../utils/multi-objective/contracts.ts';
import type { GoalBaseline, PlayerGoal } from '../../../types/player-goal.ts';
import type { BaselineEnvelope, CreatableGoalType, PortfolioGoalV2 } from '../../../types/goal-portfolio.ts';
export const CREATABLE_GOAL_TYPES: CreatableGoalType[] = ['score-pb', 'ng-reduced', 'clear', 'fc', 'df', 'rank-upgrade'];
export const terminal = (g: PortfolioGoalV2) => g.lifecycleStatus === 'completed' || g.lifecycleStatus === 'cancelled';
export const decimal = (v: unknown): v is string => typeof v === 'string' && /^(0|[1-9]\d{0,19})$/.test(v) && BigInt(v) <= 18446744073709551615n;
export const sqlTime = (v: string) => v.replace('T', ' ').replace('Z', '');
export function invalid(message = 'invalid-portfolio-command'): never { throw createError({ statusCode: 422, statusMessage: message }); }
export function allowed(value: unknown, keys: string[]): asserts value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k)))
        invalid();
}
export function targetForBaseline(type: string, b: GoalBaseline, baselineRef: string): Target | null {
    const common = { horizon: 'near_term' as const, definitionVersion: 'goal-evaluator/1' };
    if (type === 'score-pb' && Number.isSafeInteger(b.highScore) && b.highScore! >= 0 && Number.isSafeInteger(b.highScore! + 1))
        return { ...common, kind: 'score', threshold: b.highScore! + 1, comparison: 'gte', baselineRef };
    if (type === 'ng-reduced' && [b.goodCnt, b.okCnt, b.ngCnt].every(n => Number.isSafeInteger(n) && n! >= 0) && b.ngCnt! > 0)
        return { ...common, kind: 'ng_reduction', threshold: b.ngCnt! - 1, total: b.goodCnt! + b.okCnt! + b.ngCnt!, comparison: 'lte', baselineRef };
    if (type === 'rank-upgrade' && Number.isInteger(b.bestScoreRank) && b.bestScoreRank! >= 1 && b.bestScoreRank! < 8)
        return { ...common, kind: 'rank', threshold: b.bestScoreRank! + 1, comparison: 'gte', requirementRef: null };
    if (type === 'clear' || type === 'fc' || type === 'df')
        return { ...common, kind: 'crown', crown: type === 'fc' ? 'full_combo' : type === 'df' ? 'dondaful_combo' : 'clear' };
    return null;
}
export function semanticTarget(target: Target | null): unknown {
    if (!target)
        return null;
    if ('baselineRef' in target)
        return { ...target, baselineRef: null };
    return target;
}
export const sameGoalTarget = (a: PortfolioGoalV2, b: PortfolioGoalV2) => a.chartId === b.chartId && a.goalType === b.goalType && same(semanticTarget(a.target), semanticTarget(b.target));
export function baselineEnvelope(ownerId: string, profileId: string, chartId: string | null, goalType: string, value: GoalBaseline, ref = `goal-baseline:${randomUUID()}`): BaselineEnvelope {
    const payload = { type: 'goal_baseline', goalType, ...value };
    const evidence: EvidenceRecord = { schemaVersion: 'b4-evidence/1', ref: { id: ref, kind: 'goal_baseline', source: value.provenance?.source || 'legacy-unverified', sourceRevision: typeof value.sourceRevision === 'string' ? value.sourceRevision : '', contentHash: hash(payload), profileId, chartId, catalogRevision: null, modelVersion: null, occurredAt: null, observedAt: value.provenance?.observedAt || null, confirmedAt: null, knownAt: typeof value.capturedAt === 'string' ? value.capturedAt : '', fieldSemanticsVersion: 'goal-baseline/1' }, payload };
    const p = value.provenance;
    const valid = !!chartId && /^[a-f0-9]{64}$/.test(value.sourceRevision || '') && !!p && ['wahlap', 'hiroba'].includes(p.source) && !!p.account && !!p.topology && !!p.marker && /^[a-f0-9]{64}$/.test(p.contentHash || '') && Number.isFinite(Date.parse(p.observedAt)) && Date.parse(p.observedAt) <= Date.parse(value.capturedAt);
    const binding: GoalBaselineBinding | null = valid ? { schemaVersion: 'goal-baseline-binding/1', baselineRef: ref, ownerId, profileId, chartId: chartId!, sourceRevision: value.sourceRevision, evidenceHash: hash(evidence) } : null;
    return { version: 1, capturedAt: typeof value.capturedAt === 'string' ? value.capturedAt : '', sourceRevision: typeof value.sourceRevision === 'string' ? value.sourceRevision : '', evidenceRefs: [ref], value: structuredClone(value), binding, evidence };
}
export function verifyBaseline(g: PortfolioGoalV2, ownerId: string) {
    const b = g.baseline, bind = b.binding, e = b.evidence;
    return !!bind && !!e && bind.schemaVersion === 'goal-baseline-binding/1' && e.schemaVersion === 'b4-evidence/1' && e.ref.profileId === g.profileId && e.ref.chartId === g.chartId && bind.ownerId === ownerId && bind.profileId === g.profileId && bind.chartId === g.chartId && bind.sourceRevision === b.sourceRevision && b.value.sourceRevision === b.sourceRevision && b.value.capturedAt === b.capturedAt && bind.baselineRef === e.ref.id && b.evidenceRefs.includes(e.ref.id) && e.ref.sourceRevision === b.sourceRevision && e.ref.contentHash === hash(e.payload) && same(e.payload, { type: 'goal_baseline', goalType: g.goalType, ...b.value }) && bind.evidenceHash === hash(e);
}
/** Legacy evidence stays immutable; this is a transient input to the single V1 evaluator/fact projector. */
export function evaluatorGoal(g: PortfolioGoalV2): PlayerGoal {
    const source = g.origin.sourceSnapshot || {};
    return { ...g.legacyRecord, id: g.id, profileId: g.profileId, songId: g.songId!, difficultyType: g.difficultyType!, title: g.displaySnapshot.title, starLevel: g.displaySnapshot.starLevel, goalType: g.goalType as PlayerGoal['goalType'], baselineVersion: 1, baseline: g.baseline.value, source: (source.source || 'today-plan') as PlayerGoal['source'], sourceBasis: (source.sourceBasis || null) as string | null, sourceMode: (source.sourceMode || 'ordinary') as PlayerGoal['sourceMode'], sourceRank: Number(source.sourceRank || 1), sourceRevision: String(source.sourceRevision || g.baseline.sourceRevision), sourceGeneratedAt: String(source.sourceGeneratedAt || g.baseline.capturedAt), targetData: g.legacyRecord?.targetData || { comparison: 'greater', field: 'highScore' }, status: g.lifecycleStatus === 'paused' ? 'active' : g.lifecycleStatus, createdAt: g.createdAt, cancelledAt: g.cancelledAt, completedAt: g.completedAt || undefined, completionEvidence: g.completionEvidence || undefined, unavailable: g.availability.state !== 'available' };
}
