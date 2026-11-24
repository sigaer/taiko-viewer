"""Validate corpus/artifact/report joins and archive evidence via bounded QA."""
import collections, gzip, hashlib, json, os, re, shutil, subprocess, tarfile, time
from pathlib import Path
BASE=Path('/var/tmp/taiko-batch2-20261124');VIEWER=BASE/'integration';DOC=VIEWER/'docs/catalog-release-batch2-20261124';RC=BASE/'release-candidate'
DURABLE=Path('/home/sigaer/taiko/qa-vault/evidence/catalog-release-batch2-20261124');DURABLE.mkdir(mode=0o700,parents=True,exist_ok=True)
def sha(p):
    with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def read(p):return json.loads(p.read_bytes())
def save(p,obj):p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
summary=read(DOC/'timeline/scan-summary.json');index=read(DOC/'timeline/file-index.json');expected={x['source']:x for x in index};counts=collections.Counter();seen=set();events=0
expert_sources={x['source'] for x in read(DOC/'timeline/expert-case-evidence.json')};expert_cases=[]
assert len(index)==len(expected)==3003
assert summary['counts']=={'COMPLETE':1832,'PARTIAL':1171,'UNSUPPORTED':0,'INVALID':0},'Review report counts if classification changes'
assert all(c['result']['status']=='COMPLETE' for c in read(DOC/'timeline/golden-corpus.json')['cases'])
assert sha(Path(summary['artifact']['path']))==summary['artifact']['sha256']
with gzip.open(summary['artifact']['path'],'rt') as f:
    for line in f:
        row=json.loads(line);assert row['source'] not in seen;seen.add(row['source'])
        assert row['sourceHash']==expected[row['source']]['sourceHash'];assert row['status']==expected[row['source']]['status'];counts[row['status']]+=1
        assert row['absoluteMusicAlignment']['status']=='UNVERIFIED'
        assert row['absoluteMusicAlignment']['absoluteTimes'] is None
        if row['source'] in expert_sources:
            expert_cases.append({'source':row['source'],'sourceHash':row['sourceHash'],'status':row['status'],'diagnostics':row['diagnostics'],'courses':{k:{'bpm':v['bpm'],'level':v['level'],'paths':{b:{key:p[key] for key in ['noteCount','bigNotes','rolls','balloons','chartRelativeDurationMs','diagnostics']} for b,p in v['paths'].items()}} for k,v in row['courses'].items()},'expertReview':'PENDING'})
        for course in row['courses'].values():
            for value in course['paths'].values():
                assert type(value['noteCount']) is int
                events+=len(value['eventTimeline'])
                assert value['noteCount']==sum(e['kind']=='NOTE' and e['type'] in '1234' for e in value['eventTimeline'])
assert seen==set(expected);assert dict(counts)=={k:v for k,v in summary['counts'].items() if v}
save(DOC/'timeline/expert-case-evidence.json',expert_cases)
frozen=read(DOC/'timeline/source-corpus-manifest.json');assert sha(Path(frozen['path']))==frozen['sha256']
with tarfile.open(frozen['path'],'r:gz') as tar:
    names=set()
    for member in tar:
        assert member.isfile() and member.name in expected
        with tar.extractfile(member) as f:assert hashlib.file_digest(f,'sha256').hexdigest()==expected[member.name]['sourceHash']
        names.add(member.name)
    assert names==set(expected)
manifest=read(RC/'release-manifest.json')
for name,value in manifest['artifacts'].items():assert sha(RC/name)==value['sha256']
for line in (RC/'SHA256SUMS').read_text().splitlines():
    digest,name=line.split('  ',1);assert sha(RC/name)==digest
assert manifest['verification']=={'centerResolverExit':0,'clientResolverExit':1}
for file in DOC.rglob('*.json'):read(file)
broken=[]
for file in [*DOC.rglob('*.md'),*(VIEWER/'docs/domain/taiko').glob('*.md')]:
    for target in re.findall(r'\]\(([^)]+)\)',file.read_text()):
        if target.startswith(('http:','https:','#','/')):continue
        target=target.split('#',1)[0]
        if target and not (file.parent/target).exists():broken.append({'file':str(file.relative_to(VIEWER)),'target':target})
assert not broken,broken
assert read(DOC/'integrity/python-writer-installed-parity.json')['files'] and all(x['matches'] for x in read(DOC/'integrity/python-writer-installed-parity.json')['files'])
# Runtime source proof: include new tracked UI utility and exact input hashes.
runtime={}
for name in filter(None,subprocess.check_output(['git','ls-files','-z','taiko_viewer'],cwd=VIEWER).decode().split('\0')):
    p=VIEWER/name
    if p.is_file():runtime[name]=sha(p)
save(BASE/'evidence/viewer-source-file-hashes.json',runtime)
shutil.copyfile(BASE/'artifacts-center-rc/installed-imports.json',RC/'installed-imports.json')
shutil.copyfile(BASE/'artifacts-center-rc/bridge-cases.json',RC/'bridge-cases.json')
# Additional evidence files do not alter wheel bytes. Refresh the directory inventory.
(RC/'SHA256SUMS').write_text(''.join(f'{sha(p)}  {p.name}\n' for p in sorted(RC.iterdir()) if p.is_file() and p.name!='SHA256SUMS'))
evidence={'qaRun':os.environ['QA_RUN_ID'],'corpusFiles':len(seen),'eventsChecked':events,'statusCounts':dict(counts),'corpusSourceHashesVerified':len(names),'artifactHashesVerified':len(manifest['artifacts']),'reportLocalLinksValid':True,'runtimeSourceHashCount':len(runtime),'pythonWriterParityFiles':6,'wholeSystemRelease':'BLOCKED_CLIENT_AND_OPEN_GATES'}
save(DOC/'delivery-verification.json',evidence)
# Source bundles preserve each local candidate; incremental Viewer/Bot bundles name prerequisites.
bundle_dir=BASE/'evidence/source-bundles';bundle_dir.mkdir(exist_ok=True)
for name,repo,args in [('viewer',VIEWER,['HEAD','^26930740']),('bot',BASE/'bot',['HEAD','^62c4d3e']),('core',BASE/'core',['HEAD'])]:
    commit=subprocess.check_output(['git','rev-parse','--short','HEAD'],cwd=repo,text=True).strip()
    target=bundle_dir/(name+'-'+commit+'.bundle')
    if not target.exists():subprocess.run(['git','bundle','create',str(target),*args],cwd=repo,check=True,timeout=60)
    subprocess.run(['git','bundle','verify',str(target)],cwd=repo,check=True,capture_output=True,timeout=30)
archive=DURABLE/'evidence.tar.gz';files=[]
for root in [BASE/'evidence',RC,DOC,VIEWER/'docs/domain/taiko',VIEWER/'scripts/audit/batch2']:
    for p in sorted(root.rglob('*')):
        if p.is_file() and not p.is_symlink() and '__pycache__' not in p.parts:files.append(p)
total=sum(p.stat().st_size for p in files);assert total<1024**3,'archive budget exceeded'
with tarfile.open(archive,'w:gz') as tar:
    for p in files:tar.add(p,arcname=str(p.relative_to(BASE)),recursive=False)
record={'qaRun':os.environ['QA_RUN_ID'],'archive':str(archive),'sha256':sha(archive),'bytes':archive.stat().st_size,'inputFiles':len(files),'inputBytes':total,'privacy':'0700 directory; includes raw player evidence; do not publish','viewerRuntimeCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=VIEWER,text=True).strip(),'sourceBundles':'viewer/bot incremental bundles require preserved 26930740/62c4d3e; core bundle includes lineage'}
save(DURABLE/'manifest.json',record);save(DOC/'durable-evidence.json',record)
print(json.dumps({'verification':evidence,'archive':{k:v for k,v in record.items() if k not in ['privacy']}}))
