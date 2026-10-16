#!/usr/bin/env python3
"""Build separate pinned pytest tooling under QA; never mutate a runtime role."""
import argparse,hashlib,json,os,re,subprocess,sys
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--find-links',type=Path);p.add_argument('--proxy-port',type=int);p.add_argument('--version',required=True);p.add_argument('--destination',type=Path,required=True);p.add_argument('--annual-evidence',type=Path,required=True);a=p.parse_args()
assert a.proxy_port is None or 1<=a.proxy_port<=65535
assert re.fullmatch(r'\d+\.\d+\.\d+',a.version),'Explicit pytest version required'
assert 'development-qa.slice/taiko-qa-' in Path('/proc/self/cgroup').read_text()
vault=Path('/home/sigaer/taiko/qa-vault').resolve(strict=True)
assert a.find_links is None or a.find_links.resolve(strict=True).is_relative_to(vault/'wheelhouse')
assert a.destination.resolve().is_relative_to(vault/'tooling') and not a.destination.exists()
evidence=Path(os.environ['QA_EVIDENCE_DIR']).resolve(strict=True);assert evidence.is_relative_to(vault/'runs')
a.destination.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
with (evidence/'pytest-tooling-install.log').open('x') as log:
 subprocess.run([sys.executable,'-I','-m','venv',str(a.destination)],stdout=log,stderr=log,check=True,timeout=60)
 python=a.destination/'bin/python'
 subprocess.run([str(python),'-I','-m','pip','--isolated','install','--disable-pip-version-check','--no-cache-dir','--timeout','30','--retries','2',*(['--find-links',str(a.find_links)] if a.find_links else []),*(['--proxy','http://127.0.0.1:'+str(a.proxy_port)] if a.proxy_port else []),'pytest=='+a.version],stdout=log,stderr=log,check=True,timeout=180,env={**os.environ,'PIP_CONFIG_FILE':os.devnull,'PYTHONNOUSERSITE':'1'})
code="import importlib.metadata,json,pytest;print(json.dumps({'pytestPath':pytest.__file__,'version':pytest.__version__,'packages':{d.metadata['Name']:d.version for d in importlib.metadata.distributions()}}))"
info=json.loads(subprocess.check_output([str(python),'-I','-c',code]));path=Path(info['pytestPath']);assert path.is_relative_to(a.destination)
old=json.loads(a.annual_evidence.read_text())['pytestTool']['sha256'];actual=hashlib.sha256(path.read_bytes()).hexdigest()
info.update(status='TOOLING_READY_NOT_BUSINESS_TESTED',pytestSite=str(path.parent.parent),originalPytestInitSha256=old,actualPytestInitSha256=actual,originalToolByteMatch=old==actual,runtimeRoleModified=False)
(evidence/'pytest-tooling.json').write_text(json.dumps(info,indent=2)+'\n');print(json.dumps(info))
