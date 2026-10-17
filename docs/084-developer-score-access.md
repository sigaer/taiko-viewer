Developer Token 审批通过后，`GET /api/developer/userdata/{sourceId}` 可读取任意合法 Source 的当前成绩 JSON，目标不受开发者自身绑定限制，无需目标玩家逐人授权。请求使用 `Authorization: Bearer <token>`；Key 必须保密。响应保持 Profile、songs、achievement、dojo 及观测元数据形状，剔除凭据和私密字段，权限与凭据在返回前再次核验。限流、禁用和撤销继续生效。

此能力不包含写分、同步、绑定变更、上游凭据、history 或 Growth。平台审批仅自动配置成绩只读的 Source service grant。既有受限服务 policy 中新增 `scores_read_any` 时只豁免当前成绩的 Source 范围，不扩大其他 scope 或 principals；显式撤销和过期不复活。每次真实变更写入既有 service grant 审计表；重复补齐无新变更。运行总开关 `developerGlobalScoresRead=false` 可关闭这项审批派生权限。

v1 `/api/v1/taiko/players/{playerId}/profile|scores` 继续使用 opaque playerId 和用户 ResourceGrant。全局成绩只读 Key 不会自动获得这些 v1 resource 的权限。所有真实 approved active clients 均可注册和接受用户授权，不再使用试点 client 名单；`developerApiV1=false` 仍可关闭 v1。

My Taiko 的 `all` 模式接纳所有已登录账号，`legacy` 可关闭新读取；`allowlist` 仅作兼容模式。Session、本人绑定和 Publication 校验继续生效。尚无可验证 Publication 的账号显示读取错误并保留原成绩/工具入口，不会自动拼接旧代际或显示其他账号数据。
