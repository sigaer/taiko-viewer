import { ACCOUNT_TITLE_TABLE_SQL } from "../server/services/account-titles/schema.ts";
import { openAccountTitleDb } from "./account_title_db.mjs";
import { installSchemaModuleLoader } from "./schema_module_loader.mjs";

const flags = new Set(process.argv.slice(2));
if ([...flags].some(flag => !["--apply", "--production"].includes(flag))) throw Error("Unknown account title migration flag");
const apply = flags.has("--apply");
const connection = await openAccountTitleDb({ production: flags.has("--production"), apply });
const loader = installSchemaModuleLoader();
try {
  const { schemaRequirement, validateSchemaTables } = await import("../server/utils/account-schema-runtime.ts");
  if (apply) await connection.db.execute(ACCOUNT_TITLE_TABLE_SQL);
  await validateSchemaTables(connection.db as any, [schemaRequirement(ACCOUNT_TITLE_TABLE_SQL)], "account-titles");
  console.log(JSON.stringify({ database: connection.database, action: apply ? "migrate" : "inspect", valid: true }));
} finally { loader.deregister(); await connection.close(); }
