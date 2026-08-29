import type { H3Event } from "h3";
import { getRequestIP } from "h3";
import { createMemoryRateLimiter } from "~/server/utils/rate-limit";
import { UGC_WRITE_RATE_LIMIT, UGC_WRITE_RATE_WINDOW_MS } from "./constants";

const enforceUgcWriteRequestRate = createMemoryRateLimiter({
  windowMs: UGC_WRITE_RATE_WINDOW_MS,
  limit: UGC_WRITE_RATE_LIMIT,
  maxBuckets: 10_000,
  message: "操作太频繁，请稍后再试"
});

export const enforceUgcWriteRateLimit = (
  event: H3Event,
  userId: number,
  action: "difficulty" | "tags"
) => {
  const address = getRequestIP(event, { xForwardedFor: true }) || event.node.req.socket.remoteAddress || "unknown";
  enforceUgcWriteRequestRate(event, `${action}:account:${userId}:ip:${address}`);
};
