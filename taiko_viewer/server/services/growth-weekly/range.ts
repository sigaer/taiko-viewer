import { createError } from "h3";
import { growthCalendarDay } from "../../../utils/playerGrowth.ts";
import type { GrowthHistoryRange } from "../growth-history/range.ts";

const DAY_MS = 86_400_000;
const exactDay = (value: unknown) => {
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const epoch = Date.parse(`${text}T00:00:00Z`);
  return Number.isFinite(epoch) && new Date(epoch).toISOString().slice(0, 10) === text ? text : "";
};
const moveDay = (day: string, amount: number) => new Date(Date.parse(`${day}T00:00:00Z`) + amount * DAY_MS).toISOString().slice(0, 10);
const mondayFor = (day: string) => {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return moveDay(day, -(weekday === 0 ? 6 : weekday - 1));
};

export type WeeklyGrowthWindow = GrowthHistoryRange & { isCompleteWeek: boolean };

export function resolveWeeklyGrowthWindow(query: Record<string, unknown>, now = new Date()): WeeklyGrowthWindow {
  if (Object.keys(query).some(key => key !== "week")) throw createError({ statusCode: 400, statusMessage: "invalid-weekly-range" });
  const today = growthCalendarDay(now);
  const selectedDay = query.week === undefined ? today : exactDay(query.week);
  if (!selectedDay || selectedDay > today) throw createError({ statusCode: 400, statusMessage: "invalid-weekly-range" });
  const currentMonday = mondayFor(today);
  const from = mondayFor(selectedDay);
  if (from > currentMonday) throw createError({ statusCode: 400, statusMessage: "invalid-weekly-range" });
  const isCompleteWeek = from < currentMonday;
  const to = isCompleteWeek ? moveDay(from, 6) : today;
  const days = Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
  const fromUtc = new Date(`${from}T00:00:00+08:00`).toISOString();
  const toExclusiveUtc = new Date(Date.parse(`${to}T00:00:00+08:00`) + DAY_MS).toISOString();
  return { from, to, days, fromUtc, toExclusiveUtc, isCompleteWeek };
}
