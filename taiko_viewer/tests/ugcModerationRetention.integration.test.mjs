import assert from "node:assert/strict";
import test from "node:test";
import mysql from "mysql2/promise";
import {
  inspectModerationLogRetention,
  migrateModerationLogRetentionDown,
  migrateModerationLogRetentionUp
} from "../server/services/ugc/moderation-log-retention.ts";

const config = {
  host: String(process.env.TAIKO_DB_HOST || ""),
  port: Number(process.env.TAIKO_DB_PORT || 3306),
  user: String(process.env.TAIKO_DB_USER || ""),
  password: String(process.env.TAIKO_DB_PASSWORD || ""),
  database: String(process.env.TAIKO_DB_NAME || "")
};
if (!config.host || !config.user || !config.database) {
  throw new Error("isolated UGC integration database configuration is required");
}

const connection = await mysql.createConnection({ ...config, charset: "utf8mb4" });

test("audit retention migration is reversible only before operators are deleted", async () => {
  await connection.execute("DELETE FROM chart_ugc_moderation_logs");
  await connection.execute("DELETE FROM web_user_accounts WHERE id IN (991401, 991402)");

  await migrateModerationLogRetentionDown(connection, { confirmed: true });
  const legacy = await inspectModerationLogRetention(connection);
  assert.equal(legacy.columnType, "bigint unsigned");
  assert.equal(legacy.nullable, false);
  assert.equal(legacy.foreignKeys[0].deleteRule, "CASCADE");

  const firstUp = await migrateModerationLogRetentionUp(connection);
  assert.equal(firstUp.changed, true);
  const idempotentUp = await migrateModerationLogRetentionUp(connection);
  assert.equal(idempotentUp.changed, false);
  assert.equal(idempotentUp.after.columnType, "bigint unsigned");
  assert.equal(idempotentUp.after.nullable, true);
  assert.equal(idempotentUp.after.foreignKeys[0].deleteRule, "SET NULL");

  const safeDown = await migrateModerationLogRetentionDown(connection, { confirmed: true });
  assert.equal(safeDown.changed, true);
  await migrateModerationLogRetentionUp(connection);

  await connection.execute(
    "INSERT INTO web_user_accounts (id, username, email, password_hash) VALUES (991401, 'retention-operator', 'retention-operator@example.test', 'hash')"
  );
  await connection.execute(
    "INSERT INTO chart_ugc_moderation_logs (target_type, target_id, operator_user_id, action, reason, created_at) VALUES ('tip', 991402, 991401, 'hide', 'migration retention behavior', '2026-08-30 13:14:15')"
  );
  await connection.execute("DELETE FROM web_user_accounts WHERE id = 991401");

  const [rows] = await connection.query(
    "SELECT target_type AS targetType, target_id AS targetId, operator_user_id AS operatorUserId, action, reason, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt FROM chart_ugc_moderation_logs WHERE target_id = 991402"
  );
  assert.deepEqual(rows, [{
    targetType: "tip",
    targetId: 991402,
    operatorUserId: null,
    action: "hide",
    reason: "migration retention behavior",
    createdAt: "2026-08-30 13:14:15"
  }]);
  await assert.rejects(
    migrateModerationLogRetentionDown(connection, { confirmed: true }),
    /refusing audit retention rollback: 1 moderation log\(s\) have a deleted operator/
  );
  await assert.rejects(
    migrateModerationLogRetentionDown(connection, { confirmed: false }),
    /requires --confirm-audit-retention-rollback/
  );
});

test.after(async () => {
  await connection.execute("DELETE FROM chart_ugc_moderation_logs WHERE target_id = 991402");
  await connection.execute("DELETE FROM web_user_accounts WHERE id IN (991401, 991402)");
  await migrateModerationLogRetentionUp(connection);
  await connection.end();
});
