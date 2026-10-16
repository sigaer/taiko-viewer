import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv from '../../../taiko_viewer/node_modules/ajv/dist/ajv.js';
import { fromLegacyScore, toLegacyScore } from '../src/legacy.mjs';
import { projectScoreFacts } from '../../../taiko_viewer/utils/growthHistory.ts';

const schema = JSON.parse(readFileSync(new URL('../schema/contract-v1.json', import.meta.url)));
const fixtures = JSON.parse(readFileSync(new URL('../fixtures/scores.json', import.meta.url)));
const legacyGrowth = JSON.parse(readFileSync(new URL('../fixtures/growth.json', import.meta.url)));
const growth = JSON.parse(readFileSync(new URL('../fixtures/growth-chart-continuity-v3.json', import.meta.url)));
const ajv = new Ajv({ strict: true, allowUnionTypes: true });
ajv.addSchema(schema);
const validate = name => ajv.compile({ $ref: `${schema.$id}#/$defs/${name}` });

test('Python/JS score Goldens satisfy schema and restore exact legacy evidence', () => {
  const scoreSchema = validate('Score');
  for (const fixture of fixtures) {
    const result = fromLegacyScore(fixture.legacy, fixture.options);
    assert.deepEqual(result, fixture.canonical, fixture.name);
    assert.equal(scoreSchema(result), true, fixture.name);
    assert.deepEqual(toLegacyScore(result), fixture.legacy);
    toLegacyScore(result).song_no = 99;
    assert.deepEqual(result, fixture.canonical);
  }
});

test('source namespaces and scopes do not merge identities or contain secrets', () => {
  assert.equal(validate('User')({ id:'1', namespace:'viewer', displayName:null }), true);
  assert.equal(validate('User')({ id:'1', namespace:'qq', displayName:null }), false);
  assert.equal(validate('Binding')({ id:'9', userId:'1', externalIdentity:{namespace:'wahlap',id:'fixture-id'}, isCurrent:true, verifiedAt:null }), true);
  assert.equal(validate('DeveloperIdentity')({ id:'client-1',ownerUserId:'1',scopes:['scores:read'] }), true);
  assert.equal(validate('DeveloperIdentity')({ id:'client-1',ownerUserId:'1',scopes:['scores:read'],token:'synthetic' }), false);
});

test('Canonical Fact preserves existing Viewer output and temporal attribution', () => {
  const predecessor = structuredClone(growth);
  for (const fact of predecessor.canonical) {
    assert.equal(fact.evidence.provenance.factPolicyRevision, 'observation-chart-continuity-v3');
    delete fact.evidence.provenance.factPolicyRevision;
  }
  assert.deepEqual(predecessor, legacyGrowth, 'Only the approved v3 provenance marker may differ from the retained original Golden');
  const actual = projectScoreFacts(growth.ownerId, growth.bindingId, growth.days);
  assert.deepEqual(actual, growth.canonical);
  for (const fact of actual) assert.equal(validate('CanonicalFact')(fact), true);
  assert.equal(validate('GrowthProjection')({ownerId:'7',bindingId:'9',timezone:'Asia/Shanghai',facts:actual,projectionVersion:'viewer-growth-v1'}), true);
});

test('observation exclusion, null time and versioned algorithm profiles remain explicit', () => {
  for (const excludedReason of schema.$defs.GrowthObservation.properties.excludedReason.enum) {
    assert.equal(validate('GrowthObservation')({token:'content-hash',orderKey:'order',revision:'rev',contentRevision:null,observedAt:'2026-10-10T04:00:00Z',source:'manual-score',eventDays:[],evidenceLevel:'L0',excludedReason}),true);
  }
  for (const algorithmVersion of schema.$defs.CalculationProfile.properties.algorithmVersion.enum) {
    assert.equal(validate('CalculationProfile')({algorithmVersion,modelRevision:'m1',catalogRevision:'c1',topN:20,availabilityRevision:'cn1'}),true);
  }
  const value = fromLegacyScore({song_no:1,level:4},{source:'unknown',capturedAt:null});
  assert.equal(value.capturedAt,null); assert.equal(value.good,null); assert.equal(value.clear,null); assert.equal(value.chart.level,null);
});

test('invalid values, timestamps, credential extensions and edited evidence fail closed', () => {
  for (const invalid of [-1,1.2,true,'NaN','0x10','١',[],{},Number.MAX_SAFE_INTEGER+1]) {
    assert.throws(()=>fromLegacyScore({song_no:1,level:4,good_cnt:invalid},{source:'wahlap',capturedAt:null}));
  }
  assert.throws(()=>fromLegacyScore({song_no:1,level:4,extension:{cookie:'synthetic'}},{source:'wahlap',capturedAt:null}));
  assert.throws(()=>fromLegacyScore({song_no:1,level:4,update_datetime:true},{source:'wahlap',capturedAt:null}));
  const value = structuredClone(fixtures[0].canonical); value.score=99;
  assert.throws(()=>toLegacyScore(value));
});
