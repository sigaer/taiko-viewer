import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {createApp,toNodeListener} from 'h3';
import {build} from 'esbuild';
import {parse,compileScript} from '@vue/compiler-sfc';
import {chromium} from 'playwright-core';
const root=resolve(import.meta.dirname,'..'), scratch=await mkdtemp('/var/tmp/taiko-b43-preview-');
let server,browser;
const errors=[];
try {
 const path=resolve(root,'server/api/candidate/prediction-preview.get.ts');
 const api=await build({stdin:{contents:`import {defineEventHandler} from 'h3';const useRuntimeConfig=()=>globalThis.__b43Config;\n${await readFile(path,'utf8')}`,resolveDir:resolve(path,'..'),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
 const {default:handler}=await import(`data:text/javascript;base64,${Buffer.from(api.outputFiles[0].text).toString('base64')}`);
 globalThis.__b43Config={predictionComparisonCandidate:false};
 const app=createApp().use('/api/candidate/prediction-preview',handler);
 const source=await readFile(resolve(root,'components/goals/PredictionComparison.vue'),'utf8');
 const {descriptor}=parse(source);
 const compiled=compileScript(descriptor,{id:'prediction',inlineTemplate:true});
 const widget=resolve(scratch,'widget.ts');
 await writeFile(widget,`import {ref,computed,onBeforeUnmount} from 'vue';const useI18n=()=>({locale:ref(new URLSearchParams(location.search).get('lang')||'zh')});const $fetch=async(url,options)=>{const r=await fetch(url+'?'+new URLSearchParams(options.query),{signal:options.signal});if(!r.ok)throw Error('http');return r.json();};\n${compiled.content}`);
 const frontend=await build({stdin:{contents:`import {createApp} from 'vue';import Widget from ${JSON.stringify(widget)};createApp(Widget).mount('#app');`,resolveDir:root,loader:'ts'},bundle:true,platform:'browser',format:'esm',write:false,nodePaths:[resolve(root,'node_modules')],define:{'process.env.NODE_ENV':'"production"'},alias:{'~':root}});
 const html=`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>:root{--el-border-color:#576174;--el-bg-color:#121722;--el-text-color-primary:#f3f6fc;--viewer-accent-strong:#6ab5ff}*{box-sizing:border-box}body{background:#121722;color:#f3f6fc;font:16px/1.5 system-ui;margin:16px}button{color:inherit;background:#242d3c;border:1px solid #576174;border-radius:8px;padding:8px 12px}#app{max-width:1000px;margin:auto}${descriptor.styles[0].content}</style><div id="app"></div><script type="module" src="/widget.js"></script>`;
 server=createServer((req,res)=>{if(req.url.startsWith('/api/'))return toNodeListener(app)(req,res);res.setHeader('Content-Type',req.url.startsWith('/widget.js')?'text/javascript':'text/html');res.end(req.url.startsWith('/widget.js')?frontend.outputFiles[0].text:html);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 assert.equal((await fetch(`${base}/api/candidate/prediction-preview`)).status,404);
 globalThis.__b43Config.predictionComparisonCandidate=true;
 for(const state of ['available','missing','sparse','revision']){
  const response=await fetch(`${base}/api/candidate/prediction-preview?state=${state}`);
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
  const body=await response.json();assert.equal(body.decision,'retain-personal');assert.equal(body.personal.point,896000);
  assert.equal(body.cohort.availability,state==='available'?'available':state==='sparse'?'insufficient':'unavailable');
 }
 assert.equal((await fetch(`${base}/api/candidate/prediction-preview?state=garbage`)).status,400);
 assert.equal((await fetch(`${base}/api/candidate/prediction-preview?profileId=private`)).status,400);
 assert.equal((await fetch(`${base}/api/candidate/prediction-preview?state=available&state=missing`)).status,400);
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const evidence=process.env.QA_EVIDENCE_DIR||scratch;await mkdir(evidence,{recursive:true});
 for(const [width,lang] of [[390,'zh'],[768,'zh'],[1440,'ja']]){
  const context=await browser.newContext({viewport:{width,height:900}});
  try {
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`${base}/?lang=${lang}`);await page.locator('button').first().click();
   await page.locator('[data-prediction-type="personal"]').waitFor();
   assert.equal(await page.locator('.prediction-cards article').count(),3);
   assert.ok((await page.locator('[data-prediction-type="personal"]').innerText()).includes('896,000'));
   const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,minControl:Math.min(...Array.from(document.querySelectorAll('button,select,summary')).map(e=>e.getBoundingClientRect().height))}));
   assert.ok(dimensions.scroll<=dimensions.width,`horizontal overflow at ${width}`);assert.ok(dimensions.minControl>=44);
   await page.screenshot({path:resolve(evidence,`prediction-${width}-${lang}.png`),fullPage:true});
   for(const state of ['missing','sparse','revision','available']){
    await page.locator('select').selectOption(state);await page.locator('.prediction-cards article').first().waitFor();
    const text=await page.locator('[data-prediction-type="cohort-observation"]').innerText();
    assert.ok(state==='available'?/\d{3},\d{3}/.test(text):! /\d{3},\d{3}/.test(text));
   }
   await page.route('**/api/candidate/prediction-preview?state=missing',route=>route.abort(),{times:1});
   await page.locator('select').selectOption('missing');await page.locator('[role="alert"]').waitFor();
   await page.locator('[role="alert"] button').click();await page.locator('.prediction-cards article').first().waitFor();
   await page.locator('button').first().click();assert.equal(await page.locator('.prediction-content').count(),0);
  } finally {await context.close();}
 }
 assert.equal(errors.length,0,errors.slice(0,3).join(';'));
 console.log('PASS candidate HTTP gate/query/no-store + Vue state/error/retry/mobile/desktop/ja integration');
} finally {
 delete globalThis.__b43Config;
 if(browser)await browser.close();
 if(server){server.closeAllConnections();await new Promise(r=>server.close(r));assert.equal(server.listening,false);}
 await rm(scratch,{recursive:true,force:true});
}
