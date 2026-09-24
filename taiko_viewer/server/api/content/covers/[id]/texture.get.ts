import { createReadStream } from 'node:fs';
import { createError, getRouterParam, sendStream, setHeader } from 'h3';
import { resolveSongCoverAsset } from '~/server/services/content';

// Read only the locally resolved song asset. No arbitrary URL proxy or redirects.
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!Number.isSafeInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Invalid song ID' });
  try {
    const asset = await resolveSongCoverAsset(id);
    if (!asset) throw createError({ statusCode: 404 });
    setHeader(event, 'Content-Type', 'image/png');
    setHeader(event, 'Cache-Control', 'public, max-age=86400');
    setHeader(event, 'X-Content-Type-Options', 'nosniff');
    return sendStream(event, createReadStream(asset.filePath));
  } catch (error: any) {
    if (error?.code === 'ENOENT') throw createError({ statusCode: 404, statusMessage: 'Cover not found' });
    throw error;
  }
});
