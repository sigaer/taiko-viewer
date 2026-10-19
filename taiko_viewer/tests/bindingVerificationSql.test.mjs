// Actual owned _test rows + kernel leases. Official profile responses are synthetic.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createApp,createRouter,defineEventHandler,toNodeListener} from 'h3';
const nativeFetch = globalThis.fetch;
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFile,execFileSync} from 'node:child_process';
import {promisify} from 'node:util';
import ts from 'typescript';
import {manualSqlFixture,manualSourceSnapshot} from './fixtures/manualSqlRuntime.mjs';
import {openPublicationLease} from '../server/infrastructure/taiko-publication/client.ts';
import {encodeSqlRecoveryBackup} from '../server/infrastructure/taiko-publication/sql-backup.ts';
const execFileAsync=promisify(execFile);
const taikoId=()=> '7'+(BigInt('0x'+randomBytes(8).toString('hex'))%100000000000000000n).toString().padStart(17,'0');
const hash=raw=>createHash('sha256').update(raw).digest('hex');
function deferred() {let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
async function bounded(promise) {let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Owned verification race deadline')),3000);})]);}finally{clearTimeout(timer);}}
async function fixture(task,{manualNamespace=false,withProfile=false}={}) {
  return manualSqlFixture(async context=>{
    const c={...context,taikoId:manualNamespace?'98'+taikoId().slice(-16):taikoId(),manualId:context.taikoId};
    await c.shared.writeUserdataWithHistory(c.taikoId,{profile:{userid:c.taikoId},songs:[]},'wahlap');
    c.binding=await import('../server/utils/account/bindings.ts');
    c.service=await import('../server/services/account/binding-verification.ts');
    const previousCookie=process.env.TAIKO_WAHLAP_COOKIE,previousFetch=globalThis.fetch;
    process.env.TAIKO_WAHLAP_COOKIE='synthetic-official-cookie';
    const remote={userid:c.taikoId,title:'Original public title',titleplateId:1,requests:0,beforeResponse:null};
    const profiles=new Map([[c.taikoId,remote]]);c.remoteProfiles=profiles;
    globalThis.fetch=async(url,options)=>{
      assert.equal(String(url),'https://wl-taiko.wahlap.net/api/user/search/player');
      assert.equal(options.method,'POST');assert.ok(options.signal);const key=JSON.parse(options.body).keyword;const current=key===c.taikoId?remote:profiles.get(key);assert.ok(current);
      current.requests++;await current.beforeResponse?.();
      return new Response(JSON.stringify({data:{players:[{userid:current.userid,gameCostume:{title:current.title,titleplate_id:current.titleplateId}}]}}),{status:200,headers:{'Content-Type':'application/json'}});
    };
    c.remote=remote;
    c.prepare=async()=>{c.state.expectedSourceMode='none';return c.binding.startBindingVerification(c.user,c.taikoId);};
    c.confirm=async()=>{c.state.expectedSourceMode='write';return c.binding.confirmBindingVerification(c.user,c.taikoId);};
    c.change=()=>{remote.title='Changed public title';remote.titleplateId=2;};
    try {await task(c);} finally {
      globalThis.fetch=previousFetch;
      if(previousCookie===undefined)delete process.env.TAIKO_WAHLAP_COOKIE;else process.env.TAIKO_WAHLAP_COOKIE=previousCookie;
    }
  },{withProfile});
}

test('real profile browser isolates binding verification responses across targets, identities and lifecycle',{timeout:180000},()=>fixture(c=>withOtherUser(c,async other=>{
  const {bindingVerificationBrowser}=await import('./fixtures/bindingVerificationBrowser.mjs');
  await bindingVerificationBrowser(c,other,nativeFetch);
}),{withProfile:true}));
async function source(c) {
  return c.scopeModule.withDomainScoreRead(c.taikoId,async()=>({body:await manualSourceSnapshot(c),commitId:c.scopeModule.scorePublication(c.taikoId)?.commitId,sequence:c.scopeModule.scorePublication(c.taikoId)?.sequence}));
}
async function sql(c) {
  const snapshot={};
  for(const table of ['web_taiko_bindings','web_taiko_binding_verifications','web_taiko_binding_confirmations']) {
    const [rows]=await c.pool.query(`SELECT * FROM ${table} WHERE user_id=? ORDER BY ${table==='web_taiko_binding_confirmations'?'operation_id':'id'}`,[c.user]);snapshot[table]=rows;
  }
  return hash(encodeSqlRecoveryBackup(snapshot));
}
async function confirmed(c) {
  const [[row]]=await c.pool.query('SELECT * FROM web_taiko_bindings WHERE user_id=? AND taiko_id=?',[c.user,c.taikoId]);
  assert.ok(row);assert.equal(row.source,'wahlap');assert.equal(row.manual_account_id,null);assert.equal(row.verified_title,c.remote.title);assert.equal(row.verified_titleplate_id,c.remote.titleplateId);
  const [[pending]]=await c.pool.query('SELECT COUNT(*) AS n FROM web_taiko_binding_verifications WHERE user_id=?',[c.user]);assert.equal(pending.n,0);
  const [[receipt]]=await c.pool.query('SELECT * FROM web_taiko_binding_confirmations WHERE user_id=? AND taiko_id=? ORDER BY created_at DESC,operation_id DESC LIMIT 1',[c.user,c.taikoId]);
  assert.equal(receipt.binding_id,row.id);assert.equal(receipt.source,row.source);assert.equal(receipt.user_id,c.user);
  assert.ok(!encodeSqlRecoveryBackup({receipt}).includes(c.remote.title),'receipt must contain only title/challenge hashes');
  return row;
}
async function withOtherUser(c,task) {
  const tag='verify-'+randomUUID().slice(0,8);
  const [created]=await c.pool.execute('INSERT INTO web_user_accounts (username,email,password_hash) VALUES (?,?,?)',[tag,tag+'@example.test','no-login']);
  const user=created.insertId;
  try {await task(user);} finally {
    for(const table of ['web_taiko_binding_confirmations','web_taiko_binding_verifications','web_taiko_bindings'])await c.pool.execute(`DELETE FROM ${table} WHERE user_id=?`,[user]);
    await c.pool.execute('DELETE FROM web_user_accounts WHERE id=?',[user]);
  }
}
async function queued(c,operation,mutation) {
  const held=await openPublicationLease({root:c.config.userdataDir,repoRoot:c.config.repoRoot,identity:c.taikoId,mode:'write'});
  const observed=deferred();c.remote.beforeResponse=()=>observed.resolve();
  const result=operation();result.catch(()=>{});
  try {await bounded(observed.promise);await mutation();await held.close();return await result;}
  finally {await held.close();c.remote.beforeResponse=null;await result.catch(()=>{});}
}

test('actual preparation/confirmation preserve frozen legacy successful DTO and authority fields',{timeout:20000},()=>fixture(async c=>{
  const frozen=execFileSync('git',['show','7d67edc:taiko_viewer/server/utils/account/bindings.ts'],{cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:1024*1024});
  const originalUrl=new URL('../server/utils/account/bindings.ts',import.meta.url);
  const resolved=frozen.replace(/from "([^"]+)"/g,(full,name)=>name.startsWith('.')?`from "${new URL(name.endsWith('.ts')?name:name+'.ts',originalUrl).href}"`:!name.startsWith('~/')&&!name.startsWith('node:')?`from "${import.meta.resolve(name)}"`:full);
  const file=resolve(c.root,'frozen-binding.mjs');await writeFile(file,ts.transpileModule(resolved,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
  const legacy=await import(pathToFileURL(file).href),before=await source(c);
  const legacyPrepared=await legacy.startBindingVerification(c.user,c.taikoId);c.change();
  const legacyConfirmed=await legacy.confirmBindingVerification(c.user,c.taikoId);
  const projected=async()=>{const [rows]=await c.pool.query('SELECT taiko_id,source,manual_account_id,is_current,verified_title,verified_titleplate_id FROM web_taiko_bindings WHERE user_id=? ORDER BY taiko_id',[c.user]);return rows;};
  const expected=await projected();
  await c.pool.execute('DELETE FROM web_taiko_bindings WHERE user_id=? AND taiko_id=?',[c.user,c.taikoId]);
  await c.pool.execute('UPDATE web_taiko_bindings SET is_current=1 WHERE user_id=?',[c.user]);
  c.remote.title='Original public title';c.remote.titleplateId=1;
  assert.deepEqual(await c.prepare(),legacyPrepared);c.change();const commits=c.state.commits;
  assert.deepEqual(await c.confirm(),legacyConfirmed);assert.equal(c.state.commits-commits,1);
  assert.deepEqual(await projected(),expected);await confirmed(c);assert.deepEqual(await source(c),before);
}));

test('non-exact official profile cannot create a challenge or grant; unchanged title keeps the original challenge',{timeout:20000},()=>fixture(async c=>{
  c.remote.userid=taikoId();const before=await sql(c);
  await assert.rejects(c.prepare(),e=>e.statusCode===404);assert.equal(await sql(c),before);
  c.remote.userid=c.taikoId;await c.prepare();const pending=await sql(c);
  c.remote.userid=taikoId();await assert.rejects(c.confirm(),e=>e.statusCode===404);assert.equal(await sql(c),pending);
  c.remote.userid=c.taikoId;await assert.rejects(c.confirm(),e=>e.statusCode===400);assert.equal(await sql(c),pending);
}));

test('an unsafe numeric official userid is rejected even if its rounded string matches the requested ID',{timeout:20000},()=>fixture(async c=>{
  const original=c.taikoId,before=await sql(c);
  c.taikoId='700000000000000000';c.remote.userid=Number(c.taikoId);
  try {await assert.rejects(c.prepare(),e=>e.statusCode===404);assert.equal(await sql(c),before);}
  finally {c.taikoId=original;}
}));

test('preparation rechecks a foreign acquisition after its public profile lookup without replacing the prior challenge',{timeout:20000},()=>fixture(async c=>withOtherUser(c,async other=>{
  await c.prepare();const before=await sql(c);
  c.remote.beforeResponse=()=>c.pool.execute("INSERT INTO web_taiko_bindings (user_id,taiko_id,source,is_current) VALUES (?,?,'wahlap',1)",[other,c.taikoId]);
  await assert.rejects(c.prepare(),e=>e.statusCode===409);assert.equal(await sql(c),before);
})));

for(const failedRollback of [false,true])test(`preparation replacement is atomic through late failure, discard=${failedRollback}`,{timeout:20000},()=>fixture(async c=>{
  await c.prepare();const before=await sql(c),beforeSource=await source(c),commits=c.state.commits;
  c.remote.title='A later baseline';c.state.failRollback=failedRollback;
  c.state.beforeSqlStatement=statement=>{if(statement.includes('INSERT INTO web_taiko_binding_verifications'))throw new Error('Synthetic last preparation failure');};
  await assert.rejects(c.prepare());assert.equal(await sql(c),before);assert.equal(c.state.commits,commits);assert.equal(c.state.discardedConnections,failedRollback?1:0);assert.deepEqual(await source(c),beforeSource);
}));

test('lost actual preparation COMMIT ack is proven by its exact inserted verification',{timeout:20000},()=>fixture(async c=>{
  c.state.afterSqlCommit=()=>{throw new Error('Synthetic lost preparation COMMIT ack');};
  const commits=c.state.commits;const result=await c.prepare();assert.equal(result.originalTitle,c.remote.title);assert.equal(c.state.commits-commits,1);
  const [[row]]=await c.pool.query('SELECT original_title FROM web_taiko_binding_verifications WHERE user_id=?',[c.user]);assert.equal(row.original_title,result.originalTitle);
}));

for(const point of ['grant','current','consume','receipt','driver','failed-rollback'])test(`late confirmation ${point} failure leaves grant/current/challenge wholly unchanged`,{timeout:20000},()=>fixture(async c=>{
  await c.prepare();c.change();const before=await sql(c),beforeSource=await source(c),commits=c.state.commits;
  c.state.failRollback=point==='failed-rollback';
  c.state.beforeSqlStatement=async statement=>{
    if(point==='grant'&&statement.includes('INSERT INTO web_taiko_bindings'))throw new Error('Synthetic grant failure');
    if(point==='current'&&statement.startsWith('UPDATE web_taiko_bindings SET is_current=1'))throw new Error('Synthetic current failure');
    if(point==='consume'&&statement.startsWith('DELETE FROM web_taiko_binding_verifications WHERE id'))throw new Error('Synthetic consumption failure');
    if(['receipt','failed-rollback'].includes(point)&&statement.includes('INSERT INTO web_taiko_binding_confirmations'))throw new Error('Synthetic receipt failure');
    if(point==='driver'&&statement.includes('INSERT INTO web_taiko_binding_confirmations'))await c.pool.execute('SELECT missing_private_verification_column FROM web_taiko_bindings WHERE user_id=?',[c.user]);
  };
  await assert.rejects(c.confirm(),e=>point!=='driver'||(e.statusCode===503&&!('sql' in e)&&!('cause' in e)));
  assert.equal(await sql(c),before);assert.equal(c.state.commits,commits);assert.equal(c.state.discardedConnections,point==='failed-rollback'?1:0);assert.deepEqual(await source(c),beforeSource);
}));

test('lost confirmation COMMIT ack and same-actor concurrency produce one grant; replay preserves later current and pending',{timeout:20000},()=>fixture(async c=>{
  await c.prepare();c.change();const commits=c.state.commits,before=await source(c);
  c.state.afterSqlCommit=()=>{throw new Error('Synthetic lost confirmation ack');};
  const results=await Promise.all([c.confirm(),c.confirm()]);assert.deepEqual(results,[{ok:true},{ok:true}]);assert.equal(c.state.commits-commits,1);
  const row=await confirmed(c),[[manual]]=await c.pool.query('SELECT id FROM web_taiko_bindings WHERE user_id=? AND taiko_id=?',[c.user,c.manualId]);
  c.state.afterSqlCommit=null;c.state.expectedSourceMode='none';await c.binding.switchCurrentBinding(c.user,manual.id);
  const unrelated=taikoId();await c.pool.execute('INSERT INTO web_taiko_binding_verifications (user_id,taiko_id,original_title,original_titleplate_id,expires_at) VALUES (?,?,?,1,DATE_ADD(NOW(),INTERVAL 30 MINUTE))',[c.user,unrelated,'Unrelated baseline']);
  const after=await sql(c),done=c.state.commits;assert.deepEqual(await c.confirm(),{ok:true});assert.equal(c.state.commits,done);assert.equal(await sql(c),after);assert.deepEqual(await source(c),before);
  await c.pool.execute('DELETE FROM web_taiko_bindings WHERE id=?',[row.id]);await assert.rejects(c.confirm(),e=>e.statusCode===400);
}));

for(const mutation of ['replacement','expired','baseline-title','baseline-plate','identity','foreign-owner'])test(`confirmation rejects a ${mutation} while waiting for actual Source EX`,{timeout:20000},()=>fixture(async c=>{
  await c.prepare();c.change();const before=await source(c),commits=c.state.commits;
  let otherUser=0;
  try {
    await assert.rejects(queued(c,()=>c.confirm(),async()=>{
      if(mutation==='replacement'){await c.pool.execute('DELETE FROM web_taiko_binding_verifications WHERE user_id=?',[c.user]);await c.pool.execute('INSERT INTO web_taiko_binding_verifications (user_id,taiko_id,original_title,original_titleplate_id,expires_at) VALUES (?,?,?,1,DATE_ADD(NOW(),INTERVAL 30 MINUTE))',[c.user,c.taikoId,'Replacement baseline']);}
      if(mutation==='expired')await c.pool.execute('UPDATE web_taiko_binding_verifications SET expires_at=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE user_id=?',[c.user]);
      if(mutation==='baseline-title')await c.pool.execute('UPDATE web_taiko_binding_verifications SET original_title=? WHERE user_id=?',['Changed baseline',c.user]);
      if(mutation==='baseline-plate')await c.pool.execute('UPDATE web_taiko_binding_verifications SET original_titleplate_id=99 WHERE user_id=?',[c.user]);
      if(mutation==='identity')await c.pool.execute('UPDATE web_taiko_binding_verifications SET taiko_id=? WHERE user_id=?',[taikoId(),c.user]);
      if(mutation==='foreign-owner') {
        const tag='late-verify-'+randomUUID().slice(0,8),[created]=await c.pool.execute('INSERT INTO web_user_accounts (username,email,password_hash) VALUES (?,?,?)',[tag,tag+'@example.test','no-login']);otherUser=created.insertId;
        await c.pool.execute("INSERT INTO web_taiko_bindings (user_id,taiko_id,source,is_current) VALUES (?,?,'wahlap',1)",[otherUser,c.taikoId]);
      }
    }),e=>e.statusCode===409);
    assert.equal(c.state.commits,commits);assert.deepEqual(await source(c),before);
    const [[receipts]]=await c.pool.query('SELECT COUNT(*) AS n FROM web_taiko_binding_confirmations WHERE user_id=?',[c.user]);assert.equal(receipts.n,0);
  } finally {
    if(otherUser){await c.pool.execute('DELETE FROM web_taiko_bindings WHERE user_id=?',[otherUser]);await c.pool.execute('DELETE FROM web_user_accounts WHERE id=?',[otherUser]);}
  }
}));

test('existing source refresh retains its identity/products; a queued source substitution cannot refresh it',{timeout:20000},()=>fixture(async c=>{
  await c.prepare();c.change();await c.confirm();const row=await confirmed(c);
  const before=await source(c);c.remote.title='Next public baseline';await c.prepare();c.remote.title='New verified public title';
  const commits=c.state.commits;await c.confirm();assert.equal(c.state.commits-commits,1);assert.equal((await confirmed(c)).id,row.id);
  c.remote.title='Last baseline';await c.prepare();c.remote.title='Last verified title';
  await assert.rejects(queued(c,()=>c.confirm(),()=>c.pool.execute("UPDATE web_taiko_bindings SET source='hiroba' WHERE id=?",[row.id])),e=>e.statusCode===409);
  assert.deepEqual(await source(c),before);
}));

test('foreign owner and bot-only manual authority cannot be acquired through public title verification',{timeout:20000},()=>fixture(async c=>withOtherUser(c,async other=>{
  await c.prepare();c.change();await c.confirm();c.state.expectedSourceMode='none';
  await assert.rejects(c.binding.startBindingVerification(other,c.taikoId),e=>e.statusCode===409);
  const bot={kind:'bot',identityKey:c.botKey};c.state.expectedSourceMode='write';const born=await c.manual.createManualAccount(bot,'Bot-only manual');
  try {await assert.rejects(c.binding.startBindingVerification(c.user,born.taikoId),e=>e.statusCode===400);} finally {
    await c.pool.execute('DELETE FROM bind WHERE qq=? AND id=?',[c.botKey,born.taikoId]);
  }
})));

test('a deleted manual source remains reserved and cannot be reacquired through external title verification',{timeout:20000},()=>fixture(async c=>{
  const bot={kind:'bot',identityKey:c.botKey};
  const born=await c.manual.createManualAccount(bot,'Deleted reserved manual');
  await c.manual.permanentlyDeleteManualAccount(bot,born.taikoId,true);
  const before=c.remote.requests;
  await assert.rejects(c.binding.startBindingVerification(c.user,born.taikoId),e=>e.statusCode===400);
  await assert.rejects(c.binding.confirmBindingVerification(c.user,born.taikoId),e=>e.statusCode===400);
  assert.equal(c.remote.requests,before);
  const [[binding]]=await c.pool.query('SELECT COUNT(*) AS n FROM web_taiko_bindings WHERE user_id=? AND taiko_id=?',[c.user,born.taikoId]);assert.equal(binding.n,0);
}));

test('legacy orphaned manual namespace is protected even without any surviving SQL reservation',{timeout:20000},()=>fixture(async c=>{
  await c.shared.writeUserdataWithHistory(c.taikoId,{_meta:{source:'manual'},profile:{userid:c.taikoId},songs:[]},'manual-score');
  for(const table of ['taiko_manual_accounts','taiko_manual_creations','taiko_source_lifecycle']) {
    const [[row]]=await c.pool.query(`SELECT COUNT(*) AS n FROM ${table} WHERE taiko_id=?`,[c.taikoId]);assert.equal(row.n,0);
  }
  const before=await source(c),requests=c.remote.requests;
  await assert.rejects(c.prepare(),e=>e.statusCode===400);await assert.rejects(c.confirm(),e=>e.statusCode===400);
  assert.equal(c.remote.requests,requests);assert.deepEqual(await source(c),before);
},{manualNamespace:true}));

test('deleted login owner and corrupt confirmation receipt cannot authorize replay',{timeout:20000},()=>fixture(async c=>{
  await c.prepare();c.change();await c.confirm();
  await c.pool.execute('UPDATE web_taiko_binding_confirmations SET verified_hash=? WHERE user_id=?',['z'.repeat(64),c.user]);
  await assert.rejects(c.confirm(),e=>e.statusCode===503);
  await c.pool.execute('DELETE FROM web_user_accounts WHERE id=?',[c.user]);await assert.rejects(c.confirm(),e=>e.statusCode===404);
}));

test('actual authenticated prepare/confirm/GET/reload/re-login adapters preserve ownership and later selection',{timeout:25000},()=>fixture(async c=>{
  const previousHandler=globalThis.defineEventHandler;globalThis.defineEventHandler=defineEventHandler;
  let server;
  try {
    const password=randomBytes(16).toString('hex');
    const [[account]]=await c.pool.query('SELECT username FROM web_user_accounts WHERE id=?',[c.user]);
    await c.pool.execute('UPDATE web_user_accounts SET password_hash=?,email_verified=1 WHERE id=?',[await c.shared.getPasswordHash(password),c.user]);
    const router=createRouter();
    for(const [method,path,file] of [['post','/login','auth/login.post.ts'],['post','/logout','auth/logout.post.ts'],['post','/prepare','bindings/prepare.post.ts'],['post','/confirm','bindings/confirm.post.ts'],['post','/current','bindings/current.post.ts'],['get','/bindings','bindings.get.ts']]) {
      router[method](path,(await import(new URL('../server/api/account/'+file,import.meta.url).href)).default);
    }
    server=createServer(toNodeListener(createApp().use(router)));server.listen(0,'127.0.0.1');await once(server,'listening');
    const base=`http://127.0.0.1:${server.address().port}`;
    const request=(cookie,method,path,body)=>nativeFetch(base+path,{method,headers:{'Content-Type':'application/json',Cookie:cookie||''},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
    const login=async()=>{const response=await request('','POST','/login',{identifier:account.username,password});assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0];};
    const read=async cookie=>{const response=await request(cookie,'GET','/bindings');assert.equal(response.status,200);return response.json();};
    assert.equal((await request('','POST','/prepare',{taikoId:c.taikoId})).status,401);
    assert.equal((await request('','GET','/bindings')).status,401);
    let cookie=await login();c.state.expectedSourceMode='none';
    const prepared=await request(cookie,'POST','/prepare',{taikoId:c.taikoId});assert.equal(prepared.status,200);
    assert.equal((await read(cookie)).pendingBinding.taikoId,c.taikoId);
    c.change();c.state.expectedSourceMode='write';
    const response=await request(cookie,'POST','/confirm',{taikoId:c.taikoId});assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true});
    const completed=await read(cookie);assert.equal(completed.pendingBinding,null);assert.equal(completed.currentBinding.taikoId,c.taikoId);
    assert.equal((await read(cookie)).currentBinding.id,completed.currentBinding.id);
    const manual=completed.bindings.find(row=>row.taikoId===c.manualId);c.state.expectedSourceMode='none';
    assert.equal((await request(cookie,'POST','/current',{bindingId:manual.id})).status,200);
    c.state.expectedSourceMode='write';assert.equal((await request(cookie,'POST','/confirm',{taikoId:c.taikoId})).status,200);
    assert.equal((await read(cookie)).currentBinding.taikoId,c.manualId);
    assert.equal((await request(cookie,'POST','/logout')).status,200);cookie=await login();
    assert.equal((await read(cookie)).currentBinding.taikoId,c.manualId);
  } finally {
    if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
    if(previousHandler===undefined)delete globalThis.defineEventHandler;else globalThis.defineEventHandler=previousHandler;
  }
},{withProfile:true}));

for(const kind of ['prepare','confirm'])test(`${kind} retains its captured pool through actual late SQL COMMIT acknowledgement loss`,{timeout:20000},()=>fixture(async c=>{
  if(kind==='confirm'){await c.prepare();c.change();}
  const db=globalThis.__goalSqlRuntime.db;let replaced=false;
  c.state.afterSqlStatement=statement=>{if(statement.includes('FROM web_user_accounts')){replaced=true;globalThis.__goalSqlRuntime.db={execute:()=>{throw new Error('Fresh global pool forbidden');},getConnection:()=>{throw new Error('Fresh global pool forbidden');}};}};
  c.state.afterSqlCommit=()=>{throw new Error('Synthetic lost SQL ack after replacement');};
  try {const result=kind==='prepare'?await c.prepare():await c.confirm();assert.equal(kind==='prepare'?result.taikoId:result.ok,kind==='prepare'?c.taikoId:true);assert.equal(replaced,true);}
  finally {globalThis.__goalSqlRuntime.db=db;c.state.afterSqlStatement=null;c.state.afterSqlCommit=null;}
}));

for(const point of ['before-commit','after-commit'])test(`actual confirmation process death ${point} has atomic authority and a correct completed replay`,{timeout:25000},()=>fixture(async c=>{
  await c.prepare();c.change();const before=await sql(c),beforeSource=await source(c);
  const options=resolve(c.root,'verification-crash-options.json'),childFile=resolve(c.root,'verification-crash-child.mjs');
  await writeFile(options,JSON.stringify({point,user:c.user,taikoId:c.taikoId,config:c.config,title:{title:c.remote.title,titleplateId:c.remote.titleplateId}}),{mode:0o600});
  await writeFile(childFile,`
import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import mysql from ${JSON.stringify(import.meta.resolve('mysql2/promise'))};
import {installGoalSqlRuntime} from ${JSON.stringify(new URL('./fixtures/goalSqlRuntime.mjs',import.meta.url).href)};
assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1');assert.match(String(process.env.TAIKO_DB_NAME||''),/_test$/);
const o=JSON.parse(await readFile(process.argv[2],'utf8'));
const pool=mysql.createPool({host:process.env.TAIKO_DB_HOST,port:Number(process.env.TAIKO_DB_PORT||3306),user:process.env.TAIKO_DB_USER,password:process.env.TAIKO_DB_PASSWORD,database:process.env.TAIKO_DB_NAME,connectionLimit:2});
const [[identity]]=await pool.query('SELECT DATABASE() AS name');assert.match(identity.name,/_test$/);assert.equal(identity.name,process.env.TAIKO_DB_NAME);
let scope;const db={query:(...a)=>pool.query(...a),execute:(...a)=>pool.execute(...a),async getConnection(){
assert.equal(scope.currentScoreScope(o.taikoId)?.mode,'write');const connection=await pool.getConnection();return {
beginTransaction:()=>connection.beginTransaction(),rollback:()=>connection.rollback(),destroy:()=>connection.destroy(),release:()=>connection.release(),
async execute(sql,args){const result=await connection.execute(sql,args);if(o.point==='before-commit'&&sql.includes('INSERT INTO web_taiko_binding_confirmations'))process.exit(73);return result;},
async commit(){await connection.commit();if(o.point==='after-commit')process.exit(73);}};}};
installGoalSqlRuntime(db,o.config);globalThis.fetch=async()=>{throw new Error('Owned crash test network forbidden');};
scope=await import(${JSON.stringify(new URL('../server/services/taiko-domain/publication.ts',import.meta.url).href)});
const service=await import(${JSON.stringify(new URL('../server/services/account/binding-verification.ts',import.meta.url).href)});
await service.confirmViewerBindingVerification(o.user,o.taikoId,async()=>o.title);process.exit(74);
`,{mode:0o600});
  await assert.rejects(execFileAsync(process.execPath,['--experimental-strip-types',childFile,options],{cwd:new URL('../',import.meta.url),timeout:15000,maxBuffer:8192}),e=>e.code===73);
  if(point==='before-commit')assert.equal(await sql(c),before);else await confirmed(c);
  const commits=c.state.commits;assert.deepEqual(await c.confirm(),{ok:true});assert.equal(c.state.commits-commits,point==='before-commit'?1:0);await confirmed(c);assert.deepEqual(await source(c),beforeSource);
}));
