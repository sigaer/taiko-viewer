import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {manualSqlFixture} from './fixtures/manualSqlRuntime.mjs';
import {bounded} from './fixtures/accountSourceHttp.mjs';
import {openPublicationLease} from '../server/infrastructure/taiko-publication/client.ts';
const gate=principal=>'taiko-bind-'+createHash('sha256').update(JSON.stringify(principal)).digest('hex').slice(0,52);
async function fixture(task){return manualSqlFixture(async c=>{
 c.principal='qq_official:Owned_'+randomUUID().replaceAll('-','');c.other='onebot_v11:9'+String(c.user).padStart(12,'0');c.ids=['6'+String(c.user).padStart(12,'0'),'6'+String(c.user).padStart(12,'0')+'1'];c.children=[];
 c.start=extra=>{
  const env={PATH:process.env.PATH,PYTHONDONTWRITEBYTECODE:'1',PYTHONPATH:c.config.repoRoot,TAIKO_ALLOW_TEST_DB_MUTATION:'1'};
  for(const key of ['TAIKO_DB_HOST','TAIKO_DB_PORT','TAIKO_DB_USER','TAIKO_DB_PASSWORD','TAIKO_DB_NAME'])env[key]=process.env[key];
  const child=spawn('/usr/bin/python3',[c.config.repoRoot+'/tests/native_wahlap_sql_child.py'],{cwd:c.config.repoRoot,env,stdio:['pipe','pipe','pipe']});c.children.push(child);
  let announce,announceCapture;const attempted=new Promise(resolve=>announce=resolve),captured=new Promise(resolve=>announceCapture=resolve);
  const completed=new Promise((resolve,reject)=>{
   let output='',errors=0,diagnostic='',announced=false,captureAnnounced=false;const timer=setTimeout(()=>child.kill('SIGTERM'),20000);
   child.stdout.on('data',data=>{output+=data;if(output.length>65536)child.kill('SIGTERM');if(!announced&&output.includes('gate-attempt')){announced=true;announce();}if(!captureAnnounced&&output.includes('capture-complete')){captureAnnounced=true;announceCapture();}});
   child.stderr.on('data',data=>{errors+=data.length;if(diagnostic.length<8192)diagnostic+=data;if(errors>8192)child.kill('SIGTERM');});child.once('error',()=>{clearTimeout(timer);announce();reject(new Error('Owned native update unavailable'));});
   child.once('close',code=>{clearTimeout(timer);announce();announceCapture();try{const last=output.trim().split('\n').filter(line=>line&&!line.includes('gate-attempt')&&!line.includes('capture-complete')).at(-1);const sites=diagnostic.split('\n').filter(line=>line.trim().startsWith('File ')).slice(-5);resolve({code,result:last?JSON.parse(last):null,errors,sites});}catch{reject(new Error('Owned update response invalid'));}});
   child.stdin.end(JSON.stringify({root:c.root,principal:c.principal,identity:c.ids[0],...extra}));
  });return {attempted,captured,completed};
 };
 c.ask=async extra=>{const value=await c.start(extra).completed;assert.equal(value.code,0,'Owned update child failed');assert.equal(value.errors,0,JSON.stringify(value.sites));assert.ok(value.result);return value.result;};
 c.seed=async({principal=c.principal,id=c.ids[0],source='wahlap',current=1,slot=1}={})=>c.pool.execute('INSERT INTO bind(qq,id,visible,slot_index,is_current,source) VALUES(?,?,0,?,?,?)',[principal,id,slot,current,source]);
 c.rows=async()=>(await c.pool.execute('SELECT row_id,qq,id,visible,slot_index,is_current,source FROM bind WHERE qq=? ORDER BY slot_index,row_id',[c.principal]))[0];
 c.source=async()=>c.scopeModule.withDomainScoreRead(c.ids[0],async()=>{
  const scope=c.scopeModule.currentScoreScope(c.ids[0]);let raw=null;try{raw=await scope.reader.readRawCurrent(c.ids[0]);}catch(error){if(error.code!=='ENOENT')throw error;}
  return {raw,publication:scope.lease.view};
 });
 try{await task(c);}finally{
  for(const child of c.children){if(child.exitCode===null&&child.signalCode===null){child.kill('SIGTERM');await bounded(new Promise(resolve=>child.once('close',resolve)));}assert.ok(child.exitCode!==null||child.signalCode!==null);}
  for(const principal of [c.principal,c.other]){await c.pool.execute('DELETE FROM bind WHERE qq=?',[principal]);await c.pool.execute('DELETE FROM taiko_bind_identity_state WHERE identity_key=?',[principal]);}
 }
});}

test('own hidden current uses real getUserData/common writer and captured view rendering',{timeout:30000},()=>fixture(async c=>{
 await c.seed();const before=await c.rows();const result=await c.ask({showAll:true});assert.equal(result.ok,true);assert.equal(result.result.ok,true);assert.ok(result.result.image>0);assert.equal(result.upstreamCalls,4);
 const first=await c.source();assert.equal(JSON.parse(first.raw).profile.userid,c.ids[0]);assert.equal(JSON.parse(first.raw)._meta.source,'wahlap');assert.ok(first.publication.sequence>0);
 assert.equal((await c.ask({image:false})).result.image,null);assert.ok((await c.source()).publication.sequence>first.publication.sequence);assert.deepEqual(await c.rows(),before);
}));
test('matching profile preserves frozen current and full/delta history raw bytes',{timeout:30000},()=>fixture(async c=>{
 await c.seed();const oldRoot=join(c.root,'frozen');await mkdir(oldRoot,{mode:0o700});
 let hashes,oldHashes;
 for(let i=0;i<2;i++){const now=await c.ask({image:false,hashes:true}),old=await c.ask({root:oldRoot,frozen:true,image:false,hashes:true});
  assert.equal(now.result.ok,true);assert.equal(old.result.ok,true);hashes=now.hashes;oldHashes=old.hashes;}
 assert.equal(hashes.current,oldHashes.current);
 const ordered=value=>Object.entries(value.history).sort(([a],[b])=>a.localeCompare(b)).map(([name,digest])=>[name.replace(/[a-f0-9]{32}\.json$/,'{nonce}.json'),digest]);
 assert.deepEqual(ordered(hashes),ordered(oldHashes));assert.equal(Object.keys(hashes.history).length,2);
}));
for(const mode of ['foreign','virtual','wrong-current','wrong-source','manual'])test(mode+' denies before source acquisition',{timeout:30000},()=>fixture(async c=>{
 await c.seed({source:mode==='wrong-source'?'hiroba':'wahlap'});
 if(mode==='virtual')await c.pool.execute('INSERT INTO taiko_bind_identity_state(identity_key,current_virtual) VALUES(?,1)',[c.principal]);
 if(mode==='wrong-current'){await c.pool.execute('UPDATE bind SET is_current=0 WHERE qq=?',[c.principal]);await c.seed({id:c.ids[1],slot:2});}
 const result=await c.ask(mode==='foreign'?{principal:c.other}:mode==='manual'?{identity:c.taikoId}:{});
 assert.equal(result.ok,false);assert.equal(result.reason,'denied');assert.equal(result.upstreamCalls,0);assert.equal((await c.source()).raw,null);
}));
for(const fault of ['before-publish-owner','rollback-error','upstream-error','wrong-profile'])test(fault+' cannot publish failed or revoked acquisition',{timeout:30000},()=>fixture(async c=>{
 await c.seed();const before=await c.rows(),result=await c.ask({fault});assert.equal(result.ok,false);assert.equal((await c.source()).raw,null);assert.deepEqual(await c.rows(),before);assert.ok(!result.message.includes('Private'));
}));
for(const [fault,message] of [['upstream-status','更新失败，怎么回事呢？'],['not-found','请确认绑定鼓众ID是否正确？']])test(fault+' retains the frozen product failure copy',{timeout:30000},()=>fixture(async c=>{
 await c.seed();const result=await c.ask({fault});assert.equal(result.ok,true);assert.equal(result.result.ok,false);assert.equal(result.result.message,message);assert.equal((await c.source()).raw,null);
}));
for(const fault of ['after-publish-owner','render-owner','render-error','oversize-image','before-commit-error','after-commit-error'])test(fault+' preserves observation and fences response',{timeout:30000},()=>fixture(async c=>{
 await c.seed();const before=await c.rows(),result=await c.ask({fault});assert.equal(result.ok,['render-error','oversize-image'].includes(fault));
 if(result.ok){assert.equal(result.result.ok,true);assert.equal(result.result.image,null);}
 assert.equal(JSON.parse((await c.source()).raw).profile.userid,c.ids[0]);assert.deepEqual(await c.rows(),before);
}));
for(const [fault,exit] of [['before-publish-exit',47],['after-publish-exit',48],['before-commit-exit',45],['after-commit-exit',46]])test('real '+fault+' releases all leases and keeps committed observation',{timeout:30000},()=>fixture(async c=>{
 await c.seed();const result=await c.start({fault}).completed;assert.equal(result.code,exit);assert.equal((await c.source()).raw!==null,fault!=='before-publish-exit');assert.equal((await c.ask({})).result.ok,true);
}));
test('Node-held same principal gate rejects before upstream with bounded wait',{timeout:30000},()=>fixture(async c=>{
 await c.seed();const db=await c.pool.getConnection(),name=gate(c.principal);await db.execute('SELECT GET_LOCK(?,0)',[name]);
 try{const child=c.start({});await bounded(child.attempted);const result=await child.completed;assert.equal(result.code,0);assert.equal(result.result.reason,'unavailable');assert.equal(result.result.upstreamCalls,0);assert.equal((await c.source()).raw,null);}
 finally{await db.execute('SELECT RELEASE_LOCK(?)',[name]);db.release();}
}));
for(const field of ['visible','row-id','source','virtual'])test('Source queue '+field+' replacement rejects stale captured ownership',{timeout:30000},()=>fixture(async c=>{
 await c.seed();const held=await openPublicationLease({root:c.config.userdataDir,repoRoot:c.config.repoRoot,identity:c.ids[0],mode:'write'});
 const child=c.start({});
 try{await bounded(child.captured);
  if(field==='visible')await c.pool.execute('UPDATE bind SET visible=1 WHERE qq=?',[c.principal]);
  if(field==='row-id'){await c.pool.execute('DELETE FROM bind WHERE qq=?',[c.principal]);await c.seed();}
  if(field==='source')await c.pool.execute("UPDATE bind SET source='hiroba' WHERE qq=?",[c.principal]);
  if(field==='virtual')await c.pool.execute('INSERT INTO taiko_bind_identity_state(identity_key,current_virtual) VALUES(?,1)',[c.principal]);
  await held.close();const result=await child.completed;assert.equal(result.code,0);assert.equal(result.result.reason,'denied');assert.equal(result.result.upstreamCalls,0);assert.equal((await c.source()).raw,null);
 }finally{await held.close();await child.completed.catch(()=>{});}
}));
