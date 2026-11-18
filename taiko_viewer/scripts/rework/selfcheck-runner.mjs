// Shared Windows development self-check runner for the rework slices. NOT acceptance.
// Starts its own `nuxt dev` on 127.0.0.1:<port> over a temporary data directory the slice fills, with unresolvable
// database hosts and the no-egress preload; one system Chrome; a total time limit; everything is stopped in finally
// and the port is checked free at the end. Only processes this runner started are stopped, by their recorded PIDs:
// the dev server tree (spawn pid) and the browser tree (launchServer pid, reported as report.browserPid). Never stop
// processes by name or command-line match (AGENTS.md memory rules). The slice supplies:
//   prepare(dataDir)            → { env?: extra environment, ...anything the run needs }   (writes synthetic files)
//   run({ base, browser, data, prepared, report, out })                                    (fills `report`)
//   summarize(report)           → { line: object for the console, failed: boolean }
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { openSync } from "node:fs";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

export const web = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const cliArg = (name) => process.argv.find((x) => x.startsWith(`--${name}=`))?.slice(name.length + 3);

const portBusy = (port) =>
  new Promise((done) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => (socket.destroy(), done(true)));
    socket.once("error", () => done(false));
  });

/** Environment every self-check dev server gets; `data` is the temporary data directory. */
export function baseEnv(data) {
  return {
    ...process.env,
    NODE_ENV: "development",
    NODE_OPTIONS: `--max-old-space-size=4096 --import ${new URL("../ds/no-egress.mjs", import.meta.url).href}`,
    TAIKO_DB_HOST: "invalid.invalid",
    METHOD_CALLS_DB_HOST: "invalid.invalid",
    TAIKO_REPO_ROOT: data,
    TAIKO_SONG_DATA_PATH: resolve(data, "song_data.json"),
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
}

export async function runSelfcheck({ name, defaultPort, defaultOut, label, limitMs = 25 * 60 * 1000, readyPath = "/api/content/songs?view=list&page=1", prepare, run, summarize }) {
  const port = Number(cliArg("port") || defaultPort);
  assert.ok(![3000, 3517, 3518, 3527, 3562].includes(port) && port > 1024, "use a private port");
  const out = resolve(cliArg("out") || defaultOut);
  const chrome = cliArg("chrome") || "C:/Program Files/Google/Chrome/Application/chrome.exe";
  const base = `http://127.0.0.1:${port}`;
  assert.equal(await portBusy(port), false, `port ${port} already in use`);
  await mkdir(out, { recursive: true });
  const data = await mkdtemp(resolve(tmpdir(), `taiko-${name}-selfcheck-`));
  let server;
  let browser;
  let browserServer;
  const report = { kind: "development self-check (nuxt dev, Windows); not acceptance", label, base, startedAt: new Date().toISOString() };
  const killPid = (pid) => {
    if (pid) spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
  };
  const killTree = () => {
    if (server?.pid && server.exitCode === null) killPid(server.pid);
  };
  const alive = (pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  const deadline = setTimeout(() => {
    report.timedOut = true;
    browser?.close().catch(() => {});
    killPid(report.browserPid);
    killTree();
  }, limitMs);
  let summary = { line: {}, failed: true };
  try {
    const prepared = (await prepare(data)) || {};
    const log = openSync(resolve(out, "nuxt-dev.log"), "w");
    server = spawn(process.execPath, [resolve(web, "node_modules/@nuxt/cli/bin/nuxi.mjs"), "dev", "--host", "127.0.0.1", "--port", String(port)], {
      cwd: web,
      env: { ...baseEnv(data), ...(prepared.env || {}) },
      stdio: ["ignore", log, log],
      windowsHide: true
    });
    let ready = false;
    for (let i = 0; i < 600 && !ready; i++) {
      if (server.exitCode !== null) throw new Error("nuxt dev exited");
      try {
        ready = (await fetch(base + readyPath, { signal: AbortSignal.timeout(5000) })).ok;
      } catch {}
      if (!ready) await new Promise((r) => setTimeout(r, 1000));
    }
    assert.ok(ready, "dev server ready");
    browserServer = await chromium.launchServer({ headless: true, executablePath: chrome });
    report.browserPid = browserServer.process()?.pid ?? null;
    browser = await chromium.connect(browserServer.wsEndpoint());
    await run({ base, browser, data, prepared, report, out });
  } catch (error) {
    report.error = String(error?.stack || error).slice(0, 1500);
    process.exitCode = 1;
  } finally {
    clearTimeout(deadline);
    await browser?.close().catch(() => {});
    await browserServer?.close().catch(() => {});
    if (report.browserPid && alive(report.browserPid)) killPid(report.browserPid);
    report.browserStoppedAfter = report.browserPid ? !alive(report.browserPid) : null;
    killTree();
    for (let i = 0; i < 30 && (await portBusy(port)); i++) await new Promise((r) => setTimeout(r, 500));
    report.portFreeAfter = !(await portBusy(port));
    report.finishedAt = new Date().toISOString();
    await rm(data, { recursive: true, force: true }).catch(() => {});
    await writeFile(resolve(out, `${label}.json`), JSON.stringify(report, null, 2));
    try {
      summary = summarize(report);
    } catch (error) {
      summary = { line: { summarizeError: String(error) }, failed: true };
    }
    console.log(JSON.stringify({ ...summary.line, portFreeAfter: report.portFreeAfter, browserStoppedAfter: report.browserStoppedAfter, error: report.error?.split("\n")[0] }));
    if (summary.failed || report.error || !report.portFreeAfter || report.browserStoppedAfter === false) process.exitCode = 1;
  }
}
