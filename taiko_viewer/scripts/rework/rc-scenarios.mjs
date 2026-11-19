// Minimal Linux RC orchestration. Runtime/DB containment is shell-sql + shell-check;
// the visual matrix reuses the existing slice G scenarios. All data is synthetic.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {open} from 'node:fs/promises';
import {readFile,writeFile,chmod} from 'node:fs/promises';
import {createServer} from 'node:https';
import {generateKeyPairSync,randomBytes,createHash} from 'node:crypto';
import {SignJWT} from 'jose';
import mysql from 'mysql2/promise';
import {writePagesFiles} from './pages-data.mjs';
import {runSweep} from './sweep-scenarios.mjs';
import {authoritativeFixture} from '../../tests/fixtures/goalAuthoritative.mjs';
const account=990881, identity='990000000000115001';
const issuer='https://127.0.0.1:35324', base='https://127.0.0.1:35323';
const connection=()=>mysql.createConnection({host:process.env.TAIKO_DB_HOST,port:Number(process.env.TAIKO_DB_PORT),user:process.env.TAIKO_DB_USER,password:process.env.TAIKO_DB_PASSWORD,database:process.env.TAIKO_DB_NAME});
async function guard(db){assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1');const [[row]]=await db.query('SELECT DATABASE() name,@@datadir dir');assert.match(row.name,/_test$/);assert.equal(row.dir.replace(/\/$/,''),process.env.TAIKO_TEST_MYSQL_DATADIR);}
export async function prepareData(data,web){
 const prepared=await writePagesFiles(data,web);
 const installed='/opt/taiko-bot/releases/0.25.3/bin/python';
 // Reuse the existing installed-worker fixture: actual CLI/SQL/publication, synthetic upstream only.
 const fixture=web+'/tests/fixtures/installed-workers/account_sync_sql_child.py';
 const launcher=data+'/python-rc';
 await writeFile(launcher,`#!/usr/bin/python3
import os,sys,subprocess
from pathlib import Path
args=sys.argv[1:]
if args[:3]==['-I','-m','taiko_bot.cli.account_sync_cli']:
 os.environ.update(QA_RUN_DIR=${JSON.stringify(process.env.QA_RUN_DIR)},QA_RUN_TMPDIR=${JSON.stringify(process.env.QA_RUN_TMPDIR)},TAIKO_ALLOW_TEST_DB_MUTATION='1')
 args=['-I',${JSON.stringify(fixture)},${JSON.stringify(data+'/sync-current-options.json')}]
if args[:3]==['-I','-m','taiko_bot.offline.growth_compute']:
 result=subprocess.run([${JSON.stringify(installed)}]+args,capture_output=True,timeout=120)
 Path(${JSON.stringify(data+'/growth-stderr.txt')}).write_bytes(result.stderr[:16384])
 sys.stdout.buffer.write(result.stdout)
 sys.exit(result.returncode)
os.execv(${JSON.stringify(installed)},[${JSON.stringify(installed)}]+args)
`,{mode:0o700});
 await chmod(launcher,0o700);
 await writeFile(data+'/songs/song_data.json',JSON.stringify(prepared.data.songs));
 // Existing installed-runtime vector supplies the Python model input (the detail-page vector has no const table).
 const vector=JSON.parse(await readFile(web+'/tests/fixtures/installedRuntimeCatalog.json','utf8'));
 const charts=Object.fromEntries(prepared.data.songs.filter(s=>s.level_4).map(s=>[s.id,{...vector.chart,id:s.id,level:4,song_name_cn:s.song_name}]));
 await writeFile(data+'/songs/rating_structured_with_ids.json',JSON.stringify({songs:charts,const_table:vector.const_table}));
 await writeFile(data+'/songs/song_data_raw.json',JSON.stringify(prepared.data.songs));
 for(const name of ['song_alias','song_score','taiko_goku_onis','taiko_goku_all_levels_stream'])await writeFile(data+'/songs/'+name+'.json','[]');
 const songs=Array.from({length:25},(_,i)=>i+1).map(song_no=>({song_no,level:4,high_score:900000,good_cnt:song_no<=20?520:450,ok_cnt:10,ng_cnt:1,combo_cnt:100,stage_cnt:1,clear_cnt:1,full_combo_cnt:0,dondaful_combo_cnt:0,best_score_rank:4,update_datetime:'2026-11-18 10:00:00',highscore_datetime:'2026-11-18 10:00:00'}));
 await writeFile(data+'/userdata/'+identity+'data.json',JSON.stringify(authoritativeFixture({profile:{userid:identity,mydon_name:'RC synthetic'},songs},identity)));
 await writeFile(data+'/sync-current-options.json',JSON.stringify({root:data,userId:account,taikoId:identity,payload:{profile:{userid:identity,mydon_name:'RC synthetic',gameCostume:{title:'RC synthetic',titleplate_id:2}},songs,achievement:{gold:0},dojo:{}}}));
 await writeFile(data+'/config.json',JSON.stringify({cookie:'synthetic-public-cookie'}));
 prepared.env={...prepared.env,TAIKO_PYTHON_EXECUTABLE:launcher,NUXT_SONG_DATA_PATH:data+'/song_data.json',NUXT_RATING_STRUCT_PATH:data+'/rating.json',NUXT_BRANCH_AUDIO_MANIFEST_PATH:data+'/branch_audio_manifest.json',NUXT_TAIKO_API_BASE:prepared.upstream.base,NUXT_TAIKO_TITLE_API_BASE:prepared.upstream.base};
 return prepared;
}
export async function seed(db){
 await guard(db);
 await db.execute("INSERT INTO forum_sections(slug,name,description,icon,accent_color,sort_order) VALUES ('rc-test','RC synthetic','Synthetic QA','chat','#123456',1)");
 for(const sql of (await import('../../server/services/oidc/schema.ts')).OIDC_TABLES)await db.execute(sql);
 // Same minimal source table as the existing SQL fixtures; no production migrations.
 await db.execute(`CREATE TABLE IF NOT EXISTS taiko_manual_accounts (taiko_id VARCHAR(25) PRIMARY KEY,nickname VARCHAR(100),bot_identity_key VARCHAR(128),created_by VARCHAR(32),created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
 await db.execute("INSERT INTO web_taiko_bindings(user_id,taiko_id,source,is_current,verified_title) VALUES (?,?,'wahlap',1,'RC synthetic')",[account,identity]);
 await db.execute(`INSERT INTO web_external_identities(user_id,provider_id,issuer,subject,remote_link_operation_id) VALUES (?,'mock',?,'rc-subject',?)`,[account,issuer,randomBytes(32).toString('hex')]);
}
export async function startProvider(tls){
 const keys=generateKeyPairSync('rsa',{modulusLength:2048});
 const jwk={...keys.publicKey.export({format:'jwk'}),kid:'rc-key',alg:'RS256',use:'sig'};
 const codes=new Map();
 const server=createServer(tls,async(req,res)=>{
  try{
   const url=new URL(req.url,issuer);const json=body=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(body));};
   if(url.pathname==='/.well-known/openid-configuration')return json({issuer,authorization_endpoint:issuer+'/authorize',token_endpoint:issuer+'/token',jwks_uri:issuer+'/jwks',response_types_supported:['code'],subject_types_supported:['public'],id_token_signing_alg_values_supported:['RS256'],code_challenge_methods_supported:['S256'],token_endpoint_auth_methods_supported:['none']});
   if(url.pathname==='/jwks')return json({keys:[jwk]});
   if(url.pathname==='/authorize'){
    const code=randomBytes(16).toString('hex');codes.set(code,Object.fromEntries(url.searchParams));
    const back=new URL(url.searchParams.get('redirect_uri'));back.searchParams.set('state',url.searchParams.get('state'));back.searchParams.set('code',code);
    res.writeHead(302,{location:back.href});return res.end();
   }
   if(url.pathname==='/token'){
    let body='';for await(const chunk of req){body+=chunk;assert.ok(body.length<8192);}
    const params=new URLSearchParams(body),code=codes.get(params.get('code'));assert.ok(code);codes.delete(params.get('code'));
    assert.equal(createHash('sha256').update(params.get('code_verifier')).digest('base64url'),code.code_challenge);
    const id_token=await new SignJWT({nonce:code.nonce,name:'RC synthetic'}).setProtectedHeader({alg:'RS256',kid:'rc-key'}).setSubject('rc-subject').setIssuer(issuer).setAudience('viewer-rc').setIssuedAt().setExpirationTime('2m').sign(keys.privateKey);
    return json({access_token:randomBytes(20).toString('hex'),token_type:'Bearer',expires_in:120,id_token});
   }
   res.writeHead(404);res.end();
  }catch{res.writeHead(400);res.end('{}');}
 });
 await new Promise(r=>server.listen(35324,'127.0.0.1',r));
 return {env:{NUXT_OIDC_ENABLED:'1',NUXT_OIDC_PROVIDERS_JSON:JSON.stringify([{id:'mock',label:'Synthetic OIDC',enabled:true,issuer,clientId:'viewer-rc',redirectUri:base+'/api/account/oidc/mock/callback'}])},close:async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));}};
}
export async function run({browser,base,out,password,prepared,coreOnly=false}){
 const results=[];const db=await connection();await guard(db);
 const context=await browser.newContext({viewport:{width:390,height:844},ignoreHTTPSErrors:true,reducedMotion:'reduce'});
 const page=await context.newPage();page.setDefaultTimeout(20000);
 const faults=[];page.on('pageerror',e=>faults.push(e.message.slice(0,200)));
 await context.route('**/*',r=>[base,issuer].includes(new URL(r.request().url()).origin)?r.continue():r.abort());
 const check=async(name,task)=>{try{await task();results.push({name,pass:true});console.log('PASS '+name);}catch(e){results.push({name,pass:false,error:String(e.message).slice(0,350)});console.log('FAIL '+name+': '+String(e.message).slice(0,220));await page.screenshot({path:out+'/FAILED-'+name.replace(/[^a-z0-9-]/gi,'-')+'.png'}).catch(()=>{});}};
 const ask=async(method,path,body,status=200)=>{const r=await context.request.fetch(base+path,{method,...(body?{data:body}:{}),headers:{Origin:base},timeout:30000});assert.equal(r.status(),status,method+' '+path+' HTTP '+r.status());return r.json();};
 const login=()=>ask('POST','/api/account/auth/login',{identifier:'stage1-synthetic',password});
 try{
  await check('390-login-settings-6-real-roundtrips',async()=>{
   for(const lang of ['zh','ja'])for(let i=0;i<3;i++){
    await ask('POST','/api/account/auth/logout');
    const prefix=lang==='ja'?'/ja':'';
    await page.goto(base+prefix+'/account/login?redirect='+encodeURIComponent(prefix+'/settings'),{waitUntil:'networkidle'});
    await page.locator('#login-identifier').fill('stage1-synthetic');await page.locator('#login-password').fill(password);
    await page.locator('form .submit-btn').click();await page.waitForURL(base+prefix+'/settings',{timeout:20000});
    assert.equal((await ask('GET','/api/account/auth/me')).user.id,account);
   }
   const session=(await context.cookies()).find(c=>c.name==='stv_session');assert.ok(session.secure&&session.httpOnly&&session.sameSite==='Lax');
  });
  await check('real-logout-menu-and-login-error',async()=>{
   await page.setViewportSize({width:1440,height:900});await page.goto(base+'/about',{waitUntil:'networkidle'});
   await page.locator('[data-account-menu]').click();await page.getByRole('menuitem',{name:'退出登录',exact:true}).click();
   await page.waitForURL('**/account/login');assert.equal((await ask('GET','/api/account/auth/me')).authenticated,false);
   await ask('POST','/api/account/auth/login',{identifier:'stage1-synthetic',password:'invalid-'+randomBytes(4).toString('hex')},401);
   await login();
  });
  await check('OIDC-TLS-PKCE-callback-real-session',async()=>{
   await ask('POST','/api/account/auth/logout');
   const start=await ask('POST','/api/account/oidc/mock/start',{purpose:'login',redirect:'/settings',locale:'zh'});
   await page.goto(start.authorizationUrl,{waitUntil:'networkidle'});await page.waitForURL(base+'/settings');
   assert.equal((await ask('GET','/api/account/auth/me')).user.id,account);
   const [[used]]=await db.query('SELECT COUNT(*) n FROM web_oidc_transactions WHERE consumed_at IS NOT NULL');assert.ok(used.n>0);
  });
  await login();
  await check('goal-real-select-replace-cancel',async()=>{
   const overview=()=>ask('GET','/api/account/growth/overview');let state=await overview();assert.ok(state.todayPlan?.items?.length);
   const item=state.todayPlan.items.find(item=>item.goalOptions?.length);assert.ok(item,'actionable recommendation from existing model fixture');
   const body={profileId:state.profileId,scoreRevision:state.scoreRevision,expectedActiveGoalId:null,songId:item.songId,difficultyType:item.difficultyType||item.level,goalType:item.goalOptions[0]};
   await writeFile(out+'/goal-input.json',JSON.stringify(body));
   const a=await ask('POST','/api/account/growth/goal',body);assert.ok(a.activeGoal);
   state=await overview();assert.equal(state.activeGoal.id,a.activeGoal.id);
   await ask('POST','/api/account/growth/goal/evaluate-current',{profileId:state.profileId});
   const replacement=state.todayPlan.items.find(item=>item.songId!==body.songId&&item.goalOptions?.length);assert.ok(replacement);
   const b=await ask('POST','/api/account/growth/goal',{...body,songId:replacement.songId,difficultyType:replacement.difficultyType,goalType:replacement.goalOptions[0],expectedActiveGoalId:a.activeGoal.id});assert.notEqual(b.activeGoal.id,a.activeGoal.id);
   await ask('DELETE','/api/account/growth/goal',{profileId:state.profileId,expectedActiveGoalId:b.activeGoal.id});assert.equal((await overview()).activeGoal,null);
   const [[history]]=await db.query("SELECT COUNT(*) n FROM web_player_goals WHERE user_id=? AND status='cancelled'",[account]);assert.equal(history.n,2);
  });
  await check('scores-real-read-update-lock',async()=>{
   const list=await ask('GET','/api/account/songs');assert.equal(list.total,25);
   await ask('POST','/api/account/songs/lock',{songNo:1,level:4,locked:true});
   const [[lock]]=await db.query('SELECT is_locked FROM web_song_locks WHERE user_id=? AND song_no=1',[account]);assert.equal(lock.is_locked,1);
   await ask('POST','/api/account/songs/update',{songNo:1,level:4,values:{high_score:910000}});
   assert.equal((await ask('GET','/api/account/songs')).items.find(s=>s.songNo===1).highScore,910000);
   await page.goto(base+'/account/songs',{waitUntil:'networkidle'});await page.locator('.sl-table tr.sr').first().waitFor();
  });
  await check('scores-real-visual-8-states',async()=>{
   for(const lang of ['zh','ja'])for(const theme of ['light','dark'])for(const width of [1440,390]) {
    await context.addCookies([{name:'taiko_theme',value:theme,url:base},{name:'viewer_locale',value:lang,url:base}]);
    await page.setViewportSize({width,height:width===390?844:900});
    await page.goto(base+(lang==='ja'?'/ja':'')+'/account/songs',{waitUntil:'networkidle'});
    await page.locator('.sl-table tr.sr').first().waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),theme);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:out+`/acceptance-scores-${width}-${lang}-${theme}.png`,fullPage:true});
   }
   await context.addCookies([{name:'viewer_locale',value:'zh',url:base}]);
  });
  await check('sync-real-overview-submit',async()=>{
   const overview=await ask('GET','/api/account/sync/targets');assert.ok(overview.currentBinding);
   await page.goto(base+'/account/sync',{waitUntil:'networkidle'});
   const sync=await ask('POST','/api/account/sync',{profileId:String(overview.currentBinding.id),targetIds:['sakura-bot']});assert.ok(sync.log);
   const [[receipt]]=await db.query('SELECT COUNT(*) n FROM web_data_sync_receipts WHERE user_id=?',[account]);assert.equal(receipt.n,1);
  });
  await check('community-real-thread-reply-like-notification',async()=>{
   const [[before]]=await db.query('SELECT COUNT(*) n FROM forum_threads');
   const sections=await ask('GET','/api/forum/sections');const section=(sections.items||sections.sections||sections)[0];assert.ok(section);
   const thread=await ask('POST','/api/forum/threads',{sectionSlug:section.slug,threadType:'discussion',title:'RC synthetic integration',songId:1,difficultyType:4,contentBlocks:[{type:'paragraph',text:'RC synthetic body <script>window.__rcXss=1</script>'}]});
   const id=thread.id||thread.thread?.id;assert.ok(id);
   await page.setViewportSize({width:390,height:844});await page.goto(base+'/forum/thread/'+id,{waitUntil:'networkidle'});
   await page.locator('.crb__field').fill('RC real UI reply');const reply=page.waitForResponse(r=>r.url().endsWith('/replies')&&r.request().method()==='POST');
   await page.locator('.crb__foot button.rw-btn--primary').click();assert.equal((await reply).status(),200);
   await page.getByText('RC real UI reply',{exact:true}).waitFor();await page.reload({waitUntil:'networkidle'});await page.getByText('RC real UI reply',{exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>window.__rcXss),undefined);
   await page.screenshot({path:out+'/acceptance-community-390-real.png',fullPage:true});
   const liked=await ask('POST',`/api/forum/threads/${id}/like`);assert.equal(liked.liked,true);
   await ask('GET','/api/forum/notifications');
   const [[after]]=await db.query('SELECT COUNT(*) n FROM forum_threads');assert.equal(after.n-before.n,1);
   await db.execute('DELETE FROM forum_threads WHERE id=?',[id]);const [[clean]]=await db.query('SELECT COUNT(*) n FROM forum_threads');assert.equal(clean.n,before.n);
  });
  await check('PWA-production-manifest-sw',async()=>{
   const manifest=await context.request.get(base+'/manifest.webmanifest');assert.equal(manifest.status(),200);assert.ok((await manifest.json()).icons.length);
   const sw=await context.request.get(base+'/sw.js');assert.equal(sw.status(),200);const source=await sw.text();assert.ok(!source.includes('/_ds/'));assert.ok(!source.includes('url:"/api/'));
   await page.goto(base+'/settings',{waitUntil:'networkidle'});assert.ok(await page.locator('meta[name=theme-color]').getAttribute('content'));
   assert.equal((await context.request.get(base+'/_ds/tokens')).status(),404,'normal production output excludes samples');
   const cache=await page.evaluate(()=>Promise.race([
    (async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;
     const names=await caches.keys(),urls=[];
     for(const name of names){for(const r of await (await caches.open(name)).keys())urls.push(new URL(r.url).pathname);}
     return {names,urls};})(),new Promise((_,reject)=>setTimeout(()=>reject(Error('service worker activation deadline')),15000))]));
   assert.ok(cache.names.length);assert.ok(cache.urls.length>=3);assert.ok(cache.urls.every(url=>!url.startsWith('/api/')&&!url.includes('_payload')&&!url.endsWith('.html')&&!url.startsWith('/account/')));
   await writeFile(out+'/pwa-runtime.json',JSON.stringify(cache,null,2));
  });
 }finally{await page.close();await context.close();await db.end();}
 // Existing slice G matrix; intercepted states remain explicitly labelled in sweep.json.
 const sweep=coreOnly?{results:[]}:await runSweep({browser,base,out,prepared,only:'home-guest,songs,song-detail,account-songs,forum-thread,account-login,settings,about'});
 results.push(...sweep.results);
 await writeFile(out+'/rc-result.json',JSON.stringify({results,faults,realDevice:'not-run; nonblocking per owner',productionAccess:false},null,2));
 await writeFile(out+'/growth-stderr.txt',await readFile(process.env.QA_RUN_TMPDIR+'/manual-source-sql-rc/growth-stderr.txt').catch(()=>''));
 return {results};
}

export async function runScope({web,out,base}) {
 const log=await open(out+'/scope.log','w');
 const child=spawn(process.execPath,[web+'/scripts/ds/browser-check.mjs','--fixture-covers','--base',base,'--out',out+'/scope','--browser','/root/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell'],{cwd:web,env:process.env,stdio:['ignore',log.fd,log.fd]});
 await log.close();let timer;
 try {
  const code=await new Promise((resolve,reject)=>{timer=setTimeout(()=>child.kill('SIGKILL'),300000);child.once('error',reject);child.once('close',resolve);});
  const report=JSON.parse(await readFile(out+'/scope/browser-check.json','utf8'));
  return {results:[...report.results.map(r=>({name:r.name,pass:r.ok,error:r.ok?undefined:r.detail})),{name:'scope-process-exit',pass:code===0}]};
 } finally {clearTimeout(timer);if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');}
}
