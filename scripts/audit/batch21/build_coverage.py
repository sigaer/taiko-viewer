"""Derive coverage from existing evidence; do not rerun the 3003-file parser."""
import gzip,hashlib,json,sys,tarfile
from collections import Counter
from pathlib import Path
BASE=Path('/var/tmp/taiko-batch21-20261124')
sys.path.insert(0,str(BASE/'bot'))
from taiko_bot.catalog.coverage import assess
OUT=BASE/'viewer/docs/wahlap-authority-b21-20261124/coverage';OUT.mkdir(exist_ok=True)
old=BASE/'viewer/docs/catalog-release-batch2-20261124'
identity=json.loads((old/'catalog/song-chart-identity-map.json').read_text())
metadata=json.loads(Path('/home/sigaer/taiko/songs/song_data.json').read_text())
paths={}
for song in metadata:
    reference=song.get('tja_path')
    if reference:
        prefix='supplemental/ourtaiko/' if song.get('resource_source')=='ourtaiko' else 'ESE/'
        paths[str(song['id'])]=prefix+reference
scroll={}
with tarfile.open('/var/tmp/taiko-batch2-20261124/evidence/tja-source-corpus.tar.gz') as archive:
    for member in archive:
        raw=archive.extractfile(member).read()
        scroll[member.name]={'hash':hashlib.sha256(raw).hexdigest(),'hasScroll':b'#SCROLL' in raw.upper()}
needed={source for source in paths.values()}
by_source={}; count=0
with gzip.open('/var/tmp/taiko-batch2-20261124/evidence/full-tja-scan.jsonl.gz','rt') as stream:
    for line in stream:
        record=json.loads(line);count+=1
        frozen=scroll[record['source']];assert frozen['hash']==record['sourceHash']
        record['hasScroll']=frozen['hasScroll']
        if record['source'] in needed:
            by_source[record['source']]={course:assess(record,course) for course in record.get('courses',{})}
assert count==3003
courses={1:'easy',2:'normal',3:'hard',4:'oni',5:'edit'}
coverage={}; baseline={}; missing=[]
for song in identity:
    sid=song['songId'];source=paths.get(sid)
    for difficulty in range(1,6):
        key=f'{sid}:{difficulty}'; value=by_source.get(source,{}).get(courses[difficulty])
        if value is None:
            value={'sourceHash':scroll.get(source,{}).get('hash'),'rawAvailability':'AVAILABLE' if source in scroll else 'MISSING',
                'parserStatus':'UNAVAILABLE','parserVersion':None,
                'diagnostics':['COURSE_UNAVAILABLE' if source in scroll else 'RAW_UNAVAILABLE'],
                'features':{name:'UNAVAILABLE' for name in ['basicNoteSequence','bigNotes','bpm','delay','measure','offset','scroll','roll','balloon','branch','localDensity','rhythmFeatures','patternFeatures']}}
        coverage[key]=value
    for chart in song['charts']:
        if chart['course'] in (4,5) and chart['cnCurrentPlayableCandidate']:
            key=f"{sid}:{chart['course']}";baseline[key]=coverage[key]
            if coverage[key]['rawAvailability']!='AVAILABLE': missing.append(key)
assert len(baseline)==1387
(OUT/'all-chart-coverage.json').write_text(json.dumps(coverage,ensure_ascii=False,separators=(',',':'))+'\n')
(OUT/'cn-1387-coverage.json').write_text(json.dumps(baseline,ensure_ascii=False,separators=(',',':'))+'\n')
summary={'inputFilesVerified':count,'baselineCharts':len(baseline),'rawUnavailable':missing,
    'featureCounts':{name:dict(Counter(row['features'][name] for row in baseline.values())) for name in next(iter(baseline.values()))['features']},
    'scope':'Static paths and chart-relative note times only. BPM/DELAY command instants, absolute OFFSET alignment, Scroll and dynamic LEVELHOLD are not fully validated. Rhythm interval histogram is partial; no pattern extractor.',
    'sourceScanSha256':'d03e4956b126b2e6bafa3a6fef53d4e8d9df53d0441c489346b51519d3c15944'}
(OUT/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(summary,ensure_ascii=False))
