# 社区核心链路验收 · 0.87.7

基线为 0.87.6 / `5d923bf982c782aecd4359483fb21750c8914cb6`，从当前 main 建立 `fix/community-core-closeout-20261023`，工作区 `/var/tmp/viewer-community-core-20261023`。原设计 WIP、备份和回滚产物保持。

## 实际复现与修复

真实 Nuxt 基线合成输入复现了六条问题，记录在仓库外 `core-before.json`：首页查看全部指向自己；“最新”从精选／热帖等混合，未读取实际最新排序；筛选弹窗未应用就发请求；我的社区读取失败变空态；身份切换保留旧帖子；迟到点赞覆盖新身份。

- `/forum`：最新使用现有 `/api/forum/threads?sort=latest&page=1&pageSize=12`；其他筛选复用原 Home DTO，保留服务端顺序与数量。筛选写入 `filter` query，查看全部进入 `/forum/discussions` 并携带对应 sort／threadType。精选沿用服务端既有优先排序，不新增“全部必须精选”的事实标准。
- `/forum/discussions`、`/forum/section/:slug`：共享 `ThreadListPage` 的请求仅来自已提交 URL，弹窗为草稿；应用、排序和分页只由 query 触发读取，移除重复 refresh。无效参数规范化，歌曲／难度及历史恢复保留，关闭弹窗不把草稿带入分页。
- `/forum/me`：摘要、资料、我的帖子与管理分开加载／报错／重试；未知数量不补零，合法空列表才显示未发帖；已有总数驱动每页10条及URL分页。审查P2用真实页面复现 `page=9` 显示9/2并误报从未发帖；现在按API总数replace到真实末页，暂态不显示错误空态，只有total=0使用未发帖文案，共享列表同步修正并保留筛选query。普通账号不请求管理数据；管理操作互斥，拒绝可恢复，旧身份响应不更新当前页面。
- `/forum/thread/:id`：读取失败可重试；回复／点赞／上传使用现有身份 guard 并增加帖子与活跃视图检查，账号改变清除私有草稿／附件／展开；同一楼层点赞防重复，上传中不可提交，接受回复后仅当前视图消费 DTO。未改变服务端处理器或权限。
- `useForumResource` 只保留一份原 Nuxt DTO，另存身份归属和错误元数据；保留 `forum-home`／`forum-me-home` 键，0.87.6 通知可继续同步未读数。页面／版块／帖子缓存键彼此隔离；SSR 失败通过 hydration 保留，不把 null 当空列表。异步错误解析显式使用 setup 翻译函数。

通知与发帖页产品源码沿用0.87.6，不重新设计或重写状态机。当前主页面没有独立屏蔽管理按钮：屏蔽 API／解除屏蔽用真实隔离 SQL 验证，帖子折叠和展开用真实 Vue 验证；不将 API 验证写成不存在的页面控件通过。

## 验证层级与证据

- `tests/forumCoreState.test.mjs`：URL纯逻辑＋实际生产composable配真实Vue响应式、受控Nuxt／生命周期端口。覆盖归属、账号往返、迟到成功／失败、SSR错误、重试和停用恢复；这不是DOM或SQL测试。
- `preview/song-detail/review/community_core.py`：实际Nuxt路由、Vue组件及浏览器，1440浅中／390浅中／414暗日，使用29条代表性合成帖子、真实 SVG／图片查看组件。请求和写入层级逐项记录。SSR读取为独立预览后端，客户端成功写操作为受控响应，默认预览服务所有业务写入仍405，绝不转发生产。
- `tests/forumCoreSqlHttp.test.mjs`：复用既有私有MySQL启动器、实际H3处理器／服务／SQL。空白禁网测试daemon，实际 `SELECT DATABASE()=viewer_community_core_test`、datadir归属与显式mutation opt-in均验证。34个HTTP请求（此SQL服务／用例／fixture在分页修正后未改）：搜索／歌曲／难度／版块／分页，mine归属与游客拒绝，回复父级、主题／楼层点赞，普通账号管理403、锁帖拒绝不入库及解锁，隐藏与恢复，屏蔽／解除屏蔽及折叠标记，通知和首页未读一致。

catalog、账号及session均为合成输入；未复制真实数据或连接生产库，不声称真实登录服务端／图片存储端到端验收。登录→返回发帖→指定歌曲难度→创建接受→帖子导航在真实Vue中用受控响应验证。数据库层19个POST仅发生在私有测试库（含预期拒绝），不属于生产写入。

首次 SQL 因合成 catalog 不含所选难度而正确拒绝；修正测试输入后重跑通过，不放宽校验。测试工具的等待／参数错误和所有失败记录保留在外部 attempts，不能计为通过。最终测试数量、SHA、CI、构建、审查与发布以最终交付记录为准，不复制旧候选的结果。

## 复跑

安全 Node 为 `/opt/taiko-viewer-runtime/node-v24.22.1-linux-x64/bin/node`，无依赖升级。正常应用生产构建不得使用 preview root。所有QA串行，结束关闭浏览器、Nuxt和私有MySQL。

```sh
bash scripts/memory/run_qa.sh /usr/bin/env VIEWER_REVIEW_OUT=/var/tmp/community-core-browser /usr/bin/python3 preview/song-detail/review/community_core.py
bash scripts/memory/run_qa.sh /usr/bin/env TAIKO_ALLOW_TEST_DB_MUTATION=1 COMMUNITY_SQL_TEST_FILE=forumCoreSqlHttp.test.mjs VIEWER_REVIEW_OUT=/var/tmp/community-core-sql /usr/bin/python3 preview/song-detail/review/community_sql.py
```

原始截图、日志、运行记录、基线复现脚本及实际发布记录在仓库外 `/home/sigaer/taiko/qa-vault/evidence/viewer-community-core-20261023`；Git保留可复用fixture、测试及本说明。线上只读验收禁止非读取请求及帖子详情读取（现有阅读会写浏览计数）。

本轮恢复原资源准入，不继承PR33发布的一次性内存豁免；安全运行时及自启disabled保持。仅走既有CI／审查／标准部署流程，失败不手工替换。唯一迁移表区分核心功能验收与仍未开展的整体内容设计。社区核心完成后，账号、开发者及其他常用入口进入后续最后验收，不混入本PR扩大范围。
