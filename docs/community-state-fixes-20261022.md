# 社区通知与发帖状态修复候选

基线：Viewer 0.87.5，`2bf1a09f8a123826f4c0689fe6041ae06b0b8231`。
分支：`fix/community-notifications-composer-20261022`。

这是开发草稿，不是 0.87.6 发布或整批社区验收证明。未合并 main、未部署，也未修改服务器、自启策略或资源准入。应用版本暂与基线一致；正式发布准备必须在本 PR 中同步下一 patch、package/lock 根版本、应用文档元数据和发布说明。不得直接合并此草稿。

## 实现

- `pages/forum/notifications.vue`：单条已读、全部已读和导航共用操作锁；成功响应前不修改已读状态，消除旧失败快照覆盖较新成功的竞态。已读成功后导航失败不回滚已确认状态。全路径释放忙碌状态，读取失败与合法空列表分开，有重试和现有 page/pageSize 分页。服务端全局未读计数、未读优先排序、接口与权限均保留。
- 通知读取和操作回调复用 `useAccountRequestGuard(false)`，补充页面代次与 KeepAlive 停用/恢复；迟到结果不能写入新用户或触发后台导航。SSR 数据继续经过 useAsyncData，不另建存储。
- `pages/forum/new.vue`：提交内容使用快照，不在接受前清空编辑框。失败后原稿可编辑；已加入段落在切换帖子类型后仍可见、可编辑。成功创建回执与跳转结果分开，跳转失败后仅重试打开已创建帖子，不再次 POST；提供显式再发一帖操作。
- 发帖、上传与搜索回调复用现有身份 guard；账号切换清空私有草稿，旧上传和旧创建响应失效；页面停用期间收到本作者的创建成功回执时保留回执但不抢占当前页面。所有上传结束前禁止发帖，避免附件遗漏。

不改服务端、数据库结构、授权、评分、目标、历史事实或已完成的首页与 My Taiko。客户端创建回执保护不等于服务端 exactly-once：服务端已接受但响应丢失的歧义仍需原服务端协议处理，本候选不声称解决。

## 已执行验证

冻结 0.87.5 的原处理函数复现：7 项中 3 项对照通过、4 项缺陷断言失败，失败记录保留在仓库外。

候选新增 `tests/forumCommunityHandlers.test.mjs` 与 `tests/fixtures/forumHandlerHarness.mjs`：38/38 定向测试通过。测试执行完整实际 SFC script 和原有 useAccountRequestGuard，传输、最小响应式/生命周期端口及导航为受控模拟。覆盖已读互斥、失败、导航拒绝/取消、分页、身份往返、迟到 GET/POST、停用/恢复、原稿保留、重复提交、已创建回执与上传。

验证层级必须准确：这不是 Vue DOM 挂载、真实 Nuxt 路由、浏览器或 SQL 验收。初次本地运行环境为独立 ChatGPT 容器 Node.js 22.16.0，单进程串行、128 MiB Node heap、25 秒外部超时；没有使用或修改生产主机的 systemd 包装器。两页 TypeScript script 的语法转译无诊断；不冒充完整类型检查或 SFC 模板编译。外部网络、生产读取和生产业务写入均为 0。

现有 CI 只追加上述测试路径，权限、任务预算、其他测试和正常 Nuxt build 步骤不变。CI 的实际结果以 PR 对应最终提交记录为准，本文不预填 PASS。

生产开发主机复验遵循原包装器：

```sh
bash scripts/memory/run_qa.sh /absolute/node --experimental-strip-types --test --test-concurrency=1 taiko_viewer/tests/forumCommunityHandlers.test.mjs
```

## 合并前剩余事项

1. 同一候选的现有完整 CI、正常业务构建及代码审查。
2. 实际 Vue/Nuxt/浏览器验证：中日文、手机与桌面、分页、导航失败、身份切换、KeepAlive、发帖/上传失败原稿恢复；不能用函数级测试替代。
3. 复用隔离数据库/HTTP 验证发帖、回复、通知持久化与权限，保留实际 SELECT DATABASE 和 mutation opt-in；不要写生产。
4. 正式版本与 lock/application 文档元数据同步；保留已审查 Node.js 24.22.1/Undici 7.30.1 或后续已核实安全基线，不回退依赖。
5. 社区其他入口、登录返回、帮助/开发者/歌曲分类仍按原批次验收；不得将这两页修复计为整个社区完成。
6. 更新唯一迁移表时分别记录已验收、已修复与未验证。受控部署仍走原脚本，本轮不继承上次一次性 MemAvailable 豁免，不启用开机自启。

原始日志与补丁归档在仓库外，Git 只保留源码、可复用测试和此简明说明。
