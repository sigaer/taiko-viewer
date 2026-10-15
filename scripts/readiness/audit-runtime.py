#!/usr/bin/env python3
"""Bounded offline inventory; launch via scripts/memory/run_qa.sh.
Reads Git, public source, wheel metadata and previous QA logs only. No imports
from application packages, network, SQL, service changes or private runtime roots.
"""
import argparse
import email
import hashlib
import json
import subprocess
import zipfile
from pathlib import Path

OLD = Path('/var/tmp/taiko-final-ownership-20261015')
REPOS = {
    'taiko': ('/home/sigaer/taiko-bot', '248713e', '15722e8'),
    'sakura': ('/home/sigaer/git/Sakura_bot', '86b8334', '38298af'),
    'viewer': ('/home/sigaer/taiko/taiko-forum', '777546c', '6331aea'),
}

def git(repo, *args):
    result = subprocess.run(['git', '-C', str(repo), *args], capture_output=True,
                            text=True, timeout=20)
    if result.returncode not in (0, 1):
        raise RuntimeError('git audit failed: ' + args[0])
    if len(result.stdout) > 2_000_000:
        raise RuntimeError('git audit output exceeded bound')
    return result.stdout.strip()


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    report = {
        'schemaVersion': 1, 'auditDate': '2026-10-16',
        'status': 'BLOCKED_NOT_RELEASE_READY',
        'scope': 'local refs and offline artifacts only; remote refs not fetched',
        'repositories': {}, 'artifacts': {},
        'gates': {
            'O1': 'PARTIAL_LOCAL_HOOKS_ONLY', 'O2': 'BLOCKED_FRESH_ROLE_INSTALLS_MISSING',
            'O3': 'FAIL_SOURCE_SWITCH', 'O4': 'NOT_RUN_ISOLATED_AUTH_SQL_E2E',
            'O5': 'BLOCKED_OFF_HOST_BACKUP_AND_RIGHTS_REVIEW',
            'O7': 'BLOCKED_RESTORE_DRILL_AND_LIVE_CONFIG_NOT_AUDITED',
            'O8': 'NOT_RUN_NO_DEPLOYMENT',
        },
        'rollback': {
            'productionInterpreter': None, 'databaseSchemaHash': None,
            'databaseRestoreEvidence': None, 'productionDataHash': None,
            'reason': 'No live configuration, SQL, private data or restore access in this audit.',
            'policy': 'Retain current main and saved historical measurements; do not replace main with old candidate.',
        },
    }
    checkout = Path(__file__).resolve().parents[2]
    readiness_sources = (
        'taiko_viewer/server/infrastructure/taiko-publication/client.ts',
        'taiko_viewer/server/infrastructure/taiko-publication/python.ts',
        'taiko_viewer/server/middleware/private-cache.ts',
        'taiko_viewer/server/utils/cache-policy.ts',
        'taiko_viewer/server/infrastructure/account/private-source-response.ts',
    )
    report['observedReadinessCheckout'] = {
        'branch': git(checkout, 'branch', '--show-current'),
        'head': git(checkout, 'rev-parse', 'HEAD'),
        'sourceHashes': {name: digest(checkout / name) for name in readiness_sources if (checkout / name).is_file()},
        'identityNote': 'This is the current readiness checkout, distinct from historical 6331aea ownership candidate. HEAD is observed before any subsequent documentation commit; source hashes identify the audited implementation. Manifest excludes its own hash to avoid self-reference.',
    }
    for name, (path, base, candidate) in REPOS.items():
        main_sha = git(path, 'rev-parse', 'main')
        candidate_sha = git(path, 'rev-parse', candidate)
        counts = list(map(int, git(path, 'rev-list', '--left-right', '--count',
                                  f'{main_sha}...{candidate_sha}').split()))
        tracked = git(path, 'ls-files', '.github/workflows').splitlines()
        hooks_dir = Path(git(path, 'rev-parse', '--git-path', 'hooks'))
        if not hooks_dir.is_absolute():
            hooks_dir = Path(path) / hooks_dir
        hook_hashes = {}
        if hooks_dir.is_dir():
            for hook in sorted(hooks_dir.iterdir()):
                if hook.is_file() and not hook.name.endswith('.sample'):
                    hook_hashes[hook.name] = digest(hook)
        report['repositories'][name] = {
            'documentedBaseline': git(path, 'rev-parse', base),
            'localMain': main_sha, 'candidate': candidate_sha,
            'mergeBase': git(path, 'merge-base', main_sha, candidate_sha),
            'mainOnlyCommits': counts[0], 'candidateOnlyCommits': counts[1],
            'relationship': 'main_is_candidate_ancestor' if not counts[0] else 'diverged',
            'worktreeStatus': git(path, 'status', '--porcelain').splitlines(),
            'configuredHooksPath': git(path, 'config', '--get', 'core.hooksPath') or None,
            'activeHookHashes': hook_hashes,
            'trackedWorkflows': {p: digest(Path(path) / p) for p in tracked},
            'remoteHooksRulesets': 'UNVERIFIED; local files cannot prove absence',
        }
    wheel = OLD / 'wheels/taiko_bot-0.14.1-py3-none-any.whl'
    with zipfile.ZipFile(wheel) as archive:
        metadata_name = next(n for n in archive.namelist() if n.endswith('.dist-info/METADATA'))
        info = archive.getinfo(metadata_name)
        if info.file_size > 1_000_000:
            raise RuntimeError('wheel metadata exceeds bound')
        metadata = email.message_from_bytes(archive.read(metadata_name))
    report['artifacts']['candidateWheel'] = {
        'file': wheel.name, 'sha256': digest(wheel),
        'name': metadata['Name'], 'version': metadata['Version'],
        'requiresPython': metadata['Requires-Python'],
        'requiresDist': metadata.get_all('Requires-Dist', []),
        'freshCenterInstall': 'NOT_RUN', 'freshClientInstall': 'NOT_RUN',
    }
    dependencies = []
    for metadata_file in sorted((OLD / 'wheel-env/lib/python3.11/site-packages').glob('*.dist-info/METADATA')):
        if metadata_file.stat().st_size > 2_000_000:
            raise RuntimeError('installed metadata exceeds bound')
        metadata = email.message_from_bytes(metadata_file.read_bytes())
        dependencies.append({'name': metadata['Name'], 'version': metadata['Version'],
                             'metadataSha256': digest(metadata_file)})
    serialized = json.dumps(dependencies, sort_keys=True, separators=(',', ':')).encode()
    report['artifacts']['existingEnvironment'] = {
        'interpreter': 'wheel-env/bin/python', 'origin': 'historical candidate QA environment',
        'dependencyInventorySha256': hashlib.sha256(serialized).hexdigest(),
        'dependencies': dependencies,
        'limitation': 'Installed metadata inventory is not a dependency wheel lock or fresh install proof.',
    }
    files = {
        'contract': OLD / 'viewer/packages/sakura-taiko-contract/schema/contract-v1.json',
        'viewerInterpreterSelector': OLD / 'viewer/taiko_viewer/server/utils/taiko-python.ts',
        'growthCompatibility': OLD / 'taiko/taiko_bot/offline/growth-compatibility.dat',
        'syncServiceTemplate': OLD / 'taiko/deploy/services/taiko-sync-dispatch.service',
        'publicServiceTemplate': OLD / 'taiko/deploy/services/taiko-public-api.service',
        'songUpdateServiceTemplate': OLD / 'taiko/deploy/offline/taiko-song-update.service',
        'oldSourceFailureLog': OLD / 'frozen-failure.log',
        'candidateFailureLog': OLD / 'offline-final.log',
        'viewerDeployScript': Path(REPOS['viewer'][0]) / 'scripts/deploy_forum_web.sh',
    }
    report['artifacts']['sourceAndEvidenceHashes'] = {
        key: {'sha256': digest(path), 'file': str(path.relative_to(OLD)) if path.is_relative_to(OLD) else 'scripts/deploy_forum_web.sh'}
        for key, path in files.items() if path.is_file()
    }
    report['knownFailure'] = {
        'test': 'test_source_switch_and_deleted_readded_chart_never_create_cross_epoch_delta',
        'historicalResult': '271 passed, 7 skipped, 1 failed',
        'frozenResult': '1 failed, 36 deselected',
        'newExecution': False,
        'skips': 'Seven historical production-fixture cases; private fixtures not accessed.',
    }
    fresh = args.output.parent / 'evidence/fresh-runtime-20261015.json'
    if fresh.is_file() and fresh.stat().st_size < 1_000_000:
        evidence = json.loads(fresh.read_text())
        report['artifacts']['candidateWheel']['freshCenterInstall'] = 'SEE_FRESH_RUNTIME_EVIDENCE_FULL_ROLE_BLOCKED'
        report['artifacts']['candidateWheel']['freshClientInstall'] = 'SEE_FRESH_RUNTIME_EVIDENCE_FULL_ROLE_BLOCKED'
        report['artifacts']['freshRuntimeEvidence'] = {
            'file': 'evidence/fresh-runtime-20261015.json',
            'sha256': digest(fresh), 'status': evidence['status'],
            'roles': {role: {
                'fullRoleInstall': value['fullRoleInstall'],
                'pipCheck': value.get('pipCheck', 'NOT_RUN'),
                'bridgeSynthetic': value.get('bridgeSynthetic', {'status': 'NOT_RUN'}),
            } for role, value in evidence.get('roles', {}).items()},
        }
        report['gates']['O2'] = 'BLOCKED_FULL_ROLE_LIFECYCLE_NOT_ACCEPTED'
    online = args.output.parent / 'evidence/fresh-runtime-pypi-20261015.json'
    if online.is_file() and online.stat().st_size < 1_000_000:
        evidence = json.loads(online.read_text())
        report['artifacts']['freshRuntimePypiEvidence'] = {
            'file': 'evidence/fresh-runtime-pypi-20261015.json',
            'sha256': digest(online), 'status': evidence['status'],
            'durationSeconds': evidence.get('durationSeconds'),
            'failure': evidence.get('downloadFailure', evidence.get('failureReview', evidence.get('verificationFailure'))),
            'roles': evidence.get('roles', {}),
        }
    proxy = args.output.parent / 'evidence/fresh-runtime-proxy-20261016.json'
    if proxy.is_file() and proxy.stat().st_size < 1_000_000:
        evidence = json.loads(proxy.read_text())
        report['artifacts']['freshRuntimeProxyEvidence'] = {
            'file': 'evidence/fresh-runtime-proxy-20261016.json',
            'sha256': digest(proxy), 'status': evidence['status'],
            'durationSeconds': evidence.get('durationSeconds'),
            'failure': evidence.get('downloadFailure', evidence.get('verificationFailure')),
            'roles': {role: {
                'fullRoleInstall': value.get('fullRoleInstall', 'NOT_COMPLETED'),
                'pipCheck': value.get('pipCheck', 'NOT_RUN'),
                'installedLockSha256': value.get('installedLockSha256'),
                'bridgeSynthetic': value.get('bridgeSynthetic', {'status': 'NOT_RUN'}),
            } for role, value in evidence.get('roles', {}).items()},
            'acceptanceLimit': 'Fresh installation and bridge only; full role lifecycle remains unaccepted.',
        }
        for role, field in (('center', 'freshCenterInstall'), ('client', 'freshClientInstall')):
            value = evidence.get('roles', {}).get(role, {})
            report['artifacts']['candidateWheel'][field] = (
                'FULL_INSTALL_PASS_LIFECYCLE_NOT_ACCEPTED'
                if value.get('fullRoleInstall') == 'PASS' and value.get('pipCheck') == 'PASS'
                else 'SEE_PROXY_EVIDENCE_FULL_ROLE_NOT_ACCEPTED')
        report['gates']['O2'] = 'BLOCKED_FULL_ROLE_LIFECYCLE_NOT_ACCEPTED'
    sql = args.output.parent / 'evidence/isolated-sql-20261016.json'
    if sql.is_file() and sql.stat().st_size < 1_000_000:
        evidence = json.loads(sql.read_text())
        report['artifacts']['isolatedSqlEvidence'] = {
            'file': 'evidence/isolated-sql-20261016.json',
            'sha256': digest(sql), 'status': evidence['status'],
            'passed': sum(run.get('passed', 0) for run in evidence.get('runs', [])),
            'failed': sum(run.get('failed', 0) for run in evidence.get('runs', [])),
            'limitations': evidence.get('limitations', []),
            'acceptanceLimit': 'Scoped authorization/conditionals/proxy SQL only; complete login-to-annual authenticated chain not accepted.',
        }
        report['gates']['O4'] = 'PARTIAL_SQL_EVIDENCE_FULL_AUTH_CHAIN_NOT_ACCEPTED'
    retry = args.output.parent / 'evidence/fresh-runtime-proxy-retry-20261016.json'
    if retry.is_file() and retry.stat().st_size < 1_000_000:
        evidence = json.loads(retry.read_text())
        report['artifacts']['freshRuntimeProxyRetryEvidence'] = {
            'file': 'evidence/fresh-runtime-proxy-retry-20261016.json',
            'sha256': digest(retry), 'status': evidence['status'],
            'durationSeconds': evidence.get('durationSeconds'),
            'failure': evidence.get('downloadFailure', evidence.get('verificationFailure')),
            'roles': {role: {
                'fullRoleInstall': value.get('fullRoleInstall', 'NOT_COMPLETED'),
                'pipCheck': value.get('pipCheck', 'NOT_RUN'),
                'installedLockSha256': value.get('installedLockSha256'),
                'bridgeSynthetic': value.get('bridgeSynthetic', {'status': 'NOT_RUN'}),
            } for role, value in evidence.get('roles', {}).items()},
            'acceptanceLimit': 'Retains prior failed attempts; full role lifecycle remains unaccepted.',
        }
        for role, field in (('center', 'freshCenterInstall'), ('client', 'freshClientInstall')):
            value = evidence.get('roles', {}).get(role, {})
            report['artifacts']['candidateWheel'][field] = (
                'FULL_INSTALL_PASS_LIFECYCLE_NOT_ACCEPTED'
                if value.get('fullRoleInstall') == 'PASS' and value.get('pipCheck') == 'PASS'
                else 'SEE_PROXY_RETRY_EVIDENCE_FULL_ROLE_NOT_ACCEPTED')
        report['gates']['O2'] = 'BLOCKED_FULL_ROLE_LIFECYCLE_NOT_ACCEPTED'
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'status': report['status'], 'output': str(args.output),
                      'repositories': {name: value['relationship'] for name, value in report['repositories'].items()}}))

if __name__ == '__main__':
    main()
