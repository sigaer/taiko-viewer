#!/usr/bin/env node
// Bounded open-loop probe. This is not k6 and has no k6 metrics.
import assert from 'node:assert/strict';
import {observeAnnual} from './annual-observe.mjs';
import { readFile, mkdir, writeFile, realpath } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import mysql from 'mysql2/promise';
import sharp from 'sharp';
import { assertAnnualE2eEnvironment } from '../scripts/annual_e2e_safety.mjs';
import { assertTestDatabaseMutationAllowed } from '../scripts/annual_test_db_guard.mjs';

const configPath = process.argv[2];
assert.ok(configPath, 'Usage: node loadtest/annual-readiness.mjs /private/config.json (no default target)');
const c = JSON.parse(await readFile(configPath,'utf8'));
const base = new URL(c.base);
assert.ok(base.protocol==='http:' && base.hostname==='127.0.0.1' && base.port, 'Only an explicitly isolated loopback server is supported');
assert.ok(Number.isInteger(c.serverPid)&&c.serverPid>1,'serverPid required');
const env=Object.fromEntries((await readFile(`/proc/${c.serverPid}/environ`,'utf8')).split('\0').filter(v=>v.includes('=')).map(v=>[v.slice(0,v.indexOf('=')),v.slice(v.indexOf('=')+1)]));
await assertAnnualE2eEnvironment(env);
assert.equal(String(env.PORT || env.NITRO_PORT),base.port,'Target port must match owned server environment');
const sockets=execFileSync('ss',['-lntp'],{encoding:'utf8'});
assert.ok(sockets.split('\n').some(line=>line.includes(`127.0.0.1:${base.port} `)&&line.includes(`pid=${c.serverPid},`)),'Target listener ownership not proven');
assert.ok(c.isolationEvidence && (await readFile(c.isolationEvidence,'utf8')).trim().length>100,'Provide reviewed evidence for worker/queue/cache/storage/egress isolation, not just a port');
const group=(await readFile(`/proc/${c.serverPid}/cgroup`,'utf8')).trim().split('::')[1];
assert.ok(group?.includes('development-'),'Target must use bounded development cgroup');
const max=await readFile(`/sys/fs/cgroup${group}/memory.max`,'utf8');
assert.ok(max.trim()!=='max','Target must have a hard memory limit');
process.env.TAIKO_ALLOW_TEST_DB_MUTATION=env.TAIKO_ALLOW_TEST_DB_MUTATION;
const db=await mysql.createConnection({host:env.TAIKO_DB_HOST,port:Number(env.TAIKO_DB_PORT||3306),user:env.TAIKO_DB_USER,password:env.TAIKO_DB_PASSWORD,database:env.TAIKO_DB_NAME});
try{await assertTestDatabaseMutationAllowed(db);}finally{await db.end();}
assert.ok(c.candidate?.buildId,'Pinned candidate build ID required');
const artifact=await fetch(new URL('/_nuxt/builds/latest.json',base),{signal:AbortSignal.timeout(5000)}).then(r=>r.json());
assert.equal(artifact.id,c.candidate.buildId,'Running artifact differs from pinned candidate');
const accounts=JSON.parse(await readFile(c.accountsFile,'utf8'));
assert.ok(accounts.length>=2 && accounts.every(a=>a.cookie&&a.userId&&a.nickname&&Number.isFinite(a.playCount)&&a.synthetic===true),'Require synthetic identities with cookie/userId/nickname/playCount (never commit credentials)');
assert.equal(new Set(accounts.map(a=>a.userId)).size,accounts.length,'Fixture identities must be distinct');
const smoke=c.scenario==='smoke', parallel=/^parallel[23]$/.test(c.scenario), shareRace=c.scenario==='share2', mixed=c.scenario==='mixed';
const cold=c.scenario==='cold', same=/^same[25]$/.test(c.scenario), share=c.scenario==='share';
assert.ok(['parallel2','parallel3','share2','mixed','smoke','warm','cold','same2','same5','share','burst','recovery'].includes(c.scenario));
assert.ok(c.rate>=1&&c.rate<=10&&c.seconds>=1&&c.seconds<=300&&c.maxVus>=1&&c.maxVus<=10);
assert.ok(c.coldDeadlineSeconds>0&&c.coldDeadlineSeconds<=600&&c.shareDeadlineSeconds>0&&c.shareDeadlineSeconds<=120);
assert.ok(c.minAvailableMiB>=10000&&c.maxMemoryPsiFull<=2&&c.maxServerRssMiB>0&&c.maxServerRssMiB<=1400);
if(cold){assert.ok(accounts.length>=30,'Cold matrix needs at least 30 unused fixtures');assert.equal(c.rate,1);assert.equal(c.maxVus,1,'Start cold serially');}
if(share)assert.equal(c.maxVus,1,'Share hard concurrency limit = 1');
if(!parallel&&!shareRace&&!smoke&&!cold&&!same&&!share&&c.rate>1){
  const previous=JSON.parse(await readFile(c.previousResult || '/missing-baseline-result','utf8'));
  const required=c.rate<=3?1:c.rate<=5?3:5;
  assert.ok(previous.scenario==='warm'&&previous.targetRate>=required&&previous.completed>0&&previous.successRate>=.995&&!previous.failed&&!previous.droppedSlots&&!previous.stopReason&&previous.p95<=800&&previous.p99<=2000,'A healthy preceding warm stage is required before escalation');
}

const output=await realpath(c.output);
assert.ok(output.startsWith(await realpath(env.ANNUAL_E2E_ISOLATED_ROOT)+'/'));
const abort=new AbortController();let stopReason='',active=0,requests=0,started=0,finished=0,failed=0,dropped=0;
const times=[],records=[],resources=[],tasks=new Set();
const start=performance.now();let lastStart=0, offeredEnd=0;
const stop=reason=>{stopReason ||=reason;abort.abort();};
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>stop(signal));
const hardTimer=setTimeout(()=>stop('whole-test-deadline'),Math.min(850000,(cold?850:share?4*c.shareDeadlineSeconds+35:c.seconds+c.coldDeadlineSeconds+35)*1000));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function request(path,a,method='GET',body,timeout=10000){
  assert.ok(path.startsWith('/api/account/'),'Only account API requests allowed');requests++;
  const r=await fetch(new URL(path,base),{method,redirect:'error',headers:{cookie:`stv_session=${a.cookie}`,'content-type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.any([abort.signal,AbortSignal.timeout(timeout)])});
  if(!r.ok)throw Error(`HTTP ${r.status}`);
  if(r.headers.get('content-type')?.includes('image/'))return Buffer.from(await r.arrayBuffer());
  return r.json();
}
function verify(s,a){if(!s||s.schemaVersion!==4||s.provenance?.algorithmVersion!=='annual-observation-v4.5.2'||s.version?.key!=='annual_2026'||s.profileCard?.nickname!==a.nickname||s.overview?.data?.playCount!==a.playCount||(a.expectedHighScore!=null&&s.sections?.highScore?.data?.highScore!==a.expectedHighScore)||(a.snapshots!=null&&s.coverage?.comparableSnapshotCount!==a.snapshots)){stop('identity-or-fixture-mismatch');throw Error('identity-or-fixture-mismatch');}}
async function transaction(a,operation){
  const buildCold=cold||same||smoke||parallel||operation==='cold', createShare=share||shareRace||operation==='share';
  const auth=await request('/api/account/auth/me',a);
  if(!auth.authenticated||String(auth.user?.id)!==String(a.userId)){stop('wrong-user');throw Error('wrong-user');}
  let jobId;
  let p=await request('/api/account/annual-summaries/annual_2026',a);
  if(buildCold){
    if(p.summary&&!same)throw Error('cold-fixture-already-generated');
    const deadline=performance.now()+c.coldDeadlineSeconds*1000;
    p=await request('/api/account/annual-summaries/annual_2026/build',a,'POST',{locale:'zh'});jobId=p.job?.id;
    for(let n=0;!p.summary&&n<c.coldDeadlineSeconds&&performance.now()<deadline;n++){
      if(p.job?.status==='failed')throw Error('build-failed');
      if(p.job?.status==='completed')break;
      await sleep(1000);p=await request(`/api/account/annual-summary-jobs/${encodeURIComponent(p.job.id)}`,a);
    }
    p=await request('/api/account/annual-summaries/annual_2026',a);
  }
  verify(p.summary,a);
  if(createShare){
    const card=await request(`/api/account/annual-summaries/${encodeURIComponent(p.summary.summaryId)}/share-card`,a,'POST',{locale:c.locale||'zh',syncCommunity:false},c.shareDeadlineSeconds*1000);
    const png=await request(card.shareCard.imageUrl,a);
    const metadata=await sharp(png).metadata();
    assert.ok(metadata.format==='png'&&metadata.width===card.shareCard.width&&metadata.height===card.shareCard.height);
    await sharp(png).stats(); // Fully decode the generated artifact.
    await writeFile(`${output}/share-${a.userId}.png`,png);
    return {cached:card.cached,width:metadata.width,height:metadata.height};
  }
  return {jobId,summaryId:p.summary.summaryId,inputFingerprint:p.inputFingerprint};
}
async function launch(a,operation){
  active++;started++;lastStart=performance.now();const t=performance.now();
  try{const detail=await transaction(a,operation);finished++;times.push(performance.now()-t);records.push({ok:true,userId:a.userId,operation:operation||(mixed?'warm':c.scenario),ms:performance.now()-t,...detail});}
  catch(e){failed++;records.push({ok:false,userId:a.userId,operation:operation||(mixed?'warm':c.scenario),ms:performance.now()-t,error:e.message});if(cold||same||share||smoke||parallel||shareRace||mixed)stop('generation-or-share-failed');if(performance.now()-start>=30000&&failed/started>.05)stop('cumulative-error-rate-above-5-percent');}
  finally{active--;}
}
async function monitor(){
  const mem=await readFile('/proc/meminfo','utf8'),psi=await readFile('/proc/pressure/memory','utf8'),status=await readFile(`/proc/${c.serverPid}/status`,'utf8');
  const available=Number(mem.match(/MemAvailable:\s+(\d+)/)[1])/1024,full=Number(psi.match(/full avg10=([\d.]+)/)[1]),rss=Number(status.match(/VmRSS:\s+(\d+)/)[1])/1024;
  const events=await readFile(`/sys/fs/cgroup${group}/memory.events`,'utf8');
  resources.push({atMs:performance.now()-start,availableMiB:available,fullPsi:full,rssMiB:rss,events});
  if(available<c.minAvailableMiB||full>=c.maxMemoryPsiFull||rss>c.maxServerRssMiB)stop('resource-danger');
  if(resources.length>1&&events.match(/oom_kill (\d+)/)?.[1]!==resources[0].events.match(/oom_kill (\d+)/)?.[1])stop('oom-kill');
}
let monitorTimer;
const finishObservation=await observeAnnual(c);
try{
  await monitor();monitorTimer=setInterval(()=>monitor().catch(()=>stop('monitor-unavailable-or-server-exited')),1000);
  if(same){const p=await request('/api/account/annual-summaries/annual_2026',accounts[0]);assert.ok(!p.summary,'same-user fixture must be unused');}
  if(mixed){assert.equal(c.rate,1);assert.equal(c.maxVus,3);for(const [a,op] of [[accounts[2],'cold'],[accounts[3],'share']]){const t=launch(a,op);tasks.add(t);t.finally(()=>tasks.delete(t));}}
  const total=parallel?Number(c.scenario.slice(-1)):shareRace?2:smoke?1:same?Number(c.scenario.slice(-1)):cold?30:share?4:c.rate*c.seconds;
  for(let slot=0;slot<total&&!abort.signal.aborted;slot++){
    if(cold)await sleep(Math.max(0,lastStart+1000-performance.now()));
    else if(!parallel&&!shareRace&&!same&&!share)await sleep(Math.max(0,start+slot*1000/c.rate-performance.now()));
    if(abort.signal.aborted)break;
    if(!parallel&&!shareRace&&!smoke&&!cold&&!same&&!share&&performance.now()-(start+slot*1000/c.rate)>=1000/c.rate){dropped++;continue;}
    if(active>=c.maxVus){dropped++;continue;}
    const a=same?accounts[0]:cold?accounts[slot]:accounts[slot%(mixed?2:accounts.length)];
    const task=launch(a);tasks.add(task);task.finally(()=>tasks.delete(task));
    if(share||cold)await task;
  }
  offeredEnd=performance.now();
  await Promise.allSettled([...tasks]);
  // Continue resource observation after offered load stops.
  if(!abort.signal.aborted)await sleep(10000);
}finally{
  clearInterval(monitorTimer);clearTimeout(hardTimer);await finishObservation();
  const elapsed=(performance.now()-start)/1000;times.sort((a,b)=>a-b);
  const percentile=p=>times.length?times[Math.min(times.length-1,Math.ceil(times.length*p)-1)]:null;
  const result={candidate:c.candidate,testInputHashes:c.testInputHashes,artifactVerificationRequests:1,scenario:c.scenario,model:parallel||shareRace?'bounded-synchronous-group':mixed?'bounded-warm-plus-two-transactions':smoke?'single-cold-smoke':cold?'bounded-serial-cold':share?'bounded-serial-share':same?'bounded-synchronous-group':'bounded-open-loop-node-probe',targetRate:(parallel||shareRace||mixed||smoke||same||share||cold)?null:c.rate,planned:parallel?Number(c.scenario.slice(-1)):shareRace?2:smoke?1:same?Number(c.scenario.slice(-1)):cold?30:share?4:c.rate*c.seconds,started,completed:finished,failed,unfinished:started-finished-failed,httpRequests:requests,droppedSlots:dropped,k6DroppedIterations:null,elapsedSeconds:elapsed,offerWindowSeconds:(offeredEnd-start)/1000,lastStartOffsetSeconds:(lastStart-start)/1000,observedStartsPerSecond:(parallel||shareRace||mixed||smoke||same||share||cold)?null:started/Math.max(c.seconds,(offeredEnd-start)/1000),httpPerSecond:requests/elapsed,successRate:started?finished/started:0,p95:percentile(.95),p99:percentile(.99),stopReason,records,resources,computationCount:'NOT_VERIFIED: inspect isolated generator admission logs'};
  if(mixed){result.planned+=2;const reads=records.filter(r=>r.ok&&r.operation==='warm').map(r=>r.ms).sort((a,b)=>a-b);result.warmLatency={n:reads.length,p95:reads[Math.ceil(reads.length*.95)-1],p99:reads[Math.ceil(reads.length*.99)-1]};if(result.warmLatency.p95>800||result.warmLatency.p99>2000)process.exitCode=1;}
  result.notStarted=result.planned-started;
  await writeFile(`${output}/${c.scenario}-${Date.now()}.json`,JSON.stringify(result,null,2));
  console.log(JSON.stringify({...result,records:undefined,resources:undefined}));
  if(failed||dropped||stopReason||!finished||(!mixed&&!parallel&&!shareRace&&!smoke&&!cold&&!same&&!share&&(result.p95>800||result.p99>2000)))process.exitCode=1;
}
