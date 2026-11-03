# Viewer 0.83 — Owner Freeze 收口与 My Taiko 消费者集成工作令

**日期：** 2026-10-16  
**来源：** 用户提交的 `083-owner-freeze-review.md`、`083-contract-freeze-diff.md`、`083-contract-and-api-matrix.json`、`083-release-manifest.json`、`100-consumer-read-model-preparation.md`，以及对应的本地交付汇报。  
**当前实际状态：** `0.83.0-rc.2` / `FREEZE_CANDIDATE_REVIEWED_PENDING_OWNER_SIGNATURE`；`contractFrozen=false`；`Gate P=DEPLOY_PENDING_AUTH`。本文件是新的工程工作令，不构成 Owner 批准或生产授权。

## 0. 强制基线与禁止事项

- 评审分支 `review/viewer083-owner-freeze-20261016`，报告提交 `d0c6fea8f172c6bc39086f13eac6fe2113205046`。候选由 `ac1042791f76b82c9f11d2b9b5b7a1ca326a0112` 修订而来；真正源码构建组合必须按 `083-release-manifest.json` 的精确 SHA 逐文件验证，不可只凭短提交号判定。
- 独立消费者准备分支 `prep/viewer1-consumer-readmodel-20261016`，提交 `49899d48a0ccff677d8506f59cea502b521758c4`，基于上述 review 分支。不得把测试原型当正式产品路由。
- Taiko 固定为 0.14.2、源码 `a632913dfbdbec1d465f8eaccc0bb80c35e25745`、当前重建 wheel SHA-256 `398d23000ebde8a9696b8586fc7fff6cf566e49eb6efe970ceba2e5ecf488c0a`；center/client 已安装环境各 94 包，Contract installed 0.1.0，候选 workspace Contract 0.1.2、`contractVersion=1.0`。不得伪称 installed consumer 已使用新平台 DTO。
- 不重跑无变更的 0.82 大矩阵、Annual 高负载、46×2 生命周期、旧 PNG 黄金对照。保留全部源证据、过去失败及接受风险记录，不将 scoped PASS 夸大为生产 PASS。
- 本指令**不授权**推送、合入 main、发布、重启、真实生产配置/数据观察、生产 SQL DDL、启用 API feature gate、公共域名对外开放或 Annual EOL 操作。所有新增测试仅在独立 `_test` MySQL、私有 loopback、`qa-vault` 的受限 QA 包装器中执行，原始证据 SHA 归档，scratch 在确认子进程退出后仅清理本轮所有物。

## 1. 先做一个有限的 F3 冻结前确认（优先）

已修订的 `hasMore` 是正确的“不伪称完整列表”措施，但需验证 **用户能够实际撤销任何当前有效授权**。目前文档称 grants 按最近记录最多显示 100 条，超过时提示联系支持；如果超过 100 条历史撤销/过期记录挤掉较旧的**仍有效** grant，用户可能无法在 UI 找到其 `grantId` 来执行撤销。这个可管理性风险须在正式冻结前明确裁决，避免把 `hasMore=true` 误当已经解决撤销可达性。

**最小实现优选**（按实际 SQL/页面审计后选择最小补丁）：

1. 自有 grant 列表优先列出所有有效 grant，再用余量显示最近过期/撤销记录；控制同时有效的 grant 数量，使其不会大于可管理列表容量。数量限制必须并发安全，不得只 `SELECT COUNT` 后不加锁插入；重授权/过期/撤销/客户端禁用、跨 owner 不得绕过。
2. 若业务不适合主动授权数量上限，则添加 owner-only 的最小分页/定位能力，保证任何有效 grant 都可由本人发现并撤销；若扩展公开的契约字段，必须重新作向后兼容审核及定向 Golden。不要为这一点引入大规模 OAuth 或重做整个管理页。
3. 已有 `hasMore`、Owner 客户端/绑定列表的真实性边界维持不变。客户端数量超过 100 时也应允许所有有效客户端被自己的所有者定位与禁用，或在候选内限制有效客户端数量。
4. 在全新隔离 MySQL + 实际 HTTP 下定向验证至少：101+ 各类 grant（大量已撤销 + 少量早期仍生效）、有效 grant 可见且可撤销、跨 owner 拒绝、撤销后旧 ETag 不返回 304、客户端禁用/重授权竞态、并发数量上限、列表 `hasMore` 含义正确。测试仅针对受影响代码，不重复原 74+20 项全部用例。

如果现有实现已满足该不变量，**不修改产品代码**，仅用源码路径和定向证据记录。若不满足且修复会超过本次范围，必须请 Owner 显式批准“超过 100 个 grant 需人工支持才能撤销”的产品风险；不可自行宣称 F3 无条件通过。

## 2. F1–F5 Owner 正式冻结顺序

**F1（Schema）建议批准：** 唯一 `sakura-taiko-contract/schema/contract-v1.json`；原领域 required/语义不变；Song/Chart 可选 availability、tjaCourse；unknown、地区/单双打/难度、Source、时钟、Score 白名单和 legacy 排除规则维持。`schemaRevision` 的 JSON 序列化 SHA 与源字节 SHA 明确区分。新必需字段必须走新兼容协议，不得悄然加到已冻结定义。

**F2（授权）建议批准：** stable client 与旋转 Key 分离；ResourceGrant 按 owner+binding+client+audience+scope+1–90 天有效期同意/撤销；只有 `profile:read` 和 `scores:read` 开放；Web 自读仍用 session，Bot/内部服务仍用各自 principal。不允许历史/成长/同步/写入/凭据权限借机开放。

**F3（规模/列表/配额）有条件批准：** 接受 10,000 catalog/8 MiB 输入、20,000 Score/8 MiB 响应的**完整或显式 503**，不做静默截断；100+lookahead 的 `hasMore` 有正确语义。正式冻结前完成本文件 §1 的有效授权/客户端可管理性确认或取得 Owner 单独的书面风险接受。默认匿名 300 / client 5000 是隔离候选默认值，不是生产配额承诺；真实可信代理、日志/审计保留另走 Gate P。

**F4（兼容）建议批准：** 老 session/raw/proxy/public-score-token/内部 service 仍各在原认证域，不自动转换 Grant、不制定猜测的 sunset；只在未来逐个客户端迁移、量化依赖并签收之后另行退役。

**F5（冻结）仅在 Owner 明确批准 F1–F4 且组合身份核对后执行。** 签收对象包含 `d0c6fea8…` review 结果及任何 §1 新补丁的完整提交、`083-release-manifest.json` 的 SHA 与所有受影响原始/派生 Schema、OpenAPI、SDK、生成绑定/测试文件身份。所有 F1–F5 决策、时区时间、Owner 审批标识与风险接受须有审计记录；不得由 Codex 在没有 Owner 表态时自行把 `contractFrozen` 设为 `true`。

签收获批后另做**一个最小受审冻结记录提交**：

- 将候选 lifecycle record 的 `FREEZE_CANDIDATE/false` 改为 `CONTRACT_FROZEN/true`，同步 `meta`、OpenAPI、Schema 不变性检查、Golden/示例、release manifest 和冻结签收报告；不能只用环境变量造成“已冻结”假象。
- feature gate 保持 `OFF`；Gate P 仍 `DEPLOY_PENDING_AUTH`；不改变默认生产流量或上线能力。
- 只运行受影响 Contract/HTTP/OpenAPI 断言和必要正式构建检查；允许复用原无改动输入的 11 JS、7 Python、74 HTTP 历史限定证据，但须以 hash 核实其适用范围。
- 成果状态严格区分 `CONTRACT_FROZEN_LOCAL`、`DEPLOY_PENDING_AUTH`、`PUBLIC_API_NOT_ENABLED`。用户未批准 F5 时仍为 `OWNER_SIGNATURE_PENDING`。

## 3. My Taiko I5：把隔离读原型变成最小产品读层

**前提：** F1–F5 取得正式冻结后实施真实 UI/BFF 接线；批准前可在隔离分支保留原型、接口设计与合成端到端验证，不影响线上。

只选 **一个** Viewer 已登录用户自读入口作为第一批产品消费者（优选 My Taiko 概览 Profile + 当前成绩摘要 + 90 天事实简述，实际路由与 owner/BFF 依源文件核查确定），不要一次性重做 Home/Growth/Goal/Recommend/Forum。复用准备分支 `49899d48…` 的 `myTaikoReadModel.ts` 试验逻辑，正式适配器应：

- 使用 `requireAccountUser` 和 existing current binding/session authority；**不得**让 Web 自读绕路走第三方 Developer Key + Grant。
- 使用单个已提交 `Publication ReadView` 与同一请求里的 `ScoreReadPort`，current/history 的来源/sequence/commit 一致；请求内 memo/ALS 不应跨账户、跨绑定、跨请求泄漏。出现解绑、切换、失效、读取中权限变化应 fail-closed，完整响应拒绝。
- 继续调用已有 Growth evidence/fact 投影与冻结 measurement/Goal，而不是创建第二套回放/算法/Writer；`C/H` 观察、事实、测量和真实游玩严格区分。
- `catalogRevision` 与 Developer API v1 **统一真实源字节计算路径**，不得把旧 `legacy-projection-sha256` 冒充 v1 catalog 原始字节 SHA；保留明确的旧 revision 诊断与回滚桥接，必须能说明两者差异而不是字符串相等。
- 诊断信封包含 `schemaRevision/catalogRevision/scoreRevision/calculationProfile/source`，原始 self-read 不应强行返回第三方 private API 的授权主体。
- 非算法推荐只能作为已有工具入口，不能伪装成已执行的实时推荐计算。
- 初期保留旧功能路径的有界 fallback：仅用于在**授权已通过、读模型自身非安全故障且旧路径有同等权限验证**的兼容场景；不得因权限拒绝、资源归属改变、Publication 缺失、来源不一致而自动回落到旧文件直读。明确开关和回滚评估，默认不触碰生产。

**验收：** 实际 HTTP/测试数据库/安装态读链中 A1/A2/B 两用户绑定切换、并发 Writer、读中解绑、scoreRevision 一致、同请求只装载一次、无额外不可重建测量写入；至少一个真实 Vue 产品页面在隔离完整 Nuxt 宿主下读到该 BFF（如完整启动需要被退场 Annual 插件牵连，需先证明独立禁用不改变其他启动语义）。记录 UI 设备宽度 375 与 desktop 代表视口，无登录、未绑定、证据不足、历史截断及加载错误状态。不以模拟接口截图替代真实路由。

## 4. Producer / Consumer 接线仍属独立 Gate

- Sakura、taiko-bot center/client 与第三方 Developer API 三类消费主体继续分离身份、权限与部署责任。
- 固定的 installed Contract 0.1.0、候选 source Contract 0.1.2 只要消费者没有调用新 DTO，不强迫升级两个 94 包 venv；首次调用新字段时重新锁定精确构件并执行兼容测试。
- 正式生产对外启用之前，P-ID（绑定真实归属与历史验证证据）、P-APP（应用显示名可信度）、P-PROXY（可信反代/Origin/共享匿名配额）、P-KEY（日志/密钥脱敏）、P-RESTORE（四张新增授权表+凭据撤销+Publication一致恢复）必须有记录和 Owner 签收。`verified_title != null` 不能被当成永久上游身份验证证明。
- 没有授权不得执行 production-observe、迁移生产 SQL、激活 v1 环境开关。新开发者申请可继续旧流程，但不得将配额 Key 自动视为拥有任意用户私有数据 Grant。

## 5. 本轮成果与最短判定

交付且仅交付：

1. `083-freeze-final-review.md`：F1–F5 每项 Owner 状态、§1 可管理性裁决、精确签署对象（提交+ manifest SHA）、兼容版本边界与 P-ID/P-PROXY 等 Gate P 风险。
2. `083-freeze-final-matrix.json`：精确构件身份、`contractFrozen`、`runtimeEnabled`、`deployReady`、所有执行中的 scoped PASS/FAIL/NOT_RUN 与原始证据路径、SHA；旧证据引用不挪用。
3. 可用的最小冻结记录提交（**仅在 Owner F5 明确批准后**）；否则保留候选源码及 pending 状态。
4. `viewer1-readmodel-i5-report.md` 和一个隔离产品 BFF/页面集成候选，含定向 SQL/HTTP/浏览器证据、Catalog 原始修订差异说明、回滚开关；正式产品接线需先冻结，未获批时只输出隔离设计及原型测试。

**完成定义：** `FROZEN_LOCAL` 不等于 `DEPLOY_READY`；开发消费层可前进，但 API 仍默认关闭。不要为 Annual、历史像素或已经满足的 Python ownership 测试再次扩大工程。
