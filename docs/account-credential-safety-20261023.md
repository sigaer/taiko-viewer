# 账号标识保存修复 · 0.87.8

基线 main `7740261316f758055f94ff78024fb6832158d4c0` / 0.87.7，独立工作区 `/var/tmp/viewer-account-credential-safety-20261023`。本工作包只修复客户端凭据持久化；常用入口和开发者验收在合并后的独立工作包进行。

## 行为与升级

删除保存密码的 composable，统一为 `rememberedAccountIdentifier`：只有账号标识和开关两个保存参数。登录成功且选中「记住账号」时保存标识；取消选中立即移除账号标识和记住开关。失败登录不会保存本次输入。注册不调用自建账号保存逻辑。退出登录保留用户主动选择的账号标识；刷新后密码输入由浏览器密码管理器决定，应用不回填密码。

客户端插件在每次 Nuxt 应用启动时直接 `removeItem('taiko-account-password')`，不读取旧值。首次访问升级版本的任意同源页面即可触发，包括保持登录会话而直接访问首页／公共入口的用户，无需先登录或登出。账号保存／读取操作也重复执行清理。旧标签页必须加载新版本后才执行新逻辑；浏览器未访问本站时无法远程清理其本地存储。浏览器拒绝存储访问时应用继续运行，下次启动或账号存储操作再次尝试，不声称被阻止的清理已经完成。

仅移除已确认的旧密码键；用户关闭记住账号时额外移除原有的两个账号偏好键，不清除主题或其他设置。没有读取历史密码、没有全量 clear、没有自行建立密码缓存。登录 username/current-password，注册 username/email/one-time-code/new-password，重置 username/one-time-code/new-password 均使用标准 autocomplete。服务端密码、Session、Token 与授权协议不变。

## 验证层级

`tests/rememberedAccountIdentifier.test.mjs` 覆盖旧版本存储升级、禁止读取旧密码、保留无关设置、账号开启／关闭、重复清理及页面接线。实际 Nuxt 浏览器脚本 `preview/song-detail/review/account_safety.py` 用受控 transport 覆盖失败登录、成功登录、注册、刷新、登出、保持会话访问公共页面，以及1440浅色中文／390浅色中文／414暗色日文。

合成秘密仅在测试进程／浏览器内随机生成，不写源码、截图、日志、报告或持久证据。截图前确认密码输入为空，不启用请求 trace。受控 POST 的数量按路径记录，不保存请求体。这些测试不代表真实邮件送达或数据库登录集成验收。生产主动业务写入为0。

复跑（串行，真实组件、隔离预览）：

```sh
bash scripts/memory/run_qa.sh /usr/bin/env VIEWER_REVIEW_OUT=/var/tmp/account-safety-browser /usr/bin/python3 preview/song-detail/review/account_safety.py
```

当前本地完整 CI 回归列表264/264、Contract生成检查、跨语言Golden通过（`qa-4be473ceb97c`）；最终真实页面、CI、审查及发布结果在仓库外 `/home/sigaer/taiko/qa-vault/evidence/viewer-account-safety-20261023` 归档。旧浏览器首轮因预览SSR合成会话未随登录更新而停止，保留失败记录；修正预览输入，不修改业务认证规则。

版本仅从0.87.7更新为0.87.8，同步锁文件根版本及两份应用OpenAPI文档版本。未升级依赖、未更改Contract版本。发布仍需精确候选 CI／审查与原资源包装器、标准部署脚本通过；保留0.87.7回滚产物、安全运行时和自启disabled。
