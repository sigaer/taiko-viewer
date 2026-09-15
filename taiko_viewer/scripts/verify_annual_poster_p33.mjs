// Poster / breakthrough / highscore P3.3 layout verification.
// Renders the real components offline (no backend, no DB, no credentials):
//   1. the Poster page grid at mobile viewports, plus the breakthrough and highscore slides
//   2. the share-card export surface at its real 1080x1648 geometry
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { chromium } from 'playwright-core';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
// The resolved title the breakthrough (finale) page prints as its heading.
const BREAKTHROUGH_TITLE = '一年一鼓，一路同行';
// Distinct sentinel so a swapped title source cannot pass the assertions below.
const BREAKTHROUGH_FALLBACK = '突破·十段';
const temp = await mkdtemp(resolve(root, 'node_modules/.poster-p33-'));
await writeFile(temp + '/index.html', '<html><head><link rel="icon" href="data:,"></head><body style="margin:0"><div id="app"></div><script type="module" src="/main.js"></script></body></html>');
await writeFile(temp + '/main.js', `
import {createApp,ref,computed,h} from 'vue';
import Poster from '${root}/components/account/version-summary/slides/PosterSlide.vue';
import Finale from '${root}/components/account/version-summary/slides/AnnualFinaleSlide.vue';
import HighScore from '${root}/components/account/version-summary/slides/HighScoreSlide.vue';
import Grid from '${root}/components/account/version-summary/AnnualShareGrid.vue';
import {buildSongCoverThumbnailUrl} from '${root}/utils/songCover.ts';
import zh from '${root}/locales/zh.json';import ja from '${root}/locales/ja.json';
const LOCALE=ref(new URLSearchParams(location.search).get('lang')||'zh');
globalThis.useI18n=()=>({locale:LOCALE,t:(key,params)=>key.split('.').reduce((o,k)=>o?.[k],LOCALE.value==='ja'?ja:zh)||key});
globalThis.useViewerApiFetch=()=>()=>({then:()=>{}});
const song=(name,songNo)=>({name,coverUrl:buildSongCoverThumbnailUrl(songNo,400),songNo,subtitle:''});
const BREAKTHROUGH_TITLE=${JSON.stringify(BREAKTHROUGH_TITLE)};
// The finale falls back to the breakthrough title only when the resolved title is empty;
// both are sentinels so a swapped source cannot pass.
const BREAKTHROUGH_FALLBACK='突破·十段';
const summary={
  summaryId:'p33-qa',user:{nickname:'测试鼓众'},
  profileCard:{nickname:'测试鼓众',title:'鼓众广场称号',titleplateId:1,danName:'八段',danLevel:8,myDonUrl:null},
  overview:{playCount:1095,uniqueSongs:286,currentClearCharts:642},
  period:{activeDays:218},
  favoriteSong:song('星屑ストラック',816),
  pound:{topSong:song('幽玄ノ乱',463),speed:23.75},
  highScore:{song:song('万戈イム－一ノ十',243),score:1002340,happenedLabel:'2026-03-14 21:07'},
  timeOfDay:{topPeriod:'evening',topLabel:'傍晚',periods:[{key:'evening',range:'16–19'}],favoriteHourLabel:'17时'},
  ratingRank:{rankLabel:'十段',rating:13256.78},
  breakthrough:{type:'rank-up',title:BREAKTHROUGH_FALLBACK,body:'',evidence:[],song:song('幽玄ノ乱',463),happenedLabel:'2026-03-14'},
  finalTitle:{title:BREAKTHROUGH_TITLE,body:'',narrativeBody:'',evidenceText:''},
  poster:{title:'年度报告'},
};
window.__summary=summary;
const which=new URLSearchParams(location.search).get('view')||'poster';
const view=which==='finale'?h(Finale,{summary,pageIndex:0,pageTotal:1,active:true,reducedMotion:true})
  :which==='highscore'?h(HighScore,{summary,pageIndex:0,pageTotal:1,active:true,reducedMotion:true})
  :which==='export'?h('main',{style:'width:1080px;height:1648px;overflow:hidden;background:#fff'},[h(Grid,{summary,locale:LOCALE.value,exportMode:true})])
  :h(Poster,{summary,active:true,reducedMotion:true});
const app=createApp({render:()=>view});
app.mount('#app');
`);

let server; let browser;
const report = [];
try {
  server = await createServer({
    configFile: false,
    define: { 'process.client': 'true', 'process.server': 'false' },
    root: temp,
    publicDir: resolve(root, 'public'),
    plugins: [{
      name: 'silent-bgm', enforce: 'pre',
      resolveId(id) { if (id.includes('annualBgm.client')) return '\0p33-bgm'; },
      load(id) { if (id === '\0p33-bgm') return 'export const createAnnualBgmSession=()=>({play:async()=>true,pause(){},release(){},dispose(){},stop(){}})' }
    }, vue()],
    resolve: { alias: { '~': root, '@': root } },
    server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } }
  });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--font-render-hinting=none'] });

  const open = async (view, width, height, lang = 'zh') => {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce', locale: lang === 'ja' ? 'ja-JP' : 'zh-CN' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const target = route.request().url();
      if (!target.startsWith(url) && !target.startsWith('data:')) return route.abort();
      return route.continue();
    });
    await page.goto(`${url}?view=${view}&lang=${lang}`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);
    return { page, errors };
  };

  const gridMetrics = page => page.evaluate(() => {
    const rect = element => { const r = element.getBoundingClientRect(); return { x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), right: +r.right.toFixed(2), bottom: +r.bottom.toFixed(2) }; };
    const grid = document.querySelector('.annual-share-grid');
    const stats = document.querySelector('.annual-share-grid__stats');
    const items = [...stats.querySelectorAll(':scope > div')].map(item => {
      const dt = item.querySelector('dt');
      const dd = item.querySelector('dd');
      const box = item.getBoundingClientRect();
      const ink = [dt, dd].map(node => node.getBoundingClientRect());
      return {
        label: dt.textContent, value: dd.textContent, box: rect(item),
        inkLeft: +Math.min(...ink.map(r => r.x)).toFixed(2), inkRight: +Math.max(...ink.map(r => r.right)).toFixed(2),
        clipped: item.scrollWidth > item.clientWidth + 1 || item.scrollHeight > item.clientHeight + 1 || dd.scrollHeight > dd.clientHeight + 1
      };
    });
    const rows = [...new Set(items.map(item => item.box.y))];
    return {
      grid: rect(grid), stats: rect(stats), items,
      rowCount: rows.length, rowMembers: rows.map(y => items.filter(item => item.box.y === y).length),
      columnWidth: items[0].box.w, columnGaps: [items[1].box.x - items[0].box.right, items[2].box.x - items[1].box.right].map(v => +v.toFixed(2)),
      inkInsets: { left: +(Math.min(...items.map(i => i.inkLeft)) - grid.getBoundingClientRect().x).toFixed(2), right: +(grid.getBoundingClientRect().right - Math.max(...items.map(i => i.inkRight))).toFixed(2) },
      statsOverflow: stats.scrollWidth > stats.clientWidth + 1 || stats.scrollHeight > stats.clientHeight + 1,
      clipped: items.filter(item => item.clipped).map(item => item.label),
      docOverflow: document.documentElement.scrollWidth > window.innerWidth,
      titleValue: document.querySelector('.annual-share-grid__label--profile p')?.textContent?.trim(),
      titleLabel: document.querySelector('.annual-share-grid__label--profile h2')?.textContent?.trim()
    };
  });

  // 1. Poster page: six statistics spread across the card, title from the breakthrough page,
  //    no overflow at narrow widths. 414x896 is the poster's max grid width (363px cap).
  for (const [width, height] of [[414, 896], [390, 844], [360, 740], [320, 640]]) {
    const { page, errors } = await open('poster', width, height);
    await page.waitForSelector('.annual-share-grid__stats > div');
    const m = await gridMetrics(page);
    await page.close();
    report.push({ case: `poster-${width}x${height}`, errors, ...m });
    assert.deepEqual(errors, [], `${width}x${height}: page errors`);
    assert.equal(m.rowCount, 2, `${width}x${height}: statistics must stay two rows`);
    assert.deepEqual(m.rowMembers, [3, 3], `${width}x${height}: statistics must stay three columns per row`);
    assert.equal(m.items.length, 6, `${width}x${height}: six statistics`);
    assert.equal(m.statsOverflow, false, `${width}x${height}: stats wrapper overflow`);
    assert.deepEqual(m.clipped, [], `${width}x${height}: clipped statistic`);
    assert.equal(m.docOverflow, false, `${width}x${height}: document overflow`);
    assert.equal(m.titleLabel, '称号展示', `${width}x${height}: label copy changed`);
    assert.equal(m.titleValue, BREAKTHROUGH_TITLE, `${width}x${height}: 称号展示 must show the breakthrough title`);
    assert.notEqual(m.titleValue, '八段', `${width}x${height}: 称号展示 must not show the dan grade`);
    // Spread: the statistics must reach much further out than the previous 5.5cqw inset and
    // must stay inside the card.
    const expectedInset = +(0.015 * 363).toFixed(2);
    assert.ok(m.inkInsets.left <= expectedInset + 1.5 && m.inkInsets.left >= 0, `${width}x${height}: left inset ${m.inkInsets.left}`);
    assert.ok(m.inkInsets.right <= expectedInset + 1.5 && m.inkInsets.right >= 0, `${width}x${height}: right inset ${m.inkInsets.right}`);
    assert.ok(m.columnGaps.every(gap => gap >= 10), `${width}x${height}: column gaps too tight: ${m.columnGaps}`);
    // Every column is wider than the previous 3-track layout, which inset both sides by 5.5cqw
    // and separated the tracks by 4cqw.
    const previousTrack = (m.grid.w * (1 - 0.11) - 2 * 0.04 * m.grid.w) / 3;
    assert.ok(m.columnWidth > previousTrack, `${width}x${height}: column width ${m.columnWidth} must exceed the previous ${previousTrack.toFixed(2)}px track`);
  }

  // 2. Japanese locale keeps the same geometry and the same resolved title.
  {
    const { page, errors } = await open('poster', 414, 896, 'ja');
    await page.waitForSelector('.annual-share-grid__stats > div');
    const m = await gridMetrics(page);
    await page.close();
    report.push({ case: 'poster-ja-414x896', errors, ...m });
    assert.deepEqual(errors, []);
    assert.deepEqual(m.rowMembers, [3, 3]);
    assert.equal(m.titleValue, BREAKTHROUGH_TITLE);
    assert.equal(m.statsOverflow, false);
  }

  // 3. Breakthrough page prints the same title text the Poster now shows.
  {
    const { page, errors } = await open('finale', 414, 896);
    await page.waitForSelector('.annual-finale-scene__title');
    const heading = (await page.locator('.annual-finale-scene__title').innerText()).trim();
    await page.close();
    report.push({ case: 'finale-414x896', errors, heading });
    assert.deepEqual(errors, []);
    assert.equal(heading, BREAKTHROUGH_TITLE, 'breakthrough heading is the Poster title source');
  }

  // 4. Highscore page no longer renders the redundant SCORE label.
  for (const [width, height] of [[414, 896], [390, 844]]) {
    const { page, errors } = await open('highscore', width, height);
    await page.waitForSelector('.score-poster__score');
    const score = (await page.locator('.score-poster__score').innerText()).trim();
    const bodyText = await page.locator('.score-poster').innerText();
    await page.close();
    report.push({ case: `highscore-${width}x${height}`, errors, score, hasScoreWord: /SCORE/.test(bodyText) });
    assert.deepEqual(errors, []);
    assert.match(score, /1,002,340/, 'score value itself must stay');
    assert.doesNotMatch(bodyText, /SCORE/, 'SCORE label must be removed');
  }

  // 5. Export surface: the saved PNG geometry must match the preview layout rules.
  {
    const { page, errors } = await open('export', 1080, 1648);
    await page.waitForSelector('.annual-share-grid__stats > div');
    const m = await gridMetrics(page);
    await page.close();
    report.push({ case: 'export-1080x1648', errors, ...m });
    assert.deepEqual(errors, []);
    assert.equal(m.rowCount, 2);
    assert.deepEqual(m.rowMembers, [3, 3]);
    assert.equal(m.statsOverflow, false);
    assert.deepEqual(m.clipped, []);
    assert.equal(m.titleValue, BREAKTHROUGH_TITLE);
    assert.ok(m.items.every(item => item.box.bottom < m.grid.bottom), 'statistics must stay inside the export card');
  }

  console.log(JSON.stringify(report, null, 2));
  console.log(`P3.3 poster layout verification PASS (${report.length} cases)`);
} finally {
  await browser?.close();
  await server?.close();
  await rm(temp, { recursive: true, force: true });
}
