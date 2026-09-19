import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import { GROWTH_MEASUREMENT_TABLE_SQL } from "../server/services/growth-history/schema.ts";
import { auditGrowthMeasurementOrphans, inspectGrowthMeasurementSchema } from "../server/services/growth-history/audit.ts";
import { readGrowthMeasurements, upsertGrowthMeasurement } from "../server/services/growth-history/measurements.ts";
import { deleteBindingsWithGoals, deleteUserWithGoals } from "../server/services/goals/lifecycle.ts";
import { GOAL_TABLE_SQL } from "../server/services/goals/schema.ts";
import { buildPlayerGrowthState, GROWTH_DIMENSION_ORDER } from "../utils/playerGrowth.ts";

for (const key of ["TAIKO_DB_HOST", "TAIKO_DB_USER", "TAIKO_DB_NAME"]) assert.ok(process.env[key], "Explicit isolated DB configuration required");
const db = mysql.createPool({ host: process.env.TAIKO_DB_HOST, port: Number(process.env.TAIKO_DB_PORT || 3306), user: process.env.TAIKO_DB_USER, password: process.env.TAIKO_DB_PASSWORD, database: process.env.TAIKO_DB_NAME, connectionLimit: 4 });
let user = 0;
let other = 0;
let binding = 0;
let otherBinding = 0;
const suffix = randomUUID().slice(0, 8);
const playerState = buildPlayerGrowthState(GROWTH_DIMENSION_ORDER.map(key => ({ key, value: key === "accuracy_power" ? 9 : 10 })), 30, "FULL_HISTORY", 10.28);

test("real SQL measurement migration, uniqueness, isolation, audit and cleanup", async () => {
  try {
    const [[identity]] = await db.query<any[]>("SELECT DATABASE() AS name");
    assert.ok(identity.name.endsWith("_test"), "Actual database must end in _test");
    assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION, "1", "Explicit test mutation opt-in required");
    await db.execute(`CREATE TABLE IF NOT EXISTS web_user_accounts (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(64) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await db.execute(`CREATE TABLE IF NOT EXISTS web_taiko_bindings (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      taiko_id VARCHAR(25) NOT NULL UNIQUE,
      source VARCHAR(16) NOT NULL DEFAULT 'wahlap',
      is_current TINYINT(1) NOT NULL DEFAULT 0,
      KEY idx_test_binding_owner (user_id,is_current)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await db.execute("CREATE TABLE IF NOT EXISTS web_user_sessions (session_token CHAR(64) PRIMARY KEY,user_id BIGINT UNSIGNED NOT NULL) ENGINE=InnoDB");
    await db.execute("CREATE TABLE IF NOT EXISTS web_song_locks (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,user_id BIGINT UNSIGNED NOT NULL,taiko_id VARCHAR(25) NOT NULL) ENGINE=InnoDB");
    await db.execute(GOAL_TABLE_SQL);
    await db.execute(GROWTH_MEASUREMENT_TABLE_SQL);
    await db.execute(GROWTH_MEASUREMENT_TABLE_SQL);
    const schema = await inspectGrowthMeasurementSchema(db);
    assert.equal(schema.exists, true);
    assert.deepEqual(schema.errors, []);
    assert.deepEqual(schema.foreignKeys, []);
    for (const label of ["owner", "other"]) {
      const [result] = await db.execute<any>("INSERT INTO web_user_accounts (username,email,password_hash) VALUES (?,?,?)", [`growth-${label}-${suffix}`, `growth-${label}-${suffix}@example.test`, "fixture-no-login"]);
      if (label === "owner") user = result.insertId; else other = result.insertId;
    }
    const [firstBinding] = await db.execute<any>("INSERT INTO web_taiko_bindings (user_id,taiko_id,source,is_current) VALUES (?,?,'wahlap',1)", [user, `gh-a-${suffix}`]);
    binding = firstBinding.insertId;
    const [secondBinding] = await db.execute<any>("INSERT INTO web_taiko_bindings (user_id,taiko_id,source,is_current) VALUES (?,?,'wahlap',1)", [other, `gh-b-${suffix}`]);
    otherBinding = secondBinding.insertId;
    const input = { userId: user, bindingId: binding, scoreRevision: "a".repeat(64), capturedAt: "2026-09-19T01:00:00.000Z", modelRevision: "b".repeat(64), playerState };
    const concurrent = await Promise.all([upsertGrowthMeasurement(db, input), upsertGrowthMeasurement(db, input)]);
    assert.equal(concurrent.filter(result => result.created).length, 1);
    assert.equal((await readGrowthMeasurements(db, user, binding, "2026-09-18T16:00:00.000Z", "2026-09-19T16:00:00.000Z")).length, 1);
    assert.equal((await readGrowthMeasurements(db, other, binding, "2026-09-18T16:00:00.000Z", "2026-09-19T16:00:00.000Z")).length, 0);
    assert.deepEqual(await upsertGrowthMeasurement(db, { ...input, userId: other }), { created: false });
    await db.execute(`INSERT INTO web_growth_measurements
      (user_id,binding_id,score_revision,measurement_version,algorithm_version,model_revision,rating,dimensions_json,focus,sample_count,availability_state,captured_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [user, binding, input.scoreRevision, 1, "growth-v2", input.modelRevision, 10.28, "{}", "balanced", 30, "ready", "2026-09-19 01:00:00.000"]);
    const [[versions]] = await db.query<any[]>("SELECT COUNT(*) AS n FROM web_growth_measurements WHERE binding_id=? AND score_revision=?", [binding, input.scoreRevision]);
    assert.equal(Number(versions.n), 2, "algorithm boundary permits a distinct measurement");
    assert.deepEqual(await auditGrowthMeasurementOrphans(db), { userOrphans: 0, bindingOrphans: 0, ownerMismatches: 0 });
    await deleteBindingsWithGoals(db, user, { bindingId: binding });
    const [[removed]] = await db.query<any[]>("SELECT COUNT(*) AS n FROM web_growth_measurements WHERE binding_id=?", [binding]);
    assert.equal(Number(removed.n), 0);
    binding = 0;
    await db.execute(`INSERT INTO web_growth_measurements
      (user_id,binding_id,score_revision,measurement_version,algorithm_version,model_revision,rating,dimensions_json,focus,sample_count,availability_state,captured_at)
      VALUES (999999999,999999999,?,1,'growth-v1',NULL,NULL,'{}','insufficient-data',0,'insufficient','2026-09-19')`, ["c".repeat(64)]);
    const audit = await auditGrowthMeasurementOrphans(db);
    assert.equal(audit.userOrphans, 1);
    assert.equal(audit.bindingOrphans, 1);
    await db.execute("DELETE FROM web_growth_measurements WHERE user_id=999999999");
    assert.deepEqual(await auditGrowthMeasurementOrphans(db), { userOrphans: 0, bindingOrphans: 0, ownerMismatches: 0 });
  } finally {
    try {
      if (user) await deleteUserWithGoals(db, user);
      if (other) await deleteUserWithGoals(db, other);
    } finally {
      await db.end();
    }
  }
});
