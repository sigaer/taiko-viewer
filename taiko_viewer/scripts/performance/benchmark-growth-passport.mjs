#!/usr/bin/env node
// Must run inside scripts/memory/run_qa.sh. Parent stays responsive during synchronous replay.
import { spawn } from "node:child_process";
import { readFile, mkdir, rm, writeFile } from "node:fs/promises";
import { appendFileSync, openSync, fsyncSync, closeSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { fixtureCases } from "./growth-benchmark-fixtures.mjs";
const args = process.argv.slice(2), out = args[0];
if (!out?.startsWith("/var/tmp/")) throw new Error("Require /var/tmp output directory");
const variant = args.includes("--before") ? "before" : "after";
const watchdogProbe = args.includes("--watchdog-probe");
const modes = watchdogProbe ? ["watchdog-probe"] : args.slice(1).filter(arg => !arg.startsWith("--"));
for (const mode of modes) if (!fixtureCases.includes(mode) && mode !== "watchdog-probe") throw new Error("Unknown fixture mode");
const ownCgroup = (await readFile("/proc/self/cgroup", "utf8")).trim().split("\n").find(line => line.startsWith("0::"))?.slice(3);
if (!ownCgroup?.includes("development-qa.slice/taiko-qa-")) throw new Error("Require approved isolated QA launcher");
const group = `/sys/fs/cgroup${ownCgroup}`;
const budget = JSON.parse(await readFile(new URL("./growth-benchmark-budget.json", import.meta.url), "utf8"));
// Diagnostic termination test only: tighten the timeout, never loosen a Gate resource limit.
if (watchdogProbe) budget.watchdogTimeoutMs = 2000;
await mkdir(out, { recursive: true, mode: 0o700 });
const read = async path => readFile(path, "utf8").then(s => s.trim()).catch(() => "unknown");
const counters = text => text === "unknown" ? "unknown" : Object.fromEntries(text.split("\n").map(line => { const [k, v] = line.split(/\s+/); return [k, Number(v)]; }));
const pressure = text => text === "unknown" ? "unknown" : Object.fromEntries(text.split("\n").map(line => {
  const [kind, ...values] = line.split(" "); return [kind, Object.fromEntries(values.map(v => { const [k, value] = v.split("="); return [k, Number(value)]; }))];
}));
const resource = async () => ({
  memoryCurrent: await read(`${group}/memory.current`), memoryPeak: await read(`${group}/memory.peak`), memoryHigh: await read(`${group}/memory.high`),
  memoryEvents: counters(await read(`${group}/memory.events`)), memoryPressure: pressure(await read(`${group}/memory.pressure`)),
  ioPressure: pressure(await read(`${group}/io.pressure`)), ioStat: await read(`${group}/io.stat`)
});
const delta = (a, b) => a === "unknown" || b === "unknown" ? "unknown" : Object.fromEntries(Object.keys(b).map(k => [k, b[k] - (a[k] || 0)]));
const results = [];
for (const mode of modes.length ? modes : fixtureCases) {
  const before = await resource(), started = performance.now();
  const fd = openSync(`${out}/${mode}-${variant}.resources.jsonl`, "ax", 0o600);
  const persist = event => { appendFileSync(fd, JSON.stringify(event) + "\n"); fsyncSync(fd); };
  persist({ stage: "admission", budget, resource: before });
  const worker = watchdogProbe ? "../../tests/fixtures/growthWatchdogProbe.mjs" : "./growth-benchmark-worker.mjs";
  const child = spawn(process.execPath, ["--experimental-strip-types", fileURLToPath(new URL(worker, import.meta.url)), mode, out, variant], { stdio: ["ignore", "ignore", "ignore"], detached: true });
  let exited = false, reason = null, stopAt = null, lastProcessHwm = "unknown", maxCurrentSample = 0, maxPsi = { memory: "unknown", io: "unknown" }, pressureSince = null;
  const completion = new Promise(resolve => {
    child.once("error", () => { exited = true; reason = "spawn failure"; resolve({ code: null, signal: null }); });
    child.once("exit", (code, signal) => { exited = true; resolve({ code, signal }); });
  });
  const stop = why => {
    if (reason || exited) return;
    reason = why; stopAt = performance.now(); persist({ stage: "early-termination", reason, elapsedMs: +(performance.now() - started).toFixed(2) });
    try { process.kill(-child.pid, "SIGTERM"); } catch {}
  };
  const interrupt = () => stop("user interruption");
  process.on("SIGINT", interrupt); process.on("SIGTERM", interrupt);
  let lastPersist = 0;
  try {
    while (!exited) {
      const sample = await resource(), elapsed = performance.now() - started;
      const status = await read(`/proc/${child.pid}/status`);
      const hwm = status.match(/^VmHWM:\s+(\d+) kB/m)?.[1];
      if (hwm) lastProcessHwm = Number(hwm) * 1024;
      if (sample.memoryCurrent !== "unknown") maxCurrentSample = Math.max(maxCurrentSample, Number(sample.memoryCurrent));
      const memoryPsi = sample.memoryPressure?.full?.avg10, ioPsi = sample.ioPressure?.full?.avg10;
      if (Number.isFinite(memoryPsi)) maxPsi.memory = Math.max(Number(maxPsi.memory) || 0, memoryPsi);
      if (Number.isFinite(ioPsi)) maxPsi.io = Math.max(Number(maxPsi.io) || 0, ioPsi);
      const events = delta(before.memoryEvents, sample.memoryEvents);
      if (elapsed > budget.watchdogTimeoutMs) stop("timeout");
      else if (Number(lastProcessHwm) > budget.processMaxRssBytes) stop("process max RSS budget");
      else if (Number(sample.memoryCurrent) > budget.cgroupPeakBytes) stop("cgroup memory budget");
      else if (events !== "unknown" && (events.high > 0 || events.oom > 0 || events.oom_kill > 0)) stop("cgroup high/OOM pressure");
      if (memoryPsi >= budget.psiFullAvg10Percent || ioPsi >= budget.psiFullAvg10Percent) pressureSince ??= performance.now();
      else pressureSince = null;
      if (pressureSince && performance.now() - pressureSince >= budget.psiSustainedMs) stop("sustained PSI pressure");
      if (elapsed - lastPersist >= 1000) {
        persist({ stage: "resource-sample", elapsedMs: +elapsed.toFixed(2), processMaxRssSoFarBytes: lastProcessHwm, resource: sample }); lastPersist = elapsed;
      }
      if (stopAt && performance.now() - stopAt > 2000) { try { process.kill(-child.pid, "SIGKILL"); } catch {} }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const exit = await completion, after = await resource();
    const stageText = await read(`${out}/${mode}-${variant}.stages.jsonl`);
    const stages = []; let incompleteCheckpointLines = 0;
    for (const line of stageText === "unknown" ? [] : stageText.split("\n").filter(Boolean)) {
      try { stages.push(JSON.parse(line)); } catch { incompleteCheckpointLines++; }
    }
    const finish = stages.findLast(s => s.stage === "finish");
    const events = delta(before.memoryEvents, after.memoryEvents);
    const result = { mode, variant, exit, reason, incompleteCheckpointLines, lastCompletedStage: stages.findLast(s => s.status === "complete")?.stage || "unknown", finish: finish || null,
      processMaxRssBytes: finish?.processMaxRssBytes ?? "unknown", unfinishedProcessMaxRssSoFarBytes: finish ? null : lastProcessHwm,
      cgroupMemoryPeakBytes: after.memoryPeak === "unknown" ? "unknown" : Number(after.memoryPeak), cgroupCurrentMaxSampleBytes: maxCurrentSample,
      memoryEventsDelta: events, memoryPsiFullAvg10Max: maxPsi.memory, ioPsiFullAvg10Max: maxPsi.io,
      memoryPsiFullTotalDeltaUs: Number.isFinite(after.memoryPressure?.full?.total) && Number.isFinite(before.memoryPressure?.full?.total) ? after.memoryPressure.full.total - before.memoryPressure.full.total : "unknown",
      ioPsiFullTotalDeltaUs: Number.isFinite(after.ioPressure?.full?.total) && Number.isFinite(before.ioPressure?.full?.total) ? after.ioPressure.full.total - before.ioPressure.full.total : "unknown",
      before, after, stages };
    persist({ stage: "supervisor-finish", result: { ...result, stages: undefined } });
    await writeFile(`${out}/${mode}-${variant}.result.json`, JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
    results.push(result);
    console.log(JSON.stringify({ mode, variant, reason, lastCompletedStage: result.lastCompletedStage, pipelineMs: finish?.pipelineMs ?? "unknown", processMaxRssBytes: result.processMaxRssBytes, memoryEventsDelta: events }));
  } finally {
    process.off("SIGINT", interrupt); process.off("SIGTERM", interrupt);
    if (!exited) { try { process.kill(-child.pid, "SIGKILL"); } catch {} await completion; }
    // Synthetic artifacts only; never touch the real history directory.
    if (mode !== "real") await rm(`${out}/fixture-${mode}`, { recursive: true, force: true });
    closeSync(fd);
  }
}
await writeFile(`${out}/summary-${variant}.json`, JSON.stringify({ budget, results }, null, 2) + "\n", { mode: 0o600 });
// Evidence collection finishes all selected cases; nonzero means a measured budget/failure blocker.
if (results.some(r => r.reason || r.exit.code !== 0 || !r.finish || r.incompleteCheckpointLines > 0 || r.finish.violations?.length)) process.exitCode = 2;
