import mysql from "mysql2/promise";
import { INBOUND_EXTERNAL_TABLES } from "../server/services/oidc/inbound-schema.ts";
import { installSchemaModuleLoader } from "./schema_module_loader.mjs";

// Independent, explicit and identity-fenced migration; never called by a request.
const flags = new Set(process.argv.slice(2));
if ([...flags].some(flag => !["--apply", "--production"].includes(flag))) throw Error("Unknown inbound migration argument");
const apply = flags.has("--apply"), production = flags.has("--production");
for (const name of ["TAIKO_DB_HOST", "TAIKO_DB_USER", "TAIKO_DB_NAME"]) if (!process.env[name]) throw Error("Explicit DB configuration required");
if (production) {
  const expected = process.env.TAIKO_INBOUND_EXPECTED_DATABASE;
  if (!expected || expected.endsWith("_test") || expected !== process.env.TAIKO_DB_NAME)
    throw Error("Expected non-test production DB identity required");
  if (apply && process.env.TAIKO_ALLOW_INBOUND_PRODUCTION_MIGRATION !== "1")
    throw Error("Explicit inbound production migration opt-in required");
} else if (apply && process.env.TAIKO_ALLOW_TEST_DB_MUTATION !== "1") {
  throw Error("Explicit test database mutation opt-in required");
}
const db = await mysql.createConnection({
  host:process.env.TAIKO_DB_HOST,
  port:Number(process.env.TAIKO_DB_PORT || 3306),
  user:process.env.TAIKO_DB_USER,
  password:process.env.TAIKO_DB_PASSWORD,
  database:process.env.TAIKO_DB_NAME
});
const loader = installSchemaModuleLoader();
try {
  const [[identity]] = await db.query<any[]>("SELECT DATABASE() name,VERSION() version");
  if (!identity?.name || (production
      ? identity.name !== process.env.TAIKO_INBOUND_EXPECTED_DATABASE || identity.name.endsWith("_test")
      : !identity.name.endsWith("_test"))) throw Error("Actual SQL database identity rejected");
  const { schemaRequirement, validateSchemaTables } = await import("../server/utils/account-schema-runtime.ts");
  if (apply) for (const sql of INBOUND_EXTERNAL_TABLES) await db.execute(sql);
  await validateSchemaTables(db as any, INBOUND_EXTERNAL_TABLES.map(schemaRequirement), "inbound-external");
  console.log(JSON.stringify({mode:production?"production":"test",action:apply?"apply":"inspect",database:identity.name,valid:true}));
} finally { loader.deregister(); await db.end(); }
