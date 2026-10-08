import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { importGrowthModule } from "../scripts/performance/growth-module-loader.mjs";
import { prepareFixture } from "../scripts/performance/growth-benchmark-fixtures.mjs";
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const dim = { big_song: 10, stamina: 10, speed: 10, accuracy_power: 10, rhythm: 10, complex: null };
const measurements = [
  ["9", "2026-10-07T15:59:59Z"], ["2", "2026-10-07T16:00:00Z"],
  ["10", "2026-10-07T16:00:00Z"], ["12", "2026-10-08T01:00:00+08:00"]
].map(([id, capturedAt]) => ({ id, capturedAt, ownerId: "1", bindingId: "1", scoreRevision: "fixture", measurementVersion: 1, algorithmVersion: "v1", modelRevision: "fixture", rating: 10, dimensions: dim, focus: "rhythm", sampleCount: 30, availabilityState: "ready" }));
const evaluate = async (fixture, before) => {
  const opts = { before, userdataDir: fixture.userdataDir };
  const evidence = await (await importGrowthModule("server/services/growth-history/evidence.ts", opts)).loadGrowthScoreEvidence(fixture.id);
  const daily = await importGrowthModule("utils/dailyProgress.ts", opts);
  const history = await importGrowthModule("utils/growthHistory.ts", opts);
  const passport = await importGrowthModule("server/services/growth-passport/composer.ts", opts);
  const weekly = await importGrowthModule("server/services/growth-weekly/composer.ts", opts);
  const recent = await importGrowthModule("server/services/growth-recent/boundary.ts", opts);
  const days = daily.deriveProgressForRange(fixture.current, evidence.snapshots, "2025-10-09", "2026-10-08", () => "synthetic");
  const facts = history.projectScoreFacts(1, 1, days);
  const pb = facts.find(f => f.type === "score-pb");
  const goal = history.projectGoalFact(1, 1, {
    id: "42", status: "completed", title: "synthetic", songId: pb?.songId || 1, difficultyType: 4, completedAt: "2026-10-08T05:00:00Z",
    completionEvidence: { observationRevision: pb?.evidence.sourceRevision || "fixture", evaluationVersion: 1, observationCapturedAt: "2026-10-07T16:00:00Z", provenance: { source: "wahlap" }, result: { goalType: "score-pb", before: pb?.before || 1, after: pb?.after || 2, delta: 1 } }
  });
  const unmatched = { ...goal, id: "unmatched", factKey: "unmatched", songId: 999, goalId: "43", evidence: { ...goal.evidence, sourceRevision: "unmatched" } };
  const allFacts = history.sortGrowthFacts([...facts, goal, unmatched]);
  const points = passport.sampleDailyGrowthMeasurements(measurements);
  const segments = passport.buildMeasurementSegments(points);
  const milestones = passport.buildSkillPassportMilestones(allFacts);
  const coverage = { truncated: evidence.truncated, invalidFiles: evidence.invalidFiles, from: evidence.fromDay, to: evidence.toDay, fullBaseline: evidence.snapshots.some(s => s.full) };
  return { evidence, coverage, days, daily: daily.deriveDailyProgress(fixture.current, evidence.snapshots, "2026-10-08", () => "synthetic"), facts: allFacts, points, segments,
    focus: passport.buildFocusTimeline(segments), milestones, goalLinks: weekly.attributeWeeklyGoals(allFacts, "2025-10-09", "2026-10-08"), recent: recent.selectRecentObservationWindow(evidence.observations, null) };
};
for (const mode of ["mixed", "no-baseline", "invalid", "boundary", "truncated"]) test(`actual loader, facts, Goal, measurements, Recent legacy parity: ${mode}`, async () => {
  const out = await mkdtemp("/var/tmp/growth-pipeline-parity-");
  try {
    const fixture = await prepareFixture(mode, out);
    const before = await evaluate(fixture, true), after = await evaluate(fixture, false);
    for (const key of Object.keys(before)) assert.equal(digest(after[key]), digest(before[key]), `${mode}: ${key} changed`);
    assert.equal(after.facts.filter(f => f.type === "goal-completed").every(f => f.temporal.attributedDay === null && f.temporal.occurredAt === null && f.temporal.confirmedAt !== f.temporal.observedAt), true);
    assert.deepEqual(after.points.map(p => p.id), ["9", "12"]);
    if (mode === "truncated") { assert.equal(after.evidence.totalFiles, 2001); assert.equal(after.evidence.filesRead, 2000); assert.equal(after.evidence.truncated, true); }
    if (mode === "invalid") assert.equal(after.evidence.invalidFiles, 2);
    if (mode === "no-baseline") assert.equal(after.coverage.fullBaseline, false);
  } finally { await rm(out, { recursive: true, force: true }); }
});
