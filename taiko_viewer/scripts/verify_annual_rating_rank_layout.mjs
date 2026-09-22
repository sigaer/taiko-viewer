import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';

const root = process.cwd();
const outputDir = '/var/tmp/annual-rating-rank-axis';
const temp = await mkdtemp('/var/tmp/annual-rating-rank-fixture-');
await mkdir(outputDir, { recursive: true });
await writeFile(`${temp}/index.html`, '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"></head><body><div id="app"></div><script type="module" src="/main.js"></script></body></html>');
await writeFile(`${temp}/main.js`, `
import {createApp,h,nextTick,onMounted,ref} from 'vue';
import RatingRank from '${root}/components/account/version-summary/AnnualRatingRankScene.vue';
import {useAnnualViewport} from '${root}/composables/useAnnualViewport.ts';
import zh from '${root}/locales/zh.json';
globalThis.useI18n=()=>({locale:ref('zh'),t:(key)=>key.split('.').reduce((value,part)=>value?.[part],zh)||key});
const ranks=Array.from({length:19},(_,index)=>({key:'rank-'+(index+1),label:'等级 '+(index+1),order:index+1,colorGroup:index<6?'low':index<13?'mid':'high',bins:Array.from({length:8},(_,bin)=>({ratingMin:bin*2,ratingMax:(bin+1)*2,relative:Math.max(.08,1-Math.abs(bin-4)/5)}))}));
const summary={summaryId:'rating-rank-layout-qa',ratingRank:{rating:12.3456,percentile:88.88,rankKey:'rank-12',rankLabel:'十段',distribution:{ranks}}};
const App={setup(){
  const viewport=ref(null);const slides=ref([]);const active=ref(Number(sessionStorage.getItem('rating-rank-page')||1));
  const align=()=>nextTick(()=>{const target=slides.value[active.value];if(viewport.value&&target)viewport.value.scrollTo({top:target.offsetTop,behavior:'auto'});});
  useAnnualViewport(align);
  const go=async(index)=>{active.value=Math.max(0,Math.min(2,index));sessionStorage.setItem('rating-rank-page',String(active.value));await align();};
  window.__ratingRankQa={go,index:()=>active.value,align};onMounted(align);
  return()=>h('main',{class:'story-player'},[h('div',{ref:viewport,class:'story-player__viewport'},Array.from({length:3},(_,index)=>h('section',{ref:el=>slides.value[index]=el,class:'story-player__slide','data-page-key':index===1?'ratingRank':index===0?'keyword':'monthly','aria-hidden':active.value!==index},index===1?[h(RatingRank,{summary,pageIndex:7,pageTotal:21,active:active.value===1,reducedMotion:true})]:[h('div',{class:'placeholder'},index===0?'PAGE 07':'PAGE 09')])))]);
}};
createApp(App).mount('#app');
`);
await writeFile(`${temp}/style.css`, '');

let server;
let browser;
const report = [];
try {
  server = await createServer({
    configFile: false,
    root: temp,
    publicDir: resolve(root, 'public'),
    define: { 'process.client': 'true', 'process.server': 'false', 'import.meta.client': 'true' },
    plugins: [
      {
        name: 'rating-rank-fixture-shell',
        transformIndexHtml(html) {
          return html.replace('</head>', `<style>
            :root { --annual-stage-height: 100dvh; }
            * { box-sizing: border-box; }
            html, body, #app { width: 100%; height: 100%; margin: 0; overflow: hidden; }
            .story-player, .story-player__viewport, .story-player__slide { height: 100vh; height: 100svh; height: var(--annual-stage-height, 100dvh); }
            .story-player__viewport { position: relative; overflow-y: auto; overflow-x: hidden; scroll-snap-type: y mandatory; scrollbar-width: none; }
            .story-player__slide { min-height: 100vh; min-height: 100svh; min-height: var(--annual-stage-height, 100dvh); overflow: hidden; scroll-snap-align: start; scroll-snap-stop: always; }
            .placeholder { width: 100%; height: 100%; display: grid; place-items: center; }
          </style></head>`);
        }
      },
      vue()
    ],
    resolve: { alias: {
      '~': root,
      '@': root,
      'vue': resolve(root, 'node_modules/vue/dist/vue.esm-bundler.js'),
      'gsap': resolve(root, 'node_modules/gsap/index.js')
    } },
    server: { host: '127.0.0.1', port: 0, fs: { allow: [root, temp] } }
  });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });

  const measure = (page, label) => page.evaluate((caseLabel) => {
    const rect = (selector) => {
      const value = document.querySelector(selector).getBoundingClientRect();
      return { top: +value.top.toFixed(2), bottom: +value.bottom.toFixed(2), height: +value.height.toFixed(2) };
    };
    const stage = rect('.story-player__slide[data-page-key="ratingRank"]');
    const scene = rect('.annual-rating-rank-scene');
    const content = rect('.annual-rating-rank-scene__content');
    const chart = rect('.annual-rating-waterfall-chart');
    const visual = rect('.annual-rating-rank-scene__visual');
    const svg = rect('.annual-rating-waterfall-chart__svg');
    const axis = rect('.annual-rating-waterfall-chart__axis');
    const axisLabels = rect('.annual-rating-waterfall-chart__labels');
    const marker = rect('.annual-rating-waterfall-chart__marker');
    const header = rect('.annual-rating-rank-scene__header');
    const title = rect('.annual-rating-rank-scene__title');
    const summary = rect('.annual-rating-rank-scene__summary');
    const viewport = rect('.story-player__viewport');
    const next = rect('.story-player__slide[data-page-key="monthly"]');
    const svgElement = document.querySelector('.annual-rating-waterfall-chart__svg');
    const axisSafeArea = Number.parseFloat(svgElement.dataset.axisSafeArea || '0');
    const viewBoxHeight = svgElement.viewBox.baseVal.height;
    const renderedAxisScale = Math.abs(svgElement.getScreenCTM()?.d || 0);
    const axisSafeMargin = +(axisSafeArea * (renderedAxisScale || svg.height / viewBoxHeight)).toFixed(2);
    const tickLabels = [...document.querySelectorAll('.annual-rating-waterfall-chart__labels text')].map((item) => item.textContent.trim());
    const rankTags = [...document.querySelectorAll('.annual-rating-waterfall-chart__rank-tags text')].map((item) => {
      const value = item.getBoundingClientRect();
      return { text: item.textContent.trim(), top: +value.top.toFixed(2), bottom: +value.bottom.toFixed(2) };
    });
    const bottomRank = rankTags.reduce((lowest, item) => !lowest || item.bottom > lowest.bottom ? item : lowest, null);
    return {
      label: caseLabel,
      innerHeight: window.innerHeight,
      visualViewport: window.visualViewport ? { height: +window.visualViewport.height.toFixed(2), offsetTop: +window.visualViewport.offsetTop.toFixed(2), scale: window.visualViewport.scale } : null,
      annualStageHeight: +Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--annual-stage-height')).toFixed(2),
      stage, scene, content, chart, visual, svg, axis, axisLabels, marker, header, title, summary, viewport, next,
      axisSafeArea,
      axisSafeMargin,
      axisClearance: +(visual.bottom - axisLabels.bottom).toFixed(2),
      tickLabels,
      rankTagCount: rankTags.length,
      bottomRank,
      layerCount: document.querySelectorAll('.annual-rating-waterfall-chart__layer').length,
      nextVisible: next.top < viewport.bottom - 1,
      documentOverflow: document.documentElement.scrollHeight > window.innerHeight + 1,
      scrollY: window.scrollY,
      reduced: document.querySelector('.annual-rating-rank-scene')?.classList.contains('is-reduced') || false
    };
  }, label);

  const assertRatingRank = (metrics) => {
    const tolerance = 2;
    assert.ok(Math.abs(metrics.scene.height - metrics.annualStageHeight) <= tolerance, `${metrics.label}: scene height`);
    assert.ok(Math.abs(metrics.stage.height - metrics.annualStageHeight) <= tolerance, `${metrics.label}: stage height`);
    assert.ok(metrics.scene.top >= metrics.stage.top - tolerance && metrics.scene.bottom <= metrics.stage.bottom + tolerance, `${metrics.label}: scene within stage`);
    assert.ok(Math.abs(metrics.content.top - metrics.scene.top) <= tolerance && Math.abs(metrics.content.bottom - metrics.scene.bottom) <= tolerance, `${metrics.label}: content fills scene`);
    assert.ok(metrics.chart.height > 0 && metrics.chart.top >= metrics.scene.top - tolerance && metrics.chart.bottom <= metrics.scene.bottom + tolerance, `${metrics.label}: chart within scene`);
    assert.ok(
      metrics.visual.height > 0 && metrics.svg.top >= metrics.visual.top - tolerance && metrics.svg.bottom <= metrics.visual.bottom + tolerance,
      `${metrics.label}: svg within visual (${JSON.stringify({ visual: metrics.visual, chart: metrics.chart, svg: metrics.svg })})`
    );
    assert.ok(metrics.axis.top >= metrics.visual.top - tolerance && metrics.axis.bottom <= metrics.visual.bottom - metrics.axisSafeMargin + tolerance, `${metrics.label}: axis line safe area`);
    assert.ok(metrics.axisLabels.bottom <= metrics.visual.bottom - metrics.axisSafeMargin + tolerance, `${metrics.label}: axis labels safe area (${metrics.axisClearance}px >= ${metrics.axisSafeMargin}px)`);
    assert.deepEqual(metrics.tickLabels, ['0', '4', '8', '12', '16'], `${metrics.label}: all x-axis labels`);
    assert.equal(metrics.rankTagCount, 19, `${metrics.label}: all 19 rank labels`);
    assert.equal(metrics.layerCount, 19, `${metrics.label}: all 19 waterfall layers`);
    assert.ok(metrics.bottomRank && metrics.bottomRank.bottom <= metrics.visual.bottom - tolerance, `${metrics.label}: lowest rank visible`);
    assert.ok(metrics.marker.top >= metrics.visual.top - tolerance && metrics.marker.bottom <= metrics.visual.bottom - tolerance, `${metrics.label}: marker visible`);
    assert.ok(metrics.header.top >= metrics.scene.top - tolerance && metrics.title.bottom <= metrics.scene.bottom + tolerance, `${metrics.label}: header/title within scene`);
    assert.ok(metrics.summary.top >= metrics.scene.top - tolerance && metrics.summary.bottom <= metrics.scene.bottom + tolerance, `${metrics.label}: summary within scene`);
    assert.equal(metrics.nextVisible, false, `${metrics.label}: next slide must not be visible`);
    assert.equal(metrics.documentOverflow, false, `${metrics.label}: document overflow`);
    assert.equal(metrics.scrollY, 0, `${metrics.label}: document scroll`);
    assert.equal(metrics.reduced, true, `${metrics.label}: reduced motion`);
  };

  for (const [width, height] of [[360, 780], [390, 844], [430, 932]]) {
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: 'reduce',
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36 EdgA/140.0.0.0'
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);

    const capture = async (label) => {
      const metrics = await measure(page, `${width}x${page.viewportSize().height}-${label}`);
      assertRatingRank(metrics);
      report.push(metrics);
      await page.screenshot({ path: `${outputDir}/${width}x${page.viewportSize().height}-${label}.png` });
    };

    await capture('initial');

    await page.setViewportSize({ width, height: height - 120 });
    await page.waitForTimeout(300);
    await capture('toolbar-expanded');

    await page.setViewportSize({ width, height });
    await page.waitForTimeout(300);
    await capture('toolbar-collapsed');

    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    await page.waitForTimeout(300);
    await capture('pageshow');

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__ratingRankQa.index()), 1, `${width}: reload restores page 08`);
    await capture('reload-page-08');

    await page.evaluate(() => window.__ratingRankQa.go(2));
    await page.waitForTimeout(80);
    assert.equal(await page.evaluate(() => window.__ratingRankQa.index()), 2, `${width}: next page`);
    await page.evaluate(() => window.__ratingRankQa.go(1));
    await page.waitForTimeout(300);
    await capture('next-back-page-08');

    assert.deepEqual(errors, [], `${width}: browser errors`);
    await context.close();
  }

  await writeFile(`${outputDir}/report.json`, `${JSON.stringify({ browser: 'Chromium emulation', cases: report }, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, browser: 'Chromium emulation', cases: report.length, viewports: [360, 390, 430] }));
} finally {
  await browser?.close();
  await server?.close();
  await rm(temp, { recursive: true, force: true });
}
