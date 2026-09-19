# 0.69.1 Goal Evaluation — Implementation status

2026-09-19。当前：全部 Gate PASS，0.69.1 GOAL EVALUATION COMPLETE。开始版本 0.69.0，最终线上 canonical version 0.69.1。发布提交 `e5795bf` 已推送 origin/main 并经标准脚本部署。

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

## 发布 Gate（最终）

- 最终构建 PASS；48 组合浏览器矩阵 PASS；间距修正后的 8 组合复查 PASS。
- 发布 scope 审计、提交、标准部署：PASS。
- 隔离生产 completion smoke、cleanup/orphan、性能数据：PASS；28 项报告见下方。

生产隔离测试已通过正式 POST 完成 1 个 PB Goal，未直接写 completed；Evaluation 已上线。

单连接池真实 HTTP 并发重试 PASS：事务内锁谱查询复用 connection，不嵌套借连接。纯判定 10,000 次合计 32.55 ms（均值 0.00326 ms）；真实 SQL transition 6–12 ms。

生产现有 schema 只读 preflight PASS，无需 migration；未执行 DDL。生产 smoke 随后完成，结果 PASS。

## 生产证据

- 标准部署：`bash scripts/memory/run_build.sh /bin/bash scripts/deploy_forum_web.sh '0.69.1 新增练习目标达成判定与完成反馈'`，exit 0。没有绕过 memory guard，没有更改部署脚本。
- 部署前 MemAvailable 14,786,608 KiB，required 13,266,778 KiB；Swap total 25,165,820 KiB / free 13,997,972 KiB。
- `taiko-viewer` / `taiko-sync-receiver` active；`/`、`/more` 为 200；真实浏览器 `/more` 可见 0.69.1。Growth 未登录 401，真实登录 200。
- 生产只读 preflight/final audit：database `taiko`、MySQL 8.0.24、schema compatible、FK=0；本版没有执行 DDL。
- 临时独立 Web user、两个 synthetic profiles；公开歌曲目录构造合法测试成绩，不复制其他用户数据。测试 envelope 模拟已审计 writer 格式，不声称发生了真实街机事件或验证了远端网站可用性。
- 初始 activeGoal=null → 实际 Today Plan UI 创建 PB Goal → 冻结 baseline/provenance → 仅更新本次自建文件为合法 future observation → GET 仍返回 active → UI 正式 POST evaluation → completed。
- 完成证据 delta=1，baseline/observation revisions 不同。刷新、logout/login 后 evidence 不变；重复 POST completedAt 不变；创建下一 Goal 成功且 recentCompletedGoal=null。没有客户端 completion facts 或直接 SQL completed 写入。
- 清理前 DB completed 历史恰好 1 条；之后经正式 lifecycle helper 删除 Goal/binding/session/user，自建 userdata 与临时凭据已删除。四类数据库残留为 0、文件残留为 0；最终 user orphan / binding orphan / owner mismatch 为 0 / 0 / 0。
- Cache-Control `private, no-store`、Vary `Cookie` PASS；extra Goal GET=0，无原始翻译 key，无 JS/hydration error。
- 浏览器矩阵 48 组合（6 types × zh/ja × 390×844/1440×900 × light/dark），包含 inconclusive、A/B、下一 Goal；局部留白修正后另有 8 组合复验，全部 PASS。UI matrix 使用 synthetic persistence，真实持久化由 SQL/HTTP/production Gates 单独证明。48 场景采样峰值 775,704,576 bytes，OOM/oom_kill=0；全部自建 QA/build cgroup 已退出。
- 用户已有四项 tracked 修改暂存后逐文件 SHA-256 恢复一致，其他未跟踪文件未纳入提交。Daily Progress 历史验收与称号数据修改保留在工作区。
- 可选百度推送每日 quota 已满；标准部署 exit 0，不影响产品 Gate。

## 最终报告（28 项）

| # | 问题 | 答复 |
| --- | --- | --- |
| 1 | 开始/最终版本 | 0.69.0 → 0.69.1，线上 `/more` 已确认 |
| 2 | Trigger | B，用户“确认进展”触发 authenticated POST；没有覆盖所有 writer 的统一 Viewer hook |
| 3 | Write paths | Wahlap dispatcher/getUserData/save_userdata、Hiroba proxy/sync/save_userdata、Kinoko score/history、writeUserdataWithHistory、account sync、网页编辑/导入、manual、dispatcher 转存；外部代码只读审计 |
| 4 | GET Overview | 只读，真实 HTTP 和生产 smoke 均验证未来观察存在时仍 active，直到 POST |
| 5 | Pure evaluator | evaluateGoal(goal, observation)；completed / active / inconclusive |
| 6 | Completion evidence | goal_data.completionEvidence：evaluationVersion=1、evaluatedAt、observationCapturedAt、observationRevision、baselineRevision、source、provenance、result(goalType/before/after/delta/facts) |
| 7 | completedAt | Viewer 确认并持久化时间；不作为实际游玩时间，没有伪造 scoreEventAt |
| 8 | Schema migration | 不需要；沿用 status/completed_at/goal_data 与 active generated unique |
| 9 | 六种规则 | PB 严格增加；NG 严格下降且完整判定总量一致且 >0；Clear/FC/DF 依据未达成 baseline 的累计/更高冠状态；rank 在 1–8 范围严格提升，baseline 8 不提供目标 |
| 10 | Higher crown | FC/DF 可满足 Clear，DF 可满足 FC；facts 记录实际 counter，不伪造 lower counter 增量 |
| 11 | Stale/same revision | 相同 revision/hash、旧/不晚于 baseline 标记、未来时钟、缓存 replay 均不完成 |
| 12 | Source discontinuity | source/account/topology、checksum、源格式、chart lock 或必要字段不能验证，以及累计/best 回退时 inconclusive；不靠 mtime/请求时间 |
| 13 | evaluate/cancel | 实际 SQL race PASS，只能产生一个终态，cancelled 不会被完成 |
| 14 | evaluate/replace | 实际 SQL race、两种确定顺序均 PASS；旧 expected id conflict，证据不会写给新 Goal |
| 15 | Duplicate evaluate | 时间/evidence 不漂移；真实 SQL、单连接池 4 个 HTTP 重试和生产 POST PASS；已有更新 Goal 时旧请求 conflict |
| 16 | Next Goal | completed 释放 generated active slot，真实 SQL/browser/production create next PASS |
| 17 | recentCompletedGoal | 最新 Goal 为 completed 且无更新 active；新 active 隐藏完成反馈，不使用任意 TTL |
| 18 | Home | “这次练成了”与曲名/谱面/PB或NG或rank变化/冠成就；“再选一首”；无 XP、奖励或新增庆典动画 |
| 19 | Daily Progress | 算法未改，未整合 Goal narrative |
| 20 | Recommendation | 排序未改，不自动创建 Goal、不切换 target dimension |
| 21 | Replay | 六种、unchanged、stale、inconclusive、重复、多成就观察 PASS；共 71 项纯规则/既有回归 |
| 22 | Real SQL | 两项大型 SQL/authenticated integration PASS，包含并发、幂等、ownership、cleanup；实际 _test DB + mutation opt-in |
| 23 | Browser matrix | 48 + 最终 8 组合 PASS |
| 24 | Production smoke | PB completion、reload、logout/login、evidence、重复 POST、下一 Goal 全 PASS |
| 25 | Cleanup/orphan | 用户/绑定/session/Goal/自建文件残留 0；三类 orphan 0 |
| 26 | Performance | pure 平均 0.00326 ms（10,000 次）；真实 SQL transition 6–12 ms；生产 evaluation HTTP 211 ms；Overview TTFB 508–573 ms、total 509–576 ms。选择 B，未增加 score sync hook 延迟；不是压力测试 |
| 27 | Evaluation enabled | 是，对可验证来源与新鲜观察正式启用；旧 Goal 不补造证据 |
| 28 | READY FOR 0.69.2 | 是；本次未开始 0.69.2 整合 |

## 来源边界与旧 Goal

内容 checksum 是受信任本地 writer 数据的完整性检查，不是远端签名，也不对任意管理员伪造文件作保证。严格拒绝未知/导入/手工来源，后续观察的顺序由 writer 标记验证，达成仍依赖 baseline→future 的严格 best-state/累计变化。没有把同步时间当精确游玩时间。

0.69.0 未冻结 score-source provenance 的 Goal 无法自动补齐过去的来源证据，保持 active/inconclusive。需要更新 authoritative 成绩后取消并重新选择，建立可验证的新 baseline。meta.full 不被提升为 server-proven complete coverage；未游玩、manual、accuracy、probability、arbitrary numeric target 仍不开放。

## 证据文件

本机 `/var/tmp/goal-evaluation/`：

- `unit.log` / `sql.log` / `pure-performance.json`
- `build.log` / `deploy.log` / `release-memory.json`
- `browser-matrix-48.json` / `browser-matrix-48-resources.json` / `browser-results.json` / `browser-resources.json` / zh-ja 截图
- `production-schema-preflight.json` / `production-final-audit.json`
- `production-evaluation.json` / `production-lifecycle.json` / `production-smoke.log` / `production-completed.png`
- `health-final.json` / `production-more.png`

## 最终状态

```text
0.69.1 GOAL EVALUATION COMPLETE
AUTHORITATIVE POST-BASELINE EVIDENCE ACCEPTED
SIX GOAL TYPES EVALUABLE
GOAL COMPLETION EVIDENCE PERSISTED
ACTIVE → COMPLETED TRANSITION ESTABLISHED
COMPLETED GOAL SURVIVES RELOAD / LOGIN
EVALUATION CONCURRENCY / IDEMPOTENCY ACCEPTED
DAILY PROGRESS UNCHANGED
RECOMMENDATION RANKING UNCHANGED
READY FOR 0.69.2 GROWTH FEEDBACK LOOP CLOSURE
```
