// Real forum SFCs; synthetic read-only DTOs. No business DB or account sessions.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright-core';
import {forumDiscoveryBrowserRuntime} from '../tests/fixtures/forumDiscoveryBrowserRuntime.mjs';

const out=process.env.QA_EVIDENCE_DIR;
assert.ok(out,'Bounded QA required');
const repo=new URL('../../',import.meta.url).pathname;
const title={key:'annual-beta-pioneer',name:'虹光先行者',style:'rainbow'};
const decorate=value=>{
 if(Array.isArray(value))return value.map(decorate);
 if(!value||typeof value!=='object')return value;
 const result=Object.fromEntries(Object.entries(value).map(([k,v])=>[k,decorate(v)]));
 if(typeof result.username==='string')result.titles=result.username==='鼓声未停'?[title]:[];
 return result;
};
let server,browser;
const report={pass:false,layouts:[],errors:[]};
const timer=setTimeout(()=>process.exit(124),240000);
try{
 server=await forumDiscoveryBrowserRuntime(repo,process.env.QA_RUN_TMPDIR,{transformData:decorate});
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],timeout:20000});
 for(const layout of [{locale:'zh',width:390,dark:false},{locale:'ja',width:390,dark:true},{locale:'zh',width:1440,dark:true},{locale:'ja',width:1440,dark:false}]){
  const context=await browser.newContext({viewport:{width:layout.width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
  try{
   await context.addInitScript(dark=>localStorage.setItem('taiko_theme',dark?'dark':'light'),layout.dark);
   await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    return url.origin==='http://127.0.0.1:3208'&&['GET','HEAD','OPTIONS'].includes(route.request().method())?route.continue():route.abort();
   });
   const page=await context.newPage();page.setDefaultTimeout(20000);
   page.on('pageerror',error=>report.errors.push(error.message.slice(0,200)));
   const base='http://127.0.0.1:3208'+(layout.locale==='ja'?'/ja':'');
   await page.goto(base+'/forum/discussions',{waitUntil:'networkidle',timeout:60000});
   const cards=page.locator('.forum-thread-card');await cards.first().waitFor();
   assert.equal(await cards.nth(0).locator('.account-title').innerText(),title.name);
   assert.equal(await cards.nth(1).locator('.account-title').count(),0);
   const metric=await cards.first().locator('.account-title').evaluate(el=>({height:el.getBoundingClientRect().height,lineHeight:parseFloat(getComputedStyle(el).lineHeight),fits:el.scrollWidth<=el.clientWidth+1,text:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor}));
   assert.ok(metric.height<2*metric.lineHeight);assert.ok(metric.fits);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:resolve(out,`title-list-${layout.locale}-${layout.width}.png`)});
   await page.goto(base+'/forum/thread/81000',{waitUntil:'networkidle'});
   await page.locator('.thread-header .account-title').waitFor();
   assert.equal(await page.locator('.floor-card__user .account-title').innerText(),title.name);
   assert.equal(await page.locator('.sub-reply-item__head .account-title').innerText(),title.name);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:resolve(out,`title-thread-${layout.locale}-${layout.width}.png`)});
   report.layouts.push({...layout,metric,authorFloorAndReply:true,nonRecipientHidden:true});
  }finally{await context.close();}
 }
 assert.deepEqual(report.errors,[]);report.pass=true;
}finally{
 if(browser)await browser.close();if(server)await server.close();clearTimeout(timer);
 await writeFile(resolve(out,'account-titles-browser.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({pass:report.pass,layouts:report.layouts.length,evidence:out}));
}
