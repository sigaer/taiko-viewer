# B4-1 Review Fix — Evidence Scope & Baseline Integrity

候选分支：`candidate/viewer-multi-objective-b4-1-20261124`。修复基线：`f53601362b62469eb4b1d07db94421dd35a9c6d9`。本报告只覆盖本轮验收问题；提交完整 SHA 由交付消息提供。本轮由 Lead 实际执行文件修改、终端测试与审查，没有将子代理设计意见计作测试。

## 修复对照

| 问题 | 基线行为 | 修复后行为与测试 |
| --- | --- | --- |
| Clear / FC / DF 范围 | attempt 对 window 校验，但 current snapshot 未校验 mode/platform | 四类 Crown 共用明确的 mode/platform 比较；current、唯一 window、全部 attempt 必须一致；NG 继续要求 baseline 同范围。Ready-Now / Stretch 均测 mismatch、null、字段遗漏和缺 current snapshot |
| Attempt 范围 | 缺少统一的已达标范围门槛 | attempt refs 完整匹配 window，mode/platform 相同，时间位于窗口内并符合原 30 天规则；跨范围记录、缺 window 字段拒绝 |
| TARGET_ALREADY_MET | 皇冠/NG 状态在窗口范围检查之前判断 | 仅在 current/window/attempt（NG 加 baseline）范围成立时判断；跨模式、跨平台、未知范围及混合 snapshots 不产生皇冠/NG 已达标结论。保留同范围已达标及同范围冲突快照的旧回归 |
| score_pb 显式基线 | 非 score-pb Goal Baseline 会回退到 estimate.currentBestScore | 非空 baselineRef 仅支持 goal-portfolio 的 goal_baseline/score-pb；查无记录、错误类型、错误 GoalType、错 profile/chart/catalog/scoreRevision、缺失或非法 highScore 直接拒绝，绝不回退 |
| score_pb 普通候选 | 可使用 estimate 当前成绩 | baselineRef=null 仍可使用可信 score_estimate.currentBestScore；scope 与完整性由入口和基线绑定验证。目标严格为所选 baseline+1；显式 baseline 与当前成绩可数值不同 |
| contentHash | 公共类型/runtime ref shape 允许 null，payload 校验却拒绝 | 公共类型改为必填 string，runtime 为 64 位小写 hex；每条已解析 EvidenceRecord 必须匹配 SHA-256(canonicalJSON(payload))。测试包括 TS 对 null 的编译期拒绝、缺失/null/格式错误/摘要不符及正确摘要 |

公共版本仍为 B4 `b4-offline/1` / `b4-evidence/1` / `candidate/1`，修订使声明与既有完整性要求一致。B3 类型、wire protocol 和已注册数值门槛未变。`evidence-bindings.ts` 抽出范围比较和 score-pb 基线解析，未新增预测模型。

新增的 `CROWN_CURRENT_SCOPE_UNVERIFIED`、`SCORE_BASELINE_EVIDENCE_MISSING`、`SCORE_BASELINE_TYPE_UNSUPPORTED`、`SCORE_BASELINE_GOAL_TYPE_MISMATCH`、`SCORE_BASELINE_SCOPE_MISMATCH`、`SCORE_BASELINE_VALUE_INVALID` 是校验失败 diagnostics（ValidationIssue），不是新增可声明的成功 reasonCodes。

## 验收结果

| 检查 | 结果 |
| --- | --- |
| 原 B4 Node | 原 109 项保留；原测试/fixtures 全部逐字节未改 |
| 本轮定向回归 | 新增 161 项，独立文件 evidence-scope-baseline.test.ts |
| B4 合计 | **270/270 PASS**，0 failed/skipped/cancelled |
| 原 B3 Node | **92/92 PASS**，0 failed/skipped/cancelled |
| Strict TypeScript | B4（含新增测试和 benchmark）、B3 均 PASS |
| 原 Golden Cases | **126/126 PASS**，原 fixture 和期望不变；两次回放 |
| 原 Core Regression | **3/3 PASS**，两次运行 |
| 原两份报告 SHA-256 | 均不变，见下表 |
| near-evidence 数值门槛 | 原 near 函数逐字节一致，原边界断言保留 |
| 原始性能报告 | performance-benchmark.md 与 evidence/performance.json 均逐字节保留；新测量另存 |
| 修改边界 | 仅 B4 校验、对应契约/说明、新定向测试与本轮证据；最终检查见 review-fix-audit.json |

| 原报告 | SHA-256 |
| --- | --- |
| docs/batch3/evidence/existing-baseline.json | `ed6ed2b0f0bfce8ef197536a0e81f32a9115d133b235f5dd69d8e3b02b53f36f` |
| docs/batch3/evidence/offline-benchmark.json | `acf208e6efb5a62b44e9b4a33f526c52e7cab03574c02400d114b90337e57bbc` |

## 可复查证据

所有执行串行使用现有 `scripts/memory/run_qa.sh`，保留 cgroup 限额、共享锁及清理证据。初轮 run `qa-4ba877760444`；完整集成 run `qa-fd206385c55b`；追加性能 run `qa-cd715dafb68d`。每轮 manifest 和未截断 output 的副本见 [本轮证据目录](evidence/review-fix/)，哈希、exitCode 和 childrenStopped 检查见 [边界审计](evidence/review-fix-audit.json)。原 QA 历史证据未重写。

完整集成命令（原脚本未修改）：

```bash
bash scripts/memory/run_qa.sh /bin/bash scripts/verify_multi_objective_integration.sh \
  /www/server/nvm/versions/node/v24.13.0/bin/node \
  /home/sigaer/taiko/taiko-forum/taiko_viewer/node_modules/typescript/bin/tsc \
  /home/sigaer/taiko/taiko-forum/taiko_viewer/node_modules/@types \
  /var/tmp/taiko-batch21-20261124/installed-rc9/bin/python \
  /var/tmp/taiko-batch21-20261124/core/tests
```

## 限制与停止边界

本轮是离线输入契约修复。快照中 mode/platform 为 null 仍可表达未知，但不能支持皇冠 Ready-Now/Stretch，也不能据此跨范围认定 TARGET_ALREADY_MET。TARGET_ALREADY_MET 只是候选拒收信息，不执行 Goal 完成更新。

显式 score-pb baseline 在本批只支持上述 goal_baseline 类型；sourceRevision 必须匹配当前 candidate/context 的 scoreRevision，历史版本不匹配时明确拒绝，不自动刷新或重建用户 baseline。没有新增历史 baseline 转换、持久化或 Goal API。payload SHA-256 绑定内容，不等同于来源认证。

[性能对照](review-fix-performance.md) 使用合成 score-pb Goals；没有实测真实 Crown producer、生产吞吐或在线尾延迟。本轮不要求也未实施 5,000 候选性能优化。

未修改 B3 或现行推荐、未接生产请求、未修改数据库或真实玩家数据、未实现 Goal API/UI、未访问 Taiko Agent、未合并 main、未部署。候选提交推送后等待最终审查。

最终边界审计 run `qa-9176d0bf19e3`：PASS，exitCode=0、processExitCode=0、childrenStopped=true、stopReason=null；确认 12 个原 B4 测试/fixture 文件、23 个原证据文件不变，near-evidence 函数逐字节不变，29 个报告链接有效。manifest/output 同样归档于本轮证据目录。审计脚本为 [review-fix-audit.py](evidence/review-fix-audit.py)，执行方式为 `bash scripts/memory/run_qa.sh /usr/bin/python3 docs/batch4/implementation/evidence/review-fix-audit.py "$PWD"`。
