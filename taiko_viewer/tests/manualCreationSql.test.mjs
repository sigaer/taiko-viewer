// Real SQL and center kernel publication. Only owned synthetic _test records.
import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID,createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFile,execFileSync} from 'node:child_process';
import {promisify} from 'node:util';
import ts from 'typescript';
import {manualSqlFixture as fixture,manualSourceSnapshot as snapshot,manualScoreInput as score} from './fixtures/manualSqlRuntime.mjs';
const execFileAsync=promisify(execFile),uuid=()=>randomUUID().replaceAll('-','');
const digest=raw=>createHash('sha256').update(raw).digest('hex');
const bot=c=>({kind:'bot',identityKey:c.botKey});
async function receipt(c,id) {
 const [[row]]=await c.pool.query('SELECT * FROM taiko_manual_creations WHERE operation_id=?',[id]);return row;
}
async function denied(c,row) {
 for(const [table,column] of [['taiko_manual_accounts','taiko_id'],['web_taiko_bindings','taiko_id'],['bind','id'],['taiko_manual_claim_codes','taiko_id']]){
  const [[r]]=await c.pool.query(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column}=?`,[row.taiko_id]);assert.equal(r.n,0);
 }
 await assert.rejects(c.manual.getManualScore(c.owner,row.taiko_id,100,4),e=>e.statusCode===403);
}
async function completed(c,id,owner=c.owner) {
 const row=await receipt(c,id);assert.equal(row.status,'ready');assert.equal(row.pending_key,null);
 const [[account]]=await c.pool.query('SELECT * FROM taiko_manual_accounts WHERE taiko_id=?',[row.taiko_id]);
 assert.equal(account.nickname,row.nickname);assert.equal(account.created_by,owner.kind);
 const [[bound]]=owner.kind==='viewer'
  ? await c.pool.query("SELECT source FROM web_taiko_bindings WHERE user_id=? AND taiko_id=?",[owner.userId,row.taiko_id])
  : await c.pool.query("SELECT source FROM bind WHERE qq=? AND id=?",[owner.identityKey,row.taiko_id]);
 assert.equal(bound.source,'manual');
 await c.scopeModule.withDomainScoreRead(row.taiko_id,async()=>{
  const view=c.scopeModule.scorePublication(row.taiko_id);assert.equal(view.commitId,id);assert.equal(view.sequence,1);assert.equal(Object.keys(view.files).length,2);
  const data=await snapshot({...c,taikoId:row.taiko_id});assert.equal(data.current,row.initial_current);assert.equal(data.history.length,1);
 });
 return row;
}
function interruptFiles(c,after=false) {
 c.state.afterSqlCommit=()=>{
  const scope=c.scopeModule.currentScoreScope(),publish=scope.lease.publish;
  scope.lease.publish=async input=>{if(after)await publish(input);throw new Error('Synthetic interrupted initial publication');};
 };
}
async function recover(c,id) {
 const {recoverOneManualSourceLifecycle}=await import('../server/services/account/source-lifecycle-recovery.ts');
 return recoverOneManualSourceLifecycle(undefined,id);
}

test('creation publishes frozen blank C/H before one atomic authority transaction and preserves response fields', {timeout:20000},async()=>fixture(async c=>{
 const id=uuid(),commits=c.state.commits;
 const result=await c.manual.createManualAccount(c.owner,'New synthetic',id);
 assert.deepEqual(result,{ok:true,taikoId:result.taikoId,nickname:'New synthetic',source:'manual',displayName:'New synthetic',isManual:true});
 assert.equal(c.state.commits-commits,2);
 const row=await completed(c,id);
 const frozen=execFileSync('git',['show','fbfd43e:taiko_viewer/server/utils/account/manual.ts'],{cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:1024*1024});
 const start=frozen.indexOf('const buildBlankUserdata = '),end=frozen.indexOf('const attachViewer',start);
 const code=`import {formatLocalTimestamp} from ${JSON.stringify(new URL('../server/infrastructure/taiko-publication/writer.ts',import.meta.url).href)};\n${frozen.slice(start,end)}\nexport {buildBlankUserdata};`;
 const file=resolve(c.root,'frozen-blank.mjs');
 await writeFile(file,ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
 const legacy=await import(pathToFileURL(file).href);
 assert.equal(row.initial_current,JSON.stringify(legacy.buildBlankUserdata(row.taiko_id,row.nickname),null,4));
 await c.scopeModule.withDomainScoreRead(row.taiko_id,async()=>{
  const reader=c.scopeModule.currentScoreScope(row.taiko_id).reader,history=await reader.listHistory(row.taiko_id);
  const expected=JSON.parse(row.initial_current);expected._meta={...expected._meta,source:'manual-create',writer_source:'manual-create'};
  assert.equal(digest(await reader.readHistory(row.taiko_id,history[0])),digest(JSON.stringify(expected,null,4)));
 });
}));

test('bot creation shares the atomic attachment and retains consecutive slots/current semantics', {timeout:20000},async()=>fixture(async c=>{
 await c.pool.execute("INSERT INTO bind (qq,id,source,slot_index,is_current) VALUES (?,?,'wahlap',1,1)",[c.botKey,'aux-'+c.taikoId.slice(-8)]);
 const id=uuid();await c.manual.createManualAccount(bot(c),'Bot synthetic',id);const row=await completed(c,id,bot(c));
 const [slots]=await c.pool.query('SELECT id,slot_index,is_current FROM bind WHERE qq=? ORDER BY slot_index',[c.botKey]);
 assert.deepEqual(slots.map(r=>[r.slot_index,r.is_current]),[[1,0],[2,1]]);assert.equal(slots[1].id,row.taiko_id);
}));

test('late reservation SQL failure creates neither grant nor publication and a fresh retry succeeds', {timeout:20000},async()=>fixture(async c=>{
 const id=uuid();let taikoId;
 c.state.afterSqlStatement=(sql,args)=>{if(sql.includes('INSERT INTO taiko_manual_creations')){taikoId=args[1];throw new Error('Synthetic reservation failure');}};
 await assert.rejects(c.manual.createManualAccount(c.owner,'Reservation synthetic',id));
 assert.equal(await receipt(c,id),undefined);await denied(c,{taiko_id:taikoId});assert.equal((await snapshot({...c,taikoId})).current,null);
 c.state.afterSqlStatement=null;await c.manual.createManualAccount(c.owner,'Reservation synthetic',id);await completed(c,id);
}));

for(const failedRollback of [false,true])test(`late authority SQL failure retains only pending receipt/files; rollback discard=${failedRollback}`, {timeout:20000},async()=>fixture(async c=>{
 const id=uuid();c.state.beforeSqlStatement=sql=>{if(sql.includes("UPDATE taiko_manual_creations SET status='ready'"))throw new Error('Synthetic final authority failure');};
 c.state.failRollback=failedRollback;
 await assert.rejects(c.manual.createManualAccount(c.owner,'Authority synthetic',id));
 const row=await receipt(c,id);assert.equal(row.status,'pending');await denied(c,row);
 const before=await snapshot({...c,taikoId:row.taiko_id});assert.equal(before.current,row.initial_current);
 assert.equal(c.state.discardedConnections,failedRollback?1:0);
 c.state.beforeSqlStatement=null;c.state.failRollback=false;
 const commits=c.state.commits;assert.deepEqual(await recover(c,id),{recovered:true});assert.equal(c.state.commits-commits,1);
 await completed(c,id);assert.deepEqual(await snapshot({...c,taikoId:row.taiko_id}),before);
}));

for(const after of [false,true])test(`initial publication failure/lost ack grants nothing and resumes the same generation, after=${after}`, {timeout:20000},async()=>fixture(async c=>{
 const id=uuid();interruptFiles(c,after);
 await assert.rejects(c.manual.createManualAccount(c.owner,'Files synthetic',id));c.state.afterSqlCommit=null;
 const row=await receipt(c,id);assert.equal(row.status,'pending');await denied(c,row);
 const before=await snapshot({...c,taikoId:row.taiko_id});assert.equal(before.current,after?row.initial_current:null);
 const result=await c.manual.createManualAccount(c.owner,'Files synthetic',id);assert.equal(result.taikoId,row.taiko_id);await completed(c,id);
 if(after)assert.deepEqual(await snapshot({...c,taikoId:row.taiko_id}),before);
}));

test('both lost actual SQL COMMIT acknowledgements use exact receipt proofs and add no duplicate authority', {timeout:20000},async()=>fixture(async c=>{
 const id=uuid(),commits=c.state.commits;c.state.afterSqlCommit=()=>{throw new Error('Synthetic lost creation COMMIT ack');};
 const result=await c.manual.createManualAccount(c.owner,'Ack synthetic',id);assert.equal(c.state.commits-commits,2);
 c.state.afterSqlCommit=null;await completed(c,id);
 assert.deepEqual(await c.manual.createManualAccount(c.owner,'Ack synthetic',id),result);assert.equal(c.state.commits-commits,2);
}));

test('same UUID concurrent creation selects one source and makes only one reservation/authority COMMIT', {timeout:25000},async()=>fixture(async c=>{
 const id=uuid(),commits=c.state.commits;
 const results=await Promise.all([c.manual.createManualAccount(c.owner,'Concurrent synthetic',id),c.manual.createManualAccount(c.owner,'Concurrent synthetic',id)]);
 assert.deepEqual(results[0],results[1]);assert.equal(c.state.commits-commits,2);await completed(c,id);
}));

test('legacy create retry resumes its matching pending actor/nickname without allocating a duplicate', {timeout:20000},async()=>fixture(async c=>{
 interruptFiles(c);await assert.rejects(c.manual.createManualAccount(c.owner,'Legacy retry'));c.state.afterSqlCommit=null;
 const [[row]]=await c.pool.query("SELECT operation_id,taiko_id FROM taiko_manual_creations WHERE actor_kind='viewer' AND actor_key=? AND status='pending'",[String(c.user)]);
 assert.equal((await c.manual.createManualAccount(c.owner,'Legacy retry')).taikoId,row.taiko_id);await completed(c,row.operation_id);
}));

test('completed creation UUID is acknowledgement after later scores and permanent deletion; it never revives a grant', {timeout:25000},async()=>fixture(async c=>{
 const id=uuid(),result=await c.manual.createManualAccount(c.owner,'Replay synthetic',id),target=result.taikoId;
 await c.manual.upsertManualScore(c.owner,target,score);const before=await snapshot({...c,taikoId:target}),commits=c.state.commits;
 assert.deepEqual(await c.manual.createManualAccount(c.owner,'Replay synthetic',id),result);assert.equal(c.state.commits,commits);assert.deepEqual(await snapshot({...c,taikoId:target}),before);
 await c.manual.permanentlyDeleteManualAccount(c.owner,target,true);const deleted=await snapshot({...c,taikoId:target}),after=c.state.commits;
 assert.deepEqual(await c.manual.createManualAccount(c.owner,'Replay synthetic',id),result);assert.equal(c.state.commits,after);await denied(c,{taiko_id:target});assert.deepEqual(await snapshot({...c,taikoId:target}),deleted);
}));

test('creation UUID rejects other principals, changed nickname and malformed input before changing grants', {timeout:20000},async()=>fixture(async c=>{
 const id=uuid();await c.manual.createManualAccount(c.owner,'Identity synthetic',id);const commits=c.state.commits;
 await assert.rejects(c.manual.createManualAccount(bot(c),'Identity synthetic',id),e=>e.statusCode===403);
 await assert.rejects(c.manual.createManualAccount(c.owner,'Changed',id),e=>e.statusCode===409);
 await assert.rejects(c.manual.createManualAccount(c.owner,'Identity synthetic','invalid'),e=>e.statusCode===400);
 assert.equal(c.state.commits,commits);await completed(c,id);
}));

for(const ownerKind of ['viewer','bot'])test(`recovery preserves a newer ${ownerKind} current selection made after reservation`, {timeout:25000},async()=>fixture(async c=>{
 const owner=ownerKind==='viewer'?c.owner:bot(c),id=uuid();interruptFiles(c);
 await assert.rejects(c.manual.createManualAccount(owner,'Selection synthetic',id));c.state.afterSqlCommit=null;
 const row=await receipt(c,id),other='aux-'+c.taikoId.slice(-8);
 if(ownerKind==='viewer'){
  await c.pool.execute('UPDATE web_taiko_bindings SET is_current=0 WHERE user_id=?',[c.user]);
  await c.pool.execute("INSERT INTO web_taiko_bindings (user_id,taiko_id,source,is_current) VALUES (?,?,'wahlap',1)",[c.user,other]);
 }else await c.pool.execute("INSERT INTO bind (qq,id,source,slot_index,is_current) VALUES (?,?,'wahlap',1,1)",[c.botKey,other]);
 await recover(c,id);await completed(c,id,owner);
 const [[selected]]=ownerKind==='viewer'?await c.pool.query('SELECT taiko_id AS id FROM web_taiko_bindings WHERE user_id=? AND is_current=1',[c.user]):await c.pool.query('SELECT id FROM bind WHERE qq=? AND is_current=1',[c.botKey]);
 assert.equal(selected.id,other);assert.notEqual(selected.id,row.taiko_id);
}));

test('deleted owner cannot acquire a pending creation; recovery leaves empty files and authority revoked', {timeout:20000},async()=>fixture(async c=>{
 const id=uuid();interruptFiles(c);await assert.rejects(c.manual.createManualAccount(c.owner,'Deleted owner',id));c.state.afterSqlCommit=null;
 const row=await receipt(c,id);await c.pool.execute('DELETE FROM web_user_accounts WHERE id=?',[c.user]);
 await assert.rejects(recover(c,id),e=>e.statusCode===403);await denied(c,row);assert.equal((await snapshot({...c,taikoId:row.taiko_id})).current,null);
}));

for(const conflict of ['receipt-checksum','receipt-payload','receipt-too-large','source-head','sql-binding','legacy-archive'])test(`pending creation rejects ${conflict} without overwriting or partial grants`, {timeout:25000},async()=>fixture(async c=>{
 const id=uuid();interruptFiles(c);await assert.rejects(c.manual.createManualAccount(c.owner,'Conflict synthetic',id));c.state.afterSqlCommit=null;
 const row=await receipt(c,id),target={...c,taikoId:row.taiko_id};
 if(conflict==='receipt-checksum')await c.pool.execute('UPDATE taiko_manual_creations SET current_sha256=? WHERE operation_id=?',['f'.repeat(64),id]);
 if(conflict==='receipt-too-large')await c.pool.execute('UPDATE taiko_manual_creations SET initial_current=? WHERE operation_id=?',['!'.repeat(33*1024),id]);
 if(conflict==='receipt-payload'){
  const raw=JSON.stringify({...JSON.parse(row.initial_current),songs:[{song_no:100,high_score:999999}]},null,4);
  await c.pool.execute('UPDATE taiko_manual_creations SET initial_current=?,current_sha256=? WHERE operation_id=?',[raw,digest(raw),id]);
 }
 if(conflict==='source-head')await c.scopeModule.withDomainScoreWrite(row.taiko_id,()=>c.scopeModule.stageScoreText(row.taiko_id,'current','{"songs":[],"different":true}'));
 if(conflict==='legacy-archive'){
  await mkdir(resolve(c.config.userdataDir,row.taiko_id),{recursive:true});
  await writeFile(resolve(c.config.userdataDir,row.taiko_id,'daily-ability-v1-top20.json'),'{"days":{"old":1}}');
 }
 if(conflict==='sql-binding')await c.pool.execute("INSERT INTO web_taiko_bindings (user_id,taiko_id,source,is_current) VALUES (?,?,'wahlap',0)",[c.user,row.taiko_id]);
 const before=await snapshot(target);await assert.rejects(recover(c,id),e=>e.statusCode===503);assert.deepEqual(await snapshot(target),before);
 if(conflict==='legacy-archive')assert.equal(await readFile(resolve(c.config.userdataDir,row.taiko_id,'daily-ability-v1-top20.json'),'utf8'),'{"days":{"old":1}}');
 const [[account]]=await c.pool.query('SELECT COUNT(*) AS n FROM taiko_manual_accounts WHERE taiko_id=?',[row.taiko_id]);assert.equal(account.n,0);
 if(conflict==='sql-binding')await c.pool.execute('DELETE FROM web_taiko_bindings WHERE taiko_id=?',[row.taiko_id]);
}));

test('creation service and recovery dispatch retain captured SQL pools through shutdown-style config replacement', {timeout:25000},async()=>fixture(async c=>{
 const id=uuid(),captured=globalThis.__goalSqlRuntime.db,config=globalThis.useRuntimeConfig;let replaced=false;
 globalThis.useRuntimeConfig=()=>{replaced=true;globalThis.__goalSqlRuntime.db={execute:()=>{throw new Error('Fresh global pool forbidden');},getConnection:()=>{throw new Error('Fresh global pool forbidden');}};return config();};
 try{await c.manual.createManualAccount(c.owner,'Captured synthetic',id);assert.equal(replaced,true);}finally{globalThis.useRuntimeConfig=config;globalThis.__goalSqlRuntime.db=captured;}
 await completed(c,id);
 const pending=uuid();interruptFiles(c);await assert.rejects(c.manual.createManualAccount(c.owner,'Captured pending',pending));c.state.afterSqlCommit=null;
 globalThis.useRuntimeConfig=()=>{globalThis.__goalSqlRuntime.db={execute:()=>{throw new Error('Fresh recovery pool forbidden');}};return config();};
 try{assert.deepEqual(await recover(c,pending),{recovered:true});}finally{globalThis.useRuntimeConfig=config;globalThis.__goalSqlRuntime.db=captured;}
 await completed(c,pending);
}));

test('actual driver failure after account insertion rolls back all authority and removes private SQL diagnostics', {timeout:20000},async()=>fixture(async c=>{
 const id=uuid();c.state.afterSqlStatement=async sql=>{if(sql.startsWith('INSERT INTO taiko_manual_accounts'))await c.pool.execute('SELECT missing_creation_column FROM taiko_manual_accounts');};
 await assert.rejects(c.manual.createManualAccount(c.owner,'Private driver',id),e=>e.statusCode===503&&!('sql' in e)&&!('cause' in e));
 const row=await receipt(c,id);await denied(c,row);assert.equal(row.status,'pending');
 c.state.afterSqlStatement=null;await recover(c,id);await completed(c,id);
}));

async function ownedCreationCrash(c,id,point){
 const options=resolve(c.root,'creation-crash-options.json'),childFile=resolve(c.root,'creation-crash-child.mjs');
 await writeFile(options,JSON.stringify({id,point,owner:c.owner,config:c.config}),{mode:0o600});
 await writeFile(childFile,`
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import mysql from ${JSON.stringify(import.meta.resolve('mysql2/promise'))};
import {installGoalSqlRuntime} from ${JSON.stringify(new URL('./fixtures/goalSqlRuntime.mjs',import.meta.url).href)};
assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1');assert.match(String(process.env.TAIKO_DB_NAME||''),/_test$/);
const options=JSON.parse(await readFile(process.argv[2],'utf8'));
const pool=mysql.createPool({host:process.env.TAIKO_DB_HOST,port:Number(process.env.TAIKO_DB_PORT||3306),user:process.env.TAIKO_DB_USER,password:process.env.TAIKO_DB_PASSWORD,database:process.env.TAIKO_DB_NAME,connectionLimit:2});
const [[identity]]=await pool.query('SELECT DATABASE() AS name');assert.match(identity.name,/_test$/);assert.equal(identity.name,process.env.TAIKO_DB_NAME);
let scope,commits=0;
const db={query:(...args)=>pool.query(...args),execute:(...args)=>pool.execute(...args),async getConnection(){
 assert.equal(scope.currentScoreScope()?.mode,'write');const connection=await pool.getConnection();
 return {beginTransaction:()=>connection.beginTransaction(),rollback:()=>connection.rollback(),destroy:()=>connection.destroy(),release:()=>connection.release(),
  async execute(sql,args){const result=await connection.execute(sql,args);
   if(options.point==='before-reservation-commit'&&sql.includes('INSERT INTO taiko_manual_creations'))process.exit(73);
   if(options.point==='before-authority-commit'&&sql.includes("UPDATE taiko_manual_creations SET status='ready'"))process.exit(73);
   return result;},
  async commit(){await connection.commit();commits++;
   if(options.point==='after-reservation'&&commits===1)process.exit(73);
   if(options.point==='after-authority-commit'&&commits===2)process.exit(73);
   if(options.point==='after-files'&&commits===1){const lease=scope.currentScoreScope().lease,publish=lease.publish;lease.publish=async input=>{const result=await publish(input);process.exit(73);return result;};}
  }
 };
}};
installGoalSqlRuntime(db,options.config);globalThis.fetch=async()=>{throw new Error('Network forbidden during owned creation crash');};
scope=await import(${JSON.stringify(new URL('../server/services/taiko-domain/publication.ts',import.meta.url).href)});
const {createManualSource}=await import(${JSON.stringify(new URL('../server/services/account/manual-creation.ts',import.meta.url).href)});
await createManualSource(options.owner,'Crash synthetic',options.id);process.exit(74);
`,{mode:0o600});
 await assert.rejects(execFileAsync(process.execPath,['--experimental-strip-types',childFile,options],{cwd:new URL('../',import.meta.url),timeout:15000,maxBuffer:8192}),e=>e.code===73);
}
for(const point of ['before-reservation-commit','after-reservation','after-files','before-authority-commit','after-authority-commit'])test(`actual owned creation process exits ${point}: SQL remains atomic and fresh recovery resumes the admitted operation`, {timeout:30000},async()=>fixture(async c=>{
 const id=uuid();await ownedCreationCrash(c,id,point);
 const row=await receipt(c,id);
 if(point==='before-reservation-commit'){
  assert.equal(row,undefined);assert.deepEqual(await recover(c,id),{recovered:false});
  await c.manual.createManualAccount(c.owner,'Crash synthetic',id);await completed(c,id);return;
 }
 if(point==='after-authority-commit'){
  await completed(c,id);assert.deepEqual(await recover(c,id),{recovered:false});
 }else{
  assert.equal(row.status,'pending');await denied(c,row);
  const before=await snapshot({...c,taikoId:row.taiko_id});assert.equal(before.current,point==='after-reservation'?null:row.initial_current);
  assert.deepEqual(await recover(c,id),{recovered:true});await completed(c,id);
  if(point!=='after-reservation')assert.deepEqual(await snapshot({...c,taikoId:row.taiko_id}),before);
 }
 const commits=c.state.commits;assert.equal((await c.manual.createManualAccount(c.owner,'Crash synthetic',id)).taikoId,row.taiko_id);assert.equal(c.state.commits,commits);
}));

for(const point of ['objects-staged','intent-durable','projection-0','projections-durable','commit-durable'])test(`owned Python publication death ${point} resumes identical registered C/H and grants only after recovery`, {timeout:30000},async()=>fixture(async c=>{
 const id=uuid();
 c.state.afterSqlCommit=async()=>{
  const row=await receipt(c,id),scope=c.scopeModule.currentScoreScope(row.taiko_id);
  const {prepareUserdataPublication}=await import('../server/infrastructure/taiko-publication/writer.ts');
  const payload=JSON.parse(row.initial_current),prepared=prepareUserdataPublication(payload,'manual-create',1,new Date(payload._meta.ts.replace(' ','T')),id);
  const options=resolve(c.root,'python-create-options.json');
  await writeFile(options,JSON.stringify({root:c.config.userdataDir,identity:row.taiko_id,id,point,changes:{current:prepared.current,[prepared.historyKey]:prepared.history}}),{mode:0o600});
  // Close the original owned bridge before the faulting Python takes EX; no
  // nested lock, no side-channel production read and no active SQL transaction.
  await scope.lease.close();
  await assert.rejects(execFileAsync('/usr/bin/python3',['-c',`
import json,os,sys
from taiko_store import PublicationStore
with open(sys.argv[1]) as source: options=json.load(source)
def fault(point):
 if point==options['point']: os._exit(73)
store=PublicationStore(options['root'],options['identity'],fault=fault)
with store.exclusive(): store.commit({key:value.encode() for key,value in options['changes'].items()},transaction_id=options['id'])
os._exit(74)
`,options],{cwd:c.config.repoRoot,timeout:15000,maxBuffer:8192}),e=>e.code===73);
 };
 await assert.rejects(c.manual.createManualAccount(c.owner,'Python crash',id),e=>e.statusCode===503);c.state.afterSqlCommit=null;
 const row=await receipt(c,id);assert.equal(row.status,'pending');await denied(c,row);
 assert.equal((await snapshot({...c,taikoId:row.taiko_id})).current,point==='commit-durable'?row.initial_current:null);
 assert.deepEqual(await recover(c,id),{recovered:true});await completed(c,id);
 const commits=c.state.commits;await c.manual.createManualAccount(c.owner,'Python crash',id);assert.equal(c.state.commits,commits);
}));
