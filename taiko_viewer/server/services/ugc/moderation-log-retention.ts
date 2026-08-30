import type { Connection } from "mysql2/promise";

const TABLE_NAME = "chart_ugc_moderation_logs";
const COLUMN_NAME = "operator_user_id";
const CANONICAL_CONSTRAINT_NAME = "fk_chart_ugc_moderation_operator";
const ALTERNATE_CONSTRAINT_NAME = "fk_chart_ugc_moderation_operator_retention";

type ForeignKeyState = {
  constraintName: string;
  referencedTable: string;
  referencedColumn: string;
  deleteRule: string;
};

export type ModerationLogRetentionState = {
  tableExists: boolean;
  columnType: string;
  nullable: boolean;
  totalLogs: number;
  nullOperatorLogs: number;
  foreignKeys: ForeignKeyState[];
};

const quoteIdentifier = (value: string) => {
  if (!/^[A-Za-z0-9_]+$/.test(value)) throw new Error(`unsafe SQL identifier: ${value}`);
  return `\`${value}\``;
};

const replacementConstraintName = (currentName: string) => currentName === CANONICAL_CONSTRAINT_NAME
  ? ALTERNATE_CONSTRAINT_NAME
  : CANONICAL_CONSTRAINT_NAME;

export const inspectModerationLogRetention = async (
  connection: Connection
): Promise<ModerationLogRetentionState> => {
  const [tableRows] = await connection.query<any[]>(
    `SELECT COUNT(*) AS count
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [TABLE_NAME]
  );
  const tableExists = Number(tableRows[0]?.count || 0) === 1;
  if (!tableExists) {
    return {
      tableExists: false,
      columnType: "",
      nullable: false,
      totalLogs: 0,
      nullOperatorLogs: 0,
      foreignKeys: []
    };
  }

  const [columnRows] = await connection.query<any[]>(
    `SELECT COLUMN_TYPE AS columnType, IS_NULLABLE AS isNullable
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [TABLE_NAME, COLUMN_NAME]
  );
  const [foreignKeyRows] = await connection.query<any[]>(
    `SELECT kcu.CONSTRAINT_NAME AS constraintName,
            kcu.REFERENCED_TABLE_NAME AS referencedTable,
            kcu.REFERENCED_COLUMN_NAME AS referencedColumn,
            rc.DELETE_RULE AS deleteRule
     FROM information_schema.KEY_COLUMN_USAGE kcu
     JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
       ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
      AND rc.TABLE_NAME = kcu.TABLE_NAME
      AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
     WHERE kcu.TABLE_SCHEMA = DATABASE()
       AND kcu.TABLE_NAME = ?
       AND kcu.COLUMN_NAME = ?
       AND kcu.REFERENCED_TABLE_NAME IS NOT NULL`,
    [TABLE_NAME, COLUMN_NAME]
  );
  const [countRows] = await connection.query<any[]>(
    `SELECT COUNT(*) AS totalLogs,
            SUM(CASE WHEN operator_user_id IS NULL THEN 1 ELSE 0 END) AS nullOperatorLogs
     FROM chart_ugc_moderation_logs`
  );
  const column = columnRows[0];
  return {
    tableExists: true,
    columnType: String(column?.columnType || "").toLowerCase(),
    nullable: String(column?.isNullable || "") === "YES",
    totalLogs: Number(countRows[0]?.totalLogs || 0),
    nullOperatorLogs: Number(countRows[0]?.nullOperatorLogs || 0),
    foreignKeys: foreignKeyRows.map((row) => ({
      constraintName: String(row.constraintName || ""),
      referencedTable: String(row.referencedTable || ""),
      referencedColumn: String(row.referencedColumn || ""),
      deleteRule: String(row.deleteRule || "").toUpperCase()
    }))
  };
};

const classifyState = (state: ModerationLogRetentionState) => {
  const foreignKey = state.foreignKeys[0];
  const sharedShape = state.tableExists
    && state.columnType === "bigint unsigned"
    && state.foreignKeys.length === 1
    && foreignKey?.referencedTable === "web_user_accounts"
    && foreignKey?.referencedColumn === "id";
  if (sharedShape && !state.nullable && foreignKey.deleteRule === "CASCADE") return "legacy";
  if (sharedShape && state.nullable && foreignKey.deleteRule === "SET NULL") return "retained";
  return "unknown";
};

const assertKnownState = (state: ModerationLogRetentionState) => {
  const classification = classifyState(state);
  if (classification === "unknown") {
    throw new Error(`unexpected ${TABLE_NAME}.${COLUMN_NAME} schema: ${JSON.stringify(state)}`);
  }
  return classification;
};

export const migrateModerationLogRetentionUp = async (connection: Connection) => {
  const before = await inspectModerationLogRetention(connection);
  const classification = assertKnownState(before);
  if (classification === "retained") return { changed: false, before, after: before };

  const constraintName = quoteIdentifier(before.foreignKeys[0].constraintName);
  const replacementName = quoteIdentifier(replacementConstraintName(before.foreignKeys[0].constraintName));
  await connection.query(
    `ALTER TABLE chart_ugc_moderation_logs
       DROP FOREIGN KEY ${constraintName},
       MODIFY operator_user_id BIGINT UNSIGNED NULL,
       ADD CONSTRAINT ${replacementName}
         FOREIGN KEY (operator_user_id) REFERENCES web_user_accounts(id) ON DELETE SET NULL`
  );
  const after = await inspectModerationLogRetention(connection);
  if (assertKnownState(after) !== "retained") throw new Error("audit log retention migration verification failed");
  return { changed: true, before, after };
};

export const migrateModerationLogRetentionDown = async (
  connection: Connection,
  options: { confirmed: boolean }
) => {
  if (!options.confirmed) throw new Error("down migration requires --confirm-audit-retention-rollback");
  const before = await inspectModerationLogRetention(connection);
  const classification = assertKnownState(before);
  if (classification === "legacy") return { changed: false, before, after: before };
  if (before.nullOperatorLogs > 0) {
    throw new Error(
      `refusing audit retention rollback: ${before.nullOperatorLogs} moderation log(s) have a deleted operator; no logs will be reassigned or deleted`
    );
  }

  const constraintName = quoteIdentifier(before.foreignKeys[0].constraintName);
  const replacementName = quoteIdentifier(replacementConstraintName(before.foreignKeys[0].constraintName));
  await connection.query(
    `ALTER TABLE chart_ugc_moderation_logs
       DROP FOREIGN KEY ${constraintName},
       MODIFY operator_user_id BIGINT UNSIGNED NOT NULL,
       ADD CONSTRAINT ${replacementName}
         FOREIGN KEY (operator_user_id) REFERENCES web_user_accounts(id) ON DELETE CASCADE`
  );
  const after = await inspectModerationLogRetention(connection);
  if (assertKnownState(after) !== "legacy") throw new Error("audit log retention rollback verification failed");
  return { changed: true, before, after };
};
