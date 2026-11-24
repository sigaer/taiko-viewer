"""Preserve exactly the hashed input corpus outside Git; read-only source access."""
import hashlib, io, json, os, tarfile
from pathlib import Path
BASE=Path('/var/tmp/taiko-batch2-20261124');DOC=BASE/'integration/docs/catalog-release-batch2-20261124/timeline'
index=json.loads((DOC/'file-index.json').read_bytes());target=BASE/'evidence/tja-source-corpus.tar.gz'
with tarfile.open(target,'w:gz') as tar:
    for row in index:
        kind,name=row['source'].split('/',1)
        root=Path('/home/sigaer/git/ESE_autosync') if kind=='ESE' else Path('/home/sigaer/taiko/assets/catalog_sources')
        raw=(root/name).read_bytes();assert hashlib.sha256(raw).hexdigest()==row['sourceHash'],'Source changed after scan: '+row['source']
        info=tarfile.TarInfo(row['source']);info.size=len(raw);info.mtime=0;info.mode=0o600
        tar.addfile(info,io.BytesIO(raw))
with target.open('rb') as f:digest=hashlib.file_digest(f,'sha256').hexdigest()
report={'qaRun':os.environ['QA_RUN_ID'],'files':len(index),'allSourceHashesMatchScan':True,'path':str(target),'bytes':target.stat().st_size,'sha256':digest,'distribution':'private QA evidence only; not part of public release'}
(DOC/'source-corpus-manifest.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
