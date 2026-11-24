import type { PlayerDecisionContext } from './context.ts';
import { assessReachability, type MatchResult } from './matching.ts';

export type UserIntent = { kind: 'inspect-chart'; chartKey: string } | { kind: 'review-goal'; goalId: string };
export function projectNextAction(context: PlayerDecisionContext, matches: MatchResult, intent?: UserIntent) {
  const sameScope = matches.profileId === context.profileId && matches.scoreRevision === context.scoreRevision
    && matches.catalogRevision === context.catalogRevision && matches.asOf === context.asOf;
  const suggestions = sameScope ? matches.items.filter(c => assessReachability(context, c, matches.region).eligible).map(c => c.chart.key).slice(0, 3) : [];
  const result = (kind: string, goalId: string | null = null, chartKey: string | null = null) => ({
    kind, profileId: context.profileId, goalId, chartKey, suggestions,
    effect: 'navigation-only' as const, writesFacts: false as const, queue: 'ephemeral-projection' as const
  });
  // A user's navigation choice does not acquire an algorithmic reachability claim.
  if (intent?.kind === 'inspect-chart' && /^[1-9]\d*:[1-5]$/.test(intent.chartKey)) return result('inspect-chart', null, intent.chartKey);
  const evaluation = context.goals;
  if (!evaluation || evaluation.profileId !== context.profileId || !sameScope) return result('refresh-evidence');
  const active = evaluation.activeGoal, completed = evaluation.recentCompletedGoal;
  if (active && (active.profileId !== context.profileId || active.status !== 'active')) return result('refresh-evidence');
  if (completed && (completed.profileId !== context.profileId || completed.status !== 'completed' || !completed.completionEvidence)) return result('refresh-evidence');
  if (evaluation.outcome === 'evaluation-error' || evaluation.outcome === 'inconclusive') return result('refresh-evidence');
  if (evaluation.outcome === 'active' && !active || evaluation.outcome === 'completed' && (!completed || active)
    || evaluation.outcome === 'no-active-goal' && active) return result('refresh-evidence');
  if (intent?.kind === 'review-goal') {
    const goal = [active, completed].find(g => g?.id === intent.goalId);
    if (goal) return result('review-goal', goal.id);
  }
  if (evaluation.outcome === 'completed' && completed) return result('review-completed-goal', completed.id);
  if (active) {
    if (active.unavailable) return result('resolve-unavailable-goal', active.id);
    // Existing user commitment remains visible even when no algorithmic suggestion passes.
    return result('review-active-goal', active.id, `${active.songId}:${active.difficultyType}`);
  }
  return result(suggestions.length ? 'choose-next-goal' : 'insufficient-evidence');
}

/** Home slots compose independently: public content does not wait for recommendation readiness. */
export function projectLivingHome(context: PlayerDecisionContext, matches: MatchResult, publicContent: {
  latestSongKeys: readonly string[]; eventIds: readonly string[]; communityIds: readonly string[];
}, intent?: UserIntent) {
  return {
    nextAction: projectNextAction(context, matches, intent),
    recent: { factKeys: context.recent.factKeys, factReferences: context.recent.factReferences,
      from: context.recent.from, to: context.recent.to, factSemantics: context.recent.factSemantics,
      sessionIdentifiability: context.recent.sessionIdentifiability },
    longTerm: context.longTerm,
    latestSongKeys: publicContent.latestSongKeys.slice(0, 6), eventIds: publicContent.eventIds.slice(0, 4), communityIds: publicContent.communityIds.slice(0, 4)
  };
}
