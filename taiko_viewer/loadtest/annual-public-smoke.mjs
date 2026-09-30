import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import mysql from 'mysql2/promise';
import sharp from 'sharp';
import {chromium} from 'playwright-core';
import {assertTestDatabaseMutationAllowed} from '../scripts/annual_test_db_guard.mjs';
export async function checkPublicMode(c,accounts){
 const root=JSON.parse(await readFile(c.isolationEvidence,'utf8')).root;
 assert.ok(root.startsWith('/var/tmp/annual-test-'));
 const env=Object.fromEntries((await readFile(`${root}/server.env`,'utf8')).split('\n').map(s=>[s.slice(0,s.indexOf('=')),s.slice(s.indexOf('=')+1)]));
 const db=await mysql.createConnection({host:env.TAIKO_DB_HOST,port:Number(env.TAIKO_DB_PORT),user:env.TAIKO_DB_USER,password:env.TAIKO_DB_PASSWORD,database:env.TAIKO_DB_NAME});
 const by=Object.fromEntries(accounts.map(a=>[a.kind,a]));const owner=by.normal,old=by.sparse,insufficient=by.insufficient,unbound=by.parallel1,expired=by.parallel2;const checks=[];
 const policy=(mode,g=false,r=false)=>execFileSync('/usr/bin/python3',['scripts/annual-policy.py','--file',`${root}/annual-policy.json`,'--mode',mode,'--pause-generation',g?'yes':'no','--pause-rendering',r?'yes':'no']);
 async function req(a,path,method='GET',body,expected=200){const response=await fetch(c.base+path,{method,headers:{...(a?{cookie:`stv_session=${a.cookie}`}:{ }),'content-type':'application/json',origin:c.base},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(90000)});const accepted=[].concat(expected).includes(response.status);assert.ok(accepted,`${method} ${path}: ${response.status}`);checks.push({method,path,status:response.status});return response;}
 const json=async(...args)=>(await req(...args)).json();
 const count=async(table,userId)=>Number((await db.execute(`SELECT COUNT(*) n FROM ${table} WHERE user_id=?`,[userId]))[0][0].n);
 async function build(a){let p=await json(a,'/api/account/annual-summaries/annual_2026/build','POST',{locale:'zh'},[200,202]);for(let i=0;i<180&&['queued','running'].includes(p.job.status);i++){await new Promise(r=>setTimeout(r,1000));p=await json(a,`/api/account/annual-summary-jobs/${p.job.id}`);}return p.job;}
 try{
  await assertTestDatabaseMutationAllowed(db);
  assert.equal(await count('web_annual_summary_jobs',owner.userId),0,'Use fresh fixtures');
  for(const a of [owner,insufficient,unbound,expired])await db.execute('DELETE FROM web_annual_summary_access WHERE user_id=?',[a.userId]);
  await db.execute('DELETE FROM web_taiko_bindings WHERE user_id=?',[unbound.userId]);
  await db.execute('UPDATE web_user_sessions SET expires_at=DATE_SUB(NOW(),INTERVAL 1 MINUTE) WHERE user_id=?',[expired.userId]);
  policy('invite');await req(owner,'/api/account/annual-summaries/annual_2026','GET',null,403);await req(old,'/api/account/annual-summaries/annual_2026');
  policy('public');assert.equal((await json(null,'/api/annual-beta/status')).mode,'public');
  await req(null,'/api/account/annual-summaries/annual_2026','GET',null,401);await req(expired,'/api/account/annual-summaries/annual_2026','GET',null,401);await req(unbound,'/api/account/annual-summaries/annual_2026','GET',null,400);
  assert.equal((await json(owner,'/api/account/auth/me')).user.annualSummaryAccess,true);
  await req(owner,'/api/admin/annual-summaries/state','GET',null,[401,403]);
  policy('public',true,true);const paused=await req(owner,'/api/account/annual-summaries/annual_2026/build','POST',{},503);assert.equal(paused.headers.get('retry-after'),'60');assert.equal(await count('web_annual_summary_jobs',owner.userId),0);
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  try{
   const ctx=await browser.newContext({viewport:{width:375,height:567},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'});
   await ctx.addCookies([{name:'stv_session',value:owner.cookie,url:c.base}]);await ctx.route('**/*',r=>new URL(r.request().url()).origin===c.base?r.continue():r.abort());
   const page=await ctx.newPage();let submissions=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/annual_2026/build'))submissions++;});
   await page.goto(c.base+'/account/version-summary',{waitUntil:'domcontentloaded'});await page.getByText('年度报告新生成已暂停，请稍后重试',{exact:true}).first().waitFor({timeout:20000}).catch(async e=>{await page.screenshot({path:`${c.output}/paused-failure.png`});await writeFile(`${c.output}/paused-failure.json`,JSON.stringify({url:page.url(),text:(await page.locator('body').innerText()).slice(0,4000),submissions}));throw e;});await page.waitForTimeout(3500);
   assert.ok(submissions<=1,'No automatic or immediate build retry');assert.equal(await page.getByRole('button',{name:'重试',exact:true}).isDisabled(),true);await page.screenshot({path:`${c.output}/public-paused.png`});checks.push({case:'paused-browser-no-loop',submissions,retryDisabled:true});
  }finally{await browser.close();}
  policy('public',false,true);const job=await build(owner);assert.equal(job.status,'completed');
  const envelope=await json(owner,'/api/account/annual-summaries/annual_2026');const s=envelope.summary;assert.equal(s.profileCard.nickname,owner.nickname);assert.equal(s.overview.data.playCount,owner.playCount);assert.equal(s.provenance.algorithmVersion,'annual-observation-v4.5.3');assert.equal(s.version.endDate,'2026-09-30');
  const route=`/api/account/annual-summaries/${s.summaryId}/share-card`;
  await req(owner,route,'POST',{locale:'zh',syncCommunity:false},503);
  policy('public');const card=await json(owner,route,'POST',{locale:'zh',syncCommunity:false});assert.equal(card.cached,false);
  const png=Buffer.from(await (await req(owner,card.shareCard.imageUrl)).arrayBuffer());const info=await sharp(png).metadata();await sharp(png).stats();assert.equal(info.width,1080);assert.equal(info.height,1872);await writeFile(`${c.output}/public-uncached.png`,png);
  await req(old,`/api/account/annual-summaries/${s.summaryId}`,'GET',null,404);await req(old,`/api/account/annual-summary-jobs/${job.id}`,'GET',null,404);await req(old,card.shareCard.imageUrl,'GET',null,404);
  policy('public',true,true);await req(owner,`/api/account/annual-summaries/${s.summaryId}`);await req(owner,card.shareCard.imageUrl);assert.equal((await json(owner,route,'POST',{locale:'zh',syncCommunity:false})).cached,true);assert.ok((await json(owner,'/api/account/annual-summaries/annual_2026/build','POST',{})).summary);
  policy('invite');await req(owner,`/api/account/annual-summaries/${s.summaryId}`,'GET',null,403);await req(old,'/api/account/annual-summaries/annual_2026');policy('public');
  const unavailable=await build(insufficient);assert.equal(unavailable.status,'failed');assert.equal(unavailable.error.code,'INSUFFICIENT_DATA');
  for(let i=0;i<3;i++)assert.equal((await json(insufficient,'/api/account/annual-summaries/annual_2026')).buildJob.id,unavailable.id);
  assert.equal(await count('web_beta_participants',owner.userId),0);assert.equal(await count('web_annual_summary_access',owner.userId),0);assert.equal(await count('web_beta_events',owner.userId),0);
  await writeFile(`${c.output}/public-smoke.json`,JSON.stringify({candidate:c.candidate,checks,publicUserHasNoGrantOrParticipant:true,png:{width:info.width,height:info.height},insufficientStable:true},null,2));
 }finally{await db.end();}
}
