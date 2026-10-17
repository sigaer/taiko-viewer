// O1 bounded cohorts: actual authenticated routes, SQL queue and isolated installed worker.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {registerHooks} from 'node:module';
import {mkdtemp,mkdir,writeFile,readFile,cp,statfs} from 'node:fs/promises';
import {resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import {qaTempPrefix,assertQaEvidencePath,assertQaPython} from './fixtures/qaPaths.mjs';
import {accountSourceFixture} from './fixtures/accountSourceHttp.mjs';
const RealDate=Date;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

export async function runAnnualO1({warmSamples=3,warmRates=[1,3,5],scale='low',formal=false,formalCold=false}={}) {
 const python=assertQaPython();
 const manifestBytes=await readFile(process.env.QA_ARTIFACT_MANIFEST),manifest=JSON.parse(manifestBytes);
 const runtime={viewerHead:execFileSync('/usr/bin/git',['rev-parse','HEAD'],{cwd:new URL('../../',import.meta.url),encoding:'utf8'}).trim(),harnessSha256:createHash('sha256').update(await readFile(new URL('./annualO1Harness.mjs',import.meta.url))).digest('hex'),viewerVersion:JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version,python,manifestSha256:createHash('sha256').update(manifestBytes).digest('hex'),candidate:manifest.candidate};
 const root=await mkdtemp(qaTempPrefix('annual-test-o1-')),outputRoot=await mkdtemp(resolve(process.env.QA_EVIDENCE_DIR,'annual-o1-')),priorEnv={...process.env},priorCwd=process.cwd();
 const evidence={status:'RUNNING',scope:formal?'CURRENT_454_WARM_COHORT':formalCold?'FORMAL_QUEUED_COLD_COHORT':'SMOKE_EVIDENCE_PENDING',root,outputRoot,scale,productionAccess:false,runtime,cold:[],warm:[],generatorLimit:2,rendererLimit:1,telemetry:'beta event sink synthetic; actual queue/worker/repository/read services retained'};
 let hook,sampler,sampling=false,resourceAlarm=null;const resourceSamples=[];
 const sampleResources=async()=>{if(sampling)return;sampling=true;try{const own=(await readFile('/proc/self/cgroup','utf8')).trim().split(':').at(-1);const ledger=await readFile(resolve(root,'admission/generator.json'),'utf8').then(JSON.parse,()=>[]);const groups=[own,...ledger.filter(x=>/^[0-9a-f-]{36}$/i.test(x.id)).map(x=>'/development.slice/development-qa.slice/taiko-annual-generator-'+x.id+'.service')];const rows=[];for(const group of groups){const data={group};for(const name of ['memory.current','memory.peak','memory.swap.current','memory.events','cpu.stat','io.stat'])data[name]=await readFile('/sys/fs/cgroup'+group+'/'+name,'utf8').catch(()=>null);if(Number(/^oom_kill (\d+)$/m.exec(data['memory.events']||'')?.[1]||0)>0||Number(/^oom (\d+)$/m.exec(data['memory.events']||'')?.[1]||0)>0)resourceAlarm='CGROUP_OOM';rows.push(data);}const memoryPsi=await readFile('/proc/pressure/memory','utf8');if(Number(/full avg10=([0-9.]+)/.exec(memoryPsi)?.[1]||0)>=2)resourceAlarm='MEMORY_PSI_FULL';resourceSamples.push({wallMs:performance.now(),groups:rows,memoryPsi});}finally{sampling=false;}};
 try{
  for(const name of ['userdata','cache','admission','tmp','songs'])await mkdir(resolve(root,name));
  Object.assign(process.env,{ANNUAL_E2E_ISOLATED_ROOT:root,ANNUAL_E2E_SYNTHETIC_DATA:'1',TAIKO_USERDATA_DIR:resolve(root,'userdata'),TAIKO_ANNUAL_CACHE_DIR:resolve(root,'cache'),TAIKO_ANNUAL_ADMISSION_DIR:resolve(root,'admission'),TAIKO_RUNTIME_ENV_FILE:resolve(root,'absent.env'),TAIKO_CONFIG_PATH:resolve(root,'absent.json'),TAIKO_ANNUAL_POLICY_FILE:resolve(root,'annual-policy.json')});
  await sampleResources();sampler=setInterval(()=>{void sampleResources().catch(()=>{});},200);
  await writeFile(resolve(root,'annual-policy.json'),JSON.stringify({mode:'public',pauseGeneration:false,pauseRendering:false,refreshImports:false,archiveFallback:false}));
  await accountSourceFixture(async c=>{
   // Annual queue transactions do not mutate source scores and must not acquire a source writer lease.
   c.state.expectedSourceMode='none';
   globalThis.Date=RealDate; // queue leases and incident wall clock must advance normally.
   await cp(c.config.userdataDir,resolve(root,'userdata'),{recursive:true});
   c.config.userdataDir=resolve(root,'userdata');c.config.accountCacheDir=resolve(root,'cache');c.config.repoRoot=root;
   process.chdir(new URL('../',import.meta.url).pathname);
  hook=registerHooks({resolve(specifier,context,next){if(specifier.endsWith('/services/annual-beta/events.ts')||specifier==='~/server/services/annual-beta/events')return {url:'data:text/javascript,export const trackBetaServer=async()=>{};export const trackBetaUser=async()=>{};',shortCircuit:true};if(specifier==='~/server/services/content'||specifier.endsWith('/server/services/content.ts'))return {url:'data:text/javascript,export const getSongCatalog=async()=>globalThis.__annualO1Catalog||[];export const getRatingEntries=async()=>[];export const getSongCoverUrl=id=>%22/synthetic-cover/%22%2Bid;',shortCircuit:true};return next(specifier,context);}});
   // Existing SQL fixture intentionally stubs Beta telemetry. Supply all exports
   // used by Annual; no scheduler, repository, generator or reader is mocked.
   const source=await readFile(new URL('../server/utils/account-db.ts',import.meta.url),'utf8');
   const [[guard]]=await c.pool.query('SELECT DATABASE() AS name,@@datadir AS datadir');assert.match(guard.name,/_test$/);assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1');evidence.databaseProof=guard;
   const connection=await c.pool.getConnection();try{
    await connection.query('SET FOREIGN_KEY_CHECKS=0');
    for(const match of source.matchAll(/`(CREATE TABLE IF NOT EXISTS web_annual_[\s\S]*?ENGINE=InnoDB DEFAULT CHARSET=utf8mb4)`/g))await connection.query(match[1]);
    await connection.query('SET FOREIGN_KEY_CHECKS=1');
    for(const match of source.matchAll(/"(ALTER TABLE web_annual_[^"]+)"/g))try{await connection.query(match[1]);}catch(e){if(![1060,1061,1091].includes(e.errno))throw e;}
    for(const sql of ["ALTER TABLE web_annual_summary_access ADD COLUMN enabled TINYINT NOT NULL DEFAULT 1","ALTER TABLE web_annual_summary_access ADD COLUMN feature VARCHAR(64) NOT NULL DEFAULT 'annual_first_run_beta'"])try{await connection.query(sql);}catch(e){if(e.errno!==1060)throw e;}
   }finally{connection.release();}
   const catalogFixture=JSON.parse(await readFile(new URL('./fixtures/installedRuntimeCatalog.json',import.meta.url),'utf8'));
   const charts={},catalog=[],rolls=[],chartCount={low:16,mid:100,high:500}[scale];assert.ok(chartCount);
   for(let i=0;i<chartCount;i++){const id=100+i,title='Synthetic annual '+i;charts[id]={...catalogFixture.chart,id,level:4,title,song_name:title};catalog.push({id,song_name:title,song_name_jp:title,level_4:9,shelf_status:0,max_combo:[0,0,0,Number(catalogFixture.chart.combo),0]});rolls.push({...catalogFixture.roll,id,level:4,title,song_name:title});}
   globalThis.__annualO1Catalog=catalog;
   for(const[name,value]of Object.entries({rating_structured_with_ids:{songs:charts,const_table:catalogFixture.const_table},song_data:catalog,song_data_raw:catalog,song_alias:[],song_score:[],taiko_goku_onis:rolls,taiko_goku_all_levels_stream:[]}))await writeFile(resolve(root,'songs',name+'.json'),JSON.stringify(value));
   const payload=n=>({profile:{userid:c.taikoId,mydon_name:'Synthetic annual',gameCostume:{title:'Synthetic',titleplate_id:2,got_dan_max:1,dan_name:{grade:'1',level:1}}},achievement:{count_level:5},dojo:{},songs:Array.from({length:chartCount},(_,i)=>({song_no:100+i,level:4,high_score:800000+n*10000,best_score_rank:4,good_cnt:500,ok_cnt:20,ng_cnt:5,pound_cnt:0,combo_cnt:100,stage_cnt:n+1,clear_cnt:1,full_combo_cnt:0,dondaful_combo_cnt:0,update_datetime:`2026-01-0${n+2} 10:00:00`,highscore_datetime:`2026-01-0${n+2} 10:00:00`,option_flg:[1,0,0,'00']})),_meta:{full:true,source:'wahlap'}});
   await mkdir(resolve(root,'userdata',c.taikoId),{recursive:true});
   const snapshotCount={low:3,mid:40,high:200}[scale];assert.ok(snapshotCount);evidence.input={syntheticIdentity:c.taikoId,snapshotCount,chartCount};
   const inputHash=createHash('sha256'); inputHash.update(JSON.stringify(catalog));
   let lastPayload;for(let n=0;n<snapshotCount;n++){const at=new RealDate(RealDate.parse('2026-01-02T02:00:00Z')+n*86400000);const stamp=at.toISOString().replaceAll('-','').replaceAll(':','').slice(0,15).replace('T','_');const data=payload(2);for(const song of data.songs){song.stage_cnt=n+1;song.high_score=800000+n*100; song.update_datetime=at.toISOString();song.highscore_datetime=at.toISOString();}const serialized=JSON.stringify(data);inputHash.update(stamp+'\0'+serialized+'\0');await writeFile(resolve(root,'userdata',c.taikoId,`data_${stamp}_000000.json`),serialized);lastPayload=data;}
   await writeFile(resolve(root,'userdata',c.taikoId+'data.json'),JSON.stringify(lastPayload));
   evidence.input.sha256=inputHash.digest('hex');
   // No source publication write occurs during this frozen synthetic input.
   c.route('post','/annual/:key/build',(await import('../server/api/account/annual-summaries/[key]/build.post.ts')).default);
   c.route('get','/annual/:key',(await import('../server/api/account/annual-summaries/[key].get.ts')).default);
   c.route('get','/annual-job/:jobId',(await import('../server/api/account/annual-summary-jobs/[jobId].get.ts')).default);
   const negative=await c.request('GET','/annual/annual_2026',null,'');await negative.text();evidence.anonymousStatus=negative.status;assert.equal(negative.status,401);
   const disk=await statfs(root);evidence.preAdmissionDisk={availableBytes:disk.bavail*disk.bsize,criticalBytes:22*1024**3};
   assert.equal(resourceAlarm,null,'pressure admission must be safe');
   const started=performance.now();evidence.cold.push({status:'submitted',scale});const queued=await c.request('POST','/annual/annual_2026/build',{});const body=await queued.json();
   evidence.cold[0]={status:queued.status>=400?'http-failed':'queued',queueHttpStatus:queued.status,totalWallMs:performance.now()-started};evidence.queueHttpStatus=queued.status;evidence.queueError=queued.status>=400?{statusMessage:body.statusMessage||body.message||null,code:body.data?.code||null}:null;assert.ok([200,202].includes(queued.status));assert.ok(body.job?.id);
   let terminal,firstRunningMs=null;
   while(performance.now()-started<180000){if(resourceAlarm)break;const poll=await c.request('GET','/annual-job/'+body.job.id);const state=await poll.json();assert.equal(poll.status,200);const job=state.job||state;if(job.status==='running'&&firstRunningMs===null)firstRunningMs=performance.now()-started;if(['completed','failed','expired','cancelled'].includes(job.status)){terminal=job;break;}await sleep(100);}
   evidence.cold[0]={jobId:body.job.id,status:terminal?.status||(resourceAlarm?'resource-stop':'unfinished'),totalWallMs:performance.now()-started,firstRunningObservedMs:firstRunningMs,queueWaitPrecision:'100ms polling upper bound; not pure generator time',errorCode:terminal?.errorCode||terminal?.error_code||null,createdAt:terminal?.createdAt,startedAt:terminal?.startedAt,completedAt:terminal?.completedAt};
   assert.equal(terminal?.status,'completed');
   const quantile=(values,p)=>values.length?[...values].sort((a,b)=>a-b)[Math.max(0,Math.ceil(values.length*p)-1)]:null;
   for(const rate of warmRates){
    const rows=[],pending=new Set(),stageStart=performance.now();
    for(let i=0;i<warmSamples;i++){
     if(resourceAlarm){for(let j=i;j<warmSamples;j++)rows.push({index:j,status:'dropped',reason:resourceAlarm});break;}
     const scheduledAt=stageStart+i*1000/rate;await sleep(Math.max(0,scheduledAt-performance.now()));
     const start=performance.now();
     if(pending.size>=5){rows.push({index:i,status:'dropped',scheduledOffsetMs:i*1000/rate,arrivalDelayMs:start-scheduledAt});continue;}
     const work=(async()=>{try{const response=await c.request('GET','/annual/annual_2026');const data=await response.json();rows.push({index:i,status:response.status,wallMs:performance.now()-start,scheduledOffsetMs:i*1000/rate,arrivalDelayMs:start-scheduledAt,hasSummary:Boolean(data.summary),algorithmVersion:data.summary?.provenance?.algorithmVersion});}catch(error){rows.push({index:i,status:error.name==='TimeoutError'?'timeout':'failed',wallMs:performance.now()-start});}})();
     pending.add(work);work.finally(()=>pending.delete(work));
    }
    await Promise.all(pending);
    const successful=rows.filter(x=>x.status===200&&x.hasSummary&&x.algorithmVersion==='annual-observation-v4.5.4');
    const failures=rows.filter(x=>!successful.includes(x));
    const values=successful.map(x=>x.wallMs),stage={requestsPerSecond:rate,planned:warmSamples,samples:rows.sort((a,b)=>a.index-b.index),success:successful.length,failures:failures.length,http429:rows.filter(x=>x.status===429).length,timeouts:rows.filter(x=>x.status==='timeout').length,dropped:rows.filter(x=>x.status==='dropped').length,p50Ms:quantile(values,.50),p95Ms:quantile(values,.95),p99Ms:quantile(values,.99)};
    stage.status=successful.length/warmSamples>=.995&&stage.p95Ms<=800&&stage.p99Ms<=2000?'PASS':'FAIL';
    evidence.warm.push(stage);assert.equal(stage.status,'PASS','warm stage prerequisite before increasing arrival rate');
   }
   const ledger=JSON.parse(await readFile(resolve(root,'admission/generator.json'),'utf8'));assert.ok(ledger.every(x=>!['queued','running'].includes(x.state)));evidence.workerLedger=ledger.map(x=>({state:x.state,id:x.id}));
   assert.equal(resourceAlarm,null,'resource guard must remain clear');
   evidence.status=formal?'PASS_WARM_COHORT_COLD_SAMPLE_ONLY':formalCold?'PASS_COLD_SAMPLE_EVIDENCE_PENDING':'PASS_SMOKE_EVIDENCE_PENDING';
  },{withDeveloper:true,requestTimeoutMs:15000});
 }catch(e){evidence.status='FAIL';evidence.failure={name:e.name,message:String(e.message).slice(0,600)};throw e;}
 finally{clearInterval(sampler);while(sampling)await sleep(10);await sampleResources().catch(()=>{});evidence.resourceSamples=resourceSamples;evidence.resourceAlarm=resourceAlarm;delete globalThis.__annualO1Catalog;hook?.deregister();process.chdir(priorCwd);globalThis.Date=RealDate;for(const key of Object.keys(process.env))if(!(key in priorEnv))delete process.env[key];Object.assign(process.env,priorEnv);await writeFile(assertQaEvidencePath(resolve(outputRoot,'evidence.json')),JSON.stringify(evidence,null,2)+'\n',{mode:0o600});console.log('ANNUAL_O1_EVIDENCE '+resolve(outputRoot,'evidence.json'));}
}
