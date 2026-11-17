#!/usr/bin/env bash
# Admission is atomic; each admitted task has its own bounded systemd service.
set -euo pipefail
[ "$#" -ge 1 ] || { echo 'Command required' >&2; exit 2; }
[ "$(stat -fc %T /sys/fs/cgroup)" = cgroup2fs ] || { echo 'cgroup v2 required' >&2; exit 1; }
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec /usr/bin/python3 "$script_dir/qa_vault.py" --profile "dev" \
  --port "${TAIKO_DEV_PORT:?set an explicit isolated dev port}" \
  --scratch-limit "2147483648" --budget-reason bounded-profile -- "$@"
