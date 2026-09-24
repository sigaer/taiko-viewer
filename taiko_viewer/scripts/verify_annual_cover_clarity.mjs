import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import sharp from 'sharp';

const root = process.env.ANNUAL_MOTION_ROOT || process.cwd();
const label = process.env.ANNUAL_CLARITY_LABEL || 'after';
const output = `/var/tmp/annual-cover-clarity/${label}`;
const temp = await mkdtemp('/var/tmp/annual-cover-clarity-');
await mkdir(output, { recursive: true });
// Deliberately larger than 400px: verify that the decoder preserves source size.
await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="white"/><path d="M0 0L800 800M800 0L0 800" stroke="black" stroke-width="2"/></svg>')).png().toFile(`${temp}/source.png`);
await writeFile(`${temp}/index.html`, '<html><body style="margin:0;background:#94c5ff"><canvas style="width:390px;height:844px"></canvas><script type="module" src="/main.js"></script></body></html>');
await writeFile(`${temp}/main.js`, `
import { createAnnualCoverRenderer } from '${root}/utils/annualCoverRenderer.client.ts';
const canvas=document.querySelector('canvas');
const state={elapsed:1800,transitionTime:1600};
const renderer=createAnnualCoverRenderer(canvas,[{songNo:1},{songNo:2}],state,()=>{});
await renderer.prepare;renderer.resize(390,844);
window.qa={renderer,state};
`);
let server, browser;
const results=[];
try {
  server=await createServer({configFile:false,root:temp,resolve:{alias:{three:resolve(root,'node_modules/three/build/three.module.js')}},server:{host:'127.0.0.1',port:0,fs:{allow:[root,temp]}}});
  await server.listen();
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader-webgl','--num-raster-threads=2','--enable-unsafe-swiftshader']});
  for(const [dpr,denyMSAA] of [[1,false],[3,false],[3,true]]) {
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:dpr});
    try {
      const page=await context.newPage(), errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('console',m=>{if(m.type()==='error'&&errors.length<10)errors.push(m.text())});
      await page.addInitScript(({denyMSAA})=>{
        window.uploads=[];window.anisotropy=[];
        const get=HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext=function(type,options){return get.call(this,type,denyMSAA&&type==='webgl2'?{...options,antialias:false}:options)};
        for(const method of ['texImage2D','texSubImage2D']) {
          const upload=WebGL2RenderingContext.prototype[method];
          WebGL2RenderingContext.prototype[method]=function(...args){const src=args.at(-1);if(src instanceof ImageBitmap)window.uploads.push([src.width,src.height]);return upload.apply(this,args)};
        }
        const parameter=WebGL2RenderingContext.prototype.texParameterf;
        WebGL2RenderingContext.prototype.texParameterf=function(...args){if(args[1]===34046)window.anisotropy.push(args[2]);return parameter.apply(this,args)};
      },{denyMSAA});
      await page.route('**/api/content/covers/1/texture',r=>r.fulfill({path:'/home/sigaer/taiko/assets/cover/1.png',contentType:'image/png'}));
      await page.route('**/api/content/covers/2/texture',r=>r.fulfill({path:`${temp}/source.png`,contentType:'image/png'}));
      await page.goto(server.resolvedUrls.local[0]);
      await page.waitForFunction(()=>!!window.qa);
      const sample=await page.evaluate(async()=>{
        const canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl2');
        // Sustain motion long enough to catch the old one-way quality downgrade.
        let handle,last=0;
        const tick=now=>{if(last)window.qa.state.elapsed+=Math.min(50,now-last);last=now;window.qa.renderer.render();handle=requestAnimationFrame(tick)};
        handle=requestAnimationFrame(tick);await new Promise(r=>setTimeout(r,8000));cancelAnimationFrame(handle);
        window.qa.state.elapsed=1800;window.qa.renderer.render();
        // Sample a white plane silhouette: intermediate alpha must come from
        // edge coverage, even with MSAA explicitly denied by the test browser.
        const scale=canvas.width/390, w=Math.round(210*scale), h=Math.round(45*scale);
        const pixels=new Uint8Array(w*h*4);
        gl.readPixels(Math.round(90*scale),Math.round((844-725)*scale),w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        const levels=new Set();for(let i=3;i<pixels.length;i+=4)if(pixels[i]>0&&pixels[i]<230)levels.add(pixels[i]);
        return {edgeAlphaLevels:levels.size,width:canvas.width,height:canvas.height,ratio:canvas.dataset.pixelRatio,uploads:window.uploads,anisotropy:window.anisotropy,samples:gl.getParameter(gl.SAMPLES),antialias:gl.getContextAttributes().antialias};
      });
      await page.screenshot({path:`${output}/dpr-${dpr}-msaa-${!denyMSAA}.png`});
      await page.evaluate(()=>{window.qa.state.transitionTime=0;window.qa.renderer.render()});
      await page.screenshot({path:`${output}/period-dpr-${dpr}-msaa-${!denyMSAA}.png`});
      if(label==='after') {
        assert.ok(sample.edgeAlphaLevels>8,'silhouette must retain subpixel coverage without whole-image blur');
        assert.equal(sample.width,390*dpr,'never reduce Retina drawing-buffer resolution');
        assert.equal(sample.height,844*dpr);
        assert.ok(sample.uploads.some(([w,h])=>w===800&&h===800),'decode the source without resizing it to 400px');
        assert.ok(sample.anisotropy.some(n=>n>1),'enable supported anisotropic texture filtering');
        assert.equal(errors.length,0,JSON.stringify(errors));
      }
      await page.evaluate(()=>window.qa.renderer.dispose());
      results.push({dpr,denyMSAA,...sample,errors});
    } finally {await context.close()}
  }
  await writeFile(`${output}/results.json`,JSON.stringify(results,null,2));
  console.log(JSON.stringify(results));
} finally {
  await browser?.close();await server?.close();await rm(temp,{recursive:true,force:true});
}
