import assert from 'node:assert/strict';
import { verifyReadiness } from './annual_readiness_browser_checks.mjs';
import { verifyMotion, measureFrames } from './annual_motion_checks.mjs';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { createServer, build, preview } from 'vite';
import vue from '@vitejs/plugin-vue';
const root=process.env.ANNUAL_MOTION_ROOT||process.cwd(), output=`/var/tmp/annual-motion/${process.env.ANNUAL_MOTION_LABEL||'baseline'}`;
const temp=await mkdtemp('/var/tmp/annual-motion-fixture-');
await mkdir(output,{recursive:true});
await writeFile(`${temp}/index.html`,'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><script type="module" src="/main.js"></script></body></html>');
await writeFile(`${temp}/main.js`, `
import {createApp,h,ref,nextTick} from 'vue';
import {gsap} from 'gsap';
import ElImage from '${root}/node_modules/element-plus/es/components/image/index.mjs';
import '${root}/assets/css/main.css';
import '${root}/assets/css/story-font.css';
import {createRouter,createWebHistory,RouterView} from 'vue-router';
import Player from '${root}/components/account/version-summary/StoryPlayer.vue';
import {useAnnualPages} from '${root}/composables/useAnnualPages.ts';
import {normalizeAnnualSummary} from '${root}/utils/annualSummary.ts';
import raw from '${root}/tests/fixtures/annual-summary.sample.json';
import zh from '${root}/locales/zh.json';
const locale=ref('zh');const t=(key,params={})=>{let text=key.split('.').reduce((v,k)=>v?.[k],zh)??key;return typeof text==='string'?Object.entries(params).reduce((str,[k,v])=>str.split('{'+k+'}').join(String(v)),text):key};
globalThis.useI18n=()=>({locale,t,n:n=>new Intl.NumberFormat('zh-CN').format(n)});
globalThis.useViewerDateTime=()=>({formatDate:v=>String(v||'').slice(0,10),formatDateTime:v=>String(v||'')});
globalThis.useAnnualPages=useAnnualPages;
globalThis.useAnnualBeta=()=>({track:()=>{}});
globalThis.useRoute=()=>({query:{}});
globalThis.useViewerApiFetch=()=>async()=>({items:[]});
const fixture=structuredClone(raw);fixture.sections.lateNight={status:'observed',data:{playCount:42,activeDays:12,latestAt:'2026-07-12T01:42:00+08:00',song:{songNo:1,name:'QA song'}}};
const summary=ref(normalizeAnnualSummary(fixture,'zh',t));
summary.value.summaryId='motion-qa';
const visible=ref(true);window.qa={summary,visible,tickerListeners:()=>gsap.ticker._listeners.length,liveContexts:()=>window.__contexts?.size||0};
const App={setup(){return()=>visible.value?h(Player,{summary:summary.value,started:true}):null}};
const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:App}]});
document.body.classList.add('story-layout-body');
const app=createApp({render:()=>h(RouterView)});app.component('ElImage',ElImage);app.config.globalProperties.$t=t;app.config.globalProperties.$n=n=>String(n);app.use(router);router.isReady().then(()=>app.mount('#app'));
`);
let server,browser;
const warnings=[],errors=[],samples=[];
try{
 const config={configFile:false,root:temp,publicDir:resolve(root,'public'),define:{'process.client':'true','process.server':'false','import.meta.client':'true','import.meta.dev':process.env.ANNUAL_READINESS === '1' ? 'false' : 'true'},plugins:[vue()],resolve:{alias:{'~':root,'@':root,'vue':resolve(root,'node_modules/vue/dist/vue.esm-bundler.js'),'vue-router':resolve(root,'node_modules/vue-router/dist/vue-router.mjs'),'gsap':resolve(root,'node_modules/gsap/index.js')}},server:{host:'127.0.0.1',port:0,fs:{allow:[root,temp]}},build:{outDir:resolve(temp,'dist'),emptyOutDir:true},preview:{host:'127.0.0.1',port:0}};
 if(process.env.ANNUAL_READINESS === '1'){await build(config);const built=await preview(config);server={resolvedUrls:built.resolvedUrls,close:()=>new Promise(resolve=>built.httpServer.close(resolve))};}else{server=await createServer(config);await server.listen();}
 browser=await chromium.launch({executablePath:process.env.ANNUAL_CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader-webgl','--num-raster-threads=2','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 page.on('console',m=>{if(['warning','error'].includes(m.type())&&warnings.length<100)warnings.push(m.text())});
 page.on('pageerror',e=>{if(errors.length<30)errors.push(e.message)});
 await page.addInitScript(()=>{
   const contexts=new Set();window.__contexts=contexts;
   const getContext=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(...args){const result=getContext.apply(this,args);if(result&&(args[0]==='webgl'||args[0]==='webgl2')){contexts.add(result);this.addEventListener('webglcontextlost',()=>contexts.delete(result),{once:true});}return result;};
 });
 await page.route('**/*',route=>{const u=new URL(route.request().url());return ['127.0.0.1','localhost'].includes(u.hostname)?route.continue():route.abort('blockedbyclient')});
 await page.route('**/api/content/covers/*/texture',route=>route.fulfill({path:'/home/sigaer/taiko/assets/cover/1.png',contentType:'image/png'}));
 await page.route('https://static.sakura-bot.cn/cover/**',route=>route.fulfill({path:'/home/sigaer/taiko/assets/cover/1.png',contentType:'image/png'}));
 await page.goto(server.resolvedUrls.local[0]);
 await page.addStyleTag({content:'html,body,#app{margin:0;width:100%;height:100%;overflow:hidden}*{box-sizing:border-box}'});
 await page.waitForFunction(()=>Boolean(window.qa&&document.querySelector('.story-player__slide')),{},{timeout:60000});
 await page.waitForTimeout(2500);
 await page.evaluate(()=>{
   window.qa.blankFrames=0;window.qa.backgroundFades=0;
   const sample=()=>{
     const viewport=document.querySelector('.story-player__viewport');
     if(viewport){const view=viewport.getBoundingClientRect();for(const slide of document.querySelectorAll('.story-player__slide')){
       const rect=slide.getBoundingClientRect();if(Math.min(rect.bottom,view.bottom)-Math.max(rect.top,view.top)>view.height*.8&&!['period','overview'].includes(slide.dataset.pageKey)&&!slide.childElementCount)window.qa.blankFrames++;
     }
     for(const bg of document.querySelectorAll('[data-obsession-stage="background"],[data-favorite-shift-stage="background"]'))if(Number(getComputedStyle(bg).opacity)<.99)window.qa.backgroundFades++;
     }window.qa.monitor=requestAnimationFrame(sample);
   };sample();
 });
 const count=await page.locator('.story-player__slide').count();
 if(count<5)throw new Error(JSON.stringify({count,errors,warnings}));
 console.log(`motion: ${process.env.ANNUAL_MOTION_LABEL} traversing ${count} pages`);
 const limit=process.env.ANNUAL_READINESS === '1' ? 0 : process.env.ANNUAL_MOTION_QUICK?3:Math.min(count,22);
 for(let i=0;i<limit;i++){
  await page.screenshot({path:`${output}/page-${i}.png`});
  samples.push(await page.evaluate(()=>({renderer:document.querySelector('.annual-cover-background')?.dataset.renderer,scenes:document.querySelectorAll('.period-overview-scene').length,active:document.querySelector('.story-player__slide[aria-hidden="false"]')?.dataset.pageKey})));
  if(i < limit-1){await page.locator('.story-player__nav button').last().click();await page.waitForTimeout(1900);}
 }
 if(!process.env.ANNUAL_MOTION_QUICK && process.env.ANNUAL_READINESS !== '1'){
   for(const chapter of [0,4,1,3,2]){await page.locator('.story-progress__chapters button').nth(chapter).click();await page.waitForTimeout(1500);}
   await page.locator('.story-player__viewport').focus();await page.keyboard.press('End');await page.waitForTimeout(1500);
 }
 const continuity=await page.evaluate(()=>{cancelAnimationFrame(window.qa.monitor);return {blankFrames:window.qa.blankFrames,backgroundFades:window.qa.backgroundFades}});
 console.log('motion: traversal complete; starting continuity and lifetime checks');
 let checks;
 if(process.env.ANNUAL_READINESS === '1') { checks=await verifyReadiness(page,output); assert.equal(checks.failures,0,'readiness geometry failures; see readiness.json'); assert.equal(errors.length,0,JSON.stringify(errors)); }
 if(process.env.ANNUAL_MOTION_LABEL==='after')checks=await verifyMotion(page,output);
 if(process.env.ANNUAL_MOTION_QUICK){assert.equal(await page.locator('.annual-cover-background').getAttribute('data-renderer'),'webgl');checks=await measureFrames(page,12000);console.log(JSON.stringify({quick:true,checks}));}
 if(process.env.ANNUAL_MOTION_LABEL==='before'){
   await page.locator('.story-player__viewport').focus();await page.keyboard.press('Home');await page.waitForTimeout(1800);
   await page.locator('.story-player__nav button').last().click();await page.waitForTimeout(900);
   checks={frames:[]};
   for(const name of ['period','overview']){
     checks.frames.push({name,...await measureFrames(page)});
     await page.screenshot({path:`${output}/${name}-steady.png`});
     if(name==='period'){await page.locator('.story-player__nav button').last().click();await page.waitForTimeout(1800);}
   }
 }
 await writeFile(`${output}/${process.env.ANNUAL_MOTION_LABEL||'baseline'}.json`,JSON.stringify({count,warnings,errors,samples,checks,continuity},null,2));
 if(process.env.ANNUAL_MOTION_LABEL==='after'){
   assert.equal(errors.length,0,JSON.stringify(errors));
   assert.equal(continuity.blankFrames,0,'no empty mounted-stage frames');
   assert.equal(continuity.backgroundFades,0,'background must stay opaque');
   assert.equal(warnings.filter(x=>/GSAP target|annual-motion.*Missing/.test(x)).length,0,'no missing animation targets');
 }
 console.log(JSON.stringify({count,warnings:[...new Set(warnings)],errors,samples}));
}catch(error){await writeFile(`${output}/failure.json`,JSON.stringify({message:error.message,errors,warnings},null,2));throw error;}finally{await browser?.close();await server?.close();await rm(temp,{recursive:true,force:true})}
