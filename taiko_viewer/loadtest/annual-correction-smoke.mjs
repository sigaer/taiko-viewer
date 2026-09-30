import assert from 'node:assert/strict';
import {readFile,writeFile,realpath} from 'node:fs/promises';
import mysql from 'mysql2/promise';
import sharp from 'sharp';
import {assertTestDatabaseMutationAllowed} from '../scripts/annual_test_db_guard.mjs';
export async function checkCorrectionFlow(c,accounts){
 const root=JSON.parse(await readFile(c.isolationEvidence,'utf8')).root;
 assert.ok(root.startsWith('/var/tmp/annual-test-'));assert.equal(c.base,'http://127.0.0.1:33180');
 const a=accounts.find(a=>a.kind==='normal');assert.equal(a.synthetic,true);
 const env=Object.fromEntries((await readFile(root+'/server.env','utf8')).split('\n').map(s=>[s.slice(0,s.indexOf('=')),s.slice(s.indexOf('=')+1)]));
 const db=await mysql.createConnection({host:env.TAIKO_DB_HOST,port:Number(env.TAIKO_DB_PORT),user:env.TAIKO_DB_USER,password:env.TAIKO_DB_PASSWORD,database:env.TAIKO_DB_NAME});
 const call=async(path,body)=>{const r=await fetch(c.base+path,{method:body?'POST':'GET',headers:{cookie:`stv_session=${a.cookie}`,origin:c.base,'content-type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(90000)});assert.ok(r.ok,`${path}: ${r.status}`);return r.json()};
 const read=()=>call('/api/account/annual-summaries/annual_2026');
 const build=async()=>{let {job}=await call('/api/account/annual-summaries/annual_2026/build',{locale:'zh'});for(let i=0;i<180&&['queued','running'].includes(job.status);i++){await new Promise(r=>setTimeout(r,1000));({job}=await call('/api/account/annual-summary-jobs/'+job.id));}assert.equal(job.status,'completed',JSON.stringify(job.error));const e=await read();assert.ok(e.summary);return e.summary;};
 try{
  await assertTestDatabaseMutationAllowed(db);
  const initial=(await read()).summary;assert.ok(initial);const target=initial.sections.highScore.data;assert.ok(target);
  const [[row]]=await db.execute('SELECT summary_path FROM web_annual_summaries WHERE id=? AND user_id=?',[initial.summaryId,a.userId]);
  const path=await realpath(row.summary_path);assert.ok(path.startsWith(root+'/'));
  const legacy=JSON.parse(await readFile(path,'utf8'));legacy.provenance.algorithmVersion='annual-observation-v4.5.2';await writeFile(path,JSON.stringify(legacy));
  assert.equal((await read()).summary.summaryId,initial.summaryId,'Untouched legacy report must remain readable');
  await call('/api/account/songs/lock',{songNo:target.songNo,level:target.level,locked:true});
  assert.equal((await read()).summary.summaryId,initial.summaryId,'Lock alone must not invalidate history');
  await call('/api/account/songs/update',{songNo:target.songNo,level:target.level,values:{high_score:0,stage_cnt:0,clear_cnt:0,full_combo_cnt:0,dondaful_combo_cnt:0,best_score_rank:0,good_cnt:0,ok_cnt:0,ng_cnt:0}});
  assert.equal((await read()).summary,null,'Manual edit must invalidate legacy summary');
  const corrected=await build();assert.notEqual(corrected.summaryId,initial.summaryId);assert.equal(corrected.provenance.algorithmVersion,'annual-observation-v4.5.3');assert.notEqual(corrected.sections.highScore.data?.songNo,target.songNo);assert.equal(corrected.overview.data.playCount,initial.overview.data.playCount-11);
  assert.equal(corrected.version.endDate,'2026-09-30');
  const card=await call(`/api/account/annual-summaries/${corrected.summaryId}/share-card`,{locale:'zh',syncCommunity:false});
  const response=await fetch(c.base+card.shareCard.imageUrl,{headers:{cookie:`stv_session=${a.cookie}`},signal:AbortSignal.timeout(30000)});assert.equal(response.status,200);const png=Buffer.from(await response.arrayBuffer());const info=await sharp(png).metadata();await sharp(png).stats();assert.equal(info.width,1080);assert.equal(info.height,1872);await writeFile(c.output+'/corrected-share.png',png);
  await new Promise(r=>setTimeout(r,1100));
  await call('/api/account/songs/update',{songNo:target.songNo,level:target.level,values:{pound_cnt:1}});
  assert.equal((await read()).summary,null,'A later edit must invalidate a corrected report too');
  const refreshed=await build();assert.notEqual(refreshed.summaryId,corrected.summaryId);
  await writeFile(c.output+'/correction-smoke.json',JSON.stringify({candidate:c.candidate,legacyReused:true,lockDoesNotInvalidate:true,firstEditInvalidates:true,secondEditInvalidates:true,playsBefore:initial.overview.data.playCount,playsAfter:corrected.overview.data.playCount,highScoreBefore:target,highScoreAfter:corrected.sections.highScore.data,png:{width:info.width,height:info.height}},null,2));
 }finally{await db.end();}
}
