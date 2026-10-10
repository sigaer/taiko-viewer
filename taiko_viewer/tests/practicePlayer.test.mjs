import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createApp, defineEventHandler, toNodeListener } from 'h3';
import { validatePlayerRelease } from '../server/services/practice-player/release.mjs';
import { gzipSync } from 'node:zlib';
import { syncPlayer, fetchPlayerArchive } from '../scripts/sync_practice_player.mjs';
import { servePracticeAsset } from '../server/utils/practice-player.mjs';
import { createPlayerFetch } from '../public/practice-player/runtime.mjs';

const names = ['Build/Web.loader.js', 'Build/Web.data.unityweb', 'Build/Web.framework.js.unityweb', 'Build/Web.wasm.unityweb', 'index.html', 'StreamingAssets/sub/config.json', 'audio/decode.js', 'audio/vendor/decoder.min.js'];
const fixture = version => ({ path: `/player/${version}/index.html`, files: Object.fromEntries(names.map(name => [name, createHash('sha256').update(`test ${name}`).digest('hex')])) });
const version = '0123456789abcdef';
const fetcher = async url => new Response(`test ${url.pathname.split('/').slice(3).join('/')}`);

test('manifest rejects missing files, path traversal and invalid hashes', () => {
  assert.equal(validatePlayerRelease(fixture(version)).version, version);
  for (const name of ['Build/../secret', 'StreamingAssets//x', 'Build/.secret', 'Build/%2e%2e/x', '/etc/passwd']) {
    const value = fixture(version); value.files[name] = 'a'.repeat(64);
    assert.throws(() => validatePlayerRelease(value));
  }
  const missing = fixture(version); delete missing.files['Build/Web.wasm.unityweb'];
  assert.throws(() => validatePlayerRelease(missing));
  const invalid = fixture(version); invalid.files['index.html'] = 'not-a-hash';
  assert.throws(() => validatePlayerRelease(invalid));
});

test('sync publishes complete releases, reuses verified files and preserves last-good on failure', async () => {
  const root = await mkdtemp('/var/tmp/practice-sync-test-');
  const directory = join(root, 'store'), manifest = join(root, 'candidate.json');
  try {
    await writeFile(manifest, JSON.stringify(fixture(version)));
    const synced = await syncPlayer({ manifest, directory, fetcher });
    assert.equal(synced.reused, false);
    assert.equal(await readFile(join(directory, version, names[5]), 'utf8'), `test ${names[5]}`);
    assert.equal((await syncPlayer({ manifest, directory, fetcher: () => { throw new Error('offline'); } })).reused, true);
    const next = 'fedcba9876543210';
    await writeFile(manifest, JSON.stringify(fixture(next)));
    let attempts = 0;
    await assert.rejects(syncPlayer({ manifest, directory, fetcher: async () => { attempts++; return new Response('corrupt'); } }), /checksum/);
    assert.equal(attempts, 2);
    assert.deepEqual(await readdir(directory), [version]);
    let failures = 0;
    const recovered = await syncPlayer({ manifest, directory, fetcher: async url => {
      if (!failures++) throw new Error('temporary network failure');
      return fetcher(url);
    } });
    assert.equal(recovered.version, next);
    await writeFile(join(directory, next, names[0]), 'corrupted locally');
    await assert.rejects(syncPlayer({ manifest, directory, fetcher }), /checksum/);
    assert.equal(await readFile(join(directory, version, names[0]), 'utf8'), `test ${names[0]}`);
    await mkdir(join(directory, '.sync-lock'));
    await assert.rejects(syncPlayer({ manifest, directory, fetcher }), { code: 'EEXIST' });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('local HTTP serving works offline with cache validators, HEAD and a strict file boundary', async () => {
  const root = await mkdtemp('/var/tmp/practice-http-test-');
  let server;
  try {
    const manifest = join(root, 'candidate.json');
    await writeFile(manifest, JSON.stringify(fixture(version)));
    await syncPlayer({ manifest, directory: root, fetcher });
    const app = createApp();
    app.use(defineEventHandler(event => servePracticeAsset(event, new URL(event.path, 'http://localhost').pathname.slice(1), root)));
    server = createServer(toNodeListener(app));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}/${version}/`;
    const response = await fetch(url + names[0]);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control'), /immutable/);
    assert.match(response.headers.get('content-type'), /javascript/);
    assert.equal(await response.text(), `test ${names[0]}`);
    const cached = await fetch(url + names[0], { headers: { 'if-none-match': response.headers.get('etag') } });
    assert.equal(cached.status, 304);
    const head = await fetch(url + names[1], { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    assert.equal(head.headers.get('content-encoding'), null);
    for (const name of ['release.json', 'Build/unknown.js', 'Build/%252e%252e/secret', '../candidate.json']) {
      assert.equal((await fetch(url + name)).status, 404);
    }
    assert.equal((await fetch(url + names[0], { method: 'POST' })).status, 405);
    await rm(join(root, version, names[0]));
    await symlink(manifest, join(root, version, names[0]));
    assert.equal((await fetch(url + names[0])).status, 404);
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await rm(root, { recursive: true, force: true });
  }
});

test('browser retries transient local resource failures once, respects abort and does not retry unrelated URLs', async () => {
  const origin = 'https://viewer.example';
  let count = 0;
  const controller = new AbortController();
  const recover = createPlayerFetch(async () => new Response('ok', { status: ++count === 1 ? 503 : 200 }), origin, controller.signal);
  assert.equal((await recover('/practice-player/release.json')).status, 200);
  assert.equal(count, 2);
  count = 0;
  const missing = createPlayerFetch(async () => { count++; return new Response('', { status: 404 }); }, origin, controller.signal);
  assert.equal((await missing('/ourtaikoview-runtime/missing')).status, 404);
  assert.equal(count, 1);
  count = 0;
  const broken = createPlayerFetch(async () => { count++; throw new Error('network'); }, origin, controller.signal);
  await assert.rejects(broken('/ourtaikoview-runtime/broken'), /network/);
  assert.equal(count, 2);
  count = 0;
  await assert.rejects(broken('/api/content/songs/1/tja-package'), /network/);
  assert.equal(count, 1);
  count = 0;
  controller.abort();
  await assert.rejects(broken('/practice-player/release.json'));
  assert.equal(count, 1);
});

 test('sync transport preserves publisher gzip bytes rather than transparently decoding', async () => {
  const bytes = gzipSync('Unity compressed fixture');
  const server = createServer((req, res) => { res.writeHead(200, { 'Content-Encoding': 'gzip' }); res.end(bytes); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetchPlayerArchive(new URL(`http://127.0.0.1:${server.address().port}/asset`), { signal: AbortSignal.timeout(5000) });
    const body = Buffer.from(await new Response(response.body).arrayBuffer());
    assert.ok(body.equals(bytes), 'Compressed archive bytes must match');
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
