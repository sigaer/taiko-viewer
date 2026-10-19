"""Run via scripts/memory/run_qa.sh; installed artifacts and isolated SQL only."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tomllib

p=argparse.ArgumentParser()
p.add_argument('--bot-source',type=Path,required=True)
p.add_argument('--sql',action='store_true')
a=p.parse_args()
root=Path(__file__).resolve().parents[2]
manifest=json.loads(Path(os.environ['QA_ARTIFACT_MANIFEST']).read_text())
evidence=Path(os.environ['QA_EVIDENCE_DIR'])
scratch=Path(os.environ['QA_RUN_TMPDIR'])
node='/www/server/nvm/versions/node/v24.13.0/bin/node'
python=manifest['candidate']['python']
def digest(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as source:
        for chunk in iter(lambda:source.read(65536),b''):h.update(chunk)
    return h.hexdigest()
wheel=manifest['candidate']['wheelFile']
assert digest(wheel)==manifest['candidate']['wheelSha256'],'Candidate wheel identity changed'
files=['taiko_bot/offline/score_calculator.py',
       'taiko_bot/runtime/player/center/duplicate_versions.py',
       'taiko_bot/runtime/player/center/b30_support/duplicate_versions.py',
       'taiko_bot/runtime/player/center/b30_support/b30_single.py',
       'taiko_bot/runtime/player/center/b30_support/b30_render.py',
       'taiko_bot/runtime/player/center/recommendation_support/duplicate_versions.py',
       'taiko_bot/runtime/player/center/recommendation_support/score_calculator.py',
       'taiko_bot/runtime/player/client/recommendation_support/catalog.py',
       'taiko_bot/runtime/player/client/recommendation_support/score_calculator.py',
       'taiko_bot/runtime/player/client/b30_support/score_calculator.py']
probe='''import importlib.metadata as m,json,hashlib,sys
from pathlib import Path
out={}
for name in ('taiko-bot','taiko-application','sakura-taiko-core','sakura-taiko-contract'):
 d=m.distribution(name);assert not json.loads(d.read_text('direct_url.json') or '{}').get('dir_info',{}).get('editable')
 out[name]={'version':d.version,'root':str(d.locate_file('')),'recordSha256':hashlib.sha256(d.read_text('RECORD').encode()).hexdigest()}
d=m.distribution('taiko-bot');out['files']={f:hashlib.sha256(d.locate_file(f).read_bytes()).hexdigest() for f in json.loads(sys.argv[1])}
print(json.dumps(out))'''
identities={}
for role,executable in [('center',python),('client',manifest['roles']['client']['python'])]:
    value=json.loads(subprocess.check_output([executable,'-I','-c',probe,json.dumps(files)],text=True,timeout=20))
    assert value['taiko-bot']['version']==tomllib.loads((a.bot_source/'pyproject.toml').read_text())['project']['version']
    assert value['taiko-application']['version']==tomllib.loads((a.bot_source/'packages/taiko-application/pyproject.toml').read_text())['project']['version']
    assert value['sakura-taiko-core']['version']==('0.1.1' if role=='center' else '0.1.2')
    for file in files:assert value['files'][file]==digest(a.bot_source/file),file+' installed/source mismatch'
    identities[role]=value
(evidence/'rating-installed-identities.json').write_text(json.dumps({'wheelSha256':digest(wheel),'roles':identities},indent=2))
env={**os.environ,'TAIKO_PYTHON_EXECUTABLE':python,'PYTHONDONTWRITEBYTECODE':'1',
     'TAIKO_RUNTIME_ENV_FILE':str(scratch/'absent.env')}
if a.sql:
    command=[node,str(root/'scripts/readiness/run-isolated-sql.mjs'),'--allow-test-db-mutation',
             '--rating-entry-bot-source='+str(a.bot_source),
             'taiko_viewer/tests/ratingEntryConsistencySql.test.mjs',
             'taiko_viewer/tests/developerAnalyticsSql.test.mjs']
    result=subprocess.run(command,cwd=root,env=env,timeout=650)
else:
    for executable in (python,manifest['roles']['client']['python']):
        for script in ('wheel_cache_smoke.py','catalog_revision.py'):
            subprocess.run([executable,'-I',str(a.bot_source/'tests/recommendation'/script)],cwd=root,env=env,timeout=30,check=True)
    result=subprocess.run([node,'--experimental-strip-types','--test','--test-concurrency=1',
                          *['taiko_viewer/tests/'+name+'.test.mjs' for name in
                            ('toolChartIdentity','developerAnalysisWorker','developerApiBatch1','versionProjection','viewerRelease')]],
                         cwd=root,env=env,timeout=120)
sys.exit(result.returncode)
