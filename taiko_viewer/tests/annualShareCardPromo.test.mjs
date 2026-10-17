import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFile(resolve(root, path), 'utf8');

test('preview stays footer-free while the canonical export appends the promo footer', async () => {
  const [posterSlide, renderPage, exportComponent, footer] = await Promise.all([
    read('components/account/version-summary/slides/PosterSlide.vue'),
    read('pages/account/annual-share-card/[summaryId].vue'),
    read('components/account/version-summary/AnnualShareCardExport.vue'),
    read('components/account/version-summary/AnnualShareCardPromoFooter.vue')
  ]);

  assert.match(posterSlide, /<AnnualShareGrid\b/);
  assert.doesNotMatch(posterSlide, /AnnualShareCard(?:Export|PromoFooter)/);
  assert.match(renderPage, /<AnnualShareCardExport\b/);
  assert.doesNotMatch(renderPage, /<AnnualShareGrid\b/);
  assert.match(exportComponent, /<AnnualShareGrid[^>]*export-mode/);
  assert.match(exportComponent, /<AnnualShareCardPromoFooter\b/);
  assert.match(exportComponent, /--share-card-content-height:\s*1648px/);
  assert.match(exportComponent, /--share-card-footer-height:\s*224px/);
  assert.match(renderPage, /height:1872px/);

  for (const token of [
    '--promo-footer-height: 224px',
    '--promo-padding-x: 52px',
    '--promo-padding-y: 34px',
    '--promo-qr-size: 136px',
    '--promo-content-gap: 40px',
    '--promo-line-gap: 8px'
  ]) assert.ok(footer.includes(token), `missing footer token: ${token}`);
});

test('promo copy and QR target are public, localized, and failure-safe', async () => {
  const [constants, footer, service, poster] = await Promise.all([
    read('server/services/account/annual-summary/constants.ts'),
    read('components/account/version-summary/AnnualShareCardPromoFooter.vue'),
    read('server/services/account/annual-summary/index.ts'),
    read('server/services/account/annual-summary/poster.ts')
  ]);

  assert.match(constants, /ANNUAL_SHARE_CARD_PROMO_URL = "https:\/\/viewer\.sakura-bot\.cn\/annual\?from=poster"/);
  assert.match(footer, /Sakura Taiko/);
  assert.match(footer, /生成你的太鼓年度报告/);
  assert.match(footer, /あなたの太鼓年間レポートを作成/);
  assert.match(footer, /viewer\.sakura-bot\.cn/);
  assert.doesNotMatch(footer, /user_id|userId|summary_id|summaryId|token|invite/i);
  assert.match(footer, /@error="qrFailed = true"/);
  assert.match(footer, /v-else class="annual-share-card-promo__qr-fallback"/);
  assert.match(service, /if \(!promoQrCodeDataUrl\)/);
  assert.match(service, /二维码生成失败/);
  assert.match(poster, /errorCorrectionLevel: "H"/);
  assert.match(poster, /margin: 4/);
  assert.match(poster, /dark: "#101921", light: "#FFFFFF"/);
});

test('renderer dimensions and cache identity advance together', async () => {
  const [constants, service, renderer, schema] = await Promise.all([
    read('server/services/account/annual-summary/constants.ts'),
    read('server/services/account/annual-summary/index.ts'),
    read('server/services/account/annual-summary/poster.ts'),
    read('server/utils/account-schema-definition.ts')
  ]);

  assert.match(constants, /ANNUAL_SHARE_CARD_CONTENT_HEIGHT = 1648/);
  assert.match(constants, /ANNUAL_SHARE_CARD_PROMO_FOOTER_HEIGHT = 224/);
  assert.match(constants, /ANNUAL_SHARE_CARD_HEIGHT = ANNUAL_SHARE_CARD_CONTENT_HEIGHT \+ ANNUAL_SHARE_CARD_PROMO_FOOTER_HEIGHT/);
  assert.match(constants, /ANNUAL_SHARE_CARD_RENDERER_REVISION = "share-card-v4-static-capture"/);
  assert.match(service, /ANNUAL_SHARE_CARD_WIDTH}x\$\{ANNUAL_SHARE_CARD_HEIGHT}:\$\{ANNUAL_SHARE_CARD_RENDERER_REVISION}/);
  assert.match(renderer, /width: ANNUAL_SHARE_CARD_WIDTH/);
  assert.match(renderer, /height: ANNUAL_SHARE_CARD_HEIGHT/);
  assert.match(schema, /height INT UNSIGNED NOT NULL DEFAULT 1872/);
});

test('export retains the existing artwork fallback contract', async () => {
  const [grid, exportComponent] = await Promise.all([
    read('components/account/version-summary/AnnualShareGrid.vue'),
    read('components/account/version-summary/AnnualShareCardExport.vue')
  ]);

  assert.match(exportComponent, /import AnnualShareGrid/);
  assert.match(grid, /<AnnualCover/);
  assert.match(grid, /<AnnualArtworkFallback v-else kind="don"/);
  assert.match(grid, /resolvePosterCover\(cell\.song\)/);
});
