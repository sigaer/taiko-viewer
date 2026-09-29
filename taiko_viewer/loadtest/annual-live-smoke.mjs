// Explicitly authorized, single-account production transactions; never a load test.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
assert.equal(process.env.ANNUAL_LIVE_SMOKE_AUTHORIZED,'1');
const c=JSON.parse(await readFile(process.argv[2],'utf8')),phase=process.argv[3];
assert.ok(['invite','public'].includes(phase));assert.equal(c.base,'https://viewer.sakura-bot.cn');
assert.equal((await stat(c.accountsFile)).mode&0o777,0o600);
const accounts=JSON.parse(await readFile(c.accountsFile,'utf8')),old=accounts.find(a=>a.kind==='invited'),fresh=accounts.find(a=>a.kind==='public');assert.ok(old&&fresh);
const records=[];const started=Date.now();
const policy=(mode,g=false,r=false)=>execFileSync('/usr/bin/python3',['scripts/annual-policy.py','--mode',mode,'--pause-generation',g?'yes':'no','--pause-rendering',r?'yes':'no']);
async function req(a,path,method='GET',body,expected=200){
 const begin=Date.now();const response=await fetch(c.base+path,{method,headers:{...(a?{cookie:`stv_session=${a.cookie}`}:{ }),'content-type':'application/json',origin:c.base},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(90000)});
 records.push({path,method,status:response.status,ms:Date.now()-begin});assert.ok([].concat(expected).includes(response.status),`HTTP ${response.status} ${method} ${path}`);return response;
}
const json=async(...args)=>(await req(...args)).json();
async function build(a){let p=await json(a,'/api/account/annual-summaries/annual_2026');if(p.summary)return {summary:p.summary,cached:true};assert.equal(String(p.currentBinding?.taikoId),String(a.taikoId));
 let j=(await json(a,'/api/account/annual-summaries/annual_2026/build','POST',{locale:'zh'},[200,202])).job;
 for(let n=0;n<180&&['queued','running'].includes(j.status);n++){await new Promise(r=>setTimeout(r,1000));j=(await json(a,`/api/account/annual-summary-jobs/${j.id}`)).job;}
 assert.equal(j.status,'completed',j.error?.code||'Build did not complete');p=await json(a,'/api/account/annual-summaries/annual_2026');assert.ok(p.summary);return {summary:p.summary,cached:false};
}
try{
 const metadata=await json(null,'/_nuxt/builds/latest.json');assert.equal(metadata.id,c.candidate.buildId,'Wrong live build');
 await req(null,'/api/account/annual-summaries/annual_2026','GET',null,401);
 if(phase==='invite'){
  assert.equal(JSON.parse(await readFile('/var/lib/taiko/annual-policy.json','utf8')).mode,'invite');
  assert.equal((await json(fresh,'/api/account/auth/me')).user.annualSummaryAccess,false);
  await req(fresh,'/api/account/annual-summaries/annual_2026','GET',null,403);
  assert.equal((await json(old,'/api/account/auth/me')).user.annualSummaryAccess,true);
 }else{
  // Keep both creation gates closed during the switch, then test each recovery.
  policy('public',true,true);
  assert.equal((await json(fresh,'/api/account/auth/me')).user.annualSummaryAccess,true);
  assert.equal((await json(fresh,'/api/annual-beta/status')).mode,'public');
  assert.equal((await json(fresh,'/api/account/annual-summaries/annual_2026')).summary,null,'Public smoke identity must have no prior report');
  const paused=await req(fresh,'/api/account/annual-summaries/annual_2026/build','POST',{},503);assert.equal(paused.headers.get('retry-after'),'60');
  policy('public',false,true);
 }
 const a=phase==='invite'?old:fresh;const built=await build(a);const s=built.summary;
 assert.equal(s.schemaVersion,4);assert.equal(s.provenance.algorithmVersion,'annual-observation-v4.5.2');assert.equal(s.version.endDate,'2026-09-30');
 const path=`/api/account/annual-summaries/${s.summaryId}/share-card`;
 if(phase==='public'){await req(fresh,path,'POST',{locale:'zh',syncCommunity:false},503);policy('public');}
 const card=await json(a,path,'POST',{locale:'zh',syncCommunity:false});
 const data=Buffer.from(await (await req(a,card.shareCard.imageUrl)).arrayBuffer());const image=await sharp(data).metadata();await sharp(data).stats();assert.equal(image.width,1080);assert.equal(image.height,1872);await writeFile(`${c.output}/live-${phase}.png`,data,{mode:0o600});
 if(phase==='public'){
  await req(old,`/api/account/annual-summaries/${s.summaryId}`,'GET',null,404);await req(old,card.shareCard.imageUrl,'GET',null,404);
  policy('public',true,true);await req(fresh,`/api/account/annual-summaries/${s.summaryId}`);await req(fresh,card.shareCard.imageUrl);assert.equal((await json(fresh,path,'POST',{locale:'zh',syncCommunity:false})).cached,true);policy('public');
 }
 await writeFile(`${c.output}/live-${phase}.json`,JSON.stringify({candidate:c.candidate,phase,started,finished:Date.now(),buildCached:built.cached,shareCached:card.cached,image:{width:image.width,height:image.height},records},null,2),{mode:0o600});
 console.log(JSON.stringify({phase,ok:true,requests:records.length,buildCached:built.cached,shareCached:card.cached}));
}catch(error){if(phase==='public'){try{policy('invite',true,true);}catch{console.error('Could not restore operator policy; inspect immediately');}}await writeFile(`${c.output}/live-${phase}-failure.json`,JSON.stringify({phase,candidate:c.candidate,error:error.message,records},null,2),{mode:0o600});throw error;}
