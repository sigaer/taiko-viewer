// Song library acceptance against a production Nitro output (Linux). Started only by
//   scripts/rework/shell-sql.mjs --allow-test-db-mutation --output=<isolated .output> --check=catalog
// which owns the private empty MySQL, the vault paths and the opt-in. Same conventions as shell-check.mjs:
// synthetic public data only, loopback only, one browser, everything closed in finally.
import assert from "node:assert/strict";
import { mkdir, writeFile, realpath, open, utimes } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import mysql from "mysql2/promise";
import { chromium } from "playwright-core";
import { buildDataset, rawHttpChecks, runScenarios, ssrFailureCheck } from "./catalog-scenarios.mjs";

const web = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const output = process.argv[2];
assert.ok(output?.startsWith("/var/tmp/"));
assert.ok(process.env.QA_RUN_TMPDIR && process.env.QA_EVIDENCE_DIR);
const data = resolve(process.env.QA_RUN_TMPDIR, "viewer-catalog");
const out = process.env.QA_EVIDENCE_DIR;
await mkdir(data, { recursive: true });
for (const dir of ["userdata", "cache", "annual", "viewer-cache", "songs"]) await mkdir(data + "/" + dir, { recursive: true });
await writeFile(data + "/config.json", "{}");
await writeFile(data + "/songs/rating_structured_with_ids.json", "[]");
await writeFile(data + "/songs/song_alias.json", "{}");
const dataset = buildDataset();
const catalog = data + "/catalog.json";
const writeSongs = async (content, offsetMs) => {
  await writeFile(catalog, content);
  const when = new Date(Date.now() + offsetMs);
  await utimes(catalog, when, when);
};
await writeSongs(JSON.stringify(dataset), 0);

// Same empty-database guard as shell-check.mjs; only the schema the shell's session lookup reads.
assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION, "1");
const db = await mysql.createConnection(
  Object.fromEntries([
    ["host", process.env.TAIKO_DB_HOST],
    ["port", Number(process.env.TAIKO_DB_PORT)],
    ["user", process.env.TAIKO_DB_USER],
    ["password", process.env.TAIKO_DB_PASSWORD],
    ["database", process.env.TAIKO_DB_NAME]
  ])
);
try {
  const [[proof]] = await db.query("SELECT DATABASE() name,@@datadir dir");
  assert.ok(proof.name.endsWith("_test"));
  assert.equal(await realpath(proof.dir), await realpath(process.env.TAIKO_TEST_MYSQL_DATADIR));
  const { CREATE_FORUM_TABLES } = await import("../../server/utils/forum-schema-definition.ts");
  for (const sql of CREATE_FORUM_TABLES) await db.execute(sql);
  const { ACCOUNT_TITLE_TABLE_SQL } = await import("../../server/services/account-titles/schema.ts");
  await db.execute(ACCOUNT_TITLE_TABLE_SQL);
} finally {
  await db.end();
}

const port = 35324;
const base = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  NODE_ENV: "production",
  NODE_OPTIONS: "--max-old-space-size=512 --import " + web + "/scripts/ds/no-egress.mjs",
  NITRO_HOST: "127.0.0.1",
  NITRO_PORT: String(port),
  NUXT_ANNUAL_STARTUP_MODE: "owned-qa",
  NUXT_REPO_ROOT: data,
  NUXT_USERDATA_DIR: data + "/userdata",
  NUXT_TAIKO_CONFIG_PATH: data + "/config.json",
  NUXT_ACCOUNT_CACHE_DIR: data + "/cache",
  NUXT_ANNUAL_CACHE_DIR: data + "/annual",
  NUXT_VIEWER_CACHE_DIR: data + "/viewer-cache",
  NUXT_SONG_DATA_PATH: catalog,
  TAIKO_RUNTIME_ENV_FILE: data + "/absent.env",
  NUXT_PUBLIC_GOOGLE_ANALYTICS_ID: "",
  NUXT_TAIKO_API_BASE: "http://127.0.0.1:1",
  NUXT_TAIKO_TITLE_API_BASE: "http://127.0.0.1:1",
  NUXT_TAIKO_ADMIN_API_BASE: "http://127.0.0.1:1",
  NUXT_VIEWER_ACCESS_LOG_PATH: data + "/access.log"
};
for (const prefix of ["NUXT_DB_", "NUXT_BOT_DB_"])
  for (const suffix of ["HOST", "PORT", "USER", "PASSWORD", "NAME"]) env[prefix + suffix] = process.env["TAIKO_DB_" + suffix];
const log = await open(out + "/catalog-nitro.log", "w");
const server = spawn(process.execPath, [output + "/server/index.mjs"], { cwd: data, env, stdio: ["ignore", log.fd, log.fd] });
await log.close();
let browser;
const report = { kind: "acceptance: production Nitro, private test MySQL, synthetic catalog", database: process.env.TAIKO_DB_NAME, productionNetwork: false };
const timer = setTimeout(() => {
  report.timedOut = true;
  browser?.close().catch(() => {});
  server.kill("SIGTERM");
}, 600000);
try {
  let ready = false;
  for (let i = 0; i < 100 && !ready; i++) {
    if (server.exitCode !== null) throw Error("Nitro exited");
    try {
      ready = (await fetch(base + "/api/content/songs?view=list&page=1")).ok;
    } catch {}
    if (!ready) await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(ready);
  report.http = await rawHttpChecks(base);
  browser = await chromium.launch({
    headless: true,
    executablePath: "/root/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell"
  });
  report.ssrFailure = await ssrFailureCheck({
    browser,
    base,
    out,
    dataset,
    label: "acceptance",
    breakData: () => writeSongs("not json", 2000),
    restoreData: () => writeSongs(JSON.stringify(dataset), 4000)
  });
  Object.assign(report, await runScenarios({ browser, base, out, dataset, web, label: "acceptance" }));
} catch (e) {
  report.error = String(e.message).slice(0, 500);
} finally {
  clearTimeout(timer);
  await browser?.close();
  server.kill("SIGTERM");
  await new Promise((r) => {
    if (server.exitCode !== null) return r();
    const timeout = setTimeout(() => server.kill("SIGKILL"), 5000);
    server.once("close", () => {
      clearTimeout(timeout);
      r();
    });
  });
  await writeFile(out + "/catalog-result.json", JSON.stringify(report, null, 2));
}
const failed = Boolean(report.error) || (report.http || []).some((x) => !x.pass) || report.ssrFailure?.pass === false || report.passed !== report.total;
console.log(JSON.stringify({ http: report.http?.length, ssrFailure: report.ssrFailure?.pass, scenarios: `${report.passed}/${report.total}`, timings: report.timings, error: report.error }));
if (failed) process.exitCode = 1;
