"""Run the actual CI list, identity reproduction and Contract checks in bounded QA."""
import argparse,json,os,re,signal,subprocess,time
from pathlib import Path
from completion_output import review_output
ap=argparse.ArgumentParser();ap.add_argument('--baseline');args=ap.parse_args()
signal.alarm(480)
root=Path(__file__).resolve().parents[3];out=review_output();start=time.monotonic()
workflow=(root/'.github/workflows/developer-api-batch1.yml').read_text();tests=re.search(r'run: node --experimental-strip-types --test (.+)',workflow).group(1).split()
if args.baseline:
 baseline={**os.environ,'VIEWER_GROWTH_BASELINE':args.baseline}
 with (out/'baseline-identity.log').open('w') as log:
  code=subprocess.run(['/www/server/nvm/versions/node/v24.13.0/bin/node','--experimental-strip-types','--test','tests/growthPageState.test.mjs'],cwd=root/'taiko_viewer',env=baseline,stdout=log,stderr=log,timeout=30).returncode
 assert code==0,'Baseline identity reproduction failed'
with (out/'related-tests.log').open('w') as log:
 result=subprocess.run(['/www/server/nvm/versions/node/v24.13.0/bin/node','--experimental-strip-types','--test','--test-concurrency=1',*tests],cwd=root/'taiko_viewer',stdout=log,stderr=log,timeout=360)
assert result.returncode==0,'Related tests failed; see bounded related-tests.log'
s=(out/'related-tests.log').read_text();count=int(re.search(r'(?:ℹ |# )tests (\d+)',s).group(1));passed=int(re.search(r'(?:ℹ |# )pass (\d+)',s).group(1));assert count==passed
checks=[]
for script in ['tools/generate_bindings.py','tests/test_api_v1.py']:
 with (out/('contract-'+Path(script).stem+'.log')).open('w') as log:
  code=subprocess.run(['/usr/bin/python3','-I',script]+(['--check'] if script.startswith('tools') else []),cwd=root/'packages/sakura-taiko-contract',stdout=log,stderr=log,timeout=30).returncode
 assert code==0,script
 checks.append({'script':script,'exitCode':code})
(out/'unit-tests.json').write_text(json.dumps({'pass':True,'tests':count,'passed':passed,'testFiles':tests,'contractChecks':checks,'run':os.environ.get('QA_RUN_DIR'),'seconds':round(time.monotonic()-start,2)},indent=2)+'\n')
print(json.dumps({'pass':True,'tests':count,'passed':passed,'contractChecks':checks}))
