#!/bin/bash
set -euo pipefail
base=/var/tmp/taiko-batch21-20261124
mode="$1"
log="$base/evidence/installed-rc9-$mode.log"
set +e
"$base/installed-rc9/bin/python" -I "$base/viewer/scripts/audit/batch21/installed_validation.py" "$mode" >"$log" 2>&1
result=$?
set -e
tail -20 "$log"
exit "$result"
