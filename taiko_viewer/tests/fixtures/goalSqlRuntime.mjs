// Test-only module boundaries: real account/session/binding/Goal SQL and services.
// Only runtime configuration, catalog and Python recommendation inputs are synthetic.
import {registerHooks} from 'node:module';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
export function installGoalSqlRuntime(db, runtime, { withProfile = false, withPersonal = false, withRealPython = false, withAccountSource = false, withDeveloper = false, withRealModel = false, withRealCatalog = false } = {}) {
 const root=new URL('../../',import.meta.url);
 globalThis.__goalSqlRuntime={db,runtime,pythonCalls:0};
 globalThis.useRuntimeConfig=()=>runtime;
 const overrides=new Map([
  [new URL('server/utils/account-db.ts',root).href,`export const getAccountDb=()=>globalThis.__goalSqlRuntime.db; export const getAccountDbNativeConfig=()=>({host:process.env.TAIKO_DB_HOST,port:Number(process.env.TAIKO_DB_PORT||3306),user:process.env.TAIKO_DB_USER,password:process.env.TAIKO_DB_PASSWORD,database:process.env.TAIKO_DB_NAME}); export const ensureAccountSchema=async()=>{};`],
  [new URL('server/utils/account.ts',root).href,`export * from '${new URL('server/utils/account/auth.ts',root).href}';export * from '${new URL('server/utils/account/bindings.ts',root).href}';${withProfile || withAccountSource ? `export * from '${new URL('server/utils/account/profile.ts',root).href}';` : ''}${withAccountSource ? `export * from '${new URL('server/utils/account/sync.ts',root).href}';export * from '${new URL('server/utils/account/score-token.ts',root).href}';` : ''}`],
  [new URL('server/services/content.ts',root).href,`export const getSongCatalog=async()=>[100,101,102].map(id=>({id,song_name:'SQL Song '+id,level_4:9,shelf_status:0}));export const getRatingEntries=async()=>[];`],
  [new URL('server/services/account/personal.ts',root).href,`export const runGrowthPythonJson=async()=>{globalThis.__goalSqlRuntime.pythonCalls++;await globalThis.__goalSqlRuntime.onPython?.();return ({playerState:{dimensions:['accuracy_power','stamina','rhythm','speed','complex','big_song'].map(key=>({key,value:key==='accuracy_power'?9:10})),sampleCount:30,overallRating:10},todayPlan:{items:[100,101,102].map(songId=>({songId,level:4,title:'SQL Song '+songId,isUnplayed:false})),usedFallback:false}});};`],
  [new URL('server/services/growth-history/model-revision.ts',root).href,`export const getGrowthModelRevision=async()=> 'synthetic-domain-source';`],
  [new URL('server/services/annual-beta/events.ts',root).href,`export const trackBetaServer=async()=>{};`]
 ]);
 if (withAccountSource) overrides.set(new URL('server/infrastructure/account/sync-worker.ts',root).href,`
  import {createAccountSyncWorkerRunner} from '${new URL('server/infrastructure/account/sync-worker-runner.ts',root).href}';
  export const runAccountSyncWorker=(request,db)=>createAccountSyncWorkerRunner(globalThis.__goalSqlRuntime.syncLaunch)(request,db);
 `);
 if (withAccountSource) overrides.set(new URL('server/infrastructure/account/source-mutation-worker.ts',root).href,`
  import {createSourceMutationWorker} from '${new URL('server/infrastructure/account/source-mutation-worker-runner.ts',root).href}';
  export const runSourceMutationWorker=(request,ticket)=>createSourceMutationWorker(globalThis.__goalSqlRuntime.sourceMutationLaunch)(request,ticket);
 `);
 if (withDeveloper) {
  overrides.set(new URL('server/infrastructure/account/qq-migration-worker.ts',root).href,`
   import {createQqMigrationWorker} from '${new URL('server/infrastructure/account/qq-migration-worker-runner.ts',root).href}';
   export const runQqMigrationWorker=(request,host)=>createQqMigrationWorker(globalThis.__goalSqlRuntime.qqMigrationLaunch)(request,host);
  `);
  overrides.set(new URL('server/infrastructure/account/hiroba-credential-worker.ts',root).href,`
   import {createHirobaCredentialWorker} from '${new URL('server/infrastructure/account/hiroba-credential-worker-runner.ts',root).href}';
   export const runHirobaCredentialWorker=(request,ticket)=>createHirobaCredentialWorker(globalThis.__goalSqlRuntime.hirobaCredentialLaunch)(request,ticket);
  `);
  // Keep actual developer/quota/credential/source services. The unused public
  // catalog module imports JSON and remote constants outside this test's scope.
  overrides.set(new URL('server/services/content/v2Constants.ts',root).href,`export const getV2ConstantsCsvDataset=async()=>{throw new Error('Public catalog not exercised by source authority QA');};`);
  const accountUrl=new URL('server/utils/account.ts',root).href;
  overrides.set(accountUrl,overrides.get(accountUrl)+`export * from '${new URL('server/utils/account/developer.ts',root).href}';`);
 }
 if (withRealCatalog) overrides.set(new URL('server/services/content.ts',root).href,`export {getSongCatalog,getRatingEntries} from '${new URL('server/services/content/songs.ts',root).href}';`);
 if (withRealModel) overrides.delete(new URL('server/services/growth-history/model-revision.ts',root).href);
 if (withPersonal) {
  overrides.delete(new URL('server/services/account/personal.ts',root).href);
  if (!withRealPython) overrides.set(new URL('server/services/account/python-compute.ts',root).href,`
   export const runPythonJson=async args=>{
    const runtime=globalThis.__goalSqlRuntime;runtime.pythonCalls++;runtime.pythonArgs=args;
    await runtime.onPython?.(args);
    if(runtime.pythonFailure)throw runtime.pythonFailure;
    return runtime.pythonPayload || (args[0]==='rating'?{overallRating:10,sampleCount:30}:args[0]==='target'?{target:args[args.indexOf('--target')+1],items:[]}:{basis:args[args.indexOf('--basis')+1],items:[{songId:100,isUnplayed:false}]});
   };
   export const runGrowthPythonJson=async()=>{throw new Error('Growth compute not mocked in personal fixture');};
  `);
 }
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
