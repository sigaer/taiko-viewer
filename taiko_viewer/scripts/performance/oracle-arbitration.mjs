// Synthetic oracle comparison only; run through memory/run_qa.sh.
import {mkdtemp,writeFile,readFile,rm,mkdir,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {prepareFixture} from './growth-benchmark-fixtures.mjs';
import {importGrowthRequest} from '../../tests/fixtures/growthRequestHarness.mjs';
import {projectGoalFact} from '../../utils/growthHistory.ts';
import * as current from '../../utils/dailyProgress.ts';
const output=process.argv[2];assert.ok(output?.startsWith('/var/tmp/'));
const work=await mkdtemp('/var/tmp/oracle-arbitration-');
const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
function differences(a,b,path='$',out=[]){
 if(JSON.stringify(a)===JSON.stringify(b))return out;
 if(a&&b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)){
  for(const key of new Set([...Object.keys(a),...Object.keys(b)]))differences(a[key],b[key],path+'.'+key,out);
 }else out.push({path,before:a??null,after:b??null});return out;
}
const report={status:'OWNER_DECISION_PENDING',productionAccess:false,scope:'Unchanged synthetic Passport boundary and paired observation facts; frozen oracle unchanged'};
try{
 const fixture=await prepareFixture('boundary',work);
 fixture.goalFacts=[projectGoalFact(1,1,{id:'42',status:'completed',title:'synthetic',songId:1,difficultyType:4,completedAt:'2026-10-08T05:00:00Z',completionEvidence:{observationRevision:'fixture',evaluationVersion:1,observationCapturedAt:'2026-10-07T16:00:00Z',provenance:{source:'wahlap'},result:{goalType:'score-pb',before:1,after:2,delta:1}}})];
 await writeFile(resolve(fixture.userdataDir,fixture.id,'daily-ability-v1-top20.json'),JSON.stringify({version:1,namespace:'v1-top20',days:{'2026-10-07':{capturedAt:'2026-10-07T05:00:00Z',rating:8,dimensions:Object.fromEntries(['大歌力','体力','高速处理','精度力','节奏处理','复合处理'].map(k=>[k,8])),sampleCount:30}}}));
 fixture.measurements=[{id:'frozen',ownerId:'1',bindingId:'1',capturedAt:'2026-10-07T04:00:00Z',scoreRevision:'frozen',measurementVersion:1,algorithmVersion:'growth-v1',modelRevision:'frozen-model',rating:7,dimensions:Object.fromEntries(['big_song','stamina','speed','accuracy_power','rhythm','complex'].map(k=>[k,7])),focus:'balanced',sampleCount:30,availabilityState:'ready'}];
 const range={from:'2025-10-09',to:'2026-10-08',fromUtc:'2025-10-08T16:00:00.000Z',toExclusiveUtc:'2026-10-08T16:00:00.000Z',requestedDays:365,selectedDimension:'rating',recentFrom:'2026-07-11'};
 const results=[];
 for(const baseline of [true,false]){
  const adapter=await importGrowthRequest(fixture,{baseline});
  try{results.push(await adapter.service.getSkillPassport(1,range,{shareScoreEvidence:!baseline}));}finally{adapter.dispose();}
 }
 report.passport={oldHash:hash(results[0]),candidateHash:hash(results[1]),differences:differences(...results),old:results[0],candidate:results[1]};
 report.inputHashes=Object.fromEntries(await Promise.all((await readdir(resolve(fixture.userdataDir,fixture.id))).sort().map(async name=>[name,hash(await readFile(resolve(fixture.userdataDir,fixture.id,name),'utf8'))])));
 const frozenPath=new URL('../../tests/fixtures/passport0819/dailyProgress.ts.txt',import.meta.url);
 const raw=await readFile(frozenPath,'utf8');
 const frozenFile=resolve(work,'frozen.mjs');
 const code=ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace('"./playerGrowth.ts"',JSON.stringify(new URL('../../utils/playerGrowth.ts',import.meta.url).href));
 await writeFile(frozenFile,code);const frozen=await import(pathToFileURL(frozenFile));
 report.frozenSourceSha256=hash(raw);
 const song=(day,extra={})=>({song_no:1,level:4,high_score:900000+day*100,stage_cnt:day,best_score_rank:4,clear_cnt:1,full_combo_cnt:0,dondaful_combo_cnt:0,good_cnt:480,ok_cnt:10,ng_cnt:10,combo_cnt:300,update_datetime:`2026-01-0${day} 12:00:00`,highscore_datetime:`2026-01-0${day} 12:00:00`,...extra});
 const snap=(day,songs,extra={})=>({full:true,source:'wahlap',timestamp:`2026-01-0${day} 13:00:00`,songs,...extra});
 const scenarios=[
 ['same-source-full-reappearance',[snap(1,[song(1)]),snap(2,[]),snap(3,[song(3)])],2,false],
 ['source-switch-reappearance',[snap(1,[song(1)]),snap(2,[],{source:'hiroba'}),snap(3,[song(3)])],2,false],
 ['explicit-removed',[snap(1,[song(1)]),snap(2,[],{full:false,removed:['1:4']}),snap(3,[song(3)])],2,false],
 ['direct-source-switch',[snap(1,[song(1)]),snap(2,[song(2)],{source:'hiroba'})],1,false],
 ['manual',[snap(1,[song(1)]),snap(2,[song(2)],{excludedReason:'manual'})],1,false],
 ['delta-omission',[snap(1,[song(1)]),snap(2,[],{full:false}),snap(3,[song(3)])],2,true],
 ['legitimate-pb-ng-rank-clear',[snap(1,[song(1,{update_datetime:'2026-01-02 10:00:00',highscore_datetime:'2026-01-02 10:00:00'})],{timestamp:'2026-01-02 11:00:00'}),snap(2,[song(2,{ng_cnt:5,good_cnt:485,best_score_rank:5,full_combo_cnt:1})])],1,true],
 ['next-comparable-after-reappearance',[snap(1,[song(1)]),snap(2,[]),snap(3,[song(3)]),snap(4,[song(4)])],3,true]];
 report.counterexamples=[];
 for(const [name,input,index,played] of scenarios){
  const before=frozen.deriveProgressForRange(input.at(-1).songs,input,'2026-01-01','2026-01-06',()=> 'Synthetic');
  const after=current.deriveProgressForRange(input.at(-1).songs,input,'2026-01-01','2026-01-06',()=> 'Synthetic');
  assert.equal(after[index].attendance,played?'played':'unknown',name);
  const facts=after[index].events.flatMap(e=>e.facts).map(f=>f.type);
  if(name==='legitimate-pb-ng-rank-clear')for(const type of ['score-pb','ng-reduced','rank-upgrade','fc'])assert.ok(facts.includes(type),type);
  report.counterexamples.push({name,input,old:before,candidate:after,expectedAttendance:played?'played':'unknown',candidateAssertion:'PASS',differences:differences(before,after)});
 }
 await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({output,status:report.status,passportDifferences:report.passport.differences.length,counterexamples:report.counterexamples.length}));
}finally{await rm(work,{recursive:true,force:true});}
