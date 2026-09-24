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

// The upstream `period.totalDays` stays the season-window length. The Viewer
// independently derives the same reporting span and never substitutes the
// account's earlier observation history.
test("cached summaries keep a season-window length upstream", async () => {
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
    assert.ok(upstreamDays > 200, `${file} no longer looks like a season window length`);
  }
});

// `firstActualPlayDate` remains account-observation provenance for the generator
// and may predate the reporting window. It is deliberately not the Period-page
// display anchor; that presentation contract is covered by the normalizer test.
// Only summaries produced by the current algorithm are audited; older cached
// files still carry the previous anchor.
test("current summaries preserve their first observed record as provenance", async () => {
  const CURRENT_ALGORITHM = "annual-observation-v4.2.0";
  const cacheRoot = resolve(process.cwd(), ".data/account-cache/annual-summary-v4/summaries");
  const summaryFiles = [];
  const walk = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.name === "summary.json") summaryFiles.push(path);
    }
  };
  await walk(cacheRoot).catch(() => undefined);
  for (const file of summaryFiles) {
    const summary = JSON.parse(await readFile(file, "utf8").catch(() => "null") ?? "null");
    if (!summary || summary.provenance?.algorithmVersion !== CURRENT_ALGORITHM) continue;
    const firstActualPlayDay = calendarParts(summary.period?.firstActualPlayDate);
    const firstRecordDay = calendarParts(summary.period?.firstRecordAt);
    const lastRecordDay = calendarParts(summary.period?.lastRecordAt);
    const firstSnapshotDay = calendarParts(summary.coverage?.firstSnapshotAt);
    assert.ok(firstActualPlayDay, `${file} has no first-record day`);
    assert.ok(firstRecordDay, `${file} has no first-record timestamp`);
    assert.ok(firstSnapshotDay, `${file} has no first observed snapshot`);
    assert.equal(
      firstActualPlayDay,
      firstRecordDay,
      `${file} stores different first-observation dates`
    );
    assert.ok(
      firstRecordDay <= firstSnapshotDay,
      `${file} first record is later than the first observed snapshot`
    );
    assert.ok(firstRecordDay <= lastRecordDay, `${file} first record is later than its last record`);
  }
});
