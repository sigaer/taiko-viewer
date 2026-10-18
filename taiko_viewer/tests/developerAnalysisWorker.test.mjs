import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {createDeveloperAnalysisWorker} from '../server/services/account/developer-analysis-worker.ts';
import {ANALYSIS_TIMEOUT_MS} from '../server/services/account/developer-analysis-limits.ts';

async function scratch(task){
 const root=await mkdtemp(resolve(process.env.QA_RUN_TMPDIR||process.env.RUNNER_TEMP||tmpdir(),'analysis-worker-'));
 try{await task(root);}finally{await rm(root,{recursive:true,force:true});}
}
const input=(repoRoot,code)=>({repoRoot,code,python:process.env.TAIKO_PYTHON_EXECUTABLE||'/usr/bin/python3',env:{PATH:process.env.PATH},records:[]});
test('worker decodes split UTF-8 output without corrupting song names',{timeout:10000},()=>scratch(async root=>{
 const code="import sys,time; b='{' + chr(34) + 'title' + chr(34) + ':' + chr(34) + '太鼓' + chr(34) + '}'; b=b.encode(); n=b.index('太'.encode())+1; sys.stdout.buffer.write(b[:n]); sys.stdout.buffer.flush(); time.sleep(.05); sys.stdout.buffer.write(b[n:])";
 const result=await createDeveloperAnalysisWorker()(input(root,code));assert.equal(result.title,'太鼓');
}));
test('OS lock rejects a concurrent worker and is reusable after exit',{timeout:10000},()=>scratch(async root=>{
 const execute=createDeveloperAnalysisWorker();
 const first=execute(input(root,"import json,time; from pathlib import Path; Path('ready').touch(); time.sleep(.5); print(json.dumps({'ok':True}))"));
 try{
  let ready=false;
  for(let i=0;i<100;i++){try{await access(resolve(root,'ready'));ready=true;break;}catch{await new Promise(r=>setTimeout(r,20));}}
  assert.ok(ready,'first worker did not start');
  await assert.rejects(execute(input(root,"print('{}')")),error=>error.statusCode===503);
 }finally{await first;}
 assert.deepEqual(await execute(input(root,"print('{}')")),{});
}));
test('timeout keeps admission pending until the killed worker closes',async t=>scratch(async root=>{
 let child,started;const launched=new Promise(r=>{started=r;});
 const execute=createDeveloperAnalysisWorker(()=>{
  child=new EventEmitter();child.stdout=new PassThrough();child.stdin=new PassThrough();child.kill=()=>{child.killed=true;return true;};started();return child;
 });
 t.mock.timers.enable({apis:['setTimeout']});
 const running=execute(input(root,''));let settled=false;running.then(()=>{settled=true;},()=>{settled=true;});
 try{
  await launched;t.mock.timers.tick(ANALYSIS_TIMEOUT_MS+1);
  await new Promise(r=>setImmediate(r));assert.equal(child.killed,true);assert.equal(settled,false);
  child.emit('close',null);await assert.rejects(running,error=>error.statusCode===503);
 }finally{child?.emit('close',null);await running.catch(()=>{});t.mock.timers.reset();}
}));
