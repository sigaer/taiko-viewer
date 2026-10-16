#!/usr/bin/env python3
"""Remove only this task's stopped synthetic MySQL data; preserve all evidence."""
import argparse,json,os,shutil,time
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('workspace',type=Path);a=p.parse_args();w=a.workspace.resolve()
evidence_root=Path(os.environ['QA_EVIDENCE_DIR']).resolve(strict=True)
assert evidence_root.is_relative_to('/home/sigaer/taiko/qa-vault') and evidence_root!=Path('/home/sigaer/taiko/qa-vault')
assert not a.workspace.is_symlink() and w.parent==evidence_root and w.name.startswith('viewer1-sql-')
result=json.loads((w/'result.json').read_text())
assert result.get('workspace')==str(w) and result.get('daemonExited') is True
assert result.get('databaseProof')=='viewer1_security_test' and (w/'o1-performance.json').is_file()
run_tmp=Path(os.environ['QA_RUN_TMPDIR']).resolve(strict=True)
assert run_tmp.is_relative_to('/home/sigaer/taiko/qa-vault') and run_tmp!=Path('/home/sigaer/taiko/qa-vault')
d=Path(result['datadir']);assert not d.is_symlink()
assert d.resolve().is_relative_to(run_tmp) and d.name=='mysql' and d.parent.name.startswith('sql-')
assert result.get('qaRunTmpdir')==str(run_tmp)
assert d.is_dir()
for proc in Path('/proc').iterdir():
 if not proc.name.isdigit():continue
 try:cmd=(proc/'cmdline').read_bytes().split(b'\0')
 except (FileNotFoundError,PermissionError,ProcessLookupError):continue
 assert ('--datadir='+str(d)).encode() not in cmd,'Owned mysqld still alive'
size=sum(f.lstat().st_size for f in d.rglob('*') if f.is_file() and not f.is_symlink())
proof={'workspace':str(w),'removed':str(d),'logicalBytes':size,'daemonExited':True,'activeMatchingProcess':False,'finishedAtUnix':time.time(),'retained':['result.json','o1-performance.json','tests.log','bootstrap.log','mysql.log','initialize.log'],'scope':'exact current-task synthetic datadir only'}
assert not (d.parent/'mysql.pid').exists(),'MySQL PID file remains'
shutil.rmtree(d)
(w/'owned-datadir-cleanup.json').write_text(json.dumps(proof,indent=2)+'\n')
print(json.dumps(proof))
