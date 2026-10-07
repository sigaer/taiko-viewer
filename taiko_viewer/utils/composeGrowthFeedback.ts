import type { PlayerGoal, GoalType } from '../types/player-goal';
import type { GrowthDailyProgress, GrowthEventFact, GrowthFact, RecentGrowthResponse } from '../types/player-growth';

const recentType = (type: GrowthEventFact['type']) => type === 'clear-upgrade' ? 'clear' : type;
const sameChange = (left: Pick<GrowthEventFact, 'before' | 'after'>, right: Pick<GrowthFact, 'before' | 'after'>) => left.before === right.before && left.after === right.after;
const priority = (fact: Pick<GrowthEventFact, 'type' | 'delta' | 'after'>) => {
  if (fact.type === 'df') return 100;
  if (fact.type === 'fc') return 90;
  if (fact.type === 'rank-upgrade') return 80;
  if (fact.type === 'clear-upgrade') return 75;
  if (fact.type === 'ng-reduced') return fact.after === 0 ? 70 : 60;
  if (fact.type === 'score-pb') return Math.abs(fact.delta || 0) >= 5000 ? 65 : 50;
  return fact.type === 'combo-improved' ? 40 : 0;
};

// Presentation only. Daily attribution and the original DTO remain untouched.
export function composeGrowthFeedback(goal: PlayerGoal | null, dailyProgress: GrowthDailyProgress, recent?: RecentGrowthResponse, activeGoal?: PlayerGoal | null) {
  if (goal?.status !== 'completed') goal = null;
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
  const goalFacts: GrowthEventFact[] = fact ? [{ ...fact, delta: fact.before !== null && fact.after !== null ? fact.after - fact.before : null }] : [];
  const revision = goal?.completionEvidence?.observationRevision;
  const goalChart = (songId?: number, level?: number) => Boolean(goal && goal.songId === songId && goal.difficultyType === level);
  const goalRecentChart = (candidate: GrowthFact) => goalChart(candidate.songId, candidate.difficultyType)
    && (!goal?.profileId || (recent?.profileId === goal.profileId && candidate.bindingId === goal.profileId));
  const primaryMatch = (candidate: GrowthEventFact, sourceRevision?: string) => Boolean(fact && candidate.type === fact.type
    && (sameChange(fact, candidate) || (revision && revision === sourceRevision && fact.after === candidate.after)));
  // Supporting changes need the same authoritative observation, not just the
  // same song. A Goal baseline can differ from the Daily/Recent baseline.
  const addSupport = (candidate: GrowthEventFact, sourceRevision?: string) => {
    if (candidate.type === 'played' || !revision || sourceRevision !== revision || primaryMatch(candidate, sourceRevision)) return;
    if (!goalFacts.some(existing => existing.type === candidate.type && existing.after === candidate.after)) goalFacts.push(candidate);
  };
  if (fact) {
    for (const event of dailyProgress.events) if (goalChart(event.songId, event.level)) {
      for (const candidate of event.facts) addSupport(candidate, event.evidenceRevision);
    }
    for (const candidate of recent?.facts || []) if (goalRecentChart(candidate) && candidate.type !== 'goal-completed') {
      addSupport({ type: candidate.type === 'clear' ? 'clear-upgrade' : candidate.type, before: candidate.before ?? null, after: candidate.after ?? null, delta: candidate.delta ?? null }, candidate.evidence.sourceRevision);
    }
  }
  const shownInGoal = (candidate: GrowthEventFact, sourceRevision?: string) => primaryMatch(candidate, sourceRevision)
    || goalFacts.slice(1).some(support => support.type === candidate.type
      && (sameChange(support, candidate) || (revision && revision === sourceRevision && support.after === candidate.after)));
  const intent = activeGoal || goal;
  const remainingRecent = (recent?.facts || []).filter(candidate => {
    if (!goalRecentChart(candidate)) return true;
    if (candidate.type === 'goal-completed') return !goal?.id || candidate.goalId !== goal.id;
    return !shownInGoal({ type: candidate.type === 'clear' ? 'clear-upgrade' : candidate.type, before: candidate.before ?? null, after: candidate.after ?? null, delta: candidate.delta ?? null }, candidate.evidence.sourceRevision);
  }).sort((left, right) => {
    const relevant = (item: GrowthFact) => intent && item.songId === intent.songId && item.difficultyType === intent.difficultyType ? 1 : 0;
    const rank = (item: GrowthFact) => priority({ type: item.type === 'clear' ? 'clear-upgrade' : item.type === 'goal-completed' ? 'played' : item.type, delta: item.delta ?? null, after: item.after ?? null });
    return relevant(right) - relevant(left) || rank(right) - rank(left);
  });
  // Only facts actually rendered in Recent can suppress Daily rows.
  const recentFacts = remainingRecent.slice(0, 5);
  const events = dailyProgress.events.map(event => ({ ...event, facts: event.facts.filter(candidate => {
    if (goalChart(event.songId, event.level) && shownInGoal(candidate, event.evidenceRevision)) return false;
    return !recentFacts.some(item => item.songId === event.songId && item.difficultyType === event.level && item.type === recentType(candidate.type)
      && item.temporal.attributedDay === dailyProgress.calendarDay
      && (sameChange(candidate, item) || (event.evidenceRevision && event.evidenceRevision === item.evidence.sourceRevision && candidate.after === item.after)));
  }).sort((left, right) => priority(right) - priority(left)) })).filter(event => event.facts.length > 0);
  events.sort((left, right) => priority(right.facts[0]!) - priority(left.facts[0]!));
  return {
    goalType, goalFacts, recentFacts,
    recentSuppressedCount: (recent?.facts.length || 0) - remainingRecent.length,
    additionalPbCount: goal ? events.filter(event => !goalChart(event.songId, event.level) && event.facts.some(item => item.type === 'score-pb')).length : 0,
    dailyProgress: !goal && !recent ? dailyProgress : { ...dailyProgress, events }
  };
}
