#!/usr/bin/env bash
# Bounded, serial ad-hoc QA. Keep credentials in private files, never CLI arguments.
set -euo pipefail
if [ "$#" -eq 0 ]; then echo 'Usage: bash scripts/memory/run_qa.sh command [args...]' >&2; exit 2; fi
[ "$(stat -fc %T /sys/fs/cgroup)" = cgroup2fs ] || { echo 'cgroup v2 required' >&2; exit 1; }
exec 9>/run/lock/taiko-memory-qa.lock
flock -n 9 || { echo 'Another bounded QA task is running' >&2; exit 75; }
mkdir -p /var/tmp/taiko-bounded-qa
chmod 700 /var/tmp/taiko-bounded-qa
unit="taiko-qa-$(date +%s)-$$"
cleanup() { systemctl stop "$unit.service" >/dev/null 2>&1 || true; }
trap cleanup EXIT
trap 'exit 130' INT TERM
systemd-run --quiet --unit="$unit" --wait --collect --pipe \
  --working-directory="$PWD" --setenv=TMPDIR=/var/tmp/taiko-bounded-qa \
  --setenv=NODE_OPTIONS=--max-old-space-size=1536 \
  -p MemoryHigh=2G -p MemoryMax=3G -p MemorySwapMax=256M \
  -p TasksMax=256 -p CPUQuota=200% -p RuntimeMaxSec=15min \
  -p TimeoutStopSec=15 -p KillMode=control-group -p OOMPolicy=stop \
  -p UMask=0077 -- "$@"
# The transient service owns descendants; its teardown reaps leaked Chromium too.
