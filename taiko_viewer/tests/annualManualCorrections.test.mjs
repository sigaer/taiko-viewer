import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {annualManualEditTime,annualCorrectionsAreCurrent} from '../server/services/account/annual-summary/manual-corrections.ts';
import {canReuseAnnualSummary,canReadAnnualSummary} from '../server/services/account/annual-summary/build-recovery.ts';
test('legacy unaffected reports stay readable; edited reports and subsequent edits invalidate',async()=>{
 const root=await mkdtemp('/var/tmp/annual-correction-cache-');
 try{
  await mkdir(root+'/123');await writeFile(root+'/123/data_20261001_010101.json','{}');
  assert.equal(await annualManualEditTime(root,'123'),0);
  assert.equal(annualCorrectionsAreCurrent('annual-observation-v4.5.2','2026-09-01',0),true);
  assert.equal(canReuseAnnualSummary({provenance:{algorithmVersion:'annual-observation-v4.5.2'}},'annual-observation-v4.5.3'),true);
  for(const suffix of ['web-account','manual-score','web-score-import','manual-score-delete']){
   await writeFile(root+`/123/data_2026-10-01_00_00_00_${suffix}.json`,'{}');const edit=await annualManualEditTime(root,'123');assert.ok(edit>0);
   assert.equal(annualCorrectionsAreCurrent('annual-observation-v4.5.2',new Date(edit+10000).toISOString(),edit),false);
   assert.equal(annualCorrectionsAreCurrent('annual-observation-v4.5.3',new Date(edit+10000).toISOString(),edit),true);
   assert.equal(annualCorrectionsAreCurrent('annual-observation-v4.5.3','2026-09-01',edit),false);
  }
 }finally{await rm(root,{recursive:true,force:true});}
});

test('fact revision keeps historical reports readable without reusing them as a new build',()=>{
 const current='annual-observation-v4.5.4';
 for(const version of ['annual-observation-v4.5.2','annual-observation-v4.5.3']){
  const report={provenance:{algorithmVersion:version},summaryId:'published-original'};
  const original=JSON.stringify(report);
  assert.equal(canReadAnnualSummary(report,current),true);
  assert.equal(canReuseAnnualSummary(report,current),false);
  assert.equal(JSON.stringify(report),original);
 }
 assert.equal(canReuseAnnualSummary({provenance:{algorithmVersion:current}},current),true);
 assert.equal(annualCorrectionsAreCurrent(current,'2026-10-16T00:00:00Z',0),true);
 assert.equal(canReadAnnualSummary({provenance:{algorithmVersion:'unknown'}},current),false);
});
