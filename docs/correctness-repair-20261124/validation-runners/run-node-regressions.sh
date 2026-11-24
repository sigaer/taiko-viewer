#!/bin/bash
set -euo pipefail
cd "$1/taiko_viewer"
export TAIKO_PYTHON_EXECUTABLE=/opt/taiko-bot/current/bin/python
export TAIKO_PUBLICATION_TEST_REPO_ROOT="$QA_RUN_TMPDIR"
export TAIKO_OFFLINE_ROOT="$QA_RUN_TMPDIR"
export TAIKO_RUNTIME_ROOT="$QA_RUN_TMPDIR"
export TAIKO_CENTER_ROOT="$QA_RUN_TMPDIR"
files=(tests/goalEvaluation.test.ts tests/playerGoal.test.ts tests/playerGoalService.test.mjs tests/playerGoalHttp.test.mjs tests/goalProfileCache.test.mjs tests/growthRefresh.test.mjs tests/growthEvaluationRefresh.test.mjs tests/growthFeedback.test.ts tests/growthClientLoading.test.mjs tests/dailyProgress.test.ts tests/playerGrowth.test.ts tests/dailyProgressReplay.test.mjs tests/growthHistory.test.ts tests/growthMeasurements.test.ts tests/growthHistoryHttp.test.mjs tests/growthWeekly.test.ts tests/growthWeeklyHttp.test.mjs tests/growthPassport.test.ts tests/growthPassportHttp.test.mjs tests/growthRecent.test.ts tests/growthRecentHttp.test.mjs tests/growthSessionIdentifiability.test.ts tests/homeStateResolver.test.ts tests/homePresentation.test.ts tests/personalHomeLocale.test.ts tests/homeDailyProgress.test.mjs tests/homeDeepState.test.mjs tests/homeGrowthFeedback.test.ts tests/recommendationToolIdentity.test.mjs tests/recommendationSongItem.test.mjs tests/recommendationGoalIdentity.test.mjs tests/weeklyMeasurementDisplay.test.mjs tests/weeklyChangesDisplay.test.mjs tests/versionProjection.test.mjs tests/publicationScope.test.ts tests/publicationClient.test.ts)
for f in tests/recommendationDimensions.test.mjs tests/tjaTimeline.test.mjs; do if [ -f "$f" ]; then files+=("$f"); fi; done
exec /opt/taiko-viewer-runtime/node-v24.22.1-linux-x64/bin/node --experimental-strip-types --test --test-concurrency=1 --test-reporter=tap "${files[@]}"
