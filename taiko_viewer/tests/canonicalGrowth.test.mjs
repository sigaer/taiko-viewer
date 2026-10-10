import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import Ajv from 'ajv';
import { canonicalGrowthProjection } from '../utils/canonicalGrowth.ts';
import { projectScoreFacts, projectGoalFact } from '../utils/growthHistory.ts';

const schema = JSON.parse(await readFile(new URL('../../packages/sakura-taiko-contract/schema/contract-v1.json', import.meta.url), 'utf8'));
const golden = JSON.parse(await readFile(new URL('../../packages/sakura-taiko-contract/fixtures/growth.json', import.meta.url), 'utf8'));
const ajv = new Ajv({ strict: true, allowUnionTypes: true });
ajv.addSchema(schema);
const validate = ajv.compile({ $ref: `${schema.$id}#/$defs/GrowthProjection` });
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('canonical projection conforms to frozen schema and preserves legacy fact bytes', () => {
  const facts = projectScoreFacts(golden.ownerId, golden.bindingId, golden.days);
  const projection = canonicalGrowthProjection(String(golden.ownerId), String(golden.bindingId), facts);
  assert.equal(validate(projection), true);
  assert.equal(hash(projection.facts), hash(golden.canonical));
  assert.equal(projection.facts, facts, 'no duplicate retained fact tree');
  assert.equal(projection.projectionVersion, 'viewer-growth-v1');
});

test('canonical projection rejects cross-owner and cross-binding evidence', () => {
  const facts = projectScoreFacts(golden.ownerId, golden.bindingId, golden.days);
  assert.throws(() => canonicalGrowthProjection('other', String(golden.bindingId), facts), /scope mismatch/);
  assert.throws(() => canonicalGrowthProjection(String(golden.ownerId), 'other', facts), /scope mismatch/);
  assert.throws(() => canonicalGrowthProjection('', '9', []), /scope mismatch/);
  assert.throws(() => canonicalGrowthProjection('7', '', []), /scope mismatch/);
  assert.equal(validate(canonicalGrowthProjection('7', '9', [])), true);
});

test('Goal remains a confirmed observation rather than an invented play day', () => {
  const fact = projectGoalFact(7, 9, {
    id: '42', status: 'completed', title: 'synthetic', songId: 1, difficultyType: 4,
    completedAt: '2026-10-11T02:00:00Z',
    completionEvidence: { observationRevision: 'synthetic-revision', evaluationVersion: 1,
      observationCapturedAt: '2026-10-10T16:00:00Z', provenance: { source: 'wahlap' },
      result: { goalType: 'fc', before: 0, after: 1, delta: 1 } }
  });
  assert.ok(fact);
  assert.equal(validate(canonicalGrowthProjection('7', '9', [fact])), true);
  assert.equal(fact.temporal.attributedDay, null);
  assert.equal(fact.temporal.occurredAt, null);
  assert.equal(fact.temporal.observedAt, '2026-10-10T16:00:00Z');
  assert.equal(fact.temporal.confirmedAt, '2026-10-11T02:00:00Z');
  assert.equal(fact.temporal.precision, 'observation');
});
