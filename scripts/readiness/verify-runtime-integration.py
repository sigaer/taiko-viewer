#!/usr/bin/env python3
"""Run inside run_qa.sh, never start another wrapper or alter a role environment.

Each subprocess has a 240s deadline and a streamed 1MiB combined log cap.
Stop at the first failure; exclusive output creation preserves earlier evidence.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import selectors
import signal
import subprocess
import tempfile
import time

REPO = Path(__file__).resolve().parents[2]
NODE = Path('/www/server/nvm/versions/node/v24.13.0/bin/node')
MAX_LOG = 1024 * 1024


def sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as source:
        for chunk in iter(lambda: source.read(65536), b''):
            h.update(chunk)
    return h.hexdigest()


def cgroup_snapshot():
    membership = Path('/proc/self/cgroup').read_text().strip()
    unified = next((line[3:] for line in membership.splitlines() if line.startswith('0::')), None)
    result = {'membership': membership}
    if unified:
        base = Path('/sys/fs/cgroup') / unified.lstrip('/')
        for name in ['memory.events', 'memory.peak', 'memory.current']:
            try:
                result[name] = (base / name).read_text().strip()
            except OSError:
                result[name] = 'UNAVAILABLE'
    return result


def kill_group(pid):
    try:
        os.killpg(pid, signal.SIGKILL)
    except ProcessLookupError:
        pass


def run(command, directory, environment, label, cwd=None):
    start = time.monotonic()
    log = directory / (label + '.log')
    record = {'label': label, 'command': [str(x) for x in command], 'cwd': str(cwd or directory),
              'status': 'FAIL', 'timeoutSeconds': 240, 'maxLogBytes': MAX_LOG, 'log': str(log),
              'cgroupBefore': cgroup_snapshot()}
    process = None
    reason = None
    count = 0
    selector = selectors.DefaultSelector()
    try:
        with log.open('xb') as output:
            process = subprocess.Popen([str(x) for x in command], cwd=cwd or directory, env=environment,
                                       stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                       stderr=subprocess.STDOUT, start_new_session=True)
            selector.register(process.stdout, selectors.EVENT_READ)
            while selector.get_map():
                if time.monotonic() - start > 240:
                    reason = 'TIMEOUT'
                    break
                for key, _ in selector.select(0.2):
                    chunk = os.read(key.fileobj.fileno(), 65536)
                    if not chunk:
                        selector.unregister(key.fileobj)
                        continue
                    remaining = MAX_LOG - count
                    output.write(chunk[:remaining])
                    count += min(len(chunk), remaining)
                    if len(chunk) > remaining:
                        reason = 'LOG_LIMIT'
                        break
                if reason:
                    break
            if reason:
                kill_group(process.pid)
            remaining_time = max(0.1, 240 - (time.monotonic() - start))
            try:
                process.wait(timeout=remaining_time)
            except subprocess.TimeoutExpired:
                reason = 'TIMEOUT'
                kill_group(process.pid)
                process.wait(timeout=5)
            record['exitCode'] = process.returncode
            # A completed test must not leave descendants in its process group.
            try:
                os.killpg(process.pid, 0)
            except ProcessLookupError:
                record['processGroupExited'] = True
            else:
                reason = reason or 'DESCENDANTS_REMAINED'
                kill_group(process.pid)
                record['processGroupExited'] = False
            if not reason and process.returncode == 0:
                record['status'] = 'PASS'
            else:
                record['failure'] = reason or 'NONZERO_EXIT'
    except Exception as error:
        if process is not None:
            kill_group(process.pid)
            process.wait(timeout=5)
        record['failure'] = type(error).__name__
    finally:
        selector.close()
        if process and process.stdout:
            process.stdout.close()
        record['elapsedSeconds'] = round(time.monotonic() - start, 3)
        record['logBytes'] = log.stat().st_size if log.exists() else 0
        record['logSha256'] = sha(log) if log.exists() else None
        record['cgroupAfter'] = cgroup_snapshot()
    return record


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--role', choices=['center', 'client'], required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--rebuild-evidence', type=Path)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument('--lifecycle-only', action='store_true', help='Client representative lifecycle only; retain earlier dispatch evidence.')
    modes.add_argument('--center-lifecycle-only', action='store_true', help='Center representative lifecycle only; retain earlier Viewer consumer evidence.')
    args = parser.parse_args()
    if args.lifecycle_only and args.role != 'client' or args.center_lifecycle_only and args.role != 'center':
        parser.error('lifecycle-only option must match its role')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    # Reserve before any work; never overwrite an older PASS or FAIL record.
    output = args.output.open('x')
    start = time.monotonic()
    workspace = Path(tempfile.mkdtemp(prefix='viewer-runtime-integration-', dir='/var/tmp'))
    report = {'role': args.role, 'status': 'FAIL', 'workspace': str(workspace), 'commands': [],
              'productionAccess': False, 'priorEvidenceOverwritten': False,
              'scope': 'Center real Viewer consumers; client synthetic dispatch and frozen source oracle. No production lifecycle claim.',
              'cgroupBefore': cgroup_snapshot()}
    try:
        assert '/development.slice/development-qa.slice/' in report['cgroupBefore']['membership'], 'run_qa admission required'
        path = args.rebuild_evidence or REPO / f'docs/platform-architecture-audit/evidence/r1-rebuild-{args.role}-with-memory-20261016.json'
        rebuilt = json.loads(path.read_text())
        assert rebuilt['role'] == args.role and rebuilt['status'] == 'PASS_EXACT_OFFLINE_ROLE_REBUILD'
        installed = rebuilt['installed']
        assert len(installed['versions']) == 94 and installed['versions']['python-memory-runtime'] == '1.1.0'
        python = Path(installed['interpreter'])
        assert python.is_absolute() and str(python).startswith('/var/tmp/') and python.is_file()
        report.update(rebuildEvidence=str(path), rebuildEvidenceSha256=sha(path),
                      environmentIdentity=rebuilt['environmentIdentity'], interpreter=str(python))
        environment = {'PATH': '/usr/bin:/bin', 'TMPDIR': str(workspace), 'XDG_CACHE_HOME': str(workspace/'cache'),
                       'NODE_OPTIONS': '--max-old-space-size=1536', 'TAIKO_PYTHON_EXECUTABLE': str(python),
                       'RUNTIME_QA_ROLE': args.role, 'PYTHONNOUSERSITE': '1',
                       'TAIKO_RUNTIME_ENV_FILE': str(workspace/'absent.env'),
                       'MPLCONFIGDIR': str(workspace/'mpl')}
        if args.lifecycle_only or args.center_lifecycle_only:
            commands = [(args.role+'-lifecycle', [python, '-I', REPO/'scripts/readiness/run-installed-lifecycle.py',
                         '--host', args.role, '--work', workspace/'lifecycle'])]
            report['scope'] = 'Only representative installed role lifecycle with explicit hashed test helpers and frozen oracle; earlier consumer/dispatch tests not rerun.'
        elif args.role == 'center':
            files = ['installedRuntimeConsumers.test.mjs', 'installedGrowthRevision.test.mjs',
                     'taikoFingerprint.test.mjs', 'annualWheelWorker.test.mjs', 'crossWriterInstalled.test.ts']
            image_evidence = REPO/'docs/platform-architecture-audit/evidence/installed-viewer-images-retry-20261016.json'
            image = json.loads(image_evidence.read_text())
            assert image['status'] == 'PASS_LIMITED_IMAGE_CALLSITE_PARITY' and image['interpreter'] == str(python)
            assert sha(image['log']) == image['logSha256']
            report['priorIndependentImageEvidence'] = {'file': str(image_evidence), 'sha256': sha(image_evidence), 'rerun': False}
            commands = [(f.split('.')[0], [NODE, '--experimental-transform-types', '--test', '--test-concurrency=1', REPO/'taiko_viewer/tests'/f]) for f in files]
        else:
            candidate = Path('/var/tmp/taiko-final-ownership-20261015/taiko')
            baseline = Path('/var/tmp/taiko-lifecycle-20261015/baseline-client')
            assets = Path('/var/tmp/taiko-phase2fe-20261014/assets')
            assert candidate.is_dir() and baseline.is_dir() and assets.is_dir()
            commands = [
                ('client-delivery', [python, '-I', candidate/'tests/runtime_ownership/delivery_smoke.py', '--host', 'client', '--work', workspace/'delivery', '--assets', assets]),
                ('client-lifecycle', [python, '-I', REPO/'scripts/readiness/run-installed-lifecycle.py', '--host', 'client', '--work', workspace/'lifecycle'])]
            report['clientOracleBoundary'] = 'Frozen baseline source and test fixture helpers only; business imports must resolve installed modules. Shared assets are prior QA public fixtures, no real userdata.'
        report['testSources'] = [{'file': str(part), 'sha256': sha(part)} for _, command in commands for part in command if isinstance(part, Path) and part.suffix in ['.mjs', '.ts', '.py']]
        for label, command in commands:
            record = run(command, workspace, environment, label, REPO/'taiko_viewer' if args.role == 'center' else workspace)
            report['commands'].append(record)
            print(json.dumps({'label': label, 'status': record['status'], 'log': record['log']}), flush=True)
            if record['status'] != 'PASS':
                report['stoppedAfterFailure'] = label
                break
        else:
            report['status'] = 'PASS_LIMITED_SYNTHETIC_RUNTIME_INTEGRATION'
    except Exception as error:
        report['failure'] = type(error).__name__
    finally:
        report['elapsedSeconds'] = round(time.monotonic() - start, 3)
        report['cgroupAfter'] = cgroup_snapshot()
        report['memoryPeakScope'] = 'Whole owning QA cgroup peak, not sum or per-command allocation'
        json.dump(report, output, ensure_ascii=False, indent=2)
        output.write('\n')
        output.close()
        print(json.dumps({'role': args.role, 'status': report['status'], 'output': str(args.output)}), flush=True)
    return 0 if report['status'].startswith('PASS_') else 1


if __name__ == '__main__':
    raise SystemExit(main())
