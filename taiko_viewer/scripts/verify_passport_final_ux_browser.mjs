// Real Vue + server-composed synthetic DTOs. Run only through run_qa.sh.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir,open,writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { recoveryFact,recoveryFlood,recoveryInput,recoveryMeasurement } from '../tests/fixtures/passportRecovery.ts';
import { resolveSkillPassportRange } from '../server/services/growth-passport/range.ts';
import { buildSkillPassport } from '../server/services/growth-passport/composer.ts';
import { passportPresentationFixture,homePresentationFixture } from '../tests/fixtures/growthExperienceFixtures.mjs';
import { monitorPassportResources } from '../tests/fixtures/passportRecoveryResources.mjs';
const baseline=process.argv.includes('--before');
const extras=process.argv.includes('--extras');
import { finalBrowserInput } from '../tests/fixtures/passportFinalUx.ts';
const dev=process.argv.includes('--dev');
const out='/var/tmp/passport-final-ux-0814', base='http://127.0.0.1:3197';
const projectArg=process.argv.indexOf('--project');
const build=projectArg>=0?process.argv[projectArg+1]:new URL('..',import.meta.url).pathname;
const compose=buildSkillPassport;
const layouts=baseline?[{locale:'zh',width:390,dark:false}]:['zh','ja'].flatMap(locale=>[390,1440].flatMap(width=>[false,true].map(dark=>({locale,width,dark}))));
const scenarios=baseline?['compatible','singletons']:extras?['ceiling','unknown','truncated']:['compatible','singletons','empty','weak'];
const report={baseline,dev,results:[],screenshotReview:'PENDING'};
await mkdir(out,{recursive:true});
const finishResources=await monitorPassportResources(`${out}/${baseline?'baseline':extras?'extras':'browser'}-resources.json`);
const log=await open(`${out}/${baseline?'baseline':'browser'}-server.log`,'w');
let server,browser;
const deadline=setTimeout(()=>{console.error('Passport recovery browser deadline');process.exit(124);},720000);
const fixture=(scenario,days=90,profileId='2')=>{
 const input=finalBrowserInput(scenario);input.profileId=profileId;input.history.profileId=profileId;input.range=resolveSkillPassportRange({range:days},new Date('2026-10-08T04:00:00Z'));
 for(const fact of input.history.facts)fact.bindingId=profileId;
 if(scenario==='ceiling')for(const fact of input.history.facts)fact.title='長い曲名 / 很长的歌曲标题 · '+String(fact.title).repeat(8);
 const p=compose(input);p.current={rating:10.43,dimensions:passportPresentationFixture('stable').current.dimensions,focus:'accuracy_power',readiness:'ready'};
 p.activeGoal={...homePresentationFixture('active-goal').overview.activeGoal,title:`Current Goal ${profileId}`};
 p.currentNextAction=null;return p;
};
try{
 server=spawn(process.execPath,dev?['node_modules/nuxt/bin/nuxt.mjs','dev','--host','127.0.0.1','--port','3197']:['.output/server/index.mjs'],{cwd:build,env:{PATH:process.env.PATH,NODE_OPTIONS:process.env.NODE_OPTIONS,TMPDIR:process.env.TMPDIR,HOST:'127.0.0.1',PORT:'3197',NUXT_REPO_ROOT:`${out}/runtime`,NUXT_ACCOUNT_CACHE_DIR:`${out}/runtime/cache`,TAIKO_ANNUAL_ADMISSION_DIR:`${out}/runtime/admission`,NUXT_DB_HOST:'127.0.0.1',NUXT_DB_PORT:'1',NUXT_DB_USER:'fixture',NUXT_DB_PASSWORD:'fixture-unreachable',NUXT_DB_NAME:'passport_fixture_test',NUXT_ANNUAL_SHARE_SECRET:randomBytes(32).toString('hex'),NUXT_ANNUAL_RENDER_SECRET:randomBytes(32).toString('hex')},stdio:['ignore',log.fd,log.fd]});
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw new Error('Owned preview exited');try{if((await fetch(`${base}/about`,{signal:AbortSignal.timeout(1000)})).ok)break;}catch{}if(i===99)throw new Error('Readiness deadline');await new Promise(r=>setTimeout(r,500));}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 for(const layout of layouts)for(const scenario of scenarios){
  const row={...layout,scenario,result:'FAIL'};report.results.push(row);
  const context=await browser.newContext({viewport:{width:layout.width,height:layout.width===390?844:900},serviceWorkers:'block'});
  let page;
  try{
   page=await context.newPage();page.setDefaultTimeout(15000);
   const errors=[],hydration=[],requests=[];let profileId='2',delayNext=100;
   page.on('pageerror',error=>errors.push(error.message.slice(0,180)));
   page.on('console',message=>{if(/hydration/i.test(message.text()))hydration.push(message.text().slice(0,180));});
   page.on('request',request=>{if(request.url().includes('/api/account/'))requests.push(new URL(request.url()).pathname);});
   await page.addInitScript(dark=>{localStorage.setItem('taiko_theme',dark?'dark':'light');window.__passportShifts=0;new PerformanceObserver(list=>{for(const entry of list.getEntries())if(!entry.hadRecentInput)window.__passportShifts+=entry.value;}).observe({type:'layout-shift',buffered:true});},layout.dark);
   await page.route('**/api/account/auth/me',route=>route.fulfill({json:{authenticated:true,user:{id:990081,username:'Recovery fixture',emailVerified:true}}}));
   await page.route('**/api/account/growth/passport*',async route=>{const range=Number(new URL(route.request().url()).searchParams.get('range')||90),requestedProfile=profileId,delay=delayNext;delayNext=100;await new Promise(r=>setTimeout(r,delay));await route.fulfill({json:fixture(scenario,range,requestedProfile)});});
   const prefix=layout.locale==='ja'?'/ja':'';
   await page.goto(`${base}${prefix}/about`,{waitUntil:'domcontentloaded',timeout:30000});
   await page.waitForFunction(()=>document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false);
   await page.evaluate(()=>{window.__NUXT__.state['$saccount-user']={id:990081,username:'Recovery fixture',emailVerified:true};window.__NUXT__.state['$saccount-user-loaded']=true;});
   await page.locator(`a[href="${prefix}/my"]`).first().evaluate(element=>element.click());
   const link=page.locator(`.my-links a[href="${prefix}/my/growth"]`);await link.waitFor();
   const initialStart=performance.now();await link.click();
   const root=page.locator('.passport-page');await root.locator('.passport-hero').waitFor();
   row.initialVisibleMs=Math.round(performance.now()-initialStart);
   row.initialPassportRequests=requests.filter(path=>path==='/api/account/growth/passport').length;
   row.payloadBytes=Buffer.byteLength(JSON.stringify(fixture(scenario)));
   const text=await root.innerText();assert.doesNotMatch(text,/passport\.|modelRevision|algorithmVersion|[a-f0-9]{48,}/);
   const current=await root.locator('.passport-rating').innerText(),goal=await root.locator('.passport-next').innerText();
   if(baseline){row.rangeButtons=await root.locator('.passport-range button').count();row.selectedMilestoneDays=fixture(scenario).milestones.map(node=>node.day);}
   else{
    assert.equal(await root.locator('.passport-range button').count(),4);
    assert.equal(await root.locator('[data-range="90"]').getAttribute('aria-pressed'),'true');
    if(scenario==='ceiling'){
     assert.equal(await root.locator('.passport-milestone').count(),8);

     const more=root.locator('.passport-more');await more.click();assert.ok(await root.locator('.passport-milestone').count()>8);assert.equal(await more.getAttribute('aria-expanded'),'true');await more.click();
    }
    if(scenario==='singletons')assert.equal(await root.locator('.passport-chart__segment path').count(),2);
    if(scenario==='rich')assert.equal(await root.locator('.passport-chart__segment path').count(),6);
    if(!['empty','weak'].includes(scenario)){
     const point=root.locator('[data-metric="rating"] .passport-chart circle[role="button"]').last();await point.focus();await point.press('Enter');
     const detail=await root.locator('[data-metric="rating"] .passport-chart-detail').innerText();assert.match(detail,/Rating/);assert.doesNotMatch(detail,/精度|高速|rhythm|speed/);
     await point.evaluate(element=>element.scrollIntoView({block:'center'}));await point.hover();await point.click();await point.press('Space');

    }
   }
   assert.equal(await root.locator('.passport-break-control, .passport-chart__break').count(),0);
   if(!baseline)assert.equal(await root.locator('.passport-breaks summary').count(),0);
   if(!baseline&&['compatible','singletons'].includes(scenario)){
    const chart=root.locator('[data-metric="accuracy_power"]');
    assert.equal(await chart.locator('svg').count(),1);assert.equal(await chart.locator('circle[role="button"]').count(),4);
    assert.equal(await chart.locator('path').count(),1);assert.equal(await root.locator('.passport-point-records').count(),0);
    const xs=await chart.locator('circle[role="button"]').evaluateAll(els=>els.map(e=>Number(e.getAttribute('cx'))));
    assert.ok(Math.abs((xs[1]-xs[0])/(xs[2]-xs[1])-8)<.01);
    const first=chart.locator('circle[role="button"]').first();await first.focus();await first.press('Space');await page.waitForFunction(()=>document.querySelector('[data-metric="accuracy_power"] .passport-chart-detail')?.textContent.includes('10.42'));assert.match(await chart.locator('.passport-chart-detail').innerText(),/10.42/);
    const previous=chart.locator('.passport-chart-selection button').first();const next=chart.locator('.passport-chart-selection button').last();
    await next.click();await next.click();await page.waitForFunction(()=>document.querySelector('[data-metric="accuracy_power"] .passport-chart-detail')?.textContent.includes('10.44'));await previous.click();
    assert.equal(await root.locator('.passport-milestone').count(),5);assert.doesNotMatch(await root.locator('.passport-milestone-list').innerText(),/tiny-pb/);
   }
   if(!baseline&&scenario==='weak')assert.equal(await root.locator('.passport-milestone').count(),0);
   const initialHeadlines=await root.locator('.passport-milestone-headline').allTextContents();
   if(await root.locator('.passport-more').count()) {await root.locator('.passport-more').click();await root.locator('.passport-more').click();assert.deepEqual(await root.locator('.passport-milestone-headline').allTextContents(),initialHeadlines);}
   if(baseline){await root.screenshot({path:`${out}/before-${scenario}-${layout.locale}-${layout.width}-light.png`});row.result='PASS';continue;}
   const prior=requests.length;row.switches=[];
   let x30=null,x365=null;
   for(const days of [30,180,365,90]){
    const button=root.locator(`[data-range="${days}"]`);
    if(await button.count()===0)continue;
    const completed=baseline?page.waitForResponse(response=>response.url().includes('/api/account/growth/passport')&&new URL(response.url()).searchParams.get('range')===String(days)):null;
    const started=performance.now();await button.click();if(completed)await completed;
    await page.waitForFunction(days=>new URL(location.href).searchParams.get('range')===String(days),days);
    await page.waitForFunction(days=>document.querySelector(`[data-range="${days}"]`)?.getAttribute('aria-pressed')==='true',days);
    row.switches.push({days,visibleMs:Math.round(performance.now()-started)});
    if(days===365){row.svgElements365=await root.locator('.passport-metric svg *').count();row.renderTwoFramesMs=await page.evaluate(()=>new Promise(resolve=>{const start=performance.now();requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(performance.now()-start)));}));if(scenario==='ceiling')assert.equal(await root.locator('[data-metric="rating"] circle[role="button"]').count(),365);}
    if(!baseline){
     if(days===365&&scenario==='sparse')await root.locator('.passport-trend').screenshot({path:`${out}/range365-sparse-${layout.locale}-${layout.width}-${layout.dark?'dark':'light'}.png`});
     assert.equal(await root.locator('.passport-rating').innerText(),current);assert.equal(await root.locator('.passport-next').innerText(),goal);
     if(days>90)assert.match(await root.locator('.passport-milestones').innerText(),layout.locale==='zh'?/近 90 天/:/直近90日/);
     if(days===30&&scenario==='rich')assert.doesNotMatch(await root.locator('.passport-milestone-list').innerText(),/7月|8月/);
     if(scenario==='sparse'){
      assert.match(await root.locator('.passport-trend .passport-kicker').innerText(),new RegExp(`${days}`));
      const x=Number(await root.locator('[data-metric="rating"] .passport-chart circle[role="button"]').first().getAttribute('cx'));
      if(days===30)x30=x;if(days===365)x365=x;
     }
    }
   }
   row.rangeSwitchAccountRequests=requests.length-prior;
   row.rangeSwitchPassportRequests=requests.slice(prior).filter(path=>path==='/api/account/growth/passport').length;
   if(!baseline){
    assert.equal(row.rangeSwitchAccountRequests,0);assert.ok(scenario!=='sparse'||x365>x30);
    await page.goBack();await page.waitForFunction(()=>document.querySelector('[data-range="365"]')?.getAttribute('aria-pressed')==='true');
    await page.goForward();await page.waitForFunction(()=>document.querySelector('[data-range="90"]')?.getAttribute('aria-pressed')==='true');
    await root.locator('.passport-dimensions button').nth(2).click();
    await page.waitForFunction(()=>new URL(location.href).searchParams.get('dimension')==='speed');
    assert.equal(new URL(page.url()).searchParams.get('dimension'),'speed');
    await page.goBack();await page.waitForFunction(()=>document.querySelectorAll('.passport-dimensions button')[3]?.getAttribute('aria-pressed')==='true');
    assert.equal(await root.locator('.passport-dimensions button').nth(3).getAttribute('aria-pressed'),'true');
    // Invalidating a binding loads a fresh corpus once and clears the old view.
    if(scenario==='compatible'&&layout.locale==='zh'&&layout.width===390&&!layout.dark){
     profileId='3';const count=requests.filter(path=>path==='/api/account/growth/passport').length;
     await page.evaluate(()=>{window.__NUXT__.state['$saccount-binding-generation']+=1;});
     await page.waitForFunction(()=>document.querySelector('.passport-next')?.textContent.includes('Current Goal 3'));
     assert.equal(requests.filter(path=>path==='/api/account/growth/passport').length,count+1);
     row.bindingInvalidation='PASS';
     delayNext=450;await page.evaluate(()=>{window.__NUXT__.state['$saccount-binding-generation']+=1;});
     await page.waitForTimeout(150);profileId='4';
     await page.evaluate(()=>{window.__NUXT__.state['$saccount-user']={id:990082,username:'Other fixture',emailVerified:true};});
     await page.waitForFunction(()=>document.querySelector('.passport-next')?.textContent.includes('Current Goal 4'));
     await page.waitForTimeout(500);assert.match(await root.locator('.passport-next').innerText(),/Current Goal 4/);row.lateResponseIsolation='PASS';
    }
   }
   assert.ok(await root.evaluate(element=>element.scrollWidth<=element.clientWidth+1));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   if(layout.width===390){
    await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
    const lastControl=root.locator('.passport-more, .passport-chart-selection button').last();
    if(await lastControl.count()){const box=await lastControl.boundingBox(),nav=await page.locator('.mobile-tabbar').boundingBox();assert.ok(box&&nav&&box.y+box.height<nav.y,'Last control clears mobile bottom navigation');}
    row.mobileBottomControls='PASS';
   }
   assert.deepEqual(errors,[]);assert.deepEqual(hydration,[]);
   row.layoutShift=await page.evaluate(()=>window.__passportShifts);
   await page.mouse.move(0,0);await page.waitForTimeout(600);
   await root.screenshot({path:`${out}/${baseline?'baseline':'recovery'}-${scenario}-${layout.locale}-${layout.width}-${layout.dark?'dark':'light'}.png`});
   row.result='PASS';
  }catch(error){row.error=String(error.message||error).slice(0,500);row.url=page?.url();if(page){await page.screenshot({path:`${out}/failure.png`});row.activeRange=await page.locator('.passport-range').innerText().catch(()=>'missing');}throw error;}finally{await context.close();}
 }
}finally{
 clearTimeout(deadline);
 await writeFile(`${out}/${extras?'extras-matrix':'browser-matrix'}.json`,JSON.stringify(report,null,2));
 try{if(browser)await browser.close();}finally{
  if(server&&server.exitCode===null){const exited=once(server,'exit'),killer=setTimeout(()=>server.kill('SIGKILL'),5000);server.kill('SIGTERM');await exited;clearTimeout(killer);}
  await log.close();await finishResources();
 }
}
console.log(JSON.stringify({baseline,passed:report.results.filter(row=>row.result==='PASS').length,total:report.results.length,out}));
