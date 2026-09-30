import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

// Read-only production smoke; never creates or modifies a discussion.
const base = process.argv[2] || 'https://viewer.sakura-bot.cn';
const output = process.argv[3] || '/var/tmp/song-discussions-smoke';
await mkdir(output, { recursive: true, mode: 0o700 });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const results = [];
try {
  for (const locale of ['', '/ja']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      await context.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        const allowed = url.origin === base || (url.hostname.endsWith('.sakura-bot.cn') && ['image', 'font', 'stylesheet'].includes(request.resourceType()));
        if (request.method() !== 'GET' || !allowed) return route.abort();
        return route.continue();
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message.slice(0, 200)));
      await page.goto(`${base}${locale}/songs/463?difficulty=4`, { waitUntil: 'networkidle', timeout: 45000 });
      const link = page.locator('.related-discussions__head a');
      await link.waitFor();
      const target = new URL(await link.getAttribute('href'), base);
      assert.equal(target.pathname, `${locale}/forum/discussions`);
      assert.equal(target.searchParams.get('songId'), '463');
      assert.equal(target.searchParams.get('difficultyType'), '4');
      const previewIds = await page.locator('.related-discussions__list a').evaluateAll(links => links.map(a => a.getAttribute('href')));
      const response = await context.request.get(`${base}/api/forum/threads?songId=463&difficultyType=4&pageSize=12&sort=latest`);
      assert.equal(response.status(), 200);
      const expected = await response.json();
      await link.click();
      await page.waitForURL(`${base}${locale}/forum/discussions?**`);
      await page.locator('.thread-list-panel').waitFor();
      for (const thread of expected.items) {
        await page.locator(`.thread-list-panel a[href="${locale}/forum/thread/${thread.id}"]`).first().waitFor();
      }
      for (const href of previewIds) await page.locator(`.thread-list-panel a[href="${href}"]`).first().waitFor();
      const compose = new URL(await page.locator('.section-hero__stats a').getAttribute('href'), base);
      assert.equal(compose.searchParams.get('songId'), '463');
      assert.equal(compose.searchParams.get('difficulty'), '4');
      assert.equal(compose.searchParams.has('section'), false);
      await page.locator('.sort-chips button').nth(1).click();
      await page.waitForURL(url => url.searchParams.get('sort') === 'hot');
      assert.equal(new URL(page.url()).searchParams.get('songId'), '463');
      assert.equal(new URL(page.url()).searchParams.get('difficultyType'), '4');
      await page.goBack({ waitUntil: 'networkidle' });
      assert.equal(new URL(page.url()).searchParams.has('sort'), false);
      await page.reload({ waitUntil: 'networkidle' });
      for (const thread of expected.items) await page.locator(`.thread-list-panel a[href="${locale}/forum/thread/${thread.id}"]`).first().waitFor();
      await page.screenshot({ path: `${output}/${locale ? 'ja' : 'zh'}-discussions.png`, fullPage: true });
      await page.goto(`${base}${locale}/forum/section/score-guides`, { waitUntil: 'networkidle' });
      assert.equal(new URL(await page.locator('.section-hero__stats a').getAttribute('href'), base).searchParams.get('section'), 'score-guides');
      assert.equal(errors.length, 0, errors.join('\n'));
      results.push({ locale: locale || 'zh', previewCount: previewIds.length, total: expected.total, sections: [...new Set(expected.items.map(t => t.section.slug))], errors });
    } finally { await context.close(); }
  }
  await writeFile(`${output}/result.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
