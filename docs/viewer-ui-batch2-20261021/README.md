# Viewer 第二批 UI：成绩、B30、进度

基线为远程 main `ad260fd`（0.87.1 / PR #28）。独立分支 `design/viewer-ui-batch2-20261021`；保留原设计工作区与备份。本轮为兼容 UX 修正，发布准备版本 0.87.2，未改变 API、Contract、权限、数据计算或图像内部排版。

| 页面 | 实际代码与行为 |
| --- | --- |
| 成绩 | `pages/account/songs.vue`、`components/account/AccountSongEditorDialog.vue`、`AccountScoreImportDialog.vue`、`composables/useAccountRequestGuard.ts`。绑定和来源在前；搜索为主、管理次之；桌面对照表和内部滚动，手机成绩行与详情展开；所有原处理器、确认和字段保留。加载和失败不冒充空数据，切换身份清除旧结果和弹层，迟到的完成回调失效。 |
| B30 | `pages/tools/b30.vue`、`composables/useToolChartResult.ts`、`useToolChartImage.ts`。保留 Top N 1–50、维度、动态原点和请求参数；紧凑参数、明确状态、结果参数摘要、原比例图片与完整尺寸入口。条件变化取消请求并清除旧图；重新生成失败不展示上次图。 |
| 进度 | `pages/tools/progress.vue`、`composables/useProgressOptions.ts`及上述图片 composable。段位、定数、星级、全良难度的选项与分页保留；当前条件、页码、下载放在图片前。选项加载、失败、合法空值和图片生成分别反馈，重试不需刷新。 |

普通 1000px／密集 1180px／正文 800px、手机 20px、公共浅暗色值和导航没有调整。三个页面继续使用原路由及真实 Nuxt 入口，没有另一套原型。

历史问题在冻结基线的真实进度页使用选项 503 复现，浏览器记录 `Must be called at the top of a setup function`。原因是异步 catch 未传入 translator，`resolveViewerError()` 回退调用 `useI18n()`。新 composable 在 setup 捕获 `t` 并显式传入；工具图片 Blob 错误路径同样修正。回归实际验证失败信息可见、loading 退出、重试恢复选项和结果，另覆盖迟到错误、绑定切换及卸载。合法空选项独立验证，不能代替失败路径。

可运行预览与复跑命令见 [预览 README](../../preview/song-detail/README.md) 的第二批部分；`/__batch2` 提供真实页面入口及同输入前后图。固定样图明确注明 synthetic，仅用于页面和参数匹配验证，不代表后台图像计算结果。真实账号、成绩、绑定和目标写入为 0。编辑、导入、锁定及删除确认的成功／失败／身份保护属于真实组件与可控响应验证层，未宣称生产写入成功。

原始截图、日志、下载文件及源文件 hash 归档到 QA 证据库 `viewer-ui-batch2-20261021`；Git 仅保留源码、可复用用例／fixture 和本说明。归档 `evidence.tar.gz`，SHA-256：`5a917950506155dfc599b55c42aef92b9b0c2c8e8cec53c0e4555d215bc4a19b`。对应实际运行：125/125 项本次相关及既有 CI 测试通过，包含成绩发布隔离文件／内存适配回归；Contract 生成与跨语言测试通过。正常业务入口 `npm run build` 通过，未加载本地 fixture 或评审路由；构建资源包装及原预算保持。

9 组同输入前后对照（每页 1440 浅中、390 浅中、414 暗日），另有基线 503 异常复现；最终 24 个正常／空／失败／匿名／未绑定／手动来源状态及 23 项桌面手机交互检查通过，页面无横向溢出、图片比例和完整尺寸入口正常。进度选项 503 后在同一页重试恢复图片；完整四类参数、定数口径联动、页码及下载均实际操作。预览入口 `__batch2` 和前后截图加载另经浏览器验证。

测试首次额外运行遇到本机旧目录不存在及默认解释器不匹配；显式使用已安装运行时并指定有效的只读运行目录后，9 项既有成绩发布测试在 QA 临时目录通过。未修改这些后端实现或测试来规避失败。构建采用已验证的显式代理，未更改全局网络设置、依赖或资源预算。

唯一迁移清单仍为 [migration.md](../viewer-lightness-20261020/migration.md)。成长档案、周报、首页深层状态及其余内容迁移继续待办；图片生成算法和运营流程不在本批完成范围。
