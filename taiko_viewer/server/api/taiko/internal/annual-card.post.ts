import { readBody, setHeader } from 'h3';
import { requireBotService } from '~/server/utils/account/manual';
import { getBotAnnualCard } from '~/server/services/account/annual-summary/bot';
import { createMemoryRateLimiter } from '~/server/utils/rate-limit';
const limit = createMemoryRateLimiter({ windowMs: 60_000, limit: 4, maxBuckets: 5000, message: '请求过于频繁，请稍后再试' });
export default defineEventHandler(async event => {
  requireBotService(event);
  const body = await readBody(event);
  const identity = String(body?.identityKey || '').trim();
  limit(event, identity);
  setHeader(event, 'Cache-Control', 'no-store');
  const image = await getBotAnnualCard(event, identity);
  setHeader(event, 'Content-Type', 'image/png');
  return image;
});
