#!/usr/bin/env node
import mysql from "mysql2/promise";

const stateArg = process.argv.find((arg) => arg.startsWith("--state="));
const state = stateArg?.slice("--state=".length) || "rich";
if (!new Set(["empty", "small", "rich"]).has(state)) throw new Error("--state must be empty, small, or rich");

const config = {
  host: String(process.env.TAIKO_DB_HOST || "127.0.0.1"),
  port: Number(process.env.TAIKO_DB_PORT || 3306),
  user: String(process.env.TAIKO_DB_USER || ""),
  password: String(process.env.TAIKO_DB_PASSWORD || ""),
  database: String(process.env.TAIKO_DB_NAME || "")
};
if (!config.database.endsWith("_test")) throw new Error("UGC browser fixtures are restricted to a database ending in _test");

const connection = await mysql.createConnection({ ...config, charset: "utf8mb4" });
const tokens = { userA: "a".repeat(64), userB: "b".repeat(64) };
try {
  await connection.execute(
    `CREATE TABLE IF NOT EXISTS web_user_sessions (
      session_token CHAR(64) NOT NULL PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_test_sessions_user (user_id),
      CONSTRAINT fk_test_sessions_user FOREIGN KEY (user_id) REFERENCES web_user_accounts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`
  );
  await connection.beginTransaction();
  try {
    for (const table of ["chart_tip_reports", "chart_tip_helpful", "chart_tips", "chart_tag_votes", "chart_difficulty_votes"]) {
      await connection.execute(`DELETE FROM \`${table}\``);
    }
    await connection.execute("UPDATE ugc_tags SET status = 'active' WHERE slug IN ('stamina', 'high-speed', 'long-compounds', 'backloaded')");
    await connection.execute("DELETE FROM web_user_sessions");
    await connection.execute("DELETE FROM web_user_accounts");
    await connection.execute(
      `INSERT INTO web_user_accounts (id, username, email, password_hash, avatar_url) VALUES
        (101, 'fixture-a', 'fixture-a@example.test', 'hash', 'https://viewer.sakura-bot.cn/miku.png'),
        (102, 'fixture-b', 'fixture-b@example.test', 'hash', 'https://viewer.sakura-bot.cn/miku.png'),
        (103, 'fixture-c', 'fixture-c@example.test', 'hash', NULL),
        (104, 'fixture-d', 'fixture-d@example.test', 'hash', NULL),
        (105, 'fixture-deleted', 'fixture-deleted@example.test', 'hash', NULL)`
    );
    await connection.execute(
      "INSERT INTO web_user_sessions (session_token, user_id, expires_at) VALUES (?, 101, DATE_ADD(NOW(), INTERVAL 1 DAY)), (?, 102, DATE_ADD(NOW(), INTERVAL 1 DAY))",
      [tokens.userA, tokens.userB]
    );
    const [chartRows] = await connection.query(
      "SELECT chart_id AS chartId, difficulty_code AS difficultyCode FROM ugc_charts WHERE song_id = 1419 AND difficulty_code IN (4, 5) AND status = 'active'"
    );
    const chartIds = new Map(chartRows.map((row) => [Number(row.difficultyCode), Number(row.chartId)]));
    if (!chartIds.get(4) || !chartIds.get(5)) throw new Error("fixture charts 1419/4 and 1419/5 are unavailable");
    if (state !== "empty") {
      const oni = chartIds.get(4);
      const ura = chartIds.get(5);
      const difficultyVotes = state === "small"
        ? [[oni, 101, 1, 1], [oni, 102, 2, 0]]
        : [
            [oni, 101, 1, 1], [oni, 102, 1, 0], [oni, 103, 2, 1], [oni, 104, 0, 0],
            [ura, 101, -2, 1], [ura, 102, -2, 0], [ura, 103, -1, 1], [ura, 104, 0, 0]
          ];
      for (const vote of difficultyVotes) {
        await connection.execute(
          "INSERT INTO chart_difficulty_votes (chart_id, user_id, value, verified_play) VALUES (?, ?, ?, ?)",
          vote
        );
      }
      const [tagRows] = await connection.query("SELECT tag_id AS tagId, slug FROM ugc_tags WHERE slug IN ('stamina', 'high-speed', 'long-compounds', 'backloaded')");
      const tagIds = new Map(tagRows.map((row) => [String(row.slug), Number(row.tagId)]));
      const tagVotes = state === "small"
        ? [[oni, tagIds.get("stamina"), 101]]
        : [
            [oni, tagIds.get("stamina"), 101], [oni, tagIds.get("stamina"), 102], [oni, tagIds.get("stamina"), 103],
            [oni, tagIds.get("high-speed"), 101], [oni, tagIds.get("high-speed"), 102],
            [oni, tagIds.get("long-compounds"), 101], [oni, tagIds.get("long-compounds"), 104],
            [oni, tagIds.get("backloaded"), 101], [oni, tagIds.get("backloaded"), 102],
            [ura, tagIds.get("high-speed"), 101], [ura, tagIds.get("high-speed"), 102]
          ];
      for (const vote of tagVotes) {
        await connection.execute("INSERT INTO chart_tag_votes (chart_id, tag_id, user_id) VALUES (?, ?, ?)", vote);
      }
      if (state === "rich") {
        await connection.execute("UPDATE ugc_tags SET status = 'deprecated' WHERE slug = 'backloaded'");
      }
      const unsafeBody = "<script>alert('x')</script> https://example.com/path 🎵 日本語 — 后半长复合要稳住节奏，不要被显示文本影响。";
      await connection.execute(
        "INSERT INTO chart_tips (tip_id, chart_id, author_user_id, body_text, status, verified_play, created_at) VALUES (9001, ?, 101, ?, 'active', 1, '2026-08-01 10:00:00')",
        [oni, unsafeBody]
      );
      if (state === "rich") {
        await connection.execute(
          `INSERT INTO chart_tips (tip_id, chart_id, author_user_id, body_text, status, verified_play, created_at) VALUES
            (9002, ?, 102, '先看清后半段再提速。', 'active', 0, '2026-08-02 10:00:00'),
            (9003, ?, 105, '匿名后仍应保留的提示。', 'active', 1, '2026-08-03 10:00:00'),
            (9004, ?, 103, '隐藏提示', 'hidden', 0, '2026-08-04 10:00:00'),
            (9005, ?, 104, '已删除提示', 'deleted', 0, '2026-08-05 10:00:00'),
            (9010, ?, 102, '里谱先放慢识谱。', 'active', 1, '2026-08-06 10:00:00')`,
          [oni, oni, oni, oni, ura]
        );
        await connection.execute("INSERT INTO chart_tip_helpful (tip_id, user_id) VALUES (9001, 102), (9001, 103), (9002, 101), (9003, 101), (9010, 101)");
        await connection.execute("DELETE FROM web_user_accounts WHERE id = 105");
      }
    }
    await connection.commit();
    process.stdout.write(`${JSON.stringify({ state, songId: 1419, difficulties: [4, 5], tokens }, null, 2)}\n`);
  } catch (error) {
    await connection.rollback();
    throw error;
  }
} finally {
  await connection.end();
}
