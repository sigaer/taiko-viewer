# Batch 3 Review Fix — Decision Context & Goal Contract 验收报告

基准：`b7c121057c627224192b6a9ee6effa8d236400bf`。
候选分支：`candidate/viewer-player-intelligence-b3-20261124`。
结论：四项审查问题修复，定向与既有离线验收全部通过；候选继续等待审查。

## 修复与覆盖

| 审查项 | 修复结果 | 新增定向测试 |
| --- | --- | --- |
| Snapshot Provenance | 移除 `input[key as 'rating']` 类型强制映射，改为五个显式来源；来源只有在 payload 最终被接受后才有 metadata；保留各自 revision/observedAt；confidence 时间同样不得引用拒收的 Rating | 4 项：各来源不同时间与独立 revision；缺来源/null revision；Rating/Growth 不同旧 revision 均拒收；错身份、未来时间、错 payload profile、无效 Rating 的 provenance 为 null |
| Dimension Consistency | `dimension-consistency.ts` 只比较原证据，输出全局/逐维三态；空或部分维度不再 vacuously consistent；整体 Rating 独立保留；Growth 提序需要完整可信匹配与对应 chart dimension | 5 项：空数组；左右/双侧部分维度；完整一致与真实提序；冲突与不提序；缺来源/零填充/limited |
| Goal Target Binding | `goal-target.ts` 统一 adapter 与 sorter 的 active score-pb 校验；身份/状态/field/comparison/baseline/value/候选分数严格绑定；伪造或旧 goalId 不能绕过；其他 Goal 类型不解释为分数目标 | 4 项：正确相对门槛；低于/等于 baseline/高于精确门槛/小数；错误字段/方向/值/状态/类型；显式等价 bound、缺失/非法/溢出 baseline |
| Recent Fact Semantics | Context 与 Home 同用 recently-known-fact-references；发生、观察、确认分别保留，缺失为 null；额外标明 knownAt/knowledgeBasis；不新建 Growth Facts | 3 项：历史 PB 晚确认在 Home 保留旧 occurredAt；仅观察时不补发生时间、event-only 无知识证据被排除；未来/无效 confirmation 不回退旧 observation |

`as 'rating'` 在 JavaScript 运行时本身不会把循环 key 改成 rating，但旧写法错误地表达了字段类型，且无条件记录了被拒收输入的 metadata。这次用显式已接受来源消除了类型歧义与实际 provenance 问题，没有改动 scoreRevision 的既有约束。

score-pb 数值语义依据已存在的 `utils/playerGoal.ts:goalTarget` 和 `utils/goalEvaluation.ts:evaluateGoal`：目标为 `highScore > baseline.highScore`，targetData 默认不含 value。候选 targetScore 是 inclusive 得分门槛；在安全整数分数域中只允许 baseline+1，不能把更高的任意候选分数标成同一 Goal 目标。若 targetData.value 显式存在，只允许其与 baseline 相等，否则与当前 evaluator 不一致，拒绝绑定。没有修改或重实现原 evaluator。

## 全量回归结果

最终运行 `qa-73993fdbb1a6`，经原 `scripts/memory/run_qa.sh` 串行执行：

- Strict TypeScript：通过。原 strict/noEmit 保留；仅增加既有 `~/*` 路径映射，使新比较模块复用现有六维键集合。
- Node：92/92 通过，0 failed/skipped/cancelled；原 76 项测试及其断言未改动，新增 16 项在独立 `playerDecisionReview.test.ts`。
- Existing Core Golden Cases：126/126 一致，实际执行既有 core，不替换或修改算法。
- 原 Core 推荐回归：3/3 通过，双次回放均执行。
- 两次生成报告：SHA-256 完全相同；与 `b7c12105` 的两份既有报告也完全相同。
- 工作区差异检查：没有 UI、生产路由、现行 Goal evaluator、Rating/core 或业务数据修改。

| 产物 | SHA-256 |
| --- | --- |
| existing-baseline.json | `ed6ed2b0f0bfce8ef197536a0e81f32a9115d133b235f5dd69d8e3b02b53f36f` |
| offline-benchmark.json | `acf208e6efb5a62b44e9b4a33f526c52e7cab03574c02400d114b90337e57bbc` |

原始证据目录：`/home/sigaer/taiko/qa-vault/runs/qa-73993fdbb1a6/evidence`。本分支封存 [QA 输出](evidence/review-fix/qa-output.txt) 与 [wrapper manifest](evidence/review-fix/qa-manifest.json)。manifest 记录 wrapper/process exitCode=0、childrenStopped=true、stopReason=null、scratch 已清理。使用 development-qa.slice 子 cgroup 的原预算与准入，无绕过；本次未启动 server/browser。wrapper 未输出进程峰值，不将配置预算称为实测峰值。

## 复现

从候选工作树根目录执行：

```bash
bash scripts/memory/run_qa.sh /bin/bash scripts/verify_player_intelligence.sh \
  /www/server/nvm/versions/node/v24.13.0/bin/node \
  /home/sigaer/taiko/taiko-forum/taiko_viewer/node_modules/typescript/bin/tsc \
  /var/tmp/taiko-batch21-20261124/installed-rc9/bin/python \
  /var/tmp/taiko-batch21-20261124/core/tests
```

runner 保留原六个 Node 文件，另加定向测试文件；完整执行 strict 检查、Node、原 Golden/core regression、两次报告及 hash comparison。QA 只使用现有合成 fixtures，没有读取/迁移真实玩家数据。

## 停止条件

本次只修复审查问题及相关测试/合同文档。没有接入生产请求链路、修改 UI、访问 Taiko Agent、迁移真实玩家资料、合并 main 或部署。原始基准的质量限制继续成立：合成基线不证明真实推荐效果，也不授权替换现行推荐算法。
