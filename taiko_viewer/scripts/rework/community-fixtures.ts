// Intercepted responses for the slice D self-check (社区). The forum is database-backed: every /api/forum/* answer,
// the signed-in user and the chart activity are synthetic, typed against the real response types (types/forum.ts,
// types/ugc.ts, the account status type), so a field a page reads cannot drift from what the API returns. Only used by
// community-scenarios.mjs; never served. Song ids 1–60 exist in the synthetic catalog of detail-data.mjs.
//
// Mixed identity data (ruling 3 / RK-47): uploaded avatars (a same-origin PNG answered by the scenario), the server's
// fixed default address (shown as /default-avatar.svg), an empty avatar, and an avatar address that fails (404).
import type { AccountAuthUser } from "../../composables/useAccountAuthStatus";
import type {
  ForumContentBlock,
  ForumHomePayload,
  ForumNotification,
  ForumPostFloor,
  ForumPostReply,
  ForumSection,
  ForumThreadCard,
  ForumThreadDetail,
  ForumUserBadge
} from "../../types/forum";
import { FORUM_SECTION_SEEDS } from "../../types/forum.ts";
import type { CommunityChartActivityPayload } from "../../types/ugc";

export const AVATAR_OK = "/selfcheck/avatar-ok.png";
export const AVATAR_WIDE = "/selfcheck/avatar-wide.png";
export const AVATAR_FAIL = "/selfcheck/avatar-missing.png";
export const SERVER_DEFAULT = "https://viewer.sakura-bot.cn/miku.png";
export const MEDIA_URL = (n: number) => `/selfcheck/media-${n}.png`;
/** An image address that answers 404 (a failed thumbnail / content image). */
export const MEDIA_FAIL = "/selfcheck/media-missing.png";

export const fixtureUser = {
  id: 9004,
  username: "社区自检账号 selfcheck",
  email: "community-selfcheck@example.invalid",
  emailVerified: true,
  avatarUrl: AVATAR_OK,
  createdAt: "2026-01-01T00:00:00.000Z",
  titles: [{ key: "annual-beta-pioneer", name: "虹光先行者", style: "rainbow" as const }],
  annualSummaryAccess: false,
  myTaikoReadModelAccess: false,
  developerApiV1Access: false
} satisfies AccountAuthUser;

type AvatarKind = "uploaded" | "wide" | "default" | "empty" | "failed";
const avatarOf = (kind: AvatarKind) =>
  kind === "uploaded" ? AVATAR_OK : kind === "wide" ? AVATAR_WIDE : kind === "default" ? SERVER_DEFAULT : kind === "failed" ? AVATAR_FAIL : "";

export function badge(id: number, kind: AvatarKind, over: Partial<ForumUserBadge> = {}): ForumUserBadge {
  return {
    id,
    username: `鼓友${id}`,
    avatarUrl: avatarOf(kind),
    role: "user",
    roleLabel: "鼓友",
    taikoIdMasked: "12****89",
    verifiedTitle: null,
    verifiedTitleplateId: null,
    titles: [],
    ...over
  };
}

/** The signed-in user's forum badge (moderator: the moderation console is shown). */
export const meBadge = (role: ForumUserBadge["role"] = "moderator") =>
  badge(fixtureUser.id, "uploaded", {
    username: fixtureUser.username,
    role,
    roleLabel: role === "moderator" ? "版主" : role === "admin" ? "站务" : "鼓友",
    verifiedTitle: "魔王全连达人",
    verifiedTitleplateId: 42,
    titles: fixtureUser.titles
  });

/** Ten authors cycling through every avatar case, roles, plate / text titles, site titles and a long name. */
export const AUTHORS: ForumUserBadge[] = [
  badge(101, "uploaded", { verifiedTitle: "魔王全连达人", verifiedTitleplateId: 42, titles: [{ key: "annual-beta-pioneer", name: "虹光先行者", style: "rainbow" }] }),
  badge(102, "default", { role: "moderator", roleLabel: "版主" }),
  badge(103, "failed", { verifiedTitle: "称号没有对应牌面的情况", verifiedTitleplateId: 987654 }),
  badge(104, "empty", { taikoIdMasked: "未绑定" }),
  badge(105, "wide", { role: "admin", roleLabel: "站务" }),
  badge(106, "uploaded", { username: "名字非常非常长的鼓友名字非常非常长的鼓友名字非常非常长的鼓友abcdefghijklmnop" }),
  badge(107, "default"),
  badge(108, "failed"),
  badge(109, "uploaded", { verifiedTitle: "Lorem-ipsum-dolor-sit-amet-consectetur-adipiscing-elit-without-any-break", verifiedTitleplateId: 2 }),
  badge(110, "empty")
];

export function fixtureSections(): ForumSection[] {
  return FORUM_SECTION_SEEDS.map((seed, index) => ({
    ...seed,
    id: index + 1,
    threadCount: [12, 4, 30, 128, 9, 51, 3, 77, 0][index] ?? 0,
    postCount: 100 + index,
    featuredThreadCount: index % 3
  }));
}

const section = (slug: string) => {
  const s = fixtureSections().find((x) => x.slug === slug) || fixtureSections()[0];
  return { id: s.id, slug: s.slug, name: s.name, icon: s.icon, accentColor: s.accentColor };
};

const LONG_TITLE = "【长标题】这是一条非常非常长的帖子标题，用来检查列表与帖子页在窄屏上的换行，以及不会出现横向滚动的情况，再加一些文字";
const UNBROKEN = "https://example.invalid/averyveryveryveryveryveryveryveryveryverylongpathwithoutanybreakopportunity/0123456789";

/** Thread n (id 5000 + n). Every fourth links a chart, every third has a media cover, some carry states. */
export function threadCard(n: number, over: Partial<ForumThreadCard> = {}): ForumThreadCard {
  const slugs = ["score-guides", "dojo", "general", "achievements", "beginner-help", "events", "arcade", "creative", "official"];
  const withSong = n % 4 === 1;
  return {
    id: 5000 + n,
    section: section(slugs[n % slugs.length]),
    author: AUTHORS[n % AUTHORS.length],
    threadType: (["discussion", "guide", "achievement", "official"] as const)[n % 4],
    title: n === 2 ? LONG_TITLE : n === 3 ? `长串 ${UNBROKEN}` : `合成帖子 ${n}：魔王第 ${n} 首的练习记录`,
    summary: n === 3 ? UNBROKEN : `这是第 ${n} 条帖子的摘要，用来检查列表里的两行截断与字号。后半段的连打和转换怎么处理比较稳定？`,
    coverImageUrl: n === 6 ? MEDIA_FAIL : n % 3 === 0 ? MEDIA_URL(n % 4) : "",
    tags: n % 2 === 0 ? ["段位", "全良", `标签${n}`] : [],
    song: withSong
      ? { id: (n % 50) + 1, title: `合成曲目 ${(n % 50) + 1}`, titleJp: n % 8 === 1 ? `合成曲 ${(n % 50) + 1}` : "", coverUrl: "", category: "", difficultyType: 4, difficultyLabel: "魔王", level: 9 }
      : null,
    status: "published",
    isPinned: n === 1,
    isFeatured: n === 4,
    isLocked: n === 5,
    likeCount: n * 7,
    replyCount: n * 3,
    viewCount: n * 101,
    createdAt: new Date(Date.UTC(2026, 10, 18, 2, 0) - n * 3600_000).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 10, 18, 2, 0) - n * 3600_000).toISOString(),
    latestPostAt: new Date(Date.UTC(2026, 10, 18, 3, 0) - n * 3600_000).toISOString(),
    viewerHasLiked: false,
    viewerHasFavorited: false,
    ...over
  };
}

export function fixtureList(opts: { total?: number; page?: number; pageSize?: number; sort?: string; offset?: number } = {}) {
  const pageSize = opts.pageSize ?? 12;
  const page = opts.page ?? 1;
  const total = opts.total ?? 30;
  const count = Math.max(0, Math.min(pageSize, total - (page - 1) * pageSize));
  return { total, page, pageSize, sort: opts.sort ?? "latest", items: Array.from({ length: count }, (_, i) => threadCard((opts.offset ?? 0) + (page - 1) * pageSize + i + 1)) };
}

export function fixtureHome(opts: { unread?: number; signedIn?: boolean } = {}): ForumHomePayload {
  return {
    sections: fixtureSections(),
    featuredThreads: [threadCard(4), threadCard(8)],
    hotThreads: [threadCard(6), threadCard(7), threadCard(2)],
    latestGuides: [threadCard(1, { threadType: "guide" }), threadCard(9, { threadType: "guide" })],
    announcements: [threadCard(12, { threadType: "official" })],
    leaderboard: AUTHORS.slice(0, 5).map((author, i) => ({ author, threadCount: 40 - i * 6, likeCount: 900 - i * 120 })),
    currentUser: opts.signedIn ? meBadge() : null,
    unreadNotificationCount: opts.unread ?? 3,
    highlightedTags: ["段位", "全良", "配速", "新手", "长长长长长长长长长长的标签"]
  };
}

export function fixtureActivity(): CommunityChartActivityPayload {
  return {
    items: [1, 2, 3].map((n) => ({
      chartId: `${n}:4`,
      songId: n,
      difficulty: 4,
      songTitle: `合成曲目 ${n}`,
      songTitleJp: n === 1 ? "合成曲 1" : "",
      cover: `/api/content/covers/${n}`,
      level: 8 + n,
      difficultySummary: (["hard", "balanced", "mixed"] as const)[n - 1],
      participantCount: 3 * n,
      tags: [{ slug: "stamina", labelKey: "ugc.tags.stamina", count: 2 }],
      tipPreview: n === 1 ? { body: "后半段的十六分连打先压住节奏，不要抢拍。", helpfulCount: 4 } : null,
      activityAt: "2026-11-17T08:00:00.000Z",
      href: `/songs/${n}?difficulty=4#chart-ugc`
    }))
  };
}

const paragraph = (text: string): ForumContentBlock => ({ type: "paragraph", text });
const image = (n: number, caption = ""): ForumContentBlock => ({ type: "image", imageUrl: MEDIA_URL(n), alt: caption || undefined, caption: caption || undefined });

function reply(id: number, floor: ForumPostFloor, k: number, parent: number, over: Partial<ForumPostReply> = {}): ForumPostReply {
  return {
    id,
    parentPostId: parent,
    rootPostId: floor.id,
    bodyText: `楼中楼回复 ${k}`,
    contentBlocks: [paragraph(`楼中楼回复 ${k}：同意，补充一点关于第 ${k} 小节的看法。`)],
    likeCount: k % 5,
    createdAt: new Date(Date.UTC(2026, 10, 17, 9, k)).toISOString(),
    author: AUTHORS[(k + 3) % AUTHORS.length],
    viewerHasLiked: k % 7 === 0,
    isBlockedAuthor: false,
    ...over
  };
}

/**
 * Thread detail. `long`: 40 floors, floor 3 with 30 replies and floor 10 with 70 replies (one floor longer than a
 * window), a blocked floor and a blocked reply, images in the body, a floor and a reply, many likes. `hidden`: the
 * thread is hidden (moderator view). `locked`.
 */
export function fixtureThread(id: number, opts: { long?: boolean; locked?: boolean; hidden?: boolean; song?: boolean; liked?: boolean; empty?: boolean } = {}): ForumThreadDetail {
  const card = threadCard(id - 5000 > 0 ? id - 5000 : 1, {
    id,
    title: opts.long ? "后半段十六分连打怎么稳定：长帖，40 楼，带图片与楼中楼" : `合成帖子 ${id}`,
    isLocked: Boolean(opts.locked),
    status: opts.hidden ? "hidden" : "published",
    viewerHasLiked: Boolean(opts.liked),
    likeCount: 1234,
    tags: ["段位", "全良", "配速"],
    song: opts.song === false ? null : { id: 1, title: "合成曲目 1", titleJp: "合成曲 1", coverUrl: "", category: "", difficultyType: 4, difficultyLabel: "魔王", level: 9 }
  });
  const floors: ForumPostFloor[] = [];
  const floorCount = opts.empty ? 0 : opts.long ? 40 : 4;
  let postId = id * 100;
  for (let f = 1; f <= floorCount; f++) {
    const floor: ForumPostFloor = {
      id: ++postId,
      floorNo: f,
      bodyText: `第 ${f} 楼`,
      contentBlocks: [
        paragraph(`第 ${f} 楼：${f === 2 ? UNBROKEN : "我是这样练的：先用 0.8 倍速把手顺固定下来，再逐步加速。"}`),
        ...(f === 4 ? [image(1, "第 4 楼的截图")] : []),
        ...(f === 6 ? [{ type: "image" as const, imageUrl: MEDIA_FAIL, caption: "第 6 楼加载失败的图片" }] : [])
      ],
      likeCount: f === 1 ? 999 : f % 6,
      createdAt: new Date(Date.UTC(2026, 10, 17, 8, f)).toISOString(),
      author: f === 1 ? card.author : AUTHORS[f % AUTHORS.length],
      viewerHasLiked: f === 3,
      isBlockedAuthor: f === 5,
      replies: []
    };
    const replyCount = opts.long ? (f === 3 ? 30 : f === 10 ? 70 : f % 4 === 0 ? 2 : 0) : f === 1 ? 3 : 0;
    for (let k = 1; k <= replyCount; k++) {
      const parent = k > 1 && k % 3 === 0 ? floor.replies[k - 2].id : floor.id;
      floor.replies.push(reply(++postId, floor, k, parent, k === 2 ? { isBlockedAuthor: true } : k === 4 && f === 1 ? { contentBlocks: [paragraph("带图回复"), image(2)] } : {}));
    }
    floors.push(floor);
  }
  const replyTotal = floors.reduce((sum, floor) => sum + 1 + floor.replies.length, 0);
  return {
    ...card,
    replyCount: replyTotal,
    contentBlocks: [
      paragraph("这是正文第一段。后半段的十六分连打在 BPM 220 下很难稳定，我把练习方法整理如下。\n\n1. 先降速。\n2. 固定手顺。"),
      image(0, "正文里的谱面截图"),
      paragraph(`第二段带一个很长的链接：${UNBROKEN}`),
      image(3),
      { type: "image", imageUrl: MEDIA_FAIL, caption: "正文里加载失败的图片" }
    ],
    posts: floors
  };
}

/** Post ids of the long thread: a reply inside floor 10 (in a later window) and floor 38. */
export const deepReplyId = (thread: ForumThreadDetail) => thread.posts[9].replies[50].id;
export const lateFloorId = (thread: ForumThreadDetail) => thread.posts[37].id;

export function fixtureNotifications(page = 1, opts: { empty?: boolean; total?: number } = {}) {
  const total = opts.empty ? 0 : opts.total ?? 26;
  const pageSize = 20;
  const count = Math.max(0, Math.min(pageSize, total - (page - 1) * pageSize));
  const items: ForumNotification[] = Array.from({ length: count }, (_, i) => {
    const n = (page - 1) * pageSize + i;
    const type = (["reply", "mention", "like", "system"] as const)[n % 4];
    return {
      id: 7000 + n,
      type,
      title: type === "system" ? "你的帖子状态已变更：合成帖子" : `${AUTHORS[n % AUTHORS.length].username} 回复了你的帖子《合成帖子 ${n}》`,
      body: n === 1 ? `很长的通知正文 ${UNBROKEN} 再加一些文字，检查两行截断。` : "我也是这样练的，后半段先降速。",
      isRead: n >= 3,
      createdAt: new Date(Date.now() - (n * 47 + 3) * 60_000).toISOString(),
      threadId: type === "system" && n % 8 === 3 ? null : 5001,
      postId: type === "reply" ? 500102 : null,
      actor: type === "system" ? null : AUTHORS[n % AUTHORS.length]
    };
  });
  return { total, unreadCount: items.filter((i) => !i.isRead).length + (page === 1 ? 0 : 0), page, pageSize, items };
}

/** /api/account/profile as /forum/me reads it (the page's own ProfilePayload). */
export const fixtureProfile = (bound = true) => ({
  user: { id: fixtureUser.id, username: fixtureUser.username, email: fixtureUser.email, avatarUrl: fixtureUser.avatarUrl, emailVerified: true, createdAt: fixtureUser.createdAt },
  currentBinding: bound ? { taikoId: "123456789012", verifiedTitle: "魔王全连达人" } : null,
  bindings: bound ? [{ id: 1 }] : []
});
