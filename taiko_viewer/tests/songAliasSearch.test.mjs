// Song alias search: the pure matcher / ordering, and the real public list handler with an owned synthetic catalogue
// and alias file. No DB, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createApp, defineEventHandler, getQuery, setHeader, toNodeListener } from 'h3';
import { installGoalSqlRuntime } from './fixtures/goalSqlRuntime.mjs';
import {
  buildSongAliasIndex, findMatchedAlias, matchSongs, normalizeSearchText, orderMatches, songAliases, MATCH_TIER
} from '../server/services/content/songSearch.ts';

const catalog = [
  { id: 1, song_name: '千本桜 Remix', song_name_jp: '千本桜 Remix', type: '博歌乐音乐' },
  { id: 2, song_name: '夏祭り', song_name_jp: '夏祭り', type: '流行音乐' },
  { id: 3, song_name: '千本桜', song_name_jp: '千本桜', type: '博歌乐音乐' },
  { id: 4, song_name: '幽玄ノ乱', song_name_jp: '幽玄ノ乱', type: '南梦宫原创音乐', legacy_ids: [904] },
  { id: 5, song_name: 'Another 千本桜', song_name_jp: undefined, type: '综合音乐' },
  { id: 6, song_name: 'ＡＢＣ', song_name_jp: undefined, type: '游戏音乐' }
];
const aliasRows = [
  { id: 2, aliases: ['千本', 'natsu'] },
  { id: 904, aliases: ['ygnl', '幽玄'] },
  { id: 6, aliases: ['abc-alias'] },
  { id: 'bad', aliases: ['x'] },
  { id: 7, aliases: 'not-a-list' },
  { id: 2, aliases: ['NATSU', 42, '  '] }
];

test('alias index: malformed rows are skipped, duplicates merged, normalised NFKC + lower case', () => {
  const index = buildSongAliasIndex(aliasRows);
  assert.deepEqual([...index.keys()], [2, 904, 6]);
  assert.deepEqual(index.get(2).map((a) => a.alias), ['千本', 'natsu']);
  assert.equal(normalizeSearchText(' ＡＢＣ '), 'abc');
  assert.deepEqual(buildSongAliasIndex(null).size, 0);
  assert.deepEqual(buildSongAliasIndex({}).size, 0);
  // Aliases written under a legacy id belong to the song that replaced it.
  assert.deepEqual(songAliases(catalog[3], index).map((a) => a.alias), ['ygnl', '幽玄']);
  assert.equal(findMatchedAlias(songAliases(catalog[3], index), 'ygn'), 'ygnl');
  assert.equal(findMatchedAlias(songAliases(catalog[3], index), ''), null);
});

test('tiers: exact title / id, title prefix, substring (title, id, category), then alias; stable within a tier', () => {
  const index = buildSongAliasIndex(aliasRows);
  const extra = (song) => [song.type];
  const ranked = orderMatches(matchSongs(catalog, '千本桜', index, extra), 'relevance');
  assert.deepEqual(ranked.map((m) => [m.song.id, m.tier]), [[3, 0], [1, 1], [5, 2]]);
  assert.ok(ranked.every((m) => m.matchedAlias === undefined));

  const withAlias = orderMatches(matchSongs(catalog, '千本', index, extra), 'relevance');
  assert.deepEqual(withAlias.map((m) => [m.song.id, m.tier]), [[1, 1], [3, 1], [5, 2], [2, MATCH_TIER.alias]]);
  assert.equal(withAlias.at(-1).matchedAlias, '千本');

  // id exact, and NFKC: full-width query against ASCII title and the reverse.
  assert.deepEqual(matchSongs(catalog, '4', index).map((m) => [m.song.id, m.tier]), [[4, 0]]);
  assert.deepEqual(matchSongs(catalog, 'abc', index).map((m) => [m.song.id, m.tier]), [[6, 0]]);
  assert.deepEqual(matchSongs(catalog, 'ＮＡＴＳＵ', index).map((m) => [m.song.id, m.matchedAlias]), [[2, 'natsu']]);
  // Category names still match (substring tier), as before.
  assert.deepEqual(matchSongs(catalog, '流行', index, extra).map((m) => [m.song.id, m.tier]), [[2, 2]]);
  // A song matched directly never reports an alias.
  assert.equal(matchSongs(catalog, '夏', index).find((m) => m.song.id === 2).matchedAlias, undefined);
});

test('queries without an alias hit return the same songs as the old substring search', () => {
  const index = buildSongAliasIndex(aliasRows);
  const old = (q) => catalog.filter((song) => [song.song_name, song.song_name_jp, song.type, song.id]
    .some((v) => String(v ?? '').toLocaleLowerCase().includes(q.toLocaleLowerCase()))).map((s) => s.id).sort();
  for (const q of ['千本桜', '乱', '1', 'remix', '音乐', 'zzz']) {
    const ids = matchSongs(catalog, q, index, (s) => [s.type]).map((m) => m.song.id).sort();
    assert.deepEqual(ids, old(q), q);
  }
});

test('direct-first keeps the caller order and puts alias-only matches after it', () => {
  const index = buildSongAliasIndex(aliasRows);
  const reversed = [...catalog].reverse();
  const out = orderMatches(matchSongs(reversed, '千本', index), 'direct-first');
  assert.deepEqual(out.map((m) => m.song.id), [5, 3, 1, 2]);
});

test('GET /api/content/songs list mode matches aliases, reports matchedAlias and fails open without the alias file', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'alias-http-'));
  const songsDir = resolve(root, 'songs');
  const songFile = resolve(songsDir, 'song_data.json');
  const aliasFile = resolve(songsDir, 'song_alias.json');
  const old = { defineEventHandler: globalThis.defineEventHandler, getQuery: globalThis.getQuery, setHeader: globalThis.setHeader };
  let server, uninstall;
  try {
    await mkdir(songsDir);
    await writeFile(songFile, JSON.stringify(catalog.map((song) => ({ ...song, shelf_status: 0, level_4: 9 }))));
    uninstall = installGoalSqlRuntime({ query: () => { throw Error('No SQL allowed'); } },
      { repoRoot: root, songDataPath: songFile, public: {} }, { withRealCatalog: true });
    Object.assign(globalThis, { defineEventHandler, getQuery, setHeader });
    const handler = (await import('../server/api/content/songs.get.ts')).default;
    server = createServer(toNodeListener(createApp().use(handler)));
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = 'http://127.0.0.1:' + server.address().port;
    const ask = async (q) => {
      const response = await fetch(base + '/?view=list&pageSize=12&' + q, { signal: AbortSignal.timeout(5000) });
      assert.equal(response.status, 200);
      return response.json();
    };

    // No alias file yet: titles only, nothing reports an alias.
    let page = await ask('keyword=' + encodeURIComponent('千本') + '&sort=catalog');
    assert.deepEqual(page.songs.map((s) => s.id), [1, 3, 5]);
    assert.ok(page.songs.every((s) => !('matchedAlias' in s)));

    await writeFile(aliasFile, JSON.stringify(aliasRows));
    page = await ask('keyword=' + encodeURIComponent('千本') + '&sort=catalog');
    assert.equal(page.total, 4);
    assert.deepEqual(page.songs.map((s) => [s.id, s.matchedAlias ?? null]), [[1, null], [3, null], [5, null], [2, '千本']]);
    page = await ask('keyword=' + encodeURIComponent('千本桜'));
    assert.deepEqual(page.songs.map((s) => s.id), [3, 1, 5]);
    page = await ask('keyword=ygnl&sort=open-day-desc');
    assert.deepEqual(page.songs.map((s) => [s.id, s.matchedAlias]), [[4, 'ygnl']]);
    // Paging counts alias matches.
    page = await ask('keyword=' + encodeURIComponent('千本') + '&page=2');
    assert.equal(page.total, 4);
    assert.equal(page.songs.length, 0);

    // A broken alias file is not an error: search continues without aliases.
    await writeFile(aliasFile, '{not json');
    await utimes(aliasFile, new Date(), new Date(Date.now() + 2000));
    page = await ask('keyword=ygnl');
    assert.equal(page.total, 0);
    page = await ask('keyword=' + encodeURIComponent('幽玄'));
    assert.deepEqual(page.songs.map((s) => s.id), [4]);
  } finally {
    if (server) { server.closeAllConnections(); await new Promise((r) => server.close(r)); }
    uninstall?.();
    Object.assign(globalThis, old);
    await rm(root, { recursive: true, force: true });
  }
});
