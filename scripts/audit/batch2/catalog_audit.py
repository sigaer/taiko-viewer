"""Read-only catalog inventory; never import production writers or refreshers."""
import collections, hashlib, json, math, os, subprocess, time
from pathlib import Path

BASE=Path('/var/tmp/taiko-batch2-20261124')
SONGS=Path('/home/sigaer/taiko/songs')
OUT=BASE/'integration/docs/catalog-release-batch2-20261124/catalog'
OUT.mkdir(parents=True,exist_ok=True)
deadline=time.monotonic()+180
def sha(p):
    with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def positive(v):
    try:return not isinstance(v,bool) and math.isfinite(float(v)) and float(v)>0
    except (ValueError,TypeError):return False
def read(name):return json.loads((SONGS/name).read_bytes())
inventory=[]
for p in sorted(SONGS.iterdir()):
    if time.monotonic()>deadline:raise TimeoutError('catalog deadline')
    if not p.is_file() or p.suffix not in ('.json','.csv','.xlsx'):continue
    st=p.stat(); record={'path':str(p),'bytes':st.st_size,'sha256':sha(p),'mtimeNs':st.st_mtime_ns}
    if p.suffix=='.json' and st.st_size<=96*1024**2:
        value=json.loads(p.read_bytes());record.update(type=type(value).__name__,entries=len(value) if isinstance(value,(dict,list)) else None)
        sample=value[0] if isinstance(value,list) and value else value
        record['keys']=list(sample)[:55] if isinstance(sample,dict) else []
        if isinstance(value,list):
            record['shelfCounts']=dict(collections.Counter(str(x.get('shelf_status','MISSING')) for x in value if isinstance(x,dict)))
            ids=[x.get('id') for x in value if isinstance(x,dict) and x.get('id') is not None]
            record['duplicateIds']=sum(c-1 for c in collections.Counter(map(str,ids)).values() if c>1)
    record['stableDuringRead']=(st.st_size,st.st_mtime_ns,st.st_ino)==(p.stat().st_size,p.stat().st_mtime_ns,p.stat().st_ino)
    inventory.append(record)
merged=read('song_data.json');raw=read('song_data_raw.json');rating=read('rating_structured_with_ids.json');mapping=read('song_id2tjapath.json')
raw_by={str(x['id']):x for x in raw};rating_rows=rating.get('songs',{})
identity=[];legacy=collections.defaultdict(list);conflicts=[];counts=collections.Counter()
for song in merged:
    sid=str(song['id']);r=raw_by.get(sid,{})
    for old in song.get('legacy_ids',[]):legacy[str(old)].append(sid)
    charts=[]
    for level in range(1,6):
        m=positive(song.get(f'level_{level}'));rp=positive(r.get(f'level_{level}'))
        if not (m or rp):continue
        eligible=song.get('shelf_status') in (0,'0') and r.get('shelf_status') in (0,'0') and m and rp
        counts['mergedOrRawCharts']+=1;counts['cnPlayableAllCourses']+=eligible
        if level>=4:counts['cnPlayableOniUra']+=eligible
        if m!=rp:conflicts.append({'id':sid,'course':level,'mergedPositive':m,'rawPositive':rp})
        charts.append({'course':level,'mergedPositive':m,'rawPositive':rp,'cnCurrentPlayableCandidate':eligible})
    identity.append({'songId':sid,'legacyIds':song.get('legacy_ids',[]),'wikiSongNos':song.get('wiki_song_nos',[]),'sourceSongNo':song.get('songNo'),'mergedShelfStatus':song.get('shelf_status'),'rawShelfStatus':r.get('shelf_status'),'rawPresent':bool(r),'charts':charts,'otherIdentityFields':{k:v for k,v in song.items() if any(w in k.lower() for w in ['ourtaiko','nijiiro','region','source','platform','legacy'])}})
consumers=[]
terms=['song_data.json','song_data_raw.json','rating_structured','taiko_goku_onis','song_id2tjapath','ourtaiko_charts','shelf_status','song_alias','cn_available_chart_keys','load_on_shelf_song_ids']
for repo in [BASE/'integration',BASE/'bot']:
    paths=subprocess.check_output(['git','ls-files','-z'],cwd=repo).decode().split('\0')
    for name in filter(None,paths):
        if not name.endswith(('.py','.ts','.vue','.mjs','.js','.dart')) or '/tests/' in '/'+name or name.startswith(('docs/','tools/')):continue
        p=repo/name
        if not p.is_file() or p.stat().st_size>2*1024**2:continue
        for i,line in enumerate(p.read_text(errors='replace').splitlines(),1):
            matched=[t for t in terms if t in line]
            if matched:consumers.append({'repo':repo.name,'path':name,'line':i,'terms':matched,'excerpt':line.strip()[:280]})
result={'qaRun':os.environ['QA_RUN_ID'],'counts':dict(counts),'sources':inventory,'legacyAliasConflicts':{k:v for k,v in legacy.items() if len(set(v))>1},'difficultyConflicts':conflicts,'consumerReferences':len(consumers),'ratingRows':len(rating_rows),'tjaMappingEntries':len(mapping)}
for name,obj in [('source-audit.json',result),('song-chart-identity-map.json',identity),('consumer-inventory.json',consumers)]:
    (OUT/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'qaRun':result['qaRun'],'counts':dict(counts),'sources':len(inventory),'consumerReferences':len(consumers),'difficultyConflicts':len(conflicts),'legacyConflicts':len(result['legacyAliasConflicts'])}))
