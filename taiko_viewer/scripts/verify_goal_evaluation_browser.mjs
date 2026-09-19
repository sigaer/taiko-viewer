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
const out=process.env.GOAL_BROWSER_ARTIFACTS || '/var/tmp/growth-refresh';const base='http://127.0.0.1:3197';
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
  let reads=0,writes=0;let persisted=null,completed=null;let evalOutcome='completed';let failRefresh=false;
  const bind=()=>({id:state.binding.id,taikoId:'fixture',source:'wahlap',isCurrent:true});
  const dailyFacts=()=>{if(!completed)return [];const result=completed.completionEvidence.result;const type=mode==='clear'?'fc':mode==='fc'?'df':mode;const crown=['fc','df'].includes(type);return [{songId:completed.songId,level:completed.difficultyType,title:completed.title,evidence:'history',importance:1,occurredAt:'2026-09-19',facts:[{type,before:crown?-1:result.before,after:crown?(type==='fc'?1:2):result.after,delta:result.delta},{type:'combo-improved',before:100,after:110,delta:10}]}]};
  const overview=()=>({ ...state.overview(),activeGoal:persisted,recentCompletedGoal:completed,playerState:{overallRating:10.28,skills:['stamina','accuracy_power','rhythm','speed','complex','big_song'].map(key=>({key,value:10})),priorityDimension:state.basis,tiedDimensions:mode==='balanced'?['stamina','accuracy_power','rhythm','speed','complex','big_song']:[],dataSufficiency:mode==='limited'?'limited':'ready',sampleCount:30,basis:'lowest-valid-dimension'},dailyProgress:{calendarDay:'2026-09-19',dataMode:'FULL_HISTORY',attendance:completed?'played':'not_played',uniqueCharts:completed?1:0,events:dailyFacts()},dataStatus:{mode:'FULL_HISTORY',timezone:'Asia/Shanghai'}});
  try{
   await page.route('**/api/account/auth/me',r=>r.fulfill({json:{authenticated:true,user:{id:990001,username:'Goal Player',emailVerified:true}}}));
   await page.route('**/api/account/bindings',r=>r.fulfill({json:{bindings:[bind()],currentBinding:bind()}}));
   await page.route('**/api/account/songs?*',r=>r.fulfill({json:{total:1,items:[state.row]}}));
   await page.route('**/api/account/growth/overview',r=>{reads++;return r.fulfill(failRefresh?{status:503,json:{statusCode:503}}:{json:overview()})});
   await page.route('**/api/account/growth/goal/evaluate',async r=>{
    if(evalOutcome==='completed'){state.revision='revision-R2';state.row.high_score=900001;if(mode==='score-pb'){state.basis='rhythm';state.plan=[102,101,100]}const before=mode==='ng-reduced'?8:mode==='rank-upgrade'?6:mode==='score-pb'?900000:0;const after=mode==='ng-reduced'?4:mode==='rank-upgrade'?7:mode==='score-pb'?900001:1;completed={...persisted,status:'completed',completedAt:new Date().toISOString(),completionEvidence:{evaluationVersion:1,result:{goalType:mode,before,after,delta:after-before,facts:mode==='clear'?{clearCnt:0,fullComboCnt:1,dondafulComboCnt:0}:mode==='fc'?{fullComboCnt:0,dondafulComboCnt:1}:mode==='df'?{dondafulComboCnt:1}:{}}}};persisted=null;state.active=null;}
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
   for(const outcome of ['active','inconclusive']){evalOutcome=outcome;const n=reads;await page.locator('.goal-evaluate').click();await page.waitForFunction(()=>!document.querySelector('.goal-evaluate')?.disabled);assert.equal(reads,n+1);assert.equal(await page.locator('.goal-evaluate').count(),1);}
   evalOutcome='completed';failRefresh=true;await page.locator('.goal-evaluate').click();await page.locator('.goal-actions[role="alert"]').waitFor();assert.equal(reads,readsBefore+3);assert.equal(await page.locator('.growth-goal--completed').count(),1);assert.equal(await page.locator('.growth-goal--completed button').isDisabled(),true);assert.equal(await choose.first().isDisabled(),true);assert.equal(await page.locator('.growth-loading').count(),0);failRefresh=false;await page.locator('.goal-actions[role="alert"] button').click();await page.waitForFunction(()=>!document.querySelector('.growth-goal--completed button')?.disabled);assert.equal(reads,readsBefore+4);assert.ok(await page.evaluate(()=>scrollY)>0);
   assert.equal(await page.locator('.growth-plan__details > strong').first().innerText(),mode==='score-pb'?'Song 102':'Song 100');
   assert.equal(await page.locator('.growth-event__change').count(),1,'Only nonduplicate combo fact remains');
   assert.equal(await page.locator('.growth-plan__choice').count(),3);assert.equal(await page.locator('.growth-progress').count(),1);
   assert.ok(!/home\.goal\./.test(await page.locator('.growth-surface').innerText()));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.locator('.growth-surface').screenshot({path:`${out}/${locale}-${width}-${mode}-${theme}.png`});
   const saved=completed;await page.locator('.growth-goal--completed button').click();await choose.first().click();await dialog.locator('input[value="score-pb"]').check();await dialog.locator('.goal-actions button').last().click();await page.locator('.goal-evaluate').waitFor();assert.equal(persisted.sourceRevision,'revision-R2');persisted=null;state.active=null;completed=saved;state.binding.id=2;completed=null;await enter();assert.equal(await page.locator('.growth-goal').count(),0);
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
