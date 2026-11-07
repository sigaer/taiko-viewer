// Actual Vue components/router/resource logic; controlled Nuxt data ports.
// Run through scripts/memory/run_qa.sh; never a production acceptance claim.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { monitorPassportResources } from '../tests/fixtures/passportRecoveryResources.mjs';
import { forumDiscoveryBrowserRuntime } from '../tests/fixtures/forumDiscoveryBrowserRuntime.mjs';

const repo = new URL('../../', import.meta.url).pathname;
const source = resolve(repo, 'taiko_viewer');
const out = process.env.QA_EVIDENCE_DIR;
assert.ok(out, 'Bounded QA runner required');
const finishResources = await monitorPassportResources(resolve(out, 'browser-resources.json'));
const base = 'http://127.0.0.1:3208';
const image = await readFile(resolve(source, 'public/optimized/guide-miku-160.webp'));
const report = { pass: false, mode: 'actual Vue SFCs/router/resource; controlled Nuxt data ports and read-only fixtures', layouts: [], filters: [], requests: [], errors: [] };
const stage = label => { report.stage = label; console.log(label); };
const identityOnly = process.argv.includes('--identity-only');
let server, browser;
const deadline = setTimeout(() => process.exit(124), 720_000);
try {
  server = await forumDiscoveryBrowserRuntime(repo, process.env.QA_RUN_TMPDIR);
  const sections = (await (await fetch(`${base}/api/forum/sections`)).json()).items;
  report.sections = sections.map(s => s.slug);
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'], timeout: 20000 });
  for (const locale of identityOnly ? ['zh'] : ['zh', 'ja']) for (const width of identityOnly ? [390] : [390, 414, 1440]) for (const dark of identityOnly ? [false] : [false, true]) {
    stage(`layout ${locale} ${width} ${dark ? 'dark' : 'light'}`);
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    let page;
    try {
      await context.addCookies([{ name: 'song_preview_state', value: 'forum-discovery', url: base }]);
      await context.addInitScript(dark => localStorage.setItem('taiko_theme', dark ? 'dark' : 'light'), dark);
      page = await context.newPage(); page.setDefaultTimeout(30000);
      page.on('pageerror', error => report.errors.push(error.message.slice(0, 250)));
      page.on('crash', () => report.errors.push('Chromium page crashed'));
      const requests = [], coverRequests = [];
      page.on('request', request => { if (new URL(request.url()).pathname === '/api/forum/threads') requests.push(Object.fromEntries(new URL(request.url()).searchParams)); });
      await page.route('https://static.sakura-bot.cn/cover/**', route => {
        const path = new URL(route.request().url()).pathname; coverRequests.push(path);
        return /90000002|1384/.test(path) || (path.includes('90000001') && path.endsWith('.webp'))
          ? route.fulfill({ status: 404, body: '' })
          : route.fulfill({ contentType: 'image/webp', body: image });
      });
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.hostname === 'static.sakura-bot.cn' && url.pathname.startsWith('/cover/')) return route.fallback();
        if (url.origin !== base) return route.abort();
        if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) return route.fulfill({ status: 405, body: '' });
        return route.continue();
      });
      const prefix = locale === 'ja' ? '/ja' : '';
      const nav = async path => {
        stage(`navigate ${prefix + path}`);
        await page.evaluate(path => { void document.querySelector('#__nuxt').__vue_app__.$nuxt.$router.push(path); }, prefix + path);
        await page.waitForURL(base + prefix + path);
      };
      const cardsReady = async () => {
        await page.locator('.forum-thread-card').first().waitFor();
        await page.waitForFunction(() => document.querySelector('.forum-thread-card__song-cover img')?.complete);
      };
      await page.goto(`${base}${prefix}/__forum-discovery`, { waitUntil: 'networkidle', timeout: 90000 });
      await page.waitForFunction(() => document.querySelector('#__nuxt')?.__vue_app__?.$nuxt?.isHydrating === false);
      for (const compact of [false, true]) {
        if (compact) { await nav('/forum/discussions'); await cardsReady(); }
        for (let i = 0; i < 3; i++) await page.locator('.forum-thread-card').nth(i).scrollIntoViewIfNeeded();
        await page.waitForFunction(() => document.querySelectorAll('.forum-thread-card__song-cover')[2]?.querySelector('img') === null);
        const metrics = await page.locator('.forum-thread-card').evaluateAll(cards => cards.slice(0, 3).map(card => {
          const cover = card.querySelector('.forum-thread-card__song-cover'), img = cover.querySelector('img'), title = card.querySelector('.forum-user__title');
          const rect = cover.getBoundingClientRect(), songTitle = card.querySelector('.forum-thread-card__song strong');
          return { width: rect.width, height: rect.height, basis: getComputedStyle(cover).flexBasis, imgWidth: img?.getBoundingClientRect().width || 0,
            fit: img ? getComputedStyle(img).objectFit : '', loaded: img ? img.complete && img.naturalWidth > 0 : false,
            title: Boolean(title), ellipsis: title ? getComputedStyle(title).textOverflow : '', titleFits: title ? title.clientWidth < title.scrollWidth : true,
            maskedId: card.textContent.includes('MASKED-ID-HIDDEN'), titleplateNumber: card.textContent.includes('987654321'),
            songTitle: songTitle.textContent, titleHeight: songTitle.clientHeight, titleLineHeight: parseFloat(getComputedStyle(songTitle).lineHeight),
            link: card.querySelector('.forum-thread-card__song').getAttribute('href') };
        }));
        for (const metric of metrics) {
          assert.equal(metric.width, width < 901 ? 56 : 60); assert.equal(metric.height, metric.width);
          assert.equal(metric.basis, `${metric.width}px`); assert.ok(metric.imgWidth <= metric.width);
          assert.ok(metric.titleHeight <= 2 * metric.titleLineHeight + 1); assert.equal(metric.maskedId, false); assert.equal(metric.titleplateNumber, false);
          assert.ok(metric.link.startsWith(`${prefix}/songs/`)); assert.ok(metric.songTitle.includes(locale === 'ja' ? 'とても長い' : '很长的中文'));
        }
        assert.equal(metrics[0].loaded, true); assert.equal(metrics[0].fit, 'cover'); assert.equal(metrics[1].loaded, true); assert.equal(metrics[2].imgWidth, 0);
        assert.equal(metrics[0].title, true); assert.equal(metrics[0].ellipsis, 'ellipsis'); assert.equal(metrics[0].titleFits, true); assert.equal(metrics[1].title, false);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Page overflow');
        await page.locator('.forum-thread-card').first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: resolve(out, `${locale}-${width}-${dark ? 'dark' : 'light'}-${compact ? 'compact' : 'regular'}.png`) });
        report.layouts.push({ locale, width, dark, compact, metrics });
        stage(`covers PASS ${locale} ${width} ${dark} ${compact}`);
      }
      assert.ok(coverRequests.some(path => path.includes('90000001.png')), 'WebP falls back to original');
      assert.ok(coverRequests.some(path => path.includes('1384')), 'Fallback cover attempted before placeholder');
      if (width === 390 && !dark) {
        const messages = JSON.parse(await readFile(resolve(source, `locales/${locale}.json`), 'utf8'));
        const copy = messages.page.forum.section;
        stage('home client navigation identity');
        await nav('/forum?filter=hot'); await cardsReady();
        assert.equal(await page.locator('.community-section-link').count(), 4); assert.ok(await page.locator('.community-feed .forum-user__title').count() > 0);
        stage('detail client navigation identity');
        await nav('/forum/thread/81000'); await page.locator('.thread-header .forum-user__title').waitFor();
        assert.equal(await page.locator('.forum-thread-page .forum-user__title').count(), 3);
        assert.equal(await page.locator('.forum-thread-page .forum-user__detail').count(), 0);
        assert.equal(await page.locator('.forum-thread-page .forum-user__role').count(), 3);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.screenshot({ path: resolve(out, `detail-${locale}.png`) });
        if (identityOnly) { report.identity = 'PASS'; continue; }
        const openFilters = async () => { stage('open filters'); await page.locator('.filter-trigger').click(); await page.locator('.filter-dialog__field').waitFor(); };
        const choose = async label => {
          stage(`choose ${label}`);
          await page.locator('.filter-dialog__field .el-select').click();
          await page.getByRole('option', { name: label, exact: true }).click();
        };
        const apply = async () => { stage('apply'); await page.getByRole('button', { name: copy.applyFilters, exact: true }).click(); await page.waitForTimeout(250); };
        const selected = sections.find(s => s.slug === 'score-guides');
        const selectedLabel = messages.forum.sections[selected.slug].name;
        await nav('/forum/discussions?sort=hot&threadType=guide&keyword=Discovery&difficultyType=5&page=2'); await cardsReady();
        await openFilters(); const before = requests.length, oldUrl = page.url();
        await choose(selectedLabel); await page.waitForTimeout(300);
        assert.equal(requests.length, before); assert.equal(page.url(), oldUrl);
        assert.equal(new URL(await page.locator('.section-hero__stats a').getAttribute('href'), base).searchParams.has('section'), false);
        await page.locator('.el-dialog__headerbtn').click();
        await openFilters(); assert.match(await page.locator('.filter-dialog__field').innerText(), new RegExp(copy.allSections));
        await choose(selectedLabel); await apply(); await cardsReady();
        let url = new URL(page.url()); assert.equal(url.searchParams.get('sectionSlug'), selected.slug); assert.equal(url.searchParams.has('page'), false);
        assert.equal(url.searchParams.get('sort'), 'hot'); assert.equal(url.searchParams.get('threadType'), 'guide'); assert.equal(url.searchParams.get('keyword'), 'Discovery'); assert.equal(url.searchParams.get('difficultyType'), '5');
        assert.equal(await page.locator('.filter-trigger span').textContent(), '3');
        assert.equal(new URL(await page.locator('.section-hero__stats a').getAttribute('href'), base).searchParams.get('section'), selected.slug);
        assert.equal(requests.at(-1).sectionSlug, selected.slug);
        await page.locator('.pager-panel__actions button').last().click(); await page.waitForURL(url => url.searchParams.get('page') === '2'); await cardsReady();
        assert.equal(requests.at(-1).sectionSlug, selected.slug);
        await page.goBack(); await page.waitForURL(url => !url.searchParams.has('page')); await cardsReady();
        await page.goForward(); await page.waitForURL(url => url.searchParams.get('page') === '2'); await cardsReady();
        for (const section of sections) {
          await openFilters(); await choose(messages.forum.sections[section.slug]?.name || section.name); await apply(); await cardsReady();
          assert.equal(new URL(page.url()).searchParams.get('sectionSlug'), section.slug);
          assert.equal(requests.at(-1).sectionSlug, section.slug);
          assert.ok((await page.locator('.thread-list .section-pill').evaluateAll(links => links.map(a => a.getAttribute('href')))).every(href => href.endsWith(`/section/${section.slug}`)));
        }
        await openFilters(); await choose(copy.allSections); await apply(); await cardsReady();
        assert.equal(new URL(page.url()).searchParams.has('sectionSlug'), false); assert.ok(!requests.at(-1).sectionSlug);
        await nav('/forum/section/general?sectionSlug=official'); await cardsReady();
        assert.equal(requests.at(-1).sectionSlug, 'general');
        assert.equal(new URL(await page.locator('.section-hero__stats a').getAttribute('href'), base).searchParams.get('section'), 'general');
        await page.locator('.filter-trigger').click(); assert.equal(await page.locator('.filter-dialog__field').count(), 0); await page.locator('.el-dialog__headerbtn').click();
        await nav('/forum/discussions?sectionSlug=%3Cscript%3E'); await cardsReady(); assert.ok(!requests.at(-1).sectionSlug);
        report.filters.push({ locale, allSections: sections.length, draftIsolation: true, pageReset: true, backForward: true, composeContext: true, fixedSectionWins: true, titlePositions: ['home', 'list', 'author', 'floor', 'reply'] });
        report.requests.push({ locale, requests });
      }
    } catch (error) {
      report.failure = String(error.message || error).slice(0, 800);
      if (page) {
        report.failurePage = page.url();
        report.failureText = await Promise.race([page.locator('body').innerText({ timeout: 3000 }).then(text => text.slice(0, 2000)).catch(() => ''), new Promise(r => setTimeout(() => r('unavailable'), 4000))]);
        await page.screenshot({ path: resolve(out, 'failure.png'), timeout: 5000 }).catch(() => {});
      }
      await writeFile(resolve(out, 'forum-discovery.json'), JSON.stringify(report, null, 2));
      throw error;
    } finally { await Promise.race([context.close().catch(() => {}), new Promise(r => setTimeout(r, 5000))]); }
  }
  assert.deepEqual(report.errors, []); report.pass = true;
} finally {
  await writeFile(resolve(out, 'forum-discovery.json'), JSON.stringify(report, null, 2));
  await finishResources();
  if (browser) await Promise.race([browser.close().catch(() => {}), new Promise(r => setTimeout(r, 5000))]);
  if (server) await server.close();
  clearTimeout(deadline);
  console.log(JSON.stringify({ pass: report.pass, layouts: report.layouts.length, filters: report.filters.length, evidence: out }));
}
