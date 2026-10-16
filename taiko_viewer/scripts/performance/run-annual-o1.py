#!/usr/bin/env python3
"""One bounded isolated SQL cohort; invoke only through memory/run_qa.sh."""
import argparse,json,os,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('cohort',choices=['smoke','warm','cold']);args=p.parse_args()
root=Path(__file__).resolve().parents[3]
manifest=Path(os.environ['QA_ARTIFACT_MANIFEST']);m=json.loads(manifest.read_text())
python=m['candidate']['python'];assert Path(python).is_absolute() and Path(python).is_relative_to('/home/sigaer/taiko/qa-vault')
assert 'development-qa.slice' in Path('/proc/self/cgroup').read_text()
node='/www/server/nvm/versions/node/v24.13.0/bin/node'
suites={'smoke':['annualO1SmokeSql'],'warm':['annualO1WarmSql'],'cold':['annualO1ColdSql','annualO1ColdMidSql','annualO1ColdHighSql']}[args.cohort]
env={**os.environ,'TAIKO_PYTHON_EXECUTABLE':python}
result=subprocess.run([node,str(root/'scripts/readiness/run-isolated-sql.mjs'),'--allow-test-db-mutation',*[f'taiko_viewer/tests/{suite}.test.mjs' for suite in suites]],cwd=root,env=env,timeout=750)
raise SystemExit(result.returncode)
