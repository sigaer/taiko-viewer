// The actual account pool/config and worker transport; no DB queries or network.
import assert from 'node:assert/strict';
import test from 'node:test';
import {registerHooks} from 'node:module';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import ts from 'typescript';
const root=new URL('../',import.meta.url);
const hook=registerHooks({
 resolve(specifier,context,next){
  let target;if(specifier.startsWith('~/'))target=new URL(specifier.slice(2),root).href;
  else if(specifier.startsWith('.')&&context.parentURL?.startsWith(root.href)&&!context.parentURL.includes('/node_modules/'))target=new URL(specifier,context.parentURL).href;
  if(target){if(!/\.(ts|mjs|js|json)$/.test(target)&&existsSync(fileURLToPath(target+'.ts')))target+='.ts';return next(target,context);}return next(specifier,context);
 },
 load(url,context,next){if(url.startsWith(root.href)&&url.endsWith('.ts'))return {format:'module',source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,shortCircuit:true};return next(url,context);}
});
const initial={dbHost:'127.0.0.1',dbPort:3306,dbUser:'synthetic-only',dbPassword:'synthetic-only',dbName:'synthetic_transport_test',repoRoot:'/var/tmp/owned-sync-transport',userdataDir:'/var/tmp/owned-sync-transport/userdata',taikoConfigPath:'/var/tmp/owned-sync-transport/config.json'};
let config={...initial};globalThis.useRuntimeConfig=()=>config;
const dbModule=await import('../server/utils/account-db.ts');
const {createAccountSyncWorkerRunner}=await import('../server/infrastructure/account/sync-worker-runner.ts');
const {createSourceMutationWorker}=await import('../server/infrastructure/account/source-mutation-worker-runner.ts');
const request={requestId:'a'.repeat(32),requestHash:'b'.repeat(64),userId:1,binding:{id:'1',taiko_id:'7123456',source:'wahlap',manual_account_id:null},targetIds:['sakura-bot']};
const reply={ok:true,result:{requestId:request.requestId,userId:1,taikoId:'7123456',logId:1,logHash:'c'.repeat(64)}};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
class Child extends EventEmitter{
 constructor(){super();this.stdin=new PassThrough();this.stdout=new PassThrough();this.stderr=new PassThrough();this.kills=[];}
 kill(signal){this.kills.push(signal);return true;}
 finish(payload=reply,code=0){this.stdout.end(typeof payload==='string'?payload:JSON.stringify(payload));this.emit('close',code);}
}
test.after(async()=>{await dbModule.closeAccountDb();hook.deregister();delete globalThis.useRuntimeConfig;});

test('captured real pool configuration survives config changes and pool replacement',{timeout:3000},async()=>{
 const db=dbModule.getAccountDb();config={...initial,dbPassword:'changed-private',dbName:'changed_transport_test'};
 assert.equal(dbModule.getAccountDbNativeConfig(db).database,initial.dbName);
 await dbModule.closeAccountDb();const next=dbModule.getAccountDb();assert.notEqual(next,db);
 assert.equal(dbModule.getAccountDbNativeConfig(next).database,'changed_transport_test');
 assert.equal(dbModule.getAccountDbNativeConfig(db).password,initial.dbPassword);
 let launched;const run=createAccountSyncWorkerRunner((executable,args,options)=>{
  assert.equal(executable,(process.env.TAIKO_PYTHON_EXECUTABLE || '/usr/bin/python3'));assert.deepEqual(args,['-I','-m','taiko_bot.cli.account_sync_cli']);assert.equal(options.env.TAIKO_DB_NAME,initial.dbName);assert.equal(options.env.TAIKO_DB_PASSWORD,initial.dbPassword);
  assert.equal(options.env.TAIKO_RUNTIME_ENV_FILE,'/proc/self/taiko-account-sync-no-env');assert.equal(options.env.TAIKO_ALLOW_TEST_DB_MUTATION,undefined);assert.equal(options.env.PYTHONPATH,undefined);
  launched=new Child();return launched;
 });const pending=run(request,db);await tick();launched.finish();assert.deepEqual(await pending,reply.result);
 config={...initial};await dbModule.closeAccountDb();
});

test('all runner instances share two active/eight waiting slots; release follows child close',{timeout:4000},async()=>{
 const children=[],launch=()=>{const child=new Child();children.push(child);return child;};
 const one=createAccountSyncWorkerRunner(launch),two=createAccountSyncWorkerRunner(launch),db=dbModule.getAccountDb();
 const calls=Array.from({length:10},(_,i)=>(i%2?one:two)(request,db));for(const p of calls)p.catch(()=>{});
 await assert.rejects(one(request,db),error=>error.statusCode===503);await tick();assert.equal(children.length,2);
 children[0].stderr.write(Buffer.alloc(8193));await tick();assert.deepEqual(children[0].kills,['SIGTERM']);assert.equal(children.length,2,'Capacity retained while child has not closed');
 children[0].finish(reply,1);await assert.rejects(calls[0],error=>error.statusCode===503);await tick();assert.equal(children.length,3);
 for(let index=1;index<10;index++){children[index].finish();await tick();}
 await Promise.all(calls.slice(1));assert.equal(children.length,10);
});

for(const field of ['requestId','userId','taikoId','logHash'])test(`native output refuses a mismatched ${field}`,{timeout:3000},async()=>{
 let child;const run=createAccountSyncWorkerRunner(()=>child=new Child());const pending=run(request,dbModule.getAccountDb());await tick();
 child.finish({ok:true,result:{...reply.result,[field]:field==='userId'?2:'foreign'}});await assert.rejects(pending,error=>error.statusCode===503);
});

test('native output/stderr bounds and spawn failures are sanitized',{timeout:4000},async()=>{
 for(const stream of ['stdout','stderr']){let child;const run=createAccountSyncWorkerRunner(()=>child=new Child());const pending=run(request,dbModule.getAccountDb());await tick();child[stream].write(Buffer.alloc(stream==='stdout'?65537:8193));await tick();assert.equal(child.kills[0],'SIGTERM');child.finish();await assert.rejects(pending,error=>error.statusCode===503);}
 let child;const run=createAccountSyncWorkerRunner(()=>child=new Child());const pending=run(request,dbModule.getAccountDb());await tick();child.emit('error',new Error('Private spawn /password/hash'));child.finish();await assert.rejects(pending,error=>error.statusCode===503&&!String(error).includes('/password/hash'));
 await assert.rejects(createAccountSyncWorkerRunner(()=>{throw new Error('Private launch /password/hash');})(request,dbModule.getAccountDb()),error=>!String(error).includes('/password/hash'));
});

test('worker reply retains safe cooldown fields and rejects arbitrary native message',{timeout:3000},async()=>{
 for(const payload of [{ok:false,error:'sync_cooldown',status:429,data:{remainingSeconds:100,availableAt:'2026-10-11T12:00:00'},message:'private password'},
  {ok:false,error:'wahlap_sync_failed',status:502,message:'private password'}]){
  let child;const run=createAccountSyncWorkerRunner(()=>child=new Child());const pending=run(request,dbModule.getAccountDb());await tick();child.finish(payload);
  await assert.rejects(pending,error=>error.statusCode===payload.status&&!String(error).includes('private password'));
 }
});

test('queue deadline expires without starting an extra worker',{timeout:3000},async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const children=[];
 const run=createAccountSyncWorkerRunner(()=>{const child=new Child();children.push(child);return child;});
 const db=dbModule.getAccountDb(),a=run(request,db),b=run(request,db),queued=run(request,db);queued.catch(()=>{});
 try{await tick();assert.equal(children.length,2);t.mock.timers.tick(30000);await assert.rejects(queued,error=>error.statusCode===503);
  assert.equal(children.length,2);for(const child of children)child.finish();await Promise.all([a,b]);
 }finally{t.mock.timers.reset();}
});

test('deadline escalates only the owned child and keeps its slot until close',{timeout:3000},async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let child,settled=false;
 const run=createAccountSyncWorkerRunner(()=>child=new Child()),pending=run(request,dbModule.getAccountDb());pending.then(()=>{settled=true;},()=>{settled=true;});
 try{await tick();t.mock.timers.tick(180000);await tick();assert.deepEqual(child.kills,['SIGTERM']);assert.equal(settled,false);
  t.mock.timers.tick(1500);await tick();assert.deepEqual(child.kills,['SIGTERM','SIGKILL']);assert.equal(settled,false);
  child.finish(reply,1);await assert.rejects(pending,error=>error.statusCode===503);
 }finally{t.mock.timers.reset();}
});

test('oversize private request is refused before process admission',{timeout:3000},async()=>{
 let launched=false;const run=createAccountSyncWorkerRunner(()=>{launched=true;return new Child();});
 await assert.rejects(run({...request,binding:{...request.binding,taiko_id:'x'.repeat(16384)}},dbModule.getAccountDb()),error=>error.statusCode===503);
 assert.equal(launched,false);
});
const mutation={operationId:'d'.repeat(32),source:'7123456',scope:'wahlap_update',actor:{kind:'session',userId:1,credential:'e'.repeat(64)},grant:{kind:'owner',binding:request.binding},showAll:false,includeImage:false,email:'',password:''};
const mutationReply={ok:true,result:{operationId:mutation.operationId,source:mutation.source,commitId:'f'.repeat(32),sequence:2,imageBytes:0,imageHash:null}};
const ticket=()=>({db:dbModule.getAccountDb(),paths:{repoRoot:initial.repoRoot,userdataDir:initial.userdataDir,configPath:initial.taikoConfigPath,cacheDir:initial.repoRoot+'/cache'}});
test('account sync and source mutation share the same two-worker admission',{timeout:4000},async()=>{
 const children=[],launch=()=>{const c=new Child();children.push(c);return c;};
 const account=createAccountSyncWorkerRunner(launch),source=createSourceMutationWorker(launch),t=ticket();
 const a=account(request,t.db),b=source(mutation,t),c=source(mutation,t);await tick();assert.equal(children.length,2);
 children[0].finish();await a;await tick();assert.equal(children.length,3);children[1].finish(mutationReply);children[2].finish(mutationReply);await Promise.all([b,c]);
});
test('source worker captures paths/config and sends private actor/credentials only over stdin',{timeout:3000},async()=>{
 const t=ticket();let child,actualInput='';const run=createSourceMutationWorker((executable,args,options)=>{
  assert.deepEqual(args,['-I','-m','taiko_bot.cli.source_mutation_cli']);assert.equal(options.cwd,t.paths.repoRoot);assert.equal(options.env.TAIKO_ACCOUNT_CACHE_DIR,t.paths.cacheDir);assert.equal(options.env.TAIKO_ALLOW_TEST_DB_MUTATION,undefined);
  child=new Child();child.stdin.on('data',bytes=>{actualInput+=bytes.toString();});return child;
 });const pending=run({...mutation,email:'synthetic@example.test',password:'private-password'},t);await tick();
 assert.equal(JSON.parse(actualInput).password,'private-password');child.finish(mutationReply);assert.deepEqual(await pending,mutationReply.result);
});
test('Hiroba worker uses its own 900-second deadline and closes before freeing capacity',{timeout:3000},async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let child;const run=createSourceMutationWorker(()=>child=new Child()),pending=run({...mutation,scope:'hiroba_sync'},ticket());pending.catch(()=>{});
 try{await tick();t.mock.timers.tick(180000);assert.deepEqual(child.kills,[]);t.mock.timers.tick(720000);assert.deepEqual(child.kills,['SIGTERM']);t.mock.timers.tick(1500);assert.deepEqual(child.kills,['SIGTERM','SIGKILL']);child.finish(mutationReply,1);await assert.rejects(pending,error=>error.statusCode===503);}
 finally{t.mock.timers.reset();}
});
test('source worker rejects mismatched commit/actor output and bounded stdout failure',{timeout:3000},async()=>{
 for(const result of [{...mutationReply.result,source:'foreign'},{...mutationReply.result,imageBytes:1,imageHash:null},{...mutationReply.result,commitId:'unsafe'}]){
  let child;const pending=createSourceMutationWorker(()=>child=new Child())(mutation,ticket());await tick();child.finish({ok:true,result});await assert.rejects(pending,error=>error.statusCode===503);
 }
 let child;const pending=createSourceMutationWorker(()=>child=new Child())(mutation,ticket());await tick();child.stdout.write(Buffer.alloc(65537));assert.equal(child.kills[0],'SIGTERM');child.finish(mutationReply);await assert.rejects(pending,error=>error.statusCode===503);
});
