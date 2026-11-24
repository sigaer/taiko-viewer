#!/bin/bash
set -euo pipefail
base=/var/tmp/taiko-batch21-20261124
viewer="$base/viewer/taiko_viewer"
if [ ! -d "$viewer/node_modules" ]; then
  cp -a --reflink=auto /var/tmp/taiko-batch2-20261124/integration/taiko_viewer/node_modules "$viewer/node_modules"
fi
cd "$viewer"
export TAIKO_PYTHON_EXECUTABLE="$base/installed-rc5/bin/python"
if [ "${1:-}" = development ]; then export TAIKO_PYTHON_EXECUTABLE=/var/tmp/taiko-batch2-20261124/installed-center-rc/bin/python; fi
export TAIKO_PUBLICATION_TEST_REPO_ROOT="$QA_RUN_TMPDIR"
export TAIKO_OFFLINE_ROOT="$QA_RUN_TMPDIR"
export TAIKO_RUNTIME_ROOT="$QA_RUN_TMPDIR"
export TAIKO_CENTER_ROOT="$QA_RUN_TMPDIR"
files=(tests/goalEvaluation.test.ts tests/playerGoal.test.ts tests/playerGoalService.test.mjs tests/playerGoalHttp.test.mjs tests/goalProfileCache.test.mjs tests/growthRefresh.test.mjs tests/growthEvaluationRefresh.test.mjs tests/growthFeedback.test.ts tests/growthClientLoading.test.mjs tests/dailyProgress.test.ts tests/playerGrowth.test.ts tests/dailyProgressReplay.test.mjs tests/growthHistory.test.ts tests/growthMeasurements.test.ts tests/growthHistoryHttp.test.mjs tests/growthWeekly.test.ts tests/growthWeeklyHttp.test.mjs tests/growthPassport.test.ts tests/growthPassportHttp.test.mjs tests/growthRecent.test.ts tests/growthRecentHttp.test.mjs tests/growthSessionIdentifiability.test.ts tests/homeStateResolver.test.ts tests/homePresentation.test.ts tests/personalHomeLocale.test.ts tests/homeDailyProgress.test.mjs tests/homeDeepState.test.mjs tests/homeGrowthFeedback.test.ts tests/recommendationToolIdentity.test.mjs tests/recommendationSongItem.test.mjs tests/recommendationGoalIdentity.test.mjs tests/weeklyMeasurementDisplay.test.mjs tests/weeklyChangesDisplay.test.mjs tests/versionProjection.test.mjs tests/publicationScope.test.ts tests/publicationClient.test.ts tests/recommendationDimensions.test.mjs tests/tjaTimeline.test.mjs)
if [ "${1:-}" = replay ]; then files=(tests/dailyProgressReplay.test.mjs tests/growthHistoryHttp.test.mjs); fi
if [ "${1:-}" = additional ]; then files=(tests/catalogAuthority.test.ts tests/measurementAttempt.test.ts tests/manualImportTime.test.ts tests/ugcCatalog.test.mjs tests/catalogHttpScope.test.ts); fi
log="$base/evidence/node-${1:-installed}.log"
set +e
/opt/taiko-viewer-runtime/node-v24.22.1-linux-x64/bin/node --experimental-strip-types --test --test-concurrency=1 --test-reporter=tap "${files[@]}" >"$log" 2>&1
result=$?
set -e
tail -12 "$log"
exit "$result"
