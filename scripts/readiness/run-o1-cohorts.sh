#!/usr/bin/env bash
# Each cohort receives its own unchanged 15-minute QA cgroup and owned SQL.
# Invoke only when the coordinator grants the shared host QA slot.
set -uo pipefail
node=/www/server/nvm/versions/node/v24.13.0/bin/node
python=$(/usr/bin/python3 -c 'import json,os; print(json.load(open(os.environ["QA_ARTIFACT_MANIFEST"]))["candidate"]["python"])') || exit 2
out=${1:?New persistent QA evidence output directory required}
/usr/bin/python3 -c 'import os,sys; from pathlib import Path; base=Path(os.environ["QA_EVIDENCE_DIR"]).resolve(strict=True); assert base.is_relative_to("/home/sigaer/taiko/qa-vault") and base!=Path("/home/sigaer/taiko/qa-vault"); assert Path(sys.argv[1]).resolve().is_relative_to(base)' "$out" || exit 2
[ ! -e "$out" ] || exit 2
mkdir -m 700 "$out"
for operation in private-current private-history growth-history; do
  for concurrency in 1 3 5; do
    log="$out/$operation-$concurrency.log"
    bash scripts/memory/run_qa.sh /usr/bin/env TAIKO_PYTHON_EXECUTABLE="$python" "$node" scripts/readiness/run-isolated-sql.mjs --allow-test-db-mutation "--o1=$operation:$concurrency:200" taiko_viewer/tests/o1RequestPerformance.test.mjs > "$log" 2>&1
    result=$?
    printf '%s concurrency=%s launcher_exit=%s log=%s\n' "$operation" "$concurrency" "$result" "$log"
    if [ "$result" -eq 75 ]; then exit 75; fi
    # A pressure stop blocks additional load; operation failures do not silently
    # skip the other independent operations. Every original output is retained.
    if rg -q '"pressureStop":"' "$log"; then exit 2; fi
  done
done
