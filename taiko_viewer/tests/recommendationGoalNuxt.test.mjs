// Actual built Nuxt routes, session, SQL, installed wheel and Chromium. No API mocks.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {readFile,writeFile,mkdir,open,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import {randomBytes} from 'node:crypto';
import {chromium} from 'playwright-core';
import {accountSourceFixture} from './fixtures/accountSourceHttp.mjs';
import {authoritativeFixture} from './fixtures/goalAuthoritative.mjs';
const nativeFetch=globalThis.fetch;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(task,label,ms=20000){const end=performance.now()+ms;while(performance.now()<end){if(await task())return;await pause(60);}throw Error('Deadline '+label);}

test('built Nuxt ordinary list to difficulty confirmation Goal evaluation Growth, zh/ja desktop/mobile',{timeout:300000},()=>accountSourceFixture(async c=>{
 c.config.repoRoot=c.root;c.config.public={};
 const vector=JSON.parse(await readFile(new URL('./fixtures/installedRuntimeCatalog.json',import.meta.url),'utf8'));
 const catalog=[],charts={},records=[];
 for(let i=0;i<48;i++){
  const id=10000+i,title='Action '+i;charts[id]={...vector.chart,id,level:4,song_name_cn:title};
  catalog.push({id,song_name:title,song_name_jp:title,type:'南梦宫原创音乐',level_4:9,level_5:'-',shelf_status:0,max_combo:[0,0,0,Number(vector.chart.combo),0]});
  if(i<25)records.push({song_no:id,level:4,high_score:900000,good_cnt:i<20?520:450,ok_cnt:10,ng_cnt:1,combo_cnt:100,clear_cnt:1,full_combo_cnt:0,dondaful_combo_cnt:0,best_score_rank:4,stage_cnt:1,update_datetime:'2026-10-19 10:00:00',highscore_datetime:'2026-10-19 10:00:00'});
 }
 // A real ura chart: its stars intentionally differ from its identity code.
 const uraId=9999;charts[uraId]={...vector.chart,id:uraId,level:5,song_name_cn:'Action Ura'};catalog.push({id:uraId,song_name:'Action Ura',song_name_jp:'Action Ura',type:'南梦宫原创音乐',level_4:7,level_5:10,shelf_status:0,max_combo:[0,0,0,400,Number(vector.chart.combo)]});records.push({...records[24],song_no:uraId,level:5});
 await mkdir(resolve(c.root,'songs'));for(const name of ['song_data','song_data_raw'])await writeFile(resolve(c.root,'songs',name+'.json'),JSON.stringify(catalog));
 await writeFile(resolve(c.root,'songs/rating_structured_with_ids.json'),JSON.stringify({songs:charts,const_table:vector.const_table}));
 for(const name of ['song_alias','song_score','taiko_goku_onis','taiko_goku_all_levels_stream'])await writeFile(resolve(c.root,'songs',name+'.json'),'[]');
 await mkdir(resolve(c.root,'assets/fonts'),{recursive:true});await copyFile('/home/sigaer/taiko-bot/assets/fonts/DDFont.ttf',resolve(c.root,'assets/fonts/DDFont.ttf'));
 const {withPublicationLease}=await import('../server/infrastructure/taiko-publication/client.ts');
 const realNow=()=>new Date(performance.timeOrigin+performance.now());
 const publish=async(songs,at=realNow())=>withPublicationLease({root:c.config.userdataDir,repoRoot:c.root,identity:c.taikoId,mode:'write'},async lease=>{await lease.put('current',JSON.stringify(authoritativeFixture({profile:{userid:c.taikoId},songs},c.taikoId,at)));await lease.publish();});
 await publish(records,new Date(realNow().getTime()-1000));
 const E=process.env.QA_EVIDENCE_DIR;let host,log,browser,context,page,base;
 const errors=[],cases=[],responses=[];
 const dbEnv={};for(const prefix of ['TAIKO','NUXT','NUXT_BOT'])for(const suffix of ['HOST','PORT','USER','PASSWORD','NAME'])dbEnv[prefix+'_DB_'+suffix]=process.env['TAIKO_DB_'+suffix];
 const env={NUXT_ANNUAL_SHARE_SECRET:randomBytes(32).toString('hex'),NUXT_ANNUAL_RENDER_SECRET:randomBytes(32).toString('hex'),PATH:process.env.PATH,NODE_ENV:'production',NODE_OPTIONS:'--max-old-space-size=1536',TMPDIR:process.env.QA_RUN_TMPDIR,...dbEnv,
  TAIKO_PYTHON_EXECUTABLE:process.env.TAIKO_PYTHON_EXECUTABLE,TAIKO_RUNTIME_ENV_FILE:resolve(c.root,'absent.env'),TAIKO_REPO_ROOT:c.root,TAIKO_USERDATA_DIR:c.config.userdataDir,TAIKO_ACCOUNT_CACHE_DIR:c.config.accountCacheDir,TAIKO_CONFIG_PATH:resolve(c.root,'config.json'),TAIKO_SONG_DATA_PATH:resolve(c.root,'songs/song_data.json'),
  NUXT_REPO_ROOT:c.root,NUXT_USERDATA_DIR:c.config.userdataDir,NUXT_ACCOUNT_CACHE_DIR:c.config.accountCacheDir,NUXT_TAIKO_CONFIG_PATH:resolve(c.root,'config.json'),NUXT_SONG_DATA_PATH:resolve(c.root,'songs/song_data.json'),NUXT_ANNUAL_CACHE_DIR:resolve(c.root,'annual'),NUXT_VIEWER_CACHE_DIR:resolve(c.root,'viewer-cache'),NUXT_VIEWER_ACCESS_LOG_PATH:resolve(c.root,'access.log'),NUXT_ADMIN_BACKUP_DIR:resolve(c.root,'backup'),NUXT_BILIBILI_SESS_DATA_FILE:resolve(c.root,'absent-bili'),
  NUXT_TAIKO_API_BASE:'http://127.0.0.1:1',NUXT_TAIKO_ADMIN_API_BASE:'http://127.0.0.1:1',NUXT_LOCAL_SYNC_RECEIVER_BASE_URL:'http://127.0.0.1:1',NUXT_PUBLIC_API_BASE:'http://127.0.0.1:1',NUXT_PUBLIC_GUIDE_API_BASE:'http://127.0.0.1:1',NUXT_DEVELOPER_API_V1:'false',NUXT_PUBLIC_DEVELOPER_API_V1:'false'};
 await writeFile(resolve(c.root,'config.json'),'{}');
 const request=async(path,{method='GET',body,expected=200,cookie=c.cookie}={})=>{const r=await nativeFetch(base+path,{method,headers:{cookie,origin:base,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});const data=await r.json();assert.equal(r.status,expected,path+' '+(data.statusMessage||data.message||''));return data;};
 try{
  const ports=createServer();ports.listen(0,'127.0.0.1');await once(ports,'listening');const port=ports.address().port;await new Promise(r=>ports.close(r));base='http://127.0.0.1:'+port;
  log=await open(resolve(E,'recommendation-nuxt.log'),'wx',0o600);
  host=spawn(process.execPath,[new URL('../.output/server/index.mjs',import.meta.url).pathname],{cwd:c.root,env:{...env,NITRO_HOST:'127.0.0.1',NITRO_PORT:String(port)},stdio:['ignore',log.fd,log.fd]});host.on('error',()=>{});
  await until(async()=>{if(host.exitCode!==null)throw Error('Owned Nuxt exited');try{return (await nativeFetch(base+'/api/account/auth/me',{signal:AbortSignal.timeout(500)})).status===200;}catch{return false;}},'Nuxt ready');
  const original=await request('/api/account/recommendation/tool?n=20');assert.ok(original.items.some(x=>x.level===5&&x.starLevel===10),'ura fixture reaches actual endpoint');
  await request('/api/account/recommendation/tool',{expected:401,cookie:''});
  const image=await request('/api/account/recommendation/tool?n=5&image=true');assert.match(image.image,/^data:image\/jpeg;base64,/);assert.equal(image.items.length,5);
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],timeout:15000});
  context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});await context.addCookies([{name:'stv_session',value:c.cookie.split('=')[1],url:base}]);
  await context.route('**/*',route=>{const u=new URL(route.request().url());return u.origin===base||u.protocol==='data:'?route.continue():route.abort();});
  page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message.slice(0,250)));page.on('response',r=>{if(new URL(r.url()).pathname.startsWith('/api/account/'))responses.push({path:new URL(r.url()).pathname,status:r.status()});});
  for(const locale of ['zh','ja'])for(const width of [1280,375]){
   const prefix=locale==='ja'?'/ja':'';await page.setViewportSize({width,height:width===375?812:900});
   await page.goto(base+prefix+'/tools/recommend',{waitUntil:'domcontentloaded',timeout:30000});await page.waitForFunction(()=>!!document.querySelector('#__nuxt')?.__vue_app__);
   const waiting=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/account/recommendation/tool');await page.getByRole('button',{name:locale==='ja'?'推薦を表示':'查看推荐',exact:true}).click();const batch=await (await waiting).json();await page.getByTestId('ordinary-list').waitFor();
   assert.deepEqual(await page.locator('[data-testid="ordinary-list"] article').evaluateAll(els=>els.map(el=>[Number(el.dataset.songId),Number(el.dataset.difficulty)])),batch.items.map(x=>[x.songId,x.level]));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   await page.screenshot({path:resolve(E,`recommendation-${locale}-${width}.png`),fullPage:false});
   const item=batch.items.find(x=>x.level===5&&x.canCreateGoal);assert.ok(item);const row=page.locator(`article[data-song-id="${item.songId}"][data-difficulty="5"]`);
   await row.locator('a').first().click();await page.waitForURL(u=>u.pathname===prefix+'/songs/'+item.songId);assert.equal(new URL(page.url()).searchParams.get('difficulty'),'5');await page.locator('.track-tab.active, .track-tabs button.active').waitFor();assert.match(await page.locator('.track-tabs button.active').innerText(),/里|裏/);
   const action=page.locator('.recommendation-goal-action');await action.getByRole('button',{name:locale==='ja'?'目標を選ぶ':'选择目标',exact:true}).click();const dialog=page.locator('dialog[open]');await dialog.waitFor();assert.match(await dialog.innerText(),/10★/);await page.screenshot({path:resolve(E,`goal-confirm-${locale}-${width}.png`)});
   await dialog.locator('input[value="score-pb"]').check();const created=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/account/growth/goal'&&r.request().method()==='POST');await dialog.locator('.goal-actions button').last().click();const goal=(await (await created).json()).activeGoal;assert.equal(goal.source,'ordinary-recommendation');assert.equal(goal.difficultyType,5);await action.getByRole('status').waitFor();
   await pause(50);records.find(x=>x.song_no===item.songId).high_score+=1;await publish(records);
   const outcome=await request('/api/account/growth/goal/evaluate',{method:'POST',body:{profileId:goal.profileId,expectedActiveGoalId:goal.id}});assert.equal(outcome.outcome,'completed');
   await page.goto(base+prefix+'/my/growth',{waitUntil:'domcontentloaded'});await page.locator('.passport-goal').waitFor();assert.ok((await page.locator('.passport-goal').innerText()).includes('Action Ura'));await page.screenshot({path:resolve(E,`goal-growth-${locale}-${width}.png`)});
   cases.push({locale,width,difficulty:5,stars:10,goalId:goal.id,outcome:outcome.outcome});
  }
  await page.goto(base+'/tools/recommend',{waitUntil:'domcontentloaded'});await page.locator('.el-input-number input').fill('7');await page.locator('.el-input-number input').press('Tab');await page.locator('.el-select').first().click();await page.locator('.el-select-dropdown__item').filter({hasText:/^体力$/}).click();await page.getByText('同时生成图片',{exact:true}).click();assert.equal(await page.getByRole('checkbox',{name:'同时生成图片'}).isChecked(),true);
  const selectedBatch=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/account/recommendation/tool');await page.getByRole('button',{name:'查看推荐',exact:true}).click();const selected=await(await selectedBatch).json();assert.equal(selected.basis,'stamina');assert.equal(selected.items.length,7);assert.match(selected.image,/^data:image\/jpeg;base64,/);await page.locator('.chart-image').waitFor();assert.equal(await page.locator('[data-testid="ordinary-list"] article').count(),7);
  cases.push({name:'quantity dimension and image from one actual request',basis:selected.basis,count:selected.items.length});
  assert.deepEqual(errors,[]);await writeFile(resolve(E,'recommendation-goal-browser.json'),JSON.stringify({status:'PASS',cases,responses,pageErrors:errors},null,2));
 }finally{
  await page?.close();await context?.close();await browser?.close();
  if(host){const exited=once(host,'exit');host.kill('SIGTERM');await Promise.race([exited,pause(2500)]);if(host.exitCode===null&&host.signalCode===null){host.kill('SIGKILL');await exited;}await until(async()=>{try{await nativeFetch(base+'/api/account/auth/me',{signal:AbortSignal.timeout(300)});return false;}catch{return true;}},'owned Nuxt listener stopped',3000);}
  await log?.close();await c.pool.execute('DELETE FROM web_player_goals WHERE user_id=?',[c.user]);
 }
},{withRealPython:true,withRealCatalog:true,requestTimeoutMs:60000}));
