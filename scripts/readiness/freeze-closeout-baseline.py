"""Capture local source and immutable artifact identities, without runtime data."""
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/platform-architecture-audit/evidence/final-closeout-baseline-20261016.json'


def git(path, *args):
    return subprocess.check_output(['git', '-C', str(path), *args], text=True, timeout=20).strip()


def sha(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


repos = {}
for name, path in {
    'viewerCandidate': ROOT,
    'viewerMain': Path('/home/sigaer/taiko/taiko-forum'),
    'taikoMain': Path('/home/sigaer/taiko-bot'),
    'taikoCandidate': Path('/var/tmp/taiko-final-ownership-20261015/taiko'),
    'sakuraMain': Path('/home/sigaer/git/Sakura_bot'),
}.items():
    repos[name] = {'path': str(path), 'head': git(path, 'rev-parse', 'HEAD'),
                   'tree': git(path, 'rev-parse', 'HEAD^{tree}'),
                   'branch': git(path, 'branch', '--show-current'),
                   'status': git(path, 'status', '--porcelain=v1').splitlines()}
lock_path = ROOT / 'docs/platform-architecture-audit/runtime-role-locks-with-memory.json'
locks = json.loads(lock_path.read_text())
artifacts = {}
for role in locks['roles'].values():
    for item in role['wheels']:
        path = item.get('file')
        if path:
            actual = sha(path)
            assert actual == item['sha256'], 'Wheel digest mismatch'
            artifacts[path] = actual
report = {'schemaVersion': 1, 'verifiedAt': datetime.now(timezone.utc).isoformat(),
          'scope': 'Git metadata and locked local wheel bytes only; no live configuration or private data',
          'repositories': repos, 'roleLockSha256': sha(lock_path), 'wheelDigests': artifacts,
          'productionAccess': False, 'status': 'BASELINE_ONLY_NOT_GATE_ACCEPTANCE'}
with OUT.open('x') as output:
    json.dump(report, output, indent=2, ensure_ascii=False)
    output.write('\n')
print(json.dumps({'output': str(OUT), 'wheelsVerified': len(artifacts)}))
