# 文件与提交清单

提交均由主代理执行；分组对应工作包，不代表子代理直接写入。

## Viewer

```text
9e3151a2 fix: keep Viewer recommendation bases in public vocabulary

docs/correctness-repair-20261124/agent-a.md
taiko_viewer/package-lock.json
taiko_viewer/package.json
taiko_viewer/server/services/account/charts.ts
taiko_viewer/server/services/account/recommendation-dimensions.ts
taiko_viewer/tests/recommendationDimensions.test.mjs
d8f766cb fix: integrate TJA timing commands at their note positions

docs/correctness-repair-20261124/agent-c.md
taiko_viewer/tests/tjaTimeline.test.mjs
taiko_viewer/vendor/tja/TJAAnalyzer/src/utils/bar-timeline.ts
taiko_viewer/vendor/tja/TJAAnalyzer/src/utils/note-gap.ts
taiko_viewer/vendor/tja/TJARenderer/src/tja-parser.ts
taiko_viewer/vendor/tja/sources.json
```

## Bot/Application/Core

```text
a14d19d fix: normalize recommendation dimensions at Core boundary

docs/correctness-repair-20261124/agent-a.md
packages/taiko-application/src/taiko_application/commands/recommendation.py
packages/taiko-application/src/taiko_application/query/recommendation.py
packages/taiko-application/src/taiko_application/recommendation_dimensions.py
taiko_bot/offline/score_calculator.py
taiko_bot/runtime/player/center/recommendation_support/aliases.py
taiko_bot/runtime/player/center/recommendation_support/score_calculator.py
taiko_bot/runtime/player/client/recommendation_support/aliases.py
taiko_bot/runtime/player/client/recommendation_support/score_calculator.py
tests/correctness/run.py
1d74978 fix: enforce authoritative CN chart availability before selection

docs/correctness-repair-20261124/agent-b.md
packages/sakura-taiko-core/core/chart/availability.py
packages/sakura-taiko-core/core/recommendation/candidates.py
packages/sakura-taiko-core/core/recommendation/catalog_inputs.py
taiko_bot/offline/chart_availability.py
taiko_bot/runtime/player/center/recommendation_support/chart_availability.py
taiko_bot/runtime/player/client/recommendation_support/score_calculator.py
taiko_bot/runtime/player/client/recommendation_support/target_recommend.py
tests/correctness/catalog.py
9813266 test: integrate CN authority fixtures and Core timeline regression

packages/sakura-taiko-core/core/parser/chart_analysis.py
tests/offline/test_chart_timeline_golden.py
tests/offline/test_target_recommend.py
2a014a8 fix: preserve decimal and signed TJA delay timing

packages/sakura-taiko-core/core/parser/tja.py
tests/correctness/bridge.py
tests/offline/test_chart_timeline_golden.py
3cf01e4 fix: guard initial chart tempo and record center-only backport

docs/correctness-repair-20261124/core-center-backport.patch
packages/sakura-taiko-core/core/parser/tja.py
tests/offline/test_chart_timeline_golden.py
```

最终文档提交另包含本目录 README、validation、agent-d、files-and-commits、backport-inputs、validation-runners；不包含新的业务修改。

Bot最终文档提交：62c4d3e（agent-b.md、integration.md）。
