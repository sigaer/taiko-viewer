import test from "node:test";
import assert from "node:assert/strict";
import { buildPlayerGrowthState, growthCalendarDay, growthGreetingPeriod, selectGrowthPriority } from "../utils/playerGrowth.ts";

test("selects the lowest valid dimension with stable tie ordering", () => {
  const result = selectGrowthPriority([
    { key: "complex", value: 9.4 },
    { key: "rhythm", value: 9.4 },
    { key: "stamina", value: 11.2 }
  ], "ready");
  assert.equal(result.priorityDimension, "rhythm");
  assert.deepEqual(result.tiedDimensions, ["rhythm", "complex"]);
});

test("treats top20 sample size as ready and avoids calling missing evidence weak", () => {
  const limited = buildPlayerGrowthState([{ key: "complex", value: 4 }, { key: "stamina", value: 10 }], 2, "SNAPSHOT_LIMITED");
  assert.equal(limited.dataSufficiency, "limited");
  assert.equal(limited.priorityDimension, "complex");
  const empty = buildPlayerGrowthState([{ key: "complex", value: 0 }, { key: "stamina", value: 0 }], 0, "INSUFFICIENT");
  assert.equal(empty.dataSufficiency, "insufficient");
  assert.equal(empty.priorityDimension, null);
  assert.equal(empty.basis, "insufficient-evidence");
});

test("calendar day follows the business timezone and preserves local timestamps", () => {
  assert.equal(growthCalendarDay("2026-08-31 23:59:59"), "2026-08-31");
  assert.equal(growthCalendarDay("2026-09-01T00:00:00+08:00"), "2026-09-01");
  assert.equal(growthCalendarDay("2026-08-31T16:00:00Z"), "2026-09-01");
});

test("greeting period follows the business timezone", () => {
  assert.equal(growthGreetingPeriod(new Date("2026-08-31T00:00:00Z")), "morning");
  assert.equal(growthGreetingPeriod(new Date("2026-08-31T03:00:00Z")), "noon");
  assert.equal(growthGreetingPeriod(new Date("2026-08-31T06:00:00Z")), "afternoon");
  assert.equal(growthGreetingPeriod(new Date("2026-08-31T12:00:00Z")), "evening");
});
