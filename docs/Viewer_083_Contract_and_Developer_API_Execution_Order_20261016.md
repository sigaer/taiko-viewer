# Viewer 0.83 — 数据契约统一与 Developer API v1 实施工作令

> **签发日期：**2026-10-16  
> **工作性质：**下一阶段 Codex 主控指令，进入 0.83 的**隔离实施与 Freeze 候选准备**，不是授权推送、合入或上线  
> **产品方向：**Sakura Taiko Platform — *My Taiko, in one place.*  
> **首要结果：**用最小可运行的用户授权与版本化读 API，开始兑现“一个身份、一套成绩/事实契约、一个第三方接入边界”。  
> **当前边界：**0.82 Gate C Owner 已接受 O1/O2，批准按 `PASS_WITH_ACCEPTED_RISK` 记录；Gate P 仍 `DEPLOY_PENDING_AUTH`；0.83 尚未正式 Freeze。

## 0. 立即执行的 Owner 决议与版本边界

### 0.1 先归档本次 Owner 签收，不重复 0.82 迁移

1. 在当前隔离的 Viewer 0.82 工作树中审阅 `docs/082-code-closeout.md` 和 `docs/082-gate-status.json`；仅以本轮明确的 Owner 确认更新 O1、O2 与 Gate C 状态。状态为 `OWNER_ACCEPTED_RISK`、`PASS_WITH_ACCEPTED_RISK`；记录签收日期 `2026-10-16`，精确证据范围与仍为未知的部分。
2. **不要修改历史测试的客观状态：**12 项旧 PNG 为 `LEGACY_PIXEL_PARITY_NOT_REESTABLISHED`；history 474/600、126 dropped 为 `HISTORICAL_FAIL_CAUSE_UNRESOLVED`；B30 和 merged-history 的九次预检不冒充正式百分位。保留 `PASS_SCOPED` 和原始 SHA 清单。
3. `Gate P = DEPLOY_PENDING_AUTH` 不变，生产 ingress/ACL、系统运行身份、备份/PITR、异地资源权属与部署回滚均不视为通过。
4. 如果 Gate C 签收状态仅存在聊天而尚未写入仓库，按本确认落实一份本地提交；**不推送、不合入 main、不部署**。更新文件前先检查工作树状态和现有提交，不能覆盖用户未提交材料。

### 0.2 精确研发基线

- Viewer 0.82.1 候选：`32729e86b070ed5bd40bc033a7d936114e5081ce`；隔离树 `/home/sigaer/taiko/.worktrees/viewer082-recovered-20261016`。本轮 8/8 安装态 SQL、Nuxt build、非 Annual HTTP/Worker smoke 已有证据，不在 0.83 再全量重跑。
- Taiko 0.14.2：源码 `a632913dfbdbec1d465f8eaccc0bb80c35e25745`；新 wheel SHA-256 `398d23000ebde8a9696b8586fc7fff6cf566e49eb6efe970ceba2e5ecf488c0a`。旧 wheel SHA 不同且旧字节缺失，不能声明二进制完全相同。
- center/client 独立 94 包，Core 0.1.1/0.1.2，支持包 `python-memory-runtime 1.1.0`，通过非 editable / `-I` 来源检查。
- 既有 0.83 产品草案：`78ce858`，本地 `/home/sigaer/taiko/.worktrees/viewer1-draft-recovered-20261016`，状态 `READY_FOR_FREEZE_REVIEW_NOT_FROZEN`。**先差异审阅，逐文件有选择地沿用，不盲目 cherry-pick 或以旧草案覆盖 0.82 权限与 Writer 修复。**
- 契约正本：Viewer `packages/sakura-taiko-contract/schema/contract-v1.json`，已有 Python/TypeScript 生成绑定和 `@sakura-taiko/contract/score-read`。禁止另起一个并行权威 Schema。
- 正本数据/写入：已安装 `taiko_store` 的 `PublicationStore` 与已完成安装态的受控 read/write adapter。禁止恢复直接写 C/H 的第二套 Writer；无需此轮把全部 JSON 迁移到 SQL。
- 正式运行与独立 SQL 检查均从现有 `/home/sigaer/taiko/qa-vault` 取锁定构件与证据；禁止重新在 `/var/tmp` 长期保存工作树、venv 或验收结果。

如本地 HEAD 与所列基线不同，以 **Git 对象、工作树差异、现存签收清单**三方对照写出变化；停止自动合并，不能推测当前生产部署版本。

## 1. 此轮必须交付的最小产品能力（MVP）

首个 0.83 候选只做**版本化、只读、可授权、可撤销的资源访问**，并让既有数据/契约具有统一身份与版本信息：

1. **公共 Catalog v1：**可匿名读取的歌曲/谱面基础数据，统一明确地区、上下架与单双打适用口径；返回 `contractVersion` 与 `catalogRevision`，支持明确的匿名配额及合理 ETag。公共内容中不得混入私有成绩、凭据。
2. **私有 Score/Profile v1：**开发者应用只有在对应用户主动授予**指定绑定、指定客户端、指定 scope** 后，才可读取最小字段集合；无授权绝不读取完整原始 userdata 或其他绑定。
3. **ResourceGrant：**让登录的 Viewer 用户查看、建立、撤销针对开发者应用的授权；授权绑定不可变的 `bindingId`，不能只看当前选择或同名 `taikoId`；过期、解绑、账户异常、应用/令牌撤销必须 fail closed。
4. **Developer App 身份与配额：**现有 Developer Token 是 client 身份/配额，不是用户数据许可。保持与 ResourceGrant 分离；令牌轮换不得意外扩大授权；`audience`/scope/owner 每次请求实时校验。
5. **兼容路由清单与受控迁移：**既有 Web session、内部 bot service、`/api/developer/userdata/[userid]`、`/api/taiko/proxy/*` 与旧 public-score-token 各自标明真实使用者、认证、响应、写入副作用、后续迁移策略；本阶段不为“统一 URL”删除仍在使用的旧入口。

**明确不做：**OAuth/OIDC 完整平台、所有 scope 的写入/同步 API、全站数据库迁移、独立微服务、Rating/六维新算法、旧 SQL/Java 业务重构、全部 Bot 端同步改造、全站 UI 重设计、Annual 2026 业务负载或生产 EOL 操作。

## 2. Package A — 现有 Contract v1 的增量冻结候选

**Owner：**Viewer Contract / 数据语义。**交付：**Contract 差异表、唯一 Schema 增量、Golden、生成绑定及消费矩阵。

- 审阅 `User`、`Binding`、`ExternalIdentity`、`DeveloperIdentity`、`Song`、`Chart`、`Score`、`GrowthObservation`、`CanonicalFact`、`GrowthProjection`、`CalculationProfile` 等现有 v1 契约。逐字段确定是现有合同复用、兼容增量、平台授权 DTO，还是只存在内部 storage 的字段；不要把 SQL 表或用户 Token 逻辑塞进纯太鼓领域算法。
- 成绩：`song_no/level` 与 `songId/chartId/difficulty` 显式映射；difficulty 为成绩等级 1–5，star level 是独立数值；TJA course 0–4 显式转换；重复曲/地区/单双打按照显式 Profile 决定，不覆写基本 identity。
- `high_score→score`、`good_cnt→good`、`ok_cnt→ok`、`ng_cnt→ng`、`combo_cnt→combo`、`best_score_rank→rank`；null 缺失不归零；clear/FC/DF 的 flag 与历史累计次数分离。
- `capturedAt` 是真实观测时间，`highscoreAt`/`updatedAt` 是上游文本，绝不凭更新时间推断游玩。Growth 使用已修复的按谱面 source-reappearance 可比较性：受影响谱面重新建立可信基线，未受影响谱面的合法 PB/FC/NG/rank 不丢失。
- 区分 `scoreRevision`（Publication 已提交代际）、`catalogRevision`、`calculationProfile` 与报告/历史原有 `modelRevision`。不要将轮次 SHA 当成可对抗恶意 Writer 的签名，也不能为统一指纹而重写已冻结历史 measurement。
- 返回元数据优先复用现有字段；新增字段要定义空值、来源、兼容默认、读旧值行为与序列化稳定性。契约本体保持兼容扩展，breaking change 必须单独申请并带版本策略。
- 生成绑定、Schema validation、Python/JS roundtrip、ScoreReadPort legacy Golden、Source-switch、时间与区域样例全部定向 PASS。**禁止通过弱化原严格 DTO 测试制造 PASS。**

**A 的放行条件：**单一 Schema 正本、变更影响表、双方生成绑定一致、已知消费者逐一列明 owner 和 fallback；审查期间不把草案标成 FROZEN。

## 3. Package B — ResourceGrant + Developer API v1（本轮最高优先级编码）

**Owner：**Viewer Server / 安全。**交付：**隔离 DB schema、授权服务、用户同意/撤销最小操作界面、可运行 versioned API、OpenAPI 3.1 草案、负面 E2E。

### 3.1 固定身份和授权边界

- **Actor**：登录 Viewer 用户、已审核开发者客户端、平台内部服务是三个不同身份域。Viewer account ID 不等于 QQ/bot key/`taikoId`；client owner 不等于资源 owner。
- **Grant** 最低要素：`grantId`、`ownerUserId`、`bindingId`、`clientId`、`audience`、`scopes`、`issuedAt`、`expiresAt`、`revokedAt`，另定义用户明确同意记录与审计时间。只能由已登录、已验证该 binding 的 owner 发放；不能由开发者自签授予别人的数据。
- **Client credential**：仅用于证明应用身份，单独存储哈希/轮换/撤销；grant 不存开发者明文密钥，不以 token ID 的可变含义替代稳定 `clientId`。
- **Scope MVP**：公共数据匿名只读；私有 `profile:read`、`scores:read`。历史 `history:read`、成长 `growth:read` 仅定义设计/Schema 而默认不开放，除非本轮能够完整证明源事实权限、分页、隐私边界且另获 Owner 许可。**不新增 sync:write/credential 管理开放权限。**
- 绑定解绑、所属 user 改变或应用/授权过期、撤销、禁用后，API 立刻拒绝；绑定切换不默许跨绑定读。单用户多绑定必须经明确的逐绑定授权。
- `Authorization` 无效时绝不能回退为 Cookie 或匿名高权限；401/403/404 的资源枚举风险按策略区分，返回最小 `code/message/requestId`，不得带私有路径或密钥。

### 3.2 路由候选（最终路由先以 OpenAPI 审阅冻结）

建议从现有路由拓扑评估 `/api/v1/taiko/` 前缀，可调整但必须**只出现一个正式版本化外部入口**：

- `GET /api/v1/taiko/meta`：API/schema 支持版本、公开数据 revision 与能力声明。
- `GET /api/v1/taiko/catalog/songs`、`GET /api/v1/taiko/catalog/charts`：公共契约数据。
- `GET /api/v1/taiko/players/{playerId}/profile`、`GET /api/v1/taiko/players/{playerId}/scores`：按 client + grant + binding owner + scope 授权；`playerId` 不得直接信任为磁盘路径。必要时采用不暴露外部凭据的 binding opaque ID。
- 登录资源 owner 的 grant 操作放入 session-only 路由（如 `/api/account/developer/grants/*`），不能让第三方 client 靠开发者 API Key 自己授予用户数据。

**所有私有 API 读必须遵守：**先验证身份与 grant、再使用受控 ScoreReadPort / Publication ReadView，响应前对关键绑定/撤销状态复核，正确处理并发撤销与 ETag/304；`Cache-Control: private, no-store`，不依赖共享 CDN 隔离。**纯 GET 不能因读取而抓取上游成绩、修改绑定或写 C/H**；已有可记录的配额/审计 side effect 必须单独说明。

### 3.3 旧入口兼容约束

- 当前 Developer Token/旧 `public-score/by-token` 不自动升级为 grant；旧 token 只能在原授权语义内使用，旧接口如果读取前会刷新成绩，要在文档写明副作用，不能混入 v1 纯读接口。
- 当前 `/api/taiko/proxy/*`、`/api/developer/userdata/[userid]`、内部 bot/manual/QQ/credential 通道保持严格已有身份边界；只在明确消费者/新路由可替代且通过回归后才考虑弃用，不在本轮批量删除。
- `service-to-service` 使用独立调用凭据，不能借普通 Developer Token 提权。Runtime Python 0.14.2 与新 API 解耦，可根据现有接口走非网络本地读取，但必须共享授权决策和返回契约。

### 3.4 隔离真实 SQL + HTTP 负面验收矩阵

只在全新独立 `mysqld --no-defaults` datadir 的 `_test` 数据库、显式 mutation opt-in、禁外连/cgroup 内进行。最小覆盖：

1. 匿名访问公共 Catalog 成功；匿名访问私有成绩拒绝。
2. 有效开发者 Key 但无用户 grant，私有成绩拒绝；开发者申请人自有账号并不自动代表任何绑定 owner。
3. 用户 A 授权应用 X 绑定 A1 的 `scores:read` 后 X 只能读取 A1 的最小契约数据；A2/B1、其他 client Y 或 `profile:read` 均拒绝。
4. 错误 `audience`、缺 scope、过期、撤销、解绑、被禁用 client、令牌轮换、绑定切换、并发撤销分别拒绝。撤销后重复 GET/If-None-Match 不得获得旧的 304 授权漏检。
5. 无效 Authorization 不回退 Cookie；跨 owner、越权参数和路径穿越不能读取磁盘；响应不含 raw userdata、Wahlap/Hiroba cookie、内部 token 或 private 文件位置。
6. Publication commit 变化后 `scoreRevision`/ETag 与读取数据同代；并发写入与撤销不返回混代私有数据。
7. 速率限制/配额为原子一致性实现或记录可复核的限额保证；429 不改变授权结果。日志和错误不泄露 Token/PII。
8. TypeScript、Python golden/contract parity；重复请求、分页（如果有）和协议 schema 验证；旧账户/内部 Service 必要路径保持功能。

每项要有可回放的**原始响应代码、业务断言、输入/版本 SHA、环境与资源清单**。反例没实现或未测试只能标 `NOT_TESTED`，不能当 Gate 通过。

**B 的放行条件：**授权用户可完成“同意→第三方读取→撤销→第三方立即拒绝”的端到端流程，在已安装 0.14.2 与真实隔离 SQL/HTTP 上 PASS；没有新开放的同步/凭据写入能力。

## 4. Package C — 数据/API 统一与消费者迁移协议

**Owner：**Viewer + Taiko/Sakura Adapter 联合审阅。**交付：**按数据域与调用方分类的权威映射、source/version 行为与兼容矩阵。

- **身份**：Viewer Account 是 Web session owner；QQ/OneBot/官方 ID 是独立命名空间，验证映射后才跨端关联。
- **成绩与历史**：current 是可编辑的最佳记录集合；history 是 full/delta 观察证据，不是每一局的 play event；Growth Canonical Fact、冻结 measurement 和 Goal 事实各有 owner。API 文档不能把“同步一次”称为“打了一局”。
- **提交**：Publication committed generation 为多 Reader 一致性的事实边界；缓存必须携带 revision，不直接以文件 mtime 或内部路径充当跨平台版本。Viewer/taiko-bot/Sakura 的数据使用者逐个映射到 source 及合适的 adapter。
- **公开元数据**：同一曲名、谱面难度、区域/实装范围、单双打、v1/v2 模型若有意不同，保留明确 Profile；不要为了叫统一就合并不同算法。
- 建一份路由/消费者矩阵，字段至少有 `entry / reader-or-writer / owner / auth / scope / source / contract-version / side-effects / migration / regression / sunset`，将当前 Developer API、Bot service、public-score-token、Web session 路由全部纳入。对本轮不更动的旧接口标 `COMPAT_RETAINED`，不得标为已迁移。
- OpenAPI 的公开示例与 TypeScript SDK smoke 只能对已实现的隔离路由声明可用；生产文档、外部链接与公开申请页面的“已开放”说明须等正式发布。

**C 的放行条件：**一个字段/对象有一个契约 owner，跨调用方差异可解释；旧调用者不因为新 v1 的存在而失效；不额外生成第二套 Source of Truth。

## 5. Package D — Freeze Candidate、验证与评审

**本轮禁止把版本标签等同生产状态。** 在隔离分支实现 0.83 契约与 API；未获 0.83 Freeze / release 授权前，当前生产与 0.82.1 候选版本声明不变。需要 package/version 变更时作为明确的候选 diff，并独立 signoff。

- 使用持久工作树 `/home/sigaer/taiko/.worktrees/` 与 `/home/sigaer/taiko/qa-vault` 的独立 QA run；scratch 有界、日志 hash+fsync、清理只限自身。控制单次产物体积与磁盘余量。
- 定向运行：Contract Python/JS Golden、真实隔离 MySQL/HTTP 授权 E2E、安装态 `-I` 来源/核心只读 Worker、版本响应与兼容路由、一次受控完整 Nuxt Build、最小用户同意页交互。不要重新执行 0.82 的 119 SQL、46×2、全 PNG、Annual 负载。
- 阻断条件：匿名或错 owner 访问私有数据，grant 撤销/过期仍可访问；错误 source/时间/双打/等级；跨 Writer 混代；数据或私有 token 外泄；已证明的重要旧调用方回归。格式与局部文案小问题可单独记 P1。
- 非生产演练通过后只产出 Freeze 候选，不声称 0.83 正式完成；由 Owner 审阅契约 diff、API 暴露范围、资源 owner、弃用策略及安全反例后再单独决定 Freeze。

### 最终文件（少而完整）

1. `docs/083-contract-freeze-candidate.md`：语义、非目标、技术决定、每项 PASS/FAIL、残余风险及 Owner 待签。
2. `docs/083-contract-and-api-matrix.json`：机器可读的 route/consumer/schema/grant/read/write/side-effect/compatibility 清单。
3. `docs/083-developer-api-openapi.yaml`（或原仓库既有规范位置）：**只列实际已实现候选**，含请求/响应样例和安全定义。
4. 一份最小 migration/schema change、合同 Golden、开发者同意/撤销 E2E、非生产用户操作示例。
5. `/home/sigaer/taiko/qa-vault/evidence/083-.../`：必要原始日志/样本/哈希；禁止把账号、token、私有成绩带入 Git。

每个工作包以一个明确提交/提交组结束，保持 Git 工作树干净。若任务受阻，报告最小复现与唯一下一动作；禁止为完成实施又发起一轮全仓库历史盘点。

## 6. 执行次序与验收状态

| 顺序 | 工作 | 完成定义 | 允许继续的范围 |
|---|---|---|---|
| T0 | Owner O1/O2 签收落盘 | Gate C=`PASS_WITH_ACCEPTED_RISK`；原始 FAIL 不动 | 无推送/部署 |
| T1 | 0.83 规范与草案复核 | 唯一 Contract、权限模型、MVP scope、路由表 | 可以并行开展 T2/T3 |
| T2 | ResourceGrant + 用户同意/撤销 + 私有 Score v1 | 真实隔离 SQL+HTTP 下端到端 PASS | 不得开放生产路由 |
| T3 | 公共 Catalog/Meta + API v1 契约适配 | 版本/来源/Schema Golden PASS | 不切旧 API |
| T4 | 跨客户端兼容与受控构建 | 关键消费者无回归；Nuxt Build PASS | 仅生成 Freeze 候选 |
| T5 | Owner 审阅 0.83 Freeze Candidate | 决议明确、缺陷与风险列明 | 未明确批准前不得标 FROZEN |

**Gate P 仍独立：**生产 ingress/ACL/运行版本、完整 PITR 与 RPO≤15min/RTO≤120min、异地备份/权属、灰度/回滚和部署批准。不得因 Gate C 签收或 0.83 开发完成而默认获得任何生产读取或写入权限。

## 7. 立即交给 Codex 的主控提示词

> Owner 已确认接受 O1（12 PNG 历史像素证据缺口）与 O2（history 历史 474/126 及 B30/merged-history 性能残余风险）。请先在隔离 Viewer 0.82 树中准确落盘 Gate C=`PASS_WITH_ACCEPTED_RISK`，保留所有旧 FAIL，并保持 Gate P=`DEPLOY_PENDING_AUTH`。然后进入 **Viewer 0.83 Contract / Developer API v1 Freeze Candidate 实施**：对比现有 `78ce858` 草案与最新 Viewer 0.82.1，复用 `sakura-taiko-contract` v1、安装态 Taiko 0.14.2 和 PublicationStore，不创建第二套权威 Schema 或 Writer。优先交付 **公共 Catalog + 用户按绑定授权的私有 Profile/Score 只读 API + ResourceGrant 同意/撤销**，Developer Token 必须与用户资源授权分离。以真实隔离 MySQL/HTTP 做完整权限负面测试、契约 Golden 和一次非 Annual 构建冒烟。保留旧 token/QQ/service 的兼容边界，不开放新的同步或上游凭据写 API，不触及 Annual 业务负载和过季功能。成果在本地隔离分支提交为 0.83 Freeze Candidate，交付机器可读矩阵、OpenAPI、最小 E2E、清单/证据与 Owner 待签；未经额外授权不得 push、merge main、访问生产配置或数据、部署、重启、擅自冻结 0.83。

**结束标准：**第一次完成真实隔离授权闭环之后，就提交可审阅结果；不要求先建全量 OAuth、拆服务、重写算法或把所有旧客户端统一切换。
