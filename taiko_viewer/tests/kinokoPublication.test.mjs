import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { accountPublicationFixture as fixture } from './fixtures/accountScorePublicationHarness.mjs';
const identity = 'synthetic';
const row = (song_no, high_score, stage_cnt, timestamp = '2026-10-10 12:00:00') => ({ song_no, level: 4, high_score, stage_cnt, good_cnt: 10,
  update_datetime: timestamp, highscore_datetime: timestamp, clear_cnt: 1 });
const records = [row(1, 810000, 2), row(1, 820000, 3), row(2, 710000, 2), row(1, 830000, 4, '2026-10-10 12:01:00')];
const hash = raw => createHash('sha256').update(raw).digest('hex');
const head = service => service.withDomainScoreRead(identity, async () => ({ ...service.scorePublication(identity) }));
async function snapshots(root) {
  const directory = resolve(root, identity);
  const result = {};
  for (const name of (await readdir(directory)).filter(name => name.startsWith('data_')).sort()) result[name] = hash(await readFile(resolve(directory, name)));
  return result;
}

test('real Kinoko adapter preserves legacy full/delta raw bytes, filenames and summary', async () => fixture(async (service, state, root) => {
  const current = await service.readUserdata(identity);
  const legacy = resolve(root, 'legacy-oracle');
  await mkdir(resolve(legacy, identity), { recursive: true });
  await copyFile(resolve(root, `${identity}data.json`), resolve(legacy, `${identity}data.json`));
  for (const name of await readdir(resolve(root, identity))) await copyFile(resolve(root, identity, name), resolve(legacy, identity, name));
  let expected;
  state.config.userdataDir = legacy;
  try { expected = await service.legacyKinokoHistory(identity, records, current); }
  finally { state.config.userdataDir = root; }
  const actual = await service.writeKinokoHistorySnapshots(identity, records, current);
  assert.deepEqual(actual, expected);
  assert.deepEqual(await snapshots(root), await snapshots(legacy));
  assert.equal(actual.baselineCreated, true);
  assert.equal(actual.snapshotFiles, 4);
  assert.equal((await head(service)).sequence, 2);
}));

test('real imported histories and merged current publish in one outer source commit', async () => fixture(async (service, state, root) => {
  const before = await head(service);
  const oldCurrent = await readFile(resolve(root, `${identity}data.json`), 'utf8');
  await service.withUserdataWriteLock(identity, async () => {
    const userdata = await service.readUserdata(identity);
    await service.writeKinokoHistorySnapshots(identity, records, userdata);
    const current = service.mergeKinokoScores(userdata, [records[3]]);
    assert.equal(current.updated, 1);
    await service.writeUserdataWithHistory(identity, userdata, 'kinoko-history-current');
    assert.equal(await readFile(resolve(root, `${identity}data.json`), 'utf8'), oldCurrent);
    assert.equal(service.scorePublication(identity).commitId, before.commitId);
    assert.equal((await service.readUserdata(identity)).songs[0].high_score, 830000);
  });
  const after = await head(service);
  assert.equal(after.sequence, before.sequence + 1);
  assert.equal(Object.keys(after.files).filter(key => key.startsWith('history/')).length, 6);
  assert.equal((await service.readUserdata(identity)).songs[0].high_score, 830000);
}));

test('real Kinoko retry deduplicates committed and already-staged observations', async () => fixture(async service => {
  const current = await service.readUserdata(identity);
  await service.withUserdataWriteLock(identity, async () => {
    assert.equal((await service.writeKinokoHistorySnapshots(identity, records, current)).importedRecords, 4);
    const again = await service.writeKinokoHistorySnapshots(identity, records, current);
    assert.equal(again.importedRecords, 0);
    assert.equal(again.skippedRecords, 4);
    assert.equal(again.snapshotFiles, 0);
  });
  const before = await head(service);
  const retry = await service.writeKinokoHistorySnapshots(identity, records, current);
  assert.equal(retry.snapshotFiles, 0);
  assert.equal((await head(service)).commitId, before.commitId);
}));

test('business failure after imported histories were staged leaves the old batch intact', async () => fixture(async service => {
  const before = await head(service);
  await assert.rejects(service.withUserdataWriteLock(identity, async () => {
    await service.writeKinokoHistorySnapshots(identity, records, await service.readUserdata(identity));
    throw new Error('Synthetic subsequent current failure');
  }), /Synthetic subsequent current failure/);
  assert.equal((await head(service)).commitId, before.commitId);
  assert.equal(Object.keys((await head(service)).files).filter(key => key.startsWith('history/')).length, 1);
}));

test('bridge failure midway through real Kinoko staging does not publish a partial import', async () => fixture(async service => {
  await assert.rejects(service.withUserdataWriteLock(identity, async () => {
    const scope = service.currentScoreScope(identity), put = scope.lease.put;
    let count = 0;
    scope.lease.put = async (...args) => { if (++count === 3) throw new Error('Synthetic stage failure'); return put(...args); };
    await service.writeKinokoHistorySnapshots(identity, records, await service.readUserdata(identity));
  }), /Synthetic stage failure/);
  assert.equal((await head(service)).sequence, 1);
  assert.equal((await service.writeKinokoHistorySnapshots(identity, records, await service.readUserdata(identity))).snapshotFiles, 4);
}));

test('real import preserves independent frozen archives and malformed old evidence', async () => fixture(async (service, state, root) => {
  await service.withUserdataWriteLock(identity, async () => {
    await service.stageScoreText(identity, 'history/data_bad.json', '{invalid');
  });
  const archive = '{"days":{"2026-10-09":{"rating":8}}}';
  await writeFile(resolve(root, identity, 'daily-ability-v1-top20.json'), archive);
  const result = await service.writeKinokoHistorySnapshots(identity, records, await service.readUserdata(identity));
  assert.equal(result.importedRecords, 4);
  assert.equal(await readFile(resolve(root, identity, 'daily-ability-v1-top20.json'), 'utf8'), archive);
  assert.equal(await readFile(resolve(root, identity, 'data_bad.json'), 'utf8'), '{invalid');
}));

test('real import bounds and timestamp validation reject before publication', async () => fixture(async service => {
  const current = await service.readUserdata(identity);
  await assert.rejects(service.writeKinokoHistorySnapshots(identity, [row(1, 1, 1, '2026-02-30 12:00:00')], current), error => error.statusCode === 502);
  const large = Array.from({ length: 10001 }, (_, i) => row(i + 1, 1, 1));
  await assert.rejects(service.writeKinokoHistorySnapshots(identity, large, current), error => error.statusCode === 400);
  assert.equal((await head(service)).sequence, 1);
}));


test('a corrupt committed object stops real Kinoko inspection before another source commit', async () => fixture(async (service, state, root) => {
  const manifest = await head(service);
  const history = Object.entries(manifest.files).find(([key]) => key.startsWith('history/'))[1];
  await writeFile(resolve(root, '.taiko-publications', identity, 'objects', history.sha256), 'corrupt');
  await assert.rejects(service.writeKinokoHistorySnapshots(identity, records, await service.readUserdata(identity)), error => error.name === 'PublicationUnavailableError' && error.statusCode === 503);
  assert.equal((await head(service)).commitId, manifest.commitId);
}));
