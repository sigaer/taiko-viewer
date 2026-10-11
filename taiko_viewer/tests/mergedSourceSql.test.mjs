// Real formal HTTP routes, account/service SQL and a native all-member SH worker.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash,randomUUID,randomBytes} from 'node:crypto';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {accountSourceFixture,deferred,bounded} from './fixtures/accountSourceHttp.mjs';
import {mergedSourceId,mergedSourcePrincipal} from '../server/infrastructure/account/merged-source-id.ts';
const nonce=()=>randomUUID().replaceAll('-','');
async function fixture(task,{service=false,manual=false}={}){
 return accountSourceFixture(async c=>{
  c.state.expectedSourceMode='none'; // Native worker owns SH, rather than Node ALS.
  c.principal=service?'qq_official:_'+nonce()+'_':'onebot_v11:9'+String(c.user).padStart(10,'0');
  c.second='6'+BigInt('0x'+nonce().slice(0,12)).toString().padStart(15,'0');c.ownedTokenIds.add(c.second);
  const score=stage=>({song_no:7,level:4,good_cnt:90,ok_cnt:10,ng_cnt:0,stage_cnt:stage,high_score:800000,unknown:'retained'});
  await c.shared.writeUserdataWithHistory(c.taikoId,{profile:{mydon_name:'A'},songs:[score(2)],dojo:{dan:3}},'wahlap');
  await c.shared.writeUserdataWithHistory(c.second,{profile:{mydon_name:'B'},songs:[score(3)],dojo:{dan:4}},'hiroba');
  const [secondBinding]=await c.pool.execute("INSERT INTO web_taiko_bindings(user_id,taiko_id,source,is_current) VALUES (?,?,'hiroba',0)",[c.user,c.second]);c.secondBinding=secondBinding.insertId;
  await c.pool.execute('INSERT INTO bind(qq,id,visible,slot_index,is_current,source) VALUES (?,?,0,1,0,\'wahlap\'),(?,?,0,2,1,\'hiroba\')',[c.principal,c.taikoId,c.principal,c.second]);
  if(manual)await c.pool.execute("INSERT INTO bind(qq,id,visible,slot_index,is_current,source) VALUES (?,?,0,3,0,'manual')",[c.principal,c.manualId]);
  await c.pool.execute('INSERT INTO taiko_bind_identity_state(identity_key,current_virtual) VALUES (?,1)',[c.principal]);
  if(!service)await c.pool.execute("INSERT INTO web_user_qq_bindings(user_id,qq_number,status,verified_at) VALUES (?,?,'active',NOW())",[c.user,c.principal.slice(11)]);
  c.identity=mergedSourceId(c.principal);c.rawToken=randomBytes(12).toString('hex');
  const [token]=await c.pool.execute('INSERT INTO web_developer_tokens(user_id,token_hash,token_mask) VALUES (?,?,?)',[c.user,createHash('sha256').update(c.rawToken).digest('hex'),'synthetic']);c.tokenId=String(token.insertId);
  c.register=async({scopes=['bind_read','source_read','history_read'],sources=[c.taikoId,c.second,...(manual?[c.manualId]:[])],principals=[c.principal]}={})=>c.pool.execute(`INSERT INTO taiko_source_service_grants(developer_token_id,developer_user_id,service_name,scopes_json,sources_json,principals_json,revision_nonce,status,issued_by_user_id)
   VALUES (?,?,'synthetic-merged',?,?,?,?, 'active',?) ON DUPLICATE KEY UPDATE scopes_json=VALUES(scopes_json),sources_json=VALUES(sources_json),principals_json=VALUES(principals_json),revision_nonce=VALUES(revision_nonce),status='active',expires_at=NULL`,[c.tokenId,c.user,JSON.stringify(scopes),JSON.stringify(sources),JSON.stringify(principals),nonce(),c.user]);
  if(service){await c.register();await c.pool.execute('DELETE FROM web_taiko_bindings WHERE user_id=?',[c.user]);}
  c.route('get','/merged-current/:userid',(await import('../server/api/developer/userdata/[userid].get.ts')).default);
  c.route('get','/merged-history/:taikoId',(await import('../server/api/taiko/proxy/userdata/[taikoId]/history.get.ts')).default);
  const ip='fd01:'+nonce().slice(0,4)+':'+nonce().slice(0,4)+'::1';
  c.ask=async(kind='current',{etag,cookie=service?'':c.cookie,token=service?c.rawToken:undefined,identity=c.identity,format}={})=>{
   const response=await c.request('GET','/merged-'+kind+'/'+identity+(format?'?format='+encodeURIComponent(format):''),null,cookie,{'x-forwarded-for':ip,...(etag?{'if-none-match':etag}:{}),...(token?{authorization:'Bearer '+token}:{})});
   const raw=await response.text();return {status:response.status,headers:response.headers,etag:response.headers.get('etag'),raw,body:raw?JSON.parse(raw):null};
  };
  c.heads=async()=>Promise.all([c.taikoId,c.second].map(async id=>JSON.parse(await readFile(resolve(c.config.userdataDir,'.taiko-publications',id,'committed.json'),'utf8'))));
  try{await task(c);}finally{
   c.state.afterExecute=null;c.state.afterSqlStatement=null;c.state.beforeSqlStatement=null;
   await c.pool.execute('DELETE FROM bind WHERE qq=?',[c.principal]);await c.pool.execute('DELETE FROM taiko_bind_identity_state WHERE identity_key=?',[c.principal]);
   await c.pool.execute('DELETE FROM web_user_qq_bindings WHERE user_id=?',[c.user]);await c.pool.execute('DELETE FROM web_taiko_open_api_daily_usage WHERE ip_address=?',[ip]);
  }
 },{withDeveloper:true});
}
test('u0 identifier roundtrips full principal including trailing underscore, rejects aliases',()=>{
 for(const principal of ['12345','onebot_v11:12345','qq_official:_Abc-_','qq_official:'+'x'.repeat(128)])assert.equal(mergedSourcePrincipal(mergedSourceId(principal)),principal);
 for(const input of ['u0v1_','u0v1_'+Buffer.from('qq_official:A').toString('base64url')+'=','u0v1_'+Buffer.from('other:123').toString('base64url')])assert.throws(()=>mergedSourcePrincipal(input));
});
for(const kind of ['current','history']){
 test(kind+' native merged DTO, exact 304, unchanged canonical heads and manual exclusion',{timeout:25000},()=>fixture(async c=>{
  const before=await c.heads(),first=await c.ask(kind);assert.equal(first.status,200);assert.match(first.headers.get('x-taiko-source-view'),/^merged-v1-[a-f0-9]{64}$/);
  if(kind==='current'){assert.equal(first.body.profile.mydon_name,'B');assert.equal(first.body.songs[0].stage_cnt,5);assert.equal(first.body.songs[0].unknown,'retained');assert.deepEqual(first.body._meta.merge_topology,[c.taikoId,c.second].sort());}
  else assert.ok(first.body.snapshots.length>=1);
  const hit=await c.ask(kind,{etag:first.etag});assert.equal(hit.status,304);assert.equal(hit.raw,'');assert.equal(hit.headers.get('x-taiko-source-view'),first.headers.get('x-taiko-source-view'));
  assert.deepEqual(await c.heads(),before);
 },{manual:true}));
 test(kind+' conditional reuse refuses absent credential, Source ownership and QQ verification',{timeout:25000},()=>fixture(async c=>{
  const first=await c.ask(kind);assert.equal(first.status,200);
  assert.equal((await c.ask(kind,{etag:first.etag,cookie:''})).status,401);
  await c.pool.execute('DELETE FROM web_taiko_bindings WHERE id=?',[c.secondBinding]);assert.equal((await c.ask(kind,{etag:first.etag})).status,403);
  await c.pool.execute("INSERT INTO web_taiko_bindings(user_id,taiko_id,source,is_current) VALUES (?,?,'hiroba',0)",[c.user,c.second]);
  await c.pool.execute("UPDATE web_user_qq_bindings SET status='pending' WHERE user_id=?",[c.user]);assert.equal((await c.ask(kind,{etag:first.etag})).status,403);
 }));
 test(kind+' explicit service needs principal, every member and matching scope',{timeout:25000},()=>fixture(async c=>{
  const first=await c.ask(kind);assert.equal(first.status,200);
  for(const policy of [{principals:['qq_official:other']},{sources:[c.taikoId]},{scopes:['bind_read',kind==='current'?'history_read':'source_read']},...(kind==='history'?[{scopes:['bind_read','history_read']}]:[])]){
   await c.register(policy);const denied=await c.ask(kind,{etag:first.etag});assert.equal(denied.status,403);assert.equal(denied.etag,null);assert.equal(denied.headers.get('x-taiko-source-view'),null);
   await c.register();
  }
  await c.pool.execute("UPDATE taiko_source_service_grants SET expires_at=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE developer_token_id=?",[c.tokenId]);assert.equal((await c.ask(kind,{etag:first.etag})).status,403);
 },{service:true}));
 test(kind+' missing projections remain readable while canonical corruption fails without ETag',{timeout:25000},()=>fixture(async c=>{
  const first=await c.ask(kind);assert.equal(first.status,200);await unlink(resolve(c.config.userdataDir,c.second+'data.json'));
  assert.equal((await c.ask(kind,{etag:first.etag})).status,304);
  const second=(await c.heads())[1],key=kind==='current'?'current':Object.keys(second.files).find(key=>key.startsWith('history/'));
  await writeFile(resolve(c.config.userdataDir,'.taiko-publications',c.second,'objects',second.files[key].sha256),'corrupted');
  const failed=await c.ask(kind,{etag:first.etag});assert.equal(failed.status,503);assert.equal(failed.etag,null);
 }));
}
test('current and history identify the same vector and an H-only new head refreshes current 304',{timeout:25000},()=>fixture(async c=>{
 const first=await c.ask(),history=await c.ask('history');assert.equal(first.status,200);assert.equal(history.status,200);assert.equal(first.headers.get('x-taiko-source-view'),history.headers.get('x-taiko-source-view'));
 const {openPublicationLease}=await import('../server/infrastructure/taiko-publication/client.ts');const lease=await openPublicationLease({root:c.config.userdataDir,repoRoot:c.config.repoRoot,identity:c.second,mode:'write'});
 try{await lease.put('history/data_9999.json','{"_meta":{"full":false},"songs":[]}');await lease.publish();}finally{await lease.close();}
 const hit=await c.ask('current',{etag:first.etag});assert.equal(hit.status,304);assert.notEqual(hit.headers.get('x-taiko-source-view'),first.headers.get('x-taiko-source-view'));
}));
test('raw merged history keeps recipe microseconds and pairs with the same current vector',{timeout:25000},()=>fixture(async c=>{
 const current=await c.ask(),normal=await c.ask('history'),raw=await c.ask('history',{format:'raw-v1'});
 assert.equal(raw.status,200);assert.equal(raw.body.historyFormat,'raw-v1');assert.equal(raw.headers.get('x-taiko-source-view'),current.headers.get('x-taiko-source-view'));
 assert.deepEqual(raw.body.snapshots.map(({capturedAt,payload})=>({capturedAt,payload})),normal.body.snapshots);
 for(const item of raw.body.snapshots){assert.match(item.fileName,/^data_\d{8}_\d{6}_\d{6}_merged-bind\.json$/);assert.equal(item.fileMtime,undefined);assert.equal(item.fileCtime,undefined);}
 assert.notEqual(raw.etag,normal.etag);assert.equal((await c.ask('history',{format:'raw-v1',etag:raw.etag})).status,304);
 await c.pool.execute('DELETE FROM web_taiko_bindings WHERE id=?',[c.secondBinding]);
 assert.equal((await c.ask('history',{format:'raw-v1',etag:raw.etag})).status,403);
}));
test('membership change while queued for SH cannot derive from old members',{timeout:25000},()=>fixture(async c=>{
 const {openPublicationLease}=await import('../server/infrastructure/taiko-publication/client.ts');const held=await openPublicationLease({root:c.config.userdataDir,repoRoot:c.config.repoRoot,identity:c.second,mode:'write'});
 const captured=deferred();c.state.afterExecute=sql=>{if(sql.includes('FROM web_taiko_bindings')&&sql.includes('ORDER BY id'))captured.resolve();};
 const reading=c.ask();reading.catch(()=>{});
 try{await bounded(captured.promise);await c.pool.execute('DELETE FROM bind WHERE qq=? AND id=?',[c.principal,c.second]);await held.close();const denied=await reading;assert.equal(denied.status,403);assert.equal(denied.etag,null);}
 finally{await held.close();await reading.catch(()=>{});}
}));
test('both Source locks are already held before SQL, and release after the response',{timeout:25000},()=>fixture(async c=>{
 const {openPublicationLease}=await import('../server/infrastructure/taiko-publication/client.ts');
 const writers=[];let checked=false;
 c.state.beforeSqlStatement=async sql=>{if(!checked&&sql.includes('GET_LOCK')){checked=true;
  for(const identity of [c.taikoId,c.second]){const item={ready:false,lease:null};item.promise=openPublicationLease({root:c.config.userdataDir,repoRoot:c.config.repoRoot,identity,mode:'write'}).then(lease=>{item.ready=true;item.lease=lease;return lease;});item.promise.catch(()=>{});writers.push(item);}
  await new Promise(resolve=>setTimeout(resolve,150));assert.ok(writers.every(item=>!item.ready));
 }};
 try{const result=await c.ask();assert.equal(result.status,200);assert.ok(checked);for(const item of writers)await bounded(item.promise);}
 finally{for(const item of writers){await item.promise.catch(()=>{});await item.lease?.close();}}
}));
test('service revoked while waiting for principal gate is denied after the wait',{timeout:25000},()=>fixture(async c=>{
 const held=await c.pool.getConnection(),name='taiko-bind-'+createHash('sha256').update(JSON.stringify(c.principal)).digest('hex').slice(0,52);
 await held.execute('SELECT GET_LOCK(?,5)',[name]);const waiting=deferred();c.state.beforeSqlStatement=sql=>{if(sql.includes('GET_LOCK'))waiting.resolve();};
 const reading=c.ask();reading.catch(()=>{});
 try{await bounded(waiting.promise);await c.pool.execute("UPDATE taiko_source_service_grants SET status='revoked' WHERE developer_token_id=?",[c.tokenId]);await held.execute('SELECT RELEASE_LOCK(?)',[name]);const denied=await reading;assert.equal(denied.status,403);assert.equal(denied.etag,null);}
 finally{await held.execute('SELECT RELEASE_LOCK(?)',[name]);held.release();await reading.catch(()=>{});}
},{service:true}));
test('late expiry, SQL failure and rollback discard send no merged payload or observation',{timeout:25000},()=>fixture(async c=>{
 let checks=0;c.state.afterSqlStatement=async(sql,args,result,db)=>{if(sql.includes('FROM web_taiko_bindings')&&++checks===3)await db.execute('UPDATE web_user_sessions SET expires_at=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE user_id=?',[c.user]);};
 const denied=await c.ask();assert.equal(denied.status,401);assert.equal(denied.etag,null);
 c.state.afterSqlStatement=null;c.cookie=await c.login();c.state.failRollback=true;c.state.beforeSqlStatement=sql=>{if(sql.includes('FROM bind'))throw new Error('private/password/path');};
 const failed=await c.ask();assert.equal(failed.status,503);assert.equal(failed.etag,null);assert.ok(!failed.raw.includes('private/password/path'));assert.ok(c.state.discardedConnections>0);
}));
test('captured host paths survive runtime configuration replacement before actor SQL returns',{timeout:25000},()=>fixture(async c=>{
 const old={repoRoot:c.config.repoRoot,userdataDir:c.config.userdataDir};let replaced=false;
 c.state.afterExecute=sql=>{if(!replaced&&sql.includes('FROM web_user_sessions')){replaced=true;c.config.repoRoot='/var/tmp/absent-source-root';c.config.userdataDir='/var/tmp/absent-source-data';}};
 try{const response=await c.ask();assert.equal(response.status,200);assert.ok(replaced);}finally{Object.assign(c.config,old);}
}));
