"""Private durable copies. Never traverse player/runtime data or recover stores."""
import hashlib,json,os,shutil,subprocess
from pathlib import Path
BASE=Path('/var/tmp/taiko-batch21-20261124');OUT=BASE/'viewer/docs/wahlap-authority-b21-20261124'
DEST=Path('/home/sigaer/taiko/qa-vault/evidence/wahlap-authority-batch21-20261124/candidate-rc9')
DEST.mkdir(mode=0o700,parents=True,exist_ok=True)
def sha(path):
    with path.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
def copy(source,target):
    if source.is_dir():
        target.mkdir(mode=0o700,parents=True,exist_ok=True)
        for path in source.iterdir():
            if path.is_symlink():raise ValueError('Unexpected evidence symlink')
            copy(path,target/path.name)
    else:
        target.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
        if target.exists():assert sha(source)==sha(target),'Never overwrite prior durable evidence '+str(target)
        else:shutil.copy2(source,target);target.chmod(0o600)
for name in ['evidence','catalog','release-candidate','release-candidate-rc2','release-candidate-rc3','release-candidate-rc4','release-candidate-rc5','release-candidate-rc6','release-candidate-rc7','release-candidate-rc8','release-candidate-rc9']:
    copy(BASE/name,DEST/name)
sources={}
for name in ['viewer','bot','core']:
    root=BASE/name;commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
    target=DEST/'sources'/f'{name}-{commit}.tar.gz';target.parent.mkdir(mode=0o700,exist_ok=True)
    if not target.exists():subprocess.run(['git','archive','--format=tar.gz','-o',str(target),'HEAD'],cwd=root,check=True,timeout=120);target.chmod(0o600)
    sources[name]={'commit':commit,'archive':str(target.relative_to(DEST)),'sha256':sha(target),'bytes':target.stat().st_size}
primary=['qa-61da48fe7fab','qa-d8a913706808','qa-aa58787f7a8e','qa-af2768250fd5','qa-7caa8def7cd8','qa-872e69f9403e','qa-271ee5b10252','qa-75a2690bfc68','qa-93353124e935','qa-36f7e04dab2c','qa-44a9d9f18e39','qa-9b7e6e33da28','qa-50ab5d36cc90','qa-05992b52e3fe','qa-0e00d2b1622b','qa-e3ca99c7b0b7','qa-c6108dba2a52']
def collect_runs(value):
    if isinstance(value,dict):
        for child in value.values():collect_runs(child)
    elif isinstance(value,list):
        for child in value:collect_runs(child)
    elif isinstance(value,str) and __import__('re').fullmatch('qa-[0-9a-f]{12}',value):
        if value not in primary:primary.append(value)
for path in OUT.rglob('*.json'):collect_runs(json.loads(path.read_bytes()))
for path in [BASE/'release-candidate-rc8/release-manifest.json',BASE/'release-candidate-rc9/release-manifest.json']:collect_runs(json.loads(path.read_bytes()))
for run in primary:
    source=Path('/home/sigaer/taiko/qa-vault/runs')/run/'evidence'
    if source.is_dir():copy(source,DEST/'qa'/run)
manifest={}
for path in sorted(DEST.rglob('*')):
    if path.is_file() and path.name!='SHA256SUMS':manifest[str(path.relative_to(DEST))]={'sha256':sha(path),'bytes':path.stat().st_size}
(DEST/'SHA256SUMS').write_text(''.join(item['sha256']+'  '+name+'\n' for name,item in manifest.items()));(DEST/'SHA256SUMS').chmod(0o600)
report={'privateRoot':str(DEST),'sourceArchives':sources,'files':len(manifest),'bytes':sum(item['bytes'] for item in manifest.values()),'sha256Sums':sha(DEST/'SHA256SUMS'),'productionDataTraversal':False,'sourceOfPrivateEvidence':'Previously captured Batch 2/2.1 read-only evidence only; no Publication reader/recovery or production DB invoked.'}
(OUT/'durable-evidence.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
