import type { PlayerGoal } from './player-goal';
export type GoalEvaluationResponse = {
  profileId: string;
  outcome: 'completed' | 'active' | 'inconclusive' | 'no-active-goal' | 'evaluation-error';
  activeGoal: PlayerGoal | null;
  recentCompletedGoal: PlayerGoal | null;
};
