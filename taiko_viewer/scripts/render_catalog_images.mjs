/** Bounded, resumable PNG backfill. Run through the memory isolation wrapper. */
import { readFile, mkdir, link, unlink, writeFile } from 'node:fs/promises';
import { createWriteStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { chromium } from 'playwright-core';

const viewer = fileURLToPath(new URL('../', import.meta.url));
const jobsPath = process.argv[2];
if (!jobsPath) throw new Error('Usage: render_catalog_images.mjs JOBS_JSON [LIMIT]');
const plan = JSON.parse(await readFile(jobsPath, 'utf8'));
const limit = Number(process.argv[3] || 0);
const pending = plan.jobs.filter(job => { try { return !statSync(job.output).isFile(); } catch { return true; } });
const jobs = limit ? pending.slice(0, limit) : pending;
const bundle = await readFile(resolve(viewer, '.tja-runtime/chart-image.js'));
const report = { planned: jobs.length, generated: [], existing: [], issues: [], deferred: pending.length - jobs.length };
const batchDeadline = Date.now() + 9 * 60 * 1000;
let active = null, browser, context, page;
const saveReport = async () => {
  const temporary = plan.report + '.tmp';
  await writeFile(temporary, JSON.stringify(report, null, 2));
  const { rename } = await import('node:fs/promises'); await rename(temporary, plan.report);
};
const server = createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === '/') {
      response.setHeader('Content-Type', 'text/html');
      response.end('<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;width:1200px;background:white"><canvas></canvas><script src="/bundle.js"></script></body></html>');
    } else if (request.method === 'GET' && request.url === '/bundle.js') {
      response.setHeader('Content-Type', 'application/javascript'); response.end(bundle);
    } else if (request.method === 'POST' && active && request.url === '/rendered/' + active.token) {
      const job = active;
      await mkdir(dirname(job.output), { recursive: true });
      const temporary = job.output + '.' + job.token + '.tmp';
      try {
        let bytes = 0;
        const bounded = new Transform({ transform(chunk, encoding, callback) {
          bytes += chunk.length;
          callback(bytes > 12 * 1024 * 1024 ? new Error('Image size budget') : null, chunk);
        } });
        await pipeline(request, bounded, createWriteStream(temporary, { flags: 'wx', mode: 0o644 }));
        try { await link(temporary, job.output); }
        catch (error) { if (error.code !== 'EEXIST') throw error; }
        response.end('ok');
      } finally { await unlink(temporary).catch(() => {}); }
    } else { response.statusCode = 404; response.end(); }
  } catch { response.statusCode = 500; response.end(); }
});
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.TAIKO_CHROMIUM || '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const resetPage = async () => {
    await context?.close();
    context = await browser.newContext({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
    await context.addInitScript(() => { console.log = () => {}; });
    page = await context.newPage(); page.setDefaultTimeout(20000);
    await page.goto(origin); await page.waitForFunction(() => Boolean(window.CatalogChartImage));
  };
  await resetPage();
  for (const [index, job] of jobs.entries()) {
    if (Date.now() >= batchDeadline) { report.deferred += jobs.length - index; break; }
    if (index && index % 100 === 0) await resetPage();
    try {
      const { stat } = await import('node:fs/promises');
      const existing = await stat(job.output).catch(() => null);
      if (existing?.isFile() && existing.size > 8) { report.existing.push({ id: job.id, course: job.course }); continue; }
      const bytes = await readFile(job.tja);
      if (bytes.length > 2 * 1024 * 1024) throw new Error('TJA exceeds input budget');
      let text;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch { text = new TextDecoder('shift_jis').decode(bytes); }
      active = { token: randomUUID(), output: job.output };
      let deadline;
      const result = await Promise.race([
        page.evaluate(async input => window.CatalogChartImage.renderCatalogChart(input),
          { text, course: job.course, side: job.side, level: job.level, notes: job.notes, title: job.title, upload: origin + '/rendered/' + active.token }),
        new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error('Chart render deadline exceeded')), 20000); })
      ]).finally(() => clearTimeout(deadline));
      report.generated.push({ id: job.id, course: job.course, side: job.side, ...result });
    } catch (error) {
      report.issues.push({ id: job.id, course: job.course, side: job.side, reason: String(error.message).slice(0, 180) });
      if (String(error.message).includes('deadline')) await resetPage();
    }
    finally { active = null; }
    if ((index + 1) % 50 === 0) {
      await saveReport(); console.log(JSON.stringify({ checked: index + 1, generated: report.generated.length, failed: report.issues.length }));
    }
  }
  await saveReport();
  console.log(JSON.stringify({ complete: report.deferred === 0, planned: jobs.length, generated: report.generated.length, existing: report.existing.length, failed: report.issues.length, deferred: report.deferred }));
} finally {
  await context?.close(); await browser?.close(); await new Promise(resolve => server.close(resolve));
}
