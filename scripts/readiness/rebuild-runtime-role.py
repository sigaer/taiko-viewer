#!/usr/bin/env python3
"""Rebuild one recorded role without network; execute through memory/run_qa.sh."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[2]
AUDIT = ROOT / 'docs/platform-architecture-audit'

def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--role', choices=('center', 'client'), required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--lock-manifest', type=Path, default=AUDIT / 'runtime-role-locks.json')
    args = parser.parse_args()
    if args.output.exists():
        parser.error('evidence output already exists')
    start = time.monotonic()
    lockpath = args.lock_manifest
    locks = json.loads(lockpath.read_text())
    lock = locks['roles'][args.role]
    requirements = AUDIT / lock['requirements']
    if digest(requirements) != lock['requirementsSha256']:
        raise RuntimeError('role requirements digest mismatch')
    for wheel in lock['wheels']:
        if digest(Path(wheel['file'])) != wheel['sha256']:
            raise RuntimeError('role wheel digest mismatch')
    workspace = Path(tempfile.mkdtemp(prefix='taiko-role-rebuild-', dir='/var/tmp'))
    python = workspace / 'venv/bin/python'
    env = {'PATH': '/usr/bin:/bin', 'TMPDIR': str(workspace), 'PIP_CONFIG_FILE': '/dev/null',
           'PIP_NO_INDEX': '1', 'PIP_DISABLE_PIP_VERSION_CHECK': '1', 'PYTHONNOUSERSITE': '1'}
    report = {'role': args.role, 'status': 'FAIL', 'environmentIdentity': lock['environmentIdentity'],
              'lockManifestSha256': digest(lockpath), 'workspace': str(workspace), 'network': 'no-index only-binary require-hashes no-deps',
              'productionAccess': False, 'logs': {}}
    def run(command, label, timeout=180):
        path = workspace / (label + '.log')
        with path.open('w') as output:
            result = subprocess.run([str(arg) for arg in command], cwd=workspace, env=env, stdout=output,
                                    stderr=subprocess.STDOUT, timeout=timeout)
        if path.stat().st_size > 1_000_000:
            raise RuntimeError('rebuild log exceeds bound')
        report['logs'][label] = {'exitCode': result.returncode, 'sha256': digest(path)}
        if result.returncode:
            raise RuntimeError('role rebuild failed at ' + label)
        return path
    try:
        run(['/usr/bin/python3', '-m', 'venv', workspace / 'venv'], 'venv')
        command = [python, '-I', '-m', 'pip', 'install', '--no-index', '--no-cache-dir', '--no-deps', '--require-hashes', '--only-binary=:all:']
        for directory in sorted({str(Path(wheel['file']).parent) for wheel in lock['wheels']}):
            command += ['--find-links', directory]
        command += ['-r', requirements]
        run(command, 'install')
        run([python, '-I', '-m', 'pip', 'check'], 'pip-check')
        probe = '''import importlib.metadata as m, importlib.util, json, pathlib, sys
names=['taiko_store','taiko_bot','taiko_application','sakura_taiko_core','sakura_taiko_contract']
if any(d.metadata['Name']=='python-memory-runtime' for d in m.distributions()): names.append('runtime_memory')
origins={name:importlib.util.find_spec(name).origin for name in names}
assert sys.flags.isolated == 1
assert all(pathlib.Path(path).resolve().is_relative_to(pathlib.Path(sys.prefix).resolve()) for path in origins.values())
print(json.dumps({'interpreter':sys.executable,'origins':origins,'versions':{d.metadata['Name'].lower().replace('_','-'):d.version for d in m.distributions()}}))
'''
        path = run([python, '-I', '-c', probe], 'isolated-origin')
        identity = json.loads(path.read_text())
        expected = {wheel['name']: wheel['version'] for wheel in lock['wheels']}
        if identity['versions'] != expected:
            raise RuntimeError('rebuilt distribution inventory differs from exact role lock')
        report['installed'] = identity
        report['status'] = 'PASS_EXACT_OFFLINE_ROLE_REBUILD'
    finally:
        report['durationSeconds'] = round(time.monotonic() - start, 3)
        report['cgroup'] = Path('/proc/self/cgroup').read_text().strip()
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps({'status': report['status'], 'role': args.role, 'output': str(args.output)}))

if __name__ == '__main__':
    main()
