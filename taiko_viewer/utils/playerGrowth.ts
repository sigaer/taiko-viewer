import type { PlayerRatingDimension, RatingDimensionKey } from "~/types/recommendation-intelligence";
import type { GrowthDataSufficiency, GrowthDataMode, PlayerGrowthState } from "~/types/player-growth";

export const GROWTH_DIMENSION_ORDER: RatingDimensionKey[] = [
  "big_song",
  "stamina",
  "speed",
  "accuracy_power",
  "rhythm",
  "complex"
];

export const GROWTH_DIMENSION_LABELS: Record<RatingDimensionKey, { zh: string; ja: string }> = {
  big_song: { zh: "大歌力", ja: "大歌力" },
  stamina: { zh: "体力", ja: "体力" },
  speed: { zh: "高速处理", ja: "高速処理" },
  accuracy_power: { zh: "精度力", ja: "精度力" },
  rhythm: { zh: "节奏处理", ja: "リズム処理" },
  complex: { zh: "复合处理", ja: "複合処理" }
};

export const GROWTH_DIMENSION_SHORT_LABELS: Record<RatingDimensionKey, { zh: string; ja: string }> = {
  big_song: { zh: "大歌", ja: "大歌" },
  stamina: { zh: "体力", ja: "体力" },
  speed: { zh: "高速", ja: "高速" },
  accuracy_power: { zh: "精度", ja: "精度" },
  rhythm: { zh: "节奏", ja: "リズム" },
  complex: { zh: "复合", ja: "複合" }
};

export type GrowthGreetingPeriod = "morning" | "noon" | "afternoon" | "evening";

export const growthGreetingPeriod = (value: Date = new Date(), timezone = "Asia/Shanghai"): GrowthGreetingPeriod => {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", hourCycle: "h23" }).format(value));
  if (hour < 11) return "morning";
  if (hour < 14) return "noon";
  if (hour < 18) return "afternoon";
  return "evening";
};

export const resolveGrowthSufficiency = (sampleCount: number, mode: GrowthDataMode): GrowthDataSufficiency => {
  if (mode === "INSUFFICIENT" || sampleCount <= 0) return "insufficient";
  return sampleCount >= 20 ? "ready" : "limited";
};

export const selectGrowthPriority = (dimensions: PlayerRatingDimension[], sufficiency: GrowthDataSufficiency) => {
  if (sufficiency === "insufficient") {
    return { priorityDimension: null, tiedDimensions: [] as RatingDimensionKey[], basis: "insufficient-evidence" as const };
  }
  const valid = dimensions
    .filter((item) => Number.isFinite(Number(item.value)) && Number(item.value) > 0)
    .sort((left, right) => {
      const delta = Number(left.value) - Number(right.value);
      return Math.abs(delta) > 1e-6 ? delta : GROWTH_DIMENSION_ORDER.indexOf(left.key) - GROWTH_DIMENSION_ORDER.indexOf(right.key);
    });
  if (!valid.length) {
    return { priorityDimension: null, tiedDimensions: [] as RatingDimensionKey[], basis: "insufficient-evidence" as const };
  }
  const minimum = Number(valid[0].value);
  const tiedDimensions = valid.filter((item) => Math.abs(Number(item.value) - minimum) <= 1e-6).map((item) => item.key);
  return { priorityDimension: valid[0].key, tiedDimensions, basis: "lowest-valid-dimension" as const };
};

export const buildPlayerGrowthState = (dimensions: PlayerRatingDimension[], sampleCount: number, mode: GrowthDataMode, overallRating: number | null = null): PlayerGrowthState => {
  const dataSufficiency = resolveGrowthSufficiency(sampleCount, mode);
  const selected = selectGrowthPriority(dimensions, dataSufficiency);
  return {
    overallRating,
    skills: GROWTH_DIMENSION_ORDER.map((key) => dimensions.find((item) => item.key === key) || { key, value: 0 }),
    priorityDimension: selected.priorityDimension,
    tiedDimensions: selected.tiedDimensions,
    dataSufficiency,
    basis: selected.basis,
    sampleCount
  };
};

// One fixed-zone formatter; arbitrary caller timezones are deliberately not cached.
let shanghaiCalendarFormatter: Intl.DateTimeFormat | undefined;

export const growthCalendarDay = (value: unknown, timezone = "Asia/Shanghai") => {
  const text = String(value || "").trim();
  const direct = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T]\d{2}:\d{2}:\d{2})?$/);
  if (direct) return `${direct[1]}-${String(Number(direct[2])).padStart(2, "0")}-${String(Number(direct[3])).padStart(2, "0")}`;
  const date = value instanceof Date ? value : new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "";
  const formatter = timezone === "Asia/Shanghai"
    ? shanghaiCalendarFormatter ??= new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" })
    : new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
  return formatter.format(date);
};
