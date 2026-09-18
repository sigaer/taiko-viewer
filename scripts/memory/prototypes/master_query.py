"""Controlled public-master-data prototype. Never imports/starts a bot or writes source data."""
import argparse, copy, gc, hashlib, json, os, sqlite3, time, tracemalloc
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('mode',choices=['prepare','current','sqlite']);p.add_argument('source');p.add_argument('database');p.add_argument('--profile',action='store_true');a=p.parse_args()
def pss():
 return int(next(l.split()[1] for l in Path('/proc/self/smaps_rollup').read_text().splitlines() if l.startswith('Pss:')))
start=time.perf_counter();base=pss()
if a.profile:tracemalloc.start(10)
if a.mode=='prepare':
 con=sqlite3.connect(a.database);con.execute('CREATE TABLE rows (id INTEGER PRIMARY KEY, body TEXT NOT NULL)')
 with open(a.source) as f:rows=json.load(f)
 for row in rows:con.execute('INSERT OR REPLACE INTO rows VALUES (?,?)',(int(row['id']),json.dumps(row,ensure_ascii=False,separators=(',',':'))))
 con.commit();print(json.dumps({'prepared':len(rows)}));raise SystemExit
if a.mode=='current':
 with open(a.source) as f:rows=json.load(f)
 # Matches pjskClient _read_masterdata_json plus RESOURCE_BOX_INDEX ownership.
 fallback_cache=copy.deepcopy(rows);index={int(row['id']):row for row in rows};del rows
 def query(key):return index[key]
 keys=sorted(index)[::max(1,len(index)//100)][:100]
else:
 con=sqlite3.connect(f'file:{a.database}?mode=ro',uri=True)
 con.execute('PRAGMA cache_size=-2048');con.execute('PRAGMA mmap_size=0')
 ids=[r[0] for r in con.execute('SELECT id FROM rows ORDER BY id')]
 keys=ids[::max(1,len(ids)//100)][:100];del ids
 def query(key):return json.loads(con.execute('SELECT body FROM rows WHERE id=?',(key,)).fetchone()[0])
gc.collect();startup=time.perf_counter()-start;resident=pss()
result=[query(k) for k in keys]
digest=hashlib.sha256(json.dumps(result,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
latencies=[];started=time.perf_counter()
for i in range(10000):
 t=time.perf_counter_ns();row=query(keys[i%len(keys)]);latencies.append(time.perf_counter_ns()-t)
elapsed=time.perf_counter()-started;latencies.sort()
report=dict(mode=a.mode,base_pss_kib=base,pss_kib=resident,delta_pss_kib=resident-base,startup_seconds=startup,queries=10000,qps=10000/elapsed,lookup_p50_us=latencies[5000]/1000,lookup_p95_us=latencies[9500]/1000,digest=digest)
if a.profile:
 current,peak=tracemalloc.get_traced_memory();report['python_allocated_bytes']=current;report['python_peak_bytes']=peak
 report['top_allocations']=[dict(file=Path(s.traceback[0].filename).name,line=s.traceback[0].lineno,bytes=s.size,count=s.count) for s in tracemalloc.take_snapshot().statistics('lineno')[:6]]
print(json.dumps(report))
Path(a.database+'.'+a.mode+'.sample.json').write_text(json.dumps(result,sort_keys=True,separators=(',',':'),ensure_ascii=False))
