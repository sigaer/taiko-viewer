"""Installed full-snapshot consumers and owned-root lifecycle measurements."""
import collections,copy,hashlib,json,os,statistics,subprocess,time
from pathlib import Path
BASE=Path('/var/tmp/taiko-batch21-20261124');OUT=BASE/'viewer/docs/wahlap-authority-b21-20261124'
from taiko_bot.catalog.reader import capture,_load,read_revision
from taiko_bot.catalog.storage import install,activate,rollback,mark_failed
from taiko_bot.catalog.wahlap import canonical_bytes
from sakura_taiko_core.chart.availability import cn_available_chart_keys,on_shelf_song_ids
from sakura_taiko_core.chart.progress_catalog import active_song_ids_from_index
from sakura_taiko_core.chart.position import build_song_catalog,get_song_position_by_id
from taiko_bot.catalog.availability import load_cn_available_chart_keys,load_recommendation_chart_keys
os.environ['TAIKO_CATALOG_ROOT']=str(BASE/'catalog')
start=time.perf_counter();view=capture();cold=(time.perf_counter()-start)*1000
data=view.data;warm=[]
for _ in range(30):
    start=time.perf_counter();assert capture().revision==view.revision;warm.append((time.perf_counter()-start)*1000)
expected={(c['sourceSongId'],c['difficulty']) for c in data['charts'].values() if c['difficulty'] in (4,5) and c['policies']['cn_current_playable']['eligible']}
assert len(expected)==1387
position_ids={sid for category in data['positions']['index']['categories'].values() for key in ['ordered','pending'] for sid in category[key]}
assert position_ids==view.song_ids()
for profile in ['position-center-20261010','position-client-20261010']:
    catalog=build_song_catalog(data['songs'],profile=profile)
    assert {row['id'] for row in data['songs'] if get_song_position_by_id(row['id'],catalog=catalog,profile=profile).is_on_shelf}==view.song_ids()

assert cn_available_chart_keys(data['songs'],[{'id':999999,'shelf_status':0,'level_4':10}])==expected
assert load_cn_available_chart_keys()==expected
assert on_shelf_song_ids(data['songs'])==active_song_ids_from_index({r['id']:r for r in data['songs']})==view.song_ids()
for profile in ('ordinary','target'):
    assert load_recommendation_chart_keys(profile=profile)==view.chart_keys('recommendation_eligible',profile=profile)
aliases=collections.defaultdict(set)
for row in data['sourceAliases']:aliases[(row['namespace'],row['key'])].add(row['songId'])
conflicts=[{'namespace':key[0],'key':key[1],'songIds':sorted(value)} for key,value in aliases.items() if len(value)>1]
identity={'catalogRevision':view.revision,'policyVersion':view.policy_version,'sourceAliasRows':len(data['sourceAliases']),
 'uniqueNamespaceKeys':len(aliases),'namespaceCounts':dict(collections.Counter(row['namespace'] for row in data['sourceAliases'])),
 'namespaceIdentityConflicts':conflicts,'legacyAliasKeys':sum(int(old)!=current for old,current in data['aliases'].items()),
 'identityConflicts':data['identityConflicts'],'semantics':'Search aliases are not identity equivalence. Source namespaces are not cross-merged by text.'}
(OUT/'identity-audit.json').write_text(json.dumps(identity,ensure_ascii=False,indent=2)+'\n')
scratch=Path(os.environ['QA_RUN_TMPDIR']);root=scratch/'rollback-catalog'
first=install(root,data);activate(root,view.revision)
second=copy.deepcopy(data);second['catalogRevision']=hashlib.sha256((view.revision+'synthetic-rollback-generation').encode()).hexdigest()
for song in second['songs']:song['catalog']['catalogRevision']=second['catalogRevision']
install(root,second)
start=time.perf_counter();activate(root,second['catalogRevision']);activation=(time.perf_counter()-start)*1000
before=(root/'active.json').read_bytes();mark_failed(root,'SYNTHETIC_INCOMPLETE_PAGE')
assert (root/'active.json').read_bytes()==before
start=time.perf_counter();rollback(root,view.revision);rollback_ms=(time.perf_counter()-start)*1000
assert json.loads((root/'active.json').read_bytes())['catalogRevision']==view.revision
assert (root/'revisions'/second['catalogRevision']/'catalog.json').exists()
assert (root/'revisions'/view.revision/'catalog.json').stat().st_nlink==1
script=scratch/'node-consistency.mjs';node_result=scratch/'node-result.json'
adapter=(BASE/'viewer/taiko_viewer/server/services/content/catalogAuthority.ts').as_uri()
ugc=(BASE/'viewer/taiko_viewer/scripts/lib/ugc-catalog.mjs').as_uri()
(scratch/'rating.json').write_text('{"songs":{}}');(scratch/'notes.json').write_text('{}')
script.write_text(f'''import {{readCatalogAuthority}} from {json.dumps(adapter)};
import {{loadUgcCatalogAudit}} from {json.dumps(ugc)};
import {{performance}} from 'node:perf_hooks';import {{writeFile}} from 'node:fs/promises';
const root={json.dumps(str(BASE/'catalog'))};let start=performance.now();const view=await readCatalogAuthority(root);const cold=performance.now()-start;
const warm=[];for(let i=0;i<30;i++){{start=performance.now();await readCatalogAuthority(root);warm.push(performance.now()-start);}}
const charts=Object.values(view.data.charts);const keys=charts.filter(c=>[4,5].includes(c.difficulty)&&c.policies.cn_current_playable.eligible).map(c=>`${{c.sourceSongId}}:${{c.difficulty}}`).sort();
const audit=await loadUgcCatalogAudit({{catalogRoot:root,ratingPath:{json.dumps(str(scratch/'rating.json'))},noteCountPath:{json.dumps(str(scratch/'notes.json'))}}});
const ugcKeys=audit.catalog.charts.filter(c=>c.status==='active').map(c=>`${{c.songId}}:${{c.difficultyCode}}`).sort();
await writeFile({json.dumps(str(node_result))},JSON.stringify({{catalogRevision:view.data.catalogRevision,policyVersion:view.data.policyVersion,keys,ugcKeys,ugcRevision:audit.catalog.revision,coldMs:cold,warmMs:warm}}));
''')
subprocess.run(['/opt/taiko-viewer-runtime/node-v24.22.1-linux-x64/bin/node','--experimental-strip-types',str(script)],check=True,timeout=60)
node=json.loads(node_result.read_bytes());assert node['catalogRevision']==node['ugcRevision']==view.revision
assert set(node['keys'])=={f'{sid}:{d}' for sid,d in expected}
assert set(node['ugcKeys'])=={f"{c['sourceSongId']}:{c['difficulty']}" for c in data['charts'].values() if c['policies']['cn_current_playable']['eligible']}
def timings(values):return {'medianMs':statistics.median(values),'maxMs':max(values),'samples':len(values)}
result={'qaRun':os.environ['QA_RUN_ID'],'execution':'installed Bot/Core plus actual Node adapter and UGC loader; no production HTTP or business-data writes',
 'catalogRevision':view.revision,'policyVersion':view.policy_version,'cnOniUra':len(expected),
 'crossConsumerConsistency':'PASS','consumers':['Python Reader','Core availability','Core progress active IDs','Bot availability masks','Node Reader','UGC actual loader'],
 'python':{'coldMs':cold,'warm':timings(warm)},'node':{'coldMs':node['coldMs'],'warm':timings(node['warmMs'])},
 'activationMs':activation,'rollbackMs':rollback_ms,'failedFetchPreservesPointer':True,'olderRevisionsRetained':True,'snapshotLinkCount':1,
 'limits':'One synthetic second revision in an owned root, not production rollback/load testing. Single writer required. No global cross-machine transaction claim.'}
(OUT/'consistency-performance.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
