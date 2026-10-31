# 旧 Developer token 与自部署 Bot

旧 Developer token 由开发者申请审批产生。有效、未撤销且所属申请仍获批、账号邮箱已验证时，直接用于旧 `/api/developer/*` 与 `/api/taiko/proxy/*` Bot 接口：成绩、历史、QQ 绑定、多账号、上游更新和 Hiroba 同步/凭据配置。不需要另建逐 Source / principal 的服务授权记录。既有显式服务凭据和普通登录 Cookie 的授权逻辑保留。

Developer API v1 `/api/v1/taiko/*` 仍要求对应 Client 与用户 ResourceGrant。两个接口族不互相推导权限。旧接口仍执行每日额度、撤销复核、发布版本一致性及响应去敏，不返回上游密码、Cookie 等运行密钥。手动成绩账号写入口仍独立使用 Bot service token。

Node 与安装的 Python 私有更新/QQ 迁移 worker 都复核旧 token 的同一申请身份；授权丢失不回落到另一个 grant。无需数据库迁移或生产 grant 回填。

验证使用 runner 自建空 MySQL，实际 `SELECT DATABASE()` 为 `viewer1_security_test`，显式 mutation opt-in；未复制或改写生产数据。新增 HTTP 用例覆盖无服务 grant 的跨用户读取、历史、隐藏绑定、添加/切换、更新授权、额度、审批撤回、token 撤销，以及同一个 token 在 v1 无 ResourceGrant 时的拒绝。

当前 main 的既有广泛回归有三个可复现的历史失败：`sourceAccessSql` 的未知顶层字段保留预期、删除兼容投影后仍成功预期，以及 `developerApiV1Sql` 最后的旧授权表单浏览器选择器超时。未经本次改动的 `fa3468f2` 已用相同隔离流程复现相同三项失败；前两项与现行去敏/完整性规则不一致，第三项发生在 HTTP 授权断言之后。本次不改变这些规则或表单。
