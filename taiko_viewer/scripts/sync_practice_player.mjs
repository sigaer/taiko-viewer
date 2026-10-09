#!/usr/bin/env node
// Download only at operator request. Playback never contacts the upstream.
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { DEFAULT_PLAYER_DIR, MAX_RELEASE_BYTES, MAX_PLAYER_FILE_BYTES, MAX_PLAYER_BYTES, validatePlayerRelease } from '../server/services/practice-player/release.mjs';

async function readRelease(path) {
  if ((await stat(path)).size > MAX_RELEASE_BYTES) throw new Error('Release manifest too large');
  return validatePlayerRelease(JSON.parse(await readFile(path, 'utf8')));
}

async function hashFile(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

export async function syncPlayer({ manifest, directory = DEFAULT_PLAYER_DIR, source = 'https://fanmade.ourtaiko.org', fetcher = fetch }) {
  const release = await readRelease(manifest);
  await mkdir(directory, { recursive: true });
  const lock = join(directory, '.sync-lock');
  await mkdir(lock); // A concurrent sync fails closed; a killed sync requires operator inspection.
  const staging = join(directory, `.staging-${randomUUID()}`);
  const target = join(directory, release.version);
  try {
    const exists = await stat(target).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; });
    if (exists) {
      const stored = await readRelease(join(target, 'release.json'));
      if (stored.version !== release.version || JSON.stringify(Object.entries(stored.files).sort()) !== JSON.stringify(Object.entries(release.files).sort())) throw new Error('Published player version is immutable');
      for (const [name, hash] of Object.entries(release.files)) {
        if (await hashFile(join(target, name)) !== hash) throw new Error(`Local player checksum mismatch: ${name}`);
      }
      return { version: release.version, reused: true };
    }
    await mkdir(staging);
    let total = 0;
    for (const [name, expected] of Object.entries(release.files)) {
      const path = join(staging, name);
      await mkdir(dirname(path), { recursive: true });
      let size = 0;
      for (let attempt = 0; ; attempt++) {
        const signal = AbortSignal.timeout(120_000);
        try {
          const response = await fetcher(new URL(`/player/${release.version}/${name}`, source), { signal, redirect: 'error' });
          if (!response.ok || !response.body) {
            await response.body?.cancel();
            throw new Error(`Player download HTTP ${response.status}`);
          }
          if (Number(response.headers.get('content-length')) > MAX_PLAYER_FILE_BYTES) {
            await response.body.cancel();
            throw new Error('Player file too large');
          }
          size = 0;
          const hash = createHash('sha256');
          const check = new Transform({ transform(chunk, encoding, callback) {
            size += chunk.length;
            if (size > MAX_PLAYER_FILE_BYTES || total + size > MAX_PLAYER_BYTES) return callback(new Error('Player release too large'));
            hash.update(chunk);
            callback(null, chunk);
          } });
          await pipeline(Readable.fromWeb(response.body), check, createWriteStream(path), { signal });
          if (!size || hash.digest('hex') !== expected) throw new Error(`Player checksum mismatch: ${name}`);
          break;
        } catch (error) {
          await rm(path, { force: true });
          if (attempt >= 1) throw error;
        }
      }
      total += size;
    }
    await writeFile(join(staging, 'release.json'), JSON.stringify({ path: release.path, files: release.files }) + '\n');
    await rename(staging, target); // Publish the complete version atomically; never touch older versions.
    return { version: release.version, bytes: total, reused: false };
  } finally {
    await rm(staging, { recursive: true, force: true });
    await rm(lock, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length > 2) throw new Error('Usage: sync_practice_player.mjs [manifest.json] [storage-directory]');
  const manifest = args[0] || fileURLToPath(new URL('../public/practice-player/release.json', import.meta.url));
  console.log(JSON.stringify(await syncPlayer({ manifest, directory: args[1] || process.env.TAIKO_PRACTICE_PLAYER_DIR || DEFAULT_PLAYER_DIR })));
}
