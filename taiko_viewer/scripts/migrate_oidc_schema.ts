import mysql from "mysql2/promise";
import { OIDC_TABLES } from "../server/services/oidc/schema.ts";
import { installSchemaModuleLoader } from "./schema_module_loader.mjs";

for (const key of ["TAIKO_DB_HOST", "TAIKO_DB_USER", "TAIKO_DB_NAME"]) if (!process.env[key]) throw Error("Explicit DB configuration required");
const apply = process.argv.includes("--apply");
// This delivery intentionally has no production mutation mode.
if (process.argv.includes("--production")) throw Error("Production migration is not enabled in this delivery");
const db = await mysql.createConnection({ host: process.env.TAIKO_DB_HOST, port: Number(process.env.TAIKO_DB_PORT || 3306), user: process.env.TAIKO_DB_USER, password: process.env.TAIKO_DB_PASSWORD, database: process.env.TAIKO_DB_NAME });
const loader = installSchemaModuleLoader();
try {
  const [[identity]] = await db.query<any[]>("SELECT DATABASE() AS name");
  if (!identity.name?.endsWith("_test")) throw Error("Actual isolated _test database required");
  if (apply && process.env.TAIKO_ALLOW_TEST_DB_MUTATION !== "1") throw Error("Explicit test mutation opt-in required");
  const { schemaRequirement, validateSchemaTables } = await import("../server/utils/account-schema-runtime.ts");
  if (apply) for (const sql of OIDC_TABLES) await db.execute(sql);
  await validateSchemaTables(db as any, OIDC_TABLES.map(schemaRequirement), "oidc");
  console.log(JSON.stringify({ database: identity.name, action: apply ? "apply" : "inspect", valid: true }));
} finally { loader.deregister(); await db.end(); }
