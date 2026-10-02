import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import {measureAnnualPage} from '../scripts/annual_readiness_browser_checks.mjs';
const c=JSON.parse(await readFile(process.argv[2],'utf8'));
const accounts=JSON.parse(await readFile(c.accountsFile,'utf8'));
if(c.botSmoke){await (await import('./annual-bot-smoke.mjs')).checkBotFlow(c,accounts);process.exit(0);}
if(c.refreshSmoke){await (await import('./annual-refresh-smoke.mjs')).checkRefreshFlow(c,accounts);process.exit(0);}
if(c.correctionSmoke){await (await import('./annual-correction-smoke.mjs')).checkCorrectionFlow(c,accounts);process.exit(0);}
if(c.publicSmoke){await (await import('./annual-public-smoke.mjs')).checkPublicMode(c,accounts);process.exit(0);}
if(c.publicAuth){await (await import('./annual-public-auth.mjs')).checkPublicAuth(c,accounts);process.exit(0);}
if(c.renderDiagnostics){await (await import('./annual-render-diagnostics.mjs')).diagnoseRender(c,accounts);process.exit(0);}
if(c.protocolOnly){await (await import('./annual-protocol-assertions.mjs')).checkProtocol(c,accounts);process.exit(0);}
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[];
try{
 for(const [a,locale] of (c.browserCases||[['normal','zh'],['sparse','ja']]).map(([kind,locale])=>[accounts.find(a=>a.kind===kind),locale])){
 const context=await browser.newContext({viewport:{width:375,height:567},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',reducedMotion:'reduce',acceptDownloads:true});
 await context.addCookies([{name:'stv_session',value:a.cookie,url:c.base,httpOnly:true}]);
 const page=await context.newPage();const errors=[],requests=[],resourceFailures=[];
 page.on('response',r=>{if(r.status()>=400)resourceFailures.push({path:new URL(r.url()).pathname,status:r.status()});});
 page.on('pageerror',e=>errors.push(e.message.slice(0,180)));
 await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin!==c.base&&!['data:','blob:'].includes(url.protocol)&&!(c.liveReadOnlyAssets&&route.request().method()==='GET'&&['image','font','stylesheet'].includes(route.request().resourceType())&&url.protocol==='https:'&&(url.hostname==='sakura-bot.cn'||url.hostname.endsWith('.sakura-bot.cn'))))await route.abort();else await route.continue();});
 page.on('request',r=>{if(r.url().endsWith('/share-card')){const data=r.postDataJSON();assert.equal(data.syncCommunity,false);requests.push({locale:data.locale,syncCommunity:data.syncCommunity});}});
 await page.goto(`${c.base}${locale==='ja'?'/ja':''}${c.entryPath||'/account/version-summary'}`,{waitUntil:'domcontentloaded',timeout:30000});
 await page.locator('.annual-opening__start').waitFor({timeout:45000}).catch(async e=>{await page.screenshot({path:`${c.output}/entry-failure-${a.kind}.png`});await writeFile(`${c.output}/entry-failure-${a.kind}.json`,JSON.stringify({url:page.url(),text:(await page.locator('body').innerText()).slice(0,5000),errors},null,2));throw e});
 await page.waitForFunction(()=>!document.querySelector('.el-message'),null,{timeout:10000});
 await page.screenshot({path:`${c.output}/business-${a.kind}-${locale}-opening.png`});
 await page.locator('.annual-opening__start').click();
 const geometry=[];
 const keys=await page.locator('.story-player__slide').evaluateAll(nodes=>nodes.map(n=>n.dataset.pageKey));
 for(let i=1;i<keys.length;i++) {
   if(i>1){await page.locator('.story-player__nav button').last().click();await page.waitForTimeout(850);}
   await page.waitForFunction(key=>document.querySelector('.story-player__slide[aria-hidden="false"]')?.dataset.pageKey===key,keys[i],{timeout:5000});
   if(['weekday','favorite','speedProfile','final','poster'].includes(keys[i])){await page.screenshot({path:`${c.output}/business-${a.kind}-${locale}-${keys[i]}.png`});const measured=await measureAnnualPage(page,`${a.kind}-${locale}-${keys[i]}`);geometry.push(measured);await writeFile(`${c.output}/business-${a.kind}-${locale}-geometry.json`,JSON.stringify(geometry,null,2));assert.equal(measured.issues.length,0,JSON.stringify(measured.issues));}
 }
 assert.equal(keys.at(-1),'poster');assert.ok(keys.includes('final'));
 assert.equal(await page.locator('.beta-feedback').count(),0,'Retired beta feedback buttons must not render');
 const marquee=await page.locator('.annual-danmaku__bubble').evaluateAll(els=>els.map(e=>({id:e.dataset.reactionId,x:e.getBoundingClientRect().x})));
 if(marquee.length){await page.waitForTimeout(400);const moved=await page.locator('.annual-danmaku__bubble').evaluateAll((els,old)=>els.some(e=>old.some(o=>o.id===e.dataset.reactionId&&e.getBoundingClientRect().x<o.x-2)),marquee);assert.ok(moved,'Community marquee must actually move');}

 if(c.browserCases){
  for(let replay=0;replay<2;replay++){
   await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('Home');
   await page.waitForFunction(()=>document.querySelector('.story-player__viewport').scrollTop<2);
   await page.locator('.annual-opening__start').click();await page.evaluate(()=>document.activeElement?.blur());
   for(const key of ['ArrowDown','ArrowUp','ArrowDown'])await page.keyboard.press(key);
   await page.waitForTimeout(350);await page.keyboard.press('End');
   await page.waitForFunction(n=>{const e=document.querySelector('.story-player__viewport');return Math.round(e.scrollTop/e.clientHeight)===n-1},keys.length);
  }
 }

 await page.locator('.poster-scene__actions input[type=checkbox]').uncheck();
 await page.screenshot({path:`${c.output}/business-${a.kind}-${locale}-save-visible.png`});
 const responsePromise=page.waitForResponse(r=>r.url().endsWith('/share-card')&&r.request().method()==='POST',{timeout:100000});
 const downloadPromise=page.waitForEvent('download',{timeout:110000});
 await page.locator('.poster-scene__actions > button').first().click();
 const response=await responsePromise;assert.equal(response.status(),200,await response.text());
 const result=await response.json();const download=await downloadPromise;
 const path=`${c.output}/business-${a.kind}-${locale}.png`;await download.saveAs(path);
 const metadata=await sharp(path).metadata();await sharp(path).stats();
 assert.equal(metadata.width,1080);assert.equal(metadata.height,1872);
 const repeat=await context.request.post(`${c.base}/api/account/annual-summaries/${encodeURIComponent((await context.request.get(`${c.base}/api/account/annual-summaries/annual_2026`).then(r=>r.json())).summary.summaryId)}/share-card`,{data:{locale,syncCommunity:false},timeout:90000});
 assert.equal(repeat.status(),200);const reused=await repeat.json();assert.equal(reused.cached,true);assert.equal(reused.shareCard.id,result.shareCard.id);
 results.push({kind:a.kind,locale,pages:keys,errors,resourceFailures,shareRequests:requests,png:path,width:metadata.width,height:metadata.height,cachedRepeat:true,rapidNavigationAndReplays:c.browserCases?2:0});
 await writeFile(`${c.output}/${c.browserCases?'high-':''}business-browser.json`,JSON.stringify(results,null,2));await context.close();
 }
 if(c.checkPublicLanding){
  const ctx=await browser.newContext({viewport:{width:375,height:567},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'});
  await ctx.route('**/*',r=>new URL(r.request().url()).origin===c.base?r.continue():r.abort());const page=await ctx.newPage();
  await page.goto(c.base+'/annual',{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'虹2025版本总结',exact:true}).waitFor();await page.locator('.beta-entry').getByRole('link',{name:'登录',exact:true}).waitFor();assert.equal(await page.locator('#beta-code').count(),0);
  await page.screenshot({path:`${c.output}/public-anonymous-entry.png`});await writeFile(`${c.output}/public-landing.json`,JSON.stringify({publicTitle:true,loginRequired:true,inviteInput:false}));await ctx.close();
 }
} finally{await browser.close();}
console.log(JSON.stringify(results));
