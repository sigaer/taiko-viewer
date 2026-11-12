import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { build } from 'esbuild';

test('PNG backfill renders numeric courses and independent P1/P2, rejecting wrong identities', {timeout:60000}, async()=>{
 const viewer=fileURLToPath(new URL('../',import.meta.url));
 const root=await mkdtemp('/var/tmp/taiko-chart-image-test-');
 try {
  const single=resolve(root,'single.tja'),double=resolve(root,'double.tja'),branched=resolve(root,'branched.tja'),branchEnd=resolve(root,'branch-end.tja');
  await writeFile(single,'TITLE:Test\nBPM:120\nCOURSE:3\nLEVEL:1\n#START\n1122,\n#END\n');
  await writeFile(double,'TITLE:Double\nBPM:120\nCOURSE:Oni\nLEVEL:1\nSTYLE:Double\n#START P1\n1122,\n#END\n#START P2\n2211,\n#END\n');
  await writeFile(branched,'TITLE:Branches\nBPM:120\nCOURSE:Oni\nLEVEL:1\n#START\n#BRANCHSTART p,75,90\n#N\n11,\n11,\n#E\n12,\n#M\n1122,\n#BRANCHEND\n12,\n#END\n');
  await writeFile(branchEnd,'TITLE:Branch end\nBPM:120\nCOURSE:Oni\nLEVEL:1\n#START\n#BRANCHSTART p,75,90\n#N\n11,\n#E\n12,\n#M\n1122,\n#BRANCHEND\n#END\n');
  const mixed=resolve(root,'mixed.tja'),oversized=resolve(root,'oversized.tja');
  await writeFile(mixed,'TITLE:Mixed\nBPM:120\nCOURSE:Oni\nLEVEL:1\nSTYLE:Duet\n#START P1\n1111,\n#END\n#START P2\n2222,\n#END\nSTYLE:Single\n#START\n1122,\n#END\nCOURSE:Hard\nLEVEL:1\n#START P1\n1111,\n#END\n#START P2\n2222,\n#END\n');
  await writeFile(oversized,'TITLE:Geometry\nBPM:120\nCOURSE:Oni\nLEVEL:1\n#START\n#MOVELINE 100000\n1122,\n#END\n');
  const jobs=[{id:1,tja:single,side:'single'},{id:2,tja:double,side:'p1'},{id:3,tja:double,side:'p2'},
              {id:4,tja:double,side:'single'},{id:5,tja:single,side:'single',notes:99},{id:6,tja:branched,side:'single',notes:6},{id:7,tja:branchEnd,side:'single'},
              {id:8,tja:mixed,side:'single'},{id:9,tja:mixed,side:'p1'},{id:10,tja:mixed,side:'p2'},
              {id:11,tja:mixed,course:'hard',side:'p1'},{id:12,tja:mixed,course:'hard',side:'p2'},{id:13,tja:oversized,side:'single'}]
   .map(row=>({course:'oni',level:1,notes:4,title:'中文曲名',...row,output:resolve(root,row.id+'.png')}));
  const report=resolve(root,'report.json'),plan=resolve(root,'plan.json');
  await writeFile(plan,JSON.stringify({jobs,report}));
  await promisify(execFile)(process.execPath,[resolve(viewer,'scripts/render_catalog_images.mjs'),plan],{timeout:50000,maxBuffer:65536});
  const result=JSON.parse(await readFile(report,'utf8'));
  assert.equal(result.generated.length,10,JSON.stringify(result.issues));assert.equal(result.issues.length,3);
  assert.ok(result.issues.find(row=>row.id===13)?.reason.includes('geometry'),'Oversized surfaces must be rejected before allocation');
  assert.ok(result.generated.every(row=>row.title==='中文曲名'),'Chinese display title not applied');
  for(const id of [1,2,3,6,7,8,9,10,11,12]) {
   const png=await readFile(resolve(root,id+'.png'));
   assert.ok(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'PNG signature invalid');
   assert.equal(png.readUInt32BE(16),816);assert.ok(png.readUInt32BE(20)>100);
  }
  assert.ok(!(await readFile(resolve(root,'2.png'))).equals(await readFile(resolve(root,'3.png'))),'P1 and P2 must retain distinct notes');
 } finally {await rm(root,{recursive:true,force:true});}
});

test('image service resolves legacy IDs and rejects invalid difficulty or missing player side',async()=>{
 const viewer=fileURLToPath(new URL('../',import.meta.url));
 const root=await mkdtemp('/var/tmp/taiko-chart-source-test-');
 const saved=globalThis.createError;
 try {
  const folder=resolve(root,'assets/fumens/Oni');await mkdir(folder,{recursive:true});
  await writeFile(resolve(folder,'7.png'),Buffer.from('synthetic-image'));
  const output=resolve(root,'service.mjs');
  await build({entryPoints:[resolve(viewer,'server/services/content/chartImages.ts')],outfile:output,bundle:true,platform:'node',format:'esm',logLevel:'silent',plugins:[{name:'fixtures',setup(builder){
   builder.onResolve({filter:/^\.\/(songs|runtime)$/},args=>({path:args.path,namespace:'fixture'}));
   builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='./songs'?'export const getSongCatalog=async()=>[{id:7,legacy_ids:[100007]}]':`export const getContentRuntimePaths=()=>({repoRoot:${JSON.stringify(root)}})`,loader:'js'}));
  }}]});
  globalThis.createError=value=>Object.assign(new Error(value.statusMessage),value);
  const service=await import(pathToFileURL(output));
  const image=await service.openChartImage(100007,4);assert.equal(image.size,15);await image.file.close();
  await assert.rejects(service.openChartImage(7,0),e=>e.statusCode===400);
  await assert.rejects(service.openChartImage(7,4,'../'),e=>e.statusCode===400);
  await assert.rejects(service.openChartImage(7,4,'p1'),e=>e.statusCode===404);
 } finally {globalThis.createError=saved;await rm(root,{recursive:true,force:true});}
});
