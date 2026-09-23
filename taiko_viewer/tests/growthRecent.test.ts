import test from "node:test";
import assert from "node:assert/strict";
import type { GrowthObservation } from "../server/services/growth-history/evidence.ts";
import { selectRecentObservationWindow } from "../server/services/growth-recent/boundary.ts";
import { GROWTH_RECENT_ALGORITHM_VERSION, type RecentCursor } from "../server/services/growth-recent/store.ts";
import { GROWTH_RECENT_CURSOR_TABLE_SQL } from "../server/services/growth-recent/schema.ts";

const observation = (token: string, level: "L0" | "L1" = "L1", excludedReason: GrowthObservation["excludedReason"] = level === "L1" ? null : "import"): GrowthObservation => ({
  token: token.repeat(64),
  orderKey: token,
  revision: token.repeat(64),
  contentRevision: null,
  observedAt: `2026-09-2${token === "a" ? 0 : token === "b" ? 1 : 2}T02:00:00.000Z`,
  source: level === "L1" ? "wahlap" : excludedReason === "dispatcher-transfer" ? "sakura-bot-sync" : "kinoko-import",
  eventDays: ["2026-09-20"],
  evidenceLevel: level,
  excludedReason
});
const cursor = (item: GrowthObservation, version = GROWTH_RECENT_ALGORITHM_VERSION): RecentCursor => ({ userId: 1, bindingId: 2, token: item.token, observationRevision: item.revision, observedAt: item.observedAt, algorithmVersion: version });

test("first visit presents only the latest eligible observation", () => {
  const [a, excluded, b] = [observation("a"), observation("c", "L0", "dispatcher-transfer"), observation("b")];
  const result = selectRecentObservationWindow([a, excluded, b], null);
  assert.equal(result.current?.token, b.token);
  assert.deepEqual(result.selected.map(item => item.token), [b.token]);
  assert.equal(result.acknowledgeRequired, true);
  assert.equal(result.recovered, false);
});

test("a disruptive L0 boundary hides older observations until a new authoritative chain exists", () => {
  const before = observation("a");
  const imported = observation("b", "L0", "import");
  const baseline = observation("c", "L0", "discontinuity-baseline");
  assert.equal(selectRecentObservationWindow([before, imported, baseline], null).current, null);
  const after = observation("d");
  assert.deepEqual(selectRecentObservationWindow([before, imported, baseline, after], null).selected.map(item => item.token), [after.token]);
});

test("cursor selects strictly newer eligible observations and caught-up is empty", () => {
  const items = [observation("a"), observation("b"), observation("c")];
  assert.deepEqual(selectRecentObservationWindow(items, cursor(items[0])).selected.map(item => item.token), [items[1].token, items[2].token]);
  const caughtUp = selectRecentObservationWindow(items, cursor(items[2]));
  assert.deepEqual(caughtUp.selected, []);
  assert.equal(caughtUp.acknowledgeRequired, false);
});

test("missing or version-stale cursor recovers to latest observation without replaying a backlog", () => {
  const items = [observation("a"), observation("b")];
  for (const stale of [cursor(observation("c")), cursor(items[0], "old-version")]) {
    const result = selectRecentObservationWindow(items, stale);
    assert.equal(result.recovered, true);
    assert.deepEqual(result.selected.map(item => item.token), [items[1].token]);
  }
});

test("cursor schema is per-binding, binary-tokened and deliberately has no foreign keys", () => {
  assert.match(GROWTH_RECENT_CURSOR_TABLE_SQL, /PRIMARY KEY \(binding_id\)/);
  assert.match(GROWTH_RECENT_CURSOR_TABLE_SQL, /cursor_token CHAR\(64\).*ascii_bin/);
  assert.doesNotMatch(GROWTH_RECENT_CURSOR_TABLE_SQL, /FOREIGN KEY|REFERENCES/i);
});
