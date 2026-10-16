#!/usr/bin/env python3
"""Aggregate immutable synthetic HTTP raw samples; never average percentiles."""
import os,argparse,hashlib,json,math,re
from collections import Counter,defaultdict
from pathlib import Path
vault=Path('/home/sigaer/taiko/qa-vault')
evidence_root=Path(os.environ['QA_EVIDENCE_DIR']).resolve(strict=True)
assert evidence_root.is_relative_to(vault) and evidence_root!=vault
p=argparse.ArgumentParser();p.add_argument('--logs',type=Path,action='append',required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
assert all(x.resolve().is_relative_to(evidence_root) for x in a.logs) and not a.output.exists()
assert a.output.resolve().is_relative_to(evidence_root),'Write summaries only within persistent QA evidence'
def sha(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for chunk in iter(lambda:f.read(65536),b''):h.update(chunk)
 return h.hexdigest()
def ref(path):return {'path':str(path),'sha256':sha(path),'bytes':path.stat().st_size}
def quantile(xs,p):return sorted(xs)[max(0,math.ceil(len(xs)*p)-1)] if xs else None
def stats(samples,requested):
 ok=[x['wallMs'] for x in samples if x.get('status')==200 and not x.get('error')]
 return dict(n=len(samples),success=len(ok),requested=requested,successRate=len(ok)/requested if requested else 0,p50Ms=quantile(ok,.5),p95Ms=quantile(ok,.95),p99Ms=quantile(ok,.99),failures=dict(Counter(x.get('error') or str(x.get('status')) for x in samples if x.get('status')!=200 or x.get('error'))),http429=sum(x.get('status')==429 for x in samples),timeout=sum(x.get('error')=='timeout' for x in samples),dropped=requested-len(samples),unfinished=sum(x.get('error')=='timeout' for x in samples),hardCapExceeded=sum(bool(x.get('hardCapExceeded')) for x in samples))
def maximum(xs):return max((x for x in xs if isinstance(x,(int,float))),default=None)
r={'schemaVersion':2,'status':'EVIDENCE_PENDING','productionAccess':False,'percentileMethod':'nearest rank over successful complete wall times; every failed/429/timeout/drop/unfinished counted separately; aggregate raw samples, never average percentile values','cohorts':[],'smokeAndInitialFailures':[],'measuredGroups':[],'notTested':['private-merged','annual-warm-1/s-3/s-5/s (separate Annual evidence)','annual-cold-30-identities-including-queue (separate Annual evidence)','same-input-old-artifact-comparison unless a separate report is attached']}
groups=defaultdict(lambda:{'samples':[],'requested':0,'refs':[],'manifests':[],'resourceFailures':[]})
for log in sorted({f for root in a.logs for f in root.glob('*.log')}):
 item={'launcherLog':ref(log)};paths=re.findall(r'"workspace":"([^"]+)"',log.read_text())
 if not paths:item.update(status='INCOMPLETE',reason='launcher did not finish');r['smokeAndInitialFailures'].append(item);continue
 work=Path(paths[-1]).resolve();assert re.fullmatch(r'qa-[0-9a-f]{12}',work.parent.parent.name) and work.parent.name=='evidence' and work.parent.parent.parent==vault/'runs' and work.name.startswith('viewer1-sql-');result=work/'o1-performance.json'
 if not result.exists():item.update(status='HARNESS_FAIL',sqlResult=ref(work/'result.json'));r['smokeAndInitialFailures'].append(item);continue
 data=json.loads(result.read_text());item.update({key:data.get(key) for key in ['status','operation','concurrency','requested','samplesPerScale','summary','byScale','manifest','targets','failureDistribution','processResourceUsage','resourceScope','requestDeadlineMs','baselineComparison','error','syntheticDress','syntheticAssetDataset','syntheticCatalogSha256','cgroup','limitations','clock','measurementRevision','streamValidation','loadModel','queueWaitMs','queueWaitReason']})
 item['rawEvidence']=ref(result);item['sqlEvidence']=ref(work/'result.json');item['testLog']=ref(work/'tests.log')
 if (work/'owned-datadir-cleanup.json').exists():item['cleanup']=ref(work/'owned-datadir-cleanup.json')
 resource=data.get('resource',[])
 item['resources']={'sampleCount':len(resource),'memoryPeakBytes':maximum(x.get('memoryPeak') for x in resource),'maxSwapBytes':maximum(x.get('swapBytes') for x in resource),'maxNodeRssKb':maximum(x.get('rssKb') for x in resource),'maxNodePssKb':maximum(x.get('pssKb') for x in resource),'hostAvailableMinKb':min((x['hostAvailableKb'] for x in resource if x.get('hostAvailableKb') is not None),default=None),'psiFullAvg10Max':maximum(float(m.group(1)) for x in resource if (m:=re.search(r'full avg10=([\d.]+)',x.get('psi') or ''))),'ioFirst':resource[0].get('io') if resource else None,'ioLast':resource[-1].get('io') if resource else None,'oomDelta':data.get('summary',{}).get('oomDelta'),'oomKillDelta':data.get('summary',{}).get('oomKillDelta'),'pressureStop':data.get('summary',{}).get('pressureStop')}
 if 'smoke' in log.name or data.get('samplesPerScale',0)<50:
  r['smokeAndInitialFailures'].append(item);continue
 r['cohorts'].append(item)
 for scale in data.get('byScale',[]):
  manifest=data.get('manifest',{});runtime=manifest.get('runtimeClosure') or {'declaredBaseline':manifest.get('viewerBaseline')}
  key=json.dumps([data['operation'],scale['scale'],data['concurrency'],manifest.get('taikoWheelSha256'),manifest.get('measurementRevision','full-json-consume-v1'),runtime,scale.get('inputSha256'),data.get('syntheticAssetDataset')],sort_keys=True)
  group=groups[key];group['samples'] += [v for v in data.get('samples',[]) if v['scale']==scale['scale']];group['requested']+=data.get('samplesPerScale',scale['n']);group['refs'].append(ref(result));group['manifests'].append(manifest);group['targets']=data['targets'];group['scope']={'operation':data['operation'],'scale':scale['scale'],'concurrency':data['concurrency'],'inputSha256':scale.get('inputSha256'),'syntheticAssetDataset':data.get('syntheticAssetDataset'),'runtimeClosure':runtime,'wheelSha256':manifest.get('taikoWheelSha256'),'artifactRole':manifest.get('artifactRole'),'measurementRevision':manifest.get('measurementRevision','full-json-consume-v1')}
  if data.get('summary',{}).get('pressureStop') or data.get('summary',{}).get('oomDelta') or data.get('summary',{}).get('oomKillDelta'):group['resourceFailures'].append(item['resources'])
for group in groups.values():
 summary=stats(group.pop('samples'),group.pop('requested'));target=group['targets'];group.update(summary)
 bad=group['resourceFailures'] or summary['successRate']<.995 or summary['hardCapExceeded'] or summary['p95Ms'] is None or summary['p95Ms']>target['p95Ms'] or summary['p99Ms']>target['p99Ms']
 group['status']='FAIL' if bad else 'PASS_SCOPED' if summary['success']>=200 else 'EVIDENCE_PENDING';r['measuredGroups'].append(group)
r['baselineComparisons']=[]
for candidate in r['measuredGroups']:
 if candidate['scope'].get('artifactRole')!='candidate':continue
 for old in r['measuredGroups']:
  if old['scope'].get('artifactRole')!='baseline' or old['scope']['wheelSha256']==candidate['scope']['wheelSha256']:continue
  keys=['operation','scale','concurrency','inputSha256','syntheticAssetDataset','runtimeClosure','measurementRevision']
  if all(old['scope'][key]==candidate['scope'][key] for key in keys):
   r['baselineComparisons'].append({'scope':{key:candidate['scope'][key] for key in keys},'status':'MEASURED_DIAGNOSTIC' if min(old['success'],candidate['success'])>=200 else 'INSUFFICIENT_SAMPLE_DIAGNOSTIC','oldN':old['n'],'candidateN':candidate['n'],'oldP95Ms':old['p95Ms'],'candidateP95Ms':candidate['p95Ms'],'oldP99Ms':old['p99Ms'],'candidateP99Ms':candidate['p99Ms'],'oldFailures':old['failures'],'candidateFailures':candidate['failures'],'oldRaw':old['refs'],'candidateRaw':candidate['refs'],'remaining93Wheels':'runtime harness asserts exact name/version/SHA equality'})
a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'output':str(a.output),'cohorts':len(r['cohorts']),'groups':len(r['measuredGroups']),'statuses':dict(Counter(x['status'] for x in r['measuredGroups']))}))
