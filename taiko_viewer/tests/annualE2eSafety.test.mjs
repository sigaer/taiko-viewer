import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, symlink, rm } from 'node:fs/promises';
import { assertAnnualE2eEnvironment } from '../scripts/annual_e2e_safety.mjs';
import { assertTestDatabaseMutationAllowed } from '../scripts/annual_test_db_guard.mjs';
test('E2E rejects default and production configurations before startup',async()=>{
 await assert.rejects(()=>assertAnnualE2eEnvironment({}),/opt-in/);
 await assert.rejects(()=>assertAnnualE2eEnvironment({TAIKO_ALLOW_TEST_DB_MUTATION:'1',TAIKO_DB_NAME:'taiko'}),/test database/);
});
test('E2E rejects external servers and symlink escapes',async()=>{
 const root=await mkdtemp('/var/tmp/annual-test-guard-');
 try{
   for(const name of ['userdata','cache','admission'])await mkdir(`${root}/${name}`);
   const env={TAIKO_ALLOW_TEST_DB_MUTATION:'1',TAIKO_DB_NAME:'fixture_test',ANNUAL_E2E_ISOLATED_ROOT:root,TAIKO_USERDATA_DIR:`${root}/userdata`,TAIKO_ANNUAL_CACHE_DIR:`${root}/cache`,TAIKO_ANNUAL_ADMISSION_DIR:`${root}/admission`,ANNUAL_E2E_SYNTHETIC_DATA:'1',ANNUAL_E2E_EGRESS_BLOCKED:'1'};
   await assertAnnualE2eEnvironment(env);
   await assert.rejects(()=>assertAnnualE2eEnvironment({...env,ANNUAL_E2E_BASE_URL:'http://127.0.0.1:3100'}),/own its server/);
   await symlink('/var/tmp',`${root}/escape`);
   await assert.rejects(()=>assertAnnualE2eEnvironment({...env,TAIKO_ANNUAL_CACHE_DIR:`${root}/escape`}),/isolated root/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('actual production DB identity fails even when environment claims test',async()=>{
 const prior=process.env.TAIKO_ALLOW_TEST_DB_MUTATION;process.env.TAIKO_ALLOW_TEST_DB_MUTATION='1';
 try{await assert.rejects(()=>assertTestDatabaseMutationAllowed({query:async()=>[[{databaseName:'taiko',currentUser:'test@localhost'}]]}),/Refusing/);}
 finally{if(prior===undefined)delete process.env.TAIKO_ALLOW_TEST_DB_MUTATION;else process.env.TAIKO_ALLOW_TEST_DB_MUTATION=prior;}
});
