import test from 'node:test';
import assert from 'node:assert/strict';
import { composeHomeGrowthFeedback } from '../utils/homeGrowthFeedback.ts';
import type { GrowthDailyProgress, RecentGrowthResponse } from '../types/player-growth';

const daily = (): GrowthDailyProgress => ({ calendarDay: '2026-10-20', dataMode: 'SNAPSHOT_LIMITED', attendance: 'played', uniqueCharts: 7,
  events: [{ songId: 1, level: 4, title: 'Fixture', occurredAt: '2026-10-20T05:00:00Z', evidence: 'history', evidenceRevision: 'r1', importance: 65,
    facts: [{ type: 'score-pb', before: 900, after: 950, delta: 50 }] }] });
const recent = (): RecentGrowthResponse => ({ profileId: '1', state: 'new', observedAt: '2026-10-20T10:00:00Z', totalFacts: 1,
  facts: [{ id: 'f1', factKey: 'f1', ownerId: '1', bindingId: '1', type: 'score-pb', title: 'Fixture', songId: 1, difficultyType: 4, before: 900, after: 950, delta: 50,
    evidence: { source: 'score-history', sourceRevision: 'r1', evidenceVersion: 1 },
    temporal: { attributedDay: '2026-10-20', occurredAt: '2026-10-20T05:00:00Z', observedAt: '2026-10-20T10:00:00Z', precision: 'instant' } }],
  boundary: { acknowledgedToken: null, currentToken: null, acknowledgeRequired: false, recovered: false } });
test('confirmed same-day change appears once in Daily; raw DTOs and total chart count remain intact', () => {
  const d = daily(), r = recent(), original = JSON.stringify([d, r]);
  const shown = composeHomeGrowthFeedback(null, d, r, null, '1');
  assert.equal(shown.recentFacts.length, 0);assert.equal(shown.recentSuppressedCount, 1);
  assert.equal(shown.dailyProgress.events.length, 1);assert.equal(shown.dailyProgress.uniqueCharts, 7);
  assert.equal(JSON.stringify([d, r]), original);
});
for (const mode of ['older', 'unknown-day', 'observation-only', 'other-chart', 'other-difficulty', 'other-binding', 'different-change'] as const) {
  test(`${mode} is not reassigned or silently discarded based on observation time`, () => {
    const d = daily(), r = recent(), f = r.facts[0];
    if (mode === 'older') f.temporal.attributedDay = '2026-10-19';
    if (mode === 'unknown-day') { f.temporal.attributedDay = null;f.temporal.precision = 'unknown'; }
    if (mode === 'observation-only') f.temporal.precision = 'observation';
    if (mode === 'other-chart') f.songId = 2;
    if (mode === 'other-difficulty') f.difficultyType = 5;
    if (mode === 'other-binding') f.bindingId = '2';
    if (mode === 'different-change') { f.before = 800;f.evidence.sourceRevision = 'r0'; }
    const shown = composeHomeGrowthFeedback(null, d, r, null, '1');
    assert.equal(shown.recentFacts.length, 1);assert.equal(shown.dailyProgress.events.length, 1);
  });
}
test('unavailable recent data does not suppress today facts', () => {
  const shown = composeHomeGrowthFeedback(null, daily());
  assert.equal(shown.dailyProgress.events[0].facts[0].after, 950);
});
test('known no-play and unknown preserve their different counts and attendance', () => {
  for (const attendance of ['not_played', 'unknown'] as const) {
    const d = daily();d.attendance = attendance;d.events = [];d.uniqueCharts = attendance === 'unknown' ? null : 0;
    const shown = composeHomeGrowthFeedback(null, d, recent(), null, '1');
    assert.equal(shown.dailyProgress.attendance, attendance);assert.equal(shown.dailyProgress.uniqueCharts, d.uniqueCharts);
    assert.equal(shown.recentFacts.length, 1);
  }
});
for (const mode of ['revision', 'missing-daily-revision', 'missing-recent-revision', 'before', 'after', 'delta', 'type', 'source', 'version', 'snapshot-kind', 'occurrence', 'profile', 'missing-profile'] as const) {
  test(`${mode}: a distinct or unconfirmed identity remains in Recent`, () => {
    const d = daily(), r = recent(), f = r.facts[0];
    let profile: string | undefined = '1';
    if (mode === 'revision') f.evidence.sourceRevision = 'another-observation';
    if (mode === 'missing-daily-revision') delete d.events[0].evidenceRevision;
    if (mode === 'missing-recent-revision') delete f.evidence.sourceRevision;
    if (mode === 'before') f.before = 850;
    if (mode === 'after') f.after = 960;
    if (mode === 'delta') f.delta = 60;
    if (mode === 'type') f.type = 'combo-improved';
    if (mode === 'source') f.evidence.source = 'goal';
    if (mode === 'version') f.evidence.evidenceVersion = 2;
    if (mode === 'snapshot-kind') f.evidence.provenance = { snapshotKind: 'full-snapshot' };
    if (mode === 'occurrence') d.events[0].factOccurredAt = { 'score-pb': '2026-10-20T06:00:00Z' };
    if (mode === 'profile') r.profileId = '2';
    if (mode === 'missing-profile') profile = undefined;
    const before = JSON.stringify([d, r]);
    const shown = composeHomeGrowthFeedback(null, d, r, null, profile);
    assert.equal(shown.recentFacts.length, 1);
    assert.equal(shown.dailyProgress.events[0].facts[0].after, 950);
    assert.equal(shown.dailyProgress.uniqueCharts, 7);
    assert.equal(JSON.stringify([d, r]), before);
  });
}
for (const state of ['loading', 'failed'] as const) {
  test(`Daily ${state} cannot suppress the header's only valid record`, () => {
    const d = daily(), r = recent();
    const shown = composeHomeGrowthFeedback(null, d, r, null, '1', { daily: false });
    assert.equal(shown.recentFacts[0].factKey, 'f1');
    assert.equal(shown.recentSuppressedCount, 0);
    assert.equal(shown.dailyProgress.uniqueCharts, 7);
  });
  test(`Recent ${state} cannot suppress the only valid Daily record`, () => {
    const shown = composeHomeGrowthFeedback(null, daily(), recent(), null, '1', { recent: false });
    assert.equal(shown.dailyProgress.events[0].facts[0].after, 950);
    assert.equal(shown.dailyProgress.uniqueCharts, 7);
  });
}
test('an unavailable Recent DTO cannot claim Daily evidence', () => {
  const r = recent();r.state = 'unavailable';
  const shown = composeHomeGrowthFeedback(null, daily(), r, null, '1');
  assert.equal(shown.dailyProgress.events.length, 1);
  assert.equal(shown.recentFacts.length, 0);
});
test('distinct difficulties, changes and observations survive alongside one confirmed duplicate', () => {
  const d = daily(), r = recent();
  for (const [key, patch] of [
    ['difficulty', { difficultyType: 5 }],
    ['change', { before: 850 }],
    ['evidence', { evidence: { ...r.facts[0].evidence, sourceRevision: 'r2' } }]
  ] as const) r.facts.push({ ...r.facts[0], ...patch, id: key, factKey: key });
  r.totalFacts = r.facts.length;
  const shown = composeHomeGrowthFeedback(null, d, r, null, '1');
  assert.deepEqual(shown.recentFacts.map(f => f.factKey), ['difficulty', 'change', 'evidence']);
  assert.equal(shown.recentSuppressedCount, 1);
  assert.equal(shown.dailyProgress.uniqueCharts, 7);
});
