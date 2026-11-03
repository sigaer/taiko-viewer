# Viewer 0.83 P-A — 启动 Schema 兼容修复与发布执行工作令

**优先级：P0；范围：唯一已确认的 P-A 启动兼容障碍。不要扩展为新一轮 rc/0.82/Annual/Developer API 验收。**

## 已确认事实（不要重复证明）

- main 已通过 PR #2 合入 `7d1626805478cbb7251ab55e87fe6b3eb5c13143`；已验证的 rc.6 构建源码为 `8d915ca2724480c7a287073b742e94a83b44686a`。
- 生产仍为 0.81.12，部署和已封存回滚 SHA 均是 `777546c943b9ca196c365fffa6d1289eb558a2db`；未切换、未重启，新版认证功能未在生产验证。
- 核心数据已有一次**真实隔离恢复 PASS**：24 张表 / 10,837 行 / 53,616 个文件，原生恢复 117.325 秒，20 项业务检查通过，当前成功检查点保持不可覆盖。原生产为 legacy SQL + 文件权威，**不存在可宣称的原生产 Publication commitId/sequence**；测试副本的 sequence=0 不是生产发布事件。该检查点仅同盘、一次性；不宣称持续 PITR/离机备份/正式 RPO-RTO。
- 本次明确阻断：rc.6 正常 `server/plugins/source-lifecycle.ts` 启动立即运行 `recoverOneManualSourceLifecycle()`，它先调用 `ensureAccountSchema()`；当前线上没有 `web_data_sync_receipts`，但该函数含全量 CREATE、MIGRATIONS、`bind` 的 ALTER/UPDATE，缺失表只是**首个被观察到的差异**。

## 根因裁决与修复方向

**问题是运行时读取/恢复与数据库迁移耦合，不是单独一个 CREATE 语句。** 严禁通过简单删掉 `web_data_sync_receipts` 建表、关闭整个 Source 恢复 Worker、吞掉 SQL 错误、给数据库账号加无约束 DDL 权限，或者修改现有 SQL/历史记录来“通过”测试。

1. 从当前 main 新建隔离 hotfix 工作树。按源码调用图查清：`server/plugins/source-lifecycle.ts` → `server/services/account/source-lifecycle-recovery.ts` → `server/utils/account-db.ts` 的 `ensureAccountSchema()`；同时确认 Session、绑定、Profile、Source 读取/写入及 Growth 也使用该函数。**不要只修第一个调用方。**
2. 把运行时的“连接及必需 Schema 校验”与“显式 Schema 初始化/迁移”分离。**正式普通启动和正常业务 GET 不应隐式执行 `CREATE/ALTER/DROP` 或为了修 Schema 而 `UPDATE bind`**。保留显式 bootstrap/migration 入口供隔离数据库与经审阅的发布迁移使用；既有测试 fixture 显式调用它，不通过全局假开关放松生产。运行缺表或结构不兼容时返回清晰、无敏感信息的不可用状态，不能以成功结果掩盖被跳过的 Source 恢复。
3. 在**本轮已验证恢复成功的独立副本**上完整复现生产实际表/列/索引集合，先生成精确 Schema diff：按 P-A legacy 必需、source lifecycle 必需、Developer v1-only（OFF）、过季 Annual 专用分组。不要只依赖 `web_data_sync_receipts` 的第一个错误，不要把四张 Developer v1 表列为 P-A 前置。
4. 首选不改生产 Schema 的 P-A 兼容模式，**仅限全部旧模式关键业务确实可正确运行**；如果 source lifecycle 的必要 outbox/receipt 表在旧库不存在，不能以禁用 Worker、允许运行却不能恢复或假成功来规避迁移。此时在恢复副本上构造**确切最小增量 DDL**（不自动执行全量 `ensureAccountSchema()`），验证表/索引、锁影响、无破坏、回退与已存在行保持；把必要 DDL 作为同一次发布变更的单一明确事项处理。**前次“本轮禁止新 DDL”不可成为隐式执行或假装兼容的借口；未获实际变更许可时不得在生产执行。**
5. 如果发现新代码的旧模式必须依赖额外的现存业务表结构或数据语义，直接列出具体表/列/功能与最小修复，不另起全域审计。

## 最小验证：只测受影响链路

在全新 `_test` 数据库和独立文件根中，用恢复副本的 Schema 与匿名化/受控必要数据验证；对普通运行账号**拒绝 DDL 权限**，用 SQL 日志证明普通启动、Session 登录、旧 `/my`、成绩、Growth、Source 生命周期读取等不会尝试 Schema DDL 或引起意外批量 DML。显式迁移只由受控迁移身份执行，严格区别于运行账号。

- 原样正式 Nuxt 构件、**normal** 插件启动（不以 `owned-qa` 跳过 Source/Annual 来代替此次验证）；验证 Source recovery 的空队列与待恢复任务语义，不能产生假回执、漏恢复、额外 Writer 或推进错误 Publication。
- 复用受影响的 Kinoko 全过滤422、零变更409、污染整批409、部分真实写入及 C/H 单 generation；验证实际 Session/绑定/Source 权限拒绝。
- 双 My Taiko `legacy`、Developer API 全部 OFF；验证新 BFF/v1 404，不要求四张 v1 授权表，不运行 Annual 性能测试。
- 对不存在的必需 Schema 应安全拒绝对应功能；对已满足的旧版 Schema 应正常运行。运行前后核对 SQL Schema fingerprint、既有账号与文件 hash；保留全部失败及修复证据。

## 完成修复后的连续交付

1. 以最新 `origin/main` 为基线创建**单一最小 hotfix PR**；仅修改必要启动/Schema 入口和定向测试，不重开 Contract F1–F5、Kinoko 决策或 0.82 风险。代码改变意味着旧 `8d915ca` 产物不再是新运行源码的产物，须从实际新提交创建**新的不可变构建及 SHA 记录**，不要沿用原 5,185 文件验收来冒充新构建。版本按仓库发布策略调整，不建立又一轮 RC 评审循环。
2. 完成针对真实恢复副本的启动与旧业务验收。如果确有必要的生产 DDL，则在隔离恢复副本完成可复演迁移/回滚，集中说明唯一生产执行事项；禁止让正式服务启动时自行跑迁移。
3. 发布前获取**新的跨 SQL/文件一致检查点**，因为 2026-10-17T03:57:56Z 的一次性快照随业务继续写入会变旧；保证旧 0.81.12 不可变目录与配置可恢复。普通代码回滚优先切回旧构件，**不得为回滚代码自动恢复旧 SQL/用户文件快照、覆盖之后的有效业务写入**。
4. 真实条件满足后按标准发布流程执行 P-A：My Taiko 两端 `legacy`、Developer API `OFF`、Annual `normal`；不执行 v1 四表 DDL、不打开第三方读取。发布后检查登录、绑定/Source、成绩、Growth、原 `/my`、匿名与跨 owner 拒绝；安全/数据/服务重大回归按验证过的旧构件流程回退。

## 唯一允许停止的原因与输出

无法在当前生产 Schema 安全运行旧模式；必须执行但尚未获授权的确切最小生产 DDL；新备份检查点不一致；无法安全回滚；定向启动/授权/写入测试失败；真实 CI 或部署检查失败。这些必须有具体反例，不用旧审批卡或历史已关闭问题重新制造 blocker。

最后只报告：**hotfix/main SHA；当前生产 SHA；P-A 是否发布；是否需要及是否执行了哪几条明确的生产 DDL；恢复点身份/新鲜度；旧版回滚位置；认证业务健康结果；尚未解决的唯一技术问题**。不要再输出“准备评审”的大文档作为终点。
