// Synthetic HTTP lifecycle cohort. Run only via run-isolated-sql.mjs --o1=... .
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash,randomBytes} from 'node:crypto';
import {readFile,writeFile,mkdir,symlink,readdir} from 'node:fs/promises';
import {resolve,relative,isAbsolute} from 'node:path';
import {performance} from 'node:perf_hooks';
import {execFileSync} from 'node:child_process';
import {consumeO1Response,consumeO1BufferedResponse,proveO1StreamingEquivalence} from './fixtures/o1ResponseStream.mjs';
import {accountSourceFixture} from './fixtures/accountSourceHttp.mjs';
const op=process.env.TAIKO_O1_OPERATION,concurrency=Number(process.env.TAIKO_O1_CONCURRENCY),n=Number(process.env.TAIKO_O1_SAMPLES),output=process.env.TAIKO_O1_OUTPUT;
assert.ok(['private-current','private-history','private-merged-current','private-merged-history','growth-history','growth-overview','growth-passport','b30'].includes(op));assert.ok([1,3,5].includes(concurrency));assert.ok([1,3,50,200].includes(n));assert.ok(process.env.QA_EVIDENCE_DIR?.startsWith('/home/sigaer/taiko/qa-vault/'));const outputRelative=relative(process.env.QA_EVIDENCE_DIR,output||'');assert.ok(outputRelative.startsWith('viewer1-sql-')&&!outputRelative.startsWith('..')&&!isAbsolute(outputRelative));
const measurementMode=process.env.TAIKO_O1_MEASUREMENT_MODE||'stream';assert.ok(['stream','buffered-original'].includes(measurementMode));assert.ok(measurementMode!=='buffered-original'||op==='private-history');
const measurementRevision=measurementMode==='stream'?'stream-consume-v3-persistent-recovery':'buffered-original-consume-v3-persistent-recovery';
const selectedScale=process.env.TAIKO_O1_SCALE||'all';
const scales=selectedScale==='extreme'?[['extreme',500,2000]]:[['small',32,3],['medium',100,30],['large',500,90]].filter(v=>selectedScale==='all'||v[0]===selectedScale);assert.ok(scales.length);
const group=(await readFile('/proc/self/cgroup','utf8')).split('\n').find(v=>v.startsWith('0::'))?.slice(3);
assert.ok(group?.includes('development-qa.slice/taiko-qa-'));
const cg='/sys/fs/cgroup'+group;
const read=path=>readFile(path,'utf8').catch(()=>null);
const counters=text=>Object.fromEntries((text||'').trim().split('\n').filter(Boolean).map(v=>{const[k,n]=v.split(/\s+/);return[k,Number(n)]}));
const evidence={schemaVersion:1,status:'RUNNING',operation:op,concurrency,requested:n*scales.length,samplesPerScale:n,scales:[],samples:[],resource:[],productionAccess:false,clock:'performance.now; HTTP send to final body byte consumed and SHA updated',measurementRevision,measurementMode,sqlIsolation:'owned mysqld; actual SELECT DATABASE guard',loadModel:'closed loop, fixed concurrency; no arrival-rate or production claim',requestDeadlineMs:op==='b30'?30000:selectedScale==='extreme'?20000:12000,resourceScope:'cgroup includes descendants; PSS/RSS are Node process only, not process tree',queueWaitMs:null,queueWaitReason:'no application job queue for these reads; SQL/socket/source-lock wait included in lifecycle',baselineComparison:{status:'EVIDENCE_PENDING',reason:'same-input old artifact cohort not yet measured'},limitations:['synthetic catalog (100/101/102) and empty Goal/measurement rows; real SQL queries, HTTP auth, publication reader and replay','private modes use explicit service grant, no owner binding fallback; current/history are single-source, merged not measured','cold disk cache is not asserted; original page cache retained'],cgroup:group};
const audit=new URL('../../docs/platform-architecture-audit/',import.meta.url);
const baseline=process.env.TAIKO_O1_BASELINE==='1';
const artifactManifestPath=process.env.QA_ARTIFACT_MANIFEST;assert.ok(artifactManifestPath?.startsWith('/home/sigaer/taiko/qa-vault/'));
const artifacts=JSON.parse(await readFile(artifactManifestPath,'utf8'));assert.equal(artifacts.schemaVersion,1);
const artifact=artifacts[baseline?'baseline':'candidate'];assert.ok(artifact,'Requested artifact is unavailable');
const lockBytes=await readFile(artifact.lockFile);assert.equal(createHash('sha256').update(lockBytes).digest('hex'),artifact.lockSha256);
const lock=JSON.parse(lockBytes);const originName=artifact.originEvidenceFile;
const wheel=lock.roles.center.wheels.find(item=>item.name==='taiko-bot');
assert.equal(wheel.version,baseline?'0.14.1':'0.14.2');
const originalWheelSha256='0963350629b261fb5002bf6ef96c6019c22ca5c9515b73279f3c578d8e6725c8';
let derivation=null;
if(!baseline&&wheel.sha256!==originalWheelSha256){
 assert.equal(artifact.provenanceStatus,'LOCKED_SOURCE_REBUILD_DERIVED_LOCK');
 const bytes=await readFile(artifact.derivationEvidenceFile);assert.equal(createHash('sha256').update(bytes).digest('hex'),artifact.derivationEvidenceSha256);
 derivation=JSON.parse(bytes);assert.equal(derivation.status,'PASS_LOCKED_SOURCE_REBUILD');assert.equal(derivation.historicalContentParityClaim,false);assert.equal(derivation.thirdPartyWheelsUnchanged,true);assert.equal(derivation.originalWheelSha256,originalWheelSha256);assert.equal(derivation.candidateWheelSha256,wheel.sha256);
} else if(!baseline)assert.equal(wheel.sha256,originalWheelSha256);
if(baseline){const candidate=JSON.parse(await readFile(artifacts.candidate.lockFile));const remaining=role=>role.wheels.filter(v=>v.name!=='taiko-bot').map(({name,version,sha256})=>({name,version,sha256}));assert.deepEqual(remaining(lock.roles.center),remaining(candidate.roles.center));assert.equal(lock.roles.center.wheels.length,94);}
const {createReadStream}=await import('node:fs');
async function sha(path){const h=createHash('sha256');for await(const block of createReadStream(path))h.update(block);return h.digest('hex');}
assert.equal(await sha(artifact.wheelFile),wheel.sha256);
const rebuild=JSON.parse(await readFile(originName));
assert.equal(await sha(originName),artifact.originEvidenceSha256);assert.equal(process.env.TAIKO_PYTHON_EXECUTABLE,artifact.python);assert.equal(artifact.python,rebuild.installed.interpreter);
evidence.manifest={viewerBaseline:'6e7f35b',viewerVersion:'0.82.1',taikoWheelSha256:wheel.sha256,lockSha256:createHash('sha256').update(lockBytes).digest('hex'),interpreter:process.env.TAIKO_PYTHON_EXECUTABLE,centerRole:lock.roles.center.environmentIdentity,clientRole:lock.roles.client.environmentIdentity,comparisonAxis:baseline?'old Taiko artifact only; same Viewer service source':'candidate',installedOriginEvidence:originName,installedOriginEvidenceSha256:await sha(originName),testHarnessSha256:await sha(new URL(import.meta.url))};
evidence.manifest.artifactRole=baseline?'baseline':'candidate';evidence.manifest.provenanceStatus=artifact.provenanceStatus||'EXACT_ORIGINAL';evidence.manifest.historicalContentParityClaim=derivation?false:null;evidence.manifest.derivationEvidenceSha256=artifact.derivationEvidenceSha256||null;
evidence.manifest.artifactManifestSha256=await sha(artifactManifestPath);
evidence.manifest.measurementRevision=measurementRevision;evidence.manifest.measurementMode=measurementMode;evidence.clientMethodComparison={scope:'same rebuilt candidate and synthetic inputs; not old Taiko migration comparison',originalBufferedPatternSource:'dc6fa75',addedAuditWork:'both sinks compute full-body SHA within wall time',historicalFailureFixedClaim:false};
evidence.manifest.viewerWorktreeHead=execFileSync('git',['rev-parse','HEAD'],{cwd:new URL('../../',import.meta.url),encoding:'utf8'}).trim();
evidence.manifest.runtimeClosure={};for(const file of ['utils/dailyProgress.ts','server/services/growth-history/evidence.ts','server/services/growth-history/service.ts','server/services/growth-passport/service.ts','server/services/account/growth.ts','server/services/account/charts.ts'])evidence.manifest.runtimeClosure[file]=await sha(new URL('../'+file,import.meta.url));
const initial=counters(await read(cg+'/memory.events'));assert.ok(Number.isFinite(initial.oom)&&Number.isFinite(initial.oom_kill),'Cgroup OOM counters required');let stopped=null,busy=false;
async function resource(){if(busy)return;busy=true;try{const [events,pressure,io,swap,current,peak,host,smaps]=await Promise.all(['memory.events','memory.pressure','io.stat','memory.swap.current','memory.current','memory.peak'].map(p=>read(cg+'/'+p)).concat([read('/proc/meminfo'),read('/proc/self/smaps_rollup')]));const counts=counters(events),full=Number(/full avg10=([\d.]+)/.exec(pressure||'')?.[1]||0),available=Number(/MemAvailable:\s+(\d+)/.exec(host||'')?.[1]||0),total=Number(/MemTotal:\s+(\d+)/.exec(host||'')?.[1]||0);evidence.resource.push({atMs:performance.now(),memoryCurrent:current===null?'UNAVAILABLE':Number(current),memoryPeak:peak===null?'UNAVAILABLE':Number(peak),swapBytes:swap===null?'UNAVAILABLE':Number(swap),psi:pressure,io,events:counts,pssKb:Number(/Pss:\s+(\d+)/.exec(smaps||'')?.[1]||0),rssKb:Number(/Rss:\s+(\d+)/.exec(smaps||'')?.[1]||0),hostAvailableKb:available});if(!pressure||!host||!Number.isFinite(counts.oom)||!Number.isFinite(counts.oom_kill))stopped='MONITOR_UNAVAILABLE';if(counts.oom>initial.oom||counts.oom_kill>initial.oom_kill||full>=2||available<total*.30+3*1024*1024)stopped='RESOURCE_PRESSURE';}finally{busy=false;}}
const q=(xs,p)=>xs.length?[...xs].sort((a,b)=>a-b)[Math.max(0,Math.ceil(xs.length*p)-1)]:null;
test('O1 synthetic real HTTP request cohort',{timeout:570000},async()=>{
 let timer;const info=console.info;console.info=()=>{};
 try{
  await resource();assert.equal(stopped,null,'Insufficient initial resource reserve');timer=setInterval(()=>resource().catch(()=>{stopped='MONITOR_ERROR'}),200);
  await writeFile(output,JSON.stringify(evidence,null,2)+'\n',{mode:0o600});
  await accountSourceFixture(async c=>{
   c.taikoId='7000000000000142';c.ownedTokenIds.add(c.taikoId);await c.pool.execute('UPDATE web_taiko_bindings SET taiko_id=? WHERE id=?',[c.taikoId,c.bindingId]);
   const isMerged=op.startsWith('private-merged-'),isGrowth=op.startsWith('growth-'),isCompute=['growth-overview','growth-passport','b30'].includes(op)||isMerged,isAccount=isGrowth||op==='b30';
   if(isCompute){
    const fixture=JSON.parse(await readFile(new URL('./fixtures/installedRuntimeCatalog.json',import.meta.url),'utf8'));
    const charts={},catalog=[],rolls=[];
    for(let i=0;i<500;i++){const id=100+i,title='Synthetic '+i;charts[id]={...fixture.chart,id,level:4,title,song_name:title};catalog.push({id,song_name:title,song_name_jp:title,level_4:9,shelf_status:0,max_combo:[0,0,0,Number(fixture.chart.combo),0]});rolls.push({...fixture.roll,id,level:4,title,song_name:title});}
    await mkdir(resolve(c.root,'songs'));
    for(const[name,value]of Object.entries({rating_structured_with_ids:{songs:charts,const_table:fixture.const_table},song_data:catalog,song_data_raw:catalog,song_alias:[],song_score:[],taiko_goku_onis:rolls,taiko_goku_all_levels_stream:[]}))await writeFile(resolve(c.root,'songs',name+'.json'),JSON.stringify(value));
    c.config.repoRoot=c.root;process.env.TAIKO_RUNTIME_ENV_FILE=resolve(c.root,'absent.env');process.env.TAIKO_CONFIG_PATH=resolve(c.root,'absent.json');process.env.MPLCONFIGDIR=resolve(c.root,'mpl');
    if(op==='b30'){
     const assetDatasetPath=resolve(artifacts.assetsRoot,'dataset-manifest.json');const assetDataset=JSON.parse(await readFile(assetDatasetPath,'utf8'));assert.equal(assetDataset.historicalB30ResourceParityClaim,false);evidence.syntheticAssetDataset={revision:assetDataset.datasetRevision,manifestSha256:await sha(assetDatasetPath),historicalB30ResourceParityClaim:false};
     await mkdir(resolve(c.root,'assets'));
     for(const name of await readdir(artifacts.assetsRoot))if(name!=='dress')await symlink(resolve(artifacts.assetsRoot,name),resolve(c.root,'assets',name));
     const sharp=(await import('sharp')).default;evidence.syntheticDress=[];
     for(const[name,color]of [['line/line_290.png',{r:30,g:40,b:50,alpha:160/255}],['body/body_290_000.png',{r:220,g:40,b:50,alpha:1}],['skin/skin_290_000.png',{r:40,g:180,b:200,alpha:1}],['face/face_290_000.png',{r:230,g:210,b:150,alpha:1}]]){
      const path=resolve(c.root,'assets/dress/common',name);await mkdir(resolve(path,'..'),{recursive:true});await sharp({create:{width:160,height:160,channels:4,background:color}}).png().toFile(path);evidence.syntheticDress.push({name,sha256:await sha(path)});
     }
    }
    evidence.syntheticCatalogSha256=await sha(resolve(c.root,'songs/rating_structured_with_ids.json'));
   }
   c.route('get','/o1/:userid',isGrowth?(op==='growth-overview'?(await import('../server/api/account/growth/overview.get.ts')).default:op==='growth-passport'?(await import('../server/api/account/growth/passport.get.ts')).default:(await import('../server/api/account/growth/history.get.ts')).default):op==='b30'?(await import('../server/api/account/charts/b30.get.ts')).default:(op==='private-current'||op==='private-merged-current')?(await import('../server/api/developer/userdata/[userid].get.ts')).default:(await import('../server/api/taiko/proxy/userdata/[taikoId]/history.get.ts')).default);
   if(op.endsWith('history')&&!isGrowth)c.route('get','/history/:taikoId',(await import('../server/api/taiko/proxy/userdata/[taikoId]/history.get.ts')).default);
   const rawToken=randomBytes(12).toString('hex');
   const [token]=await c.pool.execute('INSERT INTO web_developer_tokens(user_id,token_hash,token_mask) VALUES (?,?,?)',[c.user,createHash('sha256').update(rawToken).digest('hex'),'synthetic-o1']);
   if(!isAccount){
    await c.pool.execute('DELETE FROM web_taiko_bindings WHERE user_id=?',[c.user]);
    await c.pool.execute("INSERT INTO taiko_source_service_grants(developer_token_id,developer_user_id,service_name,scopes_json,sources_json,revision_nonce,status,issued_by_user_id) VALUES (?,?,'o1-synthetic',?,?,?,'active',?)",[token.insertId,c.user,JSON.stringify(['source_read','history_read']),JSON.stringify([c.taikoId]),randomBytes(16).toString('hex'),c.user]);
   }
   let requestIdentity=c.taikoId;
   const second='6000000000000142';
   if(isMerged){
    const principal='qq_official:_o1_fixed_';c.state.expectedSourceMode='none';c.ownedTokenIds.add(second);
    await c.pool.execute("INSERT INTO bind(qq,id,visible,slot_index,is_current,source) VALUES (?,?,0,1,0,'wahlap'),(?,?,0,2,1,'hiroba')",[principal,c.taikoId,principal,second]);
    await c.pool.execute('INSERT INTO taiko_bind_identity_state(identity_key,current_virtual) VALUES (?,1)',[principal]);
    await c.pool.execute('UPDATE taiko_source_service_grants SET scopes_json=?,sources_json=?,principals_json=? WHERE developer_token_id=?',[JSON.stringify(['bind_read','source_read','history_read']),JSON.stringify([c.taikoId,second]),JSON.stringify([principal]),token.insertId]);
    requestIdentity=(await import('../server/infrastructure/account/merged-source-id.ts')).mergedSourceId(principal);
   }
   const path=op.endsWith('history')&&!isGrowth?'/history/'+requestIdentity:'/o1/'+requestIdentity+(op==='growth-history'?'?days=90':op==='growth-passport'?'?range=90':'');
   const headers={'x-forwarded-for':'fd00:082:142::1',...(!isAccount?{authorization:'Bearer '+rawToken}:{})};
   const negative=await c.request('GET',path,null,'',{'x-forwarded-for':'fd00:082:142::2'});await negative.text();assert.equal(negative.status,401);evidence.missingCredentialStatus=negative.status;
   let nextIndex=0;const fixtureEpoch=Date.parse('2026-10-16T04:00:00Z');
   for(const [scale,charts,history] of scales){
    if(stopped)break;
    const {openPublicationLease}=await import('../server/infrastructure/taiko-publication/client.ts');
    const lease=await openPublicationLease({root:c.config.userdataDir,repoRoot:c.config.repoRoot,identity:c.taikoId,mode:'write'});
    const secondLease=isMerged?await openPublicationLease({root:c.config.userdataDir,repoRoot:c.config.repoRoot,identity:second,mode:'write'}):null;
    const dataHash=createHash('sha256');let lastPayload;
    try{
     for(let h=0;h<history;h++){
      const day=new Date(fixtureEpoch-(history-h)*86400000).toISOString().slice(0,10),ts=day+' 12:00:00';
      const songs=Array.from({length:charts},(_,i)=>({song_no:100+i,level:4,high_score:900000+h,good_cnt:500,ok_cnt:20,ng_cnt:8,combo_cnt:300,stage_cnt:h+1,clear_cnt:h+1,full_combo_cnt:0,dondaful_combo_cnt:0,best_score_rank:5,update_datetime:ts,highscore_datetime:ts}));
      const payload=JSON.stringify({_meta:{full:true,ts,source:'wahlap'},profile:{userid:c.taikoId,...(op==='b30'?{gameCostume:{color_limb:0,color_body:0,color_face:0}}:{})},songs});
      dataHash.update(payload);lastPayload=payload;
      await lease.put('history/data_'+day+'_12_00_00.json',payload);if(h===history-1)await lease.put('current',payload);
      if(secondLease){const other=JSON.stringify({_meta:{full:true,ts,source:'hiroba'},profile:{userid:second},songs:songs.map(v=>({...v,high_score:v.high_score+1000}))});dataHash.update(other);await secondLease.put('history/data_'+day+'_12_00_00.json',other);if(h===history-1)await secondLease.put('current',other);}
     }
     const publication=await lease.publish();evidence.scales.push({scale,charts,history,fixtureEpoch:'2026-10-16T04:00:00Z',inputSha256:dataHash.digest('hex'),syntheticIdentity:c.taikoId,publication,secondPublication:secondLease?await secondLease.publish():null});
    }finally{await secondLease?.close();await lease.close();}
    if(op==='b30')await writeFile(resolve(c.config.userdataDir,c.taikoId+'data.json'),lastPayload);
    await writeFile(output,JSON.stringify(evidence,null,2)+'\n',{mode:0o600});
    if(process.env.TAIKO_O1_STREAM_CHECK==='1'&&!evidence.streamValidation)evidence.streamValidation=await proveO1StreamingEquivalence(()=>c.request('GET',path,null,isAccount?c.cookie:'',headers));
    const count=n,end=nextIndex+count;
    let cursor=nextIndex;nextIndex=end;
    await Promise.all(Array.from({length:Math.min(concurrency,count)},async()=>{
     while(cursor<end&&!stopped){
      const index=cursor++,started=performance.now();let status=null,bytes=0,error=null,bodySha256=null;
      try{const response=await c.request('GET',path,null,isAccount?c.cookie:'',headers);status=response.status;const body=measurementMode==='buffered-original'?await consumeO1BufferedResponse(response):await consumeO1Response(response,{jpeg:op==='b30'});bytes=body.bytes;bodySha256=body.sha256;}
      catch(e){error=e?.name==='TimeoutError'||e?.name==='AbortError'?'timeout':'request_error';}
      const wallMs=performance.now()-started;evidence.samples.push({index,scale,charts,history,wallMs,status,bytes,bodySha256,error,hardCapExceeded:op==='private-history'||isMerged?wallMs>10000:op==='b30'?wallMs>30000:selectedScale==='extreme'?wallMs>15000:false});
     }
    }));
    await writeFile(output,JSON.stringify(evidence,null,2)+'\n',{mode:0o600});
   }
  },{withDeveloper:true,withRealPython:['growth-overview','growth-passport'].includes(op),requestTimeoutMs:op==='b30'?30000:selectedScale==='extreme'?20000:12000});
 }catch(e){evidence.error={name:e?.name,message:String(e?.message||'').slice(0,300)};throw e;}
 finally{
  clearInterval(timer);console.info=info;await resource();
  const success=evidence.samples.filter(s=>s.status===200&&!s.error),latencies=success.map(s=>s.wallMs),p95=q(latencies,.95),p99=q(latencies,.99),bounds=op==='private-current'?[800,2000]:op==='private-history'||op.startsWith('private-merged-')?[2500,6000]:op==='growth-passport'?[5000,10000]:op==='b30'?[8000,15000]:[3000,6000];
  evidence.summary={completed:evidence.samples.length,success:success.length,successRate:success.length/(n*scales.length),p50Ms:q(latencies,.5),p95Ms:p95,p99Ms:p99,non200:evidence.samples.filter(s=>s.status!==200).length,http429:evidence.samples.filter(s=>s.status===429).length,timeouts:evidence.samples.filter(s=>s.error==='timeout').length,dropped:n*scales.length-evidence.samples.length,unfinished:evidence.samples.filter(s=>s.error==='timeout').length,hardCapExceeded:evidence.samples.filter(s=>s.hardCapExceeded).length,pressureStop:stopped,oomDelta:counters(await read(cg+'/memory.events')).oom-initial.oom,oomKillDelta:counters(await read(cg+'/memory.events')).oom_kill-initial.oom_kill};
  evidence.status=evidence.error||stopped||success.length/(n*scales.length)<.995||p95>bounds[0]||p99>bounds[1]||evidence.summary.hardCapExceeded?'FAIL':n<200?'EVIDENCE_PENDING':'PASS_SCOPED';
  evidence.processResourceUsage=process.resourceUsage();evidence.failureDistribution=Object.fromEntries([...new Set(evidence.samples.filter(v=>v.status!==200||v.error).map(v=>v.error||String(v.status)))].map(kind=>[kind,evidence.samples.filter(v=>(v.error||String(v.status))===kind).length]));
  evidence.byScale=evidence.scales.map(scale=>{const samples=evidence.samples.filter(v=>v.scale===scale.scale),ok=samples.filter(v=>v.status===200&&!v.error),times=ok.map(v=>v.wallMs);return {...scale,n:samples.length,success:ok.length,p50Ms:q(times,.5),p95Ms:q(times,.95),p99Ms:q(times,.99),http429:samples.filter(v=>v.status===429).length,timeouts:samples.filter(v=>v.error==='timeout').length,failed:samples.filter(v=>v.status!==200||v.error).length,dropped:n-samples.length,sampleSufficiency:ok.length>=200?'SUFFICIENT':'EVIDENCE_PENDING'};});
  for(const scale of evidence.byScale)scale.status=scale.success/n<.995||scale.p95Ms>bounds[0]||scale.p99Ms>bounds[1]||evidence.samples.some(v=>v.scale===scale.scale&&v.hardCapExceeded)?'FAIL':scale.success<200?'EVIDENCE_PENDING':'PASS_SCOPED';
  if(evidence.byScale.some(v=>v.status==='FAIL'))evidence.status='FAIL';
  else if(evidence.status!=='FAIL'&&evidence.byScale.some(v=>v.status==='EVIDENCE_PENDING'))evidence.status='EVIDENCE_PENDING';
  if(selectedScale==='extreme'){evidence.status=evidence.samples.every(v=>v.status===200&&!v.error&&v.wallMs<=15000)&&evidence.samples.length===n&&!stopped?'PASS_EXTREME_SCOPED':'FAIL';}
  evidence.targets={p95Ms:bounds[0],p99Ms:bounds[1],successRate:.995,minSamplesPerScale:200};
  if(selectedScale==='extreme'){evidence.targets={hardCapMs:15000,category:'separate extreme sample; excluded from ordinary percentiles'};for(const row of evidence.byScale)row.status=evidence.status;}
  await writeFile(output,JSON.stringify(evidence,null,2)+'\n',{mode:0o600});console.log(JSON.stringify({output,status:evidence.status,summary:evidence.summary}));
 }
});
