import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {botBindingFixture as fixture} from './fixtures/botBindingHttp.mjs';
import {sourceSnapshot,deferred,bounded} from './fixtures/accountSourceHttp.mjs';
const nonce=()=>randomUUID().replaceAll('-',''),exec=promisify(execFile);
const credential=async(c,id,owner=c.principal)=>c.pool.execute('INSERT INTO web_hiroba_credentials(taiko_no,email,password_enc,configured_by_qq) VALUES (?,?,?,?)',[id,'synthetic@example.test','synthetic-cipher',owner]);
const credentials=async(c,id)=>(await c.pool.execute('SELECT taiko_no,configured_by_qq FROM web_hiroba_credentials WHERE taiko_no=?',[id]))[0];

for(const [current,target,expected] of [[0,0,1],[1,1,2],[2,2,1],[1,0,1],[1,2,1]])test('client frozen selection current '+current+' delete '+target,{timeout:20000},()=>fixture(async c=>{
 const ids=[c.taikoId,c.taikoId+'1',c.taikoId+'2'];
 for(const [i,id] of ids.entries())await c.seed(id,{slot:i+1,current:i===current?1:0});
 const result=await c.ask({action:'remove',body:{taikoId:ids[target]}});assert.equal(result.status,200);assert.equal(result.body.currentTaikoId,ids[expected]);
 assert.deepEqual(result.body.bindings.map(row=>row.taikoId),ids.filter((_,i)=>i!==target));
}));

test('whole-principal visibility preserves current/u0 and changes no Source bytes',{timeout:20000},()=>fixture(async c=>{
 await c.seed();await c.seed(c.taikoId+'1',{source:'hiroba',slot:2,current:0});
 await c.ask({action:'current',body:{slot:0}});const before=await sourceSnapshot(c),beforeSql=await c.snapshot();
 const shown=await c.ask({action:'visibility',body:{visible:1}});assert.equal(shown.status,200);assert.deepEqual(shown.body.operation,{kind:'visibility',matched:2});
 assert.equal(shown.body.currentVirtual,true);assert.ok(shown.body.bindings.every(row=>row.visible===1));
 const hidden=await c.ask({action:'visibility',body:{visible:0}});assert.equal(hidden.status,200);assert.equal(hidden.body.currentSlot,0);assert.ok(hidden.body.bindings.every(row=>row.visible===0));
 assert.deepEqual((await c.snapshot()).rows.map(row=>row.is_current),beforeSql.rows.map(row=>row.is_current));assert.deepEqual(await sourceSnapshot(c),before);
}));
test('empty visibility returns zero without creating selection state',{timeout:20000},()=>fixture(async c=>{
 const result=await c.ask({action:'visibility',body:{visible:1}});assert.equal(result.status,200);assert.equal(result.body.found,false);assert.deepEqual(result.body.operation,{kind:'visibility',matched:0});assert.equal((await c.snapshot()).state.length,0);
}));
test('deleting current selects its client successor, renumbers and preserves foreign credentials',{timeout:20000},()=>fixture(async c=>{
 await c.seed(c.taikoId,{current:0});await c.seed(c.taikoId+'1',{source:'hiroba',slot:1001,current:1});await c.seed(c.taikoId+'2',{slot:2001,current:0});
 await credential(c,c.taikoId+'1','qq_official:foreign');const before=await sourceSnapshot(c);
 const result=await c.ask({action:'remove',body:{taikoId:c.taikoId+'1'}});assert.equal(result.status,200);assert.equal(result.body.currentTaikoId,c.taikoId+'2');
 assert.deepEqual(result.body.bindings.map(row=>row.slot),[1,2]);assert.deepEqual(result.body.operation,{kind:'remove',removed:true,needsConfirmation:false,targetTaikoId:c.taikoId+'1'});
 assert.equal((await credentials(c,c.taikoId+'1'))[0].configured_by_qq,'qq_official:foreign');assert.deepEqual(await sourceSnapshot(c),before);
}));
test('owned Hiroba credential deletion is atomic and last binding requires an exact target confirmation',{timeout:20000},()=>fixture(async c=>{
 await c.seed(c.taikoId,{source:'hiroba'});await credential(c,c.taikoId);const before=await c.snapshot(),beforeSource=await sourceSnapshot(c);
 const requestId=nonce(),pending=await c.ask({action:'remove',body:{taikoId:c.taikoId,requestId}});assert.equal(pending.status,200);assert.equal(pending.body.operation.needsConfirmation,true);
 assert.deepEqual((await c.snapshot()).rows,before.rows);assert.equal((await credentials(c,c.taikoId)).length,1);
 assert.equal((await c.ask({action:'remove',body:{taikoId:c.taikoId,requestId,forceLast:true}})).status,409);
 assert.equal((await c.ask({action:'remove',body:{forceLast:true}})).status,400);
 const confirmed=await c.ask({action:'remove',body:{taikoId:c.taikoId,forceLast:true}});assert.equal(confirmed.status,200);assert.equal(confirmed.body.found,false);assert.equal(confirmed.body.operation.removed,true);
 assert.equal((await credentials(c,c.taikoId)).length,0);assert.equal((await c.snapshot()).state.length,0);assert.deepEqual(await sourceSnapshot(c),beforeSource);
}));
test('manual removal stays on dedicated authority and cannot clear any metadata',{timeout:20000},()=>fixture(async c=>{
 await c.seed(c.manualId,{source:'manual'});const before=await c.snapshot();
 assert.equal((await c.ask({action:'remove',body:{taikoId:c.manualId,forceLast:true}})).status,403);assert.deepEqual(await c.snapshot(),before);
}));
test('removing to one clears durable u0 while multiple manual members retain native virtual selection',{timeout:20000},()=>fixture(async c=>{
 await c.seed();await c.seed(c.taikoId+'1',{slot:2,current:0});await c.ask({action:'current',body:{slot:0}});
 assert.equal((await c.ask({action:'remove',body:{taikoId:c.taikoId+'1'}})).body.currentVirtual,false);assert.equal((await c.snapshot()).state[0].current_virtual,0);
 // Native profile accepts manual members; client payload may hide its u0.
 await c.seed(c.manualId,{source:'manual',slot:2,current:0});await c.seed(c.manualId.slice(0,-1)+(c.manualId.endsWith('9')?'8':'9'),{source:'manual',slot:3,current:0});
 const extra=(await c.snapshot()).rows[2].id;
 await c.pool.execute('INSERT INTO taiko_manual_accounts(taiko_id,nickname,bot_identity_key,created_by) VALUES (?,? ,NULL,?)',[extra,'Synthetic second manual','bot']);
 try{await c.pool.execute('UPDATE taiko_bind_identity_state SET current_virtual=1 WHERE identity_key=?',[c.principal]);
  const result=await c.ask({action:'remove',body:{taikoId:c.taikoId}});assert.equal(result.status,200);assert.equal(result.body.currentVirtual,false);assert.equal((await c.snapshot()).state[0].current_virtual,1);
 }finally{await c.pool.execute('DELETE FROM bind WHERE id=? AND qq=?',[extra,c.principal]);await c.pool.execute('DELETE FROM taiko_manual_accounts WHERE taiko_id=?',[extra]);}
}));
for(const action of ['remove','visibility'])test(action+' replay does not overwrite later binding/visibility or delete rebound credentials',{timeout:20000},()=>fixture(async c=>{
 await c.seed(c.taikoId,{source:'hiroba'});await credential(c,c.taikoId);const requestId=nonce(),body=action==='remove'?{taikoId:c.taikoId,forceLast:true,requestId}:{visible:1,requestId};
 assert.equal((await c.ask({action,body})).status,200);
 if(action==='remove'){await c.seed(c.taikoId,{source:'hiroba'});await credential(c,c.taikoId);}
 else await c.pool.execute('UPDATE bind SET visible=0 WHERE qq=?',[c.principal]);
 const before=await c.snapshot(),replay=await c.ask({action,body});assert.equal(replay.status,200);assert.deepEqual(await c.snapshot(),before);
 if(action==='remove')assert.equal((await credentials(c,c.taikoId)).length,1);else assert.equal(replay.body.visible,0);
}));
for(const [label,scope,principalPolicy,sourcePolicy] of [
 ['old bind_write scope','bind_write',true,true],['wrong principal','bind_remove',false,true],['missing Source','bind_remove',true,false],
 ['missing visibility scope','bind_read',true,true]
])test(label+' cannot authorize new mutations',{timeout:20000},()=>fixture(async c=>{
 await c.pool.execute('DELETE FROM web_user_qq_bindings WHERE user_id=?',[c.user]);await c.seed();
 await c.register({scopes:[scope],principals:principalPolicy?[c.principal]:['qq_official:foreign'],sources:sourcePolicy?[c.taikoId]:['unknown']});const before=await c.snapshot();
 const action=label.includes('visibility')?'visibility':'remove',body=action==='remove'?{taikoId:c.taikoId,forceLast:true}:{visible:1};
 assert.equal((await c.ask({action,body,token:c.rawToken,cookie:''})).status,403);assert.deepEqual(await c.snapshot(),before);
}));
test('new explicit service scopes authorize their exact own principal and all members',{timeout:20000},()=>fixture(async c=>{
 await c.pool.execute('DELETE FROM web_user_qq_bindings WHERE user_id=?',[c.user]);await c.seed();await c.register({scopes:['bind_remove','bind_visibility'],sources:[c.taikoId]});
 assert.equal((await c.ask({action:'visibility',body:{visible:1},token:c.rawToken,cookie:''})).status,200);
 assert.equal((await c.ask({action:'remove',body:{taikoId:c.taikoId,forceLast:true},token:c.rawToken,cookie:''})).status,200);
}));
for(const kind of ['session','QQ','SQL','rollback'])test('late '+kind+' failure rolls back both owned credentials and binding',{timeout:20000},()=>fixture(async c=>{
 await c.seed(c.taikoId,{source:'hiroba'});await credential(c,c.taikoId);const before=await c.snapshot();
 c.state.afterSqlStatement=async(sql,args,result,connection)=>{if(sql.startsWith('DELETE FROM bind')){
  if(kind==='session')await connection.execute('UPDATE web_user_sessions SET expires_at=NOW()-INTERVAL 1 SECOND WHERE user_id=?',[c.user]);
  else if(kind==='QQ')await connection.execute("UPDATE web_user_qq_bindings SET status='removed' WHERE user_id=?",[c.user]);
  else throw new Error('/password/hash');
 }};if(kind==='rollback')c.state.failRollback=true;
 const result=await c.ask({action:'remove',body:{taikoId:c.taikoId,forceLast:true}});assert.equal(result.status,kind==='session'?401:kind==='QQ'?403:503);
 c.state.failRollback=false;c.state.afterSqlStatement=null;assert.deepEqual(await c.snapshot(),before);assert.equal((await credentials(c,c.taikoId)).length,1);
 if(kind==='rollback')assert.ok(c.state.discardedConnections>0);
}));
for(const action of ['remove','visibility'])test(action+' lost ACK is proven on a fresh connection using its captured pool',{timeout:20000},()=>fixture(async c=>{
 await c.seed(c.taikoId,{source:'hiroba'});await credential(c,c.taikoId);let once=true;
 c.state.afterSqlCommit=()=>{if(once){once=false;throw new Error('/password/hash');}};
 const result=await c.ask({action,body:action==='remove'?{taikoId:c.taikoId,forceLast:true}:{visible:1}});assert.equal(result.status,200);assert.equal((await c.snapshot()).receipts.length,1);
 if(action==='remove')assert.equal((await credentials(c,c.taikoId)).length,0);else assert.equal(result.body.visible,1);
}));
test('unproved pre-COMMIT failure and corrupted effect never report success or mutate a retry',{timeout:20000},()=>fixture(async c=>{
 await c.seed();const before=await c.snapshot();c.state.beforeSqlCommit=()=>{throw new Error('/password/hash');};
 assert.equal((await c.ask({action:'visibility',body:{visible:1}})).status,503);c.state.beforeSqlCommit=null;assert.deepEqual(await c.snapshot(),before);
 const requestId=nonce();assert.equal((await c.ask({action:'visibility',body:{visible:1,requestId}})).status,200);
 await c.pool.execute('UPDATE taiko_bot_binding_operations SET effect_json=? WHERE operation_id=?',['{"kind":"visibility","matched":99}',requestId]);
 const corrupted=await c.snapshot();assert.equal((await c.ask({action:'visibility',body:{visible:1,requestId}})).status,503);assert.deepEqual(await c.snapshot(),corrupted);
}));
test('queued principal gate rechecks authentication and mutation cannot use stale membership',{timeout:20000},()=>fixture(async c=>{
 await c.seed();const blocker=await c.pool.getConnection(),held=deferred(),name='taiko-bind-'+(await import('../server/infrastructure/account/bot-binding-effect.ts')).bindingHash(c.principal).slice(0,52);
 await blocker.execute('SELECT GET_LOCK(?,0)',[name]);c.state.beforeSqlStatement=sql=>{if(sql.includes('GET_LOCK'))held.resolve();};
 const writing=c.ask({action:'remove',body:{taikoId:c.taikoId,forceLast:true}});writing.catch(()=>{});
 try{await bounded(held.promise);await c.pool.execute('UPDATE web_user_sessions SET expires_at=NOW()-INTERVAL 1 SECOND WHERE user_id=?',[c.user]);await blocker.execute('SELECT RELEASE_LOCK(?)',[name]);
  assert.equal((await writing).status,401);assert.equal((await c.snapshot()).rows.length,1);
 }finally{c.state.beforeSqlStatement=null;await writing.catch(()=>{});await blocker.execute('SELECT RELEASE_LOCK(?)',[name]);blocker.release();}
}));
for(const action of ['remove','visibility'])for(const point of ['before-commit','after-commit'])test('actual '+action+' process death '+point+' preserves atomic receipt and supports nonce retry',{timeout:30000},()=>fixture(async c=>{
 await c.seed(c.taikoId,{source:'hiroba'});await credential(c,c.taikoId);const requestId=nonce(),body=action==='remove'?{forceLast:true}:{visible:1};
 const file=resolve(c.root,'owned-binding-mutation-death.json');await writeFile(file,JSON.stringify({point,action,body,config:c.config,cookie:c.cookie,ip:c.ip,principal:c.principal,taikoId:c.taikoId,requestId}),{mode:0o600});
 await assert.rejects(exec(process.execPath,['--experimental-strip-types',new URL('./fixtures/botBindingSqlDeathChild.mjs',import.meta.url).pathname,file],{cwd:new URL('../',import.meta.url),timeout:15000,maxBuffer:8192}),error=>error.code===73);
 const after=await c.snapshot();assert.equal(after.receipts.length,point==='after-commit'?1:0);
 if(action==='remove'){assert.equal(after.rows.length,point==='after-commit'?0:1);assert.equal((await credentials(c,c.taikoId)).length,point==='after-commit'?0:1);}else assert.equal(after.rows[0].visible,point==='after-commit'?1:0);
 const retried=await c.ask({action,body:{...body,taikoId:c.taikoId,requestId}});assert.equal(retried.status,200);assert.equal((await c.snapshot()).receipts.length,1);
}));
test('real Python SDK and command adapters mutate only center rows and capture exact last confirmation',{timeout:30000},()=>fixture(async c=>{
 await c.pool.execute('DELETE FROM web_user_qq_bindings WHERE user_id=?',[c.user]);await c.register({scopes:['bind_read','bind_remove','bind_visibility']});await c.seed();
 const url=new URL((await c.request('GET','/bot-bind?identityKey='+encodeURIComponent(c.principal),null,'',{authorization:'Bearer '+c.rawToken})).url).origin;
 const child=(input)=>new Promise((resolve,reject)=>{
  // execFile takes no secret command text. Input is private stdin only.
  const {spawn}=requireSpawn;
  const p=spawn('/usr/bin/python3',['/home/sigaer/taiko-bot/tests/binding_mutation_http_child.py'],{env:{PATH:process.env.PATH,PYTHONDONTWRITEBYTECODE:'1',PYTHONPATH:'/home/sigaer/taiko-bot:/var/tmp/taiko-domain-extraction/git-pin-installed'},stdio:['pipe','pipe','pipe']});
  let output='',diagnostic='',diagnosticBytes=0;const timer=setTimeout(()=>p.kill('SIGTERM'),12000);
  p.stdout.on('data',chunk=>{output+=chunk;if(output.length>16384)p.kill('SIGTERM');});p.stderr.on('data',chunk=>{diagnosticBytes+=chunk.length;if(diagnosticBytes>8192)p.kill('SIGTERM');else diagnostic+=chunk.toString();});
  p.on('error',()=>{clearTimeout(timer);reject(new Error('Owned SDK child unavailable'));});p.on('close',async code=>{clearTimeout(timer);
   if(diagnostic)await writeFile(resolve(c.root,'owned-sdk-diagnostic.txt'),diagnostic,{mode:0o600});
   if(code!==0||diagnosticBytes)return reject(new Error('Owned SDK child code '+code+' diagnostic bytes '+diagnosticBytes));
   try{resolve(JSON.parse(output));}catch{reject(new Error('Owned SDK response invalid'));}});
  p.stdin.end(JSON.stringify({baseUrl:url,ownedRoot:c.root,token:c.rawToken,ip:c.ip,principal:c.principal,...input}));
 });
 const requireSpawn=await import('node:child_process');
 const shown=await child({mode:'command',action:'visibility',visible:1});assert.equal(shown.ok,true,JSON.stringify(shown.diagnostic||{status:shown.status}));assert.equal(shown.result.reply,1);
 const pending=await child({mode:'command',action:'remove',target:''});assert.equal(pending.ok,true);assert.equal(pending.result.reply[2],true);assert.equal(pending.result.confirmation.taiko_id,c.taikoId);
 const removed=await child({mode:'command',action:'remove',target:c.taikoId,forceLast:true});assert.equal(removed.ok,true);assert.equal(removed.result.reply[0],true);assert.ok(removed.result.reply[1].includes('已删除最后一个绑定'));
 assert.equal((await c.snapshot()).rows.length,0);
}));
