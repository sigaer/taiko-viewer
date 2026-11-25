# B4-1 离线推荐内核验收入口

候选分支：`candidate/viewer-multi-objective-b4-1-20261124`。
基线：B3 `c49717b6b7b7f697c0975c3d1477b7abffb26b7f`；已批准 B4 契约 `a68d8bda40189f527392ffee262473699d912a41`。

本交付实现独立的确定性离线内核。生产请求、旧推荐、Goal API、数据库、UI、真实玩家数据均未接线或修改。验收通过前不启动下一实施阶段。

| 报告 | 内容 |
| --- | --- |
| [Implementation Architecture](implementation-architecture.md) | 模块、公共接口、信任边界、版本 |
| [Canonical Identity Adapter](canonical-identity-adapter-report.md) | 真 Authority 行、namespace、政策与歧义 |
| [Registry Contract](registry-contract.md) | 联合注册表、能力与 unsupported |
| [Candidate Validation](candidate-validation-report.md) | 严格 schema、证据、独立样本 |
| [Actionability / Priority](actionability-priority-report.md) | 专用输出校验、planned gate |
| [Goal Association](goal-association-report.md) | 只读多 Goal 精确关联 |
| [Slate Composer](slate-composer-report.md) | 主动作、去重、排序、历史与短缺 |
| [Golden and Regression Results](golden-and-regression-results.md) | 实际命令、结果、覆盖与未测范围 |
| [Determinism](determinism-report.md) | ID、冻结输入与排序复现 |
| [Performance Benchmark](performance-benchmark.md) | 实测方法、规模与原始样本 |
| [Known Limitations](known-limitations.md) | 未实现能力与真实证据缺口 |
| [Updated B4 Roadmap](updated-b4-roadmap.md) | 后续阶段与停止点 |

[Phase 0 接口冻结](shared-interfaces.md)先于代理实施；新增公共导出位于 [index.ts](../../../taiko_viewer/utils/multi-objective/index.ts)。

B4-1 Review Fix：基于 `f53601362b62469eb4b1d07db94421dd35a9c6d9` 修复证据范围与基线绑定，验收入口见 [修复对照与验收报告](review-fix-acceptance.md)。原实现报告与原性能测量作为历史证据保留。

B4-1 Final Review Fix（基线 `35ff18c4568e32719b14678a5f5ee0288fa32340`）：[不可变 Goal Baseline revision 修复与验收](immutable-baseline-review.md)。
