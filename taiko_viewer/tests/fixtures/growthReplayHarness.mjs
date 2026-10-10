// Test-only dependency injection. Executes the unmodified production Growth service,
// including its disk loader and replay; never mocks the final overview or daily DTO.
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import ts from 'typescript';
import {catalog} from './dailyProgressReplay.mjs';
const root = new URL('../../',import.meta.url);
const dataModule = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
export async function replayOverview(fixture,style='ready',measurementStyle='success') {
 const dir=await mkdtemp('/var/tmp/growth-replay-');
 try {
  await mkdir(resolve(dir,'fixture'));
  let current=new Map();
  for(const [i,payload] of fixture.snapshots.entries()) {
   await writeFile(resolve(dir,'fixture',`data_20260917_${String(i).padStart(6,'0')}.json`),JSON.stringify(payload));
   if(payload._meta.full)current=new Map();
   for(const row of payload.songs)current.set(`${row.song_no}:${row.level}`,row);
  }
  await writeFile(resolve(dir,'fixturedata.json'),JSON.stringify({songs:[...current.values()]}));
  if(measurementStyle==='archived') {
   const capturedAt=new Date().toISOString(),day=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
   await writeFile(resolve(dir,'fixture','daily-ability-v1-top20.json'),JSON.stringify({version:1,namespace:'v1-top20',days:{[day]:{capturedAt,rating:8,dimensions:Object.fromEntries(['大歌力','体力','高速处理','精度力','节奏处理','复合处理'].map(k=>[k,8])),sampleCount:30}}}));
  }
  const counters={compute:0,current:0,catalog:0,historyLoads:0,replays:0,measurements:0};
  const hook=`__growthReplay_${dir.split('/').at(-1).replaceAll('-','_')}`;
  globalThis[hook]={counters};
  const fsModule=dataModule(`import * as fs from 'node:fs/promises';export const {access,constants,readFile}=fs;export const readdir=async(...args)=>{globalThis[${JSON.stringify(hook)}].counters.historyLoads++;return fs.readdir(...args)};`);
  const dailyModule=dataModule(`import {deriveDailyProgress as derive} from ${JSON.stringify(new URL('utils/dailyProgress.ts',root).href)};export const deriveDailyProgress=(...args)=>{globalThis[${JSON.stringify(hook)}].counters.replays++;return derive(...args)};`);
  const shared=dataModule(`import {readFile} from 'node:fs/promises';export const getCurrentBindingRow=async()=>({id:1,taiko_id:'fixture',source:'wahlap'});export const getRuntimePaths=()=>({userdataDir:${JSON.stringify(dir)}});export const getUserdataPath=()=>${JSON.stringify(resolve(dir,'fixturedata.json'))};export const readUserdata=async()=>{globalThis[${JSON.stringify(hook)}].counters.current++;return JSON.parse(await readFile(getUserdataPath(),'utf8'))};`);
  const scoreRead=dataModule(`import {createFileScoreReader} from ${JSON.stringify(new URL('server/domain/file-score-reader.ts',root).href)};export const getDomainScoreReader=()=>createFileScoreReader(${JSON.stringify(dir)},()=>new Date().toISOString());`);
  const goalSnapshot=dataModule(`import {readUserdata} from ${JSON.stringify(shared)};export const readGoalSnapshot=async()=>({current:await readUserdata(),revision:'fixture',capturedAt:new Date().toISOString()});`);
  const goalStore=dataModule(`export const readActiveGoal=async()=>null;`);
  const goalEvaluationStore=dataModule(`export const readRecentCompletedGoal=async()=>null;`);
  const goalDb=dataModule(`export const getAccountDb=()=>null;`);
  const content=dataModule(`export const getSongCatalog=async()=>{globalThis[${JSON.stringify(hook)}].counters.catalog++;return ${JSON.stringify(catalog)}}`);
  const evidence=dataModule(`export const loadGrowthScoreEvidence=async()=>{globalThis[${JSON.stringify(hook)}].counters.historyLoads++;const snapshots=${JSON.stringify(fixture.snapshots)}.map(payload=>({full:payload._meta.full,timestamp:payload._meta.ts||'',songs:payload.songs,revision:payload._meta.ts||'fixture'}));return {snapshots,totalFiles:snapshots.length,filesRead:snapshots.length,invalidFiles:0,truncated:false,fromDay:'2026-09-17',toDay:'2026-09-17'}};`);
  const modelRevision=dataModule(`export const getGrowthModelRevision=async()=> 'fixture-model';`);
  const measurements=dataModule(`export const upsertGrowthMeasurement=async()=>{globalThis[${JSON.stringify(hook)}].counters.measurements++;${measurementStyle === 'fail' ? `throw new Error('fixture write failure')` : `return {created:true}`}};`);
  const dimensions=['big_song','stamina','speed','accuracy_power','rhythm','complex'].map(key=>({key,value:style==='balanced'?10:key==='accuracy_power'?9:10}));
  const computed={playerState:{dimensions,sampleCount:style==='limited'?2:30,overallRating:10.28},todayPlan:{items:catalog.map(s=>({songId:s.id,level:4,title:s.song_name,isUnplayed:false})),usedFallback:false}};
  const personal=dataModule(`export const runGrowthPythonJson=async()=>{globalThis[${JSON.stringify(hook)}].counters.compute++;return ${JSON.stringify(computed)}}`);
  let code=ts.transpileModule(await readFile(new URL('server/services/account/growth.ts',root),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  code=code.replace(/from (["'])([^"']+)\1/g,(_,quote,specifier)=>{
   const url=specifier==='../taiko-domain/read.ts'?scoreRead:specifier==='../goals/snapshot'?goalSnapshot:specifier==='../goals/store'?goalStore:specifier==='../goals/evaluation-store'?goalEvaluationStore:specifier==='../growth-history/evidence'?evidence:specifier==='../growth-history/model-revision'?modelRevision:specifier==='../growth-history/measurements'?measurements:specifier==='../growth-history/daily-archive'?new URL('server/services/growth-history/daily-archive.ts',root).href:specifier==='~/server/utils/account-db'?goalDb:specifier==='node:fs/promises'?fsModule:specifier==='~/utils/dailyProgress'?dailyModule:specifier.startsWith('node:')?specifier:specifier==='~/server/internal/account/shared'?shared:specifier==='~/server/services/content'?content:specifier==='./personal'?personal:specifier==='h3'?import.meta.resolve('h3'):new URL(specifier.replace('~/','')+'.ts',root).href;
   return `from ${JSON.stringify(url)}`;
  });
  code=`const Date=class extends globalThis.Date {constructor(...args){super(...(args.length?args:[${JSON.stringify(fixture.clock)}]))}};\n`+code;
  try {const service=await import(dataModule(code));return {overview:await service.getPlayerGrowthOverview(1),counters};}
  finally {delete globalThis[hook];}
 } finally {await rm(dir,{recursive:true,force:true});}
}
