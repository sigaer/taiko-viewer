#!/usr/bin/env python3
"""Serial bounded frozen PNG checks; run through the existing memory QA wrapper."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import tempfile
import time

def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(65536), b''):
            value.update(chunk)
    return value.hexdigest()

def workspace_bytes(path):
    total = 0
    def onerror(error):
        if not isinstance(error, FileNotFoundError):
            raise error
    for base, _directories, files in os.walk(path, onerror=onerror, followlinks=False):
        for name in files:
            try:
                total += (Path(base) / name).lstat().st_size
            except FileNotFoundError:
                pass
    return total

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--python', required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--family', choices=('b30', 'progress', 'personal', 'trend', 'recommendation'), action='append')
args = parser.parse_args()
assert Path(args.python).is_absolute() and not args.output.exists()
workspace = Path(tempfile.mkdtemp(prefix='viewer-r4-images-', dir='/var/tmp'))
launcher = Path(__file__).resolve().with_name('run-installed-image-golden.py')
report = {'status': 'RUNNING', 'workspace': str(workspace), 'interpreter': args.python,
          'productionAccess': False, 'runs': [], 'memoryPeak': 'UNAVAILABLE',
          'scope': 'Synthetic frozen PNG parity; original 94 center lock unchanged, no production/private assets.'}
start = time.monotonic()
try:
    for family in args.family or ('b30', 'progress', 'personal', 'trend', 'recommendation'):
        log = workspace / (family + '.log')
        env = {'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8', 'TMPDIR': str(workspace), 'MPLCONFIGDIR': str(workspace / 'mpl'),
               'TAIKO_RUNTIME_ENV_FILE': str(workspace / 'absent.env')}
        began = time.monotonic()
        with log.open('wb') as stream:
            child = subprocess.Popen([args.python, '-I', str(launcher), '--family', family, '--work', str(workspace / family)],
                                     cwd=workspace, env=env, stdout=stream, stderr=stream, start_new_session=True)
            reason = None
            try:
                while child.poll() is None:
                    if time.monotonic() - began > 180:
                        reason = 'TIME_LIMIT_180S'
                    elif log.stat().st_size > 1024 * 1024:
                        reason = 'LOG_LIMIT_1MIB'
                    elif workspace_bytes(workspace) > 1024 * 1024 * 1024:
                        reason = 'WORKSPACE_LIMIT_1GIB'
                    if reason:
                        os.killpg(child.pid, signal.SIGKILL)
                        break
                    time.sleep(0.2)
                code = child.wait(timeout=5)
            finally:
                if child.poll() is None:
                    os.killpg(child.pid, signal.SIGKILL)
                    child.wait(timeout=5)
        item = {'family': family, 'exitCode': code, 'reason': reason, 'durationSeconds': round(time.monotonic()-began, 3),
                'log': str(log), 'logSha256': digest(log)}
        evidence = workspace / family / 'image-golden-evidence.json'
        if evidence.is_file() and evidence.stat().st_size <= 2 * 1024 * 1024:
            item['evidence'] = json.loads(evidence.read_text())
        report['runs'].append(item)
        print(json.dumps({'family': family, 'exitCode': code, 'reason': reason}), flush=True)
    report['status'] = 'PASS_SYNTHETIC_FROZEN_PNG_PARITY' if all(item['exitCode'] == 0 for item in report['runs']) else 'FAIL_FROZEN_PNG_VERIFICATION'
finally:
    report['durationSeconds'] = round(time.monotonic()-start, 3)
    report['cgroup'] = Path('/proc/self/cgroup').read_text().strip()
    cgroup = Path('/sys/fs/cgroup') / report['cgroup'].split('::', 1)[-1].lstrip('/')
    events = cgroup / 'memory.events'
    if events.is_file():
        report['memoryEvents'] = events.read_text()
    peak = cgroup / 'memory.peak'
    if peak.is_file():
        report['memoryPeak'] = peak.read_text().strip()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'status': report['status'], 'output': str(args.output)}))
raise SystemExit(0 if report['status'] == 'PASS_SYNTHETIC_FROZEN_PNG_PARITY' else 1)
