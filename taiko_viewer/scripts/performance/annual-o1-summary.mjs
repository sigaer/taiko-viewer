// Explicit cohort evidence only; preserve all attempts and reject mixed runtimes.
import assert from 'node:assert/strict';
import {readFile,writeFile,realpath} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {createHash} from 'node:crypto';
const paths=process.argv.slice(2);assert.ok(paths.length>0&&paths.length<=1000);
const sources=[],attempts=[],warm=[];
for(const spec of paths){
 const match=/^--(cold|warm)=(.+)$/.exec(spec);assert.ok(match,'Label each formal cohort --cold=path or --warm=path; smoke evidence stays separate');const [,kind,path]=match;
 const actual=await realpath(path);assert.ok(actual.startsWith('/home/sigaer/taiko/qa-vault/runs/')&&basename(actual)==='evidence.json');
 const bytes=await readFile(actual),data=JSON.parse(bytes);assert.equal(data.productionAccess,false);
 sources.push({kind,path:actual,sha256:createHash('sha256').update(bytes).digest('hex'),status:data.status,manifestSha256:data.runtime?.manifestSha256,harnessSha256:data.runtime?.harnessSha256,viewerHead:data.runtime?.viewerHead});
 // Cold samples that prepared warm reports or smoke are listed separately, never pooled into formal cold.
 const formalCold=kind==='cold';if(formalCold)assert.equal(data.warm?.length,0,'Cold-only cohort required');
 if(formalCold)for(const item of data.cold||[])attempts.push({...item,scale:data.scale,user:data.input?.syntheticIdentity,inputSha256:data.input?.sha256,source:actual,resourceAlarm:data.resourceAlarm});
 if(formalCold&&!data.cold?.length)attempts.push({status:'failed-before-submission',scale:data.scale,source:actual});
 if(kind==='warm')assert.equal(data.scope,'CURRENT_454_WARM_COHORT');
 for(const stage of kind==='warm'?data.warm||[]:[])warm.push({...stage,source:actual});
}
assert.equal(new Set(sources.map(x=>x.manifestSha256)).size,1,'Mixed manifests require separate evidence cohorts');
assert.ok(sources[0].manifestSha256,'Runtime identity required');
assert.ok(sources[0].harnessSha256);assert.equal(new Set(sources.map(x=>x.harnessSha256)).size,1,'Mixed harness revisions require separate cohorts');
const successes=attempts.filter(x=>x.status==='completed'&&!x.resourceAlarm),values=successes.map(x=>x.totalWallMs).sort((a,b)=>a-b);
const q=p=>values.length?values[Math.ceil(values.length*p)-1]:null;
const scales=Object.fromEntries(['low','mid','high'].map(scale=>[scale,successes.filter(x=>x.scale===scale).length]));
const distinct=new Set(successes.map(x=>x.user)).size;
const cold={attempts:attempts.length,successes:successes.length,failed:attempts.length-successes.length,distinctUsers:distinct,scales,p50Ms:q(.5),p95Ms:q(.95),p99Ms:q(.99),maxMs:values.at(-1)??null};
cold.status=attempts.length<30||distinct<30||Object.values(scales).some(x=>x<10)?'EVIDENCE_PENDING':successes.length/attempts.length>=.995&&cold.p95Ms<=30000&&cold.p99Ms<=90000&&cold.maxMs<=180000?'PASS':'FAIL';
const warmStatus=[1,3,5].every(rate=>warm.some(stage=>stage.requestsPerSecond===rate&&stage.planned>=200&&stage.status==='PASS'))&&!warm.some(stage=>stage.status==='FAIL')?'PASS':'EVIDENCE_PENDING';
const output={scope:'ANNUAL_O1_REPORT_ONLY_POSTER_NOT_MEASURED',productionAccess:false,status:cold.status==='PASS'&&warmStatus==='PASS'?'PASS_SCOPED':cold.status==='FAIL'||warm.some(x=>x.status==='FAIL')?'FAIL':'EVIDENCE_PENDING',cold,warmStatus,attempts,warm,sources,limits:['200ms cgroup sampling may miss short worker peaks; pair with runner memory.events','Poster renderer remains unmeasured','No Gate or Freeze decision inferred']};
const destination=resolve(process.env.QA_EVIDENCE_DIR,'annual-o1-summary.json');assert.ok(destination.startsWith(resolve(process.env.QA_RUN_DIR,'evidence')+'/'));
await writeFile(destination,JSON.stringify(output,null,2)+'\n',{mode:0o600});console.log(JSON.stringify({path:destination,status:output.status,cold,warmStatus}));
