// Actual SQL grant operations and source fence; only guarded owned _test rows.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash,randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {manualSqlFixture as fixture,manualSourceSnapshot as readSourceSnapshot} from './fixtures/manualSqlRuntime.mjs';
import {populate} from './fixtures/manualLifecycleRuntime.mjs';
import {encodeSqlRecoveryBackup} from '../server/infrastructure/taiko-publication/sql-backup.ts';
import {openPublicationLease} from '../server/infrastructure/taiko-publication/client.ts';
const execFileAsync=promisify(execFile);
const hash=raw=>createHash('sha256').update(raw).digest('hex');
async function sourceSnapshot(c) {
  return c.scopeModule.withDomainScoreRead(c.taikoId,async()=>{
    const body=await readSourceSnapshot(c),publication=c.scopeModule.scorePublication(c.taikoId);
    return {body,commitId:publication?.commitId,sequence:publication?.sequence};
  });
}
async function receiptCount(c,kind) {
  const [[row]]=await c.pool.query('SELECT COUNT(*) AS n FROM taiko_manual_grant_receipts WHERE taiko_id=? AND kind=?',[c.taikoId,kind]);
  return row.n;
}
async function sqlSnapshot(c) {
  const result={};
  for(const [table,where,args,order] of [
    ['taiko_manual_accounts','taiko_id=?',[c.taikoId],'taiko_id'],
    ['web_taiko_bindings','user_id=? OR taiko_id=?',[c.user,c.taikoId],'id'],
    ['bind','qq=? OR id=?',[c.botKey,c.taikoId],'row_id'],
    ['taiko_manual_claim_codes','taiko_id=?',[c.taikoId],'id'],
    ['web_player_goals','user_id=?',[c.user],'id'],
    ['web_growth_measurements','user_id=?',[c.user],'id'],
    ['web_growth_recent_cursors','user_id=?',[c.user],'binding_id'],
    ['web_song_locks','user_id=?',[c.user],'id']
  ]) {
    const [rows]=await c.pool.query(`SELECT * FROM ${table} WHERE ${where} ORDER BY ${order}`,args);result[table]=rows;
  }
  const [titles]=await c.pool.query('SELECT t.* FROM web_taiko_binding_mydon_showcase_titles t JOIN web_taiko_bindings b ON b.id=t.binding_id WHERE b.user_id=? ORDER BY t.id',[c.user]);
  result.titles=titles;
  return hash(encodeSqlRecoveryBackup(result));
}
async function assertSourceUnchanged(c,before) {
  assert.deepEqual(await sourceSnapshot(c),before);
}
async function withExtraUser(c,task) {
  const tag='grant-'+randomUUID().slice(0,8);
  const [created]=await c.pool.execute('INSERT INTO web_user_accounts (username,email,password_hash) VALUES (?,?,?)',[tag,tag+'@example.test','no-login']);
  const user=created.insertId;
  try {await task(user);} finally {
    await c.pool.execute('DELETE t FROM web_taiko_binding_mydon_showcase_titles t JOIN web_taiko_bindings b ON b.id=t.binding_id WHERE b.user_id=?',[user]);
    for(const table of ['web_player_goals','web_growth_measurements','web_growth_recent_cursors','web_song_locks','web_taiko_bindings'])await c.pool.execute(`DELETE FROM ${table} WHERE user_id=?`,[user]);
    await c.pool.execute('DELETE FROM web_user_accounts WHERE id=?',[user]);
  }
}
const bot=c=>({kind:'bot',identityKey:c.botKey});

test('claim-code replacement is one SQL commit and an actual late failure keeps the original code usable', {timeout:20000},async()=>fixture(async c=>{
  const old=await c.manual.issueManualClaimCode(c.owner,c.taikoId),beforeSource=await sourceSnapshot(c),before=await sqlSnapshot(c);
  const receiptBefore=await receiptCount(c,'issue'),commits=c.state.commits;
  const expected=new Error('Synthetic late claim issuance');
  c.state.beforeSqlStatement=sql=>{if(sql.includes('INSERT INTO taiko_manual_claim_codes'))throw expected;};
  await assert.rejects(c.manual.issueManualClaimCode(c.owner,c.taikoId),e=>e===expected);
  assert.equal(c.state.commits,commits);assert.equal(await receiptCount(c,'issue'),receiptBefore);
  assert.equal(await sqlSnapshot(c),before);await assertSourceUnchanged(c,beforeSource);
  c.state.beforeSqlStatement=null;
  await c.manual.claimManualAccount(bot(c),old.code);
  await assertSourceUnchanged(c,beforeSource);
}));

for(const failedRollback of [false,true]) {
  test(`late bot attachment/receipt failure rolls back consumed code and every grant, discard=${failedRollback}`, {timeout:20000},async()=>fixture(async c=>{
    const issued=await c.manual.issueManualClaimCode(c.owner,c.taikoId),beforeSource=await sourceSnapshot(c),before=await sqlSnapshot(c),commits=c.state.commits;
    c.state.beforeSqlStatement=sql=>{if(sql.includes('INSERT INTO taiko_manual_grant_receipts'))throw new Error('Synthetic last grant SQL failure');};
    c.state.failRollback=failedRollback;
    await assert.rejects(c.manual.claimManualAccount(bot(c),issued.code));
    assert.equal(c.state.commits,commits);assert.equal(c.state.discardedConnections,failedRollback?1:0);
    assert.equal(await receiptCount(c,'claim'),0);assert.equal(await sqlSnapshot(c),before);await assertSourceUnchanged(c,beforeSource);
    c.state.beforeSqlStatement=null;c.state.failRollback=false;
    assert.equal((await c.manual.claimManualAccount(bot(c),issued.code)).ok,true);
  }));
}

test('Viewer ownership conflict leaves a code unconsumed and the existing holder/current untouched', {timeout:20000},async()=>fixture(async c=>withExtraUser(c,async user=>{
  const issued=await c.manual.issueManualClaimCode(c.owner,c.taikoId),before=await sqlSnapshot(c),beforeSource=await sourceSnapshot(c);
  await assert.rejects(c.manual.claimManualAccount({kind:'viewer',userId:user},issued.code),e=>e.statusCode===409);
  assert.equal(await sqlSnapshot(c),before);assert.equal(await receiptCount(c,'claim'),0);await assertSourceUnchanged(c,beforeSource);
  assert.equal((await c.manual.claimManualAccount(bot(c),issued.code)).ok,true);
})));

test('late Viewer current-selection failure rolls back both new binding and code consumption', {timeout:20000},async()=>fixture(async c=>withExtraUser(c,async user=>{
  const first=await c.manual.issueManualClaimCode(c.owner,c.taikoId);
  await c.manual.claimManualAccount(bot(c),first.code);await c.manual.detachManualAccount(c.owner,c.taikoId);
  await c.pool.execute("INSERT INTO web_taiko_bindings (user_id,taiko_id,source,is_current) VALUES (?,?,'wahlap',1)",[user,'aux-'+c.taikoId.slice(-8)]);
  const code=await c.manual.issueManualClaimCode(bot(c),c.taikoId);
  const before=await sqlSnapshot(c),beforeSource=await sourceSnapshot(c),commits=c.state.commits;
  c.state.beforeSqlStatement=sql=>{if(sql.startsWith('UPDATE web_taiko_bindings SET is_current = 1 WHERE user_id'))throw new Error('Synthetic current selection failure');};
  await assert.rejects(c.manual.claimManualAccount({kind:'viewer',userId:user},code.code));
  assert.equal(c.state.commits,commits);assert.equal(await sqlSnapshot(c),before);await assertSourceUnchanged(c,beforeSource);
  const [bindings]=await c.pool.query('SELECT taiko_id,is_current FROM web_taiko_bindings WHERE user_id=?',[user]);
  assert.equal(bindings.length,1);assert.equal(bindings[0].is_current,1);
  c.state.beforeSqlStatement=null;
  await c.manual.claimManualAccount({kind:'viewer',userId:user},code.code);
  const [[selected]]=await c.pool.query('SELECT taiko_id FROM web_taiko_bindings WHERE user_id=? AND is_current=1',[user]);
  assert.equal(selected.taiko_id,c.taikoId);
})));

test('Viewer detach, all scoped product cleanup and remaining-current selection commit together', {timeout:20000},async()=>fixture(async c=>{
  const f=await populate(c);
  const [extra]=await c.pool.execute("INSERT INTO web_taiko_bindings (user_id,taiko_id,source,is_current) VALUES (?,?,'wahlap',0)",[c.user,'aux-'+c.taikoId.slice(-8)]);
  const before=await sqlSnapshot(c),beforeSource=await sourceSnapshot(c),commits=c.state.commits;
  c.state.beforeSqlStatement=sql=>{if(sql.startsWith('UPDATE web_taiko_bindings SET is_current = 1 WHERE id'))throw new Error('Synthetic late detach');};
  await assert.rejects(c.manual.detachManualAccount(c.owner,c.taikoId));
  assert.equal(await sqlSnapshot(c),before);assert.equal(await receiptCount(c,'detach'),0);assert.equal(c.state.commits,commits);await assertSourceUnchanged(c,beforeSource);
  c.state.beforeSqlStatement=null;
  assert.deepEqual(await c.manual.detachManualAccount(c.owner,c.taikoId),{ok:true});
  assert.equal(c.state.commits-commits,1);
  for(const table of ['web_player_goals','web_growth_measurements','web_growth_recent_cursors','web_taiko_binding_mydon_showcase_titles']){
    const [[row]]=await c.pool.query(`SELECT COUNT(*) AS n FROM ${table} WHERE binding_id=?`,[f.id]);assert.equal(row.n,0);
  }
  const [[current]]=await c.pool.query('SELECT is_current FROM web_taiko_bindings WHERE id=?',[extra.insertId]);assert.equal(current.is_current,1);
  const [[account]]=await c.pool.query('SELECT bot_identity_key FROM taiko_manual_accounts WHERE taiko_id=?',[c.taikoId]);assert.equal(account.bot_identity_key,c.botKey);
  const done=c.state.commits;assert.deepEqual(await c.manual.detachManualAccount(c.owner,c.taikoId),{ok:true});assert.equal(c.state.commits,done);
  await assertSourceUnchanged(c,beforeSource);
}));

test('bot detach principal update and slot compaction are atomic; surviving legacy holder is retained', {timeout:20000},async()=>fixture(async c=>{
  const code=await c.manual.issueManualClaimCode(c.owner,c.taikoId);await c.manual.claimManualAccount(bot(c),code.code);
  const other=c.botKey+'-legacy';
  await c.pool.execute("INSERT INTO bind (qq,id,source,slot_index,is_current) VALUES (?,?,'manual',1,1),(?,?,'wahlap',2,0)",[other,c.taikoId,c.botKey,'aux-'+c.taikoId.slice(-8)]);
  const before=await sqlSnapshot(c),beforeSource=await sourceSnapshot(c),commits=c.state.commits;
  c.state.beforeSqlStatement=sql=>{if(sql.startsWith('UPDATE bind SET is_current = 0 WHERE qq'))throw new Error('Synthetic compact failure');};
  await assert.rejects(c.manual.detachManualAccount(bot(c),c.taikoId));
  assert.equal(await sqlSnapshot(c),before);assert.equal(c.state.commits,commits);assert.equal(await receiptCount(c,'detach'),0);
  c.state.beforeSqlStatement=null;
  await c.manual.detachManualAccount(bot(c),c.taikoId);
  const [[account]]=await c.pool.query('SELECT bot_identity_key FROM taiko_manual_accounts WHERE taiko_id=?',[c.taikoId]);assert.equal(account.bot_identity_key,other);
  const [[slot]]=await c.pool.query('SELECT slot_index,is_current FROM bind WHERE qq=?',[c.botKey]);assert.equal(slot.slot_index,1);assert.equal(slot.is_current,1);
  await assertSourceUnchanged(c,beforeSource);
}));

for(const kind of ['issue','claim','detach']) {
  test(`lost actual ${kind} COMMIT acknowledgement uses a matching nonce receipt and preserves source`, {timeout:20000},async()=>fixture(async c=>{
    let code;
    if(kind!=='issue')code=await c.manual.issueManualClaimCode(c.owner,c.taikoId);
    if(kind==='detach')await c.manual.claimManualAccount(bot(c),code.code);
    const commits=c.state.commits,beforeSource=await sourceSnapshot(c),receipts=await receiptCount(c,kind);
    c.state.afterSqlCommit=()=>{throw new Error('Synthetic lost grant COMMIT response');};
    const result=kind==='issue'?await c.manual.issueManualClaimCode(c.owner,c.taikoId):kind==='claim'?await c.manual.claimManualAccount(bot(c),code.code):await c.manual.detachManualAccount(c.owner,c.taikoId);
    assert.equal(result.ok,true);assert.equal(c.state.commits-commits,1);assert.equal(await receiptCount(c,kind)-receipts,1);await assertSourceUnchanged(c,beforeSource);
    if(kind!=='issue'){
      const retry=kind==='claim'?await c.manual.claimManualAccount(bot(c),code.code):await c.manual.detachManualAccount(c.owner,c.taikoId);
      assert.deepEqual(retry,result);assert.equal(c.state.commits-commits,1);
    }
    const [rows]=await c.pool.query('SELECT * FROM taiko_manual_grant_receipts WHERE taiko_id=?',[c.taikoId]);
    assert.ok(!encodeSqlRecoveryBackup({rows}).includes(kind==='issue'?result.code:code.code),'receipt must never contain a plaintext capability');
  }));
}

test('two simultaneous same-actor claims grant once, replay without switching a later selected slot, and reject another actor', {timeout:20000},async()=>fixture(async c=>{
  const code=await c.manual.issueManualClaimCode(c.owner,c.taikoId),beforeSource=await sourceSnapshot(c),commits=c.state.commits;
  const results=await Promise.all([c.manual.claimManualAccount(bot(c),code.code),c.manual.claimManualAccount(bot(c),code.code)]);
  assert.deepEqual(results[0],results[1]);assert.equal(c.state.commits-commits,1);assert.equal(await receiptCount(c,'claim'),1);
  const aux='aux-'+c.taikoId.slice(-8);
  await c.pool.execute('UPDATE bind SET is_current=0 WHERE qq=?',[c.botKey]);
  await c.pool.execute("INSERT INTO bind (qq,id,source,slot_index,is_current) VALUES (?,?,'wahlap',2,1)",[c.botKey,aux]);
  await c.manual.claimManualAccount(bot(c),code.code);
  const [[current]]=await c.pool.query('SELECT id FROM bind WHERE qq=? AND is_current=1',[c.botKey]);assert.equal(current.id,aux);
  await assert.rejects(c.manual.claimManualAccount({kind:'bot',identityKey:c.botKey+'-other'},code.code),e=>e.statusCode===400);
  await assertSourceUnchanged(c,beforeSource);
}));

test('two different actors cannot spend the same capability twice', {timeout:20000},async()=>fixture(async c=>{
  const code=await c.manual.issueManualClaimCode(c.owner,c.taikoId),commits=c.state.commits,beforeSource=await sourceSnapshot(c);
  const results=await Promise.allSettled([c.manual.claimManualAccount(bot(c),code.code),c.manual.claimManualAccount({kind:'bot',identityKey:c.botKey+'-two'},code.code)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
  assert.equal(c.state.commits-commits,1);assert.equal(await receiptCount(c,'claim'),1);await assertSourceUnchanged(c,beforeSource);
}));

for(const kind of ['expired','consumed','source-substituted']) {
  test(`a code ${kind} while its request waits for actual source EX cannot attach a grant`, {timeout:20000},async()=>fixture(async c=>{
    const code=await c.manual.issueManualClaimCode(c.owner,c.taikoId),beforeSource=await sourceSnapshot(c);
    const [[row]]=await c.pool.query('SELECT id,taiko_id FROM taiko_manual_claim_codes WHERE taiko_id=? AND consumed_at IS NULL',[c.taikoId]);
    const held=await openPublicationLease({root:c.config.userdataDir,repoRoot:c.config.repoRoot,identity:c.taikoId,mode:'write'});
    let notify,timer;
    const lookup=new Promise(resolve=>{notify=resolve;});
    c.state.afterExecute=sql=>{if(sql.includes('WHERE code_hash = ? AND consumed_at IS NULL'))notify();};
    try {
      const rejected=assert.rejects(c.manual.claimManualAccount(bot(c),code.code),e=>e.statusCode===409);
      await Promise.race([lookup,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Owned code lookup deadline')),2000);})]);clearTimeout(timer);
      if(kind==='expired')await c.pool.execute('UPDATE taiko_manual_claim_codes SET expires_at=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE id=?',[row.id]);
      if(kind==='consumed')await c.pool.execute('UPDATE taiko_manual_claim_codes SET consumed_at=NOW() WHERE id=?',[row.id]);
      if(kind==='source-substituted')await c.pool.execute('UPDATE taiko_manual_claim_codes SET taiko_id=? WHERE id=?',['98'+c.taikoId.slice(2,-1)+(c.taikoId.endsWith('0')?'1':'0'),row.id]);
      await held.close();await rejected;
      const [[bound]]=await c.pool.query('SELECT COUNT(*) AS n FROM bind WHERE id=?',[c.taikoId]);assert.equal(bound.n,0);
      assert.equal(await receiptCount(c,'claim'),0);await assertSourceUnchanged(c,beforeSource);
    } finally {clearTimeout(timer);await held.close();c.state.afterExecute=null;await c.pool.execute('UPDATE taiko_manual_claim_codes SET taiko_id=? WHERE id=?',[row.taiko_id,row.id]);}
  }));
}

test('real SQL driver failure during a grant transaction rolls back and returns no SQL or private cause', {timeout:20000},async()=>fixture(async c=>{
  const code=await c.manual.issueManualClaimCode(c.owner,c.taikoId),before=await sqlSnapshot(c),beforeSource=await sourceSnapshot(c);
  c.state.afterSqlStatement=async sql=>{if(sql.startsWith('UPDATE taiko_manual_claim_codes SET consumed_at'))await c.pool.execute('SELECT missing_grant_column FROM taiko_manual_accounts WHERE taiko_id=?',[c.taikoId]);};
  await assert.rejects(c.manual.claimManualAccount(bot(c),code.code),e=>e.statusCode===503&&!('sql' in e)&&!('cause' in e));
  assert.equal(await sqlSnapshot(c),before);assert.equal(await receiptCount(c,'claim'),0);await assertSourceUnchanged(c,beforeSource);
}));

for(const kind of ['issue','claim','detach']) {
  test(`${kind} retains its captured pool when runtime-path resolution sees shutdown-style global replacement`, {timeout:20000},async()=>fixture(async c=>{
    let code;
    if(kind!=='issue')code=await c.manual.issueManualClaimCode(c.owner,c.taikoId);
    if(kind==='detach')await c.manual.claimManualAccount(bot(c),code.code);
    const captured=globalThis.__goalSqlRuntime.db,config=globalThis.useRuntimeConfig;
    const beforeSource=await sourceSnapshot(c);
    let replaced=false,resolutions=0;
    globalThis.useRuntimeConfig=()=>{
      // Claim hashes its input before capturing the pool; paths resolve next.
      if(++resolutions>=(kind==='claim'?2:1)) {
        replaced=true;
        globalThis.__goalSqlRuntime.db={execute:()=>{throw new Error('Must not resolve a fresh global pool');},getConnection:()=>{throw new Error('Must not resolve a fresh global pool');}};
      }
      return config();
    };
    try {
      const result=kind==='issue'?await c.manual.issueManualClaimCode(c.owner,c.taikoId):kind==='claim'?await c.manual.claimManualAccount(bot(c),code.code):await c.manual.detachManualAccount(c.owner,c.taikoId);
      assert.equal(result.ok,true);assert.equal(replaced,true);
    } finally {globalThis.useRuntimeConfig=config;globalThis.__goalSqlRuntime.db=captured;}
    await assertSourceUnchanged(c,beforeSource);
  }));
}

async function ownedGrantCrash(c,kind,point,code) {
  const options=resolve(c.root,'grant-crash-options.json'),childFile=resolve(c.root,'grant-crash-child.mjs');
  await writeFile(options,JSON.stringify({kind,point,code:code?.code,owner:kind==='claim'?bot(c):c.owner,taikoId:c.taikoId,config:c.config}),{mode:0o600});
  await writeFile(childFile,`
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import mysql from ${JSON.stringify(import.meta.resolve('mysql2/promise'))};
import {installGoalSqlRuntime} from ${JSON.stringify(new URL('./fixtures/goalSqlRuntime.mjs',import.meta.url).href)};
assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1');assert.match(String(process.env.TAIKO_DB_NAME||''),/_test$/);
const options=JSON.parse(await readFile(process.argv[2],'utf8'));
const pool=mysql.createPool({host:process.env.TAIKO_DB_HOST,port:Number(process.env.TAIKO_DB_PORT||3306),user:process.env.TAIKO_DB_USER,password:process.env.TAIKO_DB_PASSWORD,database:process.env.TAIKO_DB_NAME,connectionLimit:2});
const [[identity]]=await pool.query('SELECT DATABASE() AS name');assert.match(identity.name,/_test$/);assert.equal(identity.name,process.env.TAIKO_DB_NAME);
let scope;
const db={query:(...args)=>pool.query(...args),execute:(...args)=>pool.execute(...args),async getConnection(){
 assert.equal(scope.currentScoreScope(options.taikoId)?.mode,'write');
 const connection=await pool.getConnection();
 return {beginTransaction:()=>connection.beginTransaction(),rollback:()=>connection.rollback(),destroy:()=>connection.destroy(),release:()=>connection.release(),
  async execute(sql,args){const result=await connection.execute(sql,args);if(options.point==='before-commit'&&sql.includes('INSERT INTO taiko_manual_grant_receipts'))process.exit(73);return result;},
  async commit(){await connection.commit();if(options.point==='after-commit')process.exit(73);}
 };
}};
installGoalSqlRuntime(db,options.config);globalThis.fetch=async()=>{throw new Error('Network forbidden during owned grant crash');};
scope=await import(${JSON.stringify(new URL('../server/services/taiko-domain/publication.ts',import.meta.url).href)});
const service=await import(${JSON.stringify(new URL('../server/utils/account/manual.ts',import.meta.url).href)});
if(options.kind==='issue')await service.issueManualClaimCode(options.owner,options.taikoId);
if(options.kind==='claim')await service.claimManualAccount(options.owner,options.code);
if(options.kind==='detach')await service.detachManualAccount(options.owner,options.taikoId);
process.exit(74);
`,{mode:0o600});
  await assert.rejects(execFileAsync(process.execPath,['--experimental-strip-types',childFile,options],{cwd:new URL('../',import.meta.url),timeout:15000,maxBuffer:8192}),e=>e.code===73);
}
for(const kind of ['issue','claim','detach'])for(const point of ['before-commit','after-commit']) {
  test(`actual owned ${kind} process death ${point} preserves atomic SQL and supports the correct retry`, {timeout:25000},async()=>fixture(async c=>{
    const code=await c.manual.issueManualClaimCode(c.owner,c.taikoId);
    if(kind==='detach')await c.manual.claimManualAccount(bot(c),code.code);
    const beforeSource=await sourceSnapshot(c),before=await sqlSnapshot(c),receipts=await receiptCount(c,kind);
    await ownedGrantCrash(c,kind,point,code);
    await assertSourceUnchanged(c,beforeSource);
    assert.equal(await receiptCount(c,kind)-receipts,point==='before-commit'?0:1);
    if(point==='before-commit')assert.equal(await sqlSnapshot(c),before);
    if(kind==='issue') {
      if(point==='before-commit')assert.equal((await c.manual.claimManualAccount(bot(c),code.code)).ok,true);
      else {
        await assert.rejects(c.manual.claimManualAccount(bot(c),code.code),e=>e.statusCode===400);
        const fresh=await c.manual.issueManualClaimCode(c.owner,c.taikoId);
        assert.equal((await c.manual.claimManualAccount(bot(c),fresh.code)).ok,true);
      }
    } else {
      const commits=c.state.commits;
      const result=kind==='claim'?await c.manual.claimManualAccount(bot(c),code.code):await c.manual.detachManualAccount(c.owner,c.taikoId);
      assert.equal(result.ok,true);assert.equal(c.state.commits-commits,point==='before-commit'?1:0);
    }
    await assertSourceUnchanged(c,beforeSource);
  }));
}
