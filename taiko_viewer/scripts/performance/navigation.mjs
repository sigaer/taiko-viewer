// One browser/page at a time. Run via scripts/memory/run_qa.sh.
// Fixed DTOs isolate client CPU/lifecycle from server calculation and private data.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, open, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { chromium } from 'playwright-core';
import { user, responseFor } from './navigation-fixtures.mjs';
import { monitorAcceptanceResources } from '../../tests/fixtures/goalAcceptanceResources.mjs';
import { navigationRegression } from './navigation-regression.mjs';

const [build, out, phase = 'after', filter = 'all'] = process.argv.slice(2);
assert.ok(build && out, 'navigation.mjs BUILD_ROOT OUTPUT_DIR [before|after]');
await mkdir(out, { recursive: true });
const resources = await monitorAcceptanceResources(`${out}/resources.json`);
const log = await open(`${out}/server.log`, 'w');
const base = 'http://127.0.0.1:3198';
const results = [];
let browser, server;
const deadline = setTimeout(() => { console.error('Navigation QA deadline'); process.exit(124); }, 800000);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  server = spawn(process.execPath, [resolve(build, '.output/server/index.mjs')], {
    cwd: build, stdio: ['ignore', log.fd, log.fd],
    env: { PATH: process.env.PATH, NODE_OPTIONS: process.env.NODE_OPTIONS, TMPDIR: process.env.TMPDIR, HOST: '127.0.0.1', PORT: '3198', NUXT_REPO_ROOT: `${out}/runtime`, NUXT_DB_HOST: '127.0.0.1', NUXT_DB_PORT: '1', NUXT_DB_USER: 'fixture', NUXT_DB_PASSWORD: 'isolated-only', NUXT_DB_NAME: 'navigation_test', NUXT_ANNUAL_SHARE_SECRET: randomBytes(32).toString('hex'), NUXT_ANNUAL_RENDER_SECRET: randomBytes(32).toString('hex') }
  });
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null) throw Error('QA server exited');
    try { if ((await fetch(`${base}/about`, { signal: AbortSignal.timeout(1000) })).ok) break; } catch {}
    assert.ok(i < 79, 'QA server readiness'); await pause(500);
  }
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--enable-precise-memory-info'] });
  const matrix = [
    { scenario: 'normal', delay: 60, interval: 0 },
    { scenario: 'rapid-loaded', delay: 60, interval: 150 },
    ...['rapid-pending', 'slow-network'].flatMap(scenario => Array.from({ length: 10 }, (_, trial) => ({ scenario, trial, cycles: 1, delay: scenario === 'rapid-pending' ? 1200 : 2400, interval: 150 }))),
    ...['zh', 'ja'].flatMap(locale => [false, true].map(dark => ({ scenario: 'visual', locale, dark, delay: 60, interval: 0 })))
  ].filter(config => filter === 'all' || (filter === 'stress' ? config.scenario !== 'visual' : filter === 'profile' ? config.scenario === 'rapid-pending' && config.trial === 0 : filter === 'pending' ? ['rapid-pending', 'slow-network'].includes(config.scenario) : config.scenario === filter));
  for (const config of matrix) {
    const { scenario, delay, interval, locale = 'zh', dark = false } = config;
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block', ...(scenario === 'visual' ? { recordVideo: { dir: out, size: { width: 1440, height: 900 } } } : {}) });
    const page = await context.newPage();
    const profileSession = filter === 'profile' ? await context.newCDPSession(page) : null;
    const row = { scenario, trial: config.trial, locale, dark, requests: [], clicks: [], errors: [], console: [], status: 'FAIL' };
    results.push(row);
    let active = 0, maximum = 0, identity = 1, failPath = '', latency = delay;
    const requests = new Map();
    page.on('pageerror', error => row.errors.push(error.message.slice(0, 300)));
    page.on('console', msg => { if (['error', 'warning'].includes(msg.type()) && !/favicon|ERR_ABORTED/.test(msg.text())) row.console.push(msg.text().slice(0, 240)); });
    page.on('request', req => {
      if (!new URL(req.url()).pathname.startsWith('/api/')) return;
      const event = { path: new URL(req.url()).pathname, method: req.method(), at: Date.now(), end: null, failure: null };
      row.requests.push(event); requests.set(req, event); active++; maximum = Math.max(maximum, active);
    });
    const finish = req => { const event = requests.get(req); if (!event) return; event.end = Date.now(); event.ms = event.end - event.at; event.failure = req.failure()?.errorText || null; requests.delete(req); active--; };
    page.on('requestfinished', finish); page.on('requestfailed', finish);
    await page.addInitScript(dark => {
      localStorage.setItem('taiko_theme', dark ? 'dark' : 'light');
      window.__navPerf = { tasks: [], shifts: [] };
      new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__navPerf.tasks.push({ at: entry.startTime, ms: entry.duration }); }).observe({ type: 'longtask', buffered: true });
      new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__navPerf.shifts.push({ at: entry.startTime, value: entry.value }); }).observe({ type: 'layout-shift', buffered: true });
    }, dark);
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      const captured = identity;
      if (!url.pathname.includes('/auth/')) await pause(latency);
      try { await route.fulfill({ status: url.pathname === failPath ? 503 : 200, json: url.pathname === failPath ? { statusMessage: 'QA unavailable' } : responseFor(url, captured) }); } catch {}
    });
    const prefix = locale === 'ja' ? '/ja' : '';
    const paths = ['/account/songs', '/my/weekly', '/my/growth', '/my'];
    const click = async path => {
      const at = await page.evaluate(path => { document.querySelector(`[data-nav-key="${path}"]`).click(); return performance.now(); }, path);
      row.clicks.push({ path: prefix + path, at });
    };
    const settled = async path => {
      await page.waitForURL(`${base}${prefix}${path}`, { timeout: 10000 });
      const selector = path === '/account/songs' ? '.songs-page .result-count' : path === '/my/weekly' ? '.weekly-hero' : path === '/my/growth' ? '.passport-hero' : '.my-page';
      await page.locator(selector).waitFor({ timeout: 10000 });
      for (let n = 0; n < 200 && active; n++) await pause(25);
      assert.equal(active, 0, 'requests settle');
      await pause(60);
    };
    const heap = async () => page.evaluate(() => ({ heap: performance.memory?.usedJSHeapSize ?? null, dom: document.querySelectorAll('*').length, probe: window.__navQA?.snapshot() }));
    try {
      await page.goto(`${base}${prefix}/about`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForFunction(() => window.__navQA);
      await page.evaluate(user => { window.__navQA.state('account-user', user); window.__navQA.state('account-user-loaded', true); }, user);
      // Warm routes so rapid-loaded explicitly starts with successful cached data.
      for (const path of config.cycles ? ['/account/songs'] : paths) { await click(path); await settled(path); }
      const cdp = await context.newCDPSession(page);
      await cdp.send('HeapProfiler.collectGarbage');
      row.start = await heap(); row.begin = await page.evaluate(() => performance.now());
      if (profileSession) {
        await profileSession.send('Debugger.enable');
        profileSession.on('Debugger.paused', event => { row.pausedStack = event.callFrames.slice(0, 20).map(frame => ({ function: frame.functionName, url: frame.url, line: frame.location.lineNumber, column: frame.location.columnNumber })); });
        await profileSession.send('Profiler.enable'); await profileSession.send('Profiler.start');
      }
      if (scenario !== 'visual') {
        for (let i = 0; i < (config.cycles || 10); i++) {
          await click('/account/songs'); await settled('/account/songs');
          if (scenario.includes('pending') || scenario === 'slow-network') {
            identity++;
            await page.evaluate(value => window.__navQA.state('account-binding-generation', value), identity);
            await pause(30);
          }
          for (const path of paths.slice(1)) { await click(path); if (interval) await pause(interval); else await settled(path); }
          await settled('/my');
          assert.equal(await page.locator('.my-page').count(), 1, 'final view matches final click');
          for (const path of ['/my/growth', '/my/weekly', '/account/songs']) { await click(path); if (interval) await pause(interval); else await settled(path); }
          await settled('/account/songs');
          if ([4, 9].includes(i)) { await cdp.send('HeapProfiler.collectGarbage'); (row.samples ||= []).push(await heap()); }
        }
      } else {
        const titles = page.locator('.nav-title');
        row.animationFrames = await page.evaluate(async () => {
          const title = document.querySelector('.nav-title');
          const panel = title.closest('.nav-group').querySelector('[id]');
          const frames = []; title.click(); const start = performance.now();
          while (performance.now() - start < 260) { frames.push({ at: performance.now() - start, height: panel.getBoundingClientRect().height, opacity: getComputedStyle(panel).opacity }); await new Promise(requestAnimationFrame); }
          return frames;
        });
        if (phase === 'after') {
          const heights = row.animationFrames.map(frame => frame.height), max = Math.max(...heights);
          assert.ok(heights.some(height => height > 0 && height < max - 2), 'animation has intermediate heights');
        }
        for (let i = 0; i < 20; i++) {
          const title = titles.nth(i % 5), was = await title.getAttribute('aria-expanded');
          await title.click(); await pause(230);
          assert.equal(await title.getAttribute('aria-expanded'), was === 'true' ? 'false' : 'true');
          assert.ok(await page.locator('.nav-title[aria-expanded="true"]').count() <= 1);
        }
        if (await titles.nth(1).getAttribute('aria-expanded') !== 'true') await titles.nth(1).click();
        await pause(230);
        await page.screenshot({ path: `${out}/${locale}-${dark ? 'dark' : 'light'}-sidebar.png` });
        assert.equal(await page.locator('body').evaluate(el => el.classList.contains('theme-dark')), dark);
        if (phase === 'after') {
          await navigationRegression({ page, click, settled, row, out, setFailure: path => { failPath = path; }, switchIdentity: async () => { identity = 2; await page.evaluate(() => window.__navQA.state('account-binding-generation', 2)); } });
          await click('/my'); await settled('/my');
        }
      }
      await settled(new URL(page.url()).pathname.replace(/^\/ja/, ''));
      row.endTime = await page.evaluate(() => performance.now());
      row.end = await heap(); row.perf = await page.evaluate(() => window.__navPerf);
      row.maxConcurrent = maximum; row.backgroundAtEnd = requests.size;
      assert.deepEqual(row.errors, [], 'no page errors');
      row.status = 'PASS';
      await writeFile(`${out}/results.json`, JSON.stringify({ phase, browser: browser.version(), viewport: '1440x900', results }, null, 2));
      console.log(JSON.stringify({ phase, scenario, locale, dark, status: row.status, requests: row.requests.length, maxConcurrent: maximum, longestTask: Math.max(0, ...row.perf.tasks.filter(t => t.at >= row.begin).map(t => t.ms)) }));
    } catch (error) {
      row.error = String(error.message).slice(0, 500);
      row.maxConcurrent = maximum; row.backgroundAtEnd = requests.size;
      if (profileSession) {
        try {
          await Promise.race([profileSession.send('Debugger.pause'), pause(2000)]);
          const result = await Promise.race([profileSession.send('Profiler.stop'), pause(2000)]);
          if (result) await writeFile(`${out}/baseline.cpuprofile`, JSON.stringify(result.profile));
          await profileSession.send('Debugger.resume').catch(() => {});
        } catch {}
      }
      if (phase !== 'before') { await page.screenshot({ path: `${out}/failure.png`, timeout: 1500 }).catch(() => {}); throw error; }
      console.log(JSON.stringify({ phase, scenario, trial: config.trial, status: 'REPRODUCED', error: row.error.slice(0, 100) }));
    }
    finally { await context.close(); if (scenario === 'visual') await page.video()?.saveAs(`${out}/${locale}-${dark ? 'dark' : 'light'}-animation.webm`); }
  }
} finally {
  clearTimeout(deadline);
  await writeFile(`${out}/results.json`, JSON.stringify({ phase, browser: browser?.version(), viewport: '1440x900', results }, null, 2));
  if (browser) await browser.close();
  if (server && server.exitCode === null) { const exited = once(server, 'exit'); const killer = setTimeout(() => server.kill('SIGKILL'), 8000); server.kill('SIGTERM'); await exited; clearTimeout(killer); }
  await log.close(); await resources();
}
