// Frozen from 85859c4 utils/playerGrowth.ts, before the P0 formatter change.
// Preserve even surprising legacy behavior; this is a semantic oracle, not production code.
export const growthCalendarDayBefore = (value, timezone = "Asia/Shanghai") => {
  const text = String(value || "").trim();
  const direct = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T]\d{2}:\d{2}:\d{2})?$/);
  if (direct) return `${direct[1]}-${String(Number(direct[2])).padStart(2, "0")}-${String(Number(direct[3])).padStart(2, "0")}`;
  const date = value instanceof Date ? value : new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
};

export const calendarCases = () => [
  ["before-shanghai-midnight", "2026-10-07T15:59:59Z"],
  ["at-shanghai-midnight", "2026-10-07T16:00:00Z"],
  ["milliseconds", "2026-10-07T16:00:00.001Z"],
  ["offset-eight", "2026-10-08T00:00:00+08:00"],
  ["offset-negative", "2026-10-07T11:00:00-05:00"],
  ["offset-half-hour", "2026-10-07T21:30:00+05:30"],
  ["local-space", "2026-10-07 23:59:59"],
  ["local-T", "2026-10-07T23:59:59"],
  ["local-slashes", "2026/2/9 01:02:03"],
  ["date-only", "2026-2-9"],
  ["trim", " 2026-10-07 "],
  ["Date-instance", new Date("2026-10-07T16:00:00Z")],
  ["invalid-Date", new Date(NaN)],
  ["invalid-string", "not-a-date"],
  ["invalid-local-legacy", "2026-99-99"],
  ["invalid-ISO", "2026-99-99T01:00:00Z"],
  ["missing", undefined], ["null", null], ["empty", ""], ["whitespace", " "],
  ["zero", 0], ["number", 2026], ["timestamp-number", 1791388800000],
  ["false", false], ["true", true], ["object", {}], ["array", []],
  ["stringifiable", { toString: () => "2026-10-07T16:00:00Z" }],
  ["Symbol", Symbol("date")], ["bigint", 2026n],
  ["leap-day", "2024-02-28T16:00:00Z"],
  ["month-end", "2026-04-30T16:00:00Z"],
  ["year-end", "2026-12-31T16:00:00Z"],
  ["UTC", "2026-10-07T16:00:00Z", "UTC"],
  ["New-York-before-DST", "2026-03-08T06:59:59Z", "America/New_York"],
  ["New-York-after-DST", "2026-03-08T07:00:00Z", "America/New_York"],
  ["New-York-fall-first", "2026-11-01T05:30:00Z", "America/New_York"],
  ["New-York-fall-second", "2026-11-01T06:30:00Z", "America/New_York"],
  ["London-midnight", "2026-06-30T23:00:00Z", "Europe/London"],
  ["Tokyo", "2026-10-07T15:00:00Z", "Asia/Tokyo"],
  ["invalid-timezone", "2026-10-07T16:00:00Z", "invalid/timezone"],
  ["local-invalid-timezone-fast-path", "2026-10-07", "invalid/timezone"],
  ["invalid-date-invalid-timezone", "bad", "invalid/timezone"]
];
export const calendarResult = (fn, value, timezone) => {
  try { return { value: fn(value, timezone) }; }
  catch (error) { return { error: error.name }; }
};
