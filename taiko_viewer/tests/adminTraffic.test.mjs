import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, writeFile, appendFile, rename, rm } from 'node:fs/promises';
const root = await mkdtemp('/var/tmp/viewer-traffic-unit-');
await build({entryPoints:['server/utils/admin/traffic-rules.ts','server/utils/admin/traffic-log.ts','scripts/viewer-page-routes.ts'],outdir:root,outbase:'.',bundle:true,platform:'node',format:'esm',outExtension:{'.js':'.mjs'}});
const r = await import(root+'/server/utils/admin/traffic-rules.mjs');
const {readLogBatch} = await import(root+'/server/utils/admin/traffic-log.mjs');
const {viewerPageRoutes} = await import(root+'/scripts/viewer-page-routes.mjs');
const routes=viewerPageRoutes(new URL('../pages',import.meta.url).pathname).map(p=>new RegExp(p));
const request=(o={})=>({ip:'192.0.2.1',time:Date.now(),method:'GET',path:'/',status:200,ua:'Mozilla/5.0 browser',...o});
test.after(()=>rm(root,{recursive:true,force:true}));

test('only actual pages with successful GET responses count, including Japanese and dynamic routes',()=>{
 for(const path of ['/','/ja','/ja/','/forum','/ja/forum','/songs/403','/guide/oni/10'])assert.equal(r.exclusionReason(request({path}),routes),null,path);
 for(const [o,reason] of [[{path:'/taiko-api/guide/music/musicDetailList'},'api'],[{path:'/api/account'},'api'],[{path:'/practice-player/runtime.mjs'},'resource'],[{path:'/movie.mp4'},'resource'],[{path:'/.env.local'},'probe'],[{path:'/index.php'},'probe'],[{status:404},'status'],[{status:302},'status'],[{status:431},'status'],[{ua:'node'},'bot'],[{ua:'libredtail-http'},'bot'],[{ua:'-'},'missingUa'],[{path:'/random-scanner-path'},'unknownRoute'],[{method:'HEAD'},'method']])assert.equal(r.exclusionReason(request(o),routes),reason);
 assert.equal(r.exclusionReason(request({status:304}),routes),null);
 assert.equal(r.parseAccessLine('192.0.2.1 - - [06/Nov/2026:10:00:00 +0800] "GET /%2eenv?token=secret HTTP/1.1" 404 5 "-" "Mozilla/5.0"').path,'/.env');
});

test('behavior reclassifies entire minute across persisted batches without double counting',()=>{
 let bucket=r.emptyMinute();
 for(let i=0;i<19;i++)r.addRequest(bucket,request(),'salt',routes);
 assert.equal(r.summarizeMinute(bucket).pv,19);
 bucket=JSON.parse(JSON.stringify(bucket));r.addRequest(bucket,request(),'salt',routes);
 const v=r.summarizeMinute(bucket);assert.equal(v.pv,0);assert.equal(v.suspected,20);assert.equal(v.reasons.repeat,20);
 assert.equal(v.raw,v.pv+v.suspected+v.excluded);
 assert.ok(!JSON.stringify(bucket).includes('192.0.2.1'));
});

test('assets do not flag legitimate users and different browser identities on a shared IP are separated',()=>{
 const b=r.emptyMinute();
 for(let i=0;i<100;i++)r.addRequest(b,request({path:`/_nuxt/${i}.js`}),'salt',routes);
 for(let i=0;i<10;i++)r.addRequest(b,request(),'salt',routes);
 for(let i=0;i<10;i++)r.addRequest(b,request({ua:'Mozilla/5.0 another browser'}),'salt',routes);
 const s=r.summarizeMinute(b);assert.equal(s.pv,20);assert.equal(s.ips.size,1);assert.equal(s.suspected,0);assert.equal(s.excluded,100);
});

test('high-frequency multi-page and scanner behavior are identified',()=>{
 const b=r.emptyMinute();
 for(let i=0;i<60;i++)r.addRequest(b,request({path:`/songs/${i}`}),'salt',routes);
 assert.equal(r.summarizeMinute(b).reasons.burst,60);
 const scan=r.emptyMinute();r.addRequest(scan,request(),'salt',routes);
 for(let i=0;i<10;i++)r.addRequest(scan,request({path:`/scan${i}.php`,status:404}),'salt',routes);
 const s=r.summarizeMinute(scan);assert.equal(s.pv,0);assert.equal(s.suspected,1);assert.equal(s.excluded,10);
 assert.equal(s.raw,Object.values(s.reasons).reduce((a,b)=>a+b,0));
});

test('bounded cursor handles partial UTF-8 lines, append, rotation, truncation and same-size rewrite',async()=>{
 const path=root+'/access.log';await writeFile(path,'一行\nsecond');
 let b=await readLogBatch(path);assert.equal(b.text,'一行\n');assert.equal(b.partialLine,true);
 await appendFile(path,'\n');b=await readLogBatch(path,b.cursor);assert.equal(b.text,'second\n');
 const before=b.cursor;await rename(path,path+'.1');await appendFile(path+'.1','old-tail\n');await writeFile(path,'new\n');
 b=await readLogBatch(path,before);assert.equal(b.text,'old-tail\n');assert.equal(b.gap,false);
 b=await readLogBatch(path,b.cursor);assert.equal(b.text,'new\n');
 await writeFile(path,'xyz\n');b=await readLogBatch(path,b.cursor);assert.equal(b.gap,true);assert.equal(b.text,'xyz\n');
 await writeFile(path,'a\n');b=await readLogBatch(path,b.cursor);assert.equal(b.gap,true);assert.equal(b.text,'a\n');
 await rm(path);await writeFile(path,'replacement\n');b=await readLogBatch(path,b.cursor);assert.equal(b.gap,true);
});
