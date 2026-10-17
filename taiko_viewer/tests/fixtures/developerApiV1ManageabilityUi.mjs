import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {parse,compileScript} from '@vue/compiler-sfc';
import {build,stop} from 'esbuild';
import {chromium} from 'playwright-core';
import {setHeader} from 'h3';
/** Actual candidate component and API; Nuxt shell only is supplied by this controlled host. */
export async function managementBrowser(c,{grantId,clientId,raceConsent}){
 const source=await readFile(new URL('../../pages/account/developer/grants.vue',import.meta.url),'utf8');const {descriptor}=parse(source);const compiled=compileScript(descriptor,{id:'manage-qa',inlineTemplate:true});
 const code=compiled.content.replace('export default','const Page =')+`
 import {createApp,ref,h,Suspense} from 'vue';globalThis.definePageMeta=()=>{};globalThis.useRuntimeConfig=()=>({public:{developerApiV1:true}});globalThis.useAccountState=()=>({accountUser:ref({developerApiV1Access:true}),fetchCurrentUser:async()=>{}});globalThis.useI18n=()=>({locale:ref('zh')});
 globalThis.useViewerApiFetch=()=>async(url,options={})=>{const r=await fetch(url,{...options,headers:{'Content-Type':'application/json'},body:options.body?JSON.stringify(options.body):undefined,credentials:'same-origin'});const data=await r.json();if(!r.ok)throw new Error('API_REQUEST_FAILED');return data;};createApp({render:()=>h(Suspense,null,{default:()=>h(Page)})}).mount('#app');`;
 let script;try{const bundled=await build({stdin:{contents:code,resolveDir:new URL('../../',import.meta.url).pathname,loader:'ts'},bundle:true,format:'iife',write:false,minify:true,define:{'process.env.NODE_ENV':'"production"'}});script=bundled.outputFiles[0].text;}finally{stop();}assert.ok(script.length<1024*1024);
 const html=`<!doctype html><html lang="zh-CN"><meta name="viewport" content="width=device-width, initial-scale=1"><style>:root{--el-text-color-primary:#242424;--el-bg-color:#fff;--el-fill-color-blank:#fff;--el-border-color:#777;--el-color-primary:#135aa5;--el-color-danger:#a51515}*{box-sizing:border-box}body{margin:0;font:16px system-ui}${descriptor.styles.map(s=>s.content).join('\n')}</style><div id="app"></div><script>${script.replaceAll('</script','<\\/script')}</script></html>`;
 c.route('get','/management-ui',e=>{setHeader(e,'content-type','text/html; charset=utf-8');return html;});let browser,context,page;const cases=[];
 try{
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],timeout:15000});context=await browser.newContext({viewport:{width:375,height:812},reducedMotion:'reduce'});const [name,...value]=c.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:c.baseUrl}]);page=await context.newPage();page.setDefaultTimeout(10000);await page.goto(c.baseUrl+'/management-ui',{waitUntil:'domcontentloaded',timeout:15000});await page.locator('#grant-app').waitFor();
  const grant=page.locator('[data-grant-id="'+grantId+'"]');let grantPages=0;
  while(!await grant.count()){
   assert.ok(grantPages++<6,'Bounded UI grant pagination');const next=page.getByRole('navigation',{name:'授权记录',exact:true}).getByRole('button',{name:'下一页',exact:true});await next.click();await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');
  }
  assert.ok(grantPages>=1,'Old active grant must require pagination');assert.equal(await page.locator('[data-grant-id]').count()<=100,true);
  await grant.getByRole('button',{name:'撤销授权',exact:true}).click();await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');
  const [[revoked]]=await c.pool.execute('SELECT revoked_at FROM web_developer_resource_grants WHERE grant_id=?',[grantId]);assert.ok(revoked.revoked_at);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Horizontal overflow');await page.screenshot({path:resolve(process.env.QA_EVIDENCE_DIR,'083-management-mobile.png'),timeout:10000});cases.push({case:'mobile-pages-to-old-active-grant-and-revokes',width:375,grantPages});
  await page.setViewportSize({width:1280,height:900});await page.reload({waitUntil:'domcontentloaded'});await page.locator('#grant-app').waitFor();await page.locator('details summary').click();const client=page.locator('[data-client-id="'+clientId+'"]');let clientPages=0;
  while(!await client.count()){
   assert.ok(clientPages++<6,'Bounded UI client pagination');await page.getByRole('navigation',{name:'开发者应用',exact:true}).getByRole('button',{name:'下一页',exact:true}).click();await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');
  }
  assert.ok(clientPages>=1);page.once('dialog',dialog=>dialog.accept());
  const race=raceConsent();await race.ready;try{await client.getByRole('button',{name:'停用应用',exact:true}).click();await race.task;}finally{race.release();}await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');
  const [[disabled]]=await c.pool.execute('SELECT status FROM web_developer_api_clients WHERE client_id=?',[clientId]);assert.equal(disabled.status,'disabled');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Horizontal overflow');await page.screenshot({path:resolve(process.env.QA_EVIDENCE_DIR,'083-management-desktop.png'),timeout:10000});cases.push({case:'desktop-pages-to-old-client-and-disables-with-reconsent-race',width:1280,clientPages});
 }finally{await page?.close();await context?.close();await browser?.close();}
 const report={status:'PASS_SCOPED',cases,sourceSha256:createHash('sha256').update(source).digest('hex'),scope:'Actual component/native SQL/HTTP; shell composables and CSS supplied; not full Nuxt',browserClosed:true};await writeFile(resolve(process.env.QA_EVIDENCE_DIR,'083-management-ui.json'),JSON.stringify(report,null,2)+'\n');return report;
}
