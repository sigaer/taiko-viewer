// Offline UI QA: actual dashboard component with synthetic API data.
import {createServer} from 'vite';
import vue from '@vitejs/plugin-vue';
import {chromium} from 'playwright-core';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd(), temp=await mkdtemp(resolve(root,'node_modules/.traffic-ui-'));
const out=process.env.QA_EVIDENCE_DIR;assert.ok(out);
const payload={summary:{pagePv24h:123,pageUv24h:42,homePv24h:20,botCommands24hByPlatform:{qqOfficial:0,onebotV11:0}},trends:{accessHourly:[],daily:[],botHourly:[]},topCommands:[],backups:[],recentAudits:[],trafficQuality:{status:'ready',windowStart:'2026-11-05T03:08:00Z',windowEnd:'2026-11-06T03:08:00Z',checkedAt:'2026-11-06T03:08:01Z',complete24h:true,rawRequests24h:200,suspected24h:20,excluded24h:57,reasons:[{key:'api',label:'接口请求',count:57}]}};
await writeFile(temp+'/index.html','<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:12px"><div id="app"></div><script type="module" src="/main.js"></script></body></html>');
await writeFile(temp+'/main.js',`
import {createApp,h,ref,Suspense} from 'vue';
import ElementPlus from 'element-plus';import 'element-plus/dist/index.css';
import Dashboard from '${root}/pages/admin/taiko/dashboard.vue';
import Metric from '${root}/components/admin/AdminMetricCard.vue';
globalThis.defineI18nRoute=()=>{};globalThis.definePageMeta=()=>{};globalThis.useHead=()=>{};
const data=ref(${JSON.stringify(payload)});globalThis.useAdminApiFetch=()=>()=>{};globalThis.useAsyncData=async()=>({data,pending:ref(false),refresh:()=>{}});
window.setTrafficStatus=status=>{data.value.trafficQuality.status=status};
const app=createApp({render:()=>h(Suspense,null,{default:()=>h(Dashboard)})});app.use(ElementPlus);app.component('AdminMetricCard',Metric);app.component('AdminChartCard',{render:()=>h('div')});app.mount('#app');
`);
let server,browser,page;const errors=[];
try{
 server=await createServer({configFile:false,root:temp,plugins:[vue()],resolve:{alias:{'~':root}},server:{host:'127.0.0.1',port:0,fs:{allow:[root]}}});await server.listen();
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message.slice(0,160)));page.setDefaultTimeout(15000);
 await page.goto('http://127.0.0.1:'+server.httpServer.address().port,{waitUntil:'networkidle',timeout:30000});
 await page.getByText('123 / 42',{exact:true}).waitFor();
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:1000});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
  await page.locator('.traffic-quality').screenshot({path:out+'/traffic-quality-'+width+'.png'});
  await page.locator('.admin-metric-card').filter({hasText:'24h 页面请求 PV'}).screenshot({path:out+'/traffic-metric-'+width+'.png'});
 }
 await page.locator('summary').click();await page.getByText('接口请求：57',{exact:true}).waitFor();
 for(const status of ['backfilling','stale','pending']){
  await page.evaluate(s=>window.setTrafficStatus(s),status);
  await page.waitForTimeout(50);assert.equal(await page.getByText('123 / 42',{exact:true}).count(),0,'incomplete/stale total hidden');
 }
 assert.equal(errors.length,0,errors.join('; '));console.log('PASS: actual dashboard renders 390/1440px, reason disclosure, stale/pending/backfill states');
}finally{await page?.close();await browser?.close();await server?.close();await rm(temp,{recursive:true,force:true});}
