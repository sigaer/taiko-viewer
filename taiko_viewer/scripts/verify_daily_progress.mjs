import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
const base = process.env.GROWTH_BROWSER_BASE || 'http://127.0.0.1:3198';
const out = '/tmp/taiko-growth-browser';
await mkdir(out,{recursive:true});
const browser = await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const dimensions = ['big_song','stamina','speed','accuracy_power','rhythm','complex'];
let passed=0;
try {
for (const locale of ['zh','ja']) for (const dark of [false,true]) for (const width of [390,1440]) for (const state of ['improvement','ordinary','no-play','balanced','limited']) {
 const context=await browser.newContext({viewport:{width,height:width===390?844:900},serviceWorkers:'block'});
 const page=await context.newPage();
 const skills=dimensions.map(key=>({key,value:state==='balanced'?10:key==='accuracy_power'?9:10}));
 const overview={playerState:{overallRating:10.28,skills,priorityDimension:'accuracy_power',tiedDimensions:state==='balanced'?dimensions:['accuracy_power'],dataSufficiency:state==='limited'?'limited':'ready',basis:'lowest-valid-dimension',sampleCount:30},todayPlan:{items:[1,2,3].map(songId=>({songId,difficultyType:4,title:'Fallen Angel',starLevel:9,currentBestScore:998360})),usedFallback:false},dailyProgress:{calendarDay:'2026-09-17',dataMode:'FULL_HISTORY',attendance:state==='no-play'?'not_played':'played',uniqueCharts:state==='no-play'?0:2,events:state==='no-play'?[]:[{songId:1,level:4,title:'Fallen Angel',importance:50,evidence:'delta-snapshot',facts:state==='improvement'?[{type:'ng-reduced',before:7,after:4,delta:-3}]:[{type:'played',before:null,after:null,delta:null}]}]},dataStatus:{mode:'FULL_HISTORY',timezone:'Asia/Shanghai'}};
 await page.addInitScript(dark=>localStorage.setItem('taiko_theme',dark?'dark':'light'),dark);
 await page.route('**/api/account/growth/overview',r=>r.fulfill({json:overview}));
 await page.goto(base+(locale==='ja'?'/ja':'/'),{waitUntil:'networkidle',timeout:60000});
 await page.waitForFunction(()=>window.__NUXT__?.state);
 await page.evaluate(()=>{
 const s=window.__NUXT__.state;
 s['$saccount-user']={id:990001,username:'Player',emailVerified:true};s['$saccount-user-loaded']=true;s['$saccount-user-error']=null;
 s['$shome-state-resolved-user-id']=990001;
 s['$shome-state-resolver']={status:'ready',homeState:'authenticated_ready',authenticated:true,currentBinding:{id:1,taikoId:'fixture',source:'manual'},hasScores:true,error:null};
 });
 const surface=page.locator('.growth-surface');
 await surface.locator('.growth-focus').waitFor();
 const text=await surface.innerText();
 assert.ok(!/涉及谱面|段位变化|接下来先练|练这三首|次は.*を練習/.test(text));
 assert.equal(await surface.locator('.growth-metric').count(),0);
 if(state==='improvement')assert.match(text,/7 → 4/);
 if(state==='no-play')assert.match(text,locale==='zh'?/今天还没开打/:/今日はまだプレイ/);
 if(state==='balanced')assert.match(text,locale==='zh'?/最近状态挺均衡/:/バランス/);
 if(state==='limited')assert.match(text,locale==='zh'?/再积累一些成绩/:/記録が増えると/);
 assert.ok(await surface.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 await surface.screenshot({path:`${out}/${locale}-${dark?'dark':'light'}-${width}-${state}.png`});
 await surface.locator(".growth-progress").scrollIntoViewIfNeeded();
 await surface.locator(".growth-progress").screenshot({path:`${out}/${locale}-${dark?'dark':'light'}-${width}-${state}-daily.png`});
 await context.close();passed++;
}
console.log(JSON.stringify({passed,kind:'synthetic browser presentation',out}));
} finally {await browser.close();}
