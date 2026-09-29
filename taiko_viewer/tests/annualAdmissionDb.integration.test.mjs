import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import mysql from 'mysql2/promise';
import {build} from 'esbuild';

test('real MySQL: queue TTL and stale selection cannot overwrite a running job', {timeout:30000}, async()=>{
 assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1','explicit mutation opt-in required');
 if(process.env.TAIKO_TEST_ENV_FILE) process.loadEnvFile(process.env.TAIKO_TEST_ENV_FILE);
 const pool=mysql.createPool({host:process.env.TAIKO_DB_HOST,port:Number(process.env.TAIKO_DB_PORT||3306),user:process.env.TAIKO_DB_USER,password:process.env.TAIKO_DB_PASSWORD,database:process.env.TAIKO_DB_NAME,connectionLimit:4});
 const db=await pool.getConnection();
 let folder;
 try{
  const [[identity]]=await db.query('SELECT DATABASE() AS name');
  assert.ok(identity.name?.endsWith('_test'),'actual database must end in _test');
  const migrations=[
   'ADD COLUMN job_key CHAR(64) DEFAULT NULL AFTER progress_detail','ADD COLUMN active_key CHAR(64) DEFAULT NULL AFTER job_key',
   'ADD COLUMN algorithm_version VARCHAR(64) DEFAULT NULL AFTER active_key','ADD COLUMN input_fingerprint CHAR(64) DEFAULT NULL AFTER algorithm_version',
   'ADD COLUMN source_revision CHAR(64) DEFAULT NULL AFTER input_fingerprint','ADD COLUMN estimated_service_seconds DECIMAL(8,2) NOT NULL DEFAULT 1.00 AFTER source_revision',
   'ADD COLUMN queued_at DATETIME DEFAULT CURRENT_TIMESTAMP AFTER estimated_service_seconds','ADD COLUMN lease_owner VARCHAR(96) DEFAULT NULL AFTER queued_at',
   'ADD COLUMN lease_until DATETIME DEFAULT NULL AFTER lease_owner','ADD COLUMN heartbeat_at DATETIME DEFAULT NULL AFTER lease_until',
   'ADD COLUMN attempt INT UNSIGNED NOT NULL DEFAULT 0 AFTER heartbeat_at',
   'ADD UNIQUE KEY uniq_web_annual_summary_jobs_active_key (active_key)',
   'ADD KEY idx_web_annual_summary_jobs_claim (job_type,status,queued_at)','ADD KEY idx_web_annual_summary_jobs_lease (status,lease_until)'
  ];
  for(const migration of migrations){try{await db.query(`ALTER TABLE web_annual_summary_jobs ${migration}`);}catch(error){if(![1060,1061].includes(Number(error.errno)))throw error;}}
  for(const migration of ['ADD KEY idx_web_annual_summaries_owner_version (user_id,binding_id,version_key,created_at)','ADD KEY idx_web_annual_summaries_fingerprint (input_fingerprint)']){try{await db.query(`ALTER TABLE web_annual_summaries ${migration}`);}catch(error){if(Number(error.errno)!==1061)throw error;}}
  const [summaryIndexes]=await db.query('SHOW INDEX FROM web_annual_summaries');
  const grouped=new Map();for(const row of summaryIndexes){const value=grouped.get(row.Key_name)||{nonUnique:Number(row.Non_unique),columns:[]};value.columns.push([Number(row.Seq_in_index),row.Column_name]);grouped.set(row.Key_name,value);}
  for(const [name,value] of grouped){const columns=value.columns.sort((a,b)=>a[0]-b[0]).map(item=>item[1]).join(',');if(name!=='PRIMARY'&&value.nonUnique===0&&columns==='user_id,binding_id,version_key')await db.query(`ALTER TABLE web_annual_summaries DROP INDEX \`${String(name).replaceAll('`','``')}\``);}
  await db.query('SELECT id, queued_at, lease_owner, lease_until, attempt, status FROM web_annual_summary_jobs LIMIT 0');
  folder=await mkdtemp(join(tmpdir(),'annual-capacity-db-'));
  // Real production repository SQL, real test schema and FKs. A single
  // transaction rolls back all changes, including any old expired test rows.
  await build({entryPoints:[resolve('server/services/account/annual-summary/repository.ts')],outfile:join(folder,'repository.mjs'),bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'isolated-test-connection',setup(b){b.onResolve({filter:/^~\/server\/utils\/account-db$/},()=>({path:'connection',namespace:'capacity-test'}));b.onLoad({filter:/.*/,namespace:'capacity-test'},()=>({contents:'export const getAccountDb=()=>globalThis.__capacityTestDb; export const ensureAccountSchema=async()=>{};'}));}}]});
  await db.beginTransaction();
  const marker=randomUUID();
  const [user]=await db.execute('INSERT INTO web_user_accounts(username,email,password_hash,email_verified) VALUES(?,?,?,1)',['capacity_'+marker,marker+'@example.invalid','not-a-login']);
  const [binding]=await db.execute('INSERT INTO web_taiko_bindings(user_id,taiko_id,source,is_current) VALUES(?,?,?,1)',[user.insertId,'9'+String(Date.now()),'hiroba']);
  const expired=randomUUID(),running=randomUUID(),fresh=randomUUID(),resumed=randomUUID(),raced=randomUUID();
  for(const [id,status,age,started] of [[expired,'queued',11,false],[running,'running',11,true],[fresh,'queued',1,false],[resumed,'queued',11,true],[raced,'queued',11,false]]){
   await db.execute('INSERT INTO web_annual_summary_jobs(id,user_id,binding_id,version_key,job_type,status,created_at,queued_at,started_at) VALUES(?,?,?,?,?,?,DATE_SUB(NOW(),INTERVAL ? MINUTE),DATE_SUB(NOW(),INTERVAL ? MINUTE),IF(?,NOW(),NULL))',[id,user.insertId,binding.insertId,'capacity_internal','build',status,age,age,started]);
  }
  let interleaved=false;
  globalThis.__capacityTestDb={execute:async(sql,args)=>{
   const result=await db.execute(sql,args);
   if(!interleaved&&sql.startsWith('SELECT * FROM web_annual_summary_jobs WHERE status')){
    interleaved=true;
    await db.execute("UPDATE web_annual_summary_jobs SET status='running',started_at=NOW() WHERE id=?",[raced]);
   }
   return result;
  }};
  const {expireQueuedAnnualJobs,markAnnualJobRunning}=await import(pathToFileURL(join(folder,'repository.mjs')).href);
  const result=await expireQueuedAnnualJobs();
  assert.ok(result.some(row=>row.id===expired));assert.ok(!result.some(row=>row.id===raced));
  assert.equal(await markAnnualJobRunning(expired),false,'expired job cannot start after timer wins');
  for(const [id,expected] of [[expired,'expired'],[running,'running'],[fresh,'queued'],[resumed,'expired'],[raced,'running']]){
   const [[row]]=await db.execute('SELECT status,error_code FROM web_annual_summary_jobs WHERE id=?',[id]);assert.equal(row.status,expected);
   if(id===expired)assert.equal(row.error_code,'ANNUAL_QUEUE_TIMEOUT');
  }
  await db.rollback();

  globalThis.__capacityTestDb=pool;
  const durable=await import(`${pathToFileURL(join(folder,'repository.mjs')).href}?durable`);
  const durableMarker=randomUUID();
  const [durableUser]=await pool.execute('INSERT INTO web_user_accounts(username,email,password_hash,email_verified) VALUES(?,?,?,1)',['durable_'+durableMarker,durableMarker+'@example.invalid','not-a-login']);
  try{
   const [durableBinding]=await pool.execute('INSERT INTO web_taiko_bindings(user_id,taiko_id,source,is_current) VALUES(?,?,?,1)',[durableUser.insertId,'8'+String(Date.now()),'hiroba']);
   const [durableBinding2]=await pool.execute('INSERT INTO web_taiko_bindings(user_id,taiko_id,source,is_current) VALUES(?,?,?,0)',[durableUser.insertId,'7'+String(Date.now()),'hiroba']);
   const [durableBinding3]=await pool.execute('INSERT INTO web_taiko_bindings(user_id,taiko_id,source,is_current) VALUES(?,?,?,0)',[durableUser.insertId,'6'+String(Date.now()),'hiroba']);
   const make=(suffix,seconds=2)=>({id:randomUUID(),userId:durableUser.insertId,bindingId:durableBinding.insertId,versionKey:'capacity_durable',jobKey:suffix.padEnd(64,'0'),algorithmVersion:'annual-observation-v4.5.2',inputFingerprint:suffix.padEnd(64,'1'),sourceRevision:suffix.padEnd(64,'2'),estimatedServiceSeconds:seconds,parameters:{}});
   for(const suffix of ['1','2'])await pool.execute(`INSERT INTO web_annual_summaries
    (id,user_id,binding_id,version_key,schema_version,data_mode,input_fingerprint,summary_path,events_path,event_count,generated_at)
    VALUES(?,?,?,?,4,'current_archive',?,?,?,?,NOW())`,[randomUUID(),durableUser.insertId,durableBinding.insertId,'capacity_retention',suffix.padEnd(64,'f'),`/fixture/${suffix}/summary.json`,`/fixture/${suffix}/events.json`,0]);
   const [[retained]]=await pool.execute("SELECT COUNT(*) AS count FROM web_annual_summaries WHERE user_id=? AND version_key='capacity_retention'",[durableUser.insertId]);
   assert.equal(Number(retained.count),2,'current and previous revisions can coexist');
   const first=await durable.admitAnnualBuildJob(make('a'));
   const joined=await durable.admitAnnualBuildJob({...make('a'),id:randomUUID()});
   assert.equal(joined.joined,true);assert.equal(joined.job.id,first.job.id,'same fingerprint must single-flight');
   const second=await durable.admitAnnualBuildJob({...make('b'),bindingId:durableBinding2.insertId});
   const third=await durable.admitAnnualBuildJob({...make('c'),bindingId:durableBinding3.insertId});
   const claimed1=await durable.claimNextAnnualBuild('test-owner-1');
   const claimed2=await durable.claimNextAnnualBuild('test-owner-2');
   assert.ok(claimed1&&claimed2);assert.notEqual(claimed1.id,claimed2.id);assert.equal(await durable.claimNextAnnualBuild('test-owner-3'),null,'global N=2 claim');
   assert.equal(await durable.heartbeatAnnualBuild(claimed1.id,'test-owner-1'),true);
   assert.equal(await durable.completeLeasedAnnualBuild(claimed1.id,'test-owner-1',null),true);
   await pool.execute("UPDATE web_annual_summary_jobs SET lease_until=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE id=?",[claimed2.id]);
   const reclaimed=await durable.claimNextAnnualBuild('test-owner-3');
   assert.equal(reclaimed.id,claimed2.id,'expired lease must be reclaimed before later FIFO work');
   assert.equal(Number(reclaimed.attempt),2);
   assert.equal(await durable.failLeasedAnnualBuild(reclaimed.id,'test-owner-3','FIXTURE_FAILURE','fixture'),true);
   const [[failedRow]]=await pool.execute('SELECT status,active_key,error_code FROM web_annual_summary_jobs WHERE id=?',[reclaimed.id]);
   assert.deepEqual({status:failedRow.status,activeKey:failedRow.active_key,code:failedRow.error_code},{status:'failed',activeKey:null,code:'FIXTURE_FAILURE'});
   await pool.execute("UPDATE web_annual_summary_jobs SET status='cancelled',active_key=NULL WHERE id=?",[third.job.id]);
  }finally{
   await pool.execute('DELETE FROM web_user_accounts WHERE id=?',[durableUser.insertId]);
  }
  console.log('durable queue SQL contract PASS; lease recovery and N=2 verified; isolated database verified');
 }finally{await db.rollback().catch(()=>{});db.release();await pool.end();delete globalThis.__capacityTestDb;if(folder)await rm(folder,{recursive:true,force:true});}
});
