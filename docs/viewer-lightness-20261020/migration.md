# 全站迁移表

从实际 pages、布局和 route meta 逐项整理，共 73 个页面文件；不重复计入 `/my` 父包装组件。此表是唯一迁移清单。公共空间已适配，不等于深层内容重排完成。首批页面可独立收口，73 页深度改造不是发布前置条件。

普通默认 1000px；正文／主要表单 800px；密集数据 1180px。三者共用外围边距与组间／组内间距，均在侧栏右侧居中。通过现有 `definePageMeta({ contentLayout })` 选择例外，未设置即常规，不另建路由解析系统。手机共用 20px 页边距。独立 story、false 布局、播放器及后台保留明确例外。

| 实际页面路由 | 布局 | 公共空间 | 外壳 | 内容迁移 | 选择原因／剩余问题 | 截图入口 |
| --- | --- | --- | --- | --- | --- | --- |
| `/about` | default | 正文／表单 800 | 已适配 | 公共适配；内容未迁移 | 正文或主要表单；弹层不受容器限宽 | 未逐页截图 |
| `/account/annual-poster/:summaryId` | story | 专用 | 独立布局 | 独立内容未迁移 | 年度独立演出／分享画布，固定比例与视口保持 | 未逐页截图 |
| `/account/annual-share-card/:summaryId` | false | 专用 | 独立布局 | 独立内容未迁移 | 年度独立演出／分享画布，固定比例与视口保持 | 未逐页截图 |
| `/account/developer/grants` | default | 正文／表单 800 | 已适配 | 公共适配；内容未迁移 | 正文或主要表单；弹层不受容器限宽 | 未逐页截图 |
| `/account/developer` | default | 正文／表单 800 | 已适配 | 公共适配；内容未迁移 | 正文或主要表单；弹层不受容器限宽 | 未逐页截图 |
| `/account/developer/review` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 权限审核数据表 | 未逐页截图 |
| `/account/forgot-password` | default | 正文／表单 800 | 已适配 | 公共适配；内容未迁移 | 正文或主要表单；弹层不受容器限宽 | 未逐页截图 |
| `/account` | default | 常规 1000 | 已适配 | 公共适配；内容未迁移 | 既有跳转／路由入口；使用目的页面的空间规则 | 未逐页截图 |
| `/account/login` | default | 正文／表单 800 | 已适配 | 公共适配；内容未迁移 | 正文或主要表单；弹层不受容器限宽 | 未逐页截图 |
| `/account/profile` | default | 正文／表单 800 | 已适配 | 首批完成 | 短面板自然结束；当前使用为状态；头像操作按需展开；原异步脚本不变 | [414](content-refinement-20261020/screenshots/after-profile-414-light-zh.png) · [1440 暗色日文](content-refinement-20261020/screenshots/after-profile-1440-dark-ja.png) |
| `/account/register` | default | 正文／表单 800 | 已适配 | 公共适配；内容未迁移 | 正文或主要表单；弹层不受容器限宽 | 未逐页截图 |
| `/account/songs` | default | 密集 1180 | 已适配 | 本批内容完成 | 绑定及来源 → 搜索／难度与次要管理 → 成绩 → 分页；桌面对照表、手机逐条展开判定与管理；身份切换隐藏旧结果 | [第二批证据](../viewer-ui-batch2-20261021/README.md) |
| `/account/support/review` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 支持记录及处理面板 | 未逐页截图 |
| `/account/sync` | default | 正文／表单 800 | 已适配 | 公共适配；内容未迁移 | 正文或主要表单；弹层不受容器限宽 | 未逐页截图 |
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
| `/forum/discussions` | default | 常规 1000 | 已适配 | 公共适配；内容未迁移 | 普通概览、列表或导航；无需占满右侧区域 | 未逐页截图 |
| `/forum` | default | 常规 1000 | 已适配 | 公共适配；内容未迁移 | 补验 16 条合成 DTO，现有首页上限显示 12 条；徽章及卡片主次仍待后续整理 | [414](content-refinement-20261020/screenshots/after-community-414-light-zh.png) · [1440 暗色日文](content-refinement-20261020/screenshots/after-community-1440-dark-ja.png) |
| `/forum/me` | default | 常规 1000 | 已适配 | 公共适配；内容未迁移 | 普通概览、列表或导航；无需占满右侧区域 | 未逐页截图 |
| `/forum/new` | default | 正文／表单 800 | 已适配 | 公共适配；内容未迁移 | 发帖主表单 | 未逐页截图 |
| `/forum/notifications` | default | 常规 1000 | 已适配 | 公共适配；内容未迁移 | 普通概览、列表或导航；无需占满右侧区域 | 未逐页截图 |
| `/forum/section/:slug` | default | 常规 1000 | 已适配 | 公共适配；内容未迁移 | 普通概览、列表或导航；无需占满右侧区域 | 未逐页截图 |
| `/forum/thread/:id` | default | 正文／表单 800 | 已适配 | 公共适配；内容未迁移 | 长帖、回复与编辑器共享正文边界 | 未逐页截图 |
| `/grade/2023` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 多列课题／分析数据或固定比例图表 | 未逐页截图 |
| `/grade/2024` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 多列课题／分析数据或固定比例图表 | 未逐页截图 |
| `/grade/2025/:grade` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 多列课题／分析数据或固定比例图表 | 未逐页截图 |
| `/grade/2025` | default | 常规 1000 | 已适配 | 公共适配；内容未迁移 | 普通概览、列表或导航；无需占满右侧区域 | 未逐页截图 |
| `/grade/2026/:grade` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 多列课题／分析数据或固定比例图表 | 未逐页截图 |
| `/grade/2026` | default | 常规 1000 | 已适配 | 公共适配；内容未迁移 | 普通概览、列表或导航；无需占满右侧区域 | 未逐页截图 |
| `/grade` | default | 常规 1000 | 已适配 | 公共适配；内容未迁移 | 普通概览、列表或导航；无需占满右侧区域 | 未逐页截图 |
| `/guide/:difficulty/:level` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 多列课题／分析数据或固定比例图表 | 未逐页截图 |
| `/guide` | default | 常规 1000 | 已适配 | 公共适配；内容未迁移 | 普通概览、列表或导航；无需占满右侧区域 | 未逐页截图 |
| `/` | default | 常规 1000 | 已适配 | 内容局部迁移 | 单次个人上下文；能力详情折叠；未知记录与读取失败分开；真实目标及深度内容后续 | [414](content-refinement-20261020/screenshots/after-home-414-light-zh.png) · [1440 暗色日文](content-refinement-20261020/screenshots/after-home-1440-dark-ja.png) |
| `/more` | default | 常规 1000 | 已适配 | 公共适配；内容未迁移 | 普通概览、列表或导航；无需占满右侧区域 | 未逐页截图 |
| `/my/growth` | default | 常规 1000 | 已适配 | 公共适配；内容未迁移 | 普通概览、列表或导航；无需占满右侧区域 | [414](screenshots/after-growth-414-light-zh.png) · [1440 暗色](screenshots/after-growth-1440-dark-ja.png) |
| `/my` | default | 常规 1000 | 已适配 | 公共适配；内容未迁移 | 普通概览、列表或导航；无需占满右侧区域 | 未逐页截图 |
| `/my/weekly` | default | 正文／表单 800 | 已适配 | 公共适配；内容未迁移 | 周报叙事与事实阅读 | [414](screenshots/after-weekly-414-light-zh.png) · [1440 暗色](screenshots/after-weekly-1440-dark-ja.png) |
| `/ourtaikoview/:id/:difficulty` | default | 专用 | 专用例外 | 播放器未改 | 播放器自有画布、全屏与展开视口；隐藏普通底栏 | 未逐页截图 |
| `/settings` | default | 常规 1000 | 已适配 | 本次内容收口完成 | 单行主题切换；缓存摘要与按需明细；清空仍清除全部 localStorage | [414](content-refinement-20261020/screenshots/after-settings-414-light-zh.png) · [1440 暗色日文](content-refinement-20261020/screenshots/after-settings-1440-dark-ja.png) |
| `/songs/:id` | default | 密集 1180 | 已适配 | 首批完成并补验 | 真实谱面节选含音符与小节；成绩完成态、明细与空讨论核对 | [414](content-refinement-20261020/screenshots/after-song-414-light-zh.png) · [1440 暗色日文](content-refinement-20261020/screenshots/after-song-1440-dark-ja.png) |
| `/songs/available` | default | 常规 1000 | 已适配 | 首批完成 | 两列紧凑对象行；名称统一为实装歌曲；使用静态五难度图标 | [414](content-refinement-20261020/screenshots/after-catalog-414-light-zh.png) · [1440 暗色日文](content-refinement-20261020/screenshots/after-catalog-1440-dark-ja.png) |
| `/songs` | default | 常规 1000 | 已适配 | 公共适配；内容未迁移 | 既有跳转／路由入口；使用目的页面的空间规则 | 未逐页截图 |
| `/songs/other` | default | 常规 1000 | 已适配 | 复用列表组件；分类状态待验 | 共享两列对象行与五难度图标；具体分类内容未逐项收口 | 共享组件见实装歌曲；本路由未单独截图 |
| `/songs/removed` | default | 常规 1000 | 已适配 | 复用列表组件；分类状态待验 | 共享两列对象行与五难度图标；具体分类内容未逐项收口 | 共享组件见实装歌曲；本路由未单独截图 |
| `/songs/v2-constants` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 多列定数表 | 未逐页截图 |
| `/support` | default | 常规 1000 | 已适配 | 公共适配；内容未迁移 | 普通概览、列表或导航；无需占满右侧区域 | 未逐页截图 |
| `/titles` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 称号数据列表 | 未逐页截图 |
| `/tools/b30` | default | 密集 1180 | 已适配 | 本批内容完成 | 紧凑参数与状态；结果绑定生成时条件，参数变化清图并取消迟到响应；原 Top N／维度／原点及生成能力保留 | [第二批证据](../viewer-ui-batch2-20261021/README.md) |
| `/tools/chart-config` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 多列课题／分析数据或固定比例图表 | 未逐页截图 |
| `/tools` | default | 常规 1000 | 已适配 | 公共适配；内容未迁移 | 普通概览、列表或导航；无需占满右侧区域 | 未逐页截图 |
| `/tools/note-count` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 多列课题／分析数据或固定比例图表 | 未逐页截图 |
| `/tools/progress` | default | 密集 1180 | 已适配 | 本批内容完成 | 四类参数与结果／页码／下载；选项失败、空选项、生成失败分开，可重试；异步翻译上下文异常已修复 | [第二批证据](../viewer-ui-batch2-20261021/README.md) |
| `/tools/recommend` | default | 常规 1000 | 已适配 | 普通推荐完成并复核 | 保留筛选、20 条结果与行密度；目标及来源限制不变 | [414](content-refinement-20261020/screenshots/after-recommend-414-light-zh.png) · [1440 暗色日文](content-refinement-20261020/screenshots/after-recommend-1440-dark-ja.png) |
| `/tools/trend` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 多列课题／分析数据或固定比例图表 | 未逐页截图 |
| `/tools/word-cloud` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 多列课题／分析数据或固定比例图表 | 未逐页截图 |

本批成绩／B30／进度已完成。后续内容顺序：成长／周报 → 首页与 My Taiko 真实状态 → 社区／开发者／设置／帮助及其他入口。空间规则已全站应用，这个顺序不再表示等待接入公共容器。管理后台仅兼容，不扩展运营流程。

年度入口使用普通表单空间，独立演出、时间线和分享图不套内容容器。播放器保留原 1440px 自有工作区、iframe 固定比例和全屏行为；普通公共容器不限制其画布。

历史首批预览的社区为合成空社区，成长／周报为有限历史。第二批进度预览现有完整合成选项、与条件相符的固定样图、合法空选项及请求失败响应；历史异步错误已复现并修复，详见第二批证据。后台仅独立登录入口外观初检，不声称运营和认证生命周期已验证。中日文截图均为 Linux Chromium 模拟视口，不代表真实设备。
