import assert from 'node:assert/strict';
import test from 'node:test';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {installGoalSqlRuntime} from './fixtures/goalSqlRuntime.mjs';
const undo=installGoalSqlRuntime({},{});
const {createHirobaCredentialWorker}=await import('../server/infrastructure/account/hiroba-credential-worker-runner.ts');undo();
const operationId='a'.repeat(32),intentHash='b'.repeat(64),ticket={paths:{repoRoot:'/owned/core'},workerEnv:{HIROBA_CRED_KEY:'private-key',TAIKO_DB_NAME:'synthetic_test'}};
const request={operationId,mode:'discover',email:'demo@example.test',password:'private-password',target:'12345',principal:'onebot_v11:12345'};
function fake(result,{stderr='',code=0,closeAfterKill=false}={}){
 const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();child.signals=[];let input='';child.stdin.on('data',chunk=>{input+=chunk.toString();});
 child.kill=signal=>{child.signals.push(signal);if(closeAfterKill)setImmediate(()=>child.emit('close',null));return true;};
 const launch=(executable,args,options)=>{assert.equal(executable,'python3');assert.deepEqual(args,['-m','scripts.hiroba_credential_cli']);assert.equal(options.cwd,'/owned/core');assert.strictEqual(options.env,ticket.workerEnv);
  child.stdin.on('finish',()=>setImmediate(()=>{assert.equal(JSON.parse(input).password,request.password);if(stderr)child.stderr.write(stderr);child.stdout.write(typeof result==='string'?result:JSON.stringify({ok:true,result}));if(!closeAfterKill)child.emit('close',code);}));return child;};
 return {child,run:()=>createHirobaCredentialWorker(launch)(request,ticket)};
}
const result={operationId,intentHash,taikoIds:['12345'],passwordEnc:'g'+'A'.repeat(98)+'='};
test('private worker uses fixed module argv/captured environment and stdin for secrets',async()=>{
 const worker=fake(result);assert.deepEqual(await worker.run(),result);assert.deepEqual(worker.child.signals,[]);
});
test('foreign nonce, mismatched target, unsafe or over-capacity results are unavailable',async()=>{
 for(const change of [{operationId:'c'.repeat(32)},{taikoIds:['54321']},{taikoIds:['../private']},{taikoIds:['12345','12345']},{taikoIds:Array.from({length:129},()=> '12345')},{intentHash:'bad'},{passwordEnc:'bad'}])await assert.rejects(fake({...result,...change}).run(),error=>error.statusCode===503);
});
test('malformed and unknown native diagnostics are fixed, never copied to HTTP',async()=>{
 for(const payload of ['Private /password/hash',JSON.stringify({ok:false,status:502,error:'private-password'})])await assert.rejects(fake(payload).run(),error=>error.statusCode===503&&!error.message.includes('private-password'));
 const known=fake(JSON.stringify({ok:false,status:502,error:'hiroba_login_failed'}));await assert.rejects(known.run(),error=>error.statusCode===502);
});
test('stdout/stderr overflow terminates the owned child and waits for close',async()=>{
 for(const options of [{payload:'x'.repeat(16385)},{payload:result,stderr:'x'.repeat(8193)}]){
  const worker=fake(options.payload,{stderr:options.stderr,closeAfterKill:true});await assert.rejects(worker.run(),error=>error.statusCode===503);assert.deepEqual(worker.child.signals,['SIGTERM']);
 }
});
test('oversized secret input is rejected before spawn',async()=>{
 let spawned=false;await assert.rejects(createHirobaCredentialWorker(()=>{spawned=true;throw new Error('Should not spawn');})({...request,password:'x'.repeat(32769)},ticket),error=>error.statusCode===503);assert.equal(spawned,false);
});
