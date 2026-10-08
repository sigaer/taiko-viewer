import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { growthCalendarDay } from "../utils/playerGrowth.ts";
import { deriveDailyProgress, deriveProgressForRange } from "../utils/dailyProgress.ts";
import { projectScoreFacts } from "../utils/growthHistory.ts";
import { fixtures } from "./fixtures/dailyProgressReplay.mjs";
import { calendarCases, calendarResult, growthCalendarDayBefore } from "./fixtures/growthCalendarBefore0800.mjs";
const golden = JSON.parse(await readFile(new URL("./fixtures/growthCalendar0800.golden.json", import.meta.url), "utf8"));
for (const [id, value, zone] of calendarCases()) test(`calendar legacy parity: ${id}`, () => {
  const result = calendarResult(growthCalendarDay, value, zone);
  assert.deepEqual(result, golden.calendar[id]);
  assert.deepEqual(result, calendarResult(growthCalendarDayBefore, value, zone));
});
for (const fixture of fixtures) test(`canonical replay before/after golden: ${fixture.id}`, () => {
  const snapshots = fixture.snapshots.map(p => ({ full: p._meta.full, timestamp: p._meta.ts, songs: p.songs, revision: p._meta.ts }));
  const current = snapshots.at(-1).songs;
  const days = deriveProgressForRange(current, snapshots, "2026-09-16", "2026-09-17", () => "fixture");
  const value = { days, daily: deriveDailyProgress(current, snapshots, "2026-09-17", () => "fixture"), facts: projectScoreFacts(1, 1, days) };
  assert.equal(createHash("sha256").update(JSON.stringify(value)).digest("hex"), golden.replay[fixture.id], "canonical day/facts/provenance digest changed");
});

test("offset-aware calendar parity across leap years and DST zones", () => {
  for (const zone of ["Asia/Shanghai", "UTC", "America/New_York", "Europe/London", "Australia/Sydney"]) {
    for (let i = 0; i < 120; i++) {
      const instant = new Date(Date.parse("2024-01-01T15:59:59.999Z") + i * 11 * 86400000);
      assert.equal(growthCalendarDay(instant, zone), growthCalendarDayBefore(instant, zone));
      assert.equal(growthCalendarDay(instant.toISOString(), zone), growthCalendarDayBefore(instant.toISOString(), zone));
    }
  }
});

test("default formatter is constructed once and arbitrary timezones are not cached", async () => {
  const module = await import("../utils/playerGrowth.ts?formatter-construction-parity");
  const Original = Intl.DateTimeFormat;
  let count = 0;
  Intl.DateTimeFormat = function (...args) { count++; return new Original(...args); };
  try {
    for (let i = 0; i < 100; i++) module.growthCalendarDay("2026-10-07T16:00:00Z");
    assert.equal(count, 1);
    for (let i = 0; i < 10; i++) module.growthCalendarDay("2026-10-07T16:00:00Z", "UTC");
    assert.equal(count, 11);
    module.growthCalendarDay("bad"); module.growthCalendarDay("2026-10-07");
    assert.equal(count, 11);
  } finally { Intl.DateTimeFormat = Original; }
});
