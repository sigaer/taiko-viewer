// Real built Nuxt + fresh guarded MySQL + installed -I Publication worker.
// No runtime import hooks, fixture authority, API mocks or component harness.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {scryptSync,randomBytes,createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,open,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createReadStream} from 'node:fs';
async function fileSha(path){const h=createHash('sha256');for await(const chunk of createReadStream(path))h.update(chunk);return h.digest('hex');}
import mysql from 'mysql2/promise';
import {chromium} from 'playwright-core';
import {GOAL_TABLE_SQL} from '../server/services/goals/schema.ts';
import {GROWTH_MEASUREMENT_TABLE_SQL} from '../server/services/growth-history/schema.ts';
import {withPublicationLease} from '../server/infrastructure/taiko-publication/client.ts';
const sha=x=>createHash('sha256').update(x).digest('hex');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(task,label,ms=12000){const end=Date.now()+ms;while(Date.now()<end){if(await task())return;await pause(40);}throw new Error('Deadline: '+label);}

test('RC4 integration unmodified Nuxt SQL HTTP browser and generation isolation',{timeout:210000},async()=>{
 assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1');assert.match(process.env.TAIKO_DB_NAME,/_test$/);assert.notEqual(process.env.TAIKO_DB_PORT,'3306');
 const E=process.env.QA_EVIDENCE_DIR,root=resolve(process.env.QA_RUN_TMPDIR,'my-taiko-product'),userdata=resolve(root,'userdata');await mkdir(userdata,{recursive:true});
 const pool=mysql.createPool({host:process.env.TAIKO_DB_HOST,port:Number(process.env.TAIKO_DB_PORT),user:process.env.TAIKO_DB_USER,password:process.env.TAIKO_DB_PASSWORD,database:process.env.TAIKO_DB_NAME,connectionLimit:8});
 const [[proof]]=await pool.query('SELECT DATABASE() name,@@datadir datadir');assert.equal(proof.name,process.env.TAIKO_DB_NAME);assert.equal(resolve(proof.datadir),resolve(process.env.TAIKO_TEST_MYSQL_DATADIR));
 const catalogPath=resolve(root,'catalog.json'),catalogBytes=JSON.stringify([{id:100,song_name:'Synthetic chart',level_4:9,shelf_status:0}]);await writeFile(catalogPath,catalogBytes);await writeFile(resolve(root,'config.json'),'{}');
 const artifact=JSON.parse(await readFile(resolve(E,'integration-build.json'),'utf8'));assert.equal(artifact.status,'PASS');
 async function verifyOutput(){for(const f of artifact.files)assert.equal(await fileSha(resolve(artifact.output,f.path)),f.sha256,f.path);}
 await verifyOutput();
 for(const d of ['cache','annual','viewer-cache'])await mkdir(resolve(root,d));
 const observations=[],browserCases=[],pageErrors=[],criticalConsole=[],blockedExternal=[];let host,browser,context,page,hostPort,log,locker;
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
  host=spawn(process.execPath,[resolve(artifact.output,'server/index.mjs')],{cwd:root,env:{...env,NITRO_HOST:'127.0.0.1',NITRO_PORT:String(hostPort),...(mode==='read-model'?{NUXT_MY_TAIKO_READ_MODEL_MODE:mode,NUXT_PUBLIC_MY_TAIKO_READ_MODEL_MODE:mode}:{})},stdio:['ignore',log.fd,log.fd]});host.on('error',()=>{});
  await until(async()=>{if(host.exitCode!==null)throw new Error('Owned Nuxt startup exited');try{const r=await fetch(base+'/api/account/auth/me',{signal:AbortSignal.timeout(700)});return r.status===200;}catch{return false;}},'Nuxt loopback startup',20000);
 }
 async function stop(){if(host){const exiting=once(host,'exit');host.kill('SIGTERM');await Promise.race([exiting,pause(2000)]);if(host.exitCode===null&&host.signalCode===null){host.kill('SIGKILL');await exiting;}host=null;await until(async()=>{try{await fetch(base+'/api/account/auth/me',{signal:AbortSignal.timeout(300)});return false;}catch{return true;}},'owned listener closed',2000);}await log?.close();log=null;}
 async function http(path,{cookie='',method='GET',body,expected=200,headers={}}={}){const r=await fetch(base+path,{method,headers:{'content-type':'application/json',...(cookie?{cookie}:{}),origin:base,...headers},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});const data=await r.json();if(r.status!==expected)await writeFile(resolve(E,'unexpected-response.json'),JSON.stringify({path,status:r.status,statusMessage:data.statusMessage||data.message||data.code},null,2));assert.equal(r.status,expected,path+' expected status '+String(data.statusMessage||data.code||''));return {r,data};}
 async function ask(name,cookie,expected=200,query=''){const {r,data}=await http('/api/account/my-taiko/overview'+query,{cookie,expected});assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('etag'),null);if(expected!==200)assert.equal(data.release,undefined);else{assert.equal(data.diagnostics.physicalCurrentReads,1);assert.equal(data.diagnostics.measurements,'NOT_REQUESTED');assert.equal(data.release.calculationProfile,null);assert.equal(data.recommendation.scoreRevision,data.release.scoreRevision);assert.equal(data.release.catalogRevision,sha(await readFile(catalogPath)));assert.ok(data.release.legacyCatalogRevision.startsWith('legacy-projection-sha256:'));assert.notEqual(data.release.catalogRevision,data.release.legacyCatalogRevision);}
  observations.push({name,status:r.status,binding:data.profile?.bindingId??null,revision:data.release?.scoreRevision??null,coverage:data.growth?.coverage.scoreHistoryState??null,facts:data.growth?.totalFacts??null});return data;}
 const password='synthetic-'+randomBytes(12).toString('hex'),salt=randomBytes(16).toString('hex'),passwordHash=salt+':'+scryptSync(password,salt,64).toString('hex');
 const publication={root:userdata,repoRoot:root};
 const snapshot=(title,score,stage,day,source='wahlap')=>({_meta:{source,ts:day+'T01:00:00Z',full:true},profile:{gameCostume:{title}},songs:[{song_no:100,level:4,high_score:score,stage_cnt:stage,clear_cnt:stage,highscore_datetime:day+' 09:00:00',update_datetime:day+' 09:00:00'}]});
 const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'}),yesterday=new Date(Date.now()-86400000).toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'});
 async function publish(identity,title,score,{empty=false,history=true}={}){return withPublicationLease({...publication,identity,mode:'write'},async lease=>{const current=empty?{_meta:{source:'wahlap'},profile:{},songs:[]}:snapshot(title,score,2,today);if(history){await lease.put('history/data_'+yesterday+'_09_00_00.json',JSON.stringify(snapshot(title,800000,1,yesterday)));await lease.put('history/data_'+today+'_09_00_00.json',JSON.stringify(current));}await lease.put('current',JSON.stringify(current));return lease.publish({replaceHistory:true});});}
 async function login(username){const {r}=await http('/api/account/auth/login',{method:'POST',body:{identifier:username,password}});return r.headers.get('set-cookie').split(';')[0];}
 async function switchTo(cookie,id){await http('/api/account/bindings/current',{method:'POST',cookie,body:{bindingId:id}});}
 async function barrier(task,mutation){locker=await pool.getConnection();await locker.query('LOCK TABLES web_player_goals WRITE');const pending=task();pending.catch(()=>{});try{await until(async()=>{const [rows]=await pool.query('SHOW FULL PROCESSLIST');return rows.some(r=>String(r.Info||'').includes('FROM web_player_goals')&&String(r.State||'').toLowerCase().includes('lock'));},'real Nuxt query blocked under SH lease');await mutation();}finally{await locker.query('UNLOCK TABLES');locker.release();locker=null;}return pending;}
 try{
  // Invalid opt-in must exit before listening; no normal Annual work is invoked.
  const rejectedLog=await open(resolve(E,'nuxt-rejected-startup.log'),'wx',0o600);
  const rejected=spawn(process.execPath,[resolve(artifact.output,'server/index.mjs')],{cwd:root,env:{...env,NITRO_HOST:'127.0.0.1',NITRO_PORT:'0',TAIKO_ALLOW_TEST_DB_MUTATION:'0'},stdio:['ignore',rejectedLog.fd,rejectedLog.fd]});
  try{const [code]=await Promise.race([once(rejected,'exit'),pause(10000).then(()=>{throw new Error('Unsafe startup did not reject');})]);assert.equal(code,78);observations.push({name:'invalid owned QA opt-in rejected before listener',status:78});}finally{if(rejected.exitCode===null){rejected.kill('SIGKILL');await once(rejected,'exit');}await rejectedLog.close();}
  await start('read-model');await http('/api/account/auth/login',{method:'POST',body:{identifier:'missing',password:'synthetic'},expected:401});
  await pool.execute(GOAL_TABLE_SQL);await pool.execute(GROWTH_MEASUREMENT_TABLE_SQL);
  async function user(username){const [r]=await pool.execute('INSERT INTO web_user_accounts(username,email,password_hash,email_verified) VALUES (?,?,?,1)',[username,username+'@example.test',passwordHash]);return r.insertId;}
  async function binding(owner,id,current){const [r]=await pool.execute("INSERT INTO web_taiko_bindings(user_id,taiko_id,source,verified_title,is_current) VALUES (?,?,'wahlap','Synthetic verified',?)",[owner,id,current]);return r.insertId;}
  const A=await user('mytaiko-product-a'),B=await user('mytaiko-product-b'),U=await user('mytaiko-product-empty');
  const A1=await binding(A,'71000000001',1),A2=await binding(A,'71000000002',0),B1=await binding(B,'71000000003',1),missing=await binding(A,'71000000004',0),empty=await binding(A,'71000000005',0),corrupt=await binding(A,'71000000006',0);
  await writeFile(resolve(userdata,'71000000004data.json'),JSON.stringify(snapshot('Uncommitted legacy',100000,1,today)));
  const first=await publish('71000000001','Synthetic A1',900000);await publish('71000000002','Synthetic A2',910000);await publish('71000000003','Synthetic B',920000);await publish('71000000005','',0,{empty:true,history:false});const corruptView=await publish('71000000006','Corrupt',0);
  const cookieA=await login('mytaiko-product-a'),cookieB=await login('mytaiko-product-b'),cookieU=await login('mytaiko-product-empty');
  await http('/api/account/profile',{cookie:cookieA});
  const before=await ask('A1 authenticated product BFF',cookieA);assert.equal(before.profile.bindingId,String(A1));assert.equal(before.profile.currentTitle,'Synthetic A1');assert.equal(before.scores.highestScore,900000);assert.ok(before.growth.totalFacts>0);assert.equal(before.release.scoreRevision,`publication-v1:${first.sequence}:${first.commitId}`);assert.equal(before.growth.range.maxDays,90);assert.equal((Date.parse(before.growth.range.to)-Date.parse(before.growth.range.from))/86400000+1,90);
  await ask('anonymous 401','',401);await ask('owner binding query override denied',cookieA,400,'?bindingId='+B1);await ask('unbound controlled 400',cookieU,400);await http('/api/v1/taiko/meta',{expected:404});await http('/qa/my-taiko',{expected:404});
  await switchTo(cookieA,A2);assert.equal((await ask('A1 to A2',cookieA)).scores.highestScore,910000);await switchTo(cookieA,A1);assert.equal((await ask('A2 back A1',cookieA)).scores.highestScore,900000);assert.equal((await ask('independent account B',cookieB)).scores.highestScore,920000);assert.equal((await ask('A1 after B',cookieA)).profile.bindingId,String(A1));
  await barrier(()=>ask('switch during read discards body',cookieA,409),()=>switchTo(cookieA,A2));await switchTo(cookieA,A1);
  await barrier(()=>ask('session logout during read',cookieB,401),()=>http('/api/account/auth/logout',{method:'POST',cookie:cookieB}));
  const relogB=await login('mytaiko-product-b');await barrier(()=>ask('unbind during read discards body',relogB,409),()=>pool.execute('DELETE FROM web_taiko_bindings WHERE id=?',[B1]));
  let writer,writerDone=false;const pinned=await barrier(()=>ask('queued writer old generation coherent',cookieA),async()=>{writer=publish('71000000001','Synthetic A1 newer',940000).then(v=>{writerDone=true;return v;});await pause(150);assert.equal(writerDone,false,'Writer cannot publish while real Nuxt holds SH');});
  assert.equal(pinned.scores.highestScore,900000);assert.equal(pinned.release.scoreRevision,before.release.scoreRevision);const next=await writer;const newer=await ask('next request sees committed new generation',cookieA);assert.equal(newer.scores.highestScore,940000);assert.equal(newer.release.scoreRevision,`publication-v1:${next.sequence}:${next.commitId}`);
  await barrier(()=>ask('catalog bytes mutate mid-read rejected',cookieA,409),()=>writeFile(catalogPath,catalogBytes+'\n'));const whitespace=await ask('raw catalog revision changes projection stable',cookieA);assert.notEqual(whitespace.release.catalogRevision,newer.release.catalogRevision);assert.equal(whitespace.release.legacyCatalogRevision,newer.release.legacyCatalogRevision);
  const mutateCatalog=(a,b)=>execFileSync(process.env.TAIKO_PYTHON_EXECUTABLE,['-I','-c',"import os,sys;from pathlib import Path;p=Path(sys.argv[1]);s=p.stat();a=sys.argv[2].encode();b=sys.argv[3].encode();raw=p.read_bytes();assert len(a)==len(b) and a in raw;p.write_bytes(raw.replace(a,b));os.utime(p,ns=(s.st_atime_ns,s.st_mtime_ns))",catalogPath,a,b],{timeout:10000,maxBuffer:4096});
  mutateCatalog('Synthetic chart','Changed title!!');await ask('stale legacy catalog projection rejected',cookieA,409);mutateCatalog('Changed title!!','Synthetic chart');await ask('restored catalog recovers without fallback',cookieA);
  await switchTo(cookieA,missing);await ask('missing committed Publication',cookieA,503);await switchTo(cookieA,corrupt);
  const object=resolve(userdata,'.taiko-publications','71000000006','objects',corruptView.files.current.sha256);await writeFile(object,'corrupt');await ask('corrupt committed object controlled',cookieA,503);
  await switchTo(cookieA,empty);const unknown=await ask('no history no reliable facts unknown',cookieA);assert.equal(unknown.growth.coverage.scoreHistoryState,'unknown');assert.equal(unknown.growth.totalFacts,0);assert.equal(unknown.scores.rows,0);
  await switchTo(cookieA,A1);
  await barrier(()=>ask('owner changes during read rejected',cookieA,409),()=>pool.execute('UPDATE web_taiko_bindings SET user_id=? WHERE id=?',[B,A2]));await pool.execute('UPDATE web_taiko_bindings SET user_id=? WHERE id=?',[A,A2]);await switchTo(cookieA,A1);
  await http('/api/account/my-taiko/overview',{headers:{authorization:'Bearer synthetic-developer-key'},expected:401});
  const [[measure]]=await pool.query('SELECT COUNT(*) n FROM web_growth_measurements');assert.equal(Number(measure.n),0);const [[goals]]=await pool.query('SELECT COUNT(*) n FROM web_player_goals');assert.equal(Number(goals.n),0);
  // Full Nuxt login/page, native selector and HTTP; only external asset egress is blocked.
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],timeout:15000});
  context=await browser.newContext({viewport:{width:375,height:812},reducedMotion:'reduce'});await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===base||u.protocol==='data:')return route.continue();blockedExternal.push(u.origin);return route.abort();});
  page=await context.newPage();page.on('response',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/account/'))observations.push({name:'browser '+path,status:r.status()});});page.setDefaultTimeout(12000);page.on('pageerror',e=>pageErrors.push(e.message.slice(0,200)));page.on('console',m=>{if(m.type()==='error'&&/hydration|Unhandled|TypeError|ReferenceError|SyntaxError/.test(m.text()))criticalConsole.push(m.text().slice(0,200));});
  await page.goto(base+'/account/login?redirect=/my',{waitUntil:'domcontentloaded',timeout:15000});await page.waitForFunction(()=>Boolean(document.querySelector('#__nuxt')?.__vue_app__));await page.locator('input').nth(0).fill('mytaiko-product-a');await page.locator('input[type=password]').fill(password);await page.locator('.submit-btn').click();await page.waitForURL(url=>url.pathname==='/my');await page.getByTestId('my-current-title').waitFor();assert.equal(await page.getByTestId('my-current-title').textContent(),'Synthetic A1 newer');
  for(const width of [375,1280]){await page.setViewportSize({width,height:width===375?812:900});await page.reload({waitUntil:'domcontentloaded'});await page.getByTestId('my-current-title').waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal overflow '+width);assert.ok(await page.getByRole('link',{name:'打开推荐工具',exact:true}).isVisible());await page.screenshot({path:resolve(E,'my-taiko-'+width+'.png'),timeout:10000});browserCases.push({name:'actual Nuxt login refresh data tools and layout',width,overflow:false});}
  await page.getByTestId('my-binding-select').selectOption(String(A2));await until(async()=>await page.getByTestId('my-current-title').textContent()==='Synthetic A2','native selector A2');await page.getByTestId('my-binding-select').selectOption(String(A1));await until(async()=>await page.getByTestId('my-current-title').textContent()==='Synthetic A1 newer','native selector A1');
  await page.getByRole('button',{name:'重新获取',exact:true}).focus();assert.equal(await page.getByRole('button',{name:'重新获取',exact:true}).evaluate(el=>el===document.activeElement),true);await page.getByRole('button',{name:'重新获取',exact:true}).click();await page.getByTestId('my-current-title').waitFor();browserCases.push({name:'binding select A1 A2 A1 keyboard retry',pass:true});
  // Real response failure, no browser response mocking: choose missing binding in SQL.
  await switchTo(cookieA,missing);await page.getByRole('button',{name:'重新获取',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(await page.getByTestId('my-current-title').count(),0);await switchTo(cookieA,A1);await page.getByRole('button',{name:'重新获取',exact:true}).click();await page.getByTestId('my-current-title').waitFor();browserCases.push({name:'503 clears previous payload and retry recovers',pass:true});
  await context.clearCookies();await page.reload({waitUntil:'domcontentloaded'});assert.equal(await page.getByTestId('my-taiko-overview').count(),0);await page.locator('.my-intro .my-cta').waitFor();browserCases.push({name:'anonymous page login state',pass:true});
  const [cookieName,...cookieValue]=cookieU.split('=');await context.addCookies([{name:cookieName,value:cookieValue.join('='),url:base}]);await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('alert').waitFor();await page.getByRole('link',{name:'绑定鼓众 ID',exact:true}).waitFor();browserCases.push({name:'unbound page binding entry',pass:true});
  assert.equal(pageErrors.length,0,'No page errors');assert.equal(criticalConsole.length,0,'No critical hydration/console errors');
  await page.close();page=null;await context.close();context=null;await browser.close();browser=null;
  // Restart only this owned test listener in the default old mode; never production.
  await stop();await start('legacy');await http('/api/account/my-taiko/overview',{cookie:cookieA,expected:404});await http('/api/v1/taiko/meta',{expected:404});const legacy=await fetch(base+'/my',{headers:{cookie:cookieA},signal:AbortSignal.timeout(15000)});assert.equal(legacy.status,200);const html=await legacy.text();assert.ok(!html.includes('data-testid="my-taiko-overview"'));assert.ok(html.includes('my-links'));observations.push({name:'default legacy page and BFF off',status:200});
  const [[afterMeasure]]=await pool.query('SELECT COUNT(*) n FROM web_growth_measurements');assert.equal(Number(afterMeasure.n),0);
  await writeFile(resolve(E,'my-taiko-product-observations.json'),JSON.stringify({status:'PASS_SCOPED',host:'unmodified production Nuxt output; source-level owned-qa startup admission',databaseProof:proof,observations,browserCases,pageErrors,criticalConsole,blockedExternalOrigins:[...new Set(blockedExternal)],measurementWrites:0,goalWrites:0,developerGate:false,contractFrozen:true,productionAccess:false,publicationPython:process.env.TAIKO_PYTHON_EXECUTABLE,publicationMode:'-I -m taiko_store.bridge'},null,2)+'\n');
 }finally{
  if(page){await page.screenshot({path:resolve(E,'last-product-page.png'),timeout:5000}).catch(()=>{});await writeFile(resolve(E,'last-product-page.json'),JSON.stringify(await page.evaluate(()=>({path:location.pathname,mode:window.__NUXT__?.config?.public?.myTaikoReadModelMode,body:document.body.innerText.slice(0,7000)})).catch(()=>({unavailable:true})),null,2));}
  if(locker){await locker.query('UNLOCK TABLES').catch(()=>{});locker.release();}
  await page?.close();await context?.close();await browser?.close();await stop();await pool.end();
  await verifyOutput();await writeFile(resolve(E,'unmodified-output-proof.json'),JSON.stringify({sourceCommit:artifact.sourceCommit,matchedFiles:artifact.files.length,compiledFilesPatched:0,verifiedBeforeAndAfterStartup:true}));
  await writeFile(resolve(E,'my-taiko-product-cleanup.json'),JSON.stringify({hostExited:!host,listenerClosed:true,browserClosed:true,databasePoolClosed:true,observedHttpCases:observations.length,browserCases:browserCases.length,pageErrors,criticalConsole},null,2)+'\n');
  await writeFile(resolve(E,'my-taiko-product-partial-observations.json'),JSON.stringify({observations,browserCases},null,2)+'\n');
 }
});
