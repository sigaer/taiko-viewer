# 0.69.1 Goal Evaluation — Implementation status

2026-09-19。当前：实施及隔离验收进行中，未部署，不能声明 COMPLETE。开始版本 0.69.0，目标 0.69.1。

先行审计见 [Evaluation Trigger Audit](goal-evaluation-trigger-audit.md)。采用 B：authenticated POST `/api/account/growth/goal/evaluate`，用户从当前 Goal 的“确认进展”触发。服务端读取当前文件并核对 owner/current binding/expected Goal；拒绝客户端成绩事实。GET Overview 保持只读，不增加独立 Goal GET。

## 实现

- 纯 evaluator：`evaluateGoal(goal, observation)` 返回 completed / active / inconclusive；冻结 before / after / delta / 实际 crown facts。
- 验证 Python writer schema v2 的 source/account/topology、content_sha256、同步标记和 baseline revision。保留原始数字 token，兼容 ujson 的 1.0 与斜线编码；不把 mtime、请求时间当新成绩证据。
- 来源仅接受校验通过的 Wahlap/Hiroba envelope，拒绝导入标记、合并来源、chart lock、内容编辑、时间倒退、同 revision、缺字段及累计/best 字段回退。新 Goal 冻结来源；0.69.0 旧 Goal 缺少来源时 inconclusive，不补造。
- 来源校验仅在 Goal 创建/evaluation 做；普通 Overview 不增加完整校验计算。
- owner→binding→Goal 行锁与现有 mutation 保持顺序，CAS active→completed；重复完成不改 completedAt/evidence，旧 completed 后已有新 Goal 时请求 conflict。取消/完成历史不可逆。
- 无 SQL schema migration；completed_at 是 Viewer 确认时间，完整 evidence 保存在 goal_data，未冒充 score event 时间。
- Overview 单独返回 recentCompletedGoal：最新 Goal completed 且没有新 active；没有 TTL。最小 zh/ja 反馈及“再选一首”，不自动创建下一目标。
- Daily Progress 和 Recommendation 算法未修改；manual、accuracy、probability、arbitrary target、runtime unplayed 继续关闭。

## 已有验证

- 71 项纯规则与既有回归 PASS，涵盖六种 replay、unchanged、边界、higher crown、真实 Python ujson 格式。
- 2 项真实 MySQL 集成 PASS：evaluate/evaluate、evaluate/cancel、evaluate/replace、完整 evidence、下一目标、用户隔离；真实 H3/auth/session 验证 POST completion、GET 只读、拒绝客户端 facts、重新登录后 evidence 保留。
- 实际 SELECT DATABASE() 为 `taiko_annual_poster_test`，显式 mutation opt-in；synthetic fixtures 清理后 orphan 为 0。未复制用户数据。
- 核心 strict TypeScript 检查 PASS。

## 待完成 Gate

- 最终构建 PASS；48 组合浏览器矩阵 PASS；间距修正后的 8 组合复查 PASS。
- 发布 scope 审计、提交、标准部署。
- 隔离生产 completion smoke、cleanup/orphan、性能数据和最终报告 28 项。

未执行任何生产 Goal completion；本文件不宣称 Evaluation 已上线。

单连接池真实 HTTP 并发重试 PASS：事务内锁谱查询复用 connection，不嵌套借连接。纯判定 10,000 次合计 32.55 ms（均值 0.00326 ms）；真实 SQL transition 6–12 ms。

生产现有 schema 只读 preflight PASS，无需 migration；未执行 DDL。发布前检查完成，生产 smoke 仍 PENDING。
