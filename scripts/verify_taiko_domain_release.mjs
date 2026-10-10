// Invoke through memory/run_qa.sh after the standard Viewer deploy succeeds.
// Public SSR and anonymous GET only; no cookies, login, DB client or private files.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';

const [expectedVersion, output] = process.argv.slice(2);
assert.match(expectedVersion || '', /^\d+\.\d+\.\d+$/);
assert.ok(output?.startsWith('/var/tmp/taiko-domain-extraction/'), 'Require disk-backed task artifact');
assert.match(await readFile('/proc/self/cgroup', 'utf8'), /development-qa\.slice\/taiko-qa-/);
const local = 'http://127.0.0.1:3100';
const online = 'https://viewer.sakura-bot.cn';
const privatePaths = ['/api/account/growth/overview', '/api/account/growth/history', '/api/account/growth/recent', '/api/account/growth/passport'];
const report = { phase: 5, expectedVersion, result: 'FAIL', method: 'anonymous GET only', checks: [] };

async function check(url, expectedStatus, { version = false, privateRoute = false, varyCookie = false } = {}) {
  const started = performance.now();
  const response = await fetch(url, { method: 'GET', redirect: 'error', headers: { 'Accept': privateRoute ? 'application/json' : 'text/html', 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(15000) });
  const hash = createHash('sha256');
  const pieces = [];
  let bytes = 0;
  try {
    for await (const piece of response.body) {
      bytes += piece.byteLength;
      if (bytes > 4 * 1024 * 1024) throw new Error('SSR/anonymous response exceeded limit');
      hash.update(piece);
      if (version) pieces.push(piece);
    }
    const cacheControl = response.headers.get('cache-control') || '';
    const vary = response.headers.get('vary') || '';
    const item = { url, status: response.status, bytes, sha256: hash.digest('hex'), milliseconds: Math.round(performance.now() - started), cacheControl, vary };
    report.checks.push(item);
    assert.equal(response.status, expectedStatus, `Unexpected status for ${url}`);
    if (version) {
      const html = Buffer.concat(pieces).toString('utf8');
      item.versionBadge = html.includes(`v${expectedVersion}`);
      assert.equal(item.versionBadge, true, `Release version badge missing for ${url}`);
    }
    if (privateRoute) {
      assert.match(cacheControl, /private,\s*no-store/i);
      if (varyCookie) assert.match(vary, /cookie/i);
    }
  } finally { await response.body?.cancel().catch(() => {}); }
}

try {
  await check(`${local}/more`, 200, { version: true });
  await check(`${online}/more`, 200, { version: true });
  await check(`${online}/titles`, 200);
  for (const path of privatePaths) await check(`${online}${path}`, 401, { privateRoute: true, varyCookie: true });
  // Songs uses the global no-store rule; its existing route has no Vary contract.
  await check(`${online}/api/account/songs`, 401, { privateRoute: true });
  report.result = 'PUBLICATION_SMOKE_PASS';
} catch (error) {
  report.failure = { name: error.name, message: String(error.message).slice(0, 300) };
  process.exitCode = 1;
} finally {
  await mkdir(dirname(output), { recursive: true, mode: 0o700 });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify({ result: report.result, expectedVersion, checks: report.checks.length, output }));
}
