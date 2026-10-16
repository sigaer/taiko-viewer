import os,json,sys,subprocess,importlib.util,hashlib
from pathlib import Path
R=Path(__file__).resolve().parents[2];V=Path('/home/sigaer/taiko/qa-vault');E=Path(os.environ['QA_EVIDENCE_DIR']);N=Path('/www/server/nvm/versions/node/v24.13.0/bin')
spec=importlib.util.spec_from_file_location('bounded',R/'scripts/readiness/verify-runtime-integration.py');b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
manifest=V/'artifacts/runtime-manifest.json';assert hashlib.sha256(manifest.read_bytes()).hexdigest()=='407a3ad925ef2b22d96639153758e644e4723e33e5e6e56ccf800b0e95e217b4';m=json.loads(manifest.read_text())
env={**os.environ,'PATH':str(N)+':/usr/bin:/bin','TAIKO_PYTHON_EXECUTABLE':m['candidate']['python'],'PYTHONDONTWRITEBYTECODE':'1','TAIKO_RUNTIME_ENV_FILE':str(Path(os.environ['QA_RUN_TMPDIR'])/'absent.env')}
mode=sys.argv[1]
if mode=='install':commands=[('locked-install',[str(N/'npm'),'ci','--ignore-scripts','--no-audit','--no-fund'],R/'taiko_viewer')]
elif mode=='sql':commands=[('integration-sql-http',[str(N/'node'),str(R/'scripts/readiness/run-isolated-sql.mjs'),'--allow-test-db-mutation','--test-name-pattern=^My Taiko isolated','taiko_viewer/tests/myTaikoIntegrationSql.test.mjs'],R)]
elif mode=='product':commands=[('product-nuxt-sql-http',[str(N/'node'),str(R/'scripts/readiness/run-isolated-sql.mjs'),'--allow-test-db-mutation','--test-name-pattern=^My Taiko product','taiko_viewer/tests/myTaikoProductNuxt.test.mjs'],R)]
elif mode=='scoped-types':commands=[('prepare-scoped-types',[str(N/'node'),str(R/'taiko_viewer/node_modules/nuxt/bin/nuxt.mjs'),'prepare'],R/'taiko_viewer'),('scoped-typecheck',[str(N/'node'),str(R/'scripts/readiness/check-my-taiko-types.mjs')],R)]
elif mode=='recovery':commands=[('schema-recovery-sql-http',[str(N/'node'),str(R/'scripts/readiness/run-isolated-sql.mjs'),'--allow-test-db-mutation','--test-name-pattern=^RC4 schema','taiko_viewer/tests/viewer083SchemaRecovery.test.mjs'],R)]
elif mode=='integration':
 build=Path(sys.argv[2]).resolve();assert build.is_relative_to(V/'evidence');receipt=json.loads(build.read_text());assert receipt['status']=='PASS';(E/'integration-build.json').write_bytes(build.read_bytes())
 commands=[('unmodified-integration-nuxt',[str(N/'node'),str(R/'scripts/readiness/run-isolated-sql.mjs'),'--allow-test-db-mutation','--test-name-pattern=^RC4 integration','taiko_viewer/tests/viewer083IntegrationNuxt.test.mjs'],R)]
elif mode=='examples':commands=[('examples-and-bundle',[str(N/'node'),str(R/'scripts/readiness/verify-viewer1-developer-examples.mjs')],R)]
else:raise SystemExit('unknown mode')
records=[]
for name,cmd,cwd in commands:
 row=b.run(cmd,E,env,name,cwd);records.append(row);print(json.dumps({'task':name,'status':row['status'],'log':row['log']}),flush=True)
 if row['status']!='PASS':break
files=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','--','taiko_viewer/server/services/my-taiko','taiko_viewer/server/api/account/my-taiko','taiko_viewer/types/my-taiko.ts','taiko_viewer/components/my-taiko','taiko_viewer/pages/my/index.vue','taiko_viewer/tests/myTaikoProductNuxt.test.mjs','scripts/readiness/check-my-taiko-types.mjs','taiko_viewer/tests/prototypes','taiko_viewer/tests/myTaikoIntegrationSql.test.mjs','taiko_viewer/tests/fixtures/goalSqlRuntime.mjs','taiko_viewer/server/services/account/current-source.ts','taiko_viewer/server/services/growth-history','examples/developer-api-v1','scripts/readiness/verify-viewer1-developer-examples.mjs'],cwd=R,text=True).splitlines()
report={'records':records,'inputs':[{'file':f,'sha256':hashlib.sha256((R/f).read_bytes()).hexdigest()} for f in files],'contractFrozen':True,'productionAccess':False,'installedPython':m['candidate']['python']};(E/(mode+'-summary.json')).write_text(json.dumps(report,indent=2)+'\n');sys.exit(0 if all(r['status']=='PASS' for r in records) else 1)
