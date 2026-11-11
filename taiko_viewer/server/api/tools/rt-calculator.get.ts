import { getRtCalculatorPayload } from '../../services/content/rtCalculator';

export default defineEventHandler(async event => {
  const raw = getQuery(event).songId;
  const songId = typeof raw === 'string' && /^\d{1,9}$/.test(raw) ? Number(raw) : 0;
  if (!Number.isSafeInteger(songId) || songId <= 0) throw createError({ statusCode: 400, statusMessage: '歌曲 ID 无效' });
  const payload = await getRtCalculatorPayload(songId);
  setHeader(event, 'Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  return payload;
});
