# 账号与常用入口功能验收 · 0.87.9

本工作包 B 从 A 合并后的 main `8edab2be652fc4a940b526b89cfe7c23f94f39b8` / 0.87.8 建立独立工作区 `/var/tmp/viewer-entry-closeout-20261023`，分支 `fix/account-entry-closeout-20261023`。A 为 PR #35，已独立审查、合并和受控部署；其客户端密码修复不与本 PR 混为同一个发布验收。原设计 WIP、旧工作区和回滚产物保留。

## 复现与最小修复

- 真实 Nuxt 基线复现：同步读取失败显示成未绑定；开发者读取失败显示成未申请；审批503显示成无权限；工单读取失败显示成没有工单。现复用既有 `useForumResource` 的身份归属、SSR错误及缓存返回保护，不新增读模型或API；403审批拒绝和可重试的读取错误分别呈现。
- 注册成功但自动登录失败后，重试曾重复注册；重置密码成功而导航取消／失败后，重试曾重复重置。现保留当前页面已接受阶段：只继续登录、会话读取或打开页面。首次认证读取失败也不显示游客登录表单，提供现有会话的强制重试。认证读取失败与已确认会话过期／换号分开：前者只重试读取，后者允许用户明确重新输入密码。登录返回目标同时拒绝外部与反斜杠形式，保留原合法内部目标。成功后的密码不进入账号存储，离开缓存页面清空密码；验证码请求迟到不启动已离开表单的冷却或反馈。
- 同步操作的回调跟随账号、绑定和当前视图，概览读取失败可重试，保留Source能力、目标、冷却、结果及Score Token；没有返回结果时不冒称同步成功。已接受同步继续通过原包装器使首页状态失效，不增加无条件的重复读取。真实Vue进一步定位到共享guard及页面scope使用返回数组的getter监听，同账号元数据刷新也触发身份失效，造成请求被丢弃却不重新读取、状态被意外清空。现按userid／绑定代次的标量来源监听；真正换号、绑定变化、ABA和离开仍作废旧回调。未奏效的复选框／保留DTO刷新方案已撤回，失败证据保留。另复现开发者公开示例的ElTabs在缓存离开时随私有状态拆除，触发pane注销异常并破坏后续渲染；现公开示例保持挂载并按读取状态显隐，私有状态仍受原归属保护，保留缓存与原内容顺序。真实页面覆盖示例语言切换及往返／失败重试，不升级依赖。

- 工单历史与详情独立错误／重试，身份切换清空私有详情和草稿，迟到写入回执不清空新账号的内容。真实隔离持久化证明保存成功但通知邮件失败可以同时成立；界面保留相应区别。普通用户只有已存在的留言和查看能力，关闭状态由原服务端权限及站务处理器决定，不新增普通用户关闭入口。
- 开发者申请、审批和v1授权增加视图／身份保护。真实隔离SQL复现申请先入库、通知失败后接口500：前端显示原错误并重新读取申请状态，避免继续把已入库申请当作未申请。没有修改服务端邮件或事务处理。
- v1授权页恢复曾依赖初次 activated 钩子；真实Vue再次发现钩子顺序假设不成立，现同一作用域在激活后恢复请求，后台缓存页面不随身份变化发起读取。旧Developer Token与v1 ResourceGrant的说明、权限和撤销范围继续独立；没有扩大授权。真实Vue还复现账号改变后旧审批对话框仍可见；现只关闭本页拥有的审批／Token弹窗，迟到确认不得操作新身份或新绑定。
- “其他”(`shelfStatus=2`)与“已下架”(`1`)分别用真实目录HTTP处理器验收。搜索无结果原先只有空白，现共享列表显示准确空态；正常卡片布局、排序、分页和详情导航保持。共享实装列表只核对受影响状态，不重做设计。

## 验证层级

1. `tests/accountEntryState.test.mjs`：实际页面脚本及生产guard，受控响应与生命周期端口；覆盖阶段回执、失败恢复、迟到、身份及KeepAlive。不是DOM或SQL。`forumCoreState.test.mjs`现在执行实际guard配真实Vue watch，补同账号元数据刷新时成功／失败／重试及scope回归，避免脚本端口模拟掩盖此问题。
2. `tests/songShelvesHttp.test.mjs`：实际H3目录处理器／service，独立合成catalog文件，分别覆盖两类shelf、数字／字符串状态、搜索、分页、合法空态、读取失败和恢复；无SQL。
3. `tests/accountEntrySqlHttp.test.mjs`：复用现有私有MySQL启动器与真实H3／账号／工单／开发者SQL。实际 `SELECT DATABASE()=viewer_account_entry_test`、datadir归属和mutation opt-in在写入前验证。合成账号走实际注册、密码校验、会话刷新、重置、登出；工单正文／留言／关闭／跨账号拒绝；开发者申请／审批／Token掩码、v1授权属主与撤销、旧ETag／匿名／撤销Key拒绝。邮件为明确失败的受控transport，禁止SMTP/sendmail；这不是邮件投递成功验收。测试库退出后删除，仅保留无凭据观察记录。
4. `preview/song-detail/review/account_entries.py`：真实Nuxt路由／Vue／Element Plus、合成身份及受控transport，1440浅中／390浅中／414暗日；正常、读取失败／重试、合法空态、身份切换、迟到、验证码、注册及重置完成后的继续操作、分离的v1撤销范围、工单邮件状态、两类目录分别验收。全部导航只证明对应入口实际跳转，不冒充未列入本轮页面的业务验收。

未连接生产SQL、未复制真实用户数据。合成密码／Token仅在测试内存或临时隔离库中存在，不进入源码、截图、日志或报告。SQL使用控件外的真实权限拒绝；浏览器接受写操作使用受控响应，不把预览405当成功。生产主动业务写入为0，线上只用匿名只读检查。

## 可复跑预览

```sh
bash scripts/memory/run_qa.sh /usr/bin/env VIEWER_REVIEW_OUT=/var/tmp/account-entry-browser /usr/bin/python3 preview/song-detail/review/account_entries.py
bash scripts/memory/run_qa.sh /usr/bin/env TAIKO_ALLOW_TEST_DB_MUTATION=1 COMMUNITY_SQL_TEST_FILE=accountEntrySqlHttp.test.mjs VIEWER_REVIEW_OUT=/var/tmp/account-entry-sql /usr/bin/python3 preview/song-detail/review/community_sql.py
```

人工预览先安装锁定依赖；运行一次浏览器脚本会创建预览所需的本地软链及空dotenv文件。随后从工作区根启动（正常业务root不加载此后端）：

```sh
bash scripts/memory/run_dev.sh /usr/bin/env SONG_PREVIEW_SOURCE="$PWD/taiko_viewer" NUXT_TELEMETRY_DISABLED=1 /opt/taiko-viewer-runtime/node-v24.22.1-linux-x64/bin/node "$PWD/taiko_viewer/node_modules/@nuxt/cli/bin/nuxi.mjs" dev "$PWD/preview/song-detail" --host 127.0.0.1 --port 3208 --no-fork --dotenv "$PWD/preview/song-detail/.env.preview-empty"
```

入口示例：`http://127.0.0.1:3208/account/sync?previewState=entry-normal`；`entry-empty`／`entry-failure`／`entry-reviewer`分别为合法空、读取失败和合成审批人员。服务端默认拒绝业务写入，成功操作只由浏览器受控transport或明确隔离SQL验证。

原始前后截图、失败attempts、最终候选输入清单、测试／构建／CI／审查与受控发布结果位于仓库外 `/home/sigaer/taiko/qa-vault/evidence/viewer-entry-closeout-20261023`。最终通过数量和SHA以该目录的最终记录为准，不复制此前候选计数。预览没有生产配置或真实凭据。

`/more`与`/tools`功能验收不需要修改产品源码；本轮12个入口的功能验收与整体内容设计完成分别记录在唯一迁移表中。其余页面和1.0安全／恢复差距不扩大成本PR的无限前置条件。
