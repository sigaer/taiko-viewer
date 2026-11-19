// One real Vue component + real session/API HTTP. No Nuxt startup/Annual plugin.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {parse,compileScript} from '@vue/compiler-sfc';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {setHeader} from 'h3';
export async function consentBrowser(c,{clientId,bindingId,key,ask}){
 const source=await readFile(new URL('../../pages/account/developer/grants.vue',import.meta.url),'utf8');
 const {descriptor}=parse(source);const compiled=compileScript(descriptor,{id:'grant-qa',inlineTemplate:true});
 const code=compiled.content.replace('export default','const Page =')+`
 import {createApp,ref,h,Suspense} from 'vue';
 globalThis.definePageMeta=()=>{};
 globalThis.useRuntimeConfig=()=>({public:{developerApiV1:true}});globalThis.useAccountState=()=>({accountUser:ref({developerApiV1Access:true}),fetchCurrentUser:async()=>{}});
 globalThis.useI18n=()=>({locale:ref('zh')});
 globalThis.useViewerApiFetch=()=>async(url,options={})=>{const response=await fetch(url,{...options,headers:{'Content-Type':'application/json'},body:options.body?JSON.stringify(options.body):undefined,credentials:'same-origin'});const data=await response.json();if(!response.ok)throw new Error('API_REQUEST_FAILED');return data;};
 createApp({render:()=>h(Suspense,null,{default:()=>h(Page)})}).mount('#app');`;
 const bundled=await build({stdin:{contents:code,resolveDir:new URL('../../',import.meta.url).pathname,loader:'ts'},bundle:true,format:'iife',write:false,minify:true,define:{'process.env.NODE_ENV':'"production"'}});
 const script=bundled.outputFiles[0].text;assert.ok(script.length<1024*1024);
 const html=`<!doctype html><html lang="zh-CN"><meta name="viewport" content="width=device-width, initial-scale=1"><style>:root{--el-text-color-primary:#242424;--el-bg-color:#fff;--el-fill-color-blank:#fff;--el-border-color:#777;--el-color-primary:#135aa5;--el-color-danger:#a51515}*{box-sizing:border-box}body{margin:0;font:16px system-ui} ${descriptor.styles.map(s=>s.content).join('\n')}</style><div id="app"></div><script>${script.replaceAll('</script','<\\/script')}</script></html>`;
 c.route('get','/consent-ui',event=>{setHeader(event,'content-type','text/html; charset=utf-8');return html;});
 let browser,context,page;
 try{
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],timeout:15000});
  context=await browser.newContext({viewport:{width:375,height:812},reducedMotion:'reduce'});const cookie=c.cookie.split('=');await context.addCookies([{name:cookie[0],value:cookie.slice(1).join('='),url:c.baseUrl}]);
  page=await context.newPage();page.setDefaultTimeout(10000);await page.goto(c.baseUrl+'/consent-ui',{waitUntil:'domcontentloaded',timeout:15000});
  const submit=page.getByRole('button',{name:'同意',exact:true});await page.locator('details').filter({has:page.locator('#grant-app')}).locator('summary').click();await page.locator('#grant-app').waitFor();assert.equal(await submit.isDisabled(),true);
  const prior=await page.locator('[data-grant-id]').first().getAttribute('data-grant-id');
  await page.locator('#grant-app').selectOption(clientId);await page.locator('#grant-binding').selectOption(bindingId);assert.equal(await page.locator('input[type=checkbox],#grant-days').count(),0);assert.equal(await page.locator('#grant-binding option:checked').textContent(),c.taikoId+' · wahlap');
  assert.equal(await submit.isEnabled(),true);await submit.click();
  await page.waitForFunction(previous=>document.querySelector('[data-grant-id]')?.getAttribute('data-grant-id')!==previous,prior);
  const current=await page.locator('[data-grant-id]').first().getAttribute('data-grant-id');assert.notEqual(current,prior);
  const state=(await ask('ui-list-authorized','/api/account/developer/grants')).body;const grant=state.grants.find(g=>g.grantId===current);assert.ok(grant);assert.deepEqual(grant.scopes,['account:read']);assert.equal(grant.expiresAt,null);
  const response=await ask('ui-consent-then-third-party-read','/api/v1/taiko/players/'+grant.playerId+'/scores',{token:key});
  const screenshot=resolve(process.env.QA_EVIDENCE_DIR,'083-consent-mobile.png');await page.screenshot({path:screenshot,fullPage:true,timeout:10000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Mobile horizontal overflow');
  await page.locator('[data-grant-id="'+current+'"]').getByRole('button',{name:'撤销授权',exact:true}).click();
  await page.waitForFunction(id=>document.querySelector('[data-grant-id="'+id+'"]')?.textContent?.includes('已撤销'),current);
  await ask('ui-revoke-then-third-party-denied','/api/v1/taiko/players/'+grant.playerId+'/scores',{token:key,headers:{'if-none-match':response.res.headers.get('etag')},expected:403});
  await writeFile(resolve(process.env.QA_EVIDENCE_DIR,'083-consent-ui.json'),JSON.stringify({status:'PASS_SCOPED',scope:'Actual grants.vue compiled with Vue; real native SQL/session/API; shell composables and CSS variables supplied by isolated test host; no full Nuxt startup',viewport:{width:375,height:812},singleConsent:true,noExpiry:true,consentReadRevokeDenied:true,noHorizontalOverflow:true,sourceSha256:createHash('sha256').update(source).digest('hex'),screenshot},null,2)+'\n');
 }finally{await page?.close();await context?.close();await browser?.close();}
}
