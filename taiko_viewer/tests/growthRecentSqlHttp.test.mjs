import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import { createApp, createRouter, defineEventHandler, toNodeListener } from "h3";
import { installGoalSqlRuntime } from "./fixtures/goalSqlRuntime.mjs";
import { GROWTH_RECENT_CURSOR_TABLE_SQL } from "../server/services/growth-recent/schema.ts";
import { GROWTH_MEASUREMENT_TABLE_SQL } from "../server/services/growth-history/schema.ts";
import { GOAL_TABLE_SQL } from "../server/services/goals/schema.ts";
import { deleteUserWithGoals } from "../server/services/goals/lifecycle.ts";

for (const key of ["TAIKO_DB_HOST", "TAIKO_DB_USER", "TAIKO_DB_NAME"]) assert.ok(process.env[key], "Explicit isolated DB configuration required");
const db = mysql.createPool({ host: process.env.TAIKO_DB_HOST, port: Number(process.env.TAIKO_DB_PORT || 3306), user: process.env.TAIKO_DB_USER, password: process.env.TAIKO_DB_PASSWORD, database: process.env.TAIKO_DB_NAME, connectionLimit: 2 });

test("real authenticated Recent GET/ack survives reload, device and login boundaries", async () => {
  const [[identity]] = await db.query("SELECT DATABASE() AS name");
  assert.ok(identity.name.endsWith("_test"), "Actual database must end in _test");
  assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION, "1", "Explicit test mutation opt-in required");
  await db.execute(GOAL_TABLE_SQL);
  await db.execute(GROWTH_MEASUREMENT_TABLE_SQL);
  await db.execute(GROWTH_RECENT_CURSOR_TABLE_SQL);
  const root = await mkdtemp("/var/tmp/recent-growth-http-");
  const runtime = { repoRoot: root, userdataDir: `${root}/userdata`, accountCacheDir: `${root}/cache` };
  const uninstall = installGoalSqlRuntime(db, runtime);
  globalThis.defineEventHandler = defineEventHandler;
  let server;
  let user = 0;
  try {
    const { getPasswordHash } = await import("../server/internal/account/shared.ts");
    const tag = randomBytes(5).toString("hex");
    const password = randomBytes(16).toString("hex");
    const username = `recent-http-${tag}`;
    const taikoId = `recent-${tag}`;
    const [created] = await db.execute("INSERT INTO web_user_accounts (username,email,password_hash,email_verified) VALUES (?,?,?,1)", [username, `${username}@example.test`, await getPasswordHash(password)]);
    user = created.insertId;
    const [bound] = await db.execute("INSERT INTO web_taiko_bindings (user_id,taiko_id,source,is_current) VALUES (?,?,'wahlap',1)", [user, taikoId]);
    const baselineSong = { song_no: 100, level: 4, high_score: 900000, good_cnt: 500, ok_cnt: 20, ng_cnt: 8, combo_cnt: 300, stage_cnt: 1, clear_cnt: 1, full_combo_cnt: 0, dondaful_combo_cnt: 0, best_score_rank: 5, update_datetime: "2026-09-20 10:00:00", highscore_datetime: "2026-09-20 10:00:00" };
    const currentSong = { ...baselineSong, high_score: 920000, stage_cnt: 2, best_score_rank: 6, update_datetime: "2026-09-21 11:00:00", highscore_datetime: "2026-09-21 11:00:00" };
    const baseline = { _meta: { full: true, ts: "2026-09-20 12:00:00", source: "wahlap" }, songs: [baselineSong] };
    const current = { _meta: { full: true, ts: "2026-09-21 12:00:00", source: "wahlap" }, songs: [currentSong] };
    const historyDir = `${runtime.userdataDir}/${taikoId}`;
    await mkdir(historyDir, { recursive: true });
    await writeFile(`${historyDir}/data_2026-09-20_12_00_00.json`, JSON.stringify(baseline));
    await writeFile(`${historyDir}/data_2026-09-21_12_00_00.json`, JSON.stringify(current));
    await writeFile(`${runtime.userdataDir}/${taikoId}data.json`, JSON.stringify(current));

    const router = createRouter();
    router.post("/login", (await import("../server/api/account/auth/login.post.ts")).default);
    router.post("/logout", (await import("../server/api/account/auth/logout.post.ts")).default);
    router.get("/recent", (await import("../server/api/account/growth/recent.get.ts")).default);
    router.post("/recent/ack", (await import("../server/api/account/growth/recent/ack.post.ts")).default);
    server = createServer(toNodeListener(createApp().use(router)));
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = (cookie, method, path, body) => fetch(base + path, { method, headers: { "Content-Type": "application/json", Cookie: cookie || "" }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15_000) });
    const login = async () => {
      const response = await request("", "POST", "/login", { identifier: username, password });
      assert.equal(response.status, 200);
      return response.headers.get("set-cookie").split(";")[0];
    };
    const readRecent = async cookie => {
      const response = await request(cookie, "GET", "/recent");
      assert.equal(response.status, 200);
      assert.match(response.headers.get("cache-control"), /private, no-store/);
      assert.match(response.headers.get("vary"), /cookie/i);
      return response.json();
    };
    assert.equal((await request("", "GET", "/recent")).status, 401);
    const deviceA = await login();
    let deviceB = await login();
    const firstA = await readRecent(deviceA);
    const firstB = await readRecent(deviceB);
    assert.equal(firstA.profileId, String(bound.insertId));
    assert.equal(firstA.state, "new");
    assert.equal(firstA.boundary.acknowledgedToken, null);
    assert.equal(firstA.boundary.currentToken, firstB.boundary.currentToken);
    assert.ok(firstA.facts.some(fact => fact.type === "score-pb" && fact.after === 920000));
    const [[beforeAck]] = await db.query("SELECT COUNT(*) AS n FROM web_growth_recent_cursors WHERE binding_id=?", [bound.insertId]);
    assert.equal(Number(beforeAck.n), 0, "GET never advances the cursor");
    const wrong = await request(deviceA, "POST", "/recent/ack", { profileId: firstA.profileId, expectedBoundary: "f".repeat(64), acknowledgeToken: firstA.boundary.currentToken });
    assert.equal(wrong.status, 409);
    const acknowledged = await request(deviceA, "POST", "/recent/ack", { profileId: firstA.profileId, expectedBoundary: null, acknowledgeToken: firstA.boundary.currentToken });
    assert.equal(acknowledged.status, 200);
    assert.equal((await acknowledged.json()).unchanged, false);
    const repeated = await request(deviceB, "POST", "/recent/ack", { profileId: firstB.profileId, expectedBoundary: null, acknowledgeToken: firstB.boundary.currentToken });
    assert.equal(repeated.status, 200);
    assert.equal((await repeated.json()).unchanged, true);
    assert.equal((await readRecent(deviceB)).state, "caught-up", "another device shares the acknowledged boundary");
    assert.equal((await readRecent(deviceA)).state, "caught-up", "reload remains caught up");
    assert.equal((await request(deviceB, "POST", "/logout")).status, 200);
    deviceB = await login();
    assert.equal((await readRecent(deviceB)).state, "caught-up", "logout/login preserves the account cursor");
    console.log("Authenticated Recent Growth PASS: read-only GET, CAS POST, reload, multi-device and re-login");
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    try { if (user) await deleteUserWithGoals(db, user); }
    finally { uninstall(); delete globalThis.defineEventHandler; await db.end(); await rm(root, { recursive: true, force: true }); }
  }
});
