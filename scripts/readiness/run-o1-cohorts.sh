#!/usr/bin/env bash
# Each cohort receives its own unchanged 15-minute QA cgroup and owned SQL.
# Invoke only when the coordinator grants the shared host QA slot.
set -uo pipefail
node=/www/server/nvm/versions/node/v24.13.0/bin/node
python=/var/tmp/taiko-role-rebuild-hlmgfkq0/venv/bin/python
out=${1:?New /var/tmp output directory required}
case "$out" in /var/tmp/*) ;; *) exit 2;; esac
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
