# Viewer 1.2.3 OurTaiko 真实 link 最小联调

基于 main `eb37e1f044cb68e5987f1dba6422633bba77aa68`。按本轮用户明确授权，使用现有 Sakura-staging confidential Application 和既有自有专用测试账号；不要求管理员书面工单或先行解绑。成功后保留本地测试身份及远端关系。此前 1.2.2 文档的管理员清理前置流程不再适用于本批授权。

## 持久隔离

数据库为 `viewer_ourtaiko_staging_test`，datadir 固定 `/var/tmp/taiko-viewer-ourtaiko-staging/mysql`，不在任何 QA scratch 下。首次建号 ID 事先固定在私有配置和 admission manifest；不因重启、浏览器退出或 QA 清理而重置。数据不复制自生产，显式账号/OIDC Schema 已在此库准备，实际 SELECT DATABASE()、datadir 设备/inode 均核验。

MySQL 使用独立进程、`--no-defaults`、`--skip-networking`、私有 Unix socket；Nuxt 通过临时 loopback SQL 代理使用该库的独立非 root 用户。整个 MySQL/Nuxt/浏览器受现有 QA cgroup 与互斥锁约束，结束只停进程，保留库。仍用既有 owned-qa 启动校验；新增 opt-in `TAIKO_OIDC_PERSISTENT_STAGING=1` 仅接受上述固定目录、固定 `_test` 库名、0700 所有者目录及 0600 的 `admission.json` 中匹配的设备/inode。其他运行时路径仍只能位于本轮 scratch，普通临时 QA 校验保持不变。

复用可信 localhost TLS、原有私有 client.json/test-account.json。OIDC 和 remoteLinkEnabled 仅在该 Nuxt 子进程中启用。回调仍是 `https://localhost:8443/api/account/oidc/ourtaiko/callback`；代理无访问日志，不记录授权码 query，拒绝业务写入。正式 Viewer 的配置、数据库、代理和部署产物均未修改。

本批专用入口：

```sh
bash scripts/memory/run_qa.sh /usr/bin/env \
  TAIKO_ALLOW_TEST_DB_MUTATION=1 TAIKO_OURTAIKO_REAL_LINK=1 \
  /absolute/path/to/node scripts/readiness/serve-ourtaiko-persistent.mjs
```

这不是旧的 `run-isolated-sql.mjs --oidc-loopback`；后者仍会销毁自己的临时库，不得用来承载真实远端绑定。

## 请求约束与证据

`ourtaiko-persistent-fetch.mjs` 只放行真实 SSO 的 Discovery/JWKS/token/lookup/link 固定路径。首次 lookup 成功后，核对已验证邮箱属于既有自有测试账号，再将对应 OurTaiko sub 固定；不保存邮箱或响应正文。link 请求只能使用该 sub 与固定 Viewer ID；X-Service-ID/Key 来自现有私有 confidential 凭据，不发送 Origin、Cookie 或 OAuth Token。协议规定 lookup/link 共用 Application 外源互通权限；lookup 200 是权限前置检查，实际 link 200 是该接口权限的最终实证。

每次显式运行最多允许一次真实 link。任何未知结果不自动扩大远端请求；业务客户端内部的第二次尝试会在测试出口拦截。该拦截保留本地审计，不伪造成远端成功。

最小证据位于 `/var/tmp/taiko-viewer-ourtaiko-staging/evidence/`：

- `pair.json`：Application、OurTaiko sub、固定 Viewer ID、自有测试账号核验及时间。
- `remote-confirmation.json`：相同账号对的 HTTP 状态、OK 与 linkedAt。
- `result.json`：本地 identity/status/operation ID、审计 outcome、建号数量、再次登录结果及停止/保留状态。
- `network.json`：端点类别和 HTTP 状态，不含请求头、正文、邮箱、密钥或 Token。

私有凭据及数据库密码在 Git 外 0600 文件中。浏览器只有本轮临时 profile，退出后由 QA scratch 清理；持久数据库和上述证据保留，不主动解绑或删除测试身份。

## 真实发现的兼容问题与同对恢复

第一次真实 OIDC、lookup 和 link 均返回成功。OurTaiko 的实际 linkedAt 为带六位小数及 `+00:00` 的 Django aware datetime；1.2.2 客户端只接受 Z 且最多三位小数，误将真实 OK 响应标为 invalid_response，本地保留 pending，符合原有不确定结果保护。

仅修复此已确认问题：接受带时区的 RFC 3339 时间及小数秒，保留远端时间原值；Issuer/sub/externalId、成功 envelope 与其他安全校验不放宽。补充一项实际 wire 格式的纯解析回归，不重跑大型 CI、Provider Mock、页面回归或故障注入。

保留第一次远端 OK 证据和原数据库。恢复需要显式 `TAIKO_OURTAIKO_RECOVER_SAME_PAIR=1`；入口核对现有本地账号对、自有账号核验记录、第一次远端 200 的账号对及 operation ID，一致后才重新 OIDC 授权并对原绑定对重试一次。不改变 Viewer ID，不删除未知审计，不直接修改本地状态为 linked。再次登录不重复调用已确认的 link。

恢复入口使用上述命令再加 `TAIKO_OURTAIKO_RECOVER_SAME_PAIR=1`。成功后不得把此 pending 恢复命令当作常规重跑工具；入口会拒绝已经 linked 的 fixture。

## 实际结果（2026-11-03）

真实链路已打通。初次 OIDC/JWKS、lookup 和 link 全部 HTTP 200；lookup 邮箱已在内存中核对为既有自有测试账号，link 的服务认证和 Application 权限均由真实返回证实。时间格式兼容修复后，对同一 OurTaiko sub/Viewer ID 幂等恢复返回 200，linkedAt 与第一次完全相同，本地 identity 及最新审计均为 linked，operation ID 不变。

随后完成一个新的真实 OIDC 登录，token/JWKS 均为 200，仍复用同一 Viewer ID；账号和关联各一条，审计仍为原来三条（两个历史 unknown、一个恢复 linked）。此轮显式禁止 link，请求数为 0，也没有重复 lookup。历史 unknown 不删除、不改写，保留首次真实兼容问题的可审计轨迹。

- 首次远端写入：`qa-1fa8725db378`；同对恢复：`qa-0183807c9e44`；再次登录最终通过：`qa-fbbefd5c7504`。QA 输出位于 `/home/sigaer/taiko/qa-vault/runs/{runId}/evidence/`，MySQL/Nuxt/Chromium 均已停止，自动清理仅涉及各轮 scratch，持久库不在其中。
- 准确账号对、operation ID、逐阶段 HTTP 状态和时间只保存在私有 `evidence/final-summary.json` 及上述证据中，未提交真实身份资料、邮箱、密钥或 Token。对证据、日志及源码差异做了私有值比对，未检出凭据、密码或邮箱。
- 只运行一次针对实际时间格式的解析回归（`qa-cb910952815a`）并通过；不运行 Provider Mock、大型 CI、页面矩阵或故障注入。必要的 staging 构建及兼容修复重建均通过，日志 `/var/tmp/taiko-viewer-1.2.3-recovery-build.log`。该批提交使用 skip-ci 标记，避免 main 推送再触发用户要求省略的大型 CI；未修改 CI 工作流。
- 数据库和远端绑定按用户新指示保留；没有调用 unlink、清理对方 SSO 数据、删除测试身份或执行正式部署/生产迁移。后续需要清理时，以私有证据中的精确 Application/账号对/operation ID 为准，另行安排。

已确认绑定的只读登录核对，可在相同入口使用 `TAIKO_OURTAIKO_VERIFY_LINKED_LOGIN=1`（代替 pending 恢复标记）；此模式要求已 linked，出口拒绝所有 link，并断言审计数量不增长。不要把它改为新建临时 ID。首次远端成功、恢复成功和最终登录证据分别保留，不能只用最后一次登录的零 link 计数代替真实写入证据。
