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
 const db=await mysql.createConnection({host:process.env.TAIKO_DB_HOST,port:Number(process.env.TAIKO_DB_PORT||3306),user:process.env.TAIKO_DB_USER,password:process.env.TAIKO_DB_PASSWORD,database:process.env.TAIKO_DB_NAME});
 let folder;
 try{
  const [[identity]]=await db.query('SELECT DATABASE() AS name');
  assert.ok(identity.name?.endsWith('_test'),'actual database must end in _test');
  await db.query('SELECT id, started_at, created_at, status FROM web_annual_summary_jobs LIMIT 0');
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
   await db.execute('INSERT INTO web_annual_summary_jobs(id,user_id,binding_id,version_key,job_type,status,created_at,started_at) VALUES(?,?,?,?,?,?,DATE_SUB(NOW(),INTERVAL ? MINUTE),IF(?,NOW(),NULL))',[id,user.insertId,binding.insertId,'capacity_internal','build',status,age,started]);
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
  for(const [id,expected] of [[expired,'failed'],[running,'running'],[fresh,'queued'],[resumed,'queued'],[raced,'running']]){
   const [[row]]=await db.execute('SELECT status,error_code FROM web_annual_summary_jobs WHERE id=?',[id]);assert.equal(row.status,expected);
   if(id===expired)assert.equal(row.error_code,'ANNUAL_QUEUE_TIMEOUT');
  }
  console.log('queue TTL SQL contract PASS; fixture rollback; isolated database verified');
 }finally{await db.rollback();await db.end();delete globalThis.__capacityTestDb;if(folder)await rm(folder,{recursive:true,force:true});}
});
