import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptPersonalEstimate, compareEvidence, evidenceId, validateEvidence, type PersonalEstimateEvidence } from '../utils/prediction-evidence/personal.ts';
import { syntheticPredictionPreview } from '../server/services/prediction-evidence/preview.ts';
import type { EvidenceScope } from '../utils/prediction-evidence/types.ts';
const scope: EvidenceScope = { canonicalChartId:'chart-a',chartRevision:'chart/1',profileId:'fixture-profile',playerProfileRevision:'profile/1',scoreRevision:'score/1',catalogRevision:'catalog/1' };
const now='2026-11-25T00:00:00Z';
const snapshot=():PersonalEstimateEvidence=>({...scope,sourceHash:'sha256-fixture',generatedAt:now,featureCutoff:now,modelVersion:'core/1',evidenceRefs:['fixture'],estimate:{song_id:1,level:4,current_score:null,reliability:80,data_sufficiency:'ok',stable:{score:850000},pb:{score:900000}}});
const identity={songId:1,difficultyType:4};

test('personal preserves exact Bot output, separates reliability and leaves quantiles unknown',()=>{
 const raw=snapshot(), before=JSON.stringify(raw), e=adaptPersonalEstimate(scope,raw,identity,now);
 assert.equal(e.point,850000);assert.equal(e.personalScores?.pb,900000);assert.equal(e.uncertainty.value,.8);
 assert.equal(e.distribution.kind,'unavailable');assert.equal(e.cohortRevision,null);assert.equal(JSON.stringify(raw),before);
 validateEvidence(e);
});
test('personal fails closed on every identity, revision and clock mismatch',()=>{
 for(const key of ['profileId','canonicalChartId','chartRevision','playerProfileRevision','scoreRevision','catalogRevision'] as const){
  const raw=snapshot();raw[key]='other';assert.equal(adaptPersonalEstimate(scope,raw,identity,now).availability,'unavailable');
 }
 for(const change of [(r:PersonalEstimateEvidence)=>r.estimate.song_id=2,(r:PersonalEstimateEvidence)=>r.estimate.level=5,
  (r:PersonalEstimateEvidence)=>r.generatedAt='2026-11-26T00:00:00Z',(r:PersonalEstimateEvidence)=>r.featureCutoff='2026-11-26T00:00:00Z',
  (r:PersonalEstimateEvidence)=>r.estimate.reliability=NaN,(r:PersonalEstimateEvidence)=>r.estimate.stable!.score=Infinity]){
  const raw=snapshot();change(raw);assert.equal(adaptPersonalEstimate(scope,raw,identity,now).point,null);
 }
});
test('missing and cold personal evidence have explicit distinct states',()=>{
 assert.equal(adaptPersonalEstimate(scope,null,identity,now).availability,'unavailable');
 const raw=snapshot();raw.estimate.stable=null;raw.estimate.pb=null;assert.equal(adaptPersonalEstimate(scope,raw,identity,now).availability,'insufficient');
});
test('evidence contract rejects type masquerade, invalid target, quantiles and quality',()=>{
 const e=adaptPersonalEstimate(scope,snapshot(),identity,now);
 for(const mutate of [(x:any)=>x.predictionType='hybrid',(x:any)=>x.cohortRevision='cohort/1',
  (x:any)=>x.target.kind='next-attempt',(x:any)=>x.uncertainty.value=1.2,
  (x:any)=>x.distribution={kind:'quantiles',q25:900000,q50:800000,q75:850000,calibrationRevision:'r'},
  (x:any)=>x.availability='unavailable',(x:any)=>x.createdAt='invalid']){
  const copy=structuredClone(e);mutate(copy);assert.throws(()=>validateEvidence(copy));
 }
});
test('canonical evidence hashes ignore object key ordering and bind all revisions',()=>{
 assert.equal(evidenceId({b:1,a:{y:2,x:3}}),evidenceId({a:{x:3,y:2},b:1}));
 const first=adaptPersonalEstimate(scope,snapshot(),identity,now);
 const nextScope={...scope,scoreRevision:'score/2'},next={...snapshot(),scoreRevision:'score/2'};
 assert.notEqual(first.predictionId,adaptPersonalEstimate(nextScope,next,identity,now).predictionId);
});
test('candidate comparison integrates M0 and aggregate artifact with honest unavailable hybrid',()=>{
 const r=syntheticPredictionPreview('available');assert.equal(r.personal.point,896000);assert.equal(r.cohort.availability,'available');
 assert.equal(r.cohortSample?.distinctPlayerCount,24);assert.equal(r.cohortSample?.effectiveSampleSize,24);
 assert.equal(r.hybrid.point,null);assert.equal(r.hybrid.availability,'unavailable');assert.equal(r.decision,'retain-personal');
 for(const value of [r.personal,r.cohort,r.hybrid])validateEvidence(value);
});
test('candidate missing, sparse and incompatible revisions never fabricate cohort evidence',()=>{
 assert.equal(syntheticPredictionPreview('missing').cohort.availability,'unavailable');
 assert.equal(syntheticPredictionPreview('revision').cohort.availability,'unavailable');
 const r=syntheticPredictionPreview('sparse');assert.equal(r.cohort.availability,'insufficient');assert.equal(r.cohortSample?.effectiveSampleSize,2.5);
 assert.equal(r.cohort.point,null);assert.equal(r.hybrid.point,null);
});
test('read-only comparison cannot overwrite historical Goal Baseline and rejects scope substitution',()=>{
 const baseline=Object.freeze({scoreRevision:'score-old',cohortRevision:null,highScore:700000});
 const before=JSON.stringify(baseline),r=syntheticPredictionPreview('available');
 Object.freeze(r.scope);Object.freeze(r.personal);Object.freeze(r.cohort);
 compareEvidence(r.scope,r.personal,r.cohort,r.cohortSample);assert.equal(JSON.stringify(baseline),before);
 assert.throws(()=>compareEvidence({...r.scope,scoreRevision:'new'},r.personal,r.cohort,r.cohortSample));
 assert.throws(()=>compareEvidence(r.scope,r.cohort,r.personal,r.cohortSample));
});

test('residual evidence uses signed score offsets and chart features cannot claim scores',()=>{
 const residual={...adaptPersonalEstimate(scope,snapshot(),identity,now),predictionType:'cohort-residual' as const,modelId:'conditional-residual',cohortRevision:'cohort/1',point:-1000,distribution:{kind:'quantiles' as const,q25:-2000,q50:-1000,q75:0,calibrationRevision:'residual-oof/1'}};
 delete residual.personalScores;validateEvidence(residual);
 const feature={...residual,predictionType:'chart-feature' as const,point:null,distribution:{kind:'unavailable' as const,reason:'feature-only'}};validateEvidence(feature);
 assert.throws(()=>validateEvidence({...feature,point:10}));
});

test('malformed personal wire fields become unavailable instead of partial predictions',()=>{
 for(const mutate of [(r:any)=>r.estimate=null,(r:any)=>r.estimate.stable={},(r:any)=>r.estimate.pb=undefined,(r:any)=>r.evidenceRefs=null,(r:any)=>r.modelVersion=4,(r:any)=>r.estimate.data_sufficiency=null]){
  const raw=snapshot();mutate(raw);assert.equal(adaptPersonalEstimate(scope,raw,identity,now).availability,'unavailable');
 }
});
