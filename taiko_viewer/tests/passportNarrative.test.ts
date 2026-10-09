import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { passportMetricRuns, composePassportMilestoneNarrative } from '../utils/passportNarrative.ts';
import { buildMeasurementSegments, sampleDailyGrowthMeasurements } from '../server/services/growth-passport/composer.ts';
import { curateSkillPassportMilestones } from '../server/services/growth-passport/milestones.ts';
import { recoveryFact as fact, recoveryMeasurement as measurement, recoveryFlood } from './fixtures/passportRecovery.ts';
const segments = (rows: ReturnType<typeof measurement>[]) => buildMeasurementSegments(sampleDailyGrowthMeasurements(rows));
const rows = () => ['20','28','29'].map((day,i)=>measurement(String(i),`2026-09-${day}`)).concat(measurement('4','2026-10-07'));
const period={from:'2026-07-11',to:'2026-10-08'};
const compose=(facts: ReturnType<typeof fact>[])=>curateSkillPassportMilestones(facts,period).milestones.map(n=>composePassportMilestoneNarrative(n,(_type,value)=>String(value)));
test('frozen daily values connect across four revisions and A B A without recalculation',()=>{
 assert.equal(passportMetricRuns(segments(rows()),'rating')[0]!.points.length,4);
 assert.deepEqual(passportMetricRuns(segments(rows().map((p,i)=>({...p,modelRevision:String(i)}))),'rating').map(r=>r.points.length),[4]);
 assert.deepEqual(passportMetricRuns(segments(rows().slice(0,3).map((p,i)=>({...p,modelRevision:i===1?'b':'a'}))),'speed').map(r=>r.points.length),[3]);
});
test('missing dimension breaks a metric, version or availability metadata never erases a saved value',()=>{
 const data=rows();data[1]!.dimensions.speed=null;
 assert.deepEqual(passportMetricRuns(segments(data),'speed').map(r=>r.points.length),[1,2]);
 data[1]!.availabilityState='limited';
 assert.deepEqual(passportMetricRuns(segments(data),'rating').map(r=>r.points.length),[4]);
 assert.deepEqual(passportMetricRuns(segments(rows().map(p=>({...p,modelRevision:null}))),'rating').map(r=>r.points.length),[4]);
 assert.equal(passportMetricRuns([],'rating').length,0);
});
test('multi-fact headline follows curator, NG zero is FC and PB unknown baseline is excluded',()=>{
 const ng=fact('ng','ng-reduced','2026-10-06',{before:14,after:0,delta:-14});
 const pb=fact('pb','score-pb','2026-10-06');const combo=fact('combo','combo-improved','2026-10-06',{before:266,after:617,delta:351});
 const [n]=compose([pb,ng,combo]);assert.equal(n!.headline.key,'passport.narrative.fc');assert.equal(n!.support.length,2);assert.equal(n!.factKeys.length,3);
 assert.deepEqual(compose([combo,ng,pb]),compose([pb,ng,combo]));
 assert.deepEqual(compose([{...pb,before:null}]),[]);
 for(const type of ['fc','df'] as const)assert.equal(compose([fact(type,type,'2026-10-06',{before:type==='df'?1:0,after:type==='df'?2:1,delta:1})])[0]!.headline.key,`passport.narrative.${type}`);
 assert.equal(compose([fact('rank','rank-upgrade','2026-10-06',{before:7,after:8,delta:1})])[0]!.headline.key,'passport.narrative.rankUp');
});
test('Goal observation stays undated; curated flood identity/order/evidence survives presentation',()=>{
 const nodes=curateSkillPassportMilestones(recoveryFlood(),period).milestones;
 const before=JSON.stringify(nodes);
 for(const n of nodes){const line=composePassportMilestoneNarrative(n,(_t,v)=>String(v));assert.deepEqual(line.factKeys,n.factKeys);assert.equal(line.id,n.id);}
 assert.equal(JSON.stringify(nodes),before);
 const n=compose([fact('goal','goal-completed',null,{goalId:'g',goalType:'fc'})])[0]!;
 assert.equal(n.timePrecision,'observation');assert.equal(n.headline.key,'passport.narrative.goalObserved');
 assert.deepEqual(compose([]),[]);
});
test('zh/ja semantic slots match, no unsupported single-play or emotional claims',()=>{
 const zh=JSON.parse(readFileSync(new URL('../locales/zh.json',import.meta.url),'utf8')).passport;
 const ja=JSON.parse(readFileSync(new URL('../locales/ja.json',import.meta.url),'utf8')).passport;
 assert.deepEqual(Object.keys(zh.narrative),Object.keys(ja.narrative));
 for(const key of Object.keys(zh.narrative)){
  const parameters=(s:string)=>[...s.matchAll(/\{([^}]+)\}/g)].map(m=>m[1]).sort();
  assert.deepEqual(parameters(zh.narrative[key]),parameters(ja.narrative[key]));
  assert.doesNotMatch(zh.narrative[key],/终于|这一把|同时|变稳|努力/);
 }
});
test('365 measurements × six metrics and bounded narrative performance',()=>{
 const data=Array.from({length:365},(_,i)=>measurement(String(i),new Date(Date.UTC(2025,9,9+i)).toISOString().slice(0,10)));
 const history=segments(data);const start=performance.now();
 for(let repeat=0;repeat<100;repeat++)for(const dimension of ['big_song','stamina','speed','accuracy_power','rhythm','complex'] as const)assert.equal(passportMetricRuns(history,dimension)[0]!.points.length,365);
 const plotMs=(performance.now()-start)/100;
 const nodes=curateSkillPassportMilestones(recoveryFlood(),period).milestones;const nstart=performance.now();
 for(let repeat=0;repeat<1000;repeat++)for(const n of nodes)composePassportMilestoneNarrative(n,(_t,v)=>String(v));
 console.log(JSON.stringify({sixSeriesProjectionMs:plotMs,narrativeBatchMs:(performance.now()-nstart)/1000}));
 assert.ok(plotMs<100);
});

test('multiple same-type facts keep the exact curator primary, not alphabetical first',()=>{
 const a=fact('a','score-pb','2026-10-06',{before:900000,after:901000,delta:1000});
 const z=fact('z','score-pb','2026-10-06',{before:900000,after:950000,delta:50000});
 const node=curateSkillPassportMilestones([a,z],period).milestones[0]!;
 const line=composePassportMilestoneNarrative(node,(_t,v)=>String(v));
 assert.equal(line.primaryFactKey,'z');assert.equal(line.headline.params.delta,'50000');
 assert.deepEqual(composePassportMilestoneNarrative({...node,improvements:[...node.improvements!].reverse()},(_t,v)=>String(v)),line);
});
