#!/usr/bin/env bash
# Isolation wrapper only. For Viewer releases the command MUST remain the
# standard scripts/deploy_forum_web.sh with the committed HEAD subject.
set -euo pipefail
[ "$#" -ge 1 ] || { echo 'Usage: run_build.sh command [args...]' >&2; exit 2; }
exec 9>/run/lock/taiko-memory-qa.lock
flock -n 9 || { echo 'Another development/QA/build task is running' >&2; exit 75; }
python3 - <<'PY'
from pathlib import Path
import re
assert not any(int(p.read_text() or '0') for p in Path('/sys/fs/cgroup/system.slice').glob('taiko-annual-*.service/pids.current')), 'Annual worker active; defer release build'
m={l.split(':')[0]:int(l.split()[1]) for l in Path('/proc/meminfo').read_text().splitlines()}
assert m['MemAvailable'] >= .25*m['MemTotal']+5*1024**2, 'Insufficient headroom for bounded build; retry in a maintenance window'
assert float(re.search(r'full avg10=([\d.]+)',Path('/proc/pressure/memory').read_text()).group(1)) < 2, 'Memory PSI pressure: defer release build'
PY
mkdir -p /var/tmp/taiko-build
chmod 700 /var/tmp/taiko-build
unit="taiko-build-$(date +%s)-$$"
cleanup() { systemctl stop "$unit.service" >/dev/null 2>&1 || true; }
trap cleanup EXIT
trap 'exit 130' INT TERM
systemd-run --quiet --unit="$unit" --slice=development-build.slice --wait --collect --pipe \
 --working-directory="$PWD" --setenv=TMPDIR=/var/tmp/taiko-build --setenv=PATH="$PATH" \
 -p MemoryHigh=4G -p MemoryMax=5G -p MemorySwapMax=512M -p TasksMax=512 \
 -p CPUQuota=200% -p RuntimeMaxSec=30min -p TimeoutStopSec=15 \
 -p KillMode=control-group -p OOMPolicy=stop -p UMask=0077 -- "$@"
