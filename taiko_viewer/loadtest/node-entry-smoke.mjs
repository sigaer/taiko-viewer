#!/usr/bin/env node
import http from "node:http";
import https from "node:https";
import { writeFile } from "node:fs/promises";

const base = new URL(process.env.BASE || "http://127.0.0.1:3100");
const vus = Math.max(1, Number(process.env.VUS || 3));
const durationSeconds = Math.max(1, Number(process.env.DURATION || 30));
const timeoutMs = Math.max(100, Number(process.env.TIMEOUT_MS || 8000));
const paths = String(process.env.PATHS || "/:/account/version-summary:/api/account/auth/me:/api/account/annual-summaries/annual_2026").split(/[:,]/).filter(Boolean);
const cookie = String(process.env.COOKIE || "").trim();
const intervalMs = Math.max(0, Number(process.env.REQUEST_INTERVAL_MS || 250));
const jitterMs = Math.max(0, Number(process.env.JITTER_MS || 50));
const warmupSeconds = Math.max(0, Number(process.env.WARMUP_SECONDS || 0));
const maxRps = Math.max(0, Number(process.env.MAX_RPS || 0));
const observations = [];
const request = (path) => new Promise((resolve) => {
  const started = performance.now();
  const target = new URL(path, base);
  const client = target.protocol === "https:" ? https : http;
  const req = client.request(target, { method: "GET", headers: cookie ? { Cookie: cookie } : {} }, (res) => {
    let bytes = 0;
    res.on("data", (chunk) => { bytes += chunk.length; });
    res.on("end", () => resolve({ path, status: res.statusCode || 0, ms: performance.now() - started, bytes, error: false }));
  });
  req.setTimeout(timeoutMs, () => req.destroy(new Error("timeout")));
  req.on("error", (error) => resolve({ path, status: 0, ms: performance.now() - started, bytes: 0, error: true, message: error.message }));
  req.end();
});

const deadline = Date.now() + durationSeconds * 1000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pacingMs = maxRps > 0 ? Math.max(intervalMs, 1000 / maxRps) : intervalMs;
await sleep(warmupSeconds * 1000);
await Promise.all(Array.from({ length: vus }, async () => { while (Date.now() < deadline) { observations.push(await request(paths[Math.floor(Math.random() * paths.length)])); const delay = pacingMs + (jitterMs ? Math.floor(Math.random() * (jitterMs * 2 + 1)) - jitterMs : 0); if (delay > 0) await sleep(delay); } }));
const durations = observations.map((item) => item.ms).sort((a, b) => a - b);
const percentile = (value) => durations.length ? durations[Math.min(durations.length - 1, Math.floor((value / 100) * durations.length))] : 0;
const status = Object.fromEntries([...new Set(observations.map((item) => item.status))].sort((a, b) => a - b).map((code) => [code, observations.filter((item) => item.status === code).length]));
const result = { base: base.origin, vus, durationSeconds, intervalMs, maxRps: maxRps || null, jitterMs, warmupSeconds, paths, cookieProvided: Boolean(cookie), totalRequests: observations.length, requestsPerSecond: observations.length / durationSeconds, status, counts: { 200: status[200] || 0, 302: status[302] || 0, 401: status[401] || 0, 403: status[403] || 0, 404: status[404] || 0, 429: status[429] || 0, "5xx": observations.filter((item) => item.status >= 500).length }, timingsMs: { min: durations[0] || 0, avg: durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : 0, p50: percentile(50), p95: percentile(95), p99: percentile(99), max: durations.at(-1) || 0 }, errorCount: observations.filter((item) => item.error || item.status >= 500).length, expectedAuthStatuses: observations.filter((item) => [401, 403].includes(item.status)).length };
console.log(JSON.stringify(result, null, 2));
if (process.env.OUTPUT_JSON) await writeFile(process.env.OUTPUT_JSON, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
console.log(`node-entry-smoke: ${result.totalRequests} requests, ${result.requestsPerSecond.toFixed(1)} req/s, p95=${result.timingsMs.p95.toFixed(1)}ms, p99=${result.timingsMs.p99.toFixed(1)}ms, errors=${result.errorCount}`);
if (result.counts[404] || result.counts["5xx"]) process.exitCode = 2;
