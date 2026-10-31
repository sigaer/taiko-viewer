"""Directed acceptance of an existing, unmodified Viewer build; no rebuild/deploy.

Invoke with memory/run_qa.sh, an absolute .output directory and its source SHA.
Uses the existing empty-MySQL runner and installed Publication runtime.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

repo = Path(__file__).resolve().parents[2]
output = Path(sys.argv[1]).resolve(strict=True)
commit = sys.argv[2]
assert output.name == '.output' and (output / 'server/index.mjs').is_file()
assert subprocess.check_output(['git', '-C', str(output.parent), 'rev-parse', 'HEAD'], text=True).strip() == commit
evidence = Path(os.environ['QA_EVIDENCE_DIR'])
manifest = Path(os.environ['QA_ARTIFACT_MANIFEST'])
runtime = json.loads(manifest.read_text())
files = []
for path in sorted(output.rglob('*')):
    if path.is_file():
        with path.open('rb') as stream:
            digest = hashlib.file_digest(stream, 'sha256').hexdigest()
        files.append({'path': str(path.relative_to(output)), 'sha256': digest})
(evidence / 'my-taiko-build.json').write_text(json.dumps({
    'status': 'PASS', 'commit': commit, 'output': str(output), 'files': files,
    'artifactManifestSha256': hashlib.sha256(manifest.read_bytes()).hexdigest(),
}))
node = '/opt/taiko-viewer-runtime/node-v24.22.1-linux-x64/bin/node'
env = {**os.environ, 'TAIKO_PYTHON_EXECUTABLE': runtime['candidate']['python'],
       'PATH': str(Path(node).parent) + ':/usr/bin:/bin'}
raise SystemExit(subprocess.call([
    node, str(repo / 'scripts/readiness/run-isolated-sql.mjs'),
    '--allow-test-db-mutation', 'taiko_viewer/tests/myTaikoCatalogNuxt.test.mjs',
], cwd=repo, env=env))
