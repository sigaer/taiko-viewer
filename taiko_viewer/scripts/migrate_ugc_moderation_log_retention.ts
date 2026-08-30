#!/usr/bin/env node
import mysql from "mysql2/promise";
import {
  inspectModerationLogRetention,
  migrateModerationLogRetentionDown,
  migrateModerationLogRetentionUp
} from "../server/services/ugc/moderation-log-retention.ts";

const args = new Set(process.argv.slice(2));
if (args.has("--up") && args.has("--down")) throw new Error("choose either --up or --down");
const action = args.has("--up") ? "up" : args.has("--down") ? "down" : "dry-run";
const config = {
  host: String(process.env.TAIKO_DB_HOST || "127.0.0.1"),
  port: Number(process.env.TAIKO_DB_PORT || 3306),
  user: String(process.env.TAIKO_DB_USER || ""),
  password: String(process.env.TAIKO_DB_PASSWORD || ""),
  database: String(process.env.TAIKO_DB_NAME || "taiko")
};
if (!config.user || !config.password) throw new Error("TAIKO_DB_USER and TAIKO_DB_PASSWORD are required");

const connection = await mysql.createConnection({ ...config, charset: "utf8mb4" });
try {
  const before = await inspectModerationLogRetention(connection);
  process.stdout.write(`${JSON.stringify({ action, database: config.database, before }, null, 2)}\n`);
  if (action === "dry-run") process.exitCode = 0;
  if (action === "up") {
    const result = await migrateModerationLogRetentionUp(connection);
    process.stdout.write(`${JSON.stringify({ changed: result.changed, after: result.after }, null, 2)}\n`);
  }
  if (action === "down") {
    const result = await migrateModerationLogRetentionDown(connection, {
      confirmed: args.has("--confirm-audit-retention-rollback")
    });
    process.stdout.write(`${JSON.stringify({ changed: result.changed, after: result.after }, null, 2)}\n`);
  }
} finally {
  await connection.end();
}
