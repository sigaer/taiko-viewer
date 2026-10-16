#!/usr/bin/env python3
"""Only lost key Oracle/installed checks; bounded wrapper owns temporary data."""
import argparse,hashlib,json,os,re,subprocess,time
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--group',choices=['node','python'],required=True);p.add_argument('--start-at');args=p.parse_args()
root=Path(__file__).resolve().parents[2]; taiko=Path('/home/sigaer/taiko/.worktrees/taiko082-recovered-20261016')
assert 'development-qa.slice' in Path('/proc/self/cgroup').read_text()
out=Path(os.environ['QA_EVIDENCE_DIR']);scratch=Path(os.environ['QA_RUN_TMPDIR']);vault=Path('/home/sigaer/taiko/qa-vault')
manifest_path=Path(os.environ['QA_ARTIFACT_MANIFEST']);m=json.loads(manifest_path.read_text());python=m['candidate']['python']
assert Path(python).is_relative_to(vault)
env={**os.environ,'TAIKO_PYTHON_EXECUTABLE':python,'TAIKO_PUBLICATION_TEST_REPO_ROOT':str(scratch),'TAIKO_COMPUTE_ONLY':'1','TAIKO_RUNTIME_ENV_FILE':str(scratch/'absent.env'),'MPLCONFIGDIR':str(scratch/'mpl'),'XDG_CACHE_HOME':str(scratch/'cache'),'TAIKO_OFFLINE_ROOT':str(scratch),'TAIKO_CENTER_ROOT':str(scratch),'TAIKO_RUNTIME_ROOT':str(scratch),'TAIKO_USERDATA_DIR':str(scratch/'userdata'),'QA_TEST_TOOLS_ROOT':str(vault/'tooling/pytest-8.4.2-proxy'),'PYTEST_ADDOPTS':'-p no:cacheprovider'}
(scratch/'userdata').mkdir();(scratch/'songs').mkdir();(scratch/'songs/song_data.json').write_text('[]')
node='/www/server/nvm/versions/node/v24.13.0/bin/node'
cases=[]
if args.group=='node':
 for name in ['sourceReappearance.test.ts','sourceReappearanceIntegration.test.mjs','chartContinuityIntegration.test.mjs','growthRequestEvidence.test.mjs','installedRuntimeConsumers.test.mjs','installedGrowthRevision.test.mjs','taikoFingerprint.test.mjs','annualWheelWorker.test.mjs']:
  cases.append((name,[node,'--experimental-transform-types','--test','--test-reporter=tap','--test-concurrency=1',str(root/'taiko_viewer/tests'/name)]))
 # Only the replaced source-layout Oracle; don't rerun unrelated HTTP cases.
 cases.append(('layout',[node,'--experimental-transform-types','--test','--test-reporter=tap','--test-name-pattern=generic history writer',str(root/'taiko_viewer/tests/growthRecentHttp.test.mjs')]))
else:
 cases=[('facts',[python,'-B','-I',str(taiko/'scripts/readiness/run-installed-reappearance.py'),'--tests',str(taiko/'tests/offline/test_reappearance_facts.py'),'--output',str(out/'facts.json')]),('credential',[python,'-B','-I',str(vault/'sources/credential-v2/installed_acceptance.py'),'--output',str(out/'credential.json')]),('annual-oracle',[python,'-B','-I',str(taiko/'scripts/readiness/run-installed-annual-oracle.py'),'--tests',str(taiko/'tests/offline'),'--external-pytest',str(vault/'tooling/pytest-8.4.2-proxy/lib/python3.11/site-packages'),'--frozen',str(vault/'sources/frozen-original'),'--output',str(out/'annual-oracle.json')])]
if args.start_at:
 assert args.start_at in [label for label,_ in cases]
 cases=cases[[label for label,_ in cases].index(args.start_at):]
report={'status':'RUNNING','group':args.group,'artifactManifest':str(manifest_path),'artifactManifestSha256':hashlib.sha256(manifest_path.read_bytes()).hexdigest(),'productionAccess':False,'selectedCases':[label for label,_ in cases],'cases':[]}
def save():
 tmp=out/'key-gates.partial.json';tmp.write_text(json.dumps(report,indent=2)+'\n');tmp.replace(out/'key-gates.json')
save()
try:
 for label,cmd in cases:
  start=time.monotonic();log=out/(label+'.log')
  with log.open('xb') as f:
   try:result=subprocess.run(cmd,cwd=root/'taiko_viewer',env=env,stdout=f,stderr=subprocess.STDOUT,timeout=180);code=result.returncode
   except subprocess.TimeoutExpired:code=124
  counts={k:int(v) for k,v in re.findall(r'^# (tests|pass|fail|skipped) (\d+)$',log.read_text(),re.M)}
  if args.group=='node' and counts.get('pass',0)==0:code=code or 1
  row={'counts':counts,'label':label,'exitCode':code,'status':'PASS' if code==0 else 'FAIL','wallSeconds':round(time.monotonic()-start,3),'log':str(log),'sha256':hashlib.sha256(log.read_bytes()).hexdigest()};report['cases'].append(row);print(json.dumps(row),flush=True);save()
  if code:break
 report['status']='PASS_SCOPED' if len(report['cases'])==len(cases) and all(x['exitCode']==0 for x in report['cases']) else 'FAIL'
finally:
 save()
raise SystemExit(0 if report['status']=='PASS_SCOPED' else 1)
