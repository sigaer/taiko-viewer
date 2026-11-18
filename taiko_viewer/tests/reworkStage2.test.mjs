// Stage 2 slice B: the signed-in player's score pages (helpers, contracts the pages rely on, source rules).
// Stage 2 slice C: 今日 / 成长 / 这一周 / goals (helpers, contracts, source rules) — tests at the end of the file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { activeDestination } from '../utils/rework/navigation.ts';
import {
  accountReadKind, errorStatus, errorStatusMessage, SCORE_ROW_WINDOW, rowWindowCount, rowWindow, rowWindowRange, pageCount,
  scoreDate, scoreDateTime, scoreTitles, starOf, fitPercent, deviationText, fitPosition, FIT_SCALE, progressShare, PLAY_TABS
} from '../utils/rework/scores.ts';
import { crownFromCounts } from '../utils/ds/crown.ts';
import {
  GROWTH_TABS, factCrown, isRankFact, rankValue, radarAxes, radarHasData, metricLine, deltaRows, signedFixed, shiftDay,
  weekNavigation, dimensionLabelKey, intlLocale, shortDay, GOAL_TYPE_KEYS, GOAL_COMPLETED_KEYS, RECOVERY_KEYS,
  WEEKLY_TOTAL_KEYS, WEEKLY_REASON_KEYS, WEEKLY_METHOD_KEYS, keyOf
} from '../utils/rework/today.ts';
import { catalogLocation, searchAllState, songSearchRequest } from '../utils/rework/catalog.ts';
import { passportMetricRuns } from '../utils/passportNarrative.ts';
import { GROWTH_DIMENSION_ORDER } from '../utils/playerGrowth.ts';

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
  // slice C reworked the two growth pages: they carry the mapping now (was: not flagged, belonged to slice C)
  for (const growth of ['pages/my/growth.vue', 'pages/my/weekly.vue']) assert.match(await read(growth), /reworkElementPlus: true/, growth + ' (slice C)');
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

// ---------- slice C ----------

test('slice C: crowns and ranks from growth facts; rank values are 0–8 only', () => {
  assert.equal(factCrown('df'), 'dondaful');
  assert.equal(factCrown('fc'), 'full');
  assert.equal(factCrown('clear'), 'clear');
  assert.equal(factCrown('clear-upgrade'), 'clear');
  for (const type of ['score-pb', 'ng-reduced', 'rank-upgrade', 'played', 'goal-completed', null, undefined]) assert.equal(factCrown(type), null);
  assert.ok(isRankFact('rank-upgrade'));
  assert.ok(!isRankFact('fc'));
  assert.deepEqual([0, 5, 8, '6'].map(rankValue), [0, 5, 8, 6]);
  for (const value of [null, undefined, 9, -1, 2.5, 'x', '']) assert.equal(rankValue(value), null);
});

test('slice C: radar axes keep missing values as missing (never zero) and only compare when there is a previous value', () => {
  const label = (k) => k.toUpperCase();
  const axes = radarAxes(GROWTH_DIMENSION_ORDER, label, { big_song: 9.4, stamina: null, speed: 7.9, accuracy_power: 9.8, rhythm: Number.NaN });
  assert.deepEqual(axes.map((a) => a.key), GROWTH_DIMENSION_ORDER);
  assert.deepEqual(axes.map((a) => a.value), [9.4, null, 7.9, 9.8, null, null]);
  assert.ok(axes.every((a) => !('prev' in a)), 'no dashed outline without a previous measurement');
  assert.equal(axes[0].label, 'BIG_SONG');
  assert.ok(radarHasData(axes));
  assert.ok(!radarHasData(axes.map((a, i) => ({ ...a, value: i < 2 ? a.value : null }))));
  const compared = radarAxes(GROWTH_DIMENSION_ORDER, label, { speed: 8 }, { speed: 7.5, stamina: 6 });
  assert.equal(compared.find((a) => a.key === 'speed').prev, 7.5);
  assert.equal(compared.find((a) => a.key === 'big_song').prev, null);
  assert.equal(dimensionLabelKey('big_song'), 'rework.ratingDims.big');
  assert.equal(dimensionLabelKey('accuracy_power'), 'rework.ratingDims.accuracy');
  assert.equal(dimensionLabelKey('speed'), 'rework.ratingDims.speed');
});

test('slice C: the metric line shows exactly the measured points, separated runs break the line', () => {
  const point = (id, day, rating, speed) => ({ id, day, rating, dimensions: { speed } });
  const segments = [
    { id: 'a', points: [point('1', '2026-09-01', 8.5, 7), point('2', '2026-09-08', 8.6, null)] },
    { id: 'b', points: [point('3', '2026-10-01', 8.9, 7.4), point('4', '2026-10-05', 9.0, 7.6)] }
  ];
  const rating = metricLine(passportMetricRuns(segments, 'rating'), (d) => d.slice(5));
  assert.deepEqual(rating.points, [{ label: '09-01', value: 8.5 }, { label: '09-08', value: 8.6 }, { label: '10-01', value: 8.9 }, { label: '10-05', value: 9.0 }]);
  const speed = metricLine(passportMetricRuns(segments, 'speed'), (d) => d.slice(5));
  assert.deepEqual(speed.points.map((p) => p.value), [7, null, 7.4, 7.6], 'a missing value starts a new run: a gap, not a zero');
  assert.deepEqual(speed.index.map((p) => [p.id, p.at]), [['1', 0], ['3', 2], ['4', 3]]);
  assert.deepEqual(metricLine([], String), { points: [], index: [] });
});

test('slice C: weekly dimension change rows, signed values and week navigation over ?week=', () => {
  const rows = deltaRows(GROWTH_DIMENSION_ORDER, { big_song: 0.1, stamina: -0.2, speed: 0.4, accuracy_power: null, rhythm: 0, complex: 0.4 });
  assert.deepEqual(rows.map((r) => r.share), [25, 50, 100, 0, 0, 100]);
  assert.deepEqual(rows.filter((r) => r.top).map((r) => r.key), ['speed', 'complex'], 'the largest increase is marked (ties too)');
  assert.equal(rows[3].delta, null);
  assert.deepEqual(deltaRows(GROWTH_DIMENSION_ORDER, null).map((r) => [r.delta, r.share, r.top]), GROWTH_DIMENSION_ORDER.map(() => [null, 0, false]));
  assert.deepEqual([0.18, -0.04, 0, null, undefined, Number.NaN].map((v) => signedFixed(v)), ['+0.18', '−0.04', '0.00', '—', '—', '—']);
  assert.equal(shiftDay('2026-11-16', -7), '2026-11-09');
  assert.equal(shiftDay('2026-12-28', 7), '2027-01-04');
  assert.equal(shiftDay('2026-3-1', 1), null);
  assert.deepEqual(weekNavigation({ from: '2026-11-16', to: '2026-11-18', isCompleteWeek: false }), { previous: '2026-11-09', next: null });
  assert.deepEqual(weekNavigation({ from: '2026-11-09', to: '2026-11-15', isCompleteWeek: true }), { previous: '2026-11-02', next: '2026-11-16' });
  assert.deepEqual(weekNavigation(null), { previous: null, next: null });
});

test('slice C: dates in the page language on the growth calendar', () => {
  assert.equal(intlLocale('ja'), 'ja-JP');
  assert.equal(intlLocale('zh'), 'zh-CN');
  assert.equal(shortDay('2026-11-12', 'zh'), '11/12');
  assert.equal(shortDay('2026-11-11T20:00:00.000Z', 'zh'), '11/12', 'Asia/Shanghai day');
  assert.equal(shortDay('', 'zh'), '');
  assert.equal(shortDay(null, 'ja'), '');
});

test('slice C: every static locale key the reworked components use exists in both languages', async () => {
  const [zh, ja] = [await locale('zh'), await locale('ja')];
  const tables = [GOAL_TYPE_KEYS, GOAL_COMPLETED_KEYS, RECOVERY_KEYS, WEEKLY_TOTAL_KEYS, WEEKLY_REASON_KEYS, WEEKLY_METHOD_KEYS];
  for (const table of tables) for (const key of Object.values(table)) for (const [lang, messages] of [['zh', zh], ['ja', ja]]) assert.equal(typeof get(messages, key), 'string', `${lang}: ${key}`);
  for (const key of GROWTH_DIMENSION_ORDER.map(dimensionLabelKey)) assert.equal(typeof get(zh, key), 'string', key);
  assert.equal(keyOf(GOAL_TYPE_KEYS, 'fc'), 'home.goal.types.fc');
  assert.equal(keyOf(RECOVERY_KEYS, 'unknown-stage', RECOVERY_KEYS.auth), 'home.recovery.auth');
  assert.equal(keyOf(GOAL_TYPE_KEYS, null), '');
  const shape = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' ? shape(v, `${prefix}${k}.`) : [`${prefix}${k}`])).sort();
  for (const area of ['home', 'growthPage', 'weeklyPage']) {
    assert.deepEqual(shape(zh.rework[area]), shape(ja.rework[area]), `rework.${area}`);
    for (const key of shape(zh.rework[area])) assert.ok(String(get(ja.rework[area], key)).trim(), `ja rework.${area}.${key}`);
  }
});

test('slice C: the 成长 tabs are the two growth pages, named like their own <h1>', async () => {
  const [zh, ja, shell] = [await locale('zh'), await locale('ja'), await read('components/rework/Shell.vue')];
  assert.deepEqual(GROWTH_TABS.map((t) => t.to), ['/my/growth', '/my/weekly']);
  assert.ok(GROWTH_TABS.every((t) => activeDestination(t.to) === 'growth'));
  for (const messages of [zh, ja]) {
    assert.equal(get(messages, 'rework.passport'), get(messages, 'passport.title'));
    assert.equal(get(messages, 'rework.weekly'), get(messages, 'weekly.title'));
  }
  assert.match(shell, /growth: \[\.\.\.GROWTH_TABS\]/);
  assert.doesNotMatch(shell, /today: \[/, '今日 is a single page without section tabs');
});

test('slice C: the guest search uses the global search contract and the same "view all" into the library', async () => {
  const source = await read('components/rework/today/SongSearch.vue');
  assert.match(source, /songSearchRequest\(keyword\)/);
  assert.match(source, /catalogLocation\(searchAllState\(q\), localePath\)/);
  assert.doesNotMatch(source, /shelfStatus|pageSize/, 'no second query semantics');
  assert.deepEqual(songSearchRequest('天狗'), { view: 'list', page: 1, pageSize: 8, keyword: '天狗', sort: 'catalog' });
  assert.deepEqual(catalogLocation(searchAllState('天狗')), { path: '/songs', query: { q: '天狗', shelf: 'all' } });
  const search = await read('components/rework/SearchPanel.vue');
  assert.match(search, /songSearchRequest\(/);
  assert.match(search, /catalogLocation\(searchAllState\(/);
});

test('slice C pages: own header, Element Plus mapping, gates, no hand-written growth chart', async () => {
  for (const path of ['pages/index.vue', 'pages/my/growth.vue', 'pages/my/weekly.vue']) {
    const source = await read(path);
    assert.match(source, /hidePageHeader: true/, path);
    assert.match(source, /reworkElementPlus: true/, path);
  }
  const growth = await read('pages/my/growth.vue');
  const weekly = await read('pages/my/weekly.vue');
  assert.match(growth, /contentLayout: "wide"/);
  assert.match(weekly, /contentLayout: "wide"/, 'the two 成长 tabs share one content width');
  for (const source of [growth, weekly]) assert.match(source, /<ReworkGate v-if="!accountUser"[^>]*need="login"/);
  assert.doesNotMatch(growth, /PassportMetricChart|<svg/);
  const chart = await read('components/rework/growth/MetricChart.vue');
  assert.match(chart, /<DsChartsLineChart/);
  const signedIn = await read('components/rework/today/SignedIn.vue');
  assert.match(signedIn, /need="binding"/);
  assert.match(signedIn, /localePath\('\/account\/sync'\)/);
  const home = await read('pages/index.vue');
  assert.match(home, /resolveHomePresentation\(homeStateStatus\.value, homeState\.value\)/, 'home state resolution unchanged');
  for (const name of ['ReworkTodayGuest', 'ReworkTodayPublic', 'ReworkTodaySignedIn']) assert.match(home, new RegExp(`<${name}`));
});

test('slice C: charts draw only values the APIs return', async () => {
  const profile = await read('components/rework/today/Profile.vue');
  assert.match(profile, /<DsDrumDial :value="rating"/);
  assert.match(profile, /<DsRadar v-if="showRadar"/);
  const value = await read('components/rework/today/AccountValue.vue');
  assert.doesNotMatch(value, /12,840|--bar/, 'no invented Rating card on the guest home');
  for (const path of ['components/rework/today/Board.vue', 'components/rework/weekly/Hero.vue']) assert.doesNotMatch(await read(path), /<DsLane|ReworkLane/, path + ': no lane without per-day data');
});
