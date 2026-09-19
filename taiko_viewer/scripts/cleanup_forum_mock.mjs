import { deleteUserAndGoalsInTransaction } from "../server/services/goals/lifecycle.ts";
import mysql from "mysql2/promise";

const MOCK_EMAIL_LIKE = "%\\_mock@sakura-bot.cn";
const MOCK_SYNC_TARGET_ID = "mock-service-b";

const dbConfig = {
  host: process.env.TAIKO_DB_HOST || "127.0.0.1",
  port: Number(process.env.TAIKO_DB_PORT || 3306),
  user: process.env.TAIKO_DB_USER || "",
  password: process.env.TAIKO_DB_PASSWORD || "",
  database: process.env.TAIKO_DB_NAME || "taiko",
  charset: "utf8mb4"
};

if (!dbConfig.user || !dbConfig.password) {
  throw new Error("TAIKO_DB_USER and TAIKO_DB_PASSWORD are required");
}

const getConnection = async () => mysql.createConnection(dbConfig);

const decodeJsonArray = (value) => {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const buildInClause = (values) => values.map(() => "?").join(", ");

const selectNumericColumn = async (db, sql, values) => {
  const [rows] = await db.execute(sql, values);
  return rows
    .map((row) => Number(row.id || 0))
    .filter((value) => Number.isFinite(value) && value > 0);
};

const deleteMockNotifications = async (db, mockUserIds, mockThreadIds, mockPostIds) => {
  const conditions = [];
  const values = [];

  if (mockUserIds.length) {
    const placeholders = buildInClause(mockUserIds);
    conditions.push(`user_id IN (${placeholders})`);
    values.push(...mockUserIds);
    conditions.push(`actor_user_id IN (${placeholders})`);
    values.push(...mockUserIds);
  }

  if (mockThreadIds.length) {
    const placeholders = buildInClause(mockThreadIds);
    conditions.push(`thread_id IN (${placeholders})`);
    values.push(...mockThreadIds);
  }

  if (mockPostIds.length) {
    const placeholders = buildInClause(mockPostIds);
    conditions.push(`post_id IN (${placeholders})`);
    values.push(...mockPostIds);
  }

  if (!conditions.length) {
    return 0;
  }

  const [result] = await db.execute(
    `DELETE FROM forum_notifications
     WHERE ${conditions.join(" OR ")}`,
    values
  );
  return Number(result.affectedRows || 0);
};

const cleanMockSyncTargets = async (db) => {
  const [rows] = await db.execute(
    `SELECT id, target_ids_json, result_json
     FROM web_data_sync_logs
     WHERE target_ids_json LIKE ? OR result_json LIKE ?`,
    [`%${MOCK_SYNC_TARGET_ID}%`, `%${MOCK_SYNC_TARGET_ID}%`]
  );

  let updatedCount = 0;
  let deletedCount = 0;

  for (const row of rows) {
    const targetIds = decodeJsonArray(row.target_ids_json)
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .filter((item) => item !== MOCK_SYNC_TARGET_ID);
    const results = decodeJsonArray(row.result_json).filter((item) => {
      if (!item || typeof item !== "object") return false;
      return String(item.targetId || "").trim() !== MOCK_SYNC_TARGET_ID;
    });

    if (!targetIds.length || !results.length) {
      await db.execute("DELETE FROM web_data_sync_logs WHERE id = ?", [row.id]);
      deletedCount += 1;
      continue;
    }

    const status = results.every((item) => Boolean(item.ok))
      ? "success"
      : results.some((item) => Boolean(item.ok))
        ? "partial"
        : "failed";

    await db.execute(
      `UPDATE web_data_sync_logs
       SET status = ?, target_ids_json = ?, result_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, JSON.stringify(targetIds), JSON.stringify(results), row.id]
    );
    updatedCount += 1;
  }

  return {
    updatedCount,
    deletedCount
  };
};

const main = async () => {
  const db = await getConnection();
  try {
    await db.beginTransaction();

    const mockUserIds = await selectNumericColumn(
      db,
      "SELECT id FROM web_user_accounts WHERE email LIKE ? ESCAPE '\\\\' ORDER BY id FOR UPDATE",
      [MOCK_EMAIL_LIKE]
    );
    const mockThreadIds = mockUserIds.length
      ? await selectNumericColumn(
          db,
          `SELECT id FROM forum_threads
           WHERE author_user_id IN (${buildInClause(mockUserIds)})`,
          mockUserIds
        )
      : [];
    const mockPostIds = mockUserIds.length
      ? await selectNumericColumn(
          db,
          `SELECT id FROM forum_posts
           WHERE author_user_id IN (${buildInClause(mockUserIds)})`,
          mockUserIds
        )
      : [];

    const syncLogChanges = await cleanMockSyncTargets(db);
    const deletedNotifications = await deleteMockNotifications(db, mockUserIds, mockThreadIds, mockPostIds);

    let deletedUsers = 0;
    if (mockUserIds.length) {
      for (const userId of mockUserIds) {
        await deleteUserAndGoalsInTransaction(db, userId);
        deletedUsers++;
      }
    }

    await db.commit();

    const [summaryRows] = await db.execute(
      `SELECT
         (SELECT COUNT(*) FROM web_user_accounts WHERE email LIKE ? ESCAPE '\\\\') AS mockUsers,
         (SELECT COUNT(*) FROM forum_threads WHERE author_user_id IN (SELECT id FROM web_user_accounts WHERE email LIKE ? ESCAPE '\\\\')) AS mockThreads,
         (SELECT COUNT(*) FROM forum_posts WHERE author_user_id IN (SELECT id FROM web_user_accounts WHERE email LIKE ? ESCAPE '\\\\')) AS mockPosts,
         (SELECT COUNT(*) FROM forum_notifications WHERE actor_user_id IN (SELECT id FROM web_user_accounts WHERE email LIKE ? ESCAPE '\\\\')) AS actorNotifications,
         (SELECT COUNT(*) FROM web_data_sync_logs WHERE target_ids_json LIKE ? OR result_json LIKE ?) AS syncLogsWithMockTarget`,
      [
        MOCK_EMAIL_LIKE,
        MOCK_EMAIL_LIKE,
        MOCK_EMAIL_LIKE,
        MOCK_EMAIL_LIKE,
        `%${MOCK_SYNC_TARGET_ID}%`,
        `%${MOCK_SYNC_TARGET_ID}%`
      ]
    );

    console.log("Forum mock cleanup complete.");
    console.table([
      {
        deletedUsers,
        deletedNotifications,
        updatedSyncLogs: syncLogChanges.updatedCount,
        deletedSyncLogs: syncLogChanges.deletedCount
      }
    ]);
    console.table(summaryRows);
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    await db.end();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
