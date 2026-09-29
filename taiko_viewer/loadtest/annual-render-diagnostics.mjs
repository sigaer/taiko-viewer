import {readFile,writeFile} from 'node:fs/promises';
import {createHmac} from 'node:crypto';
import {chromium} from 'playwright-core';
export async function diagnoseRender(c,accounts){
 const root=JSON.parse(await readFile(c.isolationEvidence,'utf8')).root;
 const env=Object.fromEntries((await readFile(`${root}/server.env`,'utf8')).split('\n').map(s=>[s.slice(0,s.indexOf('=')),s.slice(s.indexOf('=')+1)]));
 const a=accounts[1];const summary=(await fetch(c.base+'/api/account/annual-summaries/annual_2026',{headers:{cookie:`stv_session=${a.cookie}`}}).then(r=>r.json())).summary;
 const expires=Date.now()+120000;const signature=createHmac('sha256',env.TAIKO_ANNUAL_RENDER_SECRET).update(`taiko-annual-share-card-render-v1\0${summary.summaryId}:${expires}`).digest('base64url');
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--font-render-hinting=none']});
 try{const page=await browser.newPage({viewport:{width:1080,height:1872},locale:'ja-JP',reducedMotion:'reduce'});
 await page.route('**/*',r=>new URL(r.request().url()).origin===c.base||r.request().url().startsWith('data:')?r.continue():r.abort());
 await page.goto(`${c.base}/ja/account/annual-share-card/${summary.summaryId}?locale=ja&renderToken=${expires}.${signature}`);
 await page.waitForFunction(()=>window.__ANNUAL_SHARE_CARD_READY__===true);await page.evaluate(()=>document.fonts.ready);
 await page.evaluate(async()=>{await document.fonts.ready;for(const img of document.images)await img.decode().catch(()=>{});});
 await page.screenshot({path:`${c.output}/render-ja-first-worker-options.png`,animations:'disabled',caret:'hide',clip:{x:0,y:0,width:1080,height:1872}});
 const nodes=await page.locator('.annual-share-grid__label h2,.annual-share-grid__label p,.annual-share-grid__stats dt').evaluateAll(nodes=>nodes.map(n=>({text:n.textContent,rect:n.getBoundingClientRect().toJSON(),font:getComputedStyle(n).font,fontFamily:getComputedStyle(n).fontFamily,scrollWidth:n.scrollWidth,clientWidth:n.clientWidth})));
 await writeFile(`${c.output}/render-ja-dom.json`,JSON.stringify(nodes,null,2));
 await page.screenshot({path:`${c.output}/render-ja-baseline.png`});
 await page.screenshot({path:`${c.output}/render-ja-worker-options.png`,animations:'disabled',caret:'hide',clip:{x:0,y:0,width:1080,height:1872}});
 await page.screenshot({path:`${c.output}/render-ja-animation-only.png`,animations:'disabled'});
 await page.screenshot({path:`${c.output}/render-ja-clip-only.png`,clip:{x:0,y:0,width:1080,height:1872}});
 await page.locator('#dynamic-line').evaluate(el=>el.remove());
 await page.screenshot({path:`${c.output}/render-ja-no-decoration.png`,animations:'disabled',caret:'hide',clip:{x:0,y:0,width:1080,height:1872}});
 await page.addStyleTag({content:'.share-card-render-page * {font-family: sans-serif !important;}'});await page.screenshot({path:`${c.output}/render-ja-sans-diagnostic.png`});
 }finally{await browser.close();}
}
