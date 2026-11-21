import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { parse, compileScript, compileStyle } from '@vue/compiler-sfc';
import { chromium } from 'playwright-core';
import { qaTempPrefix } from './fixtures/qaPaths.mjs';

const root = new URL('../', import.meta.url).pathname;

test('daily and weekly show actual rank images and arrows alongside PB without duplicate rank text', { timeout: 60000 }, async () => {
  const directory = await mkdtemp(qaTempPrefix('growth-ranks-'));
  const styles = [];
  let browser;
  try {
    const bundle = await build({ stdin: { contents: `
      import {createSSRApp,h,computed} from 'vue';
      import {renderToString} from '@vue/server-renderer';
      import {createI18n,useI18n} from 'vue-i18n';
      import Daily from './components/home/DailyProgress.vue';
      import Weekly from './components/rework/weekly/Highlights.vue';
      import Rank from './components/ds/Rank.vue';
      import Crown from './components/ds/Crown.vue';
      import zh from './locales/zh.json'; import ja from './locales/ja.json';
      import {buildWeeklyGrowthRecap} from './server/services/growth-weekly/composer.ts';
      globalThis.computed=computed; globalThis.useI18n=useI18n;
      globalThis.useLocalePath=()=>value=>typeof value==='string'?value:value.path;
      const facts=[['rank-upgrade',6,7,1],['score-pb',954710,964670,9960]].map(([type,before,after,delta],i)=>({
        id:'fact-'+i,factKey:'fact-'+i,ownerId:'1',bindingId:'2',songId:1366,difficultyType:5,title:'宝物之丘',
        type,before,after,delta,goalId:null,goalType:null,
        evidence:{source:'score-history',sourceRevision:'r1',evidenceVersion:1},
        temporal:{attributedDay:'2026-11-21',occurredAt:null,observedAt:'2026-11-21T09:00:00Z',confirmedAt:null,precision:'day'}
      }));
      const extra=[1381,819].map(songId=>({...facts[1],id:'pb-'+songId,factKey:'pb-'+songId,songId}));
      const history={facts:[...facts,...extra],measurements:[],coverage:{scoreHistoryState:'complete'}};
      const highlights=buildWeeklyGrowthRecap(history,{from:'2026-11-16',to:'2026-11-21',isCompleteWeek:false},null).highlights;
      const progress={calendarDay:'2026-11-21',attendance:'played',uniqueCharts:17,
        events:[{songId:1366,level:5,title:'宝物之丘',evidenceRevision:'r1',facts}]};
      export async function render(locale='zh',primaryRank=false) {
        const items=primaryRank?[{...highlights.find(h=>h.songId===1366),primaryType:'rank-upgrade',primaryFactKey:facts[0].factKey,before:6,after:7}]:highlights;
        const app=createSSRApp({render:()=>h('main',[h(Daily,{progress,original:progress}),h(Weekly,{items,change:h=>'最好成绩 '+h.before.toLocaleString('en-US')+' → '+h.after.toLocaleString('en-US')})])});
        app.use(createI18n({legacy:false,locale,messages:{zh,ja}}));
        app.component('DsRank',Rank);
        app.component('DsCrown',Crown);
        app.component('DsCover',{render:()=>h('span',{class:'cover'})});
        app.component('NuxtLink',{props:['to'],setup:(p,{slots})=>()=>h('a',{href:p.to},slots.default?.())});
        return await renderToString(app);
      }`, resolveDir: root }, bundle: true, platform: 'node', format: 'esm', write: false,
      alias: { '~': root }, logLevel: 'silent', plugins: [{ name: 'vue', setup(b) {
        b.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
          const { descriptor } = parse(await readFile(path, 'utf8'));
          const id = `rank-${styles.length}`;
          for (const style of descriptor.styles) styles.push(compileStyle({ source: style.content, filename: path, id: `data-v-${id}`, scoped: style.scoped }).code);
          return { loader: 'ts', resolveDir: dirname(path), contents:
            compileScript(descriptor, { id, inlineTemplate: true }).content.replace('export default', 'const component =') +
            `\ncomponent.__scopeId='data-v-${id}';export default component;` };
        });
      }}] });
    const modulePath = resolve(directory, 'display.mjs');
    await writeFile(modulePath, bundle.outputFiles[0].text);
    const { render } = await import(pathToFileURL(modulePath));
    const tokens = await readFile(resolve(root, 'assets/css/ds/tokens.css'), 'utf8');
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      try {
        await page.route(/\/icons\/rank\/(56|80)\/[2-8]\.(png|webp)$/, route => route.fulfill({ path: resolve(root, 'public', new URL(route.request().url()).pathname.slice(1)) }));
        for (const locale of ['zh', 'ja']) for (const primaryRank of [false, true]) {
          const html = await render(locale, primaryRank);
          await page.setContent(`<html class="viewer-rework"><head><base href="https://viewer.sakura-bot.cn/"><style>${tokens}\n${styles.join('\n')}\nbody{margin:16px}.growth-progress{max-width:400px}main{max-width:752px}</style></head><body>${html}</body></html>`);
          await page.waitForFunction(() => [...document.querySelectorAll('.ds-rank img')].every(image => image.complete && image.naturalWidth > 0), null, { timeout: 10000 });
          const daily = page.locator('.growth-progress .ds-rank--upgrade');
          const weekly = page.locator('.weekly-highlight .ds-rank--upgrade');
          assert.equal(await daily.count(), 1);
          assert.equal(await weekly.count(), 1, 'PB theme must retain accompanying rank; rank theme must not duplicate it');
          for (const rank of [daily, weekly]) {
            assert.equal(await rank.locator('picture img').count(), 2);
            assert.equal(await rank.locator('svg').count(), 1);
            assert.equal((await rank.innerText()).trim(), '', 'rank names and label are accessible only');
            assert.ok(await rank.getAttribute('aria-label'));
            assert.ok(await rank.locator('img').evaluateAll(images => images.every(image => /rank\//.test(image.src))));
          }
          assert.equal(await page.locator('.ds-rank__name').count(), 0);
          assert.match(await page.locator('.growth-event__facts').innerText(), /954,710.*964,670/s);
          assert.match(await page.locator('.weekly-highlight').first().innerText(), /954,710.*964,670/s);
          for (const width of [320, 390, 1440]) {
            await page.setViewportSize({ width, height: 900 });
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow');
          }
          if (locale === 'zh' && !primaryRank) await page.screenshot({ path: resolve(process.env.QA_EVIDENCE_DIR, 'growth-rank-display.png') });
        }
      } finally { await page.close(); }
    } finally { await context.close(); }
  } finally {
    if (browser) await browser.close();
    await rm(directory, { recursive: true, force: true });
  }
});
