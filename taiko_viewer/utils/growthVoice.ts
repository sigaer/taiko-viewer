import type { RatingDimensionKey } from '../types/recommendation-intelligence';
import type { GrowthDailyProgress, GrowthEventFact, RecentGrowthResponse, WeeklyGrowthTheme } from '../types/player-growth';

export type GrowthVoiceLine = { key: string; params?: Record<string, string | number> };
export type GrowthVoiceContext = {
  profileId: string;
  businessDate: string;
  focus: RatingDimensionKey | 'balanced' | 'limited' | 'insufficient-data' | null;
  readiness: 'ready' | 'limited' | 'insufficient';
  goalState: 'none' | 'active' | 'completed';
  // Only pass quiet when a real activity source establishes it. A sync timestamp
  // and today's attendance cannot establish a quiet period.
  activity: 'unknown' | 'active' | 'quiet';
};
export const GROWTH_COPY_POOL_SIZES = {
  big_song: 4, stamina: 4, speed: 4, accuracy_power: 4, rhythm: 4, complex: 4,
  balanced: 4, limited: 4, quiet: 4, active: 4, completed: 4, invitation: 5, score: 4
} as const;

// Bounded FNV-1a over fixed-size semantic fields. No timestamps, scoreRevision,
// request state, locale, randomness, storage, or history reads enter selection.
export function growthCopyIndex(context: GrowthVoiceContext, surface: string, size: number): number {
  let hash = 2166136261;
  for (const field of [surface, context.profileId, context.businessDate, context.focus || '', context.readiness, context.goalState, context.activity]) {
    const text = String(field).slice(0, 128);
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
    hash = Math.imul(hash ^ 31, 16777619) >>> 0;
  }
  return hash % size;
}
const palette = (context: GrowthVoiceContext, pool: keyof typeof GROWTH_COPY_POOL_SIZES, surface: string): GrowthVoiceLine => ({
  key: `home.growth.voice.${pool}.${growthCopyIndex(context, surface, GROWTH_COPY_POOL_SIZES[pool])}`
});
export function composeRecommendationCopy(context: GrowthVoiceContext) {
  const limited = context.readiness !== 'ready' || !context.focus || context.focus === 'limited' || context.focus === 'insufficient-data';
  const observationPool = limited ? 'limited' : context.activity === 'quiet' ? 'quiet' : context.focus as RatingDimensionKey | 'balanced';
  const invitationPool = context.goalState === 'active' ? 'active' : context.goalState === 'completed' ? 'completed' : 'invitation';
  return { observation: palette(context, observationPool, 'hero'), invitation: palette(context, invitationPool, 'recommendation') };
}
export function composeGoalCopy(state: 'active' | 'completed' | 'inconclusive' | 'unchanged'): GrowthVoiceLine {
  return { key: state === 'active' ? 'home.goal.title' : `home.goal.${state}` };
}
export function composeRecentGrowthCopy(recent: RecentGrowthResponse): GrowthVoiceLine {
  if (recent.boundary.recovered) return { key: 'home.growth.recent.boundaryRecovered' };
  if (!recent.boundary.acknowledgedToken && !recent.facts.length) return { key: 'home.growth.recent.firstUse' };
  return { key: recent.facts.length ? 'home.growth.recent.rich' : recent.state === 'new' ? 'home.growth.recent.noChanges' : 'home.growth.recent.caughtUp' };
}
export function composeDailyNarrative(progress: GrowthDailyProgress, original: GrowthDailyProgress = progress): GrowthVoiceLine {
  if (progress.attendance === 'not_played') return { key: 'home.growth.noPlay' };
  if (progress.attendance === 'unknown') return { key: 'home.growth.progressUnavailable' };
  if (progress.events.some(event => event.facts.some(fact => fact.type !== 'played'))) return { key: 'home.growth.dailyRich' };
  const changesShownElsewhere = original.events.some(event => event.facts.some(fact => fact.type !== 'played'));
  return { key: changesShownElsewhere ? 'home.growth.dailyElsewhere' : 'home.growth.dailyQuiet' };
}
export function composeDailyFactCopy(fact: GrowthEventFact, context: GrowthVoiceContext, value: string, delta: string): GrowthVoiceLine {
  if (fact.type === 'score-pb') {
    // Missing deltas do not mean zero or an observed improvement amount.
    const line = fact.delta !== null && fact.delta > 0 ? palette(context, 'score', 'daily-score') : { key: 'home.growth.scoreRecorded' };
    return { ...line, params: { value, delta } };
  }
  return { key: `home.growth.log.${fact.type}`, params: { value, delta } };
}
export function composeWeeklyNarrative(theme: WeeklyGrowthTheme): GrowthVoiceLine {
  // Keep factual achievements visible without upgrading a low-confidence
  // selection into a claim about the whole week.
  const qualified = theme.confidence !== 'high' && !['quiet', 'no-play', 'limited-coverage'].includes(theme.type);
  return { key: `weekly.${qualified ? 'observedTheme' : 'theme'}.${theme.type}` };
}
export function composePassportNarrative(state: 'new' | 'updated' | 'limited' | 'accumulating' | 'stable' | 'up' | 'down', params: GrowthVoiceLine['params'] = {}): GrowthVoiceLine {
  return { key: state === 'new' ? 'passport.newRecord' : state === 'updated' ? 'passport.segmentUpdated' : `passport.change.${state === 'accumulating' ? 'insufficient' : state === 'stable' ? 'stableValue' : state}`, params };
}
