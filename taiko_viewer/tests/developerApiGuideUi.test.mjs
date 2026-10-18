// Actual developer page + guide + Element Plus, synthetic account HTTP only.
// No Nuxt/Annual startup, real credentials or business API calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {parse,compileScript,compileStyle} from '@vue/compiler-sfc';
import {build,stop} from 'esbuild';
import {chromium} from 'playwright-core';
import {developerApis,developerGuideCopy} from '../utils/developer-api-guide.ts';

test('developer guide: zh/ja five account states, mobile disclosures, copy/fallback and no data requests',{timeout:120000},async()=>{
 assert.ok(process.env.QA_EVIDENCE_DIR,'Use bounded QA wrapper');
 const root=new URL('../',import.meta.url).pathname,styles=[];
 let meta;const script=await readFile(root+'pages/account/developer/index.vue','utf8');
 // A real Vue component tree; only Nuxt shell composables are supplied here.
 const entry=`import Page from './pages/account/developer/index.vue';
 import {createApp,ref,h,Suspense} from 'vue';import ElementPlus from 'element-plus';
 const locale=ref(new URLSearchParams(location.search).get('locale')||'zh');
 globalThis.definePageMeta=value=>{window.__pageMeta=value};
 globalThis.useI18n=()=>({locale,t:key=>key});globalThis.useLocalePath=()=>path=>path;
 globalThis.useViewerSeo=()=>{};globalThis.useViewerDateTime=()=>({formatDateTime:value=>value||'-'});
 globalThis.useAccountState=()=>({accountUser:ref({email:'synthetic@example.test'}),fetchCurrentUser:async()=>{}});
 globalThis.useViewerApiFetch=()=>async(url,options={})=>{const r=await fetch(url,options);if(!r.ok)throw Error('synthetic HTTP');return r.json()};
 globalThis.useAsyncData=async(key,task)=>({data:ref(await task()),pending:ref(false),refresh:async()=>{}});
 Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{if(window.__copyFailure)throw Error('blocked');window.__copied=text;}}});
 createApp({render:()=>h(Suspense,null,{default:()=>h(Page)})}).use(ElementPlus).component('NuxtLink',{props:['to'],setup:props=>()=>h('a',{href:props.to},'review')}).mount('#app');`;
 let browser,context,page;const requests=[],checks=[],errors=[];let state='',active=false;
 const plugin={name:'actual-vue',setup(b){
  b.onResolve({filter:/^~\//},args=>args.path==='~/utils/seo'?{path:'seo',namespace:'shell'}:{path:resolve(root,args.path.slice(2))+(/\.(vue|ts)$/.test(args.path)?'':'.ts')});
  b.onLoad({filter:/.*/,namespace:'shell'},()=>({contents:'export const buildPageDescription=x=>x;',loader:'js'}));
  b.onLoad({filter:/\.vue$/},async args=>{
   const source=await readFile(args.path,'utf8'),{descriptor,errors}=parse(source);assert.equal(errors.length,0);
   const id='data-v-'+createHash('sha256').update(args.path).digest('hex').slice(0,8);
   const compiled=compileScript(descriptor,{id,inlineTemplate:true});
   for(const s of descriptor.styles){const css=compileStyle({source:s.content,filename:args.path,id,scoped:s.scoped});assert.equal(css.errors.length,0);styles.push(css.code);}
   return {contents:compiled.content.replace('export default','const Component =')+`\nComponent.__scopeId=${JSON.stringify(id)};export default Component;`,loader:'ts',resolveDir:resolve(args.path,'..')};
  });
 }};
 let server;
 try{
  const result=await build({stdin:{contents:entry,resolveDir:root,loader:'ts'},plugins:[plugin],bundle:true,format:'iife',write:false,minify:true,define:{'process.env.NODE_ENV':'"production"'}});
  const html='<!doctype html><html><meta name="viewport" content="width=device-width, initial-scale=1"><style>'+await readFile(root+'node_modules/element-plus/dist/index.css','utf8')+await readFile(root+'assets/css/main.css','utf8')+styles.join('\n')+'</style><div id="app"></div><script>'+result.outputFiles[0].text.replaceAll('</script','<\\/script')+'</script></html>';
  server=createServer((req,res)=>{
   if(req.url.startsWith('/?')){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);return;}
   requests.push(req.method+' '+req.url);
   if(req.url==='/api/account/developer'){
    const application=state?{id:1,status:state,replyEmail:'synthetic@example.test',reason:'Synthetic application',reviewNote:state==='rejected'?'Synthetic rejection':'',createdAt:'2026-01-01',imageUrls:[]}:null;
    res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({canReview:false,currentApplication:application,history:application?[application]:[],token:state==='approved'?{tokenMask:'syn...mask',status:active?'active':'revoked',lastUsedAt:null}:null}));return;
   }
   res.writeHead(404);res.end('{}');
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],timeout:15000});
  context=await browser.newContext({viewport:{width:375,height:812},reducedMotion:'reduce'});page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.name));
  for(const locale of ['zh','ja'])for(const scenario of ['', 'pending','rejected','approved-active','approved-inactive']){
   state=scenario.startsWith('approved')?'approved':scenario;active=scenario==='approved-active';
   await page.goto('http://127.0.0.1:'+server.address().port+'/?locale='+locale,{waitUntil:'networkidle',timeout:15000});await page.locator('[data-developer-guide]').waitFor();
   const copy=developerGuideCopy[locale],guide=page.locator('[data-developer-guide]');
   assert.equal(await guide.locator('.api-overview-item').count(),4);
   assert.equal(await guide.locator('[data-api]').count(),4);
   for(const api of developerApis){const item=guide.locator('.api-overview-item').filter({has:page.getByText(api.name[locale],{exact:true})});assert.ok((await item.innerText()).includes(api.path));assert.ok((await item.innerText()).includes(api.protected?copy.protected:copy.public));}
   assert.equal(await page.locator('form').count(),['','rejected'].includes(state)?1:0);
   if(state!=='approved')assert.equal(await guide.getByRole('status').innerText(),copy.requiresApproval);
   else if(!active)assert.equal(await guide.getByRole('status').innerText(),copy.inactive);
   else assert.equal(await guide.getByRole('status').count(),0);
   assert.equal(await page.locator('a[href*="/account/developer/grants"]').count(),0);
   assert.ok(!(await page.locator('body').innerText()).includes('ResourceGrant'));
   await guide.locator('[data-common] > summary').click();assert.ok(!/Contract 1\.1[^。]*(?:候选状态|候補状態)/.test(await guide.innerText()),'Keep internal release stages in specifications');
   assert.equal(await page.locator('body').getByText('syn...mask',{exact:true}).count(),state==='approved'?1:0);
   for(const api of developerApis){
    const panel=guide.locator('[data-api="'+api.id+'"]');assert.equal(await panel.getAttribute('open'),null);
    await panel.locator(':scope > summary').focus();await page.keyboard.press('Enter');
    await panel.locator('details').first().locator('summary').click();await panel.locator('[data-examples] > summary').click();
    for(const kind of ['curl','python','json'])assert.ok(await panel.locator('[data-example="'+kind+'"] pre').isVisible());
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,scenario+' '+locale+' mobile overflow');
   await guide.locator('[data-api="catalog"] [data-example="curl"] button').click();
   assert.ok((await page.evaluate(()=>window.__copied)).includes('/api/v1/taiko/catalog/songs'));
   assert.ok(!(await page.evaluate(()=>window.__copied)).includes('Authorization'));
   await page.evaluate(()=>{window.__copyFailure=true;});
   await guide.locator('[data-api="rating"] [data-example="python"] button').click();await page.getByText(copy.copyFailed,{exact:true}).waitFor();
   meta=await page.evaluate(()=>window.__pageMeta);assert.equal(meta.middleware,'account-auth');
   checks.push({locale,state:scenario||'unapplied',apis:4,noOverflow:true,copy:true,copyFallback:true});
  }
  await page.setViewportSize({width:1280,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  assert.deepEqual(errors,[]);assert.ok(requests.every(x=>x==='GET /api/account/developer'||x==='GET /favicon.ico'),'documentation must not call scores/analysis APIs');
  await page.screenshot({path:resolve(process.env.QA_EVIDENCE_DIR,'developer-guide-ja-desktop.png'),fullPage:true,timeout:15000});
  await writeFile(resolve(process.env.QA_EVIDENCE_DIR,'developer-guide-ui.json'),JSON.stringify({status:'PASS',checks,requests,accountAuth:meta.middleware,sourceSha256:createHash('sha256').update(script).digest('hex'),scope:'Actual Vue page, guide and Element Plus; Nuxt shell and account data synthetic; no backend authority claims'},null,2));
 }finally{await page?.close();await context?.close();await browser?.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}stop();}
});
