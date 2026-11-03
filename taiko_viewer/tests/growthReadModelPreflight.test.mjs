// P1 writer-gate diagnostics, NOT a read-model implementation or live writer test.
// Reproduce audited operation boundaries on tiny synthetic /var/tmp files and
// execute the unmodified production loader/replay/projector. No DB or account API.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, readFile, rm, stat, utimes, unlink, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { importGrowthModule } from "../scripts/performance/growth-module-loader.mjs";

const digest = value => createHash("sha256").update(value).digest("hex");
const structureDigest = value => digest(JSON.stringify(value));
const report = [];
const started = performance.now();
const cgroup = (await readFile("/proc/self/cgroup", "utf8")).trim().split("\n").find(line => line.startsWith("0::"))?.slice(3);
if (!cgroup?.includes("development-qa.slice/taiko-qa-")) throw new Error("Run with scripts/memory/run_qa.sh");
const resource = async () => {
  const read = name => readFile(`/sys/fs/cgroup${cgroup}/${name}`, "utf8").then(value => value.trim()).catch(() => "unknown");
  return {
    currentBytes: await read("memory.current"), peakBytes: await read("memory.peak"),
    events: await read("memory.events"), memoryPressure: await read("memory.pressure"),
    ioPressure: await read("io.pressure"), ioStat: await read("io.stat")
  };
};
const beforeResource = await resource();
const song = (score = 100, at = "2026-10-08T00:00:00Z") => ({
  song_no: 1, level: 4, high_score: score, best_score_rank: 2,
  good_cnt: 80, ok_cnt: 10, ng_cnt: 10, combo_cnt: 50,
  stage_cnt: 1, clear_cnt: 0, full_combo_cnt: 0, dondaful_combo_cnt: 0,
  update_datetime: at, highscore_datetime: at
});
const snapshot = (row, at, full = true, source = "wahlap") => ({
  songs: [row], _meta: { full, ts: at, writer_source: source }
});
const firstName = "data_20261008_000000_000001.json";
const secondName = "data_20261008_010000_000001.json";
const baseline = snapshot(song(), "2026-10-08T00:00:00Z");
const appended = snapshot(song(200, "2026-10-08T01:00:00Z"), "2026-10-08T01:00:00Z");
const write = (fixture, name, payload) => writeFile(resolve(fixture.history, name), typeof payload === "string" ? payload : JSON.stringify(payload));
const evaluate = async (fixture, current = [], currentRevision = "", from = "2026-10-08", to = "2026-10-08", title = () => "Synthetic") => {
  const evidence = await fixture.loader.loadGrowthScoreEvidence("synthetic");
  const days = fixture.daily.deriveProgressForRange(current, evidence.snapshots, from, to, title, currentRevision);
  return { evidence, days, facts: fixture.historyModule.sortGrowthFacts(fixture.historyModule.projectScoreFacts(1, 1, days)) };
};
const diagnostic = (name, fn) => test(name, { timeout: 10000 }, async () => {
  const directory = await mkdtemp("/var/tmp/growth-read-model-preflight-");
  const fixture = { directory, history: resolve(directory, "synthetic") };
  const start = performance.now();
  try {
    await mkdir(fixture.history);
    const options = { userdataDir: directory };
    fixture.loader = await importGrowthModule("server/services/growth-history/evidence.ts", options);
    fixture.daily = await importGrowthModule("utils/dailyProgress.ts", options);
    fixture.historyModule = await importGrowthModule("utils/growthHistory.ts", options);
    const evidence = await fn(fixture);
    report.push({ name, result: "PASS", ms: +(performance.now() - start).toFixed(2), evidence });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

diagnostic("frozen full-field score fact and deterministic replay", async fixture => {
  await write(fixture, secondName, appended); // creation order must not control replay
  await write(fixture, firstName, baseline);
  const a = await evaluate(fixture), b = await evaluate(fixture);
  const key = "score-history:v1:1:2026-10-08:1:4:score-pb:100:200";
  const expected = [{
    id: key, factKey: key, ownerId: "1", bindingId: "1", type: "score-pb",
    title: "Synthetic", songId: 1, difficultyType: 4, before: 100, after: 200, delta: 100, goalId: null,
    evidence: { source: "score-history", sourceRevision: digest(JSON.stringify(appended)), evidenceVersion: 1, provenance: { snapshotKind: "full-snapshot" } },
    temporal: { attributedDay: "2026-10-08", occurredAt: "2026-10-08T01:00:00.000Z", observedAt: "2026-10-08T01:00:00.000Z", confirmedAt: null, precision: "instant" }
  }];
  assert.equal(structureDigest(a.facts), structureDigest(expected), "full-field frozen fact mismatch");
  assert.equal(structureDigest(b), structureDigest(a), "repeat replay changed");
  return { fullFieldDigest: structureDigest(expected), factCount: a.facts.length };
});

diagnostic("direct history overwrite exposes invalid JSON before completion", async fixture => {
  await write(fixture, firstName, baseline);
  const raw = JSON.stringify(appended);
  await write(fixture, secondName, raw.slice(0, raw.length / 2));
  const interrupted = await evaluate(fixture);
  assert.equal(interrupted.evidence.invalidFiles, 1);
  assert.equal(interrupted.evidence.filesRead, 2);
  assert.equal(interrupted.facts.some(fact => fact.type === "score-pb"), false);
  await write(fixture, secondName, raw);
  const complete = await evaluate(fixture);
  assert.equal(complete.evidence.invalidFiles, 0);
  assert.equal(complete.facts.some(fact => fact.type === "score-pb"), true);
  return { invalidDuringWrite: 1, invalidAfterWrite: 0, blocker: "no committed input generation" };
});

diagnostic("current publication before history cannot recover a missing PB", async fixture => {
  await write(fixture, firstName, baseline);
  const currentPath = resolve(fixture.directory, "syntheticdata.json");
  const temporary = `${currentPath}.tmp`;
  await writeFile(temporary, JSON.stringify(appended));
  await rename(temporary, currentPath);
  const current = JSON.parse(await readFile(currentPath, "utf8"));
  const interrupted = await evaluate(fixture, current.songs, "new-current");
  assert.equal(interrupted.evidence.invalidFiles, 0);
  assert.equal(interrupted.facts.some(fact => fact.type === "score-pb"), false);
  await write(fixture, secondName, appended);
  const complete = await evaluate(fixture, current.songs, "new-current");
  assert.equal(complete.facts.some(fact => fact.type === "score-pb"), true);
  return { parseErrorsDuringGap: 0, missingTransitionRecoverableFromCurrentAlone: false };
});

diagnostic("same size and preserved mtime do not prove unchanged history", async fixture => {
  await write(fixture, firstName, baseline);
  await write(fixture, secondName, appended);
  const path = resolve(fixture.history, secondName);
  const fixed = new Date("2026-10-08T02:00:00Z");
  await utimes(path, fixed, fixed);
  const before = await stat(path), a = await evaluate(fixture);
  const replacement = snapshot(song(300, "2026-10-08T01:00:00Z"), "2026-10-08T01:00:00Z");
  await write(fixture, secondName, replacement);
  await utimes(path, fixed, fixed);
  const after = await stat(path), b = await evaluate(fixture);
  assert.equal(before.size, after.size);
  assert.equal(before.mtimeMs, after.mtimeMs);
  assert.equal(a.evidence.totalFiles, b.evidence.totalFiles);
  assert.equal(a.evidence.observations[1].orderKey, b.evidence.observations[1].orderKey);
  assert.notEqual(a.evidence.observations[1].revision, b.evidence.observations[1].revision);
  assert.notEqual(structureDigest(a.facts), structureDigest(b.facts));
  return { statSignatureUnchanged: true, contentIdentityChanged: true, fullFactIdentityChanged: true };
});

diagnostic("destructive batch replacement can look valid while losing baseline", async fixture => {
  await write(fixture, firstName, baseline);
  await write(fixture, secondName, appended);
  await unlink(resolve(fixture.history, firstName));
  await unlink(resolve(fixture.history, secondName));
  const empty = await evaluate(fixture);
  assert.equal(empty.evidence.invalidFiles, 0);
  assert.equal(empty.evidence.totalFiles, 0);
  await write(fixture, secondName, appended);
  const partial = await evaluate(fixture);
  assert.equal(partial.evidence.invalidFiles, 0);
  assert.equal(partial.evidence.truncated, false);
  assert.equal(partial.facts.some(fact => fact.type === "score-pb"), false);
  await write(fixture, firstName, baseline);
  const complete = await evaluate(fixture);
  assert.equal(complete.facts.some(fact => fact.type === "score-pb"), true);
  return { emptyAndPartialBothParse: true, baselineGapChangesFacts: true };
});

diagnostic("old mutation changes later bestScores even across a full snapshot", async fixture => {
  await write(fixture, firstName, snapshot(song(300), "2026-10-08T00:00:00Z"));
  await write(fixture, secondName, appended);
  await write(fixture, "data_20261008_020000_000001.json", snapshot(song(250, "2026-10-08T02:00:00Z"), "2026-10-08T02:00:00Z"));
  const before = await evaluate(fixture);
  assert.equal(before.facts.some(fact => fact.type === "score-pb"), false);
  await write(fixture, firstName, baseline);
  const after = await evaluate(fixture);
  const pb = after.facts.find(fact => fact.type === "score-pb");
  assert.equal(pb.before, 100);
  assert.equal(pb.after, 250);
  assert.equal(pb.delta, 150);
  return { fullSnapshotDoesNotResetBestScores: true, oldMutationAffectsSuccessors: true };
});

diagnostic("current revision changes existing score evidence without a history append", async fixture => {
  await write(fixture, firstName, baseline);
  await write(fixture, secondName, appended);
  const a = await evaluate(fixture, appended.songs, "current-A");
  const b = await evaluate(fixture, appended.songs, "current-B");
  assert.equal(structureDigest(a.evidence), structureDigest(b.evidence));
  assert.equal(a.facts[0].factKey, b.facts[0].factKey);
  assert.equal(a.facts[0].evidence.sourceRevision, "current-A");
  assert.equal(b.facts[0].evidence.sourceRevision, "current-B");
  assert.notEqual(structureDigest(a.facts), structureDigest(b.facts));
  return { historyUnchanged: true, factsChanged: true, requiredInput: "current bytes/revision and attendance overlay" };
});

diagnostic("zero score changes still update observation provenance", async fixture => {
  await write(fixture, firstName, baseline);
  await write(fixture, secondName, appended);
  const before = await evaluate(fixture);
  await write(fixture, "data_20261008_020000_000001.json", snapshot(appended.songs[0], "2026-10-08T02:00:00Z"));
  const after = await evaluate(fixture);
  assert.equal(before.facts.length, after.facts.length);
  assert.equal(before.facts[0].factKey, after.facts[0].factKey);
  assert.equal(before.facts[0].temporal.observedAt, "2026-10-08T01:00:00.000Z");
  assert.equal(after.facts[0].temporal.observedAt, "2026-10-08T02:00:00.000Z");
  assert.notEqual(structureDigest(before.facts), structureDigest(after.facts));
  return { changedScoreRows: 0, factCountAndKeyUnchanged: true, fullFactChanged: true };
});

diagnostic("catalog titles are also canonical projection inputs", async fixture => {
  await write(fixture, firstName, baseline);
  await write(fixture, secondName, appended);
  const a = await evaluate(fixture), b = await evaluate(fixture, [], "", "2026-10-08", "2026-10-08", () => "Renamed");
  assert.equal(a.facts[0].factKey, b.facts[0].factKey);
  assert.notEqual(structureDigest(a.facts), structureDigest(b.facts));
  return { requiredInput: "catalog revision or query-time title projection" };
});

diagnostic("filename order differs from observation time; hash is identity only", async fixture => {
  await write(fixture, firstName, snapshot(song(100), "2026-10-08T02:00:00Z"));
  await write(fixture, secondName, appended);
  const a = await evaluate(fixture);
  assert.equal(a.evidence.snapshots[0].timestamp, "2026-10-08T02:00:00Z");
  assert.equal(a.evidence.observations[0].observedAt, "2026-10-08T01:00:00.000Z");
  assert.equal(a.facts[0].before, 100);
  assert.equal(a.facts[0].after, 200);
  return { replayOrder: "filename-time + filename", observationOrder: "observedAt + orderKey + revision" };
});

diagnostic("no-baseline delta and imports retain existing evidence rules", async fixture => {
  await write(fixture, secondName, { ...appended, _meta: { ...appended._meta, full: false, imported_via: "kinoko-history" } });
  const a = await evaluate(fixture);
  assert.equal(a.evidence.snapshots.some(item => item.full), false);
  assert.equal(a.evidence.observations[0].evidenceLevel, "L0");
  assert.equal(a.evidence.observations[0].excludedReason, "import");
  assert.equal(a.facts.some(fact => fact.type === "score-pb"), false);
  return { baseline: "missing", observationLevel: "L0", importNotPromoted: true };
});

diagnostic("future periods can filter shared canonical facts without replay changes", async fixture => {
  await write(fixture, firstName, baseline);
  await write(fixture, secondName, appended);
  const full = await evaluate(fixture, [], "", "2025-10-09", "2026-10-08");
  for (const count of [30, 90, 180, 365]) {
    const from = new Date(Date.parse("2026-10-08T00:00:00Z") - (count - 1) * 86400000).toISOString().slice(0, 10);
    const window = await evaluate(fixture, [], "", from, "2026-10-08");
    const selected = full.facts.filter(fact => fact.temporal.attributedDay >= from);
    assert.equal(structureDigest(window.facts), structureDigest(selected));
  }
  return { periods: [30, 90, 180, 365], scope: "tiny canonical sample, NOT read-model parity" };
});

test.after(async () => {
  const afterResource = await resource();
  const output = {
    kind: "P1 Phase 1 counterexamples; no read model built", canonicalCommit: "1dcf9c3",
    cases: report, durationMs: +(performance.now() - started).toFixed(2),
    processMaxRssBytes: process.resourceUsage().maxRSS * 1024, memory: process.memoryUsage(),
    beforeResource, afterResource
  };
  const path = "/var/tmp/taiko-bounded-qa/growth-read-model-preflight.json";
  await writeFile(path, JSON.stringify(output, null, 2) + "\n", { mode: 0o600 });
});
