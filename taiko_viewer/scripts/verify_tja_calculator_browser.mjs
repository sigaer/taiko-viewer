import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { open, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const root = new URL('..', import.meta.url).pathname;
const out = process.env.QA_EVIDENCE_DIR || '/var/tmp/viewer-tja-browser';
const base = 'http://127.0.0.1:3197';
await mkdir(out, { recursive: true });
const log = await open(resolve(out, 'dev.log'), 'w');
let server, browser, context;
const deadline = setTimeout(() => process.exit(124), 240_000);
const source = 'TITLE:交互测试\nBPM:180\nCOURSE:Hard\nLEVEL:6\n#START\n12121212,\n11221122,\n#END\nCOURSE:Oni\nLEVEL:8\n#START\n1212,\n#BRANCHSTART p,50,80\n#N\n1111,\n#E\n12121212,\n#M\n1212121212121212,\n#BRANCHEND\n#END\n';
try {
  server = spawn(process.execPath, ['node_modules/nuxt/bin/nuxt.mjs', 'dev', '--host', '127.0.0.1', '--port', '3197'], {
    cwd: root, detached: true,
    env: { PATH: process.env.PATH, NODE_OPTIONS: '--max-old-space-size=1536', TMPDIR: process.env.TMPDIR,
      NUXT_DB_HOST: '127.0.0.1', NUXT_DB_PORT: '1', NUXT_DB_NAME: 'tja_browser_test', NUXT_DB_USER: 'unavailable', NUXT_DB_PASSWORD: 'synthetic',
      NUXT_REPO_ROOT: resolve(out, 'empty-runtime') }, stdio: ['ignore', log.fd, log.fd]
  });
  for (let i = 0; i < 90; i++) {
    if (server.exitCode !== null) throw Error('Dev server exited');
    try { if ((await fetch(`${base}/tools/tja-constants`, { signal: AbortSignal.timeout(1500) })).ok) break; } catch {}
    if (i === 89) throw Error('Dev readiness timeout');
    await new Promise(r => setTimeout(r, 1000));
  }
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'], env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' }, timeout: 20_000 });
  context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  await page.goto(`${base}/tools/tja-constants`, { waitUntil: 'networkidle' });
  const input = page.locator('input[type=file]');
  await input.setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('bad') });
  await page.getByRole('alert').filter({ hasText: '.tja' }).waitFor();
  await input.setInputFiles({ name: '交互测试.tja', mimeType: 'application/octet-stream', buffer: Buffer.from(source) });
  await page.getByRole('button', { name: '计算定数', exact: true }).click();
  await page.getByRole('heading', { name: '交互测试', exact: true }).waitFor();
  assert.equal(await page.locator('.metrics dd').count(), 5);
  await page.getByRole('button', { name: '困难', exact: true }).click();
  assert.equal(await page.locator('.chart-meta strong').textContent(), '16');
  await page.getByRole('button', { name: '魔王', exact: true }).click();
  await page.locator('.chart-meta select').selectOption('normal');
  assert.equal(await page.locator('.chart-meta strong').textContent(), '8');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '下载全部结果' }).click()]);
  assert.equal(await download.failure(), null);
  assert.equal(download.suggestedFilename(), '交互测试-constants.json');
  await page.screenshot({ path: resolve(out, 'desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile overflow');
  await page.screenshot({ path: resolve(out, 'mobile.png'), fullPage: true });
  await page.evaluate(() => { document.body.classList.add('theme-dark'); document.documentElement.dataset.theme = 'dark'; });
  await page.screenshot({ path: resolve(out, 'mobile-dark.png'), fullPage: true });
  await page.goto(`${base}/ja/tools/tja-constants`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'TJA ファイルを選択' }).waitFor();
  await input.setInputFiles({ name: 'empty.tja', mimeType: 'text/plain', buffer: Buffer.from('TITLE:invalid') });
  await page.getByRole('button', { name: '定数を計算', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '#START' }).waitFor();
  await page.goto(`${base}/tools/tja-constants`, { waitUntil: 'networkidle' });
  await page.evaluate(text => {
    const data = new DataTransfer(); data.items.add(new File([text], 'dragged.tja', { type: 'application/octet-stream' }));
    document.querySelector('.drop-zone').dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: data }));
  }, source);
  await page.getByRole('heading', { name: 'dragged.tja' }).waitFor();
  await page.route('**/api/tools/tja-constants', async route => {
    await new Promise(r => setTimeout(r, 1500));
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ data: { code: 'busy' } }) }).catch(() => {});
  });
  await page.getByRole('button', { name: '计算定数', exact: true }).click();
  await page.getByRole('button', { name: '取消等待', exact: true }).click();
  await page.getByText('已取消等待，可稍后重新计算。', { exact: true }).waitFor();
  await page.getByRole('button', { name: '计算定数', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '计算服务正忙' }).waitFor();
  await page.unroute('**/api/tools/tja-constants');
  await page.getByRole('button', { name: '重新计算', exact: true }).click();
  await page.getByRole('heading', { name: '交互测试', exact: true }).waitFor();
  assert.equal(errors.length, 0, JSON.stringify(errors));
  await writeFile(resolve(out, 'browser-result.json'), JSON.stringify({ pass: true, checks: ['upload', 'real-calculation', 'course', 'branch', 'download', 'invalid-file', 'invalid-tja', 'mobile', 'dark', 'japanese', 'drag-drop', 'cancel-wait', 'busy-retry'], errors }, null, 2));
  console.log(`TJA browser QA passed: ${out}`);
} finally {
  if (context) await context.close();
  if (browser) await browser.close();
  if (server) {
    const stopped = once(server, 'exit');
    try { process.kill(-server.pid, 'SIGTERM'); } catch {}
    await Promise.race([stopped, new Promise(r => setTimeout(r, 4000))]);
    try { process.kill(-server.pid, 'SIGKILL'); } catch {}
  }
  await log.close(); clearTimeout(deadline);
}
