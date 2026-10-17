import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {parse,compileScript} from '@vue/compiler-sfc';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
test('actual picture selector falls back to same PNG, then default; resets on song change', {timeout:45000},async()=>{
 const source=await readFile(new URL('../components/SongCoverImage.vue',import.meta.url),'utf8');
 const {descriptor}=parse(source);let code=compileScript(descriptor,{id:'cover-qa',inlineTemplate:true}).content.replace('export default','const Cover =');
 code += `\nimport {createApp,ref,computed,watch,onMounted,onBeforeUnmount,h} from 'vue';const song=ref(1529);window.changeSong=id=>song.value=id;createApp({render:()=>h(Cover,{songId:song.value,priority:true})}).mount('#app');`;
 const result=await build({stdin:{contents:code,resolveDir:new URL('../',import.meta.url).pathname,loader:'ts'},bundle:true,format:'iife',write:false,alias:{'~':new URL('../',import.meta.url).pathname},define:{'process.env.NODE_ENV':'"production"'}});
 const server=createServer((_q,r)=>{r.setHeader('content-type','text/html');r.end('<div id="app"></div><script>'+result.outputFiles[0].text+'</script>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser,context,page;
 try{
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],timeout:10000});context=await browser.newContext();
  const png=await readFile('/home/sigaer/taiko/assets/cover/1529.png');const seen=[];
  await context.route('https://static.sakura-bot.cn/**',route=>{const u=new URL(route.request().url());seen.push(u.pathname);return u.pathname.endsWith('.png')&&!u.pathname.includes('/99999999.')?route.fulfill({status:200,contentType:'image/png',body:png}):route.fulfill({status:404,body:''});});
  page=await context.newPage();page.setDefaultTimeout(10000);await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>document.querySelector('img')?.naturalWidth===400&&document.querySelector('img').currentSrc.includes('/1529.png'));assert.equal(await page.locator('source').count(),0);assert.ok(!seen.some(u=>u.includes('1384')));
  await page.evaluate(()=>window.changeSong(99999999));await page.waitForFunction(()=>document.querySelector('img')?.naturalWidth===400&&document.querySelector('img').currentSrc.includes('/1384.png'));assert.ok(seen.some(u=>u.includes('/99999999.png')));
  await page.evaluate(()=>window.changeSong(1501));await page.waitForFunction(()=>document.querySelector('img')?.naturalWidth===400&&document.querySelector('img').currentSrc.includes('/1501.png'));assert.ok(seen.some(u=>u.includes('/thumb/')&&u.includes('/1501.webp')));
  await writeFile(process.env.QA_EVIDENCE_DIR+'/cover-browser.json',JSON.stringify({status:'PASS',sameSongPngBeforeDefault:true,missingPngDefault:true,reuseResetsWebp:true,requests:seen}));
 }finally{await page?.close();await context?.close();await browser?.close();await new Promise(r=>server.close(r));}
});
