// Run once BEFORE modifying production code. Refuses to capture an optimized implementation.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { growthCalendarDay } from "../../utils/playerGrowth.ts";
import { deriveDailyProgress, deriveProgressForRange } from "../../utils/dailyProgress.ts";
import { projectScoreFacts } from "../../utils/growthHistory.ts";
import { fixtures } from "../../tests/fixtures/dailyProgressReplay.mjs";
import { calendarCases, calendarResult, growthCalendarDayBefore } from "../../tests/fixtures/growthCalendarBefore0800.mjs";
const source = await readFile(new URL("../../utils/playerGrowth.ts", import.meta.url), "utf8");
assert.ok(source.includes('return new Intl.DateTimeFormat("en-CA"'), "Capture must precede formatter optimization");
const calendar = Object.fromEntries(calendarCases().map(([id, value, zone]) => {
  const result = calendarResult(growthCalendarDay, value, zone);
  assert.deepEqual(result, calendarResult(growthCalendarDayBefore, value, zone));
  return [id, result];
}));
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const replay = Object.fromEntries(fixtures.map(fixture => {
  const snapshots = fixture.snapshots.map(p => ({ full: p._meta.full, timestamp: p._meta.ts, songs: p.songs, revision: p._meta.ts }));
  const current = snapshots.at(-1).songs;
  const days = deriveProgressForRange(current, snapshots, "2026-09-16", "2026-09-17", () => "fixture");
  return [fixture.id, digest({ days, daily: deriveDailyProgress(current, snapshots, "2026-09-17", () => "fixture"), facts: projectScoreFacts(1, 1, days) })];
}));
await writeFile(new URL("../../tests/fixtures/growthCalendar0800.golden.json", import.meta.url), JSON.stringify({ baseline: "85859c4", calendar, replay }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ baseline: "85859c4", calendarCases: Object.keys(calendar).length, replayFixtures: Object.keys(replay).length }));
