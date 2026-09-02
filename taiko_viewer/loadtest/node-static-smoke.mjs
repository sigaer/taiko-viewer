#!/usr/bin/env node
import http from "node:http";
import https from "node:https";
import { writeFile } from "node:fs/promises";

const base = new URL(process.env.BASE || "http://127.0.0.1:3100");
const vus = Math.max(1, Number(process.env.VUS || 3));
const durationSeconds = Math.max(1, Number(process.env.DURATION || 30));
const intervalMs = Math.max(0, Number(process.env.REQUEST_INTERVAL_MS || 250));
const jitterMs = Math.max(0, Number(process.env.JITTER_MS || 50));
const warmupSeconds = Math.max(0, Number(process.env.WARMUP_SECONDS || 0));
const maxRps = Math.max(0, Number(process.env.MAX_RPS || 0));
const assets = String(process.env.ASSETS || "/_nuxt/Cnx4mmAK.js,/_nuxt/index.pyZ7quO9.css,/_nuxt/arG6RtbU.js,/optimized/logo-168.webp,/optimized/2026-autumn-800.webp,/optimized/nijiiro-2026-640.webp,/kantan.png,/futsuu.png,/muzukashii.png,/oni.png").split(",").map((item) => item.trim()).filter(Boolean);
const results = [];
const fetchAsset = (path) => new Promise((resolve) => {
  const started = performance.now(); const target = new URL(path, base); const client = target.protocol === "https:" ? https : http;
  const req = client.get(target, (res) => { let bytes = 0; res.on("data", (chunk) => { bytes += chunk.length; }); res.on("end", () => resolve({ path, status: res.statusCode || 0, ms: performance.now() - started, bytes, cacheControl: res.headers["cache-control"] || "", contentType: res.headers["content-type"] || "" })); });
  req.setTimeout(8000, () => req.destroy(new Error("timeout"))); req.on("error", (error) => resolve({ path, status: 0, ms: performance.now() - started, bytes: 0, cacheControl: "", contentType: "", error: error.message }));
});
const deadline = Date.now() + durationSeconds * 1000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pacingMs = maxRps > 0 ? Math.max(intervalMs, 1000 / maxRps) : intervalMs;
await sleep(warmupSeconds * 1000);
await Promise.all(Array.from({ length: vus }, async () => { while (Date.now() < deadline) { results.push(await fetchAsset(assets[Math.floor(Math.random() * assets.length)])); const delay = pacingMs + (jitterMs ? Math.floor(Math.random() * (jitterMs * 2 + 1)) - jitterMs : 0); if (delay > 0) await sleep(delay); } }));
const grouped = Object.fromEntries(assets.map((path) => { const rows = results.filter((item) => item.path === path); const times = rows.map((item) => item.ms).sort((a, b) => a - b); const p = (n) => times[Math.min(times.length - 1, Math.floor(n / 100 * times.length))] || 0; return [path, { requests: rows.length, status: Object.fromEntries([...new Set(rows.map((item) => item.status))].map((code) => [code, rows.filter((item) => item.status === code).length])), p95: p(95), p99: p(99), avg: times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0, max: times.at(-1) || 0, bytes: rows.reduce((sum, item) => sum + item.bytes, 0), cacheControl: rows.at(-1)?.cacheControl || "", contentType: rows.at(-1)?.contentType || "" }]; }));
const result = { base: base.origin, vus, durationSeconds, totalRequests: results.length, resources: grouped, highlighted404: results.filter((item) => item.status === 404).length, highlighted5xx: results.filter((item) => item.status >= 500).length };
console.log(JSON.stringify(result, null, 2));
if (process.env.OUTPUT_JSON) await writeFile(process.env.OUTPUT_JSON, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
console.log(`node-static-smoke: ${result.totalRequests} requests, 404=${result.highlighted404}, 5xx=${result.highlighted5xx}`);
if (result.highlighted404 || result.highlighted5xx) process.exitCode = 2;
