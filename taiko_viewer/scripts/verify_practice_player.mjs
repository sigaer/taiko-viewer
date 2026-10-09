#!/usr/bin/env node
// One browser/page. Run through scripts/memory/run_qa.sh; only read-only online requests.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, open, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { zipSync, strToU8 } from 'fflate';

const remote = process.argv[2];
const base = remote || 'http://127.0.0.1:3197';
const output = '/var/tmp/practice-player-qa';
await mkdir(output, { recursive: true });
const log = await open(`${output}/dev.log`, 'w');
let server, browser, context, page, releaseBundle;
const results = [];
let rejectDeadline;
const deadlinePromise = new Promise((_, reject) => { rejectDeadline = reject; });
const deadline = setTimeout(() => rejectDeadline(new Error('Practice QA exceeded eight minutes')), 480_000);

async function run() {
  if (!remote) {
    server = spawn(process.execPath, [fileURLToPath(new URL('./practice_player_dev.mjs', import.meta.url))], {
      cwd: fileURLToPath(new URL('..', import.meta.url)), detached: true,
      stdio: ['ignore', log.fd, log.fd], env: { ...process.env, NUXT_TELEMETRY_DISABLED: '1' }
    });
    let listening = false;
    for (let i = 0; i < 90; i++) {
      if (server.exitCode !== null) throw new Error('Dev server exited');
      try { listening = (await fetch(`${base}/practice-player/release.json`, { signal: AbortSignal.timeout(2000) })).ok; } catch {}
      if (listening) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    assert.ok(listening, 'Dev server startup timed out');
  }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'] });
  context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await context.addInitScript(() => {
    window.__practiceReadyCount = 0;
    window.addEventListener('message', event => {
      if (event.origin === location.origin && event.data?.channel === 'ourtaiko-view' && event.data.type === 'ready') window.__practiceReadyCount++;
    });
  });
  page = await context.newPage();
  assert.ok(await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2')), 'QA browser must support WebGL 2');
  page.setDefaultTimeout(30_000);
  let failedResponses = 0;
  page.on('response', response => {
    if (response.status() >= 400 && failedResponses++ < 15) console.log('HTTP failure:', response.status(), new URL(response.url()).pathname);
  });
  const errors = [];
  let consoleErrors = 0;
  page.on('console', message => {
    if (['error', 'warning'].includes(message.type()) && consoleErrors++ < 12) console.log('browser:', message.text().slice(0, 300));
  });
  page.on('pageerror', error => { if (errors.length < 12) { errors.push(error.message.slice(0, 200)); console.log('pageerror:', error.message.slice(0, 200)); } });
  let scenario = remote ? 'online' : 'transient';
  const requests = new Map();
  let upstreamRequests = 0;
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname === 'fanmade.ourtaiko.org') { upstreamRequests++; return route.abort(); }
    if (!['GET', 'HEAD'].includes(request.method())) return route.abort();
    if (url.origin !== base) return route.abort();
    requests.set(url.pathname, (requests.get(url.pathname) || 0) + 1);
    if (scenario === 'transient' && (url.pathname === '/practice-player/release.json' || url.pathname.endsWith('/Web.loader.js') || url.pathname.endsWith('/Web.data.unityweb')) && requests.get(url.pathname) === 1) {
      return route.fulfill({ status: 503, body: 'Temporary QA failure' });
    }
    if (scenario === 'player-failure' && url.pathname === '/practice-player/release.json') return route.fulfill({ status: 503, body: 'Unavailable' });
    if (url.pathname.endsWith('/tja-package')) {
      if (scenario === 'held-bundle') await new Promise(resolve => {
        const timer = setTimeout(resolve, 30_000);
        releaseBundle = () => { clearTimeout(timer); resolve(); };
      });
      if (scenario === 'bundle-failure') return route.fulfill({ status: 404, body: 'Unavailable' });
      if (scenario === 'missing-course') {
        const body = Buffer.from(zipSync({ 'test.tja': strToU8('TITLE:QA\nWAVE:test.wav\nCOURSE:Oni\n#START\n0,\n#END'), 'test.wav': new Uint8Array([1]) }));
        return route.fulfill({ status: 200, contentType: 'application/zip', body });
      }
    }
    if (!remote && url.pathname.startsWith('/api/')) {
      const response = await route.fetch({ url: `http://127.0.0.1:3100${url.pathname}${url.search}`, timeout: 45_000 });
      return route.fulfill({ response });
    }
    return route.continue();
  });
  const navigation = await page.goto(`${base}/ourtaikoview/463/4`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  assert.equal(navigation.status(), 200, (await page.locator('body').innerText()).slice(0, 1200));
  console.log('Practice page opened');
  await page.waitForFunction(() => document.querySelector('.practice-page [role="alert"]') || document.querySelector('.practice-page [role="status"]')?.textContent?.includes('请在播放器中点击开始'), { }, { timeout: 180_000 });
  assert.equal(await page.locator('.practice-page [role="alert"]').count(), 0, await page.locator('.practice-page').innerText());
  const frame = page.frameLocator('.practice-page iframe');
  await frame.locator('#start').click();
  await page.waitForTimeout(1500);
  assert.equal(await frame.locator('#overlay').isVisible(), false);
  await page.getByRole('button', { name: '全屏', exact: true }).click();
  await page.waitForFunction(() => document.fullscreenElement?.tagName === 'IFRAME');
  await page.evaluate(() => document.exitFullscreen());
  await page.locator('.practice-page input[type="range"]').fill('35');
  await page.locator('.practice-page input[type="range"]').dispatchEvent('input');
  await page.screenshot({ path: `${output}/${remote ? 'online' : 'local'}-playing.png` });
  assert.equal(upstreamRequests, 0);
  assert.equal(errors.length, 0, errors.join('\n'));
  if (!remote) {
    for (const suffix of ['/practice-player/release.json', '/Web.loader.js', '/Web.data.unityweb']) {
      assert.ok([...requests].some(([path, count]) => path.endsWith(suffix) && count >= 2), `Retry missing for ${suffix}`);
    }
  }
  results.push({ scenario, loaded: true, started: true, fullscreen: true, upstreamRequests });
  console.log('Real Unity player loaded and started');
  scenario = remote ? 'healthy' : 'held-bundle';
  const before = requests.get('/practice-player/release.json');
  const beforeReady = await page.evaluate(() => window.__practiceReadyCount);
  await page.getByRole('button', { name: '重新加载', exact: true }).click();
  if (!remote) {
    await page.waitForFunction(count => window.__practiceReadyCount > count, beforeReady, { timeout: 30_000 });
    assert.ok(releaseBundle, 'Bundle request must run alongside player boot');
    releaseBundle();
    releaseBundle = undefined;
  }
  await page.waitForFunction(() => document.querySelector('.practice-page [role="status"]')?.textContent?.includes('请在播放器中点击开始'), {}, { timeout: 180_000 });
  assert.ok(requests.get('/practice-player/release.json') > before);
  results.push({ scenario: 'manual-retry', loaded: true, ...(remote ? {} : { playerReadyBeforeBundle: true }) });
  console.log('Manual reload passed');
  await page.getByRole('link', { name: '返回歌曲', exact: true }).click();
  await page.waitForURL(`${base}/songs/463`, { waitUntil: 'domcontentloaded' });
  // Nuxt may update history before the destination's async data finishes loading.
  await page.locator('.practice-page').waitFor({ state: 'detached' });
  assert.equal(page.frames().filter(frame => frame.url().includes('/practice-player/')).length, 0);
  results.push({ scenario: 'navigation-cleanup', passed: true });
  scenario = 'healthy';
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await page.frameLocator('.practice-page iframe').locator('#start').waitFor({ state: 'visible', timeout: 120_000 });
  assert.equal(await page.locator('.practice-page input[type="range"]').inputValue(), '100');
  results.push({ scenario: 'back-navigation', freshPlayerLoaded: true });
  console.log('Navigation cleanup and returning to practice passed');
  if (!remote) {
    for (const [name, expected, difficulty] of [
      ['bundle-failure', '谱面与音乐下载失败', 4],
      ['player-failure', '播放器加载失败', 4],
      ['missing-course', '此难度暂无可用谱面', 5]
    ]) {
      scenario = name;
      await page.goto(`${base}/ourtaikoview/463/${difficulty}`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('alert').filter({ hasText: expected }).waitFor();
      assert.equal(await page.locator('.practice-page iframe').count(), 0);
      results.push({ scenario, passed: true });
    }
  }
  await writeFile(`${output}/${remote ? 'online' : 'local'}-result.json`, JSON.stringify({ results, errors, upstreamRequests }, null, 2));
  console.log(JSON.stringify({ results, errors, upstreamRequests }));
}

try { await Promise.race([run(), deadlinePromise]); }
catch (error) {
  console.error('QA failed:', error.message.slice(0, 400));
  if (page && !page.isClosed()) {
    console.log('Failure state:', (await page.locator('body').innerText({ timeout: 3000 }).catch(() => 'Practice page unavailable')).slice(0, 1600));
    await page.screenshot({ path: `${output}/failure.png`, timeout: 5000 }).catch(() => {});
  }
  throw error;
}
finally {
  clearTimeout(deadline);
  const cleanupDeadline = setTimeout(() => { console.error('QA cleanup timed out'); process.exit(1); }, 15_000);
  releaseBundle?.();
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
  if (server && server.exitCode === null) {
    const exited = once(server, 'exit');
    process.kill(-server.pid, 'SIGTERM');
    const force = setTimeout(() => { try { process.kill(-server.pid, 'SIGKILL'); } catch {} }, 5000);
    await exited;
    clearTimeout(force);
  }
  await log.close();
  clearTimeout(cleanupDeadline);
}
