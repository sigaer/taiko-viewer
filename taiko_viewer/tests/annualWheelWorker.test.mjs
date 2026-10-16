import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';
import { mkdtemp, mkdir, rm, access, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, extname } from 'node:path';

const project=fileURLToPath(new URL('../',import.meta.url));
registerHooks({resolve(specifier,context,next){
  if(specifier.startsWith('~/'))return next(pathToFileURL(resolve(project,specifier.slice(2))).href+'.ts',context);
  if(specifier.startsWith('.')&&!extname(specifier))return next(specifier+'.ts',context);
  return next(specifier,context);
}});

test('installed annual consumers and failures retain admission and cgroup isolation', {timeout:120000}, async t=>{
 const root=await mkdtemp('/var/tmp/annual-test-wheel-');
 const old={...process.env};
 const outcomes=[];
 try{
  for(const dir of ['userdata','cache','admission','tmp','songs','poison/taiko_bot'])await mkdir(resolve(root,dir),{recursive:true});
  Object.assign(process.env,{ANNUAL_E2E_ISOLATED_ROOT:root,ANNUAL_E2E_SYNTHETIC_DATA:'1',TAIKO_ALLOW_TEST_DB_MUTATION:'1',TAIKO_DB_NAME:'wheel_worker_test',
    TAIKO_USERDATA_DIR:resolve(root,'userdata'),TAIKO_ANNUAL_CACHE_DIR:resolve(root,'cache'),TAIKO_ANNUAL_ADMISSION_DIR:resolve(root,'admission')});
  assert.ok(process.env.TAIKO_PYTHON_EXECUTABLE,'Select an independently installed wheel interpreter');
  const selectedPython=process.env.TAIKO_PYTHON_EXECUTABLE;
  await writeFile(resolve(root,'poison/taiko_bot/__init__.py'),'raise RuntimeError("source shadow imported")\n');
  const {annualAdmission}=await import('../server/services/account/annual-summary/admission.ts');
  const {spawnAnnualWorker,stopAnnualWorker}=await import('../server/services/account/annual-summary/isolated-worker.ts');
  const env={...process.env,PYTHONPATH:resolve(root,'poison'),TAIKO_OFFLINE_ROOT:root,TAIKO_CENTER_ROOT:root,TAIKO_RUNTIME_ROOT:root};
  async function run(label,args,timeoutMs=20000){
   let workerId;
   try{
    return await annualAdmission.run('generator',label,30000,async id=>{
     workerId=id;
     const child=await spawnAnnualWorker('generator',id,{cwd:resolve(root,'poison'),args,env},timeoutMs);
     return await new Promise((resolveRun,reject)=>{
      let output='',bytes=0,errorBytes=0;let failure;
      const timer=setTimeout(()=>{failure=new Error('worker exceeded test deadline');stopAnnualWorker('generator',id);},timeoutMs+5000);
      child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>1024*1024){failure=new Error('worker output limit');stopAnnualWorker('generator',id);}else output+=chunk;});
      child.stderr.on('data',chunk=>{errorBytes+=chunk.length;if(errorBytes>8192){failure=new Error('worker stderr limit');stopAnnualWorker('generator',id);}});
      child.on('error',error=>{failure=error;stopAnnualWorker('generator',id);});
      child.on('close',code=>{
       clearTimeout(timer);
       outcomes.push({label,exitCode:code,stdoutSha256:createHash('sha256').update(output).digest('hex'),stderrBytes:errorBytes});
       if(failure||code!==0)reject(failure||new Error(`worker failed: ${code}`));
       else resolveRun(output);
      });
     });
    });
   }finally{
    if(workerId){
     const cgroup=`/sys/fs/cgroup/development.slice/development-qa.slice/taiko-annual-generator-${workerId}.service`;
     const paths=[cgroup,resolve(root,'tmp',workerId),resolve(root,'admission',`${workerId}.config`)];
     for(let i=0;i<20;i++){if((await Promise.all(paths.map(path=>access(path).then(()=>false,()=>true)))).every(Boolean))break;await new Promise(r=>setTimeout(r,100));}
     await assert.rejects(access(cgroup),'worker cgroup must be collected before admission is released');
     await assert.rejects(access(paths[1]),'worker temp directory must be removed');
     await assert.rejects(access(paths[2]),'worker config must be removed');
    }
   }
  }
  await t.test('installed origin survives poisoned cwd and PYTHONPATH',async()=>{
   const result=JSON.parse(await run('wheel-origin',['-I','-c',"import json,sys,taiko_bot.offline;print(json.dumps({'python':sys.executable,'package':taiko_bot.offline.__file__,'isolated':sys.flags.isolated,'cgroup':open('/proc/self/cgroup').read()}))"]));
   assert.equal(result.python,selectedPython);assert.equal(result.isolated,1);
   assert.match(result.package,/site-packages\/taiko_bot\/offline/);
   assert.match(result.cgroup,/development-qa.slice\/taiko-annual-generator-/);
  });
  const payload={profile:{mydon_name:'Synthetic',gameCostume:{got_dan_max:1,dan_name:{grade:'1',level:1}}},achievement:{count_level:5},dojo:{},songs:[{song_no:1,level:4,high_score:1000000,best_score_rank:6,good_cnt:100,ok_cnt:0,ng_cnt:0,pound_cnt:0,combo_cnt:100,stage_cnt:2,clear_cnt:0,full_combo_cnt:0,dondaful_combo_cnt:0,update_datetime:'2026-01-01 10:00:00',highscore_datetime:'2026-01-01 10:00:00',option_flg:[1,0,0,'00']}],_meta:{full:true,source:'wahlap'}};
  await mkdir(resolve(root,'userdata/synthetic'));
  await writeFile(resolve(root,'userdata/synthetic/data_20260102_000000_000000.json'),JSON.stringify(payload));
  await writeFile(resolve(root,'userdata/syntheticdata.json'),JSON.stringify(payload));
  await writeFile(resolve(root,'songs/song_data.json'),'[]');
  await writeFile(resolve(root,'songs/rating_structured_with_ids.json'),JSON.stringify({songs:{},const_table:{const_to_score:{}}}));
  const common=['--userdata-dir',resolve(root,'userdata'),'--song-data',resolve(root,'songs/song_data.json'),'--rating-data',resolve(root,'songs/rating_structured_with_ids.json'),'--generated-at','2026-01-31T12:00:00','--output','-'];
  await t.test('ratings CLI accounts for synthetic current record with unavailable chart rating',async()=>{
   const result=JSON.parse(await run('wheel-ratings',['-I','-m','taiko_bot.offline.annual_summary','ratings',...common]));
   assert.equal(result.scannedCount,1);assert.equal(result.discardedCount,1);assert.deepEqual(result.ratings,[]);
  });
  await t.test('build CLI reads synthetic history and emits schema 4',async()=>{
   const version={key:'annual_2026',name:'Synthetic annual',startDate:'2025-10-09',endDate:'2026-09-30',endExclusive:'2026-10-01',calendarDays:357,timezone:'Asia/Shanghai',reportRevision:'annual-report-2026-r2-final-window'};
   const result=JSON.parse(await run('wheel-build',['-I','-m','taiko_bot.offline.annual_summary','build','--taiko-id','synthetic','--version','annual_2026','--version-json',JSON.stringify(version),...common]));
   assert.equal(result.summary.schemaVersion,4);
  });
  await t.test('missing installed module fails and closes its cgroup',async()=>{
   await assert.rejects(run('wheel-missing',['-I','-m','taiko_deliberately_missing_module']),/worker failed/);
  });
  await t.test('runtime deadline stops a non-exiting worker and closes its cgroup',async()=>{
   await assert.rejects(run('wheel-timeout',['-I','-c','import time; time.sleep(60)'],1500),/worker failed|deadline/);
  });
  await t.test('invalid interpreter fails before creating config or temp artifacts',async()=>{
   const before=await readdir(resolve(root,'admission'));const temps=await readdir(resolve(root,'tmp'));
   process.env.TAIKO_PYTHON_EXECUTABLE='python3';
   try{await assert.rejects(spawnAnnualWorker('generator','invalid-interpreter',{cwd:root,args:[],env},1000),/absolute/);}
   finally{process.env.TAIKO_PYTHON_EXECUTABLE=selectedPython;}
   assert.deepEqual(await readdir(resolve(root,'admission')),before);assert.deepEqual(await readdir(resolve(root,'tmp')),temps);
  });
  await t.test('unsafe isolation is refused before launching a worker',async()=>{
   process.env.ANNUAL_E2E_SYNTHETIC_DATA='0';
   try{await assert.rejects(spawnAnnualWorker('generator','invalid-isolation',{cwd:root,args:[],env},1000),/boundary/);}
   finally{process.env.ANNUAL_E2E_SYNTHETIC_DATA='1';}
  });
  console.info('annual-installed-evidence',JSON.stringify(outcomes));
 }finally{
  for(const key of Object.keys(process.env))if(!(key in old))delete process.env[key];
  Object.assign(process.env,old);await rm(root,{recursive:true,force:true});
 }
});
