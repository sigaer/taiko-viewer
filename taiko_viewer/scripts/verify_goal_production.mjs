// Release-only smoke. Existing user choices are never replaced by this test.
// Invoke under run_qa.sh after the standard deployment succeeds.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
const out='/var/tmp/goal-foundation-r2';const base='https://viewer.sakura-bot.cn';
assert.equal(process.env.TAIKO_ALLOW_GOAL_PRODUCTION_SMOKE,'1','Release smoke requires explicit opt-in');
assert.ok(process.env.GOAL_AUTH_FILE,'Private authorized session file required');
const auth=JSON.parse(await readFile(process.env.GOAL_AUTH_FILE,'utf8'));
assert.ok(typeof auth.owner==='string'&&auth.owner.length>0,'Authorized session missing');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
const timer=setTimeout(()=>{console.error('Goal smoke deadline');process.exit(124)},240000);
let created=null,profile=null;
const report={result:'FAIL',at:new Date().toISOString()};
try{
 await context.addCookies([{name:'stv_session',value:auth.owner,url:base}]);
 const privacy=response=>{assert.match(response.headers()['cache-control'],/private, no-store/);assert.match(response.headers()['vary'],/cookie/i)};
 const get=async()=>{const response=await fetch(`${base}/api/account/growth/overview`,{headers:{Cookie:`stv_session=${auth.owner}`},signal:AbortSignal.timeout(60000)});const headersAt=performance.now();assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/private, no-store/);assert.match(response.headers.get('vary'),/cookie/i);const body=await response.json();report.overviewTiming??=[];report.overviewTiming.push({ttfbMs:Math.round(headersAt-get.started),totalMs:Math.round(performance.now()-get.started)});return body};
 const timedGet=async()=>{get.started=performance.now();return get()};
 const before=await timedGet();assert.equal(before.activeGoal,null,'Use an account without an existing active Goal');profile=before.profileId;
 const candidate=before.todayPlan.items.find(item=>item.goalOptions?.includes('score-pb'));
 assert.ok(candidate,'No eligible Today Plan candidate');
 const page=await context.newPage();const jsErrors=[];let goalGets=0,overviewReads=0;page.on('pageerror',e=>jsErrors.push(e.name));page.on('console',m=>{if(/hydration/i.test(m.text()))jsErrors.push('hydration')});page.on('request',r=>{const path=new URL(r.url()).pathname;if(path==='/api/account/growth/goal'&&r.method()==='GET')goalGets++;if(path==='/api/account/growth/overview')overviewReads++});await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
 await page.locator('.growth-plan__choose').first().waitFor({timeout:60000});
 const choice=page.locator('.growth-plan__choice').filter({has:page.locator(`a[href*="/songs/${candidate.songId}"]`)}).first();
 await choice.locator('button').click();const dialog=page.locator('dialog[open]');await dialog.locator('input[value="score-pb"]').check();
 const responsePromise=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/account/growth/goal'&&r.request().method()==='POST',{timeout:60000});
 const readsBeforeCreate=overviewReads;const scrollBeforeCreate=await page.evaluate(()=>scrollY);
 const start=performance.now();await dialog.locator('.goal-actions button').last().click();
 const response=await responsePromise;assert.equal(response.status(),200);privacy(response);created=(await response.json()).activeGoal?.id;assert.ok(created);
 await page.locator('.growth-goal').waitFor({timeout:60000});report.createVisibleMs=Math.round(performance.now()-start);assert.equal(overviewReads,readsBeforeCreate);assert.equal(await page.evaluate(()=>scrollY),scrollBeforeCreate);
 const after=await timedGet();created=after.activeGoal?.id;assert.ok(created);assert.equal(after.activeGoal.songId,candidate.songId);assert.equal(after.activeGoal.baselineVersion,1);
 await page.reload({waitUntil:'domcontentloaded',timeout:60000});await page.locator('.growth-goal').waitFor({timeout:60000});assert.equal((await timedGet()).activeGoal.id,created);
 const logout=await context.request.post(`${base}/api/account/auth/logout`);assert.equal(logout.status(),200);
 const rejected=await context.request.get(`${base}/api/account/growth/overview`);assert.equal(rejected.status(),401);
 const login=await context.request.post(`${base}/api/account/auth/login`,{data:{identifier:auth.username,password:auth.password}});assert.equal(login.status(),200);const logged=await login.json();assert.ok(logged.sessionToken);auth.owner=logged.sessionToken;
 await context.addCookies([{name:'stv_session',value:auth.owner,url:base}]);assert.equal((await timedGet()).activeGoal.id,created);report.reloginPersistence='PASS';
 if(auth.profileB){
  let switched=await context.request.post(`${base}/api/account/bindings/current`,{data:{bindingId:auth.profileB}});assert.equal(switched.status(),200);assert.equal((await timedGet()).activeGoal,null);
  switched=await context.request.post(`${base}/api/account/bindings/current`,{data:{bindingId:auth.profileA}});assert.equal(switched.status(),200);assert.equal((await timedGet()).activeGoal.id,created);
  report.crossProfileIsolation='PASS';
 }
 const replacementOverview=await timedGet();const replacementItem=replacementOverview.todayPlan.items.find(item=>item.goalOptions?.some(type=>item.songId!==candidate.songId||item.difficultyType!==candidate.difficultyType||type!=='score-pb'));assert.ok(replacementItem,'Need a distinct eligible replacement');
 const replacementType=replacementItem.goalOptions.find(type=>replacementItem.songId!==candidate.songId||replacementItem.difficultyType!==candidate.difficultyType||type!=='score-pb');
 const oldId=created;const replacementBody={profileId:profile,expectedActiveGoalId:oldId,songId:replacementItem.songId,difficultyType:replacementItem.difficultyType,goalType:replacementType,scoreRevision:replacementOverview.scoreRevision};
 const replaced=await context.request.post(`${base}/api/account/growth/goal`,{data:replacementBody});assert.equal(replaced.status(),200);privacy(replaced);created=(await replaced.json()).activeGoal.id;assert.notEqual(created,oldId);
 const staleReplace=await context.request.post(`${base}/api/account/growth/goal`,{data:replacementBody});assert.equal(staleReplace.status(),409);
 const staleCancel=await context.request.delete(`${base}/api/account/growth/goal`,{data:{profileId:profile,expectedActiveGoalId:oldId}});assert.equal(staleCancel.status(),409);assert.equal((await timedGet()).activeGoal.id,created);report.replace='PASS';report.staleReplace=409;report.staleCancel=409;
 await page.reload({waitUntil:'domcontentloaded',timeout:60000});await page.locator('.growth-goal').waitFor({timeout:60000});
 assert.ok(!/home\.goal\./.test(await page.locator('body').innerText()));
 await page.locator('.growth-goal').screenshot({path:`${out}/production-goal.png`});
 const cancelResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/account/growth/goal'&&r.request().method()==='DELETE');const cancelStarted=performance.now();
 await page.locator('.growth-goal .goal-actions button').last().click();const cancelled=await cancelResponse;assert.equal(cancelled.status(),200);privacy(cancelled);report.cancelMs=Math.round(performance.now()-cancelStarted);await page.waitForFunction(()=>!document.querySelector('.growth-goal'),{},{timeout:60000});
 assert.equal((await timedGet()).activeGoal,null);created=null;
 await page.reload({waitUntil:'domcontentloaded',timeout:60000});await page.locator('.growth-focus').waitFor({timeout:60000});assert.equal(await page.locator('.growth-goal').count(),0);
 assert.equal(goalGets,0);assert.deepEqual(jsErrors,[]);report.extraGoalGets=goalGets;report.jsErrors=jsErrors;report.result='PASS';
}finally{
 try{
  if(created){const response=await context.request.delete(`${base}/api/account/growth/goal`,{data:{profileId:profile,expectedActiveGoalId:created}});assert.ok(response.ok(),'Smoke cleanup failed; inspect the isolated smoke account');}
  await writeFile(`${out}/production-goal.json`,JSON.stringify(report,null,2));
 }finally{clearTimeout(timer);await context.close();await browser.close()}
}
console.log(JSON.stringify(report));
