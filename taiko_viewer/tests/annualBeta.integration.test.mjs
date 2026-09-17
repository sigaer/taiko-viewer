import test from 'node:test';import assert from 'node:assert/strict';import mysql from 'mysql2/promise';import {randomUUID} from 'node:crypto';
import {BETA_TABLES,BETA_MIGRATIONS} from '../server/services/annual-beta/schema.ts';
import {createBetaInvite,validateBetaInvite,redeemBetaInvite,hashBetaToken} from '../server/services/annual-beta/core.ts';
test('real MySQL: validate is free, pending survives auth, concurrent single-use has one winner',async()=>{
 const db=mysql.createPool({host:process.env.TAIKO_DB_HOST,port:Number(process.env.TAIKO_DB_PORT||3306),user:process.env.TAIKO_DB_USER,password:process.env.TAIKO_DB_PASSWORD,database:process.env.TAIKO_DB_NAME,connectionLimit:4});const ids=[],invites=[];let allowed=false;
 try{
  const [identity]=await db.query('SELECT DATABASE() AS databaseName');assert.ok(identity[0].databaseName.endsWith('_test'));assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1');allowed=true;
  for(const sql of BETA_TABLES)await db.execute(sql);
  for(const sql of BETA_MIGRATIONS){try{await db.execute(sql);}catch(e){if(!['ER_DUP_FIELDNAME','ER_DUP_KEYNAME'].includes(e.code))throw e;}}
  for(let n=0;n<3;n++){const [r]=await db.execute('INSERT INTO web_user_accounts (username,email,password_hash,email_verified) VALUES (?,?,?,1)',['annual_beta_'+randomUUID(),'beta-'+randomUUID()+'@example.invalid','synthetic-not-a-login']);ids.push(r.insertId);await db.execute('INSERT INTO web_beta_participants (id,user_id) VALUES (?,?)',[randomUUID(),r.insertId]);}
  const create=async()=>{const i=await createBetaInvite(db,'wave1',new Date(Date.now()+60000));invites.push(i.id);return i;};
  const i=await create();assert.match(i.code,/^[A-HJ-NP-Z2-9]{8}$/);const a=await validateBetaInvite(db,i.code,'test-session-a');const b=await validateBetaInvite(db,i.code,'test-session-b');
  const [before]=await db.execute('SELECT used_count,code_hash FROM web_beta_invites WHERE id=?',[i.id]);assert.equal(before[0].used_count,0);assert.notEqual(before[0].code_hash,i.code);assert.equal(before[0].code_hash,hashBetaToken(i.code.replaceAll('-','')));
  await assert.rejects(redeemBetaInvite(db,a.token,'wrong-session',ids[0]),e=>e.code==='pending_expired');
  const race=await Promise.allSettled([redeemBetaInvite(db,a.token,'test-session-a',ids[0]),redeemBetaInvite(db,b.token,'test-session-b',ids[1])]);assert.equal(race.filter(x=>x.status==='fulfilled').length,1);assert.equal(race.filter(x=>x.status==='rejected'&&x.reason.code==='used_invite').length,1);
  const winner=race[0].status==='fulfilled'?0:1;await redeemBetaInvite(db,winner===0?a.token:b.token,winner===0?'test-session-a':'test-session-b',ids[winner]);
  const [after]=await db.execute('SELECT used_count FROM web_beta_invites WHERE id=?',[i.id]);assert.equal(after[0].used_count,1);
  await assert.rejects(validateBetaInvite(db,i.code,'other'),e=>e.code==='used_invite');await assert.rejects(validateBetaInvite(db,'not-a-code','other'),e=>e.code==='invalid_invite');
  const legacy=await create();const legacyCode='0123456789ABCDEF'+randomUUID().replaceAll('-','').slice(0,16).toUpperCase();await db.execute('UPDATE web_beta_invites SET code_hash=? WHERE id=?',[hashBetaToken(legacyCode),legacy.id]);const legacyPending=await validateBetaInvite(db,legacyCode.toLowerCase(),'legacy-session');assert.equal(legacyPending.inviteId,legacy.id);
  const expired=await create();await db.execute('UPDATE web_beta_invites SET expires_at=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE id=?',[expired.id]);await assert.rejects(validateBetaInvite(db,expired.code,'other'),e=>e.code==='expired_invite');
  const disabled=await create();const pending=await validateBetaInvite(db,disabled.code,'auth-continuation');await db.execute('UPDATE web_beta_invites SET disabled_at=NOW() WHERE id=?',[disabled.id]);await assert.rejects(redeemBetaInvite(db,pending.token,'auth-continuation',ids[2]),e=>e.code==='disabled_invite');await assert.rejects(validateBetaInvite(db,disabled.code,'other'),e=>e.code==='disabled_invite');
  const valid=await create();const cont=await validateBetaInvite(db,valid.code,'after-auth');await redeemBetaInvite(db,cont.token,'after-auth',ids[2]);const [grants]=await db.execute('SELECT enabled,feature FROM web_annual_summary_access WHERE user_id=?',[ids[2]]);assert.equal(grants[0].enabled,1);assert.equal(grants[0].feature,'annual_first_run_beta');
 }finally{if(allowed){for(const id of invites){await db.execute('DELETE FROM web_beta_pending WHERE invite_id=?',[id]);await db.execute('DELETE FROM web_beta_invites WHERE id=?',[id]);}for(const id of ids){await db.execute('DELETE FROM web_annual_summary_access WHERE user_id=?',[id]);await db.execute('DELETE FROM web_beta_participants WHERE user_id=?',[id]);await db.execute('DELETE FROM web_user_accounts WHERE id=?',[id]);}}await db.end();}
});
