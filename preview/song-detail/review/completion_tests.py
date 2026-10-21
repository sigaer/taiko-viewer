from completion_output import review_output
import json,os,re,signal,subprocess,time
from pathlib import Path
signal.alarm(300)
root=Path(__file__).resolve().parents[3];out=review_output();start=time.monotonic()
node='/www/server/nvm/versions/node/v24.13.0/bin/node'
tests=['versionProjection.test.mjs','developerApiBatch1.test.mjs','developerAnalysisWorker.test.mjs','viewerRelease.test.mjs','toolChartIdentity.test.mjs','recommendationToolIdentity.test.mjs','recommendationGoalIdentity.test.mjs','playerGoalService.test.mjs','playerGoalHttp.test.mjs','playerGoal.test.ts','goalEvaluation.test.ts','homeGrowthFeedback.test.ts','growthFeedback.test.ts','homeStateResolver.test.ts','homePresentation.test.ts','personalHomeLocale.test.ts']
log=out/'related-tests.log'
with log.open('w') as f:
 r=subprocess.run([node,'--experimental-strip-types','--test','--test-concurrency=1',*['tests/'+t for t in tests]],cwd=root/'taiko_viewer',stdout=f,stderr=f,timeout=180)
assert r.returncode==0,'related unit tests failed; see bounded log'
s=log.read_text();count=int(re.search(r'(?:ℹ |# )tests (\d+)',s).group(1));passed=int(re.search(r'(?:ℹ |# )pass (\d+)',s).group(1));assert count==passed
checks=[]
for script in ['tools/generate_bindings.py','tests/test_api_v1.py']:
 with (out/('contract-'+Path(script).stem+'.log')).open('w') as f:
  args=['/usr/bin/python3','-I',script]+(['--check'] if script.startswith('tools') else [])
  code=subprocess.run(args,cwd=root/'packages/sakura-taiko-contract',stdout=f,stderr=f,timeout=30).returncode
 assert code==0,script
 checks.append({'script':script,'exit':code})
proxy='http://127.0.0.1:33233'
probe=subprocess.run(['/usr/bin/curl','--proxy',proxy,'--noproxy','','--max-time','15','--silent','--show-error','--fail','--output','/dev/null','--write-out','%{http_code}','https://registry.npmjs.org/-/ping'],text=True,capture_output=True,timeout=20)
assert probe.returncode==0 and probe.stdout=='200','explicit proxy probe failed'
(out/'network.json').write_text(json.dumps({'proxy':proxy,'credentialFree':True,'endpoint':'https://registry.npmjs.org/-/ping','http':200,'bypassDisabled':True},indent=2)+'\n')
result={'pass':True,'tests':count,'passed':passed,'failed':0,'testFiles':tests,'contractChecks':checks,'run':os.environ.get('QA_RUN_DIR'),'seconds':round(time.monotonic()-start,2)}
(out/'unit-tests.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
