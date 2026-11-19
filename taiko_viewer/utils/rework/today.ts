// Slice C (今日 / 成长 / 这一周 / 目标) presentation helpers. Pure functions only: no Nuxt imports, used by the
// reworked components and by node tests. Nothing here decides a business fact (home state, growth facts, goal
// evaluation, weekly aggregation): it only turns what the API returned into what a component draws.

/** Secondary tabs of the 成长 destination; each tab label equals the page's own <h1>. */
export const GROWTH_TABS = [
  { key: "passport", to: "/my/growth" },
  { key: "weekly", to: "/my/weekly" }
] as const;

/** Growth dimension key (types/recommendation-intelligence RatingDimensionKey) → label key under rework.ratingDims. */
export const dimensionLabelKey = (key: string) =>
  `rework.ratingDims.${key === "big_song" ? "big" : key === "accuracy_power" ? "accuracy" : key}`;

export type CrownName = "dondaful" | "full" | "clear";

/** Growth / daily / weekly fact type → crown state of DsCrown; null for facts that are not a crown. */
export function factCrown(type: string | null | undefined): CrownName | null {
  if (type === "df") return "dondaful";
  if (type === "fc") return "full";
  if (type === "clear" || type === "clear-upgrade") return "clear";
  return null;
}

/** A rank fact carries bestScoreRank values (DsRank 0–8). */
export const isRankFact = (type: string | null | undefined) => type === "rank-upgrade";

/** 0–8 when the value is a score rank, otherwise null (DsRank shows nothing for other values). */
export function rankValue(value: unknown): number | null {
  const n = Number(value);
  return value !== null && value !== undefined && value !== "" && Number.isInteger(n) && n >= 0 && n <= 8 ? n : null;
}

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export type RadarAxis = { key: string; label: string; value: number | null; prev?: number | null };

/**
 * Six-dimension radar axes in the given order. `prev` only when a comparable earlier measurement exists; a missing
 * value stays null (the radar leaves the point out, it is not drawn as zero).
 */
export function radarAxes<K extends string>(
  order: readonly K[],
  label: (key: K) => string,
  current: Partial<Record<K, number | null>> | null | undefined,
  previous?: Partial<Record<K, number | null>> | null
): RadarAxis[] {
  return order.map((key) => {
    const value = current?.[key];
    const prev = previous?.[key];
    return {
      key,
      label: label(key),
      value: finite(value) ? value : null,
      ...(previous ? { prev: finite(prev) ? prev : null } : {})
    };
  });
}

/** True when at least `min` axes carry a value (a radar with fewer is not drawn). */
export const radarHasData = (axes: readonly RadarAxis[], min = 3) => axes.filter((a) => a.value !== null).length >= min;

// The metric line of the growth page lives next to passportMetricRuns (utils/passportNarrative.ts).
export { metricLine } from "../passportNarrative.ts";

/** Weekly dimension deltas → rows for the change list; the bar is the share of the largest absolute change. */
export function deltaRows<K extends string>(order: readonly K[], deltas: Partial<Record<K, number | null>> | null | undefined) {
  const values = order.map((key) => ({ key, delta: finite(deltas?.[key]) ? (deltas?.[key] as number) : null }));
  const max = Math.max(0, ...values.map((v) => (v.delta === null ? 0 : Math.abs(v.delta))));
  const top = values.reduce<number | null>((best, v) => (v.delta !== null && v.delta > 0 && (best === null || v.delta > best) ? v.delta : best), null);
  return values.map((v) => ({
    ...v,
    share: v.delta === null || max === 0 ? 0 : Math.round((Math.abs(v.delta) / max) * 100),
    top: v.delta !== null && top !== null && v.delta === top
  }));
}

export const signedFixed = (value: number | null | undefined, digits = 2) =>
  finite(value) ? `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits)}` : "—";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86400000;
/** YYYY-MM-DD moved by whole days (calendar arithmetic in UTC, no time zone involved). */
export function shiftDay(day: string, days: number): string | null {
  if (!DAY.test(day)) return null;
  const t = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(t)) return null;
  return new Date(t + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Week navigation of /my/weekly over the existing `?week=<YYYY-MM-DD>` contract (the server returns the week that
 * contains the day). Previous: the day before this week's Monday; next: the Monday after, only for a completed week.
 */
export function weekNavigation(week: { from: string; to: string; isCompleteWeek: boolean } | null | undefined) {
  if (!week) return { previous: null, next: null };
  return {
    previous: shiftDay(week.from, -7),
    next: week.isCompleteWeek ? shiftDay(week.from, 7) : null
  };
}

/** Intl locale of the page language (dates and numbers). */
export const intlLocale = (locale: string) => (locale === "ja" ? "ja-JP" : "zh-CN");

/** "M/D"-style day in the page language, Asia/Shanghai (the growth calendar); "" when the value is not a date. */
export function shortDay(value: string | null | undefined, locale: string): string {
  const parsed = Date.parse(DAY.test(String(value)) ? `${value}T12:00:00+08:00` : String(value || ""));
  return Number.isFinite(parsed) ? new Intl.DateTimeFormat(intlLocale(locale), { month: "numeric", day: "numeric", timeZone: "Asia/Shanghai" }).format(parsed) : "";
}

// Static locale keys for values the API returns (so every key can be checked in both locale files).
const keys = <T extends string>(prefix: string, values: readonly T[]) => Object.fromEntries(values.map((v) => [v, `${prefix}.${v}`])) as Record<T, string>;
export const GOAL_TYPES = ["score-pb", "ng-reduced", "clear", "fc", "df", "rank-upgrade", "played"] as const;
export const GOAL_TYPE_KEYS = keys("home.goal.types", GOAL_TYPES);
export const GOAL_COMPLETED_KEYS = keys("home.goal.completedTypes", GOAL_TYPES.filter((v) => v !== "played"));
export const RECOVERY_KEYS = keys("home.recovery", ["auth", "binding", "scores"] as const);
export const WEEKLY_TOTAL_FIELDS = ["distinctCharts", "pb", "fc", "df", "rankUpgrade", "completedGoals"] as const;
export const WEEKLY_TOTAL_KEYS = keys("weekly.totals", WEEKLY_TOTAL_FIELDS);
export const WEEKLY_REASON_KEYS = keys("weekly.measurement", ["insufficient", "limited", "algorithm-mismatch", "model-mismatch", "measurement-version-mismatch"] as const);
export const WEEKLY_METHOD_KEYS = keys("weekly.measurementReasons", ["algorithm-mismatch", "model-mismatch", "measurement-version-mismatch"] as const);
/** Key for a value of one of the tables above, or `fallback` when the API sent something the table does not know. */
export const keyOf = (table: Record<string, string>, value: string | null | undefined, fallback = "") => (value && table[value]) || fallback;
