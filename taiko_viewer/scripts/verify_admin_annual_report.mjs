// Admin annual report page — profile-card fallback and error-state verification.
// Renders the real admin page and the real share grid offline; no backend, no credentials.
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { chromium } from 'playwright-core';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const out = '/tmp/admin-annual-report-qa';
await mkdir(out, { recursive: true });
const temp = await mkdtemp(resolve(root, 'node_modules/.admin-report-qa-'));
const SUMMARY_ID = 'annual_0123456789abcdef01234567';
const ADMIN_MY_DON = `/api/admin/annual-summaries/${SUMMARY_ID}/my-don`;
const OWNER_MY_DON = `/api/account/annual-summaries/${SUMMARY_ID}/my-don`;
const VIEWER_MY_DON = '/api/account/my-don';
const BREAKTHROUGH_TITLE = '一年一鼓，一路同行';

await writeFile(temp + '/index.html', '<html><head><link rel="icon" href="data:,"></head><body style="margin:0"><div id="app"></div><script type="module" src="/main.js"></script></body></html>');
await writeFile(temp + '/main.js', `
import * as Vue from 'vue';
Object.assign(globalThis, Vue);
const app = await import('/app.js');
app.mount();
`);
await writeFile(temp + '/app.js', `
import {createApp,h,ref,Suspense} from 'vue';
import AdminPage from '${root}/pages/admin/taiko/annual-summaries/[summaryId].vue';
import Grid from '${root}/components/account/version-summary/AnnualShareGrid.vue';
import * as UseAnnualPagesModule from '${root}/composables/useAnnualPages.ts';
import * as UseViewerDateTimeModule from '${root}/composables/useViewerDateTime.ts';
import * as UseAnnualTimelineModule from '${root}/composables/useAnnualTimeline.ts';
import {buildSongCoverThumbnailUrl} from '${root}/utils/songCover.ts';
import zh from '${root}/locales/zh.json';import ja from '${root}/locales/ja.json';
const params = new URLSearchParams(location.search);
const MODE = params.get('mode') || 'player';
const LOCALE = ref('zh');
const n = (value, options) => new Intl.NumberFormat('zh-CN', options || {}).format(Number(value) || 0);
const t = (key, opts) => { let v = String(key).split('.').reduce((o,k)=>o?.[k], zh); if (v && typeof v === 'object' && typeof v.title === 'string') v = v.title; return typeof v === 'string' ? (opts ? v.replace(/\\{(\\w+)\\}/g,(m,p)=>String(opts[p] ?? m)) : v) : key; };
globalThis.useI18n = () => ({ locale: LOCALE, t, n });
globalThis.useRoute = () => ({ params: { summaryId: '${SUMMARY_ID}' }, path: '/admin/taiko/annual-summaries/${SUMMARY_ID}' });
globalThis.navigateTo = to => { window.__nav = (window.__nav || []).concat(typeof to === 'string' ? to : JSON.stringify(to)); };
globalThis.useAnnualPages = (...args) => UseAnnualPagesModule.useAnnualPages(...args);
globalThis.useViewerDateTime = (...args) => UseViewerDateTimeModule.useViewerDateTime(...args);
globalThis.useAnnualTimeline = (...args) => UseAnnualTimelineModule.useAnnualTimeline(...args);
globalThis.useLocalePath = () => p => p; globalThis.useSwitchLocalePath = () => l => '/' + l;
globalThis.useRuntimeConfig = () => ({ public: { googleAnalyticsId: '' } });
globalThis.useState = (k, init) => ref(typeof init === 'function' ? init() : init);
globalThis.useHead = () => {}; globalThis.definePageMeta = () => {}; globalThis.defineI18nRoute = () => {};
globalThis.useViewerApiFetch = () => () => ({ then: () => {} });
const song = (name, songNo) => ({ name, coverUrl: buildSongCoverThumbnailUrl(songNo, 400), songNo, subtitle: '' });
// Admin payloads point the profile card at the operator-gated route, like withAdminAssets does.
const adminSummary = {
  summaryId: '${SUMMARY_ID}', schemaVersion: 4, generatedAt: '2026-09-11T22:30:00+08:00', mode: 'version_observed',
  coverage: { snapshotCount: 1, firstSnapshotAt: '2026-01-04T10:00:00+08:00', lastSnapshotAt: '2026-09-11T22:00:00+08:00', partialStart: false },
  user: { nickname: '测试鼓众' },
  profileCard: { nickname: '测试鼓众', title: '鼓众广场称号', danName: '八段', myDonUrl: '${ADMIN_MY_DON}' },
  overview: { playCount: 1095, uniqueSongs: 286, currentClearCharts: 642 },
  period: { activeDays: 218, totalDays: 365, firstActualPlayDate: '2026-01-04', firstRecordAt: '2026-01-04T10:00:00+08:00', lastRecordAt: '2026-09-11T22:00:00+08:00' },
  favoriteSong: song('星屑ストラック', 816), obsessionSong: null, favoriteShift: null, monthlyFavorites: [],
  weekdayActivity: null,
  calendarActivity: { days: [{ date: '2026-01-04', playCount: 3, intensity: 1 }], maxPlayCount: 3, activeDays: 1, longestStreak: 1, streakStart: '2026-01-04', streakEnd: '2026-01-04', streakLabel: '1 天' },
  timeOfDay: { topPeriod: 'evening', topLabel: '傍晚', periods: [{ key: 'evening', range: '16–19' }], favoriteHourLabel: '17时' },
  lateNight: null, milestones: [], ratingRank: { rankLabel: '十段', rating: 13256.78 }, speedProfile: null, nearDondaful: null,
  challenge: null, pound: { topSong: song('幽玄ノ乱', 463), speed: 23.75 },
  highScore: { song: song('万戈イム－一ノ十', 243), score: 1002340, happenedLabel: '2026-03-14' },
  keyword: null, keywordProfile: null,
  breakthrough: { type: 'rank-up', title: '突破·十段', body: '', evidence: [], song: song('幽玄ノ乱', 463), happenedLabel: '2026-03-14' },
  finalTitle: { title: '${BREAKTHROUGH_TITLE}', body: '', narrativeBody: '', evidenceText: '' },
  poster: { title: '年度报告' }, story: {}, coverSongs: [],
  version: { key: 'annual_2026', name: '虹2026', startDate: '2026-01-01', endDate: null, effectiveEndDate: '2026-09-11', isOngoing: true },
};
globalThis.useAsyncData = async (key, handler) => {
  const data = ref(null); const error = ref(null);
  if (MODE === 'error') { const err = new Error('年度总结文件不可用'); err.data = { statusMessage: '年度总结文件不可用' }; error.value = err; }
  else if (MODE === 'summary-missing') { data.value = { summary: { ...adminSummary, profileCard: { ...adminSummary.profileCard, myDonUrl: '${OWNER_MY_DON}' } } }; }
  else { data.value = { summary: adminSummary }; }
  return { data, error, pending: ref(false), refresh: async () => {} };
};
globalThis.useAdminApiFetch = () => async (url) => { window.__fetched = (window.__fetched || []).concat(String(url)); return { summary: adminSummary }; };
const gridSummary = (myDonUrl, scope) => h('div', { style: 'width:363px' }, [
  h(Grid, { summary: { ...adminSummary, profileCard: { ...adminSummary.profileCard, myDonUrl } }, locale: 'zh', profileFallback: scope })
]);
export const mount = () => {
  const view = MODE === 'grid-admin'
    // Admin payload: the grid must retry the summary's operator-gated route.
    ? gridSummary('${ADMIN_MY_DON}', 'summary')
    // Owner payload: the grid keeps the viewer's own live MyDon fallback.
    : MODE === 'grid-owner'
      ? gridSummary('${OWNER_MY_DON}', 'viewer')
      : h(Suspense, null, { default: () => h(AdminPage) });
  const app = createApp({ render: () => view });
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
    plugins: [{
      name: 'qa-stubs', enforce: 'pre',
      resolveId(id) { if (id.includes('annualBgm.client')) return '\0qa-bgm'; },
      load(id) { if (id === '\0qa-bgm') return 'export const createAnnualBgmSession=()=>({play:async()=>true,pause(){},release(){},dispose(){},stop(){}});export const ANNUAL_BGM_SRC="";export const preloadAnnualBgm=async()=>{};' }
    }, vue()],
    resolve: { alias: { '~': root, '@': root } },
    server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } }
  });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });

  // myDonRequests: every profile-card image request the browser makes; the first one is
  // forced to fail so the component's fallback path runs.
  const run = async (mode) => {
    const page = await browser.newPage({ viewport: { width: 414, height: 896 }, reducedMotion: 'reduce' });
    const errors = []; const myDonRequests = [];
    page.on('pageerror', e => errors.push(e.stack || e.message));
    await page.route('**/*', route => {
      const requestUrl = route.request().url();
      if (requestUrl.startsWith(url + '/__nomatch')) return route.abort();
      if ([ADMIN_MY_DON, OWNER_MY_DON, VIEWER_MY_DON].some(p => requestUrl.endsWith(p)) || /\/api\/(account|admin)\/.*my-don$/.test(requestUrl)) {
        myDonRequests.push(new URL(requestUrl).pathname);
        // Summary-owned account URLs fail, so each component's chosen fallback is observable.
        if (new URL(requestUrl).pathname.startsWith('/api/account/')) return route.fulfill({ status: 500, contentType: 'text/plain', body: 'fail' });
        return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('89504e470d0a1a0a', 'hex') });
      }
      if (requestUrl.startsWith('https://static.sakura-bot.cn')) return route.abort();
      if (!requestUrl.startsWith(url) && !requestUrl.startsWith('data:')) return route.abort();
      return route.continue();
    });
    await page.goto(`${url}?mode=${mode}`);
    await page.waitForTimeout(2500);
    const state = await page.evaluate(() => ({
      text: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 160),
      hasPlayer: !!document.querySelector('.story-player'),
      slides: document.querySelectorAll('.story-player__slide').length,
      stateText: document.querySelector('.admin-annual-view__message')?.textContent?.trim() || null,
      stateButtons: [...document.querySelectorAll('.admin-annual-view__actions button')].map(b => b.textContent.trim()),
      imageSrc: document.querySelector('.annual-share-grid__don img')?.getAttribute('src') || null,
      navTargets: window.__nav || []
    }));
    // Trigger the poster grid so its profile card renders and (if it fails) falls back.
    if (mode === 'player') {
      await page.evaluate(() => { const trigger = document.querySelector('.story-player__drawer-trigger'); if (trigger) trigger.click(); });
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: `${out}/${mode}.png` });
    await page.close();
    return { mode, errors, myDonRequests, ...state };
  };

  for (const mode of ['player', 'error', 'summary-missing', 'grid-admin', 'grid-owner']) {
    process.stdout.write('');
    const result = await run(mode);
    report.push(result);
    assert.deepEqual(result.errors.map(e => String(e).split('\n')[0]), [], `${mode}: page errors`);
  }

  const player = report.find(r => r.mode === 'player');
  assert.equal(player.hasPlayer, true, 'player: report must render');
  assert.ok(player.slides > 0, 'player: slides must render');
  assert.deepEqual(player.myDonRequests.filter(p => p === VIEWER_MY_DON), [], 'player: must never request the operator\'s own /api/account/my-don');

  const errorCase = report.find(r => r.mode === 'error');
  assert.equal(errorCase.stateText, '年度总结文件不可用', 'error: server message is shown');
  assert.deepEqual(errorCase.stateButtons, ['重新加载', '返回管理'], 'error: recovery actions are always available');
  assert.equal(errorCase.hasPlayer, false);

  const missing = report.find(r => r.mode === 'summary-missing');
  assert.equal(missing.hasPlayer, true, 'summary-missing: report still renders');
  assert.deepEqual(missing.myDonRequests, [OWNER_MY_DON], 'summary-missing: owner-shaped MyDon is requested once, never the viewer fallback');

  const gridAdmin = report.find(r => r.mode === 'grid-admin');
  assert.ok(gridAdmin.myDonRequests.includes(ADMIN_MY_DON), 'grid-admin: operator preview requests the summary\'s own operator-gated route');
  assert.deepEqual(gridAdmin.myDonRequests.filter(p => p === VIEWER_MY_DON), [], 'grid-admin: must never fall back to the operator\'s own MyDon');

  const gridOwner = report.find(r => r.mode === 'grid-owner');
  assert.deepEqual(gridOwner.myDonRequests, [OWNER_MY_DON, VIEWER_MY_DON], 'grid-owner: owner surface keeps its viewer fallback');

  console.log(JSON.stringify(report, null, 2));
  console.log('Admin annual report verification PASS (5 cases)');
} finally {
  await browser?.close();
  await server?.close();
  await rm(temp, { recursive: true, force: true });
}
