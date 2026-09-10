import type { H3Event } from "h3";
import { createForumThreadCore } from "~/server/utils/forum/threads";
import { createMemoryRateLimiter } from "~/server/utils/rate-limit";

/**
 * Annual reaction -> Forum sync.
 *
 * The client only ever sends `syncCommunity: true/false`; the section and the
 * thread type are fixed here on the server, and the thread carries exactly the
 * reaction text as both title and body.
 */
export const ANNUAL_REACTION_FORUM_SECTION = "general";
export const ANNUAL_REACTION_FORUM_THREAD_TYPE = "discussion";
export const ANNUAL_REACTION_FORUM_TAGS = ["年度报告", "年度感想"];

export type CommunitySyncStatus = "synced" | "failed" | "skipped";
export type CommunitySyncReason = "synced" | "failed" | "rate-limited" | "not-requested";

export type CommunitySyncOutcome = {
  status: CommunitySyncStatus;
  reason: CommunitySyncReason;
  threadId?: number;
  message: string;
};

// Forum sync is intentionally stricter than the reaction limit: at most one
// sync every 30 seconds and 10 syncs per day for the same user.
const syncInterval = createMemoryRateLimiter({
  windowMs: 30 * 1000,
  limit: 1,
  maxBuckets: 10000,
  message: "社区同步过于频繁"
});
const syncDaily = createMemoryRateLimiter({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 10,
  maxBuckets: 10000,
  message: "今日社区同步次数已达上限"
});

const clearRetryAfter = (event: H3Event) => {
  const response = event?.node?.res;
  if (response && typeof response.removeHeader === "function") {
    response.removeHeader("Retry-After");
  }
};

export const syncAnnualReactionToCommunity = async (options: {
  event: H3Event;
  actorUserId: number;
  actorUsername: string;
  content: string;
}): Promise<CommunitySyncOutcome> => {
  const subject = String(options.actorUserId);
  try {
    syncInterval(options.event, subject);
    syncDaily(options.event, subject);
  } catch {
    // Rate limiting only skips the Forum side effect; the reaction itself stays published.
    clearRetryAfter(options.event);
    return { status: "skipped", reason: "rate-limited", message: "感想已发送；社区同步过于频繁，本次仅显示弹幕。" };
  }

  try {
    const created = await createForumThreadCore({
      actorUserId: options.actorUserId,
      actorUsername: options.actorUsername,
      titlePolicy: "integration",
      payload: {
        sectionSlug: ANNUAL_REACTION_FORUM_SECTION,
        threadType: ANNUAL_REACTION_FORUM_THREAD_TYPE,
        title: options.content,
        summary: options.content,
        tags: ANNUAL_REACTION_FORUM_TAGS,
        contentBlocks: [{ type: "paragraph", text: options.content }]
      }
    });
    return { status: "synced", reason: "synced", threadId: created.threadId, message: "感想已发送，已同步到社区" };
  } catch (error) {
    // The reaction is the primary operation: a Forum failure must never lose it.
    console.warn("[annual-reaction] community sync failed", options.actorUserId, (error as { statusMessage?: string })?.statusMessage || error);
    return { status: "failed", reason: "failed", message: "感想已发送，社区同步失败。" };
  }
};

export const notRequestedCommunitySync = (): CommunitySyncOutcome => ({
  status: "skipped",
  reason: "not-requested",
  message: "感想已发送，本次未同步到社区"
});
