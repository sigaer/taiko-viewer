import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,mkdir,rename,unlink} from 'node:fs/promises';
import mysql from 'mysql2/promise';
import sharp from 'sharp';
import {assertTestDatabaseMutationAllowed} from '../scripts/annual_test_db_guard.mjs';

export async function checkRefreshFlow(c,accounts) {
 const root=JSON.parse(await readFile(c.isolationEvidence,'utf8')).root;
 assert.ok(root.startsWith('/var/tmp/annual-test-'));assert.equal(c.base,'http://127.0.0.1:33180');
 const env=Object.fromEntries((await readFile(root+'/server.env','utf8')).split('\n').map(s=>[s.slice(0,s.indexOf('=')),s.slice(s.indexOf('=')+1)]));
 const db=await mysql.createConnection({host:env.TAIKO_DB_HOST,port:Number(env.TAIKO_DB_PORT),user:env.TAIKO_DB_USER,password:env.TAIKO_DB_PASSWORD,database:env.TAIKO_DB_NAME});
 const a=accounts.find(a=>a.kind==='normal'), fresh=accounts.find(a=>a.kind==='insufficient');
 assert.ok(a.synthetic&&fresh.synthetic);
 const policy=async(refreshImports,archiveFallback,pauseGeneration=false)=>writeFile(root+'/annual-policy.json',JSON.stringify({mode:'public',refreshImports,archiveFallback,pauseGeneration,pauseRendering:false}));
 const call=async(owner,path,body,status=200)=>{
  const r=await fetch(c.base+path,{method:body?'POST':'GET',headers:{cookie:`stv_session=${owner.cookie}`,origin:c.base,'content-type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(90000)});
  assert.equal(r.status,status,`${path}: ${r.status}`);return r.json();
 };
 const get=owner=>call(owner,'/api/account/annual-summaries/annual_2026');
 const submit=owner=>call(owner,'/api/account/annual-summaries/annual_2026/build',{locale:'zh'},202);
 const finish=async(owner,job,status='completed')=>{
  for(let i=0;i<180&&['queued','running'].includes(job.status);i++) {await new Promise(r=>setTimeout(r,1000));({job}=await call(owner,'/api/account/annual-summary-jobs/'+job.id));}
  assert.equal(job.status,status,JSON.stringify(job.error));return job;
 };
 const share=async(owner,s,name)=>{
  const card=await call(owner,`/api/account/annual-summaries/${s.summaryId}/share-card`,{locale:'zh',syncCommunity:false});
  const r=await fetch(c.base+card.shareCard.imageUrl,{headers:{cookie:`stv_session=${owner.cookie}`}});assert.equal(r.status,200);
  const png=Buffer.from(await r.arrayBuffer());const info=await sharp(png).metadata();await sharp(png).stats();assert.equal(info.width,1080);assert.equal(info.height,1872);await writeFile(c.output+'/'+name+'.png',png);return card.shareCard.imageUrl;
 };
 try {
  await assertTestDatabaseMutationAllowed(db);
  await policy(false,false);
  await finish(a,(await submit(a)).job);const old=(await get(a)).summary;assert.ok(old);
  const oldImage=await share(a,old,'refresh-before');
  const dir=root+'/userdata/'+a.taikoId;
  const names=(await readdir(dir)).filter(n=>n.endsWith('.json')).sort();
  const payload=JSON.parse(await readFile(dir+'/'+names.at(-1),'utf8'));
  payload._meta={full:true,source:'wahlap',observed_at:'2026-09-29T12:00:00',imported_via:'kinoko-history'};
  for(const song of payload.songs) {song.stage_cnt+=3;song.update_datetime='2026-09-29 12:00:00';}
  await writeFile(dir+'/data_20260929_kinoko-history_abcdef.json',JSON.stringify(payload));
  assert.equal((await get(a)).refreshAvailable,false);
  await policy(true,false,true);
  let e=await get(a);assert.equal(e.summary.summaryId,old.summaryId);assert.equal(e.refreshAvailable,true);
  await call(a,'/api/account/annual-summaries/annual_2026/build',{locale:'zh'},503);
  assert.equal((await get(a)).summary.summaryId,old.summaryId);
  await policy(true,false);
  const job=(await submit(a)).job;
  await call(a,'/api/account/annual-summaries/'+old.summaryId);
  await finish(a,job);const updated=(await get(a)).summary;assert.notEqual(updated.summaryId,old.summaryId);
  assert.ok(updated.overview.data.playCount>old.overview.data.playCount);assert.equal((await get(a)).refreshAvailable,false);
  assert.equal((await fetch(c.base+oldImage,{headers:{cookie:`stv_session=${a.cookie}`}})).status,200);
  await share(a,updated,'refresh-after');
  // Worker failure must leave the existing report and PNG readable. Only synthetic history is moved.
  const backup=root+'/history-backup';await mkdir(backup);
  const originalNames=await readdir(dir);
  try {
   for(const name of originalNames)await rename(dir+'/'+name,backup+'/'+name);
   const failedPayload={...payload,_meta:{full:true,source:'kinoko-import',observed_at:'2026-10-01T12:00:00'}};
   await writeFile(dir+'/data_20261001_kinoko-import.json',JSON.stringify(failedPayload));
   const failed=await finish(a,(await submit(a)).job,'failed');assert.equal(failed.error.code,'INSUFFICIENT_DATA');
   assert.equal((await get(a)).summary.summaryId,updated.summaryId);
   assert.equal((await fetch(c.base+oldImage,{headers:{cookie:`stv_session=${a.cookie}`}})).status,200);
  } finally {
   await unlink(dir+'/data_20261001_kinoko-import.json');
   for(const name of originalNames)await rename(backup+'/'+name,dir+'/'+name);
  }
  // A true first sync after cutoff: no earlier local history, no source writes to production.
  const current={...payload,_meta:{full:true,source:'wahlap',observed_at:'2026-10-01T12:00:00'}};
  await writeFile(root+'/userdata/'+fresh.taikoId+'data.json',JSON.stringify(current));
  await writeFile(root+'/userdata/'+fresh.taikoId+'/data_20261001.json',JSON.stringify(current));
  const denied=await finish(fresh,(await submit(fresh)).job,'failed');assert.equal(denied.error.code,'INSUFFICIENT_DATA');
  await policy(true,true);
  assert.equal((await get(fresh)).buildJob,null,'Enabling fallback must release cached insufficient-data failures');
  await finish(fresh,(await submit(fresh)).job);const fallback=(await get(fresh)).summary;
  assert.equal(fallback.mode,'current_archive');assert.equal(fallback.version.endDate,'2026-09-30');assert.ok(fallback.provenance.warnings.some(w=>w.startsWith('current_archive_fallback:')));
  for(const key of ['highScore','challenge','milestones','weekdayActivity','monthlyFavorites']) assert.equal(fallback.sections[key].status,'unavailable');
  await share(fresh,fallback,'fallback-share');
  await policy(false,false);assert.equal((await get(fresh)).summary.summaryId,fallback.summaryId);assert.equal((await get(a)).summary.summaryId,updated.summaryId);
  await policy(true,true);
  await writeFile(c.output+'/refresh-smoke.json',JSON.stringify({candidate:c.candidate,oldId:old.summaryId,newId:updated.summaryId,playsBefore:old.overview.data.playCount,playsAfter:updated.overview.data.playCount,oldImagePreserved:true,workerFailurePreservesReport:true,featureRollbackPreservesReports:true,fallbackId:fallback.summaryId,png:{width:1080,height:1872}},null,2));
 } finally {await db.end();}
}
