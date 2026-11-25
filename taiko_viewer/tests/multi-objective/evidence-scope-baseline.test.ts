/** B4-1 review regressions: synthetic evidence only; original 109 tests unchanged. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, record, seal, type Fixture } from './fixtures.ts';
import { crown } from './type-fixtures.ts';
import { goalFixture } from './goal-fixtures.ts';
import { validateCandidate } from '../../utils/multi-objective/candidate.ts';
import { validateActionabilityEvaluation } from '../../utils/multi-objective/actionability.ts';
import { prepareEvidence } from '../../utils/multi-objective/evidence.ts';
import { hash } from '../../utils/multi-objective/common.ts';
import type { EvidenceRef } from '../../utils/multi-objective/contracts.ts';

const result = (f: Fixture) => validateCandidate(f.candidates[0], f.context);
const codes = (f: Fixture) => result(f).issues.map(i => i.code);
const payload = (f: Fixture, id: string) => f.evidence.find(r => r.ref.id === id)!.payload;
const scopeFields = ['mode', 'platform'] as const;
const subtypes = ['clear', 'full_combo', 'dondaful_combo', 'ng_reduction'] as const;
function crownAt(subtype: typeof subtypes[number], readiness: 'ready_now' | 'reasonable_stretch') {
  const f = crown(subtype), c = f.candidates[0]!;
  if (readiness === 'reasonable_stretch') {
    c.readiness = readiness; c.actionability.confidence.level = 'medium'; c.actionability.reasonCodes = ['CROWN_BOUNDED_STRETCH'];
  }
  return seal(f);
}
function acquired(f: Fixture) {
  const p = payload(f, 'snapshot-1'), t = f.candidates[0]!.target;
  if (t.kind === 'crown') (p.crowns as Record<string, unknown>)[t.crown] = true;
  else if (t.kind === 'ng_reduction') p.ng = t.threshold;
}
for (const subtype of subtypes) {
  for (const readiness of ['ready_now', 'reasonable_stretch'] as const) {
    test(`Scope: ${subtype} ${readiness} accepts one consistent evidence scope`, () => {
      assert.deepEqual(result(crownAt(subtype, readiness)).issues, []);
    });
    for (const field of scopeFields) {
      for (const value of ['other-scope', null]) test(`Scope: ${subtype} ${readiness} rejects current ${field}=${value}`, () => {
        const f = crownAt(subtype, readiness); payload(f, 'snapshot-1')[field] = value; seal(f);
        assert.ok(codes(f).includes('CROWN_CURRENT_SCOPE_UNVERIFIED'));
      });
      test(`Scope: ${subtype} ${readiness} rejects omitted current ${field}`, () => {
        const f = crownAt(subtype, readiness); delete payload(f, 'snapshot-1')[field]; seal(f);
        assert.equal(result(f).ok, false);
      });
      test(`Scope: ${subtype} ${readiness} rejects attempt ${field} outside its window`, () => {
        const f = crownAt(subtype, readiness); payload(f, 'attempt-2')[field] = 'other-scope'; seal(f);
        assert.ok(codes(f).includes('CROWN_ATTEMPT_SCOPE_INVALID'));
      });
      test(`Scope: ${subtype} ${readiness} rejects missing window ${field}`, () => {
        const f = crownAt(subtype, readiness); delete payload(f, 'attempt-window')[field]; seal(f);
        assert.equal(result(f).ok, false);
      });
    }
    test(`Scope: ${subtype} ${readiness} rejects missing current snapshot`, () => {
      const f = crownAt(subtype, readiness); f.candidates[0]!.playerEvidence.snapshotRefs = []; seal(f);
      assert.ok(codes(f).includes('CROWN_CURRENT_SCOPE_UNVERIFIED'));
    });
  }
  test(`Scope: ${subtype} same-scope acquired target is detected`, () => {
    const f = crown(subtype); acquired(f); seal(f); assert.ok(codes(f).includes('TARGET_ALREADY_MET'));
  });
  for (const field of scopeFields) for (const id of ['snapshot-1', 'attempt-2', 'attempt-window']) {
    test(`Scope: ${subtype} TARGET_ALREADY_MET cannot borrow ${id} across ${field}`, () => {
      const f = crown(subtype); acquired(f); payload(f, id)[field] = 'other-scope'; seal(f);
      assert.equal(result(f).ok, false); assert.ok(!codes(f).includes('TARGET_ALREADY_MET'));
    });
  }
  test(`Scope: ${subtype} TARGET_ALREADY_MET remains unknown with missing current mode`, () => {
    const f = crown(subtype); acquired(f); payload(f, 'snapshot-1').mode = null; seal(f);
    assert.ok(!codes(f).includes('TARGET_ALREADY_MET')); assert.equal(result(f).ok, false);
  });
  test(`Scope: ${subtype} mixed snapshots cannot merge an out-of-scope acquired target`, () => {
    const f = crown(subtype), extra = structuredClone(f.evidence.find(r => r.ref.id === 'snapshot-1')!);
    acquired(f); payload(f, 'snapshot-1').platform = 'other-scope';
    extra.ref.id = 'same-scope-unmet'; f.evidence.push(extra); f.candidates[0]!.playerEvidence.snapshotRefs.push(extra.ref.id); seal(f);
    assert.ok(codes(f).includes('CURRENT_SNAPSHOT_CONFLICT')); assert.ok(!codes(f).includes('TARGET_ALREADY_MET'));
  });
}
test('Scope: NG already-met detection requires comparable baseline mode/platform', () => {
  for (const field of scopeFields) {
    const f = crown('ng_reduction'); acquired(f); payload(f, 'baseline-ng')[field] = 'other-scope'; seal(f);
    assert.ok(codes(f).includes('CROWN_BASELINE_MODE_UNVERIFIED')); assert.ok(!codes(f).includes('TARGET_ALREADY_MET'));
  }
});
test('Scope: attempt outside declared window cannot establish TARGET_ALREADY_MET', () => {
  const f = crown(); acquired(f); f.evidence.find(r => r.ref.id === 'attempt-1')!.ref.occurredAt = '2026-10-24T00:00:00.000Z'; seal(f);
  assert.ok(codes(f).includes('CROWN_ATTEMPT_SCOPE_INVALID')); assert.ok(!codes(f).includes('TARGET_ALREADY_MET'));
});

function pb(explicit = true, highScore = 900000): Fixture {
  const f = fixture(), c = f.candidates[0]!;
  c.subtype = 'score_pb'; c.target = { kind: 'score', threshold: highScore + 1, comparison: 'gte', baselineRef: explicit ? 'baseline-score' : null, definitionVersion: 'target/1', horizon: 'near_term' };
  if (explicit) f.evidence.push(record('baseline-score', 'goal_baseline', 'goal-portfolio', c.chartId, c.catalogRevision,
    { type: 'goal_baseline', goalType: 'score-pb', highScore, total: null, ng: null, mode: null, platform: null }));
  return seal(f);
}
test('Baseline: valid score-pb Goal Baseline and existing portfolio fixture pass', () => {
  assert.deepEqual(result(pb()).issues, []); assert.deepEqual(result(goalFixture()).issues, []);
});
test('Baseline: null baselineRef uses trusted current score and retains +1', () => {
  const f = pb(false); assert.deepEqual(result(f).issues, []);
  assert.equal(f.candidates[0]!.target.kind === 'score' && f.candidates[0]!.target.baselineRef, null);
});
test('Baseline: explicit Goal Baseline differs from current score and remains independently bound', () => {
  const f = pb(true, 920000); // Capture this different baseline at creation, never rewrite a frozen one.
  if (f.candidates[0]!.target.kind === 'score') f.candidates[0]!.target.threshold = 920001;
  seal(f); assert.deepEqual(result(f).issues, []);
});
test('Baseline: wrong Goal Type cannot fall back to current estimate', () => {
  const f = pb(); payload(f, 'baseline-score').goalType = 'fc'; seal(f);
  assert.ok(codes(f).includes('SCORE_BASELINE_GOAL_TYPE_MISMATCH'));
});
for (const id of ['estimate-1', 'snapshot-1', 'catalog-1']) test(`Baseline: explicit ${id} is not a supported baseline evidence type`, () => {
  const f = pb(); if (f.candidates[0]!.target.kind === 'score') f.candidates[0]!.target.baselineRef = id; seal(f);
  assert.ok(codes(f).includes('SCORE_BASELINE_TYPE_UNSUPPORTED'));
});
for (const [field, value] of [['profileId', 'other-profile'], ['chartId', 'other-chart'], ['sourceRevision', 'scores/older'], ['catalogRevision', hash('other-catalog')]] as const) {
  test(`Baseline: explicit ${field} must match identity or its frozen source binding`, () => {
    const f = pb(); f.evidence.find(r => r.ref.id === 'baseline-score')!.ref[field] = value; seal(f);
    assert.ok(codes(f).includes('SCORE_BASELINE_SCOPE_MISMATCH'));
  });
}
for (const value of [null, -1, 1.5, Number.MAX_SAFE_INTEGER]) test(`Baseline: invalid highScore ${value} never falls back`, () => {
  const f = pb(); payload(f, 'baseline-score').highScore = value; seal(f); assert.equal(result(f).ok, false);
});
test('Baseline: omitted highScore is rejected', () => {
  const f = pb(); delete payload(f, 'baseline-score').highScore; seal(f); assert.equal(result(f).ok, false);
});
for (const ref of ['missing-baseline', '']) test(`Baseline: unresolved or malformed nonnull ref '${ref}' never falls back`, () => {
  const f = pb(); if (f.candidates[0]!.target.kind === 'score') f.candidates[0]!.target.baselineRef = ref; seal(f);
  assert.equal(result(f).ok, false);
  const issues = validateActionabilityEvaluation(f.candidates[0]!, f.context, prepareEvidence(f.evidence).index);
  assert.ok(issues.some(i => i.code === 'SCORE_BASELINE_EVIDENCE_MISSING'));
});
test('Baseline: threshold must remain exactly baseline + 1', () => {
  const f = pb(); if (f.candidates[0]!.target.kind === 'score') f.candidates[0]!.target.threshold++;
  seal(f); assert.ok(codes(f).includes('SCORE_TARGET_BINDING_MISMATCH'));
});
test('Baseline: null ref cannot use unknown current score', () => {
  const f = pb(false); payload(f, 'estimate-1').currentBestScore = null; payload(f, 'snapshot-1').currentBestScore = null; seal(f);
  assert.ok(codes(f).includes('SCORE_BASELINE_VALUE_INVALID'));
});

test('Hash: public EvidenceRef rejects null and resolver rejects it at runtime', () => {
  const f = fixture(), r = f.evidence[0]!;
  // @ts-expect-error Resolved B4 EvidenceRef requires payload SHA-256, never null.
  const invalid: EvidenceRef = { ...r.ref, contentHash: null };
  assert.ok(prepareEvidence([{ ...r, ref: invalid }]).issues.length > 0);
});
for (const value of [undefined, '', 'not-a-sha256', 'A'.repeat(64)]) test(`Hash: missing/malformed contentHash ${String(value)} is rejected`, () => {
  const r = structuredClone(fixture().evidence[0]!);
  if (value === undefined) delete (r.ref as unknown as Record<string, unknown>).contentHash;
  else r.ref.contentHash = value;
  const parsed = prepareEvidence([r]); assert.ok(parsed.issues.length > 0); assert.equal(parsed.index.size, 0);
});
test('Hash: payload mutation under original valid SHA-256 remains rejected', () => {
  const f = fixture(); payload(f, 'snapshot-1').currentBestScore = 900001;
  assert.ok(codes(f).includes('EVIDENCE_CONTENT_HASH_MISMATCH'));
});
test('Hash: matching canonical payload SHA-256 remains accepted', () => {
  const f = fixture(); assert.deepEqual(prepareEvidence(f.evidence).issues, []); assert.deepEqual(result(f).issues, []);
});
