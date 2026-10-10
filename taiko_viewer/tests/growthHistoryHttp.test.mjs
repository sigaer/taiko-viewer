import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { replayOverview } from "./fixtures/growthReplayHarness.mjs";
import { fixtures } from "./fixtures/dailyProgressReplay.mjs";

test("History route is authenticated, private and has no client profile selector", async () => {
  const source = await readFile(new URL("../server/api/account/growth/history.get.ts", import.meta.url), "utf8");
  assert.match(source, /requireAccountUser\(event\)/);
  assert.match(source, /private, no-store/);
  assert.match(source, /Vary/);
  assert.doesNotMatch(source, /bindingId|profileId|userId/);
});

test("measurement persistence failure never fails Overview", async () => {
  const { overview, counters } = await replayOverview(fixtures[1], "ready", "fail");
  assert.equal(overview.profileId, "1");
  assert.equal(overview.playerState.dataSufficiency, "ready");
  assert.equal(counters.compute, 1);
});


test("Overview does not persist a recalculation over a frozen daily archive", async () => {
  const { overview, counters } = await replayOverview(fixtures[1], "ready", "archived");
  assert.equal(overview.playerState.overallRating, 10.28, "current status still uses current computation");
  assert.equal(counters.compute, 1);
  assert.equal(counters.measurements, 0, "no replacement measurement is inserted for an archived day");
});
