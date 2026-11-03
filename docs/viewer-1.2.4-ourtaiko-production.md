# Viewer 1.2.4 — OurTaiko 正式生产启用

基线：Viewer 1.2.3 已完成真实 `Sakura-staging` OIDC → lookup → link、同对恢复和再次登录验证。本批以正式生产直接开放为目标；不安排新增 Mock、全套 CI 或灰度。**这是发布操作说明，不是已发布证明。**

## 正式上线所需

1. OurTaiko 单独登记 confidential Application `Sakura`，启用 external lookup/link，并登记精确生产回调 `https://viewer.sakura-bot.cn/api/account/oidc/ourtaiko/callback`。从受控渠道取得真实 Client ID/Secret；不要复用 `Sakura-staging` 和测试账号对。
2. 保存现有生产账号数据库的可恢复备份，核对当前生产库及独立迁移状态；确保 Nginx/CDN/APM 不记录 OIDC callback query 中的 `code/state`，但保留回调转发 query 供授权码交换。
3. 使用与生产数据库连接相同的私有环境，通过 `taiko_viewer/scripts/migrate_oidc_schema.ts` 执行显式迁移。生产只读检查需 `--production` 和 `TAIKO_OIDC_EXPECTED_DATABASE=<确切生产库名>`；写入另需 `--production --apply` 及 `TAIKO_ALLOW_OIDC_PRODUCTION_MIGRATION=1`。实际 `SELECT DATABASE()` 与期望完全相同，且不得以 `_test` 结尾。迁移仅按 `OIDC_TABLES` 幂等建三张 OIDC 表，事后核验 Schema；不在应用启动时自动执行。
4. 在仅服务器可访问的 `/etc/taiko-viewer.env` 配置 `NUXT_OIDC_ENABLED=1` 和 `NUXT_OIDC_PROVIDERS_JSON`。Provider 为 `ourtaiko`、Issuer `https://sso.ourtaiko.org`、正式登记的 `Sakura` Client ID/Secret、`RS256`、`openid profile`、完整正式 HTTPS callback，`remoteLinkEnabled` 为 JSON 布尔 `true`。密钥不写进 Git、命令参数、日志或前端。
5. 按仓库约定使用标题以 `1.2.4 ` 开头的 release HEAD，然后在部署服务器只用 `scripts/deploy_forum_web.sh "<HEAD 完整标题>"` 执行正式构建、切换和已有健康检查；部署失败不得手动绕过。
6. 上线后仅核对公开站点、`GET /api/account/oidc/providers` 显示已启用 Provider、旧登录仍可用、实际运行 Node 安全版本/内存/重启状态正常。无需重复 staging 的全套业务或故障测试。

## 回退

优先在私有环境关闭 `NUXT_OIDC_ENABLED` 后重启服务，必要时用现有发布机制恢复上一份构建产物。**远端已经建立的绑定不能随本地代码回退自动撤销**；保留账号对和审计，严禁通过删除账号、清空身份表或复用账号 ID 假装回滚。既有 `viewer_ourtaiko_staging_test` 及其远端测试绑定不做任何改动。

若正式 `Sakura` Application 尚未登记，不能将测试凭据当作正式凭据开启公众入口；此时仅完成代码/迁移准备并报告确切阻塞。
