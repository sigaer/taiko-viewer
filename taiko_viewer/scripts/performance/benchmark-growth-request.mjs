#!/usr/bin/env node
// Run through scripts/memory/run_qa.sh. Offline synthetic inputs only.
// Measures current service orchestration, not the older 365-day raw fact probe.
import { spawnSync } from 'node:child_process';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { prepareFixture } from './growth-benchmark-fixtures.mjs';
import { importGrowthRequest } from '../../tests/fixtures/growthRequestHarness.mjs';
const args = process.argv.slice(2);
const cgroup = (await readFile('/proc/self/cgroup', 'utf8')).split('\n').find(line => line.startsWith('0::'))?.slice(3);
if (!cgroup?.includes('development-qa.slice/taiko-qa-')) throw new Error('Require approved isolated QA launcher');
if (args[0] === '--worker') {
  const fixture = JSON.parse(await readFile(args[1], 'utf8'));
  const adapter = await importGrowthRequest(fixture, { baseline: args[2] === 'before' });
  const range = { from: '2025-10-09', to: '2026-10-08', fromUtc: '2025-10-08T16:00:00.000Z', toExclusiveUtc: '2026-10-08T16:00:00.000Z', requestedDays: 365, selectedDimension: 'rating', recentFrom: '2026-07-11' };
  const info = console.info; console.info = () => {};
  try {
    const started = performance.now(); const result = await adapter.service.getSkillPassport(1, range, { shareScoreEvidence: args[2] === 'after' });
    const totalMs = performance.now() - started;
    console.log(JSON.stringify({ variant: args[2], totalMs, counters: adapter.counters,
      dtoDigest: createHash('sha256').update(JSON.stringify(result)).digest('hex'), responseBytes: Buffer.byteLength(JSON.stringify(result)),
      maxRssBytes: process.resourceUsage().maxRSS * 1024,
      scope: 'real services; injected DB/Python/catalog; 365-day measurements plus 90-day facts; not production latency' }));
  } finally { console.info = info; adapter.dispose(); }
} else {
  const out = args[0];
  if (!out?.startsWith('/var/tmp/')) throw new Error('Require /var/tmp output directory');
  const allowed = new Set(['iso-full','local-full','mixed','no-baseline','invalid','boundary','truncated']);
  const modes = args.length > 1 ? args.slice(1) : ['mixed','invalid','boundary','truncated','iso-full'];
  if (modes.some(mode => !allowed.has(mode))) throw new Error('Synthetic fixtures only');
  await mkdir(out, { recursive: true, mode: 0o700 });
  const results = [];
  const median = xs => [...xs].sort((a,b) => a-b)[Math.floor(xs.length/2)];
  for (const mode of modes) {
    const fixture = await prepareFixture(mode, out);
    const metadata = resolve(out, `${mode}.fixture.json`);
    try {
      await writeFile(metadata, JSON.stringify(fixture), { mode: 0o600 });
      const samples = [];
      // Alternate order to reduce filesystem page-cache/order bias. Each sample
      // uses a fresh process; a "cold process" does not mean a cold disk cache.
      for (let pair = 0; pair < 3; pair++) {
        for (const variant of pair % 2 ? ['after','before'] : ['before','after']) {
          const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--worker', metadata, variant], { encoding: 'utf8', timeout: 60000, maxBuffer: 256 * 1024 });
          if (child.error || child.status !== 0) throw new Error(`Bounded worker failed: ${mode}/${variant}; status=${child.status}; signal=${child.signal}`);
          samples.push(JSON.parse(child.stdout.trim()));
        }
      }
      if (new Set(samples.map(sample => sample.dtoDigest)).size !== 1) throw new Error(`DTO parity failed: ${mode}`);
      const before = samples.filter(sample => sample.variant === 'before'), after = samples.filter(sample => sample.variant === 'after');
      const item = { mode, samples, medianBeforeMs: median(before.map(sample => sample.totalMs)), medianAfterMs: median(after.map(sample => sample.totalMs)), dtoParity: true };
      item.medianSavedMs = item.medianBeforeMs - item.medianAfterMs;
      results.push(item); await writeFile(resolve(out, `${mode}.result.json`), JSON.stringify(item, null, 2) + '\n', { mode: 0o600 });
      console.log(JSON.stringify({ mode, beforeMs: item.medianBeforeMs, afterMs: item.medianAfterMs, savedMs: item.medianSavedMs, dtoParity: true }));
    } finally { await rm(fixture.userdataDir, { recursive: true, force: true }); await rm(metadata, { force: true }); }
  }
  await writeFile(resolve(out, 'summary.json'), JSON.stringify({ status: 'offline measurement only', results }, null, 2) + '\n', { mode: 0o600 });
}
