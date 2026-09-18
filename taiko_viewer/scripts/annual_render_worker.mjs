// Invoked only inside a bounded transient service. Config contains private tokens.
import { readFile, mkdir, rename, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { chromium } from 'playwright-core';
const config = JSON.parse(await readFile(process.argv[2], 'utf8'));
await unlink(process.argv[2]);
let browser, context;
const temporary = `${config.outputPath}.${process.pid}.tmp`;
const remaining = Math.min(config.timeoutMs, (config.deadlineMs || Date.now() + config.timeoutMs) - Date.now());
if (remaining <= 0) process.exit(124);
const deadline = setTimeout(() => process.exit(124), remaining);
try {
  await mkdir(dirname(config.outputPath), { recursive: true, mode: 0o700 });
  browser = await chromium.launch({ executablePath: config.chromiumPath, headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--font-render-hinting=none'] });
  context = await browser.newContext({ viewport: { width: config.width, height: config.height },
    deviceScaleFactor: 1, locale: config.locale === 'ja' ? 'ja-JP' : 'zh-CN', timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(config.timeoutMs);
  await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: config.timeoutMs });
  await page.waitForFunction(flag => window[flag] === true, config.readyFlag);
  const assets = await page.evaluate(async () => {
    await document.fonts.ready;
    for (const image of document.images) await image.decode().catch(() => undefined);
    return { images: document.images.length, broken: [...document.images].filter(image => !image.complete || !image.naturalWidth).length, fonts: document.fonts.status };
  });
  await page.screenshot({ path: temporary, type: 'png', animations: 'disabled', caret: 'hide',
    clip: { x: 0, y: 0, width: config.width, height: config.height } });
  await rename(temporary, config.outputPath);
  console.log(JSON.stringify({ width: config.width, height: config.height, assets }));
} catch (error) {
  // Never emit a URL/token or Playwright's full call log.
  console.error(JSON.stringify({ code: 'ANNUAL_RENDER_FAILED', type: String(error?.name || 'Error').slice(0, 80) }));
  process.exitCode = 1;
} finally {
  await context?.close().catch(() => undefined);
  await browser?.close().catch(() => undefined);
  await unlink(temporary).catch(() => undefined);
  clearTimeout(deadline);
}
