// Slice D (社区) presentation helpers. Pure functions only: no Nuxt imports, used by the reworked community
// components and by node tests. Nothing here reads or writes forum data or decides a permission: it only turns what
// /api/forum/* returned into what a component draws (tabs, reply windows, identity pieces, notification marks).
import type { ForumContentBlock, ForumPostFloor, ForumPostReply, ForumThreadCard, ForumUserBadge } from "../../types/forum";

/** Secondary tabs of the 社区 destination; each label equals the page's own <h1>. */
export const COMMUNITY_TABS = [
  { key: "community", to: "/forum" },
  { key: "myPosts", to: "/forum/me" },
  { key: "notifications", to: "/forum/notifications" }
] as const;

/** Feed filters of /forum (the `filter` query; `latest` is the default and not written). */
export const HOME_FILTERS = ["latest", "hot", "guide", "featured"] as const;
export type HomeFilter = (typeof HOME_FILTERS)[number];
export const homeFilter = (value: unknown): HomeFilter =>
  (HOME_FILTERS as readonly string[]).includes(String(value)) && String(value) !== "latest" ? (String(value) as HomeFilter) : "latest";

/** The V1.3 budget: at most this many replies (floors and replies inside floors) are mounted at a time. */
export const REPLY_WINDOW = 60;

export interface WindowFloor {
  floor: ForumPostFloor;
  /** false when the window starts inside this floor's replies (the floor's own post is in the previous window) */
  head: boolean;
  replies: ForumPostReply[];
}
export interface ReplyWindow {
  floors: WindowFloor[];
  /** mounted items: floor posts with head + replies */
  size: number;
  firstFloor: number;
  lastFloor: number;
}

/**
 * Splits the server's reply order (floors by floor number, each floor's replies in order) into windows of at most
 * `limit` mounted items. The order is never changed; a floor with more replies than fit continues in the next
 * window (head = false there). One window when everything fits.
 */
export function replyWindows(floors: readonly ForumPostFloor[], limit = REPLY_WINDOW): ReplyWindow[] {
  const max = Math.max(1, Math.trunc(limit) || REPLY_WINDOW);
  const windows: ReplyWindow[] = [];
  let current: ReplyWindow | null = null;
  const open = () => {
    current = { floors: [], size: 0, firstFloor: 0, lastFloor: 0 };
    windows.push(current);
    return current;
  };
  for (const floor of floors) {
    let w: ReplyWindow = current && current.size < max ? current : open();
    let entry: WindowFloor = { floor, head: true, replies: [] };
    w.floors.push(entry);
    w.size++;
    for (const reply of floor.replies) {
      if (w.size >= max) {
        w = open();
        entry = { floor, head: false, replies: [] };
        w.floors.push(entry);
      }
      entry.replies.push(reply);
      w.size++;
    }
  }
  for (const w of windows) {
    w.firstFloor = w.floors[0]?.floor.floorNo ?? 0;
    w.lastFloor = w.floors[w.floors.length - 1]?.floor.floorNo ?? 0;
  }
  return windows;
}

/** Index of the window that mounts the floor or reply with this post id; -1 when it is not in the thread. */
export function windowOfPost(windows: readonly ReplyWindow[], postId: number): number {
  return windows.findIndex((w) => w.floors.some((f) => (f.head && f.floor.id === postId) || f.replies.some((r) => r.id === postId)));
}

/** `#reply-<id>` → id, otherwise null (the thread page's existing deep-link format). */
export function replyHashId(hash: unknown): number | null {
  const match = String(hash ?? "").match(/^#reply-(\d+)$/);
  return match ? Number(match[1]) : null;
}

/** Username of the post a reply answers inside its floor ("" when it answers the floor itself or is not found). */
export function replyTargetName(reply: ForumPostReply, floor: ForumPostFloor): string {
  if (!reply.parentPostId) return "";
  if (reply.parentPostId === floor.id) return floor.author.username;
  return floor.replies.find((entry) => entry.id === reply.parentPostId)?.author.username || "";
}

/** Role tag only for moderators and admins (the API's role; ordinary members carry no tag). */
export const roleTag = (user: Pick<ForumUserBadge, "role"> | null | undefined) =>
  user && (user.role === "moderator" || user.role === "admin") ? user.role : null;

/** The song of a thread in the page language (Japanese title when the page is Japanese and it exists). */
export function threadSongTitle(song: NonNullable<ForumThreadCard["song"]>, locale: string): { text: string; lang: string | undefined } {
  if (locale === "ja" && song.titleJp) return { text: song.titleJp, lang: undefined };
  return { text: song.title, lang: locale === "ja" ? "zh-CN" : undefined };
}

/** Song title of a chart-activity entry in the page language (Japanese when the page is Japanese and it exists). */
export function activityTitle(item: { songTitle: string; songTitleJp: string }, locale: string): { text: string; lang: string | undefined } {
  if (locale === "ja" && item.songTitleJp) return { text: item.songTitleJp, lang: undefined };
  return { text: item.songTitle, lang: locale === "ja" ? "zh-CN" : undefined };
}

/** Link to the related chart: the song page at that difficulty (and its UGC block when a difficulty is given). */
export function threadSongLocation(song: NonNullable<ForumThreadCard["song"]>, withUgc = false) {
  const difficulty = song.difficultyType && song.difficultyType >= 1 && song.difficultyType <= 5 ? song.difficultyType : null;
  return {
    path: `/songs/${song.id}`,
    query: difficulty ? { difficulty: String(difficulty) } : {},
    hash: withUgc && difficulty ? "#chart-ugc" : undefined
  };
}

/** Thread states the API reports, in display order (hidden is visible only to moderators). */
export function threadStates(thread: Pick<ForumThreadCard, "isPinned" | "isFeatured" | "isLocked" | "status">) {
  const out: ("pinned" | "featured" | "locked" | "hidden")[] = [];
  if (thread.isPinned) out.push("pinned");
  if (thread.isFeatured) out.push("featured");
  if (thread.isLocked) out.push("locked");
  if (thread.status === "hidden") out.push("hidden");
  return out;
}

/** Notification type → ReworkIcon name (system notifications have no actor). */
export const NOTIFICATION_ICONS: Record<string, string> = { reply: "reply", mention: "mention", like: "heart", system: "bell" };

/**
 * Date (and time) text of a forum timestamp in the page language; "—" when missing or invalid. With `timeZone` the
 * text is the same wherever it is rendered (server render and hydration); without it the visitor's time zone.
 */
export function forumTimeText(value: unknown, kind: "datetime" | "date", locale: string, timeZone?: string): string {
  const date = new Date(typeof value === "string" || typeof value === "number" ? value : NaN);
  if (!value || Number.isNaN(date.getTime())) return "—";
  const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit" };
  if (kind === "datetime") Object.assign(options, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  if (timeZone) options.timeZone = timeZone;
  return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "zh-CN", options).format(date);
}

/** 只看楼主: the floors posted by the thread author (each with all of its replies), in the server order. */
export function onlyAuthorFloors(floors: readonly ForumPostFloor[], authorId: number): ForumPostFloor[] {
  return floors.filter((floor) => floor.author.id === authorId);
}

/**
 * Jump to floor: the id of the floor with that number, or of the first later floor when that one no longer exists
 * (removed floors leave gaps); null for a number that is not a positive integer or lies after the last floor.
 */
export function floorIdForNumber(floors: readonly ForumPostFloor[], value: unknown): number | null {
  const n = Number(String(value ?? "").trim());
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  let best: ForumPostFloor | null = null;
  for (const floor of floors) {
    if (floor.floorNo >= n && (!best || floor.floorNo < best.floorNo)) best = floor;
  }
  return best ? best.id : null;
}

/** Whether the signed-in member may offer edit / delete on an item: their own, and the thread is not locked. */
export const ownsItem = (authorId: number | null | undefined, viewerId: number | null | undefined, locked = false) =>
  !locked && typeof viewerId === "number" && viewerId > 0 && authorId === viewerId;

/** Absolute link to a thread, or to one post of it (`#reply-<id>`, the page's deep-link format). */
export function threadLink(origin: string, threadPath: string, postId?: number | null): string {
  const base = `${String(origin || "").replace(/\/+$/, "")}${threadPath.startsWith("/") ? threadPath : `/${threadPath}`}`;
  return postId ? `${base}#reply-${postId}` : base;
}

/** Notification types the type filter offers ("all" first); the API returns `type` on each item. */
export const NOTIFICATION_FILTERS = ["all", "reply", "mention", "like", "system"] as const;
export type NotificationFilter = (typeof NOTIFICATION_FILTERS)[number];
export function filterNotifications<T extends { type: string }>(items: readonly T[], filter: NotificationFilter): T[] {
  return filter === "all" ? [...items] : items.filter((item) => item.type === filter);
}

/** A block of a thread being edited (the edit page): its stored order is kept; `key` is a stable list key. */
export type EditableBlock =
  | { key: string; type: "paragraph"; text: string }
  | { key: string; type: "image"; imageUrl: string; caption: string };

/** Stored content blocks → editable blocks (same order; image alt is not edited and is dropped like on create). */
export function toEditableBlocks(blocks: readonly ForumContentBlock[]): EditableBlock[] {
  return blocks.map((block, index) =>
    block.type === "paragraph"
      ? { key: `b${index}`, type: "paragraph", text: block.text }
      : { key: `b${index}`, type: "image", imageUrl: block.imageUrl, caption: block.caption || "" }
  );
}

/** Editable blocks → the request's contentBlocks (empty paragraphs dropped, text trimmed; the server sanitises again). */
export function fromEditableBlocks(blocks: readonly EditableBlock[]): ForumContentBlock[] {
  const out: ForumContentBlock[] = [];
  for (const block of blocks) {
    if (block.type === "paragraph") {
      if (block.text.trim()) out.push({ type: "paragraph", text: block.text.trim() });
    } else if (block.imageUrl) {
      out.push(block.caption.trim() ? { type: "image", imageUrl: block.imageUrl, caption: block.caption.trim() } : { type: "image", imageUrl: block.imageUrl });
    }
  }
  return out;
}

/**
 * Whether a stored summary is the one the server derived from the first paragraph (clipText(…, 120), as on create
 * when the summary field was left empty). The edit page then leaves the field empty so it is derived again from the
 * edited body instead of keeping the old first paragraph.
 */
export function isDerivedSummary(summary: string, blocks: readonly ForumContentBlock[]): boolean {
  const first = blocks.find((block): block is Extract<ForumContentBlock, { type: "paragraph" }> => block.type === "paragraph" && Boolean(block.text.trim()));
  if (!first) return false;
  const normalized = first.text.trim().replace(/\s+/g, " ");
  const derived = normalized.length <= 120 ? normalized : `${normalized.slice(0, 119)}…`;
  return summary === derived;
}

/** Tags of a thread → the composer's tag field text (space separated; the request splits it as on create). */
export const tagsInputOf = (tags: readonly string[]) => tags.join(" ");
/** The composer's tag split (the same expression as pages/forum/new.vue). */
export const splitTags = (input: string) => input.split(/[\s,，#]+/).map((item) => item.trim()).filter(Boolean);

/** Sections of /forum/me (the `tab` query; `threads` is the default and not written). */
export const ME_TABS = ["threads", "replied", "favorites", "history", "following", "followers", "blocked"] as const;
export type MeTab = (typeof ME_TABS)[number];
export const meTab = (value: unknown): MeTab => {
  const raw = String(Array.isArray(value) ? value[0] : value);
  return (ME_TABS as readonly string[]).includes(raw) ? (raw as MeTab) : "threads";
};
/** The read behind a tab: threads.get `scope` for thread tabs, relationships.get `scope` for people tabs. */
export const meTabRequest = (tab: MeTab): { kind: "threads" | "people"; scope: string } =>
  tab === "threads"
    ? { kind: "threads", scope: "mine" }
    : tab === "following" || tab === "followers" || tab === "blocked"
      ? { kind: "people", scope: tab }
      : { kind: "threads", scope: tab };
