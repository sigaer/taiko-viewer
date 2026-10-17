#!/usr/bin/env python3
"""Generate R1 conflict ledger and exact role wheel locks; bounded QA wrapper required."""
import email
import hashlib
import json
from pathlib import Path
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[2]
AUDIT = ROOT / 'docs/platform-architecture-audit'
REPOS = {'viewer': '/home/sigaer/taiko/taiko-forum', 'taiko': '/home/sigaer/taiko-bot', 'sakura': '/home/sigaer/git/Sakura_bot'}
CANDIDATES = {'viewer': '6331aea', 'taiko': '15722e8', 'sakura': '38298af'}


def git(repo, *args):
    result = subprocess.run(['git', '-C', str(repo), *args], capture_output=True, timeout=30, check=True)
    if len(result.stdout) > 16 * 1024**2:
        raise RuntimeError('git inventory output exceeds bound')
    return result.stdout


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for data in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(data)
    return value.hexdigest()


def canonical(value):
    return re.sub(r'[-_.]+', '-', value).lower()


def trees(repo, revision):
    result = {}
    for record in git(repo, 'ls-tree', '-rz', revision).split(b'\0'):
        if record:
            meta, path = record.split(b'\t', 1)
            result[path.decode()] = meta.split()[2].decode()
    return result


def main():
    ledger = {'schemaVersion': 1, 'date': '2026-10-16', 'status': 'FROZEN_FOR_INCREMENTAL_PORT_ONLY',
              'readinessBase': git(ROOT, 'rev-parse', 'HEAD').decode().strip(), 'repositories': {},
              'policy': 'No merge, cherry-pick, reset, deployment or active-worktree mutation. Decisions authorize only scoped readiness edits; deferred paths remain unchanged.'}
    port_markers = ('annual-summary/', '/charts.ts', '/progress.ts', '/my-don.ts', 'growth-history/model-revision.ts',
                    '/taiko-artifact.', '/taiko-python.ts', '/annual_python_worker.py', '/taikoFingerprint.test.', '/annualWheelWorker.test.')
    for name, repo in REPOS.items():
        active = git(repo, 'rev-parse', 'HEAD').decode().strip()
        candidate = git(repo, 'rev-parse', CANDIDATES[name]).decode().strip()
        base = git(repo, 'merge-base', active, candidate).decode().strip()
        left = set(filter(None, git(repo, 'diff', '--name-only', '-z', base, active).decode().split('\0')))
        right = set(filter(None, git(repo, 'diff', '--name-only', '-z', base, candidate).decode().split('\0')))
        old, current, proposed = (trees(repo, rev) for rev in (base, active, candidate))
        entries = []
        for path in sorted(left | right):
            decision, reason = 'RETAIN_ACTIVE', 'Active-branch change is preserved; historical candidate is not an integration base.'
            review = 'scope_decision'
            if path in right:
                if current.get(path) == proposed.get(path):
                    decision, reason = 'ALREADY_EQUIVALENT', 'Active and candidate Git object identities match.'
                elif name == 'viewer' and any(marker in path for marker in port_markers):
                    decision, reason = 'PORT_CALLSITE_ONLY', 'Port installed module/interpreter/fingerprint changes manually; preserve active authorization, publication and worker admission semantics.'
                elif name == 'viewer' and path.endswith(('personal.ts', 'taiko-center.ts')):
                    decision, reason = 'RETAIN_ACTIVE_ADAPT_NEW_MODULE', 'Active code split personal compute and removed inline credential controls; modify current python-compute/typed callsites only, never restore historical file.'
                elif name == 'taiko':
                    decision, reason = 'CONSUME_PINNED_WHEEL_ONLY', 'Use the 15722e8/0.14.1 artifact as a separate role package; no source-copy into Viewer or change to active Taiko worktree.'
                elif name == 'sakura':
                    decision, reason = 'DEFER_CUTOVER_RETAIN_ACTIVE', 'Historical ownership retirement is not a live host cutover; preserve active dojo/host changes pending separate runtime and resource review.'
                    review = 'semantic_cutover_deferred'
                else:
                    decision, reason = 'REFERENCE_ONLY_RETAIN_ACTIVE', 'Version/generated output/smoke/deployment/document changes are not automatically portable; use as evidence and keep the active file unless separately reviewed.'
            entries.append({'path': path, 'activeChanged': path in left, 'candidateChanged': path in right,
                            'overlap': path in left and path in right, 'baseBlob': old.get(path), 'activeBlob': current.get(path),
                            'candidateBlob': proposed.get(path), 'decision': decision, 'reason': reason, 'review': review})
        ledger['repositories'][name] = {'head': active, 'branch': git(repo, 'branch', '--show-current').decode().strip(),
            'dirty': git(repo, 'status', '--porcelain=v1').decode().splitlines(), 'candidate': candidate, 'mergeBase': base,
            'divergence': [int(n) for n in git(repo, 'rev-list', '--left-right', '--count', active + '...' + candidate).split()],
            'files': entries}
    (AUDIT / 'conflict-ledger.json').write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + '\n')
    evidence_path = AUDIT / 'evidence/fresh-runtime-proxy-retry-20261016.json'
    evidence = json.loads(evidence_path.read_text())
    workspace = Path(evidence['workspace'])
    locks = {'schemaVersion': 1, 'sourceEvidence': 'evidence/fresh-runtime-proxy-retry-20261016.json',
             'sourceEvidenceSha256': digest(evidence_path), 'roles': {},
             'productionInterpreter': None, 'limitation': 'Absolute artifact paths locate QA material only; deploy must provision these digests to a reviewed durable artifact store.'}
    lockdir = AUDIT / 'runtime-locks'
    lockdir.mkdir(exist_ok=True)
    for role in ('center', 'client'):
        available = {}
        for path in sorted((workspace / (role + '-wheels')).glob('*.whl')) + sorted(Path('/usr/lib/python3.11/ensurepip/_bundled').glob('*.whl')):
            with zipfile.ZipFile(path) as archive:
                names = [name for name in archive.namelist() if name.endswith('.dist-info/METADATA')]
                if len(names) != 1 or archive.getinfo(names[0]).file_size > 1_000_000:
                    raise RuntimeError('wheel metadata exceeds bound')
                metadata = email.message_from_bytes(archive.read(names[0]))
                if any('@' in value or '://' in value for value in metadata.get_all('Requires-Dist', [])):
                    raise RuntimeError('direct wheel dependency forbidden')
            available[(canonical(metadata['Name']), metadata['Version'])] = path
        installed = sorted((canonical(p['name']), p['version']) for p in evidence['roles'][role]['installedOrigin']['dependencies'])
        wheels = []
        lines = ['# Exact observed role environment; no index, no source builds, no editable installs.']
        for name, version in installed:
            path = available.get((name, version))
            if path is None:
                raise RuntimeError('required installed distribution has no local wheel: ' + name)
            hashed = digest(path)
            lines.append(f'{name}=={version} --hash=sha256:{hashed}')
            wheels.append({'name': name, 'version': version, 'file': str(path), 'sha256': hashed})
        target = lockdir / (role + '.requirements.txt')
        target.write_text('\n'.join(lines) + '\n')
        locks['roles'][role] = {'coreVersion': '0.1.1' if role == 'center' else '0.1.2',
            'requirements': 'runtime-locks/' + target.name, 'requirementsSha256': digest(target),
            'environmentIdentity': 'sha256:' + digest(target), 'wheels': wheels,
            'qaInterpreter': evidence['roles'][role]['installedOrigin']['interpreter'], 'productionInterpreter': None,
            'rebuildEvidence': None}
    (AUDIT / 'runtime-role-locks.json').write_text(json.dumps(locks, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'ledgerFiles': {name: len(value['files']) for name, value in ledger['repositories'].items()},
                      'lockedDistributions': {role: len(value['wheels']) for role, value in locks['roles'].items()}}))

if __name__ == '__main__':
    main()
