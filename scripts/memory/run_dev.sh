#!/usr/bin/env bash
# Named, bounded new dev servers; never re-parent existing editor sessions.
set -euo pipefail
[ "$#" -ge 1 ] || { echo 'Usage: run_dev.sh command [args...]' >&2; exit 2; }
exec 9>/run/lock/taiko-memory-qa.lock
flock -n 9 || { echo "Another development/QA/build task is running" >&2; exit 75; }
mkdir -p /var/tmp/taiko-development
chmod 700 /var/tmp/taiko-development
unit="taiko-dev-$(date +%s)-$$"
cleanup() { systemctl stop "$unit.service" >/dev/null 2>&1 || true; }
trap cleanup EXIT
trap 'exit 130' INT TERM
systemd-run --quiet --unit="$unit" --slice=development.slice --wait --collect --pipe \
 --working-directory="$PWD" --setenv=TMPDIR=/var/tmp/taiko-development \
 --setenv=PATH="$PATH" --setenv=NODE_OPTIONS=--max-old-space-size=1536 \
 -p MemoryHigh=2G -p MemoryMax=3G -p MemorySwapMax=256M -p TasksMax=256 \
 -p LimitFSIZE=2147483648 -p CPUQuota=200% -p RuntimeMaxSec=4h -p TimeoutStopSec=15 \
 -p KillMode=control-group -p OOMPolicy=stop -p UMask=0077 -- "$@"
