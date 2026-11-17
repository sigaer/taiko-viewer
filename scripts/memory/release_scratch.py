"""Creator-owned release scratch. Never switches output or controls services.

The normal build runner owns its entire scratch lifecycle. Direct invocations
retain the same ownership metadata and safe cleanup, without changing deployment
steps. Paths enter cleanup over stdin so the inspector does not pin itself.
"""
import argparse,json,os,re,sys,time
from pathlib import Path
import admission as a
import qa_vault as q

def create(creator):
    start=a.pid_identity(creator)
    if not start:raise q.UnsafePath('creator exited')
    scratch=os.environ.get('QA_RUN_TMPDIR','')
    if re.fullmatch(r'/var/tmp/viewer-task-qa-[0-9a-f]{12}/scratch',scratch):
        parent=Path(scratch);q.private_directory(parent)
        task=json.loads((parent.parent/'task.json').read_text())
        if task['task_id']!=os.environ.get('QA_RUN_ID') or task['owner']!=os.geteuid():raise q.UnsafePath('runner identity mismatch')
        root=parent/'release';root.mkdir(mode=0o700)
        owner=dict(kind='runner',creator=creator,start=start,identity=q.identity(root))
        (root/'release-owner.json').write_text(json.dumps(owner))
        return root
    run=q.Run(q.DEFAULT_ROOT,1800)
    meta_path=run.task_root/'task.json';meta=json.loads(meta_path.read_text());meta.update(pid=creator,pid_start=start,workload_type='release-scratch')
    meta_path.write_text(json.dumps(meta))
    run.atomic_json('release-owner.json',dict(kind='direct',creator=creator,start=start,identities={str(p):list(v) for p,v in run.identities.items()}))
    return run.scratch

def cleanup(root,creator):
    root=Path(root)
    if re.fullmatch(r'/var/tmp/viewer-task-qa-[0-9a-f]{12}/scratch/release',str(root)):
        q.private_directory(root);owner=json.loads((root/'release-owner.json').read_text())
        if owner['creator']!=creator or owner['start']!=a.pid_identity(creator) or owner['identity']!=list(q.identity(root)):raise q.UnsafePath('release owner changed')
        return 'DEFERRED_TO_OWNING_RUNNER'
    if not re.fullmatch(r'/var/tmp/viewer-task-qa-[0-9a-f]{12}/scratch',str(root)):raise q.UnsafePath('not owned release scratch')
    run=q.Run.__new__(q.Run);run.root=q.private_directory(q.DEFAULT_ROOT)
    run.task_root=q.private_directory(root.parent);run.scratch=q.private_directory(root)
    run.run_id=root.parent.name.removeprefix('viewer-task-');run.path=q.private_directory(run.root/'runs'/run.run_id);run.evidence=q.private_directory(run.path/'evidence')
    owner=json.loads((run.evidence/'release-owner.json').read_text())
    if owner['creator']!=creator or owner['start']!=a.pid_identity(creator):raise q.UnsafePath('release creator mismatch')
    run.identities={Path(p):tuple(v) for p,v in owner['identities'].items()};run.verify()
    # Full build logs already stream to the caller; retain a bounded tail too.
    log=root/'build.log'
    if log.is_file() and not log.is_symlink():
        with log.open('rb') as stream:
            stream.seek(max(0,log.stat().st_size-65536));tail=stream.read(65536)
        (run.evidence/'build-tail.log').write_bytes(tail)
    q.archive_evidence(run)
    outcome=run.clean_scratch(True)  # Scans every live process before deletion.
    run.atomic_json('release-cleanup-'+str(time.time_ns())+'.json',dict(outcome=outcome,at=time.time(),productionServiceActions=False))
    return outcome

def main():
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['create','cleanup']);parser.add_argument('--creator-pid',type=int,required=True);args=parser.parse_args()
    if args.action=='create':print(create(args.creator_pid))
    else:
        try:print(cleanup(sys.stdin.read(4096).strip(),args.creator_pid))
        except (OSError,ValueError,KeyError,q.UnsafePath,q.tmp_cleanup.Unsafe) as error:
            print('RETAINED_RELEASE_SCRATCH_'+type(error).__name__,file=sys.stderr)
            return 1
    return 0
if __name__=='__main__':raise SystemExit(main())
