#!/usr/bin/env python3
"""Bounded offline inventory; launch via scripts/memory/run_qa.sh.
Reads Git, public source, wheel metadata and previous QA logs only. No imports
from application packages, network, SQL, service changes or private runtime roots.
"""
import argparse
import email
import hashlib
import json
import re
import subprocess
import zipfile
from datetime import datetime, timezone
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
        'taiko_viewer/server/infrastructure/account/merged-read-worker.ts',
        'taiko_viewer/server/utils/taiko-python.ts',
        'taiko_viewer/server/utils/taiko-artifact.ts',
        'taiko_viewer/scripts/taiko-artifact.mjs',
        'taiko_viewer/scripts/annual_python_worker.py',
        'taiko_viewer/server/services/account/python-compute.ts',
        'taiko_viewer/server/services/account/charts.ts',
        'taiko_viewer/server/services/account/progress.ts',
        'taiko_viewer/server/services/account/annual-summary/bot.ts',
        'taiko_viewer/server/services/account/annual-summary/runtime.ts',
        'taiko_viewer/server/services/account/annual-summary/isolated-worker.ts',
        'taiko_viewer/server/services/growth-history/model-revision.ts',
        'taiko_viewer/server/services/growth-history/evidence.ts',
        'taiko_viewer/utils/dailyProgress.ts',
        'taiko_viewer/utils/growthHistory.ts',
        'taiko_viewer/server/services/account/annual-summary/constants.ts',
        'taiko_viewer/server/utils/account/my-don.ts',
        'taiko_viewer/server/infrastructure/account/sync-worker-runner.ts',
        'taiko_viewer/server/infrastructure/account/source-mutation-worker-runner.ts',
        'taiko_viewer/server/infrastructure/account/qq-migration-worker-runner.ts',
        'taiko_viewer/server/infrastructure/account/hiroba-credential-worker-runner.ts',
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
    role_lock = args.output.parent / 'runtime-role-locks.json'
    conflict = args.output.parent / 'conflict-ledger.json'
    lock_data = json.loads(role_lock.read_text()) if role_lock.is_file() and role_lock.stat().st_size < 1_000_000 else None
    report.update({
        'viewerCommit': report['observedReadinessCheckout']['head'],
        'taikoCommit': report['repositories']['taiko']['candidate'],
        'sakuraCommit': report['repositories']['sakura']['localMain'],
        'wheelDigest': report['artifacts']['candidateWheel']['sha256'],
        'dependenciesDigest': ({role: value['requirementsSha256'] for role, value in lock_data['roles'].items()} if lock_data else None),
        'contractDigest': digest(checkout / 'packages/sakura-taiko-contract/schema/contract-v1.json') if (checkout / 'packages/sakura-taiko-contract/schema/contract-v1.json').is_file() else None,
        'coreRoleVersion': {'center': '0.1.1', 'client': '0.1.2'},
        'catalogRevision': None,
        'workerProtocol': {'publication': {'module': 'taiko_store.bridge', 'schema': 1},
                           'mergedRead': {'module': 'taiko_bot.cli.merged_read_cli', 'schema': 1, 'currentConsumerAcceptance': None},
                           'annual': {'module': 'taiko_bot.offline.annual_summary', 'currentConsumerAcceptance': None}},
        'rollbackTarget': {'productionCommit': None, 'productionInterpreter': None, 'databaseRestorePoint': None,
                           'preservedViewerActiveMain': report['repositories']['viewer']['localMain'],
                           'policy': 'No production cutover occurred. Retain active main and prior immutable artifacts; deployment/DB restoration instructions require verified production state before authorization.'},
        'verifiedAt': datetime.now(timezone.utc).isoformat(),
        'verificationScope': 'Local ref/artifact inventory, exact role rebuild evidence when available; not production or full runtime acceptance.',
    })
    for protocol, logfile, expected, scope in (
        ('mergedRead', Path('/var/tmp/viewer0822-consumers-center-final.log'), 17,
         '3 installed consumer tests plus 14 Publication tests; source vectors/history, failure/lease and restore behavior. Not all production Writers.'),
        ('annual', Path('/var/tmp/viewer0822-annual-retry.log'), 9,
         'Installed generator ratings/build, poisoned import path, missing-module/deadline/isolation cleanup and fingerprint regression; not complete authenticated Web/report lifecycle.'),
    ):
        if logfile.is_file() and logfile.stat().st_size < 1_000_000:
            summary = logfile.read_text(errors='replace')
            passed = re.search(r'\bpass (\d+)', summary)
            failed = re.search(r'\bfail (\d+)', summary)
            report['workerProtocol'][protocol]['currentConsumerAcceptance'] = {
                'status': 'PASS_SCOPED' if passed and int(passed[1]) == expected and failed and int(failed[1]) == 0 else 'REVIEW_LOG_RESULT',
                'scope': scope, 'evidencePath': str(logfile), 'sha256': digest(logfile),
                'passed': int(passed[1]) if passed else None, 'failed': int(failed[1]) if failed else None,
            }
    report['workerProtocol']['privateWorkers'] = {
        'status': 'PASS_SCOPED_INSTALLED_CENTER',
        'modules': ['taiko_bot.cli.account_sync_cli', 'taiko_bot.cli.source_mutation_cli', 'taiko_bot.cli.qq_migration_cli', 'taiko_bot.cli.hiroba_credential_cli'],
        'evidence': 'evidence/r4-workers-20261016.json',
        'scope': 'Four Viewer consumers migrated to absolute interpreter and isolated installed CLIs; 119 isolated SQL and 30 transport tests. Live activation and all service/reader paths remain unaccepted.'}
    if lock_data:
        report['roleEnvironmentIdentity'] = {role: value['environmentIdentity'] for role, value in lock_data['roles'].items()}
        report['artifacts']['roleLocks'] = {'file': 'runtime-role-locks.json', 'sha256': digest(role_lock)}
    if conflict.is_file():
        report['artifacts']['conflictLedger'] = {'file': 'conflict-ledger.json', 'sha256': digest(conflict)}
    for role in ('center', 'client'):
        rebuild = args.output.parent / f'evidence/r1-rebuild-{role}-20261016.json'
        if rebuild.is_file() and rebuild.stat().st_size < 1_000_000:
            evidence = json.loads(rebuild.read_text())
            report['artifacts'][f'exactRebuild{role.title()}'] = {
                'file': f'evidence/{rebuild.name}', 'sha256': digest(rebuild), 'status': evidence['status'],
                'environmentIdentity': evidence['environmentIdentity'],
                'durationSeconds': evidence.get('durationSeconds'),
            }
    support_locks = args.output.parent / 'runtime-role-locks-with-memory.json'
    support_package = args.output.parent / 'evidence/runtime-memory-package-20261016.json'
    if support_locks.is_file() and support_locks.stat().st_size < 1_000_000:
        supplement = json.loads(support_locks.read_text())
        report['supplementalDependenciesDigest'] = {role: value['requirementsSha256'] for role, value in supplement['roles'].items()}
        report['historicalRoleEnvironmentIdentity'] = report.get('roleEnvironmentIdentity')
        report['roleEnvironmentIdentity'] = {role: value['environmentIdentity'] for role, value in supplement['roles'].items()}
        report['baseDependenciesDigest'] = report['dependenciesDigest']
        report['dependenciesDigest'] = report['supplementalDependenciesDigest']
        report['activeEnvironmentScope'] = '94-distribution candidate adds the independently packaged Sakura shared runtime_memory support; 93-distribution installs remain historical PASS but did not cover the image/runtime dependency closure.'
        report['artifacts']['supplementalRoleLocks'] = {'file': support_locks.name, 'sha256': digest(support_locks),
            'scope': '94-distribution business QA candidate; preserves original 93-distribution role acceptance.'}
    if support_package.is_file() and support_package.stat().st_size < 1_000_000:
        evidence = json.loads(support_package.read_text())
        report['artifacts']['sharedMemoryPackage'] = {'file': 'evidence/' + support_package.name,
            'sha256': digest(support_package), 'status': evidence['status'], 'sourceCommit': evidence['sourceCommit'],
            'wheelDigest': evidence['wheel']['sha256'], 'owner': evidence['owner'], 'upstreamReleaseClaim': False}
    for role in ('center', 'client'):
        rebuilt = args.output.parent / f'evidence/r1-rebuild-{role}-with-memory-20261016.json'
        if rebuilt.is_file() and rebuilt.stat().st_size < 1_000_000:
            evidence = json.loads(rebuilt.read_text())
            report['artifacts'][f'supplementalRebuild{role.title()}'] = {
                'file': 'evidence/' + rebuilt.name, 'sha256': digest(rebuilt), 'status': evidence['status'],
                'environmentIdentity': evidence['environmentIdentity'], 'durationSeconds': evidence.get('durationSeconds')}
    for role in ('center', 'client'):
        integration = args.output.parent / f'evidence/r2-{role}-integration-94-20261016.json'
        if integration.is_file() and integration.stat().st_size < 1_000_000:
            evidence = json.loads(integration.read_text())
            report['artifacts'][f'runtimeIntegration{role.title()}'] = {
                'file': 'evidence/' + integration.name, 'sha256': digest(integration), 'status': evidence.get('status'),
                'scope': 'Recorded 94-distribution role-specific consumer checks only; full R2 and four source compatibility worker cutovers remain unaccepted.'}
        public_log = Path(f'/var/tmp/viewer0822-{role}-public.log')
        if public_log.is_file() and public_log.stat().st_size < 1_000_000:
            content = public_log.read_text(errors='replace')
            report['artifacts'][f'priorPublicDispatch{role.title()}'] = {
                'file': str(public_log), 'sha256': digest(public_log),
                'status': 'PASS_SCOPED' if re.search(r'\b18 PASS; public and player matcher ownership', content) else 'REVIEW_LOG_RESULT',
                'distributionCount': 93, 'scope': '18 real installed public/player dispatch cases on synthetic OneBot/QQ transports; not a complete image/support or account lifecycle closure.'}
    for label, filename in (('imageCallsiteInitialFailure', 'installed-viewer-images-20261016.json'),
                            ('imageCallsiteSupplementalRetry', 'installed-viewer-images-retry-20261016.json')):
        path = args.output.parent / 'evidence' / filename
        if path.is_file() and path.stat().st_size < 1_000_000:
            evidence = json.loads(path.read_text())
            report['artifacts'][label] = {'file': 'evidence/' + filename, 'sha256': digest(path), 'status': evidence.get('status'),
                'scope': evidence.get('scope'), 'imageCases': evidence.get('imageCases'),
                'limitation': 'Original missing-support failure retained; the 94-package retry verifies synthetic callsite parity, not frozen legacy algorithm equivalence.'}
    for role, filename in (('center', 'r2-center-lifecycle-94-20261016.json'),
                           ('client', 'r2-client-lifecycle-retry-94-20261016.json')):
        path = args.output.parent / 'evidence' / filename
        if path.is_file() and path.stat().st_size < 1_000_000:
            evidence = json.loads(path.read_text())
            report['artifacts'][f'representativeLifecycle{role.title()}'] = {
                'file': 'evidence/' + filename, 'sha256': digest(path), 'status': evidence.get('status'),
                'scope': 'Installed representative role lifecycle with exact test-helper whitelist and frozen source oracle; previous setup failure is retained separately. No production lifecycle claim.'}
    merged_sql = args.output.parent / 'evidence/merged-sql-installed-20261016.json'
    if merged_sql.is_file() and merged_sql.stat().st_size < 1_000_000:
        evidence = json.loads(merged_sql.read_text())
        report['artifacts']['mergedSqlInstalled'] = {
            'file': 'evidence/' + merged_sql.name, 'sha256': digest(merged_sql),
            'status': evidence.get('status'), 'tests': evidence.get('tests'),
            'scope': evidence.get('scope'), 'isolation': evidence.get('isolation')}
    auth_matrix = args.output.parent / 'api-auth-matrix.json'
    if auth_matrix.is_file() and auth_matrix.stat().st_size < 1_000_000:
        evidence = json.loads(auth_matrix.read_text())
        credential_probe = next((item for value in evidence.values() if isinstance(value, list)
                                 for item in value if isinstance(item, dict)
                                 and item.get('id') == 'credential-control-plane-negative-20261016'), None)
        report['artifacts']['apiAuthMatrix'] = {
            'file': auth_matrix.name, 'sha256': digest(auth_matrix),
            'status': evidence.get('overallApiGate'), 'credentialControlPlaneNegativeProbe': credential_probe,
            'scope': 'P0 credential-control-plane failure blocks affected integration/deployment; isolated runtime passes do not override this result. Production reachability is unverified.'}
    candidate = args.output.parent / 'evidence/candidate-0142-closeout-20261016.json'
    if candidate.is_file():
        evidence = json.loads(candidate.read_text())
        report['activeLocalCandidate'] = {
            'version': '0.14.2', 'authorization': 'Owner approved local candidate validation only',
            'evidence': 'evidence/' + candidate.name, 'sha256': digest(candidate),
            'status': evidence['status'], 'wheel': evidence['wheel'], 'roles': evidence['roles'],
            'lockManifest': 'runtime-role-locks-0142.json',
            'priorArtifactRecords': 'Historical 0.14.1 records above are retained, not current candidate proof',
            'overallGate': 'BLOCKED', 'limitations': evidence['limitations']}
        report['historicalGatesBeforeCloseout'] = report['gates']
        gate = json.loads((args.output.parent / 'viewer082-gate.json').read_text())
        report['gates'] = {item['name']: item['status'] for item in gate['gates']}
        report['activeLocalCandidate']['repositories'] = {
            name: {'path': str(path), 'head': git(path, 'rev-parse', 'HEAD'),
                   'tree': git(path, 'rev-parse', 'HEAD^{tree}'),
                   'status': git(path, 'status', '--short')}
            for name, path in {
                'viewer': checkout,
                'taiko': Path('/var/tmp/taiko-082-closeout-20261016'),
                'sakura': Path('/var/tmp/sakura-credential-control-plane-20261016')
            }.items()}
    report['evidencePaths'] = sorted({value['file'] for value in report['artifacts'].values()
                                     if isinstance(value, dict) and isinstance(value.get('file'), str)} |
                                    {value['currentConsumerAcceptance']['evidencePath'] for value in report['workerProtocol'].values()
                                     if isinstance(value, dict) and isinstance(value.get('currentConsumerAcceptance'), dict)})
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'status': report['status'], 'output': str(args.output),
                      'repositories': {name: value['relationship'] for name, value in report['repositories'].items()}}))

if __name__ == '__main__':
    main()
