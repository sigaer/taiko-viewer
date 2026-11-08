import mysql from "mysql2/promise";
import { assertTestDatabaseMutationAllowed } from "./annual_test_db_guard.mjs";

export async function openAccountTitleDb({ production, apply }) {
  for (const key of ["TAIKO_DB_HOST", "TAIKO_DB_USER", "TAIKO_DB_NAME"]) {
    if (!process.env[key]) throw Error("Explicit account title database configuration required");
  }
  const pool = mysql.createPool({ host: process.env.TAIKO_DB_HOST, port: Number(process.env.TAIKO_DB_PORT || 3306),
    user: process.env.TAIKO_DB_USER, password: process.env.TAIKO_DB_PASSWORD, database: process.env.TAIKO_DB_NAME,
    connectionLimit: 1, connectTimeout: 5000, charset: "utf8mb4" });
  let db;
  try {
    db = await pool.getConnection();
    const [[identity]] = await db.query("SELECT DATABASE() AS name");
    if (production) {
      if (!identity.name || identity.name.endsWith("_test") || identity.name !== process.env.TAIKO_ACCOUNT_TITLES_EXPECTED_DATABASE) {
        throw Error("Actual production database must match the explicit account title expectation");
      }
      if (apply && process.env.TAIKO_ALLOW_ACCOUNT_TITLES_PRODUCTION_MUTATION !== "1") throw Error("Explicit account title production mutation opt-in required");
    } else {
      if (!String(identity.name).endsWith("_test")) throw Error("Actual isolated _test database required");
      if (apply) await assertTestDatabaseMutationAllowed(db);
    }
    await db.query("SET SESSION MAX_EXECUTION_TIME=10000");
    await db.query("SET SESSION innodb_lock_wait_timeout=10");
    return { db, database: identity.name, close: async () => { db.release(); await pool.end(); } };
  } catch (error) { db?.release(); await pool.end(); throw error; }
}
