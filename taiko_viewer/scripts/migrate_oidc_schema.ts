import mysql from "mysql2/promise";
import { OIDC_TABLES } from "../server/services/oidc/schema.ts";
import { installSchemaModuleLoader } from "./schema_module_loader.mjs";

// Explicit OIDC DDL only. Never migrate at startup or during requests.
const flags = new Set(process.argv.slice(2));
if ([...flags].some(flag => !["--apply", "--production"].includes(flag))) throw Error("Unknown OIDC migration argument");
const apply = flags.has("--apply");
const production = flags.has("--production");
for (const key of ["TAIKO_DB_HOST", "TAIKO_DB_USER", "TAIKO_DB_NAME"]) if (!process.env[key]) throw Error("Explicit DB configuration required");
if (production) {
  const expected = process.env.TAIKO_OIDC_EXPECTED_DATABASE;
  if (!expected || expected.endsWith("_test") || expected !== process.env.TAIKO_DB_NAME)
    throw Error("Explicit, non-test production DB expectation required");
  if (apply && process.env.TAIKO_ALLOW_OIDC_PRODUCTION_MIGRATION !== "1")
    throw Error("Explicit OIDC production migration opt-in required");
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
  const [[identity]] = await db.query<any[]>("SELECT DATABASE() AS name, VERSION() AS version");
  if (!identity?.name) throw Error("No active database");
  if (production) {
    if (identity.name !== process.env.TAIKO_OIDC_EXPECTED_DATABASE || identity.name.endsWith("_test"))
      throw Error("Actual production database identity does not match expected database");
  } else if (!identity.name.endsWith("_test")) {
    throw Error("Actual isolated _test database required");
  }
  const { schemaRequirement, validateSchemaTables } = await import("../server/utils/account-schema-runtime.ts");
  if (apply) for (const sql of OIDC_TABLES) await db.execute(sql);
  await validateSchemaTables(db as any, OIDC_TABLES.map(schemaRequirement), "oidc");
  console.log(JSON.stringify({
    mode: production ? "production" : "test",
    database: identity.name,
    mysqlVersion: identity.version,
    action: apply ? "apply" : "inspect",
    valid: true
  }));
} finally {
  loader.deregister();
  await db.end();
}
