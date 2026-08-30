#!/usr/bin/env node
import mysql from "mysql2/promise";
import { loadUgcCatalogAudit } from "./lib/ugc-catalog.mjs";

const config = {
  host: process.env.TAIKO_DB_HOST || "127.0.0.1",
  port: Number(process.env.TAIKO_DB_PORT || 3306),
  user: process.env.TAIKO_DB_USER || "",
  password: process.env.TAIKO_DB_PASSWORD || "",
  database: process.env.TAIKO_DB_NAME || "taiko"
};
if (!config.user || !config.database) {
  console.error("ERROR DATABASE_CONFIGURATION: set TAIKO_DB_USER and TAIKO_DB_NAME");
  process.exitCode = 1;
  process.exit();
}

const issues = [];
const add = (severity, code, count, samples = []) => {
  if (Number(count) > 0) issues.push({ severity, code, count: Number(count), samples: samples.slice(0, 5) });
};
const db = await mysql.createConnection({ ...config, charset: "utf8mb4" });
const query = async (sql) => (await db.query(sql))[0];
try {
  add("ERROR", "ORPHAN_DIFFICULTY_VOTES", ...(await query("SELECT COUNT(*) count FROM chart_difficulty_votes v LEFT JOIN ugc_charts c ON c.chart_id=v.chart_id WHERE c.chart_id IS NULL")).map((r) => [r.count]));
  add("ERROR", "ORPHAN_TAG_VOTES", ...(await query("SELECT COUNT(*) count FROM chart_tag_votes v LEFT JOIN ugc_charts c ON c.chart_id=v.chart_id WHERE c.chart_id IS NULL")).map((r) => [r.count]));
  add("ERROR", "ORPHAN_TIPS", ...(await query("SELECT COUNT(*) count FROM chart_tips t LEFT JOIN ugc_charts c ON c.chart_id=t.chart_id WHERE c.chart_id IS NULL")).map((r) => [r.count]));
  add("ERROR", "ORPHAN_HELPFUL", ...(await query("SELECT COUNT(*) count FROM chart_tip_helpful h LEFT JOIN chart_tips t ON t.tip_id=h.tip_id WHERE t.tip_id IS NULL")).map((r) => [r.count]));
  add("ERROR", "INVALID_REPORT_TARGET", ...(await query("SELECT COUNT(*) count FROM chart_tip_reports r LEFT JOIN chart_tips t ON t.tip_id=r.tip_id WHERE t.tip_id IS NULL")).map((r) => [r.count]));
  add("ERROR", "INVALID_MODERATION_TARGET_TYPE", ...(await query("SELECT COUNT(*) count FROM chart_ugc_moderation_logs WHERE target_type NOT IN ('tip')")).map((r) => [r.count]));
  add("INFO", "RETAINED_MODERATION_TARGET_MISSING", ...(await query("SELECT COUNT(*) count FROM chart_ugc_moderation_logs l LEFT JOIN chart_tips t ON l.target_type='tip' AND t.tip_id=l.target_id WHERE l.target_type='tip' AND t.tip_id IS NULL")).map((r) => [r.count]));
  add("ERROR", "MALFORMED_TIP_STATUS", ...(await query("SELECT COUNT(*) count FROM chart_tips WHERE status NOT IN ('active','hidden','deleted')")).map((r) => [r.count]));
  add("ERROR", "INVALID_VERIFIED_PLAY", ...(await query("SELECT COUNT(*) count FROM (SELECT verified_play FROM chart_difficulty_votes UNION ALL SELECT verified_play FROM chart_tag_votes UNION ALL SELECT verified_play FROM chart_tips) x WHERE verified_play NOT IN (0,1)")).map((r) => [r.count]));
  add("ERROR", "DUPLICATE_CHART_IDENTITY", ...(await query("SELECT COUNT(*) count FROM (SELECT catalog_revision,song_id,difficulty_code,COUNT(*) n FROM ugc_charts GROUP BY catalog_revision,song_id,difficulty_code HAVING n>1) x")).map((r) => [r.count]));
  add("WARNING", "HELPFUL_ON_NON_ACTIVE_TIP", ...(await query("SELECT COUNT(*) count FROM chart_tip_helpful h INNER JOIN chart_tips t ON t.tip_id=h.tip_id WHERE t.status <> 'active'")).map((r) => [r.count]));
  add("WARNING", "DEPRECATED_TAG_USAGE", ...(await query("SELECT COUNT(*) count FROM chart_tag_votes v INNER JOIN ugc_tags t ON t.tag_id=v.tag_id WHERE t.status='deprecated'")).map((r) => [r.count]));
  add("INFO", "NULL_OPERATOR_LOGS", ...(await query("SELECT COUNT(*) count FROM chart_ugc_moderation_logs WHERE operator_user_id IS NULL")).map((r) => [r.count]));

  const catalog = await loadUgcCatalogAudit();
  const catalogKeys = new Set(catalog.catalog.charts.filter((chart) => chart.status === "active").map((chart) => chart.sourceKey));
  const registryRows = await query("SELECT source_key AS sourceKey FROM ugc_charts WHERE status='active'");
  const missing = registryRows.filter((row) => !catalogKeys.has(String(row.sourceKey)));
  add("WARNING", "ACTIVE_CHART_MISSING_REGISTRY", missing.length, missing.map((row) => row.sourceKey));
  add("INFO", "CATALOG_AUDIT_ERRORS", catalog.summary.errors);

  if (!issues.length) console.log("INFO CLEAN: no UGC data quality issues found");
  else for (const issue of issues) console.log(`${issue.severity} ${issue.code}: ${issue.count}${issue.samples.length ? ` ${JSON.stringify(issue.samples)}` : ""}`);
  process.exitCode = issues.some((issue) => issue.severity === "ERROR") ? 1 : 0;
} finally {
  await db.end();
}
