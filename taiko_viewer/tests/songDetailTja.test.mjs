import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,stat,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {build} from 'esbuild';

test('song detail builds downloads with installed Taiko and survives download worker failure',{timeout:30000},async()=>{
 const root=await mkdtemp(resolve(process.env.QA_RUN_TMPDIR||tmpdir(),'song-detail-'));
 const cwd=process.cwd(),python=process.env.TAIKO_PYTHON_EXECUTABLE;
 const viewer=fileURLToPath(new URL('../',import.meta.url));
 const config={repoRoot:root,viewerCacheDir:resolve(root,'cache'),public:{}};
 try{
  assert.ok(python,'test requires an installed TAIKO_PYTHON_EXECUTABLE');
  process.chdir(viewer);globalThis.useRuntimeConfig=()=>config;
  for(const name of ['songs','logs','tja'])await mkdir(resolve(root,name));
  const song={id:999931,song_name:'Synthetic Song',song_name_jp:'Synthetic Song',level_4:1,max_combo:[0,0,0,4,0],shelf_status:0};
  const missing={id:1545,song_name:'Kimi wa doko?',song_name_jp:'君はドコ？',subtitle:'GOLDEN BOMBER',level_1:3,level_2:5,level_3:6,level_4:9,max_combo:[112,189,334,563,'-'],bpm:'95.14-288',shelf_status:0};
  await writeFile(resolve(root,'songs/song_data.json'),JSON.stringify([song,missing]));
  await writeFile(resolve(root,'songs/rating_structured_with_ids.json'),JSON.stringify({songs:{test:{id:song.id,level:4,score:1}}}));
  await writeFile(resolve(root,'logs/ese_audio_sync_report.json'),JSON.stringify({repo:{repo_path:resolve(root,'tja')}}));
  await writeFile(resolve(root,'tja/synthetic.tja'),'TITLE:Synthetic Song\nBPM:120\nWAVE:synthetic.ogg\nOFFSET:0\nCOURSE:Oni\nLEVEL:1\n#START\n1111,\n#END\n');
  await writeFile(resolve(root,'tja/synthetic.ogg'),'synthetic audio bytes');
  // Reproduce a substring-only match against another song with all four courses.
  await writeFile(resolve(root,'tja/dodai.tja'),'TITLE:Do-Dai -New Audio/Chart-\nTITLEJA:Do-Dai\nBPM:171\nWAVE:dodai.ogg\nOFFSET:0\n'+['Oni','Hard','Normal','Easy'].map((course,i)=>`COURSE:${course}\nLEVEL:${[7,5,5,4][i]}\n#START\n1111,\n#END\n`).join(''));
  await writeFile(resolve(root,'tja/dodai.ogg'),'synthetic audio bytes');
  await mkdir(config.viewerCacheDir);
  const oldKey=[(await stat(resolve(root,'songs/song_data.json'))).mtimeMs,(await stat(resolve(root,'logs/ese_audio_sync_report.json'))).mtimeMs,resolve(root,'tja')].join(':');
  await writeFile(resolve(config.viewerCacheDir,'song-tja-index.json'),JSON.stringify({version:1,savedAt:new Date().toISOString(),data:{cacheKey:oldKey,data:{matches:{1545:{tja_path:resolve(root,'tja/dodai.tja'),rel_path:'dodai.tja'}}}}}));
  const output=await build({entryPoints:[resolve(viewer,'server/services/content/songs.ts')],bundle:true,platform:'node',format:'esm',write:false});
  const compiled=resolve(root,'songs.mjs');await writeFile(compiled,output.outputFiles[0].text);
  const healthy=await import(pathToFileURL(compiled).href+'?healthy');
  const detail=await healthy.getSongDetailPayload(song.id);
  assert.equal(detail.song.id,song.id);assert.equal(detail.ratingEntries.length,1);
  assert.equal(detail.tjaBundleUrl,`/api/content/songs/${song.id}/tja-package`);
  const missingDetail=await healthy.getSongDetailPayload(missing.id);
  assert.equal(missingDetail.tjaBundleUrl,null,'a substring candidate must not expose another song as the TJA package');
  const index=JSON.parse(await readFile(resolve(config.viewerCacheDir,'song-tja-index.json'),'utf8'));
  assert.match(index.data.cacheKey,/^verified-title-v2:/,'old heuristic cache must be rebuilt');
  assert.equal(index.data.data.unresolved.find(row=>row.id===missing.id)?.reason,'unverified_title');
  // A separate cold cache and missing executable simulate an unavailable worker.
  config.viewerCacheDir=resolve(root,'unavailable-cache');process.env.TAIKO_PYTHON_EXECUTABLE=resolve(root,'missing-python');
  const unavailable=await import(pathToFileURL(compiled).href+'?unavailable');
  const fallback=await unavailable.getSongDetailPayload(song.id);
  assert.equal(fallback.song.id,song.id);assert.equal(fallback.ratingEntries.length,1);assert.equal(fallback.tjaBundleUrl,null);
  const absent=await unavailable.getSongDetailPayload(999932);assert.equal(absent.song,null);
 }finally{
  process.chdir(cwd);delete globalThis.useRuntimeConfig;
  if(python===undefined)delete process.env.TAIKO_PYTHON_EXECUTABLE;else process.env.TAIKO_PYTHON_EXECUTABLE=python;
  await rm(root,{recursive:true,force:true});
 }
});
