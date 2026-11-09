#!/usr/bin/env python3
"""Age out allowlisted /var/tmp artifacts; retain source, data and consumers.

No generic recursive age purge. Source worktrees, QA evidence and persistent
staging are retained. All discovery completes before the first deletion.
"""
import argparse
import fcntl
import json
import hashlib
import os
import re
import shutil
import stat
import time
import tempfile
from pathlib import Path

ROOT = Path('/var/tmp')
REPO = Path('/home/sigaer/taiko/taiko-forum')
LOCK = Path('/run/lock/taiko-memory-qa.lock')
REPORT = Path('/var/log/taiko-tmp-cleanup/last.json')
DAY = 86400
GENERATED = {'.output', '.output.previous', '.output.next', '.nuxt', 'node_modules', '__pycache__', '.pytest_cache'}
PRUNE = {'.git', 'userdata', 'data', 'assets', 'cache', 'secrets', 'mysql', 'runtime', '.venv', 'venv', 'env', 'lib', 'share', 'include', 'logs',
         'build', 'dist', 'target', '.dart_tool', '.gradle', '.cache', 'node-compile-cache',
         'coverage', 'test-results', 'qa-vault'}
PREFIXES = ('taiko-', 'viewer-', 'u1-')
PROTECTED = (ROOT / 'taiko-viewer-ourtaiko-staging',)
REF = re.compile(r'/var/tmp/[^\s\x00\x22\x27;:]+')
MAX_ENTRIES = 300000
MAX_CANDIDATES = 2000


class Unsafe(RuntimeError):
    pass


def within(path, parent):
    return path == parent or path.is_relative_to(parent)


class Budget:
    def __init__(self, seconds=300, max_entries=MAX_ENTRIES):
        self.deadline = time.monotonic() + seconds
        self.entries = 0
        self.limit = max_entries

    def tick(self):
        self.entries += 1
        if self.entries > self.limit or time.monotonic() > self.deadline:
            raise Unsafe('discovery budget exceeded; nothing may be deleted')


def identity(path):
    info = path.lstat()
    if stat.S_ISLNK(info.st_mode) or path.resolve() != path:
        raise Unsafe('symlink in cleanup path')
    return info


def tree_info(path, budget):
    """Stream metadata, ignore link targets and reject mount crossings."""
    root = identity(path)
    latest = max(root.st_mtime, root.st_ctime)
    allocated = root.st_blocks * 512
    signature = 0

    def record(name, info):
        nonlocal signature
        metadata = (name, info.st_ino, info.st_mode, info.st_size, info.st_mtime_ns, info.st_ctime_ns)
        signature ^= int.from_bytes(hashlib.blake2b(repr(metadata).encode(), digest_size=16).digest(), 'big')

    record('.', root)
    stack = [path] if stat.S_ISDIR(root.st_mode) else []
    while stack:
        with os.scandir(stack.pop()) as entries:
            for entry in entries:
                budget.tick()
                info = entry.stat(follow_symlinks=False)
                if info.st_dev != root.st_dev:
                    raise Unsafe('mount crossing inside cleanup artifact')
                record(str(Path(entry.path).relative_to(path)), info)
                latest = max(latest, info.st_mtime, info.st_ctime)
                allocated += info.st_blocks * 512
                if stat.S_ISDIR(info.st_mode):
                    stack.append(Path(entry.path))
                elif not (stat.S_ISREG(info.st_mode) or stat.S_ISLNK(info.st_mode)):
                    raise Unsafe('special file inside cleanup artifact')
    return root, latest, allocated, f'{signature:032x}'


def candidates(root, now, budget, protected):
    selected = []

    def add(path, age, kind):
        if any(within(path, p) or within(p, path) for p in protected):
            return
        info = identity(path)
        if max(info.st_mtime, info.st_ctime) > now - age:
            return
        info, latest, allocated, signature = tree_info(path, budget)
        if latest > now - age:
            return
        selected.append({'path': str(path), 'kind': kind, 'ageSeconds': age,
                         'dev': info.st_dev, 'ino': info.st_ino,
                         'latest': latest, 'signature': signature, 'allocatedBytes': allocated})
        if len(selected) > MAX_CANDIDATES:
            raise Unsafe('too many cleanup candidates')

    for top in root.iterdir():
        budget.tick()
        if top.is_symlink() or not top.name.startswith(PREFIXES):
            continue
        if any(within(top, p) or within(p, top) for p in protected):
            continue
        if top.is_file():
            if top.suffix in {'.log', '.tmp'}:
                add(top, 30 * DAY, 'loose-log-or-temp')
            continue
        if not top.is_dir():
            continue
        if top.name == 'taiko-build':
            for child in top.iterdir():
                budget.tick()
                if re.fullmatch(r'[a-f0-9]{32}', child.name) and not child.is_symlink():
                    add(child, 7 * DAY, 'build-cache')
            continue
        for current, dirs, files in os.walk(top, followlinks=False):
            here = Path(current)
            budget.tick()
            keep = []
            for name in dirs:
                budget.tick()
                path = here / name
                if path.is_symlink():
                    continue
                if name in GENERATED:
                    add(path, 7 * DAY, 'generated')
                elif name not in PRUNE and len(here.relative_to(top).parts) < 6:
                    keep.append(name)
            dirs[:] = keep
    return selected


def extract_refs(text, root=ROOT):
    refs = set()
    # Tests may use a private fixture root; production always uses /var/tmp.
    regex = REF if root == ROOT else re.compile(re.escape(str(root)) + r'/[^\s\x00\x22\x27;:]+')
    for raw in regex.findall(text):
        path = Path(raw.rstrip(',)'))
        refs.add(path)
        refs.add(path.resolve())
    return refs


def process_refs(budget, proc_root=Path('/proc'), root=ROOT):
    refs = set()
    for proc in proc_root.iterdir():
        if not proc.name.isdigit():
            continue
        budget.tick()
        try:
            for key in ('cwd', 'exe'):
                try:
                    refs |= extract_refs(os.readlink(proc / key), root)
                except FileNotFoundError:
                    pass
            for key in ('cmdline', 'environ'):
                try:
                    with (proc / key).open('rb') as stream:
                        raw = stream.read(1024 * 1024 + 1)
                    if len(raw) > 1024 * 1024:
                        raise Unsafe('process metadata exceeds scan budget')
                    refs |= extract_refs(raw.replace(b'\0', b'\n').decode(errors='replace'), root)
                except FileNotFoundError:
                    pass
            try:
                for fd in (proc / 'fd').iterdir():
                    budget.tick()
                    try:
                        refs |= extract_refs(os.readlink(fd), root)
                    except FileNotFoundError:
                        pass
            except FileNotFoundError:
                pass
            try:
                with (proc / 'maps').open() as stream:
                    for line in stream:
                        budget.tick()
                        refs |= extract_refs(line, root)
            except (FileNotFoundError, ProcessLookupError):
                pass
        except (FileNotFoundError, ProcessLookupError):
            continue
        except PermissionError as error:
            raise Unsafe('cannot inspect active process consumers') from error
    return refs


def retained_refs(budget, root=ROOT):
    refs = set()
    # Service configuration and regression fixtures may refer to idle artifacts.
    for base in (Path('/etc/systemd/system'), Path('/etc/nginx'), Path('/etc/cron.d'),
                 REPO / 'scripts', REPO / 'taiko_viewer/tests'):
        for current, dirs, files in os.walk(base, followlinks=False):
            dirs[:] = [d for d in dirs if d not in PRUNE | GENERATED and not (Path(current) / d).is_symlink()]
            for name in files:
                budget.tick()
                path = Path(current) / name
                if path.is_symlink():
                    refs.add(path.resolve())
                elif path.is_file() and path.stat().st_size <= 256 * 1024 and path.suffix not in {'.png', '.jpg', '.webp', '.woff2', '.svg'}:
                    with path.open(errors='replace') as stream:
                        refs |= extract_refs(stream.read(256 * 1024 + 1), root)
    # Stable scratch-container names in launcher code do not pin every old job.
    refs -= {root / name for name in ('taiko-build', 'taiko-development', 'taiko-bounded-qa')}
    return refs | symlink_refs(budget, (root, Path('/home/sigaer/taiko')), root)


def symlink_refs(budget, bases, root=ROOT):
    refs = set()
    # Retained source symlinks can consume another tree's generated artifacts.
    # Stream directory entries using their d_type: regular source files need no
    # lstat/read. Count directory opens and link resolutions in the metadata
    # budget; the wall deadline also bounds enumeration of ordinary files.
    for base in bases:
        stack = [(base, 0)]
        while stack:
            here, depth = stack.pop()
            budget.tick()
            with os.scandir(here) as entries:
                for entry in entries:
                    if time.monotonic() > budget.deadline:
                        raise Unsafe('symlink discovery deadline exceeded')
                    if entry.is_symlink():
                        budget.tick()
                        target = Path(entry.path).resolve()
                        if within(target, root):
                            refs.add(target)
                    elif depth < 7 and entry.name not in PRUNE | GENERATED and entry.is_dir(follow_symlinks=False):
                        stack.append((Path(entry.path), depth + 1))
    return refs


def referenced(path, refs):
    # A root referenced by a unit/fixture or an active process retains its subtree.
    return any(within(path, ref) or within(ref, path) for ref in refs)


def remove(item, root, now, budget, refs, protected):
    path = Path(item['path'])
    if path == root or not within(path, root):
        raise Unsafe('cleanup escaped /var/tmp')
    if referenced(path, refs) or any(within(path, p) or within(p, path) for p in protected):
        raise Unsafe('consumer appeared before deletion')
    current, latest, allocated, signature = tree_info(path, budget)
    if (current.st_dev, current.st_ino) != (item['dev'], item['ino']):
        raise Unsafe('cleanup inode changed')
    if signature != item['signature'] or latest != item['latest'] or latest > now - item['ageSeconds']:
        raise Unsafe('artifact changed after discovery')
    if stat.S_ISDIR(current.st_mode):
        shutil.rmtree(path)
    elif stat.S_ISREG(current.st_mode):
        path.unlink()
    else:
        raise Unsafe('unsupported cleanup target')
    return allocated


def run(root, apply=False, protected=PROTECTED, budget=None):
    budget = budget or Budget()
    root_info = identity(root)
    if root != ROOT:
        raise Unsafe('CLI cleanup root is fixed to /var/tmp')
    if not stat.S_ISDIR(root_info.st_mode):
        raise Unsafe('invalid /var/tmp root')
    now = time.time()
    items = candidates(root, now, budget, protected)
    refs = process_refs(budget) | retained_refs(budget)
    selected = [item for item in items if not referenced(Path(item['path']), refs)]
    report = {'schema': 1, 'at': now, 'mode': 'apply' if apply else 'dry-run',
              'candidates': len(items), 'retainedByReference': len(items) - len(selected),
              'removed': [], 'selected': selected, 'allocatedBytesRemoved': 0}
    report['status'] = 'PASS'
    if apply:
        # Re-read live consumers after discovery, before any mutation.
        refs |= process_refs(budget)
        for item in selected:
            if referenced(Path(item['path']), refs):
                report['retainedByReference'] += 1
                continue
            try:
                report['allocatedBytesRemoved'] += remove(item, root, now, budget, refs, protected)
                report['removed'].append(item['path'])
            except (Unsafe, OSError) as error:
                report.update(status='FAILED', errorType=type(error).__name__)
                break
    report['entriesInspected'] = budget.entries
    return report


def save_report(report):
    REPORT.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    if REPORT.parent.resolve() != REPORT.parent or REPORT.parent.stat().st_uid != 0:
        raise Unsafe('unsafe report directory')
    descriptor, name = tempfile.mkstemp(prefix='last-', suffix='.next', dir=REPORT.parent)
    temporary = Path(name)
    try:
        with os.fdopen(descriptor, 'w') as stream:
            json.dump(report, stream, ensure_ascii=False, indent=2)
            stream.write('\n')
        os.replace(temporary, REPORT)
    finally:
        if temporary.exists():
            temporary.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    if not shutil.rmtree.avoids_symlink_attacks:
        raise Unsafe('fd-safe removal is required')
    descriptor = os.open(LOCK, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, 'a') as lock:
        info = os.fstat(lock.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_nlink != 1:
            raise Unsafe('unsafe maintenance lock')
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print(json.dumps({'status': 'SKIPPED', 'reason': 'maintenance lock busy'}))
            return 0
        try:
            report = run(ROOT, apply=args.apply)
        except (Unsafe, OSError) as error:
            report = {'status': 'FAILED', 'mode': 'apply' if args.apply else 'dry-run',
                      'at': time.time(), 'removed': [], 'errorType': type(error).__name__,
                      'retainedByReference': 0, 'allocatedBytesRemoved': 0}
        save_report(report)
        print(json.dumps({'status': report['status'], 'mode': report['mode'], 'removed': len(report['removed']),
                          'retainedByReference': report['retainedByReference'],
                          'allocatedBytesRemoved': report['allocatedBytesRemoved']}))
        return int(report['status'] != 'PASS')


if __name__ == '__main__':
    raise SystemExit(main())
