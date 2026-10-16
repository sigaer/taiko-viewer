# 0.83 Owner Freeze Review — 待签

评审日期：2026-10-16。输入分支 `feat/viewer083-contract-api-20261016` 的精确 HEAD 与 `ac10427` 相同：`ac1042791f76b82c9f11d2b9b5b7a1ca326a0112`，开始时工作树干净。修订分支 `review/viewer083-owner-freeze-20261016`，候选 `0.83.0-rc.2`。本文件是工程评审结论和签收建议，不是 Owner 批准。**contractFrozen=false；Gate P=DEPLOY_PENDING_AUTH；deployReady=false。**

完整阅读三份 ac10427 候选文件及《Viewer_083_Freeze_Review_and_Next_Integration_Order_20261016》。原交付快照、74 HTTP/SDK、18 Golden、11 OpenAPI 操作/73 实例及构建证据保留，未重跑全套或重启 0.82 迁移。旧报告与失败记录仍可查。[冻结差异](083-contract-freeze-diff.md)、[机器矩阵](083-contract-and-api-matrix.json)、[精确输入清单](083-release-manifest.json)共同界定此次待签组合；最终提交 SHA 由本分支 Git 和持久 evidence delivery identity 解析。

## F1–F5 建议决议

| ID | 工程评审建议 | 待 Owner 决定 | 边界 |
| --- | --- | --- | --- |
| F1 | 接受唯一 Schema v1.0 的兼容增量 | 待签 | 原领域 required/语义不变；缺地区/模式/availability 为 unknown；不按同名合并歌曲 |
| F2 | 接受 stable client + 逐 binding ResourceGrant | 待签 | Key 仅是应用身份；两项 read scope、1–90 天、audience/撤销/到期/解绑强校验；无 history/growth/sync/凭据 |
| F3 | 接受有界完整响应及可配置日配额 | 待签 | 超限明确拒绝；Owner 列表有 hasMore；默认 300/5000 不是容量签收，生产代理和审计另签 |
| F4 | 保留 legacy 各自认证域，不安排 sunset | 待签 | 不把旧 Key/public-score-token/bot capability 自动升级为 Grant，不新增敏感旧入口 |
| F5 | 工程评审完成，建议签收本次精确组合 | 待签，未冻结 | 冻结范围只为 compatible additive DTO + v1 read/consent surface；不代表全客户端切换或生产启用 |

## F-A 生命周期表达：已修订

`meta.status` 从 OpenAPI 永久候选常量改为受控枚举 `FREEZE_CANDIDATE | CONTRACT_FROZEN`，并加入 `contractFrozen`、`runtimeEnabled`。两种契约状态分别只能与 false/true 配对，发布源码记录由 TypeScript 联合类型约束，不接受环境变量来冻结。当前源码记录仍是候选/false。运行关闭时仍 404；响应中的 runtimeEnabled=true 仅表示回应请求的受控宿主，与生产 ACTIVE 无关。此次未打开任何 v1 feature gate；定向夹具复用原先已有的隔离路由配置。

将来 Owner 明确批准后，另一个受审提交必须同步该记录、OpenAPI 顶层状态/样例、最小 Golden、manifest 与签名记录；不得仅改环境变量，不得声称生产已启用。未来不得在冻结后悄悄增加必需字段。

## F-B 有界失败：已修订

Catalog 源输入最多 10,000 行且最多 8 MiB；成绩最多 20,000 条；序列化 UTF-8 JSON 响应最多 8 MiB，任一条件超出均拒绝整个结果。503 错误码分别为 `CATALOG_LIMIT_EXCEEDED`、`SCORES_LIMIT_EXCEEDED`、`RESPONSE_LIMIT_EXCEEDED`。使用 503 是因为请求本身合法而服务端无法提供约定的完整表示；不使用暗示请求体过大的 413。非法数据/重复 ID 仍 UNAVAILABLE，无 committed Publication 仍 PUBLICATION_REQUIRED。错误只有 code/message/requestId，private,no-store，无部分 items/ETag/304，无自动重试或 Retry-After；应改变数据规模或等待后续独立分页版本。

Owner clients/bindings/grants 各查询最多 101 行、返回前 100 项并各标记 hasMore；自己的应用列表也有 hasMore。恰好 100 项不虚报遗漏。它们是有界列表，不是完整集合、总数或游标分页。页面在有遗漏时提示仅显示前 100 项及联系支持；不伪装所有记录均已展示。客户端若要管理未展示授权需支持介入，这是 MVP 已知操作限制，待 Owner 接受。

定向真实隔离 MySQL + HTTP/SDK 测试覆盖 10,000 完整/10,001 拒绝、Catalog >8 MiB、20,001 拒绝、20,000 未超计数但超响应字节拒绝、4,000 条大字段超字节拒绝、旧 ETag 不形成 304、SDK 无旧载荷回退、撤销先拒绝，以及三类列表 lookahead。未做容量、负载或吞吐结论。

## F-C 消费者与版本：明确区分

| 消费者 | 实际来源/版本 | 已验证范围 | 升级条件 |
| --- | --- | --- | --- |
| Viewer v1 Catalog/私有响应/SDK/同意页 | workspace 源码包 0.1.2，生成 TS；唯一 Schema 1.0 | ac10427 Golden + 本次受影响回归 | 精确 SHA 清单随候选组合签收 |
| 候选 Python Catalog/DTO Golden | 仓库显式源码路径的 0.1.2 bindings/catalog.py | 7 Python Golden；不等于 installed 消费者升级 | 仅测试候选源文件 |
| center Publication Worker / taiko-bot 0.14.2 | 独立 94 包 venv，installed Contract 0.1.0、Core 0.1.1、support 1.1.0 | 已接受的 installed Publication/ScoreReadPort 与来源证据 | 本轮不使用新平台 DTO，不为包号重建 |
| client 本地 Taiko/Core | 独立 94 包 venv，installed Contract 0.1.0、Core 0.1.2、support 1.1.0 | 固定锁与历史安装态证据；非 v1 新 DTO 运行结论 | 首次依赖新增字段前升级精确包/锁，验证生成绑定、兼容性与真实调用 |
| Sakura Bot 命令/其他外部客户端 | 本仓库无法证明已切换；保留各自 adapter/本地 Core | 本轮未运行外部进程 | 在独立消费者矩阵登记版本后，按各自认证域选择一次迁移 |

`schemaRevision` 是 JSON.stringify(schema) 的 SHA，源文件 SHA 是原始字节 SHA，两者不可混同；catalogRevision 是同次源字节 SHA；scoreRevision 是同一 live ReadView 的 Publication sequence/commitId；calculationProfile 原始 API 为 null。manifest 将 Schema 原始 SHA、序列化 SHA、生成 TS/Python、Catalog/Score 适配与 OpenAPI 映射纳入，未创造第二份 Schema。

## F-D 生产安全风险：登记，未读取生产

| 风险/Owner | 已知源码事实 | 上线前必须补证或明确接受 |
| --- | --- | --- |
| P-ID / Account 安全 Owner | 现有 binding-verification.ts 在有时限 challenge 内比较上游称号/铭牌变化，再原子保存 confirmation 哈希与 binding；手工认领另有既有生命周期。v1 只检查非空 verified_title 或存活 manual identity + owner/binding 快照 | 非空字段本身不是独立上游证明；不证明历史行都来自该流程、上游账号永久归属或 manual 认领强度。需静态策略签收后单独授权生产证据核查；Hiroba/遗留导入尤其不能据此宣称独立验证 |
| P-EXP / Account Owner | challenge 有过期；Grant 1–90 天 UTC；读前/读后查 binding live identity；解绑/替换/Grant 过期拒绝 | binding 自身无新增验证新鲜度 TTL；决定是否重验/存量资格筛选；不改旧绑定或关闭入口 |
| P-APP / Developer 产品 Owner | 页面展示应用 displayName+stable client ID、具体 binding、scope、到期时间；不含 Key | 名称由应用方填写，不是法律主体或第三方身份认证。上线前批准主体展示/核验政策，不能因 approved 字段就宣称身份可信 |
| P-KEY / 安全 Owner | v1 Key 仅后端传 Authorization；同意页用 Cookie，拒绝 Authorization；构建不内嵌 Key | 真实 ingress/APM/日志须脱敏 Authorization/Cookie；不将 Key 放浏览器、URL或前端调试日志 |
| P-PROXY / 运维 Owner | 匿名配额取直接 peer IP，忽略 forwarded；同 Origin 校验取宿主 request URL | 真实反代可能共享一个 peer、影响日限额与 Origin；需独立批准可信代理链、Host/协议规范化、直连 ACL、绕过拒绝及匿名/公共与私有配额分离策略；当前未实施或验证生产配置 |
| P-OPS / 运维+数据 Owner | 默认匿名 300/client 5000 日请求配额，不是并发 admission；审计四表元数据，无 Key | 配额、公私预算、错误率/429/响应字节/失效 Key 指标、审计保留/访问/时区政策待签；不宣称资源或容量验收 |
| P-RESTORE / 数据 Owner | 新增 clients/resources/grants/events 四表，依赖既有应用/凭据/撤销/绑定与 Publication | 备份/PITR/异地恢复必须一致覆盖全部授权表和凭据撤销状态，校验恢复不复活失效授权；正式 DDL/回滚/禁用步骤另经 Gate P，禁止只恢复成绩或只恢复 Grant |

P-ID/P-EXP/P-PROXY 等仍是启用前待签风险，不被本次 Contract 工程评审冒充安全签收。未访问任何生产配置、SQL、业务数据或备份。Gate P 保持 DEPLOY_PENDING_AUTH。

## 验证与未测

本次只补受影响的真实隔离 MySQL/HTTP/SDK 边界、OpenAPI 引用/示例与一轮正式 Nuxt 构建。持久路径、SHA、输入/提交、运行退出信息见矩阵 review 与 evidence index。旧 74/18/11 证据逐个核 hash 复用，只对未修改输入和原范围有效，不冒充本次全链 PASS。源码 Schema/生成绑定/算法/Publication Writer 未改；没有重跑 0.82 生命周期或 Annual。

未测：生产身份真实性/代理/ACL/日志、完整构建服务启动/所有主题、所有 Bot/App installed 新 DTO、生产 DDL/备份恢复/PITR；没有扩大为全域审计。已有历史 FAIL 原路径和 hash 保留。

## Owner 签收栏（空白即未批准）

- 审批对象：本分支 review delivery identity 中的精确提交与 `083-release-manifest.json` SHA；范围见冻结差异。
- F1：□批准 □拒绝；F2：□批准 □拒绝；F3（含列表遗漏）：□批准 □拒绝；F4：□批准 □拒绝。
- F5 正式冻结：□批准 □拒绝；Owner：________；时间（含时区）：________；精确提交/manifest SHA：________；附加条件：________。
- Gate P：DEPLOY_PENDING_AUTH。该签字不授权 push、main 合入、生产读/迁移/部署/重启或 feature gate 启用。
- 下一工作包：独立分支先交付消费者清单、read model 适配设计/可运行隔离演示与接入示例；依赖新冻结字段的生产接线须待明确批准后的精确组合，不代签。
