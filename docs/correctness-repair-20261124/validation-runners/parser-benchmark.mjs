import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root=resolve(process.argv[2],'taiko_viewer');
const {build}=createRequire(resolve(root,'package.json'))('esbuild');
const dir=await mkdtemp(resolve(tmpdir(),'timeline-perf-'));
try {
 const outfile=resolve(dir,'analyzer.mjs');
 await build({entryPoints:[resolve(root,'vendor/tja/TJAAnalyzer/offline-analysis/tja-gaps.ts')],bundle:true,platform:'node',format:'esm',outfile,alias:{'tja-renderer':resolve(root,'scripts/tja/renderer.ts')}});
 const {analyzeTJA}=await import(pathToFileURL(outfile));
 const text='TITLE:Perf\nBPM:120\nCOURSE:Oni\n#START\n'+'1000100010001000,\n'.repeat(1000)+'#END';
 const samples=[];let count=0;
 for(let i=0;i<15;i++){const start=performance.now();const result=analyzeTJA(text,'ms','skip');samples.push(performance.now()-start);count=result.courses.oni.unbranched.flat().length;}
 samples.sort((a,b)=>a-b);
 console.log(JSON.stringify({bars:1000,notes:count,p50ms:samples[7],p95ms:samples[14],maxRssKiB:process.resourceUsage().maxRSS}));
}finally{await rm(dir,{recursive:true,force:true});}
