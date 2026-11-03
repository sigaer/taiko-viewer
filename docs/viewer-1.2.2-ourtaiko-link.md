# Viewer 1.2.2 OurTaiko 远端绑定

基于 main `07b8135b4e64adbf5ad0de9bbc0a7a3ef5e68b5e`。协议为 [SAKURA-PROTOCOL.md 0.1](https://github.com/OurTaiko/OurTaikoLogs/blob/main/OurTaikoSSO/docs/SAKURA-PROTOCOL.md)，本批读取 blob `db861f45c52a57b88cf65bb4e45053039784b2bb`。1.2.1 的真实 OIDC、lookup、首次建号及再次登录证据继续有效；本批所有新增远端写入验证仅访问本地 HTTPS Mock，没有调用真实 OurTaiko link。

## 配置与迁移

总开关仍为 `oidcEnabled: false`，Provider 注册表仍为空。服务器私有 Provider 配置新增布尔 `remoteLinkEnabled`，省略即 `false`，仅允许 `id="ourtaiko"` 为 true；字符串 `"true"` 不被接受。既有测试 Application 的私有配置没有自动启用此字段。

未来经授权的持久 staging 示例（密钥必须从私有环境注入）：

```json
{
  "id": "ourtaiko",
  "label": "OurTaiko",
  "enabled": true,
  "issuer": "https://sso.ourtaiko.org",
  "clientId": "Sakura-staging",
  "clientSecret": "PRIVATE_CONFIGURATION_ONLY",
  "tokenEndpointAuthMethod": "client_secret_basic",
  "idTokenSigningAlg": "RS256",
  "scopes": ["openid", "profile"],
  "redirectUri": "https://localhost:8443/api/account/oidc/ourtaiko/callback",
  "remoteLinkEnabled": false
}
```

满足下文真实写入条件并收到明确授权后，才允许在专用 staging 私有配置将最后一项改为 true；同时仍需启用该隔离实例的 OIDC 总开关。正式 Viewer 的开关不变。

显式迁移仍使用 `taiko_viewer/scripts/migrate_oidc_schema.ts --apply`，经 `scripts/memory/run_qa.sh` 运行，只接受实际 `SELECT DATABASE()` 以 `_test` 结尾及 `TAIKO_ALLOW_TEST_DB_MUTATION=1`。新增 `web_oidc_remote_link_attempts`，原有身份表和远端字段不变；不在启动或请求时建表。迁移可重复执行，拒绝生产模式。启用 OIDC 的已有测试实例升级时也需先执行此显式迁移。

审计表记录 attempt ID、稳定 operation ID、精确 Issuer/sub、Application Client ID、数据库产生的 Viewer ID 十进制字符串、结果、安全错误类别、租约、重试时间及远端 linkedAt。没有邮箱、密钥、授权码或 Token。表刻意没有级联删除外键，账号删除不应同时抹除远端写入证据；本批不提供自动清除审计或账号删除能力。

## 提交与恢复

只有完整通过现有 OIDC 验证的回调能够发起 link。个人资料页的重试仍调用原来的 `POST /api/account/oidc/ourtaiko/start`，用途为 link，要求当前 Session 和同源 Origin，并重新完成 OIDC。没有仅凭旧 Session 就发送 link 的 API，也没有保存 Token 的 worker。新绑定是否具备尚有效的 access token，由 OurTaiko 自己的 Token 记录校验；Viewer 不向 external/link 发送 access token。

处理顺序：

1. 复用原有事务完成本地身份、必要的首次建号及新 Session 行；邮箱冲突、身份冲突、会话变化仍按原流程拒绝。此时本地身份真实有效，但尚不表示远端绑定完成。
2. 短事务再次锁定并复核发起 Session 和配置指纹，锁定该身份。将精确账号对和新 attempt 持久化，身份设为 pending，提交后释放数据库连接。
3. 在无数据库事务、连接和 Session/身份行锁期间发送远端 HTTP。目标只能是可信 Issuer origin 的固定 `/internal/v1/external/link`；本机 HTTPS Mock 还需要实际 `_test` DB 和 mutation opt-in。POST JSON 只含已验证 sub 与从数据库 `CAST(user_id AS CHAR)` 得到的 externalId；X-Service-ID/Key 只取服务器 OIDC 配置。不发送 Origin、Cookie、Authorization、OAuth Token 或自定义 URL，不跟随重定向，8 秒总超时、32 KiB 响应上限。
4. 短事务记录远端结果，核对最新 attempt 防止过期响应覆盖新尝试。成功必须是准确 envelope、空成功 message、完全一致的字符串 id/externalId 及有效 linkedAt，才能设为 linked。
5. 交付新 Session Cookie 前再复核发起 Session、配置及新 Session 本身。期间登出、撤销或关闭功能时不签发 Cookie，清除未交付的新 Session。远端已发生的事实仍只归属于原来持久化的账号对，不挪到新账号。

| 身份 remote_link_status | 审计 outcome / 错误 | 含义与恢复 |
| --- | --- | --- |
| not_requested | 无 | 仅完成 Viewer 本地关联；开关关闭时不发送请求 |
| pending | pending | 已持久化意图，可能正在发送或本地确认失败；两分钟租约内其他请求不重复发送 |
| pending | unknown | 网络超时、连接中断、5xx、异常/过大响应或不匹配的成功资料；远端是否提交不确定 |
| linked | linked | 远端准确确认同一账号对；再次 OIDC 登录不会重复发送 |
| failed | conflict | 409 ALREADY_LINKED，拒绝覆盖或合并；需要支持人员核对双方关系 |
| failed | reauthorize | 404 NOT_FOUND，可能授权失效或不可见；统一提示重新授权，不暴露账号存在性 |
| failed | rate_limited | 429，持久化 Retry-After（1–3600 秒）；冷却期内重新授权也不会再次发送 |
| failed | service_rejected / request_rejected | 服务认证/权限/参数拒绝；不暴露远端 message |

结果未知时，同一新鲜 OIDC 回调最多立即重试一次，每次都产生独立审计条目且重复完全相同的账号对。若仍未知则保持 pending；不后台无限重试。远端成功但本地确认事务失败时保留先前 pending 租约，避免把未知结果当成失败而回滚/删除有效本地身份。两分钟后用户重新授权：将失效 pending attempt 标记 unknown，沿用稳定 operation ID 和原账号对再 POST，以远端的同对幂等语义恢复。不接纳客户端传入的 Viewer ID、Subject 或 operation ID。

operation ID 只是本地审计关联标识，不作为未经协议约定的 HTTP 幂等请求头发送；远端幂等身份是 Application + OurTaiko ID + Viewer ID。Client Secret 轮换不改变账号对；更换 Client ID 时拒绝沿用旧 Application 的确认，显示配置变化并要求人工核对。

本地有效账号与远端绑定分别提交，不能跨数据库保证原子性。远端拒绝/未知不破坏已验证的本地 OIDC 登录，不合并成绩、QQ 或权限；用户进入资料页查看未完成状态并主动重试。远端已提交但 Session 被撤销时，也不会为了伪装原子性删除本地身份或远端记录。此实现遵循本批“远端请求不持有 SQL 写事务”的要求，替代协议草案示意中的跨网络长事务。

资料页提供中日文 Viewer 本地关联、OurTaiko 待确认/未知/失败/已确认状态与重新授权按钮。状态读取仅限当前用户，不返回账号对、密钥、Token 或远端响应正文。密码登录、注册、找回密码以及 Developer Token/ResourceGrant 的权限定义未修改。

## 真实 staging 写入的清理前置条件

目前 **没有收到 OurTaiko 管理员可清理 staging link 的确认，也没有执行真实 link**。协议没有开放 unlink API，不能以删除 Viewer 临时数据库作为双端清理。现有 `--oidc-loopback` QA 每轮销毁数据库，且外网 allowlist 不含 external/link；它保留为 1.2.1 登录/lookup 工具，不用于 1.2.2 真实 link。不要给它开启 link 或放宽外网 allowlist。

后续独立批次必须按以下顺序准备：

1. OurTaiko 明确确认 staging Application 和专用测试账号，禁止共享真实业务用户。以安全方式核对已有 OurTaiko sub，不能从邮箱推导身份。
2. 使用专用、持久、空白 `_test` 数据库和专用 Viewer 测试身份；保存该数据库及必要备份直至双方解绑完成。记录数据库身份、Client ID、OurTaiko sub、真实 Viewer 十进制 ID 和 operation ID；记录中不放密钥、Token 或邮箱。该 Viewer ID 在此 Application 下不得被下一轮其他测试用户复用，不允许每轮重建后从小 ID 重新计数。
3. 双方书面约定清理负责人、具体 Application 与绑定对、清理时间、管理员使用的受控方式及成功确认方式。由 OurTaiko 管理员操作自己的 staging 绑定；Viewer 不直连或删除对方 SSO 数据，也不删除对方账号。
4. 收到明确的真实 link 写入授权后，复用已登记 `https://localhost:8443/api/account/oidc/ourtaiko/callback` 与可信本地 TLS/端口转发，保留同一 Viewer DB，通过私有环境注入测试凭据，仅指定测试者操作。在新的有界 QA 会话中验证首次 link、同对重试和本地 pending 恢复，保留两个数据库的绑定对核对证据。
5. 清理先由 OurTaiko 管理员完成并提供确认记录（Application、账号对、操作时间、执行人/工单、解绑后核验结果）；Viewer 侧确认无待恢复远端操作后再停服、清理本地测试身份及数据库。记录清理完成状态与审计位置。缺少这份确认时保留隔离测试身份与证据，不把 ID 分配给其他人。

仍待真实验证：OurTaiko access token 授权有效期的首次写入拒绝行为、同对重试的实际幂等、真实 409/429 与超时恢复，以及管理员清理闭环。Mock 通过不代表真实双端联调通过。远端 unlink、反向登录、业务同步、公开启用和生产发布仍未实现。

## 可复现验证

沿用现有隔离工具，没有新增 Gate：

```sh
bash scripts/memory/run_qa.sh /absolute/path/to/node taiko_viewer/scripts/test_oidc_isolated.mjs --allow-test-db-mutation
bash scripts/memory/run_qa.sh /usr/bin/env TAIKO_PYTHON_EXECUTABLE=/absolute/path/to/python /absolute/path/to/node scripts/readiness/run-isolated-sql.mjs --allow-test-db-mutation taiko_viewer/tests/oidcNuxtUi.test.mjs
```

第一个测试运行真实 H3 路由、真实 openid-client/JWKS 验证、隔离 MySQL 与本地 HTTPS Mock 的 OIDC、lookup、link；保留原有 49 项 lookup 与通用 Provider 回归，增加 link 成功、错误、双端不确定性、并发和恢复案例。原账号生命周期及 Developer/ResourceGrant SQL HTTP 测试仍由同一 runner 执行。第二个测试使用构建后的 Nuxt，覆盖中日文及 375/414/1280px、关闭入口、远端状态与重试操作的布局。所有远端地址由测试拦截为拥有的本机 origin，真实 OurTaiko 请求数为零。

## 2026-11-03 实际验证记录

- 隔离 H3/HTTPS/MySQL：`/home/sigaer/taiko/qa-vault/runs/qa-9c744f627bab/evidence/`。新增 31 组 link 案例全部通过，实际向拥有的本机 HTTPS Mock 发送 57 次 link 请求；原有 49 组 lookup、通用 OIDC 以及账号/Developer/ResourceGrant SQL HTTP 测试通过。`ourtaiko-link-http.json` 包括逐项结果，`oidc-isolation.json` 确认真实 OurTaiko 请求、生产连接和生产写入为 0，MySQL 已退出。
- 已验证远端提交后断线、远端成功但本地确认事务失败、租约过期恢复、旧请求延迟失败不覆盖新确认、并发只发一请求、请求期间不持有身份/Session 锁、账号切换、撤销 Session 以及执行中关闭功能不交付新 Session。
- 现有 CI：`/home/sigaer/taiko/qa-vault/runs/qa-63a2f3745739/evidence/`，320 项 Node 测试、Contract bindings 检查及 3 项跨语言测试通过；没有新增 CI Gate。
- `npm run build` 通过 `scripts/memory/run_build.sh` 完成，包装器与 npm 退出均为 0。日志 `/var/tmp/taiko-viewer-1.2.2-build.log`，结果 `/var/tmp/taiko-viewer-1.2.2-build-result.json`。只生成隔离构建产物，没有调用部署脚本或替换生产输出。
- 构建产物 Nuxt/Chromium 页面验证：`/home/sigaer/taiko/qa-vault/runs/qa-de56a27a5add/evidence/oidc-nuxt-ui.json`，89 项通过；包括中日文 × 375/414/1280px 的原页面与八类远端状态，以及键盘触发重新授权按钮、POST 用途为 link 且不传 externalId 的验证。页面运行错误和横向溢出为零；新旧显式迁移重复执行、无 opt-in 拒绝及生产模式拒绝通过。Nuxt、Chromium 与隔离 MySQL 均已退出。

1.2.3 补充：用户已明确授权现有自有 staging 账号的真实绑定，并改为保留两端数据；该批不再要求上述管理员文书或预先解绑确认。真实结果、时间格式修复和同对恢复见 [1.2.3 真实 link 记录](viewer-1.2.3-ourtaiko-real-link.md)。1.2.2 的 Mock 证据保留为历史验证，不替代新的真实证据。
