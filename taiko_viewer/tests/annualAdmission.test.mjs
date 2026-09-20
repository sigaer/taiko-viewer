import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import {
  AnnualAdmission,
  MAX_CONCURRENT_ANNUAL_BUILDS,
  MAX_CONCURRENT_ANNUAL_RENDERS
} from '../server/services/account/annual-summary/admission.ts';
const base = '/var/tmp/annual-admission-test-';
const wait = ms => new Promise(r => setTimeout(r, ms));
const worker = new URL('./fixtures/annualAdmissionWorker.mjs', import.meta.url);
const child = (root, key, delay = 250) => new Promise((resolve, reject) => {
  const p = spawn(process.execPath, ['--experimental-transform-types', worker.pathname, root, key, String(delay)], {stdio:['ignore','ignore','pipe']});
  let error='';p.stderr.on('data',c=>error=(error+c).slice(-1000));
  p.on('error',reject);p.on('close',c=>c===0?resolve():reject(new Error(error)));
});
test('cross-process global limit, same-card flight, distinct cards FIFO, both domains', {timeout:20000}, async () => {
  const root=await mkdtemp(base);
  try {
    await Promise.all([child(root,'same'),child(root,'same'),child(root,'different')]);
    const rows=(await readFile(root+'/executions','utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(rows.filter(r=>r.phase==='start'&&r.key==='same').length,1);
    let running=0;for(const row of rows){running+=row.phase==='start'?1:-1;assert.ok(running>=0&&running<=1,'global overlap');}assert.equal(running,0);
    const gate=new AnnualAdmission(root,1000,10);
    let active=0,peak=0;
    await Promise.all(['a','b','c'].map(key=>gate.run('generator',key,1000,async()=>{peak=Math.max(peak,++active);await wait(30);active--;return {key};})));
    assert.equal(peak,2);
    assert.equal(MAX_CONCURRENT_ANNUAL_BUILDS,2);
    assert.equal(MAX_CONCURRENT_ANNUAL_RENDERS,1);
  } finally {await rm(root,{recursive:true,force:true});}
});

test('headroom is rechecked before the second generator starts',async()=>{
 const root=await mkdtemp(base);let releaseFirst;try{
 let headroom=true,calls=0;
 const firstBlocked=new Promise(resolve=>{releaseFirst=resolve;});
 const gate=new AnnualAdmission(root,2000,10,1000,async()=>headroom);
 const first=gate.run('generator','first',1000,async()=>{calls++;await firstBlocked;return 1;});
 while(calls===0)await wait(10);
 headroom=false;
 const second=gate.run('generator','second',1000,async()=>{calls++;return 2;});
 await wait(80);assert.equal(calls,1);
 const rows=JSON.parse(await readFile(root+'/generator.json','utf8'));
 assert.equal(rows.filter(row=>row.state==='running').length,1);
 assert.equal(rows.filter(row=>row.state==='queued').length,1);
 releaseFirst();assert.equal(await first,1);
 await wait(30);assert.equal(calls,1);
 headroom=true;assert.equal(await second,2);assert.equal(calls,2);
 }finally{releaseFirst?.();await rm(root,{recursive:true,force:true});}
});
test('dedup before queue cap, explicit rejection, expiration, no runner on timed-out reservation', async()=>{
  const root=await mkdtemp(base);
  try{
    const gate=new AnnualAdmission(root,200,10,1000);
    const first=await gate.reserve('renderer','same');
    for(let i=1;i<8;i++)await gate.reserve('renderer',String(i));
    assert.equal(await gate.reserve('renderer','same'),first);
    await assert.rejects(gate.reserve('renderer','ninth'),{code:'ANNUAL_QUEUE_FULL',statusCode:429});
    await wait(220);
    let called=false;
    await assert.rejects(gate.run('renderer','same',100,async()=>{called=true;},{ticket:first}),{code:'ANNUAL_QUEUE_TIMEOUT'});
    assert.equal(called,false);
    for(let i=0;i<20;i++)await gate.reserve('generator',String(i));
    await assert.rejects(gate.reserve('generator','twenty-first'),{code:'ANNUAL_QUEUE_FULL'});
  }finally{await rm(root,{recursive:true,force:true});}
});
test('one failing render returns same safe error to followers',async()=>{
 const root=await mkdtemp(base);try{
 const gate=new AnnualAdmission(root,1000,10);let calls=0;
 const run=()=>gate.run('renderer','failure',500,async()=>{calls++;await wait(80);throw Object.assign(new Error('private detail'),{statusCode:422,statusMessage:'safe message',code:'TEST_ERROR'});});
 const results=await Promise.allSettled([run(),run()]);assert.equal(calls,1);
 for(const r of results){assert.equal(r.status,'rejected');assert.equal(r.reason.statusCode,422);}
 }finally{await rm(root,{recursive:true,force:true});}
});

test('unstarted DB reservation does not block other ready callers; pressure waits without starting',async()=>{
 const root=await mkdtemp(base);try{
 let headroom=false,calls=0;
 const gate=new AnnualAdmission(root,2000,10,1000,async()=>headroom);
 await gate.reserve('generator','db-insert-not-finished');
 const pending=gate.run('generator','ready',1000,async()=>{calls++;return 42;});
 await wait(80);assert.equal(calls,0);
 const rows=JSON.parse(await readFile(root+'/generator.json','utf8'));assert.equal(rows.filter(r=>r.state==='running').length,0);
 headroom=true;assert.equal(await pending,42);assert.equal(calls,1);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('metadata flock releases after caller crash', {timeout:5000}, async()=>{
 const root=await mkdtemp(base);
 const {withHostFileLock}=await import('../server/services/account/annual-summary/admission.ts');
 const p=spawn(process.execPath,['--experimental-transform-types',new URL('./fixtures/annualAdmissionLockOwner.mjs',import.meta.url).pathname,root+'/crash.lock'],{stdio:['ignore','pipe','ignore']});
 try{
  await new Promise((resolve,reject)=>{p.stdout.once('data',resolve);p.once('error',reject);});
  const exited=new Promise(resolve=>p.once('close',resolve));p.kill('SIGKILL');await exited;
  assert.equal(await withHostFileLock(root+'/crash.lock',async()=>123,1),123);
 }finally{p.kill('SIGKILL');await rm(root,{recursive:true,force:true});}
});

test('aborted DB reservation cannot cancel a joined admin request',async()=>{
 const root=await mkdtemp(base);try{
 const gate=new AnnualAdmission(root,1000,10);
 const normal=await gate.reserve('generator','shared');
 const admin=await gate.reserve('generator','shared');assert.equal(normal,admin);
 await gate.cancel('generator',normal);
 assert.equal(await gate.run('generator','shared',1000,async()=>99,{ticket:admin}),99);
 }finally{await rm(root,{recursive:true,force:true});}
});
