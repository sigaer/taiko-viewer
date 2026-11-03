# Viewer 1.3.0 — OurTaiko → Viewer 反向服务接口（候选）

基于已正式运行的 1.2.4，不影响现有 Viewer → OurTaiko 的 OIDC、lookup、link。对应 [SAKURA-PROTOCOL.md 0.1 第 4 节](https://github.com/OurTaiko/OurTaikoLogs/blob/main/OurTaikoSSO/docs/SAKURA-PROTOCOL.md)。**本分支只准备反向接口代码，尚未在服务器运行、迁移、实测、合并或部署。**

## 新增路径与边界

以下路径均为 Viewer 的服务器端 POST，**没有** `/api` 前缀：

| 路径 | 返回内容 | 授权条件 |
|---|---|---|
| `/internal/v1/external/login` | 仅精确十进制 Viewer ID；**绝不签发 Viewer Session/Cookie/Token** | 持有新服务凭据 + 通过账号密码验证 |
| `/internal/v1/external/lookup` | ID、用户名作为 nickname、邮箱验证信息及 linkedId | 同一个服务在最近 10 分钟内认证过此账号，或已经建立 exact pair |
| `/internal/v1/external/link` | 精确账号对及 linkedAt | 相同账号对幂等；新绑定需此前 10 分钟有效的认证 |
| `/internal/v1/external/unlink` | 精确账号对 | 仅当该对真实存在才删除；已不存在 404，另一对 409 |
| `/internal/v1/external/links` | 限 1000 条的只读分页 | 专用服务密钥；仅返回已确认绑定 |

所有请求固定 HTTPS（Nginx 保证），拒绝任意 Origin，服务身份以 `X-Service-ID`/`X-Service-Key` 传输，要求 JSON 与不超过 32 KiB 的明确 Content-Length，响应统一 `{code,message,data}` 且 no-store。账号对严格使用 Viewer 数据库十进制 ID 和 OurTaiko 32 位 sub，不使用用户邮箱匹配或自动合并。

**数据源只有现有 `web_external_identities`。** 反向建立的关系不能创建另一套平行映射；解绑只删除精确关联，不删除 Viewer 用户、Session、QQ、成绩或历史。旧 `web_oidc_remote_link_attempts` 审计保持；存在租约内的正在执行的远端 link 时，unlink 返回暂不可用，不破坏并发保护。

## 凭据和开关

必须由 Viewer **另外签发**新服务凭据供 OurTaiko 后端调用；不能倒用 OurTaiko 已签发给 Viewer 的 `Sakura` OIDC Client Secret/Service Key。

服务器私有环境使用如下名字，不在 Git 中写实际值：

- `TAIKO_OURTAIKO_INBOUND_ENABLED=0`（默认不启用）
- `TAIKO_OURTAIKO_INBOUND_SERVICE_ID`：Viewer 授权给 OurTaiko 的服务 ID
- `TAIKO_OURTAIKO_INBOUND_SERVICE_KEY`：Viewer 授权给 OurTaiko 的随机高强度服务密钥（至少 24 字符）

尚未迁移时即使新构建发布，也必须保持开关关闭。所有入站请求都必须验证专用凭据；不能使用浏览器 Session、普通 Developer Token 或从请求获取的用户 ID 做授权替代。

## 独立显式迁移

新增 `web_inbound_external_proofs`（10 分钟短期身份授权）和 `web_inbound_external_audit`（仅服务、动作、账号 ID、结果，不记录密码、邮箱、Token 或密钥）。两表不加入原 `OIDC_TABLES`，所以即便新 Schema 尚未部署，也不会破坏已有正向 OIDC 的运行时 Schema 校验。

迁移：`taiko_viewer/scripts/migrate_inbound_external_schema.ts`。

生产模式要求 `--production`、`TAIKO_INBOUND_EXPECTED_DATABASE` 与实际 `SELECT DATABASE()` 精确一致；写入另外必须 `--apply` 和 `TAIKO_ALLOW_INBOUND_PRODUCTION_MIGRATION=1`，且数据库不得以 `_test` 结尾。迁移前需要生产备份，并使用已有资源受限运行器。不会自动建表。

## 与 OurTaiko 侧联动

1. OurTaiko 需要实现 `accounts/sakura.py` 或等价的**仅服务端**客户端。它应使用 Viewer 颁发的独立凭据、固定生产 origin 和固定路径，8 秒内超时、不跟随重定向、32 KiB 限制，同对幂等重试；外源登录**绝不自动重试**。
2. OurTaiko 页面 `/login/sakura/` 在第 5.2 节中接受 Viewer 账号密码。**这意味着用户会把 Viewer 密码交给 OurTaiko 服务器**。上线前必须明确告知用户此信任边界、禁止保存或记录密码，并评估是否改为 Viewer 作为 OIDC Provider 的授权码流程。
3. Viewer 对通过密码成功认证的具体用户仅提供短期授权；OurTaiko 要拒绝邮箱冲突，不能自动合并两个已有账号，也不能把外源登录当成本地 Viewer 登录。
4. OurTaiko 管理员解绑应先向 Viewer 发 `unlink`、收到 200 或精确 404 才删除 OurTaiko 一侧绑定。原 OurTaiko staging 关系保留，正式 Application 下的账号对需精确确认。

## 合并/发布前的最小必要核验

只需要针对真实 H3 + 隔离 MySQL 的定向验证，不额外跑全套 Viewer CI：服务密钥拒绝；Origin 与异常正文拒绝；密码错误不签 Session；lookup 不越权；同对重试、异对 409、并发唯一性；unlink 精确删除/第二次 404/其他对 409；已有 OIDC 正向路径不退化。**尚未执行这些定向检查，不能把本 PR 当作生产可用证据。**

反向身份互通属于新能力，发布与生产迁移另行执行，现有 Viewer 1.2.4 的 OIDC 入口与绑定保持启用且不应被覆盖。
