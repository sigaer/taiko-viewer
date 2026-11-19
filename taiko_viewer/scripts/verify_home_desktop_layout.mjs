// UI fixtures only: no real account, database, synchronization or goal writes.
// Run through scripts/memory/run_qa.sh. --before captures the unchanged layout.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { mkdir, open, writeFile, realpath } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { homePresentationFixture, passportPresentationFixture } from '../tests/fixtures/growthExperienceFixtures.mjs';
import { monitorAcceptanceResources } from '../tests/fixtures/goalAcceptanceResources.mjs';

const before = process.argv.includes('--before');
const built = process.argv.includes('--built');
const stage = before ? 'before' : 'after';
const out = process.env.QA_EVIDENCE_DIR;
const runtime = process.env.QA_RUN_TMPDIR;
assert.ok(out && runtime, 'Use the bounded QA runner');
const base = 'http://127.0.0.1:3219';
const screenshots = `${out}/screenshots`;
await mkdir(screenshots, { recursive: true });
const finishResources = await monitorAcceptanceResources(`${out}/resources.json`);
const log = await open(`${out}/viewer.log`, 'w');
let server, browser;
const results = [];
const deadline = setTimeout(() => { console.error('Home layout QA deadline'); server?.kill('SIGTERM'); void browser?.close(); process.exitCode = 124; }, 720000);
const binding = { id: 1, taikoId: 'layout-fixture', source: 'wahlap', isCurrent: true };
const titles = ['HIMAWARI HAPPY', 'Turquoise Tachometer', 'とても長い楽曲タイトルの表示確認 VIVIVID'];
const latest = [101, 102, 103, 104, 105].map((id, i) => ({ id, song_name: [...titles, '新しい一曲', 'リズムの旅'][i], type: 'ナムコオリジナル', level_4: 9, open_day: '2026-11-19', shelf_status: 0 }));
const feed = { id_str: '123456', basic: { jump_url: 'https://t.bilibili.com/123456' }, modules: {
  module_author: { name: '太鼓达人', face: '', pub_time: '今天', pub_action: '发布了动态' },
  module_dynamic: { desc: { text: '冬季活动与新曲情报' } },
  module_stat: { comment: { count: 2 }, forward: { count: 1 }, like: { count: 12 } }
} };
try {
  if (!built) await promisify(execFile)(process.execPath, ['scripts/prepare_tja_runtime.mjs'], { cwd: new URL('..', import.meta.url), timeout: 60000, maxBuffer: 65536 });
  // The worktree may reuse installed dependencies via a symlink. Allow their
  // canonical location only in this temporary dev layer, outside product config.
  await mkdir(`${runtime}/layer`, { recursive: true });
  await writeFile(`${runtime}/layer/nuxt.config.ts`, `export default ${JSON.stringify({ devtools: { enabled: false }, vite: { server: { fs: { allow: [await realpath(new URL('../node_modules', import.meta.url))] } } } })}`);
  server = spawn(process.execPath, built ? ['.output/server/index.mjs'] : ['node_modules/@nuxt/cli/bin/nuxi.mjs', 'dev', '--host', '127.0.0.1', '--port', '3219', '--extends', `${runtime}/layer`], {
    cwd: new URL('..', import.meta.url),
    env: { PATH: process.env.PATH, NODE_OPTIONS: process.env.NODE_OPTIONS, TMPDIR: runtime, HOST: '127.0.0.1', PORT: '3219', NUXT_REPO_ROOT: runtime, TAIKO_REPO_ROOT: runtime, TAIKO_USERDATA_DIR: `${runtime}/userdata`, NUXT_ACCOUNT_CACHE_DIR: `${runtime}/cache`, NUXT_DB_HOST: '127.0.0.1', NUXT_DB_PORT: '1', NUXT_DB_USER: 'fixture', NUXT_DB_PASSWORD: 'fixture', NUXT_DB_NAME: 'home_layout_test', NUXT_ANNUAL_SHARE_SECRET: 'a'.repeat(64), NUXT_ANNUAL_RENDER_SECRET: 'b'.repeat(64) },
    stdio: ['ignore', log.fd, log.fd]
  });
  const readyBy = Date.now() + 150000;
  while (true) {
    assert.equal(server.exitCode, null, 'Local Viewer exited');
    try { if ((await fetch(`${base}/about`, { signal: AbortSignal.timeout(2000) })).ok) break; } catch {}
    assert.ok(Date.now() < readyBy, 'Local Viewer readiness deadline');
    await new Promise(r => setTimeout(r, 500));
  }
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  const cases = [{ width: 1600, height: 900 }, { width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 390, height: 844 }];
  if (!before) cases.push(...[320, 767, 1024, 1100, 1280, 1920].map(width => ({ width, height: 900 })), { width: 1440, height: 900, state: 'empty' }, { width: 390, height: 844, state: 'empty' }, { width: 1440, height: 900, state: 'failed' }, { width: 1440, height: 900, state: 'active' }, { width: 1440, height: 900, narrow: true }, { width: 1440, height: 900, locale: 'ja', dark: true });
  for (const test of cases) {
    const { width, height, state = 'ready', locale = 'zh', dark = false } = test;
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, serviceWorkers: 'block', reducedMotion: 'reduce' });
    try {
      const page = await context.newPage(); page.setDefaultTimeout(20000);
      const errors = []; page.on('pageerror', e => errors.push(e.message.slice(0, 180)));
      page.on('console', m => { if (m.type() === 'error' && !m.text().includes('net::ERR_FAILED')) console.log('browser:', m.text().slice(0, 240)); });
      await page.addInitScript(theme => localStorage.setItem('taiko_theme', theme), dark ? 'dark' : 'light');
      const fixture = homePresentationFixture(state === 'active' ? 'active-goal' : state === 'empty' ? 'quiet-daily' : 'no-goal');
      fixture.overview.todayPlan.items.forEach((item, i) => { item.title = titles[i]; item.currentBestRank = [7, 6, 5][i]; });
      if (state === 'empty') { fixture.overview.todayPlan.items = []; fixture.overview.playerState.skills = []; fixture.overview.playerState.overallRating = null; }
      let active = fixture.overview.activeGoal, posts = 0;
      await context.route('https://static.sakura-bot.cn/**', r => r.abort()); // Exercise the existing default cover.
      await context.route('https://t.bilibili.com/**', r => r.fulfill({ contentType: 'text/html', body: '<title>Fixture event destination</title>' }));
      await page.route('**/api/**', async r => {
        const path = new URL(r.request().url()).pathname;
        if (!path.startsWith('/api/')) return r.continue();
        let json = {};
        if (path === '/api/account/auth/me') json = { authenticated: true, user: { id: 990092, username: '太鼓玩家', emailVerified: true } };
        else if (path === '/api/account/bindings') json = { bindings: [binding], currentBinding: binding };
        else if (path === '/api/account/songs') json = { total: 1, items: [{ highScore: 900000 }] };
        else if (path === '/api/account/growth/overview') {
          if (state === 'failed') return r.fulfill({ status: 503, json: { statusMessage: 'Fixture unavailable' } });
          json = { ...fixture.overview, activeGoal: active };
        }
        else if (path === '/api/account/growth/recent') json = fixture.recent;
        else if (path === '/api/account/growth/passport') json = passportPresentationFixture('4-day');
        else if (path === '/api/account/growth/goal' && r.request().method() === 'POST') {
          const body = r.request().postDataJSON();
          assert.equal(body.profileId, '1'); assert.equal(body.songId, 101); assert.equal(body.difficultyType, 4); assert.equal(body.goalType, 'score-pb');
          assert.equal(body.expectedActiveGoalId, null); assert.equal(body.scoreRevision, fixture.overview.scoreRevision);
          posts++; active = { id: 'layout-goal', profileId: '1', songId: 101, title: titles[0], difficultyType: 4, starLevel: 9, goalType: 'score-pb', status: 'active', baseline: { highScore: 900000 } };
          json = { profileId: '1', activeGoal: active };
        }
        else if (path === '/api/content/home') json = { latestSongs: state === 'empty' ? [] : latest };
        else if (path.startsWith('/api/bilibili/dynamic/')) json = { code: 0, data: { items: [feed] } };
        else if (path === '/api/content/songs/101') json = { song: latest[0], ratingEntries: [], branchAudioVariants: {}, tjaBundleUrl: null };
        else if (path.includes('songs')) json = { items: [], songs: [], total: 0 };
        return r.fulfill({ json });
      });
      const prefix = locale === 'ja' ? '/ja' : '';
      const enterHome = async () => {
        await page.goto(`${base}${prefix}/about`, { waitUntil: 'networkidle' });
        console.log('About loaded', width, JSON.stringify(errors));
        await page.waitForFunction(() => document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$nuxt);
        await page.evaluate(() => { document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$nuxt.payload.state['$saccount-user-loaded'] = false; });
        await page.locator(`a[href="${prefix || '/'}"]`).first().evaluate(el => el.click());
        await page.locator('.growth-surface').waitFor();
        if (state !== 'failed') await page.locator('.growth-focus').waitFor();
        else await page.locator('.tb-profile .rw-state').waitFor();
      };
      await enterHome();
      if (test.narrow) await page.locator('.home-page').evaluate(el => { el.style.maxWidth = '950px'; });
      // Trigger the existing lazy feed before taking deterministic screenshots.
      await page.locator('.guest-events').scrollIntoViewIfNeeded();
      await page.locator('.fd-card').waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);
      const name = `${stage}-${width}x${height}-${state}${test.narrow ? '-narrow-content' : ''}${dark ? '-dark-ja' : ''}`;
      await page.screenshot({ path: `${screenshots}/${name}.png` });
      await page.screenshot({ path: `${screenshots}/${name}-full.png`, fullPage: true });
      const geometry = await page.evaluate(() => {
        const box = s => { const e = document.querySelector(s), r = e?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, w: r.width, h: r.height, bottom: r.bottom } : null; };
        return Object.fromEntries(['.home-page', '.tb', '.tb-main', '.tb-side', '.th', '.tpf', '.tpf-rating', '.tpf-radar', '.growth-progress', '.guest-events', '.growth-plan', '.guest-latest'].map(s => [s, box(s)]));
      });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Horizontal page overflow');
      if (!before) {
        const twoColumns = geometry['.home-page'].w >= 1000;
        if (twoColumns) {
          const main = geometry['.tb-main'], side = geometry['.tb-side'];
          assert.ok(Math.abs(main.y - side.y) < 1, 'Columns start together');
          assert.ok(Math.abs(main.w / side.w - 7 / 3) < .01, '70:30 ratio');
          assert.ok(Math.abs(side.x - main.x - main.w - 24) < 1, '24px column gap');
          if (geometry['.growth-progress']) assert.ok(Math.abs(geometry['.growth-progress'].y - main.y) < 1, 'Today starts at the top');
          if (geometry['.growth-progress']) assert.ok(geometry['.guest-events'].y > geometry['.growth-progress'].bottom, 'Events follow today');
          else assert.ok(Math.abs(geometry['.guest-events'].y - side.y) < 1, 'Events remain available when growth fails');
          assert.ok(Math.abs(geometry['.guest-latest'].w - main.w) < 1, 'Latest songs span the main column');
        } else {
          if (state !== 'failed') assert.ok(geometry['.growth-progress'].y < geometry['.growth-plan'].y, 'Single-column order preserved');
          assert.ok(geometry['.guest-events'].y > geometry['.guest-latest'].y, 'Mobile latest precedes events');
        }
        if (state !== 'failed' && width >= 768) {
          const a = geometry['.tpf-rating'], b = geometry['.tpf-radar'];
          assert.ok(Math.abs(a.w - b.w) < 1, 'Chart regions have equal widths');
          const offsets = await page.evaluate(() => {
            const offset = (s, x, y, region) => { const svg = document.querySelector(s), point = svg.createSVGPoint(); point.x = x; point.y = y; const p = point.matrixTransform(svg.getScreenCTM()), r = document.querySelector(region).getBoundingClientRect(); return p.x - r.x - r.width / 2; };
            return [offset('.ds-dial__svg', 60, 60, '.tpf-rating'), document.querySelector('.ds-radar') ? offset('.ds-radar', 150, 150, '.tpf-radar') : 0];
          });
          assert.ok(offsets.every(n => Math.abs(n) < 1), `SVG geometric centers: ${offsets.join(',')}`);
        }
        if (state !== 'empty' && state !== 'failed') {
          const cards = await page.locator('.tpl-row').evaluateAll(nodes => nodes.map(el => { const r = el.getBoundingClientRect(), b = el.querySelector('button')?.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, bottom: r.bottom, button: b ? { x: b.x, y: b.y, w: b.width, bottom: b.bottom } : null }; }));
          assert.equal(cards.length, 3);
          if (twoColumns) {
            assert.ok(cards.every(c => Math.abs(c.y - cards[0].y) < 1), 'Three columns');
            assert.ok(cards.every(c => Math.abs(c.w - cards[0].w) < 1), 'Equal card widths');
            assert.ok(cards.every(c => Math.abs(c.button.bottom - cards[0].button.bottom) < 1), 'Button bottoms align');
            assert.ok(cards.every(c => c.button.w > c.w - 32), 'Buttons fill card content width');
          }
          assert.equal(await page.locator('.tpl-best .ds-rank__name').count(), 0, 'Rank names removed');
          assert.equal(await page.locator('.tpl-best .ds-rank__img').count(), 3, 'Rank icons retained');
        }
        const ratios = await page.locator('.te-card img').evaluateAll(images => images.map(el => { const r = el.getBoundingClientRect(); return r.width / r.height; }));
        assert.ok(ratios.every(r => Math.abs(r - 800 / 239) < .01), 'Banner aspect ratio');
      }
      if (!before && width === 1440 && state === 'ready' && !test.narrow && !dark) {
        await page.locator('.tpl-choose').first().click();
        await page.locator('dialog[open] input[value="score-pb"]').check();
        await page.locator('dialog[open] .rw-dialog__actions button').last().click();
        await page.locator('.goal-evaluate').waitFor(); assert.equal(posts, 1);
        for (const [selector, path] of [['.tpf-link', '/my/growth'], ['.th-links a[href$="/my/weekly"]', '/my/weekly'], ['.tl-row', '/songs/101']]) {
          await page.locator(selector).first().click(); await page.waitForURL(`${base}${path}`);
          await page.goBack(); await page.locator('.growth-focus').waitFor();
        }
        await page.locator('.fd-card').scrollIntoViewIfNeeded();
        const popupPromise = context.waitForEvent('page'); await page.locator('.fd-card').click();
        const popup = await popupPromise; await popup.waitForURL('https://t.bilibili.com/123456'); await popup.close();
      }
      assert.deepEqual(errors, [], 'Browser exceptions');
      results.push({ name, viewport: { width, height }, geometry, result: 'PASS' });
      console.log(`${name}: PASS`);
    } finally { await context.close(); }
  }
} finally {
  clearTimeout(deadline);
  if (browser) await browser.close();
  if (server && server.exitCode === null) { const stopped = once(server, 'exit'); server.kill('SIGTERM'); const kill = setTimeout(() => server.kill('SIGKILL'), 5000); await stopped; clearTimeout(kill); }
  await log.close();
  await writeFile(`${out}/${stage}-layout.json`, JSON.stringify(results, null, 2));
  await finishResources();
}
console.log(`${results.length} scenarios passed; server and browser closed.`);
