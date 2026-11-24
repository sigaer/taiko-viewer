#!/bin/bash
set -u
base=/var/tmp/taiko-batch2-20261124
cd "$base/integration"
for mode in contract python bridge; do
  bash scripts/memory/run_qa.sh "$base/installed-center-rc/bin/python" -I "$base/integration/scripts/audit/batch2/installed_validation.py" "$mode" > "$base/evidence/installed-$mode.log" 2>&1
  echo "$mode exit=$?"
done
