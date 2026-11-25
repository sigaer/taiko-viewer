import type { GoalBaseline, GoalType, PlayerGoal } from './player-goal';
import type { EvidenceRecord, GoalBaselineBinding, Target } from '../utils/multi-objective/contracts';
import type { GoalEvaluation } from '../utils/goalEvaluation';
export type CreatableGoalType = Exclude<GoalType, 'played'>;
export type BaselineEnvelope = {
    version: 1;
    capturedAt: string;
    sourceRevision: string;
    evidenceRefs: string[];
    value: GoalBaseline;
    binding: GoalBaselineBinding | null;
    evidence: EvidenceRecord | null;
};
export type GoalEvaluationV2 = {
    evaluationId: string;
    goalId: string;
    goalRevision: string;
    evaluatorVersion: string;
    baselineRevision: string;
    observationRevision: string;
    evaluatedAt: string;
    observationCapturedAt: string;
    outcome: 'completed' | 'active' | 'inconclusive' | 'unsupported';
    reasonCodes: string[];
    evidenceRefs: string[];
    result: GoalEvaluation;
};
export type PortfolioGoalV2 = {
    id: string;
    goalRevision: string;
    profileId: string;
    songId: number | null;
    canonicalSongId: string | null;
    chartId: string | null;
    identityMappingRef: string | null;
    difficultyType: number | null;
    goalType: string;
    evaluatorVersion: string;
    target: Target | null;
    targetHash: string | null;
    legacyRecord: PlayerGoal | null;
    displaySnapshot: {
        title: string;
        starLevel: number | null;
    };
    lifecycleStatus: 'active' | 'paused' | 'completed' | 'cancelled';
    availability: {
        state: 'available' | 'unavailable' | 'unknown';
        reasonCodes: string[];
        checkedAt: string;
        catalogRevision: string;
    };
    userPriority: number;
    userOrder: number;
    baseline: BaselineEnvelope;
    latestEvaluation: GoalEvaluationV2 | null;
    completionEvidence: PlayerGoal['completionEvidence'] | null;
    origin: {
        kind: 'legacy' | 'manual' | 'accepted_recommendation';
        acceptanceId: string | null;
        candidateId: string | null;
        decisionId: string | null;
        sourceSnapshot: Record<string, unknown> | null;
    };
    diagnostics: {
        reasonCodes: string[];
        missingEvidence: string[];
        limitations: string[];
    };
    createdAt: string;
    updatedAt: string;
    pausedAt: string | null;
    completedAt: string | null;
    cancelledAt: string | null;
};
export type GoalPortfolioV2 = {
    schemaVersion: 2;
    ownerId: string;
    profileId: string;
    portfolioRevision: string;
    updatedAt: string;
    goals: PortfolioGoalV2[];
};
export type ExistingGoalOperation = {
    goalId: string;
    expectedGoalRevision: string;
} & ({
    type: 'pause_goal' | 'resume_goal' | 'cancel_goal';
} | {
    type: 'set_goal_priority';
    userPriority: number;
});
export type PortfolioOperation = ExistingGoalOperation | {
    type: 'create_manual_goal';
    songId: number;
    difficultyType: number;
    goalType: CreatableGoalType;
    target: Target;
} | {
    type: 'accept_recommendation';
    recommendationToken: string;
} | {
    type: 'reorder_goals';
    goalIds: string[];
    expectedGoalRevisions: Record<string, string>;
};
export type PortfolioCommand = {
    profileId: string;
    expectedPortfolioRevision: string;
    commandId: string;
    operations: PortfolioOperation[];
};
export type PortfolioCommandResponse = {
    newPortfolioRevision: string;
    affectedGoals: PortfolioGoalV2[];
    createdGoals: PortfolioGoalV2[];
    updatedGoals: PortfolioGoalV2[];
    existingGoalIds: string[];
    diagnostics: string[];
    replayed: boolean;
};
export type PortfolioCapabilities = {
    canCreateGoal: boolean;
    creatableGoalTypes: CreatableGoalType[];
    acceptRecommendation: false;
    reasonCodes: string[];
};
export type PortfolioResponse = GoalPortfolioV2 & {
    capabilities: PortfolioCapabilities;
    snapshotRevision: string;
    pagination: {
        nextCursor: string | null;
    };
};
export type PortfolioEvaluateRequest = {
    profileId: string;
    expectedPortfolioRevision: string;
    commandId: string;
    goalIds?: string[];
    explicitPausedEvaluation?: boolean;
};
