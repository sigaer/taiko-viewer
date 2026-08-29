#!/usr/bin/env node
import mysql from "mysql2/promise";
import { UGC_TAG_SEEDS } from "./lib/ugc-tags.mjs";

const apply = process.argv.includes("--apply");
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
  const [existingRows] = await connection.query(
    "SELECT tag_id AS tagId, slug, label_key AS labelKey, group_key AS groupKey, status, sort_order AS sortOrder FROM ugc_tags ORDER BY tag_id"
  );
  const existingBySlug = new Map(existingRows.map((row) => [String(row.slug), row]));
  let insertCount = 0;
  let updateCount = 0;
  for (const tag of UGC_TAG_SEEDS) {
    const existing = existingBySlug.get(tag.slug);
    if (!existing) insertCount += 1;
    else if (
      String(existing.labelKey) !== tag.labelKey ||
      String(existing.groupKey) !== tag.groupKey ||
      String(existing.status) !== "active" ||
      Number(existing.sortOrder) !== tag.sortOrder
    ) updateCount += 1;
  }
  process.stdout.write(`${JSON.stringify({ mode: apply ? "apply" : "dry-run", expectedTagCount: UGC_TAG_SEEDS.length, existingTagCount: existingRows.length, insertCount, updateCount }, null, 2)}\n`);
  if (apply) {
    await connection.beginTransaction();
    try {
      for (const tag of UGC_TAG_SEEDS) {
        await connection.execute(
          `INSERT INTO ugc_tags (slug, label_key, group_key, status, sort_order)
           VALUES (?, ?, ?, 'active', ?)
           ON DUPLICATE KEY UPDATE
             label_key = VALUES(label_key),
             group_key = VALUES(group_key),
             status = VALUES(status),
             sort_order = VALUES(sort_order),
             updated_at = CURRENT_TIMESTAMP`,
          [tag.slug, tag.labelKey, tag.groupKey, tag.sortOrder]
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }
    const [rows] = await connection.query("SELECT COUNT(*) AS count, COUNT(DISTINCT slug) AS distinctSlugs FROM ugc_tags");
    if (Number(rows[0]?.count || 0) !== Number(rows[0]?.distinctSlugs || 0)) throw new Error("UGC tag seed verification failed");
    process.stdout.write(`${JSON.stringify({ verified: true, ...rows[0] }, null, 2)}\n`);
  }
} finally {
  await connection.end();
}
