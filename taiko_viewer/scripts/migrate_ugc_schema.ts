#!/usr/bin/env node
import mysql, { type Connection } from "mysql2/promise";
import { UGC_CREATE_TABLE_STATEMENTS, UGC_DROP_TABLE_STATEMENTS, UGC_TABLE_NAMES } from "../server/services/ugc/schema.ts";

const args = new Set(process.argv.slice(2));
const action = args.has("--up") ? "up" : args.has("--down") ? "down" : "dry-run";

const getConfig = () => ({
  host: String(process.env.TAIKO_DB_HOST || "127.0.0.1"),
  port: Number(process.env.TAIKO_DB_PORT || 3306),
  user: String(process.env.TAIKO_DB_USER || ""),
  password: String(process.env.TAIKO_DB_PASSWORD || ""),
  database: String(process.env.TAIKO_DB_NAME || "taiko")
});

const inspectCompatibility = async (connection: Connection) => {
  const [serverRows] = await connection.query<any[]>(
    "SELECT VERSION() AS version, @@version_comment AS comment, @@character_set_database AS charset, @@collation_database AS collation"
  );
  const [accountRows] = await connection.query<any[]>(
    `SELECT COLUMN_TYPE AS columnType
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'web_user_accounts' AND COLUMN_NAME = 'id'`
  );
  const [tableRows] = await connection.query<any[]>(
    `SELECT TABLE_NAME AS tableName
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?)`,
    [UGC_TABLE_NAMES]
  );
  const server = serverRows[0] || {};
  const accountIdType = String(accountRows[0]?.columnType || "").toLowerCase();
  const version = String(server.version || "");
  const mysqlMatch = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  const supportsChecks = Boolean(mysqlMatch && (Number(mysqlMatch[1]) > 8 || (Number(mysqlMatch[1]) === 8 && (Number(mysqlMatch[2]) > 0 || Number(mysqlMatch[3]) >= 16))));
  const existingTables = tableRows.map((row) => String(row.tableName)).sort();
  const errors = [];
  if (accountIdType !== "bigint unsigned") errors.push(`web_user_accounts.id is ${accountIdType || "missing"}, expected bigint unsigned`);
  if (String(server.charset) !== "utf8mb4") errors.push(`database charset is ${server.charset}, expected utf8mb4`);
  if (!supportsChecks) errors.push(`server ${version} does not provide the required enforced CHECK semantics`);
  return { version, comment: String(server.comment || ""), charset: String(server.charset || ""), collation: String(server.collation || ""), accountIdType, supportsChecks, existingTables, errors };
};

const countContributions = async (connection: Connection) => {
  const tables = ["chart_difficulty_votes", "chart_tag_votes", "chart_tips", "chart_tip_helpful", "chart_tip_reports", "chart_ugc_moderation_logs"];
  let total = 0;
  for (const table of tables) {
    const [rows] = await connection.query<any[]>(`SELECT COUNT(*) AS count FROM \`${table}\``);
    total += Number(rows[0]?.count || 0);
  }
  return total;
};

const config = getConfig();
if (!config.user || !config.password) throw new Error("TAIKO_DB_USER and TAIKO_DB_PASSWORD are required");
const connection = await mysql.createConnection({ ...config, charset: "utf8mb4" });
try {
  const audit = await inspectCompatibility(connection);
  process.stdout.write(`${JSON.stringify({ action, database: config.database, ...audit }, null, 2)}\n`);
  if (audit.errors.length) throw new Error(`UGC migration compatibility audit failed: ${audit.errors.join("; ")}`);
  if (action === "dry-run") process.exitCode = 0;
  if (action === "up") {
    for (const statement of UGC_CREATE_TABLE_STATEMENTS) await connection.execute(statement);
    const after = await inspectCompatibility(connection);
    const missing = UGC_TABLE_NAMES.filter((table) => !after.existingTables.includes(table));
    if (missing.length) throw new Error(`UGC migration incomplete: ${missing.join(", ")}`);
    process.stdout.write(`UGC schema up complete: ${after.existingTables.length} tables present\n`);
  }
  if (action === "down") {
    if (!args.has("--confirm-drop-ugc-foundation")) throw new Error("--down requires --confirm-drop-ugc-foundation");
    const existing = new Set(audit.existingTables);
    if (existing.size) {
      const contributions = await countContributions(connection);
      if (contributions > 0 && !args.has("--allow-data-loss")) {
        throw new Error(`refusing rollback with ${contributions} contribution rows; pass --allow-data-loss only in an isolated test database`);
      }
    }
    for (const statement of UGC_DROP_TABLE_STATEMENTS) await connection.execute(statement);
    process.stdout.write("UGC schema down complete\n");
  }
} finally {
  await connection.end();
}
