# B4-2 Acceptance

候选开发完成；最终用户验收待确认。基线 `a08f5a97812962d00fe8cc92192fc3b38b86d142`，分支 `candidate/viewer-multi-goal-b4-2-20261125`。

| 完成标准 | 结果 |
| --- | --- |
| 多个 active、独立 Baseline/GoalBaselineBinding | PASS，实际隔离 SQL |
| 独立 pause/resume/cancel/complete | PASS |
| Portfolio/Goal CAS、command 幂等、nonce 约束 | PASS |
| 多 Goal Evaluation 不覆盖、active/inconclusive 持久化 | PASS |
| 历史 Goal、完成证据、原来源与 Baseline 保留 | PASS，合成迁移与 hash 核验 |
| 完整 Portfolio API 与 legacy 退出保护 | PASS |
| 首页/成长页管理多个 Goal，中日文及移动/桌面 | PASS，组件/SQL/API fixture |
| 仓库长期开发原则与 AGENTS 入口 | PASS |
| 定向验证 | 29/29 集成 + 48/48 原模块，Strict Portfolio TS |
| Viewer 候选构建 | PASS，最终约155秒、日志 Node RSS 最高3965 MiB；未部署 |
| 数据库迁移状态 | 仅合成隔离 `_test` 完成；生产未连接、未迁移 |
| 发布状态 | 未合并 main、未创建正式 Release、未部署 |

推荐 V2 Producer、生产迁移工具/审批、全站真实玩家验收及完整发布回归不在本候选授权内，见 [限制](known-limitations.md)。推送后保持候选 worktree 干净，等待最终验收。
