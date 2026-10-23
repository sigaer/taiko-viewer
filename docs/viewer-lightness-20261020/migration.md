# 全站迁移表

从实际 pages、布局和 route meta 逐项整理，共 73 个页面文件；不重复计入 `/my` 父包装组件。此表是唯一迁移清单。公共空间已适配，不等于深层内容重排完成。首批页面可独立收口，73 页深度改造不是发布前置条件。

普通默认 1000px；正文／主要表单 800px；密集数据 1180px。三者共用外围边距与组间／组内间距，均在侧栏右侧居中。通过现有 `definePageMeta({ contentLayout })` 选择例外，未设置即常规，不另建路由解析系统。手机共用 20px 页边距。独立 story、false 布局、播放器及后台保留明确例外。

| 实际页面路由 | 布局 | 公共空间 | 外壳 | 内容迁移 | 选择原因／剩余问题 | 截图入口 |
| --- | --- | --- | --- | --- | --- | --- |
| `/about` | default | 正文／表单 800 | 已适配 | 公共适配；内容未迁移 | 正文或主要表单；弹层不受容器限宽 | 未逐页截图 |
| `/account/annual-poster/:summaryId` | story | 专用 | 独立布局 | 独立内容未迁移 | 年度独立演出／分享画布，固定比例与视口保持 | 未逐页截图 |
| `/account/annual-share-card/:summaryId` | false | 专用 | 独立布局 | 独立内容未迁移 | 年度独立演出／分享画布，固定比例与视口保持 | 未逐页截图 |
| `/account/developer/grants` | default | 正文／表单 800 | 已适配 | 功能验收收口；整体内容未重做 | 既有v1授权／撤销、身份和缓存返回保护；不影响旧Developer Token | [账号／常用入口验收](../account-entry-closeout-20261023.md) |
| `/account/developer` | default | 正文／表单 800 | 已适配 | 功能验收收口；整体内容未重做 | 申请状态失败可重试；入库后通知失败重新读状态；旧Token掩码与独立v1说明保留 | [账号／常用入口验收](../account-entry-closeout-20261023.md) |
| `/account/developer/review` | default | 密集 1180 | 已适配 | 功能验收收口；整体内容未重做 | 审批权限拒绝与读取失败分开；提示／异步回执受当前身份保护 | [账号／常用入口验收](../account-entry-closeout-20261023.md) |
| `/account/forgot-password` | default | 正文／表单 800 | 已适配 | 功能验收收口；整体内容未重做 | 邮箱语义、验证码／失败恢复；重置完成后只重试打开登录页 | [账号／常用入口验收](../account-entry-closeout-20261023.md) |
| `/account` | default | 常规 1000 | 已适配 | 公共适配；内容未迁移 | 既有跳转／路由入口；使用目的页面的空间规则 | 未逐页截图 |
| `/account/login` | default | 正文／表单 800 | 已适配 | 功能验收收口；整体内容未重做 | 0.87.8仅记住账号已独立发布；会话／导航重试不重复登录，内部返回目标与认证失败恢复 | [账号／常用入口验收](../account-entry-closeout-20261023.md) |
| `/account/profile` | default | 正文／表单 800 | 已适配 | 首批完成 | 短面板自然结束；当前使用为状态；头像操作按需展开；原异步脚本不变 | [414](content-refinement-20261020/screenshots/after-profile-414-light-zh.png) · [1440 暗色日文](content-refinement-20261020/screenshots/after-profile-1440-dark-ja.png) |
| `/account/register` | default | 正文／表单 800 | 已适配 | 功能验收收口；整体内容未重做 | 已创建与自动登录分开重试；验证码忙碌／冷却／迟到保护；不持久化密码 | [账号／常用入口验收](../account-entry-closeout-20261023.md) |
| `/account/songs` | default | 密集 1180 | 已适配 | 本批内容完成 | 绑定及来源 → 搜索／难度与次要管理 → 成绩 → 分页；桌面对照表、手机逐条展开判定与管理；身份切换隐藏旧结果；本批附修 414px 中日文完整分页分组 | [第二批证据](../viewer-ui-batch2-20261021/README.md) |
| `/account/support/review` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 支持记录及处理面板 | 未逐页截图 |
| `/account/sync` | default | 正文／表单 800 | 已适配 | 功能验收收口；整体内容未重做 | 概览失败与未绑定区分；Source／目标／冷却／结果／Token保留；身份／绑定／迟到及首页返回 | [账号／常用入口验收](../account-entry-closeout-20261023.md) |
| `/account/version-summary` | story | 专用 | 独立布局 | 独立内容未迁移 | 年度独立演出／分享画布，固定比例与视口保持 | 未逐页截图 |
| `/admin/taiko/aliases` | admin-taiko | 后台专用 | 根级变量兼容 | 未迁移 | 运营布局保持；仅公共变量兼容 | 未逐页截图 |
| `/admin/taiko/annual-beta` | admin-taiko | 后台专用 | 根级变量兼容 | 未迁移 | 运营布局保持；仅公共变量兼容 | 未逐页截图 |
| `/admin/taiko/annual-summaries/:summaryId` | story | 后台专用 | 根级变量兼容 | 未迁移 | 运营布局保持；仅公共变量兼容 | 未逐页截图 |
| `/admin/taiko/annual-summaries/preview-:taikoId` | story | 后台专用 | 根级变量兼容 | 未迁移 | 运营布局保持；仅公共变量兼容 | 未逐页截图 |
| `/admin/taiko/annual-summaries` | admin-taiko | 后台专用 | 根级变量兼容 | 未迁移 | 运营布局保持；仅公共变量兼容 | 未逐页截图 |
| `/admin/taiko/audit` | admin-taiko | 后台专用 | 根级变量兼容 | 未迁移 | 运营布局保持；仅公共变量兼容 | 未逐页截图 |
| `/admin/taiko/chart-ugc` | admin-taiko | 后台专用 | 根级变量兼容 | 未迁移 | 运营布局保持；仅公共变量兼容 | 未逐页截图 |
| `/admin/taiko/covers` | admin-taiko | 后台专用 | 根级变量兼容 | 未迁移 | 运营布局保持；仅公共变量兼容 | 未逐页截图 |
| `/admin/taiko/custom-titles` | admin-taiko | 后台专用 | 根级变量兼容 | 未迁移 | 运营布局保持；仅公共变量兼容 | 未逐页截图 |
| `/admin/taiko/dashboard` | admin-taiko | 后台专用 | 根级变量兼容 | 未迁移 | 运营布局保持；仅公共变量兼容 | 未逐页截图 |
| `/admin/taiko/draw-guess` | admin-taiko | 后台专用 | 根级变量兼容 | 未迁移 | 运营布局保持；仅公共变量兼容 | 未逐页截图 |
| `/admin/taiko/guides` | admin-taiko | 后台专用 | 根级变量兼容 | 未迁移 | 运营布局保持；仅公共变量兼容 | 未逐页截图 |
| `/admin/taiko` | default | 后台专用 | 根级变量兼容 | 未迁移 | 运营布局保持；仅公共变量兼容 | 未逐页截图 |
| `/admin/taiko/login` | false | 后台专用 | 根级变量兼容 | 未迁移 | 运营布局保持；仅公共变量兼容 | [414](screenshots/after-admin-login-414-light-zh.png) · [1440 暗色](screenshots/after-admin-login-1440-dark-ja.png) |
| `/admin/taiko/songs` | admin-taiko | 后台专用 | 根级变量兼容 | 未迁移 | 运营布局保持；仅公共变量兼容 | 未逐页截图 |
| `/alias-log` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 变更数据表 | 未逐页截图 |
| `/annual/share/:token` | story | 专用 | 独立布局 | 独立内容未迁移 | 年度独立演出／分享画布，固定比例与视口保持 | 未逐页截图 |
| `/annual` | default | 正文／表单 800 | 已适配 | 公共适配；内容未迁移 | 年度入口表单，独立报告另列 | [414](screenshots/after-annual-414-light-zh.png) · [1440 暗色](screenshots/after-annual-1440-dark-ja.png) |
| `/docs/score-token` | default | 正文／表单 800 | 已适配 | 本指南内容收口完成 | 公共标题唯一；安全说明、字段及调用示例保留；其他开发者入口未深改 | [414](content-refinement-20261020/screenshots/after-developer-414-light-zh.png) · [1440 暗色日文](content-refinement-20261020/screenshots/after-developer-1440-dark-ja.png) |
| `/forum/discussions` | default | 常规 1000 | 已适配 | 核心功能链路已验收；整体内容设计未重做 | 共享列表搜索应用／排序／分页与歌曲难度URL恢复，失败／重试／身份保护 | [0.87.7 功能验收](../community-core-closeout-20261023.md) |
| `/forum` | default | 常规 1000 | 已适配 | 核心功能链路已验收；整体内容设计未重做 | 最新真实排序／四筛选与完整列表导航，URL历史与未读缓存；未重做视觉设计 | [0.87.7 功能验收](../community-core-closeout-20261023.md) |
| `/forum/me` | default | 常规 1000 | 已适配 | 核心功能链路已验收；整体内容设计未重做 | 摘要与帖子分段错误／加载／重试、实际总数分页、身份隔离、管理员拒绝与恢复 | [0.87.7 功能验收](../community-core-closeout-20261023.md) |
| `/forum/new` | default | 正文／表单 800 | 已适配 | 状态修复已验收；整体内容迁移另行安排 | 失败保留可编辑原稿、创建回执与打开重试分离、上传／身份／KeepAlive 保护；真实页面及隔离持久化链路 | [0.87.6 修复验收](../community-state-fixes-20261022.md) |
| `/forum/notifications` | default | 常规 1000 | 已适配 | 状态修复已验收；整体内容迁移另行安排 | 读取失败／空态／重试、20 条分页、单条与全部已读互斥、导航失败恢复及身份／KeepAlive 保护 | [0.87.6 修复验收](../community-state-fixes-20261022.md) |
| `/forum/section/:slug` | default | 常规 1000 | 已适配 | 核心功能链路已验收；整体内容设计未重做 | 共享列表版块限定／URL历史／新帖来源；失败与空态分开 | [0.87.7 功能验收](../community-core-closeout-20261023.md) |
| `/forum/thread/:id` | default | 正文／表单 800 | 已适配 | 核心功能链路已验收；整体内容设计未重做 | 阅读／定向回复／点赞／上传／图片查看／锁帖／屏蔽折叠；身份和迟到保护 | [0.87.7 功能验收](../community-core-closeout-20261023.md) |
| `/grade/2023` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 多列课题／分析数据或固定比例图表 | 未逐页截图 |
| `/grade/2024` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 多列课题／分析数据或固定比例图表 | 未逐页截图 |
| `/grade/2025/:grade` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 多列课题／分析数据或固定比例图表 | 未逐页截图 |
| `/grade/2025` | default | 常规 1000 | 已适配 | 公共适配；内容未迁移 | 普通概览、列表或导航；无需占满右侧区域 | 未逐页截图 |
| `/grade/2026/:grade` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 多列课题／分析数据或固定比例图表 | 未逐页截图 |
| `/grade/2026` | default | 常规 1000 | 已适配 | 公共适配；内容未迁移 | 普通概览、列表或导航；无需占满右侧区域 | 未逐页截图 |
| `/grade` | default | 常规 1000 | 已适配 | 公共适配；内容未迁移 | 普通概览、列表或导航；无需占满右侧区域 | 未逐页截图 |
| `/guide/:difficulty/:level` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 多列课题／分析数据或固定比例图表 | 未逐页截图 |
| `/guide` | default | 常规 1000 | 已适配 | 公共适配；内容未迁移 | 普通概览、列表或导航；无需占满右侧区域 | 未逐页截图 |
| `/` | default | 常规 1000 | 已适配 | 本批深层状态收口完成 | 游客／未绑定／无有效成绩／就绪、分阶段错误与重试；账号／绑定／同步返回与 KeepAlive 恢复，概览与近期独立失败；共享歌曲条目直接复用，目标及近期确认受控验证 | [0.87.5 证据](../viewer-home-my-states-20261021/README.md) |
| `/more` | default | 常规 1000 | 已适配 | 功能验收收口；整体内容未重做 | 13个原有入口及语言／版本导航验收；产品源码无需修改，未重排内容 | [账号／常用入口验收](../account-entry-closeout-20261023.md) |
| `/my/growth` | default | 常规 1000 | 已适配 | 本批内容完成 | 当前状态与范围 → 四周期／六维冻结趋势 → 成长事实 → 关注方向历史／目标与下一步；缺失数值与观察日期明确 | [成长／周报证据](../viewer-growth-weekly-20261021/README.md) |
| `/my` | default | 常规 1000 | 已适配 | 本批九入口内容完成 | 三组紧凑导航；初始加载、游客、已登录、认证失败及强制重试分开，九路由保留；不启用 Overview admission 或新读模型 | [0.87.5 证据](../viewer-home-my-states-20261021/README.md) |
| `/my/weekly` | default | 正文／表单 800 | 已适配 | 本批内容完成 | 服务端周日期／事实汇总 → 具体变化 → 可比较能力 → 当前建议；身份、绑定、周次及迟到响应隔离 | [成长／周报证据](../viewer-growth-weekly-20261021/README.md) |
| `/ourtaikoview/:id/:difficulty` | default | 专用 | 专用例外 | 播放器未改 | 播放器自有画布、全屏与展开视口；隐藏普通底栏 | 未逐页截图 |
| `/settings` | default | 常规 1000 | 已适配 | 本次内容收口完成 | 单行主题切换；缓存摘要与按需明细；清空仍清除全部 localStorage | [414](content-refinement-20261020/screenshots/after-settings-414-light-zh.png) · [1440 暗色日文](content-refinement-20261020/screenshots/after-settings-1440-dark-ja.png) |
| `/songs/:id` | default | 密集 1180 | 已适配 | 首批完成并补验 | 真实谱面节选含音符与小节；成绩完成态、明细与空讨论核对 | [414](content-refinement-20261020/screenshots/after-song-414-light-zh.png) · [1440 暗色日文](content-refinement-20261020/screenshots/after-song-1440-dark-ja.png) |
| `/songs/available` | default | 常规 1000 | 已适配 | 首批完成 | 两列紧凑对象行；名称统一为实装歌曲；使用静态五难度图标 | [414](content-refinement-20261020/screenshots/after-catalog-414-light-zh.png) · [1440 暗色日文](content-refinement-20261020/screenshots/after-catalog-1440-dark-ja.png) |
| `/songs` | default | 常规 1000 | 已适配 | 公共适配；内容未迁移 | 既有跳转／路由入口；使用目的页面的空间规则 | 未逐页截图 |
| `/songs/other` | default | 常规 1000 | 已适配 | 功能验收收口；整体内容未重做 | 独立shelfStatus=2分类、搜索／继续加载／空态／读取失败恢复；共享列表空白修复 | [账号／常用入口验收](../account-entry-closeout-20261023.md) |
| `/songs/removed` | default | 常规 1000 | 已适配 | 功能验收收口；整体内容未重做 | 独立shelfStatus=1分类、搜索／继续加载／空态／读取失败恢复；共享列表空白修复 | [账号／常用入口验收](../account-entry-closeout-20261023.md) |
| `/songs/v2-constants` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 多列定数表 | 未逐页截图 |
| `/support` | default | 常规 1000 | 已适配 | 功能验收收口；整体内容未重做 | 历史／详情失败和重试、身份隔离、保存与邮件分开；既有关闭状态及权限 | [账号／常用入口验收](../account-entry-closeout-20261023.md) |
| `/titles` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 称号数据列表 | 未逐页截图 |
| `/tools/b30` | default | 密集 1180 | 已适配 | 本批内容完成 | 紧凑参数与状态；结果绑定生成时条件，参数变化清图并取消迟到响应；原 Top N／维度／原点及生成能力保留 | [第二批证据](../viewer-ui-batch2-20261021/README.md) |
| `/tools/chart-config` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 多列课题／分析数据或固定比例图表 | 未逐页截图 |
| `/tools` | default | 常规 1000 | 已适配 | 功能验收收口；整体内容未重做 | 7个原有工具导航及登录标签验收；产品源码无需修改，未重排内容 | [账号／常用入口验收](../account-entry-closeout-20261023.md) |
| `/tools/note-count` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 多列课题／分析数据或固定比例图表 | 未逐页截图 |
| `/tools/progress` | default | 密集 1180 | 已适配 | 本批内容完成 | 四类参数与结果／页码／下载；选项失败、空选项、生成失败分开，可重试；异步翻译上下文异常已修复 | [第二批证据](../viewer-ui-batch2-20261021/README.md) |
| `/tools/recommend` | default | 常规 1000 | 已适配 | 普通推荐完成并复核 | 本批与首页今日推荐共享歌曲行；保留筛选、20 条结果与标签，难度／凭据／目标来源限制不变，目标 tab 不变 | [414](content-refinement-20261020/screenshots/after-recommend-414-light-zh.png) · [1440 暗色日文](content-refinement-20261020/screenshots/after-recommend-1440-dark-ja.png) |
| `/tools/trend` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 多列课题／分析数据或固定比例图表 | 未逐页截图 |
| `/tools/word-cloud` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 多列课题／分析数据或固定比例图表 | 未逐页截图 |

第二批成绩／B30／进度及成长／周报内容已完成；成绩分页附修见成长／周报证据。首页深层状态与 My Taiko 九入口已在 0.87.5 收口；后续内容顺序：社区／开发者／设置／帮助及其他入口。空间规则已全站应用，这个顺序不再表示等待接入公共容器。管理后台仅兼容，不扩展运营流程。

年度入口使用普通表单空间，独立演出、时间线和分享图不套内容容器。播放器保留原 1440px 自有工作区、iframe 固定比例和全屏行为；普通公共容器不限制其画布。

历史首批预览的社区为合成空社区，成长／周报仅为有限历史，不能作为本批完成证据。本批成长／周报使用完整合成 DTO 驱动真实 Vue／SVG，独立覆盖周期、维度、身份、错误与覆盖状态，见成长／周报证据。第二批进度预览现有完整合成选项、与条件相符的固定样图、合法空选项及请求失败响应；历史异步错误已复现并修复，详见第二批证据。后台仅独立登录入口外观初检，不声称运营和认证生命周期已验证。中日文截图均为 Linux Chromium 模拟视口，不代表真实设备。

首页＋My Taiko 批次先在 0.87.4 完成[共享歌曲条目增量](../viewer-home-my-20261021/README.md)，现于 0.87.5 完成[首页深层状态及现有九入口收口](../viewer-home-my-states-20261021/README.md)。这不表示启用新的 My Taiko Overview 读模型，也不表示其他页面完成。
