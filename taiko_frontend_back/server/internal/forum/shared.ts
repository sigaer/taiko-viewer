import { readFileSync } from "node:fs";
import type { H3Event } from "h3";
import { createError, getHeader } from "h3";
import OSS from "ali-oss";
import sharp from "sharp";
import type {
  ForumContentBlock,
  ForumNotificationType,
  ForumPostFloor,
  ForumPostReply,
  ForumRole,
  ForumSection,
  ForumThreadCard,
  ForumThreadSort,
  ForumThreadType,
  ForumUserBadge
} from "~/types/forum";
import { getSongCatalog as loadSongCatalog } from "~/server/services/content";
import {
  FORUM_NOTIFICATION_TYPES,
  FORUM_ROLES,
  FORUM_THREAD_SORTS,
  FORUM_THREAD_TYPES
} from "~/types/forum";
import { DbRow, getAccountDb } from "~/server/utils/account-db";
import {
  getAccountProfile,
  getAccountUserFromEvent,
  requireAccountUser
} from "~/server/utils/account";
import { ensureForumSchema } from "~/server/utils/forum-db";

export { ensureForumSchema };

export const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const DEFAULT_AVATAR = "https://forum.sakura-bot.cn/miku.png";
export const DEFAULT_TAGS = ["全良", "段位", "攻略", "金冠", "活动"];
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
] as const;
export const ALLOWED_IMAGE_FORMATS = new Set(["jpeg", "png", "webp", "gif"]);

type AccountRow = {
  id: number;
  username: string;
  avatar_url: string | null;
};

export type ForumProfileRow = {
  user_id: number;
  role: ForumRole;
  record_history_enabled?: number;
};

export type BindingRow = {
  user_id: number;
  taiko_id: string | null;
  verified_title: string | null;
  verified_titleplate_id: number | null;
};

export type SectionRow = {
  id: number;
  slug: string;
  name: string;
  description: string;
  icon: string;
  accent_color: string;
  sort_order: number;
  threadCount?: number;
  postCount?: number;
  featuredThreadCount?: number;
};

export type ThreadRow = {
  id: number;
  section_id: number;
  author_user_id: number;
  thread_type: ForumThreadType;
  title: string;
  summary: string;
  content_blocks_json: string;
  cover_image_url: string | null;
  tags_json: string | null;
  song_id: number | null;
  difficulty_type: number | null;
  level: number | null;
  status: "published" | "hidden";
  is_pinned: number;
  is_featured: number;
  is_locked: number;
  view_count: number;
  like_count: number;
  reply_count: number;
  latest_post_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
  section_slug: string;
  section_name: string;
  section_icon: string;
  section_accent_color: string;
};

export type PostRow = {
  id: number;
  thread_id: number;
  author_user_id: number;
  parent_post_id: number | null;
  root_post_id: number | null;
  floor_no: number;
  body_text: string;
  content_blocks_json: string | null;
  like_count: number;
  status: "published" | "hidden";
  created_at: Date | string;
};

export type NotificationRow = {
  id: number;
  user_id: number;
  actor_user_id: number | null;
  type: ForumNotificationType;
  title: string;
  body: string;
  thread_id: number | null;
  post_id: number | null;
  is_read: number;
  created_at: Date | string;
};

type SongMeta = {
  id: number;
  song_name: string;
  song_name_jp?: string;
  category?: string;
  level_1?: number | string;
  level_2?: number | string;
  level_3?: number | string;
  level_4?: number | string;
  level_5?: number | string;
};

export const toIso = (value: Date | string | number | null | undefined) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
};

export const sanitizeInt = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.trunc(parsed);
};

export const clipText = (value: string, limit: number) => {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 1)}…`;
};

export const detectImageFormat = async (buffer: Buffer) => {
  try {
    const metadata = await sharp(buffer, { animated: true }).metadata();
    return String(metadata.format || "").toLowerCase();
  } catch {
    return "";
  }
};

export const ensureNonEmpty = (value: string, message: string) => {
  if (!value) {
    throw createError({ statusCode: 400, statusMessage: message });
  }
};

const getIniValue = (content: string, key: string) => {
  const match = content.match(new RegExp(`^${key}\\s*=\\s*(.+)$`, "m"));
  return match?.[1]?.trim() || "";
};

const loadOssutilFallback = () => {
  try {
    const content = readFileSync("/root/.ossutilconfig", "utf-8");
    return {
      endpoint: getIniValue(content, "endpoint"),
      accessKeyId: getIniValue(content, "accessKeyID"),
      accessKeySecret: getIniValue(content, "accessKeySecret")
    };
  } catch {
    return {
      endpoint: "",
      accessKeyId: "",
      accessKeySecret: ""
    };
  }
};

const getAvatarConfig = () => {
  const runtimeConfig = useRuntimeConfig();
  const fallback = loadOssutilFallback();
  return {
    endpoint: String(runtimeConfig.ossEndpoint || process.env.OSS_ENDPOINT || fallback.endpoint || ""),
    region: String(runtimeConfig.ossRegion || process.env.OSS_REGION || ""),
    bucket: String(runtimeConfig.ossBucket || process.env.OSS_BUCKET || "sigaer"),
    accessKeyId: String(runtimeConfig.ossAccessKeyId || process.env.OSS_ACCESS_KEY_ID || fallback.accessKeyId || ""),
    accessKeySecret: String(runtimeConfig.ossAccessKeySecret || process.env.OSS_ACCESS_KEY_SECRET || fallback.accessKeySecret || ""),
    publicBaseUrl: String(runtimeConfig.ossPublicBaseUrl || process.env.OSS_PUBLIC_BASE_URL || "https://static.sakura-bot.cn")
  };
};

export const requireConfiguredOss = () => {
  const config = getAvatarConfig();
  if (!config.endpoint || !config.bucket || !config.accessKeyId || !config.accessKeySecret) {
    throw createError({
      statusCode: 500,
      statusMessage: "OSS 未配置，暂时无法上传论坛图片"
    });
  }
  return config;
};

export const getOssClient = () => {
  const config = requireConfiguredOss();
  return new OSS({
    endpoint: config.endpoint,
    region: config.region || undefined,
    bucket: config.bucket,
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    secure: true
  });
};

export const getCoverUrl = (songId: number) => {
  const runtimeConfig = useRuntimeConfig();
  const apiBase = String(runtimeConfig.public.apiBase || "https://static.sakura-bot.cn").replace(/\/$/, "");
  return `${apiBase}/cover/${songId}.png`;
};

export const getDifficultyLabel = (difficultyType: number | null | undefined) => {
  switch (Number(difficultyType || 0)) {
    case 1:
      return "简单";
    case 2:
      return "普通";
    case 3:
      return "困难";
    case 4:
      return "魔王";
    case 5:
      return "里谱";
    default:
      return "未绑定谱面";
  }
};

export const getRoleLabel = (role: ForumRole) => {
  switch (role) {
    case "admin":
      return "站务";
    case "moderator":
      return "版主";
    default:
      return "鼓友";
  }
};

export const maskTaikoId = (value: string | null | undefined) => {
  const raw = String(value || "").trim();
  if (!raw) return "未绑定";
  if (raw.length <= 5) return `${raw[0] || "*"}***`;
  return `${raw.slice(0, 3)}***${raw.slice(-2)}`;
};

export const parseJsonArray = <T>(value: string | null | undefined, fallback: T[] = []) => {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
};

export const buildSummaryFromBlocks = (blocks: ForumContentBlock[]) => {
  const firstParagraph = blocks.find((block) => block.type === "paragraph" && block.text.trim());
  return clipText(firstParagraph?.text || "这是一篇新的太鼓讨论帖。", 120);
};

export const sanitizeBlocks = (input: unknown, maxBlocks: number) => {
  if (!Array.isArray(input) || !input.length) {
    return [];
  }
  const blocks: ForumContentBlock[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const record = raw as Record<string, unknown>;
    if (record.type === "paragraph") {
      const text = String(record.text || "").trim();
      if (!text) continue;
      blocks.push({
        type: "paragraph",
        text: clipText(text, 4000)
      });
      continue;
    }
    if (record.type === "image") {
      const imageUrl = String(record.imageUrl || "").trim();
      if (!imageUrl) continue;
      blocks.push({
        type: "image",
        imageUrl,
        alt: clipText(String(record.alt || ""), 120),
        caption: clipText(String(record.caption || ""), 160)
      });
    }
  }
  return blocks.slice(0, maxBlocks);
};

export const normalizeContentBlocks = (input: unknown) => {
  const blocks = sanitizeBlocks(input, 50);
  if (!blocks.length) {
    throw createError({ statusCode: 400, statusMessage: "帖子正文不能为空" });
  }
  return blocks;
};

export const normalizeReplyContentBlocks = (payload: Record<string, unknown>) => {
  const bodyText = clipText(String(payload.bodyText || "").trim(), 1000);
  const imageBlocks = sanitizeBlocks(payload.contentBlocks, 5).filter((block) => block.type === "image");
  const blocks: ForumContentBlock[] = [];
  if (bodyText) {
    blocks.push({
      type: "paragraph",
      text: bodyText
    });
  }
  blocks.push(...imageBlocks.slice(0, 4));
  if (!blocks.length) {
    throw createError({ statusCode: 400, statusMessage: "回复内容不能为空" });
  }
  if (imageBlocks.length > 4) {
    throw createError({
      statusCode: 400,
      statusMessage: "单条回复最多上传 4 张图片"
    });
  }
  return blocks;
};

export const getReplyBodyText = (blocks: ForumContentBlock[]) =>
  blocks
    .filter(
      (block): block is Extract<ForumContentBlock, { type: "paragraph" }> => block.type === "paragraph"
    )
    .map((block) => block.text.trim())
    .filter(Boolean)
    .join("\n")
    .trim();

export const getReplyNotificationSnippet = (blocks: ForumContentBlock[]) => {
  const bodyText = getReplyBodyText(blocks);
  return bodyText || "发来了一条图片回复";
};

export const normalizeStoredReplyBlocks = (value: string | null | undefined, bodyText: string) => {
  const parsed = sanitizeBlocks(parseJsonArray<ForumContentBlock>(value), 5);
  if (parsed.length) {
    return parsed;
  }
  if (!bodyText.trim()) {
    return [];
  }
  return [
    {
      type: "paragraph",
      text: clipText(bodyText, 1000)
    }
  ] satisfies ForumContentBlock[];
};

export const normalizeTags = (input: unknown) => {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const item of input) {
    const tag = clipText(String(item || "").trim(), 16);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= 6) break;
  }
  return tags;
};

export const normalizeThreadType = (value: unknown): ForumThreadType => {
  const type = String(value || "").trim() as ForumThreadType;
  if (!FORUM_THREAD_TYPES.includes(type)) {
    throw createError({ statusCode: 400, statusMessage: "帖子类型无效" });
  }
  return type;
};

export const normalizeSort = (value: unknown): ForumThreadSort => {
  const sort = String(value || "latest").trim() as ForumThreadSort;
  return FORUM_THREAD_SORTS.includes(sort) ? sort : "latest";
};

export const getSongCatalog = async () => {
  const list = (await loadSongCatalog()) as SongMeta[];
  const map = new Map<number, SongMeta>();
  for (const item of list) {
    map.set(Number(item.id), item);
  }
  return { list, map };
};

export const extractMentions = (texts: string[]) => {
  const seen = new Set<string>();
  const mentions: string[] = [];
  const source = texts.join("\n");
  const regex = /@([A-Za-z0-9_\-\u4e00-\u9fa5]{1,64})/g;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(source))) {
    const username = match[1];
    if (seen.has(username)) continue;
    seen.add(username);
    mentions.push(username);
  }
  return mentions;
};

export const ensureForumProfile = async (userId: number) => {
  await ensureForumSchema();
  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<ForumProfileRow>[]>(
    "SELECT * FROM forum_user_profiles WHERE user_id = ? LIMIT 1",
    [userId]
  );
  if (rows.length) {
    return rows[0];
  }
  const [countRows] = await db.execute<Array<{ total: number }>>(
    "SELECT COUNT(*) AS total FROM forum_user_profiles"
  );
  const role: ForumRole = Number(countRows[0]?.total || 0) === 0 ? "admin" : "user";
  await db.execute(
    "INSERT INTO forum_user_profiles (user_id, role) VALUES (?, ?)",
    [userId, role]
  );
  return { user_id: userId, role, record_history_enabled: 1 };
};

export const getViewer = async (event: H3Event) => {
  const account = await getAccountUserFromEvent(event);
  if (!account) return null;
  await ensureForumProfile(account.id);
  return account;
};

export const loadBlockedUserSet = async (userId?: number | null) => {
  const result = new Set<number>();
  if (!userId) return result;
  const db = getAccountDb();
  const [rows] = await db.execute<Array<{ blocked_user_id: number }>>(
    "SELECT blocked_user_id FROM forum_user_blocks WHERE user_id = ?",
    [userId]
  );
  for (const row of rows) {
    result.add(row.blocked_user_id);
  }
  return result;
};

export const loadThreadFavoriteSet = async (threadIds: number[], viewerUserId?: number | null) => {
  const result = new Set<number>();
  if (!viewerUserId || !threadIds.length) return result;
  const placeholders = threadIds.map(() => "?").join(", ");
  const db = getAccountDb();
  const [rows] = await db.execute<Array<{ thread_id: number }>>(
    `SELECT thread_id FROM forum_thread_favorites WHERE user_id = ? AND thread_id IN (${placeholders})`,
    [viewerUserId, ...threadIds]
  );
  for (const row of rows) {
    result.add(row.thread_id);
  }
  return result;
};

export const loadBadgeMap = async (userIds: number[]) => {
  await ensureForumSchema();
  const deduped = Array.from(new Set(userIds.filter((id) => Number.isFinite(id) && id > 0)));
  const fallback = new Map<number, ForumUserBadge>();
  if (!deduped.length) return fallback;
  const placeholders = deduped.map(() => "?").join(", ");
  const db = getAccountDb();
  const [rows] = await db.execute<
    Array<{
      id: number;
      username: string;
      avatar_url: string | null;
      role: ForumRole | null;
      taiko_id: string | null;
      verified_title: string | null;
      verified_titleplate_id: number | null;
    }>
  >(
    `SELECT a.id, a.username, a.avatar_url, p.role, b.taiko_id, b.verified_title, b.verified_titleplate_id
     FROM web_user_accounts a
     LEFT JOIN forum_user_profiles p ON p.user_id = a.id
     LEFT JOIN web_taiko_bindings b ON b.user_id = a.id AND b.is_current = 1
     WHERE a.id IN (${placeholders})`,
    deduped
  );
  for (const row of rows) {
    const role = FORUM_ROLES.includes((row.role || "user") as ForumRole)
      ? (row.role as ForumRole)
      : "user";
    fallback.set(row.id, {
      id: row.id,
      username: row.username,
      avatarUrl: row.avatar_url || DEFAULT_AVATAR,
      role,
      roleLabel: getRoleLabel(role),
      taikoIdMasked: maskTaikoId(row.taiko_id),
      verifiedTitle: row.verified_title,
      verifiedTitleplateId: row.verified_titleplate_id
    });
  }
  return fallback;
};

export const sanitizeSection = (row: SectionRow): ForumSection => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  description: row.description,
  icon: row.icon,
  accentColor: row.accent_color,
  sortOrder: row.sort_order,
  threadCount: sanitizeInt(row.threadCount),
  postCount: sanitizeInt(row.postCount),
  featuredThreadCount: sanitizeInt(row.featuredThreadCount)
});

export const toSongSummary = async (row: { songId: number | null; difficultyType: number | null; level: number | null }) => {
  if (!row.songId) return null;
  const catalog = await getSongCatalog();
  const song = catalog.map.get(Number(row.songId));
  if (!song) return null;
  return {
    id: Number(song.id),
    title: song.song_name || `ID ${song.id}`,
    titleJp: song.song_name_jp || "",
    coverUrl: getCoverUrl(Number(song.id)),
    category: song.category || "",
    difficultyType: row.difficultyType ?? null,
    difficultyLabel: getDifficultyLabel(row.difficultyType),
    level: row.level ?? null
  };
};

export const sanitizeThreadCard = async (
  row: ThreadRow,
  badgeMap: Map<number, ForumUserBadge>,
  likedThreadIds: Set<number>,
  favoritedThreadIds: Set<number>
): Promise<ForumThreadCard> => ({
  id: row.id,
  section: {
    id: row.section_id,
    slug: row.section_slug,
    name: row.section_name,
    icon: row.section_icon,
    accentColor: row.section_accent_color
  },
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
  threadType: row.thread_type,
  title: row.title,
  summary: row.summary,
  coverImageUrl: row.cover_image_url || "",
  tags: parseJsonArray<string>(row.tags_json),
  song: await toSongSummary({
    songId: row.song_id,
    difficultyType: row.difficulty_type,
    level: row.level
  }),
  status: row.status,
  isPinned: Boolean(row.is_pinned),
  isFeatured: Boolean(row.is_featured),
  isLocked: Boolean(row.is_locked),
  likeCount: sanitizeInt(row.like_count),
  replyCount: sanitizeInt(row.reply_count),
  viewCount: sanitizeInt(row.view_count),
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at),
  latestPostAt: toIso(row.latest_post_at),
  viewerHasLiked: likedThreadIds.has(row.id),
  viewerHasFavorited: favoritedThreadIds.has(row.id)
});

export const loadThreadLikeSet = async (threadIds: number[], viewerUserId?: number | null) => {
  const result = new Set<number>();
  if (!viewerUserId || !threadIds.length) return result;
  const placeholders = threadIds.map(() => "?").join(", ");
  const db = getAccountDb();
  const [rows] = await db.execute<Array<{ thread_id: number }>>(
    `SELECT thread_id FROM forum_thread_likes WHERE user_id = ? AND thread_id IN (${placeholders})`,
    [viewerUserId, ...threadIds]
  );
  for (const row of rows) {
    result.add(row.thread_id);
  }
  return result;
};

export const loadPostLikeSet = async (postIds: number[], viewerUserId?: number | null) => {
  const result = new Set<number>();
  if (!viewerUserId || !postIds.length) return result;
  const placeholders = postIds.map(() => "?").join(", ");
  const db = getAccountDb();
  const [rows] = await db.execute<Array<{ post_id: number }>>(
    `SELECT post_id FROM forum_post_likes WHERE user_id = ? AND post_id IN (${placeholders})`,
    [viewerUserId, ...postIds]
  );
  for (const row of rows) {
    result.add(row.post_id);
  }
  return result;
};

export const getSectionBySlug = async (slug: string) => {
  await ensureForumSchema();
  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<SectionRow>[]>(
    "SELECT * FROM forum_sections WHERE slug = ? LIMIT 1",
    [slug]
  );
  return rows[0] || null;
};

export const getThreadRowById = async (threadId: number) => {
  await ensureForumSchema();
  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<ThreadRow>[]>(
    `SELECT t.*, s.slug AS section_slug, s.name AS section_name, s.icon AS section_icon, s.accent_color AS section_accent_color
     FROM forum_threads t
     INNER JOIN forum_sections s ON s.id = t.section_id
     WHERE t.id = ?
     LIMIT 1`,
    [threadId]
  );
  return rows[0] || null;
};

export const countUnreadNotifications = async (userId: number) => {
  const db = getAccountDb();
  const [rows] = await db.execute<Array<{ total: number }>>(
    `SELECT COUNT(*) AS total
     FROM forum_notifications n
     WHERE n.user_id = ? AND n.is_read = 0
       AND NOT EXISTS (
         SELECT 1 FROM forum_user_blocks b
         WHERE b.user_id = ? AND b.blocked_user_id = n.actor_user_id
       )`,
    [userId, userId]
  );
  return sanitizeInt(rows[0]?.total);
};

export const recordThreadHistory = async (userId: number, threadId: number) => {
  const profile = await ensureForumProfile(userId);
  if (!Boolean(profile.record_history_enabled ?? 1)) {
    return;
  }
  const db = getAccountDb();
  await db.execute(
    `INSERT INTO forum_thread_history (thread_id, user_id, viewed_at)
     VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE viewed_at = NOW()`,
    [threadId, userId]
  );
  await db.execute(
    `DELETE FROM forum_thread_history
     WHERE user_id = ?
       AND id NOT IN (
         SELECT id FROM (
           SELECT id
           FROM forum_thread_history
           WHERE user_id = ?
           ORDER BY viewed_at DESC, id DESC
           LIMIT 500
         ) AS keep_rows
       )`,
    [userId, userId]
  );
};

export const getUserInteractionStats = async (userId: number) => {
  const db = getAccountDb();
  const [rows] = await db.execute<
    Array<{
      threadCount: number;
      repliedThreadCount: number;
      favoriteCount: number;
      historyCount: number;
      followerCount: number;
      followingCount: number;
      blockedCount: number;
    }>
  >(
    `SELECT
        (SELECT COUNT(*) FROM forum_threads WHERE author_user_id = ? AND status = 'published') AS threadCount,
        (SELECT COUNT(DISTINCT thread_id) FROM forum_posts WHERE author_user_id = ? AND status = 'published') AS repliedThreadCount,
        (SELECT COUNT(*) FROM forum_thread_favorites WHERE user_id = ?) AS favoriteCount,
        (SELECT COUNT(*) FROM forum_thread_history WHERE user_id = ?) AS historyCount,
        (SELECT COUNT(*) FROM forum_user_follows WHERE followed_user_id = ?) AS followerCount,
        (SELECT COUNT(*) FROM forum_user_follows WHERE follower_user_id = ?) AS followingCount,
        (SELECT COUNT(*) FROM forum_user_blocks WHERE user_id = ?) AS blockedCount`,
    [userId, userId, userId, userId, userId, userId, userId]
  );
  return {
    threadCount: sanitizeInt(rows[0]?.threadCount),
    repliedThreadCount: sanitizeInt(rows[0]?.repliedThreadCount),
    favoriteCount: sanitizeInt(rows[0]?.favoriteCount),
    historyCount: sanitizeInt(rows[0]?.historyCount),
    followerCount: sanitizeInt(rows[0]?.followerCount),
    followingCount: sanitizeInt(rows[0]?.followingCount),
    blockedCount: sanitizeInt(rows[0]?.blockedCount)
  };
};

export const getRelationshipState = async (viewerUserId: number | null | undefined, targetUserId: number) => {
  if (!viewerUserId) {
    return {
      isSelf: false,
      isFollowing: false,
      isFollowedBy: false,
      isBlocked: false,
      isBlockedBy: false
    };
  }
  if (viewerUserId === targetUserId) {
    return {
      isSelf: true,
      isFollowing: false,
      isFollowedBy: false,
      isBlocked: false,
      isBlockedBy: false
    };
  }
  const db = getAccountDb();
  const [rows] = await db.execute<
    Array<{
      isFollowing: number;
      isFollowedBy: number;
      isBlocked: number;
      isBlockedBy: number;
    }>
  >(
    `SELECT
        EXISTS(SELECT 1 FROM forum_user_follows WHERE follower_user_id = ? AND followed_user_id = ?) AS isFollowing,
        EXISTS(SELECT 1 FROM forum_user_follows WHERE follower_user_id = ? AND followed_user_id = ?) AS isFollowedBy,
        EXISTS(SELECT 1 FROM forum_user_blocks WHERE user_id = ? AND blocked_user_id = ?) AS isBlocked,
        EXISTS(SELECT 1 FROM forum_user_blocks WHERE user_id = ? AND blocked_user_id = ?) AS isBlockedBy`,
    [
      viewerUserId,
      targetUserId,
      targetUserId,
      viewerUserId,
      viewerUserId,
      targetUserId,
      targetUserId,
      viewerUserId
    ]
  );
  return {
    isSelf: false,
    isFollowing: Boolean(rows[0]?.isFollowing),
    isFollowedBy: Boolean(rows[0]?.isFollowedBy),
    isBlocked: Boolean(rows[0]?.isBlocked),
    isBlockedBy: Boolean(rows[0]?.isBlockedBy)
  };
};

export const createNotification = async (payload: {
  userId: number;
  actorUserId?: number | null;
  type: ForumNotificationType;
  title: string;
  body: string;
  threadId?: number | null;
  postId?: number | null;
}) => {
  await ensureForumSchema();
  if (!FORUM_NOTIFICATION_TYPES.includes(payload.type)) return;
  const db = getAccountDb();
  const [existingRows] = await db.execute<Array<{ id: number }>>(
    `SELECT id FROM forum_notifications
     WHERE user_id = ? AND actor_user_id <=> ? AND type = ? AND thread_id <=> ? AND post_id <=> ? AND title = ? AND body = ?
       AND created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
     ORDER BY id DESC LIMIT 1`,
    [
      payload.userId,
      payload.actorUserId || null,
      payload.type,
      payload.threadId || null,
      payload.postId || null,
      payload.title,
      clipText(payload.body, 255)
    ]
  );
  if (existingRows.length) {
    return;
  }
  await db.execute(
    `INSERT INTO forum_notifications
      (user_id, actor_user_id, type, title, body, thread_id, post_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.userId,
      payload.actorUserId || null,
      payload.type,
      payload.title,
      clipText(payload.body, 255),
      payload.threadId || null,
      payload.postId || null
    ]
  );
};

export const createMentionNotifications = async (payload: {
  actorUserId: number;
  usernames: string[];
  title: string;
  bodyPrefix: string;
  threadId: number;
  postId?: number | null;
}) => {
  if (!payload.usernames.length) return;
  const db = getAccountDb();
  const placeholders = payload.usernames.map(() => "?").join(", ");
  const [rows] = await db.execute<Array<{ id: number; username: string }>>(
    `SELECT id, username FROM web_user_accounts WHERE username IN (${placeholders})`,
    payload.usernames
  );
  for (const row of rows) {
    if (row.id === payload.actorUserId) continue;
    await createNotification({
      userId: row.id,
      actorUserId: payload.actorUserId,
      type: "mention",
      title: payload.title,
      body: `${payload.bodyPrefix} @${row.username}`,
      threadId: payload.threadId,
      postId: payload.postId || null
    });
  }
};

export const requireModerator = async (event: H3Event) => {
  const user = await requireAccountUser(event);
  const profile = await ensureForumProfile(user.id);
  if (!["moderator", "admin"].includes(profile.role)) {
    throw createError({ statusCode: 403, statusMessage: "需要版主或站务权限" });
  }
  return { user, profile };
};
