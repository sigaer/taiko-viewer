// Added checkpoint recovery scope; run only through owned run-isolated-sql.mjs.
import assert from 'node:assert/strict';
import test from 'node:test';
import mysql from 'mysql2/promise';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cp,mkdir,mkdtemp,open,readFile,readdir,realpath,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import {manualSqlFixture,manualSourceSnapshot,manualScoreInput} from './fixtures/manualSqlRuntime.mjs';
import {populate} from './fixtures/manualLifecycleRuntime.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const encode=x=>JSON.stringify(x);
const decode=x=>JSON.parse(x,(_,v)=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)?new Date(v):v);
function verifyCheckpoint(raw,expected){assert.equal(hash(raw),expected,'checkpoint integrity mismatch');return decode(raw);}
async function files(root,prefix='') {const out={};for(const e of await readdir(resolve(root,prefix),{withFileTypes:true})){const name=prefix?prefix+'/'+e.name:e.name;if(e.isDirectory())Object.assign(out,await files(root,name));else if(e.isFile())out[name]=hash(await readFile(resolve(root,name)));else assert.fail('Only regular synthetic files allowed');}return out;}
async function run(command,args,logPath){const log=await open(logPath,'w',0o600);const p=spawn(command,args,{stdio:['ignore',log.fd,log.fd]});const timer=setTimeout(()=>p.kill('SIGKILL'),90000);try{return await new Promise((res,rej)=>{p.once('error',rej);p.once('close',code=>res(code));});}finally{clearTimeout(timer);await log.close();}}

test('independent MySQL checkpoint restores installed publications, historic identities and authorization continuity', {timeout:240000},async()=>manualSqlFixture(async c=>{
 const wallNow=()=>new Date(performance.timeOrigin+performance.now()).toISOString();
 const workspace=await mkdtemp('/var/tmp/viewer082-recovery-');
 const evidence={status:'RUNNING',workspace,scope:'synthetic independent SQL instance + actual publication bridge and authorization services; no HTTP listener',productionAccess:false,offHostBackup:'BLOCKED_NO_AUTHORIZED_DESTINATION',cases:[],startedAt:wallNow()};
 let daemon,db,exit;const originalDb=globalThis.__goalSqlRuntime.db,originalRoot=c.config.userdataDir;
 try {
  const f=await populate(c);c.tick();await c.manual.upsertManualScore(c.owner,c.taikoId,{...manualScoreInput,values:{...manualScoreInput.values,high_score:810000}});
  const annualDir=resolve(c.root,'annual');await mkdir(annualDir);
  const annual={summaryId:'00000000-0000-4000-8000-000000000082',algorithmVersion:'v4.5.3',inputFingerprint:'e'.repeat(64),schemaVersion:4,bindingId:f.id,source:'synthetic',published:true};
  await writeFile(resolve(annualDir,'report.json'),encode(annual)+'\n');
  // Use the exact repository Annual table DDL, including its foreign keys.
  const accountSource=await readFile(new URL('../server/utils/account-db.ts',import.meta.url),'utf8');
  const annualDdl=accountSource.match(/`(CREATE TABLE IF NOT EXISTS web_annual_summaries \([\s\S]*?ENGINE=InnoDB DEFAULT CHARSET=utf8mb4)`/)[1];
  await c.pool.query(annualDdl);
  await c.pool.execute('INSERT INTO web_annual_summaries (id,user_id,binding_id,version_key,data_mode,input_fingerprint,summary_path,events_path,generated_at) VALUES (?,?,?,?,?,?,?,?,NOW())',[annual.summaryId,c.user,f.id,'historical-v4.5.3','snapshot',annual.inputFingerprint,'report.json','events.json']);
  const shareDdl=accountSource.match(/`(CREATE TABLE IF NOT EXISTS web_annual_shares \([\s\S]*?ENGINE=InnoDB DEFAULT CHARSET=utf8mb4)`/)[1];
  await c.pool.query(shareDdl);
  await c.pool.execute('INSERT INTO web_annual_shares(id,summary_id,user_id,token_hash,status,expires_at,revoked_at) VALUES (?,?,?,?,?,DATE_ADD(NOW(),INTERVAL 1 DAY),NOW())',['00000000-0000-4000-8000-000000000083',annual.summaryId,c.user,hash('synthetic-annual-share'),'revoked']);
  const [developer]=await c.pool.execute("INSERT INTO web_user_accounts(username,email,password_hash) VALUES ('restore-developer','restore-developer@example.test','synthetic-no-login')");
  const tokens={};
  for(const kind of ['revoked-token','revoked-grant','expired-grant','active-grant']){
   const digest=hash('synthetic-'+kind);const [t]=await c.pool.execute("INSERT INTO web_developer_tokens(user_id,token_hash,token_mask,status,revoked_at) VALUES (?,?,?, ?,IF(?='revoked',NOW(),NULL))",[developer.insertId,digest,'synthetic',kind==='revoked-token'?'revoked':'active',kind==='revoked-token'?'revoked':'active']);
   tokens[kind]={id:t.insertId,digest};
   await c.pool.execute("INSERT INTO taiko_source_service_grants(developer_token_id,developer_user_id,service_name,scopes_json,sources_json,revision_nonce,status,issued_by_user_id,expires_at) VALUES (?,?, 'restore-test',?,?,?, ?,?,IF(?=1,DATE_SUB(NOW(),INTERVAL 1 DAY),DATE_ADD(NOW(),INTERVAL 1 DAY)))",[t.insertId,developer.insertId,JSON.stringify(['source_read','history_read']),JSON.stringify([c.taikoId]),'a'.repeat(32),kind==='revoked-grant'?'revoked':'active',c.user,kind==='expired-grant'?1:0]);
  }
  const sourceSnapshot=await manualSourceSnapshot(c);
  let publication;await c.scopeModule.withDomainScoreRead(c.taikoId,async()=>{publication=c.scopeModule.scorePublication(c.taikoId);});
  // All application writers are quiesced for the entire SQL + filesystem checkpoint.
  // This is a controlled cold snapshot, not proof of online PITR/backup scheduling.
  const checkpoint=wallNow();
  const [[sourceIdentity]]=await c.pool.query('SELECT DATABASE() AS name,@@datadir AS datadir');
  assert.match(sourceIdentity.name,/_test$/);assert.equal(await realpath(sourceIdentity.datadir),await realpath(process.env.TAIKO_TEST_MYSQL_DATADIR));
  const [tables]=await c.pool.query('SHOW TABLES');const backup=[];
  for(const row of tables){const name=Object.values(row)[0];assert.match(name,/^[a-z_]+$/);const [[ddl]]=await c.pool.query('SHOW CREATE TABLE `'+name+'`');const [rows]=await c.pool.query('SELECT * FROM `'+name+'`');const [columns]=await c.pool.query('SHOW COLUMNS FROM `'+name+'`');const generated=columns.filter(x=>/(?:VIRTUAL|STORED) GENERATED/.test(x.Extra)).map(x=>x.Field);backup.push({name,ddl:ddl['Create Table'],rows,generated});}
  const backupRaw=encode(backup);await writeFile(resolve(workspace,'checkpoint-sql.json'),backupRaw,{mode:0o600});
  await cp(originalRoot,resolve(workspace,'checkpoint-userdata'),{recursive:true});await cp(annualDir,resolve(workspace,'checkpoint-annual'),{recursive:true});
  const beforeFiles=await files(resolve(workspace,'checkpoint-userdata'));const beforeAnnual=await files(resolve(workspace,'checkpoint-annual'));
  evidence.checkpoint={at:checkpoint,sqlSha256:hash(backupRaw),publication:{sequence:publication.sequence,commitId:publication.commitId},userdataHashes:beforeFiles,annualHashes:beforeAnnual};
  // Incident starts before replacement server initialization/import/readiness checks.
  const incidentClock=performance.now(),incidentAt=wallNow();
  globalThis.__goalSqlRuntime.db={execute:()=>{throw new Error('Synthetic incident: original DB unavailable');}};
  c.config.userdataDir=resolve(workspace,'unavailable-original');
  assert.throws(()=>globalThis.__goalSqlRuntime.db.execute('SELECT 1'),/original DB unavailable/);
  evidence.cases.push('controlled incident disconnects original service graph before replacement initialization');
  const datadir=resolve(workspace,'restored-mysql');await mkdir(datadir,{mode:0o700});
  const args=['--no-defaults','--user=root','--basedir=/www/server/mysql',`--datadir=${datadir}`,'--innodb-buffer-pool-size=128M','--innodb-log-file-size=32M','--performance-schema=OFF'];
  const executable='/www/server/mysql/bin/mysqld';
  assert.equal(await run(executable,[...args,'--initialize-insecure'],resolve(workspace,'initialize.log')),0);
  const socket=resolve(workspace,'restore.sock'),log=await open(resolve(workspace,'mysql.log'),'w',0o600);
  daemon=spawn(executable,[...args,'--skip-networking','--mysqlx=OFF',`--socket=${socket}`,`--pid-file=${workspace}/mysql.pid`],{stdio:['ignore',log.fd,log.fd]});
  exit=new Promise(res=>daemon.once('close',res));await log.close();
  for(let i=0;i<160;i++){try{db=await mysql.createConnection({socketPath:socket,user:'root',connectTimeout:500});break;}catch{await new Promise(r=>setTimeout(r,250));}}
  assert.ok(db);await db.query('CREATE DATABASE viewer082_restore_test');await db.changeUser({database:'viewer082_restore_test'});
  const [[identity]]=await db.query('SELECT DATABASE() AS name,@@datadir AS datadir');assert.match(identity.name,/_test$/);assert.equal(await realpath(identity.datadir),await realpath(datadir));assert.notEqual(await realpath(identity.datadir),await realpath(sourceIdentity.datadir));assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1');
  evidence.databaseProof={source:sourceIdentity,restored:identity,independentDatadirs:true};
  // Restore from serialized disk checkpoint, not the live source DB.
  assert.equal(hash(await readFile(resolve(workspace,'checkpoint-sql.json'))),evidence.checkpoint.sqlSha256);
  await db.query('SET FOREIGN_KEY_CHECKS=0');
  const restored=verifyCheckpoint(await readFile(resolve(workspace,'checkpoint-sql.json'),'utf8'),evidence.checkpoint.sqlSha256);
  for(const table of restored){await db.query(table.ddl);for(const row of table.rows)await db.query('INSERT INTO `'+table.name+'` SET ?',Object.fromEntries(Object.entries(row).filter(([key])=>!table.generated.includes(key))));}
  await db.query('SET FOREIGN_KEY_CHECKS=1');
  for(const table of backup){const [rows]=await db.query('SELECT * FROM `'+table.name+'`');assert.equal(hash(encode(rows)),hash(encode(table.rows)),table.name+' parity');}
  await cp(resolve(workspace,'checkpoint-userdata'),resolve(workspace,'restored-userdata'),{recursive:true});await cp(resolve(workspace,'checkpoint-annual'),resolve(workspace,'restored-annual'),{recursive:true});
  assert.deepEqual(await files(resolve(workspace,'restored-userdata')),beforeFiles);assert.deepEqual(await files(resolve(workspace,'restored-annual')),beforeAnnual);
  evidence.cases.push('all SQL tables and C/H/daily/Annual bytes identical after independent restore');
  c.config.userdataDir=resolve(workspace,'restored-userdata');globalThis.__goalSqlRuntime.db={query:(...a)=>db.query(...a),execute:(...a)=>db.execute(...a),getConnection:async()=>({query:(...a)=>db.query(...a),execute:(...a)=>db.execute(...a),beginTransaction:()=>db.beginTransaction(),commit:()=>db.commit(),rollback:()=>db.rollback(),release(){}})};
  assert.deepEqual(await manualSourceSnapshot(c),sourceSnapshot);
  await c.scopeModule.withDomainScoreRead(c.taikoId,async()=>{assert.equal(c.scopeModule.scorePublication(c.taikoId).commitId,publication.commitId);});
  const {readActor,captureSourceReadForActor,withCapturedSourceRead}=await import('../server/services/account/source-access.ts');
  await assert.rejects(readActor(db,'developer',tokens['revoked-token'].digest),e=>e.statusCode===401);
  for(const kind of ['revoked-grant','expired-grant']){const actor=await readActor(db,'developer',tokens[kind].digest);await assert.rejects(captureSourceReadForActor(db,c.config,actor,c.taikoId,'history_read'),e=>e.statusCode===403);}
  const actor=await readActor(db,'developer',tokens['active-grant'].digest);
  const ticket=await captureSourceReadForActor(db,c.config,actor,c.taikoId,'source_read');
  await withCapturedSourceRead(ticket,async()=>assert.equal(await c.scopeModule.currentScoreScope(c.taikoId).reader.readRawCurrent(c.taikoId),sourceSnapshot.current));
  evidence.cases.push('actual authorization denies revoked token, revoked grant and expired grant; valid explicit grant reads current');
  c.tick();await c.manual.upsertManualScore(c.owner,c.taikoId,{...manualScoreInput,values:{...manualScoreInput.values,high_score:820000}});
  await c.scopeModule.withDomainScoreRead(c.taikoId,async()=>{const next=c.scopeModule.scorePublication(c.taikoId);assert.ok(next.sequence>publication.sequence);assert.notEqual(next.commitId,publication.commitId);evidence.nextPublication={sequence:next.sequence,commitId:next.commitId};});
  evidence.cases.push('restored owner core write succeeds with strictly increasing publication sequence');
  const readyAt=wallNow(),elapsedMs=performance.now()-incidentClock;
  evidence.recovery={checkpointAt:checkpoint,incidentAt,coreServiceReadyAt:readyAt,rpoMs:Date.parse(incidentAt)-Date.parse(checkpoint),rtoMs:elapsedMs,definition:'incident before replacement initialization until actual auth/current/history and core write succeed; synthetic service graph, not production HTTP readiness',targetsMet:elapsedMs<=7200000&&Date.parse(incidentAt)-Date.parse(checkpoint)<=900000};assert.equal(evidence.recovery.targetsMet,true);
  // A checkpoint whose subsequent revocation log cannot be proved must invalidate
  // every restored developer capability before opening access, including active ones.
  await db.query("UPDATE web_developer_tokens SET status='revoked',revoked_at=NOW() WHERE status='active'");await db.query("UPDATE taiko_source_service_grants SET status='revoked' WHERE status='active'");
  await assert.rejects(readActor(db,'developer',tokens['active-grant'].digest),e=>e.statusCode===401);
  evidence.cases.push('unknown revocation continuity fail-closed procedure invalidates all restored developer credentials before admission');
  // Corrupt checkpoint is rejected by the restore admission checksum guard.
  assert.throws(()=>verifyCheckpoint(backupRaw+'corruption',evidence.checkpoint.sqlSha256),/checkpoint integrity mismatch/);evidence.cases.push('corrupt SQL checkpoint rejected by the same pre-import checksum guard; production restore orchestrator remains unimplemented');
  evidence.status='PASS_SCOPED_SYNTHETIC_RESTORE';
 }catch(e){evidence.status='FAIL';evidence.failure={name:e.name,message:String(e.message).slice(0,500)};throw e;}
 finally{
  globalThis.__goalSqlRuntime.db=originalDb;c.config.userdataDir=originalRoot;
  await db?.end();if(daemon){daemon.kill('SIGTERM');const timer=setTimeout(()=>daemon.kill('SIGKILL'),10000);await exit;clearTimeout(timer);evidence.restoredDaemonExited=true;}
  evidence.finishedAt=wallNow();await writeFile(resolve(workspace,'evidence.json'),JSON.stringify(evidence,null,2)+'\n',{mode:0o600});console.log('RECOVERY_EVIDENCE '+resolve(workspace,'evidence.json'));
 }
}));
