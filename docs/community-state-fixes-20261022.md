# Viewer 0.87.6：通知与发帖状态修复

延续 PR #33、分支 `fix/community-notifications-composer-20261022`，基线 0.87.5 / `2bf1a09f8a123826f4c0689fe6041ae06b0b8231`。接续原候选 `7e5e2e61b30359bff7c1d9442f516e8fa8fe17e0`，没有重新实现或重复应用补丁。独立工作区 `/var/tmp/viewer-community-pr33-20261022`，原工作区及 WIP 保留。本轮仅验收并发布通知、发帖两个页面的兼容修复，不表示整个社区批次完成。

## 实际修复

- `pages/forum/notifications.vue`：单条已读、全部已读与导航共用锁；响应确认后更新未读数，失败恢复操作；已读成功不因导航失败回滚。区分读取失败与空态，保留 20 条分页、身份代次及 KeepAlive 保护。
- `pages/forum/new.vue`：提交快照保留失败原稿与可编辑段落。创建回执与导航分开，打开失败只重试打开，不重复 POST。账号切换清除私有草稿，迟到创建／上传不得覆盖新身份；上传结束前禁止提交；停用期间接受的本作者回执保留但不抢占导航。

上述两页实现仍为原候选；真实页面验收未发现需再改的产品代码。客户端回执不等于服务端 exactly-once；服务端接受后网络丢失的歧义仍按原协议处理。不改服务端权限、API、数据库结构、评分、目标、首页或 My Taiko。

## 验证层级

| 层级 | 实际执行与边界 |
| --- | --- |
| 定向脚本／原身份 guard | 原 38 项为完整 SFC script 加受控响应式／生命周期／导航端口，不能作为 Vue DOM、浏览器或 SQL 通过。旧候选 CI #58 的 241 项仅为历史索引，不代替新提交结果 |
| 真实 Nuxt／Vue／浏览器 | 使用实际路由、真实组件及合成身份。34 项交互检查，1440 浅中、390 浅中、414 暗日代表场景，6 张页面截图。覆盖读取失败／空态／重试、23 条分页、单条／全部互斥、重复点击、取消导航后恢复、原稿可编辑、重试正文不重复、创建回执仅重试打开、上传忙碌、身份切换、迟到响应及 KeepAlive。成功写入只由 Playwright route 受控返回 |
| 真实隔离 HTTP／SQL | 复用现有 SQL 源码加载边界、H3 HTTP 栈和 MySQL 8 测试启动方式；独立私有 socket、`--no-defaults`、禁用网络／事件／复制，空白测试库。验证实际 `SELECT DATABASE()` 为 `viewer_community_pr33_test`、datadir 为本次 QA scratch、显式 `TAIKO_ALLOW_TEST_DB_MUTATION=1`，然后执行真实 schema、session 查询、权限与 forum handlers。合成作者创建 → 合成第二账号回复 → 作者收到通知 → 已读并打开对应回复，9 次 HTTP 请求；正文、歌曲 100／难度 4、SQL 通知归属、未读 1→0 及异账号不能改读状态通过。catalog 与 runtime 为合成输入，session 为测试表种入，不声称真实登录流程通过 |

测试不会连接生产库，也不复制真实用户数据。线上仅匿名只读，发帖、回复、已读、上传等非读取请求均阻断。应用正常启动／后台任务与验收主动写入分别记录，不将启动声明为零写入。

隔离 SQL 首次因原测试加载器缺少 Nuxt 服务端文案 JSON 导入支持而失败；记录保留，未计通过。仅在既有 fixture 增加真实 locale JSON 的源码加载及合成封面导出后，完整 HTTP／SQL 链路通过。没有修改业务错误处理来让测试通过。

## 可复跑

安全运行时：`/opt/taiko-viewer-runtime/node-v24.22.1-linux-x64/bin/node`，内置及 npm Undici 7.30.1。没有新增依赖或升级无关依赖，Contract 不变。版本仅更新 package、lock 根版本、两份应用文档元数据和发布说明至 0.87.6。

```sh
# 自动启动、检查并清理本地 Nuxt；入口 http://127.0.0.1:3208/forum/notifications 和 /forum/new
bash scripts/memory/run_qa.sh /usr/bin/env VIEWER_REVIEW_OUT=/var/tmp/pr33-browser-evidence /usr/bin/python3 preview/song-detail/review/community.py

# 新建本次私有测试 daemon／空测试库；结束即关闭，绝不读取生产配置
bash scripts/memory/run_qa.sh /usr/bin/env TAIKO_ALLOW_TEST_DB_MUTATION=1 VIEWER_REVIEW_OUT=/var/tmp/pr33-sql-evidence /usr/bin/python3 preview/song-detail/review/community_sql.py
```

预览 root `preview/song-detail` 不加载业务后端，非读取请求默认 405；浏览器成功操作由测试 transport 完成，不将拒写当作业务成功。相关 GET fixtures 只在预览中加载；预览封面使用本地图片占位，不能作为真实歌曲封面数据验收。生产构建仍为正常 `taiko_viewer` 入口，不含 fixture／评审路由。

原始日志、首次失败记录、截图、候选源码哈希及 SQL 链路结果归档于仓库外 `/home/sigaer/taiko/qa-vault/evidence/viewer-community-pr33-20261022`。Git 保留可复用脚本、fixture、测试与本说明。最终回归／CI／审查、合并及运行产物以同一候选的交付记录为准，不预填发布结果。

## 发布与后续范围

采用原 `scripts/memory/run_build.sh` 和 `scripts/deploy_forum_web.sh`，本轮不继承任何内存准入豁免，脚本失败即停止，不手工替换产物。保留安全运行时与依赖、0.87.5 回滚产物、开机自启关闭状态。

其余社区首页、版块／列表／帖子阅读内容、关系／偏好、登录返回、帮助、开发者及其他常用入口继续按唯一迁移表安排，不作为此 PR 的无限前置条件。两页状态修复验收不等于整个社区内容迁移完成。
