import assert from "node:assert/strict";
import test from "node:test";
import mysql from "mysql2/promise";

const config = {
  host: String(process.env.TAIKO_DB_HOST || ""),
  port: Number(process.env.TAIKO_DB_PORT || 3306),
  user: String(process.env.TAIKO_DB_USER || ""),
  password: String(process.env.TAIKO_DB_PASSWORD || ""),
  database: String(process.env.TAIKO_DB_NAME || "")
};
if (!config.host || !config.user || !config.database) throw new Error("isolated UGC integration database configuration is required");

const connection = await mysql.createConnection({ ...config, charset: "utf8mb4" });

const reset = async () => {
  for (const table of [
    "chart_ugc_moderation_logs",
    "chart_tip_reports",
    "chart_tip_helpful",
    "chart_tips",
    "chart_tag_votes",
    "chart_difficulty_votes",
    "ugc_tags",
    "ugc_charts",
    "web_user_accounts"
  ]) await connection.execute(`DELETE FROM \`${table}\``);
};

const fixture = async () => {
  await connection.execute(
    `INSERT INTO web_user_accounts (id, username, email, password_hash) VALUES
      (1, 'user-a', 'a@example.test', 'hash'),
      (2, 'user-b', 'b@example.test', 'hash')`
  );
  await connection.execute(
    "INSERT INTO ugc_charts (chart_id, song_id, difficulty_code, source_key, catalog_revision, status) VALUES (1, 100, 4, 'taiko:100:4', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'active')"
  );
  await connection.execute(
    "INSERT INTO ugc_tags (tag_id, slug, label_key, group_key, status, sort_order) VALUES (1, 'stamina', 'ugc.tags.stamina', 'stamina', 'active', 10)"
  );
};

test.beforeEach(async () => {
  await reset();
  await fixture();
});

test.after(async () => {
  await reset();
  await connection.end();
});

test("chart identity and contribution uniqueness are enforced", async () => {
  await assert.rejects(
    connection.execute("INSERT INTO ugc_charts (song_id, difficulty_code, source_key, catalog_revision) VALUES (101, 4, 'taiko:100:4', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')"),
    (error) => Number(error?.errno) === 1062
  );
  await assert.rejects(
    connection.execute("INSERT INTO ugc_charts (song_id, difficulty_code, source_key, catalog_revision) VALUES (100, 4, 'taiko:100:4:other', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')"),
    (error) => Number(error?.errno) === 1062
  );

  await connection.execute("INSERT INTO chart_difficulty_votes (chart_id, user_id, value) VALUES (1, 1, 0)");
  await assert.rejects(
    connection.execute("INSERT INTO chart_difficulty_votes (chart_id, user_id, value) VALUES (1, 1, 1)"),
    (error) => Number(error?.errno) === 1062
  );
  await assert.rejects(
    connection.execute("INSERT INTO chart_difficulty_votes (chart_id, user_id, value) VALUES (1, 2, 3)"),
    (error) => Number(error?.errno) === 3819
  );

  await connection.execute("INSERT INTO chart_tag_votes (chart_id, tag_id, user_id) VALUES (1, 1, 1)");
  await assert.rejects(
    connection.execute("INSERT INTO chart_tag_votes (chart_id, tag_id, user_id) VALUES (1, 1, 1)"),
    (error) => Number(error?.errno) === 1062
  );

  await connection.execute("INSERT INTO chart_tips (tip_id, chart_id, author_user_id, body_text) VALUES (1, 1, 1, 'tip')");
  await assert.rejects(
    connection.execute("INSERT INTO chart_tips (chart_id, author_user_id, body_text) VALUES (1, 1, 'second')"),
    (error) => Number(error?.errno) === 1062
  );
  await connection.execute("INSERT INTO chart_tip_helpful (tip_id, user_id) VALUES (1, 2)");
  await assert.rejects(
    connection.execute("INSERT INTO chart_tip_helpful (tip_id, user_id) VALUES (1, 2)"),
    (error) => Number(error?.errno) === 1062
  );
  await connection.execute("INSERT INTO chart_tip_reports (tip_id, reporter_user_id, reason) VALUES (1, 2, 'spam')");
  await assert.rejects(
    connection.execute("INSERT INTO chart_tip_reports (tip_id, reporter_user_id, reason) VALUES (1, 2, 'abuse')"),
    (error) => Number(error?.errno) === 1062
  );
});

test("account and chart deletion semantics preserve anonymous tips and cascade relations", async () => {
  await connection.execute("INSERT INTO chart_difficulty_votes (chart_id, user_id, value) VALUES (1, 1, 1)");
  await connection.execute("INSERT INTO chart_tag_votes (chart_id, tag_id, user_id) VALUES (1, 1, 1)");
  await connection.execute("INSERT INTO chart_tips (tip_id, chart_id, author_user_id, body_text) VALUES (1, 1, 1, 'kept anonymously')");
  await connection.execute("INSERT INTO chart_tip_helpful (tip_id, user_id) VALUES (1, 2)");
  await connection.execute("INSERT INTO chart_tip_reports (tip_id, reporter_user_id, reason, resolved_by_user_id) VALUES (1, 2, 'spam', 2)");
  await connection.execute("INSERT INTO chart_ugc_moderation_logs (target_type, target_id, operator_user_id, action) VALUES ('tip', 1, 2, 'hide')");

  await connection.execute("DELETE FROM web_user_accounts WHERE id = 1");
  const [afterAuthorDelete] = await connection.query("SELECT author_user_id AS authorUserId FROM chart_tips WHERE tip_id = 1");
  assert.equal(afterAuthorDelete[0].authorUserId, null);
  for (const table of ["chart_difficulty_votes", "chart_tag_votes"]) {
    const [rows] = await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
    assert.equal(Number(rows[0].count), 0);
  }

  await connection.execute("DELETE FROM web_user_accounts WHERE id = 2");
  const [helpfulRows] = await connection.query("SELECT COUNT(*) AS count FROM chart_tip_helpful");
  assert.equal(Number(helpfulRows[0].count), 0);
  const [reportRows] = await connection.query("SELECT reporter_user_id AS reporter, resolved_by_user_id AS resolver FROM chart_tip_reports WHERE tip_id = 1");
  assert.deepEqual(reportRows[0], { reporter: null, resolver: null });
  const [moderationRows] = await connection.query("SELECT COUNT(*) AS count FROM chart_ugc_moderation_logs");
  assert.equal(Number(moderationRows[0].count), 0);

  await connection.execute("DELETE FROM ugc_charts WHERE chart_id = 1");
  const [tipRows] = await connection.query("SELECT COUNT(*) AS count FROM chart_tips");
  const [remainingReportRows] = await connection.query("SELECT COUNT(*) AS count FROM chart_tip_reports");
  assert.equal(Number(tipRows[0].count), 0);
  assert.equal(Number(remainingReportRows[0].count), 0);
});
