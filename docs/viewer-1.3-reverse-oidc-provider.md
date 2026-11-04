# Viewer → OurTaiko OIDC Provider（方案 B）

状态：开发候选，生产仍为 1.2.4；反向入口默认关闭。生产验收未完成，不应把本地隔离验证当成正式绑定账号登录成功。

## 实现

- `oidc-provider` 9.13.3，挂载在现有 Nuxt `/oidc/**`；原 `/api/account/oidc/*` RP 和私有配置独立。
- Issuer 固定 `https://viewer.sakura-bot.cn/oidc`；Discovery、JWKS、Authorization、Token、UserInfo、Revocation 使用标准库。
- 唯一 confidential Client `OurTaiko`，精确回调 `https://sso.ourtaiko.org/login/sakura/callback/`；code、S256、RS256，只有 `openid profile email`。nonce 必填，不允许静默跳过 Viewer 确认。
- Viewer 原 `stv_session` 从数据库验证；用户明确确认授权。CSRF 随机值、Origin、单次同意记录及原账号/Session 绑定；禁止表单重放或授权期间切换会话。
- 数据库 Adapter 存储 Session、Interaction、Grant、Code、Token 的 TTL 和单次消费；授权码消费用条件 UPDATE，Grant 撤销删除派生凭据。持久化授权绑定原 Viewer Session；撤销会话后拒绝换码与 UserInfo。
- `sub` 只从 SQL `CAST(id AS CHAR)` 读取，并验证 uint64 十进制，支持 `9007199254740993` 等超过 JS 安全整数的 ID；没有 Number 转换。邮箱仅按 scope 且验证后分享。

## 正式配置缺口

服务器 `/etc/taiko-viewer.env` 尚未配置 `TAIKO_OIDC_PROVIDER_ENABLED` / `TAIKO_OIDC_PROVIDER_CONFIG_FILE`。启用前需要双方通过受控渠道提供、确认独立 confidential `OurTaiko` 凭据，Viewer OP RS256 私钥和持久 Cookie 签名密钥；不得复用正向 `Sakura` 凭据，也不得把测试值作为正式值。

私有配置使用绝对路径，文件权限 0600，不能写入 Git、日志或 shell 参数。结构：`clientId` 固定 `OurTaiko`、`clientSecret`、`cookieKeys` 数组和 `jwks.keys` 私有 RSA JWK 数组（各有唯一 `kid`、`alg=RS256`、`use=sig`）。公开 JWKS 由库过滤私钥。

轮换：将新签名 key 放到数组首位，保留旧 key 至最后一个旧 Token/Grant 过期窗口结束，再删除旧 key；通过标准发布流程加载配置。Cookie keys 同样先添加新 key、保留旧验证 key 后移除。不能在进程启动时临时生成 key。

## 迁移与发布

`npm run oidc:provider:migrate -- --apply` 只添加 `web_oidc_provider_objects`、`web_oidc_provider_consent`。默认要求实际 `SELECT DATABASE()` 以 `_test` 结尾、写入另需 `TAIKO_ALLOW_TEST_DB_MUTATION=1`。生产迁移需私有明确 DB 配置、`--production --apply`、`TAIKO_OIDC_EXPECTED_DATABASE` 与实际库完全一致、`TAIKO_ALLOW_OIDC_PRODUCTION_MIGRATION=1`，执行前按现有流程备份；应用请求不会自动建表。

过期对象查询立即不可用。维护任务应分批清理两表 `expires_at <= UNIX_TIMESTAMP()` 的记录（每批至多 1000），保留现有业务表。

取得正式配置、两端候选验收后，以 1.3.0 发布提交按仓库流程集成 main，仅通过 `scripts/memory/run_build.sh /bin/bash scripts/deploy_forum_web.sh "<HEAD subject>"` 发布。脚本失败立即停止。OurTaiko 按其正式发布流程启用 RP；随后使用已有正式 `Sakura` 绑定账号取得真实浏览器、换码、验签、重复登录账号及绑定数量不变的在线证据。没有这份证据不能宣称验收通过。

本批只处理已有正式绑定，不自动建号、不按邮箱合并、不扩展新的关联协议。

## 定向验证（2026-11-04）

本地新建 MySQL `viewer_reverse_oidc_test`，执行实际 `SELECT DATABASE()` 并显式 opt-in；OurTaiko 使用新建 SQLite `ourtaiko_test.sqlite3`，没有复制生产数据或复用旧 staging 绑定。Chromium 使用本地 TLS CONNECT 代理访问两个固定域名，后端使用真实 `oidc-provider`、数据库 Adapter 和 Authlib；只有网络目的地被隔离到本地，Token、JWKS、签名、PKCE、state/nonce 校验没有 Mock。Viewer 测试 Session 由隔离库提供，此测试不包含真实生产账号密码登录或公网证书验证。

已验证授权确认 → 换码 → RS256 验签/claims → 现有正式应用名 `Sakura` 绑定账号登录，重复登录 user/link 各 1 行、账号对和密码/权限字段不变；同时覆盖错误 CSRF、会话切换、同意前撤销会话、发码后换码前撤销会话、code 单次消费、Grant 撤销、回调重放、取消、未关联但同邮箱拒绝。大整数 `sub=9007199254740993` 贯穿真实 Token 和账号映射。

可复现命令（两个候选 checkout 均需锁定依赖，需主机 MySQL/Chromium）：在 Viewer `taiko_viewer` 下通过 `../scripts/memory/run_qa.sh` 启动 `node scripts/verify_reverse_oidc_wire.mjs`；命令环境只设 `TAIKO_ALLOW_TEST_DB_MUTATION=1`、绝对路径 `TAIKO_OURTAIKO_RP_CHECKOUT`。MySQL 可执行路径可用 `TAIKO_TEST_MYSQLD` 指定。Runner 必须保持资源隔离，测试将关闭自有数据库、浏览器和监听器。

Viewer 定向测试 7 项、OurTaiko 映射测试 6 项通过。Nuxt 生产构建在既有 5 GiB cgroup / 正式脚本同款 4 GiB Node 堆下通过，耗时约 148 秒，采样 cgroup 峰值 4,190,056,448 字节，OS 最大 RSS 3,716,588 KiB，OOM/kill 均为 0。初次使用 Node 默认堆限制的构建因堆耗尽失败，随后采用仓库既定构建参数；没有调整 cgroup 上限或绕过隔离。

打包的 `.output/server/index.mjs` 也通过上述全部浏览器/换码/验签/绑定与拒绝分支；该模式使用仓库已有的 `owned-qa` 启动隔离，另需 `TAIKO_TEST_NITRO_OUTPUT` 为绝对 server entry 路径。隔离启动再次核验真实 DB 名、datadir、cgroup 和私有运行路径，不启动 Annual 维护任务。版本投影检查通过。生产公开检查仍为正向 registry `ourtaiko` 200、OurTaiko Discovery 200、新反向 Discovery 404；没有正式发布或启用。
