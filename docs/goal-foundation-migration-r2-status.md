# 0.69.0 Goal Foundation — Migration R2

2026-09-19。R2 取代 R1 的外键方案；不再要求 REFERENCES。当前状态：全部生产 Gate PASS，0.69.0 GOAL FOUNDATION COMPLETE。发布提交 `b8a545e` 已推送 origin/main 并通过标准脚本部署。

## 实施结果

- `web_player_goals` 没有 FOREIGN KEY、REFERENCES 或 ON DELETE CASCADE。
- 保留 InnoDB、utf8mb4、typed columns、DATETIME(3)、LONGTEXT snapshot、generated active_binding_id 和单列 UNIQUE。
- Goal 表仅由显式 migration 创建，已从普通 `ensureAccountSchema` 初始化移除。
- Goal mutation 先锁 Web user，再锁该用户的 binding 并重验 current identity。读查询同时 JOIN owner/binding，意外 orphan/mismatch 也不会被返回。
- expectedActiveGoalId 非空且过期时，在相同目标的幂等判断前返回 conflict；初次相同目标并发仍返回同一 active。
- privacy cleanup 与 binding/user deletion 在同一事务内完成。普通 Goal cancel/replace 仍保留 cancelled 历史。
- baseline v1、SHA-256、六种类型、Today Plan revalidation、Overview 合并和 UI 均保持；无 Evaluation，无 Daily Progress 算法修改。

## 生命周期入口审计

| 入口 | R2 处理 |
| --- | --- |
| 普通 removeBinding | deleteBindingsWithGoals：user/binding lock → Goal cleanup → song locks/binding delete → commit |
| manual detach（Viewer） | 同一 helper，限定 owner/taikoId/manual source |
| manual permanent delete | 对既有 Viewer owner 调用同一 helper；保留原文件归档及 bot/manual account 清理行为 |
| Web user 正式删除 | 当前无自助入口；提供 deleteUserWithGoals / deleteUserAndGoalsInTransaction / connection wrapper |
| cleanup_forum_mock | 已接入事务内账户 cleanup helper，提前锁定待删除用户 |
| verify_annual_e2e 的过期/最终 fixture account 删除 | 改为账户 cleanup helper；未运行 Annual e2e，不改变 Annual 产品功能 |
| seed_ugc_test_fixture | 仅隔离测试用途；Goal 表存在时先清理对应用户 Goal，避免无 FK 遗留 |
| 其他既有 integration tests | 为专属 fixture 用户的直接删除；不是正式生产入口。本次 Goal 用例用统一 lifecycle helper |

## 实际数据库证据

- 实际 `SELECT DATABASE()`：`taiko_annual_poster_test`；MySQL `8.0.24`。
- 实施前 information_schema：Goal table 0，Goal indexes 0，没有旧 partial table/index。
- mutation opt-in：`TAIKO_ALLOW_TEST_DB_MUTATION=1`；未增权，未使用生产库跑 mutation tests。
- 无 FK CREATE 成功。首轮 introspection 发现 MySQL 8.0.24 在 GENERATION_EXPRESSION 中返回转义引号；修正规范化后确认实际表达式准确。没有修改生成列来迁就测试。
- 重复 migration PASS，且在已有 active row 时再次执行 CREATE IF NOT EXISTS 两次，记录保持不变。
- schema introspection PASS：engine/charset、主键、typed columns、NOT NULL、生成表达式、单列唯一索引、无 FK、DATETIME(3)。
- 原始 schema / migration 报告：`/var/tmp/goal-foundation-r2/migration-test-first.json`、`migration-test-second.json`。

真实 SQL 验证：create/read、新连接 read、replace/cancel、cancelled retained、相同请求幂等、不同目标并发仅一个成功、同目标并发同一 id、stale cancel/replace（包括目标相同但 expected id 已过期）、User A/B 与 Binding A/B/C 隔离均 PASS。

数据库直接重复 INSERT 触发 1062；active → cancelled 后 generated 值为 NULL，之后可再次创建 active；多条 cancelled 历史共存。孤儿检测用专属 synthetic 错误行验证三类异常可被识别，再清理，最终 user orphan / binding orphan / owner mismatch 全部为 0。

## Authenticated lifecycle

真实 MySQL + 实际 H3 routes + production account/session/binding/Goal service：PASS。

用 synthetic account 密码经实际 loginAccount 创建数据库 session；GET Overview → POST Goal → GET 同一 Goal → logout 拒绝旧 session → 新 login session 保留 Goal → A/B switch → replace → stale requests → cancel → cancelled SQL history → ordinary unbind → manual detach/permanent delete → user cleanup。

仅配置、公开 catalog 与 Python 推荐输入使用测试边界；auth、session、ownership、文件基线读取、Goal source validation 与 SQL persistence 不替换成 synthetic store。未复制生产用户数据。fixture 所有用户和 userdata 文件已清理。

## 生产迁移前检查

- 线上 HTTP 200，canonical visible version `0.68.12`。
- 实际 production DB `taiko`，MySQL `8.0.24`。
- 现有 Goal 表不存在；无 partial Goal schema。
- 当前专用账号具备 CREATE / ALTER / INDEX；不需要 REFERENCES。
- 现有 daily admin backup 仅覆盖歌曲/封面和 admin tables，并不声称覆盖新增 Goal 数据。本次为纯新增空表，保存不存在状态及 DDL 前后审计；不更改原有 user/binding 表或数据。
- 回退约定：代码发布使用标准脚本的 previous output；新增表保留，不自动 DROP，不丢弃已产生的 Goal 历史。仅清理本次隔离 smoke 用户的数据。
- 只读 preflight：`/var/tmp/goal-foundation-r2/production-preflight.json`。

## 发布 Gate（最终结果）

- 生产 migration：PASS；首次创建及第二次幂等执行均通过。
- 标准 deploy：PASS；线上 canonical version 0.69.0。
- production create/reload/login/switch/replace/stale/cancel/cancelled-history/cleanup：PASS。
- production orphan audit：PASS，三类计数全部为 0。
- 已满足 COMPLETE 与 READY FOR 0.69.1 条件；本次未开始 Evaluation。

生产 smoke 使用独立临时 Web user 和两个 score profiles，成绩由公开歌曲目录构造 synthetic fixture，不复制真实用户数据。通过真实登录与线上页面操作验证 Goal；随后经正式 cleanup helper 清除账号/Goal，再删除该次自建 userdata。生产 smoke 不承担上游同步完整性验证。

## R2 验收问题逐项记录

| # | 问题 | 当前证据 / 结论 |
| --- | --- | --- |
| 1 | 移除 REFERENCES | 是，DDL 无 REFERENCES |
| 2 | SHOW CREATE TABLE | 下方为真实测试库输出；生产最终输出见下方 |
| 3 | FK | 0 |
| 4 | generated expression | CASE WHEN status = 'active' THEN binding_id ELSE NULL END，STORED |
| 5 | UNIQUE | 直接重复 INSERT 返回 1062 |
| 6 | 幂等 migration | PASS，既有 active 保持 |
| 7 | REFERENCES 权限 | 不需要 |
| 8 | SQL create/read/cancel/replace | PASS |
| 9 | 并发 create | 不同目标一成功一冲突，同目标返回同一 id |
| 10 | stale replace | conflict，包括同目标旧 expected id |
| 11 | stale cancel | conflict，不影响新 Goal |
| 12 | same-goal 幂等 | PASS |
| 13 | Binding A/B | PASS |
| 14 | User A/B | PASS |
| 15 | unbind cleanup | PASS；含 create/unbind 并发、manual detach/permanent delete |
| 16 | user cleanup | PASS；显式删除 Goal/session/binding/song locks |
| 17 | user orphan | 测试库 0；生产最终审计 0 |
| 18 | binding orphan | 测试库 0；生产最终审计 0 |
| 19 | owner mismatch | 测试库 0；生产最终审计 0 |
| 20 | baseline revision | baseline v1 / SHA-256 保持 |
| 21 | Today Plan revalidation | 保持，提交重新计算并核对当前文件 revision |
| 22 | 六种类型 | score-pb / ng-reduced / clear / fc / df / rank-upgrade |
| 23 | 未游玩 completeness | runtime unknown，未开放；仅纯逻辑支持 complete source |
| 24 | manual / accuracy | 仍关闭 |
| 25 | activeGoal Overview | 是 |
| 26 | 额外 Home GET | 未新增独立 Goal GET；mutation 本地更新 |
| 27 | authenticated lifecycle | 真实 SQL/session/H3 与线上均 PASS |
| 28 | production migration | PASS，二次幂等 PASS |
| 29 | production smoke | PASS，含重新登录、替换与 stale conflict |
| 30 | production orphan audit | PASS，0 / 0 / 0 |
| 31 | Viewer 版本 | 源码与线上均 0.69.0 |
| 32 | Evaluation | 未实现 |
| 33 | Daily Progress | 未改变算法；用户既有修改不纳入发布 |
| 34 | 正式关闭 | 是，所有生产 Gate PASS |
| 35 | READY FOR 0.69.1 | READY FOR 0.69.1 GOAL EVALUATION |

54 项回归、2 项真实 SQL/authenticated integration、Goal 核心严格 TypeScript 检查均 PASS。12 个浏览器 fixture 场景已通过。

### 实际测试库 SHOW CREATE TABLE

```sql
CREATE TABLE `web_player_goals` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `binding_id` bigint unsigned NOT NULL,
  `song_id` int unsigned NOT NULL,
  `difficulty_type` tinyint unsigned NOT NULL,
  `goal_type` varchar(24) NOT NULL,
  `source` varchar(24) NOT NULL,
  `source_basis` varchar(32) DEFAULT NULL,
  `source_mode` varchar(24) NOT NULL,
  `source_rank` tinyint unsigned NOT NULL,
  `source_revision` char(64) NOT NULL,
  `source_generated_at` datetime(3) NOT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'active',
  `active_binding_id` bigint unsigned GENERATED ALWAYS AS ((case when (`status` = _utf8mb4'active') then `binding_id` else NULL end)) STORED,
  `baseline_version` int unsigned NOT NULL DEFAULT '1',
  `goal_data` longtext NOT NULL,
  `created_at` datetime(3) NOT NULL,
  `updated_at` datetime(3) NOT NULL,
  `cancelled_at` datetime(3) DEFAULT NULL,
  `completed_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_goal_active_binding` (`active_binding_id`),
  KEY `idx_goal_owner_profile` (`user_id`,`binding_id`,`status`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

### 发布资源 Gate（历史阻塞，现已解除）

发布索引快照已准备，保留并排除用户现有无关工作区修改。`run_build.sh` 的内存余量保护连续拒绝启动构建：可用约 12908 MiB，要求约 12956 MiB。未绕过保护，未终止其他进程；生产 migration、release commit、标准 deploy 与线上 smoke 尚未执行。此处是资源准入阻塞，不是 REFERENCES 或 SQL blocker。

## Production Release Gate — 2026-09-19 续验

- 内存自然释放后标准 wrapper 放行：MemAvailable 13,289,584 KiB；required 13,266,778 KiB。Swap total 25,165,820 KiB / free 13,963,944 KiB。主要占用为 Python、Node、编辑器 MainThread、BT-Task 和 MySQL；仅记录，无进程清理。
- 标准 `run_build.sh` 构建既有 staged release snapshot：PASS，日志 `/var/tmp/goal-foundation-r2/build-staged.log`；构建期间 cgroup oom/oom_kill 为 0。
- `git diff --check` 与 staged check PASS。源码 canonical version 0.69.0。
- 仅补齐生产 smoke 验证脚本的 logout/login、replace、stale conflict、TTFB/total、取消耗时和残留检查。本轮没有 Goal 业务、schema、UI 或 Daily Progress 改动。
- 此时生产 Gate 尚待执行；其后已全部 PASS，最终证据见下方。以上资源阻塞记录保留为历史证据。

## Production Release Gate — 最终关闭

- 发布提交：`b8a545e`（`0.69.0 新增自主练习目标与持久化基线`），已 push origin/main。
- 顺序：staged snapshot 标准隔离构建 PASS → 提交/push → 生产只读 preflight → 显式 migration → 二次幂等 migration → 标准部署 → 生产 smoke → 正式 cleanup → 最终只读 orphan audit。
- 部署命令：`bash scripts/memory/run_build.sh /bin/bash scripts/deploy_forum_web.sh '0.69.0 新增自主练习目标与持久化基线'`，exit 0。未绕过 memory guard，未调整阈值，未清理无关进程。
- Viewer / sync receiver：active；`/`、`/more`：200；真实浏览器 `/more` 可见 canonical version `0.69.0`。Growth Overview 未登录为 401，真实登录后为 200。
- 生产 MySQL 8.0.24 / database `taiko`；迁移前无 Goal table；principal 已有 CREATE/ALTER/INDEX，无需 REFERENCES。首次 apply 与第二次 apply 均无 schema errors。生产 schema 验证没有写普通用户 Goal。
- `SHOW CREATE TABLE` 验证 FK=0，生成列 STORED，唯一 active binding 索引及 owner/profile/status 索引完整，所有时间列 DATETIME(3)。
- 临时独立用户初始 activeGoal=null；真实 Today Plan UI create、Overview/read/reload、logout/login、A→B→A 隔离、replace、stale replace/cancel 409、UI cancel、reload null 全部 PASS。清理前 SQL cancelled 历史为 2，未写 completed。
- 正式 lifecycle helper 清理后：Web user / binding / session / Goal 残留均为 0；自建 userdata 文件残留 0，临时凭据文件已删除。最终 user orphan / binding orphan / owner mismatch = 0 / 0 / 0。
- 性能（隔离 synthetic 用户单次 smoke，非负载测试）：Overview TTFB 512–756 ms，total 513–757 ms；create 到可见 709 ms；cancel HTTP 190 ms。
- Cache-Control `private, no-store`、Vary `Cookie` 检查 PASS；extra Goal GET=0；create 未增加 Overview GET，滚动位置保持；无原始 Goal 翻译 key，无 JS/hydration error。
- 用户原有跟踪文件临时收起后恢复，逐文件 SHA-256 与操作前一致；未跟踪文件未纳入发布。构建/QA 隔离进程均已退出。
- 可选百度收录推送返回每日 quota 超额；标准部署脚本正常完成，不影响产品 Gate。

### 生产最终 SHOW CREATE TABLE

```sql
CREATE TABLE `web_player_goals` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `binding_id` bigint unsigned NOT NULL,
  `song_id` int unsigned NOT NULL,
  `difficulty_type` tinyint unsigned NOT NULL,
  `goal_type` varchar(24) NOT NULL,
  `source` varchar(24) NOT NULL,
  `source_basis` varchar(32) DEFAULT NULL,
  `source_mode` varchar(24) NOT NULL,
  `source_rank` tinyint unsigned NOT NULL,
  `source_revision` char(64) NOT NULL,
  `source_generated_at` datetime(3) NOT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'active',
  `active_binding_id` bigint unsigned GENERATED ALWAYS AS ((case when (`status` = _utf8mb4'active') then `binding_id` else NULL end)) STORED,
  `baseline_version` int unsigned NOT NULL DEFAULT '1',
  `goal_data` longtext NOT NULL,
  `created_at` datetime(3) NOT NULL,
  `updated_at` datetime(3) NOT NULL,
  `cancelled_at` datetime(3) DEFAULT NULL,
  `completed_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_goal_active_binding` (`active_binding_id`),
  KEY `idx_goal_owner_profile` (`user_id`,`binding_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

### 证据文件（本机，不含凭据）

`/var/tmp/goal-foundation-r2/` 下：

- `release-resource-preflight.json` / `release-resource-recheck.json` / `release-resource-final.json` / `release-memory-consumers.txt`
- `build-staged.log` / `deploy.log`
- `production-preflight.json` / `migration-production.json` / `migration-production-second.json` / `production-final-audit.json`
- `production-goal.json` / `production-lifecycle.json` / `production-smoke.log`
- `health-final.json` / `production-goal.png` / `production-more.png`

### 最终状态

```text
0.69.0 GOAL FOUNDATION COMPLETE
NO-REFERENCES GOAL SCHEMA ACCEPTED
APPLICATION-OWNED GOAL LIFECYCLE ESTABLISHED
ONE ACTIVE GOAL PER BINDING ENFORCED
REAL SQL PERSISTENCE / CONCURRENCY ACCEPTED
PRODUCTION GOAL MIGRATION ACCEPTED
PRODUCTION CREATE / RELOAD / CANCEL SMOKE PASSED
GOAL OWNERSHIP / CLEANUP ACCEPTED
TODAY PLAN → GOAL SOURCE ATTRIBUTION ACCEPTED
AUTHORITATIVE GOAL BASELINE PERSISTED
GOAL SURVIVES RELOAD / LOGIN / DEVICE
GOAL EVALUATION NOT YET ENABLED
READY FOR 0.69.1 GOAL EVALUATION
```

“DEVICE”证据指服务端持久化、新 SQL 连接、新 session 的可恢复性；未宣称测试第二台实体设备。未游玩目标仍未在 runtime 开放，因为尚无服务端 complete source coverage 证明；manual / accuracy / probability / arbitrary numeric targets 均未开放。下一阶段授权前不启动 Evaluation。
