// Constants range filter: the shared contract (utils/rework/constantQuery.ts), the search panel query parser, and
// the real v2-constants service with a synthetic catalogue, alias file and cached source (no network, no DB).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import {
  CONSTANT_DIMENSIONS, constantRangeFromQuery, constantRangeQuery, constantRangeText, constantsLocation,
  constantQueryVocabulary, filterByConstantRange, normalizeConstantRange, parseConstantQuery, parseRangeBound, sameConstantRange
} from '../utils/rework/constantQuery.ts';

const locales = Object.fromEntries(await Promise.all(['zh', 'ja'].map(async (code) =>
  [code, JSON.parse(await readFile(new URL(`../locales/${code}.json`, import.meta.url), 'utf8'))])));
const translator = (messages) => (key) => key.split('.').reduce((o, k) => o?.[k], messages);

test('bounds: numbers only, clamped to 0–20; anything else is ignored', () => {
  assert.equal(parseRangeBound('10.5'), 10.5);
  assert.equal(parseRangeBound(' １０．５ '), 10.5);
  assert.equal(parseRangeBound('.5'), 0.5);
  assert.equal(parseRangeBound('25'), 20);
  assert.equal(parseRangeBound('-3'), 0);
  assert.equal(parseRangeBound(['11', '12']), 11);
  assert.equal(parseRangeBound(7), 7);
  for (const bad of ['', 'abc', '1e3', 'NaN', 'Infinity', '1,5', null, undefined, {}, Number.NaN]) assert.equal(parseRangeBound(bad), null, String(bad));
});

test('range: needs a bound, unknown dimensions fall back to the main constant, reversed bounds swap', () => {
  assert.equal(normalizeConstantRange({}), null);
  assert.equal(normalizeConstantRange({ dimension: 'stamina' }), null);
  assert.equal(normalizeConstantRange({ dimension: 'stamina', min: 'x', max: '' }), null);
  assert.deepEqual(normalizeConstantRange({ min: '10' }), { dimension: 'mainConstant', min: 10, max: null });
  assert.deepEqual(normalizeConstantRange({ dimension: 'totalNotes', max: '8' }), { dimension: 'mainConstant', min: null, max: 8 });
  assert.deepEqual(normalizeConstantRange({ dimension: 'burst', min: '12', max: '11' }), { dimension: 'burst', min: 11, max: 12 });
  for (const dimension of CONSTANT_DIMENSIONS) assert.equal(normalizeConstantRange({ dimension, min: 1 }).dimension, dimension);
});

test('URL query round trip: canonical keys, default dimension omitted', () => {
  assert.deepEqual(constantRangeQuery(null), {});
  assert.deepEqual(constantRangeQuery({ dimension: 'mainConstant', min: 10, max: 10.5 }), { min: '10', max: '10.5' });
  assert.deepEqual(constantRangeQuery({ dimension: 'handspeed', min: 11, max: null }), { dimension: 'handspeed', min: '11' });
  const range = constantRangeFromQuery({ dimension: 'rhythm', min: '3', max: '9.25', other: 'x' });
  assert.deepEqual(range, { dimension: 'rhythm', min: 3, max: 9.25 });
  assert.deepEqual(constantRangeFromQuery(constantRangeQuery(range)), range);
  assert.ok(sameConstantRange(range, { ...range }));
  assert.ok(!sameConstantRange(range, null));
  assert.deepEqual(constantsLocation(range), { path: '/songs/constants', query: { dimension: 'rhythm', min: '3', max: '9.25' } });
});

test('filter: inclusive bounds on the chosen dimension; rows without a finite value are excluded', () => {
  const rows = [
    { id: 1, mainConstant: 10, stamina: 5 },
    { id: 2, mainConstant: 10.5, stamina: 8 },
    { id: 3, mainConstant: 11, stamina: Number.NaN },
    { id: 4, mainConstant: 9.99 },
    { id: 5, mainConstant: '10.2' }
  ];
  assert.equal(filterByConstantRange(rows, null).length, 5);
  assert.deepEqual(filterByConstantRange(rows, { dimension: 'mainConstant', min: 10, max: 10.5 }).map((r) => r.id), [1, 2]);
  assert.deepEqual(filterByConstantRange(rows, { dimension: 'mainConstant', min: 10.5, max: null }).map((r) => r.id), [2, 3]);
  assert.deepEqual(filterByConstantRange(rows, { dimension: 'stamina', min: null, max: 8 }).map((r) => r.id), [1, 2]);
});

test('search panel parser: range operators or a dimension word, Chinese and Japanese labels', () => {
  const cases = {
    '定数 10-10.5': ['mainConstant', 10, 10.5],
    '10.0~10.5': ['mainConstant', 10, 10.5],
    '10.5〜10': ['mainConstant', 10, 10.5],
    '１０～１１': ['mainConstant', 10, 11],
    '手速 11+': ['handspeed', 11, null],
    '爆发>=12': ['burst', 12, null],
    '爆發 ≥ 12': ['burst', 12, null],
    '瞬発12以上': ['burst', 12, null],
    '体力 <8': ['stamina', null, 8],
    '体力 ≦ 8': ['stamina', null, 8],
    '複合 9以下': ['complex', null, 9],
    'リズム 7-9': ['rhythm', 7, 9],
    '节奏：7到9': ['rhythm', 7, 9],
    '99% 定数 > 11': ['subConstant2', 11, null],
    '75%定数 9-10': ['subConstant1', 9, 10],
    '95% 定数 9-10': ['mainConstant', 9, 10],
    '11+': ['mainConstant', 11, null],
    '<= 3.5': ['mainConstant', null, 3.5],
    'Stamina 10-12': ['stamina', 10, 12]
  };
  for (const code of ['zh', 'ja']) {
    const vocabulary = constantQueryVocabulary(translator(locales[code]));
    for (const [text, [dimension, min, max]] of Object.entries(cases)) {
      assert.deepEqual(parseConstantQuery(text, vocabulary), { dimension, min, max }, `${code}: ${text}`);
    }
    // Ordinary song queries are never ranges.
    for (const text of ['', '2000', '10', '10.5', '定数', '定数 10', '手速', '千本桜', 'Synthetic 1-2 remix', '2000-2010', '1-2-3', '体力 abc', '>', '10-', '-10', '+11', '以上', '10到']) {
      assert.equal(parseConstantQuery(text, vocabulary), null, `${code}: ${text}`);
    }
  }
  // Without the locale words: English words and ASCII operators only.
  assert.deepEqual(parseConstantQuery('handspeed 11+'), { dimension: 'handspeed', min: 11, max: null });
  assert.deepEqual(parseConstantQuery('10-10.5'), { dimension: 'mainConstant', min: 10, max: 10.5 });
  assert.equal(parseConstantQuery('手速 11+'), null);
  // Vocabulary words are escaped, not regular expressions.
  const literal = { words: {}, to: ['a+'], atLeast: [], atMost: [] };
  assert.equal(parseConstantQuery('10aa11', literal), null);
  assert.deepEqual(parseConstantQuery('10a+11', literal), { dimension: 'mainConstant', min: 10, max: 11 });
});

test('range text keys and parameters', () => {
  assert.deepEqual(constantRangeText({ dimension: 'handspeed', min: 11, max: null }),
    { key: 'rework.constantRange.atLeast', columnKey: 'page.songs.v2Constants.columns.handspeed', min: '11', max: '' });
  assert.equal(constantRangeText({ dimension: 'mainConstant', min: 10, max: 10.5 }).key, 'rework.constantRange.between');
  assert.equal(constantRangeText({ dimension: 'stamina', min: null, max: 8 }).key, 'rework.constantRange.atMost');
});

test('v2-constants service: dimension / min / max filter, paging totals, alias keyword', async () => {
  const viewer = fileURLToPath(new URL('..', import.meta.url));
  const out = await mkdtemp(resolve(tmpdir(), 'taiko-constants-range-'));
  const catalog = [1, 2, 3].map((id) => ({ id, song_name: 'Range Song ' + id, type: 'test', shelf_status: 0, level_4: 8, max_combo: ['-', '-', '-', 100, '-'] }));
  catalog.push({ id: 4, song_name: 'Legacy Owner', type: 'test', shelf_status: 0, legacy_ids: [904] });
  const chart = (main, handspeed) => ({ totalNotes: 100, sub_constant_1: main - 1, main_constant: main, sub_constant_2: main + 1,
    stamina: 1, handspeed, burst: 2, complex: 3, rhythm: 4 });
  const payload = { 1: { oni: chart(10, 12), hard: chart(6, 5) }, 2: { oni: chart(10.5, 11) }, 3: { oni: chart(11.2, 9) }, 4: { oni: chart(9, 13) } };
  const globals = { useRuntimeConfig: globalThis.useRuntimeConfig, $fetch: globalThis.$fetch, createError: globalThis.createError };
  try {
    await build({ entryPoints: [`${viewer}/server/services/content/v2Constants.ts`], outfile: `${out}/service.mjs`,
      bundle: true, platform: 'node', format: 'esm', alias: { '~': viewer }, logLevel: 'silent',
      plugins: [{ name: 'catalog-fixture', setup(builder) {
        builder.onResolve({ filter: /^\.\/songs$/ }, () => ({ path: 'catalog', namespace: 'fixture' }));
        builder.onResolve({ filter: /^\.\/catalogConstants$/ }, () => ({ path: 'catalogConstants', namespace: 'fixture' }));
        builder.onLoad({ filter: /^catalog$/, namespace: 'fixture' }, () => ({
          contents: `const catalog = ${JSON.stringify(catalog)}; export const getSongCatalog = async () => catalog; export const resolveCatalogSongId = async id => id;`, loader: 'js'
        }));
        builder.onLoad({ filter: /^catalogConstants$/, namespace: 'fixture' }, () => ({ contents: 'export const getCatalogConstants = async () => null;', loader: 'js' }));
      } }] });
    await mkdir(`${out}/cached`);
    await mkdir(`${out}/songs`);
    await writeFile(`${out}/songs/song_alias.json`, JSON.stringify([{ id: 2, aliases: ['Nickname Two'] }, { id: 904, aliases: ['oldname'] }]));
    const fetchedAt = new Date().toISOString();
    await writeFile(`${out}/cached/v2-constants.json`, JSON.stringify({ version: 1, savedAt: fetchedAt,
      data: { payload, fetchedAt, expiresAt: Date.now() + 3600000 } }));
    globalThis.useRuntimeConfig = () => ({ repoRoot: out, public: {}, viewerCacheDir: `${out}/cached`, v2ConstantsUrl: 'https://source.invalid/constants' });
    globalThis.$fetch = async () => { throw new Error('no network in tests'); };
    globalThis.createError = (value) => Object.assign(new Error(value.statusMessage), value);
    const service = await import(pathToFileURL(`${out}/service.mjs`).href);
    const ids = (result) => result.items.map((row) => `${row.id}:${row.difficulty}`);

    const all = await service.getV2ConstantsPayload({ difficulty: 'oni', sortBy: 'id' });
    assert.ok(all.total >= 4);
    assert.equal(all.range, null);

    const main = await service.getV2ConstantsPayload({ min: '10', max: '10.5', sortBy: 'id' });
    assert.deepEqual(ids(main), ['1:oni', '2:oni']);
    assert.equal(main.total, 2);
    assert.deepEqual(main.range, { dimension: 'mainConstant', min: 10, max: 10.5 });

    const hand = await service.getV2ConstantsPayload({ dimension: 'handspeed', min: '11', sortBy: 'id' });
    assert.deepEqual(ids(hand), ['1:oni', '2:oni', '4:oni']);
    const swapped = await service.getV2ConstantsPayload({ dimension: 'handspeed', min: '12', max: '11', sortBy: 'id' });
    assert.deepEqual(ids(swapped), ['1:oni', '2:oni']);
    const atMost = await service.getV2ConstantsPayload({ dimension: 'stamina', max: '0.5' });
    assert.equal(atMost.total, 0);

    // Invalid values are ignored, never an error; an invalid dimension with a bound uses the main constant.
    const ignored = await service.getV2ConstantsPayload({ dimension: 'bogus', min: 'abc', max: '' , sortBy: 'id' });
    assert.equal(ignored.total, all.total + 1);
    assert.equal(ignored.range, null);
    const fallback = await service.getV2ConstantsPayload({ dimension: 'bogus', min: '11', sortBy: 'id' });
    assert.deepEqual(ids(fallback), ['3:oni']);
    assert.equal(fallback.range.dimension, 'mainConstant');

    // Paging and totals reflect the filter.
    const paged = await service.getV2ConstantsPayload({ dimension: 'handspeed', min: '5', pageSize: '25', page: '2' });
    assert.equal(paged.total, 5);
    assert.equal(paged.items.length, 0);

    // Keyword matches aliases (also ones filed under a legacy id) and says which alias matched; combines with the range.
    const alias = await service.getV2ConstantsPayload({ keyword: 'nickname' });
    assert.deepEqual(alias.items.map((row) => [row.id, row.matchedAlias]), [[2, 'Nickname Two']]);
    const legacy = await service.getV2ConstantsPayload({ keyword: 'oldname' });
    assert.deepEqual(legacy.items.map((row) => [row.id, row.matchedAlias]), [[4, 'oldname']]);
    const direct = await service.getV2ConstantsPayload({ keyword: 'range song 2' });
    assert.deepEqual(direct.items.map((row) => [row.id, row.matchedAlias]), [[2, undefined]]);
    const combined = await service.getV2ConstantsPayload({ keyword: 'nickname', min: '11' });
    assert.equal(combined.total, 0);
  } finally {
    Object.assign(globalThis, globals);
    await rm(out, { recursive: true, force: true });
  }
});
