import { readFileSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { H3Event, MultiPartData } from "h3";
import { createError, getHeader, readMultipartFormData } from "h3";
import OSS from "ali-oss";
import sharp from "sharp";
import type { ResultSetHeader } from "mysql2/promise";
import type {
  ForumContentBlock,
  ForumHomePayload,
  ForumMeSummary,
  ForumNotification,
  ForumNotificationType,
  ForumPostFloor,
  ForumPostReply,
  ForumPreferences,
  ForumRelationshipItem,
  ForumRole,
  ForumSection,
  ForumThreadCard,
  ForumThreadDetail,
  ForumThreadSort,
  ForumThreadType,
  ForumUserProfile,
  ForumUserBadge,
} from "~/types/forum";
import {
  FORUM_NOTIFICATION_TYPES,
  FORUM_ROLES,
  FORUM_THREAD_SORTS,
  FORUM_THREAD_TYPES,
} from "~/types/forum";
import { DbRow, getAccountDb } from "./account-db";
import {
  getAccountProfile,
  getAccountUserFromEvent,
  requireAccountUser,
} from "./account";
import { ensureForumSchema } from "./forum-db";

const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const DEFAULT_AVATAR = "https://forum.sakura-bot.cn/miku.png";
const DEFAULT_TAGS = ["全良", "段位", "攻略", "金冠", "活动"];
const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;
const ALLOWED_IMAGE_FORMATS = new Set(["jpeg", "png", "webp", "gif"]);

let songCatalogCache: {
  mtimeMs: number;
  list: SongMeta[];
  map: Map<number, SongMeta>;
} | null = null;

type AccountRow = {
  id: number;
  username: string;
  avatar_url: string | null;
};

type ForumProfileRow = {
  user_id: number;
  role: ForumRole;
  record_history_enabled?: number;
};

type BindingRow = {
  user_id: number;
  taiko_id: string | null;
  verified_title: string | null;
  verified_titleplate_id: number | null;
};

type SectionRow = {
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

type ThreadRow = {
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

type PostRow = {
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

type NotificationRow = {
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

type FollowRow = {
  follower_user_id: number;
  followed_user_id: number;
  created_at: Date | string;
};

type BlockRow = {
  user_id: number;
  blocked_user_id: number;
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

const toIso = (value: Date | string | number | null | undefined) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
};

const sanitizeInt = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.trunc(parsed);
};

const clipText = (value: string, limit: number) => {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 1)}…`;
};

const detectImageFormat = async (buffer: Buffer) => {
  try {
    const metadata = await sharp(buffer, { animated: true }).metadata();
    return String(metadata.format || "").toLowerCase();
  } catch {
    return "";
  }
};

const ensureNonEmpty = (value: string, message: string) => {
  if (!value) {
    throw createError({ statusCode: 400, statusMessage: message });
  }
};

const getRuntimePaths = () => {
  const runtimeConfig = useRuntimeConfig();
  const repoRoot = String(
    runtimeConfig.repoRoot ||
      process.env.TAIKO_REPO_ROOT ||
      resolve(process.cwd(), ".."),
  );
  const songDataPath = String(
    runtimeConfig.songDataPath ||
      process.env.TAIKO_SONG_DATA_PATH ||
      `${repoRoot}/songs/song_data.json`,
  );
  return { songDataPath };
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
      accessKeySecret: getIniValue(content, "accessKeySecret"),
    };
  } catch {
    return {
      endpoint: "",
      accessKeyId: "",
      accessKeySecret: "",
    };
  }
};

const getAvatarConfig = () => {
  const runtimeConfig = useRuntimeConfig();
  const fallback = loadOssutilFallback();
  return {
    endpoint: String(
      runtimeConfig.ossEndpoint ||
        process.env.OSS_ENDPOINT ||
        fallback.endpoint ||
        "",
    ),
    region: String(runtimeConfig.ossRegion || process.env.OSS_REGION || ""),
    bucket: String(
      runtimeConfig.ossBucket || process.env.OSS_BUCKET || "sigaer",
    ),
    accessKeyId: String(
      runtimeConfig.ossAccessKeyId ||
        process.env.OSS_ACCESS_KEY_ID ||
        fallback.accessKeyId ||
        "",
    ),
    accessKeySecret: String(
      runtimeConfig.ossAccessKeySecret ||
        process.env.OSS_ACCESS_KEY_SECRET ||
        fallback.accessKeySecret ||
        "",
    ),
    publicBaseUrl: String(
      runtimeConfig.ossPublicBaseUrl ||
        process.env.OSS_PUBLIC_BASE_URL ||
        "https://static.sakura-bot.cn",
    ),
  };
};

const requireConfiguredOss = () => {
  const config = getAvatarConfig();
  if (
    !config.endpoint ||
    !config.bucket ||
    !config.accessKeyId ||
    !config.accessKeySecret
  ) {
    throw createError({
      statusCode: 500,
      statusMessage: "OSS 未配置，暂时无法上传论坛图片",
    });
  }
  return config;
};

const getOssClient = () => {
  const config = requireConfiguredOss();
  return new OSS({
    endpoint: config.endpoint,
    region: config.region || undefined,
    bucket: config.bucket,
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    secure: true,
  });
};

const getCoverUrl = (songId: number) => {
  const runtimeConfig = useRuntimeConfig();
  const apiBase = String(
    runtimeConfig.public.apiBase || "https://static.sakura-bot.cn",
  ).replace(/\/$/, "");
  return `${apiBase}/cover/${songId}.png`;
};

const getDifficultyLabel = (difficultyType: number | null | undefined) => {
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

const getRoleLabel = (role: ForumRole) => {
  switch (role) {
    case "admin":
      return "站务";
    case "moderator":
      return "版主";
    default:
      return "鼓友";
  }
};

const maskTaikoId = (value: string | null | undefined) => {
  const raw = String(value || "").trim();
  if (!raw) return "未绑定";
  if (raw.length <= 5) return `${raw[0] || "*"}***`;
  return `${raw.slice(0, 3)}***${raw.slice(-2)}`;
};

const parseJsonArray = <T>(
  value: string | null | undefined,
  fallback: T[] = [],
) => {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
};

const buildSummaryFromBlocks = (blocks: ForumContentBlock[]) => {
  const firstParagraph = blocks.find(
    (block) => block.type === "paragraph" && block.text.trim(),
  );
  return clipText(firstParagraph?.text || "这是一篇新的太鼓讨论帖。", 120);
};

const sanitizeBlocks = (input: unknown, maxBlocks: number) => {
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
        text: clipText(text, 4000),
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
        caption: clipText(String(record.caption || ""), 160),
      });
    }
  }
  return blocks.slice(0, maxBlocks);
};

const normalizeContentBlocks = (input: unknown) => {
  const blocks = sanitizeBlocks(input, 50);
  if (!blocks.length) {
    throw createError({ statusCode: 400, statusMessage: "帖子正文不能为空" });
  }
  return blocks;
};

const normalizeReplyContentBlocks = (payload: Record<string, unknown>) => {
  const bodyText = clipText(String(payload.bodyText || "").trim(), 1000);
  const imageBlocks = sanitizeBlocks(payload.contentBlocks, 5).filter(
    (block) => block.type === "image",
  );
  const blocks: ForumContentBlock[] = [];
  if (bodyText) {
    blocks.push({
      type: "paragraph",
      text: bodyText,
    });
  }
  blocks.push(...imageBlocks.slice(0, 4));
  if (!blocks.length) {
    throw createError({ statusCode: 400, statusMessage: "回复内容不能为空" });
  }
  if (imageBlocks.length > 4) {
    throw createError({
      statusCode: 400,
      statusMessage: "单条回复最多上传 4 张图片",
    });
  }
  return blocks;
};

const getReplyBodyText = (blocks: ForumContentBlock[]) => {
  return blocks
    .filter(
      (block): block is Extract<ForumContentBlock, { type: "paragraph" }> =>
        block.type === "paragraph",
    )
    .map((block) => block.text.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
};

const getReplyNotificationSnippet = (blocks: ForumContentBlock[]) => {
  const bodyText = getReplyBodyText(blocks);
  return bodyText || "发来了一条图片回复";
};

const normalizeStoredReplyBlocks = (
  value: string | null | undefined,
  bodyText: string,
) => {
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
      text: clipText(bodyText, 1000),
    },
  ] satisfies ForumContentBlock[];
};

const normalizeTags = (input: unknown) => {
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

const normalizeThreadType = (value: unknown): ForumThreadType => {
  const type = String(value || "").trim() as ForumThreadType;
  if (!FORUM_THREAD_TYPES.includes(type)) {
    throw createError({ statusCode: 400, statusMessage: "帖子类型无效" });
  }
  return type;
};

const normalizeSort = (value: unknown): ForumThreadSort => {
  const sort = String(value || "latest").trim() as ForumThreadSort;
  return FORUM_THREAD_SORTS.includes(sort) ? sort : "latest";
};

const getSongCatalog = async () => {
  const { songDataPath } = getRuntimePaths();
  const fileStat = await stat(songDataPath);
  if (songCatalogCache && songCatalogCache.mtimeMs === fileStat.mtimeMs) {
    return songCatalogCache;
  }
  const list = JSON.parse(await readFile(songDataPath, "utf-8")) as SongMeta[];
  const map = new Map<number, SongMeta>();
  for (const item of list) {
    map.set(Number(item.id), item);
  }
  songCatalogCache = { mtimeMs: fileStat.mtimeMs, list, map };
  return songCatalogCache;
};

const extractMentions = (texts: string[]) => {
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

const ensureForumProfile = async (userId: number) => {
  await ensureForumSchema();
  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<ForumProfileRow>[]>(
    "SELECT * FROM forum_user_profiles WHERE user_id = ? LIMIT 1",
    [userId],
  );
  if (rows.length) {
    return rows[0];
  }
  const [countRows] = await db.execute<Array<{ total: number }>>(
    "SELECT COUNT(*) AS total FROM forum_user_profiles",
  );
  const role: ForumRole =
    Number(countRows[0]?.total || 0) === 0 ? "admin" : "user";
  await db.execute(
    "INSERT INTO forum_user_profiles (user_id, role) VALUES (?, ?)",
    [userId, role],
  );
  return { user_id: userId, role, record_history_enabled: 1 };
};

const getViewer = async (event: H3Event) => {
  const account = await getAccountUserFromEvent(event);
  if (!account) return null;
  await ensureForumProfile(account.id);
  return account;
};

const loadBlockedUserSet = async (userId?: number | null) => {
  const result = new Set<number>();
  if (!userId) return result;
  const db = getAccountDb();
  const [rows] = await db.execute<Array<{ blocked_user_id: number }>>(
    "SELECT blocked_user_id FROM forum_user_blocks WHERE user_id = ?",
    [userId],
  );
  for (const row of rows) {
    result.add(row.blocked_user_id);
  }
  return result;
};

const loadThreadFavoriteSet = async (
  threadIds: number[],
  viewerUserId?: number | null,
) => {
  const result = new Set<number>();
  if (!viewerUserId || !threadIds.length) return result;
  const placeholders = threadIds.map(() => "?").join(", ");
  const db = getAccountDb();
  const [rows] = await db.execute<Array<{ thread_id: number }>>(
    `SELECT thread_id FROM forum_thread_favorites WHERE user_id = ? AND thread_id IN (${placeholders})`,
    [viewerUserId, ...threadIds],
  );
  for (const row of rows) {
    result.add(row.thread_id);
  }
  return result;
};

const loadBadgeMap = async (userIds: number[]) => {
  await ensureForumSchema();
  const deduped = Array.from(
    new Set(userIds.filter((id) => Number.isFinite(id) && id > 0)),
  );
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
    deduped,
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
      verifiedTitleplateId: row.verified_titleplate_id,
    });
  }
  return fallback;
};

const sanitizeSection = (row: SectionRow): ForumSection => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  description: row.description,
  icon: row.icon,
  accentColor: row.accent_color,
  sortOrder: row.sort_order,
  threadCount: sanitizeInt(row.threadCount),
  postCount: sanitizeInt(row.postCount),
  featuredThreadCount: sanitizeInt(row.featuredThreadCount),
});

const toSongSummary = async (row: {
  songId: number | null;
  difficultyType: number | null;
  level: number | null;
}) => {
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
    level: row.level ?? null,
  };
};

const sanitizeThreadCard = async (
  row: ThreadRow,
  badgeMap: Map<number, ForumUserBadge>,
  likedThreadIds: Set<number>,
  favoritedThreadIds: Set<number>,
): Promise<ForumThreadCard> => ({
  id: row.id,
  section: {
    id: row.section_id,
    slug: row.section_slug,
    name: row.section_name,
    icon: row.section_icon,
    accentColor: row.section_accent_color,
  },
  author: badgeMap.get(row.author_user_id) || {
    id: row.author_user_id,
    username: "未知鼓友",
    avatarUrl: DEFAULT_AVATAR,
    role: "user",
    roleLabel: "鼓友",
    taikoIdMasked: "未绑定",
    verifiedTitle: null,
    verifiedTitleplateId: null,
  },
  threadType: row.thread_type,
  title: row.title,
  summary: row.summary,
  coverImageUrl: row.cover_image_url || "",
  tags: parseJsonArray<string>(row.tags_json),
  song: await toSongSummary({
    songId: row.song_id,
    difficultyType: row.difficulty_type,
    level: row.level,
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
  viewerHasFavorited: favoritedThreadIds.has(row.id),
});

const loadThreadLikeSet = async (
  threadIds: number[],
  viewerUserId?: number | null,
) => {
  const result = new Set<number>();
  if (!viewerUserId || !threadIds.length) return result;
  const placeholders = threadIds.map(() => "?").join(", ");
  const db = getAccountDb();
  const [rows] = await db.execute<Array<{ thread_id: number }>>(
    `SELECT thread_id FROM forum_thread_likes WHERE user_id = ? AND thread_id IN (${placeholders})`,
    [viewerUserId, ...threadIds],
  );
  for (const row of rows) {
    result.add(row.thread_id);
  }
  return result;
};

const loadPostLikeSet = async (
  postIds: number[],
  viewerUserId?: number | null,
) => {
  const result = new Set<number>();
  if (!viewerUserId || !postIds.length) return result;
  const placeholders = postIds.map(() => "?").join(", ");
  const db = getAccountDb();
  const [rows] = await db.execute<Array<{ post_id: number }>>(
    `SELECT post_id FROM forum_post_likes WHERE user_id = ? AND post_id IN (${placeholders})`,
    [viewerUserId, ...postIds],
  );
  for (const row of rows) {
    result.add(row.post_id);
  }
  return result;
};

const getSectionBySlug = async (slug: string) => {
  await ensureForumSchema();
  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<SectionRow>[]>(
    "SELECT * FROM forum_sections WHERE slug = ? LIMIT 1",
    [slug],
  );
  return rows[0] || null;
};

const getThreadRowById = async (threadId: number) => {
  await ensureForumSchema();
  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<ThreadRow>[]>(
    `SELECT t.*, s.slug AS section_slug, s.name AS section_name, s.icon AS section_icon, s.accent_color AS section_accent_color
     FROM forum_threads t
     INNER JOIN forum_sections s ON s.id = t.section_id
     WHERE t.id = ?
     LIMIT 1`,
    [threadId],
  );
  return rows[0] || null;
};

const countUnreadNotifications = async (userId: number) => {
  const db = getAccountDb();
  const [rows] = await db.execute<Array<{ total: number }>>(
    `SELECT COUNT(*) AS total
     FROM forum_notifications n
     WHERE n.user_id = ? AND n.is_read = 0
       AND NOT EXISTS (
         SELECT 1 FROM forum_user_blocks b
         WHERE b.user_id = ? AND b.blocked_user_id = n.actor_user_id
       )`,
    [userId, userId],
  );
  return sanitizeInt(rows[0]?.total);
};

const recordThreadHistory = async (userId: number, threadId: number) => {
  const profile = await ensureForumProfile(userId);
  if (!Boolean(profile.record_history_enabled ?? 1)) {
    return;
  }
  const db = getAccountDb();
  await db.execute(
    `INSERT INTO forum_thread_history (thread_id, user_id, viewed_at)
     VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE viewed_at = NOW()`,
    [threadId, userId],
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
    [userId, userId],
  );
};

const getUserInteractionStats = async (userId: number) => {
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
    [userId, userId, userId, userId, userId, userId, userId],
  );
  return {
    threadCount: sanitizeInt(rows[0]?.threadCount),
    repliedThreadCount: sanitizeInt(rows[0]?.repliedThreadCount),
    favoriteCount: sanitizeInt(rows[0]?.favoriteCount),
    historyCount: sanitizeInt(rows[0]?.historyCount),
    followerCount: sanitizeInt(rows[0]?.followerCount),
    followingCount: sanitizeInt(rows[0]?.followingCount),
    blockedCount: sanitizeInt(rows[0]?.blockedCount),
  };
};

const getRelationshipState = async (
  viewerUserId: number | null | undefined,
  targetUserId: number,
) => {
  if (!viewerUserId) {
    return {
      isSelf: false,
      isFollowing: false,
      isFollowedBy: false,
      isBlocked: false,
      isBlockedBy: false,
    };
  }
  if (viewerUserId === targetUserId) {
    return {
      isSelf: true,
      isFollowing: false,
      isFollowedBy: false,
      isBlocked: false,
      isBlockedBy: false,
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
      viewerUserId,
    ],
  );
  return {
    isSelf: false,
    isFollowing: Boolean(rows[0]?.isFollowing),
    isFollowedBy: Boolean(rows[0]?.isFollowedBy),
    isBlocked: Boolean(rows[0]?.isBlocked),
    isBlockedBy: Boolean(rows[0]?.isBlockedBy),
  };
};

const createNotification = async (payload: {
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
      clipText(payload.body, 255),
    ],
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
      payload.postId || null,
    ],
  );
};

const createMentionNotifications = async (payload: {
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
    payload.usernames,
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
      postId: payload.postId || null,
    });
  }
};

const requireModerator = async (event: H3Event) => {
  const user = await requireAccountUser(event);
  const profile = await ensureForumProfile(user.id);
  if (!["moderator", "admin"].includes(profile.role)) {
    throw createError({ statusCode: 403, statusMessage: "需要版主或站务权限" });
  }
  return { user, profile };
};

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
     ORDER BY s.sort_order ASC, s.id ASC`,
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
  },
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
    includeHidden
      ? "t.status IN ('published', 'hidden')"
      : "t.status = 'published'",
  ];
  const params: Array<string | number> = [];
  let joinSql = "";
  let scopedOrderSql = "";

  if (query.sectionSlug) {
    filters.push("s.slug = ?");
    params.push(String(query.sectionSlug));
  }
  if (
    query.threadType &&
    FORUM_THREAD_TYPES.includes(String(query.threadType) as ForumThreadType)
  ) {
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
      joinSql =
        "INNER JOIN forum_thread_favorites fav ON fav.thread_id = t.id AND fav.user_id = ?";
      params.unshift(viewer.id);
      scopedOrderSql = "ORDER BY fav.created_at DESC, t.id DESC";
    } else if (scope === "history") {
      joinSql =
        "INNER JOIN forum_thread_history hist ON hist.thread_id = t.id AND hist.user_id = ?";
      params.unshift(viewer.id);
      scopedOrderSql = "ORDER BY hist.viewed_at DESC, t.id DESC";
    }
  }
  if (sort === "hot") {
    filters.push("t.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)");
  }
  if (viewer) {
    filters.push(
      "NOT EXISTS (SELECT 1 FROM forum_user_blocks b WHERE b.user_id = ? AND b.blocked_user_id = t.author_user_id)",
    );
    params.push(viewer.id);
  }

  const whereSql = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const offset = (page - 1) * pageSize;
  let orderSql = "ORDER BY t.is_pinned DESC, t.latest_post_at DESC, t.id DESC";
  if (scopedOrderSql) {
    orderSql = scopedOrderSql;
  } else if (sort === "featured") {
    orderSql =
      "ORDER BY t.is_pinned DESC, t.is_featured DESC, t.latest_post_at DESC, t.id DESC";
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
    params,
  );
  const [rows] = await db.execute<DbRow<ThreadRow>[]>(
    `SELECT t.*, s.slug AS section_slug, s.name AS section_name, s.icon AS section_icon, s.accent_color AS section_accent_color
     FROM forum_threads t
     INNER JOIN forum_sections s ON s.id = t.section_id
     ${joinSql}
     ${whereSql}
     ${orderSql}
     LIMIT ${pageSize} OFFSET ${offset}`,
    params,
  );
  const badgeMap = await loadBadgeMap(rows.map((row) => row.author_user_id));
  const likedThreadIds = await loadThreadLikeSet(
    rows.map((row) => row.id),
    viewer?.id,
  );
  const favoritedThreadIds = await loadThreadFavoriteSet(
    rows.map((row) => row.id),
    viewer?.id,
  );
  return {
    total: sanitizeInt(countRows[0]?.total),
    page,
    pageSize,
    sort,
    items: await Promise.all(
      rows.map((row) =>
        sanitizeThreadCard(row, badgeMap, likedThreadIds, favoritedThreadIds),
      ),
    ),
  };
};

export const getForumThreadDetail = async (
  event: H3Event,
  threadIdInput: unknown,
) => {
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
  if (
    row.status !== "published" &&
    !viewerProfile?.role.match(/admin|moderator/)
  ) {
    throw createError({ statusCode: 404, statusMessage: "帖子不存在" });
  }

  await db.execute(
    "UPDATE forum_threads SET view_count = view_count + 1 WHERE id = ?",
    [threadId],
  );
  row.view_count += 1;
  if (viewer) {
    await recordThreadHistory(viewer.id, threadId);
  }

  const [postRows] = await db.execute<DbRow<PostRow>[]>(
    `SELECT *
     FROM forum_posts
     WHERE thread_id = ? AND status = 'published'
     ORDER BY CASE WHEN parent_post_id IS NULL THEN floor_no ELSE 1000000 + id END ASC, created_at ASC, id ASC`,
    [threadId],
  );

  const badgeMap = await loadBadgeMap([
    row.author_user_id,
    ...postRows.map((post) => post.author_user_id),
  ]);
  const likedThreadIds = await loadThreadLikeSet([threadId], viewer?.id);
  const favoritedThreadIds = await loadThreadFavoriteSet(
    [threadId],
    viewer?.id,
  );
  const likedPostIds = await loadPostLikeSet(
    postRows.map((post) => post.id),
    viewer?.id,
  );
  const blockedUserIds = await loadBlockedUserSet(viewer?.id);
  const thread = await sanitizeThreadCard(
    row,
    badgeMap,
    likedThreadIds,
    favoritedThreadIds,
  );
  const repliesByRoot = new Map<number, ForumPostReply[]>();
  const floors: ForumPostFloor[] = [];

  for (const post of postRows) {
    const author = badgeMap.get(post.author_user_id) || {
      id: post.author_user_id,
      username: "未知鼓友",
      avatarUrl: DEFAULT_AVATAR,
      role: "user",
      roleLabel: "鼓友",
      taikoIdMasked: "未绑定",
      verifiedTitle: null,
      verifiedTitleplateId: null,
    };
    if (post.parent_post_id === null) {
      floors.push({
        id: post.id,
        floorNo: post.floor_no,
        bodyText: post.body_text,
        contentBlocks: normalizeStoredReplyBlocks(
          post.content_blocks_json,
          post.body_text,
        ),
        likeCount: sanitizeInt(post.like_count),
        createdAt: toIso(post.created_at),
        author,
        viewerHasLiked: likedPostIds.has(post.id),
        isBlockedAuthor: blockedUserIds.has(post.author_user_id),
        replies: [],
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
      contentBlocks: normalizeStoredReplyBlocks(
        post.content_blocks_json,
        post.body_text,
      ),
      likeCount: sanitizeInt(post.like_count),
      createdAt: toIso(post.created_at),
      author,
      viewerHasLiked: likedPostIds.has(post.id),
      isBlockedAuthor: blockedUserIds.has(post.author_user_id),
    });
    repliesByRoot.set(rootId, bucket);
  }

  for (const floor of floors) {
    floor.replies = repliesByRoot.get(floor.id) || [];
  }

  return {
    ...thread,
    contentBlocks: normalizeContentBlocks(
      parseJsonArray<ForumContentBlock>(row.content_blocks_json),
    ),
    posts: floors,
  } satisfies ForumThreadDetail;
};

const validateSongBinding = async (payload: {
  songId?: unknown;
  difficultyType?: unknown;
  level?: unknown;
}) => {
  const songId = sanitizeInt(payload.songId, 0);
  if (songId <= 0) {
    return {
      songId: null,
      difficultyType: null,
      level: null,
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
    level: level > 0 ? level : null,
  };
};

export const createForumThread = async (
  event: H3Event,
  payload: Record<string, unknown>,
) => {
  await ensureForumSchema();
  const user = await requireAccountUser(event);
  const profile = await ensureForumProfile(user.id);
  const title = clipText(String(payload.title || ""), 120);
  ensureNonEmpty(title, "请输入标题");
  if (title.length < 4) {
    throw createError({
      statusCode: 400,
      statusMessage: "标题至少需要 4 个字符",
    });
  }
  const sectionSlug = String(payload.sectionSlug || "").trim();
  ensureNonEmpty(sectionSlug, "请选择版块");
  const section = await getSectionBySlug(sectionSlug);
  if (!section) {
    throw createError({ statusCode: 404, statusMessage: "版块不存在" });
  }
  const threadType = normalizeThreadType(payload.threadType);
  if (
    threadType === "official" &&
    !["moderator", "admin"].includes(profile.role)
  ) {
    throw createError({
      statusCode: 403,
      statusMessage: "只有版主或站务可以发布公告帖",
    });
  }
  const contentBlocks = normalizeContentBlocks(payload.contentBlocks);
  const paragraphTexts = contentBlocks
    .filter((block) => block.type === "paragraph")
    .map((block) => block.text);
  const summary =
    clipText(String(payload.summary || "").trim(), 280) ||
    buildSummaryFromBlocks(contentBlocks);
  const tags = normalizeTags(payload.tags);
  const derivedCover =
    contentBlocks.find((block) => block.type === "image")?.imageUrl || "";
  const coverImageUrl = clipText(
    String(payload.coverImageUrl || derivedCover || "").trim(),
    1024,
  );
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
      songBinding.level,
    ],
  );
  const threadId = result.insertId;
  const mentions = extractMentions(paragraphTexts);
  await createMentionNotifications({
    actorUserId: user.id,
    usernames: mentions,
    title: `你在帖子中被提及：${title}`,
    bodyPrefix: `${user.username} 在新帖《${clipText(title, 24)}》中提到了你`,
    threadId,
  });
  return await getForumThreadDetail(event, threadId);
};

export const createForumReply = async (
  event: H3Event,
  threadIdInput: unknown,
  payload: Record<string, unknown>,
) => {
  await ensureForumSchema();
  const user = await requireAccountUser(event);
  await ensureForumProfile(user.id);
  const threadId = sanitizeInt(threadIdInput, 0);
  const thread = await getThreadRowById(threadId);
  if (!thread || thread.status !== "published") {
    throw createError({ statusCode: 404, statusMessage: "帖子不存在" });
  }
  if (thread.is_locked) {
    throw createError({
      statusCode: 400,
      statusMessage: "该帖子已锁定，暂时无法回复",
    });
  }

  const contentBlocks = normalizeReplyContentBlocks(payload);
  const bodyText = getReplyBodyText(contentBlocks);
  const replySnippet = getReplyNotificationSnippet(contentBlocks);
  const parentPostId = sanitizeInt(payload.parentPostId, 0);
  const db = getAccountDb();
  let parentPost: PostRow | null = null;
  let floorNo = 0;
  let rootPostId: number | null = null;

  if (parentPostId > 0) {
    const [rows] = await db.execute<DbRow<PostRow>[]>(
      "SELECT * FROM forum_posts WHERE id = ? AND thread_id = ? AND status = 'published' LIMIT 1",
      [parentPostId, threadId],
    );
    parentPost = rows[0] || null;
    if (!parentPost) {
      throw createError({ statusCode: 404, statusMessage: "回复目标不存在" });
    }
    rootPostId = parentPost.root_post_id || parentPost.id;
  } else {
    const [rows] = await db.execute<Array<{ maxFloor: number | null }>>(
      "SELECT MAX(floor_no) AS maxFloor FROM forum_posts WHERE thread_id = ? AND parent_post_id IS NULL",
      [threadId],
    );
    floorNo = sanitizeInt(rows[0]?.maxFloor) + 1;
  }

  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO forum_posts
      (thread_id, author_user_id, parent_post_id, root_post_id, floor_no, body_text, content_blocks_json, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'published')`,
    [
      threadId,
      user.id,
      parentPost ? parentPost.id : null,
      rootPostId,
      floorNo,
      bodyText,
      JSON.stringify(contentBlocks),
    ],
  );
  const createdPostId = result.insertId;
  await db.execute(
    `UPDATE forum_threads
     SET reply_count = reply_count + 1, latest_post_at = NOW(), updated_at = NOW()
     WHERE id = ?`,
    [threadId],
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
        postId: createdPostId,
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
      postId: createdPostId,
    });
  }

  await createMentionNotifications({
    actorUserId: user.id,
    usernames: extractMentions(bodyText ? [bodyText] : []),
    title: `你在回复中被提及：${thread.title}`,
    bodyPrefix: `${user.username} 在《${clipText(thread.title, 20)}》的回复中提到了你`,
    threadId,
    postId: createdPostId,
  });

  return await getForumThreadDetail(event, threadId);
};

export const toggleForumThreadLike = async (
  event: H3Event,
  threadIdInput: unknown,
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
    "SELECT id FROM forum_thread_likes WHERE thread_id = ? AND user_id = ? LIMIT 1",
    [threadId, user.id],
  );
  let liked = false;
  if (rows.length) {
    await db.execute(
      "DELETE FROM forum_thread_likes WHERE thread_id = ? AND user_id = ?",
      [threadId, user.id],
    );
    await db.execute(
      "UPDATE forum_threads SET like_count = GREATEST(like_count - 1, 0) WHERE id = ?",
      [threadId],
    );
  } else {
    await db.execute(
      "INSERT INTO forum_thread_likes (thread_id, user_id) VALUES (?, ?)",
      [threadId, user.id],
    );
    await db.execute(
      "UPDATE forum_threads SET like_count = like_count + 1 WHERE id = ?",
      [threadId],
    );
    liked = true;
    if (thread.author_user_id !== user.id) {
      await createNotification({
        userId: thread.author_user_id,
        actorUserId: user.id,
        type: "like",
        title: `你的帖子收到赞：${thread.title}`,
        body: `${user.username} 赞了你的帖子《${clipText(thread.title, 20)}》`,
        threadId,
      });
    }
  }
  const [countRows] = await db.execute<Array<{ like_count: number }>>(
    "SELECT like_count FROM forum_threads WHERE id = ?",
    [threadId],
  );
  return {
    liked,
    likeCount: sanitizeInt(countRows[0]?.like_count),
  };
};

export const toggleForumPostLike = async (
  event: H3Event,
  postIdInput: unknown,
) => {
  await ensureForumSchema();
  const user = await requireAccountUser(event);
  await ensureForumProfile(user.id);
  const postId = sanitizeInt(postIdInput, 0);
  const db = getAccountDb();
  const [postRows] = await db.execute<
    Array<PostRow & { thread_title: string }>
  >(
    `SELECT p.*, t.title AS thread_title
     FROM forum_posts p
     INNER JOIN forum_threads t ON t.id = p.thread_id
     WHERE p.id = ? AND p.status = 'published' AND t.status = 'published'
     LIMIT 1`,
    [postId],
  );
  const post = postRows[0];
  if (!post) {
    throw createError({ statusCode: 404, statusMessage: "回复不存在" });
  }
  const [likeRows] = await db.execute<Array<{ id: number }>>(
    "SELECT id FROM forum_post_likes WHERE post_id = ? AND user_id = ? LIMIT 1",
    [postId, user.id],
  );
  let liked = false;
  if (likeRows.length) {
    await db.execute(
      "DELETE FROM forum_post_likes WHERE post_id = ? AND user_id = ?",
      [postId, user.id],
    );
    await db.execute(
      "UPDATE forum_posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = ?",
      [postId],
    );
  } else {
    await db.execute(
      "INSERT INTO forum_post_likes (post_id, user_id) VALUES (?, ?)",
      [postId, user.id],
    );
    await db.execute(
      "UPDATE forum_posts SET like_count = like_count + 1 WHERE id = ?",
      [postId],
    );
    liked = true;
    if (post.author_user_id !== user.id) {
      await createNotification({
        userId: post.author_user_id,
        actorUserId: user.id,
        type: "like",
        title: `你的回复收到赞：${post.thread_title}`,
        body: `${user.username} 赞了你在《${clipText(post.thread_title, 20)}》中的回复`,
        threadId: post.thread_id,
        postId,
      });
    }
  }
  const [countRows] = await db.execute<Array<{ like_count: number }>>(
    "SELECT like_count FROM forum_posts WHERE id = ?",
    [postId],
  );
  return {
    liked,
    likeCount: sanitizeInt(countRows[0]?.like_count),
  };
};

export const toggleForumThreadFavorite = async (
  event: H3Event,
  threadIdInput: unknown,
  enabledInput?: unknown,
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
    [threadId, user.id],
  );
  const currentlyFavorited = rows.length > 0;
  const desiredState =
    enabledInput === undefined ? null : Boolean(enabledInput);
  let favorited = currentlyFavorited;
  if (currentlyFavorited && desiredState !== true) {
    await db.execute(
      "DELETE FROM forum_thread_favorites WHERE thread_id = ? AND user_id = ?",
      [threadId, user.id],
    );
    favorited = false;
  } else if (!currentlyFavorited && desiredState !== false) {
    await db.execute(
      "INSERT INTO forum_thread_favorites (thread_id, user_id) VALUES (?, ?)",
      [threadId, user.id],
    );
    favorited = true;
  }
  const [countRows] = await db.execute<Array<{ total: number }>>(
    "SELECT COUNT(*) AS total FROM forum_thread_favorites WHERE thread_id = ?",
    [threadId],
  );
  return {
    favorited,
    favoriteCount: sanitizeInt(countRows[0]?.total),
  };
};

export const getForumPreferences = async (
  event: H3Event,
): Promise<ForumPreferences> => {
  await ensureForumSchema();
  const user = await requireAccountUser(event);
  const profile = await ensureForumProfile(user.id);
  return {
    recordHistoryEnabled: Boolean(profile.record_history_enabled ?? 1),
  };
};

export const updateForumPreferences = async (
  event: H3Event,
  payload: Record<string, unknown>,
) => {
  await ensureForumSchema();
  const user = await requireAccountUser(event);
  await ensureForumProfile(user.id);
  const recordHistoryEnabled =
    payload.recordHistoryEnabled === undefined
      ? true
      : Boolean(payload.recordHistoryEnabled);
  const db = getAccountDb();
  await db.execute(
    "UPDATE forum_user_profiles SET record_history_enabled = ? WHERE user_id = ?",
    [recordHistoryEnabled ? 1 : 0, user.id],
  );
  return {
    ok: true,
    preferences: {
      recordHistoryEnabled,
    } satisfies ForumPreferences,
  };
};

export const clearForumHistory = async (event: H3Event) => {
  await ensureForumSchema();
  const user = await requireAccountUser(event);
  await ensureForumProfile(user.id);
  const db = getAccountDb();
  await db.execute("DELETE FROM forum_thread_history WHERE user_id = ?", [
    user.id,
  ]);
  return {
    ok: true,
  };
};

export const submitForumFeedback = async (
  event: H3Event,
  payload: Record<string, unknown>,
) => {
  await ensureForumSchema();
  const user = await requireAccountUser(event);
  await ensureForumProfile(user.id);
  const content = clipText(String(payload.content || "").trim(), 4000);
  ensureNonEmpty(content, "请输入反馈内容");
  const contact = clipText(String(payload.contact || "").trim(), 255);
  const appVersion = clipText(String(payload.appVersion || "").trim(), 64);
  const platform = clipText(String(payload.platform || "").trim(), 64);
  const db = getAccountDb();
  await db.execute(
    `INSERT INTO forum_feedback (user_id, content, contact, app_version, platform)
     VALUES (?, ?, ?, ?, ?)`,
    [user.id, content, contact || null, appVersion || null, platform || null],
  );
  return {
    ok: true,
  };
};

export const getForumMeSummary = async (
  event: H3Event,
): Promise<ForumMeSummary> => {
  await ensureForumSchema();
  const user = await requireAccountUser(event);
  const [accountProfile, stats, badgeMap, unreadCount, preferences] =
    await Promise.all([
      getAccountProfile(user.id),
      getUserInteractionStats(user.id),
      loadBadgeMap([user.id]),
      countUnreadNotifications(user.id),
      getForumPreferences(event),
    ]);
  return {
    user: accountProfile.user,
    forumBadge: badgeMap.get(user.id) || {
      id: user.id,
      username: accountProfile.user.username,
      avatarUrl: accountProfile.user.avatarUrl,
      role: "user",
      roleLabel: "鼓友",
      taikoIdMasked: accountProfile.currentBinding?.taikoId
        ? maskTaikoId(accountProfile.currentBinding.taikoId)
        : "未绑定",
      verifiedTitle: accountProfile.currentBinding?.verifiedTitle || null,
      verifiedTitleplateId:
        accountProfile.currentBinding?.verifiedTitleplateId || null,
    },
    currentBinding: accountProfile.currentBinding,
    pendingBinding: accountProfile.pendingBinding,
    verificationStatus: accountProfile.verificationStatus,
    unreadNotificationCount: unreadCount,
    myDonUrl: accountProfile.currentBinding ? "/api/account/my-don" : null,
    stats,
    preferences,
  };
};

export const getForumRelationshipList = async (
  event: H3Event,
  query: {
    scope?: unknown;
    page?: unknown;
    pageSize?: unknown;
  },
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
    countSql =
      "SELECT COUNT(*) AS total FROM forum_user_follows WHERE follower_user_id = ?";
    rowsSql = `SELECT followed_user_id AS user_id, created_at
       FROM forum_user_follows
       WHERE follower_user_id = ?
       ORDER BY created_at DESC, followed_user_id DESC
       LIMIT ${pageSize} OFFSET ${offset}`;
    params = [user.id];
  } else if (scope === "blocked") {
    countSql =
      "SELECT COUNT(*) AS total FROM forum_user_blocks WHERE user_id = ?";
    rowsSql = `SELECT blocked_user_id AS user_id, created_at
       FROM forum_user_blocks
       WHERE user_id = ?
       ORDER BY created_at DESC, blocked_user_id DESC
       LIMIT ${pageSize} OFFSET ${offset}`;
    params = [user.id];
  } else {
    countSql =
      "SELECT COUNT(*) AS total FROM forum_user_follows WHERE followed_user_id = ?";
    rowsSql = `SELECT follower_user_id AS user_id, created_at
       FROM forum_user_follows
       WHERE followed_user_id = ?
       ORDER BY created_at DESC, follower_user_id DESC
       LIMIT ${pageSize} OFFSET ${offset}`;
    params = [user.id];
  }
  const [countRows] = await db.execute<Array<{ total: number }>>(countSql, [
    user.id,
  ]);
  const [rows] = await db.execute<
    Array<{ user_id: number; created_at: Date | string }>
  >(rowsSql, params);
  const userIds = rows.map((row) => row.user_id);
  const badgeMap = await loadBadgeMap(userIds);
  let mutualSet = new Set<number>();
  if (userIds.length && scope !== "blocked") {
    if (scope === "following") {
      const [mutualRows] = await db.execute<
        Array<{ follower_user_id: number }>
      >(
        `SELECT follower_user_id
         FROM forum_user_follows
         WHERE followed_user_id = ? AND follower_user_id IN (${userIds.map(() => "?").join(", ")})`,
        [user.id, ...userIds],
      );
      mutualSet = new Set(mutualRows.map((row) => row.follower_user_id));
    } else {
      const [mutualRows] = await db.execute<
        Array<{ followed_user_id: number }>
      >(
        `SELECT followed_user_id
         FROM forum_user_follows
         WHERE follower_user_id = ? AND followed_user_id IN (${userIds.map(() => "?").join(", ")})`,
        [user.id, ...userIds],
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
            avatarUrl: DEFAULT_AVATAR,
            role: "user",
            roleLabel: "鼓友",
            taikoIdMasked: "未绑定",
            verifiedTitle: null,
            verifiedTitleplateId: null,
          },
          createdAt: toIso(row.created_at),
          mutualFollow:
            scope === "blocked" ? false : mutualSet.has(row.user_id),
        }) satisfies ForumRelationshipItem,
    ),
  };
};

export const toggleForumFollow = async (
  event: H3Event,
  targetUserIdInput: unknown,
  payload: Record<string, unknown>,
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
    [targetUserId],
  );
  if (!userRows.length) {
    throw createError({ statusCode: 404, statusMessage: "用户不存在" });
  }
  const [blockRows] = await db.execute<Array<{ total: number }>>(
    `SELECT COUNT(*) AS total
     FROM forum_user_blocks
     WHERE (user_id = ? AND blocked_user_id = ?) OR (user_id = ? AND blocked_user_id = ?)`,
    [user.id, targetUserId, targetUserId, user.id],
  );
  if (sanitizeInt(blockRows[0]?.total) > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "当前拉黑关系下无法关注该用户",
    });
  }
  const enabled =
    payload.enabled === undefined ? true : Boolean(payload.enabled);
  if (enabled) {
    await db.execute(
      "INSERT IGNORE INTO forum_user_follows (follower_user_id, followed_user_id) VALUES (?, ?)",
      [user.id, targetUserId],
    );
  } else {
    await db.execute(
      "DELETE FROM forum_user_follows WHERE follower_user_id = ? AND followed_user_id = ?",
      [user.id, targetUserId],
    );
  }
  return {
    ok: true,
    relationship: await getRelationshipState(user.id, targetUserId),
  };
};

export const toggleForumBlock = async (
  event: H3Event,
  targetUserIdInput: unknown,
  payload: Record<string, unknown>,
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
    [targetUserId],
  );
  if (!userRows.length) {
    throw createError({ statusCode: 404, statusMessage: "用户不存在" });
  }
  const enabled =
    payload.enabled === undefined ? true : Boolean(payload.enabled);
  if (enabled) {
    await db.execute(
      "INSERT IGNORE INTO forum_user_blocks (user_id, blocked_user_id) VALUES (?, ?)",
      [user.id, targetUserId],
    );
    await db.execute(
      "DELETE FROM forum_user_follows WHERE (follower_user_id = ? AND followed_user_id = ?) OR (follower_user_id = ? AND followed_user_id = ?)",
      [user.id, targetUserId, targetUserId, user.id],
    );
  } else {
    await db.execute(
      "DELETE FROM forum_user_blocks WHERE user_id = ? AND blocked_user_id = ?",
      [user.id, targetUserId],
    );
  }
  return {
    ok: true,
    relationship: await getRelationshipState(user.id, targetUserId),
  };
};

export const getForumUserProfile = async (
  event: H3Event,
  targetUserIdInput: unknown,
): Promise<ForumUserProfile> => {
  await ensureForumSchema();
  const viewer = await getViewer(event);
  const targetUserId = sanitizeInt(targetUserIdInput, 0);
  if (targetUserId <= 0) {
    throw createError({ statusCode: 400, statusMessage: "用户 ID 无效" });
  }
  const db = getAccountDb();
  const [userRows] = await db.execute<Array<{ id: number }>>(
    "SELECT id FROM web_user_accounts WHERE id = ? LIMIT 1",
    [targetUserId],
  );
  if (!userRows.length) {
    throw createError({ statusCode: 404, statusMessage: "用户不存在" });
  }
  const badgeMap = await loadBadgeMap([targetUserId]);
  const relationship = await getRelationshipState(viewer?.id, targetUserId);
  const [statRows] = await db.execute<
    Array<{
      threadCount: number;
      followerCount: number;
      followingCount: number;
    }>
  >(
    `SELECT
        (SELECT COUNT(*) FROM forum_threads WHERE author_user_id = ? AND status = 'published') AS threadCount,
        (SELECT COUNT(*) FROM forum_user_follows WHERE followed_user_id = ?) AS followerCount,
        (SELECT COUNT(*) FROM forum_user_follows WHERE follower_user_id = ?) AS followingCount`,
    [targetUserId, targetUserId, targetUserId],
  );
  let latestThreads: ForumThreadCard[] = [];
  if (!relationship.isBlocked) {
    const [threadRows] = await db.execute<DbRow<ThreadRow>[]>(
      `SELECT t.*, s.slug AS section_slug, s.name AS section_name, s.icon AS section_icon, s.accent_color AS section_accent_color
       FROM forum_threads t
       INNER JOIN forum_sections s ON s.id = t.section_id
       WHERE t.author_user_id = ? AND t.status = 'published'
       ORDER BY t.latest_post_at DESC, t.id DESC
       LIMIT 6`,
      [targetUserId],
    );
    const likedThreadIds = await loadThreadLikeSet(
      threadRows.map((row) => row.id),
      viewer?.id,
    );
    const favoritedThreadIds = await loadThreadFavoriteSet(
      threadRows.map((row) => row.id),
      viewer?.id,
    );
    latestThreads = await Promise.all(
      threadRows.map((row) =>
        sanitizeThreadCard(row, badgeMap, likedThreadIds, favoritedThreadIds),
      ),
    );
  }
  return {
    user: badgeMap.get(targetUserId) || {
      id: targetUserId,
      username: "未知鼓友",
      avatarUrl: DEFAULT_AVATAR,
      role: "user",
      roleLabel: "鼓友",
      taikoIdMasked: "未绑定",
      verifiedTitle: null,
      verifiedTitleplateId: null,
    },
    relationship,
    stats: {
      threadCount: sanitizeInt(statRows[0]?.threadCount),
      followerCount: sanitizeInt(statRows[0]?.followerCount),
      followingCount: sanitizeInt(statRows[0]?.followingCount),
    },
    latestThreads,
  };
};

export const readForumImageMultipart = async (event: H3Event) => {
  const files = await readMultipartFormData(event);
  if (!files?.length) {
    throw createError({ statusCode: 400, statusMessage: "未收到上传文件" });
  }
  const image = files.find((item) => item.name === "image") || files[0];
  if (!image) {
    throw createError({ statusCode: 400, statusMessage: "未收到论坛图片" });
  }
  return image;
};

export const uploadForumImage = async (event: H3Event, file: MultiPartData) => {
  await ensureForumSchema();
  const user = await requireAccountUser(event);
  await ensureForumProfile(user.id);
  if (!file?.data?.length) {
    throw createError({ statusCode: 400, statusMessage: "未收到论坛图片" });
  }
  if ((file.data as Buffer).byteLength > IMAGE_MAX_BYTES) {
    throw createError({
      statusCode: 400,
      statusMessage: "论坛图片过大，请控制在 8MB 以内",
    });
  }
  const mime = String(file.type || "").toLowerCase();
  const detectedFormat = await detectImageFormat(file.data as Buffer);
  const allowedMime = ALLOWED_IMAGE_MIME_TYPES.includes(
    mime as (typeof ALLOWED_IMAGE_MIME_TYPES)[number],
  );
  if (!allowedMime && !ALLOWED_IMAGE_FORMATS.has(detectedFormat)) {
    throw createError({
      statusCode: 400,
      statusMessage: "仅支持 JPG、PNG、WEBP、GIF 图片",
    });
  }
  const buffer = await sharp(file.data as Buffer, { animated: true })
    .rotate()
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 84 })
    .toBuffer();
  const meta = await sharp(buffer).metadata();
  const ossConfig = requireConfiguredOss();
  const client = getOssClient();
  const key = `forum/threads/${user.id}/${Date.now()}.webp`;
  await client.put(key, buffer, {
    headers: {
      "Content-Type": "image/webp",
    },
  });
  const url = `${ossConfig.publicBaseUrl.replace(/\/$/, "")}/${key}`;
  return {
    imageUrl: url,
    width: sanitizeInt(meta.width),
    height: sanitizeInt(meta.height),
  };
};

export const getForumNotifications = async (
  event: H3Event,
  query: {
    page?: unknown;
    pageSize?: unknown;
  },
) => {
  await ensureForumSchema();
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
    [user.id, user.id],
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
    [user.id, user.id],
  );
  const badgeMap = await loadBadgeMap(
    rows.map((row) => row.actor_user_id || 0),
  );
  return {
    total: sanitizeInt(countRows[0]?.total),
    unreadCount: await countUnreadNotifications(user.id),
    page,
    pageSize,
    items: rows.map(
      (row) =>
        ({
          id: row.id,
          type: row.type,
          title: row.title,
          body: row.body,
          isRead: Boolean(row.is_read),
          createdAt: toIso(row.created_at),
          threadId: row.thread_id,
          postId: row.post_id,
          actor: row.actor_user_id
            ? badgeMap.get(row.actor_user_id) || null
            : null,
        }) satisfies ForumNotification,
    ),
  };
};

export const markForumNotificationsRead = async (
  event: H3Event,
  payload: Record<string, unknown>,
) => {
  await ensureForumSchema();
  const user = await requireAccountUser(event);
  await ensureForumProfile(user.id);
  const ids = Array.isArray(payload.ids)
    ? Array.from(
        new Set(
          payload.ids
            .map((item) => sanitizeInt(item, 0))
            .filter((item) => item > 0),
        ),
      )
    : [];
  const db = getAccountDb();
  if (ids.length) {
    const placeholders = ids.map(() => "?").join(", ");
    await db.execute(
      `UPDATE forum_notifications SET is_read = 1 WHERE user_id = ? AND id IN (${placeholders})`,
      [user.id, ...ids],
    );
  } else {
    await db.execute(
      "UPDATE forum_notifications SET is_read = 1 WHERE user_id = ?",
      [user.id],
    );
  }
  return {
    ok: true,
    unreadCount: await countUnreadNotifications(user.id),
  };
};

export const moderateForumThread = async (
  event: H3Event,
  payload: Record<string, unknown>,
) => {
  await ensureForumSchema();
  const { user } = await requireModerator(event);
  const threadId = sanitizeInt(payload.threadId, 0);
  const action = String(payload.action || "").trim();
  const enabled =
    payload.enabled === undefined ? true : Boolean(payload.enabled);
  const reason = clipText(String(payload.reason || "").trim(), 255);
  const thread = await getThreadRowById(threadId);
  if (!thread) {
    throw createError({ statusCode: 404, statusMessage: "帖子不存在" });
  }

  const actionMap: Record<string, { sql: string; label: string }> = {
    pin: { sql: "is_pinned = ?", label: enabled ? "置顶" : "取消置顶" },
    feature: { sql: "is_featured = ?", label: enabled ? "加精" : "取消加精" },
    lock: { sql: "is_locked = ?", label: enabled ? "锁帖" : "解除锁帖" },
    hide: { sql: "status = ?", label: enabled ? "隐藏" : "恢复显示" },
  };
  const target = actionMap[action];
  if (!target) {
    throw createError({ statusCode: 400, statusMessage: "不支持的管理动作" });
  }
  const db = getAccountDb();
  const value =
    action === "hide" ? (enabled ? "hidden" : "published") : enabled ? 1 : 0;
  await db.execute(
    `UPDATE forum_threads SET ${target.sql}, updated_at = NOW() WHERE id = ?`,
    [value, threadId],
  );
  await db.execute(
    "INSERT INTO forum_moderation_logs (thread_id, operator_user_id, action, reason) VALUES (?, ?, ?, ?)",
    [threadId, user.id, `${action}:${enabled ? "on" : "off"}`, reason || null],
  );
  if (thread.author_user_id !== user.id) {
    await createNotification({
      userId: thread.author_user_id,
      actorUserId: user.id,
      type: "system",
      title: `你的帖子状态已变更：${thread.title}`,
      body: `帖子《${clipText(thread.title, 20)}》已被${target.label}${reason ? `，原因：${reason}` : ""}`,
      threadId,
    });
  }
  return {
    ok: true,
  };
};

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
     LIMIT 6`,
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
      verifiedTitleplateId: null,
    },
    threadCount: sanitizeInt(row.threadCount),
    likeCount: sanitizeInt(row.likeCount),
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
     LIMIT 40`,
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

export const getForumHome = async (
  event: H3Event,
): Promise<ForumHomePayload> => {
  await ensureForumSchema();
  const sections = await listForumSections();
  const viewer = await getViewer(event);
  const [featured, hot, guides, announcements, leaderboard, tags] =
    await Promise.all([
      listForumThreads(event, { sort: "featured", page: 1, pageSize: 6 }),
      listForumThreads(event, { sort: "hot", page: 1, pageSize: 6 }),
      listForumThreads(event, {
        sort: "latest",
        threadType: "guide",
        page: 1,
        pageSize: 6,
      }),
      listForumThreads(event, {
        sort: "featured",
        sectionSlug: "official",
        page: 1,
        pageSize: 4,
      }),
      getLeaderboard(),
      getHighlightedTags(),
    ]);
  const currentUser = viewer
    ? (await loadBadgeMap([viewer.id])).get(viewer.id) || null
    : null;
  return {
    sections,
    featuredThreads: featured.items,
    hotThreads: hot.items,
    latestGuides: guides.items,
    announcements: announcements.items,
    leaderboard,
    currentUser,
    unreadNotificationCount: viewer
      ? await countUnreadNotifications(viewer.id)
      : 0,
    highlightedTags: tags,
  };
};
