import { open } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { resolve } from 'node:path';
import { getSongCatalog } from './songs';
import { getContentRuntimePaths } from './runtime';

const folders = ['Kantan', 'Futsuu', 'Muzukashii', 'Oni', 'InnerOni'];
export async function openChartImage(songId: number, difficulty: number, side = 'single') {
  if (!Number.isSafeInteger(songId) || songId <= 0 || !Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5
    || !['single', 'p1', 'p2'].includes(side)) throw createError({ statusCode: 400, statusMessage: 'Invalid chart image request' });
  const song = (await getSongCatalog()).find(song => Number(song.id) === songId || song.legacy_ids?.includes(songId));
  if (!song) throw createError({ statusCode: 404, statusMessage: 'Song not found' });
  const filename = `${song.id}${side === 'single' ? '' : '-' + side}.png`;
  const path = resolve(getContentRuntimePaths().repoRoot, 'assets/fumens', folders[difficulty - 1]!, filename);
  let file;
  try {
    file = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | fsConstants.O_NONBLOCK);
    const stat = await file.stat();
    if (!stat.isFile() || stat.size < 8 || stat.size > 16 * 1024 * 1024) throw new Error('Invalid image file');
    return { file, size: stat.size, modified: stat.mtime, etag: `"${song.id}-${difficulty}-${side}-${stat.mtimeMs}-${stat.size}"` };
  } catch {
    await file?.close();
    throw createError({ statusCode: 404, statusMessage: 'Chart image unavailable' });
  }
}
