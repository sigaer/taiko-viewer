// Production Nitro smoke, owned test DB and synthetic data only. Invoke through shell-sql.mjs --check=redesign-v2.
import assert from 'node:assert/strict';
import {mkdir,writeFile,realpath,open} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import mysql from 'mysql2/promise';
import {chromium} from 'playwright-core';
import {writeDetailFiles} from './detail-data.mjs';
import {CREATE_FORUM_TABLES,FORUM_SCHEMA_MIGRATIONS} from '../../server/utils/forum-schema-definition.ts';
import {ACCOUNT_TITLE_TABLE_SQL} from '../../server/services/account-titles/schema.ts';
const web=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const output=process.argv[2], out=process.env.QA_EVIDENCE_DIR;
assert.ok(output?.startsWith('/var/tmp/'));
assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1');
const data=resolve(process.env.QA_RUN_TMPDIR,'redesign-v2');
await mkdir(data,{recursive:true});
for(const dir of ['userdata','cache','annual','viewer-cache','songs'])await mkdir(resolve(data,dir),{recursive:true});
await writeFile(resolve(data,'config.json'),'{}');
await writeDetailFiles(data);
await writeFile(resolve(data,'songs/song_alias.json'),JSON.stringify([{id:1,aliases:['v2alias']} ]));
const db=await mysql.createConnection({host:process.env.TAIKO_DB_HOST,port:Number(process.env.TAIKO_DB_PORT),user:process.env.TAIKO_DB_USER,password:process.env.TAIKO_DB_PASSWORD,database:process.env.TAIKO_DB_NAME});
const session=randomBytes(32).toString('hex');
try{
 const [[proof]]=await db.query('SELECT DATABASE() name,@@datadir dir');
 assert.match(proof.name,/_test$/);
 assert.equal(await realpath(proof.dir),await realpath(process.env.TAIKO_TEST_MYSQL_DATADIR));
 for(const sql of [...CREATE_FORUM_TABLES,...FORUM_SCHEMA_MIGRATIONS,ACCOUNT_TITLE_TABLE_SQL]){
  try{await db.execute(sql);}catch(error){if(!['ER_DUP_FIELDNAME','ER_DUP_KEYNAME'].includes(error.code))throw error;}
 }
 await db.execute("INSERT INTO forum_sections(slug,name,description,icon,accent_color,sort_order) VALUES ('general','测试社区','QA','chat','#123456',0)");
 await db.execute("INSERT INTO web_user_accounts(id,username,email,password_hash,email_verified) VALUES (990881,'v2-review','v2@example.test','synthetic-only',1)");
 await db.execute("INSERT INTO forum_user_profiles(user_id,role) VALUES (990881,'user')");
 await db.execute('INSERT INTO web_user_sessions(session_token,user_id,expires_at) VALUES (?,990881,DATE_ADD(NOW(),INTERVAL 1 DAY))',[session]);
}finally{await db.end();}
const port=35325,base=`http://127.0.0.1:${port}`;
const env={...process.env,NODE_ENV:'production',NODE_OPTIONS:`--max-old-space-size=512 --import ${web}/scripts/ds/no-egress.mjs`,NITRO_HOST:'127.0.0.1',NITRO_PORT:String(port),NUXT_ANNUAL_STARTUP_MODE:'owned-qa',NUXT_REPO_ROOT:data,NUXT_USERDATA_DIR:resolve(data,'userdata'),NUXT_TAIKO_CONFIG_PATH:resolve(data,'config.json'),NUXT_ACCOUNT_CACHE_DIR:resolve(data,'cache'),NUXT_ANNUAL_CACHE_DIR:resolve(data,'annual'),NUXT_VIEWER_CACHE_DIR:resolve(data,'viewer-cache'),NUXT_SONG_DATA_PATH:resolve(data,'song_data.json'),NUXT_RATING_STRUCT_PATH:resolve(data,'rating.json'),NUXT_BRANCH_AUDIO_MANIFEST_PATH:resolve(data,'branch_audio_manifest.json'),TAIKO_RUNTIME_ENV_FILE:resolve(data,'absent.env'),NUXT_PUBLIC_GOOGLE_ANALYTICS_ID:'',NUXT_TAIKO_API_BASE:'http://127.0.0.1:1',NUXT_TAIKO_TITLE_API_BASE:'http://127.0.0.1:1',NUXT_TAIKO_ADMIN_API_BASE:'http://127.0.0.1:1',NUXT_VIEWER_ACCESS_LOG_PATH:resolve(data,'access.log')};
for(const prefix of ['NUXT_DB_','NUXT_BOT_DB_'])for(const suffix of ['HOST','PORT','USER','PASSWORD','NAME'])env[prefix+suffix]=process.env['TAIKO_DB_'+suffix];
const log=await open(resolve(out,'redesign-nitro.log'),'w');
const server=spawn(process.execPath,[resolve(output,'server/index.mjs')],{cwd:data,env,stdio:['ignore',log.fd,log.fd]});
await log.close();
let browser;
const report={kind:'production Nitro + actual session/HTTP/private SQL; synthetic catalog',checks:[],productionConnections:0};
const timer=setTimeout(()=>{report.timedOut=true;browser?.close().catch(()=>{});server.kill('SIGTERM');},600000);
try{
 let ready=false;
 for(let i=0;i<150&&!ready;i++){
  assert.equal(server.exitCode,null,'Nitro exited');
  try{ready=(await fetch(base+'/api/account/auth/me',{signal:AbortSignal.timeout(1000)})).ok;}catch{}
  if(!ready)await new Promise(r=>setTimeout(r,100));
 }
 assert.ok(ready,'Nitro ready');
 const get=async(path)=>{const res=await fetch(base+path,{signal:AbortSignal.timeout(10000)});assert.equal(res.status,200,path);return res.json();};
 const aliases=await get('/api/content/songs?view=list&keyword=v2alias');
 assert.equal(aliases.total,1);assert.equal(aliases.songs[0].matchedAlias,'v2alias');
 const ranged=await get('/api/content/v2-constants?dimension=handspeed&min=12&max=13&pageSize=200');
 assert.ok(ranged.total>0);assert.ok(ranged.items.every(row=>row.handspeed>=12&&row.handspeed<=13));
 const aliasRange=await get('/api/content/v2-constants?keyword=v2alias');
 assert.ok(aliasRange.items.length>0);assert.ok(aliasRange.items.every(row=>row.id===1));
 report.checks.push({name:'real alias and dimension-range HTTP',pass:true});
 browser=await chromium.launch({headless:true,executablePath:'/root/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell'});
 for(const [width,lang,theme] of (process.argv.includes('--auth-only')?[]:[[375,'zh','light'],[375,'ja','dark'],[820,'zh','dark'],[1440,'zh','light'],[1440,'ja','dark']])){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  const page=await context.newPage(),faults=[];
  page.setDefaultTimeout(15000);page.on('pageerror',e=>faults.push(e.message.slice(0,300)));
  try{
   await context.addCookies([{name:'taiko_theme',value:theme,url:base},{name:'viewer_locale',value:lang,url:base}]);
   await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
   const prefix=lang==='ja'?'/ja':'';
   for(const path of ['/','/songs','/songs/1','/songs/constants?dimension=handspeed&min=12&max=13','/forum','/more']){
    const response=await page.goto(base+prefix+path,{waitUntil:'networkidle',timeout:45000});
    assert.equal(response.status(),200,path);
    await page.locator('#viewer-main').waitFor();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow: ${width} ${path}`);
    assert.equal(faults.length,0,`page errors: ${faults.join(';')}`);
    if(path==='/')await page.screenshot({path:resolve(out,`v2-home-${width}-${lang}-${theme}.png`)});
    if(path==='/songs/1')await page.screenshot({path:resolve(out,`v2-detail-${width}-${lang}-${theme}.png`)});
   }
   await page.locator('.search-trigger').click();
   await page.locator('dialog[open] input').fill('v2alias');
   await page.locator('dialog[open] [role=option]').first().waitFor();
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('dialog[open]').count(),0);
   report.checks.push({name:'responsive routes/search',width,lang,theme,pass:true});
  }catch(error){await page.screenshot({path:resolve(out,`v2-failure-${width}.png`)}).catch(()=>{});throw error;}
  finally{await page.close();await context.close();}
 }
 const context=await browser.newContext({viewport:{width:375,height:900},reducedMotion:'reduce'});
 const page=await context.newPage(),faults=[];
 page.setDefaultTimeout(15000);page.on('pageerror',e=>faults.push(e.message.slice(0,300)));
 try{
  await context.addCookies([{name:'stv_session',value:session,url:base},{name:'viewer_locale',value:'zh',url:base}]);
  await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
  const post=async(path,payload)=>{
   const response=await context.request.post(base+path,{data:payload,timeout:15000});
   assert.equal(response.status(),200,path);return response.json();
  };
  const thread=await post('/api/forum/threads',{sectionSlug:'general',threadType:'discussion',title:'V2 browser acceptance',contentBlocks:[{type:'paragraph',text:'Original review text'}]});
  await page.goto(base+`/forum/thread/${thread.id}`,{waitUntil:'networkidle'});
  await page.getByRole('link',{name:'编辑',exact:true}).click();
  await page.locator('.cbe__text').first().fill('Edited through the actual browser');
  await page.getByRole('button',{name:'保存',exact:true}).click();
  await page.waitForURL('**/forum/thread/'+thread.id);
  await page.getByText('Edited through the actual browser',{exact:true}).waitFor();
  await page.locator('.crb__field').fill('Reply draft survives reload');
  await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.locator('.crb__field').inputValue(),'Reply draft survives reload');
  await page.locator('.crb__field').focus();
  await page.locator('.crb__send').click();
  await page.locator('.cr__list').getByText('Reply draft survives reload',{exact:true}).waitFor();
  assert.equal(await page.locator('.crb__field').inputValue(),'');
  await page.reload({waitUntil:'networkidle'});
  await page.locator('.cr__list').getByText('Reply draft survives reload',{exact:true}).waitFor();
  assert.equal(await page.locator('.crb__field').inputValue(),'');
  await page.screenshot({path:resolve(out,'v2-authenticated-thread.png')});
  await page.locator('.thread-actions').getByRole('button',{name:'删除',exact:true}).click();
  await page.locator('.el-message-box').getByRole('button',{name:'删除',exact:true}).click();
  await page.waitForURL('**/forum/me');
  const removed=await context.request.get(base+`/api/forum/threads/${thread.id}`);
  assert.equal(removed.status(),404);
  assert.equal(faults.length,0,`authenticated page errors: ${faults.join(';')}`);
  report.checks.push({name:'actual authenticated edit, draft reload, reply immediate/reload, delete UI and persisted 404',pass:true});
 }finally{await page.close();await context.close();}
 report.pass=true;
}catch(error){report.pass=false;report.error=String(error.message).slice(0,1000);process.exitCode=1;}
finally{
 clearTimeout(timer);await browser?.close();
 const exited=new Promise(r=>server.once('close',r));
 if(server.exitCode===null){server.kill('SIGTERM');const kill=setTimeout(()=>server.kill('SIGKILL'),5000);await exited;clearTimeout(kill);}
 report.serverExited=server.exitCode!==null||server.signalCode!==null;
 await writeFile(resolve(out,'redesign-v2-result.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}
