import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
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
  const out = await mkdtemp('/var/tmp/growth-request-');
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
    assert.equal(digest(after.result), digest(before.result), 'Passport facts, time/evidence, coverage or frozen abilities changed');
    assert.equal(after.result.segments.flatMap(segment => segment.points).find(point => point.id === 'frozen')?.rating, 7, 'past persisted capability must remain authoritative');
    assert.equal(before.counters.enumeration, 2); assert.equal(after.counters.enumeration, 1);
    for (const key of ['reads', 'parseAttempts', 'parses', 'bytes', 'normalization']) assert.equal(before.counters[key], after.counters[key] * 2, `${key} not halved`);
    // Daily's one-day range and History's recent range remain separate.
    for (const counters of [before.counters, after.counters]) { assert.equal(counters.daily, 1); assert.equal(counters.range, 2); assert.equal(counters.scoreFacts, 1); assert.equal(counters.currentReads, 2); assert.equal(counters.archiveReads, 2); }
    assert.equal(after.counters.reads, mode === 'truncated' ? 2000 : mode === 'boundary' ? 12 : 40);
    // No retained global resolved cache: a separate request loads again.
    const next = await run(fixture, false); assert.equal(next.counters.enumeration, 1);
    assert.equal(digest(next.result), digest(after.result));
  } finally { await rm(out, { recursive: true, force: true }); }
});

test('default Passport path remains unshared and new history is visible to a fresh scope', async () => {
  const out = await mkdtemp('/var/tmp/growth-request-fresh-'); let adapter;
  try {
    const fixture = await prepareFixture('mixed', out); adapter = await importGrowthRequest(fixture);
    await adapter.service.getSkillPassport(1, range);
    assert.equal(adapter.counters.enumeration, 2, 'unproven optimization must not activate on the HTTP default path');
    const request = adapter.evidence.createGrowthScoreEvidenceRequest(fixture.id);
    const first = await request(fixture.id);
    await writeFile(resolve(fixture.userdataDir, fixture.id, 'data_20261008_130000.json'), JSON.stringify({ songs: fixture.current, _meta: { full: true, ts: '2026-10-08T05:00:00Z', writer_source: 'wahlap' } }));
    assert.equal((await request(fixture.id)).snapshots.length, first.snapshots.length, 'candidate explicitly pins first evidence');
    const next = adapter.evidence.createGrowthScoreEvidenceRequest(fixture.id);
    assert.equal((await next(fixture.id)).snapshots.length, first.snapshots.length + 1, 'independent scope must see new history');
    assert.equal((await adapter.evidence.loadGrowthScoreEvidence(fixture.id)).snapshots.length, first.snapshots.length + 1);
  } finally { adapter?.dispose(); await rm(out, { recursive: true, force: true }); }
});

test('request scope shares settled promises, never shares another account, and defaults remain fresh', async () => {
  const out = await mkdtemp('/var/tmp/growth-request-scope-');
  let adapter;
  try {
    const fixture = await prepareFixture('mixed', out); adapter = await importGrowthRequest(fixture);
    const request = adapter.evidence.createGrowthScoreEvidenceRequest(fixture.id);
    const first = request(fixture.id); assert.equal(first, request(fixture.id));
    const evidence = await first; assert.equal(await request(fixture.id), evidence);
    assert.equal(adapter.counters.enumeration, 1);
    assert.equal((await request('other-account')).snapshots.length, 0); assert.equal(adapter.counters.enumeration, 2);
    const standalone = await adapter.evidence.loadGrowthScoreEvidence(fixture.id);
    assert.notEqual(standalone, evidence); assert.equal(adapter.counters.enumeration, 3);
    // All production projections used by this optimization must leave shared input intact.
    const fingerprint = digest(evidence);
    const daily = await importGrowthModule('utils/dailyProgress.ts');
    daily.deriveDailyProgress(fixture.current, evidence.snapshots, '2026-10-08', () => 'synthetic');
    daily.deriveProgressForRange(fixture.current, evidence.snapshots, '2026-07-11', '2026-10-08', () => 'synthetic', 'current');
    const recent = await importGrowthModule('server/services/growth-recent/boundary.ts');
    recent.selectRecentObservationWindow(evidence.observations, null);
    assert.equal(digest(evidence), fingerprint);
  } finally { adapter?.dispose(); await rm(out, { recursive: true, force: true }); }
});

test('Overview compute failure still reuses successfully loaded evidence for History', async () => {
  const out = await mkdtemp('/var/tmp/growth-request-failure-');
  try {
    const fixture = await prepareFixture('mixed', out);
    const before = await run(fixture, true, { failPython: true }), after = await run(fixture, false, { failPython: true });
    assert.equal(digest(after.result), digest(before.result)); assert.equal(after.counters.enumeration, 1);
    assert.equal(after.counters.daily, 0); assert.equal(after.counters.range, 1);
  } finally { await rm(out, { recursive: true, force: true }); }
});

test('all Passport periods preserve DTOs and manual History remains independent of score evidence', async () => {
  const out = await mkdtemp('/var/tmp/growth-request-periods-');
  try {
    const fixture = await prepareFixture('mixed', out);
    for (const requestedDays of [30, 90, 180, 365]) {
      const from = new Date(Date.parse('2026-10-08T00:00:00Z') - (requestedDays - 1) * 86400000).toISOString().slice(0,10);
      const selected = { ...range, requestedDays, from, fromUtc: new Date(`${from}T00:00:00+08:00`).toISOString() };
      const before = await run(fixture, true, {}, selected), after = await run(fixture, false, {}, selected);
      assert.equal(digest(after.result), digest(before.result)); assert.equal(after.counters.enumeration, 1);
    }
    const options = { binding: () => ({ id: 1, taiko_id: fixture.id, source: 'manual' }) };
    const before = await run(fixture, true, options), after = await run(fixture, false, options);
    assert.equal(digest(after.result), digest(before.result));
    assert.equal(before.counters.enumeration, 1); assert.equal(after.counters.enumeration, 1);
    assert.equal(after.counters.scoreFacts, 0); assert.equal(after.counters.currentReads, 1);
  } finally { await rm(out, { recursive: true, force: true }); }
});

test('binding switch is rejected by the actual Passport guard', async () => {
  const out = await mkdtemp('/var/tmp/growth-request-binding-'); let adapter;
  try {
    const fixture = await prepareFixture('mixed', out); let calls = 0;
    adapter = await importGrowthRequest(fixture, { binding: () => ({ id: ++calls === 1 ? 1 : 2, taiko_id: fixture.id, source: 'wahlap' }) });
    await assert.rejects(adapter.service.getSkillPassport(1, range), error => error.statusCode === 409 && error.message === 'profile-changed');
  } finally { adapter?.dispose(); await rm(out, { recursive: true, force: true }); }
});

test('scope rejects once then retries rather than retaining a rejected promise', async () => {
  // Inject only the leaf loader into the actual factory; exercise rejection branch
  // without teaching the real evidence reader a new error policy.
  const source = await readFile(new URL('../server/services/growth-history/evidence.ts', import.meta.url), 'utf8');
  const factory = source.slice(source.indexOf('export function createGrowthScoreEvidenceRequest'));
  const ts = (await import('typescript')).default;
  let calls = 0; const loader = async () => { if (++calls === 1) throw new Error('fixture failure'); return { snapshots: [] }; };
  const key = `scope_retry_${crypto.randomUUID().replaceAll('-', '_')}`; globalThis[key] = loader;
  try {
    const code = `const loadGrowthScoreEvidence=globalThis[${JSON.stringify(key)}];\n` + ts.transpileModule(factory, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    const { createGrowthScoreEvidenceRequest } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
    const request = createGrowthScoreEvidenceRequest('fixture'); await assert.rejects(request('fixture'), /fixture failure/);
    await request('fixture'); await request('fixture'); assert.equal(calls, 2);
  } finally { delete globalThis[key]; }
});
