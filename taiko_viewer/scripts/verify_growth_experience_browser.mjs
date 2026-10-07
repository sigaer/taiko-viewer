#!/usr/bin/env node
// Bounded real Vue UI with synthetic API DTOs. Online smoke is a separate gate.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, open, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { homePresentationFixture, passportPresentationFixture } from '../tests/fixtures/growthExperienceFixtures.mjs';
import { monitorAcceptanceResources } from '../tests/fixtures/goalAcceptanceResources.mjs';

const out = '/var/tmp/growth-experience-0792';
const build = process.env.GROWTH_EXPERIENCE_BUILD_ROOT || `${out}/source/taiko-forum/taiko_viewer`;
const base = 'http://127.0.0.1:3197';
const critical = process.argv.includes('--critical');
const passportOnly = process.argv.includes('--passport-only');
const longName = process.argv.includes('--long-name');
const suite = longName ? 'critical-long-name' : critical ? 'critical' : passportOnly ? 'passport' : 'browser';
const homeScenarios = ['goal-completed', 'goal-unrelated', 'goal-recent', 'goal-daily', 'recent-daily', 'no-goal', 'rich-daily', 'quiet-daily', 'active-goal', 'recent-only', 'profile-switch', 'goal-recent-different-baseline'];
if (critical) homeScenarios.splice(0, homeScenarios.length, 'goal-recent', 'goal-unrelated', 'goal-recent-different-baseline');
const passportScenarios = ['4-day', '42-day', '120-day', '250-day', '365-day', 'model-break', 'one-point', 'limited', 'stable', 'focus-change'];
await mkdir(out, { recursive: true });
const finishResources = await monitorAcceptanceResources(`${out}/${suite}-resources.json`);
const log = await open(`${out}/browser-server.log`, 'w');
const results = [], contracts = [];
let server, browser;
const deadline = setTimeout(() => { console.error('Growth Experience browser deadline'); process.exit(124); }, 840000);
const nav = async (page, path) => page.locator(`a[href="${path}"]`).first().evaluate(el => el.click());
const enter = async (page, locale, surface) => {
  const prefix = locale === 'ja' ? '/ja' : '';
  await page.goto(`${base}${prefix}/about`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.evaluate(() => { window.__NUXT__.state['$saccount-user-loaded'] = false; });
  if (surface === 'home') { await nav(page, prefix || '/'); await page.locator('.growth-focus').waitFor(); }
  else {
    await page.evaluate(() => { window.__NUXT__.state['$saccount-user'] = { id: 990092, username: 'Growth Player', emailVerified: true }; window.__NUXT__.state['$saccount-user-loaded'] = true; });
    await nav(page, `${prefix}/my`); await page.locator(`.my-links a[href="${prefix}/my/growth"]`).click(); await page.locator('.passport-hero').waitFor();
  }
};
try {
  server = spawn(process.execPath, ['.output/server/index.mjs'], { cwd: build, env: { PATH: process.env.PATH, NODE_OPTIONS: process.env.NODE_OPTIONS, TMPDIR: process.env.TMPDIR, HOST: '127.0.0.1', PORT: '3197', NUXT_REPO_ROOT: `${out}/runtime`, NUXT_ACCOUNT_CACHE_DIR: `${out}/runtime/cache`, TAIKO_ANNUAL_ADMISSION_DIR: `${out}/runtime/admission`, NUXT_DB_HOST: '127.0.0.1', NUXT_DB_PORT: '1', NUXT_DB_USER: 'fixture', NUXT_DB_PASSWORD: 'test-only', NUXT_DB_NAME: 'growth_experience_browser_test', NUXT_ANNUAL_SHARE_SECRET: 'a'.repeat(64), NUXT_ANNUAL_RENDER_SECRET: 'b'.repeat(64) }, stdio: ['ignore', log.fd, log.fd] });
  for (let i = 0; i < 60; i++) { if (server.exitCode !== null) throw Error('Viewer exited'); try { if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).ok) break; } catch {} if (i === 59) throw Error('readiness'); await new Promise(r => setTimeout(r, 500)); }
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  for (const locale of ['zh', 'ja']) for (const width of [390, 1440]) for (const dark of [false, true]) for (const surface of critical ? ['home'] : passportOnly ? ['passport'] : ['home', 'passport']) for (const scenario of surface === 'home' ? homeScenarios : passportScenarios) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, serviceWorkers: 'block' });
    const row = { locale, width, dark, surface, scenario, result: 'FAIL' }; results.push(row);
    try {
      const page = await context.newPage(), errors = [], requests = [];
      page.on('pageerror', error => errors.push(error.message.slice(0, 160)));
      page.on('console', message => { if (/hydration/i.test(message.text())) errors.push('hydration'); });
      page.on('request', request => { const url = new URL(request.url()); if (/\/api\/account\/growth\//.test(url.pathname)) requests.push(url.pathname + url.search); });
      await page.addInitScript(d => localStorage.setItem('taiko_theme', d ? 'dark' : 'light'), dark);
      await page.route('**/api/account/auth/me', r => r.fulfill({ json: { authenticated: true, user: { id: 990092, username: longName ? 'growth_closure_12345678901234567890' : 'Growth Player', emailVerified: true } } }));
      const binding = { id: 1, taikoId: 'fixture', source: 'wahlap', isCurrent: true };
      await page.route('**/api/account/bindings', r => r.fulfill({ json: { bindings: [binding], currentBinding: binding } }));
      await page.route('**/api/account/songs?*', r => r.fulfill({ json: { total: 1, items: [{ song_no: 101, level: 4, high_score: 995440 }] } }));
      const home = homePresentationFixture(scenario === 'profile-switch' ? 'goal-recent' : scenario);
      let profile = '1';
      await page.route('**/api/account/growth/overview', r => r.fulfill({ json: profile === '1' ? home.overview : { ...home.overview, profileId: '2', activeGoal: null, recentCompletedGoal: null, dailyProgress: { ...home.overview.dailyProgress, events: [{ ...home.overview.dailyProgress.events[1], title: 'Second Profile Song' }] } } }));
      await page.route('**/api/account/growth/recent', r => r.fulfill({ json: profile === '1' ? home.recent : { ...home.recent, profileId: '2', facts: [], totalFacts: 0, state: 'unavailable', boundary: { ...home.recent.boundary, acknowledgeRequired: false } } }));
      await page.route('**/api/account/growth/recent/ack', r => r.fulfill({ json: { profileId: '1', acknowledgedToken: 'closure-boundary', unchanged: false } }));
      let delay = false, fail = false;
      await page.route('**/api/account/growth/passport*', async r => {
        if (delay) await new Promise(resolve => setTimeout(resolve, 250));
        await r.fulfill(fail ? { status: 503, json: { statusCode: 503 } } : { json: passportPresentationFixture(scenario, Number(new URL(r.request().url()).searchParams.get('range') || 90)) });
      });
      const started = performance.now(); await enter(page, locale, surface); row.visibleMs = Math.round(performance.now() - started);
      const root = page.locator(surface === 'home' ? '.growth-surface' : '.passport-page');
      const text = await root.innerText();
      assert.ok(!/home\.growth|passport\.|difficulty\.\d|modelRevision|algorithmVersion|[a-f0-9]{48,}/.test(text), 'raw identifiers');
      assert.ok(!/计算口径|測定点|計算基準|不同阶段的测量/.test(text), 'specification language');
      if (surface === 'home') {
        assert.equal(requests.filter(path => path === '/api/account/growth/overview').length, 1);
        assert.equal(requests.filter(path => path === '/api/account/growth/recent').length, 1);
        assert.equal(await root.locator('.growth-event h3').count(), 0);
        assert.equal(await root.locator('.growth-goal--completed').count(), home.overview.recentCompletedGoal ? 1 : 0);
        if (scenario.startsWith('goal-')) {
          const boxes = await root.evaluate(el => ({ goal: el.querySelector('.growth-goal--completed').getBoundingClientRect().top, daily: el.querySelector('.growth-progress').getBoundingClientRect().top, plan: el.querySelector('.growth-plan').getBoundingClientRect().top }));
          assert.ok(boxes.goal < boxes.daily && boxes.goal < boxes.plan); assert.ok(boxes.goal < 500);
          assert.match(await root.locator('.growth-goal--completed').innerText(), /1 → 0/);
          assert.equal((text.match(/1 → 0/g) || []).length, 1);
        }
        if (scenario.startsWith('goal-recent')) assert.equal(await root.locator('.recent-growth__fact').count(), 0);
        if (scenario === 'recent-daily') assert.equal(await root.locator('.growth-progress .growth-event__song').filter({ hasText: 'HIMAWARI HAPPY' }).count(), 0);
        if (scenario === 'goal-recent-different-baseline') assert.equal((text.match(/995,440/g) || []).length, 1);
        if (scenario === 'rich-daily') assert.equal(await root.locator('.growth-event').count(), 3);
        if (scenario === 'quiet-daily') assert.equal(await root.locator('.growth-event').count(), 0);
        if (scenario === 'active-goal') assert.equal(await root.locator('.goal-evaluate').count(), 1);
        if (scenario === 'profile-switch') {
          profile = '2';
          await page.evaluate(() => { const resolver = window.__NUXT__.state['$shome-state-resolver']; resolver.currentBinding = { ...resolver.currentBinding, id: 2, taikoId: 'second-fixture' }; });
          await root.locator('.growth-event__song').filter({ hasText: 'Second Profile Song' }).waitFor();
          assert.equal(await root.locator('.growth-goal--completed').count(), 0);
          assert.ok(!(await root.innerText()).includes('HIMAWARI HAPPY'), 'old profile story leaked');
        }
        row.overviewRequests = scenario === 'profile-switch' ? 2 : 1; row.recentRequests = row.overviewRequests;
      } else {
        const count = { '4-day': 0, '42-day': 2, '120-day': 3, '250-day': 4, '365-day': 4, 'model-break': 2, 'one-point': 0, limited: 0, stable: 2, 'focus-change': 2 }[scenario];
        assert.equal(await root.locator('.passport-range button').count(), count);
        assert.equal(await root.locator('.passport-dimensions button').count(), 7);
        const storyTop = await root.locator('.passport-change').evaluate(el => el.getBoundingClientRect().top);
        const controlsTop = await root.locator('.passport-controls').evaluate(el => el.getBoundingClientRect().top);
        assert.ok(storyTop < controlsTop);
        if (scenario === 'stable') assert.match(await root.locator('.passport-change').innerText(), /10.28/);
        if (scenario === 'focus-change') assert.match(await root.locator('.passport-focus-note').innerText(), locale === 'zh' ? /节奏/ : /リズム/);
        if (scenario === 'model-break') {
          assert.equal(await root.locator('.passport-chart__segment path').count(), 2);
          const disclosure = root.locator('.passport-trend .passport-segment-note summary'); await disclosure.focus(); await disclosure.press('Enter');
          assert.equal(await root.locator('.passport-trend .passport-segment-note').getAttribute('open'), '');
          assert.match(await root.locator('.passport-trend .passport-segment-note').innerText(), locale === 'zh' ? /更新前后的数值不直接比较/ : /更新前後の数値は直接比較/);
        }
        if (scenario === '365-day') {
          delay = true;
          for (const range of [30, 90, 180, 365]) {
            const before = requests.length;
            const responsePromise = page.waitForResponse(r => new URL(r.url()).pathname === '/api/account/growth/passport');
            const button = root.locator(`.passport-range button[data-range="${range}"]`);
            await button.focus();
            const beforeScroll = await page.evaluate(() => scrollY);
            const clock = performance.now(); await button.press('Enter');
            await root.locator('.passport-updating').waitFor();
            assert.equal(await root.locator('.passport-loading').count(), 0);
            assert.ok(await root.locator('.passport-hero').isVisible());
            const response = await responsePromise, payload = await response.json();
            await root.locator('.passport-updating').waitFor({ state: 'hidden' });
            const calls = requests.slice(before).filter(path => path.startsWith('/api/account/growth/passport'));
            const contract = { locale, width, dark, range, requests: calls.length, requestRange: Number(new URL(calls[0], base).searchParams.get('range')), requestedDays: payload.range.requestedDays, actualFrom: payload.range.actualFrom, actualTo: payload.range.actualTo, uiMs: Math.round(performance.now() - clock), scrollDelta: Math.abs(await page.evaluate(() => scrollY) - beforeScroll) };
            contracts.push(contract); assert.equal(contract.requests, 1); assert.equal(contract.requestRange, range); assert.equal(contract.requestedDays, range); assert.ok(contract.scrollDelta <= 2, 'range scroll jump');
            assert.equal(await button.getAttribute('aria-pressed'), 'true');
          }
          // Explicit failure retains the chart, does not retry, and leaves the
          // previous accepted range selected until a successful manual retry.
          fail = true; const before = requests.length;
          await root.locator('.passport-range button[data-range="30"]').click(); await root.locator('.passport-refresh-error').waitFor();
          assert.equal(requests.length - before, 1); assert.equal(await root.locator('.passport-loading').count(), 0);
          assert.equal(await root.locator('.passport-range button[data-range="365"]').getAttribute('aria-pressed'), 'true');
          fail = false; await root.locator('.passport-refresh-error button').click(); await root.locator('.passport-refresh-error').waitFor({ state: 'hidden' });
        }
        const before = requests.length;
        await root.locator('.passport-dimensions button').nth(3).click();
        assert.equal(await root.locator('.passport-dimensions button').nth(3).getAttribute('aria-pressed'), 'true');
        assert.equal(requests.length, before, 'dimension must be local projection');
        if (await root.locator('.passport-chart circle').count()) { const point = root.locator('.passport-chart circle').last(); await point.focus(); await point.press('Enter'); assert.ok(await root.locator('.passport-chart-detail').isVisible()); }
        assert.equal(requests.filter(path => path === '/api/account/growth/overview').length, 0);
        // Return to the parent and reopen without leaving a stale child view.
        const prefix = locale === 'ja' ? '/ja' : '';
        await nav(page, `${prefix}/my`); await page.locator('.my-links').waitFor();
        assert.equal(await page.locator('.passport-page').count(), 0);
        await page.locator(`.my-links a[href="${prefix}/my/growth"]`).click(); await root.locator('.passport-hero').waitFor();
        row.leaveAndReturn = 'PASS';
      }
      assert.equal(await page.locator('body').evaluate(el => el.classList.contains('theme-dark')), dark);
      assert.ok(await root.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'root overflow');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page overflow');
      assert.deepEqual(errors, []);
      if (['goal-recent', 'rich-daily', '4-day', '365-day', 'model-break'].includes(scenario)) {
        await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: `${out}/${surface}-${scenario}-${locale}-${width}-${dark ? 'dark' : 'light'}.png`, fullPage: false });
      }
      row.result = 'PASS';
      if (results.length % 21 === 0) console.log(JSON.stringify({ completed: results.length }));
    } catch (error) { row.error = String(error.message).slice(0, 500); throw error; }
    finally { await context.close(); }
  }
} finally {
  clearTimeout(deadline);
  await writeFile(`${out}/${suite}-matrix.json`, JSON.stringify({ results, contracts }, null, 2));
  if (browser) await browser.close();
  if (server && server.exitCode === null) { const exited = once(server, 'exit'); const killer = setTimeout(() => server.kill('SIGKILL'), 8000); server.kill('SIGTERM'); await exited; clearTimeout(killer); }
  await log.close(); await finishResources();
}
console.log(JSON.stringify({ passed: results.filter(row => row.result === 'PASS').length, total: results.length, contracts: contracts.length, out }));
