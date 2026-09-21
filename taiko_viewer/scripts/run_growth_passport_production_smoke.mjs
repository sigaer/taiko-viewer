// Post-release only. Creates one disposable production account and removes
// every account row, binding, measurement, Goal and userdata file it creates.
import assert from "node:assert/strict";
import { createHash, randomBytes, randomInt, scryptSync } from "node:crypto";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import { chromium } from "playwright-core";
import { authoritativeFixture } from "../tests/fixtures/goalAuthoritative.mjs";
import { deleteUserWithGoals } from "../server/services/goals/lifecycle.ts";
import { auditGoalOrphans } from "../server/services/goals/audit.ts";
import { auditGrowthMeasurementOrphans } from "../server/services/growth-history/audit.ts";

assert.equal(process.env.TAIKO_ALLOW_GROWTH_PASSPORT_PRODUCTION_SMOKE, "1");
assert.equal(process.env.TAIKO_DB_NAME, "taiko");
const base = "https://viewer.sakura-bot.cn";
const userdata = "/home/sigaer/taiko/userdata";
const out = "/var/tmp/growth-passport";
await mkdir(out, { recursive: true });
const db = mysql.createPool({ host: process.env.TAIKO_DB_HOST, port: Number(process.env.TAIKO_DB_PORT || 3306), user: process.env.TAIKO_DB_USER, password: process.env.TAIKO_DB_PASSWORD, database: process.env.TAIKO_DB_NAME, connectionLimit: 3 });
const report = { result: "FAIL", release: "0.73.0", api: {}, browser: {} };
let userId = 0;
let currentPath = "";
let historyDirectory = "";
let browser;

const dayMs = 86_400_000;
const moveDay = (day, amount) => new Date(Date.parse(`${day}T00:00:00Z`) + amount * dayMs).toISOString().slice(0, 10);
const shanghaiDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const localDate = (day, hour) => new Date(`${day}T${hour}:00:00+08:00`);
const sqlUtc = value => new Date(value).toISOString().replace("T", " ").replace("Z", "");
const hash = value => createHash("sha256").update(value).digest("hex");
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
  assert.match(html, /0\.73\.0/, "0.73.0 must be online before production smoke");

  const tag = randomBytes(6).toString("hex");
  const username = `growth_passport_smoke_${tag}`;
  const password = randomBytes(24).toString("hex");
  const salt = randomBytes(16).toString("hex");
  const [account] = await db.execute("INSERT INTO web_user_accounts (username,email,password_hash,email_verified) VALUES (?,?,?,1)", [username, `${username}@example.test`, `${salt}:${scryptSync(password, salt, 64).toString("hex")}`]);
  userId = Number(account.insertId);

  const reserveTaikoId = async prefix => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const candidate = String(randomInt(prefix * 10_000_000, (prefix + 1) * 10_000_000 - 1));
      const [[row]] = await db.execute("SELECT COUNT(*) AS n FROM web_taiko_bindings WHERE taiko_id=?", [candidate]);
      if (Number(row.n)) continue;
      try { await access(`${userdata}/${candidate}data.json`); } catch { return candidate; }
    }
    throw new Error("unable to reserve disposable taiko id");
  };
  const taikoId = await reserveTaikoId(9);
  const isolatedTaikoId = await reserveTaikoId(8);
  const [bindingResult] = await db.execute("INSERT INTO web_taiko_bindings (user_id,taiko_id,source,is_current,verified_title) VALUES (?,?,'wahlap',1,'Skill Passport smoke fixture')", [userId, taikoId]);
  const bindingId = Number(bindingResult.insertId);
  const [isolatedBindingResult] = await db.execute("INSERT INTO web_taiko_bindings (user_id,taiko_id,source,is_current,verified_title) VALUES (?,?,'manual',0,'Skill Passport isolation fixture')", [userId, isolatedTaikoId]);
  const isolatedBindingId = Number(isolatedBindingResult.insertId);
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
      songs.push({ song_no: Number(song.id), level, song_name: song.song_name, high_score: 900000, best_score_rank: 4, good_cnt: Math.max(0, notes - 28), ok_cnt: 20, ng_cnt: 8, combo_cnt: 100, stage_cnt: 1, clear_cnt: 1, full_combo_cnt: 0, dondaful_combo_cnt: 0, highscore_datetime: `${moveDay(shanghaiDay, -8)} 08:00:00`, update_datetime: `${moveDay(shanghaiDay, -8)} 08:00:00`, highscore_mode: 0, option_flg: [1, 0, 0, "00"] });
    }
  }
  assert.ok(songs.length > 20 && songs.length < 10_000);
  const basePayload = { _growthPassportSmoke: true, profile: { mydon_name: "Skill Passport Smoke", userid: taikoId }, achievement: { ary_crown_count: [songs.length, 0, 0], ary_score_rank_count: [0, 0, songs.length, 0, 0, 0, 0] }, songs };
  const transitions = [
    [moveDay(shanghaiDay, -8), "09", chart(songs[0], moveDay(shanghaiDay, -8), "09")],
    [moveDay(shanghaiDay, -6), "10", chart(songs[0], moveDay(shanghaiDay, -6), "10", { high_score: 910000 })],
    [moveDay(shanghaiDay, -3), "11", chart(songs[0], moveDay(shanghaiDay, -3), "11", { high_score: 915000, ng_cnt: 4, good_cnt: Number(songs[0].good_cnt) + 4 })],
    [moveDay(shanghaiDay, -1), "09", chart(songs[0], moveDay(shanghaiDay, -1), "09", { high_score: 915000, ng_cnt: 4, good_cnt: Number(songs[0].good_cnt) + 4 })],
    [moveDay(shanghaiDay, -1), "12", chart(songs[0], moveDay(shanghaiDay, -1), "12", { high_score: 920000, full_combo_cnt: 1, ng_cnt: 0, good_cnt: Number(songs[0].good_cnt) + 8 })]
  ];
  let currentPayload;
  for (const [day, hour, changed] of transitions) {
    currentPayload = authoritativeFixture({ ...basePayload, songs: [changed, ...songs.slice(1)] }, taikoId, localDate(day, hour));
    await writeFile(`${historyDirectory}/data_${day}_${hour}_00_00_passport.json`, JSON.stringify(currentPayload), { flag: "wx", mode: 0o600 });
  }
  await writeFile(currentPath, JSON.stringify(currentPayload), { flag: "wx", mode: 0o600 });

  const login = await fetch(`${base}/api/account/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: username, password }), signal: AbortSignal.timeout(20_000) });
  assert.equal(login.status, 200);
  const token = (await login.json()).sessionToken;
  assert.ok(token);
  const unauthenticated = await fetch(`${base}/api/account/growth/passport`, { signal: AbortSignal.timeout(20_000) });
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
  await writeFile(currentPath, encoded);
  await writeFile(`${historyDirectory}/data_${shanghaiDay}_00_01_00_passport.json`, encoded, { flag: "wx", mode: 0o600 });
  const evaluation = await request("/api/account/growth/goal/evaluate", token, { method: "POST", body: JSON.stringify({ profileId: overview.body.profileId, expectedActiveGoalId: goal.id }) });
  assert.equal(evaluation.response.status, 200);
  assert.equal(evaluation.body.outcome, "completed");
  const latestOverview = await request("/api/account/growth/overview", token);
  assert.equal(latestOverview.response.status, 200);
  assert.ok(latestOverview.body.recentCompletedGoal?.id);
  const activeCandidate = latestOverview.body.todayPlan.items.find(item => item.goalOptions?.includes("score-pb"));
  assert.ok(activeCandidate);
  const activeGoalResult = await request("/api/account/growth/goal", token, { method: "POST", body: JSON.stringify({ profileId: latestOverview.body.profileId, expectedActiveGoalId: null, songId: activeCandidate.songId, difficultyType: activeCandidate.difficultyType, goalType: "score-pb", scoreRevision: latestOverview.body.scoreRevision }) });
  assert.equal(activeGoalResult.response.status, 200);
  assert.ok(activeGoalResult.body.activeGoal?.id);

  const [[latestMeasurement]] = await db.execute("SELECT measurement_version,algorithm_version,model_revision,rating,dimensions_json FROM web_growth_measurements WHERE user_id=? AND binding_id=? ORDER BY captured_at DESC,id DESC LIMIT 1", [userId, bindingId]);
  assert.ok(latestMeasurement);
  const currentDimensions = JSON.parse(String(latestMeasurement.dimensions_json));
  const insertMeasurement = async ({ targetBinding = bindingId, day, hour, model, rating, focus, dimensions }) => {
    await db.execute(`INSERT INTO web_growth_measurements (user_id,binding_id,score_revision,measurement_version,algorithm_version,model_revision,rating,dimensions_json,focus,sample_count,availability_state,captured_at) VALUES (?,?,?,?,?,?,?,?,?,24,'ready',?)`, [userId, targetBinding, hash(`${tag}:${targetBinding}:${day}:${hour}:${model}`), Number(latestMeasurement.measurement_version), String(latestMeasurement.algorithm_version), model, rating, JSON.stringify(dimensions), focus, sqlUtc(localDate(day, hour))]);
  };
  const shifted = (key, delta) => Object.fromEntries(Object.entries(currentDimensions).map(([name, value]) => [name, Number(value) + (name === key ? delta : 0)]));
  await insertMeasurement({ day: moveDay(shanghaiDay, -8), hour: "08", model: "passport-smoke-prior-model", rating: Number(latestMeasurement.rating) - 6, focus: "speed", dimensions: shifted("speed", -5) });
  await insertMeasurement({ day: moveDay(shanghaiDay, -7), hour: "08", model: "passport-smoke-prior-model", rating: Number(latestMeasurement.rating) - 5, focus: "speed", dimensions: shifted("speed", -4) });
  await insertMeasurement({ day: moveDay(shanghaiDay, -5), hour: "08", model: String(latestMeasurement.model_revision), rating: Number(latestMeasurement.rating) - 4, focus: "complex", dimensions: shifted("accuracy", -4) });
  await insertMeasurement({ day: moveDay(shanghaiDay, -4), hour: "08", model: String(latestMeasurement.model_revision), rating: Number(latestMeasurement.rating) - 2, focus: "accuracy", dimensions: shifted("accuracy", -2) });
  await insertMeasurement({ targetBinding: isolatedBindingId, day: moveDay(shanghaiDay, -2), hour: "08", model: "passport-smoke-isolated", rating: 999, focus: "stamina", dimensions: shifted("stamina", 500) });
  const [[rawCoverage]] = await db.execute("SELECT COUNT(*) AS rows_count,COUNT(DISTINCT DATE(DATE_ADD(captured_at,INTERVAL 8 HOUR))) AS days_count FROM web_growth_measurements WHERE user_id=? AND binding_id=?", [userId, bindingId]);

  const passport = await request("/api/account/growth/passport?range=365&dimension=rating", token);
  assert.equal(passport.response.status, 200);
  assert.equal(passport.body.profileId, String(bindingId));
  report.api = {
    totalMs: passport.totalMs,
    segments: passport.body.segments.length,
    points: passport.body.segments.reduce((sum, segment) => sum + segment.points.length, 0),
    focusRuns: passport.body.focusTimeline.length,
    milestoneTypes: passport.body.milestones.map(item => ({ type: item.primaryType, goalCompleted: item.goalCompleted, observationOnly: item.observationOnly })),
    recentFactsState: passport.body.coverage.recentFactsState,
    measurementDays: passport.body.coverage.measurementDays
  };
  assert.ok(passport.body.segments.length >= 2);
  assert.ok(Number(rawCoverage.rows_count) > passport.body.segments.reduce((sum, segment) => sum + segment.points.length, 0));
  assert.equal(Number(rawCoverage.days_count), passport.body.segments.reduce((sum, segment) => sum + segment.points.length, 0));
  assert.ok(passport.body.segments.every(segment => segment.points.every(point => point.bindingId === String(bindingId) && point.rating !== 999)));
  assert.equal(passport.body.currentSegmentChange.compatible, true);
  assert.ok(passport.body.focusTimeline.some(run => run.focus === "complex"));
  assert.ok(passport.body.focusTimeline.some(run => run.focus === "accuracy"));
  assert.ok(passport.body.milestones.some(item => item.primaryType === "fc"));
  assert.ok(passport.body.milestones.some(item => item.goalCompleted));
  assert.ok(passport.body.milestones.length <= 8);
  assert.ok(passport.body.activeGoal?.id);
  assert.equal(passport.body.recentCompletedGoal, null);
  assert.ok(passport.body.currentNextAction?.todayPlan?.items?.length);
  assert.ok(passport.body.coverage.measurementDays >= 5);
  report.api.milestones = passport.body.milestones.length;
  report.api.rawMeasurements = Number(rawCoverage.rows_count);
  report.api.profileIsolation = "PASS";

  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await context.addCookies([{ name: "stv_session", value: token, url: base }]);
  const page = await context.newPage();
  const browserErrors = [];
  page.on("pageerror", error => browserErrors.push(error.message.slice(0, 180)));
  page.on("console", message => { if (/hydration/i.test(message.text())) browserErrors.push(message.text().slice(0, 180)); });
  await page.goto(`${base}/my/growth?range=365`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.locator(".passport-hero").waitFor({ timeout: 90_000 });
  assert.match(await page.locator(".passport-hero").innerText(), /成长档案/);
  assert.ok(await page.locator(".passport-chart__segment").count() >= 2);
  assert.ok(await page.locator(".passport-milestone").count() >= 1);
  assert.ok(await page.locator(".passport-focus-history li").count() >= 2);
  assert.equal(await page.locator(".passport-metric").count(), 0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.locator(".passport-hero").waitFor({ timeout: 90_000 });
  assert.ok(await page.locator(".passport-chart__segment").count() >= 2);
  assert.deepEqual(browserErrors, []);
  await context.close();
  await browser.close();
  browser = null;
  report.browser = { locale: "zh", viewport: "390x844", initial: "PASS", reload: "PASS", errors: browserErrors };
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
