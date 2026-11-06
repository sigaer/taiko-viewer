import test from 'node:test';
import assert from 'node:assert/strict';
import { hasNewSyncObservation } from '../server/services/goals/sync-observation.ts';
const provenance: import('../utils/goalEvaluation.ts').GoalProvenance = { source: 'wahlap', account: '123', topology: '[]', marker: '20261106_100000_000000', observedAt: '2026-11-06T02:00:00Z', contentHash: 'a'.repeat(64) };
const before = { revision: 'r1', provenance };
const after = { revision: 'r2', provenance: { ...provenance, marker: '20261106_110000_000000', observedAt: '2026-11-06T03:00:00Z', contentHash: 'b'.repeat(64) } };
test('sync trigger requires a new verified observation, independent of downstream delivery status', () => {
  assert.equal(hasNewSyncObservation(before, after), true);
  assert.equal(hasNewSyncObservation(null, after), false);
  assert.equal(hasNewSyncObservation(before, { ...after, provenance: null }), false);
  assert.equal(hasNewSyncObservation(before, { ...after, revision: 'r1' }), false);
  for (const patch of [{ source: 'hiroba' }, { account: '456' }, { topology: '[1]' }, { marker: provenance.marker }, { observedAt: provenance.observedAt }, { contentHash: provenance.contentHash }]) {
    assert.equal(hasNewSyncObservation(before, { ...after, provenance: { ...after.provenance, ...patch } as typeof provenance }), false);
  }
});
