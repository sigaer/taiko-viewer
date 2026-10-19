import type { GoalProvenance, GoalEvaluation } from '../utils/goalEvaluation';
export type GoalType = 'score-pb' | 'ng-reduced' | 'clear' | 'fc' | 'df' | 'rank-upgrade' | 'played';
export type GoalBaseline = {
  provenance?: GoalProvenance | null;
  recordPresent: boolean;
  highScore: number | null; goodCnt: number | null; okCnt: number | null; ngCnt: number | null;
  comboCnt: number | null; clearCnt: number | null; fullComboCnt: number | null;
  dondafulComboCnt: number | null; bestScoreRank: number | null;
  highscoreDatetime: string | null; updateDatetime: string | null; scoreObservedAt: string | null;
  capturedAt: string; sourceRevision: string;
  sourceCompleteness: 'complete' | 'partial' | 'unknown';
};
export type PlayerGoal = {
  id: string; profileId: string; songId: number; difficultyType: number; title: string; starLevel: number | null;
  goalType: GoalType; baselineVersion: 1; baseline: GoalBaseline;
  source: 'today-plan' | 'ordinary-recommendation'; sourceBasis: string | null; sourceMode: 'dimension' | 'general-fallback' | 'ordinary';
  sourceRank: number; sourceRevision: string; sourceGeneratedAt: string;
  targetData: { comparison: 'greater' | 'less' | 'present'; field: string; value?: number };
  status: 'active' | 'cancelled' | 'completed'; completedAt?: string; completionEvidence?: {evaluationVersion: 1; evaluatedAt: string; observationCapturedAt: string; observationRevision: string; baselineRevision: string; source: string; provenance: GoalProvenance; result: NonNullable<GoalEvaluation['result']>}; createdAt: string; cancelledAt: string | null; unavailable: boolean;
};
