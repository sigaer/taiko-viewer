#!/usr/bin/env python3
"""One-shot, explicitly authorized Vault evidence cleanup; never a periodic GC.
Plan first, then apply the exact plan with fresh consumers and identity checks.
Historical creator metadata is not required. Source, runtime dependencies,
security investigations, databases and active tasks remain protected.
"""
import argparse, bisect, hashlib, json, os, re, shutil, stat, time
from pathlib import Path
import tmp_cleanup as c

VAULT = Path('/home/sigaer/taiko/qa-vault')
GENERATED = {'.output', '.nuxt', 'node_modules', '__pycache__', '.cache'}
MEDIA = {'.png', '.jpg', '.jpeg', '.webp', '.webm', '.mp4', '.zip', '.apk', '.xapk', '.trace', '.har'}
SOURCE = {'source', 'sources', '.git', 'assets', 'public', 'src', 'lib'}
PROTECTED = {'backup', 'backups', 'userdata', 'datadir'}


def identity(p):
    s=p.lstat()
    if p.resolve()!=p or s.st_uid != os.geteuid(): raise c.Unsafe('path identity/owner unsafe')
    return [s.st_dev,s.st_ino,s.st_mode,s.st_size,s.st_mtime_ns,s.st_ctime_ns]


def active(run):
    if str(run)==os.environ.get('QA_RUN_DIR'): return True
    for parent in ('development.slice/development-qa.slice','development.slice/development-build.slice','development.slice','system.slice'):
        p=Path('/sys/fs/cgroup')/parent/('taiko-'+run.name+'.service')/'cgroup.events'
        try:
            if 'populated 1' in p.read_text(): return True
        except FileNotFoundError:pass
    return False


def references():
    b=c.Budget(seconds=90,max_entries=1000000)
    return c.process_refs(b,root=VAULT)|c.retained_refs(b,root=VAULT,excluded=(VAULT,))


_ref_cache = None
_ref_paths = set()
_ref_sorted = []
def held(p,refs):
    global _ref_cache, _ref_paths, _ref_sorted
    if refs is not _ref_cache:
        _ref_cache=refs
        _ref_paths={str(r) for r in refs if r not in (VAULT,VAULT/'runs',VAULT/'evidence')}
        _ref_sorted=sorted(_ref_paths)
    if any(str(parent) in _ref_paths for parent in [p,*p.parents]):return True
    prefix=str(p)+'/'
    i=bisect.bisect_left(_ref_sorted,prefix)
    return i<len(_ref_sorted) and _ref_sorted[i].startswith(prefix)


def totals():
    seen=set();groups={};count=0
    for here,dirs,files in os.walk(VAULT,followlinks=False):
        for p in [Path(here),*[Path(here)/n for n in files],*[Path(here)/n for n in dirs if (Path(here)/n).is_symlink()]]:
            try:s=p.lstat()
            except FileNotFoundError:continue
            key=(s.st_dev,s.st_ino)
            if key in seen:continue
            seen.add(key);count+=1
            rel=p.relative_to(VAULT).parts
            group='/'.join(rel[:3]) if rel and rel[0]=='runs' else '/'.join(rel[:2])
            groups[group]=groups.get(group,0)+s.st_blocks*512
    return dict(allocatedBytes=sum(groups.values()),entries=count,groups=groups,freeBytes=shutil.disk_usage(VAULT).free)


def guard_tree(p):
    # Do not remove a repository, data directory, backup or special file hidden
    # inside a nominal build artifact. No symlink traversal.
    for here,dirs,files in os.walk(p,followlinks=False):
        parts=Path(here).relative_to(p).parts
        compiled_routes='server/chunks/routes' in '/'.join(parts)
        if '.git' in dirs+files or (not compiled_routes and any(n in PROTECTED for n in dirs+files)):return False
        for n in files:
            s=(Path(here)/n).lstat()
            if not (stat.S_ISREG(s.st_mode) or stat.S_ISLNK(s.st_mode)):return False
            if n in {'ibdata1','auto.cnf','PG_VERSION'} or n.endswith(('.ibd','.MYD')):return False
            # Dependency packages may ship disposable IDE/test SQLite fixtures.
            if n.endswith(('.sqlite','.db')) and 'node_modules' not in (p.name,*parts):return False
    return True


def plan(path):
    before=totals();refs=references();items=[];retained=[];states=[]
    roots=[]
    for run in sorted((VAULT/'runs').iterdir()):
        if not re.fullmatch(r'qa-[0-9a-f]{12}',run.name) or not run.is_dir():continue
        busy=active(run) or any(c.within(run,r) for r in refs if r not in (VAULT,VAULT/'runs'))
        m=run/'evidence/manifest.json';meta={}
        if m.is_file() and m.stat().st_size<4*1024**2:
            try:d=json.loads(m.read_text());meta={k:d.get(k) for k in ('exitCode','childrenStopped','stopReason','finishedNs')}
            except ValueError:pass
        states.append(dict(run=run.name,active=busy,**meta))
        if busy:
            retained.append(dict(path=str(run),reason='active cgroup or concrete consumer'));continue
        roots.extend(p for p in [run/'scratch',run/'evidence'] if p.is_dir())
    roots.extend(p for p in (VAULT/'evidence').iterdir() if p.is_dir())
    for root in roots:
        if re.search(r'security|safety|investigation|forensic|incident',root.name,re.I) or any((root/n).exists() for n in ('KEEP','HOLD','.retain')):
            retained.append(dict(path=str(root),reason='independent security/incident evidence'));continue
        if any(c.within(root,r) for r in refs if r not in (VAULT,VAULT/'runs',VAULT/'evidence')):
            retained.append(dict(path=str(root),reason='concrete process/service/source consumer'));continue
        for here,dirs,files in os.walk(root,followlinks=False):
            here=Path(here);parts=set(here.relative_to(root).parts)
            dirs[:]=[n for n in dirs if n not in PROTECTED|{'.git'} and not (here/n).is_symlink()]
            for n in list(dirs):
                p=here/n
                built=(p/'nitro.json').is_file() and (p/'server/index.mjs').is_file() and (p/'public').is_dir()
                if (n in GENERATED or built) and not held(p,refs) and guard_tree(p):
                    info=c.tree_info(p,c.Budget(seconds=60,max_entries=1000000))
                    items.append(dict(path=str(p),kind='generated-directory',identity=identity(p),allocated=info[2],signature=info[3]));dirs.remove(n)
            if parts & SOURCE:continue
            for n in files:
                p=here/n;s=p.lstat()
                if not stat.S_ISREG(s.st_mode) or s.st_nlink!=1 or held(p,refs):continue
                if p.suffix.lower() in {'.sql','.sqlite','.db','.pem','.key','.env'} or re.search(r'backup|credential|account-data',n,re.I):continue
                reason=None
                if p.suffix.lower() in MEDIA:reason='completed regenerable browser/build artifact'
                elif p.suffix.lower() in {'.log','.txt'} and s.st_size>64*1024:reason='historical verbose log; retain bounded tail'
                elif p.suffix.lower() in {'.jsonl','.ndjson','.csv'} and s.st_size>2*1024**2:reason='regenerable raw samples'
                if reason:items.append(dict(path=str(p),kind='file',identity=identity(p),allocated=s.st_blocks*512,reason=reason))
    result=dict(schema=1,created=time.time(),vaultIdentity=identity(VAULT)[:3],before=before,runs=states,retained=retained,items=items)
    path.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(dict(plan=str(path),allocatedBefore=before['allocatedBytes'],plannedBytes=sum(x['allocated'] for x in items),targets=len(items),activeRuns=sum(r['active'] for r in states),scratchBytes=sum(v for k,v in before['groups'].items() if k.endswith('/scratch')),runEvidenceBytes=sum(v for k,v in before['groups'].items() if k.endswith('/evidence')))))


def apply(path):
    import fcntl
    lock=open('/run/lock/taiko-tmp-cleanup.lock','a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    try:
        data=json.loads(path.read_text())
        if data['vaultIdentity']!=identity(VAULT)[:3]:raise c.Unsafe('Vault changed')
        if time.time()-data['created']>3600:raise c.Unsafe('plan older than one hour')
        result=dict(planSha256=hashlib.sha256(path.read_bytes()).hexdigest(),removed=[],retained=[],before=totals())
        journal=VAULT/'cleanup-20261118.jsonl'
        (VAULT/'EVIDENCE-RETENTION.json').write_text(json.dumps(dict(date='2026-11-18',policy='Authorized pruning in progress. Historical originals listed in the deletion journal are no longer available.',journal=str(journal),plan=str(path),planSha256=result['planSha256']),indent=2)+'\n')
        refs=references();last_group=None
        for item in data['items']:
            p=Path(item['path'])
            if not p.is_relative_to(VAULT/'runs') and not p.is_relative_to(VAULT/'evidence'):raise c.Unsafe('scope escape')
            group=Path(*p.parts[:len(VAULT.parts)+2])
            if group!=last_group:
                refs=references();last_group=group
            if active(group) or held(p,refs):
                result['retained'].append(dict(path=str(p),reason='new consumer'));continue
            if item['identity']!=identity(p):raise c.Unsafe('target changed: '+str(p))
            if item['kind']=='generated-directory':
                current=c.tree_info(p,c.Budget(seconds=60,max_entries=1000000))
                if current[3]!=item['signature'] or not guard_tree(p):raise c.Unsafe('tree changed')
                if not shutil.rmtree.avoids_symlink_attacks:raise c.Unsafe('fd-safe removal unavailable')
                shutil.rmtree(p)
            else:
                if p.suffix.lower() in {'.log','.txt'}:
                    with p.open('rb') as f:f.seek(max(0,p.stat().st_size-4096));tail=f.read(4096)
                    (p.parent/(p.name+'.retained-tail.txt')).write_bytes(b'Original verbose log deleted by authorized Vault closeout; last 4096 bytes only.\n'+tail)
                # Parent cannot be swapped for an external symlink between validation
                # and unlink; dirfd pins the checked directory.
                parent=os.open(p.parent,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
                try:
                    s=os.stat(p.name,dir_fd=parent,follow_symlinks=False)
                    if [s.st_dev,s.st_ino,s.st_mode,s.st_size,s.st_mtime_ns,s.st_ctime_ns]!=item['identity']:raise c.Unsafe('file changed')
                    os.unlink(p.name,dir_fd=parent)
                finally:os.close(parent)
            removed=dict(path=str(p.relative_to(VAULT)),allocated=item['allocated'])
            result['removed'].append(removed)
            with journal.open('a') as stream:stream.write(json.dumps(removed)+'\n');stream.flush();os.fsync(stream.fileno())
        result['after']=totals();result['allocatedRemoved']=sum(x['allocated'] for x in result['removed'])
        out=Path(os.environ['QA_EVIDENCE_DIR'])/'vault-cleanup-result.json';out.write_text(json.dumps(result,indent=2)+'\n')
        # Tombstone is authoritative: historical manifests are checksums of deleted
        # originals, not a promise that every listed artifact still exists.
        (VAULT/'EVIDENCE-RETENTION.json').write_text(json.dumps(dict(date='2026-11-18',policy='Completed regenerable evidence pruned by explicit user authorization. Historical manifests may index deleted originals; full raw replay is no longer claimed.',result=str(out),plan=str(path),planSha256=result['planSha256']),indent=2)+'\n')
        print(json.dumps(dict(result=str(out),before=result['before']['allocatedBytes'],after=result['after']['allocatedBytes'],removed=result['allocatedRemoved'],free=result['after']['freeBytes'],retained=len(result['retained']))))
    finally:lock.close()

if __name__=='__main__':
    a=argparse.ArgumentParser();a.add_argument('mode',choices=['plan','apply']);a.add_argument('plan',type=Path);args=a.parse_args()
    (plan if args.mode=='plan' else apply)(args.plan)
