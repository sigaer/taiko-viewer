# 全站迁移表

从实际 pages、布局和 route meta 逐项整理，共 73 个页面文件；不重复计入 `/my` 父包装组件。此表是唯一迁移清单。公共空间已适配，不等于深层内容重排完成。

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
| `/account/profile` | default | 正文／表单 800 | 已适配 | 完成 | 绑定主表单与身份摘要；保护处理器保留 | [414](screenshots/after-profile-414-light-zh.png) · [1440 暗色](screenshots/after-profile-1440-dark-ja.png) |
| `/account/register` | default | 正文／表单 800 | 已适配 | 公共适配；内容未迁移 | 正文或主要表单；弹层不受容器限宽 | 未逐页截图 |
| `/account/songs` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 多列成绩表；表格自身横向滚动 | [414](screenshots/after-scores-414-light-zh.png) · [1440 暗色](screenshots/after-scores-1440-dark-ja.png) |
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
| `/docs/score-token` | default | 正文／表单 800 | 已适配 | 公共适配；内容未迁移 | 指南正文；代码块自身横向滚动 | [414](screenshots/after-developer-414-light-zh.png) · [1440 暗色](screenshots/after-developer-1440-dark-ja.png) |
| `/forum/discussions` | default | 常规 1000 | 已适配 | 公共适配；内容未迁移 | 普通概览、列表或导航；无需占满右侧区域 | 未逐页截图 |
| `/forum` | default | 常规 1000 | 已适配 | 公共适配；内容未迁移 | 普通概览、列表或导航；无需占满右侧区域 | [414](screenshots/after-community-414-light-zh.png) · [1440 暗色](screenshots/after-community-1440-dark-ja.png) |
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
| `` | default | 常规 1000 | 已适配 | 空间、网格及语义色完成；内容待续 | 普通概览、列表或导航；无需占满右侧区域 | [414](screenshots/after-home-414-light-zh.png) · [1440 暗色](screenshots/after-home-1440-dark-ja.png) |
| `/more` | default | 常规 1000 | 已适配 | 公共适配；内容未迁移 | 普通概览、列表或导航；无需占满右侧区域 | 未逐页截图 |
| `/my/growth` | default | 常规 1000 | 已适配 | 公共适配；内容未迁移 | 普通概览、列表或导航；无需占满右侧区域 | [414](screenshots/after-growth-414-light-zh.png) · [1440 暗色](screenshots/after-growth-1440-dark-ja.png) |
| `/my` | default | 常规 1000 | 已适配 | 公共适配；内容未迁移 | 普通概览、列表或导航；无需占满右侧区域 | 未逐页截图 |
| `/my/weekly` | default | 正文／表单 800 | 已适配 | 公共适配；内容未迁移 | 周报叙事与事实阅读 | [414](screenshots/after-weekly-414-light-zh.png) · [1440 暗色](screenshots/after-weekly-1440-dark-ja.png) |
| `/ourtaikoview/:id/:difficulty` | default | 专用 | 专用例外 | 播放器未改 | 播放器自有画布、全屏与展开视口；隐藏普通底栏 | 未逐页截图 |
| `/settings` | default | 常规 1000 | 已适配 | 公共适配；内容未迁移 | 普通概览、列表或导航；无需占满右侧区域 | [414](screenshots/after-settings-414-light-zh.png) · [1440 暗色](screenshots/after-settings-1440-dark-ja.png) |
| `/songs/:id` | default | 密集 1180 | 已适配 | 完成 | 真实谱面及成绩侧栏；图片比例不变 | [414](screenshots/after-song-414-light-zh.png) · [1440 暗色](screenshots/after-song-1440-dark-ja.png) |
| `/songs/available` | default | 常规 1000 | 已适配 | 完成 | 普通概览、列表或导航；无需占满右侧区域 | [414](screenshots/after-catalog-414-light-zh.png) · [1440 暗色](screenshots/after-catalog-1440-dark-ja.png) |
| `/songs` | default | 常规 1000 | 已适配 | 公共适配；内容未迁移 | 既有跳转／路由入口；使用目的页面的空间规则 | 未逐页截图 |
| `/songs/other` | default | 常规 1000 | 已适配 | 完成 | 普通概览、列表或导航；无需占满右侧区域 | [414](screenshots/after-catalog-414-light-zh.png) · [1440 暗色](screenshots/after-catalog-1440-dark-ja.png) |
| `/songs/removed` | default | 常规 1000 | 已适配 | 完成 | 普通概览、列表或导航；无需占满右侧区域 | [414](screenshots/after-catalog-414-light-zh.png) · [1440 暗色](screenshots/after-catalog-1440-dark-ja.png) |
| `/songs/v2-constants` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 多列定数表 | 未逐页截图 |
| `/support` | default | 常规 1000 | 已适配 | 公共适配；内容未迁移 | 普通概览、列表或导航；无需占满右侧区域 | 未逐页截图 |
| `/titles` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 称号数据列表 | 未逐页截图 |
| `/tools/b30` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 多列课题／分析数据或固定比例图表 | [414](screenshots/after-b30-414-light-zh.png) · [1440 暗色](screenshots/after-b30-1440-dark-ja.png) |
| `/tools/chart-config` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 多列课题／分析数据或固定比例图表 | 未逐页截图 |
| `/tools` | default | 常规 1000 | 已适配 | 公共适配；内容未迁移 | 普通概览、列表或导航；无需占满右侧区域 | 未逐页截图 |
| `/tools/note-count` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 多列课题／分析数据或固定比例图表 | 未逐页截图 |
| `/tools/progress` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 多列课题／分析数据或固定比例图表 | [414](screenshots/after-progress-414-light-zh.png) · [1440 暗色](screenshots/after-progress-1440-dark-ja.png) |
| `/tools/recommend` | default | 常规 1000 | 已适配 | 普通推荐完成 | 普通概览、列表或导航；无需占满右侧区域 | [414](screenshots/after-recommend-414-light-zh.png) · [1440 暗色](screenshots/after-recommend-1440-dark-ja.png) |
| `/tools/trend` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 多列课题／分析数据或固定比例图表 | 未逐页截图 |
| `/tools/word-cloud` | default | 密集 1180 | 已适配 | 公共适配；内容未迁移 | 多列课题／分析数据或固定比例图表 | 未逐页截图 |

后续内容顺序：成绩／B30／进度／成长／周报 → 首页与 My Taiko 真实状态 → 社区／开发者／设置／帮助及其他入口。空间规则已全站应用，这个顺序不再表示等待接入公共容器。管理后台仅兼容，不扩展运营流程。

年度入口使用普通表单空间，独立演出、时间线和分享图不套内容容器。播放器保留原 1440px 自有工作区、iframe 固定比例和全屏行为；普通公共容器不限制其画布。

预览社区为合成空社区，成长／周报为有限历史；进度为合法空选项，未生成图像，其既有失败处理异常另记。后台仅独立登录入口外观初检，不声称运营和认证生命周期已验证。中日文截图均为 Linux Chromium 模拟视口，不代表真实设备。
