import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTitleConditionManager } from '../server/services/admin-title-conditions.ts';
import type { TitleCatalogItem } from '../types/content.ts';

const actor = { id: 1, username: 'test-admin' };
const official = (id = 100, rarity = 42): TitleCatalogItem => ({ id, name: 'Title', rarity, condition: 'Official condition', songIds: [7] });
function fixture(rows: TitleCatalogItem[] = [{ ...official(), id: 8, condition: 'Manual condition', songIds: [7, 9] }]) {
  const state = { local: rows, official: [official(), official(101, 60)], writes: [] as unknown[], audits: [] as unknown[], refuse: false };
  const ports = {
    official: async () => ({ titles: structuredClone(state.official), total: state.official.length }),
    local: async () => structuredClone(state.local),
    get: async (id: number) => structuredClone(state.local.find(row => row.id === id)!),
    update: async (id: number, condition: string) => { state.writes.push({ id, condition }); if (!state.refuse) state.local.find(row => row.id === id)!.condition = condition; },
    add: async (row: Omit<TitleCatalogItem, 'id'>) => { state.writes.push(row); state.local.push({ ...structuredClone(row), id: 900 }); },
    audit: async (...entry: unknown[]) => { state.audits.push(entry); }
  };
  return { state, ports, manager: createTitleConditionManager(ports) };
}
const input = (extra = {}) => ({ officialTitleId: 100, condition: 'Corrected condition', expectedLocalId: 8, expectedLocalCondition: 'Manual condition', ...extra });

test('list uses official inventory and local name/plate identity, with keyword and unknown filters', async () => {
  const f = fixture();
  f.state.local.push({ ...official(999), name: 'Local-only' });
  const result = await f.manager.list({});
  assert.equal(result.total, 2);
  assert.equal(result.items[0].id, 100);
  assert.equal(result.items[0].localId, 8);
  assert.equal(result.items[1].localId, null);
  assert.equal(result.items[0].condition, 'Manual condition');
  assert.equal((await f.manager.list({ keyword: 'manual' })).total, 1);
  assert.equal((await f.manager.list({ keyword: '１０１' })).items[0].id, 101);
  assert.equal((await f.manager.list({ missing: '1' })).total, 0);
  f.state.official[1].condition = '？？？';
  assert.equal((await f.manager.list({ missing: '1' })).items[0].id, 101);
});

test('save patches only the local condition and preserves name, plate and every song ID', async () => {
  const f = fixture();
  const result = await f.manager.save(actor, input());
  assert.equal(result.changed, true);
  assert.deepEqual(f.state.writes, [{ id: 8, condition: 'Corrected condition' }]);
  assert.deepEqual(f.state.local[0], { id: 8, name: 'Title', rarity: 42, condition: 'Corrected condition', songIds: [7, 9] });
  assert.equal(result.item.id, 100);
  assert.equal(f.state.audits.length, 1);
});

test('missing local details create a local row without reusing the official ID', async () => {
  const f = fixture([]);
  const result = await f.manager.save(actor, input({ expectedLocalId: null, expectedLocalCondition: null }));
  assert.equal(result.item.id, 100);
  assert.equal(result.item.localId, 900);
  assert.deepEqual(f.state.writes, [{ name: 'Title', rarity: 42, condition: 'Corrected condition', songIds: [7] }]);
});

test('unchanged or cleared official-only conditions do not create redundant local rows', async () => {
  const f = fixture([]);
  for (const condition of ['', 'Official condition']) {
    const result = await f.manager.save(actor, input({ condition, expectedLocalId: null, expectedLocalCondition: null }));
    assert.equal(result.changed, false);
  }
  assert.equal(f.state.writes.length, 0);
});

test('empty correction restores the official condition; repeated unchanged save writes nothing', async () => {
  const f = fixture();
  const restored = await f.manager.save(actor, input({ condition: '' }));
  assert.equal(restored.item.condition, 'Official condition');
  assert.equal(restored.item.localCondition, '');
  f.state.writes.length = 0;
  const result = await f.manager.save(actor, input({ condition: '', expectedLocalCondition: '' }));
  assert.equal(result.changed, false);
  assert.equal(f.state.writes.length, 0);
});

test('stale conditions and same-name different plate/local identities never overwrite a row', async () => {
  const f = fixture();
  for (const change of [{ expectedLocalId: 100 }, { expectedLocalCondition: 'Old data' }, { officialTitleId: 101 }]) {
    await assert.rejects(f.manager.save(actor, input(change)), { statusCode: 409 });
  }
  f.state.local.push({ ...f.state.local[0], id: 9 });
  assert.equal((await f.manager.list({})).items[0].ambiguous, true);
  await assert.rejects(f.manager.save(actor, input()), { statusCode: 409 });
  assert.equal(f.state.writes.length, 0);
});

test('validation and write read-back failures remain explicit', async () => {
  const f = fixture();
  for (const change of [{ condition: 1 }, { officialTitleId: 0 }, { condition: 'x'.repeat(1001) }, { condition: '\u0000' }]) {
    await assert.rejects(f.manager.save(actor, input(change)), { statusCode: 400 });
  }
  await assert.rejects(f.manager.save(actor, input({ officialTitleId: 999 })), { statusCode: 404 });
  f.state.refuse = true;
  await assert.rejects(f.manager.save(actor, input()), { statusCode: 502 });
  assert.equal(f.state.audits.length, 0);
});

test('concurrent saves are excluded across separate request managers and release the guard', async () => {
  const f = fixture();
  let resume!: () => void;
  const wait = new Promise<void>(resolve => { resume = resolve; });
  const first = createTitleConditionManager({ ...f.ports, official: async () => { await wait; return f.ports.official(); } });
  const pending = first.save(actor, input());
  await assert.rejects(f.manager.save(actor, input()), { statusCode: 409 });
  resume();await pending;
  const next = await f.manager.save(actor, input({ condition: 'Corrected again', expectedLocalCondition: 'Corrected condition' }));
  assert.equal(next.item.condition, 'Corrected again');
});

test('an audit outage reports that the condition was already saved', async () => {
  const f = fixture();
  const manager = createTitleConditionManager({ ...f.ports, audit: async () => { throw new Error('Unavailable'); } });
  await assert.rejects(manager.save(actor, input()), (error: any) => error.statusCode === 503 && error.statusMessage.includes('条件已保存'));
  assert.equal(f.state.local[0].condition, 'Corrected condition');
});
