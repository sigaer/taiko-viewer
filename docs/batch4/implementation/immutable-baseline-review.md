# B4-1 Final Review Fix — Immutable Goal Baseline Revision Semantics

基线：`35ff18c4568e32719b14678a5f5ee0288fa32340`。候选分支：`candidate/viewer-multi-objective-b4-1-20261124`。本轮完成不可变 Goal Baseline 的 revision 语义修复；299 项 B4、92 项 B3 Node 和两组 Strict TypeScript 通过。**126 Golden 与 3 Core 本轮未重跑，完整验收仍有依赖缺口**。用户确认原 Core 临时文件已清除，详情见验收表。

## 真实旧实现与修正

`utils/playerGoal.ts:goalBaseline()` 在创建时复制成绩数值并冻结 sourceRevision/capturedAt。`utils/goalEvaluation.ts:evaluateGoal()` 独立校验 Goal 与 observation 身份、revision 格式、来源和时间顺序；同 revision 本来就不足以证明后续成绩变化。二者本轮未修改。

上一轮 `multi-objective/evidence-bindings.ts` 将显式 baseline.ref.sourceRevision 强制等于当前 candidate/context.scoreRevision，错误地把冻结基线当作当前成绩。现改为两条独立校验路径：

| 概念 | 必须绑定到 | S1 创建、S2 同步示例 |
| --- | --- | --- |
| Baseline Source Revision | 创建时冻结的、受信 resolver 基线来源绑定 | S1；highScore=900000 保持不变 |
| Current Score Revision | candidate/context.scoreRevision；当前 snapshot、Rating 及相应样本 | S2；当前 highScore 仍为900000 |
| Current Prediction Evidence Revision | 当前 score estimate.ref.sourceRevision、predictionSamples.scoreRevision 与当前 candidate/context | S2；modelVersion 另行校验，不能替代成绩 revision |
| Goal target | 冻结 highScore+1 | 900001，不随同步重置 |

不同 revision 字符串不代表可信的历史证据：必须匹配**原基线来源绑定**，不能因旧/新字符串不同就放行，也不按字符串大小猜测时间。

## 新增只读证据绑定

B4 离线输入新增 `ValidationContext.goalBaselineBindings: readonly GoalBaselineBinding[]`：

```ts
type GoalBaselineBinding = {
  schemaVersion: 'goal-baseline-binding/1';
  baselineRef: string;
  ownerId: string;
  profileId: string;
  chartId: string;
  sourceRevision: string;
  evidenceHash: string; // SHA-256(canonicalJSON(完整 EvidenceRecord))
};
```

这是受信 resolver 在基线捕获时保存、后续只读传入的来源/摘要绑定，不复制 highScore 等 baseline 值，不是新 Goal 数据表、生产 API 或签名 token。完整 EvidenceRecord 摘要覆盖 schema、ref（包含 sourceRevision、身份、时间、payload contentHash）及 payload；与必填 payload SHA-256 同时校验。

绑定必须有合法版本、非空字段和 SHA-256；重复 baselineRef 拒绝。decisionId 包含按 baselineRef 确定排序的绑定。显式 score-pb 必须准确找到一个绑定，核对 owner/profile/canonical chart、冻结 sourceRevision 和完整记录摘要；缺绑定、换来源、改内容后重算 payload hash 都拒绝。sourceRevision 仍须非空且与冻结来源相等，校验未取消。

上游必须提供原始可信绑定，**不能在校验时从收到的 record 重新生成或覆盖绑定**。本纯函数不接 DB、不实现来源认证，也无法对抗同时伪造受信 context 和所有证据的上游；该信任边界与现有离线 resolver 一致。测试 fixture 模拟首次捕获，后续 seal 保留原绑定；这不是生产 producer。

显式 baselineRef 仍只允许 goal-portfolio / goal_baseline / score-pb；highScore 必须非负安全整数，highScore+1 不溢出且 target 严格相等。baselineRef=null 才使用当前可信 score_estimate，仍严格校验当前 revision。原 catalog/identity/provenance/时间约束未放宽。

`goals.ts` 继续复用统一 Actionability/基线校验，增加当前 Rating/Prediction sample provenance 的复验，避免关联入口接受 S1 预测样本配 S2 当前成绩。未创建、完成、重置或修改真实 Goal。

## 定向回归与旧测试调整

新增文件 `immutable-baseline.test.ts`，29 项测试：S1→S2 Candidate 与 Goal Association 通过；S2→S3→S4 baseline 和绑定字节不变；当前达到900001后拒绝推荐；基线改值、重算摘要并改 target、改为当前 revision、任意旧 revision、错误 owner/profile/chart/GoalType/Evidence、缺失/重复绑定均拒绝；当前 snapshot/estimate/Rating、样本 payload 和 candidate samples 携带旧 revision 均拒绝；null-ref 普通 score-pb 保留当前 revision 约束。

原270项均保留通过。旧 sourceRevision 测试改为核对冻结来源绑定，而不是要求匹配当前 revision；另用 S1→S2 正例证明合法历史来源可接受。原“baseline 与当前分数不同”的正例改为创建时捕获920000，而非先捕获900000后修改冻结值。未删除或放宽原断言。

## 实际验收证据

| 检查 | 本轮结果 |
| --- | --- |
| B4 原270 + 新29 | **299/299 PASS**，无 skipped/cancelled |
| B3 Node | **92/92 PASS**，无 skipped/cancelled |
| B4 / B3 Strict TypeScript | **PASS** |
| Crown near-evidence、mode/platform、TARGET_ALREADY_MET scope | 原 actionability.ts 整文件字节不变；原定向回归通过 |
| Evidence contentHash 必填与 SHA-256 | 原 evidence.ts 字节不变；原类型/runtime/hash回归通过 |
| 两份 B3 报告 | 原字节和 SHA-256 不变，见下 |
| 126 Golden / 3 Core | **本轮未重跑，缺少原 Core 0.1.4rc2 依赖**；不复用历史 PASS 冒充本轮结果 |
| 原性能报告与所有原始证据 | 原字节保留；本轮没有新增性能结论 |

完整 Node/TS run：`qa-b31d9d2a8f5f`。此前原270验证 `qa-04669f4930b9` 通过；新增测试初轮 `qa-bd5ee7aee3cb` 有 TS narrowing 错误，`qa-3e51de7198a1` 有一项负例 fixture 错误，均修正后于 `qa-c6449d449829` 通过299项；失败输出一并保留。

[本轮输出与 manifests](evidence/immutable-baseline/) 包含未截断测试输出、隔离 runner 的退出及清理证据。[重跑 Node/TS 命令](evidence/immutable-baseline/verify-node.sh) 和 [边界审计脚本](evidence/immutable-baseline/audit.py) 可复查；执行须用 `scripts/memory/run_qa.sh`。本轮由 Lead 实际执行，未把未执行的子代理意见作为测试。

- `existing-baseline.json`: `ed6ed2b0f0bfce8ef197536a0e81f32a9115d133b235f5dd69d8e3b02b53f36f`
- `offline-benchmark.json`: `acf208e6efb5a62b44e9b4a33f526c52e7cab03574c02400d114b90337e57bbc`

原 `/var/tmp/taiko-batch21-20261124/installed-rc9/bin/python` 和 `/var/tmp/taiko-batch21-20261124/core/tests` 均不存在，用户确认文件已清除。核对可获得的 Core main `0b7319d94b041daafb0a0d32e3ccc95e50da8810` 版本为0.1.2：两个 Golden fixture hash 与原报告一致，但10个源文件 hash 不符、缺 score/time.py，因此没有用它替代0.1.4rc2。待原依赖恢复后必须补跑原集成命令，方可宣称全部验收通过；本轮不改 Golden 期望或报告来消除版本差异。

## 交付边界

仅修改 B4 离线验证、对应只读输入类型、测试和报告。未修改现行推荐、B3、数据库、生产请求、真实玩家数据、Goal API 或 UI；未访问 Taiko Agent、未部署、未合并 main。修复候选推送至原分支，等待最终验收，Core 重跑缺口明确保留。

最终边界审计 run `qa-bd7ef0dc3ded`：PASS，原 B3 报告及 Crown actionability 字节一致；299/92 测试与 Strict TS 成功输出校验通过，5轮历史 QA（包括2轮已修正失败）的 output SHA-256 已核对归档。审计明确记录 Core 重跑为 `BLOCKED_MISSING_0.1.4rc2`；这不是完整集成 PASS。manifest/output 与 audit.json 同处本轮证据目录。
