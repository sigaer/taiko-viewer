// Navigation UI fixtures only. No database or production mutations.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, open, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import packageJson from '../package.json' with { type: 'json' };

const out = process.env.QA_EVIDENCE_DIR;
const runtime = process.env.QA_RUN_TMPDIR;
assert.ok(out && runtime, 'Run through scripts/memory/run_qa.sh');
const baseline = process.argv.includes('--before');
const online = process.argv.includes('--online');
const localLive = process.argv.includes('--local-live');
const base = online ? 'https://viewer.sakura-bot.cn' : localLive ? 'http://127.0.0.1:3100' : 'http://127.0.0.1:3197';
const results = [];
let server, browser;
const log = await open(`${out}/dev.log`, 'w');
const timer = setTimeout(() => {
  console.error('My navigation UI deadline');
  process.exitCode = 124;
  server?.kill('SIGTERM');
  void browser?.close();
}, 600000);
const user = {
  id: 900001, username: '薄荷咚', email: 'fixture@example.invalid', emailVerified: true,
  avatarUrl: '/default-avatar.svg', annualSummaryAccess: true, myTaikoReadModelAccess: true,
  titles: [{ key: 'fixture-title', name: '纪念称号', style: 'rainbow' }]
};
const overview = {
  profile: { bindingId: '1', taikoId: '123', currentTitle: '太鼓达人', bindings: [{ bindingId: '1', label: '太鼓 ID' }] },
  scores: { rows: 320, scored: 300, cleared: 280 }, activeGoal: null,
  recommendation: { href: '/tools/recommend' },
  growth: { coverage: { scoreHistoryState: 'partial' }, range: { from: '2026-08-11', to: '2026-11-09' }, totalFacts: 0, recentFacts: [] }
};
try {
  if (!online && !localLive) {
    await mkdir(`${runtime}/userdata`, { recursive: true });
    server = spawn(process.execPath, ['node_modules/@nuxt/cli/bin/nuxi.mjs', 'dev', '--host', '127.0.0.1', '--port', '3197'], {
      cwd: new URL('..', import.meta.url),
      env: { PATH: process.env.PATH, NODE_OPTIONS: process.env.NODE_OPTIONS, TMPDIR: runtime,
        NUXT_REPO_ROOT: runtime, TAIKO_REPO_ROOT: runtime, TAIKO_USERDATA_DIR: `${runtime}/userdata`,
        NUXT_DB_HOST: '127.0.0.1', NUXT_DB_PORT: '1', NUXT_DB_USER: 'fixture',
        NUXT_DB_PASSWORD: 'fixture', NUXT_DB_NAME: 'my_navigation_ui_test' },
      stdio: ['ignore', log.fd, log.fd]
    });
    const deadline = Date.now() + 150000;
    while (true) {
      if (server.exitCode !== null) throw Error('Dev server exited');
      try { if ((await fetch(base + '/about', { signal: AbortSignal.timeout(2000) })).ok) break; } catch {}
      assert.ok(Date.now() < deadline, 'Dev readiness deadline');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  for (const locale of ['zh', 'ja']) for (const width of [390, 414, 1440]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce',
      ...(width < 720 ? { isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36' } : {}) });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [], reads = [], navigated = [];
    let activeUser = { ...user }, authMode = 'authenticated', currentBindingId = 1, switches = 0;
    const bindings = () => [1, 2].map(id => ({ id, taikoId: `fixture-${id}`, source: 'manual',
      displayName: `Fixture ${id}`, isManual: true, canExternalSync: false, isCurrent: id === currentBindingId,
      verifiedTitle: null, verifiedTitleplateId: null, createdAt: '2026-01-01', updatedAt: '2026-11-09' }));
    page.on('pageerror', error => errors.push(error.message.slice(0, 160)));
    try {
      await context.addCookies([{ name: 'taiko_theme', value: theme, url: base }, { name: 'viewer_locale', value: locale, url: base }]);
      await context.addInitScript(theme => localStorage.setItem('taiko_theme', theme), theme);
      await page.route('**/*', route => {
        if (new URL(route.request().url()).origin !== base) return route.abort();
        const path = new URL(route.request().url()).pathname;
        if (!path.startsWith('/api/')) return route.continue();
        reads.push(path);
        if (path === '/api/account/auth/me' && authMode === 'error') return route.fulfill({ status: 503, json: { message: 'Fixture auth unavailable' } });
        if (path === '/api/account/bindings/current') {
          assert.equal(route.request().method(), 'POST');
          currentBindingId = route.request().postDataJSON().bindingId;
          switches++;
          return route.fulfill({ json: {} });
        }
        const json = path === '/api/account/auth/me' ? { authenticated: authMode !== 'guest', user: authMode === 'guest' ? null : activeUser }
          : path === '/api/account/my-taiko/overview' ? overview
          : path === '/api/account/profile' ? { user: activeUser, bindings: bindings(), currentBinding: bindings().find(b => b.isCurrent), pendingBinding: null, qqBinding: null, verificationStatus: { emailVerified: true, taikoVerified: true } }
          : path === '/api/account/bindings' ? { bindings: bindings(), currentBinding: bindings().find(b => b.isCurrent) }
          : path === '/api/account/auth/providers' ? { providers: [] } : null;
        if (json === null) return route.fulfill({ status: 503, json: { message: 'Fixture data unavailable' } });
        return route.fulfill({ json });
      });
      const prefix = locale === 'ja' ? '/ja' : '';
      await page.goto(base + prefix + '/about', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false, null, { timeout: 60000 });
      await page.evaluate(async ({ user, prefix }) => {
        const app = document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$nuxt;
        app.payload.state['$saccount-user'] = user;
        app.payload.state['$saccount-user-loaded'] = true;
        await app.$router.push(prefix + '/my');
      }, { user, prefix });
      if (!baseline) await page.locator('.my-profile').waitFor();
      await page.locator('.my-page[data-auth-status="authenticated"]').waitFor();
      if (baseline) await page.locator('.my-overview .my-stats').waitFor();
      if (!baseline) {
        assert.equal(await page.locator('.my-grid .my-link').count(), 8);
        assert.equal(await page.locator('.my-annual').count(), 1);
        assert.equal(await page.locator('.my-profile').getAttribute('href'), prefix + '/account/profile');
        assert.equal(await page.locator('.my-profile-name').innerText(), user.username);
        assert.equal(await page.locator('.my-profile .account-title').innerText(), user.titles[0].name);
        assert.equal(await page.locator('.my-overview').count(), 0);
        assert.equal(reads.filter(p => /\/growth\/|\/my-taiko\/|\/account\/songs/.test(p)).length, 0, 'Navigation starts no score or growth reads');
        const metrics = await page.locator('.my-grid').first().evaluate(el => ({ columns: getComputedStyle(el).gridTemplateColumns.split(' ').length, width: el.getBoundingClientRect().width }));
        assert.equal(metrics.columns, locale === 'ja' && width <= 420 ? 3 : 4);
        assert.ok(metrics.width <= 640);
        const profileMetrics = await page.locator('.my-profile-info').evaluate(el => ({ width: el.getBoundingClientRect().width,
          titleHeight: el.querySelector('.account-title').getBoundingClientRect().height,
          titleLineHeight: parseFloat(getComputedStyle(el.querySelector('.account-title')).lineHeight) }));
        assert.ok(profileMetrics.titleHeight < profileMetrics.titleLineHeight * 2, 'Short commemorative title stays on one line: ' + JSON.stringify(profileMetrics));
        assert.ok(await page.locator('.my-link').evaluateAll(links => links.every(el => {
          const rect = el.getBoundingClientRect(), icon = el.querySelector('svg').getBoundingClientRect();
          return rect.width >= 44 && rect.height >= 44 && icon.width === 26 && icon.height === 26;
        })));
      }
      await page.screenshot({ path: `${out}/${baseline ? 'before' : online ? 'online' : 'after'}-${locale}-${width}-${theme}.png`, fullPage: true });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow');
      if (!baseline && width === 390 && theme === 'light') {
        // Click the actual links, then exercise browser back and forward.
        const destinations = await page.locator('.my-link, .my-annual').evaluateAll(links => links.map(link => link.getAttribute('href')));
        for (const destination of destinations) {
          console.log('Navigate', locale, destination);
          await page.locator(`.my-page a[href="${destination}"]`).click();
          await page.waitForURL(url => url.pathname === destination);
          await page.locator('.my-page').waitFor({ state: 'hidden' });
          navigated.push(destination);
          await page.goBack();
          await page.locator('.my-page[data-auth-status="authenticated"]').waitFor();
        }
        await page.locator('.my-profile').click();
        await page.waitForURL(url => url.pathname === prefix + '/account/profile');
        await page.locator('.binding-item').nth(1).waitFor();
        await page.locator('.binding-item').nth(1).getByRole('button', { name: locale === 'ja' ? '現在の ID に切り替え' : '切换为当前', exact: true }).click();
        await page.locator('.binding-item').nth(1).locator('.binding-current').waitFor();
        assert.equal(currentBindingId, 2);assert.equal(switches, 1);
        await page.screenshot({ path: `${out}/profile-binding-${locale}.png`, fullPage: true });
        await page.goBack();await page.locator('.my-profile-name').waitFor();
        await page.goForward();await page.waitForURL(url => url.pathname === prefix + '/account/profile');
        await page.goBack();await page.locator('.my-profile-name').waitFor();
        // A different authenticated identity replaces all profile fields and permissions.
        activeUser = { ...user, id: 900002, username: '別のアカウント', avatarUrl: '/missing-fixture-avatar.svg', annualSummaryAccess: false, titles: [] };
        await page.evaluate(user => { document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$nuxt.payload.state['$saccount-user'] = user; }, activeUser);
        await page.locator('.my-profile-name').filter({ hasText: activeUser.username }).waitFor();
        assert.equal(await page.locator('.my-annual').count(), 0);
        assert.equal(await page.locator('.my-profile .account-title').count(), 0);
        await page.waitForFunction(() => document.querySelector('.my-avatar')?.getAttribute('src') === '/default-avatar.svg');
        await page.evaluate(() => {
          const state = document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$nuxt.payload.state;
          state['$saccount-user'] = null;state['$saccount-user-loaded'] = true;
        });
        await page.locator('.my-page[data-auth-status="guest"]').waitFor();
        assert.equal(await page.locator('.my-profile--guest').getAttribute('href'), prefix + '/account/login');
        assert.equal(await page.locator('.my-link[href$="/account/sync"]').count(), 0);
        assert.equal(await page.locator('.my-annual').count(), 0);
        await page.screenshot({ path: `${out}/guest-${locale}.png`, fullPage: true });
        await page.evaluate(() => {
          document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$nuxt.payload.state['$saccount-user-pending'] = true;
        });
        await page.locator('.my-status[aria-busy="true"]').waitFor();
        await page.evaluate(() => {
          const state = document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$nuxt.payload.state;
          state['$saccount-user-pending'] = false;state['$saccount-user-error'] = 'Fixture unavailable';
        });
        await page.locator('.my-status[role="alert"]').waitFor();
        authMode = 'error';await page.locator('.my-status button').click();
        await page.locator('.my-status[role="alert"]').waitFor();
        await page.screenshot({ path: `${out}/error-${locale}.png`, fullPage: true });
        authMode = 'authenticated';await page.locator('.my-status button').click();
        await page.locator('.my-page[data-auth-status="authenticated"]').waitFor();
        assert.equal(await page.locator('.my-profile-name').innerText(), activeUser.username);
        assert.equal(reads.filter(p => p === '/api/account/my-taiko/overview').length, 0);
      }
      assert.deepEqual(errors, []);
      results.push({ locale, width, theme, navigated, bindingSwitches: switches, overviewReads: reads.filter(p => p === '/api/account/my-taiko/overview').length, result: 'PASS' });
    } catch (error) {
      await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
      console.error(JSON.stringify({ errors, page: await page.locator('.my-page').evaluateAll(elements => elements.map(el => el.outerHTML.slice(0, 400))), body: (await page.locator('body').innerText()).slice(0, 1000) }));
      throw error;
    } finally { await page.close(); await context.close(); }
  }
  if (online) {
    // Actual anonymous production session; all writes and external egress blocked.
    const context = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' });
    const page = await context.newPage();page.setDefaultTimeout(20000);
    const apiReads = [];
    try {
      await page.route('**/*', route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin !== base || !['GET', 'HEAD'].includes(request.method())) return route.abort();
        if (url.pathname.startsWith('/api/')) apiReads.push(url.pathname);
        return route.continue();
      });
      const response = await page.goto(base + '/my', { waitUntil: 'domcontentloaded', timeout: 60000 });
      assert.equal(response.status(), 200);
      await page.waitForFunction(() => document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false, null, { timeout: 60000 });
      await page.locator('.my-page[data-auth-status="guest"]').waitFor();
      const version = await page.evaluate(() => window.__NUXT__.config.public.appVersion);
      assert.equal(version, packageJson.version);
      assert.equal(await page.locator('.my-grid .my-link').count(), 7);
      assert.equal(await page.locator('.my-annual').count(), 0);
      assert.equal(await page.locator('.my-link[href$="/account/sync"]').count(), 0);
      assert.equal(apiReads.filter(path => /\/growth\/|\/my-taiko\//.test(path)).length, 0);
      await page.screenshot({ path: `${out}/online-real-guest.png`, fullPage: true });
      await page.locator('.my-profile--guest').click();
      await page.waitForURL(url => url.pathname === '/account/login');
      await page.goBack();await page.locator('.my-profile--guest').waitFor();
      await writeFile(`${out}/online-smoke.json`, JSON.stringify({ base, status: response.status(), version, guest: 'PASS', loginNavigation: 'PASS', apiReads, actualProductionSession: true, productionWrites: 0 }, null, 2));
    } finally { await page.close(); await context.close(); }
  }
} finally {
  clearTimeout(timer);
  if (browser) await browser.close();
  if (server && server.exitCode === null) {
    const exited = once(server, 'exit');
    server.kill('SIGTERM');
    const kill = setTimeout(() => server.kill('SIGKILL'), 5000);
    await exited;
    clearTimeout(kill);
  }
  await log.close();
  await writeFile(`${out}/my-navigation.json`, JSON.stringify(results, null, 2));
}
console.log(JSON.stringify({ mode: baseline ? 'before' : online ? 'online-fixture' : 'after', results }));
