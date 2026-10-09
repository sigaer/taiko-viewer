import test from "node:test";
import assert from "node:assert/strict";
import type { GrowthFact, GrowthHistoryResponse, GrowthMeasurement } from "../types/player-growth.ts";
import {
  buildCurrentSegmentChange,
  buildFocusTimeline,
  buildMeasurementSegments,
  buildSkillPassport,
  buildSkillPassportMilestones,
  sampleDailyGrowthMeasurements
} from "../server/services/growth-passport/composer.ts";
import { passportHistoryRange, resolveSkillPassportRange } from "../server/services/growth-passport/range.ts";

const dimensions = (value = 10) => ({ big_song: value, stamina: value, speed: value, accuracy_power: value, rhythm: value, complex: value });
const measurement = (id: string, capturedAt: string, overrides: Partial<GrowthMeasurement> = {}): GrowthMeasurement => ({
  id,
  ownerId: "1",
  bindingId: "2",
  capturedAt,
  scoreRevision: id.padEnd(64, "a").slice(0, 64),
  measurementVersion: 1,
  algorithmVersion: "growth-v1",
  modelRevision: "model-a",
  rating: 10,
  dimensions: dimensions(),
  focus: "accuracy_power",
  sampleCount: 60,
  availabilityState: "ready",
  ...overrides
});
const fact = (key: string, type: GrowthFact["type"], day: string | null, overrides: Partial<GrowthFact> = {}): GrowthFact => ({
  id: key,
  factKey: key,
  ownerId: "1",
  bindingId: "2",
  type,
  title: `Song ${key}`,
  songId: 100,
  difficultyType: 4,
  before: 900000,
  after: 910000,
  delta: 10000,
  goalId: null,
  evidence: { source: "score-history", sourceRevision: `${key}-revision`, evidenceVersion: 1 },
  temporal: { attributedDay: day, occurredAt: day ? `${day}T04:00:00.000Z` : null, observedAt: day ? `${day}T05:00:00.000Z` : null, confirmedAt: null, precision: day ? "day" : "observation" },
  ...overrides
});

test("daily representative chooses the last Shanghai-day measurement with stable out-of-order sorting", () => {
  const rows = [
    measurement("3", "2026-09-21T01:00:00.000Z", { rating: 10.3 }),
    measurement("1", "2026-09-20T01:00:00.000Z", { rating: 10.1 }),
    measurement("2", "2026-09-20T09:00:00.000Z", { rating: 10.2 })
  ];
  const points = sampleDailyGrowthMeasurements(rows);
  assert.deepEqual(points.map(point => [point.day, point.id, point.rating]), [["2026-09-20", "2", 10.2], ["2026-09-21", "3", 10.3]]);
});

test("measurement segments split on model, algorithm and measurement versions without reconnecting", () => {
  const points = sampleDailyGrowthMeasurements([
    measurement("1", "2026-09-17T04:00:00.000Z"),
    measurement("2", "2026-09-18T04:00:00.000Z"),
    measurement("3", "2026-09-19T04:00:00.000Z", { modelRevision: "model-b" }),
    measurement("4", "2026-09-20T04:00:00.000Z", { modelRevision: "model-b", algorithmVersion: "growth-v2" }),
    measurement("5", "2026-09-21T04:00:00.000Z", { modelRevision: "model-b", algorithmVersion: "growth-v2", measurementVersion: 2 })
  ]);
  const segments = buildMeasurementSegments(points);
  assert.deepEqual(segments.map(segment => segment.points.map(point => point.id)), [["1", "2"], ["3"], ["4"], ["5"]]);
  assert.deepEqual(segments.map(segment => segment.id), ["segment-1", "segment-2", "segment-3", "segment-4"]);
});

test("current segment change handles positive, negative, stable, focus, limited and missing dimensions", () => {
  const segment = buildMeasurementSegments(sampleDailyGrowthMeasurements([
    measurement("1", "2026-09-20T04:00:00.000Z", { dimensions: dimensions(10), focus: "accuracy_power" }),
    measurement("2", "2026-09-21T04:00:00.000Z", { rating: 9.9, dimensions: { ...dimensions(10), accuracy_power: 10.4, rhythm: 9.8 }, focus: "rhythm" })
  ]))[0]!;
  const change = buildCurrentSegmentChange(segment);
  assert.equal(change.compatible, true);
  assert.equal(change.ratingDelta, -0.1);
  assert.deepEqual(change.primaryDimensionChange, { key: "accuracy_power", before: 10, after: 10.4, delta: 0.4 });
  assert.equal(change.focusFrom, "accuracy_power");
  assert.equal(change.focusTo, "rhythm");

  const negative = buildCurrentSegmentChange({ ...segment, points: [segment.points[0]!, { ...segment.points[1]!, dimensions: { ...dimensions(10), speed: 9.4 } }] });
  assert.equal(negative.primaryDimensionChange?.key, "speed");
  assert.ok(negative.primaryDimensionChange!.delta < 0);
  const stable = buildCurrentSegmentChange({ ...segment, points: [segment.points[0]!, { ...segment.points[1]!, rating: 10, dimensions: dimensions(10), focus: "balanced" }] });
  assert.equal(stable.primaryDimensionChange, null);
  assert.equal(stable.focusTo, "balanced");
  const missing = buildCurrentSegmentChange({ ...segment, points: [segment.points[0]!, { ...segment.points[1]!, dimensions: { ...dimensions(10), accuracy_power: null } }] });
  assert.equal(missing.dimensionDeltas?.accuracy_power, null);
  const limited = buildCurrentSegmentChange({ ...segment, points: [segment.points[0]!, { ...segment.points[1]!, availabilityState: "limited", focus: "limited" }] });
  assert.equal(limited.reason, "limited");
  assert.equal(buildCurrentSegmentChange({ ...segment, points: [segment.points[0]!] }).reason, "insufficient");
});

test("focus timeline uses consecutive run compression and preserves model breaks and limited states", () => {
  const segments = buildMeasurementSegments(sampleDailyGrowthMeasurements([
    measurement("1", "2026-09-16T04:00:00.000Z", { focus: "accuracy_power" }),
    measurement("2", "2026-09-17T04:00:00.000Z", { focus: "accuracy_power" }),
    measurement("3", "2026-09-18T04:00:00.000Z", { focus: "rhythm" }),
    measurement("4", "2026-09-19T04:00:00.000Z", { focus: "rhythm", modelRevision: "model-b" }),
    measurement("5", "2026-09-20T04:00:00.000Z", { focus: "balanced", modelRevision: "model-b" }),
    measurement("6", "2026-09-21T04:00:00.000Z", { focus: "limited", availabilityState: "limited", modelRevision: "model-b" })
  ]));
  const runs = buildFocusTimeline(segments);
  assert.deepEqual(runs.map(run => [run.focus, run.startedAt, run.endedAt, run.segmentId]), [
    ["accuracy_power", "2026-09-16", "2026-09-17", "segment-1"],
    ["rhythm", "2026-09-18", "2026-09-18", "segment-1"],
    ["rhythm", "2026-09-19", "2026-09-19", "segment-2"],
    ["balanced", "2026-09-20", "2026-09-20", "segment-2"],
    ["limited", "2026-09-21", "2026-09-21", "segment-2"]
  ]);
  assert.equal(runs.at(-1)?.current, true);
});

test("milestones rank relative magnitude, collapse same chart facts, link Goal and keep observation semantics", () => {
  const pbSmall = fact("pb-small", "score-pb", "2026-09-18", { songId: 101, after: 901000, delta: 1000 });
  const pbLarge = fact("pb-large", "score-pb", "2026-09-19", { songId: 102, after: 920000, delta: 20000 });
  const fc = fact("fc", "fc", "2026-09-20", { songId: 103, before: 0, after: 1, delta: 1 });
  const duplicate = { ...fc };
  const rank = fact("rank", "rank-upgrade", "2026-09-17", { songId: 104, before: 4, after: 5, delta: 1 });
  const scoreForGoal = fact("goal-score", "ng-reduced", "2026-09-21", { songId: 105, before: 8, after: 4, delta: -4, evidence: { source: "score-history", sourceRevision: "matched", evidenceVersion: 1 } });
  const matchedGoal = fact("goal-matched", "goal-completed", null, { songId: 105, before: 8, after: 4, delta: -4, goalId: "g1", goalType: "ng-reduced", evidence: { source: "goal", sourceRevision: "matched", evidenceVersion: 1 }, temporal: { attributedDay: null, occurredAt: null, observedAt: "2026-09-21T05:00:00.000Z", confirmedAt: "2026-09-21T06:00:00.000Z", precision: "observation" } });
  const observedGoal = fact("goal-observed", "goal-completed", null, { songId: 106, goalId: "g2", goalType: "fc", evidence: { source: "goal", sourceRevision: "unmatched", evidenceVersion: 1 }, temporal: { attributedDay: null, occurredAt: null, observedAt: "2026-09-16T05:00:00.000Z", confirmedAt: "2026-09-16T06:00:00.000Z", precision: "observation" } });
  const milestones = buildSkillPassportMilestones([pbSmall, pbLarge, fc, duplicate, rank, scoreForGoal, matchedGoal, observedGoal]);
  assert.equal(milestones.length, 5);
  assert.equal(milestones.find(item => item.songId === 105)?.goalCompleted, true);
  assert.equal(milestones.find(item => item.songId === 106)?.observationOnly, true);
  assert.equal(milestones.find(item => item.songId === 106)?.day, null);
  assert.equal(milestones.filter(item => item.songId === 103).length, 1);
  assert.deepEqual(buildSkillPassportMilestones([pbSmall, pbLarge, fc, duplicate, rank, scoreForGoal, matchedGoal, observedGoal]), milestones);
});

test("tiny PBs never become highlights just by covering dates", () => {
  const facts = Array.from({ length: 12 }, (_, index) => fact(`pb-${index}`, "score-pb", `2026-09-${String(9 + index).padStart(2, "0")}`, { songId: 200 + index, after: 900001 + index, delta: index + 1 }));
  assert.equal(buildSkillPassportMilestones(facts).length, 0);
});

test("range accepts only 30/90/180/365 and keeps recent facts at 90 days", () => {
  for (const days of [30, 90, 180, 365]) assert.equal(resolveSkillPassportRange({ range: String(days) }, new Date("2026-09-21T08:00:00.000Z")).requestedDays, days);
  assert.throws(() => resolveSkillPassportRange({ range: "31" }, new Date("2026-09-21T08:00:00.000Z")));
  assert.throws(() => resolveSkillPassportRange({ profileId: "1" }, new Date("2026-09-21T08:00:00.000Z")));
  const range = resolveSkillPassportRange({ range: "365", dimension: "speed" }, new Date("2026-09-21T08:00:00.000Z"));
  assert.equal(range.from, "2025-09-22");
  assert.equal(passportHistoryRange(range).from, "2026-06-24");
  assert.equal(range.selectedDimension, "speed");
});

test("passport preserves shorter measurement coverage and recent fact coverage", () => {
  const range = resolveSkillPassportRange({ range: "180" }, new Date("2026-09-21T08:00:00.000Z"));
  const rows = [measurement("1", "2026-09-20T04:00:00.000Z")];
  const history: GrowthHistoryResponse = { profileId: "2", range: { from: range.recentFrom, to: range.to, timezone: "Asia/Shanghai", maxDays: 90 }, facts: [], measurements: [], coverage: { scoreHistoryFrom: null, scoreHistoryTo: null, scoreHistoryState: "partial", measurementFrom: null, measurementTo: null, measurementState: "unknown" } };
  const passport = buildSkillPassport({ profileId: "2", range, measurements: rows, measurementCoverage: { measurementFrom: rows[0]!.capturedAt, measurementTo: rows[0]!.capturedAt, measurementDays: 1 }, history, overview: null });
  assert.equal(passport.range.requestedDays, 180);
  assert.equal(passport.range.actualFrom, "2026-09-20");
  assert.equal(passport.range.actualTo, "2026-09-20");
  assert.equal(passport.coverage.measurementDays, 1);
  assert.equal(passport.coverage.recentFactsState, "partial");
});

test("365 realistic daily rows remain bounded and deterministic", () => {
  const rows = Array.from({ length: 365 }, (_, index) => measurement(String(index + 1), new Date(Date.parse("2025-09-22T04:00:00.000Z") + index * 86_400_000).toISOString(), { rating: 9 + index / 1000, dimensions: dimensions(9 + index / 1000) }));
  const startedAt = performance.now();
  const segments = buildMeasurementSegments(sampleDailyGrowthMeasurements(rows));
  const elapsed = performance.now() - startedAt;
  assert.equal(segments.length, 1);
  assert.equal(segments[0]?.points.length, 365);
  assert.ok(Buffer.byteLength(JSON.stringify(segments)) < 1_000_000);
  assert.ok(elapsed < 250, `365-row projection took ${elapsed.toFixed(1)}ms`);
});

test('recent tiny PB cannot displace eight older independent DF achievements', () => {
  const older = Array.from({ length: 8 }, (_, index) => fact(`old-${index}`, 'df', '2026-09-12', { songId: 200 + index, before: 1, after: 2, delta: 1 }));
  const latest = fact('new-small-pb', 'score-pb', '2026-10-06', { songId: 101, before: 900000, after: 900001, delta: 1 });
  const milestones = buildSkillPassportMilestones([...older, latest]);
  assert.equal(milestones.length, 8);
  assert.ok(milestones.every(node => node.day === '2026-09-12' && node.primaryType === 'df'));
});
test('observation-only Goal milestone orders by Shanghai day without inventing play attribution', () => {
  const played = fact('played-day', 'df', '2026-10-06', { songId: 100, before: 1, after: 2, delta: 1 });
  const observed = fact('observed-new', 'goal-completed', null, { songId: 101, goalId: 'new-goal', goalType: 'score-pb', evidence: { source: 'goal', sourceRevision: 'unmatched', evidenceVersion: 1 }, temporal: { attributedDay: null, occurredAt: null, observedAt: '2026-10-06T17:00:00Z', precision: 'observation' } });
  const milestones = buildSkillPassportMilestones([played, observed]);
  assert.equal(milestones[0]?.primaryType, 'goal-completed');
  assert.equal(milestones[0]?.day, null);
  assert.equal(milestones[0]?.observationOnly, true);
});
