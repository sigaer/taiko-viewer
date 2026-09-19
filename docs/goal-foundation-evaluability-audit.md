# 0.69.0 Goal Foundation — 编码前审计

R2 更新：本文外键/级联方案已被用户批准的 [Migration R2](goal-foundation-migration-r2-status.md) 取代；数据库仅负责 active 唯一性，应用事务负责 privacy lifecycle。其他产品与 baseline 决策保持。

日期：2026-09-18。修订：R1，按用户对 Goal 因果边界的说明扩展 V1 类型。状态：用户已接受 R1 并批准 migration 与实施。审计时未执行 DDL、业务写入或部署；实施进度见 goal-foundation-implementation-status.md。此文档不是功能验收 PASS。

## 基线与范围

- 开始实施的 package.json 为 0.68.12。nuxt.config.ts 的 `appVersion` 来自 `npm_package_version || packageJson.version`，再进入 `runtimeConfig.public.appVersion`；尚未检查线上构建环境是否覆盖版本。
- 目标版本 0.69.0。只做用户主动选择、持久化和 baseline；不实现 Evaluation，不改变 Daily Progress。
- 工作区已有历史重放验收相关未提交修改，包括 package.json 新增测试命令。必须保留，不能混入本任务提交或回滚。

## 身份与生命周期

源码依据：`server/internal/account/shared.ts`、`server/utils/account/bindings.ts`、`server/utils/account/manual.ts`、`server/utils/account/qq.ts`。

- Web owner 为 session 经 `requireAccountUser` 推导的 `web_user_accounts.id`。
- 当前 score profile 为 `web_taiko_bindings.id`；同时保存服务端解析的 `taiko_id`、`source` 作为身份快照。source 支持 wahlap、hiroba、manual；manual 还关联 manual_account_id。
- `getCurrentBindingRow` 按 is_current DESC、id ASC 取第一条，存在没有显式 current 标记时的回退行为。Goal 必须与 Growth 使用同一解析规则，不能另造一套账号选择规则。
- 切换 A→B→A 不删除 binding，能够恢复 A 的 Goal。客户端不能指定任意 owner 或 taikoId。请求可携带只用于一致性检查的 profile revision，但服务器仍自行解析身份。
- 普通解绑删除 binding；manual detach 也删除 viewer binding；manual 永久删除会删除所有对应 binding，并归档成绩文件。
- 建议 Goal 对 user、binding 均使用 ON DELETE CASCADE：解绑是私有数据清理，清除该 binding 的 Goal，重新绑定不恢复；普通取消与替换则保留历史行。这避免解绑后永久 active，也防止新 owner 继承旧选择。
- 未在已审阅的 account 模块找到 Web 用户自助删除入口；数据库已有 user 外键级联规范。新增 Goal 必须保证直接删除 user 同样清理数据。

## 成绩与可判定性

源码依据：`UserdataSong`、`readUserdata`、`writeUserdataWithHistory`、`utils/dailyProgress.ts`、`server/internal/account/kinoko-import.ts`。

当前 authoritative 输入为绑定账号的 userdata 文件，按 song_no + level 定位。Today Plan item 的 difficultyType 与 level 对应；UI 展示分数不能作为 baseline。

必须冻结：recordPresent、high_score、good_cnt、ok_cnt、ng_cnt、combo_cnt、clear_cnt、full_combo_cnt、dondaful_combo_cnt、best_score_rank，以及 highscore_datetime、update_datetime。缺失保留 null，不将缺失转换为 0。baselineVersion = 1。

时间必须分开保存：

- createdAt：Goal 持久化时间，使用明确 UTC 和毫秒精度。
- baselineCapturedAt / causalBoundary：服务器读取成绩时刻及创建边界，不能声称是成绩发生时间。
- scoreObservedAt：只能来自能对应当前成绩内容的快照观察证据；不存在则 null。
- highscoreDatetime / updateDatetime：原始记录时间，保留规范化时区及来源，不用文件 mtime 或请求时间填充。

历史快照支持 full/delta，观察时间来自 _meta 或历史文件名。当前 userdata 不保证有 _meta；不能直接把最新历史文件时间赋给任意当前记录。无时区的既有成绩时间按现有 Asia/Shanghai 规则解释。若使用记录事件时间作为证据，按秒记录的同秒时间不能单独证明先后；这不否定下面的 authoritative observation 证据路径。

### Goal 的因果边界与 Daily Progress 日归因

本节按用户最新指示修订，替代初稿中要求每种 Goal 都有专属达成时间的限制，也替代原需求第 50 节被解读为“一律需要游玩事件时间”的限制。

Goal 创建时冻结的 authoritative baseline 本身构成 causal boundary。对于同一 score profile、同一谱面、同一来源语义下的单调累计/最优字段，baseline → 后续 authoritative observation 的严格增加，足以证明相对 Goal 创建边界的状态变化；不需要额外提供 crown/rank 专属达成时间。

未来 observation 必须确实在边界之后，并可与冻结 baseline 建立先后和来源连续性；不能把创建前缓存、历史重放或旧快照回填当作新的 observation。来源重置、数据修复或不完整导入不能被默认解释为正常的单调增长。保存 observation revision/provenance 是为这条证据路径服务，不是要求新增专属游玩时间。

Daily Progress 仍需回答变化属于哪一天，其既有日归因规则保持不变。Goal 状态变化的证据不能直接用于宣称某日发生了游玩。本版只冻结未来判定所需证据，0.69.1 才实现 Evaluation。

V1 开放策略：

| Goal type | 基线门槛 | 未来证据要求 / 审计结论 |
| --- | --- | --- |
| score-pb | 非 manual，已有有效 authoritative high_score | 后续 authoritative 高分严格高于 baseline；可开放，保留可用的高分时间，不因缺少该时间一律禁用 |
| ng-reduced | 非 manual，完整非负判定、总物量 > 0、NG > 0 | 后续 authoritative 成绩的相同完整物量下 NG 严格降低；只能解释为保存成绩中的不可降低，不能猜历史最低 NG；可开放 |
| clear | 非 manual，完整有效 crown counters，尚无通关或更高 crown | 后续 clear_cnt 严格增加并达成通关，或由更高 crown 的 authoritative 状态证明达成；可开放 |
| fc | 非 manual，完整有效 crown counters，尚无 FC/DF | 后续 full_combo_cnt 严格增加并达成 FC，或由 DF 的 authoritative 状态证明达成；可开放 |
| df | 非 manual，完整有效 crown counters，尚无 DF | 后续 dondaful_combo_cnt 严格增加并达成 DF；可开放 |
| rank-upgrade | 非 manual，authoritative rank 1–7 | 后续 best_score_rank 严格增加（有效范围内，最高 8）；可开放，无须专属评价达成时间 |
| 未游玩谱 | recordPresent=false，且已证明 source 为完整 authoritative state | 可开放 played（“先打一次”）或 clear（“试试通关”）；后续同源 authoritative 记录出现/通关状态构成判据。不完整或完整性未知的 source 不开放 |
| manual | 时间由 upsertManualScore 写为录入时间 | 不证明真实游玩时间；V1 暂不开放 Goal，保留原有 Today Plan |

manual、accuracy 继续暂缓；禁止概率 Goal、任意目标数值。不引入新计算器。缺失字段仅排除依赖它的 Goal option，不能将缺失值转换为 0 或因为缺少专属达成时间排除全部类型。不能把此源码审计等同于所有来源的运行时验证。

### 未游玩候选的 source 完整性门槛

source 名称为 Wahlap/Hiroba、本地存在 userdata 文件、Today Plan 的 isUnplayed=true，均不足以单独证明完整性。`readUserdata` 会把缺失 songs 转为空数组；`writeUserdataWithHistory` 会给本地完整文件快照写 full=true；Kinoko 导入会按字段合并成绩。这些机制不能单独证明上游已经完整覆盖该 profile 的成绩范围。

实现必须由服务端确认并冻结 source completeness 证据：来源/profile、覆盖范围、成功完成的完整同步或等价契约、observation/revision。baseline 中保存 `sourceCompleteness: complete | partial | unknown` 及对应 provenance；不得信任客户端提供的 complete 标记。只有 complete 覆盖当前候选时，recordPresent=false 才可作为未游玩基线。

recordPresent=false 仍按原样保存，不伪造一条全零成绩。played 的 target 是后续记录存在，clear 的 target 是后续通关状态；不宣称“人生首次游玩”。具体来源适配器是否满足 complete，须在实现时用契约和 fixture 验证，不预先将全部 Wahlap/Hiroba 账号判为 complete。

## 推荐来源与创建一致性

源码依据：`server/services/account/growth.ts`、`types/player-growth.ts`。

- 当前 Today Plan 最多 3 首，由 runGrowthPythonJson 产生，之后结合 catalog、current score 和 playerState 转为 DTO。
- 当前 DTO 没有 generatedAt/revision。添加服务端生成的 revision，涵盖 profile、候选、basis/mode 和相关成绩状态；它用于过期检查，不作为授权凭证。
- POST 必须重新解析 session/current binding，并使用与 Overview 相同的 Today Plan 生成函数验证 songId + difficultyType；服务器计算 sourceBasis、sourceMode、sourceRank。
- 保存 source=today-plan、basis（允许 null）、mode=dimension/general-fallback、rank=1..3、sourceGeneratedAt、sourceRevision。不保存整份推荐列表。
- POST 最终重新读取 authoritative score、验证可用类型和谱面状态。Python 读取与 Node 读取不是一个数据库事务；需要前后内容 revision 检查，变化则返回 409，不能把先前显示的 baseline 当最终数据。
- 现有 userdataWriteLock 仅为进程内队列，不能宣称它锁住外部同步进程。实现需明确“创建瞬间”的快照线性化点，并拒绝检测到的数据变化。
- catalog 有 shelf_status 和各难度星级；创建必须复用现有上架语义并确认难度存在。已有 Goal 下架后只标 unavailable，保留取消操作。

## 迁移方案（已批准）

源码依据：`server/utils/account-db.ts`。没有统一版本号 migration runner；现有规范是 ensureAccountSchema 顺序执行 CREATE TABLE IF NOT EXISTS 与 ALTER migrations。调用该函数会产生 DDL，审计期间未调用。

- 新表 `web_player_goals`，InnoDB / utf8mb4，BIGINT UNSIGNED 主键与外键。
- typed 字段：user_id、binding_id、song_id、difficulty_type、goal_type、status、source、source_basis、source_mode、source_rank、source_revision、baseline_version、created_at、updated_at、cancelled_at、completed_at。
- baseline_data、target_data、身份/展示快照使用 LONGTEXT JSON，服务端严格校验和 version=1。baseline 同时保存来源完整性、覆盖范围及 observation provenance/revision。target 仅保存相对比较或 crown/record-present 条件，不生成任意分数阈值。账户模块主要使用 LONGTEXT JSON；部分 annual-beta 使用原生 JSON，不代表全项目统一原生 JSON。
- 时间使用显式 UTC DATETIME(3)，避免当前 pool 未设置 timezone 与默认 DATETIME 秒级精度造成因果歧义。读写必须验证驱动转换，不能直接沿用无时区字符串。
- 生成列 active_binding_id = CASE WHEN status='active' THEN binding_id ELSE NULL END，加 UNIQUE 索引作为一 binding 最多一 active 的数据库约束。实际 MySQL 版本兼容性在隔离库验证。
- mutation 使用 transaction + binding 行锁，重新核对 current identity。相同 song/difficulty/type 已 active 返回 existing；替换必须带 expectedActiveGoalId，旧行 cancelled 后插入新行，事务提交。过期确认返回 409，不覆盖他人的新选择。
- 并发 A/B 创建只允许一条成功，另一条返回 conflict。客户端 disable 仅改善交互。
- 取消也带 expectedActiveGoalId，防止延迟请求取消后来新建的 Goal。

## API / 浏览器接入

- activeGoal 合入现有 `/api/account/growth/overview`，不新增首页 GET。
- `/api/account/growth/goal` POST 创建/替换，DELETE 取消；设置 private, no-store 与 Vary: Cookie，错误路径也不能 public cache。
- Today Plan item 添加 goalOptions 类型 key；翻译留在 Viewer。无可用选项显示必要状态说明。
- usePlayerGrowth 当前缓存 key 只有 Web userId；必须加入当前 binding identity，并在账号切换时清除旧展示、屏蔽旧请求的迟到响应。
- 使用轻量 selector 和 compact activeGoal，保留整卡导航、Today Plan 和 Daily Progress。选择无默认 goalType，替换明确确认；本版永不写 completed。

## 实施与验收顺序

1. V1 六种 Goal 的扩展范围按用户最新指示确定；按已批准的修订审计推进迁移与实现，先纯函数/DTO、持久化和 API，再接 UI。未游玩选项按 source completeness 门槛开放。
2. 按需求第 54–57 节建立隔离 DB 与浏览器矩阵，额外覆盖 stale profile、stale replace/cancel、同步期间 baseline 变化；覆盖六种 option 的基线门槛、已达成排除、缺失字段、complete/partial/unknown 未游玩来源、manual 禁用。固定单调字段 baseline 与后续 observation 的兼容性样例供 0.69.1 使用，本版不执行自动完成判定，也不改 Daily Progress 日归因。
3. 所有 DB 测试先实际 SELECT DATABASE() 验证 `_test`，再要求 TAIKO_ALLOW_TEST_DB_MUTATION=1；私密配置不写入文档或命令。
4. QA 使用 scripts/memory/run_qa.sh；浏览器单页、超时、finally 清理。检查 zh/ja 与两种视口。
5. 验收后版本提升至 0.69.0，按标准部署脚本发布，生产隔离测试账号完成 create/reload/cancel/reload 并恢复。

本审计不作为实现或验证证据；实施与剩余 Gate 见 [implementation status](goal-foundation-implementation-status.md)。真实 DB/API、browser、性能与线上 smoke 未全部通过前，不得记录 COMPLETE 或 READY FOR 0.69.1。
