// Explicit deployment migration. Ordinary account requests never create this table.
import mysql from "mysql2/promise";
import { writeFile } from "node:fs/promises";
import { GROWTH_MEASUREMENT_TABLE_SQL } from "../server/services/growth-history/schema.ts";
import { auditGrowthMeasurementOrphans, inspectGrowthMeasurementSchema } from "../server/services/growth-history/audit.ts";

for (const key of ["TAIKO_DB_HOST", "TAIKO_DB_USER", "TAIKO_DB_NAME"]) if (!process.env[key]) throw Error("Explicit DB configuration required");
const apply = process.argv.includes("--apply");
const production = process.argv.includes("--production");
const db = await mysql.createConnection({ host: process.env.TAIKO_DB_HOST, port: Number(process.env.TAIKO_DB_PORT || 3306), user: process.env.TAIKO_DB_USER, password: process.env.TAIKO_DB_PASSWORD, database: process.env.TAIKO_DB_NAME });
try {
  const [[identity]] = await db.query<any[]>("SELECT DATABASE() AS name, VERSION() AS version");
  if (production) {
    if (!process.env.TAIKO_GROWTH_EXPECTED_DATABASE || identity.name !== process.env.TAIKO_GROWTH_EXPECTED_DATABASE || identity.name.endsWith("_test")) throw Error("Production database identity does not match explicit expectation");
    if (apply && process.env.TAIKO_ALLOW_GROWTH_PRODUCTION_MIGRATION !== "1") throw Error("Production migration opt-in required");
  } else {
    if (!identity.name?.endsWith("_test")) throw Error("Actual isolated _test database required");
    if (apply && process.env.TAIKO_ALLOW_TEST_DB_MUTATION !== "1") throw Error("Explicit test mutation opt-in required");
  }
  const before = await inspectGrowthMeasurementSchema(db);
  if (before.exists && before.errors.length) throw Error(`Existing Growth Measurement schema incompatible: ${before.errors.join(",")}`);
  if (apply) await db.execute(GROWTH_MEASUREMENT_TABLE_SQL);
  const after = await inspectGrowthMeasurementSchema(db);
  if (apply && (!after.exists || after.errors.length)) throw Error(`Migration verification failed: ${after.errors.join(",")}`);
  const orphans = after.exists ? await auditGrowthMeasurementOrphans(db) : null;
  if (orphans && Object.values(orphans).some(Boolean)) throw Error("Growth Measurement orphan audit failed");
  const report = { mode: production ? "production" : "test", action: apply ? "apply" : "inspect", database: identity.name, mysqlVersion: identity.version, previouslyExisted: before.exists, ...after, orphans };
  if (process.env.GROWTH_MIGRATION_REPORT) await writeFile(process.env.GROWTH_MIGRATION_REPORT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ mode: report.mode, action: report.action, database: report.database, previouslyExisted: before.exists, exists: after.exists, errors: after.errors, orphans }));
} finally {
  await db.end();
}
