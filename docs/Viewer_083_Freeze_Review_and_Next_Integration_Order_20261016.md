# Viewer 0.83 — Contract Freeze Owner Review 与下一阶段跨客户端集成工作令

**日期**：2026-10-16  
**性质**：Owner 评审建议 + 可交付 Codex 的实施指令；**不是 Owner 已批准冻结的记录**。  
**当前状态**：`FREEZE_CANDIDATE_READY_FOR_OWNER_REVIEW`；`FROZEN=false`；`DEPLOY_READY=false`。  
**优先目标**：尽快结束 0.83 的协议评审和必要局部修订，随后转向 Viewer 1.0 所需的数据/API 消费者统一，**不要重新启动 0.82 ownership 或 Annual 压测**。

## 0. 不可变基线与证据

- Viewer 本地隔离分支 `feat/viewer083-contract-api-20261016`，候选 `0.83.0-rc.1`，交付提交 `ac10427`（以本地 Git 核实完整 SHA）。
- 基线 Viewer `32729e86b070ed5bd40bc033a7d936114e5081ce`；0.82 O1/O2 签收 `c9b87f4`，Gate C=`PASS_WITH_ACCEPTED_RISK`、Gate P=`DEPLOY_PENDING_AUTH`。
- Taiko 0.14.2 固定源码 `a632913dfbdbec1d465f8eaccc0bb80c35e25745`；当前 wheel SHA-256 `398d23000ebde8a9696b8586fc7fff6cf566e49eb6efe970ceba2e5ecf488c0a`。
- center/client 各 94 个发行包，Core 0.1.1 / 0.1.2，support 1.1.0；**已安装的 Contract 0.1.0，不等同于源码增量包 0.1.2**。当前 v1 Viewer 平台 DTO 使用候选源码，不应凭现有 Golden 断言所有 installed Python 客户端已升级。
- 唯一 Schema：`packages/sakura-taiko-contract/schema/contract-v1.json`；本轮 SHA-256 `c9c93ad60185753cc36b62c80e094a42a84612bac19e6353f94a0143236ba46d`；Contract Version `1.0`。
- 当前交付文档：`docs/083-contract-freeze-candidate.md`、`docs/083-contract-and-api-matrix.json`、`docs/083-developer-api-openapi.yaml`；现有证据：74 项真实隔离 HTTP/SDK 观察，JS Golden 11、Python Golden 7，3 个指定 SQL/HTTP 套件，OpenAPI 11 个操作/73 个 schema 实例，完整 Nuxt 构建。证据所覆盖的是本地受控宿主，**非完整构建服务上线演练**。
- **本次没有生产读取、生产 SQL、推送、main 合入、部署或重启授权**。保留 feature flag 默认关闭。

## 1. Owner Freeze Review — 建议的五项裁决

| ID | 事项 | 建议决定 | 明确保留的边界 |
| --- | --- | --- | --- |
| F1 | 唯一 Schema 的 v1 兼容增量 | **同意纳入冻结范围** | User/Binding/Score/Growth 等原 required 与语义不变；Song/Chart 可选字段只作显式映射；缺来源、地区、单双打及上架状态保持 unknown，绝不推断 |
| F2 | Stable Client、ResourceGrant 与撤销语义 | **同意纳入冻结范围** | `clt_` 应用身份不等于资源授权；`plr_` 只指向具体 SQL binding；仅 `profile:read`/`scores:read`，有效期 1–90 天；撤销、过期、禁用与跨 owner/client/scope/audience 的拒绝为强约束；不开放 history/growth/sync/凭据 |
| F3 | 响应上限与配额 | **同意 MVP 有界策略，限额作为可配置运营参数** | Catalog 最多 10,000 源行；单次 Scores 最多 20,000 项/8 MiB；Owner 列表上限 100；超限不得静默截断后返回貌似完整的 200；默认匿名 300/日、client 5000/日仅是候选参数，生产流量/代理可信边界和审计保留策略单独签收 |
| F4 | Legacy 兼容 | **接受不设立即 sunset 日期** | `/api/developer/userdata`、旧 proxy、public-score-token、internal bot service 仍是各自认证域；不自动等价于 v1 client/grant；当前不拆、不删、不开放敏感旧入口 |
| F5 | 正式 Contract Freeze | **先完成第 2 节有限修订/核验，再请 Owner 明确签收** | `FROZEN` 与 `DEPLOY_READY` 为两项不同决策；不得凭本工作令自动标记两者 PASS |

推荐的最终冻结范围应称为：**Sakura Taiko Contract v1.0 compatible additive DTO + Developer API v1 read/consent surface**。它不是全平台 Writer 合并完成、全客户端已经切换，也不是历史/Growth 私有读取开放。

## 2. 冻结前仅需处理的四个细项（不扩大为新一轮综合审计）

### F-A：API 生命周期状态不能永久写死为候选

当前 OpenAPI 的 `GET /api/v1/taiko/meta` 明确要求 `status: FREEZE_CANDIDATE`，同时 `info.version=0.83.0-rc.1`、顶层 `x-freeze-status=FREEZE_CANDIDATE_NOT_FROZEN`。这些值在当前候选正确，但不能将它们不加判断地带入未来正式启用的公开接口。

- 将**契约已冻结状态**和**功能已对外启用状态**明确分离；可在当前尚未冻结的候选中将 `meta.status` 定义为受控枚举/版本化运行状态，而不是永久固定候选常量。
- 默认关闭时仍使用现有 404/禁用行为；不得为了“完成冻结”擅自打开运行时 feature flag。
- 在真正签收时同步更新文档状态、OpenAPI 状态、示例与最小 Golden；不要宣称生产已 ACTIVE。不得在冻结后默默扩展必需字段。

### F-B：有界 API 的失败语义需明确

- 以合成大输入最小测试确认超过 10,000/20,000/8 MiB 时**明确拒绝**并返回文档化的错误，而不是截断或错误 200。
- 记录 Owner 列表达到 100 时是否显示 `hasMore`/完整性说明；若不分页，不应误导用户“已展示全部记录”。
- 只补这些边界测试及 OpenAPI/SDK 对照，不重跑 74 观察或完整 46×2 生命周期。

### F-C：Contract 源码包与 installed Runtime 的升级矩阵

- 冻结文件应区分 Schema 1.0、源码包 0.1.2、现有 installed 0.1.0、以及 Viewer 当前实际使用哪一端类型。
- **若 installed Taiko/Python Worker 未使用新增平台 DTO，不要求此次为了对齐包号重建两个 94 包环境**；但下轮任一消费者开始依赖新增字段之前，必须升级与校验其精确包版本及兼容性。
- 将契约 SHA、生成 TS/Python bindings、API 适配器与 OpenAPI 的映射写入 release manifest。

### F-D：生产启用前的关键安全边界登记

- 验证现有 `verified_title`/manual account 的绑定归属依据与过期/解绑处理足以支持新增第三方授权；非空字段本身不等于独立的上游身份验证证明。
- 用户授权页面应明确展示应用主体、具体绑定、scope 与到期时间；Developer Key 保存在后端，不注入浏览器、URL、前端构建或前端调试日志。
- 独立记录生产 ingress/ACL、可信代理、默认配额、授权审计保留策略及含四张新增授权表的恢复要求，保持 `Gate P = DEPLOY_PENDING_AUTH`。

**验收方式**：只对实际修改部分运行定向 Contract/OpenAPI/SQL/HTTP 负例与一个 Nuxt 构建（若有运行源码改动）；所有结果附持久证据 hash。若不需要源码修改，允许通过有依据的 Owner 文档裁决关闭细项。

## 3. Freeze Candidate 的最终交付与签收动作

1. 输出 `docs/083-owner-freeze-review.md`：F1–F5 决议、业务语义、已知风险、实际测试/未测清单、签名与时间；**未经 Owner 回复不能代签**。
2. 更新 `docs/083-contract-and-api-matrix.json`：从 CANDIDATE 到 REVIEWED 时不得把 scoped PASS 冒充全链路 PASS；`contractFrozen=false` 保持到 Owner 最终批准。
3. 输出 `docs/083-contract-freeze-diff.md`：冻结的 Schema 字段、OpenAPI 11 操作、两项私有读取 scope、版本/错误规则和禁止扩权清单。新业务能力应在后续兼容版本另提案。
4. Owner 明确批准后，才可将**所审批的契约**标记 `FROZEN`；这不等于推送、合 main、迁生产四张表或启用 feature flag。`DEPLOY_READY=false` 保持到 Gate P 独立验收。

## 4. 下一工作包：跨客户端数据/API 一致性（冻结后立即开始；不等待生产部署）

本工作包可先做隔离设计，但具体依赖已冻结字段的实现须使用签收后的精确候选组合。**不要将所有 Bot/Web 内部接口强制改为 Developer Token**：外部第三方数据读取、Viewer Session/BFF、平台 Bot Service 是不同的认证身份域。

**I1：统一数据消费者矩阵**

- 对照 Viewer My Taiko/Home/History/Goal/Recommend、Sakura Bot 现有命令、taiko-bot 本地 Client、Developer API v1，记录每个数据项的 owner、读取位置、版本、来源、权限、缓存及可回滚原实现。
- 优先消除同一业务指标在各客户端无版本标签的差异；保持 v1/v2 CalculationProfile 的合法差别，禁止无批准改公式。
- 对每条消费者只选择一次实际迁移：Contract read port / BFF service / 已安装本地 Core / Developer API v1。不因“统一”而人为增加 HTTP 跳数。

**I2：平台 Read Model / Release Identity**

- Viewer 的 Web 端复用已授权的 `ScoreReadPort` 与 committed Publication ReadView，禁止重新发明一套 JSON 解释器或 Writer。
- 建立跨消费者 `schemaRevision/catalogRevision/scoreRevision/calculationProfile/source` 的统一诊断与差异测试；真实 User/Binding owner 由服务端验证。
- 区分 C/H 观察、Growth Canonical Fact、冻结 measurement 和逐次真实游玩事件；不得把同步或历史 reappearance 计为游玩。

**I3：Developer Center 可用性与迁移**

- 给开发者交付可使用的服务端 SDK 示例、OpenAPI bundling/引用检查、申请→注册→授权→读取→撤销文档；不展示或收集他人的授权资料。
- 明确 legacy raw API、proxy、public-score-token 的迁移适配说明；不更改现有 Token 权限，不设未经观察的 sunset 日期。
- 将公共数据与私有用户数据分别计算限额，监测错误率、429、响应体大小和失效 Key；上线前另签真实代理配置及审计保留政策。

**I4：My Taiko 首批整合**

- 将个人主页、成绩、Growth、Goal/推荐的重复 profile/catalog/score 读取收敛到 Viewer 自身的授权 BFF/服务契约；不要求登录用户经过外部 Developer Grant 访问自己的数据。
- 首个演示仅需在合成绑定下完成：个人主页→成绩→成长事实→推荐入口的一致性读链与切换账号隔离；不在本工作包完成大规模 UI 重设计。

### 明确排除

- Annual 年度冷生成/海报容量专项与 EOL 实际下线。
- OAuth/PKCE 全量授权产品化、history/growth 第三方读取 scope、API 写分/同步/凭据能力。
- 全量 DB 替代 JSON、另建微服务、算法 V1/V2 强行合并、历史数据批量回填。
- 未授权生产 ingress、SQL、备份数据访问、部署、重启、推送和 main 合入。

## 5. Codex 主控执行指令（可直接复制）

> 请基于 Viewer 本地 `feat/viewer083-contract-api-20261016` 的精确 HEAD 和 `ac10427`，完整阅读 `docs/083-contract-freeze-candidate.md`、`docs/083-contract-and-api-matrix.json`、`docs/083-developer-api-openapi.yaml`，按本工作令先完成 0.83 Owner Freeze Review。不得把候选直接标为 FROZEN。复用已验证 74 HTTP/SDK、18 Golden、11 OpenAPI 操作及现有 QA 证据，不重复开展 0.82 迁移。先解决/裁决 `meta.status` 候选常量的正式生命周期表达、bounded complete response 的明确拒绝语义、源码 Contract 0.1.2 与 installed 0.1.0 的消费者矩阵、以及生产身份/代理风险清单。仅运行受影响的隔离回归，保留失败记录和持久 hash，形成一个 Owner 可签的冻结差异与决策文档。随后在**独立分支**准备跨客户端消费者清单、统一 read model 适配、开发者接入示例与 My Taiko 最小一致性读链，避免第二套算法/Writer/权限体系。直到 Owner 正式批准冻结，`contractFrozen=false`；Gate P 保持 `DEPLOY_PENDING_AUTH`。不得擅自 push、merge main、访问生产配置/SQL、deploy、restart、打开 v1 feature gate 或运行 Annual 负载。

## 6. 最终完成定义

- **0.83 冻结评审完成**：F1–F5 有可复核裁决，冻结字段/限制/语义明确，OpenAPI 与 runtime 状态无误导，Contract 源码包/已安装角色区别清晰；Owner 单独批准后才设 `FROZEN`。
- **开发继续**：I1–I4 能以正确权限在隔离环境跑通端到端读取，无生产数据、无隐形旧源码依赖，无未经批准扩 scope。
- **生产仍独立**：Gate P 的 ingress/ACL、迁移 DDL、异地备份/PITR/回滚及四张新增授权表恢复完成之前，不得称 `DEPLOY_READY`。
