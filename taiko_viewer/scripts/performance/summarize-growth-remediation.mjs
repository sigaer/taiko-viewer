// Aggregate-only report: never opens userdata, DB, credentials or private payloads.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const [root, destination] = process.argv.slice(2);
if (!root?.startsWith("/var/tmp/") || !destination) throw new Error("Require artifacts directory and report destination");
const json = async path => JSON.parse(await readFile(path, "utf8"));
const reduce = result => ({
  mode: result.mode, variant: result.variant, exit: result.exit, reason: result.reason,
  lastCompletedStage: result.lastCompletedStage, finish: result.finish,
  processMaxRssBytes: result.processMaxRssBytes, unfinishedProcessMaxRssSoFarBytes: result.unfinishedProcessMaxRssSoFarBytes,
  cgroupMemoryPeakBytes: result.cgroupMemoryPeakBytes, cgroupCurrentMaxSampleBytes: result.cgroupCurrentMaxSampleBytes,
  cgroupMemoryPeakScope: "whole isolated QA service; kernel memory.peak is unavailable on this host",
  memoryEventsDelta: result.memoryEventsDelta, memoryPsiFullAvg10Max: result.memoryPsiFullAvg10Max, ioPsiFullAvg10Max: result.ioPsiFullAvg10Max,
  memoryPsiFullTotalDeltaUs: result.memoryPsiFullTotalDeltaUs, ioPsiFullTotalDeltaUs: result.ioPsiFullTotalDeltaUs,
  ioStatBefore: result.before.ioStat, ioStatAfter: result.after.ioStat,
  stages: result.stages.filter(s => s.status === "complete" || s.stage === "finish")
});
const primary = await json(`${root}/matrix-final/summary-after.json`);
const ordinary = await json(`${root}/prototype-ordinary-final/summary-after.json`);
const streaming = await json(`${root}/stream-v1/summary-streaming.json`);
for (const original of ordinary.results) {
  const stream = streaming.results.find(s => s.mode === original.mode);
  assert.equal(stream.finish.factsDigest, original.finish.factsDigest, `${original.mode} streaming full fact digest mismatch`);
  assert.equal(stream.finish.selectedDtoBytes, original.finish.selectedDtoBytes, `${original.mode} streaming selected DTO byte count mismatch`);
}
const repeatedReal = [];
for (let trial = 1; trial <= 3; trial++) {
  for (const variant of ["before", "after"]) {
    const row = await json(`${root}/real-${variant}-${trial}/real-${variant}.result.json`);
    repeatedReal.push({ trial, ...reduce(row) });
  }
}
assert.equal(new Set(repeatedReal.map(r => r.finish.factsDigest)).size, 1, "Repeated real before/after canonical facts changed");
const tap = await readFile(`${root}/regression-final.tap`, "utf8");
assert.match(tap, /tests 275/); assert.match(tap, /fail 0/);
const watchdog = reduce(await json(`${root}/watchdog-final/watchdog-probe-after.result.json`));
assert.equal(watchdog.reason, "timeout"); assert.equal(watchdog.exit.signal, "SIGTERM");
assert.equal(watchdog.lastCompletedStage, "watchdog-probe-checkpoint"); assert.equal(watchdog.processMaxRssBytes, "unknown");
const report = { baselineCommit: "85859c4", canonicalVersion: "0.80.0", finalGate: "BLOCKED",
  budget: primary.budget, resourceBaseline: await json(`${root}/resource-baseline.json`),
  microbenchmarks: [await json(`${root}/calendar-before.json`), await json(`${root}/calendar-after.json`)],
  primaryMatrix: primary.results.map(reduce), repeatedReal, prototypeOrdinary: ordinary.results.map(reduce), streamingPrototype: streaming.results.map(reduce),
  streamingVsOrdinaryFullFactDigestsEqualForEachInput: true, realBeforeAfterFactDigestsEqual: true,
  regression: { tests: 275, pass: 275, fail: 0, goldenCalendarInputs: 43, frozenReplayFixtures: 17, timezoneRuns: ["UTC", "America/New_York"], pipelineParityCases: 5, streamingParityTests: 6, logDigest: createHash("sha256").update(tap).digest("hex") },
  watchdog, limits: ["Cold means a fresh process, not forced cold filesystem caches", "max RSS includes module adapter, fixture preparation and optional warm replay", "Cgroup memory.peak unknown is not replaced by a sampled maximum", "Selected DTO is an offline score milestone probe, not final Temporal Passport payload", "No authenticated online mutation, Python profiling, measurement SQL or UI implementation"] };
await writeFile(destination, JSON.stringify(report, null, 2) + "\n");
for (const result of primary.results) console.log(JSON.stringify({ mode: result.mode, loaderMs: result.finish.loaderTotalMs, replayMs: result.stages.find(s => s.stage === "canonical-replay-cold" && s.status === "complete")?.wallMs, pipelineMs: result.finish.pipelineMs, facts: result.finish.factCount, rawFactBytes: result.finish.rawFactBytes, selectedDtoBytes: result.finish.selectedDtoBytes, rssMiB: +(result.processMaxRssBytes / 1048576).toFixed(2), cgroupSampleMiB: +(result.cgroupCurrentMaxSampleBytes / 1048576).toFixed(2), memoryPsiMax: result.memoryPsiFullAvg10Max, ioPsiMax: result.ioPsiFullAvg10Max }));
console.log(JSON.stringify({ fullStreamingDigestsEqual: true, watchdog: "PASS", regression: report.regression, destination }));
