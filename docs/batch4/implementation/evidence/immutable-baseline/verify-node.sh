#!/bin/bash
set -euo pipefail
cd /var/tmp/taiko-b41-final-20261125/viewer
node_bin=/www/server/nvm/versions/node/v24.13.0/bin/node
tsc=/home/sigaer/taiko/taiko-forum/taiko_viewer/node_modules/typescript/bin/tsc
bash scripts/verify_multi_objective.sh "$node_bin" "$tsc" /home/sigaer/taiko/taiko-forum/taiko_viewer/node_modules/@types
mkdir -p taiko_viewer/node_modules/@sakura-taiko
if [ ! -e taiko_viewer/node_modules/@sakura-taiko/contract ]; then
  ln -s /var/tmp/taiko-b41-final-20261125/viewer/packages/sakura-taiko-contract taiko_viewer/node_modules/@sakura-taiko/contract
fi
"$node_bin" "$tsc" -p taiko_viewer/tests/fixtures/playerIntelligence.tsconfig.json
"$node_bin" --experimental-strip-types --test --test-concurrency=1 \
  taiko_viewer/tests/playerIntelligence.test.ts taiko_viewer/tests/playerDecisionReview.test.ts \
  taiko_viewer/tests/recommendationBenchmark.test.ts taiko_viewer/tests/playerGrowth.test.ts \
  taiko_viewer/tests/playerGoal.test.ts taiko_viewer/tests/goalEvaluation.test.ts \
  taiko_viewer/tests/growthSessionIdentifiability.test.ts
sha256sum --check docs/batch3/evidence/replay.sha256
git diff --exit-code 35ff18c4568e32719b14678a5f5ee0288fa32340 -- docs/batch3 taiko_viewer/utils/player-intelligence taiko_viewer/utils/playerGoal.ts taiko_viewer/utils/goalEvaluation.ts taiko_viewer/types packages taiko_viewer/server
git diff --check
