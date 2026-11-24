"""Seal completed archive-run logs after the copy job has exited."""
import hashlib,json,os,shutil
from pathlib import Path
BASE=Path('/var/tmp/taiko-batch21-20261124');REPORT=BASE/'viewer/docs/wahlap-authority-b21-20261124/durable-evidence.json'
data=json.loads(REPORT.read_bytes());root=Path(data['privateRoot'])
def sha(path):
    with path.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
name='durable-delivery-rc9-pass.log';source=BASE/'evidence'/name;target=root/'evidence'/name
if target.exists() and sha(source)!=sha(target):
    partial=target.with_suffix('.running.log');assert not partial.exists();target.rename(partial)
if not target.exists():shutil.copy2(source,target);target.chmod(0o600)
run='qa-04664e741573';folder=root/'qa'/run;folder.mkdir(mode=0o700,parents=True,exist_ok=True)
for path in (Path('/home/sigaer/taiko/qa-vault/runs')/run/'evidence').iterdir():
    if not path.is_file():continue
    destination=folder/path.name
    if destination.exists():assert sha(path)==sha(destination)
    else:shutil.copy2(path,destination);destination.chmod(0o600)
files={str(path.relative_to(root)):{'sha256':sha(path),'bytes':path.stat().st_size} for path in sorted(root.rglob('*')) if path.is_file() and path.name!='SHA256SUMS'}
sums=root/'SHA256SUMS';sums.write_text(''.join(value['sha256']+'  '+name+'\n' for name,value in files.items()));sums.chmod(0o600)
data.update(files=len(files),bytes=sum(value['bytes'] for value in files.values()),sha256Sums=sha(sums),preservationRun=run,sealedByRun=os.environ['QA_RUN_ID'])
REPORT.write_text(json.dumps(data,indent=2)+'\n');print(json.dumps({'sealed':str(root),'files':data['files'],'bytes':data['bytes'],'sha256Sums':data['sha256Sums']}))
