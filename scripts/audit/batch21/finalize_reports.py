"""Aggregate independent acceptance evidence without re-running passed work."""
import collections,hashlib,json,re,subprocess,sys
from pathlib import Path
BASE=Path('/var/tmp/taiko-batch21-20261124');VIEWER=BASE/'viewer';OUT=VIEWER/'docs/wahlap-authority-b21-20261124';RELEASE=BASE/'release-candidate-rc9'
def read(path):return json.loads(Path(path).read_bytes())
def sha(path):
    with Path(path).open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
def save(name,value):(OUT/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
checks={}
for mode,count in [('contract',12),('python',76),('core-original',31),('authority',15)]:
    path=BASE/f'evidence/installed-rc9-{mode}.log';text=path.read_text();report=json.loads(text.splitlines()[0])
    assert report['versions']['taiko-bot']=='0.27.0rc9' and report['sourceFilesMatchArtifacts']
    assert ('76 passed, 4 skipped' in text if mode=='python' else f'Ran {count} tests' in text and '\nOK\n' in text)
    checks[mode]={'passed':count,'skipped':4 if mode=='python' else 0,'qaRun':report['qaRun'],'logSha256':sha(path),'installedPrefix':report['prefix']}
bridge=read(RELEASE/'bridge-cases.json');assert len(bridge['cases'])==27 and all(row['result']=='PASS' for row in bridge['cases'])
checks['bridge']={'passed':27,'qaRun':bridge['qaRun'],'actualInstalledHostFunctions':bridge['actualInstalledHostFunctions'],'casesSha256':sha(RELEASE/'bridge-cases.json')}
for mode,count in [('installed',310),('additional',11)]:
    path=BASE/f'evidence/node-rc9-{mode}.log';text=path.read_text();qa=re.search(r'# qaRun (qa-[0-9a-f]+)',text).group(1);assert f'# pass {count}\n' in text and '# fail 0\n' in text
    checks['node-'+mode]={'passed':count,'qaRun':qa,'logSha256':sha(path)}
build_log=Path(sys.argv[1]);text=build_log.read_text();entry=VIEWER/'taiko_viewer/.output/server/index.mjs'
pending='--pending-build' in sys.argv
if not pending:
    assert entry.is_file() and ('Nuxt build complete' in text or 'You can preview this build' in text or 'Build complete!' in text),'Successful final build evidence required'
    assert 'Build failed' not in text and 'AssertionError' not in text
checks['viewer-build']={'result':'BLOCKED_HEADROOM' if pending else 'PASS','log':str(build_log),'logSha256':sha(build_log),'entrySha256':None if pending else sha(entry),'sourceCommit':subprocess.check_output(['git','rev-parse','3567ba77'],cwd=VIEWER,text=True).strip(),'productionDeployed':False}
manifest=read(RELEASE/'release-manifest.json');assert all(value==0 for key,value in manifest['verification'].items() if key.endswith('ResolverExit'))
assert manifest['verification']['pipCheck']=='PASS'
for name,item in manifest['artifacts'].items():assert sha(RELEASE/name)==item['sha256'] and (RELEASE/name).stat().st_size==item['bytes']
prior=read(BASE/'release-candidate-rc8/release-manifest.json')
artifacts={'core':{'version':'0.1.4rc2','sourceCommit':prior['sources']['core']['commit']},'application':{'version':'0.10.0rc2','sourceCommit':prior['sources']['application']['commit']},'bot':{'version':'0.27.0rc9','sourceCommit':manifest['sources']['bot']['commit']}}
save('artifact-summary.json',{'releaseDirectory':str(RELEASE),'versionsAndSources':artifacts,'artifacts':manifest['artifacts'],'verification':manifest['verification'],'buildQa':manifest['qaRun'],'coreAndApplicationBuildQa':prior.get('completedWheelBuildQa',prior['qaRun']),'pipFreezeSha256':sha(RELEASE/'installed-freeze.txt'),'provenance':'Final Core/Application RC2 built twice in RC8 and reused unchanged; final Bot RC9 built twice from committed sources. Fresh non-system venv, -I imports, no source overlay.'})
snapshot=read(OUT/'catalog-build.json');performance=read(OUT/'consistency-performance.json');identity=read(OUT/'identity-audit.json');assert performance['catalogRevision']==identity['catalogRevision']==snapshot['manifest']['catalogRevision']
ledger=read(OUT/'consumer-migration-494.json');assert ledger['summary']['baselineReferences']==494 and ledger['summary']['unclassifiedReferences']==0
for row in read(OUT/'consumer-files-187.json'):
    path=BASE/('bot' if row['repo']=='bot' else 'viewer')/row['path'];assert sha(path)==row['sourceSha256'],'Stale source ledger '+row['path']
golden_files=subprocess.check_output(['git','ls-tree','-r','--name-only','0b7319d','tests/fixtures'],cwd=BASE/'core',text=True).splitlines()
for name in golden_files:
    old=subprocess.check_output(['git','show','0b7319d:'+name],cwd=BASE/'core');assert hashlib.sha256(old).hexdigest()==sha(BASE/'core'/name)
checks['numerical-golden']={'fixturesByteUnchanged':len(golden_files),'recommendationOracles':126,'baseline':'Core v0.1.2 0b7319d','inputsMigrated':'Legacy unrestricted [] -> None only; explicit empty rejects all'}
assert not subprocess.check_output(['git','diff','0b7319d','--name-only','--','core/rating','core/models'],cwd=BASE/'core',text=True).strip()
reconciliation=[]
for name in ['core/chart/availability.py','core/parser/chart_analysis.py','core/parser/tja.py','core/recommendation/candidates.py','core/recommendation/catalog_inputs.py']:
    old=subprocess.check_output(['git','show','52909ec:'+name],cwd=BASE/'core')
    reconciliation.append({'path':name,'batch2Sha256':hashlib.sha256(old).hexdigest(),'currentSha256':sha(BASE/'core'/name),'equalToBatch2':hashlib.sha256(old).hexdigest()==sha(BASE/'core'/name),'changeReason':'Parser fixes retained; availability now central Authority, candidate masks retain Client namespace and explicit-empty semantics'})
save('core-source-reconciliation.json',{'base':'0b7319d v0.1.2','retainedBatch2':'52909ec','current':artifacts['core']['sourceCommit'],'ratingAndModelFilesUnchangedFromClientBase':True,'reviewedBatch2Modules':reconciliation})

old=read('/var/tmp/taiko-batch2-20261124/release-candidate/bridge-cases.json');old_client=[row for row in old['cases'] if row['result']=='FAIL'];new_client=[row for row in bridge['cases'] if '.client.' in row['profile']];assert len(old_client)==len(new_client)==9
resolved=[]
for index,(before,after) in enumerate(zip(old_client,new_client),1):
    assert before['basis']==after['basis'] and after['result']=='PASS'
    resolved.append({'case':index,'basis':before['basis'],'input':after['input'],'originalError':before['error'],'classification':'REAL_ARTIFACT_INTERFACE_INCOMPATIBILITY','resolution':'Unified Core retains Client identity_namespace=pair and interfaces; actual installed host tested','numericalGoldenChanged':False,'result':after['result'],'catalogRevision':after['catalogRevision'],'policyVersion':after['policyVersion']})
save('client-nine-resolution.json',{'originalEvidenceSha256':sha('/var/tmp/taiko-batch2-20261124/release-candidate/bridge-cases.json'),'cases':resolved})
pages=read(BASE/'evidence/wahlap-private/full/pages.json');rows=[row for page in pages for row in page['payload']['data']['list']]
fields={key:{'observedTypes':dict(collections.Counter(type(row.get(key)).__name__ for row in rows if key in row)),'missingRows':sum(key not in row for row in rows),'nullRows':sum(row.get(key) is None for row in rows if key in row)} for key in sorted({key for row in rows for key in row})}
save('wahlap-field-contract.json',{'source':pages[0]['query'],'httpStatus':sorted({p['httpStatus'] for p in pages}),'rowCount':len(rows),'uniqueIds':len({r['id'] for r in rows}),'pages':[{'query':p['query'],'count':len(p['payload']['data']['list']),'total':p['payload']['data']['total'],'fetchedAt':p['fetchedAt'],'sha256':p['sha256'],'bytes':p['bytes']} for p in pages],'fields':fields,'semantics':'Observed types, not invented official guarantees; no chart release/update-time field observed. isPlayed private and omitted from public projection.'})
save('execution-ownership.json',{'lead':'/root','sourceWorktrees':{name:str(BASE/name) for name in ['viewer','bot','core']},'subagents':[{'name':name,'actualToolExecution':False,'preflight':'No terminal/filesystem tools available','creditedImplementation':False} for name in ['b21_client','b21_integrity','b21_coverage']],'execution':'Lead performed actual reads, implementations and checks; subagent Client comments were reasoning-only review.'})
save('acceptance.json',{'allCandidateGatesPassed':not pending,'checks':checks,'catalog':snapshot,'crossConsumerConsistency':performance,'consumerMigration':ledger['summary'],'productionDeployed':False,'dataMutationOrRecovery':False,'limits':['4 private regression fixtures intentionally skipped','494 static references are not 494 executed runtime calls','Production HTTP/DB/capacity/remote rollout not exercised','Publication writer and 14 historical scoreRevisions unresolved','Dynamic/absolute chart semantics retain feature-level limits']})
table='\n'.join(f"| {name} | {item['sha256']} | {item['bytes']} |" for name,item in manifest['artifacts'].items())
(OUT/'artifact-provenance.md').write_text('''# RC artifact provenance and dependency matrix

Core 0.1.4rc2 / Application 0.10.0rc2 / Bot 0.27.0rc9 are local candidates, never published or deployed. [Machine summary](artifact-summary.json) records source commits, hashes and actual resolver results. Full per-source-file manifests, build logs, freeze, pip check and import paths remain in the private durable release archive.

Core starts from v0.1.2 to retain both Center/Client interfaces, then incorporates the five reviewed Batch 2 correctness modules and the explicit Authority input contract. The old center-only 52909ec candidate is preserved. This is a new committed source build, not an overlay used as an installed artifact.

Each unique package was built twice from clean git archive with SOURCE_DATE_EPOCH and PYTHONHASHSEED=0; SHA is byte-identical. Core/Application receive unique new RC2 versions for the final position contract; prior RC1 artifacts are retained. RC1–RC8 and failed logs remain for audit. Final Bot source is recorded in artifact-summary.json.

| Wheel | SHA-256 | Bytes |
|---|---|---:|
'''+table+'''

New Python 3.11 venv uses no system site packages and no editable/source overlay. -I imports resolve under installed-rc9/lib; every Core/Bot/App Python source file matches installed bytes. setuptools 80.9.0 and wheel 0.45.1; external dependency versions are frozen. pip check and center/client/joint dry-run resolver pass. Tests import actual installed hosts; no Bot server or production adapter started.

| Host | Dependency combination | Evidence |
|---|---|---|
| Center | Bot[center] 0.27.0rc9, App 0.10.0rc2, Core[hiroba] 0.1.4rc2 | resolver exit0, actual host bridges |
| Client | Bot[client] 0.27.0rc9, same App/Core | resolver exit0, nine repaired actual host bridges |
| Joint | Bot[center,client], same single Core | resolver exit0 and pip check |
| Viewer child | explicit installed-rc9 Python and request Catalog revision | Python regression, Node bridge and H3 child-env checks |

Pure old compatibility tests remain; actual production runtime stays unchanged until acceptance. Source branches, installed paths and final evidence are separate from deployment claims.
''')
perf=performance
p=OUT/'performance-and-rollback.md';text=p.read_text();a=text.index('初次完整构建') if '初次完整构建' in text else text.index('最终实际构建');b=text.index('\n\n',a)
text=text[:a]+f"最终实际构建 {snapshot['buildSeconds']:.3f} 秒；Python 冷读 {perf['python']['coldMs']:.1f} ms，30 次缓存读取中位数 {perf['python']['warm']['medianMs']:.3f} ms；Node 冷读 {perf['node']['coldMs']:.1f} ms，缓存读取中位数 {perf['node']['warm']['medianMs']:.3f} ms。激活 {perf['activationMs']:.1f} ms、回滚 {perf['rollbackMs']:.1f} ms。受 2 CPU cgroup、磁盘与系统缓存影响，不能当生产 p95 SLA。"+text[b:]
text=re.sub('激活/回滚约 .*?秒，含完整大文件读取校验，不仅测 rename。','激活/回滚包含完整大文件读取校验，不仅测 rename。',text);p.write_text(text)
print(json.dumps({'acceptance':'BUILD_BLOCKED' if pending else 'PASS for candidate scope','checks':checks,'catalogRevision':snapshot['manifest']['catalogRevision'],'consumers':ledger['summary'],'artifacts':len(manifest['artifacts'])}))
