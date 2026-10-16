// O1 smoke only: actual authenticated routes, SQL queue and isolated installed worker.
import assert from 'node:assert/strict';
import test from 'node:test';
import {registerHooks} from 'node:module';
import {mkdtemp,mkdir,writeFile,readFile,cp,rm,statfs} from 'node:fs/promises';
import {resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {accountSourceFixture} from './fixtures/accountSourceHttp.mjs';
const RealDate=Date;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

test('Annual O1 legacy cached GET smoke without cold generation',{timeout:240000},async()=>{
 const root=await mkdtemp('/var/tmp/annual-test-o1-'),priorEnv={...process.env},priorCwd=process.cwd();
 const evidence={status:'RUNNING',scope:'LEGACY_453_WARM_SMOKE_EVIDENCE_PENDING',root,productionAccess:false,cold:'NOT_EXECUTED',warm:[],generatorLimit:2,rendererLimit:1,telemetry:'beta event sink synthetic; actual queue/worker/repository/read services retained'};
 let hook;
 try{
  for(const name of ['userdata','cache','admission','tmp','songs'])await mkdir(resolve(root,name));
  Object.assign(process.env,{ANNUAL_E2E_ISOLATED_ROOT:root,ANNUAL_E2E_SYNTHETIC_DATA:'1',TAIKO_USERDATA_DIR:resolve(root,'userdata'),TAIKO_ANNUAL_CACHE_DIR:resolve(root,'cache'),TAIKO_ANNUAL_ADMISSION_DIR:resolve(root,'admission'),TAIKO_RUNTIME_ENV_FILE:resolve(root,'absent.env'),TAIKO_CONFIG_PATH:resolve(root,'absent.json'),TAIKO_ANNUAL_POLICY_FILE:resolve(root,'annual-policy.json')});
  await writeFile(resolve(root,'annual-policy.json'),JSON.stringify({mode:'public',pauseGeneration:false,pauseRendering:false,refreshImports:false,archiveFallback:false}));
  await accountSourceFixture(async c=>{
   await c.pool.execute('UPDATE web_taiko_bindings SET taiko_id=? WHERE id=?',['synthetic',c.bindingId]);c.taikoId='synthetic';c.ownedTokenIds.add('synthetic');
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
    for(const sql of ["ALTER TABLE web_annual_summary_access ADD COLUMN enabled TINYINT NOT NULL DEFAULT 1","ALTER TABLE web_annual_summary_access ADD COLUMN feature VARCHAR(64) NOT NULL DEFAULT 'annual_first_run_beta'"])await connection.query(sql);
   }finally{connection.release();}
   const catalogFixture=JSON.parse(await readFile(new URL('./fixtures/installedRuntimeCatalog.json',import.meta.url),'utf8'));
   const charts={},catalog=[],rolls=[];
   for(let i=0;i<16;i++){const id=100+i,title='Synthetic annual '+i;charts[id]={...catalogFixture.chart,id,level:4,title,song_name:title};catalog.push({id,song_name:title,song_name_jp:title,level_4:9,shelf_status:0,max_combo:[0,0,0,Number(catalogFixture.chart.combo),0]});rolls.push({...catalogFixture.roll,id,level:4,title,song_name:title});}
   globalThis.__annualO1Catalog=catalog;
   for(const[name,value]of Object.entries({rating_structured_with_ids:{songs:charts,const_table:catalogFixture.const_table},song_data:catalog,song_data_raw:catalog,song_alias:[],song_score:[],taiko_goku_onis:rolls,taiko_goku_all_levels_stream:[]}))await writeFile(resolve(root,'songs',name+'.json'),JSON.stringify(value));
   const payload=n=>({profile:{userid:c.taikoId,mydon_name:'Synthetic annual',gameCostume:{title:'Synthetic',titleplate_id:2,got_dan_max:1,dan_name:{grade:'1',level:1}}},achievement:{count_level:5},dojo:{},songs:Array.from({length:16},(_,i)=>({song_no:100+i,level:4,high_score:800000+n*10000,best_score_rank:4,good_cnt:500,ok_cnt:20,ng_cnt:5,pound_cnt:0,combo_cnt:100,stage_cnt:n+1,clear_cnt:1,full_combo_cnt:0,dondaful_combo_cnt:0,update_datetime:`2026-01-0${n+2} 10:00:00`,highscore_datetime:`2026-01-0${n+2} 10:00:00`,option_flg:[1,0,0,'00']})),_meta:{full:true,source:'wahlap'}});
   await mkdir(resolve(root,'userdata',c.taikoId),{recursive:true});
   for(let n=0;n<3;n++)await writeFile(resolve(root,'userdata',c.taikoId,`data_2026010${n+2}_100000_000000.json`),JSON.stringify(payload(n)));
   await writeFile(resolve(root,'userdata',c.taikoId+'data.json'),JSON.stringify(payload(2)));
   // No source publication write occurs during this frozen synthetic input.
   c.route('post','/annual/:key/build',(await import('../server/api/account/annual-summaries/[key]/build.post.ts')).default);
   c.route('get','/annual/:key',(await import('../server/api/account/annual-summaries/[key].get.ts')).default);
   c.route('get','/annual-job/:jobId',(await import('../server/api/account/annual-summary-jobs/[jobId].get.ts')).default);
   const negative=await c.request('GET','/annual/annual_2026',null,'');await negative.text();evidence.anonymousStatus=negative.status;assert.equal(negative.status,401);
   const fixturePath='/var/tmp/annual-o1-warm-fixture-20261016/oracle-preserved-legacy-envelope.json';
   const fixtureRaw=await readFile(fixturePath,'utf8');
   const fixtureSha=createHash('sha256').update(fixtureRaw).digest('hex');
   assert.equal(fixtureSha,'6790105d0c099512cfa2a5a86f3b37021583494075b283488ea8d630be69d8c8');
   const envelope=JSON.parse(fixtureRaw);
   // The actual Viewer publication step normalizes the version envelope before
   // first persistence. Preserve the generator artifact; seed a NEW fixture only.
   const {getAnnualVersion}=await import('../server/services/account/annual-summary/constants.ts');
   const summary={...envelope.summary,version:getAnnualVersion()};
   assert.equal(summary.provenance.algorithmVersion,'annual-observation-v4.5.3');
   const summaryPath=resolve(root,'cache','preserved-summary.json'),eventsPath=resolve(root,'cache','preserved-events.json');
   const summaryRaw=JSON.stringify(summary);await writeFile(summaryPath,summaryRaw);await writeFile(eventsPath,JSON.stringify(envelope.events));
   await c.pool.execute('INSERT INTO web_annual_summaries(id,user_id,binding_id,version_key,schema_version,data_mode,input_fingerprint,summary_path,events_path,event_count,generated_at) VALUES (?,?,?,?,4,?,?,?,?,?,?)',[summary.summaryId,c.user,c.bindingId,'annual_2026',summary.mode,summary.provenance.inputFingerprint,summaryPath,eventsPath,envelope.events.length,new Date(summary.generatedAt)]);
   evidence.fixture={path:fixturePath,sha256:fixtureSha,algorithmVersion:summary.provenance.algorithmVersion,summaryId:summary.summaryId,source:'Synthetic frozen differential fixture preserved by the installed 0.14.2 oracle test; new fixture first publication uses the existing Viewer version normalization',publicationVersionNormalization:true,originalEffectiveEndDate:envelope.summary.version.effectiveEndDate,publishedEffectiveEndDate:summary.version.effectiveEndDate,publishedSha256:createHash('sha256').update(summaryRaw).digest('hex')};
   // Three tiny stages exercise scheduling only; they never qualify as SLO cohorts.
   for(const rate of [1,3,5]){const rows=[],stageStart=performance.now();for(let i=0;i<3;i++){const scheduledAt=stageStart+i*1000/rate;await sleep(Math.max(0,scheduledAt-performance.now()));const start=performance.now();const response=await c.request('GET','/annual/annual_2026');const data=await response.json();rows.push({status:response.status,wallMs:performance.now()-start,scheduledOffsetMs:i*1000/rate,arrivalDelayMs:start-scheduledAt,hasSummary:Boolean(data.summary),summaryId:data.summary?.summaryId,algorithmVersion:data.summary?.provenance?.algorithmVersion});if(response.status!==200||!data.summary)break;}evidence.warm.push({requestsPerSecond:rate,samples:rows});assert.ok(rows.every(x=>x.status===200&&x.hasSummary&&x.summaryId===summary.summaryId&&x.algorithmVersion===summary.provenance.algorithmVersion));assert.ok(rows.every(x=>x.wallMs<=800),'smoke stage p95 prerequisite before increasing arrival rate');}
   assert.equal(await readFile(summaryPath,'utf8'),summaryRaw);
   const ledger=await readFile(resolve(root,'admission/generator.json'),'utf8').then(JSON.parse,()=>[]);assert.equal(ledger.length,0,'Warm-only must never create a generator admission');evidence.generatorAdmissions=0;
   evidence.status='PASS_SMOKE_EVIDENCE_PENDING';
  },{withDeveloper:true,requestTimeoutMs:15000});
 }catch(e){evidence.status='FAIL';evidence.failure={name:e.name,message:String(e.message).slice(0,600)};throw e;}
 finally{delete globalThis.__annualO1Catalog;hook?.deregister();process.chdir(priorCwd);globalThis.Date=RealDate;for(const key of Object.keys(process.env))if(!(key in priorEnv))delete process.env[key];Object.assign(process.env,priorEnv);await writeFile(resolve(root,'evidence.json'),JSON.stringify(evidence,null,2)+'\n',{mode:0o600});console.log('ANNUAL_O1_WARM_EVIDENCE '+resolve(root,'evidence.json'));}
});
