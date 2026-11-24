"""Supplement initial read-only evidence; historical hashes and identity joins."""
import collections, datetime as dt, gzip, hashlib, json, os, subprocess, time
from pathlib import Path
import pymysql
from dotenv import dotenv_values
from openpyxl import load_workbook
BASE=Path('/var/tmp/taiko-batch2-20261124');DOC=BASE/'integration/docs/catalog-release-batch2-20261124';PRIVATE=BASE/'evidence/integrity-private';SONGS=Path('/home/sigaer/taiko/songs');ROOT=SONGS.parent/'userdata'
def sha(p):
    with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def save(p,obj):p.write_text(json.dumps(obj,ensure_ascii=False,indent=2,default=str)+'\n')
anomalies=json.loads((PRIVATE/'publication-anomalies-private.json').read_bytes());details=[]
for case in anomalies:
    folder=ROOT/'.taiko-publications'/case['identity'];unique={};versions=[]
    for p in sorted((folder/'commits').glob('*.json')):
        m=json.loads(p.read_bytes())
        for key,ref in m.get('files',{}).items():
            if not ref:continue
            h=ref['sha256'];obj=folder/'objects'/h
            if h not in unique:
                s=obj.stat();unique[h]={'expectedBytes':ref['bytes'],'actualBytes':s.st_size,'actualSha256':sha(obj),'links':s.st_nlink,'inode':s.st_ino,'mtimeNs':s.st_mtime_ns,'stable':False};unique[h]['stable']=s.st_mtime_ns==obj.stat().st_mtime_ns
            versions.append({'sequence':m['sequence'],'key':key,'sha256':h,'valid':unique[h]['actualSha256']==h and unique[h]['expectedBytes']==unique[h]['actualBytes']})
    details.append({'identity':case['identity'],'objects':unique,'versionReferences':versions})
save(PRIVATE/'publication-historical-objects.json',details)
env=dotenv_values('/etc/taiko-viewer.env');db=pymysql.connect(host=env.get('TAIKO_DB_HOST','127.0.0.1'),port=int(env.get('TAIKO_DB_PORT','3306')),user=env['TAIKO_DB_USER'],password=env['TAIKO_DB_PASSWORD'],database=env.get('TAIKO_DB_NAME','taiko'),cursorclass=pymysql.cursors.DictCursor,connect_timeout=5,read_timeout=15,autocommit=False)
try:
    with db.cursor() as c:
        c.execute('START TRANSACTION READ ONLY')
        for case in details:
            c.execute('SELECT id,user_id,taiko_id FROM web_taiko_bindings WHERE taiko_id=%s',(case['identity'],));case['bindings']=c.fetchall()
finally:db.rollback();db.close()
save(PRIVATE/'publication-impact-bindings.json',details)
save(DOC/'integrity/publication-historical-summary.json',{'qaRun':os.environ['QA_RUN_ID'],'cases':[{'case':i+1,'uniqueObjects':len(d['objects']),'referenceCount':len(d['versionReferences']),'badReferences':sum(not v['valid'] for v in d['versionReferences']),'generations':len(set(v['sequence'] for v in d['versionReferences'])),'currentlyBoundAccounts':len(set(x['user_id'] for x in d['bindings']))} for i,d in enumerate(details)]})
# Candidate source writer inventory: records code locations, never runtime payloads.
writers=[]
for repo in [BASE/'bot',BASE/'integration']:
    names=subprocess.check_output(['git','ls-files','-z'],cwd=repo).decode().split('\0')
    for name in filter(None,names):
        if not name.endswith(('.py','.ts','.mjs')) or name.startswith(('docs/','tests/')) or '/tests/' in name:continue
        p=repo/name
        if p.stat().st_size>1024**2:continue
        lines=p.read_text(errors='replace').splitlines()
        relevant=any(t in '\n'.join(lines) for t in ['userdata','Publication','data.json'])
        if not relevant:continue
        for i,line in enumerate(lines,1):
            if any(t in line for t in ['os.link(','.write_text(','.write_bytes(','writeFile(','json.dump(','"w"',"'w'"]):writers.append({'repo':repo.name,'path':name,'line':i,'text':line.strip()[:320]})
save(DOC/'integrity/writer-provenance-inventory.json',writers)
merged=json.loads((SONGS/'song_data.json').read_bytes());mapping=json.loads((SONGS/'song_id2tjapath.json').read_bytes());rating=json.loads((SONGS/'rating_structured_with_ids.json').read_bytes())['songs'];identity=json.loads((DOC/'catalog/song-chart-identity-map.json').read_bytes())
bychart=collections.defaultdict(list)
for key,row in rating.items():bychart[str(row.get('id'))+':'+str(row.get('level'))].append(key)
missing=[]
for song in identity:
    sid=song['songId'];candidate=mapping.get(sid);song['tjaMapping']=candidate
    if candidate:
        p=Path(candidate)
        if not p.is_absolute():p=Path('/home/sigaer/git/ESE_autosync')/p
        song['rawResource']={'path':str(p),'exists':p.is_file()}
        if p.is_file():song['rawResource'].update(sha256=sha(p),bytes=p.stat().st_size)
        else:missing.append(sid)
    for chart in song['charts']:chart['ratingRowKeys']=bychart[sid+':'+str(chart['course'])]
save(DOC/'catalog/song-chart-identity-map.json',identity)
workbook=load_workbook(SONGS/'alias.xlsx',read_only=True,data_only=True)
sheets=[]
try:
    for sheet in workbook:
        iterator=sheet.iter_rows(values_only=True);header=next(iterator,());rows=0
        for row in iterator:rows+=1
        sheets.append({'name':sheet.title,'header':[str(v) if v is not None else None for v in header],'rows':rows})
finally:workbook.close()
save(DOC/'catalog/identity-join-summary.json',{'qaRun':os.environ['QA_RUN_ID'],'mappedSongs':sum(bool(x.get('tjaMapping')) for x in identity),'missingMappedResources':missing,'ratingChartKeys':len(bychart),'aliasWorkbook':sheets})
# Raw retained score evidence links are candidates, not proof of each HTTP revision.
groups=json.loads((PRIVATE/'measurement-groups-private.json').read_bytes());association=[]
for g in groups:
    day='2026-11-22' if g['group']==1 else '2026-11-23';row=g['archive']['payload']['days'][day];source=row.get('bxx',{}).get('source');item={'group':g['group'],'archiveSourceReference':source,'historyCandidates':g['scoreHistory']}
    binding=g['binding'];manifest=ROOT/'.taiko-publications'/str(binding['taiko_id'])/'committed.json'
    item['currentManifestExists']=manifest.exists()
    if manifest.exists():
        m=json.loads(manifest.read_bytes());item['currentReference']=m.get('files',{}).get('current');item['matchingHistoryKeys']=[key for key,r in m.get('files',{}).items() if r and r['sha256']==source]
    association.append(item)
save(PRIVATE/'measurement-source-association.json',association)
# Case cards derived from actual source hashes; human expert validation remains pending.
examples=[]
with gzip.open(BASE/'evidence/full-tja-scan.jsonl.gz','rt') as f:
    for line in f:
        value=json.loads(line)
        if any(word in value['source'].lower() for word in ['tenjiku','donkama','yokuderu','clotho']) and len(examples)<8:
            examples.append({'source':value['source'],'sourceHash':value['sourceHash'],'status':value['status'],'diagnostics':value['diagnostics'],'courses':{k:{'bpm':v['bpm'],'level':v['level'],'paths':{b:{key:p[key] for key in ['noteCount','bigNotes','rolls','balloons','chartRelativeDurationMs','diagnostics']} for b,p in v['paths'].items()}} for k,v in value['courses'].items()},'expertReview':'PENDING'})
save(DOC/'timeline/expert-case-evidence.json',examples)
print(json.dumps({'qaRun':os.environ['QA_RUN_ID'],'publicationCases':len(details),'writerLocations':len(writers),'aliasSheets':len(sheets),'missingMappedResources':len(missing),'expertCaseCards':len(examples)}))
