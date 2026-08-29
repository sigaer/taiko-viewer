#!/usr/bin/env node
import mysql from "mysql2/promise";
import { loadUgcCatalogAudit } from "./lib/ugc-catalog.mjs";

const apply = process.argv.includes("--apply");
const getConfig = () => ({
  host: String(process.env.TAIKO_DB_HOST || "127.0.0.1"),
  port: Number(process.env.TAIKO_DB_PORT || 3306),
  user: String(process.env.TAIKO_DB_USER || ""),
  password: String(process.env.TAIKO_DB_PASSWORD || ""),
  database: String(process.env.TAIKO_DB_NAME || "taiko")
});

const chunk = (items, size = 400) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
};

const audit = await loadUgcCatalogAudit();
if (audit.summary.errors > 0) throw new Error(`catalog audit has ${audit.summary.errors} blocking errors`);

const config = getConfig();
if (!config.user || !config.password) throw new Error("TAIKO_DB_USER and TAIKO_DB_PASSWORD are required");
const connection = await mysql.createConnection({ ...config, charset: "utf8mb4" });
try {
  const [tableRows] = await connection.query(
    `SELECT COUNT(*) AS count FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ugc_charts'`
  );
  if (Number(tableRows[0]?.count || 0) !== 1) throw new Error("ugc_charts does not exist; run the UGC schema migration first");

  const [existingRows] = await connection.query(
    "SELECT chart_id AS chartId, song_id AS songId, difficulty_code AS difficultyCode, source_key AS sourceKey, catalog_revision AS catalogRevision, status FROM ugc_charts ORDER BY chart_id"
  );
  const existingBySource = new Map(existingRows.map((row) => [String(row.sourceKey), row]));
  const catalogSources = new Set(audit.catalog.charts.map((chart) => chart.sourceKey));
  let insertCount = 0;
  let updateCount = 0;
  const identityErrors = [];
  for (const chart of audit.catalog.charts) {
    const existing = existingBySource.get(chart.sourceKey);
    if (!existing) {
      insertCount += 1;
      continue;
    }
    if (Number(existing.songId) !== chart.songId || Number(existing.difficultyCode) !== chart.difficultyCode) {
      identityErrors.push({ sourceKey: chart.sourceKey, existing: [existing.songId, existing.difficultyCode], catalog: [chart.songId, chart.difficultyCode] });
      continue;
    }
    if (String(existing.catalogRevision) !== audit.catalog.revision || String(existing.status) !== chart.status) updateCount += 1;
  }
  const orphanRows = existingRows.filter((row) => !catalogSources.has(String(row.sourceKey)) && String(row.status) !== "inactive");
  const report = {
    mode: apply ? "apply" : "dry-run",
    catalogRevision: audit.catalog.revision,
    expectedChartCount: audit.catalog.charts.length,
    expectedActiveCount: audit.summary.activeCharts,
    existingRegistryCount: existingRows.length,
    insertCount,
    updateCount,
    inactiveCount: orphanRows.length,
    errors: identityErrors.length
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (identityErrors.length) throw new Error(`registry identity mismatch: ${JSON.stringify(identityErrors.slice(0, 8))}`);
  if (!apply) process.exitCode = 0;
  if (apply) {
    await connection.beginTransaction();
    try {
      for (const batch of chunk(audit.catalog.charts)) {
        const placeholders = batch.map(() => "(?, ?, ?, ?, ?)").join(", ");
        const values = batch.flatMap((chart) => [chart.songId, chart.difficultyCode, chart.sourceKey, audit.catalog.revision, chart.status]);
        await connection.execute(
          `INSERT INTO ugc_charts (song_id, difficulty_code, source_key, catalog_revision, status)
           VALUES ${placeholders}
           ON DUPLICATE KEY UPDATE
             song_id = VALUES(song_id),
             difficulty_code = VALUES(difficulty_code),
             catalog_revision = VALUES(catalog_revision),
             status = VALUES(status),
             updated_at = CURRENT_TIMESTAMP`,
          values
        );
      }
      for (const batch of chunk(orphanRows.map((row) => String(row.sourceKey)))) {
        await connection.query(`UPDATE ugc_charts SET status = 'inactive' WHERE source_key IN (?)`, [batch]);
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }

    const [verificationRows] = await connection.query(
      `SELECT
         COUNT(*) AS total,
         SUM(status = 'active') AS active,
         COUNT(*) - COUNT(DISTINCT source_key) AS duplicateSources,
         SUM(status = 'active' AND catalog_revision = ?) AS activeCurrentRevision
       FROM ugc_charts`,
      [audit.catalog.revision]
    );
    const verification = verificationRows[0] || {};
    if (
      Number(verification.active) !== audit.summary.activeCharts ||
      Number(verification.activeCurrentRevision) !== audit.summary.activeCharts ||
      Number(verification.duplicateSources) !== 0
    ) {
      throw new Error(`registry verification failed: ${JSON.stringify(verification)}`);
    }
    process.stdout.write(`${JSON.stringify({ verified: true, ...verification }, null, 2)}\n`);
  }
} finally {
  await connection.end();
}
