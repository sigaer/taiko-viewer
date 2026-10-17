// Real SQL + center bridge restoration; only explicitly opted-in owned fixtures.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {access,cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {manualSqlFixture as fixture,manualSourceSnapshot as snapshot,manualScoreInput as input} from './fixtures/manualSqlRuntime.mjs';
import {populate,receipt,rowCounts} from './fixtures/manualLifecycleRuntime.mjs';
import {encodeSqlRecoveryBackup} from '../server/infrastructure/taiko-publication/sql-backup.ts';
// The real service imports after the native runtime resolver/config is installed.
const restore=async(...args)=>(await import('../server/services/account/manual-recovery.ts')).restoreDeletedManualSource(...args);
const recover=async(...args)=>(await import('../server/services/account/manual-recovery.ts')).recoverOneManualSourceRestoration(...args);
const recoverOneManualSourceDeletion=async(...args)=>(await import('../server/services/account/manual-lifecycle.ts')).recoverOneManualSourceDeletion(...args);
const recoverOneManualSourceLifecycle=async(...args)=>(await import('../server/services/account/source-lifecycle-recovery.ts')).recoverOneManualSourceLifecycle(...args);
const execFileAsync=promisify(execFile);
const digest=raw=>createHash('sha256').update(raw).digest('hex');

async function authoritySnapshot(c,f) {
  const result={};
  for(const [table,where,args] of [
    ['taiko_manual_accounts','taiko_id=?',[c.taikoId]],['web_taiko_bindings','id=?',[f.id]],['bind','id=?',[c.taikoId]],
    ['web_player_goals','binding_id=?',[f.id]],['web_growth_measurements','binding_id=?',[f.id]],
    ['web_growth_recent_cursors','binding_id=?',[f.id]],['web_taiko_binding_mydon_showcase_titles','binding_id=?',[f.id]],
    ['web_song_locks','taiko_id=?',[c.taikoId]]
  ]) {
    const [rows]=await c.pool.query(`SELECT * FROM ${table} WHERE ${where}`,args);
    result[table]=rows;
  }
  return digest(encodeSqlRecoveryBackup(result));
}
async function deletePrepared(c) {
  const f=await populate(c);
  f.authorityHash=await authoritySnapshot(c,f);
  await c.manual.permanentlyDeleteManualAccount(c.owner,c.taikoId,true);
  f.receipt=await receipt(c);
  return f;
}
async function assertUnavailable(c,f,status) {
  for(const count of Object.values(await rowCounts(c,f.id))) assert.equal(count,0);
  assert.equal((await receipt(c)).status,status);
  await assert.rejects(c.manual.upsertManualScore(c.owner,c.taikoId,input),e=>e.statusCode===403);
}
async function assertRestored(c,f,exactSql=true) {
  assert.equal((await receipt(c)).status,'restored');
  assert.deepEqual(await snapshot(c),f.before);
  assert.equal(await readFile(f.daily,'utf8'),f.dailyRaw);
  if(exactSql) assert.equal(await authoritySnapshot(c,f),f.authorityHash);
  const counts=await rowCounts(c,f.id);
  assert.equal(counts.claims,0,'old claim capabilities must remain consumed/revoked');
  for(const [name,count] of Object.entries(counts)) if(name!=='claims') assert.ok(count>0,name);
}

test('actual SQL/C/H/daily round-trip preserves all bytes, fields and product IDs, then restored deletion is independent', {timeout:25000},async()=>fixture(async c=>{
  const f=await deletePrepared(c);
  assert.deepEqual(await recover(undefined,f.receipt.operation_id),{recovered:false});
  assert.deepEqual(await recoverOneManualSourceLifecycle(undefined,f.receipt.operation_id),{recovered:false});
  const beforeCommits=c.state.commits;
  assert.deepEqual(await restore(f.receipt.operation_id),{ok:true,operationId:f.receipt.operation_id});
  assert.equal(c.state.commits-beforeCommits,1);
  await assertRestored(c,f);
  assert.deepEqual(await restore(f.receipt.operation_id),{ok:true,operationId:f.receipt.operation_id});
  assert.equal(c.state.commits-beforeCommits,1);
  assert.deepEqual(await recoverOneManualSourceDeletion(undefined,f.receipt.operation_id),{recovered:false});
  c.tick();
  await c.manual.upsertManualScore(c.owner,c.taikoId,{...input,values:{...input.values,high_score:900000}});
  const changed=await snapshot(c);
  await restore(f.receipt.operation_id);
  assert.deepEqual(await snapshot(c),changed,'idempotent receipt must not roll back subsequent scores');
  await c.manual.permanentlyDeleteManualAccount(c.owner,c.taikoId,true);
  const newer=await receipt(c);
  assert.notEqual(newer.operation_id,f.receipt.operation_id);
  assert.equal(newer.status,'published');
  await assert.rejects(restore(f.receipt.operation_id),e=>e.statusCode===503);
}));

test('restoration preserves a newer Viewer current selection and bot slot while restoring legacy multiple bot grants', {timeout:25000},async()=>fixture(async c=>{
  const f=await populate(c);
  const otherBot=c.botKey+'-two';
  try {
    await c.pool.execute("INSERT INTO bind (qq,id,source,slot_index,is_current) VALUES (?,?,'manual',1,1)",[otherBot,c.taikoId]);
    await c.manual.permanentlyDeleteManualAccount(c.owner,c.taikoId,true);
    const r=await receipt(c);
    const aux='aux-'+c.taikoId.slice(-8);
    const [other]=await c.pool.execute("INSERT INTO web_taiko_bindings (user_id,taiko_id,source,is_current) VALUES (?,?,'wahlap',1)",[c.user,aux]);
    await c.pool.execute("INSERT INTO bind (qq,id,source,slot_index,is_current) VALUES (?,?,'wahlap',1,1)",[otherBot,aux]);
    await restore(r.operation_id);
    assert.deepEqual(await snapshot(c),f.before);
    const [[selected]]=await c.pool.query('SELECT is_current FROM web_taiko_bindings WHERE id=?',[other.insertId]);
    const [[restored]]=await c.pool.query('SELECT is_current FROM web_taiko_bindings WHERE id=?',[f.id]);
    assert.equal(selected.is_current,1);assert.equal(restored.is_current,0);
    const [slots]=await c.pool.query('SELECT id,slot_index,is_current FROM bind WHERE qq=? ORDER BY slot_index',[otherBot]);
    assert.equal(slots[0].id,aux);assert.equal(slots[0].is_current,1);
    assert.equal(slots[1].id,c.taikoId);assert.equal(slots[1].slot_index,2);assert.equal(slots[1].is_current,0);
    assert.equal((await rowCounts(c,f.id)).bot,2);
  } finally {await c.pool.execute('DELETE FROM bind WHERE qq=?',[otherBot]);}
}));

for(const failedRollback of [false,true]) {
  test(`late actual restoration SQL failure keeps all grants revoked; rollback connection discarded=${failedRollback}`, {timeout:25000},async()=>fixture(async c=>{
    const f=await deletePrepared(c);
    const expected=new Error('Synthetic late restore SQL failure');
    c.state.beforeSqlStatement=sql=>{if(sql.startsWith('INSERT INTO web_growth_recent_cursors'))throw expected;};
    c.state.failRollback=failedRollback;
    await assert.rejects(restore(f.receipt.operation_id),e=>e===expected);
    await assertUnavailable(c,f,'restoring');
    assert.equal(c.state.discardedConnections,failedRollback?1:0);
    assert.deepEqual(await snapshot(c),f.before);
    assert.equal(await readFile(f.daily,'utf8'),f.dailyRaw);
    await assert.rejects(c.manual.permanentlyDeleteManualAccount(c.owner,c.taikoId,true),e=>e.statusCode===503);
    assert.deepEqual(await recoverOneManualSourceDeletion(undefined,f.receipt.operation_id),{recovered:false});
    c.state.beforeSqlStatement=null;c.state.failRollback=false;
    assert.deepEqual(await recoverOneManualSourceLifecycle(undefined,f.receipt.operation_id),{recovered:true});
    await assertRestored(c,f);
  }));
}

test('lost actual restoration COMMIT acknowledgement proves restored receipt without double insertion', {timeout:25000},async()=>fixture(async c=>{
  const f=await deletePrepared(c);
  c.state.afterSqlCommit=()=>{throw new Error('Synthetic lost restore COMMIT ack');};
  assert.equal((await restore(f.receipt.operation_id)).ok,true);
  await assertRestored(c,f);
  const count=c.state.commits;
  await restore(f.receipt.operation_id);
  assert.equal(c.state.commits,count);
}));

test('two independent restore requests share the same source EX and one authority transaction', {timeout:25000},async()=>fixture(async c=>{
  const f=await deletePrepared(c);
  const before=c.state.commits;
  const results=await Promise.all([restore(f.receipt.operation_id),restore(f.receipt.operation_id)]);
  assert.deepEqual(results[0],results[1]);
  assert.equal(c.state.commits-before,1);
  await assertRestored(c,f);
}));

test('private SQL driver diagnostics are replaced by a generic lifecycle error after real transaction rollback', {timeout:25000},async()=>fixture(async c=>{
  const f=await populate(c);
  const error=Object.assign(new Error('PRIVATE_SQL_RECOVERY_PAYLOAD'),{code:'ER_SYNTHETIC',sql:'PRIVATE_SQL_RECOVERY_PAYLOAD',sqlMessage:'PRIVATE_SQL_RECOVERY_PAYLOAD'});
  const safe=error=>error.statusCode===503&&!error.message.includes('PRIVATE_SQL_RECOVERY_PAYLOAD')&&!('sql' in error)&&!('cause' in error);
  c.state.beforeSqlStatement=sql=>{if(sql.startsWith('DELETE FROM taiko_manual_accounts'))throw error;};
  await assert.rejects(c.manual.permanentlyDeleteManualAccount(c.owner,c.taikoId,true),safe);
  assert.equal(await receipt(c),undefined);
  assert.deepEqual(await snapshot(c),f.before);
  c.state.beforeSqlStatement=null;
  await c.manual.permanentlyDeleteManualAccount(c.owner,c.taikoId,true);
  const r=await receipt(c);
  c.state.beforeSqlStatement=sql=>{if(sql.startsWith('INSERT INTO web_growth_recent_cursors'))throw error;};
  await assert.rejects(restore(r.operation_id),safe);
  await assertUnavailable(c,f,'restoring');
  c.state.beforeSqlStatement=null;
  await recover(undefined,r.operation_id);
}));

for(const kind of ['pending','restoring']) {
  test(`combined ${kind} recovery keeps its captured SQL pool across shutdown-style global replacement`, {timeout:25000},async()=>fixture(async c=>{
    const f=await populate(c);
    if(kind==='pending') {
      c.state.afterSqlCommit=()=>{c.scopeModule.currentScoreScope(c.taikoId).lease.purgeBackupArchives=async()=>{throw new Error('Synthetic interruption');};};
      await assert.rejects(c.manual.permanentlyDeleteManualAccount(c.owner,c.taikoId,true));
      c.state.afterSqlCommit=null;
    } else {
      await c.manual.permanentlyDeleteManualAccount(c.owner,c.taikoId,true);
      c.state.beforeSqlStatement=sql=>{if(sql.startsWith('INSERT INTO web_growth_recent_cursors'))throw new Error('Synthetic interrupted restoration');};
      await assert.rejects(restore((await receipt(c)).operation_id));
      c.state.beforeSqlStatement=null;
    }
    const r=await receipt(c),captured=globalThis.__goalSqlRuntime.db;
    let replaced=false;
    c.state.afterExecute=sql=>{if(sql.startsWith('SELECT operation_id,status,work_kind FROM')){
      replaced=true;
      globalThis.__goalSqlRuntime.db={execute:()=>{throw new Error('Must not resolve a fresh pool after shutdown');},getConnection:()=>{throw new Error('Must not resolve a fresh pool after shutdown');}};
    }};
    try {
      assert.deepEqual(await recoverOneManualSourceLifecycle(undefined,r.operation_id),{recovered:true});
      assert.equal(replaced,true);
    } finally {globalThis.__goalSqlRuntime.db=captured;c.state.afterExecute=null;}
    assert.equal((await receipt(c)).status,kind==='pending'?'published':'restored');
  }));
}

for(const kind of ['sql-checksum','sql-cross-source','file-checksum','different-source','different-daily','id-collision','deleted-owner']) {
  test(`actual restore rejects ${kind} and preserves the conflicting state without reauthorizing`, {timeout:25000},async()=>fixture(async c=>{
    const f=await deletePrepared(c);
    let expectedSource=await snapshot(c),expectedDaily;
    const r=f.receipt;
    if(kind==='sql-checksum')await c.pool.execute('UPDATE taiko_source_lifecycle SET sql_backup_sha256=? WHERE operation_id=?',['f'.repeat(64),r.operation_id]);
    if(kind==='sql-cross-source') {
      const data=typeof r.sql_backup==='string'?JSON.parse(r.sql_backup):r.sql_backup;
      data.bindings[0].taiko_id='980000000000000000';
      const raw=encodeSqlRecoveryBackup(data);
      await c.pool.execute('UPDATE taiko_source_lifecycle SET sql_backup=?,sql_backup_sha256=? WHERE operation_id=?',[raw,digest(raw),r.operation_id]);
    }
    if(kind==='file-checksum')await writeFile(resolve(c.config.userdataDir,'.manual_deleted',`${c.taikoId}-${r.backup_key}`,`${c.taikoId}data.json`),'corrupt private backup');
    if(kind==='different-source') {
      await c.shared.writeUserdataWithHistory(c.taikoId,{profile:{userid:c.taikoId},songs:[]},'manual-score');
      expectedSource=await snapshot(c);
    }
    if(kind==='different-daily') {expectedDaily='new frozen measurement';await writeFile(f.daily,expectedDaily);}
    if(kind==='id-collision')await c.pool.execute("INSERT INTO web_taiko_bindings (id,user_id,taiko_id,source,is_current) VALUES (?,?,?,'wahlap',1)",[f.id,c.user,'aux-'+c.taikoId.slice(-8)]);
    if(kind==='deleted-owner')await c.pool.execute('DELETE FROM web_user_accounts WHERE id=?',[c.user]);
    await assert.rejects(restore(r.operation_id),e=>e.statusCode===503&&!e.message.includes(c.taikoId));
    const [[grants]]=await c.pool.query('SELECT COUNT(*) AS n FROM taiko_manual_accounts WHERE taiko_id=?',[c.taikoId]);
    assert.equal(grants.n,0);
    assert.deepEqual(await snapshot(c),expectedSource);
    if(expectedDaily)assert.equal(await readFile(f.daily,'utf8'),expectedDaily);
    else await assert.rejects(access(f.daily),{code:'ENOENT'});
    assert.equal((await receipt(c)).status,kind==='different-daily'?'restoring':'published');
  }));
}

test('verified private backup alone restores into a fresh configured root without the old canonical object store', {timeout:25000},async()=>fixture(async c=>{
  const f=await deletePrepared(c);
  const name=`${c.taikoId}-${f.receipt.backup_key}`;
  const fresh=resolve(c.root,'fresh-userdata');
  await mkdir(resolve(fresh,'.manual_deleted'),{recursive:true,mode:0o700});
  await cp(resolve(c.config.userdataDir,'.manual_deleted',name),resolve(fresh,'.manual_deleted',name),{recursive:true});
  c.config.userdataDir=fresh;
  f.daily=resolve(fresh,c.taikoId,'daily-ability-v1-top20.json');
  await restore(f.receipt.operation_id);
  await assertRestored(c,f);
}));

async function ownedRestoreCrash(c,f,point) {
  const options=resolve(c.root,'restore-crash-options.json'),childFile=resolve(c.root,'restore-crash-child.mjs');
  await writeFile(options,JSON.stringify({point,operationId:f.receipt.operation_id,taikoId:c.taikoId,config:c.config}),{mode:0o600});
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
const db={query:(...args)=>pool.query(...args),async execute(sql,args){
 const result=await pool.execute(sql,args);
 if(sql.startsWith("UPDATE taiko_source_lifecycle SET status='restoring'")){
  if(options.point==='after-reservation')process.exit(73);
  if(options.point==='after-files'){const lease=scope.currentScoreScope(options.taikoId).lease;const restore=lease.restoreBackup;lease.restoreBackup=async(...args)=>{await restore(...args);process.exit(73);};}
 }
 return result;
},async getConnection(){
 assert.equal(scope.currentScoreScope(options.taikoId)?.mode,'write');
 const connection=await pool.getConnection();
 return {beginTransaction:()=>connection.beginTransaction(),rollback:()=>connection.rollback(),destroy:()=>connection.destroy(),release:()=>connection.release(),
  async execute(sql,args){const result=await connection.execute(sql,args);if(options.point==='before-authority-commit'&&sql.startsWith("UPDATE taiko_source_lifecycle SET status='restored'"))process.exit(73);return result;},
  async commit(){await connection.commit();if(options.point==='after-authority-commit')process.exit(73);}
 };
}};
installGoalSqlRuntime(db,options.config);
scope=await import(${JSON.stringify(new URL('../server/services/taiko-domain/publication.ts',import.meta.url).href)});
const {restoreDeletedManualSource}=await import(${JSON.stringify(new URL('../server/services/account/manual-recovery.ts',import.meta.url).href)});
await restoreDeletedManualSource(options.operationId);process.exit(74);
`,{mode:0o600});
  await assert.rejects(execFileAsync(process.execPath,['--experimental-strip-types',childFile,options],{cwd:new URL('../',import.meta.url),timeout:15000,maxBuffer:8192}),e=>e.code===73);
}
for(const point of ['after-reservation','after-files','before-authority-commit','after-authority-commit']) {
  test(`actual owned restore process death ${point} never grants a partial restore and resumes idempotently`, {timeout:30000},async()=>fixture(async c=>{
    const f=await deletePrepared(c);
    await ownedRestoreCrash(c,f,point);
    if(point==='after-authority-commit') {
      await assertRestored(c,f);
      assert.deepEqual(await recover(undefined,f.receipt.operation_id),{recovered:false});
    } else {
      await assertUnavailable(c,f,'restoring');
      if(point==='after-reservation')assert.equal((await snapshot(c)).current,null);
      else {assert.deepEqual(await snapshot(c),f.before);assert.equal(await readFile(f.daily,'utf8'),f.dailyRaw);}
      assert.deepEqual(await recoverOneManualSourceDeletion(undefined,f.receipt.operation_id),{recovered:false});
      assert.deepEqual(await recoverOneManualSourceLifecycle(undefined,f.receipt.operation_id),{recovered:true});
      await assertRestored(c,f);
    }
    await restore(f.receipt.operation_id);
    await assertRestored(c,f);
  }));
}
