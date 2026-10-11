import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { prepareFixture } from '../scripts/performance/growth-benchmark-fixtures.mjs';
import { importGrowthRequest } from './fixtures/growthRequestHarness.mjs';
import { withPublicationLease } from '../server/infrastructure/taiko-publication/client.ts';
const repoRoot = process.env.TAIKO_PUBLICATION_TEST_REPO_ROOT || '/home/sigaer/git/Sakura_bot/taiko';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const range = { from: '2025-10-09', to: '2026-10-08', fromUtc: '2025-10-08T16:00:00.000Z', toExclusiveUtc: '2026-10-08T16:00:00.000Z', requestedDays: 365, selectedDimension: 'rating', recentFrom: '2026-07-11' };
const options = fixture => ({ root: fixture.userdataDir, repoRoot, identity: fixture.id });
async function adopt(fixture) {
  await withPublicationLease({ ...options(fixture), mode: 'write' }, async lease => {
    await lease.put('current', await readFile(resolve(fixture.userdataDir, `${fixture.id}data.json`), 'utf8'));
    await lease.publish();
  });
}
for (const mode of ['mixed', 'invalid']) test(`real managed source retains complete Passport DTO and historical evidence: ${mode}`, async () => {
  const root = await mkdtemp('/var/tmp/growth-publication-parity-');
  let before, after;
  try {
    const fixture = await prepareFixture(mode, root);
    before = await importGrowthRequest(fixture, { baseline: true });
    const expected = await before.service.getSkillPassport(1, range, { shareScoreEvidence: false });
    before.dispose(); before = null;
    after = await importGrowthRequest(fixture);
    await adopt(fixture);
    const actual = await after.service.getSkillPassport(1, range);
    assert.equal(digest(actual), digest(expected));
    const evidence = await after.evidence.loadGrowthScoreEvidence(fixture.id);
    assert.equal(evidence.invalidFiles, mode === 'invalid' ? 2 : 0);
  } finally { before?.dispose(); after?.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('actual managed Passport holds one source view while an independent sync waits, then observes the new commit', async () => {
  const root = await mkdtemp('/var/tmp/growth-publication-consistency-');
  let adapter, before;
  let startSync;
  const gate = new Promise(resolve => { startSync = resolve; });
  let entered = false;
  let sync;
  try {
    const fixture = await prepareFixture('mixed', root);
    before = await importGrowthRequest(fixture, { baseline: true });
    const expected = await before.service.getSkillPassport(1, range, { shareScoreEvidence: false });
    before.dispose(); before = null;
    const next = { songs: fixture.current.map(row => ({ ...row, high_score: row.high_score + 50 })), _meta: { full: true, ts: '2026-10-08 13:00:00', writer_source: 'wahlap' } };
    sync = gate.then(() => withPublicationLease({ ...options(fixture), mode: 'write' }, async lease => {
      entered = true;
      await lease.put('current', JSON.stringify(next));
      await lease.put('history/data_20261008_130000_000000_sync.json', JSON.stringify(next));
      await lease.publish();
    }));
    adapter = await importGrowthRequest(fixture, { onPython: async () => {
      startSync();
      await new Promise(resolve => setTimeout(resolve, 100));
      assert.equal(entered, false, 'sync cannot start inside a managed multi-read request');
    } });
    await adopt(fixture);
    assert.equal(digest(await adapter.service.getSkillPassport(1, range)), digest(expected));
    await sync;
    assert.equal(entered, true);
    assert.equal((await adapter.evidence.loadGrowthScoreEvidence(fixture.id)).totalFiles, 41);
  } finally {
    startSync();
    await sync?.catch(() => undefined);
    adapter?.dispose(); before?.dispose();
    await rm(root, { recursive: true, force: true });
  }
});

test('actual managed evidence rejects corrupt canonical objects instead of returning partial Growth', async () => {
  const root = await mkdtemp('/var/tmp/growth-publication-corruption-');
  let adapter;
  try {
    const fixture = await prepareFixture('mixed', root);
    adapter = await importGrowthRequest(fixture);
    await adopt(fixture);
    let hash;
    await withPublicationLease({ ...options(fixture), mode: 'read' }, async lease => {
      hash = Object.entries(lease.view.files).find(([key]) => key.startsWith('history/'))[1].sha256;
    });
    await rm(resolve(fixture.userdataDir, '.taiko-publications', fixture.id, 'objects', hash));
    await assert.rejects(adapter.evidence.loadGrowthScoreEvidence(fixture.id), error => error.name === "PublicationUnavailableError" && error.statusCode === 503);
  } finally { adapter?.dispose(); await rm(root, { recursive: true, force: true }); }
});
