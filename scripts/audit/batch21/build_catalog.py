"""Verify frozen private API bytes and build a QA-only candidate snapshot."""
import hashlib,json,sys,time,subprocess
from pathlib import Path
BASE=Path('/var/tmp/taiko-batch21-20261124')
if '--installed' not in sys.argv:sys.path.insert(0,str(BASE/'bot'))
from taiko_bot.catalog.builder import build
from taiko_bot.catalog.cli import load,model_inputs
from taiko_bot.catalog.storage import install,activate
from taiko_bot.catalog.wahlap import validate_pages

source=BASE/'evidence/wahlap-private/full'
summary=json.loads((source/'summary.json').read_text());pages=[]
for item in summary['pages']:
    body=(source/f"page-{item['page']}.json").read_bytes()
    assert len(body)==item['bytes'] and hashlib.sha256(body).hexdigest()==item['sha256']
    pages.append({**item,'query':{'page':item['page'],'pageSize':500,'sort':1},'payload':json.loads(body)})
(source/'pages.json').write_text(json.dumps(pages,ensure_ascii=False))
authority=validate_pages(pages)
metadata,m1=load('/home/sigaer/taiko/songs/song_data.json')
rating,m2=load('/home/sigaer/taiko/songs/rating_structured_with_ids.json')
scoreline,m3=load('/home/sigaer/taiko/songs/taiko_goku_onis.json')
coverage,m4=load(BASE/'evidence/chart-feature-coverage-all.json')
search_aliases,m5=load('/home/sigaer/taiko/songs/song_alias.json')
try:position_reference,m6=load('/home/sigaer/taiko/songs/cn_song_positions.json')
except (OSError,ValueError):position_reference,m6=None,{'name':'cn_song_positions.json','status':'UNAVAILABLE','role':'reference-order-only'}
from taiko_bot.catalog.provenance import builder_identity
identity=builder_identity()
identity['sourceCommit']=subprocess.check_output(['git','rev-parse','HEAD'],cwd=BASE/'bot',text=True).strip()
identity['execution']='installed-artifact' if '--installed' in sys.argv else 'development-source'
start=time.perf_counter();snapshot=build(authority,metadata,model_keys=model_inputs(rating,scoreline),coverage=coverage,builder_identity=identity,position_reference=position_reference,search_aliases=search_aliases,source_manifest=[m1,m2,m3,m4,m5,m6]);elapsed=time.perf_counter()-start
manifest=install(BASE/'catalog',snapshot);activate(BASE/'catalog',snapshot['catalogRevision'])
conflicts=[]
raw=json.loads(Path('/home/sigaer/taiko/songs/song_data_raw.json').read_text());raw={r['id']:r for r in raw}
byid={r['id']:r for r in metadata}
for sid in [1210,226,197,1103,106,301,663]:
    conflicts.append({'songId':sid,'chartIdentity':f'song:{sid}:course:5','title':byid[sid]['song_name_jp'],
        'mergedLevel5':byid[sid].get('level_5'),'rawLevel5':raw[sid].get('level_5'),
        'officialLevel5':authority['byId'][sid]['level_5'],
        'songCnRelease':'LISTED','cnCourse5Offered':False,'historicalChartPreserved':True,
        'resolution':'JP/global difficulty metadata retained; official zero does not offer CN Ura; TJA presence does not change release.'})
out=BASE/'viewer/docs/wahlap-authority-b21-20261124'
(out/'seven-conflicts.json').write_text(json.dumps(conflicts,ensure_ascii=False,indent=2)+'\n')
result={'manifest':manifest,'songs':len(snapshot['songs']),'chartSlots':len(snapshot['charts']),
    'knownCharts':sum(row['exists'] for row in snapshot['charts'].values()),
    'officialSongs':len(authority['byId']),'cnOniUra':sum(c['difficulty'] in (4,5) and c['policies']['cn_current_playable']['eligible'] for c in snapshot['charts'].values()),
    'recommendationCounts':{profile:sum(c['policies']['recommendation_eligible'][profile]['eligible'] for c in snapshot['charts'].values()) for profile in ['ordinary','target']},
    'identityConflicts':snapshot['identityConflicts'],'buildSeconds':elapsed,'activationRoot':str(BASE/'catalog'),
    'productionActivated':False}
(out/'catalog-build.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result))
