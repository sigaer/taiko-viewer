import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,symlink,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {qaTempPrefix} from './fixtures/qaPaths.mjs';
import {annualTestIsolation} from '../server/services/account/annual-summary/test-isolation.ts';

test('Annual test worker admits only current QA run and retains all isolation guards',async()=>{
 const prior={...process.env},root=await mkdtemp(qaTempPrefix('annual-test-boundary-'));
 try {
  for(const leaf of ['userdata','cache','admission','tmp'])await mkdir(resolve(root,leaf));
  const valid={ANNUAL_E2E_ISOLATED_ROOT:root,TAIKO_ALLOW_TEST_DB_MUTATION:'1',TAIKO_DB_NAME:'synthetic_test',ANNUAL_E2E_SYNTHETIC_DATA:'1',TAIKO_USERDATA_DIR:resolve(root,'userdata'),TAIKO_ANNUAL_CACHE_DIR:resolve(root,'cache'),TAIKO_ANNUAL_ADMISSION_DIR:resolve(root,'admission')};Object.assign(process.env,valid);
  const value=annualTestIsolation();assert.ok(value.properties.includes('IPAddressDeny=any'));assert.ok(value.properties.includes('ProtectSystem=strict'));assert.ok(value.properties.includes(`BindsTo=taiko-${process.env.QA_RUN_ID}.service`));assert.equal(value.tmp,resolve(root,'tmp'));
  for(const patch of [{QA_RUN_ID:'qa-000000000000'},{QA_RUN_TMPDIR:root},{TAIKO_DB_NAME:'production'},{TAIKO_ALLOW_TEST_DB_MUTATION:'0'},{ANNUAL_E2E_SYNTHETIC_DATA:'0'},{TAIKO_USERDATA_DIR:process.env.QA_RUN_TMPDIR},{ANNUAL_E2E_ISOLATED_ROOT:'/var/tmp'},{ANNUAL_E2E_ISOLATED_ROOT:'/home/sigaer/taiko/qa-vault'}]){
   const before={...process.env};Object.assign(process.env,patch);assert.throws(()=>annualTestIsolation());Object.assign(process.env,before);
  }
  const link=resolve(root,'linked-userdata');await symlink(resolve(root,'userdata'),link);process.env.TAIKO_USERDATA_DIR=link;assert.throws(()=>annualTestIsolation(),/symlink/);process.env.TAIKO_USERDATA_DIR=valid.TAIKO_USERDATA_DIR;
  const rootLink=resolve(process.env.QA_RUN_TMPDIR,'annual-test-symlink');await symlink(root,rootLink);process.env.ANNUAL_E2E_ISOLATED_ROOT=rootLink;assert.throws(()=>annualTestIsolation(),/symlink/);await rm(rootLink);
 }finally{for(const key of Object.keys(process.env))if(!(key in prior))delete process.env[key];Object.assign(process.env,prior);await rm(root,{recursive:true,force:true});}
});
