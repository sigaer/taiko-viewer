// Real built Nuxt + fresh guarded MySQL + installed -I Publication worker.
// No runtime import hooks, fixture authority, API mocks or component harness.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {scryptSync,randomBytes,createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,open} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createReadStream} from 'node:fs';
import mysql from 'mysql2/promise';
import {chromium} from 'playwright-core';
import {GOAL_TABLE_SQL} from '../server/services/goals/schema.ts';
import {GROWTH_MEASUREMENT_TABLE_SQL} from '../server/services/growth-history/schema.ts';
import {withPublicationLease} from '../server/infrastructure/taiko-publication/client.ts';
const sha=x=>createHash('sha256').update(x).digest('hex');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(task,label,ms=12000){const end=Date.now()+ms;while(Date.now()<end){if(await task())return;await pause(40);}throw new Error('Deadline: '+label);}

test('My Taiko 0.88.3 catalog aliases real Nuxt authenticated acceptance',{timeout:150000},async()=>{
 assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1');assert.match(process.env.TAIKO_DB_NAME,/_test$/);assert.notEqual(process.env.TAIKO_DB_PORT,'3306');
 const E=process.env.QA_EVIDENCE_DIR,root=resolve(process.env.QA_RUN_TMPDIR,'my-taiko-product'),userdata=resolve(root,'userdata');await mkdir(userdata,{recursive:true});
 const pool=mysql.createPool({host:process.env.TAIKO_DB_HOST,port:Number(process.env.TAIKO_DB_PORT),user:process.env.TAIKO_DB_USER,password:process.env.TAIKO_DB_PASSWORD,database:process.env.TAIKO_DB_NAME,connectionLimit:8});
 const [[proof]]=await pool.query('SELECT DATABASE() name,@@datadir datadir');assert.equal(proof.name,process.env.TAIKO_DB_NAME);assert.equal(resolve(proof.datadir),resolve(process.env.TAIKO_TEST_MYSQL_DATADIR));
 const catalogPath=resolve(root,'catalog.json'),catalogBytes=JSON.stringify([{id:100,song_name:'Synthetic chart',level_4:9,shelf_status:0}]);await writeFile(catalogPath,catalogBytes);await writeFile(resolve(root,'config.json'),'{}');
 const artifact=JSON.parse(await readFile(resolve(E,'my-taiko-build.json'),'utf8'));assert.equal(artifact.status,'PASS');
 const aliasPath=resolve(root,'song_alias.json');await writeFile(aliasPath,JSON.stringify([{id:100,song_name_jp:'合成テスト曲',aliases:['合成别名']} ]));
 async function revision(){return sha(JSON.stringify({songDataSha256:sha(await readFile(catalogPath)),songAliasSha256:sha(await readFile(aliasPath))}));}
 async function verifyOutput(){for(const f of artifact.files){const digest=createHash('sha256');for await(const chunk of createReadStream(resolve(artifact.output,f.path)))digest.update(chunk);assert.equal(digest.digest('hex'),f.sha256,f.path);}}
 await verifyOutput();for(const d of ['cache','annual','viewer-cache'])await mkdir(resolve(root,d));
 const observations=[],browserCases=[],pageErrors=[],blockedExternal=[];let host,browser,context,page,hostPort,log,locker;
 const env={QA_RUN_ID:process.env.QA_RUN_ID,QA_RUN_DIR:process.env.QA_RUN_DIR,QA_RUN_TMPDIR:process.env.QA_RUN_TMPDIR,TAIKO_TEST_MYSQL_DATADIR:process.env.TAIKO_TEST_MYSQL_DATADIR,TAIKO_ALLOW_TEST_DB_MUTATION:'1',NUXT_ANNUAL_STARTUP_MODE:'owned-qa',PATH:process.env.PATH,NODE_ENV:'production',NODE_OPTIONS:'--max-old-space-size=1536',TMPDIR:process.env.QA_RUN_TMPDIR,
  TAIKO_PYTHON_EXECUTABLE:process.env.TAIKO_PYTHON_EXECUTABLE,TAIKO_RUNTIME_ENV_FILE:resolve(root,'absent.env'),
  TAIKO_REPO_ROOT:root,TAIKO_USERDATA_DIR:userdata,TAIKO_CONFIG_PATH:resolve(root,'config.json'),TAIKO_ACCOUNT_CACHE_DIR:resolve(root,'cache'),TAIKO_SONG_DATA_PATH:catalogPath,
  NUXT_REPO_ROOT:root,NUXT_USERDATA_DIR:userdata,NUXT_TAIKO_CONFIG_PATH:resolve(root,'config.json'),NUXT_ACCOUNT_CACHE_DIR:resolve(root,'cache'),NUXT_SONG_DATA_PATH:catalogPath,
  NUXT_ANNUAL_CACHE_DIR:resolve(root,'annual'),NUXT_VIEWER_CACHE_DIR:resolve(root,'viewer-cache'),NUXT_VIEWER_ACCESS_LOG_PATH:resolve(root,'absent-access.log'),NUXT_ADMIN_BACKUP_DIR:resolve(root,'backup'),NUXT_BILIBILI_SESS_DATA_FILE:resolve(root,'absent-bili'),
  NUXT_DEVELOPER_API_V1:'false',NUXT_PUBLIC_DEVELOPER_API_V1:'false',NUXT_PUBLIC_API_BASE:'http://127.0.0.1:1',NUXT_PUBLIC_GUIDE_API_BASE:'http://127.0.0.1:1',
  TAIKO_DB_HOST:process.env.TAIKO_DB_HOST,TAIKO_DB_PORT:process.env.TAIKO_DB_PORT,TAIKO_DB_USER:process.env.TAIKO_DB_USER,TAIKO_DB_PASSWORD:process.env.TAIKO_DB_PASSWORD,TAIKO_DB_NAME:proof.name,
  NUXT_DB_HOST:process.env.TAIKO_DB_HOST,NUXT_DB_PORT:process.env.TAIKO_DB_PORT,NUXT_DB_USER:process.env.TAIKO_DB_USER,NUXT_DB_PASSWORD:process.env.TAIKO_DB_PASSWORD,NUXT_DB_NAME:proof.name,
  NUXT_BOT_DB_HOST:process.env.TAIKO_DB_HOST,NUXT_BOT_DB_PORT:process.env.TAIKO_DB_PORT,NUXT_BOT_DB_USER:process.env.TAIKO_DB_USER,NUXT_BOT_DB_PASSWORD:process.env.TAIKO_DB_PASSWORD,NUXT_BOT_DB_NAME:proof.name,
  NUXT_TAIKO_API_BASE:'http://127.0.0.1:1',NUXT_TAIKO_ADMIN_API_BASE:'http://127.0.0.1:1',NUXT_LOCAL_SYNC_RECEIVER_BASE_URL:'http://127.0.0.1:1'};
 let base;
 async function start(mode){
  const portServer=createServer();portServer.listen(0,'127.0.0.1');await once(portServer,'listening');hostPort=portServer.address().port;await new Promise(r=>portServer.close(r));base='http://127.0.0.1:'+hostPort;
  log=await open(resolve(E,'nuxt-'+mode+'.log'),'wx',0o600);
  host=spawn(process.execPath,[resolve(artifact.output,'server/index.mjs')],{cwd:root,env:{...env,NITRO_HOST:'127.0.0.1',NITRO_PORT:String(hostPort),...(mode==='all'?{NUXT_MY_TAIKO_READ_MODEL_MODE:mode,NUXT_PUBLIC_MY_TAIKO_READ_MODEL_MODE:mode}:{})},stdio:['ignore',log.fd,log.fd]});host.on('error',()=>{});
  await until(async()=>{if(host.exitCode!==null)throw new Error('Owned Nuxt startup exited');try{const r=await fetch(base+'/api/account/auth/me',{signal:AbortSignal.timeout(700)});return r.status===200;}catch{return false;}},'Nuxt loopback startup',20000);
 }
 async function stop(){if(host){const exiting=once(host,'exit');host.kill('SIGTERM');await Promise.race([exiting,pause(2000)]);if(host.exitCode===null&&host.signalCode===null){host.kill('SIGKILL');await exiting;}host=null;await until(async()=>{try{await fetch(base+'/api/account/auth/me',{signal:AbortSignal.timeout(300)});return false;}catch{return true;}},'owned listener closed',2000);}await log?.close();log=null;}
 async function http(path,{cookie='',method='GET',body,expected=200,headers={}}={}){const r=await fetch(base+path,{method,headers:{'content-type':'application/json',...(cookie?{cookie}:{}),origin:base,...headers},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});const data=await r.json();if(r.status!==expected)await writeFile(resolve(E,'unexpected-response.json'),JSON.stringify({path,status:r.status,statusMessage:data.statusMessage||data.message||data.code},null,2));assert.equal(r.status,expected,path+' expected status '+String(data.statusMessage||data.code||''));return {r,data};}
 async function ask(name,cookie,expected=200,query=''){const {r,data}=await http('/api/account/my-taiko/overview'+query,{cookie,expected});assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('etag'),null);if(expected!==200)assert.equal(data.release,undefined);else{assert.equal(data.diagnostics.physicalCurrentReads,1);assert.equal(data.diagnostics.measurements,'NOT_REQUESTED');assert.equal(data.release.calculationProfile,null);assert.equal(data.recommendation.scoreRevision,data.release.scoreRevision);assert.equal(data.release.catalogRevision,await revision());assert.ok(data.release.legacyCatalogRevision.startsWith('legacy-projection-sha256:'));assert.notEqual(data.release.catalogRevision,data.release.legacyCatalogRevision);}
  observations.push({name,status:r.status,reason:data.statusMessage??null,binding:data.profile?.bindingId??null,revision:data.release?.scoreRevision??null,coverage:data.growth?.coverage.scoreHistoryState??null,facts:data.growth?.totalFacts??null});return data;}
 const password='synthetic-'+randomBytes(12).toString('hex'),salt=randomBytes(16).toString('hex'),passwordHash=salt+':'+scryptSync(password,salt,64).toString('hex');
 const publication={root:userdata,repoRoot:root};
 const snapshot=(title,score,stage,day,source='wahlap')=>({_meta:{source,ts:day+'T01:00:00Z',full:true},profile:{gameCostume:{title}},songs:[{song_no:100,level:4,high_score:score,stage_cnt:stage,clear_cnt:stage,highscore_datetime:day+' 09:00:00',update_datetime:day+' 09:00:00'}]});
 const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'}),yesterday=new Date(Date.now()-86400000).toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'});
 async function publish(identity,title,score,{empty=false,history=true}={}){return withPublicationLease({...publication,identity,mode:'write'},async lease=>{const current=empty?{_meta:{source:'wahlap'},profile:{},songs:[]}:snapshot(title,score,2,today);if(history){await lease.put('history/data_'+yesterday+'_09_00_00.json',JSON.stringify(snapshot(title,800000,1,yesterday)));await lease.put('history/data_'+today+'_09_00_00.json',JSON.stringify(current));}await lease.put('current',JSON.stringify(current));return lease.publish({replaceHistory:true});});}
 async function login(username){const {r}=await http('/api/account/auth/login',{method:'POST',body:{identifier:username,password}});return r.headers.get('set-cookie').split(';')[0];}
 async function switchTo(cookie,id){await http('/api/account/bindings/current',{method:'POST',cookie,body:{bindingId:id}});}
 async function barrier(task,mutation){locker=await pool.getConnection();await locker.query('LOCK TABLES web_player_goals WRITE');const pending=task();pending.catch(()=>{});try{await until(async()=>{const [rows]=await pool.query('SHOW FULL PROCESSLIST');return rows.some(r=>String(r.Info||'').includes('FROM web_player_goals')&&String(r.State||'').toLowerCase().includes('lock'));},'real Nuxt query blocked under SH lease');await mutation();}finally{await locker.query('UNLOCK TABLES');locker.release();locker=null;}return pending;}
 try{
  await start('all');await pool.execute(GOAL_TABLE_SQL);await pool.execute(GROWTH_MEASUREMENT_TABLE_SQL);
  async function user(name){const [r]=await pool.execute('INSERT INTO web_user_accounts(username,email,password_hash,email_verified) VALUES (?,?,?,1)',[name,name+'@example.test',passwordHash]);return r.insertId;}
  async function binding(owner,id,current){const [r]=await pool.execute("INSERT INTO web_taiko_bindings(user_id,taiko_id,source,verified_title,is_current) VALUES (?,?,'wahlap','Synthetic verified',?)",[owner,id,current]);return r.insertId;}
  const A=await user('catalog-a'),B=await user('catalog-b'),A1=await binding(A,'71000000001',1),A2=await binding(A,'71000000002',0);await binding(B,'71000000003',1);
  await publish('71000000001','Synthetic A1',900000);await publish('71000000002','Synthetic A2',910000);await publish('71000000003','Synthetic B',920000);
  const cookieA=await login('catalog-a'),cookieB=await login('catalog-b');
  const first=await ask('nonempty aliases and Japanese fallback accepted',cookieA);assert.equal(first.scores.highestScore,900000);assert.ok(first.growth.totalFacts>0);assert.equal(first.activeGoal,null);
  await ask('anonymous denied','',401);await ask('other binding query denied',cookieA,400,'?bindingId='+A2);
  assert.equal((await ask('second account isolated',cookieB)).scores.highestScore,920000);
  await switchTo(cookieA,A2);assert.equal((await ask('current binding A2',cookieA)).scores.highestScore,910000);await switchTo(cookieA,A1);
  const bindingConflict=await barrier(()=>ask('binding changes during real read',cookieA,409),()=>switchTo(cookieA,A2));assert.ok(['profile-changed','binding-changed'].includes(bindingConflict.statusMessage));await switchTo(cookieA,A1);
  const beforeAlias=await ask('before alias update',cookieA);await writeFile(aliasPath,JSON.stringify([{id:100,song_name_jp:'合成テスト曲',aliases:['新的合成别名']} ]));
  const afterAlias=await ask('alias-only update remains readable',cookieA);assert.notEqual(afterAlias.release.catalogRevision,beforeAlias.release.catalogRevision);assert.equal(afterAlias.release.scoreRevision,beforeAlias.release.scoreRevision);
  const changedCatalog=await barrier(()=>ask('catalog changes during read rejected',cookieA,409),()=>writeFile(aliasPath,'[]'));assert.equal(changedCatalog.statusMessage,'catalog-changed');await ask('retry reads new catalog generation',cookieA);
  // Preserve size and mtime to exercise the actual cached legacy projection drift guard.
  execFileSync(process.env.TAIKO_PYTHON_EXECUTABLE,['-I','-c',"import os,sys;from pathlib import Path;p=Path(sys.argv[1]);s=p.stat();p.write_bytes(p.read_bytes().replace(b'Synthetic chart',b'Changed title!!'));os.utime(p,ns=(s.st_atime_ns,s.st_mtime_ns))",catalogPath],{timeout:10000,maxBuffer:4096});const drift=await ask('real song source drift rejected',cookieA,409);assert.equal(drift.statusMessage,'catalog-source-mismatch');
  await writeFile(catalogPath,catalogBytes);await ask('restored song source readable',cookieA);
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],timeout:15000});
  context=await browser.newContext({viewport:{width:375,height:812},reducedMotion:'reduce'});await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===base||u.protocol==='data:')return route.continue();blockedExternal.push(u.origin);return route.abort();});
  page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>pageErrors.push(e.message.slice(0,200)));
  await page.goto(base+'/account/login?redirect=/my',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>Boolean(document.querySelector('#__nuxt')?.__vue_app__));await page.locator('input[name=username]').fill('catalog-a');await page.locator('input[type=password]').fill(password);await page.locator('.submit-btn').click();await page.waitForURL(u=>u.pathname==='/my');await page.getByTestId('my-current-title').waitFor();
  for(const [locale,width] of [['zh',375],['ja',414]]){
   await page.setViewportSize({width,height:812});await page.goto(base+(locale==='ja'?'/ja':'')+'/my',{waitUntil:'domcontentloaded'});await page.getByTestId('my-current-title').waitFor();assert.equal(await page.getByTestId('my-current-title').textContent(),'Synthetic A1');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.getByTestId('my-binding-select').selectOption(String(A2));await until(async()=>await page.getByTestId('my-current-title').textContent()==='Synthetic A2','browser current binding A2');
   await page.getByTestId('my-binding-select').selectOption(String(A1));await until(async()=>await page.getByTestId('my-current-title').textContent()==='Synthetic A1','browser current binding A1');
   await page.screenshot({path:resolve(E,'catalog-'+locale+'-'+width+'.png')});browserCases.push({locale,width,currentBindingCorrect:true,overflow:false});
  }
  assert.deepEqual(pageErrors,[]);await verifyOutput();
  await writeFile(resolve(E,'my-taiko-catalog-acceptance.json'),JSON.stringify({status:'PASS',buildCommit:artifact.commit,host:'unmodified 0.88.3 production build, owned QA startup',databaseProof:proof,observations,browserCases,pageErrors,productionDataCopied:false,productionMutation:false},null,2));
 }finally{
  if(locker){await locker.query('UNLOCK TABLES').catch(()=>{});locker.release();}
  if(page)await writeFile(resolve(E,'last-page.json'),JSON.stringify(await page.evaluate(()=>({path:location.pathname,body:document.body.innerText.slice(0,5000)})).catch(()=>({unavailable:true}))));
  await page?.close();await context?.close();await browser?.close();await stop();await pool.end();
  await writeFile(resolve(E,'catalog-cleanup.json'),JSON.stringify({hostExited:!host,browserClosed:true,poolClosed:true,observations,browserCases,pageErrors},null,2));
 }
});
