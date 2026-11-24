"""Bounded raw-file inspection only; no PublicationStore/API/database calls."""
import collections,datetime as dt,json,math,time,os,hashlib
from pathlib import Path
from zoneinfo import ZoneInfo
root=Path('/home/sigaer/taiko/userdata');deadline=time.monotonic()+90
summary={'archives':0,'points':0,'invalid':collections.Counter(),'future':[],'publication':[]}
dims=['大歌力','体力','高速处理','精度力','节奏处理','复合处理']
def finite(v):return type(v) in (int,float) and math.isfinite(v)
for path in root.glob('*/daily-ability-v1-top20.json'):
 if time.monotonic()>deadline:raise RuntimeError('Inspection deadline')
 if path.stat().st_size>8*1024**2:summary['invalid']['oversize']+=1;continue
 payload=json.loads(path.read_bytes());summary['archives']+=1
 for day,row in payload.get('days',{}).items():
  summary['points']+=1
  if not isinstance(row,dict):summary['invalid']['row-shape']+=1;continue
  count=row.get('sampleCount')
  if type(count) is not int or count<1:summary['invalid']['sample-count']+=1
  if not all(finite(row.get('dimensions',{}).get(name)) for name in dims):summary['invalid']['dimensions']+=1
  if not finite(row.get('rating')):summary['invalid']['rating']+=1
  if day>'2026-11-25' and len(summary['future'])<10:
   summary['future'].append({'day':day,'capturedAt':row.get('capturedAt'),'origin':row.get('origin'),'sampleCount':count,'computedAt':row.get('computedAt')})
# Only inspect current immutable object references. Hash only length mismatches.
for path in (root/'.taiko-publications').glob('*/committed.json'):
 if time.monotonic()>deadline:raise RuntimeError('Inspection deadline')
 if path.stat().st_size>32*1024**2:continue
 before=path.read_bytes();manifest=json.loads(before);ref=manifest.get('files',{}).get('current')
 if not ref:continue
 obj=path.parent/'objects'/ref['sha256']
 try: st=obj.stat()
 except FileNotFoundError:continue
 if st.st_size==ref['bytes']:continue
 digest=hashlib.sha256()
 with obj.open('rb') as stream:
  for chunk in iter(lambda:stream.read(65536),b''):digest.update(chunk)
 projection=root/(path.parent.name+'data.json')
 ps=projection.stat() if projection.exists() else None
 summary['publication'].append({'declaredBytes':ref['bytes'],'actualBytes':st.st_size,'hashMatches':digest.hexdigest()==ref['sha256'],'stableManifest':before==path.read_bytes(),'projectionSameInode':ps is not None and (st.st_dev,st.st_ino)==(ps.st_dev,ps.st_ino),'links':st.st_nlink})
# No paths, account identifiers, score values or private payloads in output.
print(json.dumps(summary,ensure_ascii=False))
