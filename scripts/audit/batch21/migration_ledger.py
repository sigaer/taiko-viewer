"""Preserve every baseline reference; record static evidence, not execution claims."""
import ast,collections,hashlib,json,posixpath,subprocess
from pathlib import Path
BASE=Path('/var/tmp/taiko-batch21-20261124');VIEWER=BASE/'viewer';BOT=BASE/'bot'
OUT=VIEWER/'docs/wahlap-authority-b21-20261124'
baseline=json.loads((VIEWER/'docs/catalog-release-batch2-20261124/catalog/consumer-inventory.json').read_text())
assert len(baseline)==494
files=sorted({(r['repo'],r['path']) for r in baseline})
modules={};paths={};graph={}
for path in BOT.rglob('*.py'):
    relative=path.relative_to(BOT).as_posix()
    if relative.startswith(('taiko_bot/','taiko_store/')):module=relative[:-3].replace('/','.')
    elif relative.startswith('packages/taiko-application/src/'):module=relative.split('/src/',1)[1][:-3].replace('/','.')
    elif relative.startswith('packages/sakura-taiko-core/core/'):module='sakura_taiko_core.'+relative.split('/core/',1)[1][:-3].replace('/','.')
    else:continue
    if module.endswith('.__init__'):module=module[:-9]
    modules[module]=path;paths[relative]=module
for module,path in modules.items():
    dependencies=set()
    package=module if path.name=='__init__.py' else module.rsplit('.',1)[0]
    for node in ast.walk(ast.parse(path.read_text())):
        if isinstance(node,ast.Import):dependencies.update(alias.name for alias in node.names)
        if isinstance(node,ast.ImportFrom):
            parent='.'.join(package.split('.')[:len(package.split('.'))-node.level+1]) if node.level else ''
            target='.'.join(filter(None,[parent,node.module or '']))
            dependencies.add(target)
            dependencies.update(target+'.'+alias.name for alias in node.names)
    graph[module]={name for name in dependencies if name in modules}
def chain(module):
    queue=collections.deque([(module,[module])]);seen=set()
    while queue:
        current,route=queue.popleft()
        if current.startswith('taiko_bot.catalog.') or current=='taiko_bot.catalog_identity':return route
        if current in seen:continue
        seen.add(current)
        queue.extend((name,route+[name]) for name in sorted(graph.get(current,())))
    return []
metadata={'catalog_constants','catalog_images','catalog_import','catalog_reconcile','catalog_references','ourtaiko_catalog','song_update_task','fumen_rename','grade_dojo_extract','build_nijiiro_history_simple','tja_roll_sync','merge_index','cover_summary','merge_json','song_tja_mapping','catalog_resources','title_update'}
core_legacy={'position.py','progress_catalog.py','visibility.py','client_selection.py'}
file_rows=[];missing=[]
for repo,path in files:
    root=BOT if repo=='bot' else VIEWER;p=root/path;body=p.read_bytes();text=body.decode();route=chain(paths.get(path,'')) if repo=='bot' else []
    channel='not-a-runtime-policy-consumer';port=None;note='';status=''
    if path.startswith('packages/sakura-taiko-contract/'):
        status='LEGACY_TRANSPORT_SERIALIZER';note='Pure old Contract DTO retained; live developer-api-v1/catalog overrides availability and identity from Authority.'
    elif path.startswith(('scripts/','preview/')) or '/scripts/' in path or '/loadtest/' in path:
        status='TEST_OR_MAINTENANCE_TOOLING';note='Offline preview, source audit, historical fixture, metadata generator or explicit maintenance command; not a current CN authority.'
        if path=='taiko_viewer/scripts/lib/ugc-catalog.mjs':
            status='MIGRATED_RUNTIME_PORT';port='Viewer readCatalogAuthority -> precomputed cnCurrentPlayable';channel='catalogReport and catalog.revision/policyVersion';note='UGC import audit now reads the central immutable projection; old shelf conflict is a regression case.'
    elif path.startswith('packages/sakura-taiko-core/'):
        if p.name in core_legacy:
            status='PROJECTED_RUNTIME_WITH_FROZEN_COMPATIBILITY';note='Catalog projection wins for active hosts. Legacy pure raw-input profiles remain for historical compatibility tests; never used as a current CN fallback.'
        elif '/parser/' in path:
            status='RAW_RESOURCE_ANALYSIS';note='TJA identity/resource parsing, not CN release authority; per-chart feature coverage is supplied by Builder.'
        else:status='MIGRATED_RUNTIME_PORT';note='Core receives Authority projections or explicit precomputed masks; None and empty remain distinct.'
        port='Core explicit Catalog projection / host Authority mask';channel='host report and stamped Application context'
    elif path.startswith('packages/taiko-application/'):
        status='MIGRATED_RUNTIME_PORT';port='injected Authority song projection / RecommendationContext';channel='catalogRevision/policyVersion in context or host report';note='Pure old fixture shape retained; live contexts use canonical flags. No rating formula changed.'
    elif repo=='integration':
        status='MIGRATED_RUNTIME_PORT';channel='Viewer X-Catalog-Revision / X-Catalog-Policy-Version headers';port='captureCatalogAuthority / getSongCatalog / pinned Python env'
        if path.startswith(('taiko_viewer/components/','taiko_viewer/pages/','taiko_viewer/types/','taiko_viewer/utils/')):
            port='typed Authority song DTO from Viewer content endpoint';note='Presentation, metadata or historical-score use. Display grouping is not independently treated as CN permission.'
        if '/admin/' in path:
            status='DRAFT_METADATA_ADMIN';note='Editable source metadata remains separate. Current CN fields are read-only Authority overlays; publication requires a new Builder snapshot.'
        if path.endswith('catalog-consistency.ts'):note='Checks source hash of the same Authority song rows before Contract serialization.'
        if path.endswith('content/runtime.ts'):note='Paths remain for independent model/resource inputs; song list readers use Authority.'
    elif path in ('taiko_bot/runtime/public/constant_center_renderer.py','taiko_bot/runtime/public/constant_client_renderer.py'):
        status='MIGRATED_PRESENTATION_DTO';port='catalog_provider -> Application ConstantQueryContext -> stamped projection';channel='parent pinned handler/health consumer report';note='Pure renderer consumes centrally projected shelf grouping and never reads a catalog file or decides eligibility.'
    elif path.startswith('taiko_bot/cli/'):
        status='MAINTENANCE_NOT_EXECUTED';note='Explicit archival/backfill maintenance interface retained. No backfill, DB mutation or business-data command executed.'
    elif path in ('taiko_bot/settings.py','taiko_bot/offline/annual_summary/constants.py'):
        status='SOURCE_CONFIGURATION';note='Legacy dataset names retained for metadata/resource transport; Catalog distribution is separate and mandatory for CN policies.'
    elif '/offline/' in path and p.stem in metadata:
        status='METADATA_OR_RESOURCE_PRODUCER';note='Maintains metadata/raw references or explicit offline artifacts. Legacy shelf fields are non-authoritative; Builder alone projects current CN state.'
        if route:port=' -> '.join(route);note+=' Current eligibility path uses the Authority port.'
    else:
        status='MIGRATED_RUNTIME_PORT';port=' -> '.join(route) if route else None;channel='pinned handler/health consumer registry; API headers or stamped projection'
        if path.endswith('management_cluster.py'):
            status='DRAFT_METADATA_ADMIN';note='Song lookup uses Authority; alias edit/read/write is explicitly a draft-source operation, activated through Builder.'
        if path=='taiko_store/reader.py':note='Original Publication bytes retained; association uses catalog_identity.load_identity_map -> Authority, unavailable association leaves original IDs intact.'
        if path=='taiko_store/merge_reference.py':note='Combo metadata uses revisioned Authority cache; no Publication regeneration was executed.'
    if status=='MIGRATED_RUNTIME_PORT' and repo=='bot' and path.startswith(('taiko_bot/','taiko_store/')) and not route:
        missing.append(path)
    evidence=[{'line':i,'text':line.strip()[:220]} for i,line in enumerate(text.splitlines(),1) if any(token in line for token in ['catalog.reader','catalog.availability','captureCatalogAuthority','getCatalogPythonEnv','project_song_rows','cnCurrentPlayable','cn_current_playable','recommendation_eligible','getSongCatalog','catalog_policy_version','catalogRevision'])][:12]
    file_rows.append({'repo':repo,'path':path,'owner':'Lead','classification':status,'authorityPort':port,'versionReporting':channel,'note':note,'sourceSha256':hashlib.sha256(body).hexdigest(),'staticEvidence':evidence,'executionClaim':'Static review only unless listed in acceptance/consistency evidence'})
assert not missing, 'Runtime references requiring explicit disposition: '+repr(missing)
lookup={(r['repo'],r['path']):r for r in file_rows}
references=[]
for index,row in enumerate(baseline,1):
    file=lookup[row['repo'],row['path']]
    references.append({'referenceId':f'B2-{index:03}',**row,**{k:v for k,v in file.items() if k not in ('repo','path')},'originalLineIsBaseline':True})
summary={'baselineReferences':len(references),'files':len(file_rows),'referenceClassifications':dict(collections.Counter(r['classification'] for r in references)),'fileClassifications':dict(collections.Counter(r['classification'] for r in file_rows)),'productionMigration':'NOT_DEPLOYED','unclassifiedReferences':0,'verificationScope':'Static call graph + direct review; acceptance tests separately identified. Not 494 independently exercised runtime calls.'}
(OUT/'consumer-migration-494.json').write_text(json.dumps({'summary':summary,'references':references},ensure_ascii=False,indent=2)+'\n')
(OUT/'consumer-files-187.json').write_text(json.dumps(file_rows,ensure_ascii=False,indent=2)+'\n')
lines=['# Consumer migration matrix','','The baseline contains 494 references in 187 files. Every original reference is retained in [the ledger](consumer-migration-494.json); source lines refer to the unchanged Batch 2 baseline. Current source SHA and static evidence are separate. Static reachability is not a claim that all 494 calls executed. Production is unchanged.','','| Repo / file | Disposition | Authority port / reporting |','|---|---|---|']
for row in file_rows:lines.append('| '+row['repo']+'/'+row['path'].replace('|','\\|')+' | '+row['classification']+' | '+str(row['authorityPort'] or row['note']).replace('|','\\|')+'; '+row['versionReporting']+' |')
(OUT/'consumer-migration-matrix.md').write_text('\n'.join(lines)+'\n')
print(json.dumps(summary))
