// Real native Python/PyMySQL bearer + owned HTTP, synthetic remote acquisitions.
import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,unlink,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {accountSourceFixture as fixture,sourceSnapshot,deferred,bounded} from './fixtures/accountSourceHttp.mjs';
import {openPublicationLease} from '../server/infrastructure/taiko-publication/client.ts';
const nativeFetch=globalThis.fetch;
const center='/home/sigaer/git/Sakura_bot/taiko';
async function waitFile(path){const until=performance.now()+8000;for(;;){try{await access(path);return;}catch{}if(performance.now()>until)throw new Error('Owned bearer checkpoint deadline');await new Promise(r=>setTimeout(r,20));}}
async function start(c,options={}){
 for(const name of ['bearer-optimistic.json','bearer-refresh.json','bearer-release.json','bearer-closed.json'])await unlink(resolve(c.root,name)).catch(e=>{if(e.code!=='ENOENT')throw e;});
 const payload={profile:{userid:c.taikoId,mydon_name:'Synthetic native bearer'},songs:[{song_no:1,level:4,high_score:800000,stage_cnt:2}],achievement:{},dojo:{}};
 const file=resolve(c.root,'bearer-options-'+randomUUID()+'.json');
 await writeFile(file,JSON.stringify({root:c.root,userdataDir:c.config.userdataDir,taikoId:c.taikoId,token:c.bearer,payload,...options}),{mode:0o600});
 const child=spawn('/usr/bin/python3',[center+'/tests/token_bearer_sql_child.py',file],{cwd:center,stdio:['pipe','pipe','pipe'],env:{...process.env,PYTHONPATH:center,PYTHONDONTWRITEBYTECODE:'1',TAIKO_ALLOW_TEST_DB_MUTATION:'1'}});
 let output='',error='',timer;const ready=deferred();
 child.stdout.on('data',chunk=>{if(Buffer.byteLength(output)+chunk.length>65536){child.kill('SIGTERM');return;}output+=chunk.toString();if(output.includes('\n')){try{const first=JSON.parse(output.split('\n')[0]);if(first.port)ready.resolve(first.port);}catch{}}});
 child.stderr.on('data',chunk=>{if(Buffer.byteLength(error)<8192)error+=chunk.toString().slice(0,1024);});
 const done=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>{clearTimeout(timer);resolve({code,signal,output,error});});});
 done.catch(()=>{});timer=setTimeout(()=>child.kill('SIGTERM'),15000);
 return {child,done,port:ready.promise,async result(){const result=await done;assert.equal(result.code,0,'Owned native bearer child failed');return JSON.parse(result.output);},async close(){clearTimeout(timer);if(child.exitCode===null){child.stdin.end('\n');let timeout;await Promise.race([done,new Promise(resolve=>{timeout=setTimeout(()=>{child.kill('SIGTERM');resolve();},1500);})]);clearTimeout(timeout);await bounded(done);}assert.equal(child.exitCode===null,false,'Owned Python process remains');}};
}
async function bearerFixture(task){return fixture(async c=>{c.bearer=(await c.tokens.manageViewerScoreToken(c.user,'issue')).token;await task(c);});}

test('native Python complete healthy bearer DTO matches frozen 6a90c7e',{timeout:20000},()=>bearerFixture(async c=>{
 const before=await sourceSnapshot(c),run=await start(c,{frozen:true});try{const result=await run.result();assert.equal(result.status,200);assert.equal(result.result.taikoId,c.taikoId);assert.equal(result.result.data.profile.gameCostume.title,'Synthetic current title');}finally{await run.close();}
 assert.deepEqual(await sourceSnapshot(c),before);
 const [[row]]=await c.pool.query('SELECT last_used_at FROM public_score_tokens WHERE taiko_id=?',[c.taikoId]);assert.ok(row.last_used_at);
}));

test('actual bearer HTTP ignores foreign userid and serves canonical current after projection loss/tamper',{timeout:25000},()=>bearerFixture(async c=>{
 const before=await sourceSnapshot(c),run=await start(c,{mode:'http'});
 try{
  const port=await bounded(run.port),url=`http://127.0.0.1:${port}/api/public-score/by-token`;
  const post=body=>nativeFetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  assert.equal((await post({token:'foreign'})).status,401);
  const healthy=await (await post({token:c.bearer,userid:'123',taikoId:'123'})).json();assert.equal(healthy.taikoId,c.taikoId);
  await unlink(resolve(c.config.userdataDir,c.taikoId+'data.json'));assert.deepEqual(await (await post({token:c.bearer})).json(),healthy);
  await writeFile(resolve(c.config.userdataDir,c.taikoId+'data.json'),'{"profile":{"userid":"foreign"}}');assert.deepEqual(await (await post({token:c.bearer})).json(),healthy);
  const oversize=await nativeFetch(url,{method:'POST',body:'x'.repeat(16385),signal:AbortSignal.timeout(10000)});assert.equal(oversize.status,413);
  const utf8=await nativeFetch(url,{method:'POST',body:new Uint8Array([0xff]),signal:AbortSignal.timeout(10000)});assert.equal(utf8.status,400);
 }finally{await run.close();}
 assert.deepEqual(await sourceSnapshot(c),before);
}));

for(const field of ['id','taiko_id','token_hash','revoke'])test(`native bearer rejects queued ${field} replacement before private refresh`,{timeout:20000},()=>bearerFixture(async c=>{
 const before=await sourceSnapshot(c),held=await openPublicationLease({root:c.config.userdataDir,repoRoot:c.config.repoRoot,identity:c.taikoId,mode:'write'});let run;
 try{
  run=await start(c);await waitFile(resolve(c.root,'bearer-optimistic.json'));
  if(field==='revoke')await c.pool.execute('DELETE FROM public_score_tokens WHERE taiko_id=?',[c.taikoId]);
  else if(field==='id')await c.pool.execute('UPDATE public_score_tokens SET id=id+1000000000000 WHERE taiko_id=?',[c.taikoId]);
  else if(field==='taiko_id'){const target=c.taikoId+'1';c.ownedTokenIds.add(target);await c.pool.execute('UPDATE public_score_tokens SET taiko_id=? WHERE taiko_id=?',[target,c.taikoId]);}
  else await c.pool.execute('UPDATE public_score_tokens SET token_hash=? WHERE taiko_id=?',['0'.repeat(64),c.taikoId]);
  await held.close();assert.equal((await run.result()).status,401);
  await assert.rejects(access(resolve(c.root,'bearer-refresh.json')),e=>e.code==='ENOENT');
 }finally{await held.close();await run?.close();}
 assert.deepEqual(await sourceSnapshot(c),before);
}));

test('native bearer pins token SQL and Source EX throughout refresh and result construction',{timeout:25000},()=>bearerFixture(async c=>{
 const run=await start(c,{pause:true});let rotating,publishing,changed=false,published=false;
 try{
  await waitFile(resolve(c.root,'bearer-refresh.json'));
  rotating=c.pool.execute('UPDATE public_score_tokens SET token_hash=? WHERE taiko_id=?',['0'.repeat(64),c.taikoId]).then(()=>{changed=true;});rotating.catch(()=>{});
  publishing=c.shared.writeUserdataWithHistory(c.taikoId,{profile:{userid:c.taikoId},songs:[]},'wahlap').then(()=>{published=true;});publishing.catch(()=>{});
  await new Promise(r=>setTimeout(r,100));assert.equal(changed,false);assert.equal(published,false);
  await writeFile(resolve(c.root,'bearer-release.json'),'{}');assert.equal((await run.result()).status,200);
  await rotating;await publishing;assert.equal(changed,true);assert.equal(published,true);
 }finally{await writeFile(resolve(c.root,'bearer-release.json'),'{}');await run.close();await rotating?.catch(()=>{});await publishing?.catch(()=>{});}
}));

test('native canonical corruption returns a generic 503 before refresh despite a healthy projection',{timeout:20000},()=>bearerFixture(async c=>{
 const directory=resolve(c.config.userdataDir,'.taiko-publications',c.taikoId),manifest=JSON.parse(await readFile(resolve(directory,'committed.json'),'utf8'));
 await writeFile(resolve(directory,'objects',manifest.files.current.sha256),'corrupt');
 const run=await start(c);try{const result=await run.result();assert.equal(result.status,503);assert.equal(result.message,'成绩服务暂时不可用，请稍后重试。');assert.equal(JSON.stringify(result).includes(c.root),false);}finally{await run.close();}
 await assert.rejects(access(resolve(c.root,'bearer-refresh.json')),e=>e.code==='ENOENT');
 const [[row]]=await c.pool.query('SELECT last_used_at FROM public_score_tokens WHERE taiko_id=?',[c.taikoId]);assert.equal(row.last_used_at,null);
}));

for(const refresh of ['wahlap','hiroba'])test(`actual ${refresh} acquisition reuses native bearer EX and commits current/history together`,{timeout:20000},()=>bearerFixture(async c=>{
 if(refresh==='hiroba')await c.shared.writeUserdataWithHistory(c.taikoId,{_meta:{source:'hiroba'},profile:{userid:c.taikoId},songs:[]},'hiroba');
 const before=await sourceSnapshot(c),run=await start(c,{refresh});
 try{const result=await run.result();assert.equal(result.status,200);assert.equal(result.result.data.songs[0].high_score,800000);assert.equal(result.result.data._meta.source,refresh);}finally{await run.close();}
 const after=await sourceSnapshot(c);assert.equal(after.publication.sequence,before.publication.sequence+1);assert.notEqual(after.publication.commitId,before.publication.commitId);
}));

test('actual native acquisition keeps a real SQL song lock while reusing bearer EX',{timeout:20000},()=>bearerFixture(async c=>{
 await c.shared.writeUserdataWithHistory(c.taikoId,{profile:{userid:c.taikoId},songs:[{song_no:1,level:4,high_score:600000,stage_cnt:1}]},'wahlap');
 await c.pool.execute('INSERT INTO web_song_locks(user_id,taiko_id,song_no,level,is_locked) VALUES (?,?,1,4,1)',[c.user,c.taikoId]);
 const run=await start(c,{refresh:'wahlap'});try{const result=await run.result();assert.equal(result.status,200);assert.equal(result.result.data.songs[0].high_score,600000);}finally{await run.close();await c.pool.execute('DELETE FROM web_song_locks WHERE user_id=? AND taiko_id=?',[c.user,c.taikoId]);}
}));

test('native late SQL failure closes failed rollback and returns a fixed public error',{timeout:20000},()=>bearerFixture(async c=>{
 const before=await sourceSnapshot(c),run=await start(c,{point:'last-used-failure',failRollback:true});
 try{const result=await run.result();assert.equal(result.status,503);assert.equal(result.message,'成绩服务暂时不可用，请稍后重试。');}finally{await run.close();}
 assert.equal(JSON.parse(await readFile(resolve(c.root,'bearer-closed.json'),'utf8')).closed,true);assert.deepEqual(await sourceSnapshot(c),before);
 const [[row]]=await c.pool.query('SELECT last_used_at FROM public_score_tokens WHERE taiko_id=?',[c.taikoId]);assert.equal(row.last_used_at,null);
}));

test('native usage COMMIT ack loss returns unavailable while preserving the committed usage metric',{timeout:20000},()=>bearerFixture(async c=>{
 const run=await start(c,{point:'lost-use-ack'});try{assert.equal((await run.result()).status,503);}finally{await run.close();}
 const [[row]]=await c.pool.query('SELECT last_used_at FROM public_score_tokens WHERE taiko_id=?',[c.taikoId]);assert.ok(row.last_used_at);
}));

for(const point of ['grant-pinned','source-published','before-use-commit','after-use-commit'])test(`actual native bearer death ${point} preserves the committed boundary and permits fresh retry`,{timeout:25000},()=>bearerFixture(async c=>{
 const before=await sourceSnapshot(c),run=await start(c,{point,refresh:'wahlap'});
 try{assert.equal((await run.done).code,73);}finally{await run.close();}
 const after=await sourceSnapshot(c);assert.equal(after.publication.sequence,before.publication.sequence+(point==='grant-pinned'?0:1));
 const [[row]]=await c.pool.query('SELECT last_used_at FROM public_score_tokens WHERE taiko_id=?',[c.taikoId]);assert.equal(Boolean(row.last_used_at),point==='after-use-commit');
 const retry=await start(c);try{assert.equal((await retry.result()).status,200);}finally{await retry.close();}
}));
