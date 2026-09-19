import type { PlayerGoal, GoalType } from '../types/player-goal';
import type { GrowthDailyProgress, GrowthEventFact } from '../types/player-growth';

// Presentation only. Daily attribution and the original DTO remain untouched.
export function composeGrowthFeedback(goal: PlayerGoal | null, dailyProgress: GrowthDailyProgress) {
  const result = goal?.status === 'completed' ? goal.completionEvidence?.result : null;
  let goalType: GoalType | null = result?.goalType || null;
  let fact: Pick<GrowthEventFact, 'type' | 'before' | 'after'> | null = null;
  if (goal && result) {
    if (['score-pb', 'ng-reduced', 'rank-upgrade'].includes(result.goalType)) {
      fact = { type: result.goalType as GrowthEventFact['type'], before: result.before, after: result.after };
    } else if (['clear', 'fc', 'df'].includes(result.goalType)) {
      const b = goal.baseline;
      const counts = [b.clearCnt, b.fullComboCnt, b.dondafulComboCnt];
      const future = [result.facts.clearCnt, result.facts.fullComboCnt, result.facts.dondafulComboCnt];
      // Evaluation stores cumulative counters; Daily stores crown levels. Never
      // compare those units directly or fill missing counters with invented zeros.
      const after = future.findLastIndex(n => Number.isSafeInteger(n) && n > 0);
      if (after >= 0) goalType = (['clear', 'fc', 'df'] as const)[after];
      if (after >= 0 && counts.every(n => Number.isSafeInteger(n) && n! >= 0)) {
        fact = { type: (['clear-upgrade', 'fc', 'df'] as const)[after], before: counts.findLastIndex(n => n! > 0), after };
      }
    }
  }
  if (!goal || !fact) return { goalType, dailyProgress };
  const duplicate = fact;
  const events = dailyProgress.events.map(event => {
    if (event.songId !== goal.songId || event.level !== goal.difficultyType) return event;
    return { ...event, facts: event.facts.filter(f => !(f.type === duplicate.type && f.before === duplicate.before && f.after === duplicate.after)) };
  }).filter(event => event.facts.length > 0);
  return { goalType, dailyProgress: { ...dailyProgress, events } };
}
