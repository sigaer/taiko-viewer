import type { PlayerGoal } from '../../types/player-goal.ts';

/** Candidate targets are inclusive scores; the existing score-pb evaluator is strictly > baseline. */
export function matchesActiveScorePbGoal(goal: PlayerGoal | null | undefined, profileId: string,
  candidate: { songId: number; difficultyType: number; targetScore: number }): boolean {
  if (!goal || goal.status !== 'active' || goal.unavailable || goal.profileId !== profileId || goal.goalType !== 'score-pb'
    || goal.songId !== candidate.songId || goal.difficultyType !== candidate.difficultyType
    || goal.targetData?.field !== 'highScore' || goal.targetData.comparison !== 'greater' || !goal.baseline?.recordPresent) return false;
  const baseline = goal.baseline.highScore;
  if (typeof baseline !== 'number' || !Number.isSafeInteger(baseline) || baseline < 0) return false;
  // Current goals omit value and compare to the immutable baseline. An explicit
  // bound may only restate that baseline: the existing evaluator ignores targetData.value.
  if (goal.targetData.value !== undefined && goal.targetData.value !== baseline) return false;
  const minimumScore = baseline + 1;
  return Number.isSafeInteger(minimumScore) && Number.isSafeInteger(candidate.targetScore) && candidate.targetScore === minimumScore;
}
