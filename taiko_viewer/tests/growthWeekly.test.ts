import test from "node:test";
import assert from "node:assert/strict";
import type { GrowthFact, GrowthFactType, GrowthHistoryResponse, GrowthMeasurement } from "../types/player-growth.ts";
import { attributeWeeklyGoals, buildWeeklyGrowthRecap, buildWeeklyMeasurementChange, matchGoalFactToScoreFact } from "../server/services/growth-weekly/composer.ts";
import { resolveWeeklyGrowthWindow } from "../server/services/growth-weekly/range.ts";

const day = "2026-09-16";
let sequence = 0;
const fact = (type: GrowthFactType, overrides: Partial<GrowthFact> = {}): GrowthFact => {
  const id = `fact-${++sequence}`;
  return {
    id, factKey: id, ownerId: "1", bindingId: "2", type,
    title: "Test Song", songId: 10, difficultyType: 4,
    before: type === "played" ? null : 1, after: type === "played" ? null : 2, delta: type === "played" ? null : 1,
    goalId: null, goalType: null,
    evidence: { source: type === "goal-completed" ? "goal" : "score-history", sourceRevision: `revision-${id}`, evidenceVersion: 1 },
    temporal: { attributedDay: type === "goal-completed" ? null : day, occurredAt: null, observedAt: "2026-09-16T04:00:00.000Z", confirmedAt: type === "goal-completed" ? "2026-09-16T05:00:00.000Z" : null, precision: type === "goal-completed" ? "observation" : "day" },
    ...overrides
  };
};
const measurement = (id: string, capturedAt: string, overrides: Partial<GrowthMeasurement> = {}): GrowthMeasurement => ({
  id, ownerId: "1", bindingId: "2", capturedAt, scoreRevision: id.padEnd(64, "a").slice(0, 64), measurementVersion: 1,
  algorithmVersion: "growth-v1", modelRevision: "m".repeat(64), rating: 10,
  dimensions: { big_song: 10, stamina: 10, speed: 10, accuracy_power: 9, rhythm: 10, complex: 10 },
  focus: "accuracy_power", sampleCount: 30, availabilityState: "ready", ...overrides
});
const history = (facts: GrowthFact[], measurements: GrowthMeasurement[] = [], state: GrowthHistoryResponse["coverage"]["scoreHistoryState"] = "complete"): GrowthHistoryResponse => ({
  profileId: "2", range: { from: "2026-09-14", to: "2026-09-20", timezone: "Asia/Shanghai", maxDays: 90 }, facts, measurements,
  coverage: { scoreHistoryFrom: "2026-09-13", scoreHistoryTo: "2026-09-20", scoreHistoryState: state, measurementFrom: measurements[0]?.capturedAt || null, measurementTo: measurements.at(-1)?.capturedAt || null, measurementState: measurements.length ? "partial" : "unknown" }
});
const recap = (facts: GrowthFact[], measurements: GrowthMeasurement[] = [], state: GrowthHistoryResponse["coverage"]["scoreHistoryState"] = "complete") => buildWeeklyGrowthRecap(history(facts, measurements, state), { from: "2026-09-14", to: "2026-09-20", isCompleteWeek: true }, null);

test("weekly window follows Shanghai Monday and marks current week partial", () => {
  assert.deepEqual(resolveWeeklyGrowthWindow({}, new Date("2026-09-16T12:00:00+08:00")), {
    from: "2026-09-14", to: "2026-09-16", days: 3, fromUtc: "2026-09-13T16:00:00.000Z", toExclusiveUtc: "2026-09-16T16:00:00.000Z", isCompleteWeek: false
  });
  assert.equal(resolveWeeklyGrowthWindow({ week: "2026-09-07" }, new Date("2026-09-16T12:00:00+08:00")).isCompleteWeek, true);
  assert.throws(() => resolveWeeklyGrowthWindow({ week: "2026-09-21" }, new Date("2026-09-16T12:00:00+08:00")));
  assert.throws(() => resolveWeeklyGrowthWindow({ bindingId: "2" }, new Date("2026-09-16T12:00:00+08:00")));
});

test("theme selection is deterministic for progress, activity and degraded states", () => {
  assert.equal(recap([fact("score-pb"), fact("score-pb", { songId: 11 }), fact("score-pb", { songId: 12 })]).theme.type, "score-breakthrough");
  assert.equal(recap([fact("ng-reduced", { delta: -4 }), fact("ng-reduced", { songId: 11, delta: -3 }), fact("ng-reduced", { songId: 12, delta: -2 }), fact("score-pb", { songId: 13 })]).theme.type, "stability");
  assert.equal(recap([fact("df")]).theme.type, "new-crown");
  assert.equal(recap([fact("rank-upgrade")]).theme.type, "rank-breakthrough");
  assert.equal(recap([fact("score-pb"), fact("ng-reduced", { songId: 11 }), fact("rank-upgrade", { songId: 12 })]).theme.type, "mixed-growth");
  assert.equal(recap([fact("played")]).theme.type, "quiet");
  assert.equal(recap([fact("played"), fact("played", { songId: 11 }), fact("played", { songId: 12 })]).theme.type, "broad-activity");
  assert.equal(recap([]).theme.type, "no-play");
  assert.equal(recap([], [], "partial").theme.type, "limited-coverage");
  const balanced = [measurement("m1", "2026-09-14T01:00:00Z", { focus: "balanced" }), measurement("m2", "2026-09-16T01:00:00Z", { focus: "balanced" })];
  assert.equal(recap([fact("played")], balanced).theme.type, "balanced");
  const shifted = [measurement("m1", "2026-09-14T01:00:00Z"), measurement("m2", "2026-09-16T01:00:00Z", { focus: "rhythm" })];
  assert.equal(recap([fact("played")], shifted).theme.type, "focus-change");
});

test("Goal attribution requires a compatible same-chart score fact and never uses completedAt alone", () => {
  const score = fact("score-pb", { evidence: { source: "score-history", sourceRevision: "r2", evidenceVersion: 1 }, before: 900000, after: 910000, delta: 10000 });
  const goal = fact("goal-completed", { goalId: "9", goalType: "score-pb", before: 900000, after: 910000, delta: 10000, evidence: { source: "goal", sourceRevision: "r2", evidenceVersion: 1 } });
  assert.equal(matchGoalFactToScoreFact(goal, [score])?.factKey, score.factKey);
  assert.equal(attributeWeeklyGoals([goal], "2026-09-14", "2026-09-20").length, 0);
  assert.equal(attributeWeeklyGoals([score, goal], "2026-09-14", "2026-09-20").length, 1);
  const result = recap([score, goal]);
  assert.equal(result.theme.type, "goal-follow-through");
  assert.equal(result.totals.completedGoals, 1);
  assert.equal(result.highlights[0].goalCompleted, true);
});

test("highlights collapse same-chart facts, rank relative magnitudes, deduplicate and cap at four", () => {
  const duplicate = fact("score-pb", { factKey: "stable-pb", id: "stable-pb", delta: 100 });
  const result = recap([
    duplicate, { ...duplicate }, fact("ng-reduced", { factKey: "ng", songId: duplicate.songId, delta: -6 }), fact("fc", { factKey: "fc", songId: duplicate.songId }),
    fact("score-pb", { songId: 11, delta: 9000 }), fact("df", { songId: 12 }), fact("fc", { songId: 13 }), fact("rank-upgrade", { songId: 14 }), fact("score-pb", { songId: 15, delta: 500 })
  ]);
  assert.equal(result.highlights.length, 4);
  assert.equal(result.highlights.filter(item => item.songId === duplicate.songId).length, 1);
  assert.equal(result.highlights.find(item => item.songId === duplicate.songId)?.primaryType, "fc");
  assert.equal(new Set(result.highlights.flatMap(item => item.factKeys)).size, result.highlights.flatMap(item => item.factKeys).length);
  assert.deepEqual(recap(result.highlights.map(item => fact(item.primaryType, { songId: item.songId }))).highlights.map(item => item.songId).sort(), result.highlights.map(item => item.songId).sort());
});

test("measurement comparison enforces availability and every version boundary", () => {
  const start = measurement("m1", "2026-09-14T01:00:00Z");
  const end = measurement("m2", "2026-09-19T01:00:00Z", { rating: 10.2, dimensions: { ...start.dimensions, accuracy_power: 9.3 }, focus: "rhythm" });
  const compatible = buildWeeklyMeasurementChange([end, start]);
  assert.equal(compatible.compatible, true);
  assert.equal(compatible.ratingDelta, 0.2);
  assert.equal(compatible.dimensionDeltas?.accuracy_power, 0.3);
  assert.equal(compatible.primaryDimension?.key, "accuracy_power");
  assert.equal(compatible.focusFrom, "accuracy_power");
  assert.equal(compatible.focusTo, "rhythm");
  assert.equal(buildWeeklyMeasurementChange([]).reason, "insufficient");
  assert.equal(buildWeeklyMeasurementChange([start]).reason, "insufficient");
  assert.equal(buildWeeklyMeasurementChange([start, { ...end, algorithmVersion: "growth-v2" }]).reason, "algorithm-mismatch");
  assert.equal(buildWeeklyMeasurementChange([start, { ...end, modelRevision: "n".repeat(64) }]).reason, "model-mismatch");
  assert.equal(buildWeeklyMeasurementChange([start, { ...end, measurementVersion: 2 }]).reason, "measurement-version-mismatch");
  assert.equal(buildWeeklyMeasurementChange([start, { ...end, availabilityState: "limited", focus: "limited" }]).reason, "limited");
  assert.equal(buildWeeklyMeasurementChange([start, { ...end, focus: "balanced" }]).focusTo, "balanced");
  const unchanged = buildWeeklyMeasurementChange([start, measurement("m3", "2026-09-20T01:00:00Z")]);
  assert.equal(unchanged.primaryDimension, null);
  assert.equal(unchanged.ratingDelta, null);
});

test("coverage states remain explicit while totals only describe confirmed facts", () => {
  for (const state of ["complete", "partial", "truncated", "unknown"] as const) {
    const result = recap([fact("score-pb")], [], state);
    assert.equal(result.coverage.scoreHistoryState, state);
    assert.equal(result.totals.pb, 1);
  }
  const manual = recap([], [], "unknown");
  assert.equal(manual.theme.type, "limited-coverage");
  assert.equal(manual.totals.distinctCharts, 0);
});
