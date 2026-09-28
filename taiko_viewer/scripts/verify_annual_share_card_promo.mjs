import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import QRCode from 'qrcode';
import sharp from 'sharp';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';

const root = process.cwd();
const outputRoot = process.env.ANNUAL_PROMO_QA_OUT || '/var/tmp/annual-export-promo';
const promoUrl = 'https://viewer.sakura-bot.cn/annual?from=poster';
const qrCodeDataUrl = await QRCode.toDataURL(promoUrl, {
  errorCorrectionLevel: 'H', margin: 4, width: 544,
  color: { dark: '#101921', light: '#FFFFFF' }
});
const artwork = (fill, label) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${fill}"/><text x="200" y="215" text-anchor="middle" font-size="52" fill="#17365d">${label}</text></svg>`)}`;
const temp = await mkdtemp(resolve(root, 'node_modules/.annual-promo-'));
await mkdir(outputRoot, { recursive: true });
await writeFile(resolve(temp, 'index.html'), '<html><head><link rel="icon" href="data:,"></head><body style="margin:0"><div id="app"></div><script type="module" src="/main.js"></script></body></html>');
await writeFile(resolve(temp, 'main.js'), `
import {createApp,h} from 'vue';
import ExportCard from '${root}/components/account/version-summary/AnnualShareCardExport.vue';
import Grid from '${root}/components/account/version-summary/AnnualShareGrid.vue';
const params=new URLSearchParams(location.search);const locale=params.get('lang')==='ja'?'ja':'zh';const view=params.get('view')||'export';
const song=(name,coverUrl)=>({name,coverUrl,subtitle:''});
const summary={summaryId:'promo-qa',user:{nickname:'樱花鼓众'},profileCard:{nickname:'樱花鼓众',title:'春日演奏家',danName:'十段',myDonUrl:${JSON.stringify(artwork('#e5f1fb', 'DON'))}},overview:{playCount:1095,uniqueSongs:286,currentClearCharts:642},period:{activeDays:218},favoriteSong:song('星屑ストラック',${JSON.stringify(artwork('#ffd6df', 'A'))}),pound:{topSong:song('幽玄ノ乱',${JSON.stringify(artwork('#d9f2ff', 'B'))}),speed:23.75},highScore:{song:song('万戈イム－一ノ十',${JSON.stringify(artwork('#fff1c9', 'C'))}),score:1002340},timeOfDay:{topPeriod:'evening',topLabel:locale==='ja'?'夕方':'傍晚',periods:[{key:'evening',range:'16–19'}],favoriteHourLabel:'17'},ratingRank:{rankLabel:'十段',rating:13256.78},finalTitle:{title:locale==='ja'?'一年一鼓、歩みは続く':'一年一鼓，一路同行',body:''},poster:{title:''}};
const node=view==='preview'?h(Grid,{summary,locale}):view==='content'?h(Grid,{summary,locale,exportMode:true,style:'width:1080px;height:1648px;aspect-ratio:auto'}):view==='missing-qr'?h(ExportCard,{summary,locale,qrCodeDataUrl:'',qrTargetUrl:${JSON.stringify(promoUrl)}}):h(ExportCard,{summary,locale,qrCodeDataUrl:${JSON.stringify(qrCodeDataUrl)},qrTargetUrl:${JSON.stringify(promoUrl)}});
createApp({render:()=>node}).mount('#app');
`);

let server;
let browser;
const report = { result: 'FAIL', outputRoot, cases: [] };
try {
  server = await createServer({
    configFile: false,
    root: temp,
    publicDir: resolve(root, 'public'),
    plugins: [vue()],
    resolve: { alias: { '~': root, '@': root } },
    server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } }
  });
  await server.listen();
  const baseUrl = server.resolvedUrls.local[0];
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--font-render-hinting=none'] });

  const capture = async (view, locale, width, height, name) => {
    const page = await browser.newPage({ viewport: { width, height }, locale: locale === 'ja' ? 'ja-JP' : 'zh-CN' });
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.continue() : route.abort('blockedbyclient');
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${baseUrl}?view=${view}&lang=${locale}`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
    const metrics = await page.evaluate(() => {
      const rect = (selector) => { const r = document.querySelector(selector)?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right } : null; };
      return {
        export: rect('.annual-share-card-export'),
        grid: rect('.annual-share-grid'),
        footer: rect('.annual-share-card-promo'),
        qr: rect('.annual-share-card-promo__qr'),
        footerCount: document.querySelectorAll('.annual-share-card-promo').length,
        qrTarget: document.querySelector('.annual-share-card-promo')?.getAttribute('data-qr-target') || '',
        brokenImages: [...document.images].filter(image => !image.complete || !image.naturalWidth).length,
        fallbackVisible: Boolean(document.querySelector('.annual-share-card-promo__qr-fallback')),
        text: document.body.innerText
      };
    });
    const path = resolve(outputRoot, name);
    await page.screenshot({ path, fullPage: false, animations: 'disabled' });
    await page.close();
    report.cases.push({ view, locale, errors, metrics, path });
    assert.deepEqual(errors, []);
    assert.equal(metrics.brokenImages, 0);
    return { path, metrics };
  };

  const preview = await capture('preview', 'zh', 414, 632, 'preview-zh.png');
  assert.equal(preview.metrics.footerCount, 0, 'preview must not contain footer DOM');

  const baseline = await capture('content', 'zh', 1080, 1648, 'content-baseline.png');
  const zh = await capture('export', 'zh', 1080, 1872, 'export-zh.png');
  const ja = await capture('export', 'ja', 1080, 1872, 'export-ja.png');
  for (const item of [zh, ja]) {
    assert.deepEqual(item.metrics.export, { x: 0, y: 0, width: 1080, height: 1872, bottom: 1872, right: 1080 });
    assert.deepEqual(item.metrics.grid, { x: 0, y: 0, width: 1080, height: 1648, bottom: 1648, right: 1080 });
    assert.deepEqual(item.metrics.footer, { x: 0, y: 1648, width: 1080, height: 224, bottom: 1872, right: 1080 });
    assert.equal(item.metrics.qr.width, 136);
    assert.equal(item.metrics.qr.height, 136);
    assert.equal(item.metrics.qrTarget, promoUrl);
  }
  assert.match(zh.metrics.text, /生成你的太鼓年度报告/);
  assert.match(ja.metrics.text, /あなたの太鼓年間レポートを作成/);

  const baselineRaw = await sharp(baseline.path).raw().toBuffer();
  const exportedTopRaw = await sharp(zh.path).extract({ left: 0, top: 0, width: 1080, height: 1648 }).raw().toBuffer();
  const baselineHash = createHash('sha256').update(baselineRaw).digest('hex');
  const exportedTopHash = createHash('sha256').update(exportedTopRaw).digest('hex');
  assert.equal(exportedTopHash, baselineHash, 'the original 1080x1648 content changed inside the full export');

  const missing = await capture('missing-qr', 'zh', 1080, 1872, 'export-missing-qr.png');
  assert.equal(missing.metrics.fallbackVisible, true);
  assert.equal(missing.metrics.qr, null);

  report.result = 'PASS';
  report.pixelIdentity = { baselineHash, exportedTopHash };
  await writeFile(resolve(outputRoot, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log('Annual share-card promo verification PASS');
} finally {
  await browser?.close();
  await server?.close();
  await rm(temp, { recursive: true, force: true });
}
