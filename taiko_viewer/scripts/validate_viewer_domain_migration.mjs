// Exact Phase 5 baseline: production service code, synthetic storage, inert DB/Python.
import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { prepareFixture } from './performance/growth-benchmark-fixtures.mjs';
import { importGrowthRequest } from '../tests/fixtures/growthRequestHarness.mjs';

const args = process.argv.slice(2);
const group = (await readFile('/proc/self/cgroup', 'utf8')).split('\n').find(row => row.startsWith('0::'))?.slice(3);
if (!group?.includes('development-qa.slice/taiko-qa-')) throw new Error('Require memory QA runner');
async function resources() {
  const read = async name => (await readFile(`/sys/fs/cgroup${group}/${name}`, 'utf8')).trim();
  const events = Object.fromEntries((await read('memory.events')).split('\n').map(row => { const [key, value] = row.split(' '); return [key, Number(value)]; }));
  const peak = await read('memory.peak').catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  const memoryMaxBytes = Number(await read('memory.max'));
  if (!Number.isFinite(memoryMaxBytes) || memoryMaxBytes <= 0 || memoryMaxBytes > 3 * 1024 ** 3) throw new Error('QA memory isolation mismatch');
  return { path: group, memoryPeakBytes: peak === null ? null : Number(peak), peakAvailability: peak === null ? 'kernel counter unavailable' : 'kernel high-water mark', memoryCurrentSampleBytes: Number(await read('memory.current')), memoryMaxBytes, events };
}
if (args[0] === '--worker') {
  if (!args[1]?.startsWith('/var/tmp/') || !['before', 'after'].includes(args[2])) throw new Error('Invalid worker inputs');
  const fixture = JSON.parse(await readFile(args[1], 'utf8'));
  if (fixture.id !== 'synthetic' || !fixture.userdataDir.startsWith('/var/tmp/')) throw new Error('Synthetic storage required');
  const adapter = await importGrowthRequest(fixture, { migrationBaseline: args[2] === 'before' });
  const originalInfo = console.info;
  console.info = () => {};
  try {
    const range = { from: '2025-10-09', to: '2026-10-08', fromUtc: '2025-10-08T16:00:00.000Z', toExclusiveUtc: '2026-10-08T16:00:00.000Z', requestedDays: 365, selectedDimension: 'rating', recentFrom: '2026-07-11' };
    const started = performance.now();
    const result = await adapter.service.getSkillPassport(1, range, { shareScoreEvidence: true });
    const milliseconds = performance.now() - started;
    const text = JSON.stringify(result);
    console.log(JSON.stringify({ variant: args[2], milliseconds, sha256: createHash('sha256').update(text).digest('hex'), responseBytes: Buffer.byteLength(text), maxRssBytes: process.resourceUsage().maxRSS * 1024, cgroup: await resources(), counters: adapter.counters }));
  } finally { console.info = originalInfo; adapter.dispose(); }
} else {
  const out = args[0];
  if (!out?.startsWith('/var/tmp/')) throw new Error('Require disk-backed artifact directory');
  await mkdir(out, { recursive: true, mode: 0o700 });
  const fixture = await prepareFixture('iso-full', out);
  const path = resolve(out, 'fixture.json');
  const samples = [];
  try {
    await writeFile(path, JSON.stringify(fixture), { mode: 0o600 });
    for (let pair = 0; pair < 3; pair++) for (const variant of pair % 2 ? ['after', 'before'] : ['before', 'after']) {
      const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--worker', path, variant], { encoding: 'utf8', timeout: 60000, maxBuffer: 16384 });
      if (child.error || child.status !== 0) throw new Error(`Migration worker failed: ${variant}; status=${child.status}; ${String(child.stderr).slice(0, 1500)}`);
      samples.push(JSON.parse(child.stdout.trim()));
    }
    if (new Set(samples.map(row => row.sha256)).size !== 1) throw new Error('Phase 5 DTO parity failed');
    const median = rows => [...rows].sort((a, b) => a - b)[Math.floor(rows.length / 2)];
    const summary = { baseline: '060dc05 / 0.81.10', fixture: 'iso-full / 2,001 available, 2,000 selected x 500 charts', dtoParity: true, samples,
      beforeMedianMs: median(samples.filter(row => row.variant === 'before').map(row => row.milliseconds)), afterMedianMs: median(samples.filter(row => row.variant === 'after').map(row => row.milliseconds)),
      scope: 'Offline real service orchestration; mocked DB/Python/catalog; warm disk, fresh process. Not production latency.' };
    await writeFile(resolve(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', { mode: 0o600 });
    console.log(JSON.stringify({ beforeMs: summary.beforeMedianMs, afterMs: summary.afterMedianMs, dtoParity: true, maxRssBytes: Math.max(...samples.map(row => row.maxRssBytes)) }));
  } finally { await rm(fixture.userdataDir, { recursive: true, force: true }); await rm(path, { force: true }); }
}
