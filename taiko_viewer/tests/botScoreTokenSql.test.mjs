import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID,createHash} from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {botBindingFixture} from './fixtures/botBindingHttp.mjs';
import {sourceSnapshot,deferred,bounded} from './fixtures/accountSourceHttp.mjs';
import {openPublicationLease} from '../server/infrastructure/taiko-publication/client.ts';
import {parseSourceServiceRequest} from '../server/infrastructure/account/source-service-provision.ts';
const digest=value=>createHash('sha256').update(value).digest('hex'),bindingHash=value=>digest(JSON.stringify(value)),exec=promisify(execFile);
const snapshot=async c=>(await c.pool.query('SELECT id,token_hash,token_mask,last_used_at,created_at,updated_at FROM public_score_tokens WHERE taiko_id=?',[c.taikoId]))[0];
async function fixture(task){return botBindingFixture(async c=>{
 c.route('post','/bot-score-token',(await import('../server/api/taiko/proxy/bind/score-token.post.ts')).default);
 c.route('post','/api/taiko/proxy/bind/score-token',(await import('../server/api/taiko/proxy/bind/score-token.post.ts')).default);
 c.state.expectedSourceMode='write';await c.seed();
 c.askToken=async({source=c.taikoId,principal=c.principal,token,cookie=c.cookie}={})=>{
  const r=await c.request('POST','/bot-score-token',{identityKey:principal,taikoId:source},cookie,{'x-forwarded-for':c.ip,...(token?{authorization:'Bearer '+token}:{})});
  const body=await r.json();if(!r.ok)assert.ok(!JSON.stringify(body).includes(c.rawToken)&&!JSON.stringify(body).includes('/private/password'));
  return {status:r.status,body,headers:r.headers};
 };
 await task(c);
});}

test('token scope requires explicit principal policy during provisioning',()=>{
 const body={operationId:'a'.repeat(32),operatorUserId:'1',tokenId:'2',serviceName:'synthetic',status:'active',scopes:['score_token_issue'],sources:['1001']};
 assert.throws(()=>parseSourceServiceRequest(body),error=>error.statusCode===400);
 assert.equal(parseSourceServiceRequest({...body,principals:['onebot_v11:12345']}).principalsJson,'["onebot_v11:12345"]');
});
test('authenticated hidden own current token changes only center token table',{timeout:20000},()=>fixture(async c=>{
 const before=await sourceSnapshot(c),bindings=await c.snapshot();
 const result=await c.askToken();assert.equal(result.status,200);assert.equal(result.body.identityKey,c.principal);assert.equal(result.body.taikoId,c.taikoId);
 assert.equal(result.headers.get('cache-control'),'private, no-store');assert.equal(result.headers.get('vary'),'Authorization, Cookie');
 assert.match(result.body.token,/^[a-f0-9]{48}$/);const [row]=await snapshot(c);assert.ok(row.token_hash===digest(result.body.token),'Token hash mismatch');
 assert.ok(row.token_mask===result.body.token.slice(0,8)+'...'+result.body.token.slice(-8),'Token mask mismatch');assert.equal(row.last_used_at,null);
 assert.deepEqual(await c.snapshot(),bindings);assert.deepEqual(await sourceSnapshot(c),before);assert.equal(c.gate.requests.length,0);
 const next=await c.askToken();assert.equal(next.status,200);assert.ok(digest(next.body.token)!==row.token_hash,'Fresh command did not rotate token');
}));
for(const mode of ['visible-foreign','manual','virtual','missing-web-owner','web-source-changed'])test(mode+' cannot mint private token',{timeout:20000},()=>fixture(async c=>{
 if(mode==='visible-foreign')await c.pool.execute('UPDATE bind SET visible=1 WHERE qq=?',[c.principal]);
 if(mode==='manual')await c.pool.execute("UPDATE bind SET id=?,source='manual' WHERE qq=?",[c.manualId,c.principal]);
 if(mode==='virtual')await c.pool.execute('INSERT INTO taiko_bind_identity_state(identity_key,current_virtual) VALUES (?,1)',[c.principal]);
 if(mode==='missing-web-owner')await c.pool.execute('DELETE FROM web_taiko_bindings WHERE id=?',[c.bindingId]);
 if(mode==='web-source-changed')await c.pool.execute("UPDATE web_taiko_bindings SET source='hiroba' WHERE id=?",[c.bindingId]);
 const before=await snapshot(c);const result=await c.askToken(mode==='visible-foreign'?{principal:'onebot_v11:99999'}:{});
 assert.equal(result.status,403);assert.deepEqual(await snapshot(c),before);
}));
for(const scope of ['bind_read','bind_write','source_read'])test('old '+scope+' service scope cannot mint token',{timeout:20000},()=>fixture(async c=>{
 await c.pool.execute('DELETE FROM web_user_qq_bindings WHERE user_id=?',[c.user]);await c.register({scopes:[scope]});
 assert.equal((await c.askToken({token:c.rawToken,cookie:''})).status,403);assert.equal((await snapshot(c)).length,0);
}));
test('explicit service token scope proves principal and all bound sources',{timeout:20000},()=>fixture(async c=>{
 await c.pool.execute('DELETE FROM web_user_qq_bindings WHERE user_id=?',[c.user]);await c.seed(c.taikoId+'1',{slot:2,current:0});
 await c.register({scopes:['score_token_issue'],sources:[c.taikoId]});assert.equal((await c.askToken({token:c.rawToken,cookie:''})).status,403);
 await c.register({scopes:['score_token_issue'],principals:['qq_official:foreign']});assert.equal((await c.askToken({token:c.rawToken,cookie:''})).status,403);
 await c.register({scopes:['score_token_issue'],sources:[c.taikoId,c.taikoId+'1']});assert.equal((await c.askToken({token:c.rawToken,cookie:''})).status,200);
}));
for(const kind of ['session','QQ','binding','SQL','rollback','lease'])test('late '+kind+' failure retains previous token and binding',{timeout:20000},()=>fixture(async c=>{
 assert.equal((await c.askToken()).status,200);const before=await snapshot(c),bindings=await c.snapshot();
 c.state.afterSqlStatement=async(sql,args,result,db)=>{if(sql.startsWith('INSERT INTO public_score_tokens')){
  if(kind==='session')await db.execute('UPDATE web_user_sessions SET expires_at=NOW()-INTERVAL 1 SECOND WHERE user_id=?',[c.user]);
  else if(kind==='QQ')await db.execute("UPDATE web_user_qq_bindings SET status='removed' WHERE user_id=?",[c.user]);
  else if(kind==='binding')await db.execute('UPDATE bind SET visible=1 WHERE qq=?',[c.principal]);
  else if(kind==='lease')await c.scopeModule.currentScoreScope(c.taikoId).lease.close();
  else throw new Error('/private/password');
 }};
 if(kind==='rollback')c.state.failRollback=true;
 const result=await c.askToken();assert.equal(result.status,kind==='session'?401:kind==='QQ'||kind==='binding'?403:503);
 c.state.afterSqlStatement=null;c.state.failRollback=false;
 assert.deepEqual(await snapshot(c),before);assert.deepEqual(await c.snapshot(),bindings);
 if(kind==='rollback')assert.ok(c.state.discardedConnections>0);
}));
for(const point of ['lost-ack','no-commit'])test(point+' acknowledges only exact committed token',{timeout:20000},()=>fixture(async c=>{
 assert.equal((await c.askToken()).status,200);const before=await snapshot(c);let once=true;
 if(point==='lost-ack')c.state.afterSqlCommit=()=>{if(once){once=false;throw new Error('/private/password');}};
 else c.state.beforeSqlCommit=()=>{if(once){once=false;throw new Error('/private/password');}};
 const result=await c.askToken();assert.equal(result.status,point==='lost-ack'?200:503);
 if(point==='lost-ack')assert.ok((await snapshot(c))[0].token_hash===digest(result.body.token),'Unknown token outcome');
 else assert.deepEqual(await snapshot(c),before);
}));
test('waiting for Source EX rechecks full current binding',{timeout:20000},()=>fixture(async c=>{
 const held=await openPublicationLease({root:c.config.userdataDir,repoRoot:c.config.repoRoot,identity:c.taikoId,mode:'write'}),ready=deferred();
 c.state.afterExecute=sql=>{if(sql.includes('FROM web_taiko_bindings'))ready.resolve();};
 const pending=c.askToken();pending.catch(()=>{});
 try{await bounded(ready.promise);await c.pool.execute('UPDATE bind SET visible=1 WHERE qq=?',[c.principal]);await held.close();assert.equal((await pending).status,403);assert.equal((await snapshot(c)).length,0);}
 finally{await held.close();await pending.catch(()=>{});c.state.afterExecute=null;}
}));
test('lost ACK retains the captured pool after runtime replacement',{timeout:20000},()=>fixture(async c=>{
 const runtime=globalThis.__goalSqlRuntime,paths=globalThis.useRuntimeConfig;let once=true;
 c.state.afterSqlCommit=()=>{if(once){once=false;globalThis.__goalSqlRuntime={...runtime,db:{getConnection(){throw new Error('Unexpected replacement pool');}}};globalThis.useRuntimeConfig=()=>({...c.config,userdataDir:resolve(c.root,'unused-replacement')});throw new Error('/private/password');}};
 try{const result=await c.askToken();assert.equal(result.status,200);assert.ok((await snapshot(c))[0].token_hash===digest(result.body.token),'Captured token outcome mismatch');}
 finally{globalThis.__goalSqlRuntime=runtime;globalThis.useRuntimeConfig=paths;c.state.afterSqlCommit=null;}
}));
test('queued principal gate rechecks actor after Source EX',{timeout:20000},()=>fixture(async c=>{
 const db=await c.pool.getConnection(),name='taiko-bind-'+bindingHash(c.principal).slice(0,52),ready=deferred();
 await db.execute('SELECT GET_LOCK(?,0)',[name]);c.state.beforeSqlStatement=sql=>{if(sql.includes('GET_LOCK'))ready.resolve();};
 const pending=c.askToken();pending.catch(()=>{});
 try{await bounded(ready.promise);await c.pool.execute('UPDATE web_user_sessions SET expires_at=NOW()-INTERVAL 1 SECOND WHERE user_id=?',[c.user]);await db.execute('SELECT RELEASE_LOCK(?)',[name]);assert.equal((await pending).status,401);assert.equal((await snapshot(c)).length,0);}
 finally{c.state.beforeSqlStatement=null;await pending.catch(()=>{});await db.execute('SELECT RELEASE_LOCK(?)',[name]);db.release();}
}));
for(const point of ['before-commit','after-commit'])test('real issuer process death '+point+' preserves exactly its committed SQL',{timeout:30000},()=>fixture(async c=>{
 assert.equal((await c.askToken()).status,200);const before=await snapshot(c),source=await sourceSnapshot(c);
 const file=resolve(c.root,'owned-token-process-death.json');await writeFile(file,JSON.stringify({point,action:'score-token',config:c.config,cookie:c.cookie,ip:c.ip,principal:c.principal,taikoId:c.taikoId}),{mode:0o600});
 await assert.rejects(exec(process.execPath,['--experimental-strip-types',new URL('./fixtures/botBindingSqlDeathChild.mjs',import.meta.url).pathname,file],{cwd:new URL('../',import.meta.url),timeout:15000,maxBuffer:8192}),error=>error.code===73);
 const after=await snapshot(c);if(point==='before-commit')assert.deepEqual(after,before);else assert.ok(after[0].token_hash!==before[0].token_hash,'Post-COMMIT death lost token');
 assert.deepEqual(await sourceSnapshot(c),source);assert.equal((await c.askToken()).status,200);
}));
test('actual Python SDK mints only center-owned token with guarded private stdin',{timeout:20000},()=>fixture(async c=>{
 await c.pool.execute('DELETE FROM web_user_qq_bindings WHERE user_id=?',[c.user]);await c.register({scopes:['score_token_issue']});
 const origin=new URL((await c.request('GET','/missing',null,'')).url).origin;
 const p=spawn('/usr/bin/python3',['/home/sigaer/taiko-bot/tests/binding_mutation_http_child.py'],{env:{PATH:process.env.PATH,PYTHONDONTWRITEBYTECODE:'1',PYTHONPATH:'/home/sigaer/taiko-bot:/var/tmp/taiko-domain-extraction/git-pin-installed'},stdio:['pipe','pipe','pipe']});
 let output='',errors=0;const timer=setTimeout(()=>p.kill('SIGTERM'),12000);
 p.stdout.on('data',chunk=>{output+=chunk;if(output.length>16384)p.kill('SIGTERM');});p.stderr.on('data',chunk=>{errors+=chunk.length;if(errors>8192)p.kill('SIGTERM');});
 const done=new Promise((resolve,reject)=>{p.on('error',reject);p.on('close',code=>{clearTimeout(timer);resolve(code);});});
 try{
  p.stdin.end(JSON.stringify({baseUrl:origin,ownedRoot:c.root,token:c.rawToken,ip:c.ip,principal:c.principal,taikoId:c.taikoId,action:'score-token'}));
  assert.equal(await done,0,'Owned SDK process failed');assert.equal(errors,0,'Owned SDK stderr');
  const reply=JSON.parse(output);assert.equal(reply.ok,true,'Owned SDK operation failed');assert.equal(reply.result.owner_identity,c.principal);
  assert.ok((await snapshot(c))[0].token_hash===digest(reply.result.token),'SDK and center token mismatch');
 }finally{clearTimeout(timer);if(p.exitCode===null){p.kill('SIGTERM');await done;}assert.notEqual(p.exitCode,null,'Owned SDK child remains');}
}));
