import type { VersionSummaryViewModel } from "~/types/account-version-summary";

/**
 * Central narrative selector for the annual report.
 *
 * Every page that ships several wordings for the same data shape resolves its
 * text through here, so the story slides stay presentation-only: they read the
 * selection and render it instead of deciding anything themselves.
 *
 * The selection is fully deterministic:
 *   - the archetype comes only from the player's own numbers (never a hash),
 *   - the variant is a stable hash of (account, version, page, archetype), so a
 *     rebuild, an SSR render, a client render, a poster render and a shared
 *     link all show the identical sentence for the identical input.
 * Nothing here uses Math.random(), and no archetype is chosen at random.
 */

export type NarrativeIntensity = "low" | "mid" | "high" | "extreme";

export type NarrativeSelection = {
  archetype: string;
  variant: number;
  intensity?: NarrativeIntensity;
  secondaryType?: string;
};

export type NarrativePageKey =
  | "timeOfDay" | "calendar" | "speedProfile" | "challenge" | "nearDondaful"
  | "obsession" | "favoriteShift" | "monthly" | "weekday" | "lateNight";

/** FNV-1a: tiny, stable across runtimes, and independent of Math.random(). */
const stableHash = (value: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
};

const finite = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** Stable per-account seed: the summary id is minted once per account and version. */
const seedFor = (summary: VersionSummaryViewModel, page: NarrativePageKey, archetype: string) => {
  const account = String(summary.summaryId || summary.period?.firstRecordAt || summary.user?.nickname || "");
  const version = String(summary.version?.key || "");
  return `${account}|${version}|${page}|${archetype}`;
};

type Archetype = { archetype: string; intensity?: NarrativeIntensity; secondaryType?: string };

const timeOfDayArchetype = (summary: VersionSummaryViewModel): Archetype => {
  const time = summary.timeOfDay;
  const period = String(time?.topPeriod || "");
  if (period === "early_morning" || period === "morning") return { archetype: "morning", intensity: period === "early_morning" ? "high" : "mid" };
  if (period === "noon" || period === "afternoon") return { archetype: "daytime", intensity: period === "afternoon" ? "mid" : "low" };
  if (period === "evening") return { archetype: "evening", intensity: "high" };
  if (period === "late_night") return { archetype: "late_night", intensity: "extreme" };
  const hour = finite(time?.favoriteHour, -1);
  if (hour < 0) return { archetype: "daytime", intensity: "low" };
  if (hour < 5) return { archetype: "late_night", intensity: "extreme" };
  if (hour < 11) return { archetype: "morning", intensity: "mid" };
  if (hour < 17) return { archetype: "daytime", intensity: "low" };
  if (hour < 22) return { archetype: "evening", intensity: "high" };
  return { archetype: "late_night", intensity: "extreme" };
};

const calendarArchetype = (summary: VersionSummaryViewModel): Archetype => {
  const activeDays = finite(summary.calendarActivity?.activeDays);
  const streak = finite(summary.calendarActivity?.longestStreak);
  // The streak bands are 3 / 7 / 13 days. Activity and streaks are read together:
  // a handful of consecutive days is a burst, not a year-long habit, so a
  // low-activity account can never be typed as the stable, all-year player.
  const intensity: NarrativeIntensity = streak >= 13 ? "extreme" : streak >= 7 ? "high" : streak >= 3 ? "mid" : "low";
  if (streak < 3) return { archetype: "occasional", intensity };
  if (activeDays < 20) return { archetype: "sprint", intensity };
  if (streak >= 13 && activeDays >= 60) return { archetype: "persistent", intensity };
  return { archetype: "steady", intensity };
};

const speedProfileArchetype = (summary: VersionSummaryViewModel): Archetype => {
  const speed = finite(summary.speedProfile?.speed);
  // 1.25 / 1.45 / 1.60 split the observed range into four bands; a missing or zero
  // value stays in the lowest band. The lowest band is *not* called "original
  // speed": the values that land here are 1.1x-1.2x, so the wording talks about
  // keeping the speed low instead of claiming the default speed.
  if (speed <= 1.25) return { archetype: "mild", intensity: "low" };
  if (speed <= 1.45) return { archetype: "cruise", intensity: "mid" };
  if (speed <= 1.6) return { archetype: "fast", intensity: "high" };
  return { archetype: "extreme", intensity: "extreme" };
};

const challengeArchetype = (summary: VersionSummaryViewModel): Archetype => {
  const plays = finite(summary.challenge?.playCount);
  if (plays < 30) return { archetype: "tap", intensity: "low" };
  if (plays < 70) return { archetype: "push", intensity: "mid" };
  if (plays < 121) return { archetype: "siege", intensity: "high" };
  return { archetype: "vow", intensity: "extreme" };
};

const nearDondafulArchetype = (summary: VersionSummaryViewModel): Archetype => {
  const ok = finite(summary.nearDondaful?.okCount);
  const stars = finite(summary.nearDondaful?.song?.stars);
  const closeness = ok <= 2 ? "razor" : ok <= 5 ? "near" : "distant";
  // The same one-missing-"可" reads differently on a ten-star chart, so the
  // difficulty band selects its own wording family instead of a shared one.
  const difficulty = stars >= 10 ? "ten_star" : "standard";
  const intensity: NarrativeIntensity = closeness === "razor" ? "high" : closeness === "near" ? "mid" : "low";
  return { archetype: `${closeness}_${difficulty}`, intensity, secondaryType: difficulty };
};

/**
 * How often the one song kept coming back: a few scattered encounters, a burst of
 * consecutive sittings, a returning habit, or a song that stayed all year. The
 * per-day density separates a burst from an ordinary returning habit, so no extra
 * secondary dimension is needed to tell the two stories apart.
 */
const obsessionArchetype = (summary: VersionSummaryViewModel): Archetype => {
  const days = finite(summary.obsessionSong?.activeDays);
  const plays = finite(summary.obsessionSong?.playCount);
  const density = days > 0 ? plays / days : 0;
  if (days <= 5) return { archetype: "encounter", intensity: "low", secondaryType: density >= 4 ? "burst" : "steady" };
  if (density >= 4) return { archetype: "burst", intensity: "high", secondaryType: "burst" };
  if (days >= 18) return { archetype: "devoted", intensity: "high", secondaryType: density <= 2 ? "long_running" : "steady" };
  return { archetype: "attached", intensity: "mid", secondaryType: density <= 2 ? "long_running" : "steady" };
};

/**
 * The page compares the top song of the account's own first quarter with the top
 * song of its last quarter, so the share the new favourite holds between the two
 * anchors is exactly the size of the turn: a clear handover, a shift in progress,
 * or a new song that has only just appeared.
 */
const favoriteShiftArchetype = (summary: VersionSummaryViewModel): Archetype => {
  const oldPlays = finite(summary.favoriteShift?.oldFavorite?.playCount);
  const newPlays = finite(summary.favoriteShift?.newFavorite?.playCount);
  const total = oldPlays + newPlays;
  const share = total > 0 ? newPlays / total : 0.5;
  const intensity: NarrativeIntensity = share >= 0.6 ? "high" : share >= 0.2 ? "mid" : "low";
  // Both anchors being heavy means the year really had two centres of gravity.
  const secondaryType = total >= 54 ? "deep" : "light";
  if (share >= 0.6) return { archetype: "handover", intensity, secondaryType };
  if (share >= 0.2) return { archetype: "transition", intensity, secondaryType };
  return { archetype: "flicker", intensity, secondaryType };
};

/** How much of the year has a representative song: a few months, some phases, many, or nearly all. */
const monthlyArchetype = (summary: VersionSummaryViewModel): Archetype => {
  const count = (summary.monthlyFavorites || []).filter((item) => String(item?.song?.name || "").trim()).length;
  if (count >= 9) return { archetype: "year_round", intensity: "high" };
  if (count >= 6) return { archetype: "recurring", intensity: "mid" };
  if (count >= 3) return { archetype: "seasonal", intensity: "mid" };
  return { archetype: "brief", intensity: "low" };
};

/**
 * The shape of a week, read from the seven real counts: one weekday that clearly
 * dominates, a weekend-heavy week, a week that leans on the working days, or a
 * week that is spread evenly. The concrete weekday stays an interpolation value.
 */
const weekdayArchetype = (summary: VersionSummaryViewModel): Archetype => {
  const counts = (summary.weekdayActivity?.counts || []).map((value) => finite(value));
  const total = counts.reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) return { archetype: "balanced", intensity: "low" };
  const ranked = [...counts].sort((a, b) => b - a);
  const top = ranked[0] || 0;
  const second = ranked[1] || 0;
  const weekend = (counts[5] || 0) + (counts[6] || 0);
  const workday = total - weekend;
  // The thresholds come from the real distribution: a single day owning 50% of the
  // week (or 25pp more than the runner-up) is the top decile, weekend above 45%
  // (flat week: 28.6%) is the top third, working days above 80% (flat: 71.4%) the
  // top sixth.
  if (top / total >= 0.5 || (top - second) / total >= 0.25) return { archetype: "anchored", intensity: "high" };
  if (weekend / total >= 0.45) return { archetype: "weekend", intensity: "mid" };
  if (workday / total >= 0.8) return { archetype: "workday", intensity: "mid" };
  return { archetype: "balanced", intensity: "low" };
};

/** How often the year reached into the small hours: a few nights, a habit, many, or a signature. */
const lateNightArchetype = (summary: VersionSummaryViewModel): Archetype => {
  const days = finite(summary.lateNight?.activeDays);
  if (days >= 25) return { archetype: "nocturnal", intensity: "extreme" };
  if (days >= 12) return { archetype: "frequent", intensity: "high" };
  if (days >= 4) return { archetype: "familiar", intensity: "mid" };
  return { archetype: "occasional", intensity: "low" };
};

const resolveArchetype = (page: NarrativePageKey, summary: VersionSummaryViewModel): Archetype => {
  switch (page) {
    case "timeOfDay": return timeOfDayArchetype(summary);
    case "calendar": return calendarArchetype(summary);
    case "speedProfile": return speedProfileArchetype(summary);
    case "challenge": return challengeArchetype(summary);
    case "nearDondaful": return nearDondafulArchetype(summary);
    case "obsession": return obsessionArchetype(summary);
    case "favoriteShift": return favoriteShiftArchetype(summary);
    case "monthly": return monthlyArchetype(summary);
    case "weekday": return weekdayArchetype(summary);
    case "lateNight": return lateNightArchetype(summary);
  }
};

/** How many wording sets exist for a page/archetype. Kept next to the selector so a missing locale entry cannot silently collapse the rotation. */
export const NARRATIVE_VARIANTS: Record<NarrativePageKey, number> = {
  timeOfDay: 3,
  calendar: 2,
  speedProfile: 2,
  challenge: 2,
  nearDondaful: 2,
  obsession: 2,
  favoriteShift: 2,
  monthly: 2,
  weekday: 2,
  lateNight: 2
};

/**
 * P2.1: the weekday headline interpolates the busiest day, but the `workday` archetype
 * *asserts* that the day is a working day (Mon–Fri). A week can be workday-dominated
 * (>=80% of plays) while Saturday still holds the single highest count, which would
 * render "工作日里最投入的是周六". For that archetype the headline therefore uses the
 * busiest working day; every other archetype keeps the real top day.
 */
export const weekdayHeadlineIndex = (archetype: string, counts: Array<number | null | undefined>, topWeekday: number): number => {
  const safeTop = Number.isInteger(topWeekday) && topWeekday >= 0 && topWeekday <= 6 ? topWeekday : 0;
  if (archetype !== "workday") return safeTop;
  let best = -1;
  let bestCount = 0;
  for (let index = 0; index < 5; index += 1) {
    const value = Number(counts?.[index] ?? 0);
    if (Number.isFinite(value) && value > bestCount) {
      bestCount = value;
      best = index;
    }
  }
  return best >= 0 ? best : safeTop;
};

export const selectNarrative = (page: NarrativePageKey, summary: VersionSummaryViewModel): NarrativeSelection => {
  const { archetype, intensity, secondaryType } = resolveArchetype(page, summary);
  const variants = Math.max(1, NARRATIVE_VARIANTS[page]);
  const variant = (stableHash(seedFor(summary, page, archetype)) % variants) + 1;
  return { archetype, variant, intensity, secondaryType };
};

/** i18n key of one wording field, e.g. `annualSummary.narrative.calendar.steady.v2.primary`. */
export const narrativeKey = (page: NarrativePageKey, selection: NarrativeSelection, field: string) =>
  `annualSummary.narrative.${page}.${selection.archetype}.v${selection.variant}.${field}`;
