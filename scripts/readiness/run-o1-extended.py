#!/usr/bin/env python3
"""Serial 50-sample chunks; each gets an unchanged QA cgroup and private SQL.
The coordinator must grant the host QA slot before starting this scheduler.
"""
import os,argparse,json,math,re,subprocess,time
from pathlib import Path
vault=Path('/home/sigaer/taiko/qa-vault')
evidence_root=Path(os.environ['QA_EVIDENCE_DIR']).resolve(strict=True)
assert evidence_root.is_relative_to(vault) and evidence_root!=vault
p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);p.add_argument('--operation',action='append',choices=['private-merged-current','private-merged-history','growth-overview','growth-passport','b30']);p.add_argument('--extreme',action='store_true');a=p.parse_args()
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
 item={**state['current'],'exitCode':code,'finishedAt':time.time(),'workspace':str(work) if work else None,'status':data.get('status') if data else 'HARNESS_INCOMPLETE','summary':data.get('summary') if data else None};state['completed'].append(item);state['current']=None;(a.out/'progress.json').write_text(json.dumps(state,indent=2));print(json.dumps(item),flush=True)
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
  smoke=run(operation,1,'small',3,operation+'-smoke')
  if smoke['summary']['success']!=3:raise RuntimeError('Operation smoke failed; inspect fixture or runtime before cohort')
  for concurrency in [1,3,5]:
   for scale in ['small','medium','large']:
    chunks=[run(operation,concurrency,scale,50,f'{operation}-{scale}-{concurrency}-candidate-{i}') for i in range(4)]
    if misses(chunks) and not baseline:
     state.setdefault('baselineComparisons',[]).append({'operation':operation,'concurrency':concurrency,'scale':scale,'status':'PENDING_BASELINE_ARTIFACT_UNAVAILABLE','candidateStatus':'TARGET_MISS_RETAINED'})
    elif misses(chunks):
     for i in range(4):run(operation,concurrency,scale,50,f'{operation}-{scale}-{concurrency}-baseline-{i}',old=True)
 state['status']='COMPLETE_MEASUREMENTS_NOT_RELEASE_GATE'
except BaseException as error:
 state['status']='STOPPED';state['reason']=str(error)[:300];raise
finally:
 state['finishedAt']=time.time();(a.out/'progress.json').write_text(json.dumps(state,indent=2))
