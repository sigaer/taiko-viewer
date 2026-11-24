import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixture } from './fixtures.ts';
import { prepareAuthority, resolveCanonicalChartIdentity } from '../../utils/multi-objective/identity.ts';
import { validateIntentTargetCombination, getGoalTypeCapability, evaluatorCapability } from '../../utils/multi-objective/registries.ts';
import type { CatalogAuthoritySnapshot, IdentityRequest, Target } from '../../utils/multi-objective/contracts.ts';
import { hash } from '../../utils/multi-objective/common.ts';
const request = (catalog: CatalogAuthoritySnapshot): IdentityRequest => ({ namespace: 'wahlap', sourceId: '1', difficulty: 4, catalogRevision: catalog.catalogRevision, region: 'CN', businessPolicy: 'cn_current_playable', modelProfile: null });
test('R01 actual Authority slice uses row canonical IDs, never legacy dictionary keys', () => {
  const { snapshot } = JSON.parse(readFileSync(new URL('./authority-slice.json', import.meta.url), 'utf8')) as { snapshot: CatalogAuthoritySnapshot };
  for (const [key, row] of Object.entries(snapshot.charts)) {
    const a = snapshot.sourceAliases.find(a => a.songId === row.songId && a.namespace === 'wahlap')!;
    const r = resolveCanonicalChartIdentity(snapshot, { ...request(snapshot), sourceId: a.key, difficulty: row.difficulty });
    assert.equal(r.status, 'RESOLVED');
    if (r.status === 'RESOLVED') { assert.equal(r.value.chartId, row.chartId); assert.notEqual(r.value.chartId, key); assert.equal(r.value.canonicalSongId, row.songId); }
  }
});
test('R01/R02 explicit aliases unify; equal numeric IDs in other namespaces do not', () => {
  const { catalog } = fixture(2).context;
  catalog.sourceAliases.push({ namespace: 'ourtaiko', key: '999', songId: 'song:persistent-1', evidence: 'authority-map' }, { namespace: 'ourtaiko', key: '1', songId: 'song:persistent-2', evidence: 'authority-map' });
  const index = prepareAuthority(catalog), a = index.resolve(request(catalog));
  const b = index.resolve({ ...request(catalog), namespace: 'ourtaiko', sourceId: '999' });
  const other = index.resolve({ ...request(catalog), namespace: 'ourtaiko' });
  assert.equal(a.status, 'RESOLVED'); assert.equal(b.status, 'RESOLVED'); assert.equal(other.status, 'RESOLVED');
  if (a.status === 'RESOLVED' && b.status === 'RESOLVED' && other.status === 'RESOLVED') {
    assert.equal(a.value.chartId, b.value.chartId); assert.notEqual(a.value.identityMappingRef, b.value.identityMappingRef); assert.notEqual(a.value.chartId, other.value.chartId);
  }
});
for (const [name, mutate, status] of [
  ['missing alias', (c: CatalogAuthoritySnapshot) => { c.sourceAliases = []; }, 'UNRESOLVED'],
  ['ambiguous alias', (c: CatalogAuthoritySnapshot) => { c.sourceAliases.push({ ...c.sourceAliases[0]!, songId: 'different-song' }); }, 'AMBIGUOUS'],
  ['nonexistent slot', (c: CatalogAuthoritySnapshot) => { c.charts['1:4']!.exists = false; }, 'UNRESOLVED'],
  ['denied business policy', (c: CatalogAuthoritySnapshot) => { c.charts['1:4']!.policies.cn_current_playable = { eligible: false }; }, 'UNRESOLVED'],
  ['ambiguous rows', (c: CatalogAuthoritySnapshot) => { c.charts.extra = { ...c.charts['1:4']!, chartId: 'conflicting-chart' }; }, 'AMBIGUOUS'],
] as const) test(`R03 identity rejects ${name}`, () => { const c = fixture().context.catalog; mutate(c); assert.equal(resolveCanonicalChartIdentity(c, request(c)).status, status); });
test('R03 identity namespace, revision, region and model policy fail closed', () => {
  const c = fixture().context.catalog;
  for (const override of [{ namespace: 'title' }, { sourceId: 'song:persistent-1:course:4' }, { catalogRevision: hash('other') }, { region: 'JP' as const }, { businessPolicy: 'recommendation_eligible' as const, modelProfile: 'unregistered' }]) assert.equal(resolveCanonicalChartIdentity(c, { ...request(c), ...override }).status, 'UNRESOLVED');
  assert.equal(resolveCanonicalChartIdentity(c, { ...request(c), businessPolicy: 'recommendation_eligible', modelProfile: 'ordinary' }).status, 'RESOLVED');
});
test('I01/I02 registries validate the joint union, not three independent enums', () => {
  const base = { definitionVersion: 'target/1', horizon: 'near_term' as const };
  const legal: [string, string, Target][] = [
    ['score_improvement', 'score_pb', { ...base, kind: 'score', threshold: 1, comparison: 'gte', baselineRef: null }],
    ['score_improvement', 'score_target', { ...base, kind: 'score', threshold: 2, comparison: 'gte', baselineRef: null }],
    ['score_improvement', 'rank_upgrade', { ...base, kind: 'rank', threshold: 8, comparison: 'gte', requirementRef: null }],
    ...(['clear', 'full_combo', 'dondaful_combo'] as const).map(crown => ['crown_completion', crown, { ...base, kind: 'crown' as const, crown }] as [string, string, Target]),
    ['crown_completion', 'ng_reduction', { ...base, kind: 'ng_reduction', threshold: 1, total: 100, comparison: 'lte', baselineRef: 'b' }],
    ['dimension_training', 'dimension_practice', { ...base, kind: 'dimension_practice', dimension: { namespace: 'viewer-six-dimension', key: 'speed', schemaVersion: 'viewer-six-dimension/1' }, practiceDefinitionRef: 'focus', loadEvidenceRef: 'load' }],
    ['discovery', 'interest_discovery', { ...base, kind: 'explore_chart', discoveryMode: 'interest', coverageRef: 'c', relevanceRef: 'r' }],
    ['discovery', 'level_matched_discovery', { ...base, kind: 'explore_chart', discoveryMode: 'level_matched', coverageRef: 'c', relevanceRef: 'r', loadEvidenceRef: 'l' }],
    ['challenge', 'dan_task', { ...base, kind: 'task_requirement', taskId: 't', taskVersion: '1', requirementId: 'r', requirementRef: 'ref' }],
    ['challenge', 'event_task', { ...base, horizon: 'long_term', kind: 'task_completion', taskId: 't', taskVersion: '1', requirementRefs: ['ref'] }],
  ];
  for (const [intent, subtype, target] of legal) {
    assert.deepEqual(validateIntentTargetCombination(intent, subtype, target), []);
    assert.ok(validateIntentTargetCombination('personal_goal', subtype, target).length);
    assert.ok(validateIntentTargetCombination(intent, 'unregistered', target).length);
    for (const [otherIntent, otherSubtype, otherTarget] of legal) if (otherIntent !== intent) assert.ok(validateIntentTargetCombination(intent, otherSubtype, otherTarget).length);
  }
  assert.ok(validateIntentTargetCombination('crown_completion', 'full_combo', legal[0]![2]).length);
  assert.ok(validateIntentTargetCombination('crown_completion', 'full_combo', { ...base, kind: 'crown', crown: 'dondaful_combo' }).length);
  assert.ok(validateIntentTargetCombination('challenge', 'event_task', { ...legal.at(-1)![2], horizon: 'near_term' }).length);
});
test('T11 six legacy completion types retained; registry never authorizes creation', () => {
  for (const g of ['score-pb', 'ng-reduced', 'clear', 'fc', 'df', 'rank-upgrade']) { const c = getGoalTypeCapability(g); assert.equal(c.completionSupported, true); assert.equal(c.canCreateGoal, false); }
  for (const g of ['played', 'dimension-training', '__proto__', 'constructor']) assert.equal(getGoalTypeCapability(g).completionSupported, false);
  assert.equal(evaluatorCapability('played'), null);
});
