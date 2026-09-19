// Browser-only fixture: real built Vue UI, production service validation, synthetic persistence.
// Does not substitute for the SQL/API/production gates.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdir,open,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {chromium} from 'playwright-core';
import {monitorAcceptanceResources} from '../tests/fixtures/goalAcceptanceResources.mjs';
import {goalServiceHarness} from '../tests/fixtures/goalServiceHarness.mjs';
const out='/var/tmp/goal-evaluation';const base='http://127.0.0.1:3197';
await mkdir(out,{recursive:true});
const finishResources=await monitorAcceptanceResources(`${out}/browser-resources.json`);
const log=await open(`${out}/server.log`,'w');let server,browser;const results=[];
const timer=setTimeout(()=>{console.error('Goal browser deadline');process.exit(124)},600000);
try{
 server=spawn(process.execPath,[`${out}/taiko-forum/taiko_viewer/.output/server/index.mjs`],{cwd:`${out}/taiko-forum/taiko_viewer`,env:{PATH:process.env.PATH,NODE_OPTIONS:process.env.NODE_OPTIONS,TMPDIR:process.env.TMPDIR,HOST:'127.0.0.1',PORT:'3197',NUXT_REPO_ROOT:`${out}/runtime`,NUXT_DB_HOST:'127.0.0.1',NUXT_DB_PORT:'1',NUXT_DB_USER:'fixture',NUXT_DB_PASSWORD:randomBytes(16).toString('hex'),NUXT_DB_NAME:'goal_browser_test',NUXT_ANNUAL_SHARE_SECRET:randomBytes(32).toString('hex'),NUXT_ANNUAL_RENDER_SECRET:randomBytes(32).toString('hex')},stdio:['ignore',log.fd,log.fd]});
 for(let i=0;i<60;i++){try{if((await fetch(base,{signal:AbortSignal.timeout(1000)})).ok)break}catch{}if(i===59)throw Error('Readiness timeout');await new Promise(r=>setTimeout(r,1000))}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 for(const locale of ['zh','ja'])for(const width of [390,1440])for(const mode of (process.env.GOAL_MATRIX_SMOKE === '1' ? ['score-pb'] : ['score-pb','ng-reduced','clear','fc','df','rank-upgrade']))for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},serviceWorkers:'block'});
  const fixture=await goalServiceHarness();const {state,write}=fixture;state.plan=[100,101,102];
  state.catalog.push({id:102,level_4:9,shelf_status:0});
  // All charts have a played baseline; switch the authoritative selected record per mutation.
  state.fallback=false;state.basis='accuracy_power';
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message.slice(0,160)));page.on('console',m=>{if(/hydration/i.test(m.text()))errors.push('hydration')});
  let reads=0,writes=0;let persisted=null,completed=null;let evalOutcome='completed';
  const bind=()=>({id:state.binding.id,taikoId:'fixture',source:'wahlap',isCurrent:true});
  const overview=()=>({ ...state.overview(),activeGoal:persisted,recentCompletedGoal:completed,playerState:{overallRating:10.28,skills:['stamina','accuracy_power','rhythm','speed','complex','big_song'].map(key=>({key,value:10})),priorityDimension:state.basis,tiedDimensions:mode==='balanced'?['stamina','accuracy_power','rhythm','speed','complex','big_song']:[],dataSufficiency:mode==='limited'?'limited':'ready',sampleCount:30,basis:'lowest-valid-dimension'},dailyProgress:{calendarDay:'2026-09-19',dataMode:'FULL_HISTORY',attendance:'not_played',uniqueCharts:0,events:[]},dataStatus:{mode:'FULL_HISTORY',timezone:'Asia/Shanghai'}});
  try{
   await page.route('**/api/account/auth/me',r=>r.fulfill({json:{authenticated:true,user:{id:990001,username:'Goal Player',emailVerified:true}}}));
   await page.route('**/api/account/bindings',r=>r.fulfill({json:{bindings:[bind()],currentBinding:bind()}}));
   await page.route('**/api/account/songs?*',r=>r.fulfill({json:{total:1,items:[state.row]}}));
   await page.route('**/api/account/growth/overview',r=>{reads++;return r.fulfill({json:overview()})});
   await page.route('**/api/account/growth/goal/evaluate',async r=>{
    if(evalOutcome==='completed'){const before=mode==='ng-reduced'?8:mode==='rank-upgrade'?6:mode==='score-pb'?900000:0;const after=mode==='ng-reduced'?4:mode==='rank-upgrade'?7:mode==='score-pb'?900001:1;completed={...persisted,status:'completed',completedAt:new Date().toISOString(),completionEvidence:{evaluationVersion:1,result:{goalType:mode,before,after,delta:after-before,facts:{}}}};persisted=null;state.active=null;}
    await r.fulfill({json:{profileId:String(state.binding.id),outcome:evalOutcome,activeGoal:persisted,recentCompletedGoal:completed}});
   });
   await page.route('**/api/account/growth/goal',async r=>{
    writes++;const body=r.request().postDataJSON();if(body.songId)state.row.song_no=body.songId;
    try{const data=await write(990001,body,r.request().method()==='DELETE');persisted=data.activeGoal;completed=null;await r.fulfill({json:data})}
    catch(e){await r.fulfill({status:e.statusCode||500,json:{statusCode:e.statusCode||500}})}
   });
   const enter=async()=>{
    await page.goto(base+(locale==='ja'?'/ja/about':'/about'),{waitUntil:'networkidle',timeout:60000});
    await page.evaluate(()=>{window.__NUXT__.state['$saccount-user-loaded']=false});
    await page.locator(`a[href="${locale==='ja'?'/ja':'/'}"]`).evaluateAll(links=>{const el=links.find(x=>{const r=x.getBoundingClientRect();return r.width>0&&r.height>0&&r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight});if(!el)throw Error('Missing home link');el.click()});
    await page.locator('.growth-focus').waitFor({timeout:30000});
   };
   await enter();await page.evaluate(theme=>document.body.classList.toggle('theme-dark',theme==='dark'),theme);
   const choose=page.locator('.growth-plan__choose');await choose.first().click();const dialog=page.locator('dialog[open]');await dialog.locator(`input[value="${mode}"]`).check();await dialog.locator('.goal-actions button').last().click();await page.locator('.goal-evaluate').waitFor();
   assert.equal(await page.locator('.growth-goal--completed').count(),0);
   const readsBefore=reads;await page.locator('.goal-evaluate').scrollIntoViewIfNeeded();const scroll=await page.evaluate(()=>scrollY);
   evalOutcome='inconclusive';await page.locator('.goal-evaluate').click();await page.locator('[role="status"]').waitFor();assert.equal(await page.locator('.goal-evaluate').count(),1);
   evalOutcome='completed';await page.locator('.goal-evaluate').click();await page.locator('.growth-goal--completed').waitFor();assert.equal(reads,readsBefore);assert.equal(await page.evaluate(()=>scrollY),scroll);
   assert.equal(await page.locator('.growth-plan__choice').count(),3);assert.equal(await page.locator('.growth-progress').count(),1);
   assert.ok(!/home\.goal\./.test(await page.locator('.growth-surface').innerText()));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.locator('.growth-surface').screenshot({path:`${out}/${locale}-${width}-${mode}-${theme}.png`});
   const saved=completed;state.binding.id=2;completed=null;await enter();assert.equal(await page.locator('.growth-goal').count(),0);
   state.binding.id=1;completed=saved;await enter();await page.locator('.growth-goal--completed').waitFor();
   await choose.nth(1).click();await dialog.locator('input[value="score-pb"]').check();await dialog.locator('.goal-actions button').last().click();await page.locator('.goal-evaluate').waitFor();assert.equal(await page.locator('.growth-goal--completed').count(),0);assert.deepEqual(errors,[]);
   results.push({locale,width,mode,theme,result:'PASS'});
  }finally{fixture.cleanup();await context.close()}
 }
}finally{
 clearTimeout(timer);
 try {await finishResources();await writeFile(`${out}/browser-results.json`,JSON.stringify(results,null,2));}
 finally {
  try {if(browser)await browser.close();}
  finally {if(server&&server.exitCode===null){const exit=once(server,'exit');const kill=setTimeout(()=>server.kill('SIGKILL'),8000);server.kill('SIGTERM');await exit;clearTimeout(kill)}await log.close();}
 }
}
console.log(JSON.stringify({passed:results.length}));
