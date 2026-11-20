// Offline UI QA: actual dashboard component with synthetic API data.
import {createServer} from 'vite';
import vue from '@vitejs/plugin-vue';
import {chromium} from 'playwright-core';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd(), temp=await mkdtemp(resolve(root,'node_modules/.traffic-ui-'));
const out=process.env.QA_EVIDENCE_DIR;assert.ok(out);
const payload={dauSince:'2026-11-05',summary:{viewerUsers:120,totalUsers:320,taikoBindings:250,wahlapBindings:200,hirobaBindings:50,recentNewUsers:8,totalUploads:2000,pagePv24h:123,pageUv24h:42,homePv24h:20,uploads24h:15,uploaders24h:3,botCommands24h:50,dauToday:31,dauYesterday:25,dauLoggedIn:11,dauAnonymous:20,wau7d:70,mau30d:90,suspectDevicesToday:2,botCommands24hByPlatform:{qqOfficial:40,onebotV11:10}},trends:{accessHourly:[{label:'11-06 10:00',pv:12,uv:5},{label:'11-06 11:00',pv:20,uv:9}],daily:[{day:'2026-11-04',activeUsers:null,pv:50,uploads:1,newUsers:1,newBindings:1},{day:'2026-11-05',activeUsers:25,pv:100,uploads:10,newUsers:2,newBindings:1},{day:'2026-11-06',activeUsers:31,pv:123,uploads:15,newUsers:3,newBindings:2}],botHourly:[]},topCommands:[{name:'b30',count:50}],backups:[],recentAudits:[],trafficQuality:{status:'ready',windowStart:'2026-11-05T03:08:00Z',windowEnd:'2026-11-06T03:08:00Z',checkedAt:'2026-11-06T03:08:01Z',complete24h:true,rawRequests24h:200,suspected24h:5,excluded24h:72,reasons:[{key:'api',label:'接口请求',count:57},{key:'bot',label:'已知自动化',count:15}]}};
await writeFile(temp+'/index.html','<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:12px"><div id="app"></div><script type="module" src="/main.js"></script></body></html>');
await writeFile(temp+'/main.js',`
import {createApp,h,ref,Suspense} from 'vue';
import ElementPlus from 'element-plus';import 'element-plus/dist/index.css';
import Dashboard from '${root}/pages/admin/taiko/dashboard.vue';
import Layout from '${root}/layouts/admin-taiko.vue';
import Nav from '${root}/components/admin/AdminShellNav.vue';
import Chart from '${root}/components/admin/AdminChartCard.client.vue';
import Metric from '${root}/components/admin/AdminMetricCard.vue';
import Sparkline from '${root}/components/admin/AdminSparkline.vue';
globalThis.defineI18nRoute=()=>{};const states={};globalThis.useState=(k,init)=>(states[k]||=ref(init?init():undefined));globalThis.definePageMeta=()=>{};globalThis.useHead=()=>{};globalThis.useRoute=()=>({path:'/admin/taiko/dashboard'});globalThis.useAdminState=()=>({adminUser:ref({username:'synthetic-admin'}),fetchCurrentAdmin:async()=>{},clearAdminUser:()=>{}});
const data=ref(${JSON.stringify(payload)}),error=ref(null);globalThis.useAdminApiFetch=()=>()=>{};globalThis.useAsyncData=async()=>({data,error,pending:ref(false),refresh:()=>{}});
window.setTrafficStatus=status=>{data.value.trafficQuality.status=status};
window.setOldTrafficGap=()=>{data.value.trafficQuality.gapAt='2026-10-01T00:00:00Z'};
window.setActivityMissing=()=>{data.value.summary.dauToday=null;data.value.dauSince=null};window.failDashboard=()=>{data.value=null;error.value=new Error('synthetic outage')};
const app=createApp({render:()=>h(Suspense,null,{default:()=>h(Layout,null,{default:()=>h(Dashboard)})})});app.use(ElementPlus);app.component('AdminShellNav',Nav);app.component('AdminMetricCard',Metric);app.component('AdminChartCard',Chart);app.component('AdminSparkline',Sparkline);app.component('NuxtLink',{props:['to'],setup:(p,{slots})=>()=>h('a',{href:p.to},slots.default?.())});app.mount('#app');
`);
let server,browser,page;const errors=[];
try{
 server=await createServer({configFile:false,root:temp,plugins:[vue()],resolve:{alias:{'~':root}},server:{host:'127.0.0.1',port:0,fs:{allow:[root]}}});await server.listen();
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message.slice(0,160)));page.setDefaultTimeout(15000);
 await page.goto('http://127.0.0.1:'+server.httpServer.address().port,{waitUntil:'networkidle',timeout:30000});
 const visitors=page.locator('.dash-stats > div').filter({hasText:'按网络地址估算的访客'});const views=page.locator('.admin-metric-card').filter({hasText:'浏览量'});
 await visitors.getByText('42',{exact:true}).waitFor();await views.getByText('123',{exact:true}).waitFor();
 const active=page.locator('.dash-tile--primary');await active.getByText('31',{exact:true}).waitFor();await active.getByText('已登录 11 · 未登录 20',{exact:true}).waitFor();
 const machine=page.locator('.dash-stats > div').filter({hasText:'已排除的机器访问'});await machine.getByText('20',{exact:true}).waitFor();
 await page.locator('.admin-chart-card canvas').first().waitFor();
 await page.evaluate(()=>window.setOldTrafficGap());assert.equal(await page.getByText('访问数据不完整',{exact:true}).count(),0,'an old gap outside a complete 24h window does not report current incompleteness');
 for(const width of [375,390,1440]){
  await page.setViewportSize({width,height:1000});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
  await page.locator('.dash-system').screenshot({path:out+'/traffic-quality-'+width+'.png'});
  await views.screenshot({path:out+'/traffic-metric-'+width+'.png'});
  await page.screenshot({path:out+'/dashboard-'+width+'.png',fullPage:true});
 }
 await page.locator('summary',{hasText:'统计说明'}).click();await page.locator('.dash-details__body li').filter({hasText:'接口请求'}).getByText('57',{exact:true}).waitFor();
 for(const status of ['backfilling','stale','pending']){
  await page.evaluate(s=>window.setTrafficStatus(s),status);
  await page.waitForTimeout(50);assert.equal(await visitors.getByText('42',{exact:true}).count(),0,'incomplete/stale total hidden');assert.equal(await views.getByText('123',{exact:true}).count(),0,'incomplete/stale views hidden');assert.equal(await page.locator('.dash-pill').count(),1,'status pill shown');
 }
 await page.evaluate(()=>window.setActivityMissing());await page.waitForTimeout(50);assert.equal(await active.getByText('31',{exact:true}).count(),0,'missing tracking never displays fabricated activity');
 await page.evaluate(()=>window.failDashboard());await page.getByRole('alert').filter({hasText:'统计数据加载失败'}).waitFor();
 assert.equal(errors.length,0,errors.join('; '));console.log('PASS: actual shell, charts and DAU at 375/390/1440px; correct automation total; stale/pending/backfill, missing activity and error states');
}finally{await page?.close();await browser?.close();await server?.close();await rm(temp,{recursive:true,force:true});}
