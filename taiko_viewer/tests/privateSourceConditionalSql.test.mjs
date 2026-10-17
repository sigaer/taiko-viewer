// Formal conditional GET: real cookie/developer quota, SQL grant, SH and C/H.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {accountSourceFixture,sourceSnapshot,queuedAccountSource} from './fixtures/accountSourceHttp.mjs';
const nonce=()=>randomUUID().replaceAll('-','');
async function fixture(task){
 return accountSourceFixture(async c=>{
  const ip='fd00:'+nonce().slice(0,4)+':'+nonce().slice(0,4)+'::1';
  c.rawToken=randomBytes(12).toString('hex');const [row]=await c.pool.execute('INSERT INTO web_developer_tokens(user_id,token_hash,token_mask) VALUES (?,?,?)',[c.user,createHash('sha256').update(c.rawToken).digest('hex'),'synthetic']);c.tokenId=String(row.insertId);
  c.route('get','/current/:userid',(await import('../server/api/developer/userdata/[userid].get.ts')).default);
  c.route('get','/history/:taikoId',(await import('../server/api/taiko/proxy/userdata/[taikoId]/history.get.ts')).default);
  c.ask=async(kind='current',{etag,cookie=c.cookie,token}={})=>{
   const response=await c.request('GET','/'+kind+'/'+c.taikoId,null,cookie,{'x-forwarded-for':ip,...(etag!==undefined?{'if-none-match':etag}:{}),...(token?{authorization:'Bearer '+token}:{})});
   const text=await response.text();return {status:response.status,etag:response.headers.get('etag'),headers:response.headers,text,body:text?JSON.parse(text):null};
  };
  c.register=async(scopes=['source_read','history_read'])=>c.pool.execute(`INSERT INTO taiko_source_service_grants(developer_token_id,developer_user_id,service_name,scopes_json,sources_json,revision_nonce,status,issued_by_user_id)
   VALUES (?,?,'synthetic-conditional',?,?,?,'active',?) ON DUPLICATE KEY UPDATE scopes_json=VALUES(scopes_json),revision_nonce=VALUES(revision_nonce),status='active'`,[c.tokenId,c.user,JSON.stringify(scopes),JSON.stringify([c.taikoId]),nonce(),c.user]);
  try{await task(c);}finally{c.state.afterExecute=null;await c.pool.execute('DELETE FROM web_taiko_open_api_daily_usage WHERE ip_address=?',[ip]);}
 },{withDeveloper:true});
}
for(const kind of ['current','history']){
 test(kind+' exact conditional hit still proves live SQL authority and preserves C/H',{timeout:20000},()=>fixture(async c=>{
  const before=await sourceSnapshot(c),first=await c.ask(kind);assert.equal(first.status,200);assert.match(first.etag,new RegExp('^"taiko-'+kind+'-v1-[a-f0-9]{64}"$'));
  const hit=await c.ask(kind,{etag:first.etag});assert.equal(hit.status,304);assert.equal(hit.text,'');assert.equal(hit.etag,first.etag);
  assert.equal(hit.headers.get('x-taiko-source-view'),'v1-'+before.publication.commitId+'-'+before.publication.sequence);
  assert.equal(hit.headers.get('cache-control'),'private, no-cache, must-revalidate');assert.ok(hit.headers.get('vary').includes('Authorization'));assert.ok(hit.headers.get('vary').includes('Cookie'));
  assert.ok(Number(hit.headers.get('x-taiko-api-remaining'))<Number(first.headers.get('x-taiko-api-remaining')));assert.deepEqual(await sourceSnapshot(c),before);
  for(const etag of ['*','W/'+first.etag,first.etag+', "other"'])assert.equal((await c.ask(kind,{etag})).status,200);
 }));
 test(kind+' changed canonical content returns full new DTO, projection removal keeps same proof',{timeout:20000},()=>fixture(async c=>{
  const first=await c.ask(kind);await c.shared.writeUserdataWithHistory(c.taikoId,{profile:{userid:c.taikoId},songs:[],unknown:{changed:1}},'wahlap');
  const changed=await c.ask(kind,{etag:first.etag});assert.equal(changed.status,200);assert.notEqual(changed.etag,first.etag);
  if(kind==='current'){assert.deepEqual(changed.body.unknown,{changed:1});await unlink(resolve(c.config.userdataDir,c.taikoId+'data.json'));}
  assert.equal((await c.ask(kind,{etag:changed.etag})).status,304);
 }));
 test(kind+' matching ETag cannot bypass missing credential or lost ownership',{timeout:20000},()=>fixture(async c=>{
  const first=await c.ask(kind);assert.equal((await c.ask(kind,{etag:first.etag,cookie:''})).status,401);
  await c.pool.execute('DELETE FROM web_taiko_bindings WHERE id=?',[c.bindingId]);assert.equal((await c.ask(kind,{etag:first.etag})).status,403);
 }));
 test(kind+' conditional service read refuses revoked, expired and changed scope grants',{timeout:20000},()=>fixture(async c=>{
  await c.pool.execute('DELETE FROM web_taiko_bindings WHERE id=?',[c.bindingId]);await c.register();const options={token:c.rawToken,cookie:''},first=await c.ask(kind,options);assert.equal(first.status,200);
  for(const sql of ["UPDATE taiko_source_service_grants SET status='revoked' WHERE developer_token_id=?","UPDATE taiko_source_service_grants SET expires_at=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE developer_token_id=?"]){
   await c.pool.execute(sql,[c.tokenId]);assert.equal((await c.ask(kind,{...options,etag:first.etag})).status,403);
   await c.pool.execute("UPDATE taiko_source_service_grants SET status='active',expires_at=NULL WHERE developer_token_id=?",[c.tokenId]);
  }
  await c.register(kind==='current'?['history_read']:['source_read']);assert.equal((await c.ask(kind,{...options,etag:first.etag})).status,403);
 }));
 test(kind+' matching conditional read detects owner replacement while queued for SH',{timeout:20000},()=>fixture(async c=>{
  const first=await c.ask(kind);const result=await queuedAccountSource(c,()=>c.ask(kind,{etag:first.etag}),()=>c.pool.execute("UPDATE web_taiko_bindings SET source='hiroba' WHERE id=?",[c.bindingId]));assert.equal(result.status,403);
 }));
 test(kind+' final permission loss and private SQL failure cannot send 304 or content hashes',{timeout:20000},()=>fixture(async c=>{
  const first=await c.ask(kind);let checks=0;c.state.afterExecute=async sql=>{if(c.scopeModule.currentScoreScope()?.mode==='read'&&sql.includes('FROM web_taiko_bindings')&&++checks===2)await c.pool.execute('DELETE FROM web_user_sessions WHERE user_id=?',[c.user]);};
  const denied=await c.ask(kind,{etag:first.etag});assert.equal(denied.status,401);assert.equal(denied.etag,null);
  assert.equal(denied.headers.get('x-taiko-source-view'),null);
  c.state.afterExecute=null;c.cookie=await c.login();c.state.afterExecute=sql=>{if(sql.includes('FROM web_user_sessions'))throw new Error('Private /password/hash');};
  const failed=await c.ask(kind,{etag:first.etag});assert.equal(failed.status,503);assert.equal(failed.etag,null);assert.ok(!failed.text.includes('/password/hash'));
 }));
 test(kind+' corrupt managed objects cannot be excused by a matching ETag',{timeout:20000},()=>fixture(async c=>{
  const first=await c.ask(kind),directory=resolve(c.config.userdataDir,'.taiko-publications',c.taikoId),manifest=JSON.parse(await readFile(resolve(directory,'committed.json'),'utf8'));
  const key=kind==='current'?'current':Object.keys(manifest.files).find(name=>name.startsWith('history/'));assert.ok(key);await writeFile(resolve(directory,'objects',manifest.files[key].sha256),'corrupted');
  const failed=await c.ask(kind,{etag:first.etag});assert.equal(failed.status,503);assert.equal(failed.etag,null);
 }));
}
test('conditional hit still consumes quota and detects actual token revocation',{timeout:20000},()=>fixture(async c=>{
 const first=await c.ask('current',{token:c.rawToken,cookie:''});assert.equal(first.status,200);
 await c.pool.execute("UPDATE web_developer_tokens SET status='revoked',revoked_at=NOW() WHERE id=?",[c.tokenId]);assert.equal((await c.ask('current',{token:c.rawToken,cookie:'',etag:first.etag})).status,401);
 c.config.taikoOpenAnonymousDailyLimit=1;assert.equal((await c.ask('current',{etag:first.etag})).status,304);
 const denied=await c.ask('current',{etag:first.etag});assert.equal(denied.status,429);assert.equal(denied.etag,null);
}));
test('history-only publication changes refresh the shared view token on a current 304',{timeout:20000},()=>fixture(async c=>{
 const first=await c.ask('current'),before=await sourceSnapshot(c);
 const lease=await (await import('../server/infrastructure/taiko-publication/client.ts')).openPublicationLease({root:c.config.userdataDir,repoRoot:c.config.repoRoot,identity:c.taikoId,mode:'write'});
 try{await lease.put('history/data_9999.json','{"songs":[],"unknown":9}');await lease.publish();}finally{await lease.close();}
 const after=await sourceSnapshot(c),hit=await c.ask('current',{etag:first.etag});assert.equal(hit.status,304);assert.equal(hit.etag,first.etag);
 assert.notEqual(after.publication.commitId,before.publication.commitId);assert.equal(hit.headers.get('x-taiko-source-view'),'v1-'+after.publication.commitId+'-'+after.publication.sequence);
 const history=await c.ask('history');assert.equal(history.headers.get('x-taiko-source-view'),hit.headers.get('x-taiko-source-view'));
}));
