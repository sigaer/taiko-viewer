import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { annualBuildInputRevision, canReuseAnnualFailure, canReuseAnnualSummary } from '../server/services/account/annual-summary/build-recovery.ts';

test('failure revision: legacy, same input, updated userdata, new history and runtime change', async () => {
  const root = await mkdtemp(join(tmpdir(), 'annual-build-recovery-'));
  try {
    const revision = () => annualBuildInputRevision(root, '123', 'annual-observation-v4.5.0');
    const missing = await revision();
    await writeFile(join(root, '123data.json'), '{}');
    const initial = await revision();
    assert.notEqual(initial, missing);
    const failed = { status: 'failed', parameters_json: JSON.stringify({ inputRevision: initial }) };
    assert.equal(canReuseAnnualFailure(failed, await revision()), true);
    assert.equal(canReuseAnnualFailure({ status: 'failed', parameters_json: '{}' }, initial), false);
    assert.equal(canReuseAnnualFailure({ status: 'failed', parameters_json: '{invalid' }, initial), false);
    assert.equal(canReuseAnnualFailure({ ...failed, status: 'running' }, initial), false);
    await utimes(join(root, '123data.json'), new Date(), new Date(Date.now() + 1000));
    const updated = await revision();
    assert.equal(canReuseAnnualFailure(failed, updated), false);
    await mkdir(join(root, '123'));
    await writeFile(join(root, '123', 'data_20260910_000000_000000.json'), '{}');
    assert.notEqual(await revision(), updated);
    assert.notEqual(await annualBuildInputRevision(root, '123', 'future-runtime-test'), await revision());
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('completed summary is reusable only for the current annual algorithm', () => {
  assert.equal(canReuseAnnualSummary({ provenance: { algorithmVersion: 'v2' } }, 'v2'), true);
  assert.equal(canReuseAnnualSummary({ provenance: { algorithmVersion: 'v1' } }, 'v2'), false);
  assert.equal(canReuseAnnualSummary({ provenance: null }, 'v2'), false);
  assert.equal(canReuseAnnualSummary(null, 'v2'), false);
  assert.equal(canReuseAnnualSummary({ provenance: { algorithmVersion: 'v2' } }, ''), false);
});
