import type { H3Event } from "h3";
import { createError } from "h3";
import type {
  ForumMeSummary,
  ForumNotification,
  ForumPreferences,
  ForumRelationshipItem,
  ForumUserProfile
} from "~/types/forum";
import { DbRow, ensureAccountSchema, getAccountDb } from "~/server/utils/account-db";
import { getAccountProfile, requireAccountUser } from "~/server/utils/account";
import { createServerMessageTranslator, translateServerMessage } from "~/server/utils/server-messages";
import {
  type NotificationRow,
  clipText,
  countUnreadNotifications,
  ensureForumProfile,
  ensureForumSchema,
  getRelationshipState,
  getUserInteractionStats,
  getViewer,
  loadBadgeMap,
  loadThreadFavoriteSet,
  loadThreadLikeSet,
  sanitizeInt,
  sanitizeThreadCard,
  toIso,
  type ThreadRow
} from "../../internal/forum/shared";

const renderNotificationText = (
  row: Pick<NotificationRow, "title" | "body" | "message_key" | "message_params_json">,
  locale: string
) => {
  if (!row.message_key) {
    return {
      title: row.title,
      body: row.body
    };
  }
  let params: Record<string, unknown> | undefined;
  try {
    params = row.message_params_json ? (JSON.parse(row.message_params_json) as Record<string, unknown>) : undefined;
  } catch {
    params = undefined;
  }
  return {
    title: translateServerMessage(locale, `${row.message_key}.title`, params, row.title),
    body: translateServerMessage(locale, `${row.message_key}.body`, params, row.body)
  };
};

export const getForumPreferences = async (event: H3Event): Promise<ForumPreferences> => {
  await ensureForumSchema();
  const user = await requireAccountUser(event);
  const profile = await ensureForumProfile(user.id);
  return {
    recordHistoryEnabled: Boolean(profile.record_history_enabled ?? 1)
  };
};

export const updateForumPreferences = async (event: H3Event, payload: Record<string, unknown>) => {
  await ensureForumSchema();
  const user = await requireAccountUser(event);
  await ensureForumProfile(user.id);
  const recordHistoryEnabled =
    payload.recordHistoryEnabled === undefined ? true : Boolean(payload.recordHistoryEnabled);
  const db = getAccountDb();
  await db.execute(
    "UPDATE forum_user_profiles SET record_history_enabled = ? WHERE user_id = ?",
    [recordHistoryEnabled ? 1 : 0, user.id]
  );
  return {
    ok: true,
    preferences: {
      recordHistoryEnabled
    } satisfies ForumPreferences
  };
};

export const clearForumHistory = async (event: H3Event) => {
  await ensureForumSchema();
  const user = await requireAccountUser(event);
  await ensureForumProfile(user.id);
  const db = getAccountDb();
  await db.execute("DELETE FROM forum_thread_history WHERE user_id = ?", [user.id]);
  return { ok: true };
};

export const submitForumFeedback = async (event: H3Event, payload: Record<string, unknown>) => {
  await ensureForumSchema();
  const user = await requireAccountUser(event);
  await ensureForumProfile(user.id);
  const content = clipText(String(payload.content || "").trim(), 4000);
  if (!content) {
    throw createError({ statusCode: 400, statusMessage: "请输入反馈内容" });
  }
  const contact = clipText(String(payload.contact || "").trim(), 255);
  const appVersion = clipText(String(payload.appVersion || "").trim(), 64);
  const platform = clipText(String(payload.platform || "").trim(), 64);
  const db = getAccountDb();
  await db.execute(
    `INSERT INTO forum_feedback (user_id, content, contact, app_version, platform)
     VALUES (?, ?, ?, ?, ?)`,
    [user.id, content, contact || null, appVersion || null, platform || null]
  );
  return { ok: true };
};

export const getForumMeSummary = async (event: H3Event): Promise<ForumMeSummary> => {
  await ensureForumSchema();
  const user = await requireAccountUser(event);
  const [accountProfile, stats, badgeMap, unreadCount, preferences] = await Promise.all([
    getAccountProfile(user.id),
    getUserInteractionStats(user.id),
    loadBadgeMap([user.id]),
    countUnreadNotifications(user.id),
    getForumPreferences(event)
  ]);
  return {
    user: accountProfile.user,
    forumBadge: badgeMap.get(user.id) || {
      id: user.id,
      username: accountProfile.user.username,
      avatarUrl: accountProfile.user.avatarUrl,
      role: "user",
      roleLabel: "鼓友",
      taikoIdMasked: accountProfile.currentBinding?.taikoId ? `${accountProfile.currentBinding.taikoId.slice(0, 3)}***${accountProfile.currentBinding.taikoId.slice(-2)}` : "未绑定",
      verifiedTitle: accountProfile.currentBinding?.verifiedTitle || null,
      verifiedTitleplateId: accountProfile.currentBinding?.verifiedTitleplateId || null
    },
    currentBinding: accountProfile.currentBinding,
    pendingBinding: accountProfile.pendingBinding,
    verificationStatus: accountProfile.verificationStatus,
    unreadNotificationCount: unreadCount,
    myDonUrl: accountProfile.currentBinding ? "/api/account/my-don" : null,
    stats,
    preferences
  };
};

export const getForumRelationshipList = async (
  event: H3Event,
  query: { scope?: unknown; page?: unknown; pageSize?: unknown }
) => {
  await ensureForumSchema();
  const user = await requireAccountUser(event);
  await ensureForumProfile(user.id);
  const scope = String(query.scope || "followers").trim();
  const page = Math.max(1, sanitizeInt(query.page, 1));
  const pageSize = Math.min(50, Math.max(1, sanitizeInt(query.pageSize, 20)));
  const offset = (page - 1) * pageSize;
  const db = getAccountDb();
  let countSql = "";
  let rowsSql = "";
  let params: Array<number | string> = [];
  if (scope === "following") {
    countSql = "SELECT COUNT(*) AS total FROM forum_user_follows WHERE follower_user_id = ?";
    rowsSql = `SELECT followed_user_id AS user_id, created_at
       FROM forum_user_follows
       WHERE follower_user_id = ?
       ORDER BY created_at DESC, followed_user_id DESC
       LIMIT ${pageSize} OFFSET ${offset}`;
    params = [user.id];
  } else if (scope === "blocked") {
    countSql = "SELECT COUNT(*) AS total FROM forum_user_blocks WHERE user_id = ?";
    rowsSql = `SELECT blocked_user_id AS user_id, created_at
       FROM forum_user_blocks
       WHERE user_id = ?
       ORDER BY created_at DESC, blocked_user_id DESC
       LIMIT ${pageSize} OFFSET ${offset}`;
    params = [user.id];
  } else {
    countSql = "SELECT COUNT(*) AS total FROM forum_user_follows WHERE followed_user_id = ?";
    rowsSql = `SELECT follower_user_id AS user_id, created_at
       FROM forum_user_follows
       WHERE followed_user_id = ?
       ORDER BY created_at DESC, follower_user_id DESC
       LIMIT ${pageSize} OFFSET ${offset}`;
    params = [user.id];
  }
  const [countRows] = await db.execute<Array<{ total: number }>>(countSql, [user.id]);
  const [rows] = await db.execute<Array<{ user_id: number; created_at: Date | string }>>(rowsSql, params);
  const userIds = rows.map((row) => row.user_id);
  const badgeMap = await loadBadgeMap(userIds);
  let mutualSet = new Set<number>();
  if (userIds.length && scope !== "blocked") {
    if (scope === "following") {
      const [mutualRows] = await db.execute<Array<{ follower_user_id: number }>>(
        `SELECT follower_user_id
         FROM forum_user_follows
         WHERE followed_user_id = ? AND follower_user_id IN (${userIds.map(() => "?").join(", ")})`,
        [user.id, ...userIds]
      );
      mutualSet = new Set(mutualRows.map((row) => row.follower_user_id));
    } else {
      const [mutualRows] = await db.execute<Array<{ followed_user_id: number }>>(
        `SELECT followed_user_id
         FROM forum_user_follows
         WHERE follower_user_id = ? AND followed_user_id IN (${userIds.map(() => "?").join(", ")})`,
        [user.id, ...userIds]
      );
      mutualSet = new Set(mutualRows.map((row) => row.followed_user_id));
    }
  }
  return {
    total: sanitizeInt(countRows[0]?.total),
    page,
    pageSize,
    items: rows.map(
      (row) =>
        ({
          user: badgeMap.get(row.user_id) || {
            id: row.user_id,
            username: "未知鼓友",
            avatarUrl: "https://viewer.sakura-bot.cn/miku.png",
            role: "user",
            roleLabel: "鼓友",
            taikoIdMasked: "未绑定",
            verifiedTitle: null,
            verifiedTitleplateId: null
          },
          createdAt: toIso(row.created_at),
          mutualFollow: scope === "blocked" ? false : mutualSet.has(row.user_id)
        }) satisfies ForumRelationshipItem
    )
  };
};

export const toggleForumFollow = async (
  event: H3Event,
  targetUserIdInput: unknown,
  payload: Record<string, unknown>
) => {
  await ensureForumSchema();
  const user = await requireAccountUser(event);
  await ensureForumProfile(user.id);
  const targetUserId = sanitizeInt(targetUserIdInput, 0);
  if (targetUserId <= 0 || targetUserId === user.id) {
    throw createError({ statusCode: 400, statusMessage: "关注目标无效" });
  }
  const db = getAccountDb();
  const [userRows] = await db.execute<Array<{ id: number }>>(
    "SELECT id FROM web_user_accounts WHERE id = ? LIMIT 1",
    [targetUserId]
  );
  if (!userRows.length) {
    throw createError({ statusCode: 404, statusMessage: "用户不存在" });
  }
  const [blockRows] = await db.execute<Array<{ total: number }>>(
    `SELECT COUNT(*) AS total
     FROM forum_user_blocks
     WHERE (user_id = ? AND blocked_user_id = ?) OR (user_id = ? AND blocked_user_id = ?)`,
    [user.id, targetUserId, targetUserId, user.id]
  );
  if (sanitizeInt(blockRows[0]?.total) > 0) {
    throw createError({ statusCode: 400, statusMessage: "当前拉黑关系下无法关注该用户" });
  }
  const enabled = payload.enabled === undefined ? true : Boolean(payload.enabled);
  if (enabled) {
    await db.execute(
      "INSERT IGNORE INTO forum_user_follows (follower_user_id, followed_user_id) VALUES (?, ?)",
      [user.id, targetUserId]
    );
  } else {
    await db.execute(
      "DELETE FROM forum_user_follows WHERE follower_user_id = ? AND followed_user_id = ?",
      [user.id, targetUserId]
    );
  }
  return {
    ok: true,
    relationship: await getRelationshipState(user.id, targetUserId)
  };
};

export const toggleForumBlock = async (
  event: H3Event,
  targetUserIdInput: unknown,
  payload: Record<string, unknown>
) => {
  await ensureForumSchema();
  const user = await requireAccountUser(event);
  await ensureForumProfile(user.id);
  const targetUserId = sanitizeInt(targetUserIdInput, 0);
  if (targetUserId <= 0 || targetUserId === user.id) {
    throw createError({ statusCode: 400, statusMessage: "拉黑目标无效" });
  }
  const db = getAccountDb();
  const [userRows] = await db.execute<Array<{ id: number }>>(
    "SELECT id FROM web_user_accounts WHERE id = ? LIMIT 1",
    [targetUserId]
  );
  if (!userRows.length) {
    throw createError({ statusCode: 404, statusMessage: "用户不存在" });
  }
  const enabled = payload.enabled === undefined ? true : Boolean(payload.enabled);
  if (enabled) {
    await db.execute(
      "INSERT IGNORE INTO forum_user_blocks (user_id, blocked_user_id) VALUES (?, ?)",
      [user.id, targetUserId]
    );
    await db.execute(
      "DELETE FROM forum_user_follows WHERE (follower_user_id = ? AND followed_user_id = ?) OR (follower_user_id = ? AND followed_user_id = ?)",
      [user.id, targetUserId, targetUserId, user.id]
    );
  } else {
    await db.execute(
      "DELETE FROM forum_user_blocks WHERE user_id = ? AND blocked_user_id = ?",
      [user.id, targetUserId]
    );
  }
  return {
    ok: true,
    relationship: await getRelationshipState(user.id, targetUserId)
  };
};

export const getForumUserProfile = async (event: H3Event, targetUserIdInput: unknown): Promise<ForumUserProfile> => {
  await ensureForumSchema();
  const viewer = await getViewer(event);
  const targetUserId = sanitizeInt(targetUserIdInput, 0);
  if (targetUserId <= 0) {
    throw createError({ statusCode: 400, statusMessage: "用户 ID 无效" });
  }
  const db = getAccountDb();
  const [userRows] = await db.execute<Array<{ id: number }>>(
    "SELECT id FROM web_user_accounts WHERE id = ? LIMIT 1",
    [targetUserId]
  );
  if (!userRows.length) {
    throw createError({ statusCode: 404, statusMessage: "用户不存在" });
  }
  const badgeMap = await loadBadgeMap([targetUserId]);
  const relationship = await getRelationshipState(viewer?.id, targetUserId);
  const [statRows] = await db.execute<
    Array<{ threadCount: number; followerCount: number; followingCount: number }>
  >(
    `SELECT
        (SELECT COUNT(*) FROM forum_threads WHERE author_user_id = ? AND status = 'published') AS threadCount,
        (SELECT COUNT(*) FROM forum_user_follows WHERE followed_user_id = ?) AS followerCount,
        (SELECT COUNT(*) FROM forum_user_follows WHERE follower_user_id = ?) AS followingCount`,
    [targetUserId, targetUserId, targetUserId]
  );
  let latestThreads: ForumUserProfile["latestThreads"] = [];
  if (!relationship.isBlocked) {
    const [threadRows] = await db.execute<DbRow<ThreadRow>[]>(
      `SELECT t.*, s.slug AS section_slug, s.name AS section_name, s.icon AS section_icon, s.accent_color AS section_accent_color
       FROM forum_threads t
       INNER JOIN forum_sections s ON s.id = t.section_id
       WHERE t.author_user_id = ? AND t.status = 'published'
       ORDER BY t.latest_post_at DESC, t.id DESC
       LIMIT 6`,
      [targetUserId]
    );
    const likedThreadIds = await loadThreadLikeSet(threadRows.map((row) => row.id), viewer?.id);
    const favoritedThreadIds = await loadThreadFavoriteSet(threadRows.map((row) => row.id), viewer?.id);
    latestThreads = await Promise.all(
      threadRows.map((row) => sanitizeThreadCard(row, badgeMap, likedThreadIds, favoritedThreadIds))
    );
  }
  return {
    user: badgeMap.get(targetUserId) || {
      id: targetUserId,
      username: "未知鼓友",
      avatarUrl: "https://viewer.sakura-bot.cn/miku.png",
      role: "user",
      roleLabel: "鼓友",
      taikoIdMasked: "未绑定",
      verifiedTitle: null,
      verifiedTitleplateId: null
    },
    relationship,
    stats: {
      threadCount: sanitizeInt(statRows[0]?.threadCount),
      followerCount: sanitizeInt(statRows[0]?.followerCount),
      followingCount: sanitizeInt(statRows[0]?.followingCount)
    },
    latestThreads
  };
};

export const getForumNotifications = async (
  event: H3Event,
  query: { page?: unknown; pageSize?: unknown }
) => {
  await ensureForumSchema();
  const { locale } = createServerMessageTranslator(event);
  const user = await requireAccountUser(event);
  await ensureForumProfile(user.id);
  const page = Math.max(1, sanitizeInt(query.page, 1));
  const pageSize = Math.min(50, Math.max(1, sanitizeInt(query.pageSize, 20)));
  const offset = (page - 1) * pageSize;
  const db = getAccountDb();
  const [countRows] = await db.execute<Array<{ total: number }>>(
    `SELECT COUNT(*) AS total
     FROM forum_notifications n
     WHERE n.user_id = ?
       AND NOT EXISTS (
         SELECT 1 FROM forum_user_blocks b
         WHERE b.user_id = ? AND b.blocked_user_id = n.actor_user_id
       )`,
    [user.id, user.id]
  );
  const [rows] = await db.execute<DbRow<NotificationRow>[]>(
    `SELECT *
     FROM forum_notifications n
     WHERE n.user_id = ?
       AND NOT EXISTS (
         SELECT 1 FROM forum_user_blocks b
         WHERE b.user_id = ? AND b.blocked_user_id = n.actor_user_id
       )
     ORDER BY is_read ASC, id DESC
     LIMIT ${pageSize} OFFSET ${offset}`,
    [user.id, user.id]
  );
  const badgeMap = await loadBadgeMap(rows.map((row) => row.actor_user_id || 0));
  return {
    total: sanitizeInt(countRows[0]?.total),
    unreadCount: await countUnreadNotifications(user.id),
    page,
    pageSize,
    items: rows.map(
      (row) => {
        const rendered = renderNotificationText(row, locale);
        return {
          id: row.id,
          type: row.type,
          title: rendered.title,
          body: rendered.body,
          isRead: Boolean(row.is_read),
          createdAt: toIso(row.created_at),
          threadId: row.thread_id,
          postId: row.post_id,
          actor: row.actor_user_id ? badgeMap.get(row.actor_user_id) || null : null
        } satisfies ForumNotification;
      }
    )
  };
};

export const markForumNotificationsRead = async (event: H3Event, payload: Record<string, unknown>) => {
  await ensureForumSchema();
  const user = await requireAccountUser(event);
  await ensureForumProfile(user.id);
  const ids = Array.isArray(payload.ids)
    ? Array.from(
        new Set(
          payload.ids
            .map((item) => sanitizeInt(item, 0))
            .filter((item) => item > 0)
        )
      )
    : [];
  const db = getAccountDb();
  if (ids.length) {
    const placeholders = ids.map(() => "?").join(", ");
    await db.execute(
      `UPDATE forum_notifications SET is_read = 1 WHERE user_id = ? AND id IN (${placeholders})`,
      [user.id, ...ids]
    );
  } else {
    await db.execute("UPDATE forum_notifications SET is_read = 1 WHERE user_id = ?", [user.id]);
  }
  return {
    ok: true,
    unreadCount: await countUnreadNotifications(user.id)
  };
};
