import type { H3Event } from "h3";
import { createForumThreadCore } from "~/server/utils/forum/threads";
import { uploadForumImageBuffer } from "~/server/utils/forum/media";
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

// One Forum-sync budget per user, shared by the reaction sync and the share-card
// sync, so a caller can never spend more than the configured rate.
export const claimForumSyncBudget = (event: H3Event, userId: number) => {
  const subject = String(userId);
  try {
    syncInterval(event, subject);
    syncDaily(event, subject);
    return { limited: false as const };
  } catch {
    // Rate limiting only skips the Forum side effect; the primary record stays saved.
    clearRetryAfter(event);
    return { limited: true as const };
  }
};

export const syncAnnualReactionToCommunity = async (options: {
  event: H3Event;
  actorUserId: number;
  actorUsername: string;
  content: string;
}): Promise<CommunitySyncOutcome> => {
  if (claimForumSyncBudget(options.event, options.actorUserId).limited) {
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

export const ANNUAL_SHARE_CARD_FORUM_TITLE = "快来看看我的年度报告吧～";

/**
 * Share card -> Forum. The uploaded image is exactly the Phase E share card, and the
 * thread body is exactly one image block: no extra text, no link, no QR code.
 */
export const syncAnnualShareCardToCommunity = async (options: {
  event: H3Event;
  actorUserId: number;
  actorUsername: string;
  imageData: Buffer;
}): Promise<CommunitySyncOutcome & { imageUrl?: string }> => {
  if (claimForumSyncBudget(options.event, options.actorUserId).limited) {
    return { status: "skipped", reason: "rate-limited", message: "分享图片已保存；社区同步过于频繁，本次未同步社区" };
  }

  try {
    const uploaded = await uploadForumImageBuffer({
      userId: options.actorUserId,
      data: options.imageData,
      mime: "image/png"
    });
    const created = await createForumThreadCore({
      actorUserId: options.actorUserId,
      actorUsername: options.actorUsername,
      titlePolicy: "integration",
      payload: {
        sectionSlug: ANNUAL_REACTION_FORUM_SECTION,
        threadType: ANNUAL_REACTION_FORUM_THREAD_TYPE,
        title: ANNUAL_SHARE_CARD_FORUM_TITLE,
        summary: ANNUAL_SHARE_CARD_FORUM_TITLE,
        tags: ANNUAL_REACTION_FORUM_TAGS,
        contentBlocks: [{ type: "image", imageUrl: uploaded.imageUrl }]
      }
    });
    return { status: "synced", reason: "synced", threadId: created.threadId, imageUrl: uploaded.imageUrl, message: "分享图片已保存，已同步到社区" };
  } catch (error) {
    // The share card is the primary operation: a Forum failure must never lose it.
    console.warn("[annual-share-card] community sync failed", options.actorUserId, (error as { statusMessage?: string })?.statusMessage || error);
    return { status: "failed", reason: "failed", message: "分享图片已保存，但同步社区失败" };
  }
};
