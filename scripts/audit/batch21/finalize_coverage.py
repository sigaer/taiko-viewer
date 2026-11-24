"""Keep detailed derived intervals private; publish compact per-chart coverage."""
import gzip,hashlib,json,os
from pathlib import Path
BASE=Path('/var/tmp/taiko-batch21-20261124')
out=BASE/'viewer/docs/wahlap-authority-b21-20261124/coverage'
source=out/'all-chart-coverage.json';rows=json.loads(source.read_text())
manifest={}
for row in rows.values():
 version=row.get('parserVersion')
 if isinstance(version,dict):
  identifier='tja-static-batch2-3:'+hashlib.sha256(json.dumps(version,sort_keys=True,separators=(',',':')).encode()).hexdigest()
  manifest[identifier]=version;row['parserVersion']=identifier
with (BASE/'evidence/all-chart-feature-details.json.gz').open('xb') as target:
 with gzip.GzipFile(filename='',fileobj=target,mode='wb',mtime=0) as compressed:
  compressed.write(json.dumps(rows,ensure_ascii=False,separators=(',',':')).encode())
for row in rows.values():row.pop('staticPaths',None)
private=BASE/'evidence/chart-feature-coverage-all.json'
with private.open('x') as target:json.dump(rows,target,ensure_ascii=False,separators=(',',':'))
baseline=json.loads((out/'cn-1387-coverage.json').read_text())
for key in baseline:baseline[key]=rows[key]
(out/'cn-1387-coverage.json').write_text(json.dumps(baseline,ensure_ascii=False,separators=(',',':'))+'\n')
(out/'parser-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
source.unlink()  # Only this batch's generated intermediate, after durable copy.
print(json.dumps({'charts':len(rows),'cnCharts':len(baseline),'parserVersions':len(manifest),'privateCoverage':str(private),'bytes':private.stat().st_size}))
