// Test-only module boundaries: real account/session/binding/Goal SQL and services.
// Only runtime configuration, catalog and Python recommendation inputs are synthetic.
import {registerHooks} from 'node:module';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
export function installGoalSqlRuntime(db, runtime) {
 const root=new URL('../../',import.meta.url);
 globalThis.__goalSqlRuntime={db,runtime,pythonCalls:0};
 globalThis.useRuntimeConfig=()=>runtime;
 const overrides=new Map([
  [new URL('server/utils/account-db.ts',root).href,`export const getAccountDb=()=>globalThis.__goalSqlRuntime.db; export const ensureAccountSchema=async()=>{};`],
  [new URL('server/utils/account.ts',root).href,`export * from '${new URL('server/utils/account/auth.ts',root).href}';export * from '${new URL('server/utils/account/bindings.ts',root).href}';`],
  [new URL('server/services/content.ts',root).href,`export const getSongCatalog=async()=>[100,101,102].map(id=>({id,song_name:'SQL Song '+id,level_4:9,shelf_status:0}));export const getRatingEntries=async()=>[];`],
  [new URL('server/services/account/personal.ts',root).href,`export const runGrowthPythonJson=async()=>{globalThis.__goalSqlRuntime.pythonCalls++;return ({playerState:{dimensions:['accuracy_power','stamina','rhythm','speed','complex','big_song'].map(key=>({key,value:key==='accuracy_power'?9:10})),sampleCount:30,overallRating:10},todayPlan:{items:[100,101,102].map(songId=>({songId,level:4,title:'SQL Song '+songId,isUnplayed:false})),usedFallback:false}});};`],
  [new URL('server/services/growth-history/model-revision.ts',root).href,`export const getGrowthModelRevision=async()=> 'synthetic-domain-source';`],
  [new URL('server/services/annual-beta/events.ts',root).href,`export const trackBetaServer=async()=>{};`]
 ]);
 const hook=registerHooks({
  resolve(specifier,context,next){
   let target;
   if(specifier.startsWith('~/'))target=new URL(specifier.slice(2),root).href;
   else if(specifier.startsWith('.')&&context.parentURL?.startsWith(root.href)&&!context.parentURL.includes('/node_modules/'))target=new URL(specifier,context.parentURL).href;
   if(target){
    if(overrides.has(target+'.ts'))return {url:target+'.ts',shortCircuit:true};
    if(!/\.(?:ts|mjs|js|json)$/.test(target)){
     if(existsSync(fileURLToPath(target+'.ts')))target+='.ts';
     else if(existsSync(fileURLToPath(target+'/index.ts')))target+='/index.ts';
    }
    return next(target,context);
   }
   return next(specifier,context);
  },
  load(url,context,next){
   if(overrides.has(url))return {format:'module',source:overrides.get(url),shortCircuit:true};
   if(url.startsWith(root.href)&&url.endsWith('.ts'))return {format:'module',source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,shortCircuit:true};
   return next(url,context);
  }
 });
 return ()=>{hook.deregister();delete globalThis.__goalSqlRuntime;delete globalThis.useRuntimeConfig;};
}
