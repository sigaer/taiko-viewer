#!/bin/bash
set -u
base=/var/tmp/taiko-batch2-20261124
cd "$base/integration"
run() {
  local label="$1"; shift
  for attempt in $(seq 1 30); do
    "$@" > "$base/evidence/$label.log" 2>&1
    local result=$?
    if [ "$result" -ne 75 ]; then echo "$label exit=$result"; return "$result"; fi
    sleep 5
  done
  echo "$label admission blocked"; return 75
}
run deep-audit bash scripts/memory/run_qa.sh /opt/taiko-bot/current/bin/python -I scripts/audit/batch2/deep_audit.py
run final-artifacts bash scripts/memory/run_qa.sh /usr/bin/python3 scripts/audit/batch2/final_artifacts.py
for mode in contract python bridge; do
  run "final-installed-$mode" bash scripts/memory/run_qa.sh "$base/installed-center-rc/bin/python" -I scripts/audit/batch2/installed_validation.py "$mode"
done
run viewer-build bash scripts/memory/run_build.sh /bin/bash "$base/integration/scripts/audit/batch2/build_viewer.sh"
