// Actual native Bot issuer/current SQL, full retired gateway, owned resources.
import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {readFile,writeFile,unlink,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {accountSourceFixture as fixture,sourceSnapshot,deferred,bounded} from './fixtures/accountSourceHttp.mjs';
import {openPublicationLease} from '../server/infrastructure/taiko-publication/client.ts';
const nativeFetch=globalThis.fetch;
const center='/home/sigaer/git/Sakura_bot/taiko',token='b'.repeat(48),digest=value=>createHash('sha256').update(value).digest('hex');
async function waitFile(path){const until=performance.now()+8000;for(;;){try{await access(path);return;}catch{}if(performance.now()>until)throw new Error('Owned issuer checkpoint deadline');await new Promise(r=>setTimeout(r,20));}}
async function start(c,options={}){
 for(const name of ['issuer-optimistic.json','issuer-pinned.json','issuer-release.json','issuer-closed.json'])await unlink(resolve(c.root,name)).catch(e=>{if(e.code!=='ENOENT')throw e;});
 const file=resolve(c.root,'issuer-options-'+randomUUID()+'.json');
 await writeFile(file,JSON.stringify({root:c.root,userdataDir:c.config.userdataDir,taikoId:c.taikoId,principal:c.principal,foreignPrincipal:c.foreignPrincipal,...options}),{mode:0o600});
 const child=spawn('/usr/bin/python3',[center+'/tests/token_issuer_sql_child.py',file],{cwd:center,stdio:['pipe','pipe','pipe'],env:{...process.env,PYTHONPATH:center,PYTHONDONTWRITEBYTECODE:'1',TAIKO_ALLOW_TEST_DB_MUTATION:'1'}});
 let output='',error='',timer;const ready=deferred();
 child.stdout.on('data',chunk=>{if(Buffer.byteLength(output)+chunk.length>65536){child.kill('SIGTERM');return;}output+=chunk.toString();if(output.includes('\n')){try{const first=JSON.parse(output.split('\n')[0]);if(first.port)ready.resolve(first.port);}catch{}}});
 child.stderr.on('data',chunk=>{if(Buffer.byteLength(error)<8192)error+=chunk.toString().slice(0,1024);});
 const done=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>{clearTimeout(timer);resolve({code,signal,output,error});});});
 done.catch(()=>{});timer=setTimeout(()=>child.kill('SIGTERM'),15000);
 return {child,done,port:ready.promise,async result(){const result=await done;assert.equal(result.code,0,'Owned native issuer child failed');return JSON.parse(result.output);},async close(){clearTimeout(timer);if(child.exitCode===null){child.stdin.end('\n');let timeout;await Promise.race([done,new Promise(resolve=>{timeout=setTimeout(()=>{child.kill('SIGTERM');resolve();},1500);})]);clearTimeout(timeout);await bounded(done);}assert.equal(child.exitCode===null,false,'Owned issuer process remains');}};
}
async function issuerFixture(task,{official=false}={}){return fixture(async c=>{
 const tag=BigInt('0x'+randomUUID().replaceAll('-','').slice(0,12)).toString();
 c.principal=official?'qq_official:Abc_'+tag:'onebot_v11:'+tag;c.foreignPrincipal='onebot_v11:9'+tag;
 c.oldToken=(await c.tokens.manageViewerScoreToken(c.user,'issue')).token;
 const [binding]=await c.pool.execute("INSERT INTO bind(qq,id,visible,slot_index,is_current,source) VALUES (?,?,0,1,1,'wahlap')",[c.principal,c.taikoId]);c.botRowId=binding.insertId;
 try{await task(c);}finally{
  await c.pool.execute('DELETE FROM bind WHERE qq IN (?,?)',[c.principal,c.foreignPrincipal]);
  await c.pool.execute('DELETE FROM taiko_bind_identity_state WHERE identity_key IN (?,?)',[c.principal,c.foreignPrincipal]);
 }
});}
async function currentToken(c){const [[row]]=await c.pool.query('SELECT id,token_hash,token_mask,last_used_at,created_at,updated_at FROM public_score_tokens WHERE taiko_id=?',[c.taikoId]);return row;}

for(const official of [false,true])test(`actual ${official?'official QQ':'OneBot'} hidden own current issue keeps full frozen 408d2f8 DTO`,{timeout:20000},()=>issuerFixture(async c=>{
 const before=await sourceSnapshot(c),previous=await currentToken(c),run=await start(c,{frozen:true});
 try{const result=await run.result();assert.equal(result.status,200);assert.equal(result.result.owner_identity,c.principal);assert.equal(result.result.token,token);}finally{await run.close();}
 const after=await currentToken(c);assert.equal(after.id,previous.id);assert.equal(after.token_hash,digest(token));assert.equal(after.last_used_at,null);assert.deepEqual(await sourceSnapshot(c),before);
},{official}));

test('native current-owner status and empty revoke keep full frozen token DTO; repeat revoke is idempotent',{timeout:25000},()=>issuerFixture(async c=>{
 const before=await sourceSnapshot(c);
 for(const options of [{action:'status',frozen:true},{action:'revoke'},{action:'revoke',frozen:true}]){
  const run=await start(c,options);try{const result=await run.result();assert.equal(result.status,200);if(options.action==='revoke')assert.equal(result.result.revoked,!options.frozen);}finally{await run.close();}
 }
 assert.equal(await currentToken(c),undefined);assert.deepEqual(await sourceSnapshot(c),before);
}));

for(const principal of [null,'viewer','onebot_v11:foreign','onebot_v11:999'])test(`native ownerless/foreign ${String(principal)} issuer refuses without rotating another token`,{timeout:20000},()=>issuerFixture(async c=>{
 const before=await currentToken(c),source=await sourceSnapshot(c),run=await start(c,{principal});
 try{assert.equal((await run.result()).status,403);}finally{await run.close();}
 assert.deepEqual(await currentToken(c),before);assert.deepEqual(await sourceSnapshot(c),source);
}));

for(const action of ['issue','status','revoke'])test(`native ${action} rejects virtual u0 and manual source before any token mutation`,{timeout:25000},()=>issuerFixture(async c=>{
 const before=await currentToken(c),source=await sourceSnapshot(c);
 await c.pool.execute('INSERT INTO taiko_bind_identity_state(identity_key,current_virtual) VALUES (?,1)',[c.principal]);
 for(const manual of [false,true]){
  if(manual){await c.pool.execute('UPDATE taiko_bind_identity_state SET current_virtual=0 WHERE identity_key=?',[c.principal]);await c.pool.execute("UPDATE bind SET source='manual' WHERE row_id=?",[c.botRowId]);}
  const run=await start(c,{action});try{assert.equal((await run.result()).status,manual?400:403);}finally{await run.close();}
 }
 assert.deepEqual(await currentToken(c),before);assert.deepEqual(await sourceSnapshot(c),source);
}));

test('case-insensitive SQL matches do not grant another official QQ principal',{timeout:20000},()=>issuerFixture(async c=>{
 const run=await start(c,{principal:c.principal.toUpperCase().replace('QQ_OFFICIAL:','qq_official:')});try{assert.equal((await run.result()).status,403);}finally{await run.close();}
 assert.equal((await currentToken(c)).token_hash,digest(c.oldToken));
},{official:true}));

for(const field of ['row_id','qq','id','source','slot_index','is_current','visible','virtual','deleted'])test(`native issuer rejects queued ${field} authority replacement after waiting for Source EX`,{timeout:20000},()=>issuerFixture(async c=>{
 const source=await sourceSnapshot(c),before=await currentToken(c),held=await openPublicationLease({root:c.config.userdataDir,repoRoot:c.config.repoRoot,identity:c.taikoId,mode:'write'});let run;
 try{
  run=await start(c);await waitFile(resolve(c.root,'issuer-optimistic.json'));
  if(field==='deleted')await c.pool.execute('DELETE FROM bind WHERE row_id=?',[c.botRowId]);
  else if(field==='virtual')await c.pool.execute('INSERT INTO taiko_bind_identity_state(identity_key,current_virtual) VALUES (?,1)',[c.principal]);
  else{
   const value={row_id:c.botRowId+1000000000000,qq:c.foreignPrincipal,id:c.taikoId+'1',source:'hiroba',slot_index:2,is_current:0,visible:1}[field];
   await c.pool.execute(`UPDATE bind SET ${field}=? WHERE row_id=?`,[value,c.botRowId]);
  }
  await held.close();assert.equal((await run.result()).status,403);
 }finally{await held.close();await run?.close();}
 assert.deepEqual(await currentToken(c),before);assert.deepEqual(await sourceSnapshot(c),source);
}));

test('native issuer pins current SQL, virtual selection and publication throughout token COMMIT',{timeout:25000},()=>issuerFixture(async c=>{
 await c.pool.execute('INSERT INTO taiko_bind_identity_state(identity_key,current_virtual) VALUES (?,0)',[c.principal]);
 const run=await start(c,{pause:true});let selecting,virtualizing,publishing,selected=false,virtual=false,published=false;
 try{
  await waitFile(resolve(c.root,'issuer-pinned.json'));
  selecting=c.pool.execute('UPDATE bind SET is_current=0 WHERE row_id=?',[c.botRowId]).then(()=>{selected=true;});selecting.catch(()=>{});
  virtualizing=c.pool.execute('UPDATE taiko_bind_identity_state SET current_virtual=1 WHERE identity_key=?',[c.principal]).then(()=>{virtual=true;});virtualizing.catch(()=>{});
  publishing=c.shared.writeUserdataWithHistory(c.taikoId,{profile:{userid:c.taikoId},songs:[]},'wahlap').then(()=>{published=true;});publishing.catch(()=>{});
  await new Promise(r=>setTimeout(r,100));assert.equal(selected,false);assert.equal(virtual,false);assert.equal(published,false);
  await writeFile(resolve(c.root,'issuer-release.json'),'{}');assert.equal((await run.result()).status,200);
  await selecting;await virtualizing;await publishing;
 }finally{await writeFile(resolve(c.root,'issuer-release.json'),'{}');await run.close();await selecting?.catch(()=>{});await virtualizing?.catch(()=>{});await publishing?.catch(()=>{});}
}));

test('native READ COMMITTED issuer materializes missing legacy state and pins u0 insertion until COMMIT',{timeout:25000},()=>issuerFixture(async c=>{
 const [[state]]=await c.pool.query('SELECT identity_key FROM taiko_bind_identity_state WHERE identity_key=?',[c.principal]);assert.equal(state,undefined);
 const run=await start(c,{pause:true,readCommitted:true});let selecting,selected=false;
 try{
  await waitFile(resolve(c.root,'issuer-pinned.json'));
  selecting=c.pool.execute('INSERT INTO taiko_bind_identity_state(identity_key,current_virtual) VALUES (?,1) ON DUPLICATE KEY UPDATE current_virtual=1',[c.principal]).then(()=>{selected=true;});selecting.catch(()=>{});
  await new Promise(r=>setTimeout(r,100));assert.equal(selected,false,'u0 must wait even without an original state row');
  await writeFile(resolve(c.root,'issuer-release.json'),'{}');assert.equal((await run.result()).status,200);await selecting;
  const [[after]]=await c.pool.query('SELECT current_virtual FROM taiko_bind_identity_state WHERE identity_key=?',[c.principal]);assert.equal(after.current_virtual,1);
 }finally{await writeFile(resolve(c.root,'issuer-release.json'),'{}');await run.close();await selecting?.catch(()=>{});}
 const retry=await start(c,{readCommitted:true});try{assert.equal((await retry.result()).status,403);}finally{await retry.close();}
}));

for(const failRollback of [false,true])test(`native late authority failure rolls token mutation back and closes connection (rollback fails ${failRollback})`,{timeout:20000},()=>issuerFixture(async c=>{
 const source=await sourceSnapshot(c),before=await currentToken(c),run=await start(c,{point:'late-proof-failure',failRollback});
 try{const result=await run.result();assert.equal(result.status,503);assert.equal(result.message,'成绩 token 服务暂时不可用，请稍后重试。');}finally{await run.close();}
 assert.equal(JSON.parse(await readFile(resolve(c.root,'issuer-closed.json'),'utf8')).closed,true);assert.deepEqual(await currentToken(c),before);assert.deepEqual(await sourceSnapshot(c),source);
}));

for(const action of ['issue','revoke','status'])test(`native ${action} lost COMMIT acknowledgement is proved by exact outcome and captured caller`,{timeout:20000},()=>issuerFixture(async c=>{
 const source=await sourceSnapshot(c),run=await start(c,{action,point:'lost-ack',replaceFactory:true});
 try{assert.equal((await run.result()).status,200);}finally{await run.close();}
 const row=await currentToken(c);if(action==='revoke')assert.equal(row,undefined);else assert.equal(row.token_hash,digest(action==='issue'?token:c.oldToken));assert.deepEqual(await sourceSnapshot(c),source);
}));

for(const point of ['no-commit-ack','lost-ack-replaced-owner'])test(`native issuer refuses uncertain ${point} without disclosing a token`,{timeout:20000},()=>issuerFixture(async c=>{
 const before=await currentToken(c),run=await start(c,{point});try{const result=await run.result();assert.equal(result.status,503);assert.equal(result.result,undefined);}finally{await run.close();}
 const after=await currentToken(c);if(point==='no-commit-ack')assert.deepEqual(after,before);else assert.equal(after.token_hash,digest(token));
}));

for(const action of ['issue','revoke'])for(const point of ['authority-pinned','before-commit','after-commit'])test(`actual native ${action} death ${point} preserves only its SQL COMMIT and permits fresh retry`,{timeout:25000},()=>issuerFixture(async c=>{
 const source=await sourceSnapshot(c),before=await currentToken(c),run=await start(c,{action,point});
 try{assert.equal((await run.done).code,73);}finally{await run.close();}
 const after=await currentToken(c);if(point!=='after-commit')assert.deepEqual(after,before);else if(action==='revoke')assert.equal(after,undefined);else assert.equal(after.token_hash,digest(token));
 const retry=await start(c,{action});try{assert.equal((await retry.result()).status,200);}finally{await retry.close();}
 assert.deepEqual(await sourceSnapshot(c),source);
}));

test('actual retired gateway rejects all token operations and forged principals without SQL or Source changes',{timeout:25000},()=>issuerFixture(async c=>{
 const source=await sourceSnapshot(c),before=await currentToken(c),run=await start(c,{mode:'gateway'});
 try{
  const port=await bounded(run.port);
  for(const action of ['issue','revoke','status']){
   const response=await nativeFetch(`http://127.0.0.1:${port}/score-token`,{method:'POST',body:JSON.stringify({userid:c.taikoId,action,identityKey:c.principal,userId:c.user}),signal:AbortSignal.timeout(8000)});
   assert.equal(response.status,410);assert.equal((await response.json()).error,'token_management_retired');
  }
 }finally{await run.close();}
 assert.deepEqual(await currentToken(c),before);assert.deepEqual(await sourceSnapshot(c),source);await assert.rejects(access(resolve(c.root,'issuer-optimistic.json')),e=>e.code==='ENOENT');
}));
