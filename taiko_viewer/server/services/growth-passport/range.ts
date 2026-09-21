import { createError } from "h3";
import type { SkillPassportRangeDays, SkillPassportTrendDimension } from "../../../types/player-growth.ts";
import { growthCalendarDay } from "../../../utils/playerGrowth.ts";

const DAY_MS = 86_400_000;
const allowedRanges = new Set<SkillPassportRangeDays>([30, 90, 180, 365]);
const allowedDimensions = new Set<SkillPassportTrendDimension>(["rating", "big_song", "stamina", "speed", "accuracy_power", "rhythm", "complex"]);
const moveDay = (day: string, amount: number) => new Date(Date.parse(`${day}T00:00:00Z`) + amount * DAY_MS).toISOString().slice(0, 10);

export type SkillPassportRange = {
  requestedDays: SkillPassportRangeDays;
  selectedDimension: SkillPassportTrendDimension;
  from: string;
  to: string;
  fromUtc: string;
  toExclusiveUtc: string;
  recentFrom: string;
};

export function resolveSkillPassportRange(query: Record<string, unknown>, now = new Date()): SkillPassportRange {
  if (Object.keys(query).some(key => !["range", "dimension"].includes(key))) throw createError({ statusCode: 400, statusMessage: "invalid-passport-range" });
  const requestedDays = Number(query.range ?? 90) as SkillPassportRangeDays;
  const selectedDimension = String(query.dimension ?? "rating") as SkillPassportTrendDimension;
  if (!allowedRanges.has(requestedDays) || !allowedDimensions.has(selectedDimension)) throw createError({ statusCode: 400, statusMessage: "invalid-passport-range" });
  const to = growthCalendarDay(now);
  const from = moveDay(to, -(requestedDays - 1));
  return {
    requestedDays,
    selectedDimension,
    from,
    to,
    fromUtc: new Date(`${from}T00:00:00+08:00`).toISOString(),
    toExclusiveUtc: new Date(Date.parse(`${to}T00:00:00+08:00`) + DAY_MS).toISOString(),
    recentFrom: moveDay(to, -89)
  };
}

export function passportHistoryRange(range: SkillPassportRange) {
  return {
    from: range.recentFrom,
    to: range.to,
    days: 90,
    fromUtc: new Date(`${range.recentFrom}T00:00:00+08:00`).toISOString(),
    toExclusiveUtc: range.toExclusiveUtc
  };
}
