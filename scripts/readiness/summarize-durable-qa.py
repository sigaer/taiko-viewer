#!/usr/bin/env python3
"""Read-only inventory of durable QA archives; never prune earlier runs."""
import hashlib
import json
import os
import stat
import time
from pathlib import Path

VAULT = Path('/home/sigaer/taiko/qa-vault')

def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

def allocated(root):
    seen = set()
    total = 0
    for directory, dirs, files in os.walk(root, followlinks=False):
        for path in [Path(directory), *(Path(directory) / name for name in files)]:
            info = path.lstat()
            key = (info.st_dev, info.st_ino)
            if key not in seen:
                total += info.st_blocks * 512
                seen.add(key)
    return total

out = Path(os.environ['QA_EVIDENCE_DIR'])
assert out.resolve().is_relative_to(VAULT / 'runs')
before = json.loads((VAULT / 'evidence/space-before.json').read_text())
rows, errors = [], []
for path in sorted((VAULT / 'runs').glob('qa-*/evidence/manifest.json')):
    manifest = json.loads(path.read_text())
    verified = []
    for item in manifest.get('archivedEvidence', []):
        file = path.parent / item['path']
        if not file.resolve().is_relative_to(path.parent.resolve()) or file.is_symlink():
            errors.append({'run': manifest['runId'], 'path': item['path'], 'error': 'unsafe path'})
            continue
        ok = file.is_file() and sha(file) == item['sha256']
        verified.append(ok)
        if not ok:
            errors.append({'run': manifest['runId'], 'path': item['path'], 'error': 'missing or hash mismatch'})
    rows.append({'runId': manifest['runId'], 'evidenceDirectory': str(path.parent),
                 'manifestSha256': sha(path), 'wrapperExitCode': manifest.get('wrapperExitCode'),
                 'stopReason': manifest.get('stopReason'), 'childrenStopped': manifest.get('childrenStopped'),
                 'cleanup': manifest.get('cleanup'), 'scratchStillExists': (path.parent.parent / 'scratch').exists(),
                 'archivedFileCount': len(verified), 'allArchivedHashesMatch': all(verified),
                 'peakScratchBytes': max((max(s['scratch'].get('logicalBytes', 0), s['scratch'].get('allocatedBytes', 0)) for s in manifest.get('samples', [])), default=0)})
fs = os.statvfs(VAULT)
after = {'recordedAtEpoch': time.time(), 'freeBytes': fs.f_bavail * fs.f_frsize,
         'vaultAllocatedBytes': allocated(VAULT), 'vaultMode': oct(stat.S_IMODE(VAULT.stat().st_mode))}
report = {'status': 'PASS_ARCHIVE_HASHES' if not errors else 'FAIL_ARCHIVE_HASHES',
          'gate': 'Viewer 0.82.1 BLOCKED', 'before': before, 'after': after,
          'freeBytesDelta': after['freeBytes'] - before['freeBytes'],
          'scope': 'Completed run manifests only; wrapper exit success is not a business Gate PASS.',
          'cleanupPolicy': 'Only each invocation owned scratch; no pruning or unrelated deletion.',
          'directories': [{'path': str(p), 'allocatedBytes': allocated(p)} for p in sorted(VAULT.iterdir()) if p.is_dir() and not p.is_symlink()],
          'runs': rows, 'errors': errors}
(out / 'durable-qa-inventory.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'status': report['status'], 'runCount': len(rows), 'errorCount': len(errors), 'before': before, 'after': after}))
raise SystemExit(bool(errors))
