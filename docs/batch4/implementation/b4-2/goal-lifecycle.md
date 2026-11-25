# Goal Lifecycle

| 操作 | 允许起点 | 结果 |
| --- | --- | --- |
| create_manual_goal | 新身份 | 新 active，不取消其他 Goal |
| pause_goal | active | paused，Baseline/target 保持 |
| resume_goal | paused | active，不重采 Baseline，不改 availability |
| cancel_goal | active/paused | cancelled，保留证据与历史 |
| set_goal_priority | active/paused | priority 0..3 |
| reorder_goals | 全部 active/paused | 全量连续顺序 |
| 权威 evaluation | active；paused 仅显式请求 | 独立 completed，或保留原生命周期 |

completed/cancelled 是终态；不会自动复活。Availability 是 available/unavailable/unknown 独立状态，UI 展示保存的状态及目标资料；下架不会取消 Goal，缺证据不会伪装完成。目录可用性保存 checkedAt/catalogRevision；本批没有另建目录变更后台订阅。

`lifecycle.ts` 在既有解绑/删用户事务内删除 portfolio events、commands、portfolio 和 Goal。清理会探测实际新表，因此也适用于尚未迁移及部分迁移状态。删除账号还按 binding owner 清理归属不一致的残留行。普通取消不会删除任何历史。
