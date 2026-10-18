import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
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
  await writeFile(resolve(root,'songs/song_data.json'),JSON.stringify([song]));
  await writeFile(resolve(root,'songs/rating_structured_with_ids.json'),JSON.stringify({songs:{test:{id:song.id,level:4,score:1}}}));
  await writeFile(resolve(root,'logs/ese_audio_sync_report.json'),JSON.stringify({repo:{repo_path:resolve(root,'tja')}}));
  await writeFile(resolve(root,'tja/synthetic.tja'),'TITLE:Synthetic Song\nBPM:120\nWAVE:synthetic.ogg\nOFFSET:0\nCOURSE:Oni\nLEVEL:1\n#START\n1111,\n#END\n');
  await writeFile(resolve(root,'tja/synthetic.ogg'),'synthetic audio bytes');
  const output=await build({entryPoints:[resolve(viewer,'server/services/content/songs.ts')],bundle:true,platform:'node',format:'esm',write:false});
  const compiled=resolve(root,'songs.mjs');await writeFile(compiled,output.outputFiles[0].text);
  const healthy=await import(pathToFileURL(compiled).href+'?healthy');
  const detail=await healthy.getSongDetailPayload(song.id);
  assert.equal(detail.song.id,song.id);assert.equal(detail.ratingEntries.length,1);
  assert.equal(detail.tjaBundleUrl,`/api/content/songs/${song.id}/tja-package`);
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
