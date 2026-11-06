// UI-only synthetic network fixtures; SQL/worker evidence is tested separately.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdir,open,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
const out=process.env.QA_EVIDENCE_DIR;assert.ok(out);
const runtime=process.env.QA_RUN_TMPDIR;assert.ok(runtime);
const base='http://127.0.0.1:3198';
await mkdir(`${runtime}/userdata`,{recursive:true});
const log=await open(`${out}/dev.log`,'w');let server,browser;const results=[];
const timer=setTimeout(()=>{console.error('Training UI deadline');process.exitCode=124;server?.kill('SIGTERM');void browser?.close();},600000);
try {
 server=spawn(process.execPath,['node_modules/@nuxt/cli/bin/nuxi.mjs','dev','--host','127.0.0.1','--port','3198'],{cwd:new URL('..',import.meta.url),env:{PATH:process.env.PATH,NODE_OPTIONS:process.env.NODE_OPTIONS,TMPDIR:runtime,NUXT_REPO_ROOT:runtime,TAIKO_REPO_ROOT:runtime,TAIKO_USERDATA_DIR:`${runtime}/userdata`,NUXT_DB_HOST:'127.0.0.1',NUXT_DB_PORT:'1',NUXT_DB_USER:'fixture',NUXT_DB_PASSWORD:'fixture',NUXT_DB_NAME:'training_ui_test'},stdio:['ignore',log.fd,log.fd]});
 const deadline=Date.now()+120000;
 while(true){if(server.exitCode!==null)throw Error('Dev server exited');try{if((await fetch(base+'/about',{signal:AbortSignal.timeout(2000)})).ok)break;}catch{}assert.ok(Date.now()<deadline,'Dev readiness deadline');await new Promise(r=>setTimeout(r,500));}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 for(const locale of ['zh','ja'])for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  const page=await context.newPage();page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(e.message.slice(0,180)));page.on('console',m=>{if(m.type()==='error')console.log('browser:',m.text().slice(0,180));});
  let active=null,completed=null,revision='r1',reads=0,recentReads=0,postCount=0,mode='completed';let lastLog=null;let failOverview=false;let source='wahlap';
  const goal=()=>({id:'10',profileId:'1',songId:100,difficultyType:5,title:'Training song',starLevel:9,goalType:'score-pb',baseline:{highScore:700000},status:'active'});
  const binding=()=>({id:1,taikoId:'123',source,isCurrent:true,canExternalSync:source!=='manual',isManual:source==='manual'});
  const overview=()=>({profileId:'1',scoreRevision:revision,activeGoal:active,recentCompletedGoal:completed,playerState:{overallRating:10,skills:[],priorityDimension:'stamina',tiedDimensions:[],dataSufficiency:'ready',sampleCount:30},todayPlan:{items:[{songId:100,difficultyType:5,title:'Training song',starLevel:9,targetDimension:'stamina',reason:'target-dimension',goalOptions:['score-pb']},{songId:101,difficultyType:4,title:'Next song',starLevel:8,targetDimension:'stamina',reason:'target-dimension',goalOptions:['score-pb']}]},dailyProgress:{calendarDay:'2026-11-06',dataMode:'SNAPSHOT_LIMITED',attendance:'unknown',events:[]},dataStatus:{mode:'SNAPSHOT_LIMITED',timezone:'Asia/Shanghai'}});
  try{
   await page.route('**/api/**',async r=>{
    const path=new URL(r.request().url()).pathname;if(!path.startsWith('/api/'))return r.continue();const method=r.request().method();let json={};
    if(path==='/api/account/auth/me')json={authenticated:true,user:{id:900001,username:'Training UI',emailVerified:true}};
    else if(path==='/api/account/bindings')json={bindings:[binding()],currentBinding:binding()};
    else if(path==='/api/account/songs')json={total:1,items:[{highScore:700000}]};
    else if(path==='/api/account/growth/overview'){reads++;if(failOverview)return r.fulfill({status:503,json:{statusMessage:'fixture unavailable'}});json=overview();}
    else if(path==='/api/account/growth/recent'){recentReads++;json={profileId:'1',state:'caught-up',facts:[],totalFacts:0,observedAt:null,boundary:{acknowledgeRequired:false}};}
    else if(path==='/api/account/growth/goal'){
     const body=r.request().postDataJSON();assert.equal(body.expectedActiveGoalId,active?.id||null);assert.equal(body.scoreRevision,revision);
     active={...goal(),id:String(10+postCount++),songId:body.songId,difficultyType:body.difficultyType};completed=null;json={profileId:'1',activeGoal:active};
    }
    else if(path==='/api/account/sync/targets')json={currentBinding:binding(),hasUserdata:true,canSyncFromWahlap:true,scoreTokenAvailable:false,scoreToken:null,targets:[{id:'local',label:'Test target',description:''}],cooldownRemainingSeconds:0,cooldownUntil:'',lastSync:lastLog};
    else if(path==='/api/account/sync'||path==='/api/account/growth/goal/evaluate-current'){
     assert.equal(r.request().postDataJSON().profileId,'1');revision='r2';
     if(mode==='completed'){completed={...active,status:'completed',completionEvidence:{result:{goalType:'score-pb',before:700000,after:800000,delta:100000}}};active=null;}
     const result={profileId:'1',outcome:mode,activeGoal:active,recentCompletedGoal:completed};
     lastLog={id:1,taikoId:'123',status:'success',results:[{targetId:'local',label:'Test target',ok:true,message:'OK'}],originalBytes:100,compressedBytes:50,createdAt:'2026-11-06T01:00:00Z'};
     json=path.endsWith('evaluate-current')?result:{log:lastLog,goalEvaluation:result};
    }
    else if(path==='/api/content/songs/100')json={song:{id:100,song_name:'Training song',level_4:9,level_5:9,shelf_status:0,genre:'ナムコオリジナル'},ratingEntries:[],branchAudioVariants:{},tjaBundleUrl:null};
    else if(path.includes('/ugc'))json=null;
    else if(path.startsWith('/api/content/home'))json={latestSongs:[],events:[]};
    else if(path.includes('songs'))json={items:[],total:0};
    return r.fulfill({json});
   });
   const prefix=locale==='ja'?'/ja':'';
   await page.goto(base+prefix+'/about',{waitUntil:'networkidle'});
   await page.waitForFunction(()=>document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$nuxt);
   await page.evaluate(()=>{document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$nuxt.payload.state['$saccount-user-loaded']=false;});
   await page.locator(`a[href="${prefix||'/'}"]`).evaluateAll(links=>{const link=links.find(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.left>=0&&r.top>=0&&r.bottom<=innerHeight;});if(!link)throw Error('Visible home navigation missing');link.click();});await page.locator('.growth-plan__choose').first().waitFor();console.log('Home ready',locale,width);
   await page.locator('.growth-plan__choose').first().click();await page.locator('dialog[open] input[value="score-pb"]').check();await page.locator('dialog[open] .goal-actions button').last().click();await page.locator('.goal-evaluate').waitFor();
   const chart=page.locator('.growth-goal a[href*="/songs/"]');assert.match(await chart.getAttribute('href'),/difficulty=5/);
   await chart.click();await page.locator('#song-track-EDIT').waitFor();assert.equal(await page.locator('#song-track-EDIT').getAttribute('aria-selected'),'true');
   await page.goBack();await page.locator('.goal-evaluate').waitFor();
   await page.locator('.growth-goal a[href*="/account/sync"]').click();await page.locator('.target-item').waitFor();
   const before={reads,recentReads};
   if(!await page.locator('.target-item input').isChecked())await page.locator('.target-item .el-checkbox').click();
   await page.getByRole('button',{name:locale==='ja'?'同期開始':'开始同步',exact:true}).click();
   await page.getByText(locale==='ja'?'目標を達成しました':'目标已达成',{exact:true}).waitFor();
   assert.equal(reads,before.reads,'Inactive Home must not read Overview');assert.equal(recentReads,before.recentReads);
   console.log('Sync completed',locale,width);await page.locator('.goal-return').click();await page.locator('.growth-goal--completed').waitFor();
   assert.equal(reads,before.reads+1);assert.equal(recentReads,before.recentReads+1);
   assert.equal(await page.locator('.growth-loading').count(),0);
   await page.locator('.growth-goal--completed button').click();
   // Choose through the existing replacement dialog, using its visible option.
   await page.locator('dialog[open] button').filter({hasText:'Next song'}).click();
   await page.locator('dialog[open] input[value="score-pb"]').check();await page.locator('dialog[open] .goal-actions button').last().click();await page.locator('.goal-evaluate').waitFor();
   assert.equal(active.songId,101);console.log('Next goal ready',locale,width);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.locator('.growth-surface').screenshot({path:`${out}/training-${locale}-${width}.png`});
   // Each outcome remains separate from sync delivery success. Retry never syncs again.
   for(const outcome of ['active','inconclusive','evaluation-error','no-active-goal']){
    mode=outcome;await page.locator('.growth-goal a[href*="/account/sync"]').click();await page.locator('.target-item').waitFor();if(!await page.locator('.target-item input').isChecked())await page.locator('.target-item .el-checkbox').click();
    await page.getByRole('button',{name:locale==='ja'?'同期開始':'开始同步',exact:true}).click();await page.locator('.goal-sync-result').waitFor();
    if(outcome==='evaluation-error'){await page.getByRole('button',{name:locale==='ja'?'目標を再確認':'重试目标评估',exact:true}).waitFor();mode='active';await page.getByRole('button',{name:locale==='ja'?'目標を再確認':'重试目标评估',exact:true}).click();await page.getByText(locale==='ja'?'目標はまだ達成していません':'目标尚未达成',{exact:true}).waitFor();}
    await page.locator('.goal-return').click();await page.locator('.goal-evaluate').waitFor();
   }
   // Manual bindings never advertise an external sync action.
   source='manual';await page.evaluate(()=>{document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$nuxt.payload.state['$saccount-binding-generation']++;});
   await page.locator('.goal-evaluate').waitFor();assert.equal(await page.locator('.growth-goal a[href*="/account/sync"]').count(),0);
   assert.deepEqual(errors,[]);results.push({locale,width,reads,recentReads,result:'PASS'});
  }catch(error){console.log(JSON.stringify({errors,body:(await page.locator('body').innerText()).slice(0,1200)}));throw error;}finally{await context.close();}
 }
}finally{
 clearTimeout(timer);if(browser)await browser.close();if(server&&server.exitCode===null){const exit=once(server,'exit');server.kill('SIGTERM');const kill=setTimeout(()=>server.kill('SIGKILL'),5000);await exit;clearTimeout(kill);}await log.close();await writeFile(`${out}/training-browser.json`,JSON.stringify(results,null,2));
}
console.log(JSON.stringify(results));
