// Real account helpers and endpoints' service functions, real center bridge,
// synthetic filesystem and an allowlisted in-memory DB adapter only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const viewer = fileURLToPath(new URL('../', import.meta.url));
const repoRoot = process.env.TAIKO_PUBLICATION_TEST_REPO_ROOT || '/home/sigaer/git/Sakura_bot/taiko';
const identity = 'synthetic';
const key = '__accountScorePublicationFixture';
async function fixture(task) {
  const root = await mkdtemp('/var/tmp/account-score-publication-');
  const priorConfig = globalThis.useRuntimeConfig;
  const priorFetch = globalThis.fetch;
  const state = { binding: { id: 1, user_id: 1, taiko_id: identity, source: 'wahlap' }, locks: new Set(), lockReads: 0, failLockReadAt: 0,
    inserts: 0, failInsertAt: 0, clock: '2026-10-11T09:00:00.123',
    config: { userdataDir: root, repoRoot },
    catalog: [1, 2, 3].map(id => ({ id, song_name: `Synthetic ${id}`, level_4: 10 })) };
  state.db = { async execute(sql, args) {
    if (sql.includes('SELECT b.*')) return [[{ ...state.binding }]];
    if (sql.startsWith('SELECT song_no, level')) {
      if (++state.lockReads === state.failLockReadAt) throw new Error('Synthetic lock lookup failure');
      return [[...state.locks].map(key => ({ song_no: +key.split(':')[0], level: +key.split(':')[1], is_locked: 1 }))];
    }
    if (sql.includes('INSERT INTO web_song_locks')) {
      if (++state.inserts === state.failInsertAt) throw new Error('Synthetic DB write failure');
      state.locks.add(`${args[2]}:${args[3]}`); return [{ affectedRows: 1 }];
    }
    if (sql.startsWith('DELETE FROM web_song_locks')) { state.locks.delete(`${args[2]}:${args[3]}`); return [{ affectedRows: 1 }]; }
    throw new Error('Unapproved synthetic SQL operation');
  } };
  globalThis[key] = state;
  globalThis.useRuntimeConfig = () => state.config;
  globalThis.fetch = async () => { throw new Error('Network forbidden in account publication QA'); };
  try {
    const entry = resolve(root, 'entry.ts');
    const shared = resolve(viewer, 'server/internal/account/shared.ts');
    const songs = resolve(viewer, 'server/utils/account/songs.ts');
    const scope = resolve(viewer, 'server/services/taiko-domain/publication.ts');
    await writeFile(entry, `export {readUserdata,writeUserdataWithHistory,withUserdataWriteLock} from ${JSON.stringify(shared)};\nexport {createAccountSong,updateAccountSong,importAccountSongs} from ${JSON.stringify(songs)};\nexport {currentScoreScope,scorePublication,withDomainScoreRead} from ${JSON.stringify(scope)};`);
    await build({ entryPoints: [entry], outfile: resolve(root, 'entry.mjs'), bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
      banner: { js: `const Date=class extends globalThis.Date {constructor(...args){super(...(args.length?args:[globalThis.${key}.clock]))}static now(){return new Date().getTime()}};` },
      plugins: [{ name: 'isolated-account-runtime', setup(b) {
        b.onResolve({ filter: /account-db$/ }, () => ({ path: 'db', namespace: 'synthetic' }));
        b.onResolve({ filter: /services\/content$/ }, () => ({ path: 'catalog', namespace: 'synthetic' }));
        b.onLoad({ filter: /.*/, namespace: 'synthetic' }, args => ({ contents: args.path === 'db'
          ? `export const ensureAccountSchema=async()=>{};export const getAccountDb=()=>globalThis.${key}.db;`
          : `export const getSongCatalog=async()=>globalThis.${key}.catalog;export const getRatingEntries=async()=>[1,2,3].map(id=>({id,level:4,combo:1000}));` }));
        b.onResolve({ filter: /^~\// }, args => ({ path: resolve(viewer, args.path.slice(2)) + '.ts' }));
        b.onResolve({ filter: /^[^./~]/ }, args => args.path.startsWith('node:') ? undefined : { path: import.meta.resolve(args.path), external: true });
      } }] });
    const service = await import(pathToFileURL(resolve(root, 'entry.mjs')).href);
    const initial = { profile: { userid: identity }, songs: [{ song_no: 1, level: 4, high_score: 800000, stage_cnt: 1 }, { song_no: 2, level: 4, high_score: 700000, stage_cnt: 1 }], achievement: {}, dojo: {} };
    await service.writeUserdataWithHistory(identity, initial, 'wahlap');
    await task(service, state, root);
  } finally {
    globalThis.useRuntimeConfig = priorConfig;
    globalThis.fetch = priorFetch;
    delete globalThis[key];
    await rm(root, { recursive: true, force: true });
  }
}
const payload = songNo => ({ songNo, level: 4, values: { high_score: 900000 } });
async function head(service) { return service.withDomainScoreRead(identity, async () => ({ ...service.scorePublication(identity) })); }

test('actual shared module composes through its import cycle and keeps repeated-clock observations', async () => fixture(async (service, state, root) => {
  await service.writeUserdataWithHistory(identity, { songs: [] }, 'web-account');
  await service.writeUserdataWithHistory(identity, { songs: [] }, 'web-account');
  const manifest = await head(service);
  assert.equal(manifest.sequence, 3);
  assert.equal(Object.keys(manifest.files).filter(key => key.startsWith('history/')).length, 3);
  const names = (await readdir(resolve(root, identity))).filter(name => name.startsWith('data_')).sort();
  const last = JSON.parse(await readFile(resolve(root, identity, names.at(-1)), 'utf8'));
  assert.equal(last._meta.full, true);
  assert.equal(last._meta.ts, '2026-10-11 09:00:00');
  assert.equal(last._meta.writer_source, 'web-account');
}));

test('actual concurrent account edits preserve both changed charts and publish full histories', async () => fixture(async service => {
  await Promise.all([service.updateAccountSong(1, payload(1)), service.updateAccountSong(1, payload(2))]);
  const current = await service.readUserdata(identity);
  assert.equal(current.songs.every(row => row.high_score === 900000), true);
  assert.equal((await head(service)).sequence, 3);
}));

test('actual new chart creation preserves its SQL lock and commits its score on success', async () => fixture(async (service, state) => {
  const row = await service.createAccountSong(1, payload(3));
  assert.equal(row.songNo, 3);
  assert.equal(state.locks.has('3:4'), true);
  assert.equal((await service.readUserdata(identity)).songs.length, 3);
  assert.equal((await head(service)).sequence, 2);
}));

test('post-staging business failure compensates a new chart lock without publishing the score', async () => fixture(async (service, state) => {
  const before = await head(service);
  state.failLockReadAt = 2;
  await assert.rejects(service.createAccountSong(1, payload(3)), /Synthetic lock lookup failure/);
  assert.equal(state.locks.size, 0);
  assert.equal((await head(service)).commitId, before.commitId);
  assert.equal((await service.readUserdata(identity)).songs.length, 2);
}));

test('post-staging failure preserves an already existing lock', async () => fixture(async (service, state) => {
  state.locks.add('3:4'); state.failLockReadAt = 2;
  await assert.rejects(service.createAccountSong(1, payload(3)), /Synthetic lock lookup failure/);
  assert.equal(state.locks.has('3:4'), true);
  assert.equal((await head(service)).sequence, 1);
}));

test('partial SQL failure in actual bulk import rolls back new locks and the whole score batch', async () => fixture(async (service, state) => {
  state.locks.add('1:4'); state.failInsertAt = 3;
  await assert.rejects(service.importAccountSongs(1, [1, 2, 3].map(song_no => ({ song_no, level: 4, high_score: 999999 }))), /Synthetic DB write failure/);
  assert.deepEqual([...state.locks], ['1:4']);
  assert.equal((await head(service)).sequence, 1);
  assert.equal((await service.readUserdata(identity)).songs[0].high_score, 800000);
}));

test('actual new chart creation verifies a lost commit response before preserving its SQL lock', async () => fixture(async (service, state) => {
  const row = await service.withUserdataWriteLock(identity, async () => {
    const result = await service.createAccountSong(1, payload(3));
    const lease = service.currentScoreScope(identity).lease;
    const publish = lease.publish;
    lease.publish = async input => { await publish(input); throw new Error('Synthetic lost response'); };
    return result;
  });
  assert.equal(row.songNo, 3);
  assert.equal(state.locks.has('3:4'), true);
  assert.equal((await head(service)).sequence, 2);
}));
