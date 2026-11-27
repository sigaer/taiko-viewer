// DOM/CSS acceptance against production Nitro, reusing the existing slice fixtures.
// Chromium UA controls are NOT Android Firefox / GeckoView or real keyboard acceptance.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {openContext as communityContext} from './community-scenarios.mjs';
import {openContext as accountContext} from './account-scenarios.mjs';
import {fixtureUser} from './community-fixtures.ts';
import {openContext as scoresContext} from './scores-scenarios.mjs';
import {fixtureUser as scoreUser} from './scores-fixtures.ts';

const UAS={
 firefox:'Mozilla/5.0 (Android 16; Mobile; rv:147.0) Gecko/147.0 Firefox/147.0',
 chrome:'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36',
 edge:'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/144.0.0.0 Mobile Safari/537.36 EdgA/144.0',
 iosFirefox:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 FxiOS/147.0 Mobile/15E148 Safari/605.1.15',
 safari:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
 desktopFirefox:'Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0'
};
const ready=page=>page.waitForFunction(()=>{const n=document.getElementById('__nuxt')?.__vue_app__?.config.globalProperties.$nuxt;return n&&!n.isHydrating;});
const push=async(page,to)=>{await page.evaluate(to=>document.getElementById('__nuxt').__vue_app__.config.globalProperties.$router.push(to),to);await page.waitForURL(u=>u.pathname+u.search+u.hash===to,{waitUntil:'domcontentloaded'});await page.waitForTimeout(250);};
const signIn=(page,user)=>page.evaluate(user=>{const n=document.getElementById('__nuxt').__vue_app__.config.globalProperties.$nuxt;n.payload.state['$saccount-user']=user;n.payload.state['$saccount-user-loaded']=true;},user);
const geometry=page=>page.evaluate(()=>{
 const main=document.querySelector('.rework-main'),bar=document.querySelector('.rework-bottom'),header=document.querySelector('.rework-bar'),box=el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height};};
 return {main:box(main),bar:bar?box(bar):null,header:header?box(header):null,position:bar?getComputedStyle(bar).position:null,overflow:getComputedStyle(main).overflowY,mainY:main.scrollTop,windowY:scrollY,rootScrollHeight:document.documentElement.scrollHeight,innerHeight,bodyOverflow:getComputedStyle(document.body).overflowY,mainBottomPadding:getComputedStyle(main).paddingBottom};
});

export async function run({browser,base,out}){
 const results=[];let current;
 const check=async(name,task)=>{try{await task();results.push({name,pass:true});console.log('PASS '+name);}catch(e){results.push({name,pass:false,error:String(e.message).slice(0,350)});console.log('FAIL '+name+': '+String(e.message).slice(0,200));await current?.screenshot({path:out+'/firefox-FAILED-'+name+'.png'}).catch(()=>{});}};
 const adapter=(ua,width=390)=>({newContext:options=>browser.newContext({...options,viewport:{width,height:844},userAgent:ua,ignoreHTTPSErrors:true,serviceWorkers:"block"})});
 for(const [kind,ua] of Object.entries(UAS)){
  const width=kind==='desktopFirefox'?1440:390,ctx=await communityContext(adapter(ua,width),{base,width}),{page,context,state}=ctx;current=page;page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(25000);
  try{
   await page.goto(base+'/about',{waitUntil:'domcontentloaded'});await ready(page);
   await check(kind+'-detection-layout-and-hydration',async()=>{
    assert.equal(await page.locator('html.firefox-android').count(),kind==='firefox'?1:0);assert.equal(ctx.faults.length,0);assert.equal(ctx.warnings.filter(w=>/hydration|mismatch/i.test(w)).length,0);
    const g=await geometry(page);assert.equal(g.bodyOverflow,kind==='firefox'?'hidden':'visible');
    if(kind==='firefox'){assert.equal(g.position,'static');assert.equal(g.overflow,'auto');assert.equal(g.mainBottomPadding,'32px');assert.ok(Math.abs(g.bar.bottom-g.innerHeight)<1);assert.equal(g.rootScrollHeight,g.innerHeight);}else if(width<768)assert.equal(g.position,'fixed');
   });
   if(kind!=='firefox'){
    await check(kind+'-native-document-scroll',async()=>{await page.goto(base+'/songs',{waitUntil:'networkidle'});await ready(page);await page.locator('.lib-results li.row:not(.skeleton)').first().waitFor();await page.evaluate(()=>scrollTo(0,400));await page.waitForTimeout(150);assert.ok(await page.evaluate(()=>scrollY>0));assert.equal(await page.locator('.rework-main').evaluate(el=>el.scrollTop),0);});
    continue;
   }
   await check('firefox-home-zh-light-ja-dark',async()=>{for(const lang of ['zh','ja']){const theme=lang==='ja'?'dark':'light';await context.addCookies([{name:'taiko_theme',value:theme,url:base},{name:'viewer_locale',value:lang,url:base}]);await page.goto(base+(lang==='ja'?'/ja/':'/'),{waitUntil:'networkidle'});await ready(page);await page.locator('#viewer-main h1').first().waitFor();const g=await geometry(page);assert.equal(g.position,'static');assert.equal(g.windowY,0);assert.ok(Math.abs(g.bar.bottom-g.innerHeight)<1);assert.equal(await page.locator('html').getAttribute('data-theme'),theme);await page.screenshot({path:out+'/firefox-home-'+lang+'-'+theme+'.png'});}await context.addCookies([{name:'taiko_theme',value:'light',url:base},{name:'viewer_locale',value:'zh',url:base}]);await page.goto(base+'/about',{waitUntil:'networkidle'});await ready(page);});
   await check('firefox-parser-time-class-before-hydration',async()=>{const source=await (await context.request.get(base+'/about')).text();const head=source.slice(0,source.indexOf('</head>'));assert.match(head,/firefox-android/);assert.match(head,/navigator\.userAgent/);assert.ok(head.includes('data-viewer-shell')||source.includes('data-viewer-shell'));});
   await check('firefox-short-page-bottom-and-viewport-resize',async()=>{await push(page,'/account/login');await page.setViewportSize({width:390,height:1200});await page.waitForTimeout(150);const g=await geometry(page);assert.equal(await page.locator('.rework-main').evaluate(el=>el.scrollHeight===el.clientHeight),true);assert.ok(Math.abs(g.bar.bottom-1200)<1);for(const height of [844,780,716,844]){await page.setViewportSize({width:390,height});await page.waitForTimeout(100);const g=await geometry(page);assert.ok(Math.abs(g.bar.bottom-height)<1);assert.equal(g.position,'static');assert.equal(await page.locator('html[data-kb]').count(),0);}});
   await check('firefox-long-page-single-scroll-port-stable-nav',async()=>{await push(page,'/songs');await page.locator('.lib-results li.row:not(.skeleton)').first().waitFor();const before=await geometry(page);await page.locator('.rework-main').evaluate(el=>el.scrollTo({top:500,behavior:'instant'}));await page.waitForTimeout(250);const after=await geometry(page);assert.ok(after.mainY>100);assert.equal(after.windowY,0);assert.equal(after.bar.top,before.bar.top);assert.equal(after.header.top,before.header.top);await page.screenshot({path:out+'/firefox-long-page.png'});});
   await check('firefox-history-back-forward-and-refresh',async()=>{
    const saved=await page.locator('.rework-main').evaluate(el=>el.scrollTop);await push(page,'/songs/1');await page.waitForFunction(()=>document.querySelector('.rework-main').scrollTop===0);await page.goBack();await page.waitForURL('**/songs');await page.waitForFunction(y=>Math.abs(document.querySelector('.rework-main').scrollTop-y)<2,saved);
    await page.reload({waitUntil:'domcontentloaded'});await ready(page);await page.waitForFunction(y=>Math.abs(document.querySelector('.rework-main').scrollTop-y)<2,saved);await page.goForward();await page.waitForURL('**/songs/1');await page.waitForFunction(()=>document.querySelector('.rework-main').scrollTop===0);
   });
   await check('firefox-song-sticky-tabs-and-lazy-media',async()=>{await page.locator('.sd-diffbar').waitFor();await page.locator('.rework-main').evaluate(el=>el.scrollTo({top:600,behavior:'instant'}));await page.waitForTimeout(150);const pos=await page.locator('.sd-diffbar').evaluate(el=>el.getBoundingClientRect().top),g=await geometry(page),padding=await page.locator('.rework-main').evaluate(el=>parseFloat(getComputedStyle(el).paddingTop));assert.ok(Math.abs(pos-g.main.top-padding)<2,'sticky tabs attach to inner scroll port padding edge');});
   await check('firefox-native-search-dialog-and-scroll',async()=>{await page.locator('.search-trigger').click();await page.locator('dialog[open]').waitFor();await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));assert.equal((await geometry(page)).bodyOverflow,'hidden');});
   state.signedIn=true;await signIn(page,fixtureUser);
   await push(page,'/forum/thread/5100');await page.locator('#viewer-shell-dock .crb').waitFor();
   await check('firefox-reply-docked-above-nav-and-no-double-padding',async()=>{const g=await geometry(page),r=await page.locator('.crb').boundingBox();assert.ok(Math.abs(r.y+r.height-g.bar.top)<2);assert.equal(await page.locator('.crb').evaluate(el=>getComputedStyle(el).position),'static');assert.equal(await page.locator('.forum-thread-page').evaluate(el=>getComputedStyle(el).paddingBottom),'0px');await page.locator('.rework-main').evaluate(el=>el.scrollTop=600);assert.equal((await geometry(page)).windowY,0);});
   await check('firefox-keyboard-visual-resize-offset-and-close-synthetic',async()=>{
    // Synthetic VisualViewport metrics test the layout state machine, not a real IME.
    await page.evaluate(()=>{const vv=new EventTarget();Object.assign(vv,{height:844,width:390,offsetTop:0,scale:1});Object.defineProperty(window,'visualViewport',{configurable:true,get:()=>vv});window.__testViewport=vv;});
    // The existing listeners belonged to the native viewport. window.resize and
    // focus events exercise the same production syncKeyboard handler.
    await page.locator('.crb textarea').focus();await page.evaluate(()=>{window.__testViewport.height=460;window.__testViewport.offsetTop=20;dispatchEvent(new Event('resize'));});
    await page.locator('html[data-kb]').waitFor({state:'attached'});assert.equal(await page.locator('.rework-bottom').count(),0);const shell=await page.locator('.rework-shell').boundingBox(),r=await page.locator('.crb').boundingBox();assert.ok(Math.abs(shell.y-20)<1);assert.ok(Math.abs(shell.height-460)<1);assert.ok(Math.abs(r.y+r.height-(shell.y+shell.height))<2);await page.locator('.crb textarea').fill('Synthetic local draft only');
    await page.evaluate(()=>{window.__testViewport.height=844;window.__testViewport.offsetTop=0;dispatchEvent(new Event('resize'));});await page.locator('.rework-bottom').waitFor();assert.equal(await page.locator('html[data-kb]').count(),0);await page.screenshot({path:out+'/firefox-reply-after-keyboard.png'});
   });
   await check('firefox-keepalive-composer-detaches-on-navigation',async()=>{await push(page,'/about');assert.equal(await page.locator('#viewer-shell-dock .crb').count(),0);await page.setViewportSize({width:820,height:844});await page.waitForTimeout(100);await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);assert.equal(await page.locator('#viewer-shell-dock .crb').count(),0,'resizing must not reactivate a cached composer');await page.goBack();await page.waitForURL('**/forum/thread/5100');await page.locator('#viewer-shell-dock .crb').waitFor();});
  }finally{await page.close();await context.close();}
 }
 // Profile anchors and Element Plus components reuse slice E1's typed fixtures.
 const ctx=await accountContext(adapter(UAS.firefox),{base,width:390}),{context,page,state}=ctx;current=page;page.setDefaultTimeout(15000);
 try{
  await page.goto(base+'/about',{waitUntil:'domcontentloaded'});await ready(page);state.signedIn=true;await signIn(page,state.user);await push(page,'/account/profile');await page.locator('.ra-toc a').last().waitFor();
  await check('firefox-profile-anchor-scroll-and-intersection-observer',async()=>{await page.locator('.ra-toc a').last().click();await page.waitForTimeout(500);assert.ok((await geometry(page)).mainY>0);assert.equal((await geometry(page)).windowY,0);});
  await check('firefox-element-plus-select-popper',async()=>{await page.locator('.showcase-config .el-select').first().click();await page.locator('.el-select-dropdown__item').first().waitFor();await page.waitForTimeout(250);const box=await page.locator('.el-select-dropdown').last().boundingBox();assert.ok(box&&box.x>=-1&&box.x+box.width<=391,'settled popper bounds '+JSON.stringify(box));await page.keyboard.press('Escape');});

 }finally{await page.close();await context.close();}
 const scores=await scoresContext(adapter(UAS.firefox),{base,width:390,signedIn:false});current=scores.page;scores.page.setDefaultTimeout(15000);
 try{await scores.page.goto(base+'/about',{waitUntil:'domcontentloaded'});await ready(scores.page);scores.state.signedIn=true;await signIn(scores.page,scoreUser);await push(scores.page,'/account/songs');await scores.page.locator('.sl-table tr.sr').first().waitFor();
  await check('firefox-element-plus-dialog-lock-and-close',async()=>{const page=scores.page;await page.locator('tr.sr .sr-toggle').first().click();await page.locator('tr.sd').getByRole('button',{name:'编辑',exact:true}).first().click();await page.locator('.el-dialog').first().waitFor();assert.equal(await page.locator('.rework-main').evaluate(el=>getComputedStyle(el).overflowY),'hidden');await page.keyboard.press('Escape');await page.waitForTimeout(350);assert.equal(await page.locator('.rework-main').evaluate(el=>getComputedStyle(el).overflowY),'auto');});
 }finally{await scores.page.close();await scores.context.close();}
 await writeFile(out+'/firefox-android-result.json',JSON.stringify({kind:'Chromium DOM/CSS UA controls with intercepted slice fixtures; not GeckoView acceptance',results,realAndroidFirefox:false,realKeyboard:false,addressBarAutoHide:'UNVERIFIED_REAL_DEVICE_GATE'},null,2)+'\n');return {results};
}
