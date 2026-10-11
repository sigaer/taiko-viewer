// Real cookies, quota, principal policy, named SQL lock and native transactions.
import assert from 'node:assert/strict';
import test from 'node:test';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {accountSourceFixture,sourceSnapshot,deferred,bounded} from './fixtures/accountSourceHttp.mjs';
import {provisionSourceService,parseSourceServiceRequest} from '../server/infrastructure/account/source-service-provision.ts';
const nonce=()=>randomUUID().replaceAll('-',''),hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const execFileAsync=promisify(execFile);
async function fixture(task){return accountSourceFixture(async c=>{
 const qq='1'+BigInt('0x'+nonce().slice(0,10)).toString().padStart(12,'0');c.principal='onebot_v11:'+qq;c.qq=qq;
 const ip='fd00:'+nonce().slice(0,4)+':'+nonce().slice(0,4)+'::1';c.ip=ip;c.keys=[c.principal];c.state.expectedSourceMode='none';
 const [q]=await c.pool.execute("INSERT INTO web_user_qq_bindings(user_id,qq_number,status,verified_at) VALUES (?,?,'active',NOW())",[c.user,qq]);c.qqId=String(q.insertId);
 c.rawToken=randomBytes(12).toString('hex');const [token]=await c.pool.execute('INSERT INTO web_developer_tokens(user_id,token_hash,token_mask) VALUES (?,?,?)',[c.user,createHash('sha256').update(c.rawToken).digest('hex'),'synthetic']);c.tokenId=String(token.insertId);
 c.register=async({scopes=['bind_read','bind_write','bind_current'],sources='*',principals=[c.principal]}={})=>c.pool.execute(`INSERT INTO taiko_source_service_grants(developer_token_id,developer_user_id,service_name,scopes_json,sources_json,principals_json,revision_nonce,status,issued_by_user_id)
 VALUES (?,?,'synthetic-center',?,?,?,?,'active',?) ON DUPLICATE KEY UPDATE scopes_json=VALUES(scopes_json),sources_json=VALUES(sources_json),principals_json=VALUES(principals_json),revision_nonce=VALUES(revision_nonce),status='active'`,[c.tokenId,c.user,JSON.stringify(scopes),JSON.stringify(sources),principals===null?null:JSON.stringify(principals),nonce(),c.user]);
 c.seed=async(id=c.taikoId,{source='wahlap',slot=1,current=1,visible=0,key=c.principal}={})=>c.pool.execute('INSERT INTO bind(qq,id,visible,slot_index,is_current,source) VALUES (?,?,?,?,?,?)',[key,id,visible,slot,current,source]);
 c.snapshot=async()=>{const [rows]=await c.pool.query('SELECT row_id,qq,id,visible,slot_index,is_current,source FROM bind WHERE qq=? ORDER BY slot_index,row_id',[c.principal]);const [state]=await c.pool.query('SELECT identity_key,current_virtual FROM taiko_bind_identity_state WHERE identity_key=?',[c.principal]);const [receipts]=await c.pool.query('SELECT operation_id,actor_hash,grant_hash,intent_hash,outcome_hash FROM taiko_bot_binding_operations WHERE actor_user_id=? ORDER BY operation_id',[c.user]);return {rows,state,receipts};};
 for(const [method,path,file] of [['get','/bot-bind','bind.get.ts'],['post','/bot-bind','bind.post.ts'],['post','/bot-current','bind/current.post.ts']])c.route(method,path,(await import('../server/api/taiko/proxy/'+file)).default);
 c.ask=async({action='read',principal=c.principal,body={},token,cookie=c.cookie,header}={})=>{
  const r=await c.request(action==='read'?'GET':'POST',action==='read'?'/bot-bind?identityKey='+encodeURIComponent(principal):action==='current'?'/bot-current':'/bot-bind',action==='read'?null:{identityKey:principal,...body},cookie,{'x-forwarded-for':ip,...(token?{authorization:'Bearer '+token}:{}),...(header!==undefined?{authorization:header}:{})});
  const result=await r.json();if(!r.ok)assert.ok(!JSON.stringify(result).includes('/password/hash')&&!JSON.stringify(result).includes(c.rawToken));return {status:r.status,body:result};
 };
 try{await task(c);}finally{
  c.state.afterExecute=null;c.state.beforeSqlStatement=null;c.state.afterSqlStatement=null;c.state.beforeSqlCommit=null;c.state.afterSqlCommit=null;
  for(const key of c.keys){await c.pool.execute('DELETE FROM bind WHERE qq=?',[key]);await c.pool.execute('DELETE FROM taiko_bind_identity_state WHERE identity_key=?',[key]);}
  await c.pool.execute('DELETE FROM web_user_qq_bindings WHERE user_id=?',[c.user]);await c.pool.execute('DELETE FROM web_taiko_open_api_daily_usage WHERE ip_address=?',[ip]);
 }
},{withDeveloper:true});}
test('real verified QQ cookie gets the frozen healthy DTO with no GET writes',{timeout:20000},()=>fixture(async c=>{
 await c.seed(c.taikoId,{current:0,visible:1});const before=await c.snapshot(),source=await sourceSnapshot(c),result=await c.ask();assert.equal(result.status,200);assert.deepEqual(await c.snapshot(),before);assert.deepEqual(await sourceSnapshot(c),source);
 const legacy=await import('../server/utils/taiko-center.ts');assert.deepEqual(result.body,await legacy.proxyTaikoCenterBindLookup(c.principal));
}));
test('empty binding DTO is preserved without creating identity selection state',{timeout:20000},()=>fixture(async c=>{
 const before=await c.snapshot();assert.deepEqual(await c.ask(),{status:200,body:{ok:true,found:false,identityKey:c.principal,bindings:[]}});assert.deepEqual(await c.snapshot(),before);
}));
test('ordinary owner upsert/current commit once and preserve legacy slot/visibility/u0/manual DTOs',{timeout:20000},()=>fixture(async c=>{
 const beforeSource=await sourceSnapshot(c),beforeCommit=c.state.commits;
 const first=await c.ask({action:'upsert',body:{taikoId:c.taikoId,visible:1}});assert.equal(first.status,200);assert.equal(c.state.commits,beforeCommit+1);
 const legacy=await import('../server/utils/taiko-center.ts');assert.deepEqual(first.body,await legacy.proxyTaikoCenterBindLookup(c.principal));
 await c.seed(c.manualId,{source:'manual',slot:3,current:0});const selected=await c.ask({action:'current',body:{slot:3}});assert.equal(selected.status,200);assert.equal(selected.body.currentSource,'manual');assert.equal(selected.body.bindings[1].displayName,'Synthetic manual');
 assert.equal((await c.ask({action:'current',body:{slot:0}})).status,409);
 await c.seed(c.taikoId+'1',{source:'hiroba',slot:2,current:0});const virtual=await c.ask({action:'current',body:{slot:0}});assert.equal(virtual.status,200);assert.equal(virtual.body.currentVirtual,true);assert.equal(virtual.body.currentSlot,0);
 assert.deepEqual(virtual.body,await legacy.proxyTaikoCenterBindLookup(c.principal));assert.deepEqual(await sourceSnapshot(c),beforeSource);
}));
for(const [label,change] of [['anonymous',async c=>{}],['pending QQ',c=>c.pool.execute("UPDATE web_user_qq_bindings SET status='pending' WHERE user_id=?",[c.user])],['removed QQ',c=>c.pool.execute("UPDATE web_user_qq_bindings SET status='removed' WHERE user_id=?",[c.user])],['unverified QQ',c=>c.pool.execute('UPDATE web_user_qq_bindings SET verified_at=NULL WHERE user_id=?',[c.user])]])test(label+' cannot use quota as a private binding grant',{timeout:20000},()=>fixture(async c=>{
 await c.seed();await change(c);const before=await c.snapshot();assert.equal((await c.ask(label==='anonymous'?{cookie:''}:{})).status,label==='anonymous'?401:403);assert.deepEqual(await c.snapshot(),before);
}));
test('foreign QQ/current/Source and manual external upsert deny without metadata side effects',{timeout:20000},()=>fixture(async c=>{
 await c.seed();const before=await c.snapshot();assert.equal((await c.ask({principal:'onebot_v11:12345'})).status,403);
 assert.equal((await c.ask({action:'upsert',body:{taikoId:c.taikoId+'1'}})).status,403);
 assert.equal((await c.ask({action:'upsert',body:{taikoId:c.manualId,source:'wahlap'}})).status,400);assert.deepEqual(await c.snapshot(),before);
}));
test('token principal/Source policy is explicit; missing or wrong principals cannot elevate',{timeout:20000},()=>fixture(async c=>{
 await c.pool.execute('DELETE FROM web_user_qq_bindings WHERE user_id=?',[c.user]);await c.seed();
 for(const principals of [null,['onebot_v11:12345']]){await c.register({principals});assert.equal((await c.ask({token:c.rawToken,cookie:''})).status,403);}
 await c.register({sources:[c.taikoId+'1']});assert.equal((await c.ask({token:c.rawToken,cookie:''})).status,403);
 await c.register({scopes:['bind_read']});assert.equal((await c.ask({token:c.rawToken,cookie:''})).status,200);assert.equal((await c.ask({action:'current',body:{slot:1},token:c.rawToken,cookie:''})).status,403);
 await c.register({principals:'*'});assert.equal((await c.ask({action:'upsert',body:{taikoId:c.taikoId+'2',source:'hiroba'},token:c.rawToken,cookie:''})).status,200);
 assert.equal((await c.ask({cookie:c.cookie})).status,403);
}));
test('invalid Authorization never falls back to a valid verified owner cookie',{timeout:20000},()=>fixture(async c=>{
 assert.equal((await c.ask({header:'Bearer bad'})).status,401);
}));
for(const developer of [false,true])test('atomic '+(developer?'token':'IP')+' quota admits exactly its boundary under concurrent requests',{timeout:20000},()=>fixture(async c=>{
 const limit=developer?2:1;c.config.taikoOpenAnonymousDailyLimit=1;c.config.taikoOpenDeveloperDailyLimit=2;
 const results=await Promise.all(Array.from({length:3},()=>c.ask(developer?{token:c.rawToken,cookie:''}:{})));
 assert.deepEqual(results.map(r=>r.status).sort(),developer?[200,200,429]:[200,429,429]);
 const [[usage]]=await c.pool.query('SELECT request_count FROM web_taiko_open_api_daily_usage WHERE ip_address=? AND api_name=?',[developer?'token:'+c.tokenId:'ip:'+c.ip,'taiko_proxy_bind_lookup']);assert.equal(usage.request_count,limit);
}));
for(const stage of ['grant-pinned','current-reset','state','receipt','commit'])test('late '+stage+' failure rolls back every binding/state/receipt',{timeout:20000},()=>fixture(async c=>{
 await c.seed();const before=await c.snapshot();
 c.state.afterSqlStatement=sql=>{if((stage==='grant-pinned'&&sql.includes('FROM web_user_qq_bindings'))||(stage==='current-reset'&&sql.startsWith('UPDATE bind SET is_current=0'))||(stage==='state'&&sql.startsWith('INSERT INTO taiko_bind_identity_state'))||(stage==='receipt'&&sql.startsWith('INSERT INTO taiko_bot_binding_operations')))throw new Error('Private SQL /password/hash');};
 if(stage==='commit')c.state.beforeSqlCommit=()=>{throw new Error('Private COMMIT /password/hash');};
 assert.equal((await c.ask({action:'upsert',body:{taikoId:c.taikoId,visible:1}})).status,503);assert.deepEqual(await c.snapshot(),before);
}));
test('failed rollback destroys its connection and releases the private named lock',{timeout:20000},()=>fixture(async c=>{
 c.state.failRollback=true;c.state.beforeSqlCommit=()=>{throw new Error('Private commit');};const before=await c.snapshot();
 assert.equal((await c.ask({action:'upsert',body:{taikoId:c.taikoId}})).status,503);assert.equal(c.state.discardedConnections,2);assert.deepEqual(await c.snapshot(),before);
 c.state.failRollback=false;c.state.beforeSqlCommit=null;assert.equal((await c.ask({action:'upsert',body:{taikoId:c.taikoId}})).status,200);
}));
test('lost actual COMMIT ACK proves one receipt/outcome on a fresh captured connection',{timeout:20000},()=>fixture(async c=>{
 let fail=true;c.state.afterSqlCommit=()=>{if(fail){fail=false;throw new Error('Private lost ACK');}};
 const result=await c.ask({action:'upsert',body:{taikoId:c.taikoId}});assert.equal(result.status,200);const saved=await c.snapshot();assert.equal(saved.receipts.length,1);assert.equal(saved.rows.length,1);
}));
test('no applied COMMIT cannot be reported successful',{timeout:20000},()=>fixture(async c=>{
 c.state.beforeSqlCommit=()=>{throw new Error('No commit ACK');};const before=await c.snapshot();assert.equal((await c.ask({action:'upsert',body:{taikoId:c.taikoId}})).status,503);assert.deepEqual(await c.snapshot(),before);
}));
test('exact/concurrent nonce replay cannot repeat writes or overwrite a later selection',{timeout:25000},()=>fixture(async c=>{
 const requestId=nonce(),args={action:'upsert',body:{taikoId:c.taikoId,requestId}};
 const both=await Promise.all([c.ask(args),c.ask(args)]);assert.deepEqual(both.map(r=>r.status),[200,200],c.state.sqlFaultCode||'No SQL fault recorded');assert.equal((await c.snapshot()).receipts.length,1);
 await c.seed(c.taikoId+'1',{slot:2,current:0});assert.equal((await c.ask({action:'current',body:{slot:2}})).status,200);const before=await c.snapshot();
 const replay=await c.ask(args);assert.equal(replay.status,200);assert.equal(replay.body.currentSlot,2);assert.deepEqual(await c.snapshot(),before);
 assert.equal((await c.ask({action:'upsert',body:{taikoId:c.taikoId,visible:1,requestId}})).status,409);
}));
for(const [name,change,expected] of [['QQ removal',c=>c.pool.execute("UPDATE web_user_qq_bindings SET status='removed' WHERE user_id=?",[c.user]),403],['session expiry',c=>c.pool.execute('UPDATE web_user_sessions SET expires_at=NOW()-INTERVAL 1 SECOND WHERE user_id=?',[c.user]),401],['target binding replacement',c=>c.pool.execute("UPDATE web_taiko_bindings SET source='hiroba' WHERE id=?",[c.bindingId]),403]])test('waiting for identity SQL gate rechecks '+name,{timeout:25000},()=>fixture(async c=>{
 const blocker=await c.pool.getConnection(),lock='taiko-bind-'+hash(c.principal).slice(0,52);await blocker.execute('SELECT GET_LOCK(?,5)',[lock]);
 const seen=deferred();c.state.afterExecute=sql=>{if(sql.includes(name==='target binding replacement'?'FROM web_taiko_bindings':'FROM web_user_qq_bindings'))seen.resolve();};const before=await c.snapshot(),pending=c.ask({action:'upsert',body:{taikoId:c.taikoId}});
 try{await bounded(seen.promise);await change(c);await blocker.execute('SELECT RELEASE_LOCK(?)',[lock]);assert.equal((await pending).status,expected);assert.deepEqual(await c.snapshot(),before);}
 finally{await blocker.execute('SELECT RELEASE_LOCK(?)',[lock]);blocker.release();await pending;c.state.afterExecute=null;}
}));
test('service principal revision changing while queued denies before any metadata mutation',{timeout:25000},()=>fixture(async c=>{
 await c.pool.execute('DELETE FROM web_user_qq_bindings WHERE user_id=?',[c.user]);await c.register();const blocker=await c.pool.getConnection(),lock='taiko-bind-'+hash(c.principal).slice(0,52);await blocker.execute('SELECT GET_LOCK(?,5)',[lock]);
 const seen=deferred();c.state.afterExecute=sql=>{if(sql.includes('FROM taiko_source_service_grants'))seen.resolve();};const pending=c.ask({action:'upsert',body:{taikoId:c.taikoId},token:c.rawToken,cookie:''}),before=await c.snapshot();
 try{await bounded(seen.promise);await c.pool.execute('UPDATE taiko_source_service_grants SET principals_json=? WHERE developer_token_id=?',[JSON.stringify(['onebot_v11:12345']),c.tokenId]);await blocker.execute('SELECT RELEASE_LOCK(?)',[lock]);assert.equal((await pending).status,403);assert.deepEqual(await c.snapshot(),before);}
 finally{await blocker.execute('SELECT RELEASE_LOCK(?)',[lock]);blocker.release();await pending;}
}));
test('healthy case-specific official QQ service principal cannot mutate a colliding SQL row',{timeout:20000},()=>fixture(async c=>{
 const key='qq_official:abc'+nonce().slice(0,8),other=key.replace('abc','ABC');c.keys.push(key,other);await c.seed(c.taikoId,{key});await c.register({principals:[other]});
 const before=await c.snapshot();assert.equal((await c.ask({principal:other,token:c.rawToken,cookie:''})).status,403);assert.deepEqual(await c.snapshot(),before);
}));
test('named lock wait has a real five-second bound and releases its own connection',{timeout:25000},()=>fixture(async c=>{
 const blocker=await c.pool.getConnection(),lock='taiko-bind-'+hash(c.principal).slice(0,52);await blocker.execute('SELECT GET_LOCK(?,5)',[lock]);
 try{const start=performance.now();assert.equal((await c.ask()).status,503);assert.ok(performance.now()-start<7500);}
 finally{await blocker.execute('SELECT RELEASE_LOCK(?)',[lock]);blocker.release();}
 assert.equal((await c.ask()).status,200);
}));
test('principal service parser requires explicit identity ranges and preserves Source-only requests',{timeout:20000},()=>fixture(async c=>{
 const base={operationId:nonce(),operatorUserId:'1',tokenId:'2',serviceName:'synthetic',status:'active',scopes:['bind_read'],sources:'*'};
 for(const principals of [undefined,null,[],['../private'],['onebot_v11:1','onebot_v11:1']])assert.throws(()=>parseSourceServiceRequest({...base,principals}),error=>error.statusCode===400);
 assert.equal(parseSourceServiceRequest({...base,principals:['qq_official:AbC','onebot_v11:12345']}).principalsJson,'["onebot_v11:12345","qq_official:AbC"]');
 assert.equal(parseSourceServiceRequest({...base,scopes:['source_read']}).principalsJson,null);
 assert.equal((await c.ask()).status,200);
}));
test('private operator provisioning commits the exact principal policy and replay does not reset later policy',{timeout:20000},()=>fixture(async c=>{
 let operator,created=false;const [[found]]=await c.pool.query('SELECT id,email FROM web_user_accounts WHERE username=?',['sigaer']);
 if(found){assert.equal(found.email,'1106865024@qq.com');operator=found.id;}else{const [row]=await c.pool.execute('INSERT INTO web_user_accounts(username,email,password_hash) VALUES (?,?,?)',['sigaer','1106865024@qq.com','synthetic']);operator=row.insertId;created=true;}
 const request={operationId:nonce(),operatorUserId:String(operator),tokenId:c.tokenId,serviceName:'synthetic',status:'active',scopes:['bind_read'],sources:'*',principals:[c.principal]};
 try{
  await provisionSourceService(c.pool,request,{apply:true});const [[grant]]=await c.pool.query('SELECT principals_json FROM taiko_source_service_grants WHERE developer_token_id=?',[c.tokenId]);assert.equal(grant.principals_json,JSON.stringify([c.principal]));
  const [[audit]]=await c.pool.query('SELECT principals_json FROM taiko_source_service_grant_audit WHERE operation_id=?',[request.operationId]);assert.equal(audit.principals_json,grant.principals_json);
  await c.pool.execute('UPDATE taiko_source_service_grants SET principals_json=? WHERE developer_token_id=?',['"*"',c.tokenId]);assert.equal((await provisionSourceService(c.pool,request,{apply:true})).replayed,true);
  const [[later]]=await c.pool.query('SELECT principals_json FROM taiko_source_service_grants WHERE developer_token_id=?',[c.tokenId]);assert.equal(later.principals_json,'"*"');
  await assert.rejects(provisionSourceService(c.pool,{...request,principals:'*'},{apply:true}),error=>error.statusCode===409);
 }finally{await c.pool.execute('DELETE FROM taiko_source_service_grant_audit WHERE operation_id=?',[request.operationId]);if(created)await c.pool.execute('DELETE FROM web_user_accounts WHERE id=?',[operator]);}
}));
for(const kind of ['session','QQ'])test('return-time '+kind+' loss rolls back before its single COMMIT',{timeout:20000},()=>fixture(async c=>{
 const before=await c.snapshot();c.state.afterSqlStatement=async(sql,args,result,connection)=>{if(sql.startsWith('INSERT INTO taiko_bind_identity_state')){
  if(kind==='session')await connection.execute('UPDATE web_user_sessions SET expires_at=NOW()-INTERVAL 1 SECOND WHERE user_id=?',[c.user]);
  else await connection.execute("UPDATE web_user_qq_bindings SET status='removed' WHERE user_id=?",[c.user]);
 }};
 assert.equal((await c.ask({action:'upsert',body:{taikoId:c.taikoId}})).status,kind==='session'?401:403);assert.deepEqual(await c.snapshot(),before);
}));

for(const point of ['before-commit','after-commit'])test('actual binding process death '+point+' leaves atomic metadata and supports exact retry',{timeout:30000},()=>fixture(async c=>{
 const requestId=nonce(),options=resolve(c.root,'bot-binding-death.json'),beforeSource=await sourceSnapshot(c);
 await writeFile(options,JSON.stringify({point,config:c.config,cookie:c.cookie,ip:c.ip,principal:c.principal,taikoId:c.taikoId,requestId}),{mode:0o600});
 await assert.rejects(execFileAsync(process.execPath,['--experimental-strip-types',new URL('./fixtures/botBindingSqlDeathChild.mjs',import.meta.url).pathname,options],
  {cwd:new URL('../',import.meta.url),timeout:15000,maxBuffer:8192}),error=>error.code===73);
 const after=await c.snapshot();assert.equal(after.rows.length,point==='after-commit'?1:0);assert.equal(after.receipts.length,point==='after-commit'?1:0);assert.equal(after.state.length,point==='after-commit'?1:0);
 assert.equal((await c.ask({action:'upsert',body:{taikoId:c.taikoId,requestId}})).status,200);assert.equal((await c.snapshot()).receipts.length,1);
 await c.seed(c.taikoId+'1',{slot:2,current:0});assert.equal((await c.ask({action:'current',body:{slot:2}})).status,200);
 const later=await c.snapshot(),replay=await c.ask({action:'upsert',body:{taikoId:c.taikoId,requestId}});assert.equal(replay.status,200);assert.equal(replay.body.currentSlot,2);assert.deepEqual(await c.snapshot(),later);
 assert.deepEqual(await sourceSnapshot(c),beforeSource);
}));
test('principal operation retains its captured pool through late global shutdown replacement and ACK loss',{timeout:20000},()=>fixture(async c=>{
 const captured=globalThis.__goalSqlRuntime.db;let replaced=false,ack=true;
 c.state.afterExecute=sql=>{if(sql.includes('FROM web_user_qq_bindings')){replaced=true;globalThis.__goalSqlRuntime.db={execute:()=>{throw new Error('Global pool used after capture');},getConnection:()=>{throw new Error('Global pool used after capture');}};}};
 c.state.afterSqlCommit=()=>{if(ack){ack=false;throw new Error('Lost private ACK');}};
 try{assert.equal((await c.ask({action:'upsert',body:{taikoId:c.taikoId}})).status,200);assert.equal(replaced,true);assert.equal((await c.snapshot()).receipts.length,1);}
 finally{globalThis.__goalSqlRuntime.db=captured;}
}));
