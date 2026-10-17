import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,chmod,rename,rm} from 'node:fs/promises';import {join} from 'node:path';
import {readServerAllowlist} from '../server/infrastructure/server-allowlist.ts';
import {captureMyTaikoAdmission} from '../server/services/my-taiko/admission.ts';
test('rollout fails closed and never turns process read-model mode into account admission',async()=>{
 const dir=await mkdtemp(join(process.env.QA_RUN_TMPDIR,'rollout-')),path=join(dir,'policy.json');
 const config={myTaikoReadModelMode:'allowlist',myTaikoReadModelAllowlistPath:path};
 async function policy(value){await writeFile(path+'.next',JSON.stringify(value),{mode:0o600});await rename(path+'.next',path);}
 try{
  assert.equal(await captureMyTaikoAdmission(1,config),null);
  await policy({schemaVersion:1,userIds:['1']});const admitted=await captureMyTaikoAdmission(1,config);assert.ok(admitted);
  assert.equal(await captureMyTaikoAdmission(2,config),null);assert.equal(await captureMyTaikoAdmission(1,{...config,myTaikoReadModelMode:'read-model'}),null);
  await policy({schemaVersion:1,userIds:[]});assert.equal(await captureMyTaikoAdmission(1,config),null);
  for(const bad of [{schemaVersion:1,userIds:[1]},{schemaVersion:1,userIds:['1','1']},{schemaVersion:1,userIds:['1'],owner:1}]){await policy(bad);assert.equal(await captureMyTaikoAdmission(1,config),null);}
  await policy({schemaVersion:1,userIds:['1']});await chmod(path,0o666);assert.equal(await captureMyTaikoAdmission(1,config),null);
  await policy({schemaVersion:1,clientIds:['clt_'+'a'.repeat(32)]});const clients=await readServerAllowlist(path,'clientIds',/^clt_[a-f0-9]{32}$/);assert.ok(clients.ids.has('clt_'+'a'.repeat(32)));assert.notEqual(clients.revision,admitted.revision);
 }finally{await rm(dir,{recursive:true});}
});
