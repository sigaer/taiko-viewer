#!/usr/bin/env node
import assert from "node:assert/strict";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import { chromium } from "playwright-core";

for (const key of ["TAIKO_DB_HOST", "TAIKO_DB_USER", "TAIKO_DB_NAME"]) assert.ok(process.env[key], "Explicit isolated DB configuration required");
assert.ok(process.env.TAIKO_DB_NAME.endsWith("_test"), "Actual database must end in _test");
assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION, "1", "Explicit test mutation opt-in required");

const scrypt = promisify(scryptCallback);
const db = mysql.createPool({ host: process.env.TAIKO_DB_HOST, port: Number(process.env.TAIKO_DB_PORT || 3306), user: process.env.TAIKO_DB_USER, password: process.env.TAIKO_DB_PASSWORD, database: process.env.TAIKO_DB_NAME, connectionLimit: 2 });
const root = await mkdtemp("/var/tmp/recent-growth-browser-");
const userdataDir = `${root}/userdata`;
const artifacts = "/var/tmp/recent-growth-browser-artifacts";
const port = 3317;
let user = 0;
let server;
let browser;
const logs = [];

const waitForServer = async (url, child) => {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Nuxt dev server exited with code ${child.exitCode}\n${logs.slice(-20).join("")}`);
    try { if ((await fetch(url, { signal: AbortSignal.timeout(2_000) })).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error("Nuxt dev server did not become ready");
};

try {
  const tag = randomBytes(5).toString("hex");
  const password = randomBytes(18).toString("hex");
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  const passwordHash = `${salt}:${Buffer.from(derived).toString("hex")}`;
  const username = `recent-ui-${tag}`;
  const taikoId = `recent-ui-${tag}`;
  const [created] = await db.execute("INSERT INTO web_user_accounts (username,email,password_hash,email_verified) VALUES (?,?,?,1)", [username, `${username}@example.test`, passwordHash]);
  user = created.insertId;
  await db.execute("INSERT INTO web_taiko_bindings (user_id,taiko_id,source,is_current) VALUES (?,?,'wahlap',1)", [user, taikoId]);
  const song = { song_no: 1455, level: 4, good_cnt: 500, ok_cnt: 20, ng_cnt: 8, combo_cnt: 300, clear_cnt: 1, full_combo_cnt: 0, dondaful_combo_cnt: 0, best_score_rank: 5 };
  const baseline = { _meta: { full: true, ts: "2026-09-22 12:00:00", source: "wahlap" }, profile: { taiko_id: taikoId, nickname: "Recent UI" }, achievement: {}, songs: [{ ...song, high_score: 900000, stage_cnt: 1, update_datetime: "2026-09-22 10:00:00", highscore_datetime: "2026-09-22 10:00:00" }] };
  const current = { _meta: { full: true, ts: "2026-09-23 12:00:00", source: "wahlap" }, profile: { taiko_id: taikoId, nickname: "Recent UI" }, achievement: {}, songs: [{ ...song, high_score: 930000, stage_cnt: 2, best_score_rank: 6, update_datetime: "2026-09-23 10:00:00", highscore_datetime: "2026-09-23 10:00:00" }] };
  const historyDir = `${userdataDir}/${taikoId}`;
  await mkdir(historyDir, { recursive: true });
  await mkdir(artifacts, { recursive: true });
  await writeFile(`${historyDir}/data_2026-09-22_12_00_00.json`, JSON.stringify(baseline));
  await writeFile(`${historyDir}/data_2026-09-23_12_00_00.json`, JSON.stringify(current));
  await writeFile(`${userdataDir}/${taikoId}data.json`, JSON.stringify(current));

  server = spawn(process.execPath, ["node_modules/@nuxt/cli/bin/nuxi.mjs", "dev", "--host", "127.0.0.1", "--port", String(port)], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, TAIKO_USERDATA_DIR: userdataDir, TAIKO_REPO_ROOT: "/home/sigaer/taiko" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  for (const stream of [server.stdout, server.stderr]) stream.on("data", chunk => {
    if (logs.length < 200) logs.push(String(chunk).slice(0, 2_000));
  });
  await waitForServer(`http://127.0.0.1:${port}/`, server);

  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const login = await context.request.post(`http://127.0.0.1:${port}/api/account/auth/login`, { data: { identifier: username, password } });
  assert.equal(login.status(), 200);
  const recentResponse = await context.request.get(`http://127.0.0.1:${port}/api/account/growth/recent`);
  const recentBody = await recentResponse.json().catch(async () => ({ raw: await recentResponse.text() }));
  assert.equal(recentResponse.status(), 200, `Recent API failed: ${JSON.stringify(recentBody)}`);
  assert.ok(Array.isArray(recentBody.facts) && recentBody.facts.length, `Recent API returned no facts: ${JSON.stringify(recentBody)}`);
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const recentResponseErrors = [];
  page.on("console", message => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) consoleErrors.push(message.text());
  });
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("response", response => {
    if (response.status() >= 400 && response.url().includes("/api/account/growth/recent")) recentResponseErrors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle", timeout: 90_000 });
  try {
    await page.waitForSelector(".recent-growth__fact", { timeout: 60_000 });
  } catch (error) {
    throw new Error(`Recent Growth was not rendered. Page text: ${(await page.locator("body").innerText()).slice(0, 2_000)}`, { cause: error });
  }
  const audit = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    heading: document.querySelector(".recent-growth h2")?.textContent?.trim(),
    text: document.querySelector(".recent-growth")?.textContent || "",
    targetHeight: document.querySelector(".recent-growth__fact")?.getBoundingClientRect().height || 0
  }));
  assert.ok(audit.scrollWidth <= audit.clientWidth, "Recent Growth causes horizontal overflow");
  assert.equal(audit.heading, "最近同步的变化");
  assert.match(audit.text, /最好成绩 930,000/);
  assert.ok(audit.targetHeight >= 44, "Recent fact target is too small");
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(recentResponseErrors, []);
  await page.screenshot({ path: `${artifacts}/recent-growth-mobile.png`, fullPage: true });
  await page.waitForTimeout(500);
  const [[ack]] = await db.query("SELECT COUNT(*) AS n FROM web_growth_recent_cursors c JOIN web_taiko_bindings b ON b.id=c.binding_id WHERE b.user_id=?", [user]);
  assert.equal(Number(ack.n), 1, "rendered Recent Growth was not acknowledged");
  await page.reload({ waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForSelector(".recent-growth__empty");
  assert.match(await page.locator(".recent-growth__empty").innerText(), /最新变化都看过了/);
  await context.close();
  console.log(JSON.stringify({ ok: true, artifacts, viewport: "390x844", acknowledged: true }));
} catch (error) {
  if (server && server.exitCode === null) console.error(logs.slice(-20).join(""));
  throw error;
} finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise(resolve => { server.once("exit", resolve); setTimeout(() => { if (server.exitCode === null) server.kill("SIGKILL"); resolve(); }, 10_000); });
  }
  try {
    if (user) {
      const [bindings] = await db.query("SELECT id FROM web_taiko_bindings WHERE user_id=?", [user]);
      const ids = bindings.map(row => Number(row.id));
      if (ids.length) {
        await db.query("DELETE FROM web_growth_recent_cursors WHERE binding_id IN (?)", [ids]);
        await db.query("DELETE FROM web_player_goals WHERE binding_id IN (?)", [ids]);
        await db.query("DELETE FROM web_growth_measurements WHERE binding_id IN (?)", [ids]);
      }
      await db.query("DELETE FROM web_song_locks WHERE user_id=?", [user]);
      await db.query("DELETE FROM web_user_sessions WHERE user_id=?", [user]);
      await db.query("DELETE FROM web_taiko_bindings WHERE user_id=?", [user]);
      await db.query("DELETE FROM web_user_accounts WHERE id=?", [user]);
    }
  } finally {
    await db.end();
    await rm(root, { recursive: true, force: true });
  }
}
