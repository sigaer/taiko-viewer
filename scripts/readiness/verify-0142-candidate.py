#!/usr/bin/env python3
"""Bounded local candidate checks; invoke only through memory/run_qa.sh."""
import importlib.util,json,os,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('bounded',ROOT/'scripts/readiness/verify-runtime-integration.py')
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
AUDIT=ROOT/'docs/platform-architecture-audit'
out=AUDIT/'evidence/installed-0142-candidate-20261016.json'
assert not out.exists()
assert '/development.slice/development-qa.slice/' in b.cgroup_snapshot()['membership']
work=Path(tempfile.mkdtemp(prefix='viewer0142-candidate-',dir='/var/tmp'))
roles={r:json.loads((AUDIT/f'evidence/r1-rebuild-{r}-0142-20261016.json').read_text()) for r in ('center','client')}
for r in roles.values():
 assert r['status']=='PASS_EXACT_OFFLINE_ROLE_REBUILD'
 assert len(r['installed']['versions'])==94 and r['installed']['versions']['taiko-bot']=='0.14.2'
python=roles['center']['installed']['interpreter']
env={'PATH':'/usr/bin:/bin','TMPDIR':str(work),'TAIKO_PYTHON_EXECUTABLE':python,'TAIKO_RUNTIME_ENV_FILE':str(work/'absent.env'),'NODE_OPTIONS':'--max-old-space-size=1536','MPLCONFIGDIR':str(work/'mpl'),'XDG_CACHE_HOME':str(work/'cache'),'RUNTIME_QA_ROLE':'center'}
cases=[('facts', [python,'-I','/var/tmp/taiko-082-closeout-20261016/scripts/readiness/run-installed-reappearance.py','--tests','/var/tmp/taiko-082-closeout-20261016/tests/offline/test_reappearance_facts.py','--output',work/'facts.json']),
 ('original-reproduction',[python,'-I',ROOT/'scripts/readiness/reproduce-source-switch.py']),
 ('credential',[python,'-I','/var/tmp/taiko-credential-control-plane-20261016/tests/credential_control/installed_acceptance.py','--output',work/'credential.json'])]
for name in ['annualManualCorrections.test.mjs','annualPublishedRevision.test.mjs','annualPolicy.test.mjs','installedRuntimeConsumers.test.mjs','installedGrowthRevision.test.mjs','taikoFingerprint.test.mjs','annualWheelWorker.test.mjs','crossWriterInstalled.test.ts']:
 cases.append((name,[b.NODE,'--experimental-transform-types','--test','--test-concurrency=1',ROOT/'taiko_viewer/tests'/name]))
for role in roles:
 cases.append((role+'-lifecycle',[roles[role]['installed']['interpreter'],'-I',ROOT/'scripts/readiness/run-installed-lifecycle.py','--host',role,'--work',work/(role+'-lifecycle')]))
report={'status':'RUNNING','workspace':str(work),'roles':{k:v['installed']['interpreter'] for k,v in roles.items()},'productionAccess':False,'commands':[],'scope':'Installed synthetic candidate regression; no performance SLO or live ingress claim'}
try:
 for label,command in cases:
  record=b.run(command,work,env,label,ROOT/'taiko_viewer')
  report['commands'].append(record)
  print(json.dumps({'label':label,'status':record['status'],'log':record['log']}),flush=True)
 report['status']='PASS_SCOPED' if all(r['status']=='PASS' for r in report['commands']) else 'FAIL'
finally:
 report['cgroup']=b.cgroup_snapshot()
 out.write_text(json.dumps(report,indent=2)+'\n')
raise SystemExit(0 if report['status']=='PASS_SCOPED' else 1)
