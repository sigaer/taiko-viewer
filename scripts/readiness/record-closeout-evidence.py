"""Archive bounded, non-secret QA summaries; run with the memory QA wrapper."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/platform-architecture-audit/evidence'


def file_evidence(path):
    path = Path(path)
    with path.open('rb') as source:
        digest = hashlib.file_digest(source, 'sha256').hexdigest()
    return {'path': str(path), 'sha256': digest, 'bytes': path.stat().st_size}


result_path = Path('/var/tmp/viewer1-sql-45SdX7/result.json')
result = json.loads(result_path.read_text())
assert result['status'] == 'PASS' and result['databaseProof'] == 'viewer1_security_test' and result['daemonExited']
report = {
    'status': 'PASS_SCOPED', 'productionAccess': False,
    'scope': '21 manual-source SQL/C/H/daily/Goal/measurement restore tests; not complete PITR or off-host backup',
    'passed': 21, 'failed': 0, 'skipped': 0,
    'interpreter': '/var/tmp/taiko-role-rebuild-tvcehdgr/venv/bin/python',
    'roleLocks': file_evidence(ROOT / 'docs/platform-architecture-audit/runtime-role-locks-with-memory.json'),
    'isolatedRun': result,
    'logs': [file_evidence(path) for path in [
        '/var/tmp/viewer082-closeout-restore-sql.log',
        '/var/tmp/viewer082-closeout-restore-sql-retry.log',
        '/var/tmp/viewer1-sql-45SdX7/tests.log', str(result_path)]],
    'initialFailure': 'Interpreter environment not forwarded by systemd; failed before SQL provisioning; preserved',
    'rpo': None, 'rto': None, 'offHostBackup': 'NOT_PERFORMED',
}
with (OUT / 'final-closeout-restore-20261016.json').open('x') as output:
    json.dump(report, output, ensure_ascii=False, indent=2)
    output.write('\n')
print('Archived scoped restore proof; overall Gate unchanged')

logs = [
    '/var/tmp/viewer082-g1-focused.log',
    '/var/tmp/viewer082-g1-products.log',
    '/var/tmp/viewer082-g1-products-retry.log',
    '/var/tmp/viewer082-g1-products-final.log',
]
runs = []
for path in logs:
    raw = Path(path).read_text()
    assert len(raw) < 2_000_000, 'QA log exceeded bound'
    counts = {key: int(re.findall(r'ℹ ' + key + r' (\d+)', raw)[-1])
              for key in ['tests', 'pass', 'fail', 'skipped'] if re.findall(r'ℹ ' + key + r' (\d+)', raw)}
    runs.append({**file_evidence(path), 'counts': counts})
with (OUT / 'viewer-source-reappearance-20261016.json').open('x') as output:
    json.dump({'scope': 'Viewer source replay and synthetic product fixtures with original installed Publication runtime',
               'productionAccess': False, 'runs': runs,
               'policyRevision': 'observation-reappearance-v2',
               'unchanged': ['package version 0.82.1', 'installed wheel', 'frozen oracle', 'persisted production measurements/reports/Goal'],
               'oldFailuresPreserved': True}, output, ensure_ascii=False, indent=2)
    output.write('\n')
print('Archived Viewer replay runs without overwriting prior failure logs')
