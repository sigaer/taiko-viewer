import { composeGrowthFeedback } from './composeGrowthFeedback.ts';
import type { GrowthDailyProgress, GrowthFact, RecentGrowthResponse } from '../types/player-growth';
import type { PlayerGoal } from '../types/player-goal';

// Homepage presentation only. Server attribution, chart counts and goal priority
// are unchanged. Only confirmed, identical today facts move out of Recent.
export function composeHomeGrowthFeedback(goal: PlayerGoal | null, daily: GrowthDailyProgress,
  recent?: RecentGrowthResponse, activeGoal?: PlayerGoal | null, profileId?: string,
  available: { daily?: boolean; recent?: boolean } = {}) {
  if (available.recent === false || recent?.state === 'unavailable') recent = undefined;
  // The header remains visible while the Daily/Goal body is loading or failed.
  // Hidden modules cannot claim any of the header's valid records.
  if (available.daily === false) {
    const header = composeGrowthFeedback(null, { ...daily, events: [] }, recent, activeGoal);
    return { ...header, dailyProgress: daily };
  }
  const dailyFeedback = composeGrowthFeedback(goal, daily, undefined, activeGoal);
  const snapshotKind = (fact: GrowthFact) => {
    const provenance = fact.evidence.provenance;
    return provenance && typeof provenance === 'object' && 'snapshotKind' in provenance ? provenance.snapshotKind : undefined;
  };
  const belongsInDaily = (fact: GrowthFact) => daily.attendance === 'played'
    && Boolean(profileId && recent?.profileId === profileId && fact.bindingId === profileId)
    && ['instant', 'day'].includes(fact.temporal.precision)
    && fact.temporal.attributedDay === daily.calendarDay
    && fact.evidence.source === 'score-history'
    // projectScoreFacts exposes this Daily projection as evidence version 1.
    && fact.evidence.evidenceVersion === 1
    && dailyFeedback.dailyProgress.events.some(event => event.songId === fact.songId && event.level === fact.difficultyType
      && Boolean(event.evidenceRevision && event.evidenceRevision === fact.evidence.sourceRevision)
      && (!snapshotKind(fact) || snapshotKind(fact) === event.evidence)
      && event.facts.some(item => item.type !== 'played'
        && (item.type === 'clear-upgrade' ? 'clear' : item.type) === fact.type
        && item.after !== null && fact.after != null
        && item.before === fact.before && item.after === fact.after && item.delta === (fact.delta ?? null)
        && (!event.factOccurredAt?.[item.type] || !fact.temporal.occurredAt
          || event.factOccurredAt[item.type] === fact.temporal.occurredAt)));
  const remainingRecent = recent ? { ...recent, facts: recent.facts.filter(fact => !belongsInDaily(fact)) } : undefined;
  const composed = composeGrowthFeedback(goal, daily, remainingRecent, activeGoal);
  return { ...composed, dailyProgress: dailyFeedback.dailyProgress,
    additionalPbCount: dailyFeedback.additionalPbCount,
    recentSuppressedCount: composed.recentSuppressedCount + (recent?.facts.length || 0) - (remainingRecent?.facts.length || 0) };
}
