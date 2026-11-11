// Public read-only smoke. Run through scripts/memory/run_qa.sh after deployment.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { calculateV1, calculateV2 } from '../utils/rtCalculator.ts';

const base = process.env.RT_QA_BASE_URL || 'https://viewer.sakura-bot.cn';
const out = process.env.QA_EVIDENCE_DIR;
assert.ok(out, 'Use the bounded QA runner');
const songId = 1172;
let browser, context, page;
const errors = [], checks = [];
const deadline = setTimeout(() => { void browser?.close(); process.exitCode = 124; }, 120000);
async function get(path, expected = 200) {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, expected, path);
  return response.json();
}
async function checkRating(version, counts, payload) {
  const chart = version === 'v1' ? payload.v1.find(c => c.level === 4) : payload.v2.find(c => c.difficulty === 'oni');
  const expected = version === 'v1' ? calculateV1(chart, counts) : calculateV2(chart, counts);
  await page.waitForFunction(text => document.querySelector('.rt-output .rating strong')?.textContent === text, expected.rating.toFixed(4));
  const actual = await page.locator('.rt-output .dimensions dd').allTextContents();
  assert.deepEqual(actual, expected.dimensions.map(x => x.toFixed(4)));
}
try {
  await mkdir(out, { recursive: true });
  await get('/api/tools/rt-calculator?songId=bad', 400);
  await get('/api/tools/rt-calculator?songId=999999999', 404);
  const payload = await get(`/api/tools/rt-calculator?songId=${songId}`);
  const chart = payload.v2.find(c => c.difficulty === 'oni');
  assert.ok(chart && payload.v1.find(c => c.level === 4), 'Real chart has both versions');
  checks.push('public API, invalid ID, absent song, real V1/V2 data');
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'], timeout: 15000 });
  context = await browser.newContext({ viewport: { width: 1366, height: 900 }, reducedMotion: 'reduce' });
  page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message.slice(0, 180)));
  await page.goto(`${base}/tools/rt-calculator?songId=${songId}&level=4`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('#rt-ok').fill('10'); await page.locator('#rt-bad').fill('2');
  assert.equal(await page.locator('#rt-good').inputValue(), String(chart.totalNotes - 12));
  await checkRating('v2', { good: chart.totalNotes - 12, ok: 10, bad: 2 }, payload);
  const select = page.locator('.judgment-toolbar select');
  await select.selectOption('bad');
  await page.locator('#rt-good').fill(String(chart.totalNotes - 20));
  assert.equal(await page.locator('#rt-bad').inputValue(), '10');
  await checkRating('v2', { good: chart.totalNotes - 20, ok: 10, bad: 10 }, payload);
  await select.selectOption('manual'); await page.locator('#rt-bad').fill('99999');
  await page.locator('#rt-validation').waitFor();
  assert.equal(await page.locator('.rating strong').textContent(), '—');
  await page.getByRole('button', { name: '全良', exact: true }).click();
  await checkRating('v2', { good: chart.totalNotes, ok: 0, bad: 0 }, payload);
  await page.locator('#rt-good').fill('1.5'); await page.locator('#rt-validation').waitFor();
  await page.getByRole('button', { name: '全良', exact: true }).click();
  await page.locator('#rt-good').fill('0'); await page.locator('#rt-bad').fill(String(chart.totalNotes));
  await page.getByText('精度低于 75%，不计入 Rating。', { exact: true }).waitFor();
  checks.push('real V2 scores, auto-fill modes, manual total, decimal rejection, full judgments, threshold');
  await page.locator('.selection-row select').first().selectOption('v1');
  await page.getByRole('button', { name: '全良', exact: true }).click();
  const v1 = payload.v1.find(c => c.level === 4);
  await checkRating('v1', { good: v1.totalNotes, ok: 0, bad: 0 }, payload);
  await page.screenshot({ path: resolve(out, 'rt-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile overflow');
  await page.screenshot({ path: resolve(out, 'rt-mobile.png'), fullPage: true });
  await page.evaluate(() => { document.body.classList.add('theme-dark'); document.documentElement.dataset.theme = 'dark'; });
  await page.screenshot({ path: resolve(out, 'rt-mobile-dark.png'), fullPage: true });
  checks.push('real V1 scores, desktop, mobile, dark theme');
  await page.locator('.selection-row select').first().selectOption('v2');
  const search = page.locator('.rt-controls [role="combobox"]');
  await search.fill('2F29');
  await page.getByRole('option').filter({ hasText: '2F29' }).first().waitFor();
  await page.keyboard.press('Escape');
  await page.goto(`${base}/ja/tools/rt-calculator?songId=${songId}&level=4`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '全良', exact: true }).click();
  await checkRating('v2', { good: chart.totalNotes, ok: 0, bad: 0 }, payload);
  await page.goto(`${base}/tools/rt-calculator`, { waitUntil: 'domcontentloaded' });
  await page.getByText('请选择歌曲', { exact: true }).waitFor();
  assert.equal(await page.locator('.rating strong').textContent(), '—');
  checks.push('real song search, Japanese, empty selection');
  assert.equal(errors.length, 0, errors.join('\n'));
  await writeFile(resolve(out, 'rt-smoke.json'), JSON.stringify({ status: 'PASS', base, checks, errors }, null, 2));
  console.log(JSON.stringify({ status: 'PASS', checks, evidence: out }));
} finally {
  await page?.close(); await context?.close(); await browser?.close(); clearTimeout(deadline);
}
