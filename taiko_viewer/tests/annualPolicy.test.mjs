import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,symlink,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import {resolve} from 'node:path';
test('operator policy switches live, fails closed, and separates generation/render pauses',async()=>{
 const root=await mkdtemp('/var/tmp/annual-policy-unit-');const previous=process.env.TAIKO_ANNUAL_POLICY_FILE;
 try{
  await symlink(resolve('node_modules'),root+'/node_modules');
  await build({entryPoints:['server/services/account/annual-summary/policy.ts'],outfile:root+'/policy.mjs',bundle:true,platform:'node',format:'esm',packages:'external',external:['h3']});
  const m=await import(root+'/policy.mjs');process.env.TAIKO_ANNUAL_POLICY_FILE=root+'/control.json';
  assert.deepEqual(await m.readAnnualPolicy(),{mode:'invite',pauseGeneration:false,pauseRendering:false});
  execFileSync('/usr/bin/python3',['scripts/annual-policy.py','--file',process.env.TAIKO_ANNUAL_POLICY_FILE,'--mode','public','--pause-generation','yes']);
  assert.equal((await m.readAnnualPolicy()).mode,'public');await assert.rejects(m.assertAnnualTaskAllowed('generation'),e=>e.statusCode===503&&e.data.code==='ANNUAL_GENERATION_PAUSED');await m.assertAnnualTaskAllowed('rendering');
  execFileSync('/usr/bin/python3',['scripts/annual-policy.py','--file',process.env.TAIKO_ANNUAL_POLICY_FILE,'--pause-generation','no','--pause-rendering','yes']);
  await m.assertAnnualTaskAllowed('generation');await assert.rejects(m.assertAnnualTaskAllowed('rendering'),e=>e.statusCode===503&&e.data.code==='ANNUAL_RENDERING_PAUSED');
  await writeFile(process.env.TAIKO_ANNUAL_POLICY_FILE,'{"mode":"public"}');await assert.rejects(m.readAnnualPolicy(),e=>e.statusCode===503);
 }finally{if(previous===undefined)delete process.env.TAIKO_ANNUAL_POLICY_FILE;else process.env.TAIKO_ANNUAL_POLICY_FILE=previous;await rm(root,{recursive:true,force:true});}
});
test('the frozen reporting period remains readable after cutoff and rejects unknown versions',async()=>{
 const root=await mkdtemp('/var/tmp/annual-window-unit-');
 try{
  await build({entryPoints:['server/services/account/annual-summary/constants.ts'],outfile:root+'/constants.mjs',bundle:true,platform:'node',format:'esm',alias:{'~':process.cwd()}});
  const m=await import(root+'/constants.mjs');const before=Date.now;
  try{Date.now=()=>Date.parse('2027-01-01T00:00:00Z');assert.equal(m.resolveAnnualVersion('annual_2026').endDate,'2026-09-30');assert.equal(m.getAnnualGeneratorVersion().endExclusive,'2026-10-01');assert.equal(m.getAnnualGeneratorVersion().timezone,'Asia/Shanghai');assert.equal(m.resolveAnnualVersion('annual_2027'),null);assert.equal(m.ANNUAL_ALGORITHM_VERSION,'annual-observation-v4.5.3');}finally{Date.now=before;}
 }finally{await rm(root,{recursive:true,force:true});}
});

test('annual async errors use the captured translator without calling setup composables',async()=>{
 const {transform}=await import('esbuild');const {readFile}=await import('node:fs/promises');
 const {code}=await transform(await readFile('utils/viewerError.ts','utf8'),{loader:'ts',format:'esm'});
 const {resolveViewerError}=await import('data:text/javascript,'+encodeURIComponent(code));
 const t=(key,fallback)=>fallback||key;
 await Promise.resolve();
 assert.equal(await resolveViewerError({statusCode:503,data:{statusMessage:'年度报告新生成已暂停，请稍后重试'}},'fallback',t),'年度报告新生成已暂停，请稍后重试');
 assert.equal(await resolveViewerError({statusCode:403},'fallback',t),'暂无权限查看该数据');
});
