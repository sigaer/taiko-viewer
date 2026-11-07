// Read-only real online acceptance. No API fixtures or response replacement.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { monitorPassportResources } from '../tests/fixtures/passportRecoveryResources.mjs';

const out = process.env.QA_EVIDENCE_DIR;
assert.ok(out, 'Bounded QA runner required');
const finishResources = await monitorPassportResources(resolve(out, 'online-resources.json'));
const base = 'https://viewer.sakura-bot.cn';
const report = { pass: false, mode: 'real online GET-only', at: new Date().toISOString(), layouts: [], requests: [], errors: [], blockedMutations: [] };
const deadline = setTimeout(() => process.exit(124), 300000);
let browser;
const get = async path => {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(20000), headers: { 'cache-control': 'no-cache' } });
  assert.equal(response.status, 200, path); return response.json();
};
try {
  const sections = (await get('/api/forum/sections')).items;
  const all = await get('/api/forum/threads?pageSize=50');
  report.api = { sections: sections.map(s => ({ slug: s.slug, threadCount: s.threadCount })), total: all.total,
    songCards: all.items.filter(t => t.song).length, titledAuthors: all.items.filter(t => t.author.verifiedTitle).length };
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'], timeout: 20000 });
  for (const layout of [{ locale: 'zh', width: 390, dark: false }, { locale: 'ja', width: 414, dark: true }, { locale: 'zh', width: 1440, dark: true }, { locale: 'ja', width: 1440, dark: false }]) {
    const context = await browser.newContext({ viewport: { width: layout.width, height: 960 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    try {
      await context.addInitScript(dark => localStorage.setItem('taiko_theme', dark ? 'dark' : 'light'), layout.dark);
      await context.route('**/*', route => {
        if (['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) return route.continue();
        report.blockedMutations.push({ method: route.request().method(), path: new URL(route.request().url()).pathname });
        return route.abort();
      });
      const page = await context.newPage(); page.setDefaultTimeout(20000);
      page.on('pageerror', e => report.errors.push(e.message.slice(0, 250)));
      const queries = [];
      page.on('request', request => { if (new URL(request.url()).pathname === '/api/forum/threads') queries.push(Object.fromEntries(new URL(request.url()).searchParams)); });
      const prefix = layout.locale === 'ja' ? '/ja' : '';
      const messages = JSON.parse(await readFile(new URL(`../locales/${layout.locale}.json`, import.meta.url), 'utf8'));
      const copy = messages.page.forum.section;
      await page.goto(`${base}${prefix}/forum/discussions`, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForFunction(() => document.querySelector('#__nuxt')?.__vue_app__?.$nuxt?.isHydrating === false);
      await page.locator('.forum-thread-card').first().waitFor();
      const metrics = await page.locator('.forum-thread-card__song-cover').evaluateAll(covers => covers.map(cover => {
        const rect = cover.getBoundingClientRect(); return { width: rect.width, height: rect.height, fit: cover.querySelector('img') ? getComputedStyle(cover.querySelector('img')).objectFit : null };
      }));
      for (const metric of metrics) { assert.equal(metric.width, layout.width < 901 ? 56 : 60); assert.equal(metric.height, metric.width); if (metric.fit) assert.equal(metric.fit, 'cover'); }
      assert.equal(await page.locator('.forum-thread-card .forum-user__detail').count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: resolve(out, `online-list-${layout.locale}-${layout.width}.png`) });
      const selected = sections.find(s => s.threadCount > 0) || sections[0];
      await page.locator('.filter-trigger').click(); await page.locator('.filter-dialog__field').waitFor();
      const count = queries.length, url = page.url();
      await page.locator('.filter-dialog__field .el-select').click();
      assert.equal(await page.getByRole('option').count(), sections.length + 1);
      for (const section of sections) assert.equal(await page.getByRole('option', { name: messages.forum.sections[section.slug]?.name || section.name, exact: true }).count(), 1);
      await page.getByRole('option', { name: messages.forum.sections[selected.slug]?.name || selected.name, exact: true }).click();
      await page.waitForTimeout(300); assert.equal(queries.length, count); assert.equal(page.url(), url);
      await page.getByRole('button', { name: copy.applyFilters, exact: true }).click();
      await page.waitForURL(url => url.searchParams.get('sectionSlug') === selected.slug);
      await page.locator('.forum-thread-card').first().waitFor();
      assert.equal(queries.at(-1).sectionSlug, selected.slug);
      assert.equal(new URL(await page.locator('.section-hero__stats a').getAttribute('href'), base).searchParams.get('section'), selected.slug);
      const filtered = await get('/api/forum/threads?sectionSlug=' + selected.slug);
      assert.ok(filtered.items.every(item => item.section.slug === selected.slug));
      await page.locator('.filter-trigger').click(); await page.locator('.filter-dialog__field .el-select').click();
      await page.getByRole('option', { name: copy.allSections, exact: true }).click();
      await page.getByRole('button', { name: copy.applyFilters, exact: true }).click();
      await page.waitForURL(url => !url.searchParams.has('sectionSlug')); await page.locator('.forum-thread-card').first().waitFor();
      assert.ok(!queries.at(-1).sectionSlug);
      report.layouts.push({ ...layout, covers: metrics, sectionCount: sections.length, applied: selected.slug, filteredTotal: filtered.total,
        selectedUrl: `${prefix}/forum/discussions?sectionSlug=${selected.slug}`, composeUrl: `${prefix}/forum/new?section=${selected.slug}`, draftRequests: 0, clearRestoresAll: true });
      report.requests.push({ locale: layout.locale, width: layout.width, queries });
    } finally { await context.close(); }
  }
  const titled = all.items.find(item => item.author.verifiedTitle);
  if (titled) {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' });
    try {
      await context.route('**/*', route => ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) ? route.continue() : route.abort());
      const page = await context.newPage(); page.setDefaultTimeout(20000);
      const detail = await get(`/api/forum/threads/${titled.id}`);
      await page.goto(`${base}/forum/thread/${titled.id}`, { waitUntil: 'networkidle', timeout: 60000 });
      await page.locator('.thread-header .forum-user__title').waitFor();
      assert.equal(await page.locator('.thread-header .forum-user__title').textContent(), detail.author.verifiedTitle);
      const expectedTitleCount = Number(Boolean(detail.author.verifiedTitle)) + detail.posts.reduce((n, post) => n + Number(Boolean(post.author.verifiedTitle)) + post.replies.reduce((n, reply) => n + Number(Boolean(reply.author.verifiedTitle)), 0), 0);
      assert.equal(await page.locator('.forum-thread-page .forum-user__title').count(), expectedTitleCount);
      assert.equal(await page.locator('.forum-thread-page .forum-user__detail').count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: resolve(out, 'online-titled-thread.png') });
      report.verifiedTitle = { threadId: titled.id, dtoMatchesRenderedTitle: true, renderedTitleCount: expectedTitleCount,
        floors: detail.posts.length, replies: detail.posts.reduce((n, post) => n + post.replies.length, 0) };
    } finally { await context.close(); }
  } else report.verifiedTitle = { availability: 'No titled author in first 50 real public threads; verified in isolated SQL/browser fixtures only' };
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    const page = await context.newPage(); await page.goto(`${base}/more`, { waitUntil: 'networkidle', timeout: 60000 });
    assert.match(await page.locator('body').innerText(), /1\.9\.0/); report.version = '1.9.0';
  } finally { await context.close(); }
  assert.deepEqual(report.errors, []); report.pass = true;
} finally {
  await finishResources();
  if (browser) await browser.close(); clearTimeout(deadline);
  await writeFile(resolve(out, 'forum-discovery-online.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ pass: report.pass, layouts: report.layouts.length, version: report.version, evidence: out }));
}
