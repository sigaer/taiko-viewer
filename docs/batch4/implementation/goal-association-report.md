# Goal Association Report

`associateCandidatesWithPortfolio` 只读输入已验证 Candidate 和 GoalPortfolioSnapshot，返回 detached copies 与 diagnostics。context 包含 owner/profile/portfolioRevision/updatedAt；重复 Goal ID 或不一致 revision 拒绝整批关联。

按 canonical chartId、GoalType 对应 subtype、完整 Target 及 targetHash 精确匹配；复核 mappingRef、goalRevision、baselineRef、独立 actionability/evaluationRef。score-pb 绑定原 baseline+1，NG 绑定对应 baseline，不能拿相同 Chart 上另一个 target 的证据关联。

同 Chart 的多个 Goals 保留 ID、baseline、evaluation、lifecycle、availability、userPriority 和 userOrder。算法优先级 A/B/C/D 不写回用户排序。active+available 才能提序；paused、completed、cancelled、unavailable 可作为独立上下文保留，完成一个不取消另一个。

旧 Goal 缺 canonical mapping/target 时只报 `LEGACY_GOAL_IDENTITY_OR_TARGET_UNKNOWN`，保留原 snapshot；不按旧数字或标题猜测，不补 baseline，不新建 Goal。不同 GoalType/target 分别形成候选，之后只在卡片层聚合。

G01 验证 score-pb 与 DF 同时 active、两 baseline/两 evaluation；G05 **仅纯函数子场景**验证相同输入关联幂等、同 ID 冲突和篡改 revision 拒绝；G09 验证终态/暂停/不可用状态不被改写、建议不落 Goal。输入哈希前后相同。真实 CAS、nonce/token 并发、事务 rollback、旧数据库迁移均未实现或测试。
