# Viewer → OurTaiko 反向 OIDC：Viewer Provider 工程交付切面（方案 B）

状态：**Draft / 未部署**。原正式生产 Viewer 1.2.4 的 OurTaiko → Viewer OIDC 登录与 link 保持不变；本文件不是生产启用说明。本分支不包含任何服务密钥。

## 已实施的基础

- `server/services/reverse-oidc/account.ts`：不可复用、不可四舍五入的十进制 BIGINT `sub`，从 `CAST(id AS CHAR)` 提取的只读 Viewer 用户资料；按照 `openid/profile/email` 精确投影 claims。邮箱仅在 `email_verified=1` 时对已授权的 `email` scope 返回。没有任何原始密码、QQ、成绩或 Token。
- `tests/reverseOidcAccount.test.mjs`：精确大整数、scope 隔离、未验证邮箱不外泄的定向用例。添加到新接口前需在服务器用原有资源限制执行，不增加全量 CI Gate。

## 尚须实施的核心 Provider

不得手写 OAuth Authorization Code、PKCE、JWT 签名、Discovery 或 Token 的认证协议。建议采用维护中的 `oidc-provider` v9（Node 24 运行），并提供：

1. **独立 OP Origin/Issuer**：`https://viewer.sakura-bot.cn/oidc`，经 Nginx 明确代理到受限、仅 loopback 的独立 Node 进程，不覆盖现有 Nuxt /api/account/oidc/* 作为 RP 的路由。Discovery/JWKS/authorize/token/userinfo 由库产生，使用精确 Issuer 和 RS256。
2. **RP Client 固定登记**：OurTaiko `client_id=OurTaiko`，客户端保密密钥与既有 OurTaiko → Viewer 的 `Sakura` 凭据严格隔离；回调必须精确为 `https://sso.ourtaiko.org/login/sakura/callback/`。仅 `response_type=code`、PKCE S256、`openid profile email`。
3. **Viewer 登录与授权交互**：库内建 devInteractions 在生产必须关闭。用户必须通过 Viewer 已验证的第一方 `stv_session` 证明身份，并在 Viewer 本域明确确认向 OurTaiko 分享稳定 Viewer ID 与已验证邮箱；取消不得签发授权码。处理同意时防止 CSRF、会话切换、登录撤销、账号切换及回调重放。
4. **持久存储**：实现 `oidc-provider` 文档约定的 Adapter，持久保存带 TTL 的会话/授权码/令牌/Grant；过期、消耗、吊销应原子执行。不能使用默认 MemoryAdapter 运行生产。
5. **密钥**：签名私钥与 cookie keys 从 root-only 私有文件加载；JWKS 只暴露公钥。为密钥轮换留稳定 kid 与旧公钥验证窗口；不记录 authorization code、ID Token、用户邮箱、客户端密钥。
6. **用户身份**：Provider 的 `findAccount` 只能使用本分支定义的 read-only SQL CAST adapter，`sub` 是精确原始十进制串，不能先强转 JS Number。用户被删除、Session 被撤销或用户未同意时拒绝。
7. **流控和隔离**：单独 systemd/cgroup 限额，Node 24.22.1 或更高已批准安全版本；反代不得记录 `/oidc` 的 code/state；只有受控客户端拥有授权凭据。

## 与 OurTaiko 的最小集成顺序

第一步仅提供对**已有正式 `Sakura` 绑定关系**的反向 OIDC 登录。OurTaiko 校验 ID Token 中 Viewer sub，在现有 `ExternalLink` 按正式 Application + external ID 精确查询，若已有绑定，签发 OurTaiko 自己的会话；未绑定不进行邮箱自动合并，也不偷偷写入 Viewer 本地关系。

第二步才实现未关联用户自动建号、主动绑定以及 backchannel exact-pair confirmation。特别注意：用户在 OurTaiko 完成 OIDC 不代表 Viewer `web_external_identities` 已经记录双向关系；必须按照 [SAKURA-PROTOCOL 0.2 草案](https://github.com/OurTaiko/OurTaikoLogs/pull/1) 协商并实现双端同对写入/恢复/解绑。

## 发布边界

此 PR 仅交付 Provider 账号 claims 基础，不带运行服务、依赖更新或私有凭据，**不可合并后直接宣称 Provider 已可用**。后续单独实现成熟库集成及 Viewer 会话同意流程，完成一次基于真实 OIDC 的精确账号登录后方可启动生产上线工作。原 1.2.4 正向功能不得回退或关闭。
