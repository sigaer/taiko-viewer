import mysql from "mysql2/promise";
import {
  DAILY_VISITORS_TABLE_SQL,
  USER_DAILY_ACTIVITY_SEED_SQL,
  USER_DAILY_ACTIVITY_TABLE_SQL
} from "../server/services/user-activity/schema.ts";
import { installSchemaModuleLoader } from "./schema_module_loader.mjs";

// Explicit DDL for web_user_daily_activity (+ one-time seed) and web_daily_visitors. Never runs at startup or during requests.
// Usage: node --experimental-strip-types scripts/migrate_user_activity_schema.ts [--apply] [--production]
const flags = new Set(process.argv.slice(2));
if ([...flags].some(flag => !["--apply", "--production"].includes(flag))) throw Error("Unknown migration argument");
const apply = flags.has("--apply");
const production = flags.has("--production");
for (const key of ["TAIKO_DB_HOST", "TAIKO_DB_USER", "TAIKO_DB_NAME"]) if (!process.env[key]) throw Error("Explicit DB configuration required");
if (production) {
  const expected = process.env.TAIKO_ACTIVITY_EXPECTED_DATABASE;
  if (!expected || expected.endsWith("_test") || expected !== process.env.TAIKO_DB_NAME)
    throw Error("Explicit, non-test production DB expectation required");
  if (apply && process.env.TAIKO_ALLOW_ACTIVITY_PRODUCTION_MIGRATION !== "1")
    throw Error("Explicit production migration opt-in required");
} else if (apply && process.env.TAIKO_ALLOW_TEST_DB_MUTATION !== "1") {
  throw Error("Explicit test mutation opt-in required");
}
const db = await mysql.createConnection({
  host: process.env.TAIKO_DB_HOST,
  port: Number(process.env.TAIKO_DB_PORT || 3306),
  user: process.env.TAIKO_DB_USER,
  password: process.env.TAIKO_DB_PASSWORD,
  database: process.env.TAIKO_DB_NAME
});
const loader = installSchemaModuleLoader();
try {
  const [[identity]] = await db.query<any[]>("SELECT DATABASE() AS name");
  if (!identity?.name) throw Error("No active database");
  if (production) {
    if (identity.name !== process.env.TAIKO_ACTIVITY_EXPECTED_DATABASE || identity.name.endsWith("_test"))
      throw Error("Actual production database identity does not match expected database");
  } else if (!identity.name.endsWith("_test")) {
    throw Error("Actual isolated _test database required");
  }
  const { schemaRequirement, validateSchemaTables } = await import("../server/utils/account-schema-runtime.ts");
  let seededRows = 0;
  if (apply) {
    await db.execute(USER_DAILY_ACTIVITY_TABLE_SQL);
    await db.execute(DAILY_VISITORS_TABLE_SQL);
    const [[existing]] = await db.query<any[]>("SELECT COUNT(*) AS total FROM web_user_daily_activity");
    if (Number(existing?.total || 0) === 0) {
      const [result] = await db.execute<any>(USER_DAILY_ACTIVITY_SEED_SQL);
      seededRows = Number(result?.affectedRows || 0);
    }
  }
  await validateSchemaTables(db as any, [USER_DAILY_ACTIVITY_TABLE_SQL, DAILY_VISITORS_TABLE_SQL].map(schemaRequirement), "user-activity");
  console.log(JSON.stringify({
    mode: production ? "production" : "test",
    database: identity.name,
    action: apply ? "apply" : "inspect",
    seededRows,
    valid: true
  }));
} finally {
  loader.deregister();
  await db.end();
}
