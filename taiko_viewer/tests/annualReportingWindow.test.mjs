import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ANNUAL_REPORTING_WINDOW, formatAnnualCalendarDate, formatAnnualPeriodRange } from "../utils/annualPeriod.ts";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");

test("final reporting window is 357 Asia/Shanghai calendar days", async () => {
  const start = Date.UTC(2025, 9, 9);
  const endExclusive = Date.UTC(2026, 9, 1);
  assert.equal((endExclusive - start) / 86_400_000, 357);

  assert.deepEqual(ANNUAL_REPORTING_WINDOW, {
    start: "2025-10-09",
    endInclusive: "2026-09-30",
    endExclusive: "2026-10-01",
    calendarDays: 357,
    timezone: "Asia/Shanghai",
    revision: "annual-report-2026-r2-final-window"
  });
  const constants = await read("server/services/account/annual-summary/constants.ts");
  assert.ok(constants.includes('from "~/utils/annualPeriod"'));
  assert.ok(constants.includes("getAnnualGeneratorVersion"));
});

test("period display is calendar-stable and matches the product range", () => {
  assert.equal(formatAnnualCalendarDate("2025-10-09"), "2025.10.09");
  assert.equal(formatAnnualPeriodRange("2025-10-09", "2026-09-30"), "2025.10.09 – 2026.09.30");
  assert.equal(formatAnnualPeriodRange("2025-10-09", "2026-10-01"), "2025.10.09 – 2026.10.01");
});

test("window identity invalidates jobs, producer fingerprints and stored summaries", async () => {
  const runtime = await read("server/services/account/annual-summary/runtime.ts");
  const service = await read("server/services/account/annual-summary/index.ts");
  const recovery = await read("server/services/account/annual-summary/build-recovery.ts");
  assert.ok(runtime.includes("ANNUAL_REPORTING_WINDOW"));
  assert.ok(runtime.includes("ANNUAL_PRODUCER_REVISION"));
  assert.ok(runtime.includes("getAnnualGeneratorVersion()"));
  assert.ok(service.includes("ANNUAL_PRODUCER_REVISION"));
  assert.ok(service.includes("version.endDate !== canonical.endDate"));
  assert.ok(recovery.includes('annual-build-state-v2-report-window'));
});
