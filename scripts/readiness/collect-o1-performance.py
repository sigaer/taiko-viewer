#!/usr/bin/env python3
"""Read only synthetic cohort result paths printed by the owned SQL launcher."""
import argparse, hashlib, json, re
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--logs',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
assert a.logs.resolve().is_relative_to('/var/tmp') and not a.output.exists()
def sha(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for chunk in iter(lambda:f.read(65536),b''):h.update(chunk)
 return h.hexdigest()
r={'schemaVersion':1,'status':'EVIDENCE_PENDING','productionAccess':False,'cohorts':[],'notTested':['private-merged','passport-extreme-2000','annual-warm-1/s-3/s-5/s','annual-cold-30-identities-including-queue','same-input-old-artifact-comparison']}
for log in sorted(a.logs.glob('*.log')):
 item={'launcherLog':str(log),'launcherLogSha256':sha(log)}
 paths=re.findall(r'"workspace":"([^"]+)"',log.read_text())
 if not paths:item.update(status='INCOMPLETE',reason='launcher did not finish');r['cohorts'].append(item);continue
 work=Path(paths[-1]);assert work.resolve().is_relative_to('/var/tmp')
 result=work/'o1-performance.json'
 if not result.exists():item.update(status='HARNESS_FAIL',sqlResult=str(work/'result.json'));r['cohorts'].append(item);continue
 data=json.loads(result.read_text());item.update({key:data.get(key) for key in ['status','operation','concurrency','requested','samplesPerScale','summary','byScale','manifest','targets','failureDistribution','processResourceUsage','resourceScope','requestDeadlineMs','baselineComparison','error']})
 item['rawEvidence']={'path':str(result),'sha256':sha(result),'bytes':result.stat().st_size};item['sqlEvidence']={'path':str(work/'result.json'),'sha256':sha(work/'result.json')};item['testLog']={'path':str(work/'tests.log'),'sha256':sha(work/'tests.log')};r['cohorts'].append(item)
a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'output':str(a.output),'cohorts':len(r['cohorts']),'statuses':[x['status'] for x in r['cohorts']]}))
