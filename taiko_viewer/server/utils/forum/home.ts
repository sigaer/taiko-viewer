import type { H3Event } from "h3";
import type { ForumHomePayload } from "~/types/forum";
import { getAccountDb } from "~/server/utils/account-db";
import {
  countUnreadNotifications,
  DEFAULT_AVATAR,
  DEFAULT_TAGS,
  ensureForumSchema,
  getViewer,
  loadBadgeMap,
  parseJsonArray,
  sanitizeInt
} from "../../internal/forum/shared";
import { listForumSections, listForumThreads } from "./threads";

const getLeaderboard = async () => {
  await ensureForumSchema();
  const db = getAccountDb();
  const [rows] = await db.execute<
    Array<{ author_user_id: number; threadCount: number; likeCount: number }>
  >(
    `SELECT author_user_id, COUNT(*) AS threadCount, COALESCE(SUM(like_count), 0) AS likeCount
     FROM forum_threads
     WHERE status = 'published' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
     GROUP BY author_user_id
     ORDER BY threadCount DESC, likeCount DESC, author_user_id ASC
     LIMIT 6`
  );
  const badgeMap = await loadBadgeMap(rows.map((row) => row.author_user_id));
  return rows.map((row) => ({
    author: badgeMap.get(row.author_user_id) || {
      id: row.author_user_id,
      username: "未知鼓友",
      avatarUrl: DEFAULT_AVATAR,
      role: "user",
      roleLabel: "鼓友",
      taikoIdMasked: "未绑定",
      verifiedTitle: null,
      verifiedTitleplateId: null
    },
    threadCount: sanitizeInt(row.threadCount),
    likeCount: sanitizeInt(row.likeCount)
  }));
};

const getHighlightedTags = async () => {
  await ensureForumSchema();
  const db = getAccountDb();
  const [rows] = await db.execute<Array<{ tags_json: string | null }>>(
    `SELECT tags_json
     FROM forum_threads
     WHERE status = 'published'
     ORDER BY is_featured DESC, updated_at DESC
     LIMIT 40`
  );
  const counter = new Map<string, number>();
  for (const row of rows) {
    for (const tag of parseJsonArray<string>(row.tags_json)) {
      counter.set(tag, (counter.get(tag) || 0) + 1);
    }
  }
  const ranked = Array.from(counter.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
    .slice(0, 8)
    .map((entry) => entry[0]);
  return ranked.length ? ranked : DEFAULT_TAGS;
};

export const getForumHome = async (event: H3Event): Promise<ForumHomePayload> => {
  await ensureForumSchema();
  const sections = await listForumSections();
  const viewer = await getViewer(event);
  const [featured, hot, guides, announcements, leaderboard, tags] = await Promise.all([
    listForumThreads(event, { sort: "featured", page: 1, pageSize: 6 }),
    listForumThreads(event, { sort: "hot", page: 1, pageSize: 6 }),
    listForumThreads(event, { sort: "latest", threadType: "guide", page: 1, pageSize: 6 }),
    listForumThreads(event, { sort: "featured", sectionSlug: "official", page: 1, pageSize: 4 }),
    getLeaderboard(),
    getHighlightedTags()
  ]);
  const currentUser = viewer ? (await loadBadgeMap([viewer.id])).get(viewer.id) || null : null;
  return {
    sections,
    featuredThreads: featured.items,
    hotThreads: hot.items,
    latestGuides: guides.items,
    announcements: announcements.items,
    leaderboard,
    currentUser,
    unreadNotificationCount: viewer ? await countUnreadNotifications(viewer.id) : 0,
    highlightedTags: tags
  };
};
