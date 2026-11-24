"""Bounded B4-1 review-fix evidence/boundary audit. Run via memory/run_qa.sh."""
import hashlib
import json
import pathlib
import re
import shutil
import subprocess
import sys

root = pathlib.Path(sys.argv[1]).resolve()
base = 'f53601362b62469eb4b1d07db94421dd35a9c6d9'
evidence = root / 'docs/batch4/implementation/evidence'
archive = evidence / 'review-fix'
archive.mkdir(exist_ok=True)

def git(*args):
    return subprocess.check_output(['git', *args], cwd=root)

def sha(data):
    return hashlib.sha256(data).hexdigest()

# All original tests/fixtures, B3 and production paths remain byte-identical.
protected = ['docs/batch3', 'taiko_viewer/utils/player-intelligence', 'taiko_viewer/types',
             'packages', 'taiko_viewer/server', 'taiko_viewer/pages', 'taiko_viewer/components',
             'taiko_viewer/composables', 'taiko_viewer/tests', 'scripts',
             'docs/batch4/implementation/evidence', 'docs/batch4/implementation/performance-benchmark.md']
original_protected = set(git('ls-tree', '-r', '--name-only', base, '--', *protected).decode().splitlines())
protected_changed = set(git('diff', '--name-only', base, '--', *protected).decode().splitlines())
assert not original_protected.intersection(protected_changed), 'tracked protected files changed'
original_tests = git('ls-tree', '-r', '--name-only', base, 'taiko_viewer/tests/multi-objective').decode().splitlines()
original_evidence = git('ls-tree', '-r', '--name-only', base, 'docs/batch4/implementation/evidence').decode().splitlines()
for path in original_tests + original_evidence:
    assert (root / path).read_bytes() == git('show', f'{base}:{path}'), path

expected = {
    'existing-baseline.json': 'ed6ed2b0f0bfce8ef197536a0e81f32a9115d133b235f5dd69d8e3b02b53f36f',
    'offline-benchmark.json': 'acf208e6efb5a62b44e9b4a33f526c52e7cab03574c02400d114b90337e57bbc',
}
for name, digest in expected.items():
    assert sha((root / 'docs/batch3/evidence' / name).read_bytes()) == digest

path = 'taiko_viewer/utils/multi-objective/actionability.ts'
def near_block(text):
    return text.split('      const near = ', 1)[1].split('      if (!ordered.length', 1)[0]
assert near_block((root / path).read_text()) == near_block(git('show', f'{base}:{path}').decode()), 'near thresholds changed'

changed = set(git('diff', '--name-only', base).decode().splitlines()) | set(git('ls-files', '--others', '--exclude-standard').decode().splitlines())
allowed = {
    'docs/batch4/candidate-schema.md',
    'docs/batch4/implementation/README.md',
    'docs/batch4/implementation/candidate-validation-report.md',
    'docs/batch4/implementation/actionability-priority-report.md',
    'docs/batch4/implementation/review-fix-acceptance.md',
    'docs/batch4/implementation/review-fix-performance.md',
    'taiko_viewer/utils/multi-objective/actionability.ts',
    'taiko_viewer/utils/multi-objective/contracts.ts',
    'taiko_viewer/utils/multi-objective/schemas.ts',
    'taiko_viewer/utils/multi-objective/evidence.ts',
    'taiko_viewer/utils/multi-objective/evidence-bindings.ts',
    'taiko_viewer/tests/multi-objective/evidence-scope-baseline.test.ts',
}
assert all(p in allowed or p.startswith('docs/batch4/implementation/evidence/review-fix') for p in changed), sorted(changed - allowed)

runs = []
for run_id, purpose in [('qa-4ba877760444', 'Strict TS + 270 B4 tests'),
                        ('qa-fd206385c55b', 'Full integration: 270 B4 + 92 B3 + Strict TS + 126 Golden/3 Core twice'),
                        ('qa-cd715dafb68d', 'Unchanged benchmark at 10/100/1000/5000, separate review-fix output')]:
    source = pathlib.Path('/home/sigaer/taiko/qa-vault/runs') / run_id / 'evidence'
    m = json.loads((source / 'manifest.json').read_text())
    assert m['exitCode'] == m['processExitCode'] == m['wrapperExitCode'] == 0, run_id
    assert m['childrenStopped'] is True and m['stopReason'] is None, run_id
    output = (source / 'output.log').read_bytes()
    assert sha(output) == m['log']['sha256'], run_id
    if run_id == 'qa-fd206385c55b':
        text = output.decode()
        assert 'tests 270' in text and 'pass 270' in text and 'tests 92' in text and 'pass 92' in text
        assert text.count('"goldenCases": 126, "regressionTests": 3') == 2
        assert text.count('Ran 3 tests') == 2 and 'fail 0' in text
    shutil.copyfile(source / 'manifest.json', archive / f'{run_id}.manifest.json')
    shutil.copyfile(source / 'output.log', archive / f'{run_id}.output.txt')
    runs.append({'runId': run_id, 'purpose': purpose, 'exitCode': 0, 'childrenStopped': True,
                 'outputSha256': sha(output), 'vault': str(source)})

links = 0
link_paths = []
for file in (root / 'docs/batch4/implementation').glob('*.md'):
    text = file.read_text()
    assert text.count('```') % 2 == 0, file.name
    for target in re.findall(r'\]\(([^)]+)\)', text):
        if re.match(r'^[a-z]+:', target) or target.startswith('#'):
            continue
        link_paths.append(file.parent / target.split('#', 1)[0])
        links += 1
kernel = {str(p.relative_to(root)): sha(p.read_bytes()) for p in sorted((root / 'taiko_viewer/utils/multi-objective').glob('*.ts'))}
report = {'schemaVersion': 'b4-review-fix-audit/1', 'baseCommit': base, 'boundary': 'PASS',
          'originalB4TestsAndFixturesUnchanged': len(original_tests), 'originalEvidenceFilesUnchanged': len(original_evidence),
          'nearEvidenceFunctionByteIdentical': True, 'b3ReportSha256': expected, 'validDocumentationLinks': links,
          'originalPerformanceSha256': sha((evidence / 'performance.json').read_bytes()),
          'reviewPerformanceSha256': sha((evidence / 'review-fix-performance.json').read_bytes()),
          'kernelFileHashes': kernel, 'newTestSha256': sha((root / 'taiko_viewer/tests/multi-objective/evidence-scope-baseline.test.ts').read_bytes()),
          'changedPathsBeforeArchival': sorted(changed), 'runs': runs}
(evidence / 'review-fix-audit.json').write_text(json.dumps(report, indent=2) + '\n')
for link_path in link_paths:
    assert link_path.exists(), str(link_path)
subprocess.run(['git', 'diff', '--check'], cwd=root, check=True)
print(json.dumps({'boundary': 'PASS', 'preservedB3Reports': expected, 'originalB4TestsAndFixturesUnchanged': len(original_tests),
                  'originalEvidenceFilesUnchanged': len(original_evidence), 'nearEvidenceFunctionByteIdentical': True,
                  'validDocumentationLinks': links, 'archivedRuns': len(runs)}))
