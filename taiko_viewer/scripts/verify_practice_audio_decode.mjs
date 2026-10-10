// Run via scripts/memory/run_qa.sh. One browser, 5-minute synthetic audio, 150-second deadline.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createServer } from 'node:http';
const dir = await mkdtemp('/var/tmp/practice-long-');
const release = JSON.parse(await readFile(new URL('../public/practice-player/release.json', import.meta.url), 'utf8'));
const root = (process.env.TAIKO_PRACTICE_PLAYER_DIR || '/var/lib/taiko/practice-player') + '/' + release.path.split('/')[2];
let browser, context, server;
const deadline = setTimeout(() => process.exit(124), 150000);
try {
  await promisify(execFile)('/usr/bin/ffmpeg', ['-v','error','-f','lavfi','-i','sine=frequency=440:duration=300','-ac','2','-ar','44100','-threads','1','-c:a','libvorbis',`${dir}/long.ogg`], {timeout:60000,maxBuffer:8192});
  server = createServer((req,res) => {
    if(req.url === '/') {res.setHeader('Content-Type','text/html');res.end('<script src="/audio/decode.js"></script>');return;}
    const path = req.url === '/long.ogg' ? `${dir}/long.ogg` : /^\/audio\/[a-zA-Z0-9_/.-]+$/.test(req.url) && !req.url.includes('..') ? root + req.url : null;
    if(!path) {res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',path.endsWith('.js')?'application/javascript':'application/octet-stream');
    const stream=createReadStream(path);stream.on('error',()=>{res.destroy();});stream.pipe(res);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage']});
  context=await browser.newContext();const page=await context.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const result=await page.evaluate(async()=>{
    const bytes=await (await fetch('/long.ogg')).arrayBuffer();
    const context=new AudioContext();
    try {
      const native=await window.ourTaikoAudioDecoder.decode(context,bytes.slice(0),'native').promise;
      const began=performance.now();
      const software=await window.ourTaikoAudioDecoder.decode(context,bytes,'software').promise;
      let startError = 0;
      const a = native.getChannelData(0), b = software.getChannelData(0);
      for (let i = 0; i < 44100; i++) startError = Math.max(startError, Math.abs(a[i]-b[i]));
      return {startError,nativeRate:native.sampleRate,nativeDuration:native.duration,softwareDuration:software.duration,channels:software.numberOfChannels,samples:software.length,rate:software.sampleRate,decodeMs:Math.round(performance.now()-began)};
    } finally {window.ourTaikoAudioDecoder.dispose();await context.close();}
  });
  assert.equal(result.nativeRate,result.rate);
  assert.ok(result.startError<0.0001,'Decoded onset remains sample-aligned');
  assert.ok(Math.abs(result.nativeDuration-result.softwareDuration)<0.03,'Bound native Vorbis tail padding');
  assert.ok(Math.abs(result.softwareDuration-300)<0.01,'Full long audio decoded');
  assert.equal(result.channels,2);
  console.log(JSON.stringify(result));
} finally {
 await context?.close();await browser?.close();
 if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
 await rm(dir,{recursive:true,force:true});clearTimeout(deadline);
}
