// Real Nuxt/Vue/Element Plus lifecycle regression; no backend or database.
// Run through scripts/memory/run_qa.sh in a private network namespace.
import {mkdtemp,mkdir,writeFile,readFile,symlink,open,realpath} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const web=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
assert.ok(process.env.QA_RUN_TMPDIR && process.env.QA_EVIDENCE_DIR,'isolated runner required');
const config=await readFile(web+'/nuxt.config.ts','utf8');
const cacheDefault=/keepalive: \{ exclude: \["PracticePlayerPage"\] \}/.test(config);
const root=await mkdtemp(resolve(process.env.QA_RUN_TMPDIR,'keepalive-'));
const put=async(name,body)=>{await mkdir(dirname(resolve(root,name)),{recursive:true});await writeFile(resolve(root,name),body);};
await symlink(resolve(web,'node_modules'),root+'/node_modules');
await put('package.json','{"type":"module"}');
await put('app.vue',await readFile(web+'/app.vue','utf8'));
await put('components/AnnualMobileNotice.vue','<template><span /></template>');
await put('nuxt.config.ts',`export default defineNuxtConfig({devtools:{enabled:false},telemetry:false,modules:['@element-plus/nuxt'],app:${cacheDefault?"{keepalive:{exclude:['PracticePlayerPage']}}":"{}"},vite:{server:{fs:{allow:[${JSON.stringify(web)},${JSON.stringify(await realpath(web+"/node_modules"))},${JSON.stringify(root)}]}}}})`);
await put('layouts/default.vue','<template><div data-layout="default"><slot /></div></template>');
await put('layouts/other.vue','<template><div data-layout="other"><slot /></div></template>');
const links='<nav><NuxtLink to="/">A</NuxtLink><NuxtLink to="/b">B</NuxtLink><NuxtLink to="/other">Other</NuxtLink><NuxtLink to="/bare">Bare</NuxtLink><NuxtLink to="/bare-b">Bare B</NuxtLink><NuxtLink to="/uncached">Uncached</NuxtLink></nav>';
await put('pages/index.vue',`<script setup>const value=ref('one');const count=ref(0);useHead({title:'Page A'})</script><template><div>${links}<h1>Page A</h1><button id="increment" @click="count++">{{count}}</button><el-select v-model="value"><el-option label="One" value="one"/><el-option label="Two" value="two"/></el-select><el-tooltip content="Persistent tooltip"><button>Tip</button></el-tooltip><el-dropdown><button>Menu</button><template #dropdown><el-dropdown-menu><el-dropdown-item>Item</el-dropdown-item></el-dropdown-menu></template></el-dropdown></div></template>`);
await put('pages/b.vue',`<script setup>useHead({title:'Page B'})</script><template><div>${links}<h1>Page B</h1><el-select><el-option label="B" value="b"/></el-select></div></template>`);
await put('pages/other.vue',`<script setup>definePageMeta({layout:'other'});useHead({title:'Other'})</script><template><div>${links}<h1>Other</h1></div></template>`);
await put('pages/uncached.vue',`<script setup>definePageMeta({keepalive:false});const count=ref(0);useHead({title:'Uncached'})</script><template><div>${links}<h1>Uncached</h1><button id="uncached" @click="count++">{{count}}</button></div></template>`);
await put('pages/bare.vue',`<script setup>definePageMeta({layout:false});const value=ref('one');useHead({title:'Bare'})</script><template><div>${links}<h1>Bare</h1><el-select v-model="value"><el-option label="One" value="one"/></el-select><el-tooltip content="Bare tooltip"><button>Tip</button></el-tooltip></div></template>`);
await put('pages/bare-b.vue',`<script setup>definePageMeta({layout:false});useHead({title:'Bare B'})</script><template><div>${links}<h1>Bare B</h1></div></template>`);
const log=await open(resolve(process.env.QA_EVIDENCE_DIR,'keepalive-server.log'),'w');
const server=spawn(process.execPath,[web+'/node_modules/nuxt/bin/nuxt.mjs','dev',root,'--host','127.0.0.1','--port','35321'],{cwd:root,env:{...process.env,NUXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:'--max-old-space-size=1536'},stdio:['ignore',log.fd,log.fd]});await log.close();
let browser;const errors=[],checks=[];const deadline=setTimeout(()=>server.kill('SIGTERM'),480000);
try{
 for(let i=0;i<150;i++){if(server.exitCode!==null)throw Error('Nuxt exited');try{if((await fetch('http://127.0.0.1:35321/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
 browser=await chromium.launch({headless:true,executablePath:'/root/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell'});
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 const go=async(label,title)=>{await page.getByRole('link',{name:label,exact:true}).click();await page.getByRole('heading',{name:title,exact:true}).waitFor();await page.waitForTimeout(350);assert.equal(await page.title(),title);};
 await page.goto('http://127.0.0.1:35321/',{waitUntil:'networkidle'});
 await page.locator('#increment').click();await page.locator('.el-select').click();await page.getByRole('option',{name:'Two',exact:true}).click();
 await go('B','Page B');await go('A','Page A');checks.push({name:'same-layout cached counter',pass:await page.locator('#increment').textContent()==='1'});
 await go('B','Page B');await go('Other','Other');await go('A','Page A');await go('Other','Other');await go('B','Page B');
 checks.push({name:'cross-layout navigation/head',pass:true});
 await go('Bare','Bare');await go('Bare B','Bare B');await go('A','Page A');await go('Bare','Bare');await go('A','Page A');checks.push({name:'layout false cached Teleport teardown',pass:true});
 await go('Uncached','Uncached');await page.locator('#uncached').click();await go('B','Page B');await go('Uncached','Uncached');checks.push({name:'explicit keepalive false',pass:await page.locator('#uncached').textContent()==='0'});
 checks.push({name:'no lifecycle exception',pass:errors.length===0});
 await page.close();
}catch(e){checks.push({name:'navigation completes',pass:false,error:String(e.message).slice(0,400)});}
finally{clearTimeout(deadline);await browser?.close();server.kill('SIGTERM');await new Promise(r=>{if(server.exitCode!==null)return r();const timer=setTimeout(()=>server.kill('SIGKILL'),5000);server.once('close',()=>{clearTimeout(timer);r();});});}
const report={checks,errors};await writeFile(resolve(process.env.QA_EVIDENCE_DIR,'keepalive-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(checks.some(c=>!c.pass))process.exitCode=1;
