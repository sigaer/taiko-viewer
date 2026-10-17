import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { accountPublicationFixture as fixture } from './fixtures/accountScorePublicationHarness.mjs';
const identity = 'synthetic';
const payload = songNo => ({ songNo, level: 4, values: { high_score: 900000 } });
async function head(service) { return service.withDomainScoreRead(identity, async () => ({ ...service.scorePublication(identity) })); }

test('actual shared module composes through its import cycle and keeps repeated-clock observations', async () => fixture(async (service, state, root) => {
  await service.writeUserdataWithHistory(identity, { songs: [] }, 'web-account');
  await service.writeUserdataWithHistory(identity, { songs: [] }, 'web-account');
  const manifest = await head(service);
  assert.equal(manifest.sequence, 3);
  assert.equal(Object.keys(manifest.files).filter(key => key.startsWith('history/')).length, 3);
  const names = (await readdir(resolve(root, identity))).filter(name => name.startsWith('data_')).sort();
  const last = JSON.parse(await readFile(resolve(root, identity, names.at(-1)), 'utf8'));
  assert.equal(last._meta.full, true);
  assert.equal(last._meta.ts, '2026-10-11 09:00:00');
  assert.equal(last._meta.writer_source, 'web-account');
}));

test('actual concurrent account edits preserve both changed charts and publish full histories', async () => fixture(async service => {
  await Promise.all([service.updateAccountSong(1, payload(1)), service.updateAccountSong(1, payload(2))]);
  const current = await service.readUserdata(identity);
  assert.equal(current.songs.every(row => row.high_score === 900000), true);
  assert.equal((await head(service)).sequence, 3);
}));

test('actual new chart creation preserves its SQL lock and commits its score on success', async () => fixture(async (service, state) => {
  const row = await service.createAccountSong(1, payload(3));
  assert.equal(row.songNo, 3);
  assert.equal(state.locks.has('3:4'), true);
  assert.equal((await service.readUserdata(identity)).songs.length, 3);
  assert.equal((await head(service)).sequence, 2);
}));

test('post-staging business failure compensates a new chart lock without publishing the score', async () => fixture(async (service, state) => {
  const before = await head(service);
  state.failLockReadAt = 2;
  await assert.rejects(service.createAccountSong(1, payload(3)), /Synthetic lock lookup failure/);
  assert.equal(state.locks.size, 0);
  assert.equal((await head(service)).commitId, before.commitId);
  assert.equal((await service.readUserdata(identity)).songs.length, 2);
}));

test('post-staging failure preserves an already existing lock', async () => fixture(async (service, state) => {
  state.locks.add('3:4'); state.failLockReadAt = 2;
  await assert.rejects(service.createAccountSong(1, payload(3)), /Synthetic lock lookup failure/);
  assert.equal(state.locks.has('3:4'), true);
  assert.equal((await head(service)).sequence, 1);
}));

test('partial SQL failure in actual bulk import rolls back new locks and the whole score batch', async () => fixture(async (service, state) => {
  state.locks.add('1:4'); state.failInsertAt = 3;
  await assert.rejects(service.importAccountSongs(1, [1, 2, 3].map(song_no => ({ song_no, level: 4, high_score: 999999 }))), /Synthetic DB write failure/);
  assert.deepEqual([...state.locks], ['1:4']);
  assert.equal((await head(service)).sequence, 1);
  assert.equal((await service.readUserdata(identity)).songs[0].high_score, 800000);
}));

test('actual new chart creation verifies a lost commit response before preserving its SQL lock', async () => fixture(async (service, state) => {
  const row = await service.withUserdataWriteLock(identity, async () => {
    const result = await service.createAccountSong(1, payload(3));
    const lease = service.currentScoreScope(identity).lease;
    const publish = lease.publish;
    lease.publish = async input => { await publish(input); throw new Error('Synthetic lost response'); };
    return result;
  });
  assert.equal(row.songNo, 3);
  assert.equal(state.locks.has('3:4'), true);
  assert.equal((await head(service)).sequence, 2);
}));


test('actual SQL song lock changes serialize with source readers and writers', async () => fixture(async (service, state) => {
  let start;
  const gate = new Promise(resolve => { start = resolve; });
  const writer = gate.then(() => service.setAccountSongLock(1, { songNo: 1, level: 4, locked: true }));
  await service.withDomainScoreRead(identity, async () => {
    start();
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(state.locks.has('1:4'), false);
  });
  await writer;
  assert.equal(state.locks.has('1:4'), true);
  assert.equal((await head(service)).sequence, 1, 'a lock flag does not create new score evidence');
}));

test('actual account mutation rechecks the source identity after acquiring its fence', async () => fixture(async (service, state) => {
  const initial = { ...state.binding };
  let calls = 0;
  Object.defineProperty(state, 'binding', { get: () => ++calls === 1 ? initial : { ...initial, taiko_id: 'changed' } });
  await assert.rejects(service.updateAccountSong(1, payload(1)), error => error.statusCode === 409);
  assert.equal((await head(service)).sequence, 1);
}));
