# Viewer 1.2.1 OurTaiko 真实联调入口

## 当前结论

回调固定为 **`https://localhost:8443/api/account/oidc/ourtaiko/callback`**。

采用现有 Linux 主机的短期限时实例，通过 SSH 转发供测试者 Windows 浏览器访问。不需要新服务器、公网测试域名或固定 IP 白名单。浏览器执行回调，OurTaiko 服务器无需连接 localhost。未获得 Windows 本机执行通道，因此本批实施并验证服务器侧方案；Windows 信任证书、SSH 转发及真实用户授权仍需在浏览器所在电脑完成。

这是环境就绪验证，不是双方真实登录通过。独立 Application 的 Client ID/Secret 尚未取得，私有配置保持空值，实例中的 Provider 仍关闭。未换取 Token、未调用 lookup，更未调用 link/unlink。

## 给 OurTaiko 登记的信息

| 项目 | 值 |
| --- | --- |
| Application | Sakura-staging，独立测试 confidential Application |
| Redirect URI | `https://localhost:8443/api/account/oidc/ourtaiko/callback`（精确匹配，无末尾斜杠） |
| Provider ID / Issuer | `ourtaiko` / `https://sso.ourtaiko.org` |
| Flow / client authentication | Authorization Code / `client_secret_basic` |
| Scope / ID Token algorithm / PKCE | `openid profile` / RS256 / S256 |
| 资料接口 | 后端固定 `POST https://sso.ourtaiko.org/internal/v1/external/lookup`；服务 ID/Key 复用该测试 Application 的 Client ID/Secret |
| 测试身份 | 同一个专用测试用户，32 位小写十六进制 sub、已验证邮箱，允许该 Application lookup；不使用正式 Viewer 账号记录 |

没有 email scope。OurTaiko 需允许该独立 confidential Application 登记 HTTPS localhost 回调，并确保完成授权后的有效 access token 满足 lookup 可见性规则。本批不执行远端 link 来绕过可见性检查。

## 隔离和运行结构

- 复用 `/var/tmp/taiko-viewer-oidc/taiko_viewer/.output`，来自 1.2.1、代码基线 `8b0d425475485fdb3d5d673d73ddb709b7e6b206`；不再次构建，不替换生产产物。
- 复用 `run_qa.sh` → `run-isolated-sql.mjs` 的私有 MySQL/datadir、空库 bootstrap、非 root 数据库用户、随机凭据和 loopback SQL 代理。每轮新建 `viewer1_security_test`；实际 `SELECT DATABASE()` 和 datadir 必须吻合，生产 3306 不可用作目标。
- 显式运行既有 `migrate_oidc_schema.ts --apply`，要求 `TAIKO_ALLOW_TEST_DB_MUTATION=1`。无启动自动 DDL，无生产迁移。
- Nuxt 只监听随机 loopback HTTP 端口，HTTPS 代理只监听 `127.0.0.1:8443`。代理不使用或改动生产 Nginx。
- 继续使用既有受保护的 `owned-qa` 启动模式，所有 userdata/config/cache 均在当前 QA scratch，不绕过它的数据库、路径或 cgroup 保护。
- 新模式默认开放 480 秒，允许 15–480 秒；之后退出 Nuxt、TLS 入口和私有 MySQL，并由 QA wrapper 删除该轮 scratch。沿用 QA 的互斥锁、CPU/内存限制及 15 分钟总时限，不与构建并发。
- 代理只允许登录/资料页面、必要认证/OIDC 路由及静态资源；拒绝 OIDC `purpose=link` 和其他业务写入。Nuxt 的 fetch 仅放行真实 Issuer 的 Discovery、JWKS、Token 和 lookup 路径；link、其他远端 origin 及重定向均拒绝。其他业务后端配置指向不可达 loopback 地址。
- fetch 观测只保存固定类别的请求数和成功/失败数；不保存 URL query、请求/响应正文、邮箱、请求头、Cookie 或 Token。TLS 代理无 access logger，探测授权码标记未出现在私有 Nuxt 日志中。

## 私有配置和证书

首次预检已创建以下文件，均位于 Git 之外；目录 0700，私有文件 0600，且运行器核对所有者与真实路径：

| 路径 | 用途 |
| --- | --- |
| `/var/tmp/taiko-viewer-oidc-loopback/private/client.json` | 只允许 `clientId`、`clientSecret` 两个字符串字段，目前均为空；收到测试凭据后通过 SSH 私有编辑器填写 |
| `/var/tmp/taiko-viewer-oidc-loopback/localhost-ca.crt` | 公开的专用测试 CA 证书，可复制到测试电脑；不是私钥 |
| `/var/tmp/taiko-viewer-oidc-loopback/private/` 下的 key/crt | CA 私钥及 localhost 服务端证书；私钥不离开服务器 |
| `/var/tmp/taiko-viewer-oidc-loopback/status.json` | 无敏感内容的就绪/停止状态、证书指纹及验证摘要 |

CA 有效期 30 天，服务端证书 7 天，SAN 含 localhost、127.0.0.1、::1。过期时拒绝启动；重新准备证书后重新核对并信任 CA。CA 文件 SHA-256：

```text
0dd4a20d9fd4a06a5c755d698a1739908e8a3e933c9231027a6ba8e23fe4b834
```

收到凭据后只修改私有 client.json。脚本将其注入该轮 Nuxt 子进程的私有运行环境，不写 Git、CLI 参数或日志。其他配置固定为真实 Issuer、上述回调和 scope/algorithm，不接受自定义目标 URL。两项凭据都为空时关闭该实例 OIDC；只填写一项则拒绝启动。正式 Viewer 的 OIDC 配置不变。

## Windows 浏览器准备

以下命令使用既有 SSH 登录目标，不要求固定公网 IP 白名单。用实际 SSH 别名替换示例值；只传输 CA 公共证书。

```powershell
$ViewerSshTarget = 'USER@EXISTING_HOST'
scp "${ViewerSshTarget}:/var/tmp/taiko-viewer-oidc-loopback/localhost-ca.crt" .\localhost-ca.crt
(Get-FileHash .\localhost-ca.crt -Algorithm SHA256).Hash
# 核对上面的 SHA-256 后，安装到当前测试用户的信任根。
Import-Certificate -FilePath .\localhost-ca.crt -CertStoreLocation Cert:\CurrentUser\Root
ssh -N -o ExitOnForwardFailure=yes -L localhost:8443:127.0.0.1:8443 $ViewerSshTarget
```

保持转发窗口打开。使用独立 Edge/Chrome 测试 profile，在实例就绪后打开 `https://localhost:8443/account/login`。例如在另一个 PowerShell 窗口：

```powershell
& "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe" --user-data-dir="$env:LOCALAPPDATA\ViewerOidcTest" https://localhost:8443/account/login
```

应无 TLS 警告；不要跳过证书错误。每轮数据库都是新的，使用新的测试浏览器 profile 或在重开前删除旧测试 profile，避免上轮 localhost Session Cookie 干扰。正式 Viewer 的域名和浏览器 Cookie 不参与。

## 启动、验证和停止

服务器上执行（前台占用一个终端，默认 8 分钟）：

```sh
cd /var/tmp/taiko-viewer-oidc
bash scripts/memory/run_qa.sh /usr/bin/env \
  TAIKO_PYTHON_EXECUTABLE=/home/sigaer/taiko/.venv/bin/python \
  /www/server/nvm/versions/node/v24.13.0/bin/node \
  scripts/readiness/run-isolated-sql.mjs --allow-test-db-mutation --oidc-loopback
```

初始输出给出该轮 `QA_RUN_DIR`。另一个终端读取 `status.json`，确认 `status=READY`；有凭据时还应有 `providerReady=true`、`realStartVerified=true` 和 `cookieFlagsVerified=true`。启动自检使用真实 Discovery 生成授权 URL，校验精确 callback、`openid profile`、S256 和 Secure/HttpOnly/SameSite=Lax Cookie，不输出授权 URL。无凭据时只有环境预检，Provider 和 start 均关闭。

测试者用同一个专用 OurTaiko 用户登录两次：

1. 第一次浏览器授权 → callback → 后端换码/验证 ID Token → lookup → Viewer 账号、身份及新 Session。
2. 返回登录页再次授权 → 匹配同一 `(issuer, sub)` → 新 Session；不重复建号或 lookup。
3. 真实跨站往返成功才证明浏览器传回事务 Cookie；服务器探测 Cookie flags 不能替代这一项。

结束时查看该轮 evidence 中的 `oidc-loopback-result.json` 和 `oidc-loopback-network.json`。`realLoginValidated=true` 要求两个成功登录回调、两个不同 Session、恰好一个账号和身份、恰好一次成功 lookup、至少两次成功换码。`remote_link_status` 必须仍为 `not_requested`。日志只包含数量，不含邮箱或 Token。这是单一测试身份的验证窗口，多账号/其他操作应另起新一轮。

等待限时自动结束，或在前台终端 Ctrl+C。需要从另一个终端停止时，只停止本轮输出中的 QA unit，例如 `systemctl stop taiko-qa-<本轮12位ID>.service`；不要停止 taiko-viewer、mysqld 或其他任务。正常结束证据应有 `nuxtExited=true`、`listenerClosed=true`、`daemonExited=true`，wrapper 的 `childrenStopped=true`、`cleanup=REMOVED_OWNED_SCRATCH_ONLY`，8443 不再监听。

## 清理

每轮 SQL、临时配置、用户记录、Session 和缓存随 scratch 自动删除；QA evidence 保留。结束所有联调后，先停本轮 QA unit 和 SSH 转发，再删除精确的 `/var/tmp/taiko-viewer-oidc-loopback` 目录，移除本地测试浏览器 profile 与下载的 CA 文件。保留的证据不包含 OAuth Token 或响应正文。

Windows 移除此次 CA（先保留 CA 文件以读取 thumbprint）：

```powershell
$ViewerTestCa = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new((Resolve-Path .\localhost-ca.crt).Path)
Remove-Item "Cert:\CurrentUser\Root\$($ViewerTestCa.Thumbprint)"
```

只移除此证书和本次测试 profile，不清空系统证书库或普通浏览器数据。

## 2026-11-02 验证证据

服务器侧实际预检已验证 HTTPS 证书链与 localhost SAN、真实 Nuxt 登录页面、私有库身份和 datadir、显式 OIDC 迁移、跨 Origin start 拒绝、业务写入/绑定入口拒绝、callback query 日志标记不落盘及进程清理。Nuxt 子进程使用自己的 Node TLS 信任库成功读取真实 OurTaiko Discovery，确认声明支持目标协议参数；没有发送 Client Secret、Token 或 lookup 请求。

凭据未取得，`providerReady=false`、`realLoginValidated=false`，账号/身份/Session 均为 0。Windows 信任库、实际 SSH 转发和真实授权往返尚待测试者完成。未将服务器侧预检或历史 49 个 Mock 场景冒称为真实登录通过。生产 Viewer PID/启动时间未变；未修改生产 Nginx、数据库或开关，也未执行构建。

最终环境预检证据：`/home/sigaer/taiko/qa-vault/runs/qa-12146c0b8efd/evidence/`。其中 `oidc-loopback-result.json` 记录 TLS、页面、DB、日志、网络计数和 Nuxt 退出；`viewer1-sql-CEBVcR/result.json` 记录 MySQL 退出；`manifest.json` 记录整个 cgroup 已退出及 scratch 已移除。整组进程在 loopback 脚本运行期间的抽样内存最大值为 431,566,848 bytes（约 412 MiB），无 high/max/OOM 事件；内核未提供 memory.peak，不能当作真实峰值上界。服务端 SSH 配置允许 TCP 转发，实际 Windows 隧道仍未验证。

使用同一命令加 `--oidc-duration-seconds=15` 可重做短时环境预检，无需重复 Mock 测试。预检结束后 8443 无监听，私有数据库及账号记录已随 scratch 删除；CA 和空的 client.json 保留，便于登记 Application 后直接复用。
