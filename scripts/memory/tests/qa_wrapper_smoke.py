"""Actual systemd wrapper child: no network, SQL, private data or broad cleanup."""
import json
import os
from pathlib import Path
import subprocess
import sys

root = Path(os.environ['QA_RUN_DIR'])
scratch = Path(os.environ['QA_RUN_TMPDIR'])
evidence = Path(os.environ['QA_EVIDENCE_DIR'])
assert scratch == root / 'scratch' and evidence == root / 'evidence'
assert os.environ['TMPDIR'] == str(scratch)
assert not any(key.lower().endswith('proxy') for key in os.environ)
assert len(str(scratch / 'm.sock').encode()) < 104
(scratch / 'temporary').write_text('cleanup-owned-only')
# Benign standard venv-style symlink must not trigger traversal or failure.
(scratch / 'python').symlink_to(sys.executable)
# The child is deliberately left running: systemd KillMode must stop it before cleanup.
child = subprocess.Popen(['/bin/sleep', '60'])
record = {'pid': os.getpid(), 'leftoverChildPid': child.pid,
          'leftoverChildStartTicks': Path(f'/proc/{child.pid}/stat').read_text().split()[21],
          'cgroup': Path('/proc/self/cgroup').read_text().strip(),
          'environmentCheck': 'PASS', 'scratchMarker': 'temporary'}
(evidence / 'smoke.json').write_text(json.dumps(record, indent=2)+'\n')
print('QA wrapper real child smoke PASS')
