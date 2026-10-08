// Passive production observation only. No account API requests, DB or private payload output.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { totalmem, cpus } from "node:os";
const out = process.argv[2];
if (!out?.startsWith("/var/tmp/")) throw new Error("Require a disk-backed /var/tmp output directory");
await mkdir(out, { recursive: true, mode: 0o700 });
const properties = execFileSync("/usr/bin/systemctl", ["show", "taiko-viewer.service", "-p", "ControlGroup", "-p", "MemoryCurrent", "-p", "MemoryHigh", "-p", "MemoryMax", "-p", "CPUQuotaPerSecUSec"], { encoding: "utf8", timeout: 5000, maxBuffer: 16384 });
const service = Object.fromEntries(properties.trim().split("\n").map(line => line.split("=")));
const read = async path => readFile(path, "utf8").then(s => s.trim()).catch(() => "unknown");
const group = `/sys/fs/cgroup${service.ControlGroup}`;
const report = { capturedAt: new Date().toISOString(), physicalMemoryBytes: totalmem(), cpuCount: cpus().length, service,
  hostMemoryPressure: await read("/proc/pressure/memory"), hostIoPressure: await read("/proc/pressure/io"),
  serviceMemoryEvents: await read(`${group}/memory.events`), serviceMemoryPeak: await read(`${group}/memory.peak`),
  serviceMemoryPressure: await read(`${group}/memory.pressure`), serviceIoPressure: await read(`${group}/io.pressure`),
  publicHttp: [], authenticatedBaseline: { kind: "passive production logs", window: "last 7 days, at most 4000 journal lines", home: {}, passport: {} } };
for (const route of ["/", "/my/growth", "/more"]) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    const response = await fetch(`https://viewer.sakura-bot.cn${route}`, { signal: AbortSignal.timeout(15000) });
    const html = await response.text();
    if (html.length > 1024 * 1024) throw new Error("Unexpected public response size");
    samples.push({ status: response.status, wallMs: +(performance.now() - start).toFixed(2), bytes: Buffer.byteLength(html), version0800: /v0\.80\.0/.test(html) });
  }
  report.publicHttp.push({ route, authentication: "anonymous; does not measure authenticated Growth compute or visible time", samples });
}
const logs = execFileSync("/usr/bin/journalctl", ["-u", "taiko-viewer.service", "--since", "7 days ago", "-n", "4000", "-o", "cat", "--no-pager"], { encoding: "utf8", timeout: 5000, maxBuffer: 4 * 1024 * 1024 });
for (const [kind, pattern, keys] of [
  ["home", /\[player-growth\] overview timing \{\n([\s\S]*?)^\}/gm, ["totalDurationMs", "pythonDurationMs", "progressDurationMs"]],
  ["passport", /\[growth-passport\] compose \{\n([\s\S]*?)^\}/gm, ["totalDurationMs", "overviewDurationMs", "recentHistoryMs", "measurementQueryMs", "responseBytes"]]
]) {
  const blocks = [...logs.matchAll(pattern)].map(m => m[1]);
  const metrics = {};
  for (const key of keys) {
    const values = blocks.map(block => Number(block.match(new RegExp(`${key}: (\\d+)`))?.[1])).filter(Number.isFinite).sort((a, b) => a - b);
    metrics[key] = values.length ? { count: values.length, min: values[0], p50: values[Math.floor((values.length - 1) * .5)], p95: values[Math.floor((values.length - 1) * .95)], max: values.at(-1) } : "unknown";
  }
  report.authenticatedBaseline[kind] = { count: blocks.length, metrics };
}
await writeFile(`${out}/resource-baseline.json`, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
console.log(JSON.stringify(report));
