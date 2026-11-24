#!/bin/bash
set -u
base=/var/tmp/taiko-batch2-20261124
cd "$base/integration"
run() {
 local label="$1"; shift
 "$@" > "$base/evidence/$label.log" 2>&1
 echo "$label exit=$?"
}
run deep-audit-final bash scripts/memory/run_qa.sh "$base/installed-center-rc/bin/python" -I scripts/audit/batch2/deep_audit.py
run measurement-contract bash scripts/memory/run_qa.sh /opt/taiko-viewer-runtime/node-v24.22.1-linux-x64/bin/node scripts/audit/batch2/measurement_contract.mjs
for mode in contract python bridge; do
 run "rc-installed-$mode" bash scripts/memory/run_qa.sh "$base/installed-center-rc/bin/python" -I scripts/audit/batch2/installed_validation.py "$mode"
done
run tja-final bash scripts/memory/run_qa.sh /opt/taiko-viewer-runtime/node-v24.22.1-linux-x64/bin/node scripts/audit/batch2/scan_tja.mjs
