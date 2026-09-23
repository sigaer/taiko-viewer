import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import { GROWTH_RECENT_CURSOR_TABLE_SQL } from "../server/services/growth-recent/schema.ts";
import { auditGrowthRecentCursorOrphans, inspectGrowthRecentCursorSchema } from "../server/services/growth-recent/audit.ts";
import { GROWTH_RECENT_ALGORITHM_VERSION, readRecentCursor, writeRecentCursor } from "../server/services/growth-recent/store.ts";
import { GOAL_TABLE_SQL } from "../server/services/goals/schema.ts";
import { GROWTH_MEASUREMENT_TABLE_SQL } from "../server/services/growth-history/schema.ts";
import { deleteBindingsWithGoals, deleteUserWithGoals } from "../server/services/goals/lifecycle.ts";

for (const key of ["TAIKO_DB_HOST", "TAIKO_DB_USER", "TAIKO_DB_NAME"]) assert.ok(process.env[key], "Explicit isolated DB configuration required");
const db = mysql.createPool({ host: process.env.TAIKO_DB_HOST, port: Number(process.env.TAIKO_DB_PORT || 3306), user: process.env.TAIKO_DB_USER, password: process.env.TAIKO_DB_PASSWORD, database: process.env.TAIKO_DB_NAME, connectionLimit: 3 });
let user = 0;
let binding = 0;

test("real SQL Recent cursor migration, persistence, isolation, audit and cleanup", async () => {
  try {
    const [[identity]] = await db.query<any[]>("SELECT DATABASE() AS name");
    assert.ok(identity.name.endsWith("_test"), "Actual database must end in _test");
    assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION, "1", "Explicit test mutation opt-in required");
    await db.execute(GOAL_TABLE_SQL);
    await db.execute(GROWTH_MEASUREMENT_TABLE_SQL);
    await db.execute(GROWTH_RECENT_CURSOR_TABLE_SQL);
    await db.execute(GROWTH_RECENT_CURSOR_TABLE_SQL);
    const schema = await inspectGrowthRecentCursorSchema(db);
    assert.equal(schema.exists, true);
    assert.deepEqual(schema.errors, []);
    assert.deepEqual(schema.foreignKeys, []);
    const suffix = randomUUID().slice(0, 8);
    const [createdUser] = await db.execute<any>("INSERT INTO web_user_accounts (username,email,password_hash) VALUES (?,?,?)", [`recent-${suffix}`, `recent-${suffix}@example.test`, "fixture-no-login"]);
    user = createdUser.insertId;
    const [createdBinding] = await db.execute<any>("INSERT INTO web_taiko_bindings (user_id,taiko_id,source,is_current) VALUES (?,?,'wahlap',1)", [user, `recent-${suffix}`]);
    binding = createdBinding.insertId;
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await writeRecentCursor(connection, { userId: user, bindingId: binding, token: "a".repeat(64), observationRevision: "b".repeat(64), observedAt: "2026-09-23T03:04:05.000Z" });
      await connection.commit();
    } finally { connection.release(); }
    const cursor = await readRecentCursor(db, user, binding);
    assert.equal(cursor?.token, "a".repeat(64));
    assert.equal(cursor?.algorithmVersion, GROWTH_RECENT_ALGORITHM_VERSION);
    assert.equal(await readRecentCursor(db, user + 1, binding), null);
    assert.deepEqual(await auditGrowthRecentCursorOrphans(db), { userOrphans: 0, bindingOrphans: 0, ownerMismatches: 0 });
    await deleteBindingsWithGoals(db, user, { bindingId: binding });
    assert.equal(await readRecentCursor(db, user, binding), null);
    binding = 0;
    const [replacement] = await db.execute<any>("INSERT INTO web_taiko_bindings (user_id,taiko_id,source,is_current) VALUES (?,?,'wahlap',1)", [user, `delete-${suffix}`]);
    const replacementConnection = await db.getConnection();
    try {
      await replacementConnection.beginTransaction();
      await writeRecentCursor(replacementConnection, { userId: user, bindingId: replacement.insertId, token: "c".repeat(64), observationRevision: "d".repeat(64), observedAt: "2026-09-23T04:05:06.000Z" });
      await replacementConnection.commit();
    } finally { replacementConnection.release(); }
    await deleteUserWithGoals(db, user);
    assert.equal(await readRecentCursor(db, user, replacement.insertId), null);
    user = 0;
  } finally {
    try { if (user) await deleteUserWithGoals(db, user); }
    finally { await db.end(); }
  }
});
