import {qaTempPrefix} from './fixtures/qaPaths.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile, readdir, stat, utimes, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { prepareFixture } from '../scripts/performance/growth-benchmark-fixtures.mjs';
import { importGrowthRequest } from './fixtures/growthRequestHarness.mjs';
import { importGrowthModule } from '../scripts/performance/growth-module-loader.mjs';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const range = { from: '2025-10-09', to: '2026-10-08', fromUtc: '2025-10-08T16:00:00.000Z', toExclusiveUtc: '2026-10-08T16:00:00.000Z', requestedDays: 365, selectedDimension: 'rating', recentFrom: '2026-07-11' };
const run = async (fixture, baseline, options = {}, selectedRange = range) => {
  const adapter = await importGrowthRequest(fixture, { baseline, ...options });
  try { return { result: await adapter.service.getSkillPassport(1, selectedRange, { shareScoreEvidence: !baseline }), counters: { ...adapter.counters } }; }
  finally { adapter.dispose(); }
};
for (const mode of ['mixed', 'no-baseline', 'invalid', 'boundary', 'truncated']) test(`Passport service evidence sharing and exact DTO parity: ${mode}`, async () => {
  const out = await mkdtemp(qaTempPrefix('growth-request-'));
  try {
    const fixture = await prepareFixture(mode, out);
    // Exercise persisted Goal projection and a frozen daily ability point.
    const history = await importGrowthModule('utils/growthHistory.ts');
    fixture.goalFacts = [history.projectGoalFact(1, 1, { id: '42', status: 'completed', title: 'synthetic', songId: 1, difficultyType: 4,
      completedAt: '2026-10-08T05:00:00Z', completionEvidence: { observationRevision: 'fixture', evaluationVersion: 1, observationCapturedAt: '2026-10-07T16:00:00Z', provenance: { source: 'wahlap' }, result: { goalType: 'score-pb', before: 1, after: 2, delta: 1 } } })];
    await writeFile(resolve(fixture.userdataDir, fixture.id, 'daily-ability-v1-top20.json'), JSON.stringify({ version: 1, namespace: 'v1-top20', days: {
      '2026-10-07': { capturedAt: '2026-10-07T05:00:00Z', rating: 8, dimensions: Object.fromEntries(['大歌力','体力','高速处理','精度力','节奏处理','复合处理'].map(key => [key, 8])), sampleCount: 30 }
    } }));
    fixture.measurements = [{ id: 'frozen', ownerId: '1', bindingId: '1', capturedAt: '2026-10-07T04:00:00Z', scoreRevision: 'frozen', measurementVersion: 1, algorithmVersion: 'growth-v1', modelRevision: 'frozen-model', rating: 7,
      dimensions: Object.fromEntries(['big_song','stamina','speed','accuracy_power','rhythm','complex'].map(key => [key, 7])), focus: 'balanced', sampleCount: 30, availabilityState: 'ready' }];
    const before = await run(fixture, true), after = await run(fixture, false);
    // The owner-approved per-chart policy preserves this fixture's legitimate
    // milestone. Compare the complete frozen DTO again, with no exclusions.
    assert.equal(digest(after.result), digest(before.result), 'Passport facts, time/evidence, coverage or frozen abilities changed');
    assert.equal(after.result.segments.flatMap(segment => segment.points).find(point => point.id === 'frozen')?.rating, 7, 'past persisted capability must remain authoritative');
    const factor = mode === 'invalid' ? 1 : 2;
    assert.equal(before.counters.enumeration, 2);
    for (const key of ['reads', 'parseAttempts', 'parses', 'bytes', 'normalization']) assert.equal(before.counters[key], after.counters[key] * factor, `${key} not halved`);
    // Daily's one-day range and History's recent range remain separate.
    for (const counters of [before.counters, after.counters]) { assert.equal(counters.daily, 1); assert.equal(counters.range, 2); assert.equal(counters.scoreFacts, 1); assert.equal(counters.currentReads, 2); assert.equal(counters.archiveReads, 2); }
    assert.equal(after.counters.reads, (mode === 'truncated' ? 2000 : mode === 'boundary' ? 12 : 40) * (mode === 'invalid' ? 2 : 1));
    // No retained global resolved cache: a separate request loads again.
    const next = await run(fixture, false); assert.equal(next.counters.reads, after.counters.reads);
    assert.equal(digest(next.result), digest(after.result));
  } finally { await rm(out, { recursive: true, force: true }); }
});

test('default Passport path shares stable history and reloads after changes in the same request', async () => {
  const out = await mkdtemp(qaTempPrefix('growth-request-fresh-')); let adapter;
  try {
    const fixture = await prepareFixture('mixed', out); adapter = await importGrowthRequest(fixture);
    await adapter.service.getSkillPassport(1, range);
    assert.equal(adapter.counters.reads, 40, 'HTTP default must use validated sharing');
    const request = adapter.evidence.createGrowthScoreEvidenceRequest(fixture.id);
    const firstPromise = request(fixture.id);
    assert.equal(firstPromise, request(fixture.id));
    const first = await firstPromise;
    assert.equal(await request(fixture.id), first, 'unchanged files can reuse settled evidence');
    const fingerprint = digest(first);
    const daily = await importGrowthModule('utils/dailyProgress.ts');
    daily.deriveDailyProgress(fixture.current, first.snapshots, '2026-10-08', () => 'synthetic');
    daily.deriveProgressForRange(fixture.current, first.snapshots, '2026-07-11', '2026-10-08', () => 'synthetic', 'current');
    assert.equal(digest(first), fingerprint, 'projections must not mutate retained evidence');
    const added = resolve(fixture.userdataDir, fixture.id, 'data_20261008_130000.json');
    await writeFile(added, JSON.stringify({ songs: fixture.current, _meta: { full: true, ts: '2026-10-08T05:00:00Z', writer_source: 'wahlap' } }));
    const appended = await request(fixture.id);
    assert.equal(appended.snapshots.length, first.snapshots.length + 1);
    assert.equal(digest(appended), digest(await adapter.evidence.loadGrowthScoreEvidence(fixture.id)));
    await rm(added);
    assert.equal(digest(await request(fixture.id)), fingerprint, 'deletion must invalidate');
    const path = resolve(fixture.userdataDir, fixture.id, (await readdir(resolve(fixture.userdataDir, fixture.id))).filter(name => name.startsWith('data_')).sort()[0]);
    const originalStat = await stat(path), raw = await readFile(path, 'utf8');
    const changed = raw.replace('900001', '900002');
    assert.notEqual(changed, raw); assert.equal(changed.length, raw.length);
    await writeFile(path, changed); await utimes(path, originalStat.atime, originalStat.mtime);
    const rewritten = await request(fixture.id);
    assert.notEqual(digest(rewritten), fingerprint, 'same-size rewrite with restored mtime must invalidate');
    assert.equal(digest(rewritten), digest(await adapter.evidence.loadGrowthScoreEvidence(fixture.id)));
    await writeFile(`${path}.replacement`, raw); await rename(`${path}.replacement`, path);
    assert.equal(digest(await request(fixture.id)), fingerprint, 'atomic replacement must invalidate');
    assert.equal((await request('other-account')).snapshots.length, 0);
    assert.notEqual(await adapter.evidence.loadGrowthScoreEvidence(fixture.id), first, 'independent calls have no resolved cache');
    const next = adapter.evidence.createGrowthScoreEvidenceRequest(fixture.id);
    assert.notEqual(await next(fixture.id), first);
  } finally { adapter?.dispose(); await rm(out, { recursive: true, force: true }); }
});

test('Overview compute failure still reuses successfully loaded evidence for History', async () => {
  const out = await mkdtemp(qaTempPrefix('growth-request-failure-'));
  try {
    const fixture = await prepareFixture('mixed', out);
    const before = await run(fixture, true, { failPython: true }), after = await run(fixture, false, { failPython: true });
    assert.equal(digest(after.result), digest(before.result)); assert.equal(after.counters.reads, 40);
    assert.equal(after.counters.daily, 0); assert.equal(after.counters.range, 1);
  } finally { await rm(out, { recursive: true, force: true }); }
});

test('all Passport periods preserve DTOs and manual History remains independent of score evidence', async () => {
  const out = await mkdtemp(qaTempPrefix('growth-request-periods-'));
  try {
    const fixture = await prepareFixture('mixed', out);
    for (const requestedDays of [30, 90, 180, 365]) {
      const from = new Date(Date.parse('2026-10-08T00:00:00Z') - (requestedDays - 1) * 86400000).toISOString().slice(0,10);
      const selected = { ...range, requestedDays, from, fromUtc: new Date(`${from}T00:00:00+08:00`).toISOString() };
      const before = await run(fixture, true, {}, selected), after = await run(fixture, false, {}, selected);
      assert.equal(digest(after.result), digest(before.result)); assert.equal(after.counters.reads, 40);
    }
    const options = { binding: () => ({ id: 1, taiko_id: fixture.id, source: 'manual' }) };
    const before = await run(fixture, true, options), after = await run(fixture, false, options);
    assert.equal(digest(after.result), digest(before.result));
    assert.equal(before.counters.reads, 40); assert.equal(after.counters.reads, 40);
    assert.equal(after.counters.scoreFacts, 0); assert.equal(after.counters.currentReads, 1);
  } finally { await rm(out, { recursive: true, force: true }); }
});

test('binding switch is rejected by the actual Passport guard', async () => {
  const out = await mkdtemp(qaTempPrefix('growth-request-binding-')); let adapter;
  try {
    const fixture = await prepareFixture('mixed', out); let calls = 0;
    adapter = await importGrowthRequest(fixture, { binding: () => ({ id: ++calls === 1 ? 1 : 2, taiko_id: fixture.id, source: 'wahlap' }) });
    await assert.rejects(adapter.service.getSkillPassport(1, range), error => error.statusCode === 409 && error.message === 'profile-changed');
  } finally { adapter?.dispose(); await rm(out, { recursive: true, force: true }); }
});

test('missing or invalid history is retried in the same request', async () => {
  const out = await mkdtemp(qaTempPrefix('growth-request-retry-')); let adapter;
  try {
    const fixture = await prepareFixture('invalid', out); adapter = await importGrowthRequest(fixture);
    const request = adapter.evidence.createGrowthScoreEvidenceRequest(fixture.id);
    const invalid = await request(fixture.id);
    assert.equal(invalid.invalidFiles, 2);
    assert.notEqual(await request(fixture.id), invalid, 'partial reads are not retained');
    const directory = resolve(fixture.userdataDir, fixture.id);
    await rename(directory, `${directory}-offline`);
    assert.equal((await request(fixture.id)).snapshots.length, 0);
    await rename(`${directory}-offline`, directory);
    assert.equal((await request(fixture.id)).snapshots.length, invalid.snapshots.length);
  } finally { adapter?.dispose(); await rm(out, { recursive: true, force: true }); }
});

test('sync between Overview and History preserves the original complete Passport DTO', async () => {
  const out = await mkdtemp(qaTempPrefix('growth-request-sync-'));
  try {
    const fixture = await prepareFixture('mixed', out);
    const path = resolve(fixture.userdataDir, fixture.id, 'data_20261008_130000.json');
    const sync = async () => writeFile(path, JSON.stringify({ songs: fixture.current.map(row => ({ ...row, high_score: row.high_score + 50, highscore_datetime: '2026-10-08T05:00:00Z' })), _meta: { full: true, ts: '2026-10-08T05:00:00Z', writer_source: 'wahlap' } }));
    const before = await run(fixture, true, { onPython: sync });
    await rm(path);
    const after = await run(fixture, false, { onPython: sync });
    assert.equal(digest(after.result), digest(before.result), 'History must see the synchronized evidence just as 0.81.9 did');
    assert.equal(after.counters.reads, 81, 'changed history must load again');
  } finally { await rm(out, { recursive: true, force: true }); }
});

test('write during initial load prevents retaining mixed evidence; metadata failure fails open to fresh reads', async () => {
  const out = await mkdtemp(qaTempPrefix('growth-request-race-')); let adapter;
  try {
    const fixture = await prepareFixture('mixed', out);
    const path = resolve(fixture.userdataDir, fixture.id, 'data_20261008_130000.json');
    let wrote = false, failStat = false;
    adapter = await importGrowthRequest(fixture, {
      onHistoryRead: async () => {
        if (wrote) return;
        wrote = true;
        await writeFile(path, JSON.stringify({ songs: fixture.current, _meta: { full: true, ts: '2026-10-08T05:00:00Z', writer_source: 'wahlap' } }));
      },
      onHistoryStat: async () => { if (failStat) throw new Error('synthetic stat failure'); }
    });
    const request = adapter.evidence.createGrowthScoreEvidenceRequest(fixture.id);
    assert.equal((await request(fixture.id)).snapshots.length, 40);
    const fresh = await request(fixture.id);
    assert.equal(fresh.snapshots.length, 41, 'changed input during loading must be read again');
    failStat = true;
    const fallback = await request(fixture.id);
    assert.notEqual(fallback, fresh, 'stat failure must not serve retained data');
    assert.equal(digest(fallback), digest(fresh));
    failStat = false;
    const recovered = await request(fixture.id);
    assert.notEqual(recovered, fallback);
    assert.equal(await request(fixture.id), recovered, 'successful metadata checks can resume reuse');
  } finally { adapter?.dispose(); await rm(out, { recursive: true, force: true }); }
});

test('transient directory changes during loading invalidate even when final filenames match', async () => {
  const out = await mkdtemp(qaTempPrefix('growth-request-transient-')); let adapter;
  try {
    const fixture = await prepareFixture('mixed', out);
    const path = resolve(fixture.userdataDir, fixture.id, 'data_20200101_000000.json');
    let enumerations = 0, removeAtStat = false;
    adapter = await importGrowthRequest(fixture, {
      onHistoryEnumerate: async () => {
        if (++enumerations === 2) {
          await writeFile(path, JSON.stringify({ songs: fixture.current, _meta: { full: true, ts: '2020-01-01T00:00:00Z', writer_source: 'wahlap' } }));
          removeAtStat = true;
        }
      },
      onHistoryStat: async () => {
        if (removeAtStat) { removeAtStat = false; await rm(path); }
      }
    });
    const request = adapter.evidence.createGrowthScoreEvidenceRequest(fixture.id);
    assert.equal((await request(fixture.id)).snapshots.length, 41);
    assert.equal((await request(fixture.id)).snapshots.length, 40, 'directory ctime must reject evidence from a transient filename set');
  } finally { adapter?.dispose(); await rm(out, { recursive: true, force: true }); }
});
