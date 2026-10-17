// Added checkpoint recovery scope; run only through owned run-isolated-sql.mjs.
import assert from 'node:assert/strict';
import test from 'node:test';
import {registerHooks} from 'node:module';
import mysql from 'mysql2/promise';
import {spawn} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import {cp,mkdir,mkdtemp,open,readFile,readdir,realpath,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import {manualSourceSnapshot,manualScoreInput} from './fixtures/manualSqlRuntime.mjs';
import {accountSourceFixture} from './fixtures/accountSourceHttp.mjs';
import {populate} from './fixtures/manualLifecycleRuntime.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const encode=x=>JSON.stringify(x);
const decode=x=>JSON.parse(x,(_,v)=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)?new Date(v):v);
function verifyCheckpoint(raw,expected){assert.equal(hash(raw),expected,'checkpoint integrity mismatch');return decode(raw);}
async function files(root,prefix='') {const out={};for(const e of await readdir(resolve(root,prefix),{withFileTypes:true})){const name=prefix?prefix+'/'+e.name:e.name;if(e.isDirectory())Object.assign(out,await files(root,name));else if(e.isFile())out[name]=hash(await readFile(resolve(root,name)));else assert.fail('Only regular synthetic files allowed');}return out;}
async function run(command,args,logPath){const log=await open(logPath,'w',0o600);const p=spawn(command,args,{stdio:['ignore',log.fd,log.fd]});const timer=setTimeout(()=>p.kill('SIGKILL'),90000);try{return await new Promise((res,rej)=>{p.once('error',rej);p.once('close',code=>res(code));});}finally{clearTimeout(timer);await log.close();}}

test('real HTTP authentication reads and core writes become ready after independent SQL and publication restore', {timeout:240000},async()=>accountSourceFixture(async c=>{
 const wallNow=()=>new Date(performance.timeOrigin+performance.now()).toISOString();
 const vault='/home/sigaer/taiko/qa-vault';
 const evidenceRoot=await realpath(process.env.QA_EVIDENCE_DIR),scratchRoot=await realpath(process.env.QA_RUN_TMPDIR);
 assert.ok(evidenceRoot.startsWith(vault+'/runs/')&&scratchRoot.startsWith(vault+'/runs/'),'owned durable QA paths required');
 assert.equal(evidenceRoot,resolve(scratchRoot,'../evidence'));
 const workspace=await mkdtemp(resolve(evidenceRoot,'http-restore-'));
 const restoredScratch=await mkdtemp(resolve(scratchRoot,'r-'));
 const manifestPath=await realpath(process.env.QA_ARTIFACT_MANIFEST);assert.ok(manifestPath.startsWith(vault+'/'));
 const manifestRaw=await readFile(manifestPath,'utf8'),artifacts=JSON.parse(manifestRaw);
 assert.equal(process.env.TAIKO_PYTHON_EXECUTABLE,artifacts.candidate.python);
 assert.equal(hash(await readFile(artifacts.candidate.wheelFile)),artifacts.candidate.wheelSha256);
 assert.equal(hash(await readFile(artifacts.candidate.originEvidenceFile)),artifacts.candidate.originEvidenceSha256);
 const evidence={status:'RUNNING',workspace,artifactManifestSha256:hash(manifestRaw),candidate:artifacts.candidate,testSourceSha256:hash(await readFile(new URL(import.meta.url))),restoredScratch,scope:'synthetic independent SQL + real loopback login/session/private current/history/manual POST; no production readiness claim',productionAccess:false,offHostBackup:'BLOCKED_NO_AUTHORIZED_DESTINATION',cases:[],startedAt:wallNow()};
 const sensitive=new Set([c.cookie,c.cookie?.split('=')[1]].filter(Boolean));
 const redact=value=>{let text=String(value);for(const secret of sensitive)text=text.split(secret).join('[redacted-synthetic-credential]');return text;};
 let daemon,db,exit;const originalDb=globalThis.__goalSqlRuntime.db,originalRoot=c.config.userdataDir;
 try {
  const f=await populate(c);c.tick();await c.manual.upsertManualScore(c.owner,c.taikoId,{...manualScoreInput,values:{...manualScoreInput.values,high_score:810000}});
  const annualDir=resolve(c.root,'annual');await mkdir(annualDir);
  const annual={summaryId:'00000000-0000-4000-8000-000000000082',algorithmVersion:'v4.5.3',inputFingerprint:'e'.repeat(64),schemaVersion:4,bindingId:f.id,source:'synthetic',published:true};
  await writeFile(resolve(annualDir,'report.json'),encode(annual)+'\n');
  // Use the exact repository Annual table DDL, including its foreign keys.
  const accountSource=await readFile(new URL('../server/utils/account-schema-definition.ts',import.meta.url),'utf8');
  const annualDdl=accountSource.match(/`(CREATE TABLE IF NOT EXISTS web_annual_summaries \([\s\S]*?ENGINE=InnoDB DEFAULT CHARSET=utf8mb4)`/)[1];
  await c.pool.query(annualDdl);
  await c.pool.execute('INSERT INTO web_annual_summaries (id,user_id,binding_id,version_key,data_mode,input_fingerprint,summary_path,events_path,generated_at) VALUES (?,?,?,?,?,?,?,?,NOW())',[annual.summaryId,c.user,f.id,'historical-v4.5.3','snapshot',annual.inputFingerprint,'report.json','events.json']);
  const shareDdl=accountSource.match(/`(CREATE TABLE IF NOT EXISTS web_annual_shares \([\s\S]*?ENGINE=InnoDB DEFAULT CHARSET=utf8mb4)`/)[1];
  await c.pool.query(shareDdl);
  await c.pool.execute('INSERT INTO web_annual_shares(id,summary_id,user_id,token_hash,status,expires_at,revoked_at) VALUES (?,?,?,?,?,DATE_ADD(NOW(),INTERVAL 1 DAY),NOW())',['00000000-0000-4000-8000-000000000083',annual.summaryId,c.user,hash('synthetic-annual-share'),'revoked']);
  const [developer]=await c.pool.execute("INSERT INTO web_user_accounts(username,email,password_hash) VALUES ('restore-developer','restore-developer@example.test','synthetic-no-login')");
  const tokens={};
  for(const kind of ['revoked-token','revoked-grant','expired-grant','active-grant']){
   const raw=randomBytes(24).toString('hex'),digest=hash(raw);const [t]=await c.pool.execute("INSERT INTO web_developer_tokens(user_id,token_hash,token_mask,status,revoked_at) VALUES (?,?,?, ?,IF(?='revoked',NOW(),NULL))",[developer.insertId,digest,'synthetic',kind==='revoked-token'?'revoked':'active',kind==='revoked-token'?'revoked':'active']);
   tokens[kind]={id:t.insertId,digest,raw};sensitive.add(raw);
   await c.pool.execute("INSERT INTO taiko_source_service_grants(developer_token_id,developer_user_id,service_name,scopes_json,sources_json,revision_nonce,status,issued_by_user_id,expires_at) VALUES (?,?, 'restore-test',?,?,?, ?,?,IF(?=1,DATE_SUB(NOW(),INTERVAL 1 DAY),DATE_ADD(NOW(),INTERVAL 1 DAY)))",[t.insertId,developer.insertId,JSON.stringify(['source_read','history_read']),JSON.stringify([c.taikoId]),'a'.repeat(32),kind==='revoked-grant'?'revoked':'active',c.user,kind==='expired-grant'?1:0]);
  }
  evidence.httpAdapter='real routes/services; test-local barrel resolves manual handler to real auth/manual exports; no handler behavior stubs';
  c.route('get','/restore-current/:userid',(await import('../server/api/developer/userdata/[userid].get.ts')).default);
  c.route('get','/restore-history/:taikoId',(await import('../server/api/taiko/proxy/userdata/[taikoId]/history.get.ts')).default);
  // Existing fixture barrel intentionally omits manual exports. Resolve only
  // this real handler to the real auth/manual modules; no behavior stub.
  const manualRoute=new URL('../server/api/account/manual.post.ts',import.meta.url).href;
  const manualBarrel='data:text/javascript,'+encodeURIComponent(`export * from '${new URL('../server/utils/account/auth.ts',import.meta.url).href}';export * from '${new URL('../server/utils/account/manual.ts',import.meta.url).href}';`);
  const routeHook=registerHooks({resolve(specifier,context,next){return specifier==='~/server/utils/account'&&context.parentURL===manualRoute?{url:manualBarrel,shortCircuit:true}:next(specifier,context);}});
  try{c.route('post','/restore-manual',(await import(manualRoute)).default);}finally{routeHook.deregister();}
  const headers=kind=>({authorization:'Bearer '+tokens[kind].raw});
  async function httpDigest(path,kind='active-grant'){
   const response=await c.request('GET',path,null,'',headers(kind));
   const bytes=new Uint8Array(await response.arrayBuffer());assert.ok(bytes.byteLength<2_000_000,'bounded synthetic HTTP response');
   const sourceView=response.headers.get('x-taiko-source-view');
   if(response.status===200){
    const payload=JSON.parse(Buffer.from(bytes).toString('utf8'));
    if(path.startsWith('/restore-history/'))assert.ok(payload.ok===true&&payload.taikoId===c.taikoId&&Array.isArray(payload.snapshots)&&payload.snapshots.length>0,'real nonempty restored history required');
    else assert.ok(Array.isArray(payload.songs)&&payload.songs.length>0,'real current scores required');
    assert.ok(sourceView,'HTTP publication identity required');
   }
   return {status:response.status,sha256:hash(bytes),bytes:bytes.byteLength,sourceView};
  }
  const currentPath='/restore-current/'+c.taikoId,historyPath='/restore-history/'+c.taikoId;
  const baselineHttp={current:await httpDigest(currentPath),history:await httpDigest(historyPath)};
  assert.equal(baselineHttp.current.status,200);assert.equal(baselineHttp.history.status,200);
  evidence.baselineHttp=baselineHttp;
  const sourceSnapshot=await manualSourceSnapshot(c);
  let publication;await c.scopeModule.withDomainScoreRead(c.taikoId,async()=>{publication=c.scopeModule.scorePublication(c.taikoId);});
  // All application writers are quiesced for the entire SQL + filesystem checkpoint.
  // This is a controlled cold snapshot, not proof of online PITR/backup scheduling.
  const checkpoint=wallNow();
  const [[sourceIdentity]]=await c.pool.query('SELECT DATABASE() AS name,@@datadir AS datadir');
  assert.match(sourceIdentity.name,/_test$/);assert.equal(await realpath(sourceIdentity.datadir),await realpath(process.env.TAIKO_TEST_MYSQL_DATADIR));
  const [tables]=await c.pool.query('SHOW TABLES');const backup=[];
  for(const row of tables){const name=Object.values(row)[0];assert.match(name,/^[a-z_]+$/);const [[ddl]]=await c.pool.query('SHOW CREATE TABLE `'+name+'`');const [rows]=await c.pool.query('SELECT * FROM `'+name+'`');const [columns]=await c.pool.query('SHOW COLUMNS FROM `'+name+'`');const generated=columns.filter(x=>/(?:VIRTUAL|STORED) GENERATED/.test(x.Extra)).map(x=>x.Field);backup.push({name,ddl:ddl['Create Table'],rows,generated});}
  for(const table of backup)for(const row of table.rows)if(typeof row.session_token==='string')sensitive.add(row.session_token);
  const backupRaw=encode(backup);await writeFile(resolve(restoredScratch,'checkpoint-sql.json'),backupRaw,{mode:0o600});
  await cp(originalRoot,resolve(workspace,'checkpoint-userdata'),{recursive:true});await cp(annualDir,resolve(workspace,'checkpoint-annual'),{recursive:true});
  // Session cookies are stored verbatim by this service. Keep the restorable
  // SQL checkpoint only in owned scratch; durable SQL archive is explicitly redacted.
  const redactedBackup=backup.map(table=>({...table,rows:table.rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,key==='session_token'?'sha256:'+hash(String(value)):value])))}));
  await writeFile(resolve(workspace,'checkpoint-sql-redacted.json'),encode(redactedBackup),{mode:0o600});
  evidence.sqlArchive={rawCheckpointLocation:'SCRATCH_ONLY_REMOVED_AT_EXIT',redactedArchive:'checkpoint-sql-redacted.json',restorableArchive:false,redactedFields:['web_user_sessions.session_token']};
  const beforeFiles=await files(resolve(workspace,'checkpoint-userdata'));const beforeAnnual=await files(resolve(workspace,'checkpoint-annual'));
  evidence.checkpoint={at:checkpoint,sqlSha256:hash(backupRaw),publication:{sequence:publication.sequence,commitId:publication.commitId},userdataHashes:beforeFiles,annualHashes:beforeAnnual};
  // Incident starts before replacement server initialization/import/readiness checks.
  const incidentClock=performance.now(),incidentAt=wallNow();
  globalThis.__goalSqlRuntime.db={execute:()=>{throw new Error('Synthetic incident: original DB unavailable');}};
  c.config.userdataDir=resolve(workspace,'unavailable-original');
  assert.throws(()=>globalThis.__goalSqlRuntime.db.execute('SELECT 1'),/original DB unavailable/);
  const unavailable=await c.request('GET','/profile');await unavailable.arrayBuffer();
  assert.ok(unavailable.status>=500,'HTTP account service must actually be unavailable during incident');
  evidence.incidentHttpStatus=unavailable.status;
  evidence.cases.push('actual HTTP account request fails after DB disconnection and before replacement initialization');
  const datadir=resolve(restoredScratch,'db');await mkdir(datadir,{mode:0o700});
  const args=['--no-defaults','--user=root','--basedir=/www/server/mysql',`--datadir=${datadir}`,'--innodb-buffer-pool-size=128M','--innodb-log-file-size=32M','--performance-schema=OFF'];
  const executable='/www/server/mysql/bin/mysqld';
  assert.equal(await run(executable,[...args,'--initialize-insecure'],resolve(workspace,'initialize.log')),0);
  const socket=resolve(restoredScratch,'r.sock'),log=await open(resolve(workspace,'mysql.log'),'w',0o600);
  assert.ok(Buffer.byteLength(socket)<104,'Owned restore socket path too long');
  daemon=spawn(executable,[...args,'--skip-networking','--mysqlx=OFF',`--socket=${socket}`,`--pid-file=${restoredScratch}/mysql.pid`],{stdio:['ignore',log.fd,log.fd]});
  exit=new Promise(res=>daemon.once('close',res));await log.close();
  for(let i=0;i<160;i++){try{db=await mysql.createConnection({socketPath:socket,user:'root',connectTimeout:500});break;}catch{await new Promise(r=>setTimeout(r,250));}}
  assert.ok(db);await db.query('CREATE DATABASE viewer082_restore_test');await db.changeUser({database:'viewer082_restore_test'});
  const [[identity]]=await db.query('SELECT DATABASE() AS name,@@datadir AS datadir');assert.match(identity.name,/_test$/);assert.equal(await realpath(identity.datadir),await realpath(datadir));assert.notEqual(await realpath(identity.datadir),await realpath(sourceIdentity.datadir));assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1');
  evidence.databaseProof={source:sourceIdentity,restored:identity,independentDatadirs:true};
  // Restore from serialized disk checkpoint, not the live source DB.
  assert.equal(hash(await readFile(resolve(restoredScratch,'checkpoint-sql.json'))),evidence.checkpoint.sqlSha256);
  await db.query('SET FOREIGN_KEY_CHECKS=0');
  const restored=verifyCheckpoint(await readFile(resolve(restoredScratch,'checkpoint-sql.json'),'utf8'),evidence.checkpoint.sqlSha256);
  for(const table of restored){await db.query(table.ddl);for(const row of table.rows)await db.query('INSERT INTO `'+table.name+'` SET ?',Object.fromEntries(Object.entries(row).filter(([key])=>!table.generated.includes(key))));}
  await db.query('SET FOREIGN_KEY_CHECKS=1');
  for(const table of backup){const [rows]=await db.query('SELECT * FROM `'+table.name+'`');assert.equal(hash(encode(rows)),hash(encode(table.rows)),table.name+' parity');}
  await cp(resolve(workspace,'checkpoint-userdata'),resolve(restoredScratch,'restored-userdata'),{recursive:true});await cp(resolve(workspace,'checkpoint-annual'),resolve(restoredScratch,'restored-annual'),{recursive:true});
  assert.deepEqual(await files(resolve(restoredScratch,'restored-userdata')),beforeFiles);assert.deepEqual(await files(resolve(restoredScratch,'restored-annual')),beforeAnnual);
  evidence.cases.push('all SQL tables and C/H/daily/Annual bytes identical after independent restore');
  c.config.userdataDir=resolve(restoredScratch,'restored-userdata');globalThis.__goalSqlRuntime.db={query:(...a)=>db.query(...a),execute:(...a)=>db.execute(...a),getConnection:async()=>({query:(...a)=>db.query(...a),execute:(...a)=>db.execute(...a),beginTransaction:()=>db.beginTransaction(),commit:()=>db.commit(),rollback:()=>db.rollback(),release(){}})};
  assert.deepEqual(await manualSourceSnapshot(c),sourceSnapshot);
  await c.scopeModule.withDomainScoreRead(c.taikoId,async()=>{assert.equal(c.scopeModule.scorePublication(c.taikoId).commitId,publication.commitId);});
  const {readActor,captureSourceReadForActor,withCapturedSourceRead}=await import('../server/services/account/source-access.ts');
  await assert.rejects(readActor(db,'developer',tokens['revoked-token'].digest),e=>e.statusCode===401);
  for(const kind of ['revoked-grant','expired-grant']){const actor=await readActor(db,'developer',tokens[kind].digest);await assert.rejects(captureSourceReadForActor(db,c.config,actor,c.taikoId,'history_read'),e=>e.statusCode===403);}
  const actor=await readActor(db,'developer',tokens['active-grant'].digest);
  const ticket=await captureSourceReadForActor(db,c.config,actor,c.taikoId,'source_read');
  await withCapturedSourceRead(ticket,async()=>assert.equal(await c.scopeModule.currentScoreScope(c.taikoId).reader.readRawCurrent(c.taikoId),sourceSnapshot.current));
  evidence.cases.push('actual authorization denies revoked token, revoked grant and expired grant; valid explicit grant reads current');
  c.cookie=await c.login();sensitive.add(c.cookie);sensitive.add(c.cookie.split('=')[1]); // Actual restored password/session service; never archive cookie.
  const profile=await c.request('GET','/profile');await profile.arrayBuffer();assert.equal(profile.status,200);
  const restoredHttp={current:await httpDigest(currentPath),history:await httpDigest(historyPath)};
  assert.deepEqual(restoredHttp,baselineHttp,'restored HTTP current/history bytes differ');
  const revokedHttp=await httpDigest(currentPath,'revoked-token');assert.equal(revokedHttp.status,401);
  const grantStatuses={};for(const kind of ['revoked-grant','expired-grant']){grantStatuses[kind]=(await httpDigest(currentPath,kind)).status;assert.equal(grantStatuses[kind],403);}
  evidence.restoredHttp={...restoredHttp,profileStatus:profile.status,revokedTokenStatus:revokedHttp.status,grantStatuses};
  c.tick();const written=await c.request('POST','/restore-manual',{action:'score-upsert',taikoId:c.taikoId,...manualScoreInput,values:{...manualScoreInput.values,high_score:820000}});
  await written.arrayBuffer();assert.equal(written.status,200,'restored HTTP core write failed');
  const afterWrite=await httpDigest(currentPath);assert.equal(afterWrite.status,200);assert.notEqual(afterWrite.sha256,baselineHttp.current.sha256);
  evidence.coreWriteHttp={status:written.status,currentAfterWrite:afterWrite};
  await c.scopeModule.withDomainScoreRead(c.taikoId,async()=>{const next=c.scopeModule.scorePublication(c.taikoId);assert.ok(next.sequence>publication.sequence);assert.notEqual(next.commitId,publication.commitId);evidence.nextPublication={sequence:next.sequence,commitId:next.commitId};});
  evidence.cases.push('restored owner core write succeeds with strictly increasing publication sequence');
  const readyAt=wallNow(),elapsedMs=performance.now()-incidentClock;
  evidence.recovery={checkpointAt:checkpoint,incidentAt,coreServiceReadyAt:readyAt,rpoMs:Date.parse(incidentAt)-Date.parse(checkpoint),rtoMs:elapsedMs,definition:'incident before unavailable HTTP request and replacement initialization until real HTTP login/profile/current/history/core POST and subsequent current GET succeed; synthetic loopback only',targetsMet:elapsedMs<=7200000&&Date.parse(incidentAt)-Date.parse(checkpoint)<=900000};assert.equal(evidence.recovery.targetsMet,true);
  // A checkpoint whose subsequent revocation log cannot be proved must invalidate
  // every restored developer capability before opening access, including active ones.
  await db.query("UPDATE web_developer_tokens SET status='revoked',revoked_at=NOW() WHERE status='active'");await db.query("UPDATE taiko_source_service_grants SET status='revoked' WHERE status='active'");
  await assert.rejects(readActor(db,'developer',tokens['active-grant'].digest),e=>e.statusCode===401);
  const unknownContinuityHttp=await httpDigest(currentPath);assert.equal(unknownContinuityHttp.status,401);
  await db.query('DELETE FROM web_user_sessions');
  const unknownSession=await c.request('GET','/profile');await unknownSession.arrayBuffer();assert.equal(unknownSession.status,401);
  evidence.unknownRevocationContinuityHttpStatus=unknownContinuityHttp.status;
  evidence.unknownSessionContinuityHttpStatus=unknownSession.status;
  evidence.cases.push('unknown revocation continuity fail-closed procedure invalidates restored developer capabilities and account sessions; both HTTP rereads denied 401');
  // Corrupt checkpoint is rejected by the restore admission checksum guard.
  assert.throws(()=>verifyCheckpoint(backupRaw+'corruption',evidence.checkpoint.sqlSha256),/checkpoint integrity mismatch/);evidence.cases.push('corrupt SQL checkpoint rejected by the same pre-import checksum guard; production restore orchestrator remains unimplemented');
  // Active publication hardlinks stay in scratch; archive independent copies only.
  await cp(resolve(restoredScratch,'restored-userdata'),resolve(workspace,'post-recovery-userdata'),{recursive:true});
  await cp(resolve(restoredScratch,'restored-annual'),resolve(workspace,'post-recovery-annual'),{recursive:true});
  evidence.postRecoveryFileHashes=await files(resolve(workspace,'post-recovery-userdata'));
  evidence.status='PASS_SCOPED_HTTP_RESTORE';
 }catch(e){evidence.status='FAIL';evidence.failure={name:e.name,message:redact(e.message).slice(0,500)};throw new Error('HTTP recovery failed: '+redact(e.message).slice(0,500));}
 finally{
  globalThis.__goalSqlRuntime.db=originalDb;c.config.userdataDir=originalRoot;
  await db?.end();if(daemon){daemon.kill('SIGTERM');const timer=setTimeout(()=>daemon.kill('SIGKILL'),10000);await exit;clearTimeout(timer);evidence.restoredDaemonExited=true;}
  evidence.finishedAt=wallNow();await writeFile(resolve(workspace,'evidence.json'),JSON.stringify(evidence,null,2)+'\n',{mode:0o600});console.log('RECOVERY_EVIDENCE '+resolve(workspace,'evidence.json'));
 }
},{manual:true,withDeveloper:true,withRealPython:true}));
