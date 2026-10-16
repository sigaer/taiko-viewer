import {fileURLToPath} from 'node:url';
const installedFixture=fileURLToPath(new URL('./fixtures/installed-workers/account_sync_sql_child.py',import.meta.url));
// Actual cookie route -> actual bounded stdin runner -> real Python CLI/SQL/files.
import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {access,readFile,writeFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {accountSourceFixture,sourceSnapshot,deferred,bounded,replaceIdentity} from './fixtures/accountSourceHttp.mjs';
import {openPublicationLease} from '../server/infrastructure/taiko-publication/client.ts';
const center='/home/sigaer/git/Sakura_bot/taiko';
const nonce=()=>randomUUID().replaceAll('-','');
async function waitFile(path){const until=performance.now()+8000;for(;;){try{await access(path);return;}catch{}if(performance.now()>until)throw new Error('Owned sync checkpoint deadline');await new Promise(r=>setTimeout(r,20));}}
async function fixture(task,options={}){return accountSourceFixture(async c=>{
 c.syncOptions={};c.children=[];
 c.config.taikoConfigPath=resolve(c.root,'sync-wahlap.json');
 const payload={profile:{userid:c.taikoId,mydon_name:'合成用户',gameCostume:{title:'Synthetic refreshed title',titleplate_id:2}},songs:[{song_no:1,level:4,high_score:800000,stage_cnt:2}],achievement:{gold:3},dojo:{}};
 const {writeFileSync}=await import('node:fs');
 globalThis.__goalSqlRuntime.syncLaunch=(executable,args,launchOptions)=>{
  const file=resolve(c.root,'sync-current-options.json');
  writeFileSync(file,JSON.stringify({root:c.root,userId:c.user,taikoId:c.taikoId,payload,...c.syncOptions}),{mode:0o600});
  assert.equal(executable,(process.env.TAIKO_PYTHON_EXECUTABLE || '/usr/bin/python3'));assert.deepEqual(args,['-I','-m','taiko_bot.cli.account_sync_cli']);
  assert.equal(launchOptions.env.TAIKO_ALLOW_TEST_DB_MUTATION,undefined);
  assert.equal(launchOptions.env.TAIKO_DB_NAME,process.env.TAIKO_DB_NAME);
  assert.equal(launchOptions.env.TAIKO_RUNTIME_ENV_FILE,'/proc/self/taiko-account-sync-no-env');
  const child=spawn(executable,['-I',installedFixture,file],{...launchOptions,
   env:{...launchOptions.env,QA_RUN_DIR:process.env.QA_RUN_DIR,QA_RUN_TMPDIR:process.env.QA_RUN_TMPDIR,TAIKO_RUNTIME_ROOT:c.root,TAIKO_CENTER_ROOT:c.root,TAIKO_OFFLINE_ROOT:c.root,TAIKO_ALLOW_TEST_DB_MUTATION:'1'}});
  c.children.push(child);return child;
 };
 c.ask=async(body={})=>{const response=await c.request('POST','/sync-submit',{targetIds:['sakura-bot'],...body});const result=await response.json();
  assert.ok(!JSON.stringify(result).includes('/password/hash'),'Private diagnostics in public response');return {status:response.status,body:result};};
 c.logs=async()=>{const [rows]=await c.pool.query('SELECT * FROM web_data_sync_logs WHERE user_id=? ORDER BY id',[c.user]);return rows;};
 c.receipts=async()=>{const [rows]=await c.pool.query('SELECT * FROM web_data_sync_receipts WHERE user_id=?',[c.user]);return rows;};
 try{await task(c);}finally{
  for(const child of c.children){
   if(child.exitCode===null&&child.signalCode===null){child.kill('SIGTERM');let timer;try{await bounded(new Promise(resolve=>{child.once('close',resolve);timer=setTimeout(()=>child.kill('SIGKILL'),1000);}));}finally{clearTimeout(timer);}}
   assert.ok(child.exitCode!==null||child.signalCode!==null,'Owned sync worker remains');
  }
 }
},options);}

test('real cookie sync preserves complete DTO and two C/H observations; nonce replay bypasses cooldown',{timeout:25000},()=>fixture(async c=>{
 const before=await sourceSnapshot(c),id=nonce(),first=await c.ask({requestId:id,userId:c.user+1,userid:'123',taikoId:'123'});
 assert.equal(first.status,200);assert.equal(first.body.ok,true);assert.equal(first.body.currentBinding.taikoId,c.taikoId);
 const logs=await c.logs();assert.equal(logs.length,1);assert.equal(logs[0].status,'success');assert.equal(logs[0].taiko_id,c.taikoId);
 const {toPublicSyncLog}=await import('../server/internal/account/sync.ts');assert.deepEqual(first.body.log,toPublicSyncLog(logs[0]));
 assert.deepEqual(JSON.parse(logs[0].target_ids_json),['sakura-bot']);const result=JSON.parse(logs[0].result_json)[0];
 assert.deepEqual(Object.keys(result),['targetId','label','ok','statusCode','message','receivedBytes','decompressedBytes','songCount']);assert.equal(result.songCount,1);
 const after=await sourceSnapshot(c);assert.equal(after.publication.sequence,before.publication.sequence+2);assert.equal(after.raw.history.length,before.raw.history.length+2);
 assert.equal(JSON.parse(after.raw.current).profile.gameCostume.title,'Synthetic refreshed title');
 await access(resolve(c.root,'sync-daily-callback.json'));
 const again=await c.ask({requestId:id});assert.equal(again.status,200);assert.deepEqual(again.body,first.body);
 assert.deepEqual(await sourceSnapshot(c),after);assert.equal((await c.logs()).length,1);assert.equal((await c.receipts()).length,1);
 const denied=await c.ask({requestId:nonce()});assert.equal(denied.status,429);assert.ok(denied.body.data.remainingSeconds>0);
 assert.deepEqual(await sourceSnapshot(c),after);assert.equal((await c.receipts()).length,1);
 assert.ok(c.gate.requests.every(item=>item.action==='targets'),'Retired gateway dispatch/token not called');
}));

test('sync keeps actual SQL locked songs across acquisition and local snapshot',{timeout:25000},()=>fixture(async c=>{
 await c.shared.writeUserdataWithHistory(c.taikoId,{profile:{userid:c.taikoId},songs:[{song_no:1,level:4,high_score:910000,stage_cnt:4}]},'wahlap');
 await c.pool.execute('INSERT INTO web_song_locks(user_id,taiko_id,song_no,level,is_locked) VALUES (?,?,1,4,1)',[c.user,c.taikoId]);
 assert.equal((await c.ask()).status,200);assert.equal(JSON.parse((await sourceSnapshot(c)).raw.current).songs[0].high_score,910000);
}));

test('unauthenticated or manual sync cannot launch a worker',{timeout:20000},()=>fixture(async c=>{
 const response=await c.request('POST','/sync-submit',{targetIds:['sakura-bot'],userId:c.user},'');assert.equal(response.status,401);assert.equal(c.children.length,0);
 await c.pool.execute('UPDATE web_taiko_bindings SET source=\'manual\',manual_account_id=? WHERE id=?',[c.manualId,c.bindingId]);
 assert.equal((await c.ask()).status,400);assert.equal(c.children.length,0);assert.equal((await c.logs()).length,0);
}));

for(const field of ['id','taiko_id','source','manual_account_id'])test(`worker refuses queued full identity replacement ${field} before refresh`,{timeout:25000},()=>fixture(async c=>{
 const before=await sourceSnapshot(c),held=await openPublicationLease({root:c.config.userdataDir,repoRoot:c.config.repoRoot,identity:c.taikoId,mode:'write'});
 const pending=c.ask();pending.catch(()=>{});
 try{await waitFile(resolve(c.root,'sync-optimistic.json'));await replaceIdentity(c,field);await held.close();assert.equal((await pending).status,409);}
 finally{await held.close();await pending.catch(()=>{});}
 assert.deepEqual(await sourceSnapshot(c),before);assert.equal((await c.logs()).length,0);assert.equal((await c.receipts()).length,0);
 await assert.rejects(access(resolve(c.root,'sync-acquire.json')),e=>e.code==='ENOENT');
}));

test('worker pins owner and current binding until its one SQL commit',{timeout:25000},()=>fixture(async c=>{
 c.syncOptions.pause='acquire';const pending=c.ask();pending.catch(()=>{});await waitFile(resolve(c.root,'sync-acquire.json'));
 let completed=false;const update=c.pool.execute("UPDATE web_taiko_bindings SET source='hiroba' WHERE id=?",[c.bindingId]).then(()=>{completed=true;});
 try{await new Promise(r=>setTimeout(r,100));assert.equal(completed,false);await writeFile(resolve(c.root,'sync-release.json'),'{}');await pending;await bounded(update);}
 finally{await writeFile(resolve(c.root,'sync-release.json'),'{}');await pending.catch(()=>{});await update;}
 assert.equal(completed,true);assert.equal((await c.logs()).length,1);
}));

for(const point of ['log-failure','lost-no-commit'])test(`${point} leaves authorized file observations and rolls back receipt/log`,{timeout:25000},()=>fixture(async c=>{
 const before=await sourceSnapshot(c);c.syncOptions={point,failRollback:true};assert.equal((await c.ask()).status,503);
 const after=await sourceSnapshot(c);assert.equal(after.publication.sequence,before.publication.sequence+2);assert.equal((await c.logs()).length,0);assert.equal((await c.receipts()).length,0);await access(resolve(c.root,'sync-closed.json'));
 c.syncOptions={};assert.equal((await c.ask()).status,200);assert.equal((await c.logs()).length,1);
}));

test('lost COMMIT acknowledgement proves exact log/receipt with captured config',{timeout:25000},()=>fixture(async c=>{
 c.syncOptions={point:'lost-ack',failRollback:true,changeConfig:true};assert.equal((await c.ask()).status,200);assert.equal((await c.logs()).length,1);assert.equal((await c.receipts()).length,1);
}));

for(const point of ['changed-owner','changed-log'])test(`uncertain acknowledgement rejects ${point}`,{timeout:25000},()=>fixture(async c=>{
 c.syncOptions={point};assert.equal((await c.ask()).status,503);assert.equal((await c.logs()).length,1);assert.equal((await c.receipts()).length,1);
}));

for(const [refreshResult,status] of [[404,404],[-1,502]])test(`actual runtime refresh code ${refreshResult} retains ${status}`,{timeout:25000},()=>fixture(async c=>{
 const before=await sourceSnapshot(c);c.syncOptions={refreshResult};assert.equal((await c.ask()).status,status);assert.deepEqual(await sourceSnapshot(c),before);assert.equal((await c.logs()).length,0);
}));
test('remote refresh exceptions are fixed public 502 without stale local success',{timeout:25000},()=>fixture(async c=>{
 const before=await sourceSnapshot(c);c.syncOptions={refreshException:true};assert.equal((await c.ask()).status,502);assert.deepEqual(await sourceSnapshot(c),before);assert.equal((await c.receipts()).length,0);
}));
test('ordinary target failure retains failed-log semantics without private diagnostics',{timeout:25000},()=>fixture(async c=>{
 c.syncOptions={targetException:true};const result=await c.ask();assert.equal(result.status,200);assert.equal(result.body.log.status,'failed');assert.equal((await c.logs()).length,1);
}));

for(const point of ['grant-pinned','acquired','local-published','before-commit','after-commit'])test(`actual private worker death ${point} and nonce retry has the expected file/SQL boundary`,{timeout:30000},()=>fixture(async c=>{
 const before=await sourceSnapshot(c),id=nonce();c.syncOptions={point};assert.equal((await c.ask({requestId:id})).status,503);
 assert.equal(c.children[0].exitCode,73);
 const after=await sourceSnapshot(c),count=point==='grant-pinned'?0:point==='acquired'?1:2;
 assert.equal(after.publication.sequence,before.publication.sequence+count);assert.equal((await c.logs()).length,point==='after-commit'?1:0);
 c.syncOptions={};assert.equal((await c.ask({requestId:id})).status,200);assert.equal((await c.logs()).length,1);assert.equal((await c.receipts()).length,1);
 if(point==='after-commit')assert.deepEqual(await sourceSnapshot(c),after);
}));

test('nonce cannot be reused with a different authorized source',{timeout:25000},()=>fixture(async c=>{
 const id=nonce();assert.equal((await c.ask({requestId:id})).status,200);const before=await sourceSnapshot(c);
 await c.pool.execute("UPDATE web_taiko_bindings SET source='hiroba' WHERE id=?",[c.bindingId]);
 assert.equal((await c.ask({requestId:id})).status,409);assert.deepEqual(await sourceSnapshot(c),before);assert.equal((await c.logs()).length,1);
}));

test('two same-nonce requests serialize into one real log and two observations',{timeout:30000},()=>fixture(async c=>{
 const before=await sourceSnapshot(c),id=nonce();const [a,b]=await Promise.all([c.ask({requestId:id}),c.ask({requestId:id})]);
 assert.equal(a.status,200);assert.equal(b.status,200);assert.deepEqual(a.body,b.body);assert.equal((await c.logs()).length,1);
 assert.equal((await sourceSnapshot(c)).publication.sequence,before.publication.sequence+2);
}));

for(const field of ['id','taiko_id','source','manual_account_id'])test(`final SH refuses ${field} replacement after committed worker output`,{timeout:25000},()=>fixture(async c=>{
 let changed=false;c.state.afterExecute=async sql=>{if(!changed&&sql.includes('FROM web_data_sync_receipts')){changed=true;await replaceIdentity(c,field);}};
 assert.equal((await c.ask()).status,409);assert.equal(changed,true);assert.equal((await c.logs()).length,1);
}));

test('final SH rejects receipt/log tampering, including replay',{timeout:30000},()=>fixture(async c=>{
 const id=nonce();assert.equal((await c.ask({requestId:id})).status,200);
 c.state.afterExecute=async sql=>{if(sql.includes('FROM web_data_sync_receipts'))await c.pool.execute("UPDATE web_data_sync_logs SET result_json='[]' WHERE user_id=?",[c.user]);};
 assert.equal((await c.ask({requestId:id})).status,503);c.state.afterExecute=null;
 // The unchanged receipt no longer proves the mutated log, including replay.
 assert.equal((await c.ask({requestId:id})).status,503);assert.equal((await c.logs()).length,1);
}));

test('loss of final SH cannot return a committed private result',{timeout:25000},()=>fixture(async c=>{
 c.state.afterExecute=async sql=>{if(sql.includes('FROM web_data_sync_receipts'))await c.scopeModule.currentScoreScope(c.taikoId).lease.close();};
 assert.equal((await c.ask()).status,503);assert.equal((await c.logs()).length,1);
}));

test('invalid target and nonce cannot create a worker or receipt',{timeout:20000},()=>fixture(async c=>{
 assert.equal((await c.ask({targetIds:['foreign']})).status,400);assert.equal((await c.ask({requestId:'../nonce'})).status,400);
 assert.equal(c.children.length,0);assert.equal((await c.receipts()).length,0);
}));

test('actual native lifetime expires independently and releases owner/Source before retry',{timeout:25000},()=>fixture(async c=>{
 const before=await sourceSnapshot(c);c.syncOptions={pause:'acquire',nativeDeadline:true};
 assert.equal((await c.ask()).status,503);assert.equal(c.children[0].signalCode,'SIGALRM');
 assert.deepEqual(await sourceSnapshot(c),before);assert.equal((await c.logs()).length,0);assert.equal((await c.receipts()).length,0);
 c.syncOptions={};assert.equal((await c.ask()).status,200);assert.equal((await c.logs()).length,1);
}));
