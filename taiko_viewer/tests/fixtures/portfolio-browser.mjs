// Actual Vue component/composable + actual HTTP service/store/isolated SQL; only auth and source IO are fixtures.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {build} from 'esbuild';
import {parse,compileScript,compileStyle} from '@vue/compiler-sfc';
import {chromium} from 'playwright-core';
import {eventHandler,setHeader} from 'h3';
import assert from 'node:assert/strict';
export async function verifyPortfolioBrowser(http,{outputDir,forceConflict}){
 const root=resolve(import.meta.dirname,'../..');await mkdir(outputDir,{recursive:true});
 const file=resolve(root,'components/goals/Portfolio.vue'),source=await readFile(file,'utf8'),{descriptor}=parse(source,{filename:file});
 const script=compileScript(descriptor,{id:'portfolio-fixture',inlineTemplate:true}).content.replace('export default','const __component =')+"\n__component.__scopeId='data-v-portfolio-fixture';export default __component;";
 const css=compileStyle({source:descriptor.styles[0].content,id:'data-v-portfolio-fixture',scoped:true}).code;
 const messages=Object.fromEntries(await Promise.all(['zh','ja'].map(async l=>{const all=JSON.parse(await readFile(resolve(root,`locales/${l}.json`),'utf8'));return[l,{portfolio:all.portfolio,home:{goal:all.home.goal}}];})));
 const entry=`import * as Vue from 'vue';import Portfolio from ${JSON.stringify(file)};import {useGoalPortfolio} from ${JSON.stringify(resolve(root,'composables/useGoalPortfolio.ts'))};
 const locale=Vue.ref(new URLSearchParams(location.search).get('locale')||'zh');const messages=${JSON.stringify(messages)};
 function t(key,params={}){let v=key.split('.').reduce((o,k)=>o?.[k],messages[locale.value]);if(typeof v!=='string')return key;for(const[k,x]of Object.entries(params))v=v.replaceAll('{'+k+'}',x);return v;}
 const api=async(path,options={})=>{const url=new URL(path,location.origin);for(const[k,v]of Object.entries(options.query||{}))url.searchParams.set(k,v);const response=await fetch(url,{method:options.method||'GET',headers:{'Content-Type':'application/json'},...(options.body?{body:JSON.stringify(options.body)}:{})});const data=await response.json();if(!response.ok)throw {statusCode:response.status,data};return data;};
 Object.assign(globalThis,{...Vue,useGoalPortfolio,useViewerApiFetch:()=>api,useI18n:()=>({locale,t}),useLocalePath:()=>target=>typeof target==='string'?target:target.path});
 const app=Vue.createApp(Portfolio,{profileId:'11',identity:'synthetic-owner-1:11'});app.component('NuxtLink',{props:['to'],setup:(p,{slots})=>()=>Vue.h('a',{href:p.to},slots.default?.())});app.mount('#app');`;
 const built=await build({stdin:{contents:entry,resolveDir:root,sourcefile:'portfolio-fixture.js'},bundle:true,write:false,tsconfigRaw:{compilerOptions:{target:'ES2022'}},format:'esm',platform:'browser',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'actual-vue-component',setup(b){b.onLoad({filter:/Portfolio\.vue$/},()=>({contents:script,loader:'ts'}));}}]});
 const bundle=built.outputFiles[0].text;
 http.app.use('/bundle.js',eventHandler(event=>{setHeader(event,'Content-Type','application/javascript');return bundle;}));
 http.app.use('/',eventHandler(event=>{setHeader(event,'Content-Type','text/html');return `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:16px;font:16px/1.5 sans-serif;color:#242424;background:#fafafa}body.dark{background:#121212;color:#f0f0f0;--el-fill-color-blank:#222;--el-border-color:#999}.rw-btn{font:inherit;border:1px solid #999;border-radius:8px;padding:8px 12px;background:transparent;color:inherit}.rw-btn:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid #2789ee;outline-offset:2px}${css}</style><div id="app"></div><script type="module" src="/bundle.js"></script>`;}));
 let browser;const results=[];
 try{
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const {locale,width,height,dark}of [{locale:'zh',width:375,height:812,dark:false},{locale:'ja',width:1440,height:900,dark:true},{locale:'zh',width:812,height:375,dark:true}]){
   const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',serviceWorkers:'block'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   try{
    await context.addCookies([{name:'portfolio_test',value:'session',url:http.base}]);await page.goto(http.base+'/?locale='+locale,{waitUntil:'networkidle'});if(dark)await page.locator('body').evaluate(el=>el.classList.add('dark'));
    await page.locator('.portfolio-goal').first().waitFor();assert.ok(await page.locator('.portfolio-goal').count()>=1);assert.ok(!/portfolio\.|home\.goal\./.test(await page.locator('#app').innerText()));
    const createLabel=locale==='ja'?'目標を作成':'创建目标';await page.getByRole('button',{name:createLabel,exact:true}).first().click();await page.locator('input[type=number]').fill('1');await page.getByRole('button',{name:locale==='ja'?'目標を選択':'选择目标',exact:true}).click();await page.locator('input[type=radio][value="score-pb"]').waitFor();await page.locator('input[value="score-pb"]').check();await page.locator('fieldset').getByRole('button',{name:createLabel,exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.portfolio-create'));
    const card=page.locator('.portfolio-list > li[data-goal-id]').filter({hasText:locale==='ja'?'スコア ≥ 900,001':'分数 ≥ 900,001'}).last();await card.waitFor();
    await card.getByRole('button',{name:locale==='ja'?'一時停止':'暂停',exact:true}).click();await card.getByRole('button',{name:locale==='ja'?'再開':'恢复',exact:true}).waitFor();await card.getByRole('button',{name:locale==='ja'?'再開':'恢复',exact:true}).click();await card.getByRole('button',{name:locale==='ja'?'一時停止':'暂停',exact:true}).waitFor();
    if(width===375){await forceConflict();await card.getByRole('button',{name:'暂停',exact:true}).click();await page.getByRole('alert').filter({hasText:'目标已更新'}).waitFor();assert.ok(await page.locator('.portfolio-goal').count()>=2);}
    else{await card.locator('select').selectOption('3');await page.waitForFunction(()=>!document.querySelector('[aria-busy="true"]'));}
    await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.activeElement!==document.body));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    const targets=await page.locator('.goal-portfolio button').evaluateAll(buttons=>buttons.filter(x=>x.getBoundingClientRect().width>0).map(x=>({w:x.getBoundingClientRect().width,h:x.getBoundingClientRect().height})));assert.ok(targets.every(x=>x.w>=44&&x.h>=44));
    await page.screenshot({path:resolve(outputDir,`${locale}-${width}.png`),fullPage:true});
    await card.getByRole('button',{name:locale==='ja'?'目標を取り消す':'取消目标',exact:true}).click();await card.waitFor({state:'detached'});assert.equal(errors.length,0,errors.join(';'));results.push({locale,width,height,dark,result:'PASS'});
   }finally{await context.close();}
  }
 }finally{if(browser)await browser.close();await writeFile(resolve(outputDir,'results.json'),JSON.stringify(results,null,2));}
 return results;
}
