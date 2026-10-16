#!/usr/bin/env python3
"""Archive candidate evidence without replacing retained FAIL records. Run in QA wrapper."""
import hashlib,json,re,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];AUDIT=ROOT/'docs/platform-architecture-audit';OUT=AUDIT/'evidence'
def sha(p):
 with Path(p).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def proof(p):return {'path':str(p),'sha256':sha(p)}
def save(name,data):
 with (OUT/name).open('x') as f:json.dump(data,f,ensure_ascii=False,indent=2);f.write('\n')
for name,source in [('facts-installed-0142-20261016.json','/var/tmp/taiko0142-facts-retry.json'),('credential-installed-0142-20261016.json','/var/tmp/taiko0142-credential-retry.json')]:
 data=json.loads(Path(source).read_text());data['archivedFrom']=proof(source);save(name,data)
raw=Path('/var/tmp/viewer0142-workers-sql.log').read_text();last=json.loads(raw.strip().splitlines()[-1]);workspace=Path(last['workspace']);result=json.loads((workspace/'result.json').read_text());log=(workspace/'tests.log').read_text()
counts={key:int(re.findall(r'ℹ '+key+r' (\d+)',log)[-1]) for key in ['tests','pass','fail','skipped']}
save('workers-sql-0142-20261016.json',{'scope':'Four installed workers with synthetic upstream and empty isolated SQL','result':result,'counts':counts,'logs':[proof(workspace/'tests.log'),proof(workspace/'result.json'),proof('/var/tmp/viewer0142-workers-sql.log')],'interpreter':'/var/tmp/taiko-role-rebuild-hlmgfkq0/venv/bin/python','productionAccess':False})
batch=json.loads((OUT/'installed-0142-candidate-20261016.json').read_text())
retries={'facts':'facts-installed-0142-20261016.json','credential':'credential-installed-0142-20261016.json'}
checks=[]
for item in batch['commands']:
 entry={'label':item['label'],'initialStatus':item['status'],'status':item['status'],'log':proof(item['log'])}
 if item['label'] in retries:
  retry=json.loads((OUT/retries[item['label']]).read_text());entry.update(retryEvidence=retries[item['label']],status=retry['status'])
 checks.append(entry)
image=json.loads((OUT/'image-goldens-0142-20261016.json').read_text())
report={'status':'PASS_SCOPED' if all(x['status'].startswith('PASS') for x in checks) and result['status']=='PASS' and image['status'].startswith('PASS') else 'FAIL','candidateVersion':'0.14.2','viewerVersion':'0.82.1','wheel':json.loads((OUT/'taiko-0142-wheel-20261016.json').read_text()),'roles':batch['roles'],'checks':checks,'sqlCounts':counts,'imageEvidence':'image-goldens-0142-20261016.json','priorFailuresPreserved':True,'buildAttempts':[proof('/var/tmp/taiko-0142-candidate-20261016/build.log'),proof('/var/tmp/taiko-0142-candidate-20261016/build-retry.log'),proof('/var/tmp/taiko-0142-candidate-20261016/repack/build.log')],'setupFailures':['Old setuptools rejected SPDX metadata','Wheel audit caught bundled plugin tests; excluded in source packaging','Fact runner initially omitted compute-only switch','Credential installed test cleanup indentation/import error'],'limitations':['No production manifest or ingress/ACL evidence','No complete RPO/RTO or off-host backup exercise','No SLO load campaign','Prior strict Annual identity oracle FAIL and Viewer legacy/static oracle FAILs retained','No release, deploy, push or 0.83 acceptance']}
save('candidate-0142-closeout-20261016.json',report)
print(json.dumps({'status':report['status'],'sql':counts,'checks':len(checks)}))
