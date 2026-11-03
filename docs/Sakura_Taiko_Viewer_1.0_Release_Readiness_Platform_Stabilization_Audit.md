# Sakura Taiko Viewer 1.0 — Release Readiness & Platform Stabilization Audit

> **独立 Codex 主控施工文档 / 审计与决策阶段，不是修复或发布授权**  
> 编写基线：2026-10-10（Asia/Shanghai）  
> 最后经用户确认的线上版本：**Viewer 0.81.4**，commit `4465943`，`main` / `origin/main` 一致（以开工实际核验为准）  
> 目标节点：**Sakura Taiko Viewer 1.0.0 — My Taiko, in one place. / 属于每一位国服鼓众的太鼓主页**  
> 本轮阶段名称：**1.0 Release Readiness & Platform Stabilization Audit**  
> 本轮交付：全站发布 Gate 台账、可复核证据、P0/P1/P2 问题与修复计划、1.0 RC 决策  
> 本轮不得直接 bump `1.0.0`、不得部署、不得执行生产变更

---

## 0. 给 Codex 的总任务

你现在负责 **Sakura Taiko Viewer 从 0.81.4 向 1.0.0 正式版过渡的发布就绪审计**。

先读完本文件及适用的 `AGENTS.md`，核验当前版本和仓库状态，再审计**已经发布的核心产品链路及其工程支撑**，形成可以让维护者决策的证据包。

**本轮不是增加新功能，不是改写底层架构，也不是为了得到 PASS 而修改门槛。**

你的核心问题是：

1. Viewer 已上线的 Home、Community、Training、Progress 是否足以定义为 1.0 的冻结功能集？
2. 用户成绩、历史、绑定、Goal、测量、权限的权威数据是否存在会妨碍长期使用的已知风险？
3. 当前线上服务的性能、资源、故障率和恢复手段是否有足够证据支撑 1.0 的稳定承诺？
4. P1a/P1b 与 1.0 的真正依赖关系是什么？是否可以不进行无边界迁移而达成必要保障？
5. 哪些是**必须在 RC 前解决的硬阻断**，哪些是**有明确限制和退出条件的 1.x 欠账**？
6. 在证据充分时，应进入 RC；证据不足时，应准确标注 `UNKNOWN` / `NOT TESTED` / `BLOCKED`，不可强行给出 READY。

执行原则：**Audit → Gate Decision → Bounded Remediation Plan → 人工批准 → 后续单独实施**。

---

## 1. 产品路线和 1.0 的范围定义

最初的版本路线是：

```text
0.49 Home V2
    ↓
0.50 Community on Songs
    ↓
0.51 Training
    ↓
0.52 Progress
    ↓
0.53.x Platform Stabilization
    ↓
1.0.0 — My Taiko, in one place.
```

**这里的 0.49–0.53 是当时的路线代号，不是本轮要复刻的 Git 版本。** 实际发布经过多轮验收，已推进到 0.81.4；不许据此错误推断遗漏版本必须重新实现。

1.0 用户承诺：玩家能在 Viewer 查歌查谱、管理和理解自己的成绩，获得练习方向、主动选择目标、同步并验证进展、查看回顾、参与已有社区内容，且整个过程的数据和身份边界可信。

### 1.1 本轮冻结的功能域

| 领域 | 1.0 首发承诺内的最低能力 | 需要审计的例外 |
| --- | --- | --- |
| Home / IA | Guest、Unbound、Bound-empty、Ready 等状态与桌面/移动主导航 | 登录态错误、空态、导航可达性 |
| Discovery | 国服可用歌曲、谱面、难度/状态、搜索、基本内容入口 | 数据上下架、难度口径、谱面缺失 |
| My Taiko | 成绩、Rating/B30、六维、进度、账户与绑定 | 计算/数据身份/权限/陈旧返回 |
| Training | Today Plan 推荐、玩家选 Goal、基线、完成证据与后续推荐 | 推荐≠真实游玩、Goal 未闭合/重复/失配 |
| Progress | Recent、Daily、Weekly、Passport、当前/历史测量 | 事实来源、90 天窗口、跨版本展示语义 |
| Community | 已上线的论坛/UGC、歌曲/谱面关联及基本互动 | 关系校验、权限、治理、异常可用性 |
| Version Summary | 已正式公开的年度/版本总结入口、生成、分享及已承诺回退逻辑 | 任务失败、容量、分享鉴权、异步尾部等待 |
| Developer / Sync | 当前承诺并公开的 Token/API 和账号同步能力 | Token 隔离、废止、输入来源、错误恢复 |

如果当前线上功能比本表更多，**以真实线上已公开能力为审计集合**。发现差异要补表，不可静默忽略。

### 1.2 明确不作为 1.0 的功能硬门槛

- 全国实时对战、复制 Kinoko feature parity。
- 完整 OAuth 与第三方开发者平台生态。
- AI 教练、全新玩家类型、更多未经校准的能力指数。
- 新的 Monthly Recap / Session Recap：既有来源不能可靠证明真实游玩 Session 时，不许伪造它。
- Passport 完整 365 天 **历史成绩事实**：目前测量可选四档 `30/90/180/365`，但精彩时刻的可信事实范围最多为近 90 天；1.0 可选择维持这个**显式披露的能力边界**。
- 全面改用 Go、Java、MySQL 或重建所有前后端模块。

**注意**：可延期的“365 天额外功能覆盖”不等于可以豁免“现有受支持数据的安全写入与恢复”。不能利用缩小产品范围掩盖静默丢失或串号风险。

---

## 2. 必须继承、不得改写的已知事实

### 2.1 最近已接受版本：0.81.4

用户 2026-10-09 提供的最终验收结论为：

- `0.81.4` / `4465943` 已按标准 memory build wrapper 和 deploy 脚本发布，线上 `/more` 与 package、lock、runtime 一致，线上健康检查 PASS。
- Passport Final UX 为 **COMPLETE / Feature Frozen**；六维及 Rating 以已有**每日存档值**绘出折线，不重算或回填旧值，不以跨公式连线证明同一算法的净增长；版本 metadata 仍在。
- “精彩时刻”先通过 A/B 质量准入，C 不补位，多样性仅在同级质量带内起作用；NG 可靠降到零时用 FC 语义，全良必须有 OK/NG 同时为零的充分证据或 canonical DF。
- 旧事实、Goal 时间语义、绑定隔离、四档 measurement 与 90 天里程碑范围保持；无新增 Python、raw replay、API 请求。
- 235/235 Growth 回归、3/3 隔离 SQL、56/56 正式构建浏览器场景、8/8 Goal 浏览器代表场景 PASS。
- 线上认证 Passport GET 约 2825 ms、SSR 首屏可见约 2906 ms；每种初载分别 1 compute / 1 Python / 1 replay；四档切换零额外请求或计算。**以上是单次/指定样本实测，不是全站 P95。**
- 3000 score facts 选择 p95 17.12 ms，max 34.86 ms；3000 score + 300 Goal p95 21.42 ms，单次尾峰须留观察项。
- 已声明限制：不同算法时期的存档数值不证明同公式量尺可比；180/365 天测量不等于 180/365 天事实。

**本轮不重新施工 Passport UX**。只有发现 P0 数据、权限、性能回归时才能提出单独修复任务；审计报告不得擅自“修正”已批准的“每日存档值连线”产品语义。

### 2.2 仍未关闭的 P1a 来源一致性

2026-10-08 的 P1a 在三个隔离 worktree 完成跨 Writer commit protocol 的 68/68 集成验证，但状态仍是：

```text
P1a ISOLATED SOURCE CONSISTENCY = PASS
FULL-SIZE SOURCE ADOPTION = BLOCKED_BY_IO_PSI_GUARD
PRODUCTION WRITER COVERAGE = NOT VERIFIED
PRODUCTION INTEGRATION = NOT AUTHORIZED
P1a OVERALL = BLOCKED
```

- 2,000 个 full snapshots × 500 charts，历史约 275,970,000 bytes，尝试 source adoption 时 IO PSI full avg10 12.04%，超过已批准的 2% 持续 10 秒中止门槛，约 16 秒停止。
- `memory.peak` / `io.stat` 曾不可读；采样 current 不能代替 kernel peak。
- 原协议具有隔离目录标志，**不能直接部署生产**；P1a 的旧代码基线是 Viewer `0.80.0`，不可直接合并或覆盖 0.81.4。
- P1b “MySQL 作为 Canonical 成绩/观察存储”的可行性尚未获准完整实施，也未有生产迁移验收。

**本轮应判断数据保护所需要的安全边界，不要求默认选 P1a 或 P1b。** 不准把隔离 PASS 写成生产 PASS。

### 2.3 历史性能与运营风险只能当作待复核信号

- 过去 2,000 full 历史冷管线曾测得约 12.83 秒，超过当时完整历史处理目标；此结果不等于 0.81.4 线上普通 90 天 Passport 请求耗时。历史全量性能 Gate 仍未证明通过。
- 2026-10-02 的 25 小时运营窗口报告曾出现 MyDon 500、Growth Overview 502、验证码 500、年度任务尾部等待等现象。**这些是历史问题线索，不是 2026-10-10 的实时故障判定**；必须读当前日志、请求分母、代码和修复记录再定状态。
- 年度总结产生过实际用户注册、绑定、生成及分享，但缺少可靠的全站 D1/D7 留存、SPA 漏斗、来源归因；不得借这些历史数字宣称新版 Growth 的留存效果已验证。

---

## 3. 本轮权限边界（绝对禁止的行为）

本轮 **READ-ONLY AUDIT**，允许提交经过脱敏的审计文档、测试设计与后续任务规格，不授权业务改动。

**不得：**

1. 修改生产 Viewer、Sakura_bot、独立 bot、Python 算法、UI、Goal、canonical facts、历史测量、年度生成器、Poster 或任何现有业务数据。
2. 修改/创建生产 MySQL 表、DDL、索引、触发器、外键、用户、行、权限；不执行任何生产 UPDATE/DELETE/INSERT/REPLACE/ALTER 或数据修复。
3. 直接生产部署、推送上线、重启 systemd/PM2/Nginx、清缓存、改配置、改防火墙、回滚版本或运行写入型 migration。
4. bump 任意版本，特别是 `1.0.0`；创建正式 release/tag；自动 push/merge 生产分支；将 P1a worktree 合并到 `main`。
5. 使用真实用户身份发起会修改数据的 POST/PUT/PATCH/DELETE；不新建生产测试账号、Goal、帖子、评分、图片或同步任务。
6. 原样导出私人成绩 JSON、Cookie、Token、邮箱、QQ 身份、session、原始敏感日志并写入 Git/报告；报告只能用聚合、去标识计数和不可逆摘要等必要信息。
7. 通过扩大超时、提高内存额度、关闭 PSI/cgroup/watchdog、禁用检查或减少关键数据范围来制造 PASS。
8. 在生产环境主动执行 2,000×500 扫描、跨 Writer 故障注入、压测、冷数据回放或恢复演练。

生产侧只允许事前已经具备授权的**非侵入性只读**查询、日志聚合、低频健康检查与文件元数据审计。如果只读生产数据库、私有日志、授权账号 GET 都没有权限，标 `NOT TESTED`，不要越权访问，也不要因此宣布 PASS。

如果需要离线合成 fixture、隔离测试库、独立临时工作树或已有 QA runner，先确认资源成本与既定 test opt-in。任何持久化测试数据只能写入明确的 `_test` 数据库和隔离目录；`SELECT DATABASE()` 必须与已批准的测试库名**完全一致**，否则 fail closed。数据库按项目现有惯例**不新增 FOREIGN KEY / REFERENCES**，测试结束须精确清理并审计零孤儿。

---

## 4. 开工步骤与证据分级

### 4.1 版本和代码分布核验

首先只读执行并记录：

- Viewer 仓库根、`git status --short`、HEAD、`main` / `origin/main`，当前标签与远端是否同步。
- `package.json` / lock、`nuxt.config.ts → runtimeConfig.public.appVersion`、线上 `/more`（只读）版本一致性。
- `AGENTS.md`、应用环境、部署方式、服务依赖、已安装 Python/Node 版本、真实生产进程命令行。
- Viewer/Sakura_bot/相关 bot 仓库分离边界、外部 `userdata` 的所有者、真实 Writer/Reader 部署路径。
- 已有文档、资源保护脚本、memory QA wrappers、最新 0.81.4 验收与 P1a/P1 read-model 审计材料。

若开工发现版本已高于 0.81.4，**STOP 更新审计基线**，报告漂移并请用户确认本轮目标；不可强行 checkout `4465943` 或覆盖当前改动。

### 4.2 来源证据等级

每条结论标明 `SOURCE` 与 `CONFIDENCE`：

| Level | 证据 | 可以证明 | 不能证明 |
| --- | --- | --- | --- |
| E0 | 历史提案、其他人描述 | 设计意图、历史问题 | 当前实现已通过 |
| E1 | 当前源码/配置审阅 | 存在某调用路径/保护代码 | 生产运行效果 |
| E2 | 隔离单测、SQL、浏览器 fixture | 特定输入的正确性 | 线上数据/并发全覆盖 |
| E3 | 已授权、低侵入生产只读观测 | 某时间窗真实状态与代价 | 未来可靠性或全部用户覆盖 |
| E4 | 与生产同语义的隔离灾难/并发/恢复测试 + 成本报告 | 可重复验证保障机制 | 尚未验证的真实 Writer 清单 |

同一 Gate 可能需要 E1+E2+E3+E4 组合；不能用一张 PASS 截图替代完整论证。

### 4.3 不确定性和冲突处理

报告必须分开写 `OBSERVED`、`INFERRED`、`UNKNOWN`、`HISTORICAL_ONLY`、`NOT_TESTED`。

如对版本、写入语义、历史合成、真实游玩日期存在冲突，**不替来源做未经授权的重新解释**。列出差异、证据、影响和需要用户决定的问题。

---

## 5. G0 — 1.0 产品合同 / Freeze Gate

交付一份 `feature-contract.md`，把每个产品承诺映射到真实路由、API、数据来源、失败/无数据状态、用户可见口径、单测与浏览器场景。

至少检查：

- Guest / Authenticated Unbound / Bound Empty / Bound Ready 四态；Mobile TabBar、Desktop IA、中文/日文及响应式。
- 登录绑定 -> 用户数据 -> 推荐 -> Goal 创建/替换/取消 -> 后续同步 -> 完成评估 -> Recent/Daily/Weekly/Passport 的完整路径。
- 歌曲可用性与难度口径；公开搜索/谱面图/试听内容在无权限条件下的降级。
- 论坛/UGC 与歌曲关联：Song/Difficulty 服务端权威校验、用户可见范围、审核/隐藏/删除状态。
- 年度总结：公开入口、生成任务、稀疏数据降级、分享与鉴权、用户侧错误反馈。
- 过时、下架、资料缺失、历史截断、算法调整、绑定切换等边界状态。

**1.0 不许把已公开功能的重大故障简单写成“非目标”而跳过。**

**验收结果**：是否有仍阻断主要用户旅程的 P0 缺陷；如果没有，`FEATURE-SCOPE FROZEN`，剩余只是故障修复、观测与性能提升。

---

## 6. G1 — Data Integrity / Source-of-Truth Gate（最高优先级）

核心问题不是“选择 MySQL 还是 JSON”，而是**有没有可证明的权威提交、读写隔离、身份归属和恢复语义**。

### 6.1 全 Writer/Reader 资产清单

必须从当前生产相关仓库、部署配置和调用链建立完整清单，至少包含：

- Wahlap 正常拉取写入。
- Hiroba 同步写入。
- Sakura_bot / dispatcher 转存及 merged。
- Viewer 账号成绩编辑、创建、import、manual、Kinoko score/history import。
- 运维维护脚本、修复/重放/重建、历史删除与来源替换。
- 其他真实加载的后台消费者、缓存、只读 Growth replay、年度生成器、外部 bot/cron。

对每条路径列明：**入口、运行服务/代码版本、原始来源、输出对象、锁域、commit/fence、恢复方式、是否可能回填历史、身份隔离、写入次数、是否受已有监控覆盖**。

列出未知/未登记路径，不能因为仓库搜索没有结果就宣称线上没有其他 Writer。

### 6.2 当前 / 历史原始存储合同

审计 `current`（C）、`history`（H，full/delta）、同秒排序、zero-change 快照、import provenance、last/bestScores、旧数据兼容等语义。

需要回答：

- 单次写入 C、H 是否可能一成功一失败？正常读取是否能看到 mixed revision？如何发现？
- 并发跨进程修改同一个用户时会不会丢失更新、覆盖错误时间序列、错误合并 `bestScores`？
- 中途中断/ENOSPC/权限错误/损坏 JSON 是否 fail closed，有没有 recoverable journal/checkpoint？
- 是否能证明已提交数据完整、没有静默丢失？是否有可靠备份和恢复点？
- 解绑/重绑/切换 profile/删除/撤销后，旧数据是否仍可能通过残留任务或晚到响应返回？
- import/manual/repair 与上游同步的结果是否可能被错误叙述为新的真实游玩？
- 哪些 source timestamp 是同步/观察时间，哪些才具备 chart event 时间证据？

**禁止**以文件 `mtime`、单个 DB cursor、页面显示正常、P1a 的局部通过，代替跨 Writer 整体一致性证明。

### 6.3 Canonical facts 与 Growth 时序

抽样验证或使用脱敏隔离 fixture 比较：PB、NG、Combo、clear/FC/DF、Rank、Goal 的 canonical 输出与输入观察的对应关系。

特别确认：

- 真实 Session 不可识别时仍称 **Recent synchronization / observed changes**；不能写“这次游玩”。
- PB 业务时间、同业务日归因、时区、批量历史回填、full/delta replay、同谱合并等保持。
- 只有已验证的 FC / NG0 叙事与 canonical DF（或 OK=0 且 NG=0 同份证据）才能构成对应成就；不补造 canonical FC。
- Goal 仅严格 matcher 匹配业务日；未匹配维持确认日或 `day:null`，不捏造游玩日。
- 0.81.4 的六维图绘制**历史存档值**，跨公式连线不等于绝对可比提升；不改历史数值。
- 成长事实仍 ≤90 天；measurement 30/90/180/365 使用已有查询和展示口径。
- `P1` 性能/存储研究没有改变生产权威算法与 fact keys。

### 6.4 P1a / P1b / 现有系统的路径决策

分别比较三类可行路线，**本轮只决策，不实施**：

| 路线 | 核心思路 | 必须证明的内容 |
| --- | --- | --- |
| A. 现有文件读写加固 | 在既有 C/H 下完善锁、提交、审计、恢复、备份 | 所有 Writer 覆盖、并发与 crash parity、成本可接受 |
| B. P1a cross-writer commit | 隔离协议成熟后复审并接入实际 Writer / Reader | 大样本 IO PSI、资源 peak、真实来源登记、lease consumer、一致的部署/回退 |
| C. DB-Canonical feasibility（P1b） | 统一 DB 权威写入/观察，再用投影/Outbox 提供兼容 | 迁移 parity、writer convergence、事务与 legacy C/H 出口、恢复与性能 |

不要认为只加 MySQL 读模型就解决来源提交问题；旧 Writer 如果仍可以绕过权威入口写入 JSON，就仍有 split-brain 风险。

不要把 DB 与文件写入声称为一个天然的跨系统原子事务；需另有 outbox、重试/幂等、fence 与恢复设计。

**决策必须是具体的：**`A/B/C/先补证据`、与 1.0 的依赖关系、下一阶段范围、成本和回退。若当前体系无法证明 P0 数据安全，`G1=BLOCKED`。不因为一种特定架构路线未完成就自动否定其他可行方案。

---

## 7. G2 — Security / Ownership / Privacy Gate

依据当前实际路由与中间件作**授权边界地图**。重点：

1. Guest、登录、过期登录、登出、删除账号、解绑、重绑、多个 profile/绑定、管理员、普通用户、开发者 Token。
2. 账号、谱面成绩、Goal、measurement、Recent cursor、Passport、年度分享图、论坛私有/删除内容的 owner/binding 过滤。
3. GET、POST、后台 job 和导出是否都具备授权；直接传入其他 ID 能否越权读取；不依赖前端隐藏按钮作为权限控制。
4. CSRF/session cookie、安全缓存、`Cache-Control: private/no-store`、Token 撤销/到期/作用域、速率限制、上传验证及异常信息脱敏。
5. 迟到响应、用户切换、同账号多设备对 Recent cursor 的 CAS/ack 语义，以及日志对私人 ID 的暴露风险。
6. 社区审核/删除/隐藏、关联 song/level/difficulty 的服务端校验；年度图片下载与分享生命周期。

仅执行源码审计和**隔离测试的授权负例**；不对生产运行攻击式探测或批量枚举。

已知历史上修复过安全问题，不因“曾经修复”而直接 PASS；也不能把历史漏洞描述为当前仍可利用而没有证据。

### G2 可通过的最小要求

- 存在当前源码和测试证据覆盖关键身份边界。
- 无未处置的跨账户数据泄漏、权限绕过、Token 明文泄露 P0。
- 当前生产配置/部署与被测实现一致性可以追踪。
- 若不具备负例测试，标记该项 `NOT TESTED`，给出隔离验收方案。

---

## 8. G3 — Performance / Resource / Capacity Gate

不要把“一个真实用户 GET 为 2.8 秒”写成 P95；不要把孤立 curation 17ms 写成页面渲染耗时；不要把 365 天历史全量负载等同于当前 Passport 默认调用。

### 8.1 需建立的成本账本

针对以下工作流分别记录**实测源、样本 N、冷/热、用户身份隔离、CPU、内存、网络、DB、Python/replay 次数、wall-time p50/p95/max、请求体量、可观测性缺口**：

- Guest Home、登录态 Home、搜索/歌曲详情。
- 账号绑定与同步链路（同步成功/失败/超时/重复）。
- Today Plan 推荐、Goal create/evaluate/refresh/replace、Recent/Daily/Weekly。
- Passport GET、SSR 可见、四档切换、最大现有可信事实样本。
- 论坛公开阅读/已授权普通操作；年度报告任务与分享（以已有历史统计或隔离测试，禁止生产批量生成）。
- MyDon、验证码、`/api/account/growth/overview` 等历史故障热点接口。

### 8.2 真正的负载与样本规范

- 生产低侵入的已有日志/metrics 聚合优先；需要主动施压的任务只能在隔离环境。
- 区分 API server response、worker compute、DB query、queue waiting、browser TTFB/SSR visible/hydration；绝不混用时钟口径。
- 至少报告 p50/p95/max 和样本数量；有足够原始观测再报告 p99。不许根据少数几个请求硬造 P95。
- 区分串行、并发、同账号去重、不同账号身份隔离、热缓存/冷缓存；列出峰值输入尺寸和样本代表性。
- 对 2,000 full × 500 charts 等旧灾难样本，不准直接重放到生产；隔离复现必须保留既有 `≤300 MiB input`、`≤1 GiB QA cgroup`、`≤512 MiB worker`、IO/memory PSI 及 watchdog 等已有 Guard，核对当前批准文本，**不能自行修改指标**。
- `memory.high`、`oom`、`oom_kill` 或 PSI 触发中止时记录 `BLOCKED_BY_RESOURCE_GUARD`；`memory.peak` 不可读取时为 `UNKNOWN`。及时清理隔离子进程、临时监听和 fixture。
- 对于 0.81.4 Passport 的 30/90/180/365 切换，必须保持**零新增 account 请求、Python、raw replay**；此项已有证据，可做轻量回归，无需重复完整 UX 工程。

### 8.3 服务级 SLO 不得擅自立法

形成**可供维护者批准**的初版 SLO 表，至少含：成功率/5xx、p95、错误预算、超时、资源限额、任务队列、回滚触发条件。

- 既有针对完整历史冷 replay 的 3,000/5,000 ms 性能预算属于当时专项批准口径；如要替换为在线/离线双 SLO，单独提交决策，不可悄悄放宽。
- 当前单次线上 2825 ms GET / 2906 ms SSR 是比较基线，不自动成为所有用户的正式门槛。
- 若缺真实流量统计，写出需要什么测量才能批准 1.0 RC，不虚构服务级 SLO 已通过。

---

## 9. G4 — Operations / Recovery / Deployment Gate

只读盘点并提供后续**隔离演练计划**：

- Nuxt 构建/发布：`scripts/memory/run_build.sh → scripts/deploy_forum_web.sh` 的真实参数、权限、源码/产物映射与回滚点。
- 应用进程、worker、systemd/PM2、数据库、Nginx、网络代理、存储权限、日志、cron、邮件/验证码和上游同步依赖。
- 备份：DB、current/history 源文件、配置与密钥的**受控保护策略**、加密/访问权限、备份频率和保留期。
- 恢复：删除/损坏 current、H 增量缺失、full/delta 断链、部分恢复、DB 与文件不同步、磁盘满、同账号并发、错误迁移、用户解绑/删除、撤销来源。
- 部署后健康/回归、能否回退代码与数据契约、向前兼容、可观测告警、用户侧故障提示。
- 限流/排队/拒绝策略、生成与分享 worker 在异常时的资源隔离。

记录哪些已经存在可复核的 **RPO/RTO**、恢复日志与校验 hash；不存在则明确 `RPO/RTO = NOT DEFINED`，提出候选并等待批准。

**禁止本轮真实生产恢复/重启/备份还原测试**。如果过去有隔离恢复证据，核对版本一致性后引用；否则列独立 Recovery Drill 任务。

---

## 10. G5 — Product Usage & Telemetry Gate

这不是要求 1.0 先达到某个注册量或 D7 留存率；要求的是**能够可信地衡量核心用户旅程**。

至少建立以下可度量事件的规格，不在本轮新增埋点代码：

```text
recommendation_impression
recommendation_open_song
goal_create_success
goal_eval_confirmed
goal_complete_confirmed
score_sync_success
growth_daily_view
growth_weekly_view
growth_passport_view
returning_user_d1 / returning_user_d7
```

**不要照抄事件名就宣称已有埋点**。逐一审计：是否已有、触发点/去重方式、来源身份、分母、Bot vs Web、匿名 vs 登录、SPA 浏览、与任务/接口/生成记录是否混淆。

- `goal_complete_confirmed` 必须是严格 Goal evidence 后的业务成功，不能把页面打开或计划勾选计作完成。
- `recommendation_impression` ≠ 实际用户已阅读；记录曝光条件与去重窗口。
- D1/D7 必须有稳定匿名/登录定义、时区、跨设备合并规则、无效账号排除，不得用请求 IP 重合估算留存。
- 社区自然发帖与年度总结自动关联帖子分开统计；帖子数量≠互动热度。
- 用户级行为上报遵循最小化，不存曲目之外的敏感原始私人成绩或凭据；提供退出/删除策略审计。

**通过条件**：本轮交付了可实施、可评估的观察方案及缺口表；真正新增埋点/留存数据的生产验证由后续授权实施。若没有完整埋点，不能宣称留存已验证，但不应擅自以虚构留存率阻断 1.0。

---

## 11. G6 — Full Release Candidate 流程设计

仅**制定** RC 验收方案；本轮不进入 RC，不部署候选版。

RC 方案应包括：

1. 定义 1.0 功能冻结清单和变更豁免流程（仅 P0/P1 修复及安全修复）。
2. 每个核心工作流的官方构建、单测、隔离 SQL、真实浏览器与可访问性验收范围。
3. 已授权代表性真实用户的**非破坏性**检验计划，以及无新造生产假数据的执行方式。
4. 390px/1440px、zh/ja、light/dark、iOS Safari/Android/桌面浏览器的真实覆盖与未验证设备披露。
5. 持续运营观测窗口、错误率/容量、核心路径性能的建议阈值与样本量要求（**提交用户批准，不先宣布通过**）。
6. 变更冻结、部署、回滚/数据恢复、异常值班与紧急回退判据。
7. 新版介绍/已知限制/隐私与保留策略/数据事实范围的用户可见发布说明草案。
8. 上线确认步骤：Git SHA、package/lock、runtimeConfig、`/more`、线上健康、实际请求日志、DB/文件无异常，逐项签字。

RC 最终结果必须独立于本轮审计输出，不能提前以 `0.81.4` 的 Passport 验收推导 `1.0.0 READY`。

---

## 12. 风险分级与发布 Gate 决策规则

### 12.1 分级

| 等级 | 定义 | 典型例子 | 处置 |
| --- | --- | --- | --- |
| P0 / RELEASE BLOCKER | 可能导致身份泄漏、静默损坏/丢失受承诺数据、无法恢复，或核心路径大范围不可用 | 跨账户读成绩、C/H mixed 写入未检测、绑定污染、系统性登录失败 | RC 前必须有实测修复/安全保障 |
| P1 / RC FIX CANDIDATE | 高价值/高频路径明显损坏、严重尾延迟、不可控资源压力，但风险范围有限且有隔离/降级方案 | 普通历史个别用户超时、关键 API 频繁重试、部分手机交互失效 | 原则上 RC 前修；若拟延期需证明范围、降级和监测并经批准 |
| P2 / 1.x BACKLOG | 不伤及主要产品承诺，限制可被诚实披露且有替代路径 | 365 天完整成绩事实、更多训练 Queue、高级画像、OAuth | 记录并明确用户可见边界，允许延期 |
| UNKNOWN / NEEDS EVIDENCE | 当前证据不足，不能给风险级别或 PASS | 无当前日志、无法核对运行版本、无法读取 peak | 给出获得证据的方法、权限和成本；可能影响相关 Gate |

**注意**：P0/P1/P2 是修复紧迫性，`PASS / BLOCKED / CONDITIONAL / NOT TESTED` 是 Gate 结果，不得混为一谈。

### 12.2 Gate 取值

- `PASS`：有当前有效证据，满足明确的已批准条件，且残余风险可接受。
- `PASS_WITH_DISCLOSED_LIMITS`：核心合同满足，限定范围的非 P0 缺口得到显式披露和批准；**不能覆盖数据安全 P0**。
- `BLOCKED`：有具体 P0 风险、现行批准限值失败，或必需的安全/恢复性质无法满足。
- `NOT TESTED`：没有执行规定检查；不能当 PASS。
- `UNKNOWN`：曾审计但无法确定真实状态；不能当 PASS。

### 12.3 总体决策仅允许四种

```text
READY_FOR_RC
CONDITIONAL_RC_REQUIRES_EXPLICIT_APPROVAL
BLOCKED_BY_P0
INSUFFICIENT_EVIDENCE
```

`READY_FOR_RC` **不等于** `READY_TO_BUMP_1.0.0`，更不等于已发布。

要申请 `READY_FOR_RC`：产品合同冻结；G1 数据与 G2 安全核心约束达到可证实状态；没有 P0；G3/G4 的已批准指标与恢复能力不存在未解释阻断；有可执行 RC 计划。G5 的观察方案作为发展要求，不能拿不存在的留存率作硬阻断。

若可用证据不足且可能影响数据安全或其他 P0，必须 `INSUFFICIENT_EVIDENCE`，不得默认乐观结论。

---

## 13. 本轮执行节奏与提前停止条件

### Step A：1.0 合同与版本冻结审计

核验 0.81.4 / 当前 HEAD、适用规范、现有公开范围与 1.0 承诺；提交最初 Gate matrix。不得先写修复代码。

### Step B：全栈只读资产盘点

源代码/服务/DB/文件来源/外部 Writer、权限、业务事实、部署、告警、历史故障，建立证据引用和未登记清单。

### Step C：低侵入性能/故障回顾

优先使用已有运营日志、监控、报告；只在成本、权限足够且符合既定守护时开展**隔离** fixture/回归。

### Step D：最小必要的隔离验证

针对高危未知项给出测试并且只在已经授权的隔离环境执行；无法测则列依赖和风险，不得在生产“顺手试一次”。

### Step E：发布就绪结论与修复切片

输出本轮全部报告。每个 P0 拆为最小可独立交付的后续实施任务（不超过必要范围），列 acceptance、成本/权限、回滚、安全栅栏和验证样本。先交给用户决策，再下一轮编码。

**必须提前停止并报告的情况：**

- 发现生产凭据、身份泄漏、可疑数据损坏或未经声明的当前写入路径。
- HEAD/部署基线与本文件严重不符，或存在未确认的用户修改。
- 读-only 步骤意外涉及真实写操作、日志导出敏感私有数据。
- 测试目标不是明确 `_test` DB / 隔离文件目录、不能证明可清理。
- QA 内存/IO PSI/资源限额触发；无法确认 test runner 是否隔离生产；监控不可读却需要可靠性结论。
- 为得到结果需要生产故障注入、数据库迁移、整站负载或重启服务。

遇到 STOP 时提交已取得的只读证据和剩余风险，不得私下提高预算或改变权限边界。

---

## 14. 交付文档与目录约定

建议在 Viewer 仓库创建**仅含非敏感结果**的审计目录（如果存在已有约定，先遵守原约定）：

```text
docs/release-readiness-1.0/
  00-executive-decision.md
  01-feature-contract.md
  02-writer-reader-inventory.md
  03-data-integrity-risk.md
  04-security-ownership.md
  05-performance-capacity.md
  06-operations-recovery.md
  07-telemetry-retention.md
  08-rc-test-plan.md
  09-remediation-roadmap.md
  10-gate-ledger.md
```

可选机器可读摘要：`gate-ledger.json`（非私有数据）。原始 logs、私有截图、真实账号私有 trace、回放数据只能保存在批准的隔离证据目录且访问受限；Git 仅存脱敏摘要、hash 和可信引用。路径存在与否须实际确认，不得凭本文件假定已有。

### 14.1 每份报告的最低字段

```text
Finding ID
Gate / Route / Writer
Severity (P0/P1/P2/UNKNOWN)
Status (PASS/BLOCKED/NOT TESTED/UNKNOWN/...)
Observed behavior
Expected contract
Evidence source + timestamp + revision + reproducibility
Scope (users / routes / writers / data forms affected)
Risk / consequence
Reproduction plan (isolated vs production read-only)
Minimal remediation option
Cost / resource budget
Rollback / failure behavior
Owner decision needed
```

### 14.2 总览 Gate Ledger 样例（需要用真实证据填写）

| Gate | 目前只有的历史线索 | 本轮证据 | 最终状态 | 阻断 ID | 下一行动 |
| --- | --- | --- | --- | --- | --- |
| G0 Feature contract | 0.81.4 Passport UX complete | TODO | NOT TESTED | — | 核实所有公开路径 |
| G1 Data integrity | P1a isolated pass, full gate blocked | TODO | NOT TESTED | — | Writer/Reader/source-of-truth 审计 |
| G2 Security | 既有账户/权限测试 | TODO | NOT TESTED | — | 实现与生产边界复核 |
| G3 Perf/capacity | Passport 指定样本 2.825/2.906 s | TODO | NOT TESTED | — | 形成服务/工作负载分离账本 |
| G4 Recovery/ops | 标准发布成功 | TODO | NOT TESTED | — | 恢复/回滚证据与缺口 |
| G5 Usage telemetry | D1/D7 资料缺失 | TODO | NOT TESTED | — | 事件模型与采集缺口 |
| G6 RC plan | 未启动 | TODO | NOT TESTED | — | 设计验收而非执行 |

**样例中的 `NOT TESTED` 是文档模板，不代表开始审计后的真实结论。**

---

## 15. 必须单独回答的 18 个问题

1. 实际 HEAD、线上版本、runtime、lock、`/more` 是否一致？若与 0.81.4 不同，如何处理？
2. 1.0 首发公开承诺包含哪些路由、API、状态、绑定和数据范围？
3. 当前所有 Reader/Writer 的**运行态清单**是否可证明完整？未知路径有哪些？
4. C/H 当前是否有跨 Writer 事务、全局锁或其他可靠防混合保障？证据是什么？
5. 并发、掉电/崩溃、ENOSPC、历史修复等情形，现有权威数据可能如何失败？能否检测与恢复？
6. P1a 的哪几项已通过、哪几项 blocked？其隔离代码是否与 0.81.4 兼容？
7. 是否存在足以支持 1.0 的文件方案？必须做 P1b 才能过关吗？为什么？
8. MySQL Canonical 方案是否具备可控迁移和兼容导出路径？缺哪些试验？
9. Guest/绑定/跨账号/Token/社区/年度分享是否存在可证实的权限漏洞？
10. Goal、Recent、Daily、Weekly、Passport 的事实和确认时间是否互相一致？
11. 各核心 API 在本轮时间窗口的成功率、p95/样本量是多少？无法取得哪些指标？
12. 0.81.4 Passport 的页面耗时、计算调用、四档切换成本有哪些已继承证据？有无新增回归？
13. 历史 MyDon、验证码、Growth Overview、年度任务尾部问题目前是否仍存在？证据有何变化？
14. 当前服务最危险的资源竞争/IO/内存路径是什么？Guard 和告警是否有效？
15. 备份、restore、代码 rollback、数据兼容分别能证明到哪一步？RPO/RTO 是否定义？
16. 哪些真实用户 Growth 使用指标已观测，哪些仍缺埋点？是否错误使用 IP/请求当用户？
17. 哪些是 1.0 前必修 P0，哪些 P1 需要 RC 决策，哪些 P2 明确延期到 1.x？
18. 最终结论四选一是什么？**是什么实证阻止或允许进入 RC？**

---

## 16. 最终停止线 / 人工决策点

本轮完成条件是：

- 完成了全站 1.0 Gate ledger，报告含每项证据状态、阻断和风险分级；
- 形成独立、可复核的 Writer/Reader、数据、安全、性能、运维和 RC 方案；
- 没有隐去 P1a 仍 BLOCKED 的事实，也没有要求先迁库再思考；
- 对已上线 Passport 的 0.81.4 语义和测试证据准确继承；
- 明确提出**下一轮最小修复任务**和是否具备进入 RC 的理由；
- 生产无数据、服务、配置、版本和 Git 主线变更；未泄露私有证据；
- 仅在获得维护者下一阶段授权后，才可进入任何生产变更、读写协议迁移、RC 部署、1.0 bump。

**正确的结束语不是“已经可以发布 1.0.0”，而是下面四种之一：**

```text
1.0 READINESS AUDIT COMPLETE — READY_FOR_RC
1.0 READINESS AUDIT COMPLETE — CONDITIONAL_RC_REQUIRES_EXPLICIT_APPROVAL
1.0 READINESS AUDIT COMPLETE — BLOCKED_BY_P0
1.0 READINESS AUDIT INCOMPLETE — INSUFFICIENT_EVIDENCE
```

请先完成审计并交付证据与决策包，**STOP FOR USER REVIEW**。不要自行执行后续阶段。
