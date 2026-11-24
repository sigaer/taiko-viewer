import sys,runpy,time,statistics,json,resource
from pathlib import Path
root=Path(sys.argv[1]);ns=runpy.run_path(str(root/'tests/correctness/run.py'),run_name='benchmark_helpers')
from sakura_taiko_core.chart.availability import cn_available_chart_keys
rows=[dict(id=i,shelf_status=0,level_4=9,level_5=10) for i in range(1,3001)]
config={str(i):ns['chart'](i) for i in range(1,1501)}
stats=[ns['stats'](i) for i in range(1,21)]
result={}
for name,work in [('catalog',lambda:cn_available_chart_keys(rows,rows)),('recommendation',lambda:ns['candidates'].recommend_songs(stats,config,[(10,10)],cn_available_chart_keys={(i,4) for i in range(1,1501)}))]:
 samples=[]
 for _ in range(25):
  start=time.perf_counter();value=work();samples.append((time.perf_counter()-start)*1000)
 result[name]={'p50ms':round(statistics.median(samples),3),'p95ms':round(sorted(samples)[23],3),'size':len(value)}
result['maxRssKiB']=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
print(json.dumps(result))
