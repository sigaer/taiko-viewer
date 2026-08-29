import type { H3Event } from "h3";
import { createError, setHeader } from "h3";

type RateBucket = { count: number; resetAt: number };

export const createMemoryRateLimiter = (options: {
  windowMs: number;
  limit: number;
  maxBuckets: number;
  message: string;
}) => {
  const buckets = new Map<string, RateBucket>();

  return (event: H3Event, subject: string) => {
    const now = Date.now();
    if (!buckets.has(subject) && buckets.size >= options.maxBuckets) {
      for (const [key, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(key);
      }
      while (buckets.size >= options.maxBuckets) {
        const oldestKey = buckets.keys().next().value;
        if (!oldestKey) break;
        buckets.delete(oldestKey);
      }
    }

    const bucket = buckets.get(subject);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(subject, { count: 1, resetAt: now + options.windowMs });
      return;
    }

    bucket.count += 1;
    if (bucket.count > options.limit) {
      setHeader(event, "Retry-After", Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)));
      throw createError({ statusCode: 429, statusMessage: options.message });
    }
  };
};
