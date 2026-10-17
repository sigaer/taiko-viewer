// Actual cookie login, developer quota, route, canonical SH and guarded _test SQL.
import assert from 'node:assert/strict';
import test from 'node:test';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {accountSourceFixture,sourceSnapshot,deferred,bounded,replaceIdentity} from './fixtures/accountSourceHttp.mjs';
import {openPublicationLease} from '../server/infrastructure/taiko-publication/client.ts';
import {provisionSourceService,parseSourceServiceRequest} from '../server/infrastructure/account/source-service-provision.ts';
const nonce=()=>randomUUID().replaceAll('-','');
async function fixture(task,options={}){
 return accountSourceFixture(async c=>{
  let operatorCreated=false,operator;
  const ip='fd00:'+nonce().slice(0,4)+':'+nonce().slice(0,4)+'::1';
  try{
   const [[existing]]=await c.pool.query('SELECT id,email FROM web_user_accounts WHERE username=?',['sigaer']);
   if(existing){assert.equal(existing.email,'1106865024@qq.com','Existing test operator must match complete identity');operator=existing.id;}
   else{const [created]=await c.pool.execute('INSERT INTO web_user_accounts(username,email,password_hash) VALUES (?,?,?)',['sigaer','1106865024@qq.com','synthetic-no-login']);operator=created.insertId;operatorCreated=true;}
   c.operator=operator;c.operatorCreated=operatorCreated;
   c.rawToken=randomBytes(12).toString('hex');
   const [token]=await c.pool.execute('INSERT INTO web_developer_tokens(user_id,token_hash,token_mask) VALUES (?,?,?)',[c.user,createHash('sha256').update(c.rawToken).digest('hex'),'synthetic-mask']);c.tokenId=String(token.insertId);
   c.grantInput=overrides=>({operationId:nonce(),operatorUserId:String(operator),tokenId:c.tokenId,serviceName:'synthetic-center',status:'active',scopes:['source_read'],sources:[c.taikoId],...overrides});
   c.register=overrides=>provisionSourceService(c.pool,c.grantInput(overrides),{apply:true});
   const endpoint=(await import('../server/api/developer/userdata/[userid].get.ts')).default;
   c.route('get','/userdata/:userid',endpoint);
   c.ask=async({source=c.taikoId,token,cookie=c.cookie,header}={})=>{
    const response=await c.request('GET','/userdata/'+encodeURIComponent(source),null,cookie,{'x-forwarded-for':ip,...(token!==undefined?{authorization:'Bearer '+token}:{}),...(header!==undefined?{authorization:header}:{})});
    const body=await response.json();if(!response.ok){const text=JSON.stringify(body);assert.ok(!text.includes(c.rawToken)&&!text.includes('/password/hash')&&!text.includes('token_hash'),'Private diagnostics leaked');}
    return {status:response.status,body,headers:response.headers};
   };
   c.grants=async()=>{const [rows]=await c.pool.query('SELECT * FROM taiko_source_service_grants WHERE developer_token_id=?',[c.tokenId]);return rows;};
   c.audit=async()=>{const [rows]=await c.pool.query('SELECT * FROM taiko_source_service_grant_audit WHERE developer_token_id=?',[c.tokenId]);return rows;};
   await task(c);
  }finally{
   c.state.afterExecute=null;
   await c.pool.execute('DELETE FROM web_taiko_open_api_daily_usage WHERE ip_address=?',[ip]);
   await c.pool.execute('DELETE FROM taiko_source_service_grant_audit WHERE operator_user_id=? AND developer_token_id=?',[operator,c.tokenId||'0']);
   if(operatorCreated)await c.pool.execute('DELETE FROM web_user_accounts WHERE id=?',[operator]);
  }
 },{withDeveloper:true,...options});
}
async function queued(c,operation,change){
 const held=await openPublicationLease({root:c.config.userdataDir,repoRoot:c.config.repoRoot,identity:c.taikoId,mode:'write'}),observed=deferred();
 let checks=0;c.state.afterExecute=sql=>{if(!c.scopeModule.currentScoreScope()&&sql.includes('FROM web_taiko_bindings')&&++checks===2)observed.resolve();};
 const pending=operation();pending.catch(()=>{});
 try{await bounded(observed.promise);await new Promise(resolve=>setImmediate(resolve));await change();await held.close();return await pending;}
 finally{await held.close();await pending.catch(()=>{});c.state.afterExecute=null;}
}

test('formal developer route denies anonymous raw Source access even while quota is available',{timeout:20000},()=>fixture(async c=>{
 const before=await sourceSnapshot(c),result=await c.ask({cookie:''});assert.equal(result.status,401);
 assert.ok(Number(result.headers.get('x-taiko-api-remaining'))>0);assert.deepEqual(await sourceSnapshot(c),before);
}));
test('real cookie reads own hidden/noncurrent binding and preserves unknown raw fields',{timeout:20000},()=>fixture(async c=>{
 const data={profile:{userid:c.taikoId},songs:[{song_no:7,level:4,high_score:123,unknownScore:{abc:1}}],unknownTop:{nested:[1,2]}};
 await c.shared.writeUserdataWithHistory(c.taikoId,data,'wahlap');await c.pool.execute('UPDATE web_taiko_bindings SET is_current=0 WHERE id=?',[c.bindingId]);
 const before=await sourceSnapshot(c),result=await c.ask();assert.equal(result.status,200);assert.deepEqual(result.body,JSON.parse(before.raw.current));assert.deepEqual(await sourceSnapshot(c),before);
}));
test('live ordinary developer token reads its owner binding without service grant',{timeout:20000},()=>fixture(async c=>{
 const result=await c.ask({token:c.rawToken,cookie:''});assert.equal(result.status,200);assert.equal(result.body.profile.userid,c.taikoId);
 assert.equal((await c.grants()).length,0);const [[token]]=await c.pool.query('SELECT last_used_at FROM web_developer_tokens WHERE id=?',[c.tokenId]);assert.ok(token.last_used_at);
}));
test('quota-approved token and HTTP owner fields grant no foreign Source access',{timeout:20000},()=>fixture(async c=>{
 await c.pool.execute('DELETE FROM web_taiko_bindings WHERE id=?',[c.bindingId]);
 assert.equal((await c.ask({token:c.rawToken,cookie:''})).status,403);assert.equal((await c.ask()).status,403);
 assert.equal((await c.grants()).length,0);
}));
test('explicit per-token Source policy permits center raw reads with identical DTO',{timeout:20000},()=>fixture(async c=>{
 await c.pool.execute('DELETE FROM web_taiko_bindings WHERE id=?',[c.bindingId]);const before=await sourceSnapshot(c);await c.register();
 const result=await c.ask({token:c.rawToken,cookie:''});assert.equal(result.status,200);assert.deepEqual(result.body,JSON.parse(before.raw.current));assert.deepEqual(await sourceSnapshot(c),before);
 assert.equal((await c.audit()).length,1);
}));
test('Source allowlist and scope are independently required; no broad default',{timeout:20000},()=>fixture(async c=>{
 await c.pool.execute('DELETE FROM web_taiko_bindings WHERE id=?',[c.bindingId]);
 await c.register({sources:[c.taikoId+'x']});assert.equal((await c.ask({token:c.rawToken,cookie:''})).status,403);
 await c.register({scopes:['history_read']});assert.equal((await c.ask({token:c.rawToken,cookie:''})).status,403);
 await c.register({sources:'*'});assert.equal((await c.ask({token:c.rawToken,cookie:''})).status,200);
}));
test('service policy never elevates cookie or another token belonging to the same user',{timeout:20000},()=>fixture(async c=>{
 await c.pool.execute('DELETE FROM web_taiko_bindings WHERE id=?',[c.bindingId]);await c.register({sources:'*'});
 assert.equal((await c.ask()).status,403);const other=randomBytes(12).toString('hex');
 await c.pool.execute('INSERT INTO web_developer_tokens(user_id,token_hash,token_mask) VALUES (?,?,?)',[c.user,createHash('sha256').update(other).digest('hex'),'another-mask']);
 assert.equal((await c.ask({token:other,cookie:''})).status,403);
}));
for(const [name,sql,value] of [
 ['revoked service',"UPDATE taiko_source_service_grants SET status='revoked' WHERE developer_token_id=?",null],
 ['expired service',"UPDATE taiko_source_service_grants SET expires_at=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE developer_token_id=?",null],
 ['mismatched principal','UPDATE taiko_source_service_grants SET developer_user_id=? WHERE developer_token_id=?','foreign'],
 ['invalid persisted policy',"UPDATE taiko_source_service_grants SET scopes_json='[\"unknown\"]' WHERE developer_token_id=?",null]
])test(name+' cannot expose a foreign snapshot',{timeout:20000},()=>fixture(async c=>{
 await c.pool.execute('DELETE FROM web_taiko_bindings WHERE id=?',[c.bindingId]);await c.register();
 await c.pool.execute(sql,value?[c.user+100,c.tokenId]:[c.tokenId]);assert.equal((await c.ask({token:c.rawToken,cookie:''})).status,value||name.includes('invalid')?503:403);
}));
for(const [name,change] of [
 ['revoked token',c=>c.pool.execute("UPDATE web_developer_tokens SET status='revoked',revoked_at=NOW() WHERE id=?",[c.tokenId])],
 ['inconsistent revoked_at',c=>c.pool.execute('UPDATE web_developer_tokens SET revoked_at=NOW() WHERE id=?',[c.tokenId])],
 ['rotated token',c=>c.pool.execute('UPDATE web_developer_tokens SET token_hash=? WHERE id=?',[createHash('sha256').update('replacement').digest('hex'),c.tokenId])]
])test(name+' denies owner and registered service reads',{timeout:20000},()=>fixture(async c=>{
 await c.register({sources:'*'});await change(c);assert.equal((await c.ask({token:c.rawToken})).status,401);
}));
test('invalid Authorization never falls back to a valid cookie',{timeout:20000},()=>fixture(async c=>{
 for(const header of ['Basic private','Bearer wrong','Bearer '+randomBytes(12).toString('hex')])assert.equal((await c.ask({header})).status,401);
 assert.equal((await c.ask()).status,200);
}));
for(const field of ['id','source','manual_account_id','taiko_id'])test('waiting SH detects full owner binding '+field+' change',{timeout:20000},()=>fixture(async c=>{
 const result=await queued(c,()=>c.ask(),()=>replaceIdentity(c,field));assert.equal(result.status,403);
}));
test('waiting SH detects deleted session after its optimistic checks',{timeout:20000},()=>fixture(async c=>{
 const result=await queued(c,()=>c.ask(),()=>c.pool.execute('DELETE FROM web_user_sessions WHERE user_id=?',[c.user]));assert.equal(result.status,401);
}));
test('waiting SH detects token revocation after its optimistic checks',{timeout:20000},()=>fixture(async c=>{
 const result=await queued(c,()=>c.ask({token:c.rawToken,cookie:''}),()=>c.pool.execute("UPDATE web_developer_tokens SET status='revoked' WHERE id=?",[c.tokenId]));assert.equal(result.status,401);
}));
for(const [name,mutate,expected] of [
 ['session expiry',c=>c.pool.execute('UPDATE web_user_sessions SET expires_at=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE user_id=?',[c.user]),401],
 ['binding source',c=>replaceIdentity(c,'source'),403],
 ['service revision',c=>c.pool.execute('UPDATE taiko_source_service_grants SET revision_nonce=? WHERE developer_token_id=?',[nonce(),c.tokenId]),403],
 ['service scope',c=>c.pool.execute("UPDATE taiko_source_service_grants SET scopes_json='[\"history_read\"]' WHERE developer_token_id=?",[c.tokenId]),403],
 ['service source',c=>c.pool.execute('UPDATE taiko_source_service_grants SET sources_json=? WHERE developer_token_id=?',[JSON.stringify([c.taikoId+'x']),c.tokenId]),403]
])test('return-time proof detects '+name+' changed after entry proof SQL',{timeout:20000},()=>fixture(async c=>{
 const service=name.startsWith('service');if(service)await c.register();let changed=false;
 c.state.afterExecute=async sql=>{if(!changed&&c.scopeModule.currentScoreScope()?.mode==='read'&&sql.includes(service?'FROM taiko_source_service_grants':'FROM web_taiko_bindings')){changed=true;await mutate(c);}};
 assert.equal((await c.ask(service?{token:c.rawToken,cookie:''}:{})).status,expected);assert.equal(changed,true);
}));
test('captured pool remains authoritative after globals change while waiting',{timeout:20000},()=>fixture(async c=>{
 const runtime=globalThis.__goalSqlRuntime,original=runtime.db;
 try{const result=await queued(c,()=>c.ask(),async()=>{runtime.db={execute(){throw new Error('Wrong pool /password/hash');}};});assert.equal(result.status,200);}
 finally{runtime.db=original;}
}));
test('source root and kernel cwd are captured before the first actor SQL query',{timeout:20000},()=>fixture(async c=>{
 const before=await sourceSnapshot(c),original={userdataDir:c.config.userdataDir,repoRoot:c.config.repoRoot};let changed=false;
 c.state.afterExecute=sql=>{if(!changed&&sql.includes('FROM web_user_sessions')){changed=true;c.config.userdataDir=resolve(c.root,'wrong-source');c.config.repoRoot=resolve(c.root,'missing-kernel');}};
 try{const result=await c.ask();assert.equal(result.status,200);assert.deepEqual(result.body,JSON.parse(before.raw.current));assert.equal(changed,true);}
 finally{Object.assign(c.config,original);c.state.afterExecute=null;}
 assert.deepEqual(await sourceSnapshot(c),before);
}));
test('lost SH worker during entry proof fails closed and releases its kernel lock',{timeout:20000},()=>fixture(async c=>{
 let closed=false;c.state.afterExecute=async sql=>{const scope=c.scopeModule.currentScoreScope();if(!closed&&scope?.mode==='read'&&sql.includes('FROM web_taiko_bindings')){closed=true;await scope.lease.close();}};
 assert.equal((await c.ask()).status,503);assert.equal(closed,true);c.state.afterExecute=null;
 assert.equal((await c.ask()).status,200);
}));
test('deleted manual SQL authority denies service access before outbox source cleanup',{timeout:20000},()=>fixture(async c=>{
 await c.register({sources:'*'});const before=await sourceSnapshot(c);await c.pool.execute('DELETE FROM taiko_manual_accounts WHERE taiko_id=?',[c.taikoId]);
 assert.equal((await c.ask({token:c.rawToken,cookie:''})).status,403);assert.deepEqual(await sourceSnapshot(c),before);
},{manual:true}));
test('canonical read survives projection removal but rejects corrupted managed content',{timeout:20000},()=>fixture(async c=>{
 const before=await sourceSnapshot(c),projection=resolve(c.config.userdataDir,c.taikoId+'data.json');await unlink(projection);
 assert.deepEqual((await c.ask()).body,JSON.parse(before.raw.current));
 const directory=resolve(c.config.userdataDir,'.taiko-publications',c.taikoId),manifest=JSON.parse(await readFile(resolve(directory,'committed.json'),'utf8'));
 const entry=Object.values(manifest.files)[0];await writeFile(resolve(directory,'objects',entry.sha256),'corrupted');assert.equal((await c.ask()).status,503);
}));
test('driver errors from credential and quota SQL have fixed private-safe responses',{timeout:20000},()=>fixture(async c=>{
 for(const marker of ['FROM web_user_sessions','web_taiko_open_api_daily_usage']){
  c.state.afterExecute=sql=>{if(sql.includes(marker))throw Object.assign(new Error('Private /password/hash'),{sql,code:'ER_PRIVATE'});};
  assert.equal((await c.ask()).status,503);
 }
}));
test('Source identifier traversal is rejected without opening a Source lease',{timeout:20000},()=>fixture(async c=>{
 assert.equal((await c.ask({source:'invalid.id'})).status,400);assert.equal((await c.ask({source:'invalid/id'})).status,400);
 assert.equal(c.scopeModule.currentScoreScope(),undefined);
}));
test('quota still limits authorized reads independently of source grants',{timeout:20000},()=>fixture(async c=>{
 c.config.taikoOpenAnonymousDailyLimit=1;assert.equal((await c.ask()).status,200);assert.equal((await c.ask()).status,429);
}));
test('private service registration requires complete SQL operator identity; inspect does not mutate',{timeout:20000},()=>fixture(async c=>{
 const request=c.grantInput();assert.equal((await provisionSourceService(c.pool,request)).action,'inspect');assert.equal((await c.grants()).length,0);
 await assert.rejects(provisionSourceService(c.pool,{...request,operatorUserId:String(c.user)},{apply:true}),error=>error.statusCode===403);
 assert.equal((await c.audit()).length,0);
 if(c.operatorCreated){await c.pool.execute('UPDATE web_user_accounts SET email=? WHERE id=?',['wrong@example.test',c.operator]);await assert.rejects(provisionSourceService(c.pool,request,{apply:true}),error=>error.statusCode===403);}
}));
test('one SQL grant/audit commit; exact replay never overwrites a later revocation',{timeout:20000},()=>fixture(async c=>{
 const before=await sourceSnapshot(c),request=c.grantInput();assert.equal((await provisionSourceService(c.pool,request,{apply:true})).replayed,false);
 assert.equal((await provisionSourceService(c.pool,request,{apply:true})).replayed,true);await c.register({status:'revoked'});
 assert.equal((await provisionSourceService(c.pool,request,{apply:true})).replayed,true);assert.equal((await c.grants())[0].status,'revoked');assert.equal((await c.audit()).length,2);
 await assert.rejects(provisionSourceService(c.pool,{...request,sources:'*'},{apply:true}),error=>error.statusCode===409);assert.deepEqual(await sourceSnapshot(c),before);
}));
test('concurrent identical registration commits exactly one grant and audit',{timeout:20000},()=>fixture(async c=>{
 const request=c.grantInput(),results=await Promise.all([provisionSourceService(c.pool,request,{apply:true}),provisionSourceService(c.pool,request,{apply:true})]);
 assert.deepEqual(results.map(result=>result.replayed).sort(),[false,true]);assert.equal((await c.grants()).length,1);assert.equal((await c.audit()).length,1);
}));
test('expiry changes during a service read cannot silently fall back to its owner binding',{timeout:20000},()=>fixture(async c=>{
 await c.register();let changed=false;c.state.afterExecute=async sql=>{
  if(!changed&&c.scopeModule.currentScoreScope()?.mode==='read'&&sql.includes('FROM taiko_source_service_grants')){changed=true;await c.pool.execute('UPDATE taiko_source_service_grants SET expires_at=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE developer_token_id=?',[c.tokenId]);}
 };
 assert.equal((await c.ask({token:c.rawToken,cookie:''})).status,403);assert.equal(changed,true);
 c.state.afterExecute=null;assert.equal((await c.ask({token:c.rawToken,cookie:''})).status,200);
}));
test('late grant audit failure rolls back policy; failed rollback discards owned connection',{timeout:20000},()=>fixture(async c=>{
 for(const failRollback of [false,true]){
  let destroyed=0;const db={execute:(...args)=>c.pool.execute(...args),async getConnection(){const connection=await c.pool.getConnection();return {
   beginTransaction:()=>connection.beginTransaction(),commit:()=>connection.commit(),release:()=>connection.release(),destroy:()=>{destroyed++;connection.destroy();},
   rollback:()=>failRollback?Promise.reject(new Error('Private rollback /password/hash')):connection.rollback(),
   execute:(sql,args)=>sql.startsWith('INSERT INTO taiko_source_service_grant_audit')?Promise.reject(new Error('Private audit /password/hash')):connection.execute(sql,args)
  };}};
  await assert.rejects(provisionSourceService(db,c.grantInput(),{apply:true}),error=>error.statusCode===503&&!error.message.includes('/password/hash'));
  assert.equal(destroyed,failRollback?1:0);assert.equal((await c.grants()).length,0);assert.equal((await c.audit()).length,0);
 }
}));
test('lost COMMIT acknowledgement resolves from durable audit on captured pool',{timeout:20000},()=>fixture(async c=>{
 const request=c.grantInput(),db={execute:(...args)=>c.pool.execute(...args),async getConnection(){const connection=await c.pool.getConnection();return {
  execute:(...args)=>connection.execute(...args),beginTransaction:()=>connection.beginTransaction(),rollback:()=>connection.rollback(),release:()=>connection.release(),destroy:()=>connection.destroy(),
  async commit(){await connection.commit();throw new Error('Private lost acknowledgement /password/hash');}
 };}};
 assert.equal((await provisionSourceService(db,request,{apply:true})).replayed,true);assert.equal((await c.grants())[0].revision_nonce,request.operationId);assert.equal((await c.audit()).length,1);
}));
test('COMMIT not applied cannot be reported as successful',{timeout:20000},()=>fixture(async c=>{
 const db={execute:(...args)=>c.pool.execute(...args),async getConnection(){const connection=await c.pool.getConnection();return {
  execute:(...args)=>connection.execute(...args),beginTransaction:()=>connection.beginTransaction(),rollback:()=>connection.rollback(),release:()=>connection.release(),destroy:()=>connection.destroy(),
  commit:()=>Promise.reject(new Error('Private no commit /password/hash'))
 };}};
 await assert.rejects(provisionSourceService(db,c.grantInput(),{apply:true}),error=>error.statusCode===503);assert.equal((await c.grants()).length,0);assert.equal((await c.audit()).length,0);
}));
test('invalid, empty or implicit service policies and nonfuture expiry are rejected',{timeout:20000},()=>fixture(async c=>{
 for(const patch of [{scopes:[]},{scopes:['unknown']},{scopes:['source_read','source_read']},{sources:[]},{sources:['../private']},{sources:undefined},{tokenId:1e20},{expiresAt:'2027-02-30 00:00:00'}])assert.throws(()=>parseSourceServiceRequest(c.grantInput(patch)),error=>error.statusCode===400);
 await assert.rejects(c.register({expiresAt:'2000-01-01 00:00:00'}),error=>error.statusCode===400);assert.equal((await c.grants()).length,0);
}));

async function cli(input,args=[],envPatch={}){
 const child=spawn(process.execPath,['--experimental-strip-types','scripts/configure_source_service.ts',...args],{
  cwd:new URL('../',import.meta.url),stdio:['pipe','pipe','pipe'],env:{...process.env,TAIKO_ALLOW_TEST_DB_MUTATION:'1',...envPatch}});
 let stdout='',stderr='';const append=(text,chunk)=>{const result=text+chunk.toString();assert.ok(result.length<8192,'Owned CLI output bound');return result;};
 child.stdout.on('data',chunk=>{stdout=append(stdout,chunk);});child.stderr.on('data',chunk=>{stderr=append(stderr,chunk);});child.stdin.on('error',()=>{});
 const finished=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>resolve({code,signal,stdout,stderr}));});
 child.stdin.end(typeof input==='string'?input:JSON.stringify(input));
 try{return await bounded(finished);}finally{if(child.exitCode===null&&child.signalCode===null){child.kill('SIGTERM');await bounded(finished);}assert.ok(child.exitCode!==null||child.signalCode!==null,'Owned CLI remains');}
}
test('actual private CLI inspects/applies/replays/revokes through bounded stdin and guarded test SQL',{timeout:25000},()=>fixture(async c=>{
 const request=c.grantInput();let result=await cli(request);assert.equal(result.code,0);assert.equal(JSON.parse(result.stdout).action,'inspect');assert.equal((await c.grants()).length,0);
 result=await cli(request,['--apply']);assert.equal(result.code,0);assert.equal(JSON.parse(result.stdout).replayed,false);
 assert.equal((await c.ask({token:c.rawToken,cookie:''})).status,200);
 result=await cli(request,['--apply']);assert.equal(result.code,0);assert.equal(JSON.parse(result.stdout).replayed,true);assert.equal((await c.audit()).length,1);
 result=await cli(c.grantInput({status:'revoked'}),['--apply']);assert.equal(result.code,0);assert.equal((await c.grants())[0].status,'revoked');
}));
test('actual CLI denies missing mutation opt-in, test DB presented as production and nonoperator input',{timeout:25000},()=>fixture(async c=>{
 for(const [args,env,input] of [[['--apply'],{TAIKO_ALLOW_TEST_DB_MUTATION:''},c.grantInput()],
  [['--production','--apply'],{TAIKO_SOURCE_SERVICE_EXPECTED_DATABASE:process.env.TAIKO_DB_NAME,TAIKO_ALLOW_SOURCE_SERVICE_PRODUCTION_MUTATION:'1'},c.grantInput()],
  [['--apply'],{},c.grantInput({operatorUserId:String(c.user)})]]){
  const result=await cli(input,args,env);assert.equal(result.code,1);assert.equal(JSON.parse(result.stderr.trim()).statusCode,403);
  assert.ok(!result.stderr.includes('/password/hash')&&!result.stderr.includes(c.rawToken));
 }
 assert.equal((await c.grants()).length,0);assert.equal((await c.audit()).length,0);
}));
test('actual CLI rejects malformed and oversized input with fixed errors and no private payload echo',{timeout:25000},()=>fixture(async c=>{
 for(const input of ['{','x'.repeat(17000)]){const result=await cli(input,['--apply']);assert.equal(result.code,1);assert.equal(JSON.parse(result.stderr.trim()).statusCode,400);assert.ok(result.stderr.length<512);}
 assert.equal((await c.audit()).length,0);
}));
