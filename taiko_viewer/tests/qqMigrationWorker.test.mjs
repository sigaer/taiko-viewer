import assert from 'node:assert/strict';
import test from 'node:test';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {installGoalSqlRuntime} from './fixtures/goalSqlRuntime.mjs';
const uninstall=installGoalSqlRuntime({},{});
const {createQqMigrationWorker}=await import('../server/infrastructure/account/qq-migration-worker-runner.ts');uninstall();
const request={operationId:'a'.repeat(32),action:'issue',principal:'onebot_v11:12345',actor:{kind:'developer',userId:1,credential:'b'.repeat(64),tokenId:'1'},grant:{kind:'service',tuple:[],sources:'*'}};
const host={paths:{repoRoot:'/var/tmp/owned-qq-source'},workerEnv:{PATH:'/usr/bin',TAIKO_DB_PASSWORD:'synthetic-private-env'}};
function launchFor(make){return (...args)=>{
 const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kills=0;
 child.kill=()=>{child.kills++;queueMicrotask(()=>child.emit('close',null));return true;};
 let input='';child.stdin.on('data',data=>input+=data);child.stdin.on('finish',()=>make(child,JSON.parse(input),args));return child;
};}
const response=req=>({ok:true,result:{operationId:req.operationId,payload:{ok:true,identityKey:req.principal,qq:'12345',code:'c'.repeat(32),expiresInSeconds:600}}});
test('private QQ task uses static argv/captured env and parses split response',async()=>{
 const runner=createQqMigrationWorker(launchFor((child,req,args)=>{
  assert.equal(args[0],(process.env.TAIKO_PYTHON_EXECUTABLE || '/usr/bin/python3'));assert.deepEqual(args[1],['-I','-m','taiko_bot.cli.qq_migration_cli']);assert.equal(args[2].cwd,host.paths.repoRoot);assert.equal(args[2].env,host.workerEnv);
  const raw=Buffer.from(JSON.stringify(response(req)));child.stdout.write(raw.subarray(0,5));child.stdout.write(raw.subarray(5));queueMicrotask(()=>child.emit('close',0));
 }));
 assert.equal((await runner(request,host)).code,'c'.repeat(32));
});
test('split multibyte manual nickname uses one decoder and preserves metadata',async()=>{
 const req={...request,action:'migrate',principal:'qq_official:Sender_',qq:'12345',code:'c'.repeat(32)};
 const runner=createQqMigrationWorker(launchFor((child,input)=>{
  const payload={ok:true,identityKey:input.principal,found:true,taikoId:'111',currentTaikoId:'111',visible:0,currentSource:'wahlap',currentSlot:1,currentVirtual:false,
   operation:{kind:'qq-migrate',qq:'12345',sourceCurrentId:'111',firstBinding:true,replayed:false},bindings:[
    {slot:1,taikoId:'111',visible:0,isCurrent:true,source:'wahlap',displayName:'111',isManual:false,canExternalSync:true},
    {slot:2,taikoId:'981234567890123456',visible:0,isCurrent:false,source:'manual',displayName:'玩家昵称',isManual:true,canExternalSync:false}]};
  const raw=Buffer.from(JSON.stringify({ok:true,result:{operationId:input.operationId,payload}})),offset=raw.indexOf(Buffer.from('玩家'))+1;
  child.stdout.write(raw.subarray(0,offset));child.stdout.write(raw.subarray(offset));queueMicrotask(()=>child.emit('close',0));
 }));assert.equal((await runner(req,host)).bindings[1].displayName,'玩家昵称');
});
for(const field of ['operation','identity','code','ttl'])test('wrong '+field+' response is rejected',async()=>{
 const runner=createQqMigrationWorker(launchFor((child,req)=>{
  const value=response(req);if(field==='operation')value.result.operationId='d'.repeat(32);if(field==='identity')value.result.payload.identityKey='qq_official:Foreign';if(field==='code')value.result.payload.code='bad';if(field==='ttl')value.result.payload.expiresInSeconds=true;
  child.stdout.end(JSON.stringify(value));queueMicrotask(()=>child.emit('close',0));
 }));await assert.rejects(runner(request,host),error=>error.statusCode===503&&!error.message.includes('synthetic-private-env'));
});
for(const stream of ['stdout','stderr'])test(stream+' quota terminates child and waits for close',async()=>{
 let observed;
 const runner=createQqMigrationWorker(launchFor((child)=>{observed=child;child[stream].write(Buffer.alloc(stream==='stdout'?256*1024+1:8193,120));}));
 await assert.rejects(runner(request,host),error=>error.statusCode===503);assert.equal(observed.kills,1);
});
test('oversized private frame never spawns',async()=>{
 await assert.rejects(createQqMigrationWorker(()=>assert.fail('Oversized frame spawned'))({...request,extra:'x'.repeat(65536)},host));
});
test('unknown child diagnostic code is never forwarded',async()=>{
 const runner=createQqMigrationWorker(launchFor(child=>{child.stdout.end(JSON.stringify({ok:false,status:403,error:'/password/secret'}));queueMicrotask(()=>child.emit('close',0));}));
 await assert.rejects(runner(request,host),error=>error.statusCode===503&&!error.message.includes('password'));
});
