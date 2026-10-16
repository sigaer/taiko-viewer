#!/usr/bin/env bash
# Serial bounded QA with per-run disk monitoring and durable evidence.
# Keep credentials in private files, never CLI arguments or task output.
set -euo pipefail
if [ "$#" -eq 0 ]; then echo 'Usage: bash scripts/memory/run_qa.sh command [args...]' >&2; exit 2; fi
[ "$(stat -fc %T /sys/fs/cgroup)" = cgroup2fs ] || { echo 'cgroup v2 required' >&2; exit 1; }
exec 9>/run/lock/taiko-memory-qa.lock
flock -n 9 || { echo 'Another bounded QA task is running' >&2; exit 75; }
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec /usr/bin/python3 "$script_dir/qa_vault.py" \
  --scratch-limit "${TAIKO_QA_SCRATCH_LIMIT_BYTES:-2147483648}" \
  --min-free "${TAIKO_QA_MIN_FREE_BYTES:-5368709120}" \
  --budget-reason "${TAIKO_QA_BUDGET_REASON_ID:-default}" -- "$@"
