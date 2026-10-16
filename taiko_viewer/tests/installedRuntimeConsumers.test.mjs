import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {withPublicationLease} from '../server/infrastructure/taiko-publication/client.ts';
import {openMergedReadWorker} from '../server/infrastructure/account/merged-read-worker.ts';
import {runPythonJson,runGrowthPythonJson} from '../server/services/account/python-compute.ts';
import {getTaikoPython,getTaikoPythonEnv} from '../server/utils/taiko-python.ts';

const fixture=JSON.parse(await readFile(new URL('./fixtures/installedRuntimeCatalog.json',import.meta.url),'utf8'));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function isolated(task){
 const root=await mkdtemp('/var/tmp/viewer-installed-consumers-'),old={...process.env},runtime=globalThis.useRuntimeConfig;
 try{
  assert.ok(process.env.TAIKO_PYTHON_EXECUTABLE?.startsWith('/var/tmp/'),'Select a QA wheel interpreter');
  const userdataDir=join(root,'userdata');await mkdir(userdataDir);await mkdir(join(root,'songs'));
  const charts={},catalog=[],rolls=[],records=[];
  for(let i=0;i<80;i++){
   const id=10000+i,title=`Synthetic ${i}`,combo=Number(fixture.chart.combo),good=Math.floor(combo*.96);
   charts[id]={...fixture.chart,id,level:4,title,song_name:title};
   catalog.push({id,song_name:title,song_name_jp:title,level_4:9,shelf_status:0,max_combo:[0,0,0,combo,0]});
   rolls.push({...fixture.roll,id,level:4,title,song_name:title});
   if(i<30)records.push({song_no:id,level:4,good_cnt:good,ok_cnt:combo-good-1,ng_cnt:1,high_score:900000,stage_cnt:1,clear_cnt:1,full_combo_cnt:0,dondaful_combo_cnt:0});
  }
  for(const [name,value] of Object.entries({rating_structured_with_ids:{songs:charts,const_table:fixture.const_table},song_data:catalog,song_data_raw:catalog,song_alias:[],song_score:[],taiko_goku_onis:rolls,taiko_goku_all_levels_stream:[]}))await writeFile(join(root,'songs',name+'.json'),JSON.stringify(value));
  // Poison both import search inputs. -I must ignore them; data cwd remains explicit.
  for(const name of ['taiko_bot','plugins','taiko_store']){await mkdir(join(root,name));await writeFile(join(root,name,'__init__.py'),"raise RuntimeError('SOURCE_FALLBACK_USED')");}
  Object.assign(process.env,{PYTHONPATH:root,TAIKO_RUNTIME_ENV_FILE:join(root,'absent.env'),TAIKO_CONFIG_PATH:join(root,'absent.json'),MPLCONFIGDIR:join(root,'mpl'),TAIKO_USERDATA_DIR:userdataDir});
  globalThis.useRuntimeConfig=()=>({repoRoot:root,userdataDir});
  const paths={repoRoot:root,userdataDir,configPath:join(root,'absent.json'),cacheDir:join(root,'cache')};
  const publish=async(id,score=900000,delta=false)=>withPublicationLease({root:userdataDir,repoRoot:root,identity:id,mode:'write'},async lease=>{
   const payload={profile:{userid:id,mydon_name:'Synthetic '+id},achievement:{},songs:records.map(row=>({...row,high_score:score}))};
   await lease.put('current',JSON.stringify(payload));
   await lease.put(delta?'history/data_20260102_000000_000001_wahlap.json':'history/data_20260101_000000_000001_wahlap.json',JSON.stringify({...payload,_meta:{full:!delta,source:'wahlap'}}));
   return lease.publish();
  });
  await publish('111');await publish('222',950000);
  await task({root,paths,publish});
 }finally{
  globalThis.useRuntimeConfig=runtime;
  for(const key of Object.keys(process.env))if(!(key in old))delete process.env[key];Object.assign(process.env,old);
  await rm(root,{recursive:true,force:true});
 }
}

test('real Viewer compute consumes installed canonical data despite poisoned cwd and missing projection',{timeout:120000},()=>isolated(async({root,paths})=>{
 const calls=[()=>runPythonJson(['rating','111']),()=>runPythonJson(['ordinary','111','--basis','rating','--limit','3']),()=>runPythonJson(['target','111','--target','full_combo','--limit','3']),()=>runGrowthPythonJson('111','FULL_HISTORY',3)];
 const expected=[];
 for(const call of calls){
  let result;
  try{result=await call();}catch(error){
   // Only this synthetic root is used. Retain bounded diagnostics for role incompatibility.
   try{await promisify(execFile)(getTaikoPython(),['-I','-m','taiko_bot.offline.recommendation_intelligence','rating','111'],{cwd:root,env:{...getTaikoPythonEnv(root),TAIKO_COMPUTE_ONLY:'1'},timeout:15000,maxBuffer:8192});}
   catch(probe){console.log('Synthetic role diagnostic: '+String(probe.stderr||'').slice(-1200));}
   throw error;
  }
  delete result.timing;expected.push(hash(result));
 }
 assert.equal((await calls[0]()).sampleCount,30);
 await unlink(join(paths.userdataDir,'111data.json'));
 for(let i=0;i<calls.length;i++){const result=await calls[i]();delete result.timing;assert.equal(hash(result),expected[i]);}
 const manifest=JSON.parse(await readFile(join(paths.userdataDir,'.taiko-publications/111/committed.json'),'utf8'));
 await writeFile(join(paths.userdataDir,'.taiko-publications/111/objects',manifest.files.current.sha256),'corrupt');
 await assert.rejects(calls[0],error=>error.statusCode===503&&!error.message.includes(root));
 console.log(JSON.stringify({consumer:'Viewer compute',role:process.env.RUNTIME_QA_ROLE,outputHashes:expected}));
}));

test('installed merged worker preserves vector, raw history, leases and error classification',{timeout:60000},()=>isolated(async({paths,publish})=>{
 const heads=[await publish('111',980000,true),await publish('222',950000)];
 let historyHash;
 for(const kind of ['current','history']){
  const worker=await openMergedReadWorker(paths,['111','222'],'111',kind,true);
  try{
   assert.deepEqual(worker.views.map(row=>[row.identity,row.commitId,row.sequence]),heads.map(row=>[row.identity,row.commitId,row.sequence]));assert.ok(worker.alive());
   const payload=await worker.derive();
   if(kind==='current')assert.equal(payload.songs[0].high_score,980000);
   else{
    assert.equal(payload.historyFormat,'raw-v1');assert.ok(payload.snapshots.length>=2);
    assert.equal(payload.snapshots.at(-1).payload.songs[0].high_score,980000);
    assert.equal(payload.snapshots.at(-1).payload.profile.mydon_name,'Synthetic 111');
    historyHash=hash(payload);
   }
   console.log(JSON.stringify({consumer:'merged '+kind,outputHash:hash(payload)}));
  }finally{await worker.close();}
  assert.equal(worker.alive(),false);
 }
 for(const id of ['111','222'])await rm(join(paths.userdataDir,id),{recursive:true,force:true});
 const reread=await openMergedReadWorker(paths,['111','222'],'111','history',true);
 try{assert.equal(hash(await reread.derive()),historyHash);}finally{await reread.close();}
 const held=await openMergedReadWorker(paths,['111','222'],'111','current');
 let finished=false;
 const writer=publish('111',990000).then(()=>{finished=true;});
 try{await new Promise(resolve=>setTimeout(resolve,150));assert.equal(finished,false);}
 finally{await held.close();await writer;}
 await publish('111'); // EX admission proves worker released its source SH lease.
 await assert.rejects(openMergedReadWorker(paths,['111','111'],'111','current'),error=>error.statusCode===503);
 process.env.TAIKO_PYTHON_EXECUTABLE='/usr/bin/python3';
 await assert.rejects(openMergedReadWorker(paths,['111','222'],'111','current'),error=>error.statusCode===503);
 await assert.rejects(runPythonJson(['rating','111']),error=>error.statusCode===502);
}));

test('one absolute interpreter selector rejects relative/NUL and strips import overrides',()=>{
 assert.throws(()=>getTaikoPython('python3'));assert.throws(()=>getTaikoPython('/bad\0python'));
 assert.equal(getTaikoPython('/absolute/python'),'/absolute/python');
 assert.equal(getTaikoPythonEnv('/synthetic').PYTHONPATH,undefined);
 assert.equal(getTaikoPythonEnv('/synthetic').PYTHONHOME,undefined);
});
