import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { parse, compileScript, compileStyle } from '@vue/compiler-sfc';
import { chromium } from 'playwright-core';
import { qaTempPrefix } from './fixtures/qaPaths.mjs';

const root = new URL('../', import.meta.url).pathname;
const dimensions = { big_song: 11.1, stamina: 10.8, speed: 10.4, accuracy_power: 10.5, rhythm: 11.2, complex: 11.3 };
const point = (id, overrides = {}) => ({ id, capturedAt: `2026-11-${id === 'start' ? '16' : '21'}T06:21:00Z`,
  rating: 10.3, dimensions, focus: 'speed', sampleCount: 30, availabilityState: 'ready',
  measurementVersion: 1, algorithmVersion: 'growth-v1', modelRevision: 'a', ...overrides });

test('weekly renders all seven metrics for changed versions, limited data, zeroes and missing records', { timeout: 60000 }, async () => {
  const directory = await mkdtemp(qaTempPrefix('weekly-display-'));
  let browser;
  try {
    const source = await readFile(resolve(root, 'components/rework/weekly/Change.vue'), 'utf8');
    const { descriptor } = parse(source);
    const style = compileStyle({ source: descriptor.styles[0].content, filename: 'Change.vue', id: 'data-v-weekly', scoped: true }).code;
    const bundle = await build({ stdin: { contents: `
      import {createSSRApp,h} from 'vue';
      import {renderToString} from '@vue/server-renderer';
      import {createI18n} from 'vue-i18n';
      import Change from './components/rework/weekly/Change.vue';
      import zh from './locales/zh.json'; import ja from './locales/ja.json';
      import {buildWeeklyMeasurementChange} from './server/services/growth-weekly/composer.ts';
      export async function render(points,locale='zh') {
        const change=points===null?null:buildWeeklyMeasurementChange(points);
        const app=createSSRApp({render:()=>h(Change,{change,completeWeek:false,focusText:''})});
        app.use(createI18n({legacy:false,locale,messages:{zh,ja}}));
        app.component('ReworkPanel',{props:['title'],setup:(p,{slots})=>()=>h('section',{class:'panel'},[h('h2',p.title),slots.actions?.(),slots.default?.()])});
        return {html:await renderToString(app),change};
      }`, resolveDir: root }, bundle: true, platform: 'node', format: 'esm', write: false,
      alias: { '~': root }, logLevel: 'silent', plugins: [{ name: 'vue', setup(b) {
        b.onLoad({ filter: /Change\.vue$/ }, () => ({ loader: 'ts', resolveDir: resolve(root, 'components/rework/weekly'), contents:
          `import {computed} from 'vue'; import {useI18n} from 'vue-i18n';\n` +
          compileScript(descriptor, { id: 'weekly', inlineTemplate: true }).content.replace('export default', 'const component =') +
          `\ncomponent.__scopeId='data-v-weekly';export default component;` }));
      }}] });
    const modulePath = resolve(directory, 'display.mjs');
    await writeFile(modulePath, bundle.outputFiles[0].text);
    const { render } = await import(pathToFileURL(modulePath));
    const start = point('start');
    const cases = [
      [start, point('end')],
      ...[{ modelRevision: 'b' }, { modelRevision: null }, { algorithmVersion: 'daily-v1' }, { measurementVersion: 2 }, { availabilityState: 'limited' }]
        .map(metadata => [start, point('end', { ...metadata, rating: 10.6, dimensions: { ...dimensions, speed: 10.8 } })]),
      [start, point('end', { availabilityState: 'limited', algorithmVersion: 'changed', rating: 10.6 })],
      [start, point('end', { rating: null, dimensions: { ...dimensions, speed: null } })],
      [point('end')], [], null
    ];
    const rendered = [];
    for (const locale of ['zh', 'ja']) for (const points of cases) {
      const { html, change } = await render(points, locale);
      assert.equal((html.match(/scope="row"/g) || []).length, 7, 'every state retains Rating and six dimensions');
      assert.doesNotMatch(html, /<details|暂不展示|記録方法|weekly\.measurement\./);
      if (points?.length === 2 && change.ratingDelta === 0) assert.match(html, /wc-delta[^>]*>0\.00</);
      if (points?.length === 2 && points[1].rating === 10.6) {
        assert.match(html, /\+0\.30/);
        if (points[1].dimensions.speed === 10.8) assert.match(html, /\+0\.40/);
      }
      if (points?.length === 2 && (points[0].algorithmVersion !== points[1].algorithmVersion ||
        points[0].measurementVersion !== points[1].measurementVersion ||
        points[0].modelRevision && points[1].modelRevision && points[0].modelRevision !== points[1].modelRevision)) {
        assert.match(html, /wc-model-notice/);
        assert.match(html, locale === 'zh' ? /期间计算模型有变化/ : /期間中に計算モデルが変更/);
      }
      if (!points?.length || points.length === 1) assert.match(html, /wc-delta[^>]*>—</);
      rendered.push(html);
    }
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      const tokens = await readFile(resolve(root, 'assets/css/ds/tokens.css'), 'utf8');
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.setContent(`<style>${tokens}\n${style}\nbody{margin:0;padding:16px;box-sizing:border-box;font-family:sans-serif}.panel{max-width:380px}</style>${rendered.join('')}`);
        assert.equal(await page.locator('table').count(), rendered.length);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow');
        assert.ok(await page.locator('td').evaluateAll(cells => cells.every(cell => cell.scrollWidth <= cell.clientWidth + 1)), 'numeric values fit their cells');
        if (width === 390) await page.screenshot({ path: resolve(process.env.QA_EVIDENCE_DIR, 'weekly-measurements.png') });
      }
      await page.close();
    } finally { await context.close(); }
  } finally {
    if (browser) await browser.close();
    await rm(directory, { recursive: true, force: true });
  }
});
