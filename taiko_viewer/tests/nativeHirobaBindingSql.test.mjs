import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {manualSqlFixture} from './fixtures/manualSqlRuntime.mjs';
import {bounded} from './fixtures/accountSourceHttp.mjs';
const gate=principal=>'taiko-bind-'+createHash('sha256').update(JSON.stringify(principal)).digest('hex').slice(0,52);
async function fixture(task){return manualSqlFixture(async c=>{
 c.principals=['onebot_v11:9'+String(c.user).padStart(12,'0'),'qq_official:_Abc'+randomUUID().replaceAll('-','')+'_'];
 c.ids=Array.from({length:130},(_,i)=>'8'+String(c.user).padStart(12,'0')+String(i).padStart(3,'0'));c.children=[];
 c.start=request=>{
  const env={PATH:process.env.PATH,PYTHONDONTWRITEBYTECODE:'1',PYTHONPATH:c.config.repoRoot,TAIKO_ALLOW_TEST_DB_MUTATION:'1'};
  for(const key of ['TAIKO_DB_HOST','TAIKO_DB_PORT','TAIKO_DB_USER','TAIKO_DB_PASSWORD','TAIKO_DB_NAME'])env[key]=process.env[key];
  const child=spawn('/usr/bin/python3',[c.config.repoRoot+'/tests/native_hiroba_sql_child.py'],{env,stdio:['pipe','pipe','pipe']});c.children.push(child);
  let announce;const attempted=new Promise(resolve=>announce=resolve);
  const completed=new Promise((resolve,reject)=>{
   let output='',errors=0,announced=false;const timer=setTimeout(()=>child.kill('SIGTERM'),15000);
   child.stdout.on('data',data=>{output+=data;if(output.length>65536)child.kill('SIGTERM');if(!announced&&output.includes('gate-attempt')){announced=true;announce();}});
   child.stderr.on('data',data=>{errors+=data.length;if(errors>8192)child.kill('SIGTERM');});
   child.once('error',()=>{clearTimeout(timer);announce();reject(new Error('Owned Hiroba child unavailable'));});
   child.once('close',code=>{clearTimeout(timer);announce();try{const last=output.trim().split('\n').filter(line=>line&&!line.includes('gate-attempt')).at(-1);resolve({code,result:last?JSON.parse(last):null,errors});}catch{reject(new Error('Owned Hiroba response invalid'));}});
   child.stdin.end(JSON.stringify({root:c.root,...request}));
  });return {attempted,completed};
 };
 c.ask=async request=>{const reply=await c.start(request).completed;assert.equal(reply.code,0,'Owned Hiroba child failed');assert.equal(reply.errors,0,'Owned Hiroba child diagnostics');assert.ok(reply.result);return reply.result;};
 c.rows=async principal=>(await c.pool.execute('SELECT id,visible,slot_index,is_current,source FROM bind WHERE qq=? ORDER BY slot_index,row_id',[principal]))[0];
 c.credentials=async()=>(await c.pool.execute('SELECT taiko_no,email,password_enc,configured_by_qq FROM web_hiroba_credentials WHERE taiko_no IN (?,?) ORDER BY taiko_no',c.ids.slice(0,2)))[0];
 c.seed=async(principal,id,{source='hiroba',slot=1,current=1}={})=>c.pool.execute('INSERT INTO bind(qq,id,visible,slot_index,is_current,source) VALUES (?,?,0,?,?,?)',[principal,id,slot,current,source]);
 c.source=async(id=c.ids[0])=>c.scopeModule.withDomainScoreRead(id,async()=>{
  const scope=c.scopeModule.currentScoreScope(id);let raw=null;try{raw=await scope.reader.readRawCurrent(id);}catch(e){if(e.code!=='ENOENT')throw e;}
  return {raw,publication:scope.lease.view};
 });
 try{await task(c);}finally{
  for(const child of c.children){if(child.exitCode===null&&child.signalCode===null){child.kill('SIGTERM');await bounded(new Promise(resolve=>child.once('close',resolve)));}assert.ok(child.exitCode!==null||child.signalCode!==null);}
  for(const principal of c.principals){await c.pool.execute('DELETE FROM bind WHERE qq=?',[principal]);await c.pool.execute('DELETE FROM taiko_bind_identity_state WHERE identity_key=?',[principal]);}
  for(const id of c.ids)await c.pool.execute('DELETE FROM web_hiroba_credentials WHERE taiko_no=?',[id]);
 }
});}
const bind=(c,extra={})=>c.ask({principal:c.principals[0],ids:[c.ids[1],c.ids[0]],...extra});
const sync=(c,extra={})=>c.ask({principal:c.principals[0],identity:c.ids[1],action:'sync',...extra});

test('native discovery keeps card order/preferred slot and credentials bind in one transaction',{timeout:20000},()=>fixture(async c=>{
 const result=await bind(c);assert.equal(result.ok,true);assert.deepEqual(result.result.taiko_ids,[c.ids[1],c.ids[0]]);assert.deepEqual(result.result.entry.ids,[c.ids[1],c.ids[0]]);assert.equal(result.result.entry.current_index,0);
 assert.equal((await c.credentials()).length,2);assert.ok((await c.credentials()).every(row=>row.configured_by_qq===c.principals[0]&&!row.password_enc.includes('synthetic-password')));
 assert.equal((await c.source(c.ids[1])).raw,null);
}));
test('native target filter and official principal preserve existing manual/u0 metadata correctly',{timeout:20000},()=>fixture(async c=>{
 const principal=c.principals[1];await c.seed(principal,c.taikoId,{source:'manual'});await c.pool.execute('INSERT INTO taiko_bind_identity_state(identity_key,current_virtual) VALUES (?,1)',[principal]);
 const result=await bind(c,{principal,target:c.ids[0]});assert.equal(result.ok,true);assert.deepEqual(result.result.taiko_ids,[c.ids[0]]);assert.deepEqual(result.result.entry.ids,[c.taikoId,c.ids[0]]);assert.equal(result.result.entry.current_index,1);assert.equal(result.result.entry.current_slot,2);
 assert.equal((await c.credentials())[0].configured_by_qq,principal);
}));
for(const fault of ['late-bind','late-credential','before-commit-error','after-commit-error'])test('binding '+fault+' preserves its atomic SQL outcome',{timeout:20000},()=>fixture(async c=>{
 await c.seed(c.principals[0],c.ids[1],{source:'wahlap'});const before=await c.rows(c.principals[0]);
 const result=await bind(c,{fault});assert.equal(result.ok,false);assert.equal(result.reason,'unavailable');assert.ok(!result.message.includes('synthetic-password'));
 if(fault==='after-commit-error'){assert.equal((await c.credentials()).length,2);assert.equal((await c.rows(c.principals[0])).length,2);}
 else{assert.deepEqual(await c.rows(c.principals[0]),before);assert.equal((await c.credentials()).length,0);}
}));
test('over-capacity fails before any credential write',{timeout:20000},()=>fixture(async c=>{
 for(const [i,id] of c.ids.slice(0,128).entries())await c.seed(c.principals[0],id,{source:'wahlap',slot:i+1,current:i===0?1:0});
 const result=await bind(c,{ids:[c.ids[128]]});assert.equal(result.ok,false);assert.equal(result.reason,'denied');assert.equal((await c.rows(c.principals[0])).length,128);
 const [[row]]=await c.pool.execute('SELECT COUNT(*) AS total FROM web_hiroba_credentials WHERE taiko_no=?',[c.ids[128]]);assert.equal(row.total,0);
}));
test('native own synchronization publishes a captured view and renders that exact view',{timeout:20000},()=>fixture(async c=>{
 assert.equal((await bind(c)).ok,true);const result=await sync(c,{image:true});assert.equal(result.ok,true);assert.ok(result.result.image>0);
 const source=await c.source(c.ids[1]);assert.equal(JSON.parse(source.raw).ownedSyntheticUpdate,true);assert.ok(source.publication.sequence>0);
}));
test('foreign credential ownership cannot be borrowed; public fallback has no plaintext login',{timeout:20000},()=>fixture(async c=>{
 await bind(c);await c.pool.execute('UPDATE web_hiroba_credentials SET configured_by_qq=? WHERE taiko_no=?',[c.principals[1],c.ids[1]]);
 assert.equal((await sync(c,{expectOwned:false})).ok,true);
}));
test('own corrupt credential stays actionable and cannot reach upstream',{timeout:20000},()=>fixture(async c=>{
 await bind(c);await c.pool.execute('UPDATE web_hiroba_credentials SET password_enc=? WHERE taiko_no=?',['owned-invalid-cipher',c.ids[1]]);
 const result=await sync(c);assert.equal(result.ok,false);assert.equal(result.reason,'unavailable');assert.ok(result.message.includes('凭据无法读取'));assert.equal(result.upstreamCalled,false);assert.equal((await c.source(c.ids[1])).raw,null);
}));
for(const mode of ['foreign-principal','virtual','wrong-current','wrong-source'])test(mode+' rejects before official sync or publication',{timeout:20000},()=>fixture(async c=>{
 await bind(c);
 if(mode==='virtual')await c.pool.execute('UPDATE taiko_bind_identity_state SET current_virtual=1 WHERE identity_key=?',[c.principals[0]]);
 if(mode==='wrong-source')await c.pool.execute("UPDATE bind SET source='wahlap' WHERE qq=? AND id=?",[c.principals[0],c.ids[1]]);
 const result=await sync(c,mode==='foreign-principal'?{principal:c.principals[1]}:mode==='wrong-current'?{identity:c.ids[0]}:{});
 assert.equal(result.ok,false);assert.equal(result.reason,'denied');assert.equal(result.upstreamCalled,false);assert.equal((await c.source(c.ids[1])).raw,null);
}));
for(const fault of ['late-owner','rollback-error','upstream'])test('sync '+fault+' cannot publish revoked or failed acquisition',{timeout:20000},()=>fixture(async c=>{
 await bind(c);const before=await c.credentials(),result=await sync(c,{fault});assert.equal(result.ok,false);assert.deepEqual(await c.credentials(),before);assert.equal((await c.source(c.ids[1])).raw,null);
}));
for(const fault of ['after-publish-owner','render-owner','render-error'])test(fault+' preserves committed observation and fences response',{timeout:20000},()=>fixture(async c=>{
 await bind(c);const before=await c.credentials(),result=await sync(c,{fault,image:true});
 assert.equal(result.ok,fault==='render-error');if(fault==='render-error')assert.equal(result.result.image,null);
 assert.deepEqual(await c.credentials(),before);assert.equal(JSON.parse((await c.source(c.ids[1])).raw).ownedSyntheticUpdate,true);
}));
for(const fault of ['before-commit-exit','after-commit-exit'])test('real binding '+fault+' closes locks and keeps single atomic outcome',{timeout:20000},()=>fixture(async c=>{
 const result=await c.start({principal:c.principals[0],ids:c.ids.slice(0,2),fault}).completed;
 assert.equal(result.code,fault==='before-commit-exit'?45:46);assert.equal((await c.credentials()).length,fault==='before-commit-exit'?0:2);assert.equal((await c.rows(c.principals[0])).length,fault==='before-commit-exit'?0:2);
 assert.equal((await bind(c)).ok,true);
}));
for(const fault of ['before-publish-exit','after-publish-exit'])test('real sync '+fault+' releases Source and principal leases',{timeout:20000},()=>fixture(async c=>{
 await bind(c);const result=await c.start({principal:c.principals[0],identity:c.ids[1],action:'sync',fault}).completed;
 assert.equal(result.code,fault==='before-publish-exit'?47:48);const source=await c.source(c.ids[1]);assert.equal(source.raw!==null,fault==='after-publish-exit');
 assert.equal((await sync(c)).ok,true);
}));
test('same Node/native principal gate serializes binding before SQL',{timeout:20000},()=>fixture(async c=>{
 const db=await c.pool.getConnection(),name=gate(c.principals[0]);await db.execute('SELECT GET_LOCK(?,0)',[name]);
 const child=c.start({principal:c.principals[0],ids:c.ids.slice(0,2)});
 try{await bounded(child.attempted);const response=await child.completed;assert.equal(response.code,0);assert.equal(response.result.reason,'unavailable');assert.equal((await c.credentials()).length,0);}
 finally{await db.execute('SELECT RELEASE_LOCK(?)',[name]);db.release();}
}));
