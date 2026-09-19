// Post-release only. Uses a disposable account and synthetic catalog-backed
// scores, then removes every database row and userdata file it created.
import assert from "node:assert/strict";
import { createHash, randomBytes, randomInt, scryptSync } from "node:crypto";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import { authoritativeFixture } from "../tests/fixtures/goalAuthoritative.mjs";
import { deleteUserWithGoals } from "../server/services/goals/lifecycle.ts";
import { auditGoalOrphans } from "../server/services/goals/audit.ts";
import { auditGrowthMeasurementOrphans, inspectGrowthMeasurementSchema } from "../server/services/growth-history/audit.ts";

assert.equal(process.env.TAIKO_ALLOW_GROWTH_HISTORY_PRODUCTION_SMOKE, "1");
assert.equal(process.env.TAIKO_DB_NAME, "taiko");

const base = "https://viewer.sakura-bot.cn";
const userdata = "/home/sigaer/taiko/userdata";
const outputDirectory = "/var/tmp/growth-history-foundation";
await mkdir(outputDirectory, { recursive: true });
const reportPath = `${outputDirectory}/production-smoke.json`;
const db = mysql.createPool({
  host: process.env.TAIKO_DB_HOST,
  port: Number(process.env.TAIKO_DB_PORT || 3306),
  user: process.env.TAIKO_DB_USER,
  password: process.env.TAIKO_DB_PASSWORD,
  database: process.env.TAIKO_DB_NAME,
  connectionLimit: 3
});

let userId = 0;
let bindingId = 0;
let currentPath = "";
let historyDirectory = "";
const report = { result: "FAIL", release: "0.70.0" };
const request = async (path, token, options = {}) => {
  const started = performance.now();
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { Cookie: `stv_session=${token}`, ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
    signal: AbortSignal.timeout(90_000)
  });
  assert.match(response.headers.get("cache-control") || "", /private, no-store/);
  assert.match(response.headers.get("vary") || "", /cookie/i);
  return { response, body: await response.json(), totalMs: Math.round(performance.now() - started) };
};
const hash = value => createHash("sha256").update(value).digest("hex");
const localDate = (day, hour) => new Date(`${day}T${hour}:00:00+08:00`);
const chart = (source, day, hour, overrides = {}) => ({
  ...source,
  highscore_datetime: `${day} ${hour}:00:00`,
  update_datetime: `${day} ${hour}:00:00`,
  ...overrides
});

try {
  const [[identity]] = await db.query("SELECT DATABASE() AS name");
  assert.equal(identity.name, "taiko");
  const schema = await inspectGrowthMeasurementSchema(db);
  assert.equal(schema.exists, true);
  assert.deepEqual(schema.errors, []);
  const html = await (await fetch(base, { signal: AbortSignal.timeout(20_000) })).text();
  assert.match(html, /0\.70\.0/, "0.70.0 must be online before production smoke");

  const tag = randomBytes(6).toString("hex");
  const username = `growth_history_smoke_${tag}`;
  const password = randomBytes(24).toString("hex");
  const salt = randomBytes(16).toString("hex");
  const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
  const [account] = await db.execute("INSERT INTO web_user_accounts (username,email,password_hash,email_verified) VALUES (?,?,?,1)", [username, `${username}@example.test`, passwordHash]);
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
  assert.ok(taikoId, "No unused synthetic profile identity");
  const [binding] = await db.execute("INSERT INTO web_taiko_bindings (user_id,taiko_id,source,is_current,verified_title) VALUES (?,?,'wahlap',1,'Growth history smoke fixture')", [userId, taikoId]);
  bindingId = Number(binding.insertId);
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
      songs.push({ song_no: Number(song.id), level, song_name: song.song_name, high_score: 900000, best_score_rank: 4, good_cnt: Math.max(0, notes - 28), ok_cnt: 20, ng_cnt: 8, combo_cnt: 100, stage_cnt: 1, clear_cnt: 1, full_combo_cnt: 0, dondaful_combo_cnt: 0, highscore_mode: 0, option_flg: [1, 0, 0, "00"] });
    }
  }
  assert.ok(songs.length > 0 && songs.length < 10_000);
  const basePayload = { _growthHistorySmoke: true, profile: { mydon_name: "Growth History Smoke", userid: taikoId }, achievement: { ary_crown_count: [songs.length, 0, 0], ary_score_rank_count: [0, 0, songs.length, 0, 0, 0, 0] }, songs };
  const transitions = [
    ["2026-09-15", "09", chart(songs[0], "2026-09-15", "09")],
    ["2026-09-16", "10", chart(songs[0], "2026-09-16", "10", { high_score: 910000 })],
    ["2026-09-18", "09", chart(songs[0], "2026-09-18", "09", { high_score: 910000 })],
    ["2026-09-18", "12", chart(songs[0], "2026-09-18", "12", { high_score: 920000, full_combo_cnt: 1, ng_cnt: 0, good_cnt: Number(songs[0].good_cnt) + Number(songs[0].ng_cnt) })]
  ];
  let currentPayload;
  for (const [day, hour, changed] of transitions) {
    currentPayload = authoritativeFixture({ ...basePayload, songs: [changed, ...songs.slice(1)] }, taikoId, localDate(day, hour));
    await writeFile(`${historyDirectory}/data_${day}_${hour}_00_00_smoke.json`, JSON.stringify(currentPayload), { flag: "wx", mode: 0o600 });
  }
  await writeFile(currentPath, JSON.stringify(currentPayload), { flag: "wx", mode: 0o600 });

  const login = await fetch(`${base}/api/account/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: username, password }), signal: AbortSignal.timeout(20_000) });
  assert.equal(login.status, 200);
  const token = (await login.json()).sessionToken;
  assert.ok(token);

  const unauthenticated = await fetch(`${base}/api/account/growth/history?days=7`, { signal: AbortSignal.timeout(20_000) });
  assert.equal(unauthenticated.status, 401);
  assert.match(unauthenticated.headers.get("cache-control") || "", /private, no-store/);

  const firstHistory = await request("/api/account/growth/history?from=2026-09-16&to=2026-09-19", token);
  assert.equal(firstHistory.response.status, 200);
  assert.equal(firstHistory.body.profileId, String(bindingId));
  assert.equal(firstHistory.body.coverage.scoreHistoryState, "complete");
  for (const type of ["score-pb", "fc", "ng-reduced"]) assert.ok(firstHistory.body.facts.some(fact => fact.type === type), `Missing ${type} fact`);
  assert.equal(new Set(firstHistory.body.facts.map(fact => fact.factKey)).size, firstHistory.body.facts.length);
  report.initialHistory = { totalMs: firstHistory.totalMs, facts: firstHistory.body.facts.length, measurements: firstHistory.body.measurements.length, coverage: firstHistory.body.coverage.scoreHistoryState };

  const firstOverview = await request("/api/account/growth/overview", token);
  assert.equal(firstOverview.response.status, 200);
  const repeatedOverview = await request("/api/account/growth/overview", token);
  assert.equal(repeatedOverview.response.status, 200);
  assert.equal(firstOverview.body.scoreRevision, repeatedOverview.body.scoreRevision);
  let [[measurementCount]] = await db.execute("SELECT COUNT(*) AS n FROM web_growth_measurements WHERE user_id=? AND binding_id=?", [userId, bindingId]);
  assert.equal(Number(measurementCount.n), 1, "same revision must not duplicate measurement");

  const candidate = firstOverview.body.todayPlan.items.find(item => item.goalOptions?.includes("score-pb"));
  assert.ok(candidate, "No score-pb Goal candidate");
  const createGoal = await request("/api/account/growth/goal", token, { method: "POST", body: JSON.stringify({ profileId: firstOverview.body.profileId, songId: candidate.songId, difficultyType: candidate.difficultyType, goalType: "score-pb", scoreRevision: firstOverview.body.scoreRevision }) });
  assert.equal(createGoal.response.status, 200);
  const goal = createGoal.body.activeGoal;
  assert.ok(goal?.id);

  const updated = JSON.parse(await readFile(currentPath, "utf8"));
  const updatedRow = updated.songs.find(item => Number(item.song_no) === Number(goal.songId) && Number(item.level) === Number(goal.difficultyType));
  assert.ok(updatedRow);
  updatedRow.high_score = Number(goal.baseline.highScore) + 1000;
  updatedRow.highscore_datetime = "2026-09-19 14:00:00";
  updatedRow.update_datetime = "2026-09-19 14:00:00";
  const nextPayload = authoritativeFixture(updated, taikoId, localDate("2026-09-19", "14"));
  const nextEncoded = JSON.stringify(nextPayload);
  const nextRevision = hash(nextEncoded);
  await writeFile(currentPath, nextEncoded);
  await writeFile(`${historyDirectory}/data_2026-09-19_14_00_00_smoke.json`, nextEncoded, { flag: "wx", mode: 0o600 });

  const evaluation = await request("/api/account/growth/goal/evaluate", token, { method: "POST", body: JSON.stringify({ profileId: firstOverview.body.profileId, expectedActiveGoalId: goal.id }) });
  assert.equal(evaluation.response.status, 200);
  assert.equal(evaluation.body.outcome, "completed");
  const nextOverview = await request("/api/account/growth/overview", token);
  assert.equal(nextOverview.response.status, 200);
  assert.equal(nextOverview.body.scoreRevision, nextRevision);
  [[measurementCount]] = await db.execute("SELECT COUNT(*) AS n FROM web_growth_measurements WHERE user_id=? AND binding_id=?", [userId, bindingId]);
  assert.equal(Number(measurementCount.n), 2, "new revision must create next measurement");

  const finalHistory = await request("/api/account/growth/history?from=2026-09-16&to=2026-09-19", token);
  assert.equal(finalHistory.response.status, 200);
  const goalFacts = finalHistory.body.facts.filter(fact => fact.type === "goal-completed" && fact.goalId === goal.id);
  assert.equal(goalFacts.length, 1);
  assert.equal(goalFacts[0].temporal.attributedDay, null);
  assert.equal(goalFacts[0].temporal.occurredAt, null);
  assert.equal(goalFacts[0].temporal.precision, "observation");
  assert.equal(finalHistory.body.measurements.length, 2);
  report.finalHistory = { totalMs: finalHistory.totalMs, facts: finalHistory.body.facts.length, measurements: finalHistory.body.measurements.length, goalFacts: goalFacts.length };
  report.overview = { firstMs: firstOverview.totalMs, sameRevisionMs: repeatedOverview.totalMs, nextRevisionMs: nextOverview.totalMs, measurementRows: 2 };
  report.result = "PASS";
} finally {
  try {
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
    await writeFile(reportPath, JSON.stringify(report, null, 2));
  } finally {
    await db.end();
  }
}

console.log(JSON.stringify(report));
