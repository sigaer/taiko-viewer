// Actual owned _test SQL + kernel publication leases; no production data/network.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash,randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {manualSqlFixture as fixture,manualSourceSnapshot} from './fixtures/manualSqlRuntime.mjs';
import {openPublicationLease} from '../server/infrastructure/taiko-publication/client.ts';
import {encodeSqlRecoveryBackup} from '../server/infrastructure/taiko-publication/sql-backup.ts';
const execFileAsync=promisify(execFile);
const hash=value=>createHash('sha256').update(value).digest('hex');

async function ordinary(c) {
  const taikoId='ext-'+randomUUID().replaceAll('-','').slice(0,14);
  await c.shared.writeUserdataWithHistory(taikoId,{_meta:{source:'wahlap'},songs:[]},'wahlap');
  const [[prior]]=await c.pool.query('SELECT id FROM web_taiko_bindings WHERE user_id=?',[c.user]);
  await c.pool.execute('UPDATE web_taiko_bindings SET is_current=0 WHERE user_id=?',[c.user]);
  const [row]=await c.pool.execute("INSERT INTO web_taiko_bindings (user_id,taiko_id,source,is_current) VALUES (?,?,'wahlap',1)",[c.user,taikoId]);
  return {...c,taikoId,bindingId:row.insertId,priorBindingId:prior.id,
    binding:await import('../server/utils/account/bindings.ts')};
}
async function source(c) {
  return c.scopeModule.withDomainScoreRead(c.taikoId,async()=>({body:await manualSourceSnapshot(c),
    commitId:c.scopeModule.scorePublication(c.taikoId)?.commitId,sequence:c.scopeModule.scorePublication(c.taikoId)?.sequence}));
}
async function sqlSnapshot(c) {
  const result={};
  for(const table of ['web_taiko_bindings','web_player_goals','web_growth_measurements','web_growth_recent_cursors','web_song_locks','web_taiko_binding_revocations']) {
    const [rows]=await c.pool.query(`SELECT * FROM ${table} WHERE user_id=? ORDER BY ${table==='web_taiko_binding_revocations'?'operation_id':table==='web_growth_recent_cursors'?'binding_id':'id'}`,[c.user]);
    result[table]=rows;
  }
  const [titles]=await c.pool.query('SELECT * FROM web_taiko_binding_mydon_showcase_titles WHERE binding_id=? ORDER BY id',[c.bindingId]);
  result.titles=titles;
  return hash(encodeSqlRecoveryBackup(result));
}
async function populate(c) {
  const id=c.bindingId;
  await c.pool.execute(`INSERT INTO web_player_goals (user_id,binding_id,song_id,difficulty_type,goal_type,source,source_mode,source_rank,source_revision,source_generated_at,goal_data,created_at,updated_at)
    VALUES (?,?,100,4,'score-pb','today-plan','dimension',1,?,NOW(3),'{}',NOW(3),NOW(3))`,[c.user,id,'a'.repeat(64)]);
  await c.pool.execute(`INSERT INTO web_growth_measurements (user_id,binding_id,score_revision,measurement_version,algorithm_version,rating,dimensions_json,focus,sample_count,availability_state,captured_at)
    VALUES (?,?,?,1,'synthetic',10,'[]','stamina',30,'ready',NOW(3))`,[c.user,id,'b'.repeat(64)]);
  await c.pool.execute(`INSERT INTO web_growth_recent_cursors (user_id,binding_id,cursor_token,observation_revision,observation_observed_at,algorithm_version)
    VALUES (?,?,?,?,NOW(3),'synthetic')`,[c.user,id,'c'.repeat(64),'d'.repeat(64)]);
  await c.pool.execute('INSERT INTO web_song_locks (user_id,taiko_id,song_no,level,is_locked) VALUES (?,?,100,4,1)',[c.user,c.taikoId]);
  await c.pool.execute('INSERT INTO web_taiko_binding_mydon_showcase_titles (binding_id,slot_index,title_name) VALUES (?,1,?)',[id,'Synthetic title']);
}
async function assertRemoved(c) {
  for(const table of ['web_taiko_bindings','web_player_goals','web_growth_measurements','web_growth_recent_cursors','web_taiko_binding_mydon_showcase_titles']) {
    const [[row]]=await c.pool.query(`SELECT COUNT(*) AS n FROM ${table} WHERE ${table==='web_taiko_bindings'?'id':'binding_id'}=?`,[c.bindingId]);
    assert.equal(row.n,0);
  }
  const [[locks]]=await c.pool.query('SELECT COUNT(*) AS n FROM web_song_locks WHERE user_id=? AND taiko_id=?',[c.user,c.taikoId]);assert.equal(locks.n,0);
  const [[current]]=await c.pool.query('SELECT id FROM web_taiko_bindings WHERE user_id=? AND is_current=1',[c.user]);assert.equal(current.id,c.priorBindingId);
}
function deferred() { let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve}; }
async function bounded(promise) {let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Owned race deadline')),3000);})]);}finally{clearTimeout(timer);}}
async function queued(c,operation,mutation) {
  const held=await openPublicationLease({root:c.config.userdataDir,repoRoot:c.config.repoRoot,identity:c.taikoId,mode:'write'});
  const lookup=deferred();
  c.state.afterExecute=sql=>{if(!c.scopeModule.currentScoreScope()&&sql.includes('FROM web_taiko_bindings'))lookup.resolve();};
  const result=Promise.resolve().then(operation);
  result.catch(()=>{});
  try {await bounded(lookup.promise);await mutation();await held.close();return await result;}
  finally {await held.close();c.state.afterExecute=null;await result.catch(()=>{});}
}

test('ordinary removal cleans all scoped products, chooses current, and returns the original DTO in one COMMIT',{timeout:20000},()=>fixture(async context=>{
  const c=await ordinary(context);await populate(c);const before=await source(c),commits=c.state.commits;
  const expected={ok:true,removedTaikoId:c.taikoId,remainingCount:1};
  assert.deepEqual(await c.binding.removeBinding(c.user,c.bindingId),expected);
  assert.equal(c.state.commits-commits,1);await assertRemoved(c);
  assert.deepEqual(await c.binding.removeBinding(c.user,c.bindingId),expected);assert.equal(c.state.commits-commits,1);
  assert.deepEqual(await source(c),before);
  const [[receipt]]=await c.pool.query('SELECT * FROM web_taiko_binding_revocations WHERE user_id=?',[c.user]);
  assert.deepEqual(Object.keys(receipt).sort(),['operation_id','user_id','binding_id','taiko_id','source','remaining_count','created_at'].sort());
}));

for(const point of ['cleanup','selection','receipt','driver','failed-rollback'])test(`ordinary removal ${point} failure leaves every authority/product/current unchanged`,{timeout:20000},()=>fixture(async context=>{
  const c=await ordinary(context);await populate(c);const before=await sqlSnapshot(c),beforeSource=await source(c),commits=c.state.commits;
  c.state.beforeSqlStatement=async sql=>{
    if(point==='cleanup'&&sql.startsWith('DELETE FROM web_growth_measurements'))throw new Error('Synthetic cleanup failure');
    if(point==='selection'&&sql.startsWith('UPDATE web_taiko_bindings SET is_current=1'))throw new Error('Synthetic selection failure');
    if(['receipt','failed-rollback'].includes(point)&&sql.includes('INSERT INTO web_taiko_binding_revocations'))throw new Error('Synthetic receipt failure');
    if(point==='driver'&&sql.includes('INSERT INTO web_taiko_binding_revocations'))await c.pool.execute('SELECT missing_private_binding_column FROM web_taiko_bindings WHERE user_id=?',[c.user]);
  };
  c.state.failRollback=point==='failed-rollback';
  await assert.rejects(c.binding.removeBinding(c.user,c.bindingId),error=>point!=='driver'||(error.statusCode===503&&!('sql' in error)&&!('cause' in error)));
  assert.equal(c.state.commits,commits);assert.equal(c.state.discardedConnections,point==='failed-rollback'?1:0);
  assert.equal(await sqlSnapshot(c),before);assert.deepEqual(await source(c),beforeSource);
}));

test('lost actual COMMIT ack and simultaneous retries acknowledge a single removal without a score publication',{timeout:20000},()=>fixture(async context=>{
  const c=await ordinary(context),before=await source(c),commits=c.state.commits;
  c.state.afterSqlCommit=()=>{throw new Error('Synthetic lost SQL ack');};
  const results=await Promise.all([c.binding.removeBinding(c.user,c.bindingId),c.binding.removeBinding(c.user,c.bindingId)]);
  assert.deepEqual(results[0],results[1]);assert.equal(c.state.commits-commits,1);await assertRemoved(c);assert.deepEqual(await source(c),before);
}));

for(const field of ['taiko_id','source','manual_account_id'])test(`same binding row with changed ${field} while queued fails before mutation`,{timeout:20000},()=>fixture(async context=>{
  const c=await ordinary(context),beforeSource=await source(c),commits=c.state.commits;
  await assert.rejects(queued(c,()=>c.binding.removeBinding(c.user,c.bindingId),()=>c.pool.execute(`UPDATE web_taiko_bindings SET ${field}=? WHERE id=?`,[field==='source'?'hiroba':field==='manual_account_id'?context.taikoId:'swap-'+randomUUID().slice(0,8),c.bindingId])),error=>error.statusCode===409);
  assert.equal(c.state.commits,commits);assert.deepEqual(await source(c),beforeSource);
  const [[row]]=await c.pool.query('SELECT COUNT(*) AS n FROM web_taiko_binding_revocations WHERE user_id=?',[c.user]);assert.equal(row.n,0);
}));

test('last-binding confirmation and current selection are decided after the actual Source wait',{timeout:20000},()=>fixture(async context=>{
  const c=await ordinary(context),before=await source(c);
  await assert.rejects(queued(c,()=>c.binding.removeBinding(c.user,c.bindingId),()=>c.pool.execute('DELETE FROM web_taiko_bindings WHERE id=?',[c.priorBindingId])),error=>error.statusCode===409);
  assert.deepEqual(await c.binding.removeBinding(c.user,c.bindingId,true),{ok:true,removedTaikoId:c.taikoId,remainingCount:0});assert.deepEqual(await source(c),before);
}));

test('a later selection is preserved when removal was queued; foreign/manual bindings remain unavailable',{timeout:20000},()=>fixture(async context=>{
  const c=await ordinary(context),before=await source(c);
  await assert.rejects(c.binding.removeBinding(c.user,c.priorBindingId),e=>e.statusCode===400);
  await assert.rejects(c.binding.removeBinding(c.user+1000000,c.bindingId,true),e=>e.statusCode===404);
  await queued(c,()=>c.binding.removeBinding(c.user,c.bindingId),async()=>{
    await c.pool.execute('UPDATE web_taiko_bindings SET is_current=0 WHERE user_id=?',[c.user]);
    await c.pool.execute('UPDATE web_taiko_bindings SET is_current=1 WHERE id=?',[c.priorBindingId]);
  });
  await assertRemoved(c);assert.deepEqual(await source(c),before);
}));

test('selection is a single SQL transaction with no Source acquisition; late errors cannot clear current',{timeout:20000},()=>fixture(async context=>{
  const c=await ordinary(context),before=await sqlSnapshot(c),beforeSource=await source(c),commits=c.state.commits;
  c.state.expectedSourceMode='none';
  c.state.beforeSqlStatement=sql=>{if(sql.startsWith('UPDATE web_taiko_bindings SET is_current=1'))throw new Error('Synthetic last selection failure');};
  await assert.rejects(c.binding.switchCurrentBinding(c.user,c.priorBindingId));assert.equal(await sqlSnapshot(c),before);assert.equal(c.state.commits,commits);
  c.state.beforeSqlStatement=null;assert.deepEqual(await c.binding.switchCurrentBinding(c.user,c.priorBindingId),{ok:true});assert.equal(c.state.commits-commits,1);
  const [[current]]=await c.pool.query('SELECT id FROM web_taiko_bindings WHERE user_id=? AND is_current=1',[c.user]);assert.equal(current.id,c.priorBindingId);
  await assert.rejects(c.binding.switchCurrentBinding(c.user,c.bindingId+1000000),e=>e.statusCode===404);
  assert.deepEqual(await source(c),beforeSource);
}));

for(const kind of ['removal','selection'])test(`${kind} retains the captured pool through shutdown-style global replacement`,{timeout:20000},()=>fixture(async context=>{
  const c=await ordinary(context),before=await source(c),db=globalThis.__goalSqlRuntime.db;
  let replaced=false;c.state.expectedSourceMode=kind==='selection'?'none':'write';
  c.state.afterSqlStatement=sql=>{if(sql.includes('FROM web_user_accounts')) {
    replaced=true;globalThis.__goalSqlRuntime.db={execute:()=>{throw new Error('Fresh global pool forbidden');},getConnection:()=>{throw new Error('Fresh global pool forbidden');}};
  }};
  if(kind==='removal')c.state.afterSqlCommit=()=>{throw new Error('Synthetic lost ack after pool replacement');};
  try {
    const result=kind==='removal'?await c.binding.removeBinding(c.user,c.bindingId):await c.binding.switchCurrentBinding(c.user,c.priorBindingId);
    assert.equal(result.ok,true);assert.equal(replaced,true);
  } finally {globalThis.__goalSqlRuntime.db=db;c.state.afterSqlStatement=null;c.state.afterSqlCommit=null;}
  assert.deepEqual(await source(c),before);
}));

test('removal replay fails closed for a corrupt receipt or a deleted owner',{timeout:20000},()=>fixture(async context=>{
  const c=await ordinary(context);await c.binding.removeBinding(c.user,c.bindingId);
  await c.pool.execute('UPDATE web_taiko_binding_revocations SET taiko_id=? WHERE user_id=?',['../../private',c.user]);
  await assert.rejects(c.binding.removeBinding(c.user,c.bindingId),e=>e.statusCode===503);
  await c.pool.execute('DELETE FROM web_user_accounts WHERE id=?',[c.user]);
  await assert.rejects(c.binding.removeBinding(c.user,c.bindingId),e=>e.statusCode===404);
}));

for(const name of ['overview','history','passport','recent'])for(const field of ['taiko_id','source','manual_account_id'])test(`${name} rejects changed ${field} after acquiring SH and before private files/compute`,{timeout:20000},()=>fixture(async context=>{
  const c=await ordinary(context),before=await source(c),calls=globalThis.__goalSqlRuntime.pythonCalls;
  const {getPlayerGrowthOverview}=await import('../server/services/account/growth.ts');
  const {getGrowthHistory}=await import('../server/services/growth-history/service.ts');
  const {getSkillPassport}=await import('../server/services/growth-passport/service.ts');
  const {getRecentGrowth}=await import('../server/services/growth-recent/service.ts');
  const {resolveGrowthHistoryRange}=await import('../server/services/growth-history/range.ts');
  const {resolveSkillPassportRange}=await import('../server/services/growth-passport/range.ts');
  const operation=()=>name==='overview'?getPlayerGrowthOverview(c.user):name==='history'?getGrowthHistory(c.user,resolveGrowthHistoryRange({days:7})):name==='passport'?getSkillPassport(c.user,resolveSkillPassportRange({range:30})):getRecentGrowth(c.user);
  await assert.rejects(queued(c,operation,()=>c.pool.execute(`UPDATE web_taiko_bindings SET ${field}=? WHERE id=?`,[field==='source'?'hiroba':field==='manual_account_id'?context.taikoId:'swap-'+randomUUID().slice(0,8),c.bindingId])),e=>e.statusCode===409);
  assert.equal(globalThis.__goalSqlRuntime.pythonCalls,calls);assert.deepEqual(await source(c),before);
  const [[measurements]]=await c.pool.query('SELECT COUNT(*) AS n FROM web_growth_measurements WHERE user_id=?',[c.user]);assert.equal(measurements.n,0);
}));

test('binding removal waits for an actual long Growth SH request; completed DTO precedes revocation',{timeout:20000},()=>fixture(async context=>{
  const c=await ordinary(context),entered=deferred(),finish=deferred();
  const {getPlayerGrowthOverview}=await import('../server/services/account/growth.ts');
  globalThis.__goalSqlRuntime.onPython=async()=>{entered.resolve();await bounded(finish.promise);};
  const reading=getPlayerGrowthOverview(c.user);reading.catch(()=>{});let removal;
  try {
    await bounded(entered.promise);const commits=c.state.commits;
    const lookup=deferred();c.state.afterExecute=sql=>{if(!c.scopeModule.currentScoreScope()&&sql.includes('FROM web_taiko_bindings'))lookup.resolve();};
    removal=c.binding.removeBinding(c.user,c.bindingId);removal.catch(()=>{});await bounded(lookup.promise);
    assert.equal(c.state.commits,commits);finish.resolve();
    assert.equal((await reading).profileId,String(c.bindingId));assert.equal((await removal).ok,true);await assertRemoved(c);
  } finally {finish.resolve();await reading.catch(()=>{});await removal?.catch(()=>{});globalThis.__goalSqlRuntime.onPython=null;c.state.afterExecute=null;}
}));

test('Recent ACK holds SH through cursor COMMIT, rejects identity changes, and destroys failed rollback connections',{timeout:20000},()=>fixture(async context=>{
  const c=await ordinary(context),before=await source(c);
  const recent=await import('../server/services/growth-recent/service.ts');
  const view=await recent.getRecentGrowth(c.user);assert.match(view.boundary.currentToken,/^[a-f0-9]{64}$/);
  const body={profileId:String(c.bindingId),expectedBoundary:null,acknowledgeToken:view.boundary.currentToken};
  c.state.expectedSourceMode='read';
  c.state.afterSqlCommit=()=>assert.equal(c.scopeModule.currentScoreScope(c.taikoId)?.mode,'read');
  assert.equal((await recent.acknowledgeRecentGrowth(c.user,body)).unchanged,false);
  assert.equal((await recent.acknowledgeRecentGrowth(c.user,body)).unchanged,true);
  await c.pool.execute('DELETE FROM web_growth_recent_cursors WHERE user_id=?',[c.user]);
  c.state.failRollback=true;c.state.beforeSqlStatement=sql=>{if(sql.includes('INSERT INTO web_growth_recent_cursors'))throw new Error('Synthetic late cursor failure');};
  await assert.rejects(recent.acknowledgeRecentGrowth(c.user,body));assert.equal(c.state.discardedConnections,1);
  c.state.failRollback=false;c.state.beforeSqlStatement=null;c.state.afterSqlCommit=null;
  await assert.rejects(queued(c,()=>recent.acknowledgeRecentGrowth(c.user,body),()=>c.pool.execute("UPDATE web_taiko_bindings SET source='hiroba' WHERE id=?",[c.bindingId])),e=>e.statusCode===409);
  const [[cursor]]=await c.pool.query('SELECT COUNT(*) AS n FROM web_growth_recent_cursors WHERE user_id=?',[c.user]);assert.equal(cursor.n,0);assert.deepEqual(await source(c),before);
}));

test('a source publisher cannot advance the boundary during the actual Recent cursor transaction',{timeout:20000},()=>fixture(async context=>{
  const c=await ordinary(context),entered=deferred(),finish=deferred(),publish=deferred();let publisherEntered=false;
  const recent=await import('../server/services/growth-recent/service.ts');
  const view=await recent.getRecentGrowth(c.user);
  c.state.expectedSourceMode='read';
  c.state.beforeSqlStatement=async sql=>{if(sql.includes('INSERT INTO web_growth_recent_cursors')){entered.resolve();await bounded(finish.promise);}};
  // Register outside the SH callback so this is an independent writer context.
  const writer=publish.promise.then(()=>c.scopeModule.withDomainScoreWrite(c.taikoId,async()=>{publisherEntered=true;await c.shared.writeUserdataWithHistory(c.taikoId,{_meta:{source:'wahlap'},songs:[]},'wahlap');}));
  writer.catch(()=>{});
  const ack=recent.acknowledgeRecentGrowth(c.user,{profileId:String(c.bindingId),expectedBoundary:null,acknowledgeToken:view.boundary.currentToken});ack.catch(()=>{});
  try {
    await bounded(entered.promise);c.tick();publish.resolve();
    // EX is physically unavailable while the SQL transaction's SH is alive.
    const competing=await openPublicationLease({root:c.config.userdataDir,repoRoot:c.config.repoRoot,identity:c.taikoId,mode:'read'});
    try {assert.equal(publisherEntered,false);} finally {await competing.close();}
    finish.resolve();assert.equal((await ack).unchanged,false);await writer;assert.equal(publisherEntered,true);
    const next=await recent.getRecentGrowth(c.user);assert.equal(next.state,'new');assert.equal(next.boundary.acknowledgedToken,view.boundary.currentToken);assert.notEqual(next.boundary.currentToken,view.boundary.currentToken);
  } finally {finish.resolve();publish.resolve();await ack.catch(()=>{});await writer.catch(()=>{});c.state.beforeSqlStatement=null;}
}));

for(const point of ['before-commit','after-commit'])test(`actual ordinary-removal process death ${point} has atomic SQL and a replayable private acknowledgement`,{timeout:25000},()=>fixture(async context=>{
  const c=await ordinary(context);await populate(c);const before=await sqlSnapshot(c),beforeSource=await source(c);
  const options=resolve(c.root,'binding-crash-options.json'),childFile=resolve(c.root,'binding-crash-child.mjs');
  await writeFile(options,JSON.stringify({point,user:c.user,bindingId:c.bindingId,taikoId:c.taikoId,config:c.config}),{mode:0o600});
  await writeFile(childFile,`
import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import mysql from ${JSON.stringify(import.meta.resolve('mysql2/promise'))};
import {installGoalSqlRuntime} from ${JSON.stringify(new URL('./fixtures/goalSqlRuntime.mjs',import.meta.url).href)};
assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1');assert.match(String(process.env.TAIKO_DB_NAME||''),/_test$/);
const o=JSON.parse(await readFile(process.argv[2],'utf8'));
const pool=mysql.createPool({host:process.env.TAIKO_DB_HOST,port:Number(process.env.TAIKO_DB_PORT||3306),user:process.env.TAIKO_DB_USER,password:process.env.TAIKO_DB_PASSWORD,database:process.env.TAIKO_DB_NAME,connectionLimit:2});
const [[identity]]=await pool.query('SELECT DATABASE() AS name');assert.match(identity.name,/_test$/);assert.equal(identity.name,process.env.TAIKO_DB_NAME);
let scope;const db={query:(...a)=>pool.query(...a),execute:(...a)=>pool.execute(...a),async getConnection(){
assert.equal(scope.currentScoreScope(o.taikoId)?.mode,'write');const connection=await pool.getConnection();
return {beginTransaction:()=>connection.beginTransaction(),rollback:()=>connection.rollback(),destroy:()=>connection.destroy(),release:()=>connection.release(),
async execute(sql,args){const result=await connection.execute(sql,args);if(o.point==='before-commit'&&sql.includes('INSERT INTO web_taiko_binding_revocations'))process.exit(73);return result;},
async commit(){await connection.commit();if(o.point==='after-commit')process.exit(73);}};}};
installGoalSqlRuntime(db,o.config);globalThis.fetch=async()=>{throw new Error('Owned test network forbidden');};
scope=await import(${JSON.stringify(new URL('../server/services/taiko-domain/publication.ts',import.meta.url).href)});
const service=await import(${JSON.stringify(new URL('../server/utils/account/bindings.ts',import.meta.url).href)});
await service.removeBinding(o.user,o.bindingId);process.exit(74);
`,{mode:0o600});
  await assert.rejects(execFileAsync(process.execPath,['--experimental-strip-types',childFile,options],{cwd:new URL('../',import.meta.url),timeout:15000,maxBuffer:8192}),e=>e.code===73);
  if(point==='before-commit')assert.equal(await sqlSnapshot(c),before);else await assertRemoved(c);
  const commits=c.state.commits;assert.equal((await c.binding.removeBinding(c.user,c.bindingId)).ok,true);
  assert.equal(c.state.commits-commits,point==='before-commit'?1:0);await assertRemoved(c);assert.deepEqual(await source(c),beforeSource);
}));
