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

export type NarrativePageKey = "timeOfDay" | "calendar" | "speedProfile" | "challenge" | "nearDondaful";

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
  // 1.25 / 1.45 / 1.60 split the observed range into four bands; a missing or
  // zero value stays in the original-speed band.
  if (speed <= 1.25) return { archetype: "original", intensity: "low" };
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

const resolveArchetype = (page: NarrativePageKey, summary: VersionSummaryViewModel): Archetype => {
  switch (page) {
    case "timeOfDay": return timeOfDayArchetype(summary);
    case "calendar": return calendarArchetype(summary);
    case "speedProfile": return speedProfileArchetype(summary);
    case "challenge": return challengeArchetype(summary);
    case "nearDondaful": return nearDondafulArchetype(summary);
  }
};

/** How many wording sets exist for a page/archetype. Kept next to the selector so a missing locale entry cannot silently collapse the rotation. */
export const NARRATIVE_VARIANTS: Record<NarrativePageKey, number> = {
  timeOfDay: 3,
  calendar: 2,
  speedProfile: 2,
  challenge: 2,
  nearDondaful: 2
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
