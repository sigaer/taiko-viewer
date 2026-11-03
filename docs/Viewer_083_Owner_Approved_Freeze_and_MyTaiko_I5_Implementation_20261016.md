# Viewer 0.83 — Owner 已批准 Contract Freeze + My Taiko I5 正式接线工作令

**日期：** 2026-10-16（Asia/Shanghai）  
**优先级：** 立即实施；这是执行指令，不是再次提交待签审计。  
**授权来源：** Owner 在本次对话中针对“是否批准精确 rc.3 组合的 F1–F5，正式冻结 Contract v1.0，并授权隔离 My Taiko I5 产品接线”的问题回复“尽快吧，我这边没什么需要确认的，都差不多了”。该回复按上下文视为这次**限定范围内的明确同意**。这是会话中的审批记录，**不是加密签名，不得伪造 Owner 亲笔签名或精确发言时间**。如项目采用审批 ID，可生成内部关联号并将其标注为 `CHAT_OWNER_APPROVAL_20261016_F1_F5`，关联本工作令和上述提交身份；不得冒称外部审批系统已签署。

## 0. 唯一目标与权限边界

在**现有隔离 Git 工作树**内，一次连续交付以下两项成果：

1. 把已完成工程评审的 **Viewer 0.83.0-rc.3 / Contract v1.0 兼容增量正式冻结为本地受审契约**，记录 F1–F5 Owner 批准、冻结文件身份和有限状态变化；不重新架构设计或重复已过的 QA。
2. 将已经通过 21 项隔离 HTTP 观察的 **My Taiko I5 统一 Read Model**，接入真实 `GET /api/account/my-taiko/overview` 和 `taiko_viewer/pages/my/index.vue`；完成**真实隔离 Nuxt 产品宿主**的功能、权限、数据一致性及移动/桌面验收。

**此授权仅允许：** 修改隔离分支的源码、文档和测试；只在新的独立 `_test` DB、合成数据和受限 QA cgroup 中构建与验证；生成本地提交和持久化 `qa-vault` 证据。

**明确不允许：** push、合并 `main`、修改/查看生产配置或生产 SQL/真实用户数据、生产 DDL、部署、重启、操作 Nginx/ACL、启用对外 Developer API、开放 public route、执行 Annual 冷生成/海报负载或 EOL 变更。`Gate P=DEPLOY_PENDING_AUTH` 保持不变。若工具或流程必须进行上述操作，直接 `PENDING_AUTH`，不猜测已经获得权限。

## 1. 精确批准对象与分支策略（不可跳过）

### 1.1 F1–F5 冻结的批准输入

- Viewer rc.3 运行源码提交：`46991b202b531fc18709bbfbdb453b880bd9920b`。
- `docs/083-release-manifest.json` 批准输入 SHA-256：`425e747960802284edb92af6ce2950d80e4c8a1e14c2fb7bc7cc51317fc3b6d5`。
- 工程评审交付：`289094de74fa4872c7e43459ec57ce5c207ce36f`；评审工作树：`/home/sigaer/taiko/.worktrees/viewer083-contract-api-20261016`。
- 消费者 I5 准备交付：`1b06f7d`；准备工作树：`/home/sigaer/taiko/.worktrees/viewer1-consumer-readmodel-20261016`。精确头由本机 Git 解析，禁止猜 SHA。
- 唯一正本：`packages/sakura-taiko-contract/schema/contract-v1.json`；`contractVersion=1.0`，workspace package `0.1.2`。
- Taiko installed：`0.14.2`，源码 `a632913dfbdbec1d465f8eaccc0bb80c35e25745`，已重建 wheel SHA-256 `398d23000ebde8a9696b8586fc7fff6cf566e49eb6efe970ceba2e5ecf488c0a`；center/client 各 94 包，installed contract `0.1.0`、Core `0.1.1/0.1.2`、support `1.1.0`。不因本次签署而强制升级不消费新增 DTO 的 Worker。

开始前先只读记录 `git status --porcelain=v1`、HEAD、manifest SHA、运行文件 SHA；发现不相符或工作树有未明确归属的改动，则**仅停止涉及不符文件的变更**，保留现状并提出具体差异；不得 `git reset --hard`、覆盖工作树、清理其他任务文件或从旧候选强行 cherry-pick。

**建议：** 在 review 工作树（或从其精确批准 HEAD 新建的干净隔离分支）实施冻结记录；在 I5 工作树另做产品接线。将冻结所需的最小提交明确同步到 I5 的基线，逐文件解决冲突，不将 I5 旧原型覆盖较新的 rc.3 授权和分页补丁。分别提交，不混成一次不可回滚的大提交。

### 1.2 F1–F5 批准范围

| 编号 | Owner 决定 | 冻结边界 |
|---|---|---|
| F1 | **APPROVED** | 一个 Contract Schema v1.0；Song/Chart 可选 availability/tjaCourse；unknown/来源/时间/单双打/难度及 Score 白名单语义不变；不新增必需字段 |
| F2 | **APPROVED** | stable `clt_` client + 独立旋转 Key；逐 `plr_` / binding、audience、scope 的 ResourceGrant；用户显式同意及实时撤销；仅 `profile:read`、`scores:read` |
| F3 | **APPROVED** | Catalog ≤10,000 源行/8 MiB，Score ≤20,000 条/8 MiB；超限整包 503 而不是 200 截断；Owner 管理端按 `before` keyset 分页，每页 ≤100，`hasMore/nextCursor`，授权与 client 可全部找回与撤销/停用；生产配额仍需 Gate P |
| F4 | **APPROVED** | 旧 session/raw/proxy/public-score-token/内部 Bot 能力各自保留认证域，无自动转 Grant、不设未经验证的 sunset |
| F5 | **APPROVED FOR LOCAL FREEZE** | 对本条 1.1 的**精确**源码与 manifest 做最小冻结记录；冻结不等于生产启用或允许变更真实数据 |

`P-ID/P-APP/P-PROXY/P-KEY/P-AUDIT/P-RESTORE/P-MIGRATION` 继续 `Gate P PENDING`，不得把它们标记为验收通过。

## 2. Package F — 当轮完成冻结记录，不再等待 Owner 答复

### 2.1 仅做有限冻结元数据变更

- 从源码受控 lifecycle record 更新 `FREEZE_CANDIDATE / contractFrozen=false` 为 **`CONTRACT_FROZEN / contractFrozen=true`**；这一状态只表示**当前候选的契约被批准**，不能按环境变量自动冻结或推导生产 `ACTIVE`。
- 保留 `runtimeEnabled=false` 默认、对外 Developer API feature gate 默认关闭；本地仅由已准入隔离测试可临时 opt-in。不要改写实际生产状态为已知值。
- 同步 OpenAPI `x-freeze-status`、`meta` 的合法状态示例、相关最小 Golden/SDK 验证与生命周期不变量；若 OpenAPI 对 meta 枚举已足够，只改静态冻结记录及对应定向样例，避免无必要重写 11 个 operation。
- 更新 `docs/083-release-manifest.json`（输出 manifest 新 SHA 必然可能变化），同时存档**批准输入**提交+SHA 与**冻结输出**提交+SHA，提供精确 diff：只容许 `lifecycle/meta/OpenAPI/Golden/manifest/signoff` 及被这些文件严格必需的引用变化。**业务权限、Schema required、计算/Writer、用户数据均不得借机改动。**
- 更新 `083-freeze-final-review.md` 和机器矩阵：F1–F5=`OWNER_APPROVED`，在实际代码变更与测试完成后才能置 `contractFrozen=true` 和 `CONTRACT_FROZEN_LOCAL`。必须保留审批来源、批准输入身份、冻结输出身份及 scoped validation；审批人未提供书面姓名则记录 `Owner (chat approval)`，不得伪造手签。
- 保留旧 rc.2 strict `additionalProperties:false` 消费者需要更新 rc.3 验证器的明确警告；Source Contract 0.1.2 vs installed 0.1.0 的消费者适用范围维持，未消费新 DTO 的 94 包环境不重建。

### 2.2 Package F 最小验收

冻结前后检查 Schema 原始字节 SHA 与序列化 SHA、生成 TS/Python 映射身份，验证无领域 schema 漂移；定向运行 `meta` 生命周期组合的成功/拒绝样例、Contract/OpenAPI 受影响样例、Owner 分页与 revoke/304 的已有关键安全回归。复用输入 SHA 未变化且与候选一致的 11 JS/7 Python、74 HTTP、34 F3 等限定证据；不要重复 0.82 的 46×2、119 SQL 或 Annual。输出结果必须分别记 `REUSED_WITH_HASH_PROOF` 与 `RERUN_PASS`，不得混算。

**Package F 退出条件：** 一个独立 freeze commit，`CONTRACT_FROZEN_LOCAL`、`runtimeEnabled=false`、`publicApiEnabled=false`、`DEPLOY_PENDING_AUTH`；冻结记录 SHA 与 QA 文件 SHA 完整可核。

## 3. Package I5 — 直接实施真实 My Taiko 产品入口

### 3.1 只接一条 BFF + 一个页面

正式新增 `GET /api/account/my-taiko/overview`（若原有同名路由，先核对并改为最小兼容接线，不增加重复 API），并升级已登录 `taiko_viewer/pages/my/index.vue` 消费这个 BFF。**复用**准备/I5 原型 `taiko_viewer/tests/prototypes/myTaikoReadModel.ts` 的已验证逻辑，重构为生产可维护的 read-model service；原型测试路由 `/qa/my-taiko` **不得进入构建产品路由**。

新的 BFF 只提供最小的、真实的个人概览：Profile、当前 Score 摘要、最多 90 天的 canonical Growth facts 摘要、既有推荐工具入口。不得为了展示填入占位/mock 数值，不额外重算 Rating/六维，不将 `ENTRY_ONLY` 伪装成推荐结果，也不重写 Home、Goal、Growth、Forum 或 Annual。

**交互状态必须真实且明确：** 未登录、无绑定、可显示数据、没有可靠 facts、`partial/truncated/unknown` coverage、访问被拒、请求超时/服务不可用、切换绑定重新获取。错误不展示上一账号/上一绑定的旧载荷。

### 3.2 严格数据、授权与一致性

- Web 自读只由现有 Session/`requireAccountUser` + `withViewerCurrentSource` 判断 owner/current binding。**不通过第三方 Developer Key 或 ResourceGrant**，也不接收 URL/body 的 `userId/bindingId` 强制覆盖。
- 使用**同一个 committed Publication ReadView**、同一请求级 ScoreReadPort，且对 current/history 共享 generation；显式释放 SH lease。请求级 ALS/memo 仅在该请求与绑定范围内有效，`finally` 还原，不跨请求缓存已授权私有载荷。
- Growth 复用 `getGrowthHistory`/既有 canonical projection；`Score` 使用已有 Contract mapper，不另实现转换/事实推导。若 measurement 不读取，诊断必须 `NOT_REQUESTED`，不能假装用户无冻结测量。真实游玩与 full/delta 观察不混同；Source-switch/reappearance 仍按已批准谱面连续性逻辑，不凭同步产生游玩。
- 正式接线必须使用与 Developer API v1 **同一 Catalog 源字节 identity** (`catalogRevision`)；旧投影摘要放在 `legacyCatalogRevision` 并标明 profile。若实际旧投影与新源投影不等价，明确 fail-closed/冲突，不用同名字段伪装一致。
- 响应中 `schemaRevision/catalogRevision/scoreRevision/calculationProfile/source` 与来源闭包一致。`scoreRevision` 必须来自同一 committed ReadView 的 sequence+commitId；不以文件 mtime、当前时钟或旧 current hash 替代。
- 在读前和应答前验证 Session、绑定及访问主体；读取中切换、解绑、owner 变化、source/catalog revision 不匹配、Publication 缺失/损坏、私有数据权限变化都整包拒绝。不可因 `503` 等异常自动回退为直接读 `userdata/*.json`。
- 如果为了安全回滚需要模式开关，**默认旧页面路径**；显式仅在隔离宿主启用新 read model。初期**不实现自动旧数据回落**；新路径的安全拒绝显示错误/重新登录提示，回滚只通过批准后的显式开关恢复旧入口，不新增隐式权限路径。
- `GET` 自读原则上不创建新冻结 measurement，不写 Goal/Score/C/H/Grant（现有 Session 触达行为须如实列出）；响应 `private, no-store`，不可由共享缓存对其他用户返回。

### 3.3 必需的产品级验证

必须使用**实际 Nuxt build 启动后的独立服务宿主**、新建 `_test` MySQL、合成用户/绑定和已安装 `-I` Taiko，完成一次可用的产品闭环，而非停在 `/qa/my-taiko` 原型或组件截图。若启动时受已退场 Annual 插件影响，只可在**隔离测试构建**采取证明语义范围的最小禁用，不得改生产 Annual EOL 状态、重新触发年度任务。

最低观察包括：

1. 登录 A1 → `/my` 页面 → 新 BFF → 可见 Profile/Score/90 天事实/工具入口；刷新后不会串用户。
2. 匿名 401 或导航到正确登录状态；未绑定用户看到绑定入口而非意外 500。
3. A1→A2→A1 与账户 B 独立；读中切换、解绑、登出时返回拒绝并清除旧响应。
4. 并发 Writer 下同一响应 current/history/scoreRevision 同代，下一次请求读新代；Publication 无 committed generation 正确返回受控失败。
5. Catalog 同步字节 revision 与变更检查有效；不拿 legacy 投影 revision 冒充相等。
6. `facts` 不凭同步/来源切换造新游玩；缺证据时覆盖 `unknown/partial/truncated`；无误写 measurement。
7. 375px 与 1280px 的真实浏览器页面：无横向溢出、首屏清晰、焦点/重试/绑定切换可操作，无关键 hydration/console/pageerror。
8. 默认禁用时现有 `/my` 行为不改变；登录态与外部 Developer API 完全分开；feature gate 未在公共/生产默认启用。
9. 正式生产构建完成、最小影响 TypeScript/契约回归与 QA 退出清理，保存原始 stdout、失败记录、响应摘要、授权与 release 身份、cgroup 资源事件。

已有 I5 原型 21 项及 rc.3 F3 34 项可作为基础证据，但**不得替代实际 Nuxt 页面、BFF、产品路由、隔离构建的本次新验证**。

## 4. 交付、状态与回滚

最终只保留两个逻辑独立的代码提交系列：

**F — Contract Freeze**：提交、Owner 审批记录、冻结元数据 diff、OpenAPI/Golden/manifest 更新、机器状态矩阵与最小证据；状态在完工后 `CONTRACT_FROZEN_LOCAL`。

**I5 — My Taiko 产品集成**：正式 route/service/page/受影响测试、至少一次完整独立 Nuxt 宿主浏览器验收、read model 回滚/开关说明及合成数据证据；状态 `MY_TAIKO_I5_PRODUCT_CANDIDATE_READY_FOR_REVIEW`，不是上线完成。

所有正式日志、原始性能/测试样本和构件/Manifest SHA 保存 `qa-vault` 持久 evidence；所有运行使用有磁盘/内存预算的现有 wrapper，子进程退出后仅清理本轮 scratch，避免再次在 `/var/tmp` 持续堆积。

**不得扩大本工作包：** 不引入 OAuth/PKCE、history/growth 第三方 scope、全库 DB 改造、第二 Writer、跨三仓库全量换包、所有旧 route 的 sunset、Annual 新负载、B30/图像像素重建或 0.82 遗留性能全面追责。

**保持：** `Gate P=DEPLOY_PENDING_AUTH`、`deployReady=false`、`productionAccess=false`、`publicApiEnabled=false`。正式线上启用及迁移后验仍需独立生产批准；F1–F5 Owner 聊天批准绝不自动授权该 Gate。

**最后只交付：** 一份冻结决议记录、一份 I5 实施报告、一份合并机器矩阵、固定 commit/manifest SHA、必要原始证据索引和一个简短的“下一阶段 Viewer 1.0 待办（依赖/优先级/是否需生产授权）”。遇到真实安全/数据一致性 P0 才阻断；不为更多待办重新要求本轮 Owner 逐项确认。

---

## 可复制的 Codex 启动指令

> Owner 已在本次对话批准 Viewer rc.3 精确输入（源码 `46991b202b531fc18709bbfbdb453b880bd9920b`；manifest SHA-256 `425e747960802284edb92af6ce2950d80e4c8a1e14c2fb7bc7cc51317fc3b6d5`）的 F1–F5，批准本地冻结及隔离 My Taiko I5 正式接线。请阅读并执行本工作令，不再申请这两项授权。先固定输入身份并提交受审 `CONTRACT_FROZEN_LOCAL` 冻结记录（feature gate OFF、Gate P pending），再有选择地整合 I5 21 项已验证原型为真实 `GET /api/account/my-taiko/overview` 与 `/my` 页面。在全新隔离 SQL、已安装 Python 和实际完整 Nuxt 宿主测试下完成真实登录、绑定切换、事实/代际/权限、375px/1280px 回归，提供提交/证据/失败与下阶段清单。不得 push/main 合入/部署/访问生产/启用 API/操作 Annual。只有真正发生的 P0 或输入 SHA 不一致需停工并上报；其他已批准范围请直接实施。
