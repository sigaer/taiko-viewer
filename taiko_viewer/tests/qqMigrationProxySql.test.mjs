import {fileURLToPath} from 'node:url';
const installedFixture=fileURLToPath(new URL('./fixtures/installed-workers/qq_migration_private_fixture.py',import.meta.url));
import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {botBindingFixture} from './fixtures/botBindingHttp.mjs';
import {bounded} from './fixtures/accountSourceHttp.mjs';
const CLIENT='/home/sigaer/taiko-bot';
async function fixture(task){return botBindingFixture(async c=>{
 c.origin=c.principal;c.target='qq_official:Target_'+randomUUID().replaceAll('-','');c.keys.push(c.qq,c.target);c.children=[];c.fault=null;c.launchCount=0;
 const runtime=globalThis.__goalSqlRuntime;
 runtime.qqMigrationLaunch=(executable,args,options)=>{
  assert.equal(executable,(process.env.TAIKO_PYTHON_EXECUTABLE || '/usr/bin/python3'));assert.deepEqual(args,['-I','-m','taiko_bot.cli.qq_migration_cli']);c.launchCount++;
  const env={...options.env,QA_RUN_DIR:process.env.QA_RUN_DIR,QA_RUN_TMPDIR:process.env.QA_RUN_TMPDIR,TAIKO_RUNTIME_ROOT:c.root,TAIKO_CENTER_ROOT:c.root,TAIKO_OFFLINE_ROOT:c.root,TAIKO_ALLOW_TEST_DB_MUTATION:'1',TAIKO_QQ_TEST_ROOT:c.root,TAIKO_QQ_TEST_FAULT:c.fault||''};
  const child=spawn(executable,['-I',installedFixture],{...options,env});c.children.push(child);
  let diagnostics='';child.stderr.on('data',data=>{if(diagnostics.length<8192)diagnostics+=data;});
  child.once('close',exit=>{c.lastWorker={exit};try{c.lastWorker.diagnostic=JSON.parse(diagnostics).ownedDiagnostic;}catch{c.lastWorker.diagnostic=diagnostics.split('\n').filter(line=>line.trim().startsWith('File ')).slice(-3);}});
  c.onLaunch?.();return child;
 };
 c.route('post','/api/taiko/proxy/bind/qq-code',(await import('../server/api/taiko/proxy/bind/qq-code.post.ts')).default);
 c.route('post','/api/taiko/proxy/bind/qq-migrate',(await import('../server/api/taiko/proxy/bind/qq-migrate.post.ts')).default);
 await c.register({scopes:['bind_migrate','bind_read'],principals:[c.origin,c.target]});
 c.askQq=async({action='migrate',principal=action==='issue'?c.origin:c.target,code='',qq=c.qq,token=c.rawToken,cookie=c.cookie}={})=>{
  const response=await c.request('POST','/api/taiko/proxy/bind/'+(action==='issue'?'qq-code':'qq-migrate'),{identityKey:principal,...(action==='migrate'?{qq,code}:{})},cookie,{'x-forwarded-for':c.ip,...(token?{authorization:'Bearer '+token}:{})});
  const body=await response.json();if(!response.ok)assert.ok(!JSON.stringify(body).includes('/password/')&&!JSON.stringify(body).includes(c.rawToken));
  return {status:response.status,body,cache:response.headers.get('cache-control'),vary:response.headers.get('vary')};
 };
 c.issue=async()=>{const result=await c.askQq({action:'issue'});assert.equal(result.status,200,JSON.stringify({launches:c.launchCount,worker:c.lastWorker}));return result.body.code;};
 c.rows=async key=>(await c.pool.execute('SELECT id,visible,slot_index,is_current,source FROM bind WHERE qq=? ORDER BY slot_index,row_id',[key]))[0];
 c.proof=async()=>(await c.pool.execute('SELECT code_hash,source_hash,target_principal,consumed_at,effect_json,effect_hash FROM taiko_qq_migration_codes WHERE source_principal=?',[c.origin]))[0][0]??null;
 c.sdk=async(request={})=>{
  const env={PATH:process.env.PATH,PYTHONDONTWRITEBYTECODE:'1',PYTHONPATH:CLIENT+':/var/tmp/taiko-domain-extraction/git-pin-installed'};
  const child=spawn('/usr/bin/python3',[CLIENT+'/tests/binding_mutation_http_child.py'],{env,stdio:['pipe','pipe','pipe']});c.children.push(child);
  return new Promise((resolve,reject)=>{
   let output='',errors=0;const timer=setTimeout(()=>child.kill('SIGTERM'),30000);
   child.stdout.on('data',data=>{output+=data;if(output.length>65536)child.kill('SIGTERM');});child.stderr.on('data',data=>{errors+=data.length;if(errors>8192)child.kill('SIGTERM');});
   child.once('error',()=>{clearTimeout(timer);reject(new Error('Owned QQ SDK unavailable'));});child.once('close',code=>{clearTimeout(timer);try{assert.equal(code,0);assert.equal(errors,0);resolve(JSON.parse(output));}catch{reject(new Error('Owned QQ SDK response failed'));}});
   child.stdin.end(JSON.stringify({baseUrl:c.baseUrl,token:c.rawToken,ip:c.ip,ownedRoot:c.root,action:'qq-migrate',qq:c.qq,principal:c.target,...request}));
  });
 };
 try{await task(c);}finally{
  for(const child of c.children){if(child.exitCode===null&&child.signalCode===null){child.kill('SIGTERM');await bounded(new Promise(resolve=>child.once('close',resolve)));}assert.ok(child.exitCode!==null||child.signalCode!==null);}
  delete runtime.qqMigrationLaunch;await c.pool.execute('DELETE FROM taiko_qq_migration_codes WHERE source_principal=?',[c.origin]);
 }
});}

test('actual service issue and migration use shared Python SQL transaction with private responses',{timeout:30000},()=>fixture(async c=>{
 await c.seed();await c.seed(c.taikoId+'1',{slot:2,current:0});const before=await c.rows(c.origin),code=await c.issue();
 const result=await c.askQq({code});assert.equal(result.status,200);assert.equal(result.body.identityKey,c.target);assert.deepEqual(result.body.bindings.map(row=>row.taikoId),[c.taikoId,c.taikoId+'1']);assert.deepEqual(await c.rows(c.origin),before);
 assert.equal((await c.proof()).target_principal,c.target);assert.equal(result.cache,'private, no-store');assert.equal(result.vary,'Authorization, Cookie');
}));
test('actual Python SDK and command adapter reach owned center without local binding IO',{timeout:40000},()=>fixture(async c=>{
 await c.seed();const issued=await c.sdk({action:'qq-code',principal:c.origin});assert.equal(issued.ok,true);const code=issued.result.code;
 const migrated=await c.sdk({code});assert.equal(migrated.ok,true);assert.deepEqual(migrated.result.ids,[c.taikoId]);
 const repeated=await c.sdk({code,mode:'command'});assert.equal(repeated.ok,true);assert.ok(repeated.result.reply[1].includes('完成迁移'));
}));
for(const mode of ['scope','principal','null-principals','sources','actor'])test(mode+' capability rejects without target mutation',{timeout:30000},()=>fixture(async c=>{
 await c.seed();const code=await c.issue();
 if(mode==='scope')await c.register({scopes:['bind_read'],principals:[c.target]});
 if(mode==='principal')await c.register({scopes:['bind_migrate'],principals:[c.origin]});
 if(mode==='null-principals')await c.register({scopes:['bind_migrate'],principals:null});
 if(mode==='sources')await c.register({scopes:['bind_migrate'],principals:[c.target],sources:[c.taikoId+'2']});
 if(mode==='actor')await c.pool.execute("UPDATE web_developer_tokens SET status='revoked' WHERE id=?",[c.tokenId]);
 const response=await c.askQq({code});assert.equal(response.status,mode==='actor'?401:403);assert.equal((await c.rows(c.target)).length,0);assert.equal((await c.proof()).consumed_at,null);
}));
test('ordinary verified QQ session may issue; official target still needs service subject',{timeout:30000},()=>fixture(async c=>{
 await c.seed();const issue=await c.askQq({action:'issue',token:null});assert.equal(issue.status,200);
 const result=await c.askQq({code:issue.body.code,token:null});assert.equal(result.status,403);assert.equal((await c.proof()).consumed_at,null);
}));
test('ordinary session self migration uses exact QQ authority and atomic bare fallback',{timeout:30000},()=>fixture(async c=>{
 await c.seed(c.taikoId,{key:c.qq});const result=await c.askQq({principal:c.origin,token:null});assert.equal(result.status,200);assert.equal(result.body.currentTaikoId,c.taikoId);assert.equal(await c.proof(),null);
}));
for(const fault of ['late-grant','late-actor','late-insert','rollback-error','before-commit-error','after-commit-error','before-commit-exit','after-commit-exit','signal-expiry'])test('private task '+fault+' preserves one SQL outcome',{timeout:35000},()=>fixture(async c=>{
 await c.seed(c.taikoId,{source:'hiroba'});await c.pool.execute('INSERT INTO web_hiroba_credentials(taiko_no,email,password_enc,configured_by_qq) VALUES(?,?,?,?)',[c.taikoId,'synthetic@test.test','opaque-synthetic',c.origin]);const code=await c.issue();c.fault=fault;
 const result=await c.askQq({code});assert.equal(result.status,fault==='late-grant'?403:fault==='late-actor'?401:503);c.fault=null;
 const persisted=fault.startsWith('after-commit');assert.equal((await c.rows(c.target)).length,persisted?1:0);assert.equal((await c.proof()).consumed_at!==null,persisted);
 const [[credential]]=await c.pool.execute('SELECT configured_by_qq FROM web_hiroba_credentials WHERE taiko_no=?',[c.taikoId]);assert.equal(credential.configured_by_qq,persisted?c.target:c.origin);
 const retry=await c.askQq({code});assert.equal(retry.status,200);assert.equal(retry.body.operation.replayed,persisted);
}));
test('late ordinary QQ revocation cannot issue or consume a code',{timeout:30000},()=>fixture(async c=>{
 await c.seed();c.fault='late-QQ';const result=await c.askQq({action:'issue',token:null});assert.equal(result.status,403);assert.equal(await c.proof(),null);
 const [[qq]]=await c.pool.execute('SELECT status FROM web_user_qq_bindings WHERE user_id=?',[c.user]);assert.equal(qq.status,'active');
}));
test('exact HTTP retry preserves later deletion and virtual selection',{timeout:30000},()=>fixture(async c=>{
 await c.seed();await c.seed(c.taikoId+'1',{slot:2,current:0});const code=await c.issue();await c.askQq({code});
 await c.pool.execute('UPDATE taiko_bind_identity_state SET current_virtual=1 WHERE identity_key=?',[c.target]);
 const virtual=await c.askQq({code});assert.equal(virtual.status,200);assert.equal(virtual.body.currentSlot,0);assert.equal(virtual.body.currentVirtual,true);
 await c.pool.execute('DELETE FROM bind WHERE qq=? AND id=?',[c.target,c.taikoId]);await c.pool.execute('UPDATE bind SET is_current=1 WHERE qq=?',[c.target]);
 const result=await c.askQq({code});assert.equal(result.status,200);assert.equal(result.body.operation.replayed,true);assert.deepEqual(result.body.bindings.map(row=>row.taikoId),[c.taikoId+'1']);
}));
test('source capability must cover existing target members too',{timeout:30000},()=>fixture(async c=>{
 await c.seed();await c.seed(c.taikoId+'1',{key:c.target});const code=await c.issue();await c.register({scopes:['bind_migrate'],principals:[c.target],sources:[c.taikoId]});
 const result=await c.askQq({code});assert.equal(result.status,403);assert.equal((await c.rows(c.target))[0].id,c.taikoId+'1');assert.equal((await c.proof()).consumed_at,null);
}));
test('source allowlist normalization preserves an unsorted valid service policy',{timeout:30000},()=>fixture(async c=>{
 await c.seed();await c.seed(c.taikoId+'1',{slot:2,current:0});await c.register({scopes:['bind_migrate'],principals:[c.origin,c.target],sources:[c.taikoId+'1',c.taikoId]});
 const code=await c.issue();assert.equal((await c.askQq({code})).status,200);
}));
test('captured SQL host/pool survive runtime replacement while task runs',{timeout:30000},()=>fixture(async c=>{
 await c.seed();const code=await c.issue(),runtime=globalThis.__goalSqlRuntime,config=globalThis.useRuntimeConfig;
 c.onLaunch=()=>{globalThis.__goalSqlRuntime={...runtime,db:{execute(){throw new Error('Replaced pool used');}}};globalThis.useRuntimeConfig=()=>({repoRoot:'/var/tmp/invalid-replacement'});};
 try{assert.equal((await c.askQq({code})).status,200);}finally{globalThis.__goalSqlRuntime=runtime;globalThis.useRuntimeConfig=config;c.onLaunch=null;}
}));
