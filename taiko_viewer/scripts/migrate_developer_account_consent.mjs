// Explicit operator command; never imported by a request handler or startup.
import mysql from 'mysql2/promise';
import {readFile,realpath} from 'node:fs/promises';
import {resolve,relative} from 'node:path';

const args=process.argv.slice(2);
const apply=args.includes('--apply');
const database=args.find(x=>x.startsWith('--database='))?.slice(11);
if(!database||!/^[a-zA-Z0-9_]+$/.test(database))throw Error('Explicit --database=<selected database> required');
const e=process.env;
const config=key=>e['NUXT_DB_'+key]||e['TAIKO_DB_'+key];
if(config('NAME')!==database)throw Error('Configured and requested databases must match');
if(apply){
 if(database.endsWith('_test')){
  if(e.TAIKO_ALLOW_TEST_DB_MUTATION!=='1')throw Error('Explicit test mutation opt-in required');
 }else if(!args.includes('--allow-production-schema-change'))throw Error('Explicit production schema opt-in required');
}
const db=await mysql.createConnection({host:config('HOST')||'127.0.0.1',port:Number(config('PORT')||3306),user:config('USER'),password:config('PASSWORD'),database,connectTimeout:3000});
try{
 const [[identity]]=await db.query('SELECT DATABASE() name,@@datadir datadir');
 if(identity.name!==database)throw Error('Selected database mismatch');
 if(apply&&database.endsWith('_test')){
  const scratch=await realpath(e.QA_RUN_TMPDIR||'');
  if(scratch!==resolve(await realpath(e.QA_RUN_DIR||''),'scratch')||!/^sql-[a-zA-Z0-9]+\/mysql$/.test(relative(scratch,await realpath(identity.datadir))))throw Error('Owned isolated test database required');
 }
 const inspect=async()=>{
  const [[column]]=await db.execute("SELECT IS_NULLABLE,COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='web_developer_resource_grants' AND COLUMN_NAME='expires_at'");
  if(!column||column.COLUMN_TYPE.toLowerCase()!=='datetime(3)')throw Error('Unexpected grant expiry schema');
  return column.IS_NULLABLE==='YES';
 };
 const ready=await inspect();
 if(apply&&!ready){
  await db.query('SET SESSION lock_wait_timeout=5');
  await db.execute(await readFile(new URL('../deploy/migrations/20261017_developer_account_consent.sql',import.meta.url),'utf8'));
  if(!await inspect())throw Error('Nullable expiry migration verification failed');
 }
 console.log(JSON.stringify({migration:'developer-account-consent',database,mode:apply?'apply':'check',status:ready||apply?'READY':'MIGRATION_REQUIRED',changed:apply&&!ready}));
 if(!ready&&!apply)process.exitCode=2;
}finally{await db.end();}
