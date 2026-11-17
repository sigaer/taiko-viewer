import os,sys,json,time,stat,subprocess
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import tmp_cleanup as c
started=time.time(); budget=c.Budget(seconds=600,max_entries=2000000)
refs=c.process_refs(budget)|c.retained_refs(budget)
# /tmp references are scanned separately; never infer absence from /var/tmp-only patterns.
import re
old_ref=c.REF
c.REF=re.compile(r'/tmp/[^\s\x00\x22\x27;:]+')
refs |= c.process_refs(budget,root=Path('/tmp'))
c.REF=re.compile(r'/home/sigaer/[^\s\x00\x22\x27;:]+')
refs |= c.process_refs(budget,root=Path('/home/sigaer'))
c.REF=old_ref
processes=[]
for proc in Path('/proc').iterdir():
    if not proc.name.isdigit():continue
    try:
        named=set()
        for name in ['cwd','exe']:
            try:named.add(Path(os.readlink(proc/name).removesuffix(' (deleted)')))
            except FileNotFoundError:pass
        opened=set()
        for fd in (proc/'fd').iterdir():
            try:opened.add(Path(os.readlink(fd).removesuffix(' (deleted)')))
            except FileNotFoundError:pass
        processes.append((int(proc.name),named,opened))
    except (FileNotFoundError,ProcessLookupError):continue
services=[]
for base in ['/etc/systemd/system','/run/systemd/transient','/usr/lib/systemd/system']:
    for config in Path(base).rglob('*'):
        if config.is_file() and config.stat().st_size<262144:
            raw=config.read_text(errors='replace')
            paths=c.extract_refs(raw)
            c.REF=re.compile(r'/tmp/[^\s\x00\x22\x27;:]+')
            paths |= c.extract_refs(raw,Path('/tmp'))
            c.REF=re.compile(r'/home/sigaer/[^\s\x00\x22\x27;:]+')
            paths |= c.extract_refs(raw,Path('/home/sigaer'))
            c.REF=old_ref
            if paths:services.append((str(config),paths))

w=subprocess.check_output(['git','worktree','list','--porcelain'],cwd=str(c.REPO),text=True)
worktrees=[Path(l[9:]) for l in w.splitlines() if l.startswith('worktree ')]
records=[]; changed_roots=[]
roots=list(Path('/var/tmp').iterdir())+[p for p in Path('/tmp').iterdir() if 'viewer' in p.name or 'taiko' in p.name]
# Older runners put transient scratch in the persistent Vault; inspect those
# separately from retained evidence, plus non-main worktrees outside /var/tmp.
extra=list(Path('/home/sigaer/taiko/qa-vault/runs').glob('*/scratch'))+[p for p in worktrees if p != c.REPO]
for path in extra:
    if not any(c.within(path,existing) for existing in roots):roots.append(path)
for root in roots:
    try:root_info=root.lstat()
    except FileNotFoundError:
        changed_roots.append(str(root));continue
    logical=allocated=count=files=directories=links=0; oldest=float('inf'); newest=0; seen=set(); errors=[]; stack=[root]
    while stack:
        p=stack.pop(); budget.tick()
        try:
            s=p.lstat(); files+=int(stat.S_ISREG(s.st_mode));directories+=int(stat.S_ISDIR(s.st_mode));links+=int(stat.S_ISLNK(s.st_mode)); oldest=min(oldest,s.st_mtime);newest=max(newest,s.st_mtime);count+=1;logical+=s.st_size
            if (s.st_dev,s.st_ino) not in seen: allocated+=s.st_blocks*512;seen.add((s.st_dev,s.st_ino))
            if stat.S_ISDIR(s.st_mode):
                with os.scandir(p) as it: stack.extend(Path(e.path) for e in it)
        except FileNotFoundError: errors.append('changed-during-scan')
        if len(errors)>100: raise RuntimeError('unstable-tree')
    if not count:
        changed_roots.append(str(root));continue
    associated=[str(p) for p in worktrees if c.within(p,root) or c.within(root,p)]
    matches=[str(p) for p in refs if c.within(p,root) or c.within(root,p)]
    name=root.name
    kind='Unknown'
    if 'build' in name or 'release' in name: kind='Build artifacts'
    elif 'playwright' in name or 'chrome' in name:kind='Browser artifacts'
    elif 'cache' in name:kind='Dependency cache'
    elif name.endswith('.log'):kind='Logs'
    elif name=='scratch' and 'qa-vault' in root.parts:kind='QA scratch'
    elif associated:kind='Worktree (retained; completion unknown)'
    elif any(x in name for x in ['qa','phase0','viewer-task']):kind='QA scratch'
    process_refs=[pid for pid,named,opened in processes if any(c.within(p,root) for p in named if p.is_absolute())]
    open_refs=[pid for pid,named,opened in processes if any(c.within(p,root) for p in opened if p.is_absolute())]
    service_refs=[name for name,paths in services if any(c.within(p,root) or c.within(root,p) for p in paths)]
    task = {}
    metadata = root/'task.json'
    try:
        meta_info = metadata.lstat()
        if stat.S_ISREG(meta_info.st_mode) and meta_info.st_size <= 4096:
            value = json.loads(metadata.read_text())
            if value.get('owner') == root_info.st_uid and value.get('task_id') == name.removeprefix('viewer-task-'):
                task = {key:value.get(key) for key in ['task_id','owner','status','created','expiry','finished','vault']}
    except (ValueError, OSError):pass
    records.append(dict(task=task,fileCount=files,directoryCount=directories,symlinkCount=links,processIds=process_refs,openFileProcessIds=open_refs,systemdConfigurations=service_refs,path=str(root),logicalBytes=logical,allocatedBytes=allocated,entries=count,earliestMtime=oldest,latestMtime=newest,worktrees=associated,references=matches,category=kind,ownerUid=root_info.st_uid,taskStatus=task.get('status','UNKNOWN_RETAIN'),scanChanges=len(errors)))
    # Detailed paths remain in the private evidence file.
result=dict(started=started,finished=time.time(),changedRoots=changed_roots,records=records,worktrees=[str(p) for p in worktrees],disk=dict(zip(['total','used','free'],__import__('shutil').disk_usage('/var/tmp'))))
(Path(os.environ['QA_EVIDENCE_DIR'])/'inventory.json').write_text(json.dumps(result,indent=2))
print('INVENTORY_COMPLETE',len(records))
