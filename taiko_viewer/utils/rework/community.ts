// Slice D (社区) presentation helpers. Pure functions only: no Nuxt imports, used by the reworked community
// components and by node tests. Nothing here reads or writes forum data or decides a permission: it only turns what
// /api/forum/* returned into what a component draws (tabs, reply windows, identity pieces, notification marks).
import type { ForumPostFloor, ForumPostReply, ForumThreadCard, ForumUserBadge } from "../../types/forum";

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
