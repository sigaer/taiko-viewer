import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, interest } from './fixtures.ts';
import { validateCandidate } from '../../utils/multi-objective/candidate.ts';
test('Phase 1–3 integration: score and Interest Discovery traverse strict ingress', () => {
  const f = fixture();
  assert.deepEqual(validateCandidate(f.candidates[0], f.context).issues, []);
  interest(f);
  assert.deepEqual(validateCandidate(f.candidates[0], f.context).issues, []);
});
