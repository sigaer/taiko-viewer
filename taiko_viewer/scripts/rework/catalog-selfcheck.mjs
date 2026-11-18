// Windows development self-check for the song library. NOT acceptance.
//   node scripts/rework/catalog-selfcheck.mjs --port=3561 --out=<dir> [--chrome=<exe>] [--stub]
// Starts its own `nuxt dev` on 127.0.0.1:<port> with the synthetic dataset as the song data file, unresolvable
// database hosts and the no-egress preload; one system Chrome, at most two pages, a total time limit; everything is
// stopped in finally (dev server process tree, browser) and the port is checked free at the end.
// Real here: legacy redirects as raw HTTP, SSR of /songs when the API fails, and the list API over the synthetic
// file. Client-side failures are injected by intercepting browser requests; --stub answers every browser
// /api/content/songs request from serveCatalog() instead of the dev server.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { buildDataset, rawHttpChecks, runScenarios, ssrFailureCheck } from "./catalog-scenarios.mjs";

const web = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const arg = (name) => process.argv.find((x) => x.startsWith(`--${name}=`))?.slice(name.length + 3);
const port = Number(arg("port") || 3561);
assert.ok(![3000, 3517, 3518, 3527].includes(port) && port > 1024, "use a private port");
const out = resolve(arg("out") || "catalog-selfcheck");
const chrome = arg("chrome") || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const stub = process.argv.includes("--stub");
const label = stub ? "stubbed-http-selfcheck" : "stubbed-data-selfcheck";
const base = `http://127.0.0.1:${port}`;
const LIMIT_MS = 25 * 60 * 1000;

const portBusy = () =>
  new Promise((done) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => (socket.destroy(), done(true)));
    socket.once("error", () => done(false));
  });
assert.equal(await portBusy(), false, `port ${port} already in use`);
await mkdir(out, { recursive: true });
const data = await mkdtemp(resolve(tmpdir(), "taiko-catalog-selfcheck-"));
const dataset = buildDataset();
const songFile = resolve(data, "song_data.json");
const writeSongs = async (content, offsetMs) => {
  await writeFile(songFile, content);
  const when = new Date(Date.now() + offsetMs);
  await utimes(songFile, when, when);
};
await writeSongs(JSON.stringify(dataset), 0);
await writeFile(resolve(data, "rating.json"), JSON.stringify({ songs: [] }));
await writeFile(resolve(data, "branch_audio_manifest.json"), "{}");

let server;
let browser;
const report = { kind: "development self-check (nuxt dev, Windows); not acceptance", label, stub, base, startedAt: new Date().toISOString() };
const killTree = () => {
  if (server?.pid && server.exitCode === null) spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
};
const deadline = setTimeout(() => {
  report.timedOut = true;
  browser?.close().catch(() => {});
  killTree();
}, LIMIT_MS);
try {
  const env = {
    ...process.env,
    NODE_ENV: "development",
    NODE_OPTIONS: `--max-old-space-size=4096 --import ${new URL("../ds/no-egress.mjs", import.meta.url).href}`,
    TAIKO_DB_HOST: "invalid.invalid",
    METHOD_CALLS_DB_HOST: "invalid.invalid",
    TAIKO_REPO_ROOT: data,
    TAIKO_SONG_DATA_PATH: songFile,
    TAIKO_RATING_STRUCT_PATH: resolve(data, "rating.json"),
    TAIKO_BRANCH_AUDIO_MANIFEST_PATH: resolve(data, "branch_audio_manifest.json"),
    TAIKO_USERDATA_DIR: resolve(data, "userdata"),
    TAIKO_VIEWER_CACHE_DIR: resolve(data, "viewer-cache"),
    TAIKO_ACCOUNT_CACHE_DIR: resolve(data, "account-cache"),
    TAIKO_ANNUAL_CACHE_DIR: resolve(data, "annual-cache"),
    VIEWER_ACCESS_LOG_PATH: resolve(data, "access.log"),
    TAIKO_API_BASE: "http://127.0.0.1:1",
    TAIKO_ADMIN_API_BASE: "http://127.0.0.1:1",
    TAIKO_TITLE_API_BASE: "http://127.0.0.1:1",
    NUXT_PUBLIC_GOOGLE_ANALYTICS_ID: ""
  };
  const { openSync } = await import("node:fs");
  const log = openSync(resolve(out, "nuxt-dev.log"), "w");
  server = spawn(process.execPath, [resolve(web, "node_modules/@nuxt/cli/bin/nuxi.mjs"), "dev", "--host", "127.0.0.1", "--port", String(port)], {
    cwd: web,
    env,
    stdio: ["ignore", log, log],
    windowsHide: true
  });
  let ready = false;
  for (let i = 0; i < 600 && !ready; i++) {
    if (server.exitCode !== null) throw new Error("nuxt dev exited");
    try {
      ready = (await fetch(base + "/api/content/songs?view=list&page=1", { signal: AbortSignal.timeout(5000) })).ok;
    } catch {}
    if (!ready) await new Promise((r) => setTimeout(r, 1000));
  }
  assert.ok(ready, "dev server ready");
  report.http = await rawHttpChecks(base);
  browser = await chromium.launch({ headless: true, executablePath: chrome });
  report.ssrFailure = await ssrFailureCheck({
    browser,
    base,
    out,
    dataset,
    label: "real-ssr-selfcheck",
    breakData: () => writeSongs("not json", 2000),
    restoreData: () => writeSongs(JSON.stringify(dataset), 4000)
  });
  Object.assign(report, await runScenarios({ browser, base, out, dataset, stub, web, label }));
} catch (error) {
  report.error = String(error?.stack || error).slice(0, 1000);
  process.exitCode = 1;
} finally {
  clearTimeout(deadline);
  await browser?.close().catch(() => {});
  killTree();
  for (let i = 0; i < 30 && (await portBusy()); i++) await new Promise((r) => setTimeout(r, 500));
  report.portFreeAfter = !(await portBusy());
  report.finishedAt = new Date().toISOString();
  await rm(data, { recursive: true, force: true }).catch(() => {});
  await writeFile(resolve(out, `${label}.json`), JSON.stringify(report, null, 2));
  const failedHttp = (report.http || []).filter((x) => !x.pass).length;
  const summary = {
    http: report.http ? `${report.http.length - failedHttp}/${report.http.length}` : "not run",
    ssrFailure: report.ssrFailure?.pass ?? "not run",
    scenarios: report.total ? `${report.passed}/${report.total}` : "not run",
    timings: report.timings,
    portFreeAfter: report.portFreeAfter,
    error: report.error?.split("\n")[0]
  };
  console.log(JSON.stringify(summary));
  if (failedHttp || report.ssrFailure?.pass === false || report.passed !== report.total) process.exitCode = 1;
}
