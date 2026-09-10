import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

// The annual recap reports its day count in the season time zone. These cases
// pin the calendar arithmetic that `utils/annualSummary.ts` applies to the
// upstream `period` block, whose `totalDays` is the season window length rather
// than the elapsed days of the player's own story.
const ANNUAL_CALENDAR_TIME_ZONE = "Asia/Shanghai";
const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ANNUAL_CALENDAR_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

const calendarParts = (value) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  const plain = raw.match(DAY_PATTERN);
  const date = plain ? new Date(`${raw}T00:00:00Z`) : new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  const parts = formatter.formatToParts(date);
  const year = parts.find((item) => item.type === "year")?.value || "";
  const month = parts.find((item) => item.type === "month")?.value || "";
  const day = parts.find((item) => item.type === "day")?.value || "";
  return year && month && day ? `${year}-${month}-${day}` : "";
};

const dayNumber = (dayKey) => {
  const match = dayKey.match(DAY_PATTERN);
  if (!match) return null;
  return Math.round(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000);
};

const span = (startDay, endDay) => {
  const start = dayNumber(startDay);
  const end = dayNumber(endDay);
  if (start === null || end === null || end < start) return null;
  return end - start + 1;
};

test("season time zone keeps a late-evening record on its local day", () => {
  assert.equal(calendarParts("2026-04-20T17:28:30+08:00"), "2026-04-20");
  assert.equal(calendarParts("2026-01-17T00:05:59+08:00"), "2026-01-17");
  assert.equal(calendarParts("2026-04-19T22:06:18+08:00"), "2026-04-19");
});

test("a plain date is treated as its own calendar day", () => {
  assert.equal(calendarParts("2026-03-01"), "2026-03-01");
  assert.equal(calendarParts(""), "");
  assert.equal(calendarParts("not-a-date"), "");
});

test("the inclusive span counts both the first and the last day", () => {
  assert.equal(span("2026-04-20", "2026-04-20"), 1);
  assert.equal(span("2026-04-20", "2026-09-10"), 144);
  assert.equal(span("2026-01-17", "2026-09-10"), 237);
  assert.equal(span("2026-09-10", "2026-04-20"), null);
});

test("cached summaries report a story span that starts at the first played day", async () => {
  const cacheRoot = resolve(process.cwd(), ".data/account-cache/annual-summary-v4/summaries");
  const summaryFiles = [];
  const walk = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.name === "summary.json") summaryFiles.push(path);
    }
  };
  await walk(cacheRoot).catch(() => undefined);
  assert.ok(summaryFiles.length > 0, "no cached annual summary is available to check");
  for (const file of summaryFiles) {
    const summary = JSON.parse(await readFile(file, "utf8"));
    const firstDay = calendarParts(summary.period?.firstRecordAt);
    const seasonStart = calendarParts(summary.version?.startDate);
    const upstreamDays = Number(summary.period?.totalDays);
    assert.ok(firstDay, `${file} has no first record day`);
    assert.ok(seasonStart, `${file} has no season start day`);
    // The upstream figure must be the season window length, which is exactly
    // why the viewer re-anchors it instead of rendering it directly.
    assert.ok(upstreamDays > 200, `${file} no longer looks like a season window length`);
    assert.ok(firstDay > seasonStart, `${file} first record is not after the season start`);
    const storyStart = new Date(`${firstDay}T00:00:00Z`).getTime();
    const seasonStartTime = new Date(`${seasonStart}T00:00:00Z`).getTime();
    assert.ok(storyStart > seasonStartTime, `${file} story must start later than the season`);
  }
});

// The real acceptance account (taiko id 2258735) proves the product definition
// end to end: the game's own record reaches back to 2023, while the annual
// observation window only starts in 2026. The window-scoped fields can never
// produce the first date, so the generator has to publish it separately.
test("the acceptance account's first actual play day precedes its observation window", async () => {
  const file = resolve(
    process.cwd(),
    ".data/account-cache/annual-summary-v4/summaries/d6b5915c46057bcb005f46f6/annual_2026/annual_8357acbcad4494b16903122a/summary.json"
  );
  const summary = JSON.parse(await readFile(file, "utf8").catch(() => "null") ?? "null");
  if (!summary) return;
  const firstActualPlayDay = calendarParts(summary.period?.firstActualPlayDate);
  const windowFirstDay = calendarParts(summary.period?.firstRecordAt);
  assert.equal(firstActualPlayDay, "2023-11-18", "the acceptance account lost its proven first play day");
  assert.ok(windowFirstDay > firstActualPlayDay, "the window-scoped field must not define the story start");
});
