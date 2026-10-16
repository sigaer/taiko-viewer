import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {openPublicationLease,withPublicationLease,type PublicationManifest} from '../server/infrastructure/taiko-publication/client.ts';
import {getPublicationPython} from '../server/infrastructure/taiko-publication/python.ts';

const helper=fileURLToPath(new URL('./fixtures/crossWriterInstalled.py',import.meta.url));
const identity='synthetic';
async function fixture(task:(root:string)=>Promise<void>){
 const root=await mkdtemp('/var/tmp/installed-cross-writer-');
 try{await task(root);}finally{await rm(root,{recursive:true,force:true});}
}
function worker(root:string,writer:string,fault='none'){
 const child=spawn(getPublicationPython(),['-I',helper,root,writer,fault],{cwd:root,stdio:['ignore','pipe','pipe']});
 let output='',diagnosticBytes=0;
 let readyResolve:()=>void,readyReject:(error:Error)=>void;
 const ready=new Promise<void>((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
 // Attach immediately so early process failures never create an unhandled rejection.
 ready.catch(()=>{});
 const timer=setTimeout(()=>child.kill('SIGKILL'),20000);
 child.stdout.on('data',(part:Buffer)=>{output+=part.toString();if(output.length>4096)child.kill('SIGKILL');if(output.includes('READY\n'))readyResolve();});
 child.stderr.on('data',(part:Buffer)=>{diagnosticBytes+=part.length;if(diagnosticBytes>8192)child.kill('SIGKILL');});
 const done=new Promise<number|null>(resolve=>{
  child.once('error',()=>{readyReject(new Error('Synthetic writer spawn failed'));});
  child.once('close',code=>{clearTimeout(timer);if(!output.includes('READY\n'))readyReject(new Error(`Synthetic writer failed before ready (${code}, ${diagnosticBytes} diagnostic bytes)`));resolve(code);});
 });
 return {ready,done,stop:async()=>{child.kill('SIGKILL');await done;}};
}
async function current(root:string,view:PublicationManifest){
 const ref=view.files.current;
 const body=await readFile(join(root,'.taiko-publications',identity,'objects',ref.sha256));
 assert.equal(createHash('sha256').update(body).digest('hex'),ref.sha256);
 return JSON.parse(body.toString());
}
async function seed(root:string){
 await mkdir(join(root,identity),{recursive:true});
 await writeFile(join(root,identity,'daily-ability-v1-top20.json'),'SYNTHETIC_FROZEN_DAILY');
 await withPublicationLease({root,repoRoot:root,identity,mode:'write'},async lease=>{
  const body=JSON.stringify({profile:{trace:['seed']},songs:[],achievement:{},dojo:{},_meta:{full:true,source:'wahlap'}});
  await lease.put('current',body);await lease.put('history/data_20261016_000000_seed.json',body);await lease.publish();
 });
}
async function assertHistory(root:string,view:PublicationManifest,count:number){
 const keys=Object.keys(view.files).filter(key=>key.startsWith('history/'));
 assert.equal(keys.length,count);
 for(const key of keys){
  const ref=view.files[key],body=await readFile(join(root,'.taiko-publications',identity,'objects',ref.sha256));
  assert.equal(createHash('sha256').update(body).digest('hex'),ref.sha256);
  assert.doesNotThrow(()=>JSON.parse(body.toString()));
 }
 assert.equal(await readFile(join(root,identity,'daily-ability-v1-top20.json'),'utf8'),'SYNTHETIC_FROZEN_DAILY');
}
for(const writer of ['wahlap','hiroba','dispatcher'])test(`installed ${writer} writer waits for Node EX and retains both RMW edits`,{timeout:30000},()=>fixture(async root=>{
 await seed(root);
 const options={root,repoRoot:root,identity,mode:'write' as const};
 const lease=await openPublicationLease(options);
 const child=worker(root,writer);
 try{
  await child.ready;
  const payload=await current(root,lease.view!);payload.profile.trace.push('node');
  const raw=JSON.stringify(payload);await lease.put('current',raw);await lease.put('history/data_20261016_000001_node.json',raw);
  const nonce='a'.repeat(32);const committed=await lease.publish({transactionId:nonce});
  // Restage identical content to retry the same logical request, not an empty request.
  await lease.put('current',raw);await lease.put('history/data_20261016_000001_node.json',raw);
  assert.equal((await lease.publish({transactionId:nonce})).commitId,committed.commitId);
  await lease.close();assert.equal(await child.done,0);
  await withPublicationLease({...options,mode:'read'},async read=>{
   assert.deepEqual((await current(root,read.view!)).profile.trace,['seed','node',writer]);
   assert.equal(read.view!.sequence,3);await assertHistory(root,read.view!,3);
  });
 }finally{await lease.close();await child.stop();}
}));
for(const [fault,expectedExit,changed] of [['intent-durable',77,false],['projection-0',77,false],['commit-durable',77,true],['enospc',1,false]] as const)
 test(`installed dispatcher ${fault} is recovered by Node as a complete generation`,{timeout:30000},()=>fixture(async root=>{
  await seed(root);const child=worker(root,'dispatcher',fault);
  try{
   await child.ready;assert.equal(await child.done,expectedExit);
   await withPublicationLease({root,repoRoot:root,identity,mode:'read'},async read=>{
    assert.deepEqual((await current(root,read.view!)).profile.trace,changed?['seed','dispatcher']:['seed']);
    assert.equal(read.view!.sequence,changed?2:1);await assertHistory(root,read.view!,changed?2:1);
   });
   await assert.rejects(stat(join(root,'.taiko-publications',identity,'pending.json')),{code:'ENOENT'});
  }finally{await child.stop();}
 }));
