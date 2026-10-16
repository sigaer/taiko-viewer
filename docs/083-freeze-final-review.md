# 0.83 最终冻结评审 — Owner 待签

日期：2026-10-16（Asia/Shanghai）。本轮依据《Viewer_083_Owner_Freeze_Closeout_and_Consumer_Integration_20261016.md》执行；该工作令明确“本文件是新的工程工作令，不构成 Owner 批准或生产授权”。**状态 OWNER_SIGNATURE_PENDING，contractFrozen=false，默认 runtimeEnabled=false，Gate P=DEPLOY_PENDING_AUTH，deployReady=false。** 不记录或推断真实生产开关状态。

基线已核对：review `d0c6fea8f172c6bc39086f13eac6fe2113205046`；独立消费者准备 `49899d48a0ccff677d8506f59cea502b521758c4`；原候选 `ac1042791f76b82c9f11d2b9b5b7a1ca326a0112`。开始时两个工作树干净。先在受限 QA 中逐文件核对 release manifest 的 SHA，11 操作/93 原实例及既有证据指针通过，再修改 F3。0.82 Gate C 的风险接受、所有历史 FAIL、原 74 HTTP/SDK、18 Golden 均保留，没有重跑原大矩阵。

## F3 可管理性裁决

原 rc.2 的 hasMore 只能说明遗漏，不能保证早期仍有效的授权可由用户找到。选择工作令 §1.2 的最小 owner-only 分页方案，不设同时有效授权/客户端数量上限，不以人工支持代替撤销可达性。

- `GET /api/account/developer/grants?before=...`：按 issued_at DESC、grant_id DESC 游标分页；任何 retained grant（有效/过期/撤销）均可逐页发现，本人可在实际页面撤销。
- `GET /api/account/developer/clients?before=...`：按 created_at DESC、client_id DESC 分页，所有自有客户端均可逐页定位并停用；禁用行不因过滤而消失。
- 每次只读 101、返回最多 100；hasMore/nextCursor 明确下一页。页面替换当前页，不无限累积 DOM；有“下一页”和“返回首页”，加载时禁止重复提交并保留可访问焦点反馈。
- 游标必须属于当前 session owner。无效、他人或重授权后已被替换的游标统一 400 INVALID_CURSOR；提示重新加载首屏。不是跨多请求的快照；用户的新同意/注册/撤销/停用会刷新首页，不隐含对无限并发变动的稳定快照承诺。
- 客户端选择器/绑定选择器原 100+lookahead 与独立 hasMore 维持真实边界；它们不再限制已有授权/自有客户端的管理列表。四张授权表增加两项 owner+排序列分页索引；没有领域表、Writer、Token scope 或生产 DDL 变更。

定向真实隔离 SQL/HTTP：100 撤销 + 100 过期 + 105 有效合成行，另含一条早期有效授权，共 306 条 grant / 306 个客户端，分别四页完整遍历、时间相同也无重漏；375px 实际组件找到并撤销早期授权，1280px 找到并停用早期客户端。跨 owner 撤销/停用 403，外部 Key 不能当 owner 分页，旧 ETag 在撤销/停用后不返回 304。五个并发同意后仍严格每页 100；真实重叠的重授权/页面停用由既有 owner 锁串行，最终 Key 失效。注册不复活 disabled client；重授权改变 grantId，失效游标明确拒绝。

**数量上限测试裁决：** 本方案选分页，因此“同时有效数量上限”不适用；测试实际超过 100 个未撤销/未过期行仍可发现，并验证并发请求下的每页边界，不伪称测试了一个并不存在的 active-count quota。

## F1–F5 状态与签署对象

| 决策 | 工程建议 | Owner 状态 |
| --- | --- | --- |
| F1 唯一 Schema 兼容增量 | 建议接受；本补丁未改 Schema/生成绑定/Score 语义 | 待明确批准 |
| F2 stable client / ResourceGrant | 建议接受既有逐绑定授权图、两项 read scope、1–90 天和撤销语义 | 待明确批准 |
| F3 有界响应/列表/配额 | 管理可达性定向 PASS，建议接受本次分页与兼容边界；生产配额不在此签 | 待明确批准 |
| F4 legacy 兼容 | 保留原认证域，不转换旧 Token/Grant，不猜测 sunset | 待明确批准 |
| F5 正式冻结 | 尚未执行冻结记录提交 | OWNER_SIGNATURE_PENDING |

签署对象：rc.3 运行源码提交 **`46991b202b531fc18709bbfbdb453b880bd9920b`**，包含 d0c6fea 评审结果与本轮 F3 补丁；`docs/083-release-manifest.json` SHA-256 **`425e747960802284edb92af6ce2950d80e4c8a1e14c2fb7bc7cc51317fc3b6d5`**。最终报告/矩阵提交与全部文件 SHA 另见持久目录 delivery-identity.json，报告提交不得改变运行源码。manifest 包含受影响 runtime、原始 Schema、生成 TS/Python、直接 Score/Catalog adapter、OpenAPI、SDK、DDL 源与定向测试身份。

Owner：________；审批标识：________；时间（含时区）：________；F1 □批准 □拒绝；F2 □批准 □拒绝；F3 □批准 □拒绝；F4 □批准 □拒绝；F5 □批准 □拒绝；附加风险接受/条件：________。没有签署不视为批准。正式签收后才能另做最小 lifecycle/OpenAPI/Golden/manifest 冻结记录提交；feature gate 仍须 OFF，Gate P 仍须独立验收。

## 兼容与安全边界

外部公共 Catalog/私有 Profile/Scores 仍为 bounded complete response，无新增分页、history/growth/sync/写分/凭据 scope。Owner 管理端点新增可选 before 参数及可选 nullable nextCursor；旧字段和旧默认首屏仍在。更新后 schema 接受不带 nextCursor 的旧形状；**严格使用 rc.2 additionalProperties:false 的客户端验证器须采用 rc.3 候选 Schema**，不声称旧严格验证器无需升级。OpenAPI 仍 11 操作，新增契约决定待 F3/F5 签收。

唯一 Schema 1.0、workspace package 0.1.2 不变；center/client installed Contract 0.1.0 与各 94 包环境不变。它们未使用新增平台 DTO，不为对齐版本号重建。下次消费者首次调用新增字段前必须锁定升级构件并验证。Schema 源字节 SHA 与 JSON 序列化 SHA 分开；catalogRevision 为真实源字节，scoreRevision 为同一 committed sequence+commitId，raw calculationProfile=null；没有新算法、回放或 Publication Writer。

P-ID：非空 verified_title 不是永久上游证明，历史归属/验证新鲜度与 manual 认领依据待签。P-APP：displayName 不是法律主体认证。P-PROXY：可信反代/Host/Origin、直连 ACL、匿名共享 peer 配额待签。P-KEY：真实日志/网关/APM 的 Authorization/Cookie 脱敏待签。P-AUDIT：额度与审计保留/访问/时区待签。P-RESTORE：四新增授权表必须与应用/Key 撤销、绑定及 Publication 一致备份/PITR恢复，不能复活失效授权。P-MIGRATION：分页索引需在未来单独授权 DDL 核查中确认；本次 CLI 只应用到全新 _test 实例。均未读取生产补证。

## 证据与实际未执行

[机器矩阵](083-freeze-final-matrix.json)区分本次 PASS/FAIL/NOT_RUN 与历史 scoped 引用。F3 34 项 HTTP 观察、实际组件 375/1280、OpenAPI 95 实例/6 分页 Golden 已通过；rc.3 构建结果由最终矩阵记录。首轮 qa-de85a6689179 因移动端横向溢出 FAIL，收紧控件/grid 最小宽度后 qa-1cf7e19aac2f 通过，原轮证据不覆盖、不改称 PASS。

未执行 F5 冻结记录、正式 I5 产品 UI/BFF 接线、完整 Nuxt 产品页面浏览器验收、生产配置/SQL/备份/代理观察、push/main 合入/部署/重启/feature gate 启用、Annual 负载或下线。I5 可继续独立分支的设计/原型及合成测试；正式接线和完整产品宿主验收须待 F1–F5 明确批准。最短下一步是 Owner 对本精确组合签 F1–F5，生产 Gate P 仍不随之 PASS。

正式构建实测：149.759 秒、采样峰值 4,229,136,384 字节，kernel memory.peak 不可用，high/max/oom/oom-kill 均 0；未启动构建服务。Schema/生成绑定/18 Golden 的包内输入 SHA 与原成功轮逐项不变；固定 wheel/lock SHA 复核通过，未重跑生命周期或重建 venv。持久原始索引：`/home/sigaer/taiko/qa-vault/evidence/083-freeze-closeout-i5-20261016/review-evidence-index.json`。
