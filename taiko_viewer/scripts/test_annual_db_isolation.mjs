import assert from "node:assert/strict";
import mysql from "mysql2/promise";
import { assertTestDatabaseMutationAllowed, assertTestDatabaseReadOnly } from "./annual_test_db_guard.mjs";

const config = {
  host: String(process.env.TAIKO_DB_HOST || ""),
  port: Number(process.env.TAIKO_DB_PORT || 3306),
  user: String(process.env.TAIKO_DB_USER || ""),
  password: String(process.env.TAIKO_DB_PASSWORD || ""),
  database: String(process.env.TAIKO_DB_NAME || "")
};
if (!config.host || !config.user || !config.password || !config.database) throw new Error("test DB env is incomplete");

const connection = await mysql.createConnection({ ...config, charset: "utf8mb4" });
let probeCreated = false;
try {
  const identity = await assertTestDatabaseReadOnly(connection);
  assert.equal(identity.databaseName, "taiko_annual_poster_test");
  assert.equal(identity.currentUser, "taiko_viewer_test@127.0.0.1");

  const missingOptIn = await import("./annual_test_db_guard.mjs?missing-opt-in");
  const originalOptIn = process.env.TAIKO_ALLOW_TEST_DB_MUTATION;
  delete process.env.TAIKO_ALLOW_TEST_DB_MUTATION;
  await assert.rejects(() => missingOptIn.assertTestDatabaseMutationAllowed(connection), /Refusing mutating DB operation/);
  if (originalOptIn === undefined) delete process.env.TAIKO_ALLOW_TEST_DB_MUTATION;
  else process.env.TAIKO_ALLOW_TEST_DB_MUTATION = originalOptIn;

  const wrongDbConnection = {
    query: async (sql) => {
      if (sql.startsWith("SELECT DATABASE")) return [[{ databaseName: "taiko", currentUser: "test@127.0.0.1" }]];
      if (sql === "SHOW GRANTS") return [[{ grant: "GRANT ALL PRIVILEGES ON `taiko`.* TO `test`@`127.0.0.1`" }]];
      throw new Error(`unexpected wrong-db probe: ${sql}`);
    }
  };
  await assert.rejects(() => assertTestDatabaseMutationAllowed(wrongDbConnection), /Refusing mutating DB operation/);

  assert.equal(originalOptIn, "1", "Explicit mutation opt-in is required");
  const grants = await assertTestDatabaseMutationAllowed(connection);
  await connection.execute("CREATE TABLE IF NOT EXISTS annual_phase_b_test_guard_probe (id INT PRIMARY KEY, value VARCHAR(32) NOT NULL)");
  probeCreated = true;
  await connection.execute("INSERT INTO annual_phase_b_test_guard_probe (id, value) VALUES (1, 'synthetic')");
  const [rows] = await connection.query("SELECT id, value FROM annual_phase_b_test_guard_probe WHERE id = 1");
  assert.deepEqual(rows.map((row) => ({ id: Number(row.id), value: row.value })), [{ id: 1, value: "synthetic" }]);
  await connection.execute("DELETE FROM annual_phase_b_test_guard_probe WHERE id = 1");
  await connection.execute("DROP TABLE annual_phase_b_test_guard_probe");
  probeCreated = false;
  console.log(JSON.stringify({ ok: true, databaseName: grants.databaseName, currentUser: grants.currentUser, missingOptIn: "PASS", wrongDatabase: "PASS", positiveMutation: "PASS" }));
} finally {
  if (probeCreated) await connection.execute("DROP TABLE IF EXISTS annual_phase_b_test_guard_probe");
  await connection.end();
}
