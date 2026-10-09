import { createReadStream } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { createError, getHeader, sendStream, setHeaders, setResponseStatus } from 'h3';
import { DEFAULT_PLAYER_DIR, MAX_RELEASE_BYTES, validatePlayerRelease, validPlayerFile } from '../services/practice-player/release.mjs';

export async function servePracticeAsset(event, asset, directory = process.env.TAIKO_PRACTICE_PLAYER_DIR || DEFAULT_PLAYER_DIR) {
  const match = /^([a-f0-9]{16})\/(.+)$/.exec(asset || '');
  if (!match || !validPlayerFile(match[2])) throw createError({ statusCode: 404, statusMessage: 'Player asset not found' });
  if (!['GET', 'HEAD'].includes(event.method)) throw createError({ statusCode: 405, statusMessage: 'Method not allowed' });
  let path, metadata, release;
  try {
    const root = await realpath(directory);
    const versionRoot = await realpath(join(root, match[1]));
    if (versionRoot !== join(root, match[1])) throw new Error('Unexpected player directory');
    const manifest = join(versionRoot, 'release.json');
    if ((await stat(manifest)).size > MAX_RELEASE_BYTES) throw new Error('Invalid release size');
    release = validatePlayerRelease(JSON.parse(await readFile(manifest, 'utf8')));
    if (release.version !== match[1] || !Object.hasOwn(release.files, match[2])) throw new Error('Unknown player asset');
    path = await realpath(join(versionRoot, match[2]));
    if (!path.startsWith(versionRoot + sep)) throw new Error('Unexpected player path');
    metadata = await stat(path);
    if (!metadata.isFile()) throw new Error('Not a player file');
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Player asset unavailable' });
  }
  const etag = `"${release.files[match[2]]}"`;
  // .unityweb uses Unity's built-in decompressor: do not invent Content-Encoding.
  const type = path.endsWith('.js') ? 'application/javascript' : path.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream';
  setHeaders(event, { 'Content-Type': type, 'Cache-Control': 'public, max-age=31536000, immutable', 'ETag': etag, 'X-Content-Type-Options': 'nosniff' });
  if (getHeader(event, 'if-none-match')?.split(',').map(value => value.trim().replace(/^W\//, '')).some(value => value === etag || value === '*')) {
    setResponseStatus(event, 304);
    return '';
  }
  setHeaders(event, { 'Content-Length': String(metadata.size) });
  if (event.method === 'HEAD') return '';
  return sendStream(event, createReadStream(path));
}
