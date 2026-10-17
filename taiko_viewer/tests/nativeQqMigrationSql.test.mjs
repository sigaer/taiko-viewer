import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {manualSqlFixture} from './fixtures/manualSqlRuntime.mjs';
import {bounded} from './fixtures/accountSourceHttp.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const gate=principal=>'taiko-bind-'+hash(JSON.stringify(principal)).slice(0,52);
async function fixture(task){return manualSqlFixture(async c=>{
 c.qq='9'+String(c.user).padStart(12,'0');c.source='onebot_v11:'+c.qq;c.target='qq_official:_Abc'+randomUUID().replaceAll('-','')+'_';c.other='qq_official:Other'+randomUUID().replaceAll('-','');
 c.principals=[c.source,c.qq,c.target,c.other];c.ids=Array.from({length:130},(_,i)=>'7'+String(c.user).padStart(12,'0')+String(i).padStart(3,'0'));c.children=[];
 c.start=request=>{
  const env={PATH:process.env.PATH,PYTHONDONTWRITEBYTECODE:'1',PYTHONPATH:c.config.repoRoot,TAIKO_ALLOW_TEST_DB_MUTATION:'1'};
  for(const key of ['TAIKO_DB_HOST','TAIKO_DB_PORT','TAIKO_DB_USER','TAIKO_DB_PASSWORD','TAIKO_DB_NAME'])env[key]=process.env[key];
  const child=spawn('/usr/bin/python3',[c.config.repoRoot+'/tests/native_qq_migration_sql_child.py'],{env,stdio:['pipe','pipe','pipe']});c.children.push(child);
  let announce;const attempted=new Promise(resolve=>announce=resolve);
  const completed=new Promise((resolve,reject)=>{
   let output='',errors=0,announced=false;const timer=setTimeout(()=>child.kill('SIGTERM'),20000);
   child.stdout.on('data',data=>{output+=data;if(output.length>65536)child.kill('SIGTERM');if(!announced&&output.includes('gate-attempt')){announced=true;announce();}});
   child.stderr.on('data',data=>{errors+=data.length;if(errors>8192)child.kill('SIGTERM');});
   child.once('error',()=>{clearTimeout(timer);announce();reject(new Error('Owned QQ child unavailable'));});
   child.once('close',code=>{clearTimeout(timer);announce();try{const last=output.trim().split('\n').filter(line=>line&&!line.includes('gate-attempt')).at(-1);resolve({code,result:last?JSON.parse(last):null,errors});}catch{reject(new Error('Owned QQ response invalid'));}});
   child.stdin.end(JSON.stringify({root:c.root,qq:c.qq,principal:c.target,...request}));
  });return {attempted,completed};
 };
 c.ask=async request=>{const reply=await c.start(request).completed;assert.equal(reply.code,0,'Owned QQ child failed');assert.equal(reply.errors,0,'Owned QQ child diagnostics');assert.ok(reply.result);return reply.result;};
 c.seed=async(principal,rows,virtual=0)=>{
  for(const [i,row] of rows.entries())await c.pool.execute('INSERT INTO bind(qq,id,visible,slot_index,is_current,source) VALUES(?,?,?,?,?,?)',[principal,row.id,row.visible??1,row.slot??i+1,row.current??(i===0?1:0),row.source??'wahlap']);
  await c.pool.execute('INSERT INTO taiko_bind_identity_state(identity_key,current_virtual) VALUES(?,?)',[principal,virtual]);
 };
 c.rows=async principal=>(await c.pool.execute('SELECT id,visible,slot_index,is_current,source FROM bind WHERE qq=? ORDER BY slot_index,row_id',[principal]))[0];
 c.proof=async()=>(await c.pool.execute('SELECT code_hash,source_hash,target_principal,consumed_at,effect_json,effect_hash FROM taiko_qq_migration_codes WHERE source_principal=?',[c.source]))[0][0]??null;
 c.credential=async(id,owner)=>c.pool.execute('INSERT INTO web_hiroba_credentials(taiko_no,email,password_enc,configured_by_qq) VALUES(?,?,?,?)',[id,'synthetic@example.test','owned-opaque-synthetic-cipher',owner]);
 c.owner=async id=>(await c.pool.execute('SELECT configured_by_qq FROM web_hiroba_credentials WHERE taiko_no=?',[id]))[0][0]?.configured_by_qq;
 c.issue=async()=>{const response=await c.ask({action:'issue',principal:c.source});assert.equal(response.ok,true);return response.result.code;};
 try{await task(c);}finally{
  for(const child of c.children){if(child.exitCode===null&&child.signalCode===null){child.kill('SIGTERM');await bounded(new Promise(resolve=>child.once('close',resolve)));}assert.ok(child.exitCode!==null||child.signalCode!==null);}
  await c.pool.execute('DELETE FROM taiko_qq_migration_codes WHERE source_principal=?',[c.source]);
  for(const principal of c.principals){await c.pool.execute('DELETE FROM bind WHERE qq=?',[principal]);await c.pool.execute('DELETE FROM taiko_bind_identity_state WHERE identity_key=?',[principal]);}
  for(const id of c.ids)await c.pool.execute('DELETE FROM web_hiroba_credentials WHERE taiko_no=?',[id]);
 }
});}

test('private OneBot issue stores only hashes, binds full snapshot and rate limits reissue',{timeout:25000},()=>fixture(async c=>{
 await c.seed(c.source,[{id:c.ids[0]}]);const code=await c.issue();assert.match(code,/^[a-f0-9]{32}$/);
 const proof=await c.proof();assert.equal(proof.code_hash,hash(code));assert.match(proof.source_hash,/^[a-f0-9]{64}$/);assert.equal(proof.target_principal,null);assert.equal(proof.consumed_at,null);
 const second=await c.ask({action:'issue',principal:c.source});assert.equal(second.ok,false);assert.ok(second.message.includes('一分钟'));assert.deepEqual(await c.proof(),proof);
}));
test('actual OneBot sender can normalize its own bare QQ without a code',{timeout:25000},()=>fixture(async c=>{
 await c.seed(c.qq,[{id:c.ids[0]},{id:c.ids[1],current:0}]);const result=await c.ask({principal:c.source});assert.equal(result.ok,true);assert.deepEqual(result.result.entry.ids,c.ids.slice(0,2));assert.equal(await c.proof(),null);
 assert.deepEqual((await c.rows(c.qq)).map(row=>row.id),c.ids.slice(0,2));
}));
test('proven QQ merge preserves source order, explicit current and target visibility',{timeout:25000},()=>fixture(async c=>{
 await c.seed(c.source,[{id:c.ids[0],current:0},{id:c.ids[1],current:1}],1);await c.seed(c.target,[{id:c.ids[2],visible:0},{id:c.ids[0],visible:0,current:0}]);const origin=await c.rows(c.source),code=await c.issue();
 const result=await c.ask({code});assert.equal(result.ok,true);assert.deepEqual(result.result.entry.ids,c.ids.slice(0,3));assert.equal(result.result.entry.current_index,1);assert.equal(result.result.entry.current_slot,2);assert.equal(result.result.first_binding,false);
 assert.ok((await c.rows(c.target)).every(row=>row.visible===0));assert.deepEqual(await c.rows(c.source),origin);assert.equal((await c.proof()).target_principal,c.target);
}));
test('canonical source has frozen precedence over a separate bare legacy row',{timeout:25000},()=>fixture(async c=>{
 await c.seed(c.source,[{id:c.ids[0]}]);await c.seed(c.qq,[{id:c.ids[1]}]);const code=await c.issue();assert.deepEqual((await c.ask({code})).result.entry.ids,[c.ids[0]]);assert.equal((await c.rows(c.qq)).length,1);
}));
for(const mode of ['missing','wrong','expired'])test(mode+' transfer proof cannot mutate target',{timeout:25000},()=>fixture(async c=>{
 await c.seed(c.source,[{id:c.ids[0]}]);await c.seed(c.target,[{id:c.ids[2]}]);const code=await c.issue(),before=await c.rows(c.target);
 if(mode==='expired')await c.pool.execute('UPDATE taiko_qq_migration_codes SET expires_at=UTC_TIMESTAMP()-INTERVAL 1 SECOND WHERE source_principal=?',[c.source]);
 const response=await c.ask({code:mode==='missing'?'':mode==='wrong'?'f'.repeat(32):code});assert.equal(response.ok,false);assert.equal(response.reason,'denied');assert.deepEqual(await c.rows(c.target),before);assert.equal((await c.proof()).consumed_at,null);
}));
for(const field of ['visibility','current','binding'])test('source '+field+' change invalidates exact snapshot proof',{timeout:25000},()=>fixture(async c=>{
 await c.seed(c.source,[{id:c.ids[0]},{id:c.ids[1],current:0}]);const code=await c.issue();
 if(field==='visibility')await c.pool.execute('UPDATE bind SET visible=0 WHERE qq=?',[c.source]);
 if(field==='current'){await c.pool.execute('UPDATE bind SET is_current=0 WHERE qq=?',[c.source]);await c.pool.execute('UPDATE bind SET is_current=1 WHERE qq=? AND id=?',[c.source,c.ids[1]]);}
 if(field==='binding')await c.pool.execute('DELETE FROM bind WHERE qq=? AND id=?',[c.source,c.ids[1]]);
 assert.equal((await c.ask({code})).ok,false);assert.equal((await c.rows(c.target)).length,0);assert.equal((await c.proof()).consumed_at,null);
}));
test('source manual account requires its dedicated ownership lifecycle',{timeout:25000},()=>fixture(async c=>{
 await c.seed(c.source,[{id:c.taikoId,source:'manual'}]);assert.equal((await c.ask({action:'issue',principal:c.source})).ok,false);assert.equal(await c.proof(),null);
}));
test('existing target manual account is preserved and selected source stays real',{timeout:25000},()=>fixture(async c=>{
 await c.seed(c.source,[{id:c.ids[0]}]);await c.seed(c.target,[{id:c.taikoId,source:'manual'}]);const code=await c.issue();const result=await c.ask({code});assert.equal(result.ok,true);assert.deepEqual(result.result.entry.ids,[c.ids[0],c.taikoId]);assert.equal(result.result.entry.sources[c.taikoId],'manual');
}));
test('over-capacity merge fails before code consumption',{timeout:25000},()=>fixture(async c=>{
 await c.seed(c.source,[{id:c.ids[128]}]);await c.seed(c.target,c.ids.slice(0,128).map(id=>({id})));const code=await c.issue();assert.equal((await c.ask({code})).ok,false);assert.equal((await c.rows(c.target)).length,128);assert.equal((await c.proof()).consumed_at,null);
}));
for(const origin of ['canonical','bare'])test(origin+' owned Hiroba credential transfers with binding; foreign owner stays',{timeout:25000},()=>fixture(async c=>{
 const key=origin==='canonical'?c.source:c.qq;await c.seed(key,[{id:c.ids[0],source:'hiroba'},{id:c.ids[1],source:'hiroba',current:0}]);await c.credential(c.ids[0],key);await c.credential(c.ids[1],c.other);const code=await c.issue();assert.equal((await c.ask({code})).ok,true);assert.equal(await c.owner(c.ids[0]),c.target);assert.equal(await c.owner(c.ids[1]),c.other);
}));
for(const fault of ['late-insert','late-credential','late-source','late-code','rollback-error','before-commit-error','after-commit-error'])test(fault+' keeps credential, binding and consumed proof atomic',{timeout:25000},()=>fixture(async c=>{
 await c.seed(c.source,[{id:c.ids[0],source:'hiroba'}]);await c.seed(c.target,[{id:c.ids[1]}]);await c.credential(c.ids[0],c.source);const code=await c.issue(),before=await c.rows(c.target);const result=await c.ask({code,fault});assert.equal(result.ok,false);
 if(fault==='after-commit-error'){assert.equal((await c.rows(c.target)).length,2);assert.equal(await c.owner(c.ids[0]),c.target);assert.ok((await c.proof()).consumed_at);assert.equal((await c.ask({code})).result.replayed,true);}
 else{assert.deepEqual(await c.rows(c.target),before);assert.equal(await c.owner(c.ids[0]),c.source);assert.equal((await c.proof()).consumed_at,null);assert.equal((await c.ask({code})).ok,true);}
}));
for(const fault of ['before-commit-exit','after-commit-exit'])test('real migration '+fault+' recovers one SQL outcome',{timeout:25000},()=>fixture(async c=>{
 await c.seed(c.source,[{id:c.ids[0],source:'hiroba'}]);await c.credential(c.ids[0],c.source);const code=await c.issue();const response=await c.start({code,fault}).completed;assert.equal(response.code,fault==='before-commit-exit'?45:46);
 assert.equal((await c.proof()).consumed_at!==null,fault==='after-commit-exit');assert.equal(await c.owner(c.ids[0]),fault==='after-commit-exit'?c.target:c.source);assert.equal((await c.ask({code})).ok,true);
}));
for(const fault of ['before-commit-exit','after-commit-exit'])test('real code issue '+fault+' never stores plaintext and releases gates',{timeout:25000},()=>fixture(async c=>{
 await c.seed(c.source,[{id:c.ids[0]}]);const response=await c.start({action:'issue',principal:c.source,fault}).completed;assert.equal(response.code,fault==='before-commit-exit'?45:46);const proof=await c.proof();assert.equal(proof!==null,fault==='after-commit-exit');
 if(proof)await c.pool.execute('UPDATE taiko_qq_migration_codes SET issued_at=UTC_TIMESTAMP()-INTERVAL 61 SECOND WHERE source_principal=?',[c.source]);assert.match(await c.issue(),/^[a-f0-9]{32}$/);
}));
test('concurrent consumers can authorize only one distinct target',{timeout:25000},()=>fixture(async c=>{
 await c.seed(c.source,[{id:c.ids[0]}]);const code=await c.issue();const results=await Promise.all([c.ask({code}),c.ask({code,principal:c.other})]);assert.equal(results.filter(r=>r.ok).length,1);assert.equal(results.filter(r=>!r.ok).length,1);assert.equal((await c.rows(c.target)).length+(await c.rows(c.other)).length,1);
}));
test('exact consumed replay never resurrects a removed binding or resets later selection',{timeout:25000},()=>fixture(async c=>{
 await c.seed(c.source,[{id:c.ids[0]},{id:c.ids[1],current:0}]);const code=await c.issue();assert.equal((await c.ask({code})).ok,true);
 await c.pool.execute('DELETE FROM bind WHERE qq=? AND id=?',[c.target,c.ids[0]]);await c.pool.execute('UPDATE bind SET is_current=1 WHERE qq=?',[c.target]);await c.pool.execute('UPDATE taiko_qq_migration_codes SET expires_at=UTC_TIMESTAMP()-INTERVAL 1 SECOND WHERE source_principal=?',[c.source]);
 const reply=await c.ask({code});assert.equal(reply.ok,true);assert.equal(reply.result.replayed,true);assert.deepEqual(reply.result.entry.ids,[c.ids[1]]);assert.equal((await c.rows(c.target)).length,1);
 assert.equal((await c.ask({code,principal:c.other})).ok,false);
}));
test('tampered consumed effect is refused without modifying current binding',{timeout:25000},()=>fixture(async c=>{
 await c.seed(c.source,[{id:c.ids[0]}]);const code=await c.issue();await c.ask({code});const before=await c.rows(c.target);await c.pool.execute('UPDATE taiko_qq_migration_codes SET effect_json=? WHERE source_principal=?',['{}',c.source]);assert.equal((await c.ask({code})).ok,false);assert.deepEqual(await c.rows(c.target),before);
}));
test('case-colliding official identity fails closed before replacing its binding',{timeout:25000},()=>fixture(async c=>{
 await c.seed(c.source,[{id:c.ids[0]}]);await c.seed(c.target.toLowerCase(),[{id:c.ids[1]}]);const code=await c.issue();assert.equal((await c.ask({code})).ok,false);assert.equal((await c.proof()).consumed_at,null);assert.equal((await c.rows(c.target))[0].id,c.ids[1]);
}));
for(const action of ['issue','consume'])test('center-held '+action+' principal gate waits boundedly without partial SQL',{timeout:25000},()=>fixture(async c=>{
 await c.seed(c.source,[{id:c.ids[0]}]);const code=action==='consume'?await c.issue():'';const principal=action==='issue'?c.source:c.target,name=gate(principal),db=await c.pool.getConnection();await db.execute('SELECT GET_LOCK(?,0)',[name]);
 try{const child=c.start(action==='issue'?{action:'issue',principal:c.source}:{code});await bounded(child.attempted);const response=await child.completed;assert.equal(response.code,0);assert.equal(response.result.reason,'unavailable');assert.equal((await c.rows(c.target)).length,0);if(action==='consume')assert.equal((await c.proof()).consumed_at,null);else assert.equal(await c.proof(),null);}
 finally{await db.execute('SELECT RELEASE_LOCK(?)',[name]);db.release();}
}));
