// Admin annual report page — profile-card fallback and error-state verification.
// Renders the real admin page and the real share grid offline; no backend, no credentials.
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { chromium } from 'playwright-core';
import { mkdtemp, writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const out = '/tmp/admin-annual-report-qa';
await mkdir(out, { recursive: true });
const temp = await mkdtemp(resolve(root, 'node_modules/.admin-report-qa-'));
// Real production summary payload (identifiers scrubbed); the shape is the real contract.
const sampleSummary = JSON.parse(await readFile(resolve(root, 'tests/fixtures/annual-summary.sample.json'), 'utf8'));
const SUMMARY_ID = String(sampleSummary.summaryId);
const ADMIN_MY_DON = `/api/admin/annual-summaries/${SUMMARY_ID}/my-don`;
const OWNER_MY_DON = `/api/account/annual-summaries/${SUMMARY_ID}/my-don`;
const VIEWER_MY_DON = '/api/account/my-don';

await writeFile(temp + '/index.html', '<html><head><link rel="icon" href="data:,"></head><body style="margin:0"><div id="app"></div><script type="module" src="/main.js"></script></body></html>');
const fixtureSource = JSON.stringify(sampleSummary)
  .replace('</script>', '<\\/script>')
  .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
await writeFile(temp + '/main.js', `
import * as Vue from 'vue';
Object.assign(globalThis, Vue);
globalThis.__sampleSummary = ${fixtureSource};
const app = await import('/app.js');
app.mount();
`);
await writeFile(temp + '/app.js', `
import {createApp,h,ref,computed,Suspense} from 'vue';
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
globalThis.useAnnualBeta = () => ({ track: () => {} });
globalThis.useAnnualPages = (...args) => UseAnnualPagesModule.useAnnualPages(...args);
globalThis.useViewerDateTime = (...args) => UseViewerDateTimeModule.useViewerDateTime(...args);
globalThis.useAnnualTimeline = (...args) => UseAnnualTimelineModule.useAnnualTimeline(...args);
globalThis.useLocalePath = () => p => p; globalThis.useSwitchLocalePath = () => l => '/' + l;
globalThis.useRuntimeConfig = () => ({ public: { googleAnalyticsId: '' } });
globalThis.useState = (k, init) => ref(typeof init === 'function' ? init() : init);
globalThis.useHead = () => {}; globalThis.definePageMeta = () => {}; globalThis.defineI18nRoute = () => {};
globalThis.useLocalePath = () => p => p;
globalThis.useViewerApiFetch = () => () => ({ then: () => {} });
const adminSummary = {
  ...globalThis.__sampleSummary,
  profileCard: { ...globalThis.__sampleSummary.profileCard, myDonUrl: '${ADMIN_MY_DON}' }
};
const ownerSummary = {
  ...globalThis.__sampleSummary,
  profileCard: { ...globalThis.__sampleSummary.profileCard, myDonUrl: '${OWNER_MY_DON}' }
};
globalThis.useAsyncData = async (key, handler) => {
  const data = ref(null); const error = ref(null);
  if (MODE === 'error') { const err = new Error('年度总结文件不可用'); err.data = { statusMessage: '年度总结文件不可用' }; error.value = err; }
  else if (MODE === 'summary-missing') { data.value = { summary: { ...adminSummary, profileCard: { ...adminSummary.profileCard, myDonUrl: '${OWNER_MY_DON}' } } }; }
  else { data.value = { summary: adminSummary }; }
  return { data, error, pending: ref(false), refresh: async () => {} };
};
globalThis.useAdminApiFetch = () => async (url, options) => {
  window.__calls = (window.__calls || []).concat(String(url));
  if (String(url).includes('/api/admin/annual-summaries?')) return { items: [{ taikoId: '2258735', nickname: '测试鼓众', username: 'sigaer', hasViewerAccount: true, summaryId: '${SUMMARY_ID}', userId: 1, bindingId: 1 }] };
  return { summary: adminSummary, job: { id: 'job-1', status: 'completed', summaryId: '${SUMMARY_ID}' } };
};
const gridSummary = (myDonUrl, scope) => h('div', { style: 'width:363px' }, [
  h(Grid, { summary: { ...adminSummary, profileCard: { ...adminSummary.profileCard, myDonUrl } }, locale: 'zh', profileFallback: scope })
]);
export const mount = async () => {
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
  const run = async (mode, width = 414, motion = "reduce", navigate = false) => {
    const page = await browser.newPage({ viewport: { width, height: 896 }, reducedMotion: motion });
    const errors = []; const myDonRequests = [];
    page.on('pageerror', e => errors.push(e.stack || e.message));
    await page.route('**/*', route => {
      const requestUrl = route.request().url();
      if (requestUrl.startsWith(url + '/__nomatch')) return route.abort();
      if ([ADMIN_MY_DON, OWNER_MY_DON, VIEWER_MY_DON].some(p => requestUrl.endsWith(p)) || /\/api\/(account|admin)\/.*my-don$/.test(requestUrl)) {
        myDonRequests.push(new URL(requestUrl).pathname);
        // Summary-owned account URLs fail, so each component's chosen fallback is observable.
        if (new URL(requestUrl).pathname === '${OWNER_MY_DON}') return route.fulfill({ status: 500, contentType: 'text/plain', body: 'fail' });
        return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('89504e470d0a1a0a', 'hex') });
      }
      if (requestUrl.startsWith('https://static.sakura-bot.cn')) return route.abort();
      if (!requestUrl.startsWith(url) && !requestUrl.startsWith('data:')) return route.abort();
      return route.continue();
    });
    await page.goto(`${url}?mode=${mode}`);
    if (mode === 'entry-inline') await page.waitForFunction(() => window.__entryDone === true, null, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const state = await page.evaluate(() => ({
      text: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 160),
      hasPlayer: !!document.querySelector('.story-player'),
      slides: document.querySelectorAll('.story-player__slide').length,
      stateText: document.querySelector('.admin-annual-view__message')?.textContent?.trim() || null,
      stateButtons: [...document.querySelectorAll('.admin-annual-view__actions button')].map(b => b.textContent.trim()),
      imageSrc: document.querySelector('.annual-share-grid__don img')?.getAttribute('src') || null,
      navTargets: window.__nav || [],
      entryRows: window.__rows ?? null,
      entryReached: window.__entryReached === true,
      html: document.getElementById('app')?.innerHTML?.slice(0, 120) || '(empty)',
      previewOpen: Boolean(document.querySelector('.preview')),
      previewCloseText: document.querySelector('.preview__close')?.textContent?.trim() || null,
      persistedCalls: (window.__calls || []).filter(c => c.includes('/annual-summaries/annual_')),
      entryState: window.__entryState || null,
      buildCalls: (window.__calls || []).filter(c => c.includes('/build'))
    }));
    // Trigger the poster grid so its profile card renders and (if it fails) falls back.
    if (mode === 'player') {
      await page.evaluate(() => { const trigger = document.querySelector('.story-player__drawer-trigger'); if (trigger) trigger.click(); });
      await page.waitForTimeout(300);
    }
    if(navigate){
      const started=Date.now();await page.locator('.annual-opening__direct').click();
      await page.locator('.story-player__slide[data-page-key="poster"][aria-hidden="false"]').waitFor({timeout:10000});
      state.navigationMs=Date.now()-started;
      if(motion==='no-preference')assert.ok(state.navigationMs>=600,'normal opening keeps its animation');
      await page.waitForTimeout(500);await page.locator('.story-player__viewport').focus();await page.keyboard.press('ArrowUp');await page.waitForTimeout(1200);
      await page.waitForFunction(()=>document.querySelector('.story-player__slide[data-page-key="final"]')?.getAttribute('aria-hidden')==='false');
      state.navigation='PASS';state.motion=motion;state.width=width;
    }
    await page.screenshot({ path: `${out}/${mode}-${width}-${motion}-${navigate}.png`, animations:'disabled' });
    await page.close();
    return { mode, errors, myDonRequests, ...state };
  };

  for (const mode of ['player', 'error', 'summary-missing', 'grid-admin', 'grid-owner']) {
    const result = await run(mode);
    report.push(result);
    assert.deepEqual(result.errors.map(e => String(e).split('\n')[0]), [], `${mode}: page errors`);
  }

  for(const width of [390,1280])for(const motion of ['reduce','no-preference']){
    const r=await run('player',width,motion,true);assert.deepEqual(r.errors,[]);report.push(r);
  }
  const player = report.find(r => r.mode === 'player');
  assert.equal(player.hasPlayer, true, 'player: report must render');
  assert.ok(player.slides > 0, 'player: slides must render');

  const errorCase = report.find(r => r.mode === 'error');
  assert.equal(errorCase.stateText, '年度总结文件不可用', 'error: server message is shown');
  assert.deepEqual(errorCase.stateButtons, ['重新加载', '返回管理'], 'error: recovery actions are always available');
  assert.equal(errorCase.hasPlayer, false);

  const missing = report.find(r => r.mode === 'summary-missing');
  assert.equal(missing.hasPlayer, true, 'summary-missing: report still renders');

  const gridAdmin = report.find(r => r.mode === 'grid-admin');
  assert.ok(gridAdmin.myDonRequests.includes(ADMIN_MY_DON), 'grid-admin: operator preview requests the summary\'s own operator-gated route');
  assert.deepEqual(gridAdmin.myDonRequests.filter(p => p === VIEWER_MY_DON), [], 'grid-admin: must never fall back to the operator\'s own MyDon');

  const gridOwner = report.find(r => r.mode === 'grid-owner');
  assert.deepEqual(gridOwner.myDonRequests, [OWNER_MY_DON, VIEWER_MY_DON], 'grid-owner: owner surface keeps its viewer fallback');

  // The entry must not depend on route navigation at all: the operator opens someone else's
  // report through the same in-page preview the taiko-ID path already used.
  const listSource = await readFile(resolve(root, 'pages/admin/taiko/annual-summaries.vue'), 'utf8');
  assert.doesNotMatch(listSource, /navigateTo\(/, 'entry: the list page must not navigate to open a report');
  assert.match(listSource, /const openPreview = async/, 'entry: reports open through the in-page preview');
  assert.match(listSource, /preview\.value = result\.summary/, 'entry: the preview receives the persisted summary');
  assert.match(listSource, /profile-fallback="summary"/, 'entry: the preview keeps the operator away from their own MyDon');

  console.log(JSON.stringify(report, null, 2));
  console.log(`Admin annual report verification PASS (${report.length} render cases + entry source checks)`);
} finally {
  await browser?.close();
  await server?.close();
  await rm(temp, { recursive: true, force: true });
}
