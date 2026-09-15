// Pound / Poster P3.4 verification: statistics grid geometry, Poster title source,
// highscore label removal, and the Pound record-cover fallback.
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { chromium } from 'playwright-core';
import { mkdtemp, writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const out = '/tmp/annual-p34-qa';
await mkdir(out, { recursive: true });
const temp = await mkdtemp(resolve(root, 'node_modules/.p34-qa-'));
const sample = JSON.parse(await readFile(resolve(root, 'tests/fixtures/annual-summary.sample.json'), 'utf8'));
// Same resolved title the breakthrough (finale) page prints as its heading.
const BREAKTHROUGH_TITLE = '一年一鼓，一路同行';
const BROKEN_COVER = 'https://static.sakura-bot.cn/cover/thumb/400/999999.webp';

const buildSummary = (overrides = {}) => ({
  ...sample,
  finalTitle: { ...(sample.finalTitle || {}), title: BREAKTHROUGH_TITLE, body: '', narrativeBody: '', evidenceText: '' },
  profileCard: { ...sample.profileCard, title: '鼓众广场称号', danName: '八段', myDonUrl: '' },
  ...overrides
});

await writeFile(temp + '/index.html', '<html><head><link rel="icon" href="data:,"></head><body style="margin:0"><div id="app"></div><script type="module" src="/main.js"></script></body></html>');
await writeFile(temp + '/main.js', `
import * as Vue from 'vue';
Object.assign(globalThis, Vue);
globalThis.__fixture = ${JSON.stringify({ sample })};
globalThis.__breakthroughTitle = ${JSON.stringify(BREAKTHROUGH_TITLE)};
globalThis.__brokenCover = ${JSON.stringify(BROKEN_COVER)};
const m = await import('/app.js');
m.mount();
`);
await writeFile(temp + '/app.js', `
import {createApp,h,ref,computed,Suspense} from 'vue';
import Grid from '${root}/components/account/version-summary/AnnualShareGrid.vue';
import Pound from '${root}/components/account/version-summary/slides/PoundSlide.vue';
import HighScore from '${root}/components/account/version-summary/slides/HighScoreSlide.vue';
import { normalizeAnnualSummary } from '${root}/utils/annualSummary.ts';
import Finale from '${root}/components/account/version-summary/slides/AnnualFinaleSlide.vue';
import * as UseAnnualPagesModule from '${root}/composables/useAnnualPages.ts';
import * as UseViewerDateTimeModule from '${root}/composables/useViewerDateTime.ts';
import * as UseAnnualTimelineModule from '${root}/composables/useAnnualTimeline.ts';
import zh from '${root}/locales/zh.json';import ja from '${root}/locales/ja.json';
const LOCALE = ref('zh');
const t = (key, opts) => { let v = String(key).split('.').reduce((o,k)=>o?.[k], zh); if (v && typeof v === 'object' && typeof v.title === 'string') v = v.title; return typeof v === 'string' ? (opts ? v.replace(/\\{(\\w+)\\}/g,(m,p)=>String(opts[p] ?? m)) : v) : key; };
const n = (v, o) => new Intl.NumberFormat('zh-CN', o || {}).format(Number(v) || 0);
globalThis.useI18n = () => ({ locale: LOCALE, t, n });
globalThis.useRoute = () => ({ params: {}, path: '/' });
globalThis.navigateTo = () => {};
globalThis.useAnnualPages = (...args) => UseAnnualPagesModule.useAnnualPages(...args);
globalThis.useViewerDateTime = (...a) => UseViewerDateTimeModule.useViewerDateTime(...a);
globalThis.useAnnualTimeline = (...a) => UseAnnualTimelineModule.useAnnualTimeline(...a);
globalThis.useLocalePath = () => p => p; globalThis.useSwitchLocalePath = () => l => '/' + l;
globalThis.useRuntimeConfig = () => ({ public: { googleAnalyticsId: '' } });
globalThis.useState = (k, init) => ref(typeof init === 'function' ? init() : init);
globalThis.useHead = () => {}; globalThis.definePageMeta = () => {}; globalThis.defineI18nRoute = () => {};
globalThis.useViewerApiFetch = () => () => ({ then: () => {} });
globalThis.useAsyncData = async (k, handler) => { const data = ref(null); const error = ref(null); try { data.value = await handler(); } catch (e) { error.value = e; } return { data, error, pending: ref(false), refresh: async () => {} }; };
// The components consume the same normalized view model the app builds from the payload.
window.__summary = (mode) => {
  const raw = { ...globalThis.__fixture.sample,
    finalTitle: { ...(globalThis.__fixture.sample.finalTitle || {}), title: globalThis.__breakthroughTitle },
    profileCard: { ...globalThis.__fixture.sample.profileCard, title: '鼓众广场称号', danName: '八段', myDonUrl: '' } };
  const vm = normalizeAnnualSummary(raw, 'zh', t);
  // Resolved title = what the breakthrough (finale) page prints as its heading.
  window.__breakthroughTitle = vm.finalTitle.title;
  if (mode === 'title-other') vm.finalTitle.title = '一年一鼓，一路同行';
  if (mode === 'pound-broken' && vm.pound) { vm.pound.topSong.coverUrl = globalThis.__brokenCover; }
  if (mode === 'pound-nocover' && vm.pound) { vm.pound.topSong.coverUrl = ''; }
  // The committed payload has no high score; give the slide a deterministic value.
  vm.highScore = { song: { songNo: 243, name: '万戈イム－一ノ十', subtitle: '', coverUrl: '' }, score: 1002340, happenedLabel: '2026-03-14' };
  return vm;
};
const width = new URLSearchParams(location.search).get('w');
export const mount = () => {
  const view = new URLSearchParams(location.search).get('view') || 'grid';
  const summary = window.__summary(new URLSearchParams(location.search).get('mode') || 'default');
  const box = (child, w) => h('div', { style: 'width:' + w + 'px' }, [child]);
  const story = component => h('div', { style: 'width:414px;height:896px' }, [h(component, { summary, pageIndex: 0, pageTotal: 1, active: true, reducedMotion: true })]);
  const tree = view === 'pound' ? story(Pound)
    : view === 'highscore' ? story(HighScore)
      : view === 'finale' ? story(Finale)
        : view === 'export' ? h('main', { style: 'width:1080px;height:1648px;overflow:hidden;background:#fff' }, [h(Grid, { summary, locale: 'zh', exportMode: true })])
          : box(h(Grid, { summary, locale: 'zh' }), width || 363);
  const app = createApp({ render: () => h(Suspense, null, { default: () => tree }) });
  app.config.globalProperties.$t = t; app.config.globalProperties.$n = n;
  app.config.globalProperties.$i18n = { locale: 'zh', t, n };
  app.mount('#app');
};
`);

let server; let browser;
const report = [];
try {
  server = await createServer({
    configFile: false,
    define: { 'process.client': 'true', 'process.server': 'false' },
    root: temp, publicDir: resolve(root, 'public'),
    plugins: [vue()],
    resolve: { alias: { '~': root, '@': root } },
    server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } }
  });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  const open = async (query, width, height) => {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e.stack || e.message).split('\n').slice(0, 3).join(' | ')));
    await page.route('**/*', route => {
      const target = route.request().url();
      if (target.startsWith('https://static.sakura-bot.cn')) {
        // Only the deliberately broken cover is allowed to fail.
        if (target.includes('999999')) return route.fulfill({ status: 404, contentType: 'text/plain', body: 'missing' });
        // A real 1x1 PNG so a healthy cover actually decodes.
        return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
      }
      if (!target.startsWith(url) && !target.startsWith('data:')) return route.abort();
      return route.continue();
    });
    await page.goto(url + '?' + query);
    await page.waitForTimeout(900);
    return { page, errors };
  };

  // 1. Statistics: a real grid, three tracks, outer tracks anchored to the insets.
  const gridCases = [[363, 414, 900], [320, 360, 740], [1080, 1080, 1648]];
  for (const [width, vw, vh] of gridCases) {
    const view = width === 1080 ? 'export' : 'grid';
    const { page, errors } = await open(`view=${view}&w=${width}`, vw, vh);
    await page.waitForSelector('.annual-share-grid__stats > div');
    const m = await page.evaluate(() => {
      const grid = document.querySelector('.annual-share-grid');
      const stats = document.querySelector('.annual-share-grid__stats');
      const items = [...stats.querySelectorAll(':scope > div')];
      const R = el => { const r = el.getBoundingClientRect(); return { x: +r.x.toFixed(2), w: +r.width.toFixed(2), right: +r.right.toFixed(2), y: +r.y.toFixed(2) }; };
      const g = R(grid);
      const inks = items.map(item => { const dt = item.querySelector('dt').getBoundingClientRect(); const dd = item.querySelector('dd').getBoundingClientRect(); return { left: +Math.min(dt.x, dd.x).toFixed(2), right: +Math.max(dt.right, dd.right).toFixed(2) }; });
      const rows = [...new Set(items.map(i => +i.getBoundingClientRect().y.toFixed(1)))];
      return {
        display: getComputedStyle(stats).display,
        padding: getComputedStyle(stats).padding,
        tracks: items.map(i => R(i)),
        inks, rowCount: rows.length, rowMembers: rows.map(y => items.filter(i => Math.abs(i.getBoundingClientRect().y - y) < 0.5).length),
        alignments: items.map(i => getComputedStyle(i).textAlign),
        grid: g,
        statsOverflow: stats.scrollWidth > stats.clientWidth + 1 || stats.scrollHeight > stats.clientHeight + 1,
        clipped: items.filter(i => i.scrollWidth > i.clientWidth + 1 || i.scrollHeight > i.clientHeight + 1).map(i => i.textContent.trim())
      };
    });
    await page.screenshot({ path: `${out}/grid-${width}.png` });
    await page.close();
    report.push({ case: `stats-${width}`, errors, ...m });
    assert.deepEqual(errors, [], `stats-${width}: page errors`);
    assert.equal(m.display, 'grid', `stats-${width}: must use a real grid`);
    assert.equal(m.rowCount, 2, `stats-${width}: two rows`);
    assert.deepEqual(m.rowMembers, [3, 3], `stats-${width}: three per row`);
    assert.deepEqual(m.alignments, ['start', 'center', 'right', 'start', 'center', 'right'], `stats-${width}: column alignment`);
    const inset = +(0.05 * width).toFixed(2);
    assert.ok(Math.abs(m.inks[0].left - (m.grid.x + inset)) < 1.5, `stats-${width}: first column anchors the left inset (${m.inks[0].left})`);
    assert.ok(Math.abs(m.inks[2].right - (m.grid.right - inset)) < 1.5, `stats-${width}: third column anchors the right inset (${m.inks[2].right})`);
    assert.equal(m.statsOverflow, false, `stats-${width}: wrapper overflow`);
    assert.deepEqual(m.clipped, [], `stats-${width}: clipped statistics`);
  }

  // 2. Pound: a failing remote cover must swap to the designed placeholder, never a broken image.
  for (const mode of ['pound-broken', 'pound-nocover']) {
    const { page, errors } = await open(`view=pound&mode=${mode}`, 414, 896);
    await page.waitForSelector('.pound-poster__center', { state: 'attached' });
    const state = await page.evaluate(() => {
      const center = document.querySelector('.pound-poster__center');
      const img = center.querySelector('img');
      return {
        imgVisible: Boolean(img),
        imgBroken: img ? (img.complete && img.naturalWidth === 0) : false,
        fallbackVisible: Boolean(center.querySelector('.annual-artwork-fallback')),
        fallbackText: center.querySelector('.annual-artwork-fallback')?.textContent?.trim() || null
      };
    });
    await page.screenshot({ path: `${out}/${mode}.png` });
    await page.close();
    report.push({ case: mode, errors, ...state });
    assert.deepEqual(errors, [], `${mode}: page errors`);
    assert.equal(state.fallbackVisible, true, `${mode}: the designed placeholder must render`);
    assert.equal(state.imgBroken, false, `${mode}: a broken image must never remain`);
  }

  // 3. A healthy cover must still take precedence over the placeholder.
  {
    const { page, errors } = await open('view=pound&mode=default', 414, 896);
    await page.waitForSelector('.pound-poster__center', { state: 'attached' });
    const state = await page.evaluate(() => {
      const center = document.querySelector('.pound-poster__center');
      const img = center.querySelector('img');
      return {
        imgVisible: Boolean(img) && img.complete && img.naturalWidth > 0,
        fallbackVisible: Boolean(center.querySelector('.annual-artwork-fallback'))
      };
    });
    await page.close();
    report.push({ case: 'pound-healthy', errors, ...state });
    assert.deepEqual(errors, []);
    assert.equal(state.imgVisible, true, 'pound-healthy: the real cover decodes');
    assert.equal(state.fallbackVisible, false, 'pound-healthy: no placeholder when the cover loads');
  }

  // 4. Poster 称号展示 still comes from the breakthrough title, and highscore has no SCORE label.
  {
    const { page, errors } = await open('view=finale', 414, 896);
    await page.waitForSelector('.annual-finale-scene__title');
    const heading = (await page.locator('.annual-finale-scene__title').innerText()).trim();
    const resolved = await page.evaluate(() => window.__breakthroughTitle);
    await page.close();
    report.push({ case: 'finale-title', errors, heading, resolved });
    assert.deepEqual(errors, []);
    assert.ok(heading.length > 0, 'breakthrough page prints a resolved title');
    assert.equal(resolved, heading, 'breakthrough heading is the resolved title');
  }
  const resolvedTitle = report.find(r => r.case === 'finale-title').heading;
  for (const mode of ['default', 'title-other']) {
    const { page, errors } = await open(`view=grid&w=363&mode=${mode}`, 414, 900);
    await page.waitForSelector('.annual-share-grid__stats > div');
    const title = (await page.locator('.annual-share-grid__label--profile p').innerText()).trim();
    await page.close();
    const expected = mode === 'title-other' ? '一年一鼓，一路同行' : resolvedTitle;
    report.push({ case: `poster-title-${mode}`, errors, title, expected });
    assert.deepEqual(errors, []);
    assert.equal(title, expected, `poster (${mode}): 称号展示 follows the breakthrough title`);
    assert.notEqual(title, '八段', `poster (${mode}): 称号展示 must not show the dan grade`);
  }
  {
    const { page, errors } = await open('view=highscore', 414, 896);
    await page.waitForSelector('.score-poster__score');
    const score = (await page.locator('.score-poster__score').innerText()).trim();
    const body = await page.locator('.score-poster').innerText();
    await page.close();
    report.push({ case: 'highscore', errors, score, hasScoreWord: /SCORE/.test(body) });
    assert.deepEqual(errors, []);
    assert.match(score, /1,002,340/, `highscore: the score value stays (got ${JSON.stringify(score)})`);
    assert.doesNotMatch(body, /SCORE/, 'highscore: the SCORE label stays removed');
  }

  console.log(JSON.stringify(report, null, 2));
  console.log(`P3.4 verification PASS (${report.length} cases)`);
} finally {
  await browser?.close();
  await server?.close();
  await rm(temp, { recursive: true, force: true });
}
