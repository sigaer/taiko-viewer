import { appendFileSync, openSync, fsyncSync, closeSync, readFileSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import { importGrowthModule } from "./growth-module-loader.mjs";
import { prepareFixture } from "./growth-benchmark-fixtures.mjs";
const [mode, out, variant = "after"] = process.argv.slice(2);
const fd = openSync(`${out}/${mode}-${variant}.stages.jsonl`, "ax", 0o600);
const group = `/sys/fs/cgroup${readFileSync("/proc/self/cgroup", "utf8").trim().split("\n").find(line => line.startsWith("0::")).slice(3)}`;
const readResource = name => { try { return readFileSync(`${group}/${name}`, "utf8").trim(); } catch { return "unknown"; } };
const eventCounters = text => text === "unknown" ? "unknown" : Object.fromEntries(text.split("\n").map(line => { const [key, value] = line.split(/\s+/); return [key, Number(value)]; }));
const initialEvents = eventCounters(readResource("memory.events"));
const started = performance.now();
let metadata = { availableFiles: 0, selectedFiles: 0, loadedFiles: 0, invalidFiles: 0, eligibleFiles: 0, selectedFileBytes: 0, chartVisits: 0, factCount: 0, truncated: false };
const emit = (stage, status, wallMs, extra = {}) => {
  const event = { stage, status, wallMs: +wallMs.toFixed(2), elapsedMs: +(performance.now() - started).toFixed(2), ...metadata,
    processMaxRssBytes: process.resourceUsage().maxRSS * 1024, processMaxRssKind: "OS high-water mark",
    processFsReadOperations: process.resourceUsage().fsRead, processFsWriteOperations: process.resourceUsage().fsWrite,
    cgroup: { memoryCurrent: readResource("memory.current"), memoryPeak: readResource("memory.peak"), memoryHigh: readResource("memory.high"),
      memoryEventsDelta: (() => { const counters = eventCounters(readResource("memory.events")); return counters === "unknown" || initialEvents === "unknown" ? "unknown" : Object.fromEntries(Object.keys(counters).map(key => [key, counters[key] - (initialEvents[key] || 0)])); })(),
      memoryPressure: readResource("memory.pressure"), ioPressure: readResource("io.pressure"), ioStat: readResource("io.stat") }, ...extra };
  appendFileSync(fd, JSON.stringify(event) + "\n"); fsyncSync(fd);
};
let fixture;
try {
  fixture = await prepareFixture(mode, out);
  emit("fixture-preparation", "complete", performance.now() - started, { privateData: mode === "real" ? "readonly; aggregate metrics only" : "synthetic" });
  let fileStart = 0, parsedAt = 0, enumerationStarted = 0, enumerationMs = 0, loadMs = 0, normalizeMs = 0, attempted = 0, observationsSeen = 0;
  const hooks = {
    enumerated(available, selected) {
      metadata.availableFiles = available; metadata.selectedFiles = selected; metadata.truncated = available > selected;
      enumerationMs = performance.now() - enumerationStarted;
      emit("enumeration-sort-limit", "complete", enumerationMs);
      emit("history-loading", "running", 0); emit("provenance-chronology-calendar", "running", 0, { execution: "interleaved with loading in actual production loader" });
    },
    fileStart() { fileStart = performance.now(); parsedAt = 0; },
    rawRead(bytes) { metadata.selectedFileBytes += bytes; },
    parsed(charts) { parsedAt = performance.now(); loadMs += parsedAt - fileStart; metadata.chartVisits += charts; },
    fileDone(valid, invalid, observationCount, level) {
      const now = performance.now(); if (parsedAt) normalizeMs += now - parsedAt; else loadMs += now - fileStart;
      metadata.loadedFiles = valid; metadata.invalidFiles = invalid;
      if (observationCount > observationsSeen && level === "L1") metadata.eligibleFiles++;
      observationsSeen = observationCount;
      attempted++;
      if (attempted % 100 === 0) emit("history-progress", "running", now - enumerationStarted, { attemptedFiles: attempted });
    },
    loaded(valid, invalid) { metadata.loadedFiles = valid; metadata.invalidFiles = invalid; }
  };
  const evidenceModule = await importGrowthModule("server/services/growth-history/evidence.ts", { userdataDir: fixture.userdataDir, before: variant === "before", hooks });
  const daily = await importGrowthModule("utils/dailyProgress.ts", { before: variant === "before" });
  const history = await importGrowthModule("utils/growthHistory.ts", { before: variant === "before" });
  const composer = await importGrowthModule("server/services/growth-passport/composer.ts", { before: variant === "before" });
  const calendar = await importGrowthModule("utils/playerGrowth.ts", { before: variant === "before" });
  const pipelineStarted = performance.now(); enumerationStarted = performance.now();
  const evidence = await evidenceModule.loadGrowthScoreEvidence(fixture.id);
  const totalLoaderMs = performance.now() - enumerationStarted;
  metadata.eligibleFiles = evidence.observations.filter(o => o.evidenceLevel === "L1").length;
  emit("history-loading", "complete", loadMs, { timingKind: "sum of exclusive read+parse intervals; interleaved loader" });
  emit("provenance-chronology-calendar", "complete", totalLoaderMs - loadMs - enumerationMs, { interleavedNormalizeMs: +normalizeMs.toFixed(2), loaderTotalMs: +totalLoaderMs.toFixed(2), includesCheckpointOverhead: true });
  const to = evidence.toDay || "2026-10-08", from = new Date(Date.parse(`${to}T00:00:00Z`) - 364 * 86400000).toISOString().slice(0, 10);
  const baseline = evidence.snapshots.some(s => s.full && calendar.growthCalendarDay(s.timestamp) <= from);
  const coverage = !evidence.snapshots.length ? "unknown" : evidence.truncated ? "truncated" : baseline && !evidence.invalidFiles ? "complete" : "partial";
  const replay = (kind) => {
    const at = performance.now(); emit(`canonical-replay-${kind}`, "running", 0, { coverage });
    const days = daily.deriveProgressForRange(fixture.current, evidence.snapshots, from, to, () => "redacted");
    const replayMs = performance.now() - at;
    emit(`canonical-replay-${kind}`, "complete", replayMs, { dayCount: days.length, coverage });
    return { days, replayMs };
  };
  const cold = replay("cold");
  let at = performance.now();
  const facts = history.projectScoreFacts(1, 1, cold.days);
  // No DB access: persisted Goal rows and measurements are not available in a readonly raw-score benchmark.
  metadata.factCount = facts.length;
  const factsDigest = createHash("sha256").update(JSON.stringify(facts)).digest("hex");
  emit("score-goal-projection", "complete", performance.now() - at, { factsDigest, goalFixtureCount: 0, productionGoalSql: "not executed", coverage });
  at = performance.now();
  const dictionary = {}, periods = {};
  for (const days of [30, 90, 180, 365]) {
    const periodFrom = new Date(Date.parse(`${to}T00:00:00Z`) - (days - 1) * 86400000).toISOString().slice(0, 10);
    // Cost probe uses existing canonical composer; this deliberately does not implement Temporal curation.
    const selected = composer.buildSkillPassportMilestones(facts.filter(f => f.temporal.attributedDay >= periodFrom && f.temporal.attributedDay <= to));
    for (const item of selected) dictionary[item.id] = item;
    periods[days] = { from: periodFrom, to, coverage, milestoneIds: selected.map(item => item.id) };
  }
  const compositionMs = performance.now() - at;
  emit("offline-period-curation", "complete", compositionMs, { candidateFacts: facts.length, selectedMilestones: Object.keys(dictionary).length, curation: "existing latest-8 composer, offline probe; proposed importance/diversity/bucket design remains unimplemented" });
  at = performance.now();
  const dto = { historicalCoverage: { state: coverage, from: evidence.fromDay, to: evidence.toDay }, measurementSeries: [], milestoneDictionary: dictionary, periodViews: periods };
  const selectedDtoBytes = Buffer.byteLength(JSON.stringify(dto));
  const serializationMs = performance.now() - at;
  const pipelineMs = performance.now() - pipelineStarted;
  emit("selected-payload-serialization", "complete", serializationMs, { selectedDtoBytes, dtoScope: "score milestone probe only; excludes current, real measurement series, focus and next action" });
  at = performance.now(); const rawFactBytes = Buffer.byteLength(JSON.stringify(facts));
  emit("raw-facts-byte-diagnostic", "complete", performance.now() - at, { rawFactBytes, sentToFrontend: false });
  const warm = replay("warm");
  const warmFacts = history.projectScoreFacts(1, 1, warm.days);
  const warmDigest = createHash("sha256").update(JSON.stringify(warmFacts)).digest("hex");
  if (factsDigest !== warmDigest) throw new Error("Warm replay fact digest mismatch");
  const budget = JSON.parse(await readFile(new URL("./growth-benchmark-budget.json", import.meta.url), "utf8"));
  const violations = [];
  if (pipelineMs > budget.historyPipelineMs) violations.push("history latency");
  if (compositionMs >= budget.compositionMs) violations.push("composition latency");
  if (process.resourceUsage().maxRSS * 1024 > budget.processMaxRssBytes) violations.push("process RSS");
  if (metadata.selectedFileBytes > budget.selectedFileBytes) violations.push("file bytes");
  emit("finish", "complete", performance.now() - started, { coverage, loaderTotalMs: +totalLoaderMs.toFixed(2), pipelineMs: +pipelineMs.toFixed(2), compositionMs: +compositionMs.toFixed(2), selectedDtoBytes, rawFactBytes, factsDigest, warmFactsEqual: true, violations, gate: "cost probe only; full Passport gate not inferred" });
} catch (error) {
  emit("finish", "failed", performance.now() - started, { reason: error instanceof Error ? error.name : "unknown error" });
  process.exitCode = 1;
} finally {
  if (fixture?.owned) await rm(fixture.userdataDir, { recursive: true, force: true });
  closeSync(fd);
}
