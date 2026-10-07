#!/usr/bin/env node
// Real Vue rendering, synthetic API DTOs, no production/test DB connection.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, open, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { homePresentationFixture, passportPresentationFixture } from '../tests/fixtures/growthExperienceFixtures.mjs';
import { monitorAcceptanceResources } from '../tests/fixtures/goalAcceptanceResources.mjs';

const out = '/var/tmp/growth-voice-0800';
const build = process.env.GROWTH_VOICE_BUILD_ROOT || `${out}/source/taiko-forum/taiko_viewer`;
const base = 'http://127.0.0.1:3198';
const layouts = [
  { locale: 'zh', width: 390, dark: false }, { locale: 'ja', width: 390, dark: false },
  { locale: 'zh', width: 1440, dark: false }, { locale: 'ja', width: 390, dark: true }
];
const scenarios = {
  home: ['accuracy', 'balanced', 'limited', 'active-goal', 'goal-completed', 'recent-rich', 'first-use', 'boundary-lost', 'quiet-with-old-recent', 'inconclusive', 'rich-daily', 'quiet-daily', 'no-play'],
  weekly: ['score-breakthrough', 'stability', 'new-crown', 'goal-follow-through', 'quiet', 'limited-coverage', 'model-break'],
  passport: ['stable', 'focus-change', 'model-break', 'limited', 'one-point', 'new-user']
};
const weeklyOnly = process.argv.includes('--weekly-only');
const suite = weeklyOnly ? 'weekly-browser' : 'browser';
const report = { results: [], screenshotReview: 'PENDING' };
await mkdir(out, { recursive: true });
const finishResources = await monitorAcceptanceResources(`${out}/${suite}-resources.json`);
const log = await open(`${out}/browser-server.log`, 'w');
let server, browser;
const deadline = setTimeout(() => { console.error('Growth voice browser deadline'); process.exit(124); }, 840000);
const fixture = scenario => {
  const home = homePresentationFixture(scenario === 'inconclusive' ? 'active-goal' : ['active-goal', 'goal-completed', 'rich-daily'].includes(scenario) ? scenario : scenario === 'recent-rich' || scenario === 'boundary-lost' || scenario === 'quiet-with-old-recent' ? 'recent-only' : scenario === 'no-play' || scenario === 'first-use' ? 'quiet-daily' : 'no-goal');
  if (scenario === 'balanced') { home.overview.playerState.tiedDimensions = Object.keys(home.overview.playerState.skills.reduce((a, b) => ({ ...a, [b.key]: b.value }), {})); }
  if (scenario === 'limited') home.overview.playerState.dataSufficiency = 'limited';
  if (scenario === 'first-use') { home.recent.boundary.acknowledgedToken = null; home.recent.state = 'caught-up'; }
  if (scenario === 'boundary-lost') home.recent.boundary.recovered = true;
  if (scenario === 'quiet-with-old-recent') { home.overview.dailyProgress.attendance = 'played'; home.overview.dailyProgress.uniqueCharts = 3; for (const fact of home.recent.facts) fact.temporal.attributedDay = '2026-10-01'; }
  if (scenario === 'quiet-daily') { home.overview.dailyProgress.attendance = 'played'; home.overview.dailyProgress.uniqueCharts = 3; home.overview.dailyProgress.events = []; }
  return home;
};
const weeklyFixture = scenario => {
  const p = passportPresentationFixture('stable');
  const type = scenario === 'model-break' ? 'score-breakthrough' : scenario;
  const primaryType = type === 'stability' ? 'ng-reduced' : type === 'new-crown' ? 'fc' : 'score-pb';
  return {
    profileId: '1', week: { from: '2026-10-05', to: '2026-10-07', timezone: 'Asia/Shanghai', isCompleteWeek: false },
    coverage: { scoreHistoryState: type === 'limited-coverage' ? 'partial' : 'complete' },
    theme: { type, confidence: type === 'limited-coverage' ? 'low' : 'high', evidenceFactKeys: [], evidenceMeasurementIds: [] },
    totals: { distinctCharts: 28, pb: 2, fc: 1, df: 0, rankUpgrade: 0, completedGoals: type === 'goal-follow-through' ? 1 : 0 },
    highlights: ['quiet', 'limited-coverage'].includes(type) ? [] : [{ id: 'h1', primaryType, songId: 101, difficultyType: 4, title: 'HIMAWARI HAPPY', before: primaryType === 'ng-reduced' ? 1 : primaryType === 'fc' ? null : 980000, after: primaryType === 'ng-reduced' ? 0 : primaryType === 'fc' ? null : 995440, goalCompleted: type === 'goal-follow-through' }],
    measurementChange: { compatible: scenario !== 'model-break', reason: scenario === 'model-break' ? 'model-mismatch' : 'compatible', start: p.currentSegmentChange.start, end: p.currentSegmentChange.end, ratingDelta: 0, primaryDimension: null, focusFrom: 'accuracy_power', focusTo: 'accuracy_power' },
    currentNextAction: { focus: 'accuracy_power', todayPlan: fixture('accuracy').overview.todayPlan }
  };
};
const forbidden = /home\.growth|home\.goal|passport\.|weekly\.|当前计算口径|根据数据分析|系统建议|当前优先提升项|下一步先练|任务完成|成长指数|modelRevision|algorithmVersion|[a-f0-9]{48,}|这一轮|这次游玩|刚刚打了/;
try {
  server = spawn(process.execPath, ['.output/server/index.mjs'], { cwd: build, env: { PATH: process.env.PATH, NODE_OPTIONS: process.env.NODE_OPTIONS, TMPDIR: process.env.TMPDIR, HOST: '127.0.0.1', PORT: '3198', NUXT_REPO_ROOT: `${out}/runtime`, NUXT_ACCOUNT_CACHE_DIR: `${out}/runtime/cache`, TAIKO_ANNUAL_ADMISSION_DIR: `${out}/runtime/admission`, NUXT_DB_HOST: '127.0.0.1', NUXT_DB_PORT: '1', NUXT_DB_USER: 'fixture', NUXT_DB_PASSWORD: 'test-only', NUXT_DB_NAME: 'growth_voice_browser_test', NUXT_ANNUAL_SHARE_SECRET: 'a'.repeat(64), NUXT_ANNUAL_RENDER_SECRET: 'b'.repeat(64) }, stdio: ['ignore', log.fd, log.fd] });
  for (let i = 0; i < 60; i++) { if (server.exitCode !== null) throw Error('Viewer exited'); try { if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).ok) break; } catch {} if (i === 59) throw Error('readiness'); await new Promise(r => setTimeout(r, 500)); }
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  for (const layout of layouts) for (const surface of weeklyOnly ? ['weekly'] : Object.keys(scenarios)) for (const scenario of scenarios[surface]) {
    const { locale, width, dark } = layout;
    const row = { locale, width, dark, surface, scenario, result: 'FAIL' }; report.results.push(row);
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, serviceWorkers: 'block' });
    try {
      const page = await context.newPage(), errors = [], requests = [];
      page.setDefaultTimeout(15000);
      page.on('pageerror', e => errors.push(e.message.slice(0, 180)));
      page.on('console', m => { if (/hydration/i.test(m.text())) errors.push('hydration'); });
      page.on('request', r => { const url = new URL(r.url()); if (/\/api\/account\/growth\//.test(url.pathname)) requests.push(url.pathname); });
      await page.addInitScript(d => localStorage.setItem('taiko_theme', d ? 'dark' : 'light'), dark);
      await page.route('**/api/account/auth/me', r => r.fulfill({ json: { authenticated: true, user: { id: 990092, username: 'Growth Player', emailVerified: true } } }));
      const binding = { id: 1, taikoId: 'fixture', source: 'wahlap', isCurrent: true };
      await page.route('**/api/account/bindings', r => r.fulfill({ json: { bindings: [binding], currentBinding: binding } }));
      await page.route('**/api/account/songs?*', r => r.fulfill({ json: { total: 1, items: [{ song_no: 101, level: 4, high_score: 995440 }] } }));
      const home = fixture(scenario);
      await page.route('**/api/account/growth/overview', r => r.fulfill({ json: home.overview }));
      await page.route('**/api/account/growth/recent', r => r.fulfill({ json: home.recent }));
      await page.route('**/api/account/growth/goal/evaluate', r => r.fulfill({ json: { profileId: '1', outcome: 'inconclusive', activeGoal: home.overview.activeGoal, recentCompletedGoal: null } }));
      await page.route('**/api/account/growth/recent/ack', r => r.fulfill({ json: { profileId: '1', acknowledgedToken: 'closure-boundary', unchanged: false } }));
      await page.route('**/api/account/growth/weekly*', r => r.fulfill({ json: weeklyFixture(scenario) }));
      await page.route('**/api/account/growth/passport*', r => {
        const p = passportPresentationFixture(scenario, Number(new URL(r.request().url()).searchParams.get('range') || 90));
        if (scenario === 'new-user') { p.current = null; p.segments = []; p.focusTimeline = []; p.milestones = []; p.coverage.measurementFrom = null; p.coverage.measurementTo = null; p.coverage.measurementDays = 0; p.range.actualFrom = null; p.range.actualTo = null; }
        return r.fulfill({ json: p });
      });
      const prefix = locale === 'ja' ? '/ja' : '';
      await page.goto(`${base}${prefix}/about`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.evaluate(() => { window.__NUXT__.state['$saccount-user-loaded'] = false; });
      if (surface === 'home') {
        await page.locator(`a[href="${prefix || '/'}"]`).first().evaluate(el => el.click());
        await page.locator('.growth-focus').waitFor();
      } else {
        await page.evaluate(() => { window.__NUXT__.state['$saccount-user'] = { id: 990092, username: 'Growth Player', emailVerified: true }; window.__NUXT__.state['$saccount-user-loaded'] = true; });
        await page.locator(`a[href="${prefix}/my"]`).first().evaluate(el => el.click());
        await page.locator(`.my-links a[href="${prefix}/my/${surface === 'weekly' ? 'weekly' : 'growth'}"]`).click();
        await page.locator(surface === 'weekly' ? '.weekly-hero' : '.passport-hero').waitFor();
      }
      const root = page.locator(surface === 'home' ? '.growth-surface' : `.${surface}-page`);
      const visibleText = await root.innerText();
      assert.doesNotMatch(visibleText, forbidden);
      if (locale === 'ja') assert.doesNotMatch(visibleText, /这次|今天|最好成绩|暂时|记录还|这周|从这里|不可压|练成|想继续|刷新|进展/);
      else assert.doesNotMatch(visibleText, /Growth Overview|refresh failed|insufficient data/i);
      if (surface === 'home') {
        const observation = root.locator('.growth-focus__observation');
        assert.ok((await observation.innerText()).length > 5);
        assert.equal(requests.filter(p => p.endsWith('/overview')).length, 1);
        assert.equal(requests.filter(p => p.endsWith('/recent')).length, 1);
        if (scenario === 'goal-completed') { assert.equal(await root.locator('.growth-goal--completed').count(), 1); assert.match(await root.locator('.growth-goal--completed').innerText(), /1 → 0/); }
        if (scenario === 'active-goal') assert.equal(await root.locator('.goal-evaluate').count(), 1);
        if (scenario === 'rich-daily') { assert.equal(await root.locator('.growth-event').count(), 3); assert.equal(await root.locator('.growth-event h3').count(), 0); assert.match(await root.locator('.growth-progress').innerText(), /977,000/); }
        if (scenario === 'inconclusive') { await root.locator('.goal-evaluate').click(); await root.getByText(locale === 'zh' ? '暂时还确认不了这次进展。更新成绩后可以再试一次。' : '今回の進み具合は、まだ確認できません。成績を更新したあと、もう一度お試しください。').waitFor(); }
        if (scenario === 'quiet-daily' || scenario === 'quiet-with-old-recent') assert.match(await root.locator('.growth-progress').innerText(), locale === 'zh' ? /没有特别明显的变化/ : /目立った変化/);
        if (scenario === 'no-play') assert.match(await root.locator('.growth-progress').innerText(), locale === 'zh' ? /还没有新的游玩记录/ : /新しいプレイ記録がありません/);
        if (scenario === 'boundary-lost') assert.match(await root.locator('.recent-growth').innerText(), locale === 'zh' ? /上次看到哪儿/ : /前回どこまで/);
        if (scenario === 'accuracy') {
          const before = await observation.innerText();
          await page.locator(`a[href="${prefix}/my"]`).first().evaluate(el => el.click());
          await page.locator('.growth-surface').waitFor({ state: 'hidden' });
          await page.locator(`a[href="${prefix || '/'}"]`).first().evaluate(el => el.click());
          await page.locator('.growth-focus').waitFor();
          assert.equal(await observation.innerText(), before, 'same-state same-day copy flicker'); row.sameDayReturn = 'PASS';
        }
      } else if (surface === 'weekly') {
        assert.equal(requests.filter(p => p.endsWith('/weekly')).length, 1);
        if (scenario === 'model-break') { const disclosure = root.locator('.weekly-measurement details'); assert.ok(await disclosure.isVisible()); await disclosure.locator('summary').focus(); await disclosure.locator('summary').press('Enter'); assert.match(await disclosure.innerText(), locale === 'zh' ? /不.*直接比较/ : /直接比較/); }
      } else {
        assert.equal(requests.filter(p => p.endsWith('/passport')).length, 1);
        if (scenario === 'stable') assert.match(await root.locator('.passport-change').innerText(), /10.28/);
        if (scenario === 'limited') assert.equal(await root.locator('.passport-chart').count(), 0);
        if (scenario === 'model-break') { assert.equal(await root.locator('.passport-chart__segment path').count(), 2); const disclosure = root.locator('.passport-trend details'); await disclosure.locator('summary').focus(); await disclosure.locator('summary').press('Enter'); assert.match(await disclosure.innerText(), locale === 'zh' ? /更新前后的数值不直接比较/ : /更新前後の数値は直接比較/); }
      }
      assert.equal(await page.locator('body').evaluate(el => el.classList.contains('theme-dark')), dark);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page overflow');
      assert.deepEqual(errors, []);
      await root.scrollIntoViewIfNeeded();
      row.screenshot = `${out}/${surface}-${scenario}-${locale}-${width}-${dark ? 'dark' : 'light'}.png`;
      await page.screenshot({ path: row.screenshot, fullPage: true });
      row.result = 'PASS';
      if (report.results.length % 12 === 0) console.log(JSON.stringify({ completed: report.results.length }));
    } catch (e) { row.error = String(e.message).slice(0, 600); throw e; }
    finally { await context.close(); }
  }
} finally {
  clearTimeout(deadline);
  if (browser) await browser.close();
  if (server && server.exitCode === null) { const exited = once(server, 'exit'); const killer = setTimeout(() => server.kill('SIGKILL'), 8000); server.kill('SIGTERM'); await exited; clearTimeout(killer); }
  await log.close(); await finishResources();
  await writeFile(`${out}/${suite}-matrix.json`, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ passed: report.results.filter(row => row.result === 'PASS').length, total: report.results.length, out }));
