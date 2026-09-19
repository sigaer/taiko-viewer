import { createError } from "h3";
import { growthCalendarDay } from "../../../utils/playerGrowth.ts";

export const GROWTH_HISTORY_MAX_DAYS = 90;
const DAY_MS = 86_400_000;
const exactDay = (value: unknown) => {
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const epoch = Date.parse(`${text}T00:00:00Z`);
  return Number.isFinite(epoch) && new Date(epoch).toISOString().slice(0, 10) === text ? text : "";
};

export type GrowthHistoryRange = { from: string; to: string; days: number; fromUtc: string; toExclusiveUtc: string };

export function resolveGrowthHistoryRange(query: Record<string, unknown>, now = new Date()): GrowthHistoryRange {
  if (Object.keys(query).some(key => !["from", "to", "days"].includes(key))) throw createError({ statusCode: 400, statusMessage: "invalid-history-range" });
  if (query.days !== undefined && (query.from !== undefined || query.to !== undefined)) throw createError({ statusCode: 400, statusMessage: "invalid-history-range" });
  const today = growthCalendarDay(now);
  let from = "";
  let to = today;
  if (query.days !== undefined) {
    const days = Number(query.days);
    if (!Number.isInteger(days) || days < 1 || days > GROWTH_HISTORY_MAX_DAYS) throw createError({ statusCode: 400, statusMessage: "invalid-history-range" });
    from = new Date(Date.parse(`${to}T00:00:00Z`) - (days - 1) * DAY_MS).toISOString().slice(0, 10);
  } else {
    if (query.to !== undefined) to = exactDay(query.to);
    if (!to) throw createError({ statusCode: 400, statusMessage: "invalid-history-range" });
    from = query.from === undefined ? new Date(Date.parse(`${to}T00:00:00Z`) - 29 * DAY_MS).toISOString().slice(0, 10) : exactDay(query.from);
    if (!from) throw createError({ statusCode: 400, statusMessage: "invalid-history-range" });
  }
  const days = Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
  if (days < 1 || days > GROWTH_HISTORY_MAX_DAYS) throw createError({ statusCode: 400, statusMessage: "invalid-history-range" });
  const fromUtc = new Date(Date.parse(`${from}T00:00:00+08:00`)).toISOString();
  const toExclusiveUtc = new Date(Date.parse(`${to}T00:00:00+08:00`) + DAY_MS).toISOString();
  return { from, to, days, fromUtc, toExclusiveUtc };
}
