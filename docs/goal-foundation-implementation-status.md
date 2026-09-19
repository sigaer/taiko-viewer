# 0.69.0 Goal Foundation — Implementation status

最新进度：[Migration R2 status](goal-foundation-migration-r2-status.md)。R1 REFERENCES 阻塞已由获批的无外键 R2 方案解决，以下 R1 记录保留历史背景。

2026-09-19。审计 R1、迁移与六种 V1 类型已获用户批准。本文件记录实施证据，不代表发布完成。

## 已实现

- `web_player_goals` schema：每个 binding 的 active generated column 唯一索引，user/binding 外键级联删除。
- SQL transaction + binding 行锁；expectedActiveGoalId 冲突检查；同一 active song/difficulty/type 幂等；取消/替换保留 cancelled 行。
- Goal baseline v1 冻结 authoritative 文件读取结果、内容 SHA-256 revision、读取边界和可用记录时间；createdAt 单独保留 UTC 毫秒值。
- 仅从服务端重新计算的 Today Plan 创建，校验候选、谱面 availability、类型及成绩 revision。客户端不能指定 owner、taikoId 或 source。
- source/basis/mode/rank/revision/generatedAt 保存；source metadata 为 typed SQL columns，完整 baseline/target/展示快照在 goal_data JSON 文本内。
- Goal 合入 Growth Overview；POST/DELETE `/api/account/growth/goal`，成功及错误响应 private, no-store，Vary: Cookie。
- 六种选项 score-pb、ng-reduced、clear、fc、df、rank-upgrade，按 baseline 排除已达成/证据缺失项；无 accuracy、概率或任意生成数字目标。
- 首页轻量选歌 action、无默认选择的 radio dialog、显式替换确认、即时 Goal 更新、取消、下架提示。mutation 不新增 GET、不滚动到顶、不切换整个首页 skeleton。
- Growth 客户端状态按 user/binding 区分，切换时清空并丢弃旧请求；mutation 响应也有 generation/profile 检查。
- zh/ja 文案；dialog Esc、返回焦点、显式 Tab 循环。未实现 Evaluation，未改 Daily Progress 算法。

## 未游玩来源的实际边界

纯函数支持 server-proven complete 的 played/clear 条件。现有生产 source adapter 尚不能给出可依赖的完整覆盖证明，所以当前运行时 baseline 的 completeness 为 unknown，未游玩候选不开放。

这不是将未游玩目标从产品范围移除：后续仅可在 source adapter 提供服务端完整覆盖证据后启用。不能以 `_meta.full`、本地文件存在或 Today Plan 的 isUnplayed 替代证明。Hiroba 同步实现允许详情抓取失败后继续保存，进一步证实不能按来源名称直接标 complete。manual 继续暂缓。

## 验证记录

- 隔离生产构建：PASS（最终 runtime 源码已与构建副本比对）；dialog 焦点循环及 Home binding cache 修复已包含。
- Goal baseline/options 7 tests：PASS。
- Goal service + HTTP boundary fixtures：PASS。HTTP 测试执行实际 H3 handlers 与 production service，但 auth/storage 是 synthetic dependency，不能冒充真实 DB 登录验收。
- Goal + Growth/Daily Progress 合计 54 tests：PASS，含 17 个历史重放场景和 zh/ja 事件翻译。
- 历史 replay harness 仅补齐新增 Goal snapshot/store/DB 依赖注入，Daily Progress 输入、期望和算法不变。
- SQL store / baseline 的独立 TypeScript 检查：PASS。
- 浏览器矩阵 12/12 PASS：Ready/Balanced/Limited × zh/ja × 390×844/1440×900。覆盖选项无预选、创建即时显示、替换确认、取消、页面重新加载、A/B profile fixture、Esc/Tab/返回焦点、无额外 Goal GET、无横向溢出和 raw key。
- 真正的 SQL persistence/concurrency、登录会话持久化与生产 smoke：尚未 PASS。
- 浏览器 harness 使用实际构建 UI 与 production service 校验，存储是 synthetic fixture；刷新/账号切换结果不能替代真实数据库持久化证据。

所有已运行 QA 经 `scripts/memory/run_qa.sh`，构建经 `run_build.sh`，无重叠。构建/浏览器日志与截图位于 `/var/tmp/goal-foundation`。第一次构建副本缺少外部 schema 路径，补齐只读 schema 副本后通过。

## R1 历史阻塞（R2 已解决）

隔离测试连接已实际执行 SELECT DATABASE() 验证 `_test` 后缀，并显式设置 TAIKO_ALLOW_TEST_DB_MUTATION=1。新表 CREATE 因测试用户缺少 REFERENCES 权限失败，未创建测试业务数据；没有删除外键、添加权限或改连生产库。

已请求已有测试迁移账号的私密配置路径，或由管理员执行建表。迁移入口：`taiko_viewer/scripts/migrate_goal_schema.ts`；在 bounded QA 中加载私密 env 文件，要求实际 `_test` 与显式 mutation opt-in。账号授权与凭据不得写入命令、Git 或报告。

此阻塞只针对本次新外键 migration，不重开 Annual Phase B-0，也不将其 Gate 改回未通过。

## 发布前剩余工作

1. 最终构建、54 项回归、12 组浏览器矩阵与中日文手机/桌面截图复核已通过。
2. 迁移通路恢复后运行真实 SQL fixtures、真实 authenticated API 和 login/reload/profile lifecycle。
3. 审核最终差异，隔离已有用户未提交的历史验收改动，形成 0.69.0 release commit。
4. 用标准 `scripts/deploy_forum_web.sh` 经 run_build.sh 发布；脚本失败立即停止。
5. 生产 smoke 脚本 `verify_goal_production.mjs` 使用私密授权 session，要求无既有 active Goal；验证创建/刷新/取消/刷新并保留正常 cancelled 历史。

当前版本：实施开始 0.68.12；工作区 package/package-lock 已为 0.69.0；生产未发布。没有标记 GOAL FOUNDATION COMPLETE 或 READY FOR 0.69.1。

## 需求第 66 节逐项对应（实施中）

| 项目 | 当前答案 |
| --- | --- |
| 1–2 版本 | 开始 0.68.12；工作区 0.69.0，最终生产版待发布 |
| 3–4 身份 | session Web user.id + 服务端 current binding.id；客户端 profileId 仅作一致性检查 |
| 5–6 active / 并发 | 0 或 1；generated unique + transaction + binding lock，真实 SQL 验收待执行 |
| 7–9 来源 | 仅当前 Today Plan；服务端重算校验；保存 source/basis/mode/rank/revision/generatedAt |
| 10 baseline 字段 | recordPresent、highScore、good/ok/ng/combo、clear/FC/DF counters、rank、原始记录规范化时间、capturedAt、SHA-256 revision、completeness |
| 11–12 版本 / 时间 | baselineVersion=1；createdAt 为持久化时间，capturedAt 为读取边界；scoreObservedAt 无可匹配证据时为 null，不伪造 |
| 13–14 类型 | 六种已批准类型；manual/accuracy 暂缓，按记录字段完整性与已达成状态筛选 options |
| 15–16 未游玩 | complete 分支支持 played/clear；现有 source 缺完整覆盖证明，运行时不开放 |
| 17–19 accuracy / 概率 / 数字阈值 | 均未引入 |
| 20–21 Home read | activeGoal 合入 Overview；Goal 不新增 Home GET |
| 22–24 写入 / 替换 / 历史 | POST/DELETE growth/goal；expected id 明确确认替换；旧行 cancelled，普通取消不 hard delete |
| 25 profile switch | UI fixture 与缓存失效逻辑已通过；真实多 profile SQL 待执行 |
| 26 删除 / 解绑 | user/binding 外键级联清理，重绑不恢复旧 Goal；真实 FK 验收待执行 |
| 27 下架 | 已有 Goal 标 unavailable 并允许取消，不自动换歌 |
| 28–34 Browser / 视口 / 翻译 | Ready/Balanced/Limited × zh/ja × 390×844/1440×900，12/12 PASS；已复核截图 |
| 35 production smoke | 未部署，未运行，不标 PASS |
| 36 Evaluation | 没有实现，不自动 completed |
| 37 Daily Progress | 算法与日归因未改，回归通过；仅适配测试依赖边界 |
| 38 进入 0.69.1 | 尚未 ready，须先关闭 DB / release / production Gate |

最终 browser QA：114.6 秒，250 ms 采样峰值 704,614,400 bytes（约 672 MiB），memory.events 的 OOM/oom_kill 均为 0；临时 3197 监听端口与所属 QA cgroup 已退出。报告 `/var/tmp/goal-foundation/browser-results.json`、`browser-resources.json`；回归日志 `regression.log`。
