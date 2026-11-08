import test from 'node:test';
import assert from 'node:assert/strict';
import {realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import mysql from 'mysql2/promise';
import {installSchemaModuleLoader} from '../scripts/schema_module_loader.mjs';

test('isolated account title campaign rejects roster changes and grants once with rollback and permanent account ownership',async()=>{
 assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1');
 const scratch=realpathSync(process.env.QA_RUN_TMPDIR);
 const socket=resolve(process.env.COMMUNITY_TEST_SOCKET||'');
 assert.equal(socket,resolve(scratch,'community-mysql.sock'));
 const admin=await mysql.createConnection({socketPath:socket,user:'root'});
 const loader=installSchemaModuleLoader();let pool,db;
 try{
  const [[host]]=await admin.query('SELECT @@datadir AS directory');
  assert.equal(realpathSync(host.directory),resolve(scratch,'community-mysql-data'));
  await admin.query('CREATE DATABASE viewer_account_titles_test CHARACTER SET utf8mb4');
  pool=mysql.createPool({socketPath:socket,user:'root',database:'viewer_account_titles_test',connectionLimit:2});
  db=await pool.getConnection();
  const [[identity]]=await db.query('SELECT DATABASE() AS name');assert.match(identity.name,/_test$/);
  const {CREATE_TABLES}=await import('../server/utils/account-schema-definition.ts');
  const {BETA_TABLES,BETA_MIGRATIONS}=await import('../server/services/annual-beta/schema.ts');
  const {ACCOUNT_TITLE_TABLE_SQL}=await import('../server/services/account-titles/schema.ts');
  const {schemaRequirement,validateSchemaTables}=await import('../server/utils/account-schema-runtime.ts');
  const {readAccountTitles,ANNUAL_BETA_TITLE}=await import('../server/services/account-titles/repository.ts');
  const {grantAnnualBetaTitle,readAnnualBetaTitleRecipients,normalizeRoster}=await import('../server/services/account-titles/annual-beta-grant.ts');
  for(const name of ['web_user_accounts','web_annual_summary_access','web_admin_action_logs'])await db.execute(CREATE_TABLES.find(sql=>sql.startsWith('CREATE TABLE IF NOT EXISTS '+name+' (')));
  for(const sql of BETA_TABLES)await db.execute(sql);
  for(const sql of BETA_MIGRATIONS)await db.execute(sql);
  await db.execute(ACCOUNT_TITLE_TABLE_SQL);await db.execute(ACCOUNT_TITLE_TABLE_SQL);
  await validateSchemaTables(db,[schemaRequirement(ACCOUNT_TITLE_TABLE_SQL)],'titles-test');
  for(const id of [990401,990402,990403,990404,990405]){
   await db.execute('INSERT INTO web_user_accounts(id,username,email,password_hash) VALUES (?,?,?,?)',[id,'synthetic-'+id,id+'@example.test','synthetic']);
   if(id===990405){await db.execute('INSERT INTO web_annual_summary_access(user_id) VALUES (?)',[id]);continue;}
   await db.execute("INSERT INTO web_beta_invites(id,code_hash,cohort,expires_at,used_count,analysis_excluded) VALUES (?,?,?,DATE_SUB(NOW(),INTERVAL 1 DAY),1,?)",['invite-'+id,String(id).padStart(64,'0'),'wave1',id===990403?1:0]);
   await db.execute('INSERT INTO web_annual_summary_access(user_id,invite_id,enabled) VALUES (?,?,?)',[id,'invite-'+id,id===990402?0:1]);
   await db.execute('INSERT INTO web_beta_participants(id,user_id,invite_id,analysis_excluded) VALUES (?,?,?,?)',['participant-'+id,id,'invite-'+id,id===990403?1:0]);
   if(id!==990404)await db.execute("INSERT INTO web_beta_events(event_id,participant_id,user_id,session_id,event_name,app_version,algorithm_version,locale,device_class,route,metadata_json) VALUES (?,?,?,?,'annual_report_open','1','synthetic','zh','mobile','/annual','{}')",['event-'+id,'participant-'+id,id,'s'.repeat(64)]);
  }
  const ids=[990401,990402];
  assert.deepEqual(await readAnnualBetaTitleRecipients(db),ids);
  assert.throws(()=>normalizeRoster([990401,990401]));
  assert.throws(()=>normalizeRoster(['990401']));
  await assert.rejects(()=>grantAnnualBetaTitle(db,[990401,990403],true),/reviewed roster/);
  assert.equal((await grantAnnualBetaTitle(db,ids,false)).pending,2);
  assert.equal((await db.query('SELECT COUNT(*) AS n FROM web_account_titles'))[0][0].n,0);
  // Force a late failure at the audit write; both title inserts must roll back.
  await db.query("CREATE TRIGGER synthetic_audit_failure BEFORE INSERT ON web_admin_action_logs FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic late audit failure'");
  await assert.rejects(()=>grantAnnualBetaTitle(db,ids,true),/synthetic late audit failure/);
  assert.equal((await db.query('SELECT COUNT(*) AS n FROM web_account_titles'))[0][0].n,0);
  await db.query('DROP TRIGGER synthetic_audit_failure');
  const second=await pool.getConnection();
  try{
   const results=await Promise.all([grantAnnualBetaTitle(db,ids,true),grantAnnualBetaTitle(second,ids,true)]);
   assert.equal(results.reduce((n,r)=>n+r.granted,0),2);
  }finally{second.release();}
  assert.equal((await grantAnnualBetaTitle(db,ids,true)).granted,0);
  assert.equal((await db.query('SELECT COUNT(*) AS n FROM web_admin_action_logs'))[0][0].n,1);
  const titles=await readAccountTitles(db,[...ids,990403,990404,990405]);
  assert.deepEqual(titles.get(990401),[ANNUAL_BETA_TITLE]);
  assert.equal(titles.has(990403),false);assert.equal(titles.has(990405),false);
  // Annual entitlement changes cannot remove already granted account titles.
  await db.execute('DELETE FROM web_annual_summary_access WHERE user_id=990401');
  assert.equal((await readAccountTitles(db,[990401])).get(990401)[0].name,'虹光先行者');
  await db.execute('UPDATE web_account_titles SET revoked_at=NOW() WHERE user_id=990402');
  assert.equal((await readAccountTitles(db,[990402])).size,0);
  await db.execute('INSERT INTO web_annual_summary_access(user_id,invite_id) VALUES (?,?)',[990401,'invite-990401']);
  await assert.rejects(()=>grantAnnualBetaTitle(db,ids,true),/conflict/);
  await assert.rejects(()=>db.execute("INSERT INTO web_account_titles(user_id,title_key,source) VALUES (999999,'annual-beta-pioneer','synthetic')"),e=>e.code==='ER_NO_REFERENCED_ROW_2');
  console.log(JSON.stringify({pass:true,database:identity.name,actualSelectDatabase:true,productionConnections:0,checks:['formal history including expired and disabled access','internal/unopened exclusion','manifest mismatch refusal','dry run has zero writes','late audit failure rolls back','concurrent and sequential retries grant once','ordinary accounts receive no title','account ownership outlives annual entitlement','revocation is not resurrected','account foreign key']}));
 }finally{loader.deregister();db?.release();await pool?.end();await admin.end();}
});
