// Real account helpers and endpoints' service functions, real center bridge,
// synthetic filesystem and an allowlisted in-memory DB adapter only.
import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
const viewer = fileURLToPath(new URL('../../', import.meta.url));
const repoRoot = process.env.TAIKO_PUBLICATION_TEST_REPO_ROOT || '/home/sigaer/git/Sakura_bot/taiko';
const identity = 'synthetic';
const key = '__accountScorePublicationFixture';
export async function accountPublicationFixture(task) {
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
    const kinoko = resolve(viewer, 'server/internal/account/kinoko-history.ts');
    const merge = resolve(viewer, 'server/internal/account/kinoko-import.ts');
    await writeFile(entry, `export {readUserdata,writeUserdataWithHistory,withUserdataWriteLock} from ${JSON.stringify(shared)};\nexport {createAccountSong,updateAccountSong,importAccountSongs,setAccountSongLock} from ${JSON.stringify(songs)};\nexport {currentScoreScope,scorePublication,withDomainScoreRead,stageScoreText} from ${JSON.stringify(scope)};\nexport {writeKinokoHistorySnapshots} from ${JSON.stringify(kinoko)};\nexport {mergeKinokoScores} from ${JSON.stringify(merge)};\nexport {writeKinokoHistorySnapshots as legacyKinokoHistory} from 'frozen-kinoko-history';`);
    await build({ entryPoints: [entry], outfile: resolve(root, 'entry.mjs'), bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
      banner: { js: `const Date=class extends globalThis.Date {constructor(...args){super(...(args.length?args:[globalThis.${key}.clock]))}static now(){return new Date().getTime()}};` },
      plugins: [{ name: 'isolated-account-runtime', setup(b) {
        b.onResolve({ filter: /^frozen-kinoko-history$/ }, () => ({ path: 'legacy', namespace: 'legacy-kinoko' }));
        b.onLoad({ filter: /.*/, namespace: 'legacy-kinoko' }, () => ({ contents: execFileSync('git', ['show', 'd337527:taiko_viewer/server/internal/account/kinoko-history.ts'], { cwd: viewer, encoding: 'utf8', maxBuffer: 1024 * 1024 }), loader: 'ts', resolveDir: dirname(kinoko) }));
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
