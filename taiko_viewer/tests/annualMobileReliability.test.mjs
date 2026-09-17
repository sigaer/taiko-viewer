import test from 'node:test';import assert from 'node:assert/strict';import { register } from 'node:module';
register('./support/nuxtAliasHooks.mjs',import.meta.url);
const {selectAnnualHighlights}=await import('../utils/annualMilestones.ts');
const {resolveAnnualCover,resolvePosterCover,ANNUAL_DEFAULT_COVER}=await import('../utils/annualCover.ts');
test('highlights retain strongest real event per chart, preserving other difficulties and same-name songs',()=>{
 const make=(songNo,level,type,day)=>({song:{songNo,level,name:'Crystal Hail'},level,type,occurredAt:day,playCount:day});
 const clear=make(1,4,'clear',1),fc=make(1,4,'full_combo',2),df=make(1,4,'dondaful',3),ura=make(1,5,'clear',4),other=make(2,4,'clear',5);
 const input=[clear,fc,df,ura,other],before=structuredClone(input);const result=selectAnnualHighlights(input);
 assert.equal(result.length,3);assert.ok(result.includes(df));assert.ok(result.includes(ura));assert.ok(result.includes(other));assert.deepEqual(input,before);assert.equal(result.find(r=>r.type==='dondaful'),df);
 assert.deepEqual(selectAnnualHighlights([clear,fc]),[fc]);
});
test('all annual cover consumers share existing fallback',()=>{
 assert.equal(resolvePosterCover(null),ANNUAL_DEFAULT_COVER);assert.equal(resolveAnnualCover({coverUrl:''}),ANNUAL_DEFAULT_COVER);assert.equal(resolvePosterCover({coverUrl:'/cover.png'}),'/cover.png');
});
