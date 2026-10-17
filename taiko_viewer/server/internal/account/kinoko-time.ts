import { createError } from "h3";

export const KINOKO_FUTURE_SKEW_MS = 5 * 60 * 1000;
export type TimeSkip = { position: number; type: "score-event"; reason: "future" | "invalid-time" | "missing-time" };
export type TimeSummary = { sourceRecords: number; validRecords: number; skippedTimeRecords: number; skipped: TimeSkip[]; skippedDetailsTruncated: boolean };
const invalidTime = () => createError({ statusCode: 422, message: "成绩时间无效", data: { code: "KINOKO_INVALID_SCORE_TIME" } });

// Explicit wall clock or ISO offset only: never use host TZ / Date.parse rollover.
// Retain original score strings; this representation is for ordering/snapshot names.
const parseTime = (value: unknown) => {
  if (typeof value !== "string") throw invalidTime();
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})?$/);
  if (!m) throw invalidTime();
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number) as [number, number, number, number, number, number];
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day); date.setUTCHours(hour, minute, second, 0);
  if (year < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day ||
      date.getUTCHours() !== hour || date.getUTCMinutes() !== minute || date.getUTCSeconds() !== second) throw invalidTime();
  let offset = 480;
  if (m[8] === "Z") offset = 0;
  else if (m[8]) {
    const hours = Number(m[8].slice(1, 3)), minutes = Number(m[8].slice(4, 6));
    if (hours > 14 || minutes > 59 || (hours === 14 && minutes)) throw invalidTime();
    offset = (m[8][0] === "-" ? -1 : 1) * (hours * 60 + minutes);
  }
  const epochMs = date.getTime() - offset * 60_000 + Number(`0.${m[7] || "0"}`) * 1000;
  const sh = new Date(Math.floor(epochMs / 1000) * 1000 + 480 * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const text = `${String(sh.getUTCFullYear()).padStart(4, "0")}-${pad(sh.getUTCMonth()+1)}-${pad(sh.getUTCDate())} ${pad(sh.getUTCHours())}:${pad(sh.getUTCMinutes())}:${pad(sh.getUTCSeconds())}`;
  return { text, epochMs };
};
export const parseKinokoTimestamp = (value: unknown, now = new Date()) => {
  const parsed = parseTime(value);
  if (!Number.isFinite(now.getTime()) || parsed.epochMs > now.getTime() + KINOKO_FUTURE_SKEW_MS) throw invalidTime();
  return parsed;
};
// Metadata is observation/import provenance, never a substitute score event date.
export const parseKinokoMetadataTime = (value: unknown) => {
  if (typeof value !== "string") return null;
  const compact = value.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})(?:_(\d{1,6}))?$/);
  const input = compact ? `${compact[1]}-${compact[2]}-${compact[3]} ${compact[4]}:${compact[5]}:${compact[6]}${compact[7] ? '.'+compact[7] : ''}` : value;
  try { return parseTime(input); } catch { return null; }
};
export const scoreTimeIssue = (row: Record<string, unknown>, now: Date, requireTimestamp = true): TimeSkip["reason"] | null => {
  if (!Number.isFinite(now.getTime())) throw invalidTime();
  let count = 0;
  for (const field of ["update_datetime", "highscore_datetime"]) {
    const value = row[field];
    if (value === undefined || value === null || value === "") continue;
    count++;
    let parsed;
    try { parsed = parseTime(value); } catch { return "invalid-time"; }
    if (parsed.epochMs > now.getTime() + KINOKO_FUTURE_SKEW_MS) return "future";
  }
  return requireTimestamp && !count ? "missing-time" : null;
};
export const filterKinokoEvents = <T extends Record<string, unknown>>(records: T[], now: Date) => {
  const valid: T[] = [], skipped: TimeSkip[] = [];
  let skippedTimeRecords = 0;
  records.forEach((row, position) => {
    const reason = scoreTimeIssue(row, now);
    if (!reason) valid.push(row);
    else { skippedTimeRecords++; if (skipped.length < 20) skipped.push({ position, type: "score-event", reason }); }
  });
  return { records: valid, timeSummary: { sourceRecords: records.length, validRecords: valid.length, skippedTimeRecords, skipped,
    skippedDetailsTruncated: skippedTimeRecords > skipped.length } satisfies TimeSummary };
};
export const scoreEventEpoch = (row: Record<string, unknown>) => parseTime(row.update_datetime || row.highscore_datetime).epochMs;
