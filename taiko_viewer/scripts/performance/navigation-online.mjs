// Post-release bounded GET/browser smoke. Uses only an existing load-test
// credential if still valid. Does not create accounts or mutate business data.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { user, responseFor } from './navigation-fixtures.mjs';

const base = 'https://viewer.sakura-bot.cn';
const out = process.argv[2];
assert.ok(out?.startsWith('/var/tmp/'));
await mkdir(out, { recursive: true });
const release = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')).version;
const report = { release, startedAt: new Date().toISOString(), api: [], browser: [], auth: 'guest', result: 'FAIL' };
const deadline = setTimeout(() => process.exit(124), 240000);
let browser, token = '';
try {
  const html = await (await fetch(`${base}/more`, { signal: AbortSignal.timeout(20000) })).text();
  assert.ok(html.includes(`v${release}`), 'deployed version badge');
  try {
    const candidate = (await readFile(new URL('../../loadtest/tokens.txt', import.meta.url), 'utf8')).split(/\s+/).find(Boolean);
    if (candidate) {
      const response = await fetch(`${base}/api/account/auth/me`, { headers: { Cookie: `stv_session=${candidate}` }, signal: AbortSignal.timeout(15000) });
      if ((await response.json()).authenticated) { token = candidate; report.auth = 'existing load-test session'; }
    }
  } catch { report.credential = 'unavailable'; }
  for (const path of ['/api/account/growth/weekly', '/api/account/growth/passport']) {
    const response = await fetch(base + path, { signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 401);
    report.api.push({ path, authenticated: false, status: response.status });
  }
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  for (const locale of ['zh', 'ja']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
    try {
      if (token) await context.addCookies([{ name: 'stv_session', value: token, url: base, httpOnly: true, secure: true, sameSite: 'Lax' }]);
      const page = await context.newPage();
      const row = { locale, dataset: token ? 'live API with existing load-test session' : 'fixed browser DTOs against deployed assets', errors: [], requests: [], finalRoute: '', result: 'FAIL' }; report.browser.push(row);
      page.on('pageerror', error => row.errors.push(error.message.slice(0, 180)));
      page.on('request', req => { if (req.url().startsWith(`${base}/api/account/`)) row.requests.push({ path: new URL(req.url()).pathname, method: req.method() }); });
      const prefix = locale === 'ja' ? '/ja' : '';
      if (!token) {
        await page.route('**/api/account/**', route => {
          assert.equal(route.request().method(), 'GET');
          return route.fulfill({ json: responseFor(new URL(route.request().url()), 1) });
        });
        await page.route('**/api/content/songs*', route => route.fulfill({ json: responseFor(new URL(route.request().url()), 1) }));
        await page.goto(`${base}${prefix}/about`, { waitUntil: 'networkidle', timeout: 60000 });
        await page.evaluate(user => { window.__NUXT__.state['$saccount-user'] = user; window.__NUXT__.state['$saccount-user-loaded'] = true; }, user);
        await page.locator('[data-nav-key="/my"]').evaluate(el => el.click());
      } else {
      await page.goto(`${base}${prefix}/my`, { waitUntil: 'networkidle', timeout: 60000 });
      }
      await page.locator('.my-page').waitFor();
      assert.equal(await page.evaluate(() => typeof window.__navQA), 'undefined', 'QA probe is absent from production');
      for (const path of ['/my/weekly', '/my/growth', '/my']) {
        await page.locator(`[data-nav-key="${path}"]`).evaluate(el => el.click());
        await page.waitForURL(`${base}${prefix}${path}`, { timeout: 30000 });
        await page.locator(path === '/my/weekly' ? '.weekly-page' : path === '/my/growth' ? '.passport-page' : '.my-page').waitFor();
        if (path !== '/my') await page.locator(path.endsWith('weekly') ? '.weekly-hero' : '.passport-hero').waitFor({ timeout: 60000 });
      }
        await page.locator('[data-nav-key="/account/songs"]').evaluate(el => el.click());
        await page.locator('.songs-page .result-count').waitFor({ timeout: 60000 });
        for (let i = 0; i < 10; i++) for (const path of ['/my/weekly', '/my/growth', '/my', '/account/songs']) {
          await page.locator(`[data-nav-key="${path}"]`).evaluate(el => el.click()); await page.waitForTimeout(150);
        }
        await page.waitForURL(`${base}${prefix}/account/songs`);
        await page.locator('.songs-page .result-count').waitFor();
      row.finalRoute = new URL(page.url()).pathname;
      await page.screenshot({ path: `${out}/online-${locale}.png` });
      assert.deepEqual(row.errors, []);
      assert.ok(row.requests.every(req => req.method === 'GET'), 'no account mutation in online smoke');
      row.result = 'PASS';
    } finally { await context.close(); }
  }
  report.result = 'PASS';
} finally {
  clearTimeout(deadline); if (browser) await browser.close();
  await writeFile(`${out}/online.json`, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ result: report.result, release, auth: report.auth, locales: report.browser.length, out }));
