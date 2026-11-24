#!/usr/bin/env bash
# B4 candidate integration: run inside memory/run_qa.sh; no production services.
set -euo pipefail
if [ "$#" -ne 5 ]; then
  echo 'Expected ABS_NODE ABS_TSC_JS ABS_NODE_TYPES ABS_CORE_PYTHON ABS_CORE_TESTS' >&2
  exit 2
fi
repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"
/bin/bash scripts/verify_multi_objective.sh "$1" "$2" "$3"
/bin/bash scripts/verify_player_intelligence.sh "$1" "$2" "$4" "$5"
git diff --exit-code a68d8bda -- docs/batch3 taiko_viewer/utils/player-intelligence taiko_viewer/types packages taiko_viewer/server
git diff --check
