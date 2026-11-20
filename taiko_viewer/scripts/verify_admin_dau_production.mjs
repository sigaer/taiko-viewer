// Authorized post-release smoke. Only a disposable account, its own session and
// its browser visit are created; finally removes those exact rows.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import mysql from 'mysql2/promise';
import {chromium} from 'playwright-core';
import {visitKey} from '../server/services/user-activity/visit-recorder.ts';
import {activityDayKey} from '../server/services/user-activity/daily-activity.ts';
import {readDailyActivityStats} from '../server/services/user-activity/activity-stats.ts';

assert.equal(process.env.TAIKO_ALLOW_DAU_PRODUCTION_SMOKE,'1','Explicit online smoke opt-in required');
const expected=process.env.TAIKO_DAU_EXPECTED_DATABASE;
assert.ok(expected&&!expected.endsWith('_test'),'Explicit production database expectation required');
const base='https://viewer.sakura-bot.cn';
const version=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;
const e=process.env,option=(key,fallback)=>e['NUXT_'+key]||e['TAIKO_'+key]||fallback;
const db=await mysql.createPool({host:option('DB_HOST','127.0.0.1'),port:Number(option('DB_PORT',3306)),user:option('DB_USER'),password:option('DB_PASSWORD'),database:option('DB_NAME'),connectionLimit:2,connectTimeout:8000});
const report={version,result:'FAIL',checks:[]};
let browser,context,page,userId=0,username='',visitorKey='',day='';
try{
 const [[identity]]=await db.query('SELECT DATABASE() name');assert.equal(identity.name,expected);
 const html=await (await fetch(base+'/more',{signal:AbortSignal.timeout(20000)})).text();
 assert.ok(html.includes('v'+version),'Release must be online before smoke mutations');
 const tag=randomBytes(8).toString('hex');username='dau_smoke_'+tag;
 const [account]=await db.execute('INSERT INTO web_user_accounts(username,email,password_hash,email_verified) VALUES (?,?,?,1)',[username,username+'@example.invalid','disabled-dau-smoke']);
 userId=Number(account.insertId);
 const token=randomBytes(32).toString('hex');
 await db.execute('INSERT INTO web_user_sessions(session_token,user_id,expires_at) VALUES (?,?,DATE_ADD(NOW(),INTERVAL 10 MINUTE))',[token,userId]);
 const [[state]]=await db.query('SELECT state_json FROM web_admin_ingest_state WHERE source_key=?',['viewer_access_v2']);
 const salt=JSON.parse(state.state_json).salt;assert.ok(salt);
 const device=randomUUID();visitorKey=visitKey(salt,'device',device);day=activityDayKey();
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-blink-features=AutomationControlled']});
 context=await browser.newContext({viewport:{width:1440,height:1000},userAgent:`Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} Safari/537.36`});
 await context.addInitScript(d=>localStorage.setItem('tv_device_id',d),device);
 page=await context.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(30000);
 const pageErrors=[];page.on('pageerror',error=>{if(pageErrors.length<10)pageErrors.push(error.message.slice(0,160));});
 const anonymous=page.waitForResponse(r=>r.url()===base+'/api/metrics/visit'&&r.request().method()==='POST',{timeout:30000});
 await page.goto(base+'/about',{waitUntil:'domcontentloaded'});
 assert.equal(await page.evaluate(()=>navigator.webdriver),false,'Normal browser qualification is exercised');
 assert.equal((await anonymous).status(),204);
 await page.waitForFunction(()=>Boolean(localStorage.getItem('tv_visit_day')));
 assert.equal(await page.evaluate(()=>localStorage.getItem('tv_device_id')),device);
 const ownVisitor=async()=>(await db.query('SELECT user_id,is_suspect FROM web_daily_visitors WHERE day=? AND visitor_key=?',[day,visitorKey]))[0];
 let rows=await ownVisitor();assert.equal(rows.length,1);assert.equal(rows[0].user_id,null);assert.equal(Number(rows[0].is_suspect),0);
 report.checks.push('real browser qualification and anonymous persistence');
 // Replay the same valid device through the actual same-origin endpoint.
 const repeated=await page.evaluate(async d=>(await fetch('/api/metrics/visit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({d})})).status,device);
 assert.equal(repeated,204);assert.equal((await ownVisitor()).length,1);
 await context.addCookies([{name:'stv_session',value:token,domain:'viewer.sakura-bot.cn',path:'/',httpOnly:true,secure:true,sameSite:'Lax'}]);
 const linked=page.waitForResponse(r=>r.url()===base+'/api/metrics/visit'&&r.request().method()==='POST',{timeout:30000});
 await page.reload({waitUntil:'domcontentloaded'});assert.equal((await linked).status(),204);
 await page.waitForFunction(()=>localStorage.getItem('tv_visit_day')?.endsWith(':u'));
 rows=await ownVisitor();assert.equal(rows.length,1);assert.equal(Number(rows[0].user_id),userId);
 const me=await context.request.get(base+'/api/account/auth/me',{timeout:20000});assert.equal(me.status(),200);
 const payload=await me.json();assert.equal(payload.authenticated,true);assert.equal(Number(payload.user.id),userId);
 // The account hook is asynchronous; wait only for this owned record.
 for(let i=0;i<30;i++){
  const [[n]]=await db.query('SELECT COUNT(*) total FROM web_user_daily_activity WHERE day=? AND user_id=?',[day,userId]);
  if(Number(n.total)===1)break;
  if(i===29)assert.fail('authenticated request did not record daily activity');
  await new Promise(r=>setTimeout(r,100));
 }
 const [[merged]]=await db.query(`SELECT COUNT(DISTINCT ident) total FROM (
   SELECT CONCAT('u',user_id) ident FROM web_user_daily_activity WHERE day=? AND user_id=?
   UNION ALL SELECT IF(user_id IS NULL,CONCAT('d',visitor_key),CONCAT('u',user_id)) ident
   FROM web_daily_visitors WHERE day=? AND visitor_key=? AND is_suspect=0) activity`,[day,userId,day,visitorKey]);
 assert.equal(Number(merged.total),1,'anonymous + linked device + account counts once');
 report.checks.push('session authentication, account activity, device reattribution and identity union');
 const invalid=await page.evaluate(async()=>(await fetch('/api/metrics/visit',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status);assert.equal(invalid,204);
 const protectedDashboard=await fetch(base+'/api/admin/dashboard',{signal:AbortSignal.timeout(20000)});assert.equal(protectedDashboard.status,401);
 assert.equal(pageErrors.length,0,pageErrors.join('; '));
 await page.screenshot({path:process.env.QA_EVIDENCE_DIR+'/dau-online-about.png'});
 report.checks.push('invalid visit ignored, dashboard authorization preserved, browser has no runtime errors');
 report.result='PASS';
}finally{
 await page?.close().catch(()=>{});await context?.close().catch(()=>{});await browser?.close().catch(()=>{});
 try{
  if(visitorKey)await db.execute('DELETE FROM web_daily_visitors WHERE visitor_key=? AND (user_id IS NULL OR user_id=?)',[visitorKey,userId]);
  if(userId){
   await db.execute('DELETE FROM web_user_daily_activity WHERE user_id=?',[userId]);
   await db.execute('DELETE FROM web_user_sessions WHERE user_id=?',[userId]);
   await db.execute('DELETE FROM web_user_accounts WHERE id=? AND username=?',[userId,username]);
   const [[left]]=await db.query('SELECT (SELECT COUNT(*) FROM web_user_accounts WHERE id=?) + (SELECT COUNT(*) FROM web_user_daily_activity WHERE user_id=?) + (SELECT COUNT(*) FROM web_daily_visitors WHERE visitor_key=?) total',[userId,userId,visitorKey]);
   assert.equal(Number(left.total),0,'all owned smoke records removed');
  }
  report.ownedDataRemoved=true;
  const stats=await readDailyActivityStats(db);
  report.liveActivity=stats?{since:stats.since,today:stats.dauToday,loggedIn:stats.dauLoggedIn,anonymous:stats.dauAnonymous}:null;
 }catch(error){
  report.result='FAIL';report.ownedDataRemoved=false;throw error;
 }finally{
  await db.end();
  await writeFile(process.env.QA_EVIDENCE_DIR+'/dau-online-smoke.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
 }
}
