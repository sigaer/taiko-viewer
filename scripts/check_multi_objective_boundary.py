#!/usr/bin/env python3
"""B4-1 bounded documentation/boundary audit and archival of already completed QA."""
import hashlib
import json
import pathlib
import re
import shutil
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
DOCS = ROOT / 'docs/batch4/implementation'
EVIDENCE = DOCS / 'evidence'
BASE = 'a68d8bda40189f527392ffee262473699d912a41'
RUNS = [
    ('qa-fa76752bcc03', 'initial strict TS, failed and corrected', 2),
    ('qa-f47c01dfee6e', 'strict TS after correction', 0),
    ('qa-1aaae49eb592', 'Phase A-C first ingress integration', 0),
    ('qa-da5c73359b7e', 'actual Authority slice extraction', 0),
    ('qa-2cf6dcbe690c', '78 B4 tests', 0),
    ('qa-a427812f3718', '97 B4 tests', 0),
    ('qa-827b531fcec1', '107 B4 tests including review regressions', 0),
    ('qa-9fd4ad6f4c18', 'performance 10/100/1000/5000 with nonempty portfolios', 0),
    ('qa-f60f48f1ac35', 'final 109 B4 + 92 original Node + strict TS + 126 Golden + 3 Core twice', 0),
    ('qa-ccf20924be73', 'documentation boundary audit found incorrect relative links; corrected', 1),
]

def git(*args, cwd=ROOT):
    return subprocess.check_output(['git', *args], cwd=cwd, text=True).strip()

def sha(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(65536), b''):
            value.update(chunk)
    return value.hexdigest()

EVIDENCE.mkdir(exist_ok=True)
runs = []
for run_id, purpose, expected in RUNS:
    source = pathlib.Path('/home/sigaer/taiko/qa-vault/runs') / run_id / 'evidence'
    manifest = json.loads((source / 'manifest.json').read_text())
    assert manifest['exitCode'] == expected and manifest['processExitCode'] == expected, run_id
    assert manifest['childrenStopped'] is True and manifest['stopReason'] is None, run_id
    assert sha(source / 'output.log') == manifest['log']['sha256'], run_id
    shutil.copyfile(source / 'manifest.json', EVIDENCE / f'{run_id}.manifest.json')
    shutil.copyfile(source / 'output.log', EVIDENCE / f'{run_id}.output.txt')
    runs.append({'runId': run_id, 'purpose': purpose, 'exitCode': expected, 'childrenStopped': True,
                 'vault': str(source), 'outputSha256': manifest['log']['sha256']})
(EVIDENCE / 'qa-runs.json').write_text(json.dumps({'schemaVersion': 'b4-qa-evidence/1', 'runs': runs,
    'admissionNote': 'One QA attempt returned exit 75 while host lock was occupied; retried after release, no bypass.'}, indent=2) + '\n')

required = ['implementation-architecture', 'canonical-identity-adapter-report', 'registry-contract',
            'candidate-validation-report', 'actionability-priority-report', 'goal-association-report',
            'slate-composer-report', 'golden-and-regression-results', 'determinism-report',
            'performance-benchmark', 'known-limitations', 'updated-b4-roadmap']
for name in required:
    assert (DOCS / (name + '.md')).is_file(), name
links = 0
for file in DOCS.glob('*.md'):
    text = file.read_text()
    assert text.count('```') % 2 == 0, str(file)
    for target in re.findall(r'\]\(([^)]+)\)', text):
        if re.match(r'^[a-z]+:', target) or target.startswith('#'):
            continue
        assert (file.parent / target.split('#', 1)[0]).exists(), (file.name, target)
        links += 1

changed = set(git('diff', '--name-only', BASE).splitlines()) | set(git('ls-files', '--others', '--exclude-standard').splitlines())
prefixes = ('docs/batch4/implementation/', 'taiko_viewer/utils/multi-objective/', 'taiko_viewer/tests/multi-objective/')
files = {'docs/batch4/priority-actionability-contract.md', 'scripts/verify_multi_objective.sh',
         'scripts/verify_multi_objective_integration.sh', 'scripts/check_multi_objective_boundary.py',
         'taiko_viewer/tests/fixtures/multiObjective.tsconfig.json'}
assert all(p.startswith(prefixes) or p in files for p in changed), sorted(changed - files)
for folder in ['taiko_viewer/server', 'taiko_viewer/pages', 'taiko_viewer/components', 'taiko_viewer/composables']:
    path = ROOT / folder
    if path.exists():
        for source in path.rglob('*'):
            if source.suffix in {'.ts', '.vue', '.js', '.mjs'}:
                assert 'utils/multi-objective' not in source.read_text(), str(source)

preserved = {}
for directory, expected in [('/var/tmp/taiko-batch3-20261124/viewer', 'c49717b6b7b7f697c0975c3d1477b7abffb26b7f'),
                            ('/var/tmp/taiko-batch4-20261124/viewer', BASE)]:
    assert git('rev-parse', 'HEAD', cwd=directory) == expected
    assert not git('status', '--porcelain', cwd=directory)
    preserved[directory] = expected
for file, expected in [('existing-baseline.json', 'ed6ed2b0f0bfce8ef197536a0e81f32a9115d133b235f5dd69d8e3b02b53f36f'),
                       ('offline-benchmark.json', 'acf208e6efb5a62b44e9b4a33f526c52e7cab03574c02400d114b90337e57bbc')]:
    assert sha(ROOT / 'docs/batch3/evidence' / file) == expected
kernel = {str(p.relative_to(ROOT)): sha(p) for p in sorted((ROOT / 'taiko_viewer/utils/multi-objective').glob('*.ts'))}
report = {'schemaVersion': 'b4-boundary-audit/1', 'requiredReports': len(required), 'validLinks': links,
          'changedPaths': sorted(changed), 'preservedWorktrees': preserved, 'kernelFileHashes': kernel,
          'productionIntegration': False, 'databaseAccess': False, 'realPlayerDataAccess': False}
(EVIDENCE / 'boundary-audit.json').write_text(json.dumps(report, indent=2) + '\n')
subprocess.run(['git', 'diff', '--check'], cwd=ROOT, check=True)
print(json.dumps({'requiredReports': len(required), 'validLinks': links, 'archivedRuns': len(runs), 'kernelFiles': len(kernel), 'boundary': 'PASS'}))
