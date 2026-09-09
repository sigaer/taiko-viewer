// Isolated Vue/StoryPlayer QA; no backend, DB, export renderer, or credentials.
import {createServer} from 'vite';
import vue from '@vitejs/plugin-vue';
import {chromium} from 'playwright-core';
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {buildSongCoverThumbnailUrl} from '../utils/songCover.ts';
// Three public artwork GETs only; the browser receives these exact bytes offline.
const coverFixtures = await Promise.all([816,463,243].map(async songNo => {
  const url = buildSongCoverThumbnailUrl(songNo,400);
  const response = await fetch(url);
  assert.ok(response.ok, `Cover GET failed: ${url} ${response.status}`);
  const body = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(body).metadata();
  assert.ok(metadata.width > 0 && metadata.height > 0);
  return {songNo,url,body,contentType:response.headers.get('content-type'),width:metadata.width,height:metadata.height,sha256:createHash('sha256').update(body).digest('hex')};
}));
assert.equal(new Set(coverFixtures.map(c => c.sha256)).size,3,'QA must use three distinct real covers');
const root=process.cwd(),out=process.env.POSTER_QA_OUT||'/tmp/annual-poster-phase-a/mosaic-review';
await mkdir(out,{recursive:true});await writeFile(out+'/cover-sources.json',JSON.stringify(coverFixtures.map(({body,...meta})=>meta),null,2));const temp=await mkdtemp(resolve(root,'node_modules/.poster-qa-'));
await writeFile(temp+'/index.html','<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"></head><body style="margin:0"><div id="app"></div><script type="module" src="/main.js"></script></body></html>');
await writeFile(temp+'/main.js',`
import {createApp,ref,computed,h} from 'vue';
import {createRouter,createWebHistory,useRoute,RouterView} from 'vue-router';
import Player from '${root}/components/account/version-summary/StoryPlayer.vue';
import Poster from '${root}/components/account/version-summary/slides/PosterSlide.vue';
import {buildSongCoverThumbnailUrl} from '${root}/utils/songCover.ts';
import zh from '${root}/locales/zh.json';import ja from '${root}/locales/ja.json';
const locale=ref(new URLSearchParams(location.search).get('lang')||'zh');
globalThis.useI18n=()=>({locale,t:key=>key.split('.').reduce((o,k)=>o?.[k],locale.value==='ja'?ja:zh)||key,n:n=>String(n)});
globalThis.useRoute=useRoute;globalThis.useViewerApiFetch=()=>()=>{throw Error('API forbidden')};
globalThis.useAnnualPages=()=>({pages:computed(()=>[{key:'poster',chapter:'keepsake',chapterLabel:'年度留念',labelText:'年度报告',component:Poster}])});
const song=(name,songNo=816)=>({name,coverUrl:buildSongCoverThumbnailUrl(songNo,400),songNo,subtitle:''});
const summary=ref({summaryId:'synthetic-qa',user:{nickname:'测试鼓众'},profileCard:{nickname:'测试鼓众',title:'一年一鼓，一路同行',danName:'十段',myDonUrl:null},overview:{playCount:1095,uniqueSongs:286,currentClearCharts:642},period:{activeDays:218},favoriteSong:song('星屑ストラック'),pound:{topSong:song('幽玄ノ乱',463),speed:23.75,totalPoundCount:99999,topPoundCount:9999},highScore:{song:song('万戈イム－一ノ十',243),score:1002340},timeOfDay:{topPeriod:'evening',topLabel:'傍晚',periods:[{key:'evening',range:'16–19'}],favoriteHourLabel:'17时'},ratingRank:{rankLabel:'十段',rating:13256.78},finalTitle:{title:'太鼓同行者'},poster:{title:'年度报告',periodLabel:'2025',closingLine:''},copy:{poster:{eyebrow:'',title:'年度报告',subtitle:''}},story:{},coverSongs:[]});
window.setFixture=mode=>{if(mode==='missing')summary.value={...summary.value,profileCard:null,favoriteSong:null,pound:{topSong:null,totalPoundCount:99999,topPoundCount:9999},highScore:null,timeOfDay:null,ratingRank:null,overview:{playCount:0,uniqueSongs:0},finalTitle:{title:'年度称号'}};if(mode==='long')summary.value={...summary.value,profileCard:{nickname:'这是一个很长很长的鼓众昵称',title:'这是一个很长很长很长很长的年度称号',danName:'十段'},favoriteSong:song('これはとても長い楽曲名ですこれはとても長い楽曲名です')};};
const app=createApp({render:()=>h(RouterView)});app.use(createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>h(Player,{summary:summary.value,started:true})}}]}));app.mount('#app');
`);
let server,browser;const report=[];
try{
server=await createServer({configFile:false,define:{"process.client":"true","process.server":"false","import.meta.dev":"true"},root:temp,publicDir:resolve(root,'public'),plugins:[{name:'silent-bgm',enforce:'pre',resolveId(id){if(id.includes('annualBgm.client'))return '\0qa-bgm'},load(id){if(id==='\0qa-bgm')return 'export const createAnnualBgmSession=()=>({play:async()=>true,pause(){},release(){},dispose(){},stop(){}})'}},vue()],resolve:{alias:{'~':root,'@':root}},server:{host:'127.0.0.1',port:0,fs:{allow:[root]}}});await server.listen();const url=server.resolvedUrls.local[0];
browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
// All sizes require explicit opt-in after human master review.
const sizes=process.env.POSTER_QA_ALL_VIEWPORTS==='1'?[[414,896],[390,844],[430,932],[390,760],[414,800]]:[[414,896]];
for(const [width,height]of sizes){const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});const errors=[],http=[],writes=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text())});page.on('response',r=>{if(r.status()>=400)http.push([r.status(),r.url()])});
await page.route('**/*',route=>{const r=route.request();const cover=coverFixtures.find(c=>c.url===r.url());if(cover&&r.method()==='GET')return route.fulfill({status:200,contentType:cover.contentType,body:cover.body});if(!r.url().startsWith(url)&&!r.url().startsWith('data:'))return route.abort();if(!['GET','HEAD'].includes(r.method())){writes.push(r.url());return route.abort()}return route.continue()});
await page.goto(url+(process.env.POSTER_QA_LANG ? "?lang="+process.env.POSTER_QA_LANG : ""));await page.waitForSelector('.poster-scene__grid');await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>[...document.querySelectorAll('.annual-share-grid__tile>img')].length===3&&[...document.querySelectorAll('.annual-share-grid__tile>img')].every(i=>i.complete&&i.naturalWidth>0));await page.waitForTimeout(100);
const metrics=await page.locator('.poster-scene').first().evaluate(el=>{const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}};const nav=document.querySelector('.story-player__nav');const items=[...el.querySelectorAll('.annual-share-grid__tile,.annual-share-grid__labels,.annual-share-grid__stats>div,.poster-scene__compose,.poster-scene__actions')];return{mosaic:rect(el.querySelector('.annual-share-grid__mosaic')),tiles:[...el.querySelectorAll('.annual-share-grid__tile')].map(rect),gap:getComputedStyle(el.querySelector('.annual-share-grid__mosaic')).gap,covers:[...el.querySelectorAll('.annual-share-grid__tile>img')].map(i=>({src:i.currentSrc,loaded:i.complete&&i.naturalWidth>0,fit:getComputedStyle(i).objectFit,radius:getComputedStyle(i).borderRadius})),grid:rect(el.querySelector('.annual-share-grid')),nav:rect(nav),overflow:items.filter(e=>e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1).map(e=>e.className),occluded:items.filter(e=>{const a=e.getBoundingClientRect(),b=nav.getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top}).map(e=>e.className),bodyOverflow:document.documentElement.scrollWidth>innerWidth,checkboxes:[...el.querySelectorAll('input[type=checkbox]')].map(e=>e.checked),stats:el.querySelector('.annual-share-grid__stats').innerText}});
await page.screenshot({path:out+'/'+width+'x'+height+'.png'});report.push({width,height,errors,http,writes,...metrics});
if(width===414&&height===896&&!process.env.POSTER_QA_LANG){
  const scene=page.locator('.poster-scene').first();
  await scene.locator('textarea').fill('这一年也很开心');
  await scene.locator('input[type=checkbox]').first().uncheck();
  assert.equal(await scene.locator('input[type=checkbox]').first().isChecked(),false);
  await scene.locator('input[type=checkbox]').first().check();
  assert.equal(await scene.locator('button:disabled').count(),2);
  assert.match(await scene.locator('.annual-share-grid__label--pound').innerText(),/23.75/);
  assert.match(await scene.locator('.annual-share-grid__label--score').innerText(),/1,002,340/);
  await page.evaluate(()=>window.setFixture('long'));await page.waitForTimeout(50);
  await page.screenshot({path:out+'/long-text.png'});
  const longOverflow=await scene.locator('.annual-share-grid__tile').evaluateAll(es=>es.filter(e=>e.scrollHeight>e.clientHeight+1||e.scrollWidth>e.clientWidth+1).length);assert.equal(longOverflow,0);
  await page.evaluate(()=>window.setFixture('missing'));await page.waitForTimeout(50);
  assert.equal(await scene.locator('.annual-share-grid__tile').count(),4);
  assert.match(await scene.locator('.annual-share-grid__label--pound').innerText(),/暂无记录/);
  assert.doesNotMatch(await scene.locator('.annual-share-grid').innerText(),/99999|9999/);
  assert.match(await scene.locator('.annual-share-grid__tile--profile').innerText(),/年度称号/);
  assert.equal(await scene.locator('.annual-share-grid__stats>div').count(),6);
  await page.screenshot({path:out+'/missing.png'});
}
await page.close();}
await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
for(const r of report){assert.equal(r.gap,'0px');assert.equal(r.tiles.length,4);assert.ok(Math.abs(r.mosaic.width-r.mosaic.height)<1);assert.ok(Math.abs((r.mosaic.x+r.mosaic.width/2)-(r.grid.x+r.grid.width/2))<1);for(const tile of r.tiles){assert.ok(Math.abs(tile.width-tile.height)<1);assert.ok(Math.abs(tile.width-r.mosaic.width/2)<1)}assert.ok(Math.abs(r.tiles[0].right-r.tiles[1].x)<1);assert.ok(Math.abs(r.tiles[0].bottom-r.tiles[2].y)<1);assert.equal(new Set(r.covers.map(c=>c.src)).size,3);assert.deepEqual(r.covers.map(c=>c.src),coverFixtures.map(c=>c.url));assert.ok(r.covers.every(c=>c.loaded&&c.fit==='cover'&&c.radius==='0px'));assert.deepEqual(r.errors,[]);assert.deepEqual(r.http,[]);assert.deepEqual(r.writes,[]);assert.deepEqual(r.overflow,[]);assert.deepEqual(r.occluded,[]);assert.equal(r.bodyOverflow,false);assert.deepEqual(r.checkboxes,[true,true]);}
}finally{await browser?.close();await server?.close();await rm(temp,{recursive:true,force:true});}
