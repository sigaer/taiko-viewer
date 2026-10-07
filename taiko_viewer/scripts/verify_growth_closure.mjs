#!/usr/bin/env node
// Run under scripts/memory/run_qa.sh; local built Viewer and Chromium share its cgroup.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdir,writeFile,readFile,open} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {fixtures} from '../tests/fixtures/dailyProgressReplay.mjs';
import {replayOverview} from '../tests/fixtures/growthReplayHarness.mjs';
import {monitorAcceptanceResources} from '../tests/fixtures/acceptanceResources.mjs';
const out=process.env.GROWTH_ARTIFACTS || '/var/tmp/growth-closure';
await mkdir(out,{recursive:true});
const production=process.argv.includes('--production');
const base=production?'https://viewer.sakura-bot.cn':'http://127.0.0.1:3198';
const report=[];
const finishResources=await monitorAcceptanceResources(`${out}/${production?'production':'browser'}-resources.json`);
let server,browser,serverLog;
const deadline=setTimeout(()=>{console.error('Growth acceptance deadline exceeded');process.exit(124)},720000);
try {
 if(!production){
  serverLog=await open(`${out}/server.log`,'w');
  await mkdir(`${out}/runtime`,{recursive:true});
  // Whitelist environment; no production config, credentials, DB or userdata.
  // Port 1 deliberately refuses MySQL; the Growth/auth providers are test-only.
  server=spawn(process.execPath,[`${out}/viewer/.output/server/index.mjs`],{cwd:`${out}/viewer`,env:{PATH:process.env.PATH,NODE_OPTIONS:process.env.NODE_OPTIONS,TMPDIR:process.env.TMPDIR,HOST:'127.0.0.1',PORT:'3198',NUXT_REPO_ROOT:`${out}/runtime`,TAIKO_ANNUAL_ADMISSION_DIR:`${out}/runtime/admission`,NUXT_ACCOUNT_CACHE_DIR:`${out}/runtime/cache`,NUXT_DB_HOST:'127.0.0.1',NUXT_DB_PORT:'1',NUXT_DB_USER:'fixture',NUXT_DB_PASSWORD:randomBytes(24).toString('hex'),NUXT_DB_NAME:'growth_fixture_test',NUXT_ANNUAL_SHARE_SECRET:randomBytes(32).toString('hex'),NUXT_ANNUAL_RENDER_SECRET:randomBytes(32).toString('hex')},stdio:['ignore',serverLog.fd,serverLog.fd]});
  for(let i=0;i<90;i++){if(server.exitCode!==null)throw Error('Local Viewer exited');try{const r=await fetch(base,{signal:AbortSignal.timeout(1000)});if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,1000));if(i===89)throw Error('Viewer readiness timeout');}
 }
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 if(production){
  const authPath=process.env.GROWTH_AUTH_FILE;
  assert.ok(authPath,'GROWTH_AUTH_FILE must point to an existing authorized private session file');
  const auth=JSON.parse(await readFile(authPath,'utf8'));
  assert.ok(typeof auth.owner==='string' && auth.owner.length>0,'Missing authorized session');
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  try{
   await context.addCookies([{name:'stv_session',value:auth.owner,url:base}]);
   const page=await context.newPage();const errors=[],resourceErrors=[],hydration=[];let growthResponse;
   page.on('pageerror',e=>errors.push(e.name));
   page.on('console',m=>{if(/hydration/i.test(m.text()))hydration.push(m.type());else if(m.type()==='error')(/Failed to load resource/.test(m.text())?resourceErrors:errors).push({type:'console-error',message:m.text().replace(/https?:\/\/\S+/g,'[url]').slice(0,200),source:(()=>{try{return new URL(m.location().url).pathname}catch{return ''}})()})});
   page.on('response',r=>{if(new URL(r.url()).pathname==='/api/account/growth/overview')growthResponse=r;});
   const started=performance.now();
   await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
   await page.locator('.growth-focus').waitFor({timeout:60000});
   const visibleMs=Math.round(performance.now()-started);
   assert.ok(growthResponse,'Authenticated Growth request not observed');
   await growthResponse.finished();
   const data=await growthResponse.json(),timing=growthResponse.request().timing();
   const cache=growthResponse.headers()['cache-control'];
   await page.screenshot({path:`${out}/production.png`});
   await page.locator('.growth-progress').scrollIntoViewIfNeeded();
   await page.locator('.growth-surface').screenshot({path:`${out}/production-growth.png`});
   await page.waitForLoadState('networkidle',{timeout:15000});
   const body=await page.locator('body').innerText();
   const rawKey=/\b(?:home\.growth|difficulty\.\d|nav\.[A-Za-z])/.test(body);
   const row={result:'FAIL',at:new Date().toISOString(),http:growthResponse.status(),cacheControl:cache,ttfbMs:Math.round(timing.responseStart-timing.requestStart),totalMs:Math.round(timing.responseEnd),browserGrowthVisibleMs:visibleMs,home:await page.locator('.home-page').getAttribute('data-home-state'),dailyState:data.dailyProgress.attendance,eventCount:data.dailyProgress.events.length,errors,resourceErrors,hydration,rawKey,brokenImages:await page.locator('.growth-surface img').evaluateAll(images=>images.filter(img=>!img.complete||!img.naturalWidth).length)};
   report.push(row);
   assert.equal(row.http,200);assert.match(cache,/private/);assert.match(cache,/no-store/);assert.equal(row.home,'authenticated_ready');assert.equal(rawKey,false);assert.deepEqual(errors,[]);assert.deepEqual(hydration,[]);assert.equal(row.brokenImages,0);
   assert.ok(resourceErrors.every(e=>/^\/cover\/thumb\/\d+\/\d+\.webp$/.test(e.source)&&e.message.includes('404')),'Unexpected resource error');
   row.result='PASS';
  }finally{await context.close();}
 }else{
  for(const locale of ['zh','ja'])for(const dark of [false,true])for(const width of [390,1440])for(const state of ['improvement','pb','crown','ordinary','no-play','balanced','limited','merged']){
   const fixture=fixtures.find(f=>f.id===(['balanced','limited'].includes(state)?'ordinary':state));
   const context=await browser.newContext({viewport:{width,height:width===390?844:900},serviceWorkers:'block'});
   const row={state,locale,theme:dark?'dark':'light',viewport:width===390?'390x844':'1440x900',result:'FAIL'};
   report.push(row);
   try{
    const page=await context.newPage();const errors=[],hydration=[];
    page.on('pageerror',e=>errors.push(e.name));page.on('console',m=>{if(/hydration/i.test(m.text()))hydration.push(m.type())});
    await page.addInitScript(d=>localStorage.setItem('taiko_theme',d?'dark':'light'),dark);
    // Compute on the browser's actual request, through the service and on-disk snapshots.
    await page.route('**/api/account/growth/overview',async route=>{const {overview}=await replayOverview(fixture,state);await route.fulfill({json:overview});});
    const user={id:990001,username:'Replay Player',emailVerified:true};
    const binding={id:1,taikoId:'fixture',source:'manual',isCurrent:true};
    await page.route('**/api/account/auth/me',route=>route.fulfill({json:{authenticated:true,user}}));
    await page.route('**/api/account/bindings',route=>route.fulfill({json:{bindings:[binding],currentBinding:binding}}));
    await page.route('**/api/account/songs?*',route=>route.fulfill({json:{total:1,items:[{song_no:1,level:4,high_score:900000}]}}));
    await page.goto(base+(locale==='ja'?'/ja/about':'/about'),{waitUntil:'networkidle',timeout:60000});
    // Discard the anonymous SSR auth cache, then let the real Home resolver call
    // the authenticated fixture endpoints on client navigation (no Home-state DTO).
    await page.evaluate(()=>{window.__NUXT__.state['$saccount-user-loaded']=false;});
    const homePath=locale==='ja'?'/ja':'/';
    await page.locator(`a[href="${homePath}"]`).evaluateAll(links=>{
     const link=links.find(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;});
     if(!link)throw Error('No visible Home navigation link');link.click();
    });
    const surface=page.locator('.growth-surface');await surface.locator('.growth-focus').waitFor({timeout:20000});
    const text=await surface.innerText(),daily=await surface.locator('.growth-progress').innerText();
    assert.equal(await surface.locator('.growth-metric').count(),0);
    assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('theme-dark')),dark);
    assert.ok(!/涉及谱面|段位变化|接下来先练|练这三首|次は.*を練習|推荐歌曲取得进步|home\.growth\.|difficulty\.\d/.test(text));
    if(state==='improvement')assert.match(daily,locale==='zh'?/不可压到了 4/:/不可を4/);
    if(state==='pb'||state==='merged'){assert.match(daily,/907,130/);assert.match(daily,/7,130/);}
    if(state==='merged'){assert.match(daily,locale==='zh'?/不可压到了 0/:/不可を0/);assert.equal(await surface.locator('.growth-event').count(),1);}
    if(state==='crown'||state==='merged')assert.match(daily,locale==='zh'?/拿到全连/:/フルコンボを達成/);
    if(state==='no-play'){assert.match(daily,locale==='zh'?/今天还没开打/:/今日はまだプレイ/);assert.equal(await surface.locator('.growth-event').count(),0);}
    else {assert.match(daily,/Replay Song Alpha/);assert.match(daily,locale==='zh'?/魔王/:/おに/);}
    assert.match(await surface.locator('.growth-plan').innerText(),/9星/);
    assert.match(text,locale==='zh'?/可以试试这三首/:/この3曲はいかが？/);
    if(state==='ordinary')assert.match(daily,locale==='zh'?/今天打了 1 张谱/:/1/);
    if(state==='balanced')assert.match(text,locale==='zh'?/最近状态挺均衡/:/バランス/);
    if(state==='limited')assert.match(text,locale==='zh'?/再积累一些成绩/:/記録が増えると/);
    assert.ok(await surface.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert.deepEqual(errors,[]);assert.deepEqual(hydration,[]);
    await surface.locator('.growth-progress').scrollIntoViewIfNeeded();
    await surface.screenshot({path:`${out}/${locale}-${dark?'dark':'light'}-${width}-${state}.png`});
    row.result='PASS';
   }catch(error){row.error=String(error.message).slice(0,500);throw error;}finally{await context.close();}
  }
 }
}finally{
 clearTimeout(deadline);
 try {
  await finishResources();
  await writeFile(`${out}/${production?'production':'browser'}.json`,JSON.stringify(report,null,2));
 } finally {
  try {if(browser)await browser.close();}
  finally {
   if(server && server.exitCode===null && !server.signalCode){const exited=once(server,'exit');const killTimer=setTimeout(()=>server.kill('SIGKILL'),8000);server.kill('SIGTERM');await exited;clearTimeout(killTimer);assert.ok(server.exitCode!==null||server.signalCode,'Viewer listener not reaped');}
   if(serverLog)await serverLog.close();
  }
 }
}
console.log(JSON.stringify({mode:production?'production':'browser',passed:report.length,out}));
