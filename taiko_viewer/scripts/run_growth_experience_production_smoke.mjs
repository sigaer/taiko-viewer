#!/usr/bin/env node
// Authorized post-release smoke only. Every fixture belongs to a disposable
// account; credentials stay in memory, and finally removes all owned data.
import assert from 'node:assert/strict';
import { randomBytes, randomInt, scryptSync } from 'node:crypto';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import mysql from 'mysql2/promise';
import { chromium } from 'playwright-core';
import { authoritativeFixture } from '../tests/fixtures/goalAuthoritative.mjs';
import { deleteUserWithGoals } from '../server/services/goals/lifecycle.ts';
import { monitorAcceptanceResources } from '../tests/fixtures/goalAcceptanceResources.mjs';

assert.equal(process.env.TAIKO_ALLOW_GROWTH_EXPERIENCE_PRODUCTION_SMOKE, '1');
const base = 'https://viewer.sakura-bot.cn', out = '/var/tmp/growth-experience-0792', userdata = '/home/sigaer/taiko/userdata';
const release = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
await mkdir(out, { recursive: true });
const finishResources = await monitorAcceptanceResources(`${out}/production-resources.json`);
const env = {};
for (const line of (await readFile('/etc/taiko-viewer.env', 'utf8')).split('\n')) { const match = line.match(/^([A-Z0-9_]+)=(.*)$/); if (match) env[match[1]] = match[2].replace(/^['"]|['"]$/g, ''); }
const option = (key, fallback) => env[`NUXT_${key}`] || env[`TAIKO_${key}`] || fallback;
const db = mysql.createPool({ host: option('DB_HOST', '127.0.0.1'), port: Number(option('DB_PORT', 3306)), user: option('DB_USER'), password: option('DB_PASSWORD'), database: option('DB_NAME', 'taiko'), connectionLimit: 2 });
const exec = promisify(execFile);
const report = { release, result: 'FAIL', home: {}, passport: {}, performance: [] };
let userId = 0, currentPath = '', historyDirectory = '', browser, taikoId = '';
const deadline = setTimeout(() => { console.error('Production smoke deadline'); process.exit(124); }, 600000);
const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const moveDay = delta => new Date(Date.parse(`${day}T00:00:00Z`) + delta * 86400000).toISOString().slice(0, 10);
const sqlTime = at => at.replace('T', ' ').replace('Z', '');
const ownedPython = async seen => {
  const { stdout } = await exec('/bin/ps', ['-C', 'python3', '-o', 'pid=,args='], { timeout: 2000, maxBuffer: 64 * 1024 }).catch(() => ({ stdout: '' }));
  for (const line of stdout.split('\n')) if (line.includes('-m growth_compute growth') && line.includes(`--user ${taikoId} `)) seen.add(line.trim().split(/\s+/)[0]);
};
const measure = async (label, action) => {
  const seen = new Set(); let busy = false;
  const sample = async () => { if (busy) return; busy = true; try { await ownedPython(seen); } finally { busy = false; } };
  await sample(); const timer = setInterval(() => { sample().catch(() => {}); }, 50);
  const started = performance.now(), since = new Date();
  try { return await action(); }
  finally {
    const elapsedMs = Math.round(performance.now() - started);
    clearInterval(timer); await sample();
    const until = new Date();
    const stamp = date => date.toISOString().replace('T', ' ').replace('Z', ' UTC');
    await new Promise(resolve => setTimeout(resolve, 200));
    const { stdout } = await exec('/usr/bin/journalctl', ['-u', 'taiko-viewer', '--since', stamp(since), '--until', stamp(until), '-o', 'cat', '--no-pager'], { timeout: 5000, maxBuffer: 1024 * 1024 });
    const blocks = (title, operation) => [...stdout.matchAll(new RegExp('\\[' + title + '\\] ' + operation + ' \\{\\n([\\s\\S]*?)^\\}', 'gm'))].map(match => match[1]);
    const owns = block => new RegExp('userId: ' + userId + '(?:,|\\s)').test(block);
    const overviews = blocks('player-growth', 'overview timing').filter(owns), replays = blocks('growth-history', 'replay').filter(owns);
    const compose = blocks('growth-passport', 'compose');
    const metric = (block, key) => Number(block?.match(new RegExp(key + ': (\\d+)'))?.[1] || 0);
    const row = { label, elapsedMs, observedGrowthPythonProcesses: seen.size, growthComputeCalls: overviews.length, canonicalHistoryReplays: replays.length };
    if (compose.length === 1 && replays.length === 1) for (const key of ['measurementQueryMs', 'recentHistoryMs', 'dailySamplingMs', 'segmentBuildMs', 'milestoneComposeMs']) row[key] = metric(compose[0], key);
    report.performance.push(row);
    if (label.startsWith('Home')) assert.equal(overviews.length, 1, 'one Home overview compute');
    if (label.startsWith('Passport')) { assert.equal(overviews.length, 1, 'one Passport compute'); assert.equal(replays.length, 1, 'one bounded Passport history replay'); }
  }
};
const request = async (path, token, options = {}) => {
  const response = await fetch(base + path, { ...options, headers: { Cookie: `stv_session=${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) }, signal: AbortSignal.timeout(90000) });
  assert.match(response.headers.get('cache-control') || '', /private, no-store/);
  return { response, body: await response.json() };
};
try {
  const [[identity]] = await db.query('SELECT DATABASE() AS name'); assert.equal(identity.name, 'taiko');
  const versionHtml = await (await fetch(`${base}/more`, { signal: AbortSignal.timeout(20000) })).text();
  assert.ok(versionHtml.includes(`v${release}`), 'Release must already be online');
  const tag = randomBytes(6).toString('hex'), username = `growth_closure_${tag}`, password = randomBytes(24).toString('hex'), salt = randomBytes(16).toString('hex');
  const [account] = await db.execute('INSERT INTO web_user_accounts (username,email,password_hash,email_verified) VALUES (?,?,?,1)', [username, `${username}@example.test`, `${salt}:${scryptSync(password, salt, 64).toString('hex')}`]); userId = Number(account.insertId);
  for (let attempt = 0; attempt < 30; attempt++) {
    const candidate = String(randomInt(90000000, 99999999));
    const [[exists]] = await db.execute('SELECT COUNT(*) AS n FROM web_taiko_bindings WHERE taiko_id=?', [candidate]); if (Number(exists.n)) continue;
    try { await access(`${userdata}/${candidate}data.json`); continue; } catch {}
    try { await access(`${userdata}/${candidate}`); continue; } catch {}
    taikoId = candidate; break;
  }
  assert.ok(taikoId);
  const [binding] = await db.execute("INSERT INTO web_taiko_bindings (user_id,taiko_id,source,is_current,verified_title) VALUES (?,?,'wahlap',1,'Growth experience smoke')", [userId, taikoId]);
  const profileId = String(binding.insertId);
  currentPath = `${userdata}/${taikoId}data.json`; historyDirectory = `${userdata}/${taikoId}`;
  await mkdir(historyDirectory, { recursive: false });
  const catalog = JSON.parse(await readFile('/home/sigaer/taiko/songs/song_data.json', 'utf8'));
  const songs = [];
  for (const song of catalog) if (Number(song.shelf_status || 0) === 0) for (const level of [4, 5]) if (Number(song[`level_${level}`]) > 0) {
    const notes = Number(song.max_combo?.[level - 1]) || 600;
    songs.push({ song_no: Number(song.id), level, song_name: song.song_name, high_score: 900000, best_score_rank: 4, good_cnt: notes - 28, ok_cnt: 20, ng_cnt: 8, combo_cnt: 100, stage_cnt: 1, clear_cnt: 1, full_combo_cnt: 0, dondaful_combo_cnt: 0, highscore_datetime: `${moveDay(-2)} 08:00:00`, update_datetime: `${moveDay(-2)} 08:00:00`, highscore_mode: 0, option_flg: [1, 0, 0, '00'] });
  }
  assert.ok(songs.length > 20 && songs.length < 10000);
  const payload = { _growthExperienceSmoke: true, profile: { userid: taikoId, mydon_name: 'Growth Experience Smoke' }, achievement: { ary_crown_count: [songs.length, 0, 0], ary_score_rank_count: [0, 0, songs.length, 0, 0, 0, 0] }, songs };
  await writeFile(`${historyDirectory}/data_${moveDay(-2)}_08_00_00_closure.json`, JSON.stringify(authoritativeFixture(payload, taikoId, new Date(`${moveDay(-2)}T08:00:00+08:00`))), { flag: 'wx', mode: 0o600 });
  await writeFile(currentPath, JSON.stringify(authoritativeFixture(payload, taikoId, new Date(Date.now() - 10000))), { flag: 'wx', mode: 0o600 });
  const login = await fetch(`${base}/api/account/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: username, password }), signal: AbortSignal.timeout(20000) }); assert.equal(login.status, 200); const token = (await login.json()).sessionToken; assert.ok(token);
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  try {
    await context.addCookies([{ name: 'stv_session', value: token, url: base }]);
    const page = await context.newPage(), errors = [], requests = [], responses = [];
    page.on('pageerror', error => errors.push(error.message.slice(0, 180)));
    page.on('console', message => { if (/hydration/i.test(message.text())) errors.push('hydration'); });
    page.on('request', req => { const url = new URL(req.url()); if (url.pathname.startsWith('/api/account/growth/')) requests.push({ path: url.pathname, range: url.searchParams.get('range'), method: req.method() }); });
    page.on('response', response => { if (new URL(response.url()).pathname.startsWith('/api/account/growth/')) responses.push(response); });
    await measure('Home initial', async () => { await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.locator('.growth-focus').waitFor({ timeout: 90000 }); });
    assert.equal(requests.filter(row => row.path.endsWith('/overview')).length, 1);
    const overview = await (responses.find(r => new URL(r.url()).pathname.endsWith('/overview'))).json();
    const candidate = overview.todayPlan.items.find(item => item.goalOptions?.includes('ng-reduced')); assert.ok(candidate);
    const chosenIndex = overview.todayPlan.items.indexOf(candidate);
    await page.locator('.growth-plan__choose').nth(chosenIndex).click(); await page.locator('.goal-dialog input[value="ng-reduced"]').check();
    const goalResponsePromise = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/growth/goal') && r.request().method() === 'POST');
    await page.locator('.goal-dialog .goal-actions button').last().click(); const goalResult = await (await goalResponsePromise).json(); const selectedGoal = goalResult.activeGoal; assert.ok(selectedGoal?.id);
    await page.locator('.goal-evaluate').waitFor();
    const chosen = songs.find(row => row.song_no === candidate.songId && row.level === candidate.difficultyType); assert.ok(chosen);
    chosen.high_score = 995440; chosen.good_cnt += chosen.ng_cnt; chosen.ng_cnt = 0; chosen.stage_cnt += 1;
    const otherRows = songs.filter(row => row.song_no !== chosen.song_no).slice(0, 2);
    for (const [index, row] of otherRows.entries()) { row.high_score = 977000 + index * 1000; row.stage_cnt += 1; }
    for (const row of [chosen, ...otherRows]) { row.highscore_datetime = `${day} 12:00:00`; row.update_datetime = `${day} 12:00:00`; }
    const updated = authoritativeFixture(payload, taikoId, new Date());
    await writeFile(currentPath, JSON.stringify(updated));
    await writeFile(`${historyDirectory}/data_${day}_12_00_00_closure.json`, JSON.stringify(updated), { flag: 'wx', mode: 0o600 });
    const beforeEval = requests.length;
    await measure('Home evaluation refresh', async () => { await page.locator('.goal-evaluate').click(); await page.locator('.growth-goal--completed').waitFor(); await page.locator('.growth-plan__choose:not(:disabled)').first().waitFor(); });
    const refreshCalls = requests.slice(beforeEval).filter(row => row.path.endsWith('/overview')); assert.equal(refreshCalls.length, 1);
    assert.match(await page.locator('.growth-goal--completed').innerText(), /8 → 0/);
    assert.equal((await page.locator('.growth-surface').innerText()).match(/8 → 0/g)?.length, 1);
    assert.ok(await page.locator('.growth-goal--completed').evaluate(el => el.getBoundingClientRect().top < document.querySelector('.growth-progress').getBoundingClientRect().top));
    report.home = { intentPrimary: 'PASS', completedWithoutReload: 'PASS', overviewRefreshRequests: refreshCalls.length };
    const homeLayout = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth,
      overflowing: [...document.querySelectorAll('.growth-surface, .growth-surface *')].flatMap(el => { const r = el.getBoundingClientRect(); return r.right > innerWidth + 1 || el.scrollWidth > el.clientWidth + 1 ? [{ tag: el.tagName, class: el.className, width: r.width, right: r.right, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }] : []; }).slice(0, 50) }));
    await writeFile(`${out}/home-layout.json`, JSON.stringify(homeLayout, null, 2));
    assert.ok(homeLayout.documentWidth <= homeLayout.width + 1, 'Home horizontal overflow');
    await page.screenshot({ path: `${out}/production-home.png` });
    // Read the three persisted projections in a second page before creating a
    // newer Goal (which intentionally replaces the completed-Goal story).
    // The original page stays intact for the no-reload next-Goal check.
    const factsPage = await context.newPage();
    factsPage.on('pageerror', error => errors.push(error.message.slice(0, 180)));
    factsPage.on('console', message => { if (/hydration/i.test(message.text())) errors.push('hydration'); });
    try {
      await measure('Home persisted facts', async () => { await factsPage.goto(base, { waitUntil: 'domcontentloaded' }); await factsPage.locator('.growth-goal--completed').waitFor(); });
      await factsPage.waitForLoadState('networkidle');
      const currentHome = await factsPage.locator('.growth-surface').innerText();
      assert.equal((currentHome.match(/8 → 0/g) || []).length, 1);
      assert.equal(await factsPage.locator('.recent-growth__fact').filter({ hasText: candidate.title }).count(), 0);
      report.home.goalRecentDailyDedup = 'PASS';
      report.home.dedupVerifiedOnFreshVisit = true;
    } finally { await factsPage.close(); }
    // A next Goal must use the refreshed revision without reloading the page.
    await page.locator('.growth-goal--completed button').click();
    await page.locator('.growth-plan__choose').first().click();
    const radio = page.locator('.goal-dialog input[value="score-pb"]'); await radio.check();
    const nextPromise = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/growth/goal') && r.request().method() === 'POST');
    await page.locator('.goal-dialog .goal-actions button').last().click(); const nextGoal = (await (await nextPromise).json()).activeGoal; assert.ok(nextGoal?.id);
    assert.notEqual(nextGoal.baseline.sourceRevision, selectedGoal.baseline.sourceRevision);
    await request('/api/account/growth/goal', token, { method: 'DELETE', body: JSON.stringify({ profileId, expectedActiveGoalId: nextGoal.id }) }); report.home.nextGoalWithoutReload = 'PASS';
    const beforePassport = requests.length;
    await measure('Passport initial', async () => { await page.locator('.growth-weekly-link[href="/my/growth"]').click(); await page.locator('.passport-hero').waitFor(); });
    report.passport.initialRequests = requests.slice(beforePassport).filter(row => row.path.endsWith('/passport')).length;
    assert.equal(report.passport.initialRequests, 1);
    assert.equal(await page.locator('.passport-range button').count(), 0); report.passport.shortCoverage = 'PASS';
    // Sparse synthetic history exercises all four periods and a method update.
    const [[measurement]] = await db.execute('SELECT * FROM web_growth_measurements WHERE user_id=? AND binding_id=? ORDER BY captured_at DESC LIMIT 1', [userId, profileId]); assert.ok(measurement);
    for (const [delta, model] of [[-399, 'a'.repeat(64)], [-299, 'a'.repeat(64)], [-149, 'b'.repeat(64)], [-59, 'b'.repeat(64)], [-1, measurement.model_revision]]) await db.execute('INSERT INTO web_growth_measurements (user_id,binding_id,score_revision,measurement_version,algorithm_version,model_revision,rating,dimensions_json,focus,sample_count,availability_state,captured_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [userId, profileId, randomBytes(32).toString('hex'), measurement.measurement_version, measurement.algorithm_version, model, measurement.rating, measurement.dimensions_json, measurement.focus, measurement.sample_count, 'ready', sqlTime(`${moveDay(delta)}T04:00:00.000Z`)]);
    const apiContracts = [];
    for (const range of [30, 90, 180, 365]) {
      const result = await measure(`Passport API ${range}`, () => request(`/api/account/growth/passport?range=${range}`, token));
      assert.equal(result.response.status, 200); assert.equal(result.body.range.requestedDays, range);
      apiContracts.push({ range, requestedDays: result.body.range.requestedDays, actualFrom: result.body.range.actualFrom, actualTo: result.body.range.actualTo });
    }
    report.passport.apiContracts = apiContracts;
    await page.locator('a[href="/my"]').first().evaluate(el => el.click()); await page.locator('.my-links').waitFor(); await page.locator('.my-links a[href="/my/growth"]').click(); await page.locator('.passport-hero').waitFor();
    assert.equal(await page.locator('.passport-range button').count(), 4);
    const clickContracts = [];
    for (const range of [30, 90, 180, 365]) {
      const before = requests.length;
      const result = await measure(`Passport click ${range}`, async () => {
        const responsePromise = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/passport'));
        await page.locator(`.passport-range button[data-range="${range}"]`).click();
        const response = await responsePromise; const body = await response.json(); await page.locator('.passport-updating').waitFor({ state: 'hidden' }); return body;
      });
      const calls = requests.slice(before).filter(row => row.path.endsWith('/passport')); assert.equal(calls.length, 1); assert.equal(Number(calls[0].range), range); assert.equal(result.range.requestedDays, range);
      assert.equal(await page.locator(`.passport-range button[data-range="${range}"]`).getAttribute('aria-pressed'), 'true'); assert.equal(await page.locator('.passport-loading').count(), 0);
      clickContracts.push({ range, requests: calls.length, requestedDays: result.range.requestedDays });
    }
    report.passport.clickContracts = clickContracts;
    const passportText = await page.locator('.passport-page').innerText(); assert.ok(!/计算口径|modelRevision|algorithmVersion|[a-f0-9]{48,}/.test(passportText));
    assert.equal(await page.locator('.passport-segment-note').first().innerText(), '记录方式更新过');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); assert.deepEqual(errors, []);
    await page.screenshot({ path: `${out}/production-passport.png` });
    report.passport.browser = 'PASS'; report.passport.modelBreak = 'PASS';
    assert.ok(report.performance.every(row => row.observedGrowthPythonProcesses <= 1), 'duplicate Growth Python');
    report.result = 'PASS';
  } finally { await context.close(); }
} finally {
  clearTimeout(deadline);
  if (browser) await browser.close();
  try {
    if (userId) await deleteUserWithGoals(db, userId);
    if (currentPath) await rm(currentPath, { force: true });
    if (historyDirectory) await rm(historyDirectory, { recursive: true, force: true });
    if (userId) {
      const [[residual]] = await db.query('SELECT (SELECT COUNT(*) FROM web_user_accounts WHERE id=?) AS users,(SELECT COUNT(*) FROM web_taiko_bindings WHERE user_id=?) AS bindings,(SELECT COUNT(*) FROM web_user_sessions WHERE user_id=?) AS sessions,(SELECT COUNT(*) FROM web_player_goals WHERE user_id=?) AS goals,(SELECT COUNT(*) FROM web_growth_measurements WHERE user_id=?) AS measurements,(SELECT COUNT(*) FROM web_growth_recent_cursors WHERE user_id=?) AS cursors', Array(6).fill(userId));
      report.residualRows = residual; assert.ok(Object.values(residual).every(value => Number(value) === 0)); report.residualFiles = 0;
    }
    await writeFile(`${out}/production-smoke.json`, JSON.stringify(report, null, 2));
  } finally { await db.end(); await finishResources(); }
}
console.log(JSON.stringify(report));
