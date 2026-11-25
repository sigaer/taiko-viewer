# UI Delivery

在现有首页 `PlayerGrowthSurface.vue` 和成长档案 `pages/my/growth.vue` 中加入 `components/goals/Portfolio.vue`，复用既有按钮、颜色和布局，不重设计页面。UI 版本提升为 `1.21.0-rc.1`，lockfile 同步。

用户可以从每日计划选择歌曲预填，或输入歌曲编号/难度读取合法 target，显式创建多个目标。每个目标展示歌曲/难度/类型、target、生命周期、availability、最近评价、优先级和创建/更新时间。支持暂停、恢复、取消、优先级、上下移动、独立评估、历史分页。不支持的 GoalType 不显示创建入口。

`useGoalPortfolio.ts` 统一数据加载和 CAS。409 重读后提示冲突，不重放旧操作；网络失败可用相同 commandId 重试。响应先局部合并再刷新；刷新失败保留现有目标，身份变化丢弃过期响应。加载、空、错误、来源不可用和 Schema unavailable 有明确状态。完成后重读成长事实。

实际组件 + 实际服务/Store + 独立 SQL 的浏览器场景：中文 375×812、日文 1440×900 深色、中文 812×375 横屏深色，均开启 reduced motion；创建/暂停/恢复/取消、priority、冲突后重读、触控尺寸≥44px、键盘聚焦、无横向溢出、无缺失翻译键及无 pageerror 通过。截图在测试证据的 portfolio-browser 子目录。认证与上游 source/catalog 在 fixture 中替代，不能称为真实生产玩家或整站在线验收。
