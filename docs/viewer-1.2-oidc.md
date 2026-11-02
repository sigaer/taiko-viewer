# Viewer 1.2 OIDC 登录基础

Viewer 1.2 复用现有 `web_user_accounts`、`web_user_sessions` 和 `stv_session`，增加可配置的 OIDC 登录及主动关联。功能默认关闭。本批仅交付代码与隔离验证，不部署、不执行生产迁移、不申请外部凭据。

## 配置

配置只在 Nitro 服务器读取，不进入 `runtimeConfig.public`。运行时环境变量为：

| 配置项 | 默认值 | 用途 |
| --- | --- | --- |
| `NUXT_OIDC_ENABLED` | `false` | 总开关；启用值为 `1` 或布尔 `true` |
| `NUXT_OIDC_PROVIDERS_JSON` | `[]` | Provider 注册表 JSON 字符串 |

示例使用保留示例域名。生产凭据应存入私有环境配置，不能提交到 Git、放入命令行参数或输出到日志。

```json
[
  {
    "id": "example",
    "label": "Example",
    "enabled": true,
    "issuer": "https://identity.example.com",
    "clientId": "viewer",
    "clientSecret": "REPLACE_IN_PRIVATE_SERVER_CONFIGURATION",
    "tokenEndpointAuthMethod": "client_secret_basic",
    "idTokenSigningAlg": "RS256",
    "redirectUri": "https://viewer.sakura-bot.cn/api/account/oidc/example/callback",
    "scopes": ["openid", "email", "profile"],
    "endpointOrigins": ["https://identity.example.com"]
  }
]
```

`id` 必须是小写字母开头的字母、数字或连字符，最长 48 位。同一注册表中的 ID 和 Issuer 均唯一。Issuer 按 Provider 发布的精确值配置，含有意义的路径和末尾斜线。Discovery 自动从该 Issuer 获取；所有 URL 必须为 HTTPS，禁止 URL 用户名、密码和 fragment。授权、Token 和 JWKS 端点必须位于显式允许的 `endpointOrigins`；默认只允许 Issuer 的 origin。HTTP 重定向不被跟随。

支持公开客户端 `none` 和机密客户端 `client_secret_basic` / `client_secret_post`；有 Secret 时默认 basic，否则默认 none。签名算法默认 RS256，可预配置 PS256 或 ES256；不接受 `none` 或对称签名。作用域必须包含 `openid`。Provider 必须声明支持 Authorization Code 和 PKCE S256。

回调只能是预配置的 HTTPS 地址，路径严格为 `/api/account/oidc/{id}/callback`，不允许 query。无需将 Provider Secret 或 Token 提供给浏览器。配置变更会使已发起但未完成的事务失效。关闭总开关或禁用 Provider 后，开始和回调入口均拒绝继续，页面不展示入口；不要求 OIDC 新表已迁移。

## 迁移与数据约束

新增表不会被账号启动初始化或请求自动创建：

- `web_external_identities`：用户外键、Provider ID、二进制精确 Issuer/Subject、关联状态、远端关联状态、稳定幂等操作 ID、创建及更新时间。`(issuer, subject)` 唯一，`(user_id, issuer)` 唯一，每个 Viewer 用户在同一 Issuer 下只能关联一个身份。
- `web_oidc_transactions`：state 和浏览器秘密的 SHA-256、发起会话哈希、目标用户、配置指纹、nonce、PKCE verifier、用途、本站返回路径、语言及消费时间。10 分钟有效，数据库条件更新保证只消费一次；过期一天的事务在新开始请求中按每次最多 100 条清理。

测试迁移入口：`taiko_viewer/scripts/migrate_oidc_schema.ts`。只在显式提供测试 DB 配置时使用，默认只验证，`--apply` 才执行 DDL。实际 `SELECT DATABASE()` 必须以 `_test` 结尾，且写入需要 `TAIKO_ALLOW_TEST_DB_MUTATION=1`。通过 `scripts/memory/run_qa.sh` 执行。该脚本没有生产写入模式；`--production` 明确拒绝。生产迁移与启用需另行安排，不属于本批交付。

## 路由与行为

| 路由 | 行为 |
| --- | --- |
| `GET /api/account/oidc/providers` | 返回启用的 ID、展示名；关闭时为空；不进行 Discovery |
| `POST /api/account/oidc/{provider}/start` | JSON：`purpose` 为 `login` 或 `link`，可选 `redirect`、`locale`。要求 Origin 与预配置回调 origin 一致。返回授权 URL |
| `GET /api/account/oidc/{provider}/callback` | 标准 query code/state 回调，成功后 303 到安全本站路径；失败到登录或资料页，只有固定错误代码 |
| `GET /api/account/oidc/bindings` | 启用时要求现有 Session；返回当前用户各 Provider 的本地关联及远端状态，不返回 Subject、Token 或幂等秘密 |

浏览器事务 Cookie 为 `stv_oidc_{provider}`，HttpOnly、Secure、SameSite=Lax，作用域只覆盖该 Provider 的 API，10 分钟有效。每个 Provider 在当前浏览器只保留最近一次发起的 Cookie；旧标签页不能借用新事务 Cookie 完成回调。不同浏览器可以独立并发。必要状态全部存在 MySQL，无进程内事务存储。

主动关联使用现有浏览器 Session，目标只能来自当前会话。登录流程也记录发起时的会话。回调在换码前验证会话，并在提交前锁住会话行重新验证；登出、过期、账号切换或换码期间撤销都会拒绝。关联成功保留原 Session；第三方登录复用统一 Session 签发方法，始终生成新的随机 Session。外部传入的用户 ID 不参与目标选择。

协议处理使用 [openid-client](https://github.com/panva/openid-client)，显式启用 `enableNonRepudiationChecks`。强制 S256 PKCE、state、nonce 和 ID Token；库验证签名、Issuer、Audience、有效期及 nonce。本地额外验证出现时的 `azp`、`c_hash` 和 `at_hash`。每次 Provider HTTP 请求最多 10 秒，响应体最多 256 KiB。Access/Refresh/ID Token 仅停留在回调请求内，不持久化、不返回前端、不记录协议异常内容。

已关联身份按精确 `(issuer, sub)` 登录，不用邮箱、昵称或用户名找关联。首次建号必须有可信 `email_verified: true` 和合法邮箱；没有已验证邮箱时引导用户先注册或登录后主动关联。邮箱冲突不会自动合并。新账号使用随机 `viewer_…` 用户名和无法通过现有密码验证器的 `oidc-only` 标记；可通过原有邮箱重置密码流程自行设置密码。未验证邮箱不会写入或覆盖本地账号。建号、身份写入及 Session 插入在同一个 SQL 事务中提交，任何冲突均回滚。

返回地址仅接受安全本站路径，拒绝外域、协议相对、反斜线、控制字符、编码绕过和 API 路径。回调不采用请求 Host 推导 Redirect URI。所有 OIDC 响应为 no-store，回调使用 no-referrer。上线时还需在反向代理访问日志中隐藏此回调的 query，避免基础设施记录授权码；本批不修改生产代理配置。

## 定向验证

从仓库根目录执行：

```sh
bash scripts/memory/run_qa.sh /absolute/path/to/node --experimental-strip-types --test taiko_viewer/tests/oidcConfig.test.mjs taiko_viewer/tests/accountAnonymousAuth.test.mjs taiko_viewer/tests/accountEntryState.test.mjs
bash scripts/memory/run_qa.sh /absolute/path/to/node taiko_viewer/scripts/test_oidc_isolated.mjs --allow-test-db-mutation
```

SQL 测试自行创建空的私有 MySQL 实例，`--skip-networking`、独立 datadir 和 Unix socket；先验证实际 datadir，再证明 `SELECT DATABASE()` 是 `_test` 后才写表和合成账号。HTTPS 模拟 Provider 使用本次测试生成的本地证书，测试进程只允许访问两个自建 loopback HTTPS 服务。测试运行实际 API handler、真实 OIDC 客户端、签名 Token 和真实 SQL；账号 DB 配置与无关外部服务在测试边界注入。清理时关闭 HTTP 服务、连接池和 MySQL 子进程，证据写入 QA vault。

同一隔离实例还运行原有 `accountEntrySqlHttp.test.mjs`，覆盖密码注册、登录、重置及 Session 撤销、Developer Token 生命周期和 ResourceGrant 账号隔离/撤销边界。OIDC 不改变 Developer 全局成绩只读权限、ResourceGrant、成绩 API、QQ、游戏账号或历史数据。

构建后的 Nuxt 页面检查可使用现有隔离 SQL runner：

```sh
bash scripts/memory/run_qa.sh /usr/bin/env TAIKO_PYTHON_EXECUTABLE=/absolute/path/to/installed/python /absolute/path/to/node scripts/readiness/run-isolated-sql.mjs --allow-test-db-mutation taiko_viewer/tests/oidcNuxtUi.test.mjs
```

2026 年 11 月 2 日验证结果：OIDC HTTPS Provider + H3 + SQL 定向测试、原有账号/Developer/ResourceGrant SQL HTTP 测试通过；36 个页面组合通过（开关各状态 × 中日文 × 375/414/1280px × 登录/注册/资料），无横向溢出和页面运行错误。显式迁移的 opt-in 拒绝、生产模式拒绝及测试库重复执行通过。现有 CI 的 319 项 Node 回归、Contract bindings 检查和 3 项跨语言测试通过。最终 `npm run build` 经 `scripts/memory/run_build.sh` 完成，构建与包装器退出均为 0；未执行 deploy 脚本。冻结的 Developer API 文档仍保持 1.0.0 元数据；回归测试不再错误地要求它随 Viewer 的功能版本变化。

核心实现位置：`server/services/oidc/{config,protocol,schema,service,remote-link}.ts`，路由位于 `server/api/account/oidc/`；统一会话签发位于 `server/utils/account/session.ts`，原密码认证仅改为调用该公共方法。三个页面各引入 `components/account/OidcOptions.vue`，不重做原有表单。`nuxt.config.ts` 增加私有配置，package/lock 升至 1.2.0 并锁定 OIDC 客户端依赖。三个 OIDC 测试文件及隔离 runner 随代码提交，配置边界测试加入现有 CI。

## 第一阶段整合前安全审查

2026 年 11 月 2 日复核交付提交 `a3dee126d392f68ce780981430c10a5b8b2b05dc`。远端及本地 main 均为 `e79aff6c3a3b6c94459bbafac7f40945edd9fde0`，交付分支直接基于该基线，工作树干净。未发现需要阻断主分支整合的问题，本次仅补充审查记录，不修改实现、不增加功能或验收门槛。

| 审查项 | 代码与证据核对结果 |
| --- | --- |
| state、nonce、PKCE 和一次性回调 | 随机 state 与浏览器秘密分别哈希入库，绑定 Provider 及配置指纹；条件 UPDATE 同时检查有效期和未消费状态。库调用携带 S256 verifier、expectedState、expectedNonce，显式要求 ID Token 并开启签名验证。错误 state/nonce、重放、过期和并发回调已有隔离覆盖。 |
| Session 身份一致性 | 关联目标来自有效 Viewer 会话；回调比较原会话哈希及所属用户，在换码前检查并在最终事务内锁定 Session 行复核。已有账号切换、会话过期、换码期间登出与无 Session 关联拒绝的证据。客户端传入 userId 不参与目标选择。 |
| 唯一约束、并发与回滚 | `(issuer, subject)` 和 `(user_id, issuer)` 为完整二进制唯一键。新用户、外部身份及新 Session 同事务提交，冲突和死锁回滚；Cookie 在提交后签发。已有不同邮箱争用同一身份、不同用户并发关联及无孤立 OIDC-only 用户的 SQL 断言。 |
| 重定向、配置与网络 | 仅使用服务器 Provider 注册表及固定 HTTPS 回调；返回路径拒绝跨站、编码绕过及 API 路径。Discovery 校验精确 Issuer，端点校验允许的 origin；请求禁用 HTTP 重定向，限制超时和响应大小。总开关关闭、Provider 禁用、配置变化与换码期间关闭均有拒绝证据。 |
| OIDC-only 旧密码登录 | `oidc-only` 不符合原密码验证器的 `salt:hash` 格式，验证器立即返回 false；真实旧登录路由以该字符串尝试登录的 HTTP 结果为 401。已验证邮箱的正规重置密码流程保持原有语义。 |

复用以下本机 QA 证据，均对应已交付实现：

- OIDC 与原账号/Developer/ResourceGrant SQL HTTP：`/home/sigaer/taiko/qa-vault/runs/qa-63cbb1f47ba1/evidence/`，实际 `_test` 数据库及私有 datadir 已验证，生产连接和生产写入均为 0，测试 MySQL 已退出。
- 36 个中日文页面组合、默认关闭时无入口及迁移保护：`/home/sigaer/taiko/qa-vault/runs/qa-3c9d653250ae/evidence/`，Nuxt 与 MySQL 已关闭。
- 319 项 Node 回归、Contract bindings 及 3 项跨语言测试：`/home/sigaer/taiko/qa-vault/runs/qa-9e9ec6a9a48a/evidence/`。
- 最终生产构建：`/var/tmp/taiko-viewer-oidc-build.log`、`/var/tmp/taiko-viewer-oidc-build-result.json`，npm 与隔离包装器均以 0 退出。

本次没有实现修复，因此不重复运行上述测试或构建。整合保留 `oidcEnabled: false` 和空 Provider 注册表，不配置真实 OurTaiko 凭据、不执行生产迁移或部署。真实 OurTaiko 协议联调、生产迁移和启用需后续单独安排；远端 link 与 Sakura 反向登录仍属于独立批次。

## OurTaiko 后续接入

在 Provider ID 确认为 `ourtaiko` 的前提下，需要向 OurTaiko 注册的精确回调地址是：

```text
https://viewer.sakura-bot.cn/api/account/oidc/ourtaiko/callback
```

接入前需要对方提供：精确 Issuer 及 Discovery/JWKS、Client ID、客户端认证方式及所需 Secret、允许的回调地址、`openid email profile` 作用域、稳定 Subject 规则、`email_verified` 语义、PKCE S256 支持、签名算法、端点来源列表、测试身份和错误/密钥轮换约定。若真实元数据不同，先在隔离环境验证，再单独安排生产迁移和开关启用。当前代码没有内置 OurTaiko 特例或真实凭据。

`remote_link_status` 初始为 `not_requested`。服务器内部 `readRemoteLinkIntent(db, userId, issuer)` 提供持久且唯一的操作 ID，作为未来远端 link 请求的幂等键；同一关联的重复本地绑定不会改变该键。当前没有远端 link 调用、重试 worker、远端状态确认、解绑/撤销、远端登出或账号生命周期同步，也没有宣称双方已绑定。双方成绩、QQ、权限和历史数据的互通均不在本批范围内。
