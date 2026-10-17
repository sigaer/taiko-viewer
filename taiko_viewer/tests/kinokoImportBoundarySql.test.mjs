// Real installed -I Publication Worker, fresh native SQL and authenticated H3.
// Only the upstream Kinoko transport is redirected to an owned loopback server.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {accountSourceFixture,sourceSnapshot} from './fixtures/accountSourceHttp.mjs';
const nativeFetch=globalThis.fetch;
const key='tk_'+ 'synthetic_owned_key_only_123456';
const song=(score=900000,time='2026-10-10 12:00:00',id=100)=>({song_no:id,level:4,high_score:score,stage_cnt:2,clear_cnt:1,update_datetime:time,highscore_datetime:time});
test('RC5 Kinoko zero-write receipts pollution rejection source authority and one Publication commit',{timeout:150000},()=>accountSourceFixture(async c=>{
 const [[proof]]=await c.pool.query('SELECT DATABASE() name,@@datadir datadir');assert.equal(proof.name,process.env.TAIKO_DB_NAME);assert.match(proof.name,/_test$/);assert.equal(resolve(proof.datadir),resolve(process.env.TAIKO_TEST_MYSQL_DATADIR));assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1');
 for(const [path,file] of [['/kinoko','kinoko-import.post.ts'],['/kinoko-history','kinoko-history-import.post.ts']])c.route('post',path,(await import('../server/api/account/sync/'+file)).default);
 const previousFetch=globalThis.fetch,observations=[];let upstream,rows=[],returnedId=c.taikoId,beforeReply=null,requests=0;
 async function logs(){const [[r]]=await c.pool.execute('SELECT COUNT(*) n FROM web_data_sync_logs WHERE user_id=?',[c.user]);return Number(r.n);}
 async function clearCooldown(){await c.pool.execute('DELETE FROM web_data_sync_logs WHERE user_id=?',[c.user]);}
 async function call(name,path,status,code,body={apiKey:key},cookie=c.cookie){
  const response=await c.request('POST',path,body,cookie);const data=await response.json();assert.equal(response.status,status,name);
  if(code){assert.equal(data.data?.code,code,name);assert.equal(data.data?.published,false);}
  if(status!==200){assert.notEqual(data.ok,true);assert.equal(data.log,undefined);}
  observations.push({name,status:response.status,published:data.published??data.data?.published??null,partial:data.partial??null});return data;
 }
 async function unchanged(name,path,status,code){const before=await sourceSnapshot(c),count=await logs();const data=await call(name,path,status,code);assert.deepEqual(await sourceSnapshot(c),before,name+' C/H/sequence unchanged');assert.equal(await logs(),count,name+' no success receipt');return data;}
 try{
  upstream=createServer(async(req,res)=>{requests++;try{assert.ok(['/scores/hiroba','/scores/kinoko'].includes(req.url));await beforeReply?.();const playedRecords=req.url.endsWith('/hiroba')?{userid:returnedId,scoreInfo:rows}:{player_id:returnedId,scoreInfo:rows.length?[{song_no:rows[0].song_no,level:4,scoreInfo:rows}]:[]};res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({data:{playedRecords}}));}catch{res.writeHead(500,{'content-type':'application/json'});res.end('{}');}});
  upstream.listen(0,'127.0.0.1');await once(upstream,'listening');const base='http://127.0.0.1:'+upstream.address().port;
  globalThis.fetch=(url,options)=>{const target=String(url);if(target==='https://kinoko.zorua.cn/api/v1/scores/hiroba')return nativeFetch(base+'/scores/hiroba',options);if(target==='https://kinoko.zorua.cn/api/v1/scores/kinoko')return nativeFetch(base+'/scores/kinoko',options);return previousFetch(url,options);};
  rows=[song(900000,'2099-01-01 00:00:00')];await unchanged('all future current rejects without successful receipt','/kinoko',422,'KINOKO_NO_ELIGIBLE_RECORDS');await unchanged('all future history rejects before any C/H','/kinoko-history',422,'KINOKO_NO_ELIGIBLE_RECORDS');
  rows=[song(900000,20261010120000)];await unchanged('non-string event time cannot be coerced into evidence','/kinoko',422,'KINOKO_NO_ELIGIBLE_RECORDS');
  // A fresh source with no C/H must stay absent, rather than publishing empty C.
  const originalId=c.taikoId;c.taikoId=originalId+'1';c.ownedTokenIds.add(c.taikoId);returnedId=c.taikoId;await c.pool.execute('UPDATE web_taiko_bindings SET taiko_id=? WHERE id=?',[c.taikoId,c.bindingId]);rows=[];
  const absent=await sourceSnapshot(c);assert.equal(absent.raw.current,null);await unchanged('empty history on absent source cannot create empty Publication','/kinoko-history',422,'KINOKO_NO_ELIGIBLE_RECORDS');
  c.taikoId=originalId;returnedId=originalId;await c.pool.execute('UPDATE web_taiko_bindings SET taiko_id=? WHERE id=?',[originalId,c.bindingId]);
  rows=[song(),song(999999,'2099-01-01 00:00:00')];let before=await sourceSnapshot(c);const partial=await call('mixed current admits valid rows and reports partial publication','/kinoko',200);let after=await sourceSnapshot(c);assert.equal(partial.published,true);assert.equal(partial.partial,true);assert.equal(partial.timeSummary.skippedTimeRecords,1);assert.equal(after.publication.sequence,before.publication.sequence+1);assert.equal(JSON.parse(after.raw.current).songs[0].high_score,900000);
  await clearCooldown();rows=[song()];await unchanged('duplicate current is explicit unchanged, not success','/kinoko',409,'KINOKO_UNCHANGED');
  rows=[song(920000,'2026-10-10 12:01:00'),song(999999,'2099-01-01 00:00:00')];before=await sourceSnapshot(c);const history=await call('mixed history and current publish in one source generation','/kinoko-history',200);after=await sourceSnapshot(c);assert.equal(history.published,true);assert.equal(history.partial,true);assert.equal(after.publication.sequence,before.publication.sequence+1);assert.equal(JSON.parse(after.raw.current).songs[0].high_score,920000);assert.ok(history.summary.history.snapshotFiles>0);
  await clearCooldown();rows=[song(920000,'2026-10-10 12:01:00')];await unchanged('duplicate history cannot produce success or new generation','/kinoko-history',409,'KINOKO_UNCHANGED');
  await c.shared.writeUserdataWithHistory(c.taikoId,{profile:{userid:c.taikoId},songs:[song(999999,'2099-01-01 00:00:00'),song(800000,'2026-10-10 12:00:00',101)]},'wahlap');rows=[song(930000)];
  await unchanged('polluted current blocks import without copying pollution into H','/kinoko',409,'KINOKO_CURRENT_TIME_CONFLICT');await unchanged('polluted current blocks history before staging','/kinoko-history',409,'KINOKO_CURRENT_TIME_CONFLICT');
  await c.shared.writeUserdataWithHistory(c.taikoId,{profile:{userid:c.taikoId},songs:[song(920000,'2026-10-10 12:01:00')]},'wahlap');
  returnedId='123';await unchanged('upstream identity mismatch cannot publish','/kinoko',409);returnedId=c.taikoId;
  beforeReply=()=>c.pool.execute("UPDATE web_taiko_bindings SET source='hiroba' WHERE id=?",[c.bindingId]);
  await unchanged('source changed while fetching rejects captured binding','/kinoko',409);beforeReply=null;await c.pool.execute("UPDATE web_taiko_bindings SET source='wahlap' WHERE id=?",[c.bindingId]);
  beforeReply=()=>c.pool.execute('UPDATE web_taiko_bindings SET manual_account_id=? WHERE id=?',[c.manualId,c.bindingId]);
  await unchanged('manual identity changed while fetching rejects full tuple','/kinoko-history',409);beforeReply=null;await c.pool.execute('UPDATE web_taiko_bindings SET manual_account_id=NULL WHERE id=?',[c.bindingId]);
  const [created]=await c.pool.execute("INSERT INTO web_user_accounts(username,email,password_hash) VALUES ('kinoko-test-other','kinoko-other@example.test','no-login')");
  try{beforeReply=()=>c.pool.execute('UPDATE web_taiko_bindings SET user_id=? WHERE id=?',[created.insertId,c.bindingId]);await unchanged('owner changed while fetching cannot publish','/kinoko',409);}finally{beforeReply=null;await c.pool.execute('UPDATE web_taiko_bindings SET user_id=? WHERE id=?',[c.user,c.bindingId]);await c.pool.execute('DELETE FROM web_user_accounts WHERE id=?',[created.insertId]);}
  beforeReply=()=>c.pool.execute('DELETE FROM web_user_sessions WHERE user_id=?',[c.user]);await unchanged('session revoked while fetching cannot publish','/kinoko',401);beforeReply=null;c.cookie=await c.login();
  const count=requests;await call('anonymous cannot fetch upstream or write','/kinoko',401,undefined,{apiKey:key},'');assert.equal(requests,count);
  await writeFile(resolve(process.env.QA_EVIDENCE_DIR,'kinoko-import-boundary.json'),JSON.stringify({status:'PASS_SCOPED',databaseProof:proof,observations,upstream:'owned loopback transport only',publicationPython:process.env.TAIKO_PYTHON_EXECUTABLE,publicationMode:'installed -I',existingWriter:true,productionAccess:false},null,2)+'\n');
 }finally{
  globalThis.fetch=previousFetch;if(upstream){upstream.closeAllConnections();await new Promise(r=>upstream.close(r));}
  await writeFile(resolve(process.env.QA_EVIDENCE_DIR,'kinoko-import-partial-observations.json'),JSON.stringify({observations,upstreamClosed:!upstream?.listening},null,2)+'\n');
 }
}));
