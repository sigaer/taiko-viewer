# Schema and Migration

`web_player_goals` 仍为唯一 Goal 内容来源。V2 增加 schema/revision、priority/order、availability 状态和检查来源列；移除 `uniq_goal_active_binding` 与 `active_binding_id`，原历史列保留。Goal JSON 为完整 V2 Envelope，不增加另一份可写 activeGoal。

新增 InnoDB 表：

| 表 | 身份与用途 |
| --- | --- |
| web_goal_portfolios | `(user_id,binding_id)` 主键，BIGINT UNSIGNED revision |
| web_goal_portfolio_commands | owner/binding/command 主键；owner/binding/nonce 唯一键；原始 request hash、前后 revision、响应 |
| web_goal_portfolio_events | 稳定 event ID、owner/binding/goal/command/type 唯一约束，按 Goal/revision 索引 |
| web_goal_schema_revisions | capability=`goal-portfolio`，revision=`goal-portfolio/2`；最后激活 |

`portfolio-schema.ts` 的运行时检查只有 SELECT：表/列、InnoDB、revision 类型、精确唯一键、binary command/nonce 身份、旧索引/生成列缺失、版本标记。`account-schema-runtime.ts` 在 V2 不要求旧单活动约束；显式 bootstrap 也按版本选择共享历史列定义，旧迁移工具拒绝 V2，避免恢复旧约束。

版本化入口 `taiko_viewer/scripts/migrate_goal_portfolio_v2.ts`，实现位于 `server/services/goals/migrations/portfolio-v2.ts`。稳定 migrationKey=`viewer-goal-portfolio-v2-20261125`。默认 dry-run，写入必须 `--apply`。本候选工具仅接受 `_test` 配置，连接后再验证实际 `SELECT DATABASE()`；apply 同时要求 `TAIKO_ALLOW_TEST_DB_MUTATION=1`。没有生产 apply 开关。连接参数和 fixture Catalog 路径均须显式设置，不能使用普通运行配置作为隐式来源。

流程：全记录 preflight → 获得独立迁移锁 → 扩表/列 → 逐 Goal 事务回填与 legacy_migrated 事件 → 行数/原 Baseline/完成证据核验 → 移除旧约束 → 激活 marker → capability 验证。DDL 隐式提交，不宣称单事务可回滚；每阶段检查实际结构，逐行事务允许中断后恢复；回填同样按 owner/bindings/portfolio/Goal 顺序锁定，复验完整旧记录摘要和生命周期，拒绝 preflight 后的并发变更。活跃 V2 再运行只验证能力并报告 already-active，不重写后续正常业务变化。

迁移保留 ID、完整 legacyRecord、来源字段、原 Baseline 数值与 sourceRevision、完成证据和时间、cancelled/completed 历史。旧 false availability 保留 unknown，旧 true 为 unavailable。按冻结 Authority 的显式来源别名解析 canonical ID；无唯一合法映射则 chartId=null、CHART_ID_UNRESOLVED，保留历史。Baseline binding 从原冻结记录一次性构造，缺少可信 provenance 则 binding=null 并诊断证据不足，绝不读取当前玩家快照补历史。

迁移验证仅在 QA 内启动的独立 MySQL、全合成 `viewer_b42_test` 中执行。生产 Schema、玩家 Goal 与 Baseline 均未迁移。未来生产切换仍须独立审查、停写窗口、备份/恢复方案和单独明确授权；不能在已有多个 active 后恢复单目标 writer。
