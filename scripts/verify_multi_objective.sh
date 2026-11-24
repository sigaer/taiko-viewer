#!/usr/bin/env bash
# B4-1 offline QA only. Run inside scripts/memory/run_qa.sh.
set -euo pipefail
repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"
node_bin="${1:?absolute Node path required}"
tsc_js="${2:?absolute tsc path required}"
node_types="${3:?absolute @types directory required}"
if [ ! -e taiko_viewer/node_modules/@types ]; then
  mkdir -p taiko_viewer/node_modules
  ln -s "$node_types" taiko_viewer/node_modules/@types
fi
"$node_bin" "$tsc_js" -p taiko_viewer/tests/fixtures/multiObjective.tsconfig.json
if [ "${4:-}" = 'benchmark' ]; then
  "$node_bin" --experimental-strip-types taiko_viewer/tests/multi-objective/benchmark.ts docs/batch4/implementation/evidence/performance.json
elif [ "${4:-}" != 'types-only' ]; then
  "$node_bin" --experimental-strip-types --test --test-concurrency=1 taiko_viewer/tests/multi-objective/*.test.ts
fi
