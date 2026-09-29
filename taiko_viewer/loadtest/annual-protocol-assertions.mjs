import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import mysql from 'mysql2/promise';
import {assertTestDatabaseMutationAllowed} from '../scripts/annual_test_db_guard.mjs';
import {chromium} from 'playwright-core';
export async function checkProtocol(c,accounts){
 const [owner,other]=accounts;const insufficient=accounts.find(a=>a.kind==='insufficient');
 async function req(a,path,method='GET',body,expected=200){const r=await fetch(c.base+path,{method,headers:{cookie:`stv_session=${a.cookie}`,'content-type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(90000)});const accepted=Array.isArray(expected)?expected.includes(r.status):r.status===expected;const message=accepted?'':await r.clone().json().then(x=>String(x.statusMessage||x.message||'').slice(0,300)).catch(()=>'non-JSON');assert.ok(accepted,`${method} ${path}: HTTP ${r.status}, ${message}`);return r.headers.get('content-type')?.includes('json')?r.json():null;}
 const p=await req(owner,'/api/account/annual-summaries/annual_2026');
 await req(owner,`/api/account/annual-summaries/${p.summary.summaryId}`);
 await req(other,`/api/account/annual-summaries/${p.summary.summaryId}`,'GET',null,404);
 const root=JSON.parse(await readFile(c.isolationEvidence,'utf8')).root;
 const env=Object.fromEntries((await readFile(`${root}/server.env`,'utf8')).split('\n').map(s=>[s.slice(0,s.indexOf('=')),s.slice(s.indexOf('=')+1)]));
 const db=await mysql.createConnection({host:env.TAIKO_DB_HOST,port:Number(env.TAIKO_DB_PORT),user:env.TAIKO_DB_USER,password:env.TAIKO_DB_PASSWORD,database:env.TAIKO_DB_NAME});
 let ownerJob;try{await assertTestDatabaseMutationAllowed(db);const [rows]=await db.execute('SELECT id FROM web_annual_summary_jobs WHERE user_id=? ORDER BY created_at DESC LIMIT 1',[owner.userId]);ownerJob=rows[0].id;}finally{await db.end();}
 await req(owner,`/api/account/annual-summary-jobs/${ownerJob}`);
 await req(other,`/api/account/annual-summary-jobs/${ownerJob}`,'GET',null,404);
 const card=await req(owner,`/api/account/annual-summaries/${p.summary.summaryId}/share-card`,'POST',{locale:'zh',syncCommunity:false});assert.equal(card.cached,true);
 await req(other,card.shareCard.imageUrl,'GET',null,404);
 let job=(await req(insufficient,'/api/account/annual-summaries/annual_2026/build','POST',{locale:'zh'},[200,202])).job;
 for(let i=0;i<180&&['queued','running'].includes(job.status);i++){await new Promise(r=>setTimeout(r,1000));job=(await req(insufficient,`/api/account/annual-summary-jobs/${job.id}`)).job;}
 assert.equal(job.status,'failed');assert.equal(job.error.code,'INSUFFICIENT_DATA');
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 let buildPosts=0;
 try{const context=await browser.newContext({viewport:{width:375,height:567},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'});
 await context.addCookies([{name:'stv_session',value:insufficient.cookie,url:c.base}]);const page=await context.newPage();
 await context.route('**/*',r=>new URL(r.request().url()).origin===c.base?r.continue():r.abort());
 page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/build'))buildPosts++;});
 for(let i=0;i<3;i++){await page.goto(`${c.base}/account/version-summary`,{waitUntil:'domcontentloaded'});await page.getByText('当前年度记录不足，暂时无法生成年度报告。',{exact:true}).waitFor({timeout:30000});}
 await page.screenshot({path:`${c.output}/insufficient-refresh.png`});assert.equal(buildPosts,0);
 }finally{await browser.close();}
 const final=await req(insufficient,'/api/account/annual-summaries/annual_2026');assert.equal(final.buildJob.id,job.id);
 const result={candidate:c.candidate,ownerSummaryAndJob:200,summaryIdor:404,jobIdor:404,imageIdor:404,insufficientStatus:job.status,error:job.error.code,refreshes:3,refreshBuildPosts:buildPosts,stableJob:true};
 await writeFile(`${c.output}/protocol-assertions.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
