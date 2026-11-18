// Stage 2 slice B: the signed-in player's score pages (helpers, contracts the pages rely on, source rules).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { activeDestination } from '../utils/rework/navigation.ts';
import {
  accountReadKind, errorStatus, errorStatusMessage, SCORE_ROW_WINDOW, rowWindowCount, rowWindow, rowWindowRange, pageCount,
  scoreDate, scoreDateTime, scoreTitles, starOf, fitPercent, deviationText, fitPosition, FIT_SCALE, progressShare, PLAY_TABS
} from '../utils/rework/scores.ts';
import { crownFromCounts } from '../utils/ds/crown.ts';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
const locale = async (lang) => JSON.parse(await read(`locales/${lang}.json`));
const get = (obj, key) => key.split('.').reduce((o, k) => o?.[k], obj);

test('a failed account read is presented by what the server said', () => {
  assert.equal(accountReadKind(400, '请先绑定鼓众 ID'), 'binding');
  assert.equal(accountReadKind('400', '请先绑定鼓众 ID'), 'binding');
  assert.equal(accountReadKind(400, '维度不支持，可用：大歌、节奏'), 'failed', 'an invalid parameter is not a binding prompt');
  assert.equal(accountReadKind(404, '未找到本地成绩数据，请先在「多端同步」更新数据'), 'noData');
  for (const status of [0, 401, 409, 500, 502, 503, undefined]) assert.equal(accountReadKind(status, '请先绑定鼓众 ID'), 'failed');
  assert.equal(errorStatus({ statusCode: 404 }), 404);
  assert.equal(errorStatus({ response: { status: 503 } }), 503);
  assert.equal(errorStatus(null), 0);
  assert.equal(errorStatusMessage({ data: { statusMessage: '请先绑定鼓众 ID' } }), '请先绑定鼓众 ID');
  assert.equal(errorStatusMessage({ statusMessage: 'x' }), 'x');
});

test('a score page mounts at most one window of rows; windows and ranges', () => {
  assert.ok(SCORE_ROW_WINDOW <= 60, 'V1.3 budget: ≤ 60 mounted rows');
  const rows = Array.from({ length: 100 }, (_, i) => i);
  assert.equal(rowWindowCount(0), 1);
  assert.equal(rowWindowCount(25), 1);
  assert.equal(rowWindowCount(50), 1);
  assert.equal(rowWindowCount(51), 2);
  assert.equal(rowWindowCount(100), 2);
  assert.deepEqual(rowWindow(rows, 0).length, 50);
  assert.deepEqual(rowWindow(rows, 1)[0], 50);
  assert.deepEqual(rowWindow(rows, 7)[0], 50, 'clamped to the last window');
  assert.deepEqual(rowWindow(rows, -3)[0], 0);
  for (const size of [25, 50, 100]) for (let i = 0; i < rowWindowCount(size); i++) assert.ok(rowWindow(rows.slice(0, size), i).length <= 60);
  assert.deepEqual(rowWindowRange(1, 100, 100), { from: 151, to: 200 }, 'second window of server page 2 at 100 per page');
  assert.deepEqual(rowWindowRange(0, 30, 100), { from: 101, to: 130 });
  assert.equal(pageCount(130, 25), 6);
  assert.equal(pageCount(0, 25), 1);
  assert.equal(pageCount(130, 100), 2);
});

test('score values: dates, titles by page language, stars', () => {
  assert.equal(scoreDate('2026-11-10 21:04:00'), '2026-11-10');
  assert.equal(scoreDate(''), '—');
  assert.equal(scoreDate('garbage'), '—');
  assert.equal(scoreDateTime('2026-11-10 21:04:00'), '2026-11-10 21:04');
  assert.equal(scoreDateTime('2026-11-10T21:04:00Z'), '2026-11-10 21:04');
  assert.equal(scoreDateTime('2026-11-10'), '2026-11-10');
  assert.equal(scoreDateTime(null), '—');
  assert.deepEqual(scoreTitles({ title: '千本樱', titleJp: '千本桜' }, 'zh'), { title: '千本樱', titleLang: 'zh-CN', subtitle: '千本桜', subtitleLang: 'ja' });
  assert.deepEqual(scoreTitles({ title: '千本樱', titleJp: '千本桜' }, 'ja'), { title: '千本桜', titleLang: 'ja', subtitle: '千本樱', subtitleLang: 'zh-CN' });
  assert.deepEqual(scoreTitles({ title: 'Custom', titleJp: '' }, 'ja'), { title: 'Custom', titleLang: 'zh-CN', subtitle: null, subtitleLang: 'ja' }, 'no Japanese name: the list title');
  assert.deepEqual(scoreTitles({ title: 'Same', titleJp: 'Same' }, 'zh').subtitle, null);
  assert.equal(starOf(''), null);
  assert.equal(starOf('9'), 9);
  assert.equal(starOf(0), null);
  assert.equal(starOf(undefined), null);
});

test('P1: the score list derives crowns from the real counts and shows their names', async () => {
  assert.equal(crownFromCounts({ clearCnt: 3, fullComboCnt: 1, dondafulComboCnt: 1 }), 'dondaful');
  assert.equal(crownFromCounts({ clearCnt: 0, fullComboCnt: 0, dondafulComboCnt: 0 }), 'played');
  const list = await read('components/rework/scores/List.vue');
  assert.match(list, /<DsCrown class="is-wide" :state="crownFromCounts\(row\)" size="table" text="full" \/>/, 'full name where the table is wide');
  assert.match(list, /<DsCrown class="is-narrow" :state="crownFromCounts\(row\)" size="sm" text="short" \/>/, 'short name on narrow screens');
  assert.match(list, /<DsRank class="is-wide" :value="row.bestScoreRank" variant="table" \/>/, 'rank name in the table');
  assert.match(list, /<DsRank class="is-narrow" :value="row.bestScoreRank" variant="compact" \/>/, 'rank name in phone rows');
  assert.match(list, /<DsJudgeBar class="is-wide"/);
  assert.match(list, /@media \(max-width: 374px\) \{\s*\.c-judge \.is-narrow \{\s*display: none;/, 'judge triple hidden below 375 px');
  assert.doesNotMatch(list, /crownFromCounts\(\{|clearCnt\s*>/, 'no second crown conversion');
});

test('recommendation reasons: fit from the API deviation, the strict band, progress', () => {
  assert.equal(fitPercent(0.05), 105);
  assert.equal(fitPercent(-0.1), 90);
  assert.equal(fitPercent(-0.0196), 98);
  assert.equal(fitPercent('x'), null);
  assert.equal(deviationText(0.05), '+5.0%');
  assert.equal(deviationText(-0.032), '−3.2%');
  assert.equal(deviationText(0), '±0.0%');
  assert.equal(deviationText(null), '—');
  assert.equal(fitPosition(FIT_SCALE.min), 0);
  assert.equal(fitPosition(FIT_SCALE.max), 100);
  assert.equal(fitPosition(200), 100, 'clamped');
  assert.equal(fitPosition(100), 50);
  assert.equal(fitPosition(null), null);
  assert.equal(progressShare(150), 100);
  assert.equal(progressShare(-3), 0);
  assert.equal(progressShare(37.46), 37.5);
});

test('the 成绩 tabs list every page of the group at its current address', async () => {
  assert.deepEqual(PLAY_TABS.map((t) => t.to), ['/account/songs', '/tools/b30', '/tools/trend', '/tools/progress', '/tools/recommend']);
  for (const tab of PLAY_TABS) {
    assert.equal(activeDestination(tab.to), 'play', tab.to);
    assert.equal(activeDestination('/ja' + tab.to), 'play');
  }
  assert.equal(activeDestination('/tools/word-cloud'), 'tools', 'word cloud stays with the tools (slice F)');
  const shell = await read('components/rework/Shell.vue');
  assert.match(shell, /play: \[\.\.\.PLAY_TABS\]/);
  for (const lang of ['zh', 'ja']) {
    const m = await locale(lang);
    for (const tab of PLAY_TABS) assert.equal(typeof m.rework[tab.key], 'string', `${lang} rework.${tab.key}`);
    assert.equal(m.rework.b30, get(m, 'tools.b30'), 'tab name = page title');
    assert.equal(m.rework.trend, get(m, 'tools.trend'));
    assert.equal(m.rework.progress, get(m, 'tools.progress'));
    assert.equal(m.rework.recommend, get(m, 'tools.recommend'));
    assert.equal(m.rework.scores, m.rework.scoreList.title);
  }
});

test('slice pages: own header, Element Plus mapping, ReworkGate instead of AccountToolGate', async () => {
  for (const page of ['pages/account/songs.vue', 'pages/my/index.vue', 'pages/tools/b30.vue', 'pages/tools/trend.vue', 'pages/tools/progress.vue', 'pages/tools/recommend.vue']) {
    const source = await read(page);
    assert.match(source, /hidePageHeader: true/, page);
    assert.match(source, /reworkElementPlus: true/, page);
    assert.doesNotMatch(source, /AccountToolGate|locale(\.value)? === ["']ja["']/, page + ': no old gate, no inline bilingual copy');
  }
  for (const page of ['pages/account/songs.vue', 'pages/tools/b30.vue', 'pages/tools/trend.vue', 'pages/tools/progress.vue', 'pages/tools/recommend.vue']) {
    assert.match(await read(page), /contentLayout: "wide"/, page + ': one content width for the group');
  }
  const hub = await read('pages/my/index.vue');
  for (const [path, key] of [['/account/songs', 'rework.scoreList.title'], ['/my/weekly', 'weekly.title'], ['/tools/recommend', 'tools.recommend'], ['/tools/b30', 'tools.b30'], ['/tools/trend', 'tools.trend'], ['/tools/progress', 'tools.progress'], ['/my/growth', 'passport.title']]) {
    assert.match(hub, new RegExp(`path: "${path}", label: "${key.replace('.', '\.')}"`), 'hub entry name = page title: ' + path);
  }
  for (const page of ['pages/tools/b30.vue', 'pages/tools/trend.vue', 'pages/tools/progress.vue', 'pages/tools/recommend.vue']) {
    assert.match(await read(page), /<ReworkGate :need="accountUser \? null : 'login'">/, page);
  }
  assert.match(await read('pages/tools/word-cloud.vue'), /AccountToolGate/, 'word cloud (slice F) keeps the old gate');
  for (const growth of ['pages/my/growth.vue', 'pages/my/weekly.vue']) assert.doesNotMatch(await read(growth), /reworkElementPlus/, growth + ' belongs to slice C');
});

test('server images are kept: the same endpoints and parameters', async () => {
  const b30 = await read('pages/tools/b30.vue');
  assert.match(b30, /generate\("\/api\/account\/charts\/b30"\)/);
  assert.match(b30, /n: n\.value, dim: dim\.value \|\| undefined, r: dynamicOrigin\.value \? "1" : undefined/);
  const trend = await read('pages/tools/trend.vue');
  assert.match(trend, /loadChart\("\/api\/account\/charts\/trend", \{\s*n: n\.value,\s*maxDays: maxDays\.value,\s*dim: dim\.value \|\| undefined,\s*bar: barMode\.value \? "1" : undefined,\s*all: showAll\.value \? "1" : undefined/);
  const progress = await read('pages/tools/progress.vue');
  assert.match(progress, /generate\("\/api\/account\/progress\/image"\)/);
  const recommend = await read('pages/tools/recommend.vue');
  assert.match(recommend, /"\/api\/account\/recommendation\/target"/);
  assert.match(recommend, /item\.canCreateGoal \? \{ recommendation: item\.recommendationToken \} : \{\}/, 'goal token only where the API allows a goal');
  assert.match(recommend, /<RecommendationGoalAction :token="item\.recommendationToken"/);
});

test('every slice B locale key exists in both languages with the same shape', async () => {
  const [zh, ja] = [await locale('zh'), await locale('ja')];
  const paths = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? paths(v, `${p}${k}.`) : [`${p}${k}`]));
  for (const block of ['scoreList', 'ratingDims', 'imageTool', 'b30Tool', 'trendTool', 'progressTool', 'recommendTool']) {
    assert.deepEqual(paths(zh.rework[block]).sort(), paths(ja.rework[block]).sort(), block);
    for (const key of paths(zh.rework[block])) {
      assert.ok(String(get(zh.rework[block], key)).trim(), `zh ${block}.${key}`);
      assert.ok(String(get(ja.rework[block], key)).trim(), `ja ${block}.${key}`);
    }
  }
  const sources = await Promise.all(['pages/account/songs.vue', 'pages/tools/b30.vue', 'pages/tools/trend.vue', 'pages/tools/progress.vue', 'pages/tools/recommend.vue', 'components/rework/scores/List.vue', 'components/rework/scores/ImageResult.vue', 'components/rework/scores/ReadState.vue', 'components/rework/scores/RecommendRow.vue', 'components/rework/scores/TargetProgress.vue', 'components/rework/my/Hub.vue'].map(read));
  for (const source of sources) for (const [, key] of source.matchAll(/\bt\(["'](rework\.[\w.]+)["']/g)) {
    assert.ok(get(zh, key) !== undefined && get(ja, key) !== undefined, key);
  }
});
