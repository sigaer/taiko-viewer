import test from "node:test";
import assert from "node:assert/strict";
import { deriveProgressForRange } from "../utils/dailyProgress.ts";
import { goalFactKey, projectGoalFact, projectScoreFacts, scoreFactKey, sortGrowthFacts } from "../utils/growthHistory.ts";
import { resolveGrowthHistoryRange } from "../server/services/growth-history/range.ts";
import type { PlayerGoal } from "../types/player-goal.ts";

const row = (day: string, overrides: Record<string, unknown> = {}) => ({
  song_no: 1, level: 4, high_score: 900000, good_cnt: 90, ok_cnt: 5, ng_cnt: 5, combo_cnt: 80,
  clear_cnt: 1, full_combo_cnt: 0, dondaful_combo_cnt: 0, best_score_rank: 5,
  highscore_datetime: `${day} 10:00:00`, update_datetime: `${day} 10:00:00`, ...overrides
});

test("multi-day replay emits uncapped canonical facts once in stable order", () => {
  const snapshots = [
    { full: true, timestamp: "2026-09-15 23:00:00", revision: "r0", songs: [row("2026-09-15")] },
    { full: false, timestamp: "2026-09-16 10:01:00", revision: "r1", songs: [row("2026-09-16", { high_score: 910000 })] },
    { full: false, timestamp: "2026-09-18 09:00:00", revision: "r2a", songs: [row("2026-09-18", { high_score: 910000, highscore_datetime: "2026-09-18 09:00:00", update_datetime: "2026-09-18 09:00:00" })] },
    { full: false, timestamp: "2026-09-18 12:01:00", revision: "r2b", songs: [row("2026-09-18", { high_score: 920000, full_combo_cnt: 1, ng_cnt: 0, good_cnt: 95, highscore_datetime: "2026-09-18 12:00:00", update_datetime: "2026-09-18 12:00:00" })] },
    { full: false, timestamp: "2026-09-18 12:02:00", revision: "duplicate", songs: [row("2026-09-18", { high_score: 920000, full_combo_cnt: 1, ng_cnt: 0, good_cnt: 95, highscore_datetime: "2026-09-18 12:00:00", update_datetime: "2026-09-18 12:00:00" })] },
    { full: false, timestamp: "2026-09-20 09:00:00", revision: "r3a", songs: [row("2026-09-20", { high_score: 920000, full_combo_cnt: 1, ng_cnt: 0, good_cnt: 95, highscore_datetime: "2026-09-20 09:00:00", update_datetime: "2026-09-20 09:00:00" })] },
    { full: false, timestamp: "2026-09-20 12:01:00", revision: "r3b", songs: [row("2026-09-20", { high_score: 920000, full_combo_cnt: 1, ng_cnt: 0, good_cnt: 95, best_score_rank: 6, highscore_datetime: "2026-09-20 12:00:00", update_datetime: "2026-09-20 12:00:00" })] }
  ];
  const days = deriveProgressForRange([], snapshots, "2026-09-16", "2026-09-20", () => "Song");
  assert.equal(days.length, 5);
  assert.deepEqual(days.map(day => day.attendance), ["played", "not_played", "played", "not_played", "played"]);
  const facts = projectScoreFacts(7, 9, days);
  assert.deepEqual(facts.map(fact => [fact.temporal.attributedDay, fact.type]), [
    ["2026-09-16", "score-pb"],
    ["2026-09-18", "fc"],
    ["2026-09-18", "score-pb"],
    ["2026-09-18", "ng-reduced"],
    ["2026-09-20", "rank-upgrade"]
  ]);
  assert.equal(new Set(facts.map(fact => fact.factKey)).size, facts.length);
  assert.deepEqual(projectScoreFacts(7, 9, days).map(fact => fact.factKey), facts.map(fact => fact.factKey));
});

test("canonical score identity is source-independent and temporal precision is honest", () => {
  const key = scoreFactKey("9", "2026-09-19", 1, 4, "fc", 0, 1);
  assert.equal(key, scoreFactKey("9", "2026-09-19", 1, 4, "fc", 0, 1));
  assert.notEqual(key, scoreFactKey("9", "2026-09-19", 1, 4, "df", 0, 1));
});

const completedGoal = (): PlayerGoal => ({
  id: "42", profileId: "9", songId: 1, difficultyType: 4, title: "Song", starLevel: 9,
  goalType: "fc", baselineVersion: 1,
  baseline: { recordPresent: true, highScore: 1, goodCnt: 1, okCnt: 1, ngCnt: 1, comboCnt: 1, clearCnt: 1, fullComboCnt: 0, dondafulComboCnt: 0, bestScoreRank: 2, highscoreDatetime: null, updateDatetime: null, scoreObservedAt: null, capturedAt: "2026-09-18T00:00:00Z", sourceRevision: "a".repeat(64), sourceCompleteness: "complete" },
  source: "today-plan", sourceBasis: "accuracy_power", sourceMode: "dimension", sourceRank: 1, sourceRevision: "a".repeat(64), sourceGeneratedAt: "2026-09-18T00:00:00Z",
  targetData: { comparison: "greater", field: "fullComboCnt", value: 0 }, status: "completed", createdAt: "2026-09-18T00:00:00Z", completedAt: "2026-09-19T03:00:00Z", cancelledAt: null, unavailable: false,
  completionEvidence: { evaluationVersion: 1, evaluatedAt: "2026-09-19T03:00:00Z", observationCapturedAt: "2026-09-19T02:59:00Z", observationRevision: "b".repeat(64), baselineRevision: "a".repeat(64), source: "wahlap", provenance: { source: "wahlap", account: "fixture", topology: "single", marker: "2", observedAt: "2026-09-19T02:58:00Z", contentHash: "c".repeat(64) }, result: { goalType: "fc", before: 0, after: 1, delta: 1, facts: { fullComboCnt: 1 } } }
});

test("completed Goal remains a separate observation-time fact", () => {
  const fact = projectGoalFact(7, 9, completedGoal())!;
  assert.equal(fact.type, "goal-completed");
  assert.equal(fact.temporal.attributedDay, null);
  assert.equal(fact.temporal.occurredAt, null);
  assert.equal(fact.temporal.confirmedAt, "2026-09-19T03:00:00Z");
  assert.equal(fact.temporal.precision, "observation");
  assert.equal(fact.factKey, goalFactKey("9", "42", "b".repeat(64)));
  assert.equal(projectGoalFact(7, 9, { ...completedGoal(), status: "cancelled" }), null);
  assert.deepEqual(sortGrowthFacts([fact, { ...fact, factKey: "a", id: "a" }]).map(item => item.factKey), ["a", fact.factKey]);
});

test("history range defaults to 30 days and rejects unbounded or ambiguous input", () => {
  const now = new Date("2026-09-19T12:00:00+08:00");
  assert.deepEqual(resolveGrowthHistoryRange({}, now), { from: "2026-08-21", to: "2026-09-19", days: 30, fromUtc: "2026-08-20T16:00:00.000Z", toExclusiveUtc: "2026-09-19T16:00:00.000Z" });
  assert.equal(resolveGrowthHistoryRange({ days: "90" }, now).days, 90);
  assert.throws(() => resolveGrowthHistoryRange({ days: "91" }, now));
  assert.throws(() => resolveGrowthHistoryRange({ days: "7", from: "2026-09-01" }, now));
  assert.throws(() => resolveGrowthHistoryRange({ from: "2026-02-30", to: "2026-03-01" }, now));
  assert.throws(() => resolveGrowthHistoryRange({ bindingId: "2" }, now));
});
