#!/usr/bin/env python3
"""Bounded QA disk supervision. Never collects environment or command arguments.

Owns exactly one newly-created run. Existing runs/artifacts are never pruned.
This is operational containment, not a sandbox against a malicious same-uid job.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import selectors
import shutil
import signal
import stat
import subprocess
import sys
import time
import uuid

GIB = 1024 ** 3
DEFAULT_ROOT = Path('/home/sigaer/taiko/qa-vault')
DEFAULT_SCRATCH = 2 * GIB
MIN_FREE = 5 * GIB
LOG_LIMIT = 64 * 1024 ** 2
MAX_ENTRIES = 100000

class UnsafePath(RuntimeError):
    pass


def private_directory(path, create=False):
    """Reject symlinks in every path component; never chmod an existing path."""
    path = Path(path)
    if not path.is_absolute():
        raise UnsafePath('absolute vault path required')
    current = Path(path.anchor)
    for part in path.parts[1:]:
        current /= part
        try:
            st = current.lstat()
        except FileNotFoundError:
            if not create:
                raise
            current.mkdir(mode=0o700)
            st = current.lstat()
        if not stat.S_ISDIR(st.st_mode):
            raise UnsafePath('directory component is not a regular directory')
    st = path.lstat()
    if st.st_uid != os.geteuid() or stat.S_IMODE(st.st_mode) != 0o700:
        raise UnsafePath('vault directory must be owned by caller with mode 0700')
    return path


def identity(path):
    st = Path(path).lstat()
    if not stat.S_ISDIR(st.st_mode) or st.st_uid != os.geteuid() or stat.S_IMODE(st.st_mode) != 0o700:
        raise UnsafePath('owned private directory required')
    return (st.st_dev, st.st_ino)


class Run:
    def __init__(self, root):
        self.root = private_directory(root, create=True)
        self.run_id = 'qa-' + uuid.uuid4().hex[:12]
        runs = private_directory(self.root / 'runs', create=True)
        self.path = runs / self.run_id
        self.path.mkdir(mode=0o700)
        self.scratch = self.path / 'scratch'
        self.evidence = self.path / 'evidence'
        self.scratch.mkdir(mode=0o700)
        self.evidence.mkdir(mode=0o700)
        self.identities = {p: identity(p) for p in [self.root, runs, self.path, self.scratch, self.evidence]}

    def verify(self):
        for path, expected in self.identities.items():
            if identity(path) != expected:
                raise UnsafePath('run directory replaced; refusing traversal or cleanup')

    def clean_scratch(self, children_stopped):
        if not children_stopped:
            return 'RETAINED_CHILD_EXIT_UNPROVEN'
        self.verify()
        # shutil uses fd-based symlink-attack-resistant removal on supported Linux.
        if not shutil.rmtree.avoids_symlink_attacks:
            raise UnsafePath('fd-safe cleanup unavailable')
        shutil.rmtree(self.scratch)
        del self.identities[self.scratch]
        return 'REMOVED_OWNED_SCRATCH_ONLY'

    def atomic_json(self, name, value):
        self.verify()
        if '/' in name or name.startswith('.'):
            raise UnsafePath('invalid evidence filename')
        fd = os.open(self.evidence, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        temporary = '.' + name + '-' + uuid.uuid4().hex
        try:
            out = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=fd)
            with os.fdopen(out, 'w') as stream:
                json.dump(value, stream, indent=2, ensure_ascii=False)
                stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
            try:
                os.stat(name, dir_fd=fd, follow_symlinks=False)
            except FileNotFoundError:
                pass
            else:
                raise UnsafePath('evidence destination already exists')
            os.rename(temporary, name, src_dir_fd=fd, dst_dir_fd=fd)
            os.fsync(fd)
        finally:
            os.close(fd)


def tree_usage(path, reject_symlinks=False):
    total = allocated = largest = entries = symlinks = 0
    base = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    allocated += os.fstat(base).st_blocks * 512
    stack = [base]
    try:
        while stack:
            directory = stack.pop()
            try:
                for name in os.listdir(directory):
                    entries += 1
                    if entries > MAX_ENTRIES:
                        raise UnsafePath('run entry count exceeds monitoring bound')
                    try:
                        st = os.stat(name, dir_fd=directory, follow_symlinks=False)
                        allocated += st.st_blocks * 512
                        if stat.S_ISLNK(st.st_mode):
                            if reject_symlinks:
                                raise UnsafePath("symlink evidence cannot be archived")
                            symlinks += 1
                            total += st.st_size
                        elif stat.S_ISDIR(st.st_mode):
                            stack.append(os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=directory))
                        elif stat.S_ISREG(st.st_mode):
                            if st.st_nlink != 1:
                                raise UnsafePath('hardlinked run file is not allowed')
                            total += st.st_size
                            largest = max(largest, st.st_size)
                        elif not stat.S_ISSOCK(st.st_mode):
                            raise UnsafePath('symlink or unsupported special file in run')
                    except FileNotFoundError:
                        # A job may unlink its own intermediate file between samples.
                        continue
            finally:
                os.close(directory)
    finally:
        for directory in stack:
            os.close(directory)
    return {'bytes': total, 'logicalBytes': total, 'allocatedBytes': allocated, 'symlinkCount': symlinks, 'largestFileBytes': largest, 'entries': entries}


def sample(run, phase):
    run.verify()
    disk = os.statvfs(run.path)
    scratch = tree_usage(run.scratch) if run.scratch.exists() else {'bytes': 0, 'logicalBytes': 0, 'allocatedBytes': 0, 'symlinkCount': 0, 'largestFileBytes': 0, 'entries': 0}
    return {'phase': phase, 'timeNs': time.time_ns(), 'freeBytes': disk.f_bavail * disk.f_frsize,
            'totalBytes': disk.f_blocks * disk.f_frsize, 'scratch': scratch, 'run': tree_usage(run.path),
            'evidence': tree_usage(run.evidence, reject_symlinks=True)}


def violation(record, scratch_limit, min_free):
    if record['freeBytes'] < min_free:
        return 'DISK_LOW_WATER'
    if max(record['scratch']['bytes'], record['scratch'].get('allocatedBytes', 0)) > scratch_limit:
        return 'SCRATCH_LIMIT'
    if record['run']['largestFileBytes'] > 2 * GIB:
        return 'FILE_LIMIT'
    return None


def supervise(process, run, stop, scratch_limit, min_free, interval=2, timeout=930, echo=True):
    """Read bounded output and monitor filesystem. stop must prove entire job exit."""
    samples = []
    reason = None
    started = time.monotonic()
    digest = hashlib.sha256()
    written = 0
    partial = run.evidence / 'output.log.partial'
    log_fd = os.open(partial, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    log_identity = os.fstat(log_fd)
    selector = selectors.DefaultSelector()
    selector.register(process.stdout, selectors.EVENT_READ)
    next_sample = 0
    interrupted = []
    old_handlers = {}
    for number in [signal.SIGINT, signal.SIGTERM]:
        old_handlers[number] = signal.signal(number, lambda signum, frame: interrupted.append(signum))
    stopped = False
    try:
        with os.fdopen(log_fd, 'wb') as log:
            while selector.get_map() or process.poll() is None:
                if time.monotonic() >= next_sample:
                    record = sample(run, 'during')
                    samples.append(record)
                    reason = violation(record, scratch_limit, min_free)
                    next_sample = time.monotonic() + interval
                if interrupted:
                    reason = 'INTERRUPTED'
                if time.monotonic() - started > timeout:
                    reason = 'SUPERVISOR_DEADLINE'
                if reason:
                    break
                for key, _ in selector.select(timeout=min(interval, 0.25)):
                    chunk = os.read(key.fileobj.fileno(), 65536)
                    if not chunk:
                        selector.unregister(key.fileobj)
                        continue
                    if written + len(chunk) > LOG_LIMIT:
                        reason = 'LOG_LIMIT'
                        break
                    log.write(chunk); digest.update(chunk); written += len(chunk)
                    if echo:
                        try:
                            sys.stdout.buffer.write(chunk); sys.stdout.buffer.flush()
                        except BrokenPipeError:
                            reason = 'OUTPUT_CONSUMER_CLOSED'
                            break
                if reason:
                    break
            log.flush(); os.fsync(log.fileno())
    except (UnsafePath, OSError) as error:
        reason = type(error).__name__  # Never serialize arbitrary exception payload/path/args.
    finally:
        stopped = stop()
        try:
            process.wait(timeout=20)
        except subprocess.TimeoutExpired:
            process.kill(); process.wait(timeout=5)
            stopped = False
        process.stdout.close()
        selector.close()
        for number, handler in old_handlers.items():
            signal.signal(number, handler)
    run.verify()
    # The partial was opened exclusively; verify the path still identifies that log.
    st = partial.lstat()
    if not stat.S_ISREG(st.st_mode) or st.st_nlink != 1 or (st.st_dev, st.st_ino) != (log_identity.st_dev, log_identity.st_ino):
        raise UnsafePath('log replaced')
    final = run.evidence / 'output.log'
    if final.exists() or final.is_symlink():
        raise UnsafePath('final log exists')
    os.rename(partial, final)
    after = sample(run, 'after-child-exit')
    samples.append(after)
    reason = reason or violation(after, scratch_limit, min_free)
    return {'exitCode': process.returncode, 'stopReason': reason, 'childrenStopped': stopped,
            'samples': samples, 'log': {'file': 'output.log', 'bytes': written, 'sha256': digest.hexdigest()}}


def archive_evidence(run):
    """Flush and hash only regular owned evidence files after cgroup exit."""
    run.verify()
    records = []
    def visit(directory, prefix):
        for name in sorted(os.listdir(directory)):
            if len(records) >= MAX_ENTRIES:
                raise UnsafePath('evidence inventory too large')
            st = os.stat(name, dir_fd=directory, follow_symlinks=False)
            relative = prefix + name
            if stat.S_ISDIR(st.st_mode):
                child = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=directory)
                try:
                    visit(child, relative + '/')
                    os.fsync(child)
                finally:
                    os.close(child)
            elif stat.S_ISREG(st.st_mode) and st.st_nlink == 1:
                child = os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=directory)
                try:
                    actual = os.fstat(child)
                    if (actual.st_dev, actual.st_ino) != (st.st_dev, st.st_ino):
                        raise UnsafePath('evidence replaced before archive')
                    digest = hashlib.sha256()
                    while True:
                        chunk = os.read(child, 1024 * 1024)
                        if not chunk:
                            break
                        digest.update(chunk)
                    os.fsync(child)
                    final = os.fstat(child)
                    if (actual.st_size, actual.st_mtime_ns) != (final.st_size, final.st_mtime_ns):
                        raise UnsafePath('evidence changed after child exit')
                    records.append({'path': relative, 'bytes': actual.st_size, 'sha256': digest.hexdigest()})
                finally:
                    os.close(child)
            else:
                raise UnsafePath('only regular evidence files may be archived')
    directory = os.open(run.evidence, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        visit(directory, '')
        os.fsync(directory)
    finally:
        os.close(directory)
    return records


def artifact_manifest(run):
    path = Path(os.environ.get('QA_ARTIFACT_MANIFEST', str(run.root / 'artifacts/runtime-manifest.json')))
    if not path.is_absolute() or '..' in path.parts or not path.is_relative_to(run.root):
        raise UnsafePath('artifact manifest must be absolute and inside vault')
    current = run.root
    for part in path.relative_to(run.root).parts:
        current /= part
        try:
            st = current.lstat()
        except FileNotFoundError:
            continue
        if stat.S_ISLNK(st.st_mode):
            raise UnsafePath('artifact manifest path contains symlink')
        if current == path and not stat.S_ISREG(st.st_mode):
            raise UnsafePath('artifact manifest must be a regular file')
    return path


def systemd_command(unit, run, command):
    return ['systemd-run', '--quiet', '--unit=' + unit, '--slice=development-qa.slice', '--wait', '--collect', '--pipe',
            '--working-directory=' + os.getcwd(), '--setenv=PATH=' + os.environ.get('PATH', ''),
            '--setenv=TMPDIR=' + str(run.scratch),
            '--setenv=QA_RUN_ID=' + run.run_id, '--setenv=QA_RUN_DIR=' + str(run.path),
            '--setenv=QA_RUN_TMPDIR=' + str(run.scratch), '--setenv=QA_EVIDENCE_DIR=' + str(run.evidence),
            '--setenv=QA_ARTIFACT_MANIFEST=' + str(artifact_manifest(run)), '--setenv=TAIKO_QA_SCRATCH_DIR=' + str(run.scratch),
            '--setenv=TAIKO_QA_EVIDENCE_DIR=' + str(run.evidence), '--setenv=TAIKO_QA_RUN_ID=' + run.run_id,
            '--setenv=NODE_OPTIONS=--max-old-space-size=1536',
            '-p', 'MemoryHigh=2G', '-p', 'MemoryMax=3G', '-p', 'MemorySwapMax=256M',
            '-p', 'TasksMax=256', '-p', 'LimitFSIZE=2147483648', '-p', 'CPUQuota=200%',
            '-p', 'RuntimeMaxSec=15min', '-p', 'TimeoutStopSec=15', '-p', 'KillMode=control-group',
            '-p', 'OOMPolicy=stop', '-p', 'UMask=0077', '--',
            '/usr/bin/env', '-i', 'PATH=' + os.environ.get('PATH', ''),
            'TMPDIR=' + str(run.scratch), 'QA_RUN_ID=' + run.run_id, 'QA_RUN_DIR=' + str(run.path),
            'QA_RUN_TMPDIR=' + str(run.scratch), 'QA_EVIDENCE_DIR=' + str(run.evidence),
            'TAIKO_QA_RUN_ID=' + run.run_id, 'TAIKO_QA_SCRATCH_DIR=' + str(run.scratch),
            'TAIKO_QA_EVIDENCE_DIR=' + str(run.evidence), 'QA_ARTIFACT_MANIFEST=' + str(artifact_manifest(run)),
            'NODE_OPTIONS=--max-old-space-size=1536', *command]


def stop_unit(unit):
    # Only this invocation's unguessable unit is affected; never enumerate/kill other jobs.
    try:
        subprocess.run(['systemctl', 'stop', unit + '.service'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=25)
        state = subprocess.run(['systemctl', 'show', unit + '.service', '-p', 'ActiveState', '-p', 'ControlGroup'], capture_output=True, text=True, timeout=5)
        values = dict(line.split('=', 1) for line in state.stdout.splitlines() if '=' in line)
        if values.get('ActiveState') not in {'inactive', 'failed'}:
            return False
        group = values.get('ControlGroup')
        if group:
            path = Path('/sys/fs/cgroup') / group.lstrip('/') / 'cgroup.events'
            if path.exists() and 'populated 1' in path.read_text():
                return False
        return True
    except (OSError, subprocess.TimeoutExpired):
        return False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--vault-root', type=Path, default=DEFAULT_ROOT)
    parser.add_argument('--scratch-limit', type=int, default=DEFAULT_SCRATCH)
    parser.add_argument('--min-free', type=int, default=MIN_FREE)
    parser.add_argument('--budget-reason', default='default')
    parser.add_argument('command', nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.command[1:] if args.command[:1] == ['--'] else args.command
    if not command or args.scratch_limit < 1 or args.min_free < MIN_FREE:
        parser.error('command and positive scratch budget required; free-space floor cannot be lowered')
    if args.scratch_limit != DEFAULT_SCRATCH and args.budget_reason == 'default':
        parser.error('non-default scratch budget requires a documented reason identifier')
    # Reason must be a nonsecret identifier, never free-form command/credential text.
    if not args.budget_reason.replace('-', '').replace('_', '').isalnum() or len(args.budget_reason) > 80:
        parser.error('budget reason must be a short nonsecret identifier')
    run = Run(args.vault_root)
    print(json.dumps({'QA_RUN_DIR': str(run.path), 'QA_EVIDENCE_DIR': str(run.evidence), 'QA_RUN_TMPDIR': str(run.scratch)}), flush=True)
    unit = 'taiko-' + run.run_id
    record = {'schema': 1, 'runId': run.run_id, 'unit': unit, 'startedNs': time.time_ns(),
              'scratchLimitBytes': args.scratch_limit, 'minimumFreeBytes': args.min_free,
              'budgetReasonId': args.budget_reason, 'commandArgumentsRecorded': False,
              'environmentRecorded': False, 'samples': [], 'childrenStopped': True}
    def interrupt(signum, frame):
        raise InterruptedError('QA interrupted')
    for number in [signal.SIGINT, signal.SIGTERM]:
        signal.signal(number, interrupt)
    code = 1
    process = None
    try:
        before = sample(run, 'before')
        record['samples'].append(before)
        reason = violation(before, args.scratch_limit, args.min_free)
        if reason:
            record.update(exitCode=None, stopReason=reason)
        else:
            process = subprocess.Popen(systemd_command(unit, run, command), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, start_new_session=True)
            result = supervise(process, run, lambda: stop_unit(unit), args.scratch_limit, args.min_free)
            result['samples'] = record['samples'] + result['samples']
            record.update(result)
            code = result['exitCode'] if result['exitCode'] is not None and result['exitCode'] >= 0 else 1
            if result['stopReason'] or not result['childrenStopped']:
                code = code or 1
    except (OSError, UnsafePath) as error:
        record.update(stopReason=type(error).__name__)
    finally:
        if process is not None:
            record['childrenStopped'] = stop_unit(unit)
        try:
            if record['childrenStopped']:
                record['archivedEvidence'] = archive_evidence(run)
                record['archiveStatus'] = 'FSYNCED_REGULAR_FILES'
            else:
                record['archiveStatus'] = 'RETAINED_CHILD_EXIT_UNPROVEN'
        except (OSError, UnsafePath) as error:
            record['archiveStatus'] = 'FAILED_' + type(error).__name__
            code = 1
        try:
            record['cleanup'] = run.clean_scratch(record['childrenStopped'])
            record['samples'].append(sample(run, 'after-cleanup'))
        except (OSError, UnsafePath) as error:
            record['cleanup'] = 'RETAINED_' + type(error).__name__
            code = 1
        record['finishedNs'] = time.time_ns()
        record['wrapperExitCode'] = code
        try:
            run.atomic_json('manifest.json', record)
        except (OSError, UnsafePath):
            # Never follow a swapped directory to save a report. Preserve a new
            # sibling incident record, without deleting the compromised run.
            incident = Run(args.vault_root)
            record['cleanup'] = 'RETAINED_UNSAFE_RUN_PATH'
            record['wrapperExitCode'] = code = 1
            incident.clean_scratch(True)
            incident.atomic_json('incident.json', record)
            print('QA incident evidence: ' + str(incident.evidence), file=sys.stderr)
        print('QA evidence: ' + str(run.evidence), file=sys.stderr)
    return code

if __name__ == '__main__':
    raise SystemExit(main())
