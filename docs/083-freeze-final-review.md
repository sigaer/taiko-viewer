# Contract v1.0 本地冻结决议

状态：`CONTRACT_FROZEN_LOCAL`。F1–F5 已获 Owner 在聊天中的限定批准，审批关联号 `CHAT_OWNER_APPROVAL_20261016_F1_F5`，审批人 `Owner (chat approval)`。工作令引用原话“尽快吧，我这边没什么需要确认的，都差不多了”；未提供精确发言时间或手写/加密签名，不作补造。

批准输入：运行源码 `46991b202b531fc18709bbfbdb453b880bd9920b`，评审交付 `289094de74fa4872c7e43459ec57ce5c207ce36f`，manifest SHA `425e747960802284edb92af6ce2950d80e4c8a1e14c2fb7bc7cc51317fc3b6d5`。开始前两工作树干净，30 个运行文件 SHA、固定 wheel/lock 均通过；原始输入存档见 evidence-index。

F1 唯一 Schema v1.0、F2 stable client/Key 和逐 binding ResourceGrant、F3 完整有界响应及 owner keyset 分页、F4 保留旧认证域、F5 仅本地冻结，均为 OWNER_APPROVED。只改受控 lifecycle、OpenAPI 冻结描述/示例、相关定向测试/检查器、manifest 和本记录；不改业务权限、Schema、生成绑定、算法或 Writer。冻结无环境变量入口，不代表生产 ACTIVE。

运行默认关闭，publicApiEnabled=false，Gate P=DEPLOY_PENDING_AUTH，deployReady=false、productionAccess=false。所有 P-ID/P-APP/P-PROXY/P-KEY/P-AUDIT/P-RESTORE/P-MIGRATION 继续待独立生产授权/核验。配额仍非生产签收值。

受影响的 OpenAPI 11 operation/95 示例/6 分页 Golden 及生命周期组合运行成功；真实隔离 SQL+HTTP+SDK 验证 frozen meta、关闭仍404、owner 分页、授权读取、撤销后旧 ETag 403且无ETag。原18 Golden、34 F3、原74 HTTP/SDK 中未变 SDK 范围逐文件 hash 复用，不混算重跑覆盖。两次测试夹具失败完整保留，随后定向修复通过。Schema raw/serialized 与生成 TS/Python 身份未变。

rc.2 strict additionalProperties:false 消费者须采用 rc.3 owner 分页验证器；新响应 nextCursor 不能向旧严格验证器冒称完全兼容。workspace Contract 0.1.2 是新 DTO 消费源，installed 0.1.0 的 center/client 94 包仅继续使用已有运行协议，不消费新 DTO，因此本次未重建。

冻结输出 manifest SHA：`463a090855f571ed72da184a7d1d4c01691e9f5013cf1c106ce99ec190e34b36`。独立 freeze commit 的完整 SHA 及 manifest/源码/差异身份写入外置、不可覆盖的 `freeze-delivery-identity.json`，避免报告自引用。后续 I5 改动另行提交，不扩大冻结元数据差异。

原始证据：`/home/sigaer/taiko/qa-vault/evidence/083-owner-approved-freeze-i5-20261016/evidence-index.json`。历史 FAIL、0.82 O1/O2 接受风险、Annual 失败与图片证据缺口全部保留；未开展新 Annual 或0.82迁移测试。
