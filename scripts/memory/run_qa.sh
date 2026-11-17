#!/usr/bin/env bash
# Admission is atomic; each admitted task has its own bounded systemd service.
set -euo pipefail
[ "$#" -ge 1 ] || { echo 'Command required' >&2; exit 2; }
[ "$(stat -fc %T /sys/fs/cgroup)" = cgroup2fs ] || { echo 'cgroup v2 required' >&2; exit 1; }
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
profile="${TAIKO_QA_PROFILE:-qa}"
[[ "$profile" = qa || "$profile" = static || "$profile" = browser ]] || { echo "invalid QA profile" >&2; exit 2; }
scratch=2147483648
[[ "$profile" != static ]] || scratch=268435456
exec /usr/bin/python3 "$script_dir/qa_vault.py" --profile "$profile" \
  --scratch-limit "${TAIKO_QA_SCRATCH_LIMIT_BYTES:-$scratch}" --budget-reason bounded-profile -- "$@"
