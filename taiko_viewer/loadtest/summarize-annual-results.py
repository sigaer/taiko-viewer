#!/usr/bin/env python3
"""Read saved evidence only; no service requests or database mutations."""
import json,re,sys
from pathlib import Path
root=Path(sys.argv[1]).resolve();result_dir=root/'results'
observations={int(p.stem.split('-')[-1]):p for p in result_dir.glob('observations-*.json')}
rows=[]
def rss(status):
 m=re.search(r'VmRSS:\s+(\d+)',status or '')
 return round(int(m[1])/1024,2) if m else None
for p in sorted(result_dir.glob('*.json')):
 if not re.fullmatch(r'(?:smoke|parallel[23]|same[25]|share2?|warm|burst|mixed|recovery|cold)-\d+',p.stem):continue
 x=json.loads(p.read_text());stamp=int(p.stem.split('-')[-1]);nearest=min(observations,key=lambda t:abs(t-stamp));assert abs(nearest-stamp)<1000,'Missing corresponding observer'
 op=observations[nearest];o=json.loads(op.read_text());s=o['samples'];assert s,'Empty observation'
 row={k:x.get(k) for k in ['candidate','scenario','targetRate','model','planned','started','completed','failed','unfinished','httpRequests','droppedSlots','notStarted','elapsedSeconds','offerWindowSeconds','observedStartsPerSecond','p95','p99','warmLatency','stopReason']}
 row.update(result=p.name,observations=op.name,observationFailure=o['failure'],actualGeneratorUnits=sum('generator' in u for u in o['units']),actualRendererUnits=sum('renderer' in u for u in o['units']),minAvailableMiB=min(a['availableMiB'] for a in s),maxMemoryPsiFull=max([a['fullPsi'] for a in s]+[a['fullPsi'] for a in x.get('resources',[])]),endWorkers=len(s[-1]['workers']))
 for kind in ['generator','renderer']:
  row[kind+'PeakConcurrent']=max(sum(kind in w['name'] for w in a['workers']) for a in s)
  row[kind+'SampledPeakMiB']=max([w['memory']/1048576 for a in s for w in a['workers'] if kind in w['name']]or[0])
  row[kind+'EndPending']=sum(j['state'] in ['running','queued'] for j in json.loads(s[-1].get(kind)or'[]'))
 for kind in ['server','mysql']:
  values=[rss(a.get(kind+'Status')) for a in s];row[kind+'RssMiB']={'first':values[0],'peak':max(v for v in values if v is not None),'last':values[-1]}
 row['transactions']=[{k:r.get(k) for k in ['ok','userId','operation','ms','jobId','cached','width','height']} for r in x['records']] if len(x['records'])<=32 else None
 rows.append(row)
assert len({json.dumps(r['candidate'],sort_keys=True) for r in rows})==1,'Mixed candidate evidence'
out=root/'evidence/result-summary.json';out.write_text(json.dumps(rows,ensure_ascii=False,indent=2));print(out)
for r in rows:print(r['scenario'],r['targetRate'],f"{r['completed']}/{r['started']}",f"p95={r['p95']:.2f} p99={r['p99']:.2f}",f"G/R={r['actualGeneratorUnits']}/{r['actualRendererUnits']}",f"end={r['endWorkers']}")
