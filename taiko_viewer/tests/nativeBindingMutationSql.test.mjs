import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {manualSqlFixture} from './fixtures/manualSqlRuntime.mjs';
import {bounded} from './fixtures/accountSourceHttp.mjs';

const gate=principal=>'taiko-bind-'+createHash('sha256').update(JSON.stringify(principal)).digest('hex').slice(0,52);
const unavailable=result=>{assert.equal(result.ok,false);assert.equal(result.reason,'unavailable');assert.equal(result.message,'绑定服务暂不可用，请稍后重试。');};

async function fixture(task){return manualSqlFixture(async c=>{
 c.principals=['onebot_v11:9'+String(c.user).padStart(12,'0'),'qq_official:_Abc'+randomUUID().replaceAll('-','')+'_'];
 c.ids=Array.from({length:130},(_,i)=>'7'+String(c.user).padStart(12,'0')+String(i).padStart(3,'0'));
 c.children=[];
 c.start=request=>{
  const env={PATH:process.env.PATH,PYTHONDONTWRITEBYTECODE:'1',PYTHONPATH:c.config.repoRoot,TAIKO_ALLOW_TEST_DB_MUTATION:'1'};
  for(const key of ['TAIKO_DB_HOST','TAIKO_DB_PORT','TAIKO_DB_USER','TAIKO_DB_PASSWORD','TAIKO_DB_NAME'])env[key]=process.env[key];
  const child=spawn('/usr/bin/python3',[c.config.repoRoot+'/tests/native_binding_mutation_sql_child.py'],{env,stdio:['pipe','pipe','pipe']});c.children.push(child);
  let announce;const attempted=new Promise(resolve=>{announce=resolve;});
  const completed=new Promise((resolve,reject)=>{
   let output='',diagnosticBytes=0,announced=false;
   const timer=setTimeout(()=>{child.kill('SIGTERM');reject(new Error('Owned native mutation deadline'));},15000);
   child.stdout.on('data',data=>{output+=data;if(output.length>65536)child.kill('SIGTERM');
    if(!announced&&output.includes('gate-attempt')){announced=true;announce();}});
   child.stderr.on('data',data=>{diagnosticBytes+=data.length;if(diagnosticBytes>8192)child.kill('SIGTERM');});
   child.on('error',()=>{clearTimeout(timer);announce();reject(new Error('Owned native mutation child unavailable'));});
   child.on('close',code=>{clearTimeout(timer);announce();
    try{const last=output.trim().split('\n').filter(line=>line&&!line.includes('gate-attempt')).at(-1);
     resolve({code,result:last?JSON.parse(last):null,diagnosticBytes});}
    catch{reject(new Error('Owned native mutation response invalid'));}});
   child.stdin.end(JSON.stringify(request));
  });
  return {attempted,completed};
 };
 c.ask=async request=>{const reply=await c.start(request).completed;assert.equal(reply.code,0,'Native mutation child failed');assert.equal(reply.diagnosticBytes,0,'Native mutation leaked diagnostics');assert.ok(reply.result);return reply.result;};
 c.seed=async (principal,rows,virtual=0)=>{
  for(const [i,row] of rows.entries())await c.pool.execute('INSERT INTO bind(qq,id,visible,slot_index,is_current,source) VALUES (?,?,?,?,?,?)',
   [principal,row.id,row.visible??0,row.slot??i+1,row.current??(i===0?1:0),row.source??'wahlap']);
  await c.pool.execute('INSERT INTO taiko_bind_identity_state(identity_key,current_virtual) VALUES (?,?)',[principal,virtual]);
 };
 c.credential=async (id,owner)=>c.pool.execute('INSERT INTO web_hiroba_credentials(taiko_no,email,password_enc,configured_by_qq) VALUES (?,?,?,?)',[id,'synthetic@example.test','synthetic-cipher',owner]);
 c.rows=async principal=>(await c.pool.execute('SELECT id,visible,slot_index,is_current,source FROM bind WHERE qq=? ORDER BY slot_index,row_id',[principal]))[0];
 c.credentials=async id=>(await c.pool.execute('SELECT taiko_no,configured_by_qq FROM web_hiroba_credentials WHERE taiko_no=?',[id]))[0];
 c.virtual=async principal=>(await c.pool.execute('SELECT current_virtual FROM taiko_bind_identity_state WHERE identity_key=?',[principal]))[0][0]?.current_virtual??null;
 c.assertGateFree=async principal=>{
  const db=await c.pool.getConnection();try{const [[lock]]=await db.execute('SELECT GET_LOCK(?,0) AS acquired',[gate(principal)]);assert.equal(lock.acquired,1);
   const [[release]]=await db.execute('SELECT RELEASE_LOCK(?) AS released',[gate(principal)]);assert.equal(release.released,1);}finally{db.release();}
 };
 try{await task(c);}finally{
  for(const child of c.children){if(child.exitCode===null&&child.signalCode===null){child.kill('SIGTERM');await bounded(new Promise(resolve=>child.once('close',resolve)));}assert.ok(child.exitCode!==null||child.signalCode!==null);}
  for(const principal of c.principals){await c.pool.execute('DELETE FROM bind WHERE qq=?',[principal]);await c.pool.execute('DELETE FROM taiko_bind_identity_state WHERE identity_key=?',[principal]);}
  for(const id of c.ids)await c.pool.execute('DELETE FROM web_hiroba_credentials WHERE taiko_no=?',[id]);
 }
});}

test('actual native wrappers keep new/existing binding, hidden visibility and u0 selection',{timeout:25000},()=>fixture(async c=>{
 const principal=c.principals[0],[one,two]=c.ids;
 const first=await c.ask({principal,mode:'command',action:'upsert',value:one,source:'wahlap'});
 assert.equal(first.ok,true);assert.equal(first.result[1],true);assert.ok(first.result[0].startsWith('绑定成功！已设为 u1。'));
 assert.equal((await c.ask({principal,action:'visibility',value:1})).result.matched,1);
 await c.ask({principal,action:'upsert',value:two,source:'hiroba'});
 assert.deepEqual((await c.rows(principal)).map(row=>[row.id,row.visible,row.is_current]),[[one,1,0],[two,0,1]]);
 const current=await c.ask({principal,mode:'command',action:'switch',value:0});
 assert.equal(current.ok,true);assert.ok(current.result[1].startsWith('已切换到 u0：合并账户（只读）'));assert.equal(await c.virtual(principal),1);
 await c.ask({principal,action:'visibility',value:0});assert.equal(await c.virtual(principal),1);
 assert.ok((await c.rows(principal)).every(row=>row.visible===0));
 const existing=await c.ask({principal,mode:'command',action:'upsert',value:one,source:'wahlap'});
 assert.ok(existing.result[0].startsWith('该ID已绑定，已切换到 u1。'));assert.equal(existing.result[1],false);assert.equal(await c.virtual(principal),0);
 assert.deepEqual((await c.rows(principal)).map(row=>row.is_current),[1,0]);
 assert.equal((await c.ask({principal:c.principals[1],action:'visibility',value:1})).result.matched,0);
}));

test('native manual selection profile is preserved while direct manual attach/remove is rejected',{timeout:20000},()=>fixture(async c=>{
 const principal=c.principals[0];
 await c.seed(principal,[{id:c.ids[0]},{id:c.taikoId,source:'manual',current:0}]);
 const selected=await c.ask({principal,action:'switch',value:0});assert.equal(selected.result.entry.current_slot,0);
 assert.equal((await c.ask({principal,action:'remove',value:c.taikoId,forceLast:true})).reason,'manual');
 assert.equal((await c.ask({principal,action:'upsert',value:c.taikoId,source:'wahlap'})).reason,'input');
 assert.equal((await c.rows(principal)).length,2);assert.equal(await c.virtual(principal),1);
}));

test('remove resets single-member u0, densifies gapped slots and preserves a foreign credential',{timeout:20000},()=>fixture(async c=>{
 const principal=c.principals[0],[one,two,three]=c.ids;
 await c.seed(principal,[{id:one,slot:1},{id:two,slot:1001,source:'hiroba',current:0},{id:three,slot:2001,current:0}],1);
 await c.credential(two,c.principals[1]);
 const removed=await c.ask({principal,action:'remove',value:two});assert.equal(removed.result.entry.current_slot,0);
 assert.deepEqual((await c.rows(principal)).map(row=>[row.id,row.slot_index]),[[one,1],[three,2]]);
 assert.equal((await c.credentials(two))[0].configured_by_qq,c.principals[1]);
 await c.ask({principal,action:'remove',value:'u1'});
 assert.equal(await c.virtual(principal),0);assert.deepEqual((await c.rows(principal)).map(row=>[row.id,row.slot_index,row.is_current]),[[three,1,1]]);
 const confirm=await c.ask({principal,mode:'command',action:'remove',value:''});
 assert.equal(confirm.result[2],true);assert.ok(confirm.result[1].startsWith('当前只剩最后 1 个鼓众广场ID：'));assert.equal((await c.rows(principal)).length,1);
 const last=await c.ask({principal,mode:'command',action:'remove',value:three,forceLast:true});
 assert.equal(last.result[0],true);assert.ok(last.result[1].includes('当前已无绑定'));assert.equal(await c.virtual(principal),null);
}));

for(const fault of ['late-error','rollback-error','before-commit-error','after-commit-error','before-commit-exit','after-commit-exit']){
 test('owned credential and binding stay atomic at '+fault,{timeout:20000},()=>fixture(async c=>{
  const principal=c.principals[0],id=c.ids[0];await c.seed(principal,[{id,source:'hiroba'}]);await c.credential(id,principal);
  const reply=await c.start({principal,action:'remove',value:id,forceLast:true,fault}).completed;
  if(fault.endsWith('exit')){assert.equal(reply.code,fault.startsWith('before')?45:46);assert.equal(reply.result,null);}
  else{assert.equal(reply.code,0);unavailable(reply.result);}
  const persisted=fault.startsWith('after');
  assert.equal((await c.rows(principal)).length,persisted?0:1);assert.equal((await c.credentials(id)).length,persisted?0:1);
  assert.equal(await c.virtual(principal),persisted?null:0);await c.assertGateFree(principal);
 }));
}

test('exact official case collision and malformed selection state cannot be overwritten',{timeout:20000},()=>fixture(async c=>{
 const principal=c.principals[1],id=c.ids[0];await c.seed(principal,[{id}]);
 const other=principal.replace('_Abc','_abc');
 unavailable(await c.ask({principal:other,action:'visibility',value:1}));
 unavailable(await c.ask({principal:other,action:'upsert',value:c.ids[1],source:'wahlap'}));
 assert.equal((await c.rows(principal))[0].visible,0);assert.equal(await c.virtual(principal),0);
 await c.pool.execute('UPDATE taiko_bind_identity_state SET current_virtual=3 WHERE identity_key=?',[principal]);
 unavailable(await c.ask({principal,action:'remove',value:id,forceLast:true}));assert.equal((await c.rows(principal)).length,1);
}));

test('center-held JSON principal gate times out native mutation before SQL writes',{timeout:20000},()=>fixture(async c=>{
 const principal=c.principals[0],id=c.ids[0];await c.seed(principal,[{id}]);
 const db=await c.pool.getConnection();
 try{
  const [[acquired]]=await db.execute('SELECT GET_LOCK(?,0) AS acquired',[gate(principal)]);assert.equal(acquired.acquired,1);
  const started=performance.now(),pending=c.start({principal,action:'visibility',value:1});await pending.attempted;
  const reply=await pending.completed;assert.equal(reply.code,0);unavailable(reply.result);assert.ok(performance.now()-started>=4500);
  assert.equal((await c.rows(principal))[0].visible,0);
 }finally{await db.execute('SELECT RELEASE_LOCK(?)',[gate(principal)]);db.release();}
 await c.assertGateFree(principal);
}));

test('upsert finds a free gapped slot and enforces the bounded 128 binding set',{timeout:20000},()=>fixture(async c=>{
 const principal=c.principals[0];await c.seed(principal,[{id:c.ids[0],slot:1},{id:c.ids[1],slot:3,current:0}]);
 assert.equal((await c.ask({principal,action:'upsert',value:c.ids[2],source:'wahlap'})).ok,true);
 assert.deepEqual((await c.rows(principal)).map(row=>row.slot_index),[1,2,3]);
 for(let i=3;i<128;i++)await c.pool.execute("INSERT INTO bind(qq,id,visible,slot_index,is_current,source) VALUES (?,?,0,?,0,'wahlap')",[principal,c.ids[i],i+1]);
 assert.equal((await c.ask({principal,action:'upsert',value:c.ids[128],source:'wahlap'})).reason,'capacity');
 assert.equal((await c.rows(principal)).length,128);
 await c.pool.execute("INSERT INTO bind(qq,id,visible,slot_index,is_current,source) VALUES (?,?,0,129,0,'wahlap')",[principal,c.ids[128]]);
 unavailable(await c.ask({principal,action:'visibility',value:1}));assert.ok((await c.rows(principal)).every(row=>row.visible===0));
}));
