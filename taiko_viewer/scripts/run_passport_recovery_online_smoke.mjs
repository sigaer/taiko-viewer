// Authorized post-release checks of the account named by the user. No score
// files, account/binding/Goal fixtures or synthetic production facts are made.
import assert from 'node:assert/strict';
import { readFile,mkdir,writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import mysql from 'mysql2/promise';
import { chromium } from 'playwright-core';
import { monitorPassportResources } from '../tests/fixtures/passportRecoveryResources.mjs';
import { auditGoalOrphans } from '../server/services/goals/audit.ts';
import { auditGrowthMeasurementOrphans } from '../server/services/growth-history/audit.ts';
assert.equal(process.env.TAIKO_ALLOW_PASSPORT_RECOVERY_ONLINE_SMOKE,'1');
const username=process.env.PASSPORT_SMOKE_USERNAME,taikoId=process.env.PASSPORT_SMOKE_TAIKO_ID;
assert.ok(username&&taikoId,'Explicitly authorized account identity required');
const base='https://viewer.sakura-bot.cn',out='/var/tmp/passport-recovery-0801';
const release=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;
const config={};for(const line of (await readFile('/etc/taiko-viewer.env','utf8')).split('\n')){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)config[m[1]]=m[2].replace(/^['"]|['"]$/g,'');}
const option=(key,fallback)=>config[`NUXT_${key}`]||config[`TAIKO_${key}`]||fallback;
const db=mysql.createPool({host:option('DB_HOST','127.0.0.1'),port:Number(option('DB_PORT',3306)),user:option('DB_USER'),password:option('DB_PASSWORD'),database:option('DB_NAME','taiko'),connectionLimit:1});
await mkdir(out,{recursive:true});const finishResources=await monitorPassportResources(`${out}/online-resources.json`);
const report={release,result:'FAIL',account:'user-authorized personal account',checks:{},performance:[],ownedSyntheticRows:0,ownedSyntheticFiles:0};
const exec=promisify(execFile);let userId,profileId,token,browser;
const stamp=date=>date.toISOString().replace('T',' ').replace('Z',' UTC');
const measure=async(label,action)=>{
 const seen=new Set();let busy=false;
 const sample=async()=>{if(busy)return;busy=true;try{const{stdout}=await exec('/bin/ps',['-C','python3','-o','pid=,args='],{timeout:2000,maxBuffer:65536}).catch(()=>({stdout:''}));for(const line of stdout.split('\n'))if(line.includes('-m growth_compute growth')&&line.includes(`--user ${taikoId} `))seen.add(line.trim().split(/\s+/)[0]);}finally{busy=false;}};
 await sample();const timer=setInterval(()=>sample().catch(()=>{}),50),since=new Date(),started=performance.now();
 try{return await action();}finally{
  const elapsedMs=Math.round(performance.now()-started);clearInterval(timer);await sample();const until=new Date();
  await new Promise(r=>setTimeout(r,200));
  const{stdout}=await exec('/usr/bin/journalctl',['-u','taiko-viewer','--since',stamp(since),'--until',stamp(until),'-o','cat','--no-pager'],{timeout:5000,maxBuffer:1024*1024});
  const blocks=(title,operation)=>[...stdout.matchAll(new RegExp('\\['+title+'\\] '+operation+' \\{\\n([\\s\\S]*?)^\\}','gm'))].map(m=>m[1]);
  const owns=b=>new RegExp('userId: '+userId+'(?:,|\\s)').test(b);
  const compute=blocks('player-growth','overview timing').filter(owns),replay=blocks('growth-history','replay').filter(owns),compose=blocks('growth-passport','compose').filter(owns);
  const row={label,elapsedMs,observedPythonProcesses:seen.size,growthComputeCalls:compute.length,historyReplays:replay.length};
  for(const key of ['overviewDurationMs','recentHistoryMs','measurementQueryMs','dailySamplingMs','segmentBuildMs','milestoneComposeMs','totalDurationMs','responseBytes'])if(compose.length===1)row[key]=Number(compose[0].match(new RegExp(key+': (\\d+)'))?.[1]||0);
  report.performance.push(row);
  if(label==='four local range switches'){assert.equal(compute.length,0);assert.equal(replay.length,0);assert.equal(seen.size,0);}
  else{assert.equal(compute.length,1);assert.equal(replay.length,1);assert.ok(seen.size<=1);}
 }
};
try{
 const[[identity]]=await db.query('SELECT DATABASE() AS name');assert.equal(identity.name,'taiko');
 const version=await(await fetch(`${base}/more`,{signal:AbortSignal.timeout(20000)})).text();assert.ok(version.includes(`v${release}`));
 const[accounts]=await db.execute('SELECT a.id,b.id AS binding_id,b.taiko_id FROM web_user_accounts a JOIN web_taiko_bindings b ON b.user_id=a.id AND b.is_current=1 WHERE a.username=?',[username]);
 assert.equal(accounts.length,1);assert.equal(String(accounts[0].taiko_id),taikoId);userId=Number(accounts[0].id);profileId=String(accounts[0].binding_id);
 const[sessions]=await db.execute('SELECT session_token FROM web_user_sessions WHERE user_id=? AND expires_at>NOW() ORDER BY last_seen_at DESC LIMIT 1',[userId]);
 assert.ok(sessions.length,'Authorized account needs an existing active session');token=String(sessions[0].session_token);
 const request=async(path,authenticated=true)=>{
  const response=await fetch(base+path,{headers:authenticated?{Cookie:`stv_session=${token}`}:{},signal:AbortSignal.timeout(90000)});
  assert.match(response.headers.get('cache-control')||'',/private, no-store/);return{response,text:await response.text()};
 };
 const noauth=await request('/api/account/growth/passport',false);assert.equal(noauth.response.status,401);
 for(const path of ['/api/account/growth/passport?range=31','/api/account/growth/passport?profileId=1','/api/account/growth/history?days=365']){
  const result=await request(path);assert.equal(result.response.status,400);
 }
 await measure('authenticated Passport GET',async()=>{
  const result=await request('/api/account/growth/passport?range=90');assert.equal(result.response.status,200);assert.match(result.response.headers.get('vary')||'',/cookie/i);
  const payload=JSON.parse(result.text);assert.equal(payload.profileId,profileId);assert.ok(payload.shared);
  report.apiPayloadBytes=Buffer.byteLength(result.text);report.measurementDays=payload.coverage.measurementDays;
  report.availableViews=Object.keys(payload.shared.views);report.selectedMilestoneCount=payload.milestones.length;report.initialMilestoneCount=payload.initialMilestoneIds.length;report.coverage=payload.coverage.recentFactsState;
  for(const days of [30,90,180,365]){const view=payload.shared.views[days];assert.equal(view.range.requestedDays,days);assert.equal(view.range.factDays,days===30?30:90);}
 });
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 try{
  await context.addCookies([{name:'stv_session',value:token,url:base,httpOnly:true,secure:true,sameSite:'Lax'}]);
  const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[],hydration=[],requests=[];
  page.on('pageerror',error=>errors.push(error.message.slice(0,180)));page.on('console',message=>{if(/hydration/i.test(message.text()))hydration.push(message.text().slice(0,180));});
  page.on('request',request=>{if(request.url().includes('/api/account/'))requests.push(new URL(request.url()).pathname);});
  await measure('SSR Passport initial page',async()=>{const start=performance.now();await page.goto(`${base}/my/growth`,{waitUntil:'networkidle',timeout:90000});await page.locator('.passport-hero').waitFor();report.pageInitialVisibleMs=Math.round(performance.now()-start);});
  const root=page.locator('.passport-page');assert.equal(await root.locator('.passport-range button').count(),4);
  const current=await root.locator('.passport-rating').innerText();const next=await root.locator('.passport-next').count()?await root.locator('.passport-next').innerText():'';
  const before=requests.length;report.switches=[];
  await measure('four local range switches',async()=>{
   for(const days of [30,180,365,90]){const start=performance.now();await root.locator(`[data-range="${days}"]`).click();await page.waitForFunction(days=>document.querySelector(`[data-range="${days}"]`)?.getAttribute('aria-pressed')==='true',days);
    report.switches.push({days,visibleMs:Math.round(performance.now()-start)});assert.equal(await root.locator('.passport-rating').innerText(),current);
    if(next)assert.equal(await root.locator('.passport-next').innerText(),next);if(days>90)assert.match(await root.locator('.passport-milestones').innerText(),/仅整理到最近 90 天/);
   }
  });
  report.rangeSwitchAccountRequests=requests.length-before;assert.equal(report.rangeSwitchAccountRequests,0);
  if(await root.locator('.passport-more').count()){await root.locator('.passport-more').click();assert.equal(await root.locator('.passport-more').getAttribute('aria-expanded'),'true');}
  if(await root.locator('.passport-chart circle[role="button"]').count()){const point=root.locator('.passport-chart circle[role="button"]').last();await point.focus();await point.press('Enter');assert.match(await root.locator('.passport-chart-detail').innerText(),/Rating/);assert.doesNotMatch(await root.locator('.passport-chart-detail').innerText(),/精度|高速|节奏/);}
  if(await root.locator('.passport-breaks summary').count()){const boundary=root.locator('.passport-breaks summary').first();await boundary.focus();await boundary.press('Enter');assert.equal(await boundary.locator('..').getAttribute('open'),'');}
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);assert.deepEqual(hydration,[]);
  await root.screenshot({path:`${out}/online-personal-passport.png`});
  report.checks={authenticated:true,rangeControls:true,routeAndLocalSwitch:true,currentPreserved:true,metricTooltip:true,hydration:true,mobileOverflow:true};
 }finally{await context.close();}
 report.goalOrphans=await auditGoalOrphans(db);report.measurementOrphans=await auditGrowthMeasurementOrphans(db);
 assert.deepEqual(report.goalOrphans,{userOrphans:0,bindingOrphans:0,ownerMismatches:0});assert.deepEqual(report.measurementOrphans,{userOrphans:0,bindingOrphans:0,ownerMismatches:0});
 report.result='PASS';
}finally{
 try{if(browser)await browser.close();}finally{await db.end();await finishResources();await writeFile(`${out}/online-smoke.json`,JSON.stringify(report,null,2));}
}
console.log(JSON.stringify(report));
