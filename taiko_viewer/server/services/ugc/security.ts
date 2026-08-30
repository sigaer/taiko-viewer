import type { H3Event } from "h3";
import { getRequestIP } from "h3";
import { createMemoryRateLimiter } from "~/server/utils/rate-limit";
import {
  UGC_ADMIN_MODERATION_RATE_LIMIT,
  UGC_HELPFUL_RATE_LIMIT,
  UGC_REPORT_RATE_LIMIT,
  UGC_TIP_WRITE_RATE_LIMIT,
  UGC_WRITE_RATE_LIMIT,
  UGC_WRITE_RATE_WINDOW_MS
} from "./constants";

// These buckets are process-local and are sufficient for the current single-instance deployment.
const enforceUgcWriteRequestRate = createMemoryRateLimiter({
  windowMs: UGC_WRITE_RATE_WINDOW_MS,
  limit: UGC_WRITE_RATE_LIMIT,
  maxBuckets: 10_000,
  message: "操作太频繁，请稍后再试"
});

const limiters = new Map<string, ReturnType<typeof createMemoryRateLimiter>>();
const getLimiter = (action: string, limit: number) => {
  const key = `${action}:${limit}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    limiter = createMemoryRateLimiter({ windowMs: UGC_WRITE_RATE_WINDOW_MS, limit, maxBuckets: 10_000, message: "操作太频繁，请稍后再试" });
    limiters.set(key, limiter);
  }
  return limiter;
};

export const enforceUgcWriteRateLimit = (
  event: H3Event,
  userId: number,
  action: "difficulty" | "tags" | "tip_write" | "helpful" | "report" | "admin_moderation"
) => {
  const address = getRequestIP(event, { xForwardedFor: true }) || event.node.req.socket.remoteAddress || "unknown";
  if (action === "difficulty" || action === "tags") {
    enforceUgcWriteRequestRate(event, `${action}:account:${userId}:ip:${address}`);
    return;
  }
  const limits = { tip_write: UGC_TIP_WRITE_RATE_LIMIT, helpful: UGC_HELPFUL_RATE_LIMIT, report: UGC_REPORT_RATE_LIMIT, admin_moderation: UGC_ADMIN_MODERATION_RATE_LIMIT } as const;
  getLimiter(action, limits[action])(event, `${action}:account:${userId}:ip:${address}`);
};
