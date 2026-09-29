#!/usr/bin/env python3
"""Queue one reviewed stage inside the already bounded, owned QA session."""
import json,sys,time,hashlib
from pathlib import Path
root=Path(sys.argv[1]).resolve();assert str(root).startswith('/var/tmp/annual-test-')
stage=sys.argv[2];assert stage in ['smoke','browser','high-browser','protocol','high-smoke','same2','same5','parallel2','parallel3','share2','share','warm','warm3','warm5','burst','mixed','recovery','cold','render-diagnostic','public-auth']
config=root/('probe.json' if stage=='smoke' else stage+'.json');c=json.loads(config.read_text());session=json.loads((root/'probe.json').read_text());c['serverPid']=session['serverPid'];c['candidate']=session['candidate']
if stage in ['warm3','warm5','burst']:
 assert len(sys.argv)==4,'Pass the reviewed prior warm result path'
 prior=Path(sys.argv[3]).resolve();p=json.loads(prior.read_text());assert p['candidate']==c['candidate'],'Different candidate cannot authorize escalation'
 c['previousResult']=str(prior)
c['testInputHashes']={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in Path(__file__).resolve().parent.iterdir() if p.suffix in ['.mjs','.py']}
helper=Path(__file__).resolve().parents[1]/'scripts/annual_readiness_browser_checks.mjs'
c['testInputHashes']['scripts/annual_readiness_browser_checks.mjs']=hashlib.sha256(helper.read_bytes()).hexdigest()
config.write_text(json.dumps(c,indent=2));config.chmod(0o600)
assert not (root/'task.json').exists(),'Pending stage exists'
identifier=stage+'-'+str(int(time.time()));done=root/(identifier+'.done')
kind='browser' if stage in ['browser','high-browser','protocol','render-diagnostic','public-auth'] else 'probe'
(root/'task.json').write_text(json.dumps({'kind':kind,'config':str(config),'id':identifier}))
end=time.monotonic()+850
while not done.exists():
 if time.monotonic()>end:raise SystemExit('Stage deadline; inspect the bounded session')
 time.sleep(.5)
result=json.loads(done.read_text());print(identifier,json.dumps(result));raise SystemExit(result['code'] if isinstance(result.get('code'),int) else 1)
