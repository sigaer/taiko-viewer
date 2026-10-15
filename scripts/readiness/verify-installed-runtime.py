#!/usr/bin/env python3
"""Offline fresh-role install attempt and installed stdlib bridge acceptance.
Run only through memory/run_qa.sh. Never copies installed packages or reads data.
"""
import argparse
import email
import zipfile
import hashlib
import json
import os
import signal
from pathlib import Path
import subprocess
import tempfile
import time

WHEEL = Path('/var/tmp/taiko-final-ownership-20261015/wheels/taiko_bot-0.14.1-py3-none-any.whl')
REPORTED_WHEELS = {
    WHEEL.name, 'taiko_application-0.8.0-py3-none-any.whl',
    'sakura_taiko_contract-0.1.0-py3-none-any.whl',
    'sakura_taiko_core-0.1.1-py3-none-any.whl',
    'sakura_taiko_core-0.1.2-py3-none-any.whl',
}
CORE_DIR = Path('/root/.cache/pip/wheels/61/09/6c/14129faa32af31b23f7109aa92313c92d7a50246967700e10b')
PINNED = {
    WHEEL: '4f7c44ae1a0dd78cce3f36d159caba457ec3758eb6c2c43d11fb35480e750529',
    Path('/var/tmp/taiko-player-batch-20261014/wheels/taiko_application-0.8.0-py3-none-any.whl'): 'cccb0c52ddb582823b8ade4550bc8c2cd0f8ac96a99708a38c508647baf60c89',
    Path('/root/.cache/pip/wheels/93/7b/39/0e39047cce6ab999ad32563876df6577791db634811d1c14c1/sakura_taiko_contract-0.1.0-py3-none-any.whl'): '61c63fda6949c6c8c4f84dd63b170482cc127dcf957facad056663bcf6f240d7',
    CORE_DIR / 'sakura_taiko_core-0.1.1-py3-none-any.whl': '76294144080b8816331cfce02b6363749078ab60fb048c1b72767387d989b273',
    CORE_DIR / 'sakura_taiko_core-0.1.2-py3-none-any.whl': 'f34c1d0a3e58f5a7ce232ca50741e3235260eb8dabaedd95b41d84e7d0d0d47f',
}

def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def reject_direct_dependencies(wheel):
    with zipfile.ZipFile(wheel) as archive:
        names = [n for n in archive.namelist() if n.endswith('.dist-info/METADATA')]
        if len(names) != 1 or archive.getinfo(names[0]).file_size > 1_000_000:
            raise RuntimeError('unsafe wheel metadata')
        metadata = email.message_from_bytes(archive.read(names[0]))
        for requirement in metadata.get_all('Requires-Dist', []):
            if '@' in requirement or '://' in requirement:
                raise RuntimeError('resolver rejects direct dependency references')


def main():
    started = time.monotonic()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--online-third-party', action='store_true',
                        help='Allow PyPI binary dependencies, with local Taiko wheels pinned by SHA-256.')
    args = parser.parse_args()
    workspace = Path(tempfile.mkdtemp(prefix='taiko-runtime-fresh-', dir='/var/tmp'))
    env = {'PATH': '/usr/bin:/bin', 'TMPDIR': str(workspace),
           'PIP_CONFIG_FILE': '/dev/null', 'PIP_NO_INDEX': '1',
           'PIP_DISABLE_PIP_VERSION_CHECK': '1', 'PYTHONNOUSERSITE': '1'}
    wheels = sorted(Path('/root/.cache/pip/wheels').glob('*/*/*/*/*.whl'))
    wheels += [WHEEL, Path('/var/tmp/taiko-player-batch-20261014/wheels/taiko_application-0.8.0-py3-none-any.whl')]
    wheels = [path for path in wheels if path.is_file()]
    wheels = sorted({wheel for parent in {p.parent for p in wheels} for wheel in parent.glob('*.whl')})
    if args.online_third_party:
        wheels = list(PINNED)
        for path, expected in PINNED.items():
            if sha(path) != expected:
                raise RuntimeError('pinned local wheel hash mismatch')
    # --no-index alone still permits PEP 508 URL dependencies. Reject every
    # locally eligible wheel's direct references before invoking the resolver.
    for wheel in wheels:
        reject_direct_dependencies(wheel)
    links = sorted({str(path.parent) for path in wheels})
    result = {'schemaVersion': 1, 'status': 'BLOCKED_FULL_ROLE_INSTALL',
              'workspace': str(workspace),
              'network': 'pip no-index/no-build; all eligible wheel direct dependency references rejected; not OS network isolation',
              'offlineWheelHashesScope': 'Taiko candidate and pinned application/contract/core candidates only; not a complete dependency lock',
              'offlineWheelHashes': [{'file': p.name, 'sha256': sha(p)} for p in wheels if p.name in REPORTED_WHEELS],
              'roles': {}}
    if args.online_third_party:
        result['network'] = 'PyPI index binary dependency download only; Taiko/Application/Contract/Core exact local wheels plus hash pins; install from downloaded wheelhouse'
        result['downloadedWheelHashes'] = {}
    def run(command, label, timeout=90, input=None):
        log = workspace / (label + '.log')
        with log.open('w') as output:
            proc = subprocess.run(command, cwd=workspace, env=env, input=input, text=True,
                                  stdout=output, stderr=subprocess.STDOUT, timeout=timeout)
        if log.stat().st_size > 1_000_000:
            raise RuntimeError('bounded runtime evidence log exceeded limit')
        return proc.returncode, log
    def download(command, label):
        log = workspace / (label + '.log')
        started_download = time.monotonic()
        with log.open('w') as output:
            child = subprocess.Popen(command, cwd=workspace, env={**env, 'PIP_NO_INDEX': '0'},
                                     stdout=output, stderr=subprocess.STDOUT, start_new_session=True)
            try:
                while child.poll() is None:
                    total = sum(path.stat().st_size for path in workspace.rglob('*') if path.is_file() and not path.is_symlink())
                    elapsed = time.monotonic() - started_download
                    reason = ('DOWNLOAD_DISK_LIMIT' if total > 1500 * 1024**2 else
                              'DOWNLOAD_LOG_LIMIT' if log.stat().st_size > 1_000_000 else
                              'DOWNLOAD_TIME_LIMIT' if elapsed > 240 else None)
                    if reason:
                        result['downloadFailure'] = {'reason': reason, 'elapsedSeconds': round(elapsed, 3),
                                                     'workspaceBytes': total, 'logBytes': log.stat().st_size,
                                                     'logSha256': sha(log)}
                        raise RuntimeError(reason)
                    time.sleep(1)
                return child.returncode, log
            finally:
                if child.poll() is None:
                    os.killpg(child.pid, signal.SIGKILL)
                child.wait(timeout=10)
    try:
        for role in ('center', 'client'):
            venv = workspace / role
            code, log = run(['/usr/bin/python3', '-m', 'venv', str(venv)], role + '-venv')
            if code:
                raise RuntimeError('fresh venv creation failed')
            python = str(venv / 'bin/python')
            if args.online_third_party:
                core_version = '0.1.1' if role == 'center' else '0.1.2'
                selected = [p for p in PINNED if not p.name.startswith('sakura_taiko_core-') or p.name.startswith('sakura_taiko_core-' + core_version + '-')]
                wheelhouse = workspace / (role + '-wheels')
                wheelhouse.mkdir()
                local_args = [str(p) + ('[' + role + ']' if p == WHEEL else '') for p in selected]
                command = [python, '-I', '-m', 'pip', 'download', '--no-cache-dir', '--only-binary=:all:',
                           '--index-url', 'https://pypi.org/simple', '--retries', '1', '--timeout', '20',
                           '--dest', str(wheelhouse), *local_args]
                code, log = download(command, role + '-resolve')
                result['downloadedWheelHashes'][role] = [{'file': p.name, 'sha256': sha(p)} for p in sorted(wheelhouse.glob('*.whl'))]
                if code == 0:
                    for candidate in wheelhouse.glob('*.whl'):
                        reject_direct_dependencies(candidate)
                    command = [python, '-I', '-m', 'pip', 'install', '--no-index', '--no-cache-dir', '--only-binary=:all:',
                               '--find-links', str(wheelhouse), *local_args]
                    code, log = run(command, role + '-install')
            else:
                command = [python, '-I', '-m', 'pip', 'install', '--no-index', '--no-cache-dir', '--only-binary=:all:']
                for link in links:
                    command += ['--find-links', link]
                command += [str(WHEEL) + '[' + role + ']']
                code, log = run(command, role + '-resolve')
            entry = {'fullRoleInstall': 'PASS' if code == 0 else 'FAIL_OFFLINE_DEPENDENCY_RESOLUTION',
                     'resolverExit': code, 'resolverLogSha256': sha(log), 'resolverLog': str(log)}
            result['roles'][role] = entry
            if args.online_third_party and code:
                entry['fullRoleInstall'] = 'FAIL_PYPI_DEPENDENCY_RESOLUTION_OR_INSTALL'
            if code:
                # Deliberately limited acceptance: bridge has a stdlib-only closure.
                # This never upgrades failed full-role acceptance to PASS.
                code, log = run([python, '-I', '-m', 'pip', 'install', '--no-index', '--no-deps',
                                 '--no-cache-dir', str(WHEEL)], role + '-wheel-only')
                if code:
                    raise RuntimeError('non-editable candidate wheel install failed')
            code, checklog = run([python, '-I', '-m', 'pip', 'check'], role + '-dependency-check')
            entry['pipCheck'] = 'PASS' if code == 0 else 'FAIL_DEPENDENCIES_MISSING'
            entry['pipCheckLogSha256'] = sha(checklog)
            probe = '''import importlib.metadata as m, json, pathlib, sys
import taiko_store.bridge as bridge
p=pathlib.Path(bridge.__file__).resolve()
assert p.is_relative_to(pathlib.Path(sys.prefix).resolve()), 'source import escaped fresh environment'
d=m.distribution('taiko-bot')
direct=json.loads(d.read_text('direct_url.json'))
assert not direct.get('dir_info', {}).get('editable', False), 'editable install forbidden'
print(json.dumps({'version':d.version,'interpreter':sys.executable,'module':str(p),'isolated':sys.flags.isolated,'dependencies':[{'name':x.metadata['Name'],'version':x.version} for x in m.distributions()]}))
'''
            code, log = run([python, '-I', '-c', probe], role + '-origin')
            if code:
                raise RuntimeError('isolated installed module origin failed')
            entry['installedOrigin'] = json.loads(log.read_text())
            assert entry['installedOrigin']['version'] == '0.14.1'
            if args.online_third_party and entry['fullRoleInstall'] == 'PASS':
                installed = {p['name'].lower().replace('_', '-'): p['version'] for p in entry['installedOrigin']['dependencies']}
                assert installed['sakura-taiko-core'] == core_version, 'role core version drift'
                entry['installedLockSha256'] = hashlib.sha256(json.dumps(installed, sort_keys=True).encode()).hexdigest()
            root = workspace / (role + '-synthetic')
            root.mkdir()
            payload = '{"schema":1,"synthetic":true,"score":123}'
            keys = ['current', 'history/data_20261015.json']
            messages = [{'method': 'put', 'key': key, 'body': payload} for key in keys]
            messages += [{'method': 'publish', 'transactionId': 'a' * 32}, {'method': 'finish'}]
            command = [python, '-I', '-m', 'taiko_store.bridge', '--root', str(root),
                       '--identity', 'synthetic', '--mode', 'write', '--lifetime', '15']
            code, log = run(command, role + '-publish', 20, ''.join(json.dumps(m) + '\n' for m in messages))
            responses = [json.loads(line) for line in log.read_text().splitlines()]
            assert code == 0 and responses[0]['ready'] is True, 'bridge write failed'
            view = responses[-2]['view']
            assert view['commitId'] == 'a' * 32 and set(view['files']) == set(keys), 'publication coherence failed'
            command[command.index('write')] = 'read'
            code, log = run(command, role + '-read', 20, '{"method":"finish"}\n')
            read = [json.loads(line) for line in log.read_text().splitlines()]
            assert code == 0 and read[0]['view'] == view, 'read did not retain committed view'
            object_probe = '''import sys
from taiko_store.publication import PublicationStore
s=PublicationStore(sys.argv[1], 'synthetic')
with s.shared():
 v=s.view()
 assert v['commitId']=='a'*32
 for ref in v['files'].values():
  assert s.read_object(ref)==b'{"schema":1,"synthetic":true,"score":123}', 'object bytes mismatch'
print('committed current/history objects match')
'''
            code, log = run([python, '-I', '-c', object_probe, str(root)], role + '-objects')
            assert code == 0, 'committed object read failed'
            command[command.index('read')] = 'read'
            code, log = run(command, role + '-deny-write', 20, json.dumps(messages[0]) + '\n')
            denied = [json.loads(line) for line in log.read_text().splitlines()]
            assert code == 1 and denied[-1]['error'] == 'PUBLICATION_FAILURE', 'read lease accepted mutation'
            entry['bridgeSynthetic'] = {'status': 'PASS', 'currentAndHistorySameCommit': True,
                                        'readLeaseMutationDenied': True, 'isolatedImport': True,
                                        'scope': 'stdlib bridge only; not role lifecycle or SQL acceptance'}
        if all(v['fullRoleInstall'] == 'PASS' and v['pipCheck'] == 'PASS' for v in result['roles'].values()):
            result['status'] = 'PARTIAL_FRESH_INSTALL_AND_BRIDGE_ONLY'
    except Exception as error:
        result['verificationFailure'] = type(error).__name__
        result['status'] = 'FAIL_RUNTIME_VERIFICATION'
        raise
    finally:
        cgroup = Path('/proc/self/cgroup').read_text().strip()
        result['durationSeconds'] = round(time.monotonic() - started, 3)
        result['cgroup'] = cgroup
        group_path = next((line.split(':', 2)[2] for line in cgroup.splitlines() if line.startswith('0::')), None)
        if group_path is not None:
            group_root = Path('/sys/fs/cgroup') / group_path.lstrip('/')
            result['memory'] = {
                name: (group_root / name).read_text().strip() if (group_root / name).is_file() else 'UNAVAILABLE'
                for name in ('memory.peak', 'memory.events')
            }
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps({'status': result['status'], 'output': str(args.output), 'workspace': str(workspace)}))
    if result['status'] == 'BLOCKED_FULL_ROLE_INSTALL':
        raise SystemExit(2)

if __name__ == '__main__':
    main()
