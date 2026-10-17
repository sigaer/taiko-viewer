# 0.83 冻结差异 — 待 Owner 签收

比较起点：`ac1042791f76b82c9f11d2b9b5b7a1ca326a0112`（rc.1）；当前修订 rc.2，仍未冻结。唯一正本 `packages/sakura-taiko-contract/schema/contract-v1.json`，Schema 1.0 / 源码包 0.1.2。本次没有再次改 Schema 或生成绑定；发布输入的精确字节 SHA 和映射见 [manifest](083-release-manifest.json)。

## 待冻结字段范围

既有 User/Binding/ExternalIdentity/DeveloperIdentity/Score/GrowthObservation/CanonicalFact/GrowthProjection/CalculationProfile required 与语义未改。Song 增可选 availability；Chart 增可选 availability/tjaCourse。其余 v1 平台增量在同一 Schema，字段如下（星号为 required）：

| 定义 | 字段 |
| --- | --- |
| CatalogAvailability | region*, status* |
| ResourceGrant | grantId*, ownerUserId*, bindingId*, playerId*, clientId*, audience*, scopes*, consentVersion*, consentedAt*, issuedAt*, expiresAt*, revokedAt*, revision* |
| DeveloperClient | clientId*, displayName*, status* |
| DeveloperPlayerProfile | playerId*, bindingId*, displayName*, source* |
| ApiReadVersions | contractVersion*, schemaRevision*, catalogRevision*, scoreRevision*, calculationProfile*, observationSource*, capturedAt* |
| DeveloperScoresResponse | versions*, playerId*, items* |
| DeveloperProfileResponse | versions*, profile* |
| CatalogSongsResponse | versions*, items* |
| CatalogChartsResponse | versions*, items* |
| ApiError | code*, message*, requestId* |

Score 的 legacy 仅兼容 adapter 使用；私有 v1 白名单排除此字段，OpenAPI allOf 拒绝注入 legacy。缺失/null 不改成零，来源/地区/单双打 unknown 不推断，难度 1–5 / TJA course 0–4 / 星级分开。C/H 观察与 Canonical Fact、冻结 measurement、真实游玩事件区分；同步和 reappearance 不等于游玩；原算法/历史测量不改。

## 11 个操作与认证域

| 操作 | 域/权限 |
| --- | --- |
| GET /api/v1/taiko/meta | 公共；可选 Key 有效性校验 |
| GET /api/v1/taiko/catalog/songs | 公共；同上 |
| GET /api/v1/taiko/catalog/charts | 公共；同上 |
| GET /api/v1/taiko/players/{playerId}/profile | stable client Key + 该 binding live profile:read Grant |
| GET /api/v1/taiko/players/{playerId}/scores | stable client Key + 该 binding live scores:read Grant |
| GET /api/account/developer/grants | 已验证 Viewer Cookie session |
| POST /api/account/developer/grants | 同上 + 同 Origin + 显式逐 binding 同意 |
| DELETE /api/account/developer/grants/{grantId} | 同上 + owner 撤销 |
| GET /api/account/developer/clients | 已验证 Viewer Cookie session |
| POST /api/account/developer/clients | 同上 + 自己的 approved application |
| DELETE /api/account/developer/clients/{clientId} | 同上 + 自己的 client |

认证失败、撤销/到期/owner/client/scope/audience 失败优先于私有读取和 304，Worker 结束后一次原子授权图查询是最终决策点；private,no-store，SDK 无载荷缓存。Web 自读不强迫经过外部 Grant；Bot service、旧 raw/proxy/public-score-token 仍属各自认证域。

## ac10427 → 本次局部差异

- meta.status 改受控枚举 FREEZE_CANDIDATE/CONTRACT_FROZEN，新增 contractFrozen 与 runtimeEnabled，分别表示契约审批和此宿主运行状态。源码仍候选/false、feature 默认关闭；正式签收另改受审 release record/OpenAPI/最小样例。
- 超 10,000 Catalog 行或源 8 MiB：503 CATALOG_LIMIT_EXCEEDED；超 20,000 score：503 SCORES_LIMIT_EXCEEDED；完整 JSON >8 MiB：503 RESPONSE_LIMIT_EXCEEDED。不返回部分结果或错误 200/304；阈值均允许等于上限，多个限制按最先拒绝者报告。
- 原始数据错误/重复 ID 503 UNAVAILABLE；无 committed Publication 503 PUBLICATION_REQUIRED；未知参数 400；缺/坏 Key 或 session 401；无权限 403；禁用 404；日配额 429。错误格式仍 ApiError，无文件/SQL/凭据细节；不承诺失败自动可重试。
- Owner 列表加 hasMore（grants 页每类独立 boolean；own clients 单一 boolean），查询 101 返回 100；页面显示遗漏提示。无 total/cursor，不宣称全部数据。
- Viewer 候选版本 rc.2；唯一 Schema 和源码包 0.1.2、installed 0.1.0 都保持。OpenAPI 仍 11 操作，变动前原始文档与证据留存。

版本：contractVersion=1.0；schemaRevision=Schema JSON 序列化 SHA；原文件 SHA 另列；catalogRevision=源字节 SHA；scoreRevision=同一 committed ReadView sequence+commitId；capturedAt 只认上游明确 RFC3339，否则 null；raw calculationProfile=null。不同端 v1/v2 CalculationProfile 合法差异须带版本标签，不能改公式抹平。

## 禁止扩权及后续版本规则

不开放 history/growth 第三方 scope、同步、写分、上游凭据或 OAuth/PKCE。不得将 Key、QQ 或 taikoId 当资源 owner；不得自动把 legacy Token 升级 Grant。无第二个 Writer/算法/领域模型；不重算历史报告、冻结测量或删 FAIL；不安排未经观察的 sunset；不接线生产 feature flag。新业务能力或分页必须另提兼容版本，已冻结后不得默增必需字段。

生产绑定真实性/新鲜度、应用主体、可信代理/ACL、配额/日志/审计留存和四授权表恢复仍按 [Owner 评审](083-owner-freeze-review.md) 待签。contractFrozen=false，Gate P=DEPLOY_PENDING_AUTH；工程评审完成不等于正式冻结或部署批准。
