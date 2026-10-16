#!/usr/bin/env python3
"""Serial 50-sample chunks; each gets an unchanged QA cgroup and private SQL.
The coordinator must grant the host QA slot before starting this scheduler.
"""
import os,hashlib,argparse,json,math,re,subprocess,time
from pathlib import Path
vault=Path('/home/sigaer/taiko/qa-vault')
evidence_root=Path(os.environ['QA_EVIDENCE_DIR']).resolve(strict=True)
assert evidence_root.is_relative_to(vault) and evidence_root!=vault
p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);p.add_argument('--operation',action='append',choices=['private-current','private-history','growth-history','private-merged-current','private-merged-history','growth-overview','growth-passport','b30']);p.add_argument('--concurrency',action='append',type=int,choices=[1,3,5]);p.add_argument('--smoke-evidence',action='append',type=Path);p.add_argument('--smoke-only',action='store_true');p.add_argument('--extreme',action='store_true');a=p.parse_args()
root=Path(__file__).resolve().parents[2]
assert a.out.is_absolute() and a.out.resolve().is_relative_to(evidence_root) and not a.out.exists();a.out.mkdir(mode=0o700)
node='/www/server/nvm/versions/node/v24.13.0/bin/node'
manifest=json.loads(Path(os.environ['QA_ARTIFACT_MANIFEST']).read_text());assert manifest['schemaVersion']==1
candidate=manifest['candidate']['python'];baseline=(manifest.get('baseline') or {}).get('python')
state={'status':'RUNNING','startedAt':time.time(),'completed':[],'current':None};(a.out/'progress.json').write_text(json.dumps(state,indent=2))
def run(operation,concurrency,scale,n,label,old=False):
 log=a.out/(label+'.log');assert not log.exists();assert not old or baseline,'Baseline artifact unavailable'
 state['current']={'operation':operation,'concurrency':concurrency,'scale':scale,'samples':n,'baseline':old,'startedAt':time.time(),'log':str(log)};(a.out/'progress.json').write_text(json.dumps(state,indent=2))
 cmd=['bash','scripts/memory/run_qa.sh','/usr/bin/env','TAIKO_PYTHON_EXECUTABLE='+(baseline if old else candidate),node,'scripts/readiness/run-isolated-sql.mjs','--allow-test-db-mutation',f'--o1={operation}:{concurrency}:{n}',f'--o1-scale={scale}',*(['--o1-baseline'] if old else []),'taiko_viewer/tests/o1RequestPerformance.test.mjs']
 with log.open('x') as stream:code=subprocess.run(cmd,cwd=root,stdout=stream,stderr=subprocess.STDOUT).returncode
 paths=re.findall(r'"workspace":"([^"]+)"',log.read_text());data=None;work=Path(paths[-1]) if paths else None
 if work and (work/'o1-performance.json').exists():data=json.loads((work/'o1-performance.json').read_text())
 item={**state['current'],'exitCode':code,'finishedAt':time.time(),'workspace':str(work) if work else None,'qaRunDir':str(work.parent.parent) if work else None,'qaRunManifest':str(work.parent/'manifest.json') if work else None,'status':data.get('status') if data else 'HARNESS_INCOMPLETE','summary':data.get('summary') if data else None};state['completed'].append(item);state['current']=None;(a.out/'progress.json').write_text(json.dumps(state,indent=2));print(json.dumps(item),flush=True)
 if data and work and (sql_result:=json.loads((work/'result.json').read_text())).get('daemonExited') and Path(sql_result['datadir']).is_dir():
  cleaned=subprocess.run(['/usr/bin/python3',str(root/'scripts/readiness/cleanup-o1-owned-sql.py'),str(work)],capture_output=True,text=True,env={**os.environ,'QA_RUN_TMPDIR':sql_result['qaRunTmpdir']})
  if cleaned.returncode:raise RuntimeError('Owned data cleanup failed: '+str(work))
 if code or not data:raise RuntimeError('Harness/launcher failed; original result retained')
 if data.get('summary',{}).get('pressureStop') or data.get('summary',{}).get('oomDelta') or data.get('summary',{}).get('oomKillDelta'):raise RuntimeError('Resource stop; no more load admitted')
 return data
def misses(chunks):
 samples=[s for c in chunks for s in c['samples']];times=sorted(s['wallMs'] for s in samples if s['status']==200 and not s['error']);requested=sum(c['requested'] for c in chunks);bounds=chunks[0]['targets']
 return not times or len(times)/requested<.995 or any(s.get('hardCapExceeded') for s in samples) or times[math.ceil(len(times)*.95)-1]>bounds['p95Ms'] or times[math.ceil(len(times)*.99)-1]>bounds['p99Ms']
try:
 if a.extreme:run('growth-passport',1,'extreme',1,'growth-passport-extreme-smoke')
 for operation in a.operation or []:
  smoke=None
  for path in a.smoke_evidence or []:
   assert path.resolve().is_relative_to(vault/'runs')
   candidate_smoke=json.loads(path.read_text())
   if candidate_smoke['operation']!=operation:continue
   assert candidate_smoke['manifest']['testHarnessSha256']==hashlib.sha256((root/'taiko_viewer/tests/o1RequestPerformance.test.mjs').read_bytes()).hexdigest()
   assert candidate_smoke['manifest']['artifactManifestSha256']==hashlib.sha256(Path(os.environ['QA_ARTIFACT_MANIFEST']).read_bytes()).hexdigest()
   assert candidate_smoke['samplesPerScale']==3 and candidate_smoke['concurrency']==1
   assert {x['scale'] for x in candidate_smoke['byScale']}=={'small','medium','large'}
   assert not candidate_smoke['summary']['pressureStop'] and not candidate_smoke['summary']['oomDelta'] and not candidate_smoke['summary']['oomKillDelta']
   smoke=candidate_smoke;state.setdefault('reusedSmokes',[]).append({'operation':operation,'path':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()});break
  if smoke is None:smoke=run(operation,1,'all',3,operation+'-smoke')
  if smoke['summary']['success']!=9:
   state.setdefault('blockedOperations',[]).append({'operation':operation,'reason':'SMOKE_FAIL_RETAINED; no formal samples admitted'})
   continue
  if a.smoke_only:continue
  estimates={scale['scale']:60+1.5*max(x['wallMs'] for x in smoke['samples'] if x['scale']==scale['scale'])*200/1000 for scale in smoke['byScale']}
  whole_estimate=60+sum(value-60 for value in estimates.values())
  for concurrency in a.concurrency or [1,3,5]:
   plans=[('all',200,1)] if operation!='b30' and whole_estimate<450 else [(scale,200,1) if operation!='b30' and estimates[scale]<450 else (scale,50,4) for scale in ['small','medium','large']]
   state.setdefault('batchPlans',[]).append({'operation':operation,'concurrency':concurrency,'plans':plans,'wholeEstimateSeconds':whole_estimate,'scaleEstimateSeconds':estimates,'reason':'c1 smoke maximum times 200, 1.5 safety factor plus60s setup; no assumed concurrency speedup; prefer one 600 run below450s, else scale200 below450s; B30 and heavier scales use50; guard unchanged'})
   for scale,count,repeats in plans:
    chunks=[run(operation,concurrency,scale,count,f'{operation}-{scale}-{concurrency}-candidate-{i}') for i in range(repeats)]
    target_miss=misses(chunks) or any(row['status']=='FAIL' for chunk in chunks for row in chunk['byScale'])
    if target_miss and not baseline:
     state.setdefault('baselineComparisons',[]).append({'operation':operation,'concurrency':concurrency,'scale':scale,'status':'PENDING_BASELINE_ARTIFACT_UNAVAILABLE','candidateStatus':'TARGET_MISS_RETAINED'})
    elif target_miss:
     for i in range(repeats):run(operation,concurrency,scale,count,f'{operation}-{scale}-{concurrency}-baseline-{i}',old=True)
 state['status']='COMPLETE_MEASUREMENTS_NOT_RELEASE_GATE'
except BaseException as error:
 state['status']='STOPPED';state['reason']=str(error)[:300];raise
finally:
 state['finishedAt']=time.time();(a.out/'progress.json').write_text(json.dumps(state,indent=2))
