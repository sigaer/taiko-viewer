// Post-release only. Builds two disposable production scenarios and removes
// every account row, measurement, Goal and userdata file it creates.
import assert from "node:assert/strict";
import { createHash, randomBytes, randomInt, scryptSync } from "node:crypto";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import { chromium } from "playwright-core";
import { authoritativeFixture } from "../tests/fixtures/goalAuthoritative.mjs";
import { deleteUserWithGoals } from "../server/services/goals/lifecycle.ts";
import { auditGoalOrphans } from "../server/services/goals/audit.ts";
import { auditGrowthMeasurementOrphans } from "../server/services/growth-history/audit.ts";

assert.equal(process.env.TAIKO_ALLOW_GROWTH_WEEKLY_PRODUCTION_SMOKE, "1");
assert.equal(process.env.TAIKO_DB_NAME, "taiko");
const base = "https://viewer.sakura-bot.cn";
const userdata = "/home/sigaer/taiko/userdata";
const out = "/var/tmp/growth-weekly";
await mkdir(out, { recursive: true });
const db = mysql.createPool({ host: process.env.TAIKO_DB_HOST, port: Number(process.env.TAIKO_DB_PORT || 3306), user: process.env.TAIKO_DB_USER, password: process.env.TAIKO_DB_PASSWORD, database: process.env.TAIKO_DB_NAME, connectionLimit: 3 });
const report = { result: "FAIL", release: "0.70.1", scenarios: {} };
let userId = 0;
let currentPath = "";
let historyDirectory = "";
let browser;

const dayMs = 86_400_000;
const moveDay = (day, amount) => new Date(Date.parse(`${day}T00:00:00Z`) + amount * dayMs).toISOString().slice(0, 10);
const shanghaiDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const weekday = new Date(`${shanghaiDay}T00:00:00Z`).getUTCDay();
const monday = moveDay(shanghaiDay, -(weekday === 0 ? 6 : weekday - 1));
const priorSunday = moveDay(monday, -1);
const middleDay = moveDay(monday, Math.min(2, Math.max(1, Math.floor((Date.parse(`${shanghaiDay}T00:00:00Z`) - Date.parse(`${monday}T00:00:00Z`)) / dayMs))));
const eventDay = shanghaiDay === monday ? monday : moveDay(shanghaiDay, -1);
const hash = value => createHash("sha256").update(value).digest("hex");
const localDate = (day, hour) => new Date(`${day}T${hour}:00:00+08:00`);
const chart = (source, day, hour, overrides = {}) => ({ ...source, highscore_datetime: `${day} ${hour}:00:00`, update_datetime: `${day} ${hour}:00:00`, ...overrides });
const request = async (path, token, options = {}) => {
  const started = performance.now();
  const response = await fetch(`${base}${path}`, { ...options, headers: { Cookie: `stv_session=${token}`, ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers }, signal: AbortSignal.timeout(90_000) });
  assert.match(response.headers.get("cache-control") || "", /private, no-store/);
  assert.match(response.headers.get("vary") || "", /cookie/i);
  return { response, body: await response.json(), totalMs: Math.round(performance.now() - started) };
};

try {
  const [[identity]] = await db.query("SELECT DATABASE() AS name");
  assert.equal(identity.name, "taiko");
  const html = await (await fetch(base, { signal: AbortSignal.timeout(20_000) })).text();
  assert.match(html, /0\.70\.1/, "0.70.1 must be online before production smoke");

  const tag = randomBytes(6).toString("hex");
  const username = `growth_weekly_smoke_${tag}`;
  const password = randomBytes(24).toString("hex");
  const salt = randomBytes(16).toString("hex");
  const [account] = await db.execute("INSERT INTO web_user_accounts (username,email,password_hash,email_verified) VALUES (?,?,?,1)", [username, `${username}@example.test`, `${salt}:${scryptSync(password, salt, 64).toString("hex")}`]);
  userId = Number(account.insertId);

  let taikoId = "";
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = String(randomInt(90_000_000, 99_999_999));
    const [[row]] = await db.execute("SELECT COUNT(*) AS n FROM web_taiko_bindings WHERE taiko_id=?", [candidate]);
    if (Number(row.n)) continue;
    try { await access(`${userdata}/${candidate}data.json`); continue; } catch {}
    taikoId = candidate;
    break;
  }
  assert.ok(taikoId);
  const [bindingResult] = await db.execute("INSERT INTO web_taiko_bindings (user_id,taiko_id,source,is_current,verified_title) VALUES (?,?,'wahlap',1,'Weekly growth smoke fixture')", [userId, taikoId]);
  const bindingId = Number(bindingResult.insertId);
  currentPath = `${userdata}/${taikoId}data.json`;
  historyDirectory = `${userdata}/${taikoId}`;
  await mkdir(historyDirectory, { recursive: false });

  const catalog = JSON.parse(await readFile("/home/sigaer/taiko/songs/song_data.json", "utf8"));
  const songs = [];
  for (const song of catalog) {
    if (Number(song.shelf_status || 0) !== 0) continue;
    for (const level of [4, 5]) {
      if (Number(song[`level_${level}`]) <= 0) continue;
      const notes = Number(song.max_combo?.[level - 1]) || 600;
      songs.push({ song_no: Number(song.id), level, song_name: song.song_name, high_score: 900000, best_score_rank: 4, good_cnt: Math.max(0, notes - 28), ok_cnt: 20, ng_cnt: 8, combo_cnt: 100, stage_cnt: 1, clear_cnt: 1, full_combo_cnt: 0, dondaful_combo_cnt: 0, highscore_datetime: `${priorSunday} 08:00:00`, update_datetime: `${priorSunday} 08:00:00`, highscore_mode: 0, option_flg: [1, 0, 0, "00"] });
    }
  }
  assert.ok(songs.length > 20 && songs.length < 10_000);
  const basePayload = { _growthWeeklySmoke: true, profile: { mydon_name: "Weekly Growth Smoke", userid: taikoId }, achievement: { ary_crown_count: [songs.length, 0, 0], ary_score_rank_count: [0, 0, songs.length, 0, 0, 0, 0] }, songs };
  const transitions = [
    [priorSunday, "09", chart(songs[0], priorSunday, "09")],
    [monday, "10", chart(songs[0], monday, "10", { high_score: 910000 })],
    [middleDay, "11", chart(songs[0], middleDay, "11", { high_score: 915000, ng_cnt: 4, good_cnt: Number(songs[0].good_cnt) + 4 })],
    [eventDay, "09", chart(songs[0], eventDay, "09", { high_score: 915000, ng_cnt: 4, good_cnt: Number(songs[0].good_cnt) + 4 })],
    [eventDay, "12", chart(songs[0], eventDay, "12", { high_score: 920000, full_combo_cnt: 1, ng_cnt: 0, good_cnt: Number(songs[0].good_cnt) + 8 })]
  ];
  let currentPayload;
  for (const [day, hour, changed] of transitions) {
    currentPayload = authoritativeFixture({ ...basePayload, songs: [changed, ...songs.slice(1)] }, taikoId, localDate(day, hour));
    await writeFile(`${historyDirectory}/data_${day}_${hour}_00_00_weekly.json`, JSON.stringify(currentPayload), { flag: "wx", mode: 0o600 });
  }
  await writeFile(currentPath, JSON.stringify(currentPayload), { flag: "wx", mode: 0o600 });

  const login = await fetch(`${base}/api/account/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: username, password }), signal: AbortSignal.timeout(20_000) });
  assert.equal(login.status, 200);
  const token = (await login.json()).sessionToken;
  assert.ok(token);
  const unauthenticated = await fetch(`${base}/api/account/growth/weekly`, { signal: AbortSignal.timeout(20_000) });
  assert.equal(unauthenticated.status, 401);
  assert.match(unauthenticated.headers.get("cache-control") || "", /private, no-store/);

  const overview = await request("/api/account/growth/overview", token);
  assert.equal(overview.response.status, 200);
  const candidate = overview.body.todayPlan.items.find(item => item.goalOptions?.includes("score-pb"));
  assert.ok(candidate, "No score-pb Goal candidate");
  const createGoal = await request("/api/account/growth/goal", token, { method: "POST", body: JSON.stringify({ profileId: overview.body.profileId, expectedActiveGoalId: null, songId: candidate.songId, difficultyType: candidate.difficultyType, goalType: "score-pb", scoreRevision: overview.body.scoreRevision }) });
  assert.equal(createGoal.response.status, 200);
  const goal = createGoal.body.activeGoal;
  assert.ok(goal?.id);

  const updated = JSON.parse(await readFile(currentPath, "utf8"));
  const updatedRow = updated.songs.find(item => Number(item.song_no) === Number(goal.songId) && Number(item.level) === Number(goal.difficultyType));
  assert.ok(updatedRow);
  updatedRow.high_score = Number(goal.baseline.highScore) + 1000;
  updatedRow.highscore_datetime = `${shanghaiDay} 00:01:00`;
  updatedRow.update_datetime = `${shanghaiDay} 00:01:00`;
  const nextPayload = authoritativeFixture(updated, taikoId, new Date());
  const encoded = JSON.stringify(nextPayload);
  const nextRevision = hash(encoded);
  await writeFile(currentPath, encoded);
  await writeFile(`${historyDirectory}/data_${shanghaiDay}_00_01_00_weekly.json`, encoded, { flag: "wx", mode: 0o600 });
  const evaluation = await request("/api/account/growth/goal/evaluate", token, { method: "POST", body: JSON.stringify({ profileId: overview.body.profileId, expectedActiveGoalId: goal.id }) });
  assert.equal(evaluation.response.status, 200);
  assert.equal(evaluation.body.outcome, "completed");
  const nextOverview = await request("/api/account/growth/overview", token);
  assert.equal(nextOverview.response.status, 200);
  assert.equal(nextOverview.body.scoreRevision, nextRevision);

  const rich = await request("/api/account/growth/weekly", token);
  report.scenarios.rich = { totalMs: rich.totalMs, theme: rich.body.theme?.type, totals: rich.body.totals, highlights: rich.body.highlights?.map(item => ({ type: item.primaryType, songId: item.songId, goalCompleted: item.goalCompleted })), measurementReason: rich.body.measurementChange?.reason, coverage: rich.body.coverage?.scoreHistoryState };
  assert.equal(rich.response.status, 200);
  assert.equal(rich.body.profileId, String(bindingId));
  assert.deepEqual(rich.body.week, { from: monday, to: shanghaiDay, timezone: "Asia/Shanghai", isCompleteWeek: false });
  assert.equal(rich.body.coverage.scoreHistoryState, "complete");
  assert.ok(rich.body.totals.pb >= 2);
  assert.ok(rich.body.totals.fc >= 1);
  assert.ok(rich.body.totals.completedGoals >= 1);
  assert.ok(rich.body.highlights.length >= 2 && rich.body.highlights.length <= 4);
  assert.equal(rich.body.measurementChange.compatible, true);
  assert.ok(rich.body.currentNextAction?.todayPlan?.items?.length > 0);
  report.scenarios.rich = { totalMs: rich.totalMs, theme: rich.body.theme.type, totals: rich.body.totals, highlights: rich.body.highlights.length, measurements: [rich.body.measurementChange.start?.id, rich.body.measurementChange.end?.id].filter(Boolean).length, coverage: rich.body.coverage.scoreHistoryState };

  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await context.addCookies([{ name: "stv_session", value: token, url: base }]);
  const page = await context.newPage();
  const browserErrors = [];
  page.on("pageerror", error => browserErrors.push(error.message.slice(0, 180)));
  page.on("console", message => { if (/hydration/i.test(message.text())) browserErrors.push(message.text().slice(0, 180)); });
  await page.goto(`${base}/my/weekly`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.locator(".weekly-hero").waitFor({ timeout: 90_000 });
  assert.match(await page.locator(".weekly-hero").innerText(), /本周 · 截至今天/);
  assert.ok(await page.locator(".weekly-highlight").count() >= 2 && await page.locator(".weekly-highlight").count() <= 4);
  assert.equal(await page.locator(".weekly-metric").count(), 0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  assert.deepEqual(browserErrors, []);

  await db.execute("UPDATE web_taiko_bindings SET is_current=0 WHERE user_id=?", [userId]);
  const manualId = String(randomInt(80_000_000, 89_999_999));
  await db.execute("INSERT INTO web_taiko_bindings (user_id,taiko_id,source,is_current,verified_title) VALUES (?,?,'manual',1,'Weekly incomplete fixture')", [userId, manualId]);
  const incomplete = await request("/api/account/growth/weekly", token);
  assert.equal(incomplete.response.status, 200);
  assert.equal(incomplete.body.coverage.scoreHistoryState, "unknown");
  assert.equal(incomplete.body.theme.type, "limited-coverage");
  assert.deepEqual(incomplete.body.highlights, []);
  assert.ok(Object.values(incomplete.body.totals).every(value => Number(value) === 0));
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.locator(".weekly-hero").waitFor({ timeout: 90_000 });
  const incompleteText = await page.locator(".weekly-page").innerText();
  assert.match(incompleteText, /这周可确认的记录还不够完整/);
  assert.match(incompleteText, /记录范围暂时无法确认/);
  assert.equal(await page.locator(".weekly-highlight").count(), 0);
  assert.deepEqual(browserErrors, []);
  await context.close();
  await browser.close();
  browser = null;
  report.scenarios.incomplete = { totalMs: incomplete.totalMs, theme: incomplete.body.theme.type, highlights: incomplete.body.highlights.length, coverage: incomplete.body.coverage.scoreHistoryState };
  report.browser = { locale: "zh", viewport: "390x844", rich: "PASS", incomplete: "PASS", errors: browserErrors };
  report.result = "PASS";
} finally {
  try {
    if (browser) await browser.close();
    if (userId) await deleteUserWithGoals(db, userId);
    if (currentPath) await rm(currentPath, { force: true });
    if (historyDirectory) await rm(historyDirectory, { recursive: true, force: true });
    if (userId) {
      const [[residual]] = await db.query("SELECT (SELECT COUNT(*) FROM web_user_accounts WHERE id=?) AS users,(SELECT COUNT(*) FROM web_taiko_bindings WHERE user_id=?) AS bindings,(SELECT COUNT(*) FROM web_user_sessions WHERE user_id=?) AS sessions,(SELECT COUNT(*) FROM web_player_goals WHERE user_id=?) AS goals,(SELECT COUNT(*) FROM web_growth_measurements WHERE user_id=?) AS measurements", [userId, userId, userId, userId, userId]);
      assert.ok(Object.values(residual).every(value => Number(value) === 0));
      report.residualRows = residual;
    }
    report.goalOrphans = await auditGoalOrphans(db);
    report.measurementOrphans = await auditGrowthMeasurementOrphans(db);
    assert.deepEqual(report.goalOrphans, { userOrphans: 0, bindingOrphans: 0, ownerMismatches: 0 });
    assert.deepEqual(report.measurementOrphans, { userOrphans: 0, bindingOrphans: 0, ownerMismatches: 0 });
    report.residualFiles = 0;
    await writeFile(`${out}/production-smoke.json`, JSON.stringify(report, null, 2));
  } finally { await db.end(); }
}
console.log(JSON.stringify(report));
