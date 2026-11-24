"""Public catalog identity joins only, without refreshing any source."""
import collections, hashlib, json, os, unicodedata
from pathlib import Path
BASE=Path('/var/tmp/taiko-batch2-20261124');SONGS=Path('/home/sigaer/taiko/songs');OUT=BASE/'integration/docs/catalog-release-batch2-20261124/catalog'
def read(name):return json.loads((SONGS/name).read_bytes())
def save(name,obj):(OUT/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
songs=read('song_data.json');by_source=collections.defaultdict(list)
for row in songs:
    for source in row.get('ourtaiko_ids',[]):by_source[str(source)].append(str(row['id']))
aliases=[]
for row in read('ourtaiko_charts.json'):
    aliases.append({'namespace':'ourtaiko','sourceKey':str(row['id']),'canonicalSongIds':by_source[str(row['id'])],'sourceAliases':{key:row.get(key) for key in ['nijiiroId','officialId','numberId']},'hasFiles':row.get('hasFiles'),'difficulties':row.get('difficulties'),'status':'CONFLICT' if len(set(by_source[str(row['id'])]))>1 else 'ASSOCIATED' if by_source[str(row['id'])] else 'UNRESOLVED'})
identity=json.loads((OUT/'song-chart-identity-map.json').read_bytes());by_id={str(x['id']):x for x in songs}
for row in identity:
    row['officialId']=by_id[row['songId']].get('official_id');row['ourtaikoSourceIds']=by_id[row['songId']].get('ourtaiko_ids',[])
    if row.get('rawResource'):row['mappingResource']=row.pop('rawResource')
    source=by_id[row['songId']];relative=source.get('tja_path') or row.get('tjaMapping')
    root=Path('/home/sigaer/taiko/assets/catalog_sources/ourtaiko') if source.get('resource_source')=='ourtaiko' else Path('/home/sigaer/git/ESE_autosync')
    row['resourceSource']=source.get('resource_source') or 'ese'
    if relative:
        p=(root/relative).resolve();valid=p.is_relative_to(root.resolve()) and p.is_file()
        row['rawResource']={'path':str(p),'exists':valid,'resolution':'catalog_downloads.catalog_resource_root + tja_path; mapping only fallback'}
        if valid:
            with p.open('rb') as f:row['rawResource']['sha256']=hashlib.file_digest(f,'sha256').hexdigest()
            row['rawResource']['bytes']=p.stat().st_size
    else:row['rawResource']={'exists':False,'reason':'NO_SOURCE_PATH'}
save('song-chart-identity-map.json',identity);save('source-alias-map.json',aliases)
names=collections.defaultdict(set)
for name in ['song_alias.json','song_alias_new.json']:
    for row in read(name):
        values=row.get('aliases',[])
        if isinstance(values,str):values=[values]
        for value in values:
            if isinstance(value,str):names[unicodedata.normalize('NFKC',value).strip().casefold()].add(str(row['id']))
ambiguous={k:sorted(v) for k,v in names.items() if k and len(v)>1}
summary={'qaRun':os.environ['QA_RUN_ID'],'sourceStatusCounts':dict(collections.Counter(x['status'] for x in aliases)),'resourceSourceCounts':dict(collections.Counter(x['resourceSource'] for x in identity)),'rawResourcePresentSongs':sum(x['rawResource']['exists'] for x in identity),'rawResourceAbsentOrUnknownSongs':sum(not x['rawResource']['exists'] for x in identity),'ambiguousSearchAliases':len(ambiguous),'searchAliasAmbiguityIsNotIdentityEquivalence':True,'ambiguousAliases':ambiguous}
save('alias-audit-summary.json',summary);print(json.dumps({k:v for k,v in summary.items() if k!='ambiguousAliases'}))
