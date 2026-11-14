import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { open, mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const root = new URL('..', import.meta.url).pathname;
const out = process.env.QA_EVIDENCE_DIR || '/var/tmp/viewer-tja-browser';
const base = process.env.TJA_QA_BASE || 'http://127.0.0.1:3197';
await mkdir(out, { recursive: true });
const log = await open(resolve(out, 'dev.log'), 'w');
let server, browser, context;
const deadline = setTimeout(() => process.exit(124), 240_000);
const online = process.env.TJA_QA_BASE;
const source = 'TITLE:交互测试\nBPM:180\nCOURSE:Hard\nLEVEL:6\n#START\n12121212,\n11221122,\n#END\nCOURSE:Oni\nLEVEL:8\n#START\n1212,\n#BRANCHSTART p,50,80\n#N\n1111,\n#E\n12121212,\n#M\n1212121212121212,\n#BRANCHEND\n#END\n';
try {
  if (!online) {
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
  await page.locator('.upload-panel [role=alert]').filter({ hasText: '.tja' }).waitFor();
  await input.setInputFiles({ name: '交互测试.tja', mimeType: 'application/octet-stream', buffer: Buffer.from(source) });
  const imageTool = page.locator('.image-tool');
  await imageTool.getByLabel('显示曲名', { exact: true }).fill('中文显示曲名');
  await imageTool.getByRole('button', { name: '生成谱面图', exact: true }).click();
  await imageTool.locator('img').waitFor();
  assert.equal(await imageTool.locator('img').getAttribute('alt'), '中文显示曲名 · 魔王 · 单人');
  const [pngDownload] = await Promise.all([page.waitForEvent('download'), imageTool.getByRole('link', { name: '下载 PNG', exact: true }).click()]);
  assert.equal(pngDownload.suggestedFilename(), '中文显示曲名-oni-single.png');
  const pngPath = resolve(out, 'custom-title.png');
  await pngDownload.saveAs(pngPath);
  const png = await readFile(pngPath);
  assert.ok(png.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), 'PNG signature');
  assert.equal(png.readUInt32BE(16), 816);
  await page.screenshot({ path: resolve(out, 'image-desktop.png'), fullPage: true });
  const oldURL = await imageTool.locator('img').getAttribute('src');
  await imageTool.getByLabel('显示曲名', { exact: true }).fill('第二个标题');
  assert.equal(await imageTool.locator('img').count(), 0, 'Old preview retained after editing title');
  assert.equal(await page.evaluate(async url => { try { await fetch(url); return false; } catch { return true; } }, oldURL), true, 'Old Blob URL not released');
  await page.getByRole('button', { name: '计算定数', exact: true }).click();
  await page.getByRole('heading', { name: '交互测试', exact: true }).waitFor();
  assert.equal(await page.locator('.metrics dd').count(), 5);
  await page.getByRole('button', { name: '困难', exact: true }).click();
  assert.equal(await imageTool.locator('select').inputValue(), '0');
  assert.equal(await page.locator('.chart-meta strong').textContent(), '16');
  await page.getByRole('button', { name: '魔王', exact: true }).click();
  assert.equal(await imageTool.locator('select').inputValue(), '1');
  await page.locator('.chart-meta select').selectOption('normal');
  assert.equal(await page.locator('.chart-meta strong').textContent(), '8');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '下载全部结果' }).click()]);
  assert.equal(await download.failure(), null);
  assert.equal(download.suggestedFilename(), '交互测试-constants.json');
  await page.screenshot({ path: resolve(out, 'desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile overflow');
  await imageTool.getByRole('button', { name: '生成谱面图', exact: true }).click();
  await imageTool.locator('img').waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'image mobile overflow');
  await page.screenshot({ path: resolve(out, 'mobile.png'), fullPage: true });
  await page.evaluate(() => { document.body.classList.add('theme-dark'); document.documentElement.dataset.theme = 'dark'; });
  await page.screenshot({ path: resolve(out, 'mobile-dark.png'), fullPage: true });
  await page.goto(`${base}/ja/tools/tja-constants`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'TJA ファイルを選択' }).waitFor();
  const sjis = Buffer.concat([Buffer.from('TITLE:'), Buffer.from('93fa967b8cea', 'hex'), Buffer.from('\nBPM:120\nCOURSE:Oni\nLEVEL:1\nSTYLE:Double\n#START P1\n1111,\n#END\n#START P2\n2222,\n#END\n')]);
  await input.setInputFiles({ name: 'double.tja', mimeType: 'application/octet-stream', buffer: sjis });
  await imageTool.getByLabel('表示曲名', { exact: true }).waitFor();
  assert.equal(await imageTool.getByLabel('表示曲名', { exact: true }).inputValue(), '日本語');
  assert.equal(await imageTool.locator('option').count(), 2);
  await imageTool.getByRole('button', { name: '譜面画像を生成', exact: true }).click();
  await imageTool.locator('img').waitFor();
  const [p1] = await Promise.all([page.waitForEvent('download'), imageTool.getByRole('link', { name: 'PNG をダウンロード', exact: true }).click()]);
  await p1.saveAs(resolve(out, 'p1.png'));
  await imageTool.locator('select').selectOption('1');
  assert.equal(await imageTool.locator('img').count(), 0);
  await imageTool.getByRole('button', { name: '譜面画像を生成', exact: true }).click();
  await imageTool.locator('img').waitFor();
  const [p2] = await Promise.all([page.waitForEvent('download'), imageTool.getByRole('link', { name: 'PNG をダウンロード', exact: true }).click()]);
  await p2.saveAs(resolve(out, 'p2.png'));
  assert.ok(!(await readFile(resolve(out, 'p1.png'))).equals(await readFile(resolve(out, 'p2.png'))), 'P1/P2 images must differ');
  await page.screenshot({ path: resolve(out, 'double-ja-mobile.png'), fullPage: true });

  await input.setInputFiles({ name: 'empty.tja', mimeType: 'text/plain', buffer: Buffer.from('TITLE:invalid') });
  await page.getByRole('button', { name: '定数を計算', exact: true }).click();
  await page.locator('.upload-panel [role=alert]').filter({ hasText: '#START' }).waitFor();
  await imageTool.getByRole('alert').filter({ hasText: '#START' }).waitFor();
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
  await page.locator('.upload-panel [role=alert]').filter({ hasText: '计算服务正忙' }).waitFor();
  await imageTool.getByRole('button', { name: '生成谱面图', exact: true }).click();
  await imageTool.locator('img').waitFor();
  await page.unroute('**/api/tools/tja-constants');
  await page.getByRole('button', { name: '重新计算', exact: true }).click();
  await page.getByRole('heading', { name: '交互测试', exact: true }).waitFor();
  await input.setInputFiles({ name: 'oversized.tja', mimeType: 'text/plain', buffer: Buffer.from('TITLE:Size\nBPM:120\nCOURSE:Oni\nLEVEL:1\n#START\n#MOVELINE 100000\n1122,\n#END\n') });
  await imageTool.getByRole('button', { name: '生成谱面图', exact: true }).click();
  await imageTool.getByRole('alert').filter({ hasText: '过大' }).waitFor();
  assert.equal(await imageTool.locator('img').count(), 0);
  await imageTool.getByRole('button', { name: '重新读取谱面', exact: true }).click();
  await imageTool.getByLabel('显示曲名', { exact: true }).waitFor();
  await input.setInputFiles({ name: 'bad-measure.tja', mimeType: 'text/plain', buffer: Buffer.from('TITLE:Bad measure\nBPM:120\nCOURSE:Oni\nLEVEL:1\n#START\n#MEASURE 1/0\n1122,\n#END\n') });
  await imageTool.getByRole('alert').filter({ hasText: '过大' }).waitFor();
  await page.goto(`${base}/more`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('iframe[title="TJA renderer"]').count(), 0, 'Renderer frame leaked on navigation');
  assert.equal(errors.length, 0, JSON.stringify(errors));
  await writeFile(resolve(out, 'browser-result.json'), JSON.stringify({ pass: true, checks: ['upload', 'real-calculation', 'course', 'branch', 'download', 'invalid-file', 'invalid-tja', 'mobile', 'dark', 'japanese', 'drag-drop', 'cancel-wait', 'busy-retry', 'custom-title-png', 'png-download', 'stale-blob-release', 'image-course-sync', 'image-mobile', 'shift-jis', 'image-p1-p2', 'independent-image-during-calculator-error', 'geometry-budget', 'invalid-measure', 'frame-cleanup'], errors }, null, 2));
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
