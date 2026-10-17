// Explicit administrative bootstrap only. Never imported by a server plugin or route.
import { GOAL_TABLE_SQL } from "../services/goals/schema";
import { GROWTH_MEASUREMENT_TABLE_SQL } from "../services/growth-history/schema";
import { GROWTH_RECENT_CURSOR_TABLE_SQL } from "../services/growth-recent/schema";
import type { RowDataPacket } from "mysql2/promise";
import { getAccountDb } from "./account-db";
import { CREATE_TABLES, MIGRATIONS, BIND_TABLE_CREATE_SQL } from "./account-schema-definition";
import { BETA_TABLES, BETA_MIGRATIONS } from "../services/annual-beta/schema";
const runMigration = async (statement: string) => {
  const db = getAccountDb();
  try {
    await db.execute(statement);
  } catch (error: any) {
    const code = String(error?.code || "");
    const errno = Number(error?.errno || 0);
    if (
      code === "ER_DUP_FIELDNAME" ||
      code === "ER_DUP_KEYNAME" ||
      code === "ER_TABLE_EXISTS_ERROR" ||
      code === "ER_CANT_DROP_FIELD_OR_KEY" ||
      errno === 1060 ||
      errno === 1061 ||
      errno === 1050 ||
      errno === 1091
    ) {
      return;
    }
    throw error;
  }
};

type ColumnRow = {
  Field: string;
  Type: string;
  Null: "YES" | "NO";
  Key: string;
  Default: string | null;
  Extra: string;
} & RowDataPacket;

type IndexRow = {
  Key_name: string;
  Column_name: string;
  Non_unique: number;
  Seq_in_index: number;
} & RowDataPacket;

const ensureBindTableSchema = async () => {
  const db = getAccountDb();
  await db.execute(BIND_TABLE_CREATE_SQL);

  const [columnRows] = await db.query<ColumnRow[]>("SHOW COLUMNS FROM bind");
  const columnNames = new Set(columnRows.map((row) => String(row.Field || "").trim()));

  const primaryColumns = columnRows
    .filter((row) => row.Key === "PRI")
    .sort((a, b) => String(a.Field).localeCompare(String(b.Field)))
    .map((row) => String(row.Field || "").trim());
  const hasPrimaryKeyOnRowId = primaryColumns.length === 1 && primaryColumns[0] === "row_id";

  if (!hasPrimaryKeyOnRowId && primaryColumns.length > 0) {
    await db.execute("ALTER TABLE bind DROP PRIMARY KEY");
  }

  if (!columnNames.has("row_id")) {
    await db.execute(
      "ALTER TABLE bind ADD COLUMN row_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST"
    );
  } else if (!hasPrimaryKeyOnRowId) {
    await db.execute("ALTER TABLE bind ADD PRIMARY KEY (row_id)");
  }

  if (!columnNames.has("slot_index")) {
    await db.execute("ALTER TABLE bind ADD COLUMN slot_index INT NOT NULL DEFAULT 1 AFTER visible");
  }
  if (!columnNames.has("is_current")) {
    await db.execute("ALTER TABLE bind ADD COLUMN is_current TINYINT(1) NOT NULL DEFAULT 1 AFTER slot_index");
  }
  if (!columnNames.has("source")) {
    await db.execute(
      "ALTER TABLE bind ADD COLUMN source VARCHAR(16) NOT NULL DEFAULT 'wahlap' AFTER is_current"
    );
  }
  if (!columnNames.has("created_at")) {
    // Keep legacy rows un-timestamped so a schema rollout does not count every
    // historical bot binding as a binding created today.
    await db.execute(
      "ALTER TABLE bind ADD COLUMN created_at DATETIME NULL DEFAULT NULL AFTER source"
    );
  }
  await db.execute(
    "ALTER TABLE bind MODIFY COLUMN created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP AFTER source"
  );

  await db.execute(
    "UPDATE bind SET slot_index = 1 WHERE slot_index IS NULL OR slot_index <= 0"
  );
  await db.execute(
    "UPDATE bind SET is_current = 1 WHERE is_current IS NULL"
  );
  await db.execute(
    "UPDATE bind SET source = 'wahlap' WHERE source IS NULL OR TRIM(source) = ''"
  );

  const [indexRows] = await db.query<IndexRow[]>("SHOW INDEX FROM bind");
  const indexNames = new Set(indexRows.map((row) => String(row.Key_name || "").trim()));
  if (!indexNames.has("uniq_bind_identity_slot")) {
    await db.execute("ALTER TABLE bind ADD UNIQUE KEY uniq_bind_identity_slot (qq, slot_index)");
  }
  if (!indexNames.has("uniq_bind_identity_taiko")) {
    await db.execute("ALTER TABLE bind ADD UNIQUE KEY uniq_bind_identity_taiko (qq, id)");
  }
  if (!indexNames.has("idx_bind_identity_current")) {
    await db.execute("ALTER TABLE bind ADD KEY idx_bind_identity_current (qq, is_current)");
  }
  if (!indexNames.has("idx_bind_created_at")) {
    await db.execute("ALTER TABLE bind ADD KEY idx_bind_created_at (created_at)");
  }
};

const ensureAnnualSummaryRetentionSchema = async () => {
  const db = getAccountDb();
  const [rows] = await db.query<IndexRow[]>("SHOW INDEX FROM web_annual_summaries");
  const indexes = new Map<string, { nonUnique: number; columns: Array<{ sequence: number; name: string }> }>();
  for (const row of rows) {
    const key = String(row.Key_name || "");
    const entry = indexes.get(key) || { nonUnique: Number(row.Non_unique), columns: [] };
    entry.columns.push({ sequence: Number(row.Seq_in_index), name: String(row.Column_name || "") });
    indexes.set(key, entry);
  }
  for (const [name, index] of indexes) {
    const columns = index.columns.sort((left, right) => left.sequence - right.sequence).map((item) => item.name);
    if (name !== "PRIMARY" && index.nonUnique === 0 && columns.join(",") === "user_id,binding_id,version_key") {
      const safeName = name.replace(/`/g, "``");
      await db.execute(`ALTER TABLE web_annual_summaries DROP INDEX \`${safeName}\``);
    }
  }
};

export const initializeAccountSchema = async () => {
  const db = getAccountDb();
  for (const statement of [...CREATE_TABLES, ...BETA_TABLES, GOAL_TABLE_SQL, GROWTH_MEASUREMENT_TABLE_SQL, GROWTH_RECENT_CURSOR_TABLE_SQL]) await db.execute(statement);
  for (const statement of [...MIGRATIONS, ...BETA_MIGRATIONS]) await runMigration(statement);
  await ensureAnnualSummaryRetentionSchema();
  await ensureBindTableSchema();
};
