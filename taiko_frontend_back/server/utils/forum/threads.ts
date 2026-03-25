import type { H3Event } from "h3";
import { createError } from "h3";
import type { ResultSetHeader } from "mysql2/promise";
import type { ForumContentBlock, ForumThreadDetail, ForumThreadSort, ForumThreadType } from "~/types/forum";
import { DbRow, getAccountDb } from "~/server/utils/account-db";
import { requireAccountUser } from "~/server/utils/account";
import {
  type PostRow,
  type SectionRow,
  type ThreadRow,
  buildSummaryFromBlocks,
  clipText,
  createMentionNotifications,
  createNotification,
  ensureForumProfile,
  ensureForumSchema,
  extractMentions,
  getSectionBySlug,
  getSongCatalog,
  getThreadRowById,
  getViewer,
  loadBadgeMap,
  loadBlockedUserSet,
  loadPostLikeSet,
  loadThreadFavoriteSet,
  loadThreadLikeSet,
  normalizeContentBlocks,
  normalizeReplyContentBlocks,
  normalizeSort,
  normalizeStoredReplyBlocks,
  normalizeTags,
  normalizeThreadType,
  parseJsonArray,
  recordThreadHistory,
  requireModerator,
  sanitizeInt,
  sanitizeSection,
  sanitizeThreadCard,
  toIso
} from "../../internal/forum/shared";

export const listForumSections = async () => {
  await ensureForumSchema();
  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<SectionRow>[]>(
    `SELECT s.*,
        (SELECT COUNT(*) FROM forum_threads t WHERE t.section_id = s.id AND t.status = 'published') AS threadCount,
        (SELECT COUNT(*) FROM forum_posts p INNER JOIN forum_threads t ON t.id = p.thread_id
          WHERE t.section_id = s.id AND t.status = 'published' AND p.status = 'published') AS postCount,
        (SELECT COUNT(*) FROM forum_threads t WHERE t.section_id = s.id AND t.status = 'published' AND t.is_featured = 1) AS featuredThreadCount
     FROM forum_sections s
     ORDER BY s.sort_order ASC, s.id ASC`
  );
  return rows.map(sanitizeSection);
};

export const listForumThreads = async (
  event: H3Event | null,
  query: {
    sectionSlug?: unknown;
    sort?: unknown;
    page?: unknown;
    pageSize?: unknown;
    keyword?: unknown;
    threadType?: unknown;
    songId?: unknown;
    scope?: unknown;
    includeHidden?: unknown;
  }
) => {
  await ensureForumSchema();
  const db = getAccountDb();
  const viewer = event ? await getViewer(event) : null;
  const viewerProfile = viewer ? await ensureForumProfile(viewer.id) : null;
  const page = Math.max(1, sanitizeInt(query.page, 1));
  const pageSize = Math.min(30, Math.max(1, sanitizeInt(query.pageSize, 12)));
  const sort = normalizeSort(query.sort);
  const keyword = clipText(String(query.keyword || "").trim(), 80);
  const scope = String(query.scope || "").trim();
  const includeHidden =
    Boolean(query.includeHidden) &&
    ["moderator", "admin"].includes(viewerProfile?.role || "");
  const filters: string[] = [
    includeHidden ? "t.status IN ('published', 'hidden')" : "t.status = 'published'"
  ];
  const params: Array<string | number> = [];
  let joinSql = "";
  let scopedOrderSql = "";

  if (query.sectionSlug) {
    filters.push("s.slug = ?");
    params.push(String(query.sectionSlug));
  }
  if (query.threadType && ["strategy", "discussion", "achievement", "official", "guide"].includes(String(query.threadType))) {
    filters.push("t.thread_type = ?");
    params.push(String(query.threadType));
  }
  if (keyword) {
    filters.push("t.title LIKE ?");
    params.push(`%${keyword}%`);
  }
  const songId = sanitizeInt(query.songId, 0);
  if (songId > 0) {
    filters.push("t.song_id = ?");
    params.push(songId);
  }
  if (scope) {
    if (!viewer) {
      throw createError({ statusCode: 401, statusMessage: "请先登录" });
    }
    if (scope === "mine") {
      filters.push("t.author_user_id = ?");
      params.push(viewer.id);
    } else if (scope === "replied") {
      joinSql =
        "INNER JOIN (SELECT thread_id, MAX(created_at) AS related_at FROM forum_posts WHERE author_user_id = ? AND status = 'published' GROUP BY thread_id) rp ON rp.thread_id = t.id";
      params.unshift(viewer.id);
      scopedOrderSql = "ORDER BY rp.related_at DESC, t.id DESC";
    } else if (scope === "favorites") {
      joinSql = "INNER JOIN forum_thread_favorites fav ON fav.thread_id = t.id AND fav.user_id = ?";
      params.unshift(viewer.id);
      scopedOrderSql = "ORDER BY fav.created_at DESC, t.id DESC";
    } else if (scope === "history") {
      joinSql = "INNER JOIN forum_thread_history hist ON hist.thread_id = t.id AND hist.user_id = ?";
      params.unshift(viewer.id);
      scopedOrderSql = "ORDER BY hist.viewed_at DESC, t.id DESC";
    }
  }
  if (sort === "hot") {
    filters.push("t.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)");
  }
  if (viewer) {
    filters.push("NOT EXISTS (SELECT 1 FROM forum_user_blocks b WHERE b.user_id = ? AND b.blocked_user_id = t.author_user_id)");
    params.push(viewer.id);
  }

  const whereSql = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const offset = (page - 1) * pageSize;
  let orderSql = "ORDER BY t.is_pinned DESC, t.latest_post_at DESC, t.id DESC";
  if (scopedOrderSql) {
    orderSql = scopedOrderSql;
  } else if (sort === "featured") {
    orderSql = "ORDER BY t.is_pinned DESC, t.is_featured DESC, t.latest_post_at DESC, t.id DESC";
  } else if (sort === "hot") {
    orderSql =
      "ORDER BY t.is_pinned DESC, (t.reply_count * 4 + t.like_count * 2 + FLOOR(t.view_count / 20)) DESC, t.latest_post_at DESC, t.id DESC";
  }

  const [countRows] = await db.execute<Array<{ total: number }>>(
    `SELECT COUNT(*) AS total
     FROM (
       SELECT t.id
       FROM forum_threads t
       INNER JOIN forum_sections s ON s.id = t.section_id
       ${joinSql}
       ${whereSql}
       GROUP BY t.id
     ) AS counted_rows`,
    params
  );
  const [rows] = await db.execute<DbRow<ThreadRow>[]>(
    `SELECT t.*, s.slug AS section_slug, s.name AS section_name, s.icon AS section_icon, s.accent_color AS section_accent_color
     FROM forum_threads t
     INNER JOIN forum_sections s ON s.id = t.section_id
     ${joinSql}
     ${whereSql}
     ${orderSql}
     LIMIT ${pageSize} OFFSET ${offset}`,
    params
  );
  const badgeMap = await loadBadgeMap(rows.map((row) => row.author_user_id));
  const likedThreadIds = await loadThreadLikeSet(rows.map((row) => row.id), viewer?.id);
  const favoritedThreadIds = await loadThreadFavoriteSet(rows.map((row) => row.id), viewer?.id);
  return {
    total: sanitizeInt(countRows[0]?.total),
    page,
    pageSize,
    sort,
    items: await Promise.all(
      rows.map((row) => sanitizeThreadCard(row, badgeMap, likedThreadIds, favoritedThreadIds))
    )
  };
};

export const getForumThreadDetail = async (event: H3Event, threadIdInput: unknown) => {
  await ensureForumSchema();
  const threadId = sanitizeInt(threadIdInput, 0);
  if (threadId <= 0) {
    throw createError({ statusCode: 400, statusMessage: "帖子 ID 无效" });
  }
  const db = getAccountDb();
  const viewer = await getViewer(event);
  const viewerProfile = viewer ? await ensureForumProfile(viewer.id) : null;
  const row = await getThreadRowById(threadId);
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: "帖子不存在" });
  }
  if (row.status !== "published" && !viewerProfile?.role.match(/admin|moderator/)) {
    throw createError({ statusCode: 404, statusMessage: "帖子不存在" });
  }

  await db.execute("UPDATE forum_threads SET view_count = view_count + 1 WHERE id = ?", [threadId]);
  row.view_count += 1;
  if (viewer) {
    await recordThreadHistory(viewer.id, threadId);
  }

  const [postRows] = await db.execute<DbRow<PostRow>[]>(
    `SELECT *
     FROM forum_posts
     WHERE thread_id = ? AND status = 'published'
     ORDER BY CASE WHEN parent_post_id IS NULL THEN floor_no ELSE 1000000 + id END ASC, created_at ASC, id ASC`,
    [threadId]
  );

  const badgeMap = await loadBadgeMap([row.author_user_id, ...postRows.map((post) => post.author_user_id)]);
  const likedThreadIds = await loadThreadLikeSet([threadId], viewer?.id);
  const favoritedThreadIds = await loadThreadFavoriteSet([threadId], viewer?.id);
  const likedPostIds = await loadPostLikeSet(postRows.map((post) => post.id), viewer?.id);
  const blockedUserIds = await loadBlockedUserSet(viewer?.id);
  const thread = await sanitizeThreadCard(row, badgeMap, likedThreadIds, favoritedThreadIds);
  const repliesByRoot = new Map<number, ForumPostReply[]>();
  const floors: ForumPostFloor[] = [];

  for (const post of postRows) {
    const author = badgeMap.get(post.author_user_id) || {
      id: post.author_user_id,
      username: "未知鼓友",
      avatarUrl: "https://forum.sakura-bot.cn/miku.png",
      role: "user",
      roleLabel: "鼓友",
      taikoIdMasked: "未绑定",
      verifiedTitle: null,
      verifiedTitleplateId: null
    };
    if (post.parent_post_id === null) {
      floors.push({
        id: post.id,
        floorNo: post.floor_no,
        bodyText: post.body_text,
        contentBlocks: normalizeStoredReplyBlocks(post.content_blocks_json, post.body_text),
        likeCount: sanitizeInt(post.like_count),
        createdAt: toIso(post.created_at),
        author,
        viewerHasLiked: likedPostIds.has(post.id),
        isBlockedAuthor: blockedUserIds.has(post.author_user_id),
        replies: []
      });
      continue;
    }
    const rootId = post.root_post_id || post.parent_post_id;
    const bucket = repliesByRoot.get(rootId) || [];
    bucket.push({
      id: post.id,
      parentPostId: post.parent_post_id,
      rootPostId: post.root_post_id,
      bodyText: post.body_text,
      contentBlocks: normalizeStoredReplyBlocks(post.content_blocks_json, post.body_text),
      likeCount: sanitizeInt(post.like_count),
      createdAt: toIso(post.created_at),
      author,
      viewerHasLiked: likedPostIds.has(post.id),
      isBlockedAuthor: blockedUserIds.has(post.author_user_id)
    });
    repliesByRoot.set(rootId, bucket);
  }

  for (const floor of floors) {
    floor.replies = repliesByRoot.get(floor.id) || [];
  }

  return {
    ...thread,
    contentBlocks: normalizeContentBlocks(parseJsonArray<ForumContentBlock>(row.content_blocks_json)),
    posts: floors
  } satisfies ForumThreadDetail;
};

const validateSongBinding = async (payload: { songId?: unknown; difficultyType?: unknown; level?: unknown }) => {
  const songId = sanitizeInt(payload.songId, 0);
  if (songId <= 0) {
    return {
      songId: null,
      difficultyType: null,
      level: null
    };
  }
  const difficultyType = sanitizeInt(payload.difficultyType, 0);
  const level = sanitizeInt(payload.level, 0);
  const catalog = await getSongCatalog();
  const song = catalog.map.get(songId);
  if (!song) {
    throw createError({ statusCode: 400, statusMessage: "关联曲目不存在" });
  }
  return {
    songId,
    difficultyType: difficultyType > 0 ? difficultyType : null,
    level: level > 0 ? level : null
  };
};

export const createForumThread = async (event: H3Event, payload: Record<string, unknown>) => {
  await ensureForumSchema();
  const user = await requireAccountUser(event);
  const profile = await ensureForumProfile(user.id);
  const title = clipText(String(payload.title || ""), 120);
  if (!title) {
    throw createError({ statusCode: 400, statusMessage: "请输入标题" });
  }
  if (title.length < 4) {
    throw createError({ statusCode: 400, statusMessage: "标题至少需要 4 个字符" });
  }
  const sectionSlug = String(payload.sectionSlug || "").trim();
  if (!sectionSlug) {
    throw createError({ statusCode: 400, statusMessage: "请选择版块" });
  }
  const section = await getSectionBySlug(sectionSlug);
  if (!section) {
    throw createError({ statusCode: 404, statusMessage: "版块不存在" });
  }
  const threadType = normalizeThreadType(payload.threadType);
  if (threadType === "official" && !["moderator", "admin"].includes(profile.role)) {
    throw createError({ statusCode: 403, statusMessage: "只有版主或站务可以发布公告帖" });
  }
  const contentBlocks = normalizeContentBlocks(payload.contentBlocks);
  const paragraphTexts = contentBlocks
    .filter((block) => block.type === "paragraph")
    .map((block) => block.text);
  const summary = clipText(String(payload.summary || "").trim(), 280) || buildSummaryFromBlocks(contentBlocks);
  const tags = normalizeTags(payload.tags);
  const derivedCover = contentBlocks.find((block) => block.type === "image")?.imageUrl || "";
  const coverImageUrl = clipText(String(payload.coverImageUrl || derivedCover || "").trim(), 1024);
  const songBinding = await validateSongBinding(payload);

  const db = getAccountDb();
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO forum_threads
      (section_id, author_user_id, thread_type, title, summary, content_blocks_json, cover_image_url, tags_json,
       song_id, difficulty_type, level, status, latest_post_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', NOW())`,
    [
      section.id,
      user.id,
      threadType,
      title,
      summary,
      JSON.stringify(contentBlocks),
      coverImageUrl || null,
      JSON.stringify(tags),
      songBinding.songId,
      songBinding.difficultyType,
      songBinding.level
    ]
  );
  const threadId = result.insertId;
  await createMentionNotifications({
    actorUserId: user.id,
    usernames: extractMentions(paragraphTexts),
    title: `你在帖子中被提及：${title}`,
    bodyPrefix: `${user.username} 在新帖《${clipText(title, 24)}》中提到了你`,
    threadId
  });
  return await getForumThreadDetail(event, threadId);
};

export const createForumReply = async (event: H3Event, threadIdInput: unknown, payload: Record<string, unknown>) => {
  await ensureForumSchema();
  const user = await requireAccountUser(event);
  await ensureForumProfile(user.id);
  const threadId = sanitizeInt(threadIdInput, 0);
  const thread = await getThreadRowById(threadId);
  if (!thread || thread.status !== "published") {
    throw createError({ statusCode: 404, statusMessage: "帖子不存在" });
  }
  if (thread.is_locked) {
    throw createError({ statusCode: 400, statusMessage: "该帖子已锁定，暂时无法回复" });
  }

  const contentBlocks = normalizeReplyContentBlocks(payload);
  const bodyText = contentBlocks
    .filter((block) => block.type === "paragraph")
    .map((block) => block.text.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
  const replySnippet = bodyText || "发来了一条图片回复";
  const parentPostId = sanitizeInt(payload.parentPostId, 0);
  const db = getAccountDb();
  let parentPost: PostRow | null = null;
  let floorNo = 0;
  let rootPostId: number | null = null;

  if (parentPostId > 0) {
    const [rows] = await db.execute<DbRow<PostRow>[]>(
      "SELECT * FROM forum_posts WHERE id = ? AND thread_id = ? AND status = 'published' LIMIT 1",
      [parentPostId, threadId]
    );
    parentPost = rows[0] || null;
    if (!parentPost) {
      throw createError({ statusCode: 404, statusMessage: "回复目标不存在" });
    }
    rootPostId = parentPost.root_post_id || parentPost.id;
  } else {
    const [rows] = await db.execute<Array<{ maxFloor: number | null }>>(
      "SELECT MAX(floor_no) AS maxFloor FROM forum_posts WHERE thread_id = ? AND parent_post_id IS NULL",
      [threadId]
    );
    floorNo = sanitizeInt(rows[0]?.maxFloor) + 1;
  }

  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO forum_posts
      (thread_id, author_user_id, parent_post_id, root_post_id, floor_no, body_text, content_blocks_json, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'published')`,
    [threadId, user.id, parentPost ? parentPost.id : null, rootPostId, floorNo, bodyText, JSON.stringify(contentBlocks)]
  );
  const createdPostId = result.insertId;
  await db.execute(
    `UPDATE forum_threads
     SET reply_count = reply_count + 1, latest_post_at = NOW(), updated_at = NOW()
     WHERE id = ?`,
    [threadId]
  );

  if (parentPost) {
    if (parentPost.author_user_id !== user.id) {
      await createNotification({
        userId: parentPost.author_user_id,
        actorUserId: user.id,
        type: "reply",
        title: `你收到一条楼中楼回复：${thread.title}`,
        body: `${user.username} 在《${clipText(thread.title, 20)}》中回复了你：${replySnippet}`,
        threadId,
        postId: createdPostId
      });
    }
  } else if (thread.author_user_id !== user.id) {
    await createNotification({
      userId: thread.author_user_id,
      actorUserId: user.id,
      type: "reply",
      title: `你的主题收到新回复：${thread.title}`,
      body: `${user.username} 回复了你的帖子《${clipText(thread.title, 20)}》：${replySnippet}`,
      threadId,
      postId: createdPostId
    });
  }

  await createMentionNotifications({
    actorUserId: user.id,
    usernames: extractMentions(bodyText ? [bodyText] : []),
    title: `你在回复中被提及：${thread.title}`,
    bodyPrefix: `${user.username} 在《${clipText(thread.title, 20)}》的回复中提到了你`,
    threadId,
    postId: createdPostId
  });

  return await getForumThreadDetail(event, threadId);
};

export const toggleForumThreadLike = async (event: H3Event, threadIdInput: unknown) => {
  await ensureForumSchema();
  const user = await requireAccountUser(event);
  await ensureForumProfile(user.id);
  const threadId = sanitizeInt(threadIdInput, 0);
  const thread = await getThreadRowById(threadId);
  if (!thread || thread.status !== "published") {
    throw createError({ statusCode: 404, statusMessage: "帖子不存在" });
  }
  const db = getAccountDb();
  const [rows] = await db.execute<Array<{ id: number }>>(
    "SELECT id FROM forum_thread_likes WHERE thread_id = ? AND user_id = ? LIMIT 1",
    [threadId, user.id]
  );
  let liked = false;
  if (rows.length) {
    await db.execute("DELETE FROM forum_thread_likes WHERE thread_id = ? AND user_id = ?", [threadId, user.id]);
    await db.execute("UPDATE forum_threads SET like_count = GREATEST(like_count - 1, 0) WHERE id = ?", [threadId]);
  } else {
    await db.execute("INSERT INTO forum_thread_likes (thread_id, user_id) VALUES (?, ?)", [threadId, user.id]);
    await db.execute("UPDATE forum_threads SET like_count = like_count + 1 WHERE id = ?", [threadId]);
    liked = true;
    if (thread.author_user_id !== user.id) {
      await createNotification({
        userId: thread.author_user_id,
        actorUserId: user.id,
        type: "like",
        title: `你的帖子收到赞：${thread.title}`,
        body: `${user.username} 赞了你的帖子《${clipText(thread.title, 20)}》`,
        threadId
      });
    }
  }
  const [countRows] = await db.execute<Array<{ like_count: number }>>(
    "SELECT like_count FROM forum_threads WHERE id = ?",
    [threadId]
  );
  return {
    liked,
    likeCount: sanitizeInt(countRows[0]?.like_count)
  };
};

export const toggleForumPostLike = async (event: H3Event, postIdInput: unknown) => {
  await ensureForumSchema();
  const user = await requireAccountUser(event);
  await ensureForumProfile(user.id);
  const postId = sanitizeInt(postIdInput, 0);
  const db = getAccountDb();
  const [postRows] = await db.execute<Array<PostRow & { thread_title: string }>>(
    `SELECT p.*, t.title AS thread_title
     FROM forum_posts p
     INNER JOIN forum_threads t ON t.id = p.thread_id
     WHERE p.id = ? AND p.status = 'published' AND t.status = 'published'
     LIMIT 1`,
    [postId]
  );
  const post = postRows[0];
  if (!post) {
    throw createError({ statusCode: 404, statusMessage: "回复不存在" });
  }
  const [likeRows] = await db.execute<Array<{ id: number }>>(
    "SELECT id FROM forum_post_likes WHERE post_id = ? AND user_id = ? LIMIT 1",
    [postId, user.id]
  );
  let liked = false;
  if (likeRows.length) {
    await db.execute("DELETE FROM forum_post_likes WHERE post_id = ? AND user_id = ?", [postId, user.id]);
    await db.execute("UPDATE forum_posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = ?", [postId]);
  } else {
    await db.execute("INSERT INTO forum_post_likes (post_id, user_id) VALUES (?, ?)", [postId, user.id]);
    await db.execute("UPDATE forum_posts SET like_count = like_count + 1 WHERE id = ?", [postId]);
    liked = true;
    if (post.author_user_id !== user.id) {
      await createNotification({
        userId: post.author_user_id,
        actorUserId: user.id,
        type: "like",
        title: `你的回复收到赞：${post.thread_title}`,
        body: `${user.username} 赞了你在《${clipText(post.thread_title, 20)}》中的回复`,
        threadId: post.thread_id,
        postId
      });
    }
  }
  const [countRows] = await db.execute<Array<{ like_count: number }>>(
    "SELECT like_count FROM forum_posts WHERE id = ?",
    [postId]
  );
  return {
    liked,
    likeCount: sanitizeInt(countRows[0]?.like_count)
  };
};

export const toggleForumThreadFavorite = async (
  event: H3Event,
  threadIdInput: unknown,
  enabledInput?: unknown
) => {
  await ensureForumSchema();
  const user = await requireAccountUser(event);
  await ensureForumProfile(user.id);
  const threadId = sanitizeInt(threadIdInput, 0);
  const thread = await getThreadRowById(threadId);
  if (!thread || thread.status !== "published") {
    throw createError({ statusCode: 404, statusMessage: "帖子不存在" });
  }
  const db = getAccountDb();
  const [rows] = await db.execute<Array<{ id: number }>>(
    "SELECT id FROM forum_thread_favorites WHERE thread_id = ? AND user_id = ? LIMIT 1",
    [threadId, user.id]
  );
  const currentlyFavorited = rows.length > 0;
  const desiredState = enabledInput === undefined ? null : Boolean(enabledInput);
  let favorited = currentlyFavorited;
  if (currentlyFavorited && desiredState !== true) {
    await db.execute("DELETE FROM forum_thread_favorites WHERE thread_id = ? AND user_id = ?", [threadId, user.id]);
    favorited = false;
  } else if (!currentlyFavorited && desiredState !== false) {
    await db.execute("INSERT INTO forum_thread_favorites (thread_id, user_id) VALUES (?, ?)", [threadId, user.id]);
    favorited = true;
  }
  const [countRows] = await db.execute<Array<{ total: number }>>(
    "SELECT COUNT(*) AS total FROM forum_thread_favorites WHERE thread_id = ?",
    [threadId]
  );
  return {
    favorited,
    favoriteCount: sanitizeInt(countRows[0]?.total)
  };
};

export const moderateForumThread = async (event: H3Event, payload: Record<string, unknown>) => {
  await ensureForumSchema();
  const { user } = await requireModerator(event);
  const threadId = sanitizeInt(payload.threadId, 0);
  const action = String(payload.action || "").trim();
  const enabled = payload.enabled === undefined ? true : Boolean(payload.enabled);
  const reason = clipText(String(payload.reason || "").trim(), 255);
  const thread = await getThreadRowById(threadId);
  if (!thread) {
    throw createError({ statusCode: 404, statusMessage: "帖子不存在" });
  }

  const actionMap: Record<string, { sql: string; label: string }> = {
    pin: { sql: "is_pinned = ?", label: enabled ? "置顶" : "取消置顶" },
    feature: { sql: "is_featured = ?", label: enabled ? "加精" : "取消加精" },
    lock: { sql: "is_locked = ?", label: enabled ? "锁帖" : "解除锁帖" },
    hide: { sql: "status = ?", label: enabled ? "隐藏" : "恢复显示" }
  };
  const target = actionMap[action];
  if (!target) {
    throw createError({ statusCode: 400, statusMessage: "不支持的管理动作" });
  }
  const db = getAccountDb();
  const value = action === "hide" ? (enabled ? "hidden" : "published") : enabled ? 1 : 0;
  await db.execute(`UPDATE forum_threads SET ${target.sql}, updated_at = NOW() WHERE id = ?`, [value, threadId]);
  await db.execute(
    "INSERT INTO forum_moderation_logs (thread_id, operator_user_id, action, reason) VALUES (?, ?, ?, ?)",
    [threadId, user.id, `${action}:${enabled ? "on" : "off"}`, reason || null]
  );
  if (thread.author_user_id !== user.id) {
    await createNotification({
      userId: thread.author_user_id,
      actorUserId: user.id,
      type: "system",
      title: `你的帖子状态已变更：${thread.title}`,
      body: `帖子《${clipText(thread.title, 20)}》已被${target.label}${reason ? `，原因：${reason}` : ""}`,
      threadId
    });
  }
  return { ok: true };
};
