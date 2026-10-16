import os,json,sys,subprocess,time,importlib.util,hashlib
from pathlib import Path
R=Path(__file__).resolve().parents[2];V=Path('/home/sigaer/taiko/qa-vault');O=V/'evidence/083-contract-api-20261016'
spec=importlib.util.spec_from_file_location('bounded',R/'scripts/readiness/verify-runtime-integration.py');b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
manifest=V/'artifacts/runtime-manifest.json';m=json.loads(manifest.read_text());N='/www/server/nvm/versions/node/v24.13.0/bin/node';E={**os.environ,'TAIKO_PYTHON_EXECUTABLE':m['candidate']['python'],'PYTHONDONTWRITEBYTECODE':'1','TAIKO_RUNTIME_ENV_FILE':str(Path(os.environ['QA_RUN_TMPDIR'])/'absent.env')}
assert hashlib.sha256(manifest.read_bytes()).hexdigest()=='407a3ad925ef2b22d96639153758e644e4723e33e5e6e56ccf800b0e95e217b4'
mode=sys.argv[1];commands=[]
if mode=='sql':commands=[('sql-http',[N,str(R/'scripts/readiness/run-isolated-sql.mjs'),'--allow-test-db-mutation','--test-name-pattern=^(Developer API v1 real|explicit service Source/scope|anonymous update/history)','taiko_viewer/tests/developerApiV1Sql.test.mjs','taiko_viewer/tests/sourceProxySql.test.mjs'])]
elif mode=='contract':
 commands=[('generated-bindings',['/usr/bin/python3',str(R/'packages/sakura-taiko-contract/tools/generate_bindings.py'),'--check']),('js-goldens',[N,'--experimental-strip-types','--test','--test-reporter=tap',str(R/'packages/sakura-taiko-contract/tests/contract.test.mjs'),str(R/'packages/sakura-taiko-contract/tests/viewer-read.test.mjs'),str(R/'packages/sakura-taiko-contract/tests/api-v1.test.mjs')]),('python-goldens',[m['candidate']['python'],'-I',str(R/'packages/sakura-taiko-contract/tests/test_contract.py')]),('python-api-goldens',[m['candidate']['python'],'-I',str(R/'packages/sakura-taiko-contract/tests/test_api_v1.py')])]
else:raise SystemExit('unknown mode')
records=[]
for name,cmd in commands:
 row=b.run(cmd,Path(os.environ['QA_EVIDENCE_DIR']),E,name,R);records.append(row);print(json.dumps({'task':name,'status':row['status'],'log':row['log']}),flush=True)
 if row['status']!='PASS':break
path=Path(os.environ['QA_EVIDENCE_DIR'])/(mode+'-summary.json');inputs=[]
for relative in subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','--','packages/sakura-taiko-contract','taiko_viewer/server/services/developer-api-v1','taiko_viewer/server/infrastructure/developer-api-v1','taiko_viewer/server/api/v1','taiko_viewer/server/api/account/developer/grants','taiko_viewer/server/api/account/developer/clients','taiko_viewer/pages/account/developer/grants.vue','taiko_viewer/tests/developerApiV1Sql.test.mjs','taiko_viewer/tests/fixtures/developerApiV1Ui.mjs','taiko_viewer/lib/developer-api-v1.ts','taiko_viewer/scripts/migrate_developer_api_v1.ts','scripts/readiness/run-isolated-sql.mjs'],cwd=R,text=True).splitlines():
 p=R/relative;inputs.append({'file':relative,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
path.write_text(json.dumps({'mode':mode,'records':records,'inputs':inputs,'runtimeManifestSha256':hashlib.sha256(manifest.read_bytes()).hexdigest(),'productionAccess':False},indent=2)+'\n');print(json.dumps({'summary':str(path)}));sys.exit(0 if len(records)==len(commands) and all(x['status']=='PASS' for x in records) else 1)
