#!/usr/bin/env bash
# Invoke this command through scripts/memory/run_qa.sh; it never builds or deploys.
set -euo pipefail
if [ "$#" -ne 4 ]; then
  echo 'Usage (inside QA wrapper): verify_player_intelligence.sh ABS_NODE ABS_TSC_JS ABS_CORE_PYTHON ABS_CORE_TESTS' >&2
  exit 2
fi
node_bin="$1"
tsc_js="$2"
core_python="$3"
core_tests="$4"
repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"
# Resolve the repository's own contract in a fresh candidate worktree. No install/network.
if [ ! -e taiko_viewer/node_modules/@sakura-taiko/contract ]; then
  mkdir -p taiko_viewer/node_modules/@sakura-taiko
  ln -s "$repo_dir/packages/sakura-taiko-contract" taiko_viewer/node_modules/@sakura-taiko/contract
fi
"$node_bin" "$tsc_js" -p taiko_viewer/tests/fixtures/playerIntelligence.tsconfig.json
"$node_bin" --experimental-strip-types --test --test-concurrency=1 \
  taiko_viewer/tests/playerIntelligence.test.ts \
  taiko_viewer/tests/recommendationBenchmark.test.ts \
  taiko_viewer/tests/playerGrowth.test.ts \
  taiko_viewer/tests/playerGoal.test.ts \
  taiko_viewer/tests/goalEvaluation.test.ts \
  taiko_viewer/tests/growthSessionIdentifiability.test.ts
"$core_python" -I scripts/player_intelligence_baseline.py --core-tests "$core_tests" --output docs/batch3/evidence/existing-baseline.json
"$node_bin" --experimental-strip-types taiko_viewer/scripts/benchmark_player_intelligence.mjs docs/batch3/evidence/existing-baseline.json docs/batch3/evidence/offline-benchmark.json
sha256sum docs/batch3/evidence/existing-baseline.json docs/batch3/evidence/offline-benchmark.json > docs/batch3/evidence/replay.sha256
"$core_python" -I scripts/player_intelligence_baseline.py --core-tests "$core_tests" --output docs/batch3/evidence/existing-baseline.json
"$node_bin" --experimental-strip-types taiko_viewer/scripts/benchmark_player_intelligence.mjs docs/batch3/evidence/existing-baseline.json docs/batch3/evidence/offline-benchmark.json
sha256sum --check docs/batch3/evidence/replay.sha256
