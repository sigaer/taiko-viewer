# Viewer 1.0.0 — My Taiko, in one place.

> 2026-10-16 最新隔离候选续行：用户已批准本地 Taiko 0.14.2 验证；详见 [本轮收尾](platform-architecture-audit/local-0142-closeout-20261016.md) 和 [Gate 矩阵](platform-architecture-audit/viewer082-gate.json)。原时点记录保留。O1 目标已明确、实测未签收；0.82 仍 BLOCKED，未进入 0.83。

> **2026-10-16 Runtime Integration 增量**：已完成精确角色重建、共享 memory wheel 补齐、compute/Annual/merged/Growth installed 入口，以及两个角色各 46 个代表生命周期和新增 16 项 merged SQL 验证。凭据控制面与 Source-switch 失败已离线复现并保留，0.82 仍 BLOCKED。详见 [本轮实现与 Gate](platform-architecture-audit/runtime-integration-20261016.md)；未升级版本、进入 0.83 或部署。

> **2026-10-16 执行增量**：独立 MySQL 测试配置已自动化解决，实际 `SELECT DATABASE()`、datadir 与 mutation opt-in 验证后，私有成绩授权/条件读取/同步代理共 **92 项 SQL/HTTP 测试通过**；没有访问生产数据库。证据及复验命令见 [gate-evidence.md](platform-architecture-audit/gate-evidence.md) 的续行记录，整体 Gate 仍受未完成项约束。

> **2026-10-15 执行增量**：已基于实际 Viewer main `56aa05a` 建立 `feat/viewer-1-readiness-20261015` 隔离候选，修复私有代理与失败响应缓存边界，候选版本 `0.82.1`。当前 main 与下文旧 ownership 候选存在分叉，禁止整树覆盖。实际测试、五份机器/人工验收材料与剩余阻断统一记录在 [gate-evidence.md](platform-architecture-audit/gate-evidence.md)。0.82 总 Gate、1.0 RC 仍未通过，未合并或部署；下文原始基线保留供追溯。

> 2026-10-15 · 三仓库整合收尾 / 数据与 API 统一 / 开发者开放平台主控实施方案  
> 版本路线（本次以用户确认的截图为准）：**0.82.x Architecture Audit → 0.83.x Contract Freeze → 0.90.0 Taiko Core Beta → 0.95.0 Platform RC → 1.0.0 Sakura Taiko Platform**。
>
> **状态：执行方案 / 非验收证明**。以下 `PASS` 仅指已提交记录及代码能证明的局部事实；未做生产数据库、线上 API 或发布操作。建议由 Codex 在隔离 worktree 按文末指令执行，每一个 Gate 只在证据完整后改变状态。

## 0. 主决策：不能让历史清理阻断 1.0

1. **停止把“文件数量归零”当目标。** `Sakura_bot` 旧 Taiko Python *运行实现* 在候选分支中为 0；但 195 个 Java/MyBatis + Vue 独立实现和 2 个活跃上传集成不是同一迁移单元。195 个独立系统保留为有清晰 owner 的 legacy application；上传集成在候选收尾期间因真实消费者暂不删除，1.0 前应将其太鼓专用逻辑迁往 Taiko 所有权边界，只允许 Sakura 留下可复用的通用消息/上传宿主协议。27 个未迁测试保持独立 debt ledger，按其覆盖的 Gate 决定是否阻断，而非统一以数量封锁发布。
2. **优先 P0 保护。** 源码审计发现，Developer Token 目前是身份/配额凭证，不能证明对指定用户成绩的授权；`/api/developer/userdata/[userid]`、部分 `/api/taiko/proxy/*` 存在缺失 caller→resource owner/grant 的路径。此为源码风险，不代表生产公网一定可达，也不证明已发生泄漏。在开放新开发者能力前必须完成负面授权测试，并核查实际 Nginx/ACL。
3. **复用已有基础设施。** 现有 `packages/sakura-taiko-contract/schema/contract-v1.json`（语言中立）、`@sakura-taiko/contract/score-read`、Taiko `PublicationStore`、Taiko 0.14.1 候选 wheel、Viewer Worker 与 Growth 事实投影是优先复用点。不再另外生成一份“新标准”或“第三套实现”。
4. **1.0 目标是可验证的统一**：一个 Web 用户主身份（保留上游账户和 Bot identity namespace 显式映射）、一个成绩 Schema、一个观察/事实/成长投影标准、一个对外数据接口标准，以及多个客户端；**不要求**把所有 JSON 搬入 SQL 或立即拆分微服务。
5. **仓库职责明确**：Taiko/Core 保持纯领域算法与已安装计算构件；Taiko Storage/Publication 是可恢复写入协议；Viewer 是账户/用户授权/产品事实/Developer API 与 BFF 的 owner；Sakura 的最终职责仅是通用 QQ/OneBot 宿主与通用消息适配层，不再持有任何 Taiko 专用实现（目前两个上传集成是暂存待搬迁项）；`taiko-bot` 及其他第三方通过稳定 Contract/API（或本地安装的纯计算包）使用能力。

## 1. 目前基线（要可重复核对，不能自称线上已完成）

| 仓库 | 当前 main 基线 | Python ownership 候选提交 | 候选形态 |
| --- | --- | --- | --- |
| `sigaer/taiko-bot` | `248713e` | `15722e8` | `refactor/final-python-ownership-20261015` |
| `sigaer/taiko-viewer` | `777546c` | `6331aea` | `refactor/final-python-ownership-20261015` |
| `sigaer/Sakura_bot` | `86b8334` | `38298af` | `refactor/final-python-ownership-20261015` |

已报告离线证据：6 类 CLI JSON、12 类 PNG 精确对照、merged-read 协议、Growth 旧指纹连续性/变更检测、systemd Worker 隔离、Viewer 构建及 54 项 Growth/history 测试。完整离线套件 **271 PASS / 7 SKIP / 1 FAIL**，1 个 Source-switch FAIL 在冻结旧源码复现；不能改写为 PASS。client 代表性命令仍使用 0.14.0 而非全新 0.14.1 安装；没有认证 API/SQL E2E；12 个隔离资源未异地备份；三候选分支均未合入主线、未部署。

### 本轮重要实际代码依据

- `taiko-viewer/taiko_viewer/server/utils/account/developer.ts::getDeveloperUserdataByUserid()`：目前调用 `enforceTaikoOpenQuota(event, "developer_userdata")` 后按 `userid` 读取原始 JSON，没有目标用户授权链。
- `taiko-viewer/taiko_viewer/server/utils/taiko-open.ts::enforceTaikoOpenQuota()`：developer bearer 提升请求配额（当前默认匿名 100/日、developer 2500/日，可配置），配额≠数据授权；计数路径仍应验证原子性和信任代理。
- `taiko-viewer/taiko_viewer/server/internal/account/shared.ts::writeUserdataWithHistory()`：自行 `rename(current)` 后另行 `writeFile(history)`，不能保证跨 current/history 的单次 publication 提交。
- `taiko-bot/taiko_store/publication.py`：已提供 `PublicationStore` 的 exclusive/shared、可恢复 commit、不可变对象和兼容投影，可作为跨 Writer 单一协议基础；不能仅因该类存在就宣称所有 Writer 已使用。
- `taiko-bot/taiko_bot/offline/fingerprint.py`：wheel 模型身份按已安装 Python/JSON 内容计算；Growth 用 `growth-compatibility.dat` 保留验证过的旧摘要，否则进入 v2 identity。
- `taiko-viewer/taiko_viewer/server/services/growth-history/model-revision.ts`：当前每次请求计算 identity 前都要启动 `getTaikoArtifact()` 子进程并扫描包，命中缓存不等于无成本；需热/冷性能基线。

## 2. 两条并行线：P0 安全止血 + Ownership 收尾

### Track S — 不等待版本路线的安全修复（优先、隔离变更）

**S1：建立所有公开入口的权限矩阵（不能只改 token 检查开关）。** 按公开曲库/资源（匿名只读）、Web account（session + binding owner）、Developer App（client identity + 用户 grant + scope）、内部 bot/service（独立 service credentials）、运维密钥更新（受控管理通道）分离。先 enumerate 所有 `server/api/developer/*`、`server/api/taiko/proxy/*`、`server/api/taiko/internal/*`、中心公共 API 和 miku upload 的调用链。`GET` 若会修正当前绑定或触发同步，改为显式 mutation 或保留兼容适配且严格授权。

**S2：所有私有读和副作用默认拒绝匿名。** 校验 Web 登录/外部 client identity；验证 `userId → binding → taikoId` 权属或独立的用户 grant，按 scope 减小能力。`userid`、`identityKey`、路径模板一律 strict allowlist、safe root confinement（拒绝 traversal/symlink）；同样处理服务端返回敏感 JSON 的 cache-control。不得把 `requireDeveloperToken=true` 当修复完毕；Developer Token 单独存在并没有资源授权。

**S3：封堵上游凭据控制面。** `api/token`、`/uploadTaikoLogin`、Hiroba 已存凭据代理和 sync dispatcher 分别证明调用方身份、网络 ACL、secret boundary、配置与日志脱敏。选择移除公网路由或经签名/服务身份与最小权限授权。不得尝试生产环境漏洞利用；使用隔离合成测试和实际只读 Nginx/ACL 审计。

**S4：否定性安全矩阵（上线阻断）：** anonymous、错用户、错 binding、过期、撤销、错 scope、错 audience、无效 identityKey、路径越界、缓存穿透、并发配额、重复调用分别必须验证 401/403/404/409/429 与无副作用；对 fail-closed 路径做服务不可用测试。

**当前新开发者申请临时政策：** 申请可以继续接受与人工审查；只允许公开/匿名数据契约的使用示例与合法的开发者配额，不将旧 Developer Token 描述为“读取所有用户成绩”的凭证。访问私有成绩，短期可基于现有由用户主动生成、可撤销的 `public-score token` 走兼容读链，但这个旧接口会触发刷新，且并非新的 Developer API，应标出限频、用户授权与弃用计划。未经用户 grant，绝不提供原始私有 JSON。

### Track O — Python ownership 候选验收与最终交付

- [ ] `O1` 比对三个 main 基线与候选分支；先检查所有自动部署触发器、PR hooks、P0 dirty worktree、外部 workflow/rulesets；**不要直接合并或重启**。
- [ ] `O2` 对 Taiko 0.14.1 做干净的 venv/wheel 非 editable 安装，锁定实际依赖（`taiko-application`、`sakura-taiko-core` 等）与 wheel SHA-256，验证 `-I -m` 与系统服务模板所需解释器一致。全新环境分别跑 center/client/Viewer，不以 client 旧 0.14.0 测试充数。
- [ ] `O3` 修复、隔离跟踪或正式审查 Source-switch 既有失败；保留可复现脚本与旧/新失败结果。7 个 SKIP 写明数据隐私阻断，27 个历史测试逐项归 owner，**关键安全/写入路径测试不得接受永久不运行**。
- [ ] `O4` 使用合成账户与独立 SQL，完整走登录→绑定→同步→current/history→Growth/Goal→年度总结→分享，以及 API/锁/拒绝场景；测试前打印并校验 `SELECT DATABASE()`，禁写生产库。
- [ ] `O5` 12 个隔离资源做异地加密备份并校验 hash、持久归属与传播权利；公开 Taiko 的 `resources/final-ownership-inventory.json` 包含原私有路径信息，做信息披露与公开材料审查。仅删当前版本并不移除公开 Git history。
- [ ] `O6` 将 195 个 Java/Vue 实现单独登记为 Independent Legacy App（可保留、移出或独立退役审计），2 个有消费者的上传集成先维持使用，再将太鼓专用功能迁到 Taiko Owner，通过稳定通用宿主适配衔接；15 个共享 host Python 文件独立签收。不得错误报为“旧 Python 算法残留”。
- [ ] `O7` 编制 rollback manifest：每仓库 commit、wheel+依赖锁 hash、catalog/model hash、数据库结构及恢复路径、生产进程解释器及环境变量；演练恢复，确认历史行不重写。
- [ ] `O8` 完成 staging/灰度，验证 CLI/PNG parity、资源、Worker cgroup 生命周期、错误码、缓存失效、p95 和并发。后续根据部署触发器分批、受控合并，不能合并即假定上线。

**Ownership 收尾的合理 DONE**：旧 Sakura Taiko Python runtime 依赖为 0；wheel runtime 走唯一执行路径；离线与认证 E2E、回滚演练、公开资源审查都可复核。与 Java 应用的“最终退役”和全部低风险历史测试改造分别计账，不机械阻断独立阶段。

## 3. 0.82.x Architecture Audit — 封闭剩余架构决策

请利用已有 `docs/platform-architecture-audit/`、`docs/data-flow-map.md`、`docs/taiko-domain-extraction/`，**增量审计，禁止重新做一份平行的大报告**。

应输出并经 owner 签收：

1. `ownership-map.json`：Domain/Adapter/Product/Infrastructure 每个关键入口唯一 owner（主读取者/Writer/消费者/退役状态）。
2. `api-auth-matrix.json`：路由 + method + public/private + authentication + grant/scope + expected side effect + cache policy + status code + caller。
3. `writer-matrix.json`：当前中心 Python、Viewer TS、dispatcher、Hiroba、Kinoko、manual、u0 materialization 的 commit/lock/fault/repair 路径；每项标是否 `PublicationStore` 全量兼容。
4. `runtime-release-manifest.json`：解释器、wheel、schema、数据、数据库、部署配置及回滚路径 hash（不得包含 secrets）。
5. `gate-evidence.md`：记录确实跑过的测试、已知失败、暂不访问生产的边界、修复问题的签收链接。

**0.82 Gate**：所有 P0 入口有 owner 与补救动作；旧 Python 运行迁移 DONE 或清晰列为阻断；不虚构线上通过。架构变更不再继续记录为 0.81.x。

## 4. 0.83.x Contract Freeze — 数据语义与开发者权限一次冻结

基准为 Viewer 仓库 `packages/sakura-taiko-contract/schema/contract-v1.json`，保持兼容演进。禁止并列设计另一个权威 Schema。

### 4.1 Identity

- `User { namespace:'viewer', id }` 为平台 Web 主身份；外部 Wahlap/Hiroba/Bot/QQ/manual/legacy-content 均以 `ExternalIdentity { namespace,id }` 显式映射。
- `Binding` 是经过来源验证的关系；Bot `bind.qq` 不是 Viewer user ID；相同 `taikoId` 字符串不代表第三方自动取得 owner。
- `DeveloperIdentity` 仅说明 client 身份与申请 owner；独立引入 `ResourceGrant`（user、client、binding 或 resource、scope、issued/expires/revoked、audience），不把开发者身份本身升级为资源授权。

### 4.2 Chart、Score、Observation、Fact

- chart identity 明确 `songId/chartId/difficulty(成绩 level 1–5)/star level/catalogRevision/type(single|double|unknown)/variant`；TJA `COURSE 0–4` 必须显式转换。歌曲 ID 不等同谱面 ID；重复版本处理属于算法 policy。
- `Score` 对应上游最佳记录，不等于单次游玩事件：`high_score→score`、`good_cnt→good`、`ok_cnt→ok`、`ng_cnt→ng`、`combo_cnt→combo`、`best_score_rank→rank`，`clear/fullCombo/dondafulCombo` flag 与对应累计次数分离，`null` 不误归零。
- 保留 `source`、`capturedAt`（平台真实观察时间）、`highscoreAt`（上游显示的历史时间）、`updatedAt`（上游更新文本）的独立语义；禁止凭 snapshot 变化或 `updatedAt` 推定某一天真的到店游玩。
- Growth 链：`Raw Score → GrowthObservation → CanonicalFact → GrowthProjection`，保留证据强度、排除原因、来源切换、Asia/Shanghai 归属日、occurred/observed/confirmed、Daily frozen measurement。Goal completion 是自己的事件事实，不能混成 score event。
- 算法 Profile/版本：v1/v2、TopN、地区/国行实装、单双打、下架/重复版本、定数来源、算法闭包 hash、catalog/model/availability revision 和输出 schema version；如历史存在 center/client 有意不同，先标签分离再逐条 Golden 对齐，不使用一个模糊的统一名称。

### 4.3 Storage / Publication — 不要求先全迁数据库

统一约定 `ScorePublication` 为 `(owner key, revision/commitId, current payload, history full/delta set, source, transactionId, content digests)` 的**可恢复提交**。一个 logical write 的 current/history 必须可追溯到同一次 committed revision；请求重复不得导致同名 history 覆写；并发和断电可恢复一致的 committed revision。所有 Python/Node/dispatcher 写入者采用同一 `PublicationStore` 协议或可证明等价的同一管理写入口，禁止 Viewer TS 继续孤立写文件。

`taiko_store` 现有 committed manifest/object store 可作为实现层，Viewer Node 可以通过受控已安装模块的 CLI/service adapter 调用，而非直接修改该 Python store 私有布局。先读契约/接收 ready receipt，再更新 Viewer 缓存和事实索引。投影兼容旧 consumer 读取；发生共享写期间，旧 reader 的一致性保证需明确并验证，不宣称读取旧路径天然具备快照隔离。

**0.83 Gate**：Python + TypeScript Schema 生成与 roundtrip、Golden、源切换/错误输入/隐私过滤、跨 Writer fault injection、老接口兼容均通过；包含 breaking change 时 bump contract major、明确迁移窗口。

## 5. 0.90.0 Taiko Core Beta — 权威算法与服务接口 Beta

Taiko 的 wheel 能力已经存在，**0.90 是 Viewer 平台里程碑，不是把 Taiko 0.14.1 与 Viewer 0.90.0 混为同一版本**。

优先任务：

1. 在 Core 的纯算法层固定 Rating、六维、谱面识别、定数适用规则、推荐候选/评分和历史事实共用的基础规范化；不要把 NoneBot/SQL/网络/文件系统/账号授权迁入纯 Core。
2. 移除或薄化重复实现，逐个 caller 使用明确版本的计算 Profile；完全一致才能合并算法，确实不同则保持具有明确语义的单独 profile。
3. `GET /api/v1/meta` 给出版本、`contractVersion`、可用 `catalogRevision`、`calculationProfiles` 与弃用策略。API 的响应消费基于 version/ETag/revision，不依赖同机私有文件名。
4. 保存中心最佳成绩、历史证据、Growth fact、过去日 measurement 的独立 retention/lineage；不可将历史 measurements、完整用户历史或凭据当作可以随时清理的 cache。
5. 先做受控能力读取层和 typed API，再按实际负载决定是否拆独立服务。不要在 Core Beta 阶段进行全量 DB 重写。

**0.90 Gate**：三客户端对等 fixture、结果/版本一致性、API Auth/Writers 正式通过；没有绕过 Contract 的新 raw-data 调用入口。

## 6. Developer API 统一：第三方接入的最小正确形态

### 6.1 资源分类与身份

| 场景 | 推荐入口 | 验证 |
| --- | --- | --- |
| 公共曲库、公开谱面元数据、数据包 manifest | `GET /api/v1/catalog/*` | 可匿名 + 限额 + schema/revision/ETag |
| 用户自己的绑定与成绩 | `GET /api/v1/me/bindings`, `GET /api/v1/me/scores` | Web session 或用户授权的 access token，验证 owner/binding/scope |
| 用户历史观测与成长 | `GET /api/v1/me/observations`, `GET /api/v1/me/growth` | grant 中的 `history:read`、`growth:read`，限制字段与范围 |
| 申请同步 | `POST /api/v1/me/sync-requests` | `sync:request`、确认目标用户与限流、显式副作用 |
| 已授权应用/令牌管理 | `/api/v1/me/grants/*` | 登录的资源 owner 发放/撤销；审计、失效、到期 |
| 平台内部 Bot 操作 | `/api/internal/*` | 独立的 service-to-service 身份，不是普通 Developer Key |
| 成绩凭据写入 / Hiroba 账户绑定 | 独立安全控制面 | owner+重新验证/服务凭证/审计，默认不进入公开 v1 |

以上为**目标设计提案**，不是当前已经实现的真实路由。应基于现有 route topology 形成 OpenAPI 3.1，并有合成测试生成 SDK fixture。避免暴露完整上游 `userdata` 原样记录，按契约返回所需字段并规范 provenance。

### 6.2 Developer 与 User Grant 必须分离

- 开发者申请 → 管理员审核 → `Developer App/Key`：表示应用身份、流量配额、调用能力集，不附带读取其他用户成绩的默认权利。
- 用户选择所绑定的太鼓账户、授予特定应用所需 scopes → 生成有 `clientId / userId / bindingId / audience / expiresAt / revokedAt` 的授权记录 → 每个私有 API 验证 grant。
- 面向第三方 App 建议采用 Authorization Code + PKCE（或先实现独立用户同意流程及短期 scoped token，具备迁移到 OAuth 的协议计划）；不能拿普通开发者 API Key 冒充用户授权。
- 旧 `POST /api/public-score/by-token` 做一个受控兼容窗口：只能读取持有人显式发放的绑定，文档说明该旧接口会尝试更新成绩，给出 sunset 与替代端点；新的只读 GET 不应暗中执行上游刷新。

### 6.3 错误/幂等/配额与审计

- Error envelope 稳定：`code/message/requestId`（不包含 secret、完整 raw token 或私有文件路径）。
- 数据结果携带：`contractVersion`、`catalogRevision`、`scoreRevision`、`calculationProfile`（适用时）、`observedAt`、`source`、`stale/consistency`（适用时）；ETag 随 revision 改变，Cache-Control 按 owner 隔离。
- 非法/缺 token → 401；已认证但无资源授权 → 403；资源不存在/隐藏 → 审慎 404；已撤销/过期 → 401；冲突 → 409；限流 → 429；上游不可用区分 502/503。
- private endpoint 的日志只记录哈希化 subject、requestId、resource type、scope、decision/latency，严禁写入 cookie、access token、用户成绩 body。
- 用 SDK 示例验证 Node/Python 的分页、增量 cursor、版本不匹配、离线 cache refresh、并发 Retry-After；Rate limit 的计数要可原子一致，可信代理设置要明确。

**公开新开发者文档的最低标准**：独立的 Public Catalog quickstart、OAuth/grant 或明确的过渡用户 token 授权说明、示例、错误码、限流、政策/隐私、scope、版本变更日志、deprecation。所有文档 URL 仅在实际 endpoint 上线后展示为正式可用。

## 7. 0.95.0 Platform RC — 跨端同事实与回滚演练

- [ ] 完成 P0-AUTH / P0-WRITE / P0-CREDENTIAL-BOUNDARY、G-RESTORE、G-RUNTIME；不允许靠抽掉测试或放宽断言提高通过率。
- [ ] 连贯链路：数据源同步→publication→版本化读→Growth事实→Goal/Passport/Weekly/Annual→授权 API→taiko-bot/Sakura/第三方；同样输入的同一个 Profile 返回同样结果。
- [ ] API 合成多租户安全 E2E：至少 A/B 两个 Web 用户、各自 binding、两个 App、已授予/拒绝/撤销/过期 grant、Bot service identity、Source-switch；全程无生产写入。
- [ ] 历史不重写：legacy Growth 旧 digest 与兼容 wheel 对照；升级后旧 measurement/annual report 原样保留，新计算附新 revision，缓存 invalidation 可解释。
- [ ] 并发：跨 Python/Node/进程写锁、竞态、重试、单用户及多用户并发、partial FS fail、磁盘空间不足、kill -9 恢复；有统一 `commitId` 与可重建投影。
- [ ] 真实性能：记录 p50/p95/p99、RSS、Worker admission/CPU/IO/PSI、wheel identity 扫描、冷/热 Growth 与年度报告；SLO 基线事先冻结，性能退化须明确接受而非感觉“变快”。
- [ ] 部署恢复：所有涉及的 MySQL、当前 C/H、历史 daily archive、Growth measurements、Goal facts、配置和构件 hash 一致备份；实际隔离恢复演练及 RPO/RTO 签字。
- [ ] 版本标签、OpenAPI 文档、客户端兼容测试、迁移指南、通知与撤销管理都准备就绪。

**RC 发布原则**：可以持续开放现有 Viewer 产品的稳定版本，但危险新路由不得对外；RC 可以暂不完美，但不得缺少用户授权或 publication 恢复证据。

## 8. 1.0.0 — 产品闭环，而非只改版本号

- 登录/未登录个性化：My Taiko 首页聚合用户当前账号、成绩、最近有证据的变化、推荐、计划与成长；没有已授权来源时不伪装已知用户行为。
- 歌曲/谱面详情与论坛、推荐、挑战/Goal、成长 Passport/Weekly、年度总结相互导航，避免功能孤岛。
- 公开开发者中心：申请/审批、应用资料、Key 和 User Grant、用量/错误分析、交互文档、版本兼容与安全撤销。
- 每个客户端——Viewer、Sakura、taiko-bot、第三方脚本——都能解释统一实体 ID、内容版本、成绩字段、来源/时序，不再复制不同的“标准”。
- `/api/v1` 对第三方稳定，弃用老接口有兼容窗口；公开信息与私有数据严格分离。

> **1.0 的最终定义**：一个用户身份（多来源绑定），一个成绩标准，一个成长事实标准，一个开放接口标准，多个客户端；所有 critical paths 可恢复、可审计、可回滚，生产签收证据齐全。

## 9. 建议的 Codex 执行策略：一次有实质产出，不要挤牙膏

把本 Markdown 放在 Viewer 的 `docs/` 后作为主控说明，在三个仓库的**隔离工作树**中执行。不修改生产环境、不自动推主分支。以工作包为单位并行：

**Package A（Runtime Closeout）**：Taiko 候选 wheel 固化 + 三仓库合约/构件 hash + fresh client/center install + 认证合成 E2E + Source-switch issue + 资源保护 + PR/deploy-hook gate；产出一套完整候选与 rollback manifest。

**Package B（P0 Security Boundary）**：Viewer Developer userdata/proxy、Sakura 凭据通道安全矩阵 + 最小权限适配 + 负面 E2E，不等待抽 Core。若 P0 修复确需影响 production，就单独申请明确的上线授权，不能擅自部署。

**Package C（Single Publication）**：梳理所有 Writer，基于 `taiko_store/publication.py` 收敛 `writeUserdataWithHistory()`、dispatcher、manual/edit/import，打通版本回执、同一 commit current+H、恢复和历史修订。

**Package D（Contract + Developer API）**：扩展现有 `sakura-taiko-contract` + 冻结 JSON Schema/TS/Python Golden，建立 OpenAPI/typed adapters、用户 grant、权限层、公开 SDK 样例与弃用适配；不能在契约不稳时先做 UI 新入口。

**Package E（RC/Product）**：Growth/Goal/Annual/Score/API 同事实回归 + My Taiko 产品信息架构 + 真实灰度 + 多端兼容 + 1.0 发布说明。

### Codex 主控提示（可直接复制给实施代理）

```text
阅读这份 Viewer 1.0.0 主控文档，以及现有 Viewer docs/platform-architecture-audit/*、docs/Sakura_Taiko_Domain_Extraction_Program.md、Taiko docs/final-python-ownership.md、Sakura docs/final-python-ownership.md 和各仓库 AGENTS.md。

不要重新创建并列抽象或重复算法。先核对当前分支/dirty worktree、已存在的 Contract / PublicationStore / Python wheel 候选和已知测试证据。

从 Package A/B/C/D 的阻断关键路径开始，提交有可验证结果的隔离候选变更。P0 Safety 和 Writer consistency 优先于 1.0 UI；但不把 195 个 Java/Vue 文件及与关键路径无关的旧测试视作必须删除的 blocker。

严格禁止生产 SQL 写入、读取真实私人凭据、启动部署/重启、合并 main、覆盖 P0 dirty worktree、绕过 Memory QA admission、删除或改写历史 measurement/annual 报告。用合成身份、隔离数据库并校验 SELECT DATABASE()，测试不通过须记录 FAIL。不得把已知旧错误记作 PASS。

先输出准确的影响面/依赖闭包/验收命令，完成实现后输出每个 Gate 的证据路径、未处理的明确 blocker、三仓库各自 commit 和 release manifest。对所有新接口有正向和负向权限测试、OpenAPI Schema/Golden、带版本的字段语义；保持 staged rollback。

如果修改可能触发 GitHub 自动部署，先停下，给出具体 hook 证据和待批准的操作，不得主动合并或上线。
```

## 10. Release Gate 状态模板

| Gate | 当前状态 | 更改为 PASS 的最低证据 |
| --- | --- | --- |
| Legacy Python runtime ownership | CANDIDATE | 0 残留执行路径、fresh wheel + 全链路校验、正确回滚 |
| API authorization | BLOCKED | owner/grant/scope + negative E2E + 生产路由边界核验 |
| Credential boundary | BLOCKED | Cookie/Hiroba/dispatcher 每入口 ACL/auth + 否定测试 |
| Single Writer/publication | BLOCKED | Python/Node 所有当前 Writer 一次 commit + 故障恢复 |
| Contract freeze | PARTIAL | Schema/Golden/Python+JS/API 模型版本/真实字段语义全签收 |
| Growth historical continuity | PARTIAL | 旧 digest + 新 revision + 不可重写历史证明 + 性能基线 |
| Production restoration | UNKNOWN | DB/C/H/archive/measurements/config 跨域隔离恢复证据 |
| Developer API v1 | NOT STARTED | 权限/版本/Docs/SDK/consent/revoke/监控完成 |
| Viewer 1.0 RC | BLOCKED | 以上全部 P0 和 Gate PASS + 端到端安全灰度 |

## 11. 已参考的确切仓库依据

- `https://github.com/sigaer/taiko-viewer/blob/main/docs/Sakura_Taiko_Domain_Extraction_Program.md`
- `https://github.com/sigaer/taiko-viewer/blob/main/docs/Sakura_Taiko_Domain_Extraction_Execution_Plan_v2.md`
- `https://github.com/sigaer/taiko-viewer/blob/main/docs/platform-architecture-audit/api-boundary-audit.md`
- `https://github.com/sigaer/taiko-viewer/blob/main/docs/platform-architecture-audit/platform-risk-map.md`
- `https://github.com/sigaer/taiko-viewer/blob/main/docs/platform-architecture-audit/data-ownership-audit.md`
- `https://github.com/sigaer/taiko-viewer/blob/main/packages/sakura-taiko-contract/README.md`
- `https://github.com/sigaer/taiko-bot/blob/refactor/final-python-ownership-20261015/docs/final-python-ownership.md`
- `https://github.com/sigaer/taiko-viewer/blob/refactor/final-python-ownership-20261015/docs/final-python-ownership.md`
- `https://github.com/sigaer/Sakura_bot/blob/refactor/final-python-ownership-20261015/docs/final-python-ownership.md`
