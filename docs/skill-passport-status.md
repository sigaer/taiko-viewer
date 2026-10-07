# Skill Passport 实施状态

日期：2026-09-21

结论：`PASS`

规格阶段名为 0.70.2；实施时 Viewer 已处于 0.72.0，因此未降级版本，按新增页面与 API 的 minor scope 发布为 0.73.0。

## 最终报告

1. 实施开始 / 最终版本：开始 0.72.0，最终 0.73.0。
2. 用户可见名称：中文“成长档案”，日文“成長の記録”。
3. 页面路由：`/my/growth`；日文路由由现有 i18n 映射为 `/ja/my/growth`。
4. Passport API contract：`GET /api/account/growth/passport`，仅认证用户可访问，响应 `private, no-store`、`Vary: Cookie`，组合 current、coverage、range、segments、currentSegmentChange、focusTimeline、milestones、Goal 与 next action；不接受 user/profile selector。
5. range 支持：30、90、180、365 天，默认 90 天；dimension 仅接受 Rating 与现有六维。
6. daily representative 规则：按 Asia/Shanghai 业务日分组，先按 `capturedAt`、再按数值 ID 稳定排序，取每天最后一行，保留原 measurement 元数据，不做日平均。
7. measurement segment key：`measurementVersion + algorithmVersion + modelRevision`。
8. modelRevision break：SVG 折线物理断开，以实线/虚线/点线辅助区分，并用轻量“计算口径曾更新”说明；不显示原始 SHA。
9. 是否跨 segment 算 delta：否，也不跨 segment 连线。
10. current segment：包含最新日代表点的最后一个兼容 segment。
11. Rating trend：支持，默认只画 Rating 单序列。
12. dimension selector：支持 Rating + 大曲、体力、速度、精度、节奏、复杂六维，一次只显示一条线。
13. primary dimension change：在 current segment 首尾可比六维中选绝对变化最大且超过 epsilon 的维度；稳定时不强行选主维度。
14. negative change wording：使用“近期测量略有回落”，不解释为能力退步或训练失败。
15. focus timeline：按连续相同 focus 压缩为 run，并在 segment break 处强制断开。
16. limited / balanced：作为真实状态保留；limited/insufficient 不计算稳定变化，balanced 不包装成人格标签。
17. measurement coverage：返回全生命周期 `measurementFrom`、`measurementTo`、Asia/Shanghai distinct `measurementDays`；所选范围不足时只展示实际记录天数。
18. recent fact coverage：固定最近最多 90 天，保留 complete/partial/truncated/unknown，不伪造 all-time 完整性。
19. milestones 范围：最近最多 90 天，最多 8 个。
20. milestone selection：复用 canonical Growth Facts；去重后按皇冠、评价、PB、不可、连击等意义与相对幅度稳定排序，同曲同日折叠，最高皇冠优先。
21. Goal milestone 时间语义：严格匹配同谱面 score fact 时沿用游玩日；无法匹配时仅作为 observation-time 事实，不用 completedAt 冒充游玩时间。
22. 是否展示 all-time milestone：否。
23. current Growth 是否计算：是，Passport 组合一次当前 Overview，保证页面直达可独立工作。
24. Python 次数：每次 Passport 请求最多 1 次；前端不再另取 Overview。
25. active Goal / next action：支持轻量 active Goal 或 recent completed Goal，以及当前 focus 与 Today Plan；遵循 Overview 中 active/recent 互斥展示语义。
26. Weekly 入口联动：Home、个人页、侧边栏、Weekly、Passport 均已互链。
27. 是否新建 DB 表：否。
28. 是否改 measurement capture：否，仍仅在新 scoreRevision 首次成功 Growth compute 后按既有唯一键 upsert。
29. 30/90/180/365 性能：四档均有单元与浏览器覆盖；365 个合成日点投影约 38 ms、序列化小于 1 MB。线上 365 天烟测多次请求中 measurement query 1–2 ms、daily sampling 1 ms、segment build 0 ms、milestone compose 1 ms、recent History 218–313 ms、Overview 588–872 ms、endpoint 838–1116 ms；最终烟测客户端观测 1049 ms，响应约 9.4 KB。
30. browser matrix：112/112 PASS；14 场景 × zh/ja × 390/1440 × light/dark，覆盖键盘点位、tap、overflow、hydration、原始 key/SHA、单序列和非 KPI Dashboard。
31. production smoke：PASS；真实已发布 API 与 `/my/growth?range=365` 首次加载、浏览器可见和 reload 均通过，报告位于 `/var/tmp/growth-passport/production-smoke.json`。
32. cleanup/orphan：一次性 users/bindings/sessions/goals/measurements 与 userdata 均为 0 残留；Goal 与 Growth Measurement orphan audit 全字段为 0。
33. Goal regression：46/46 PASS；Goal refresh 8/8 PASS。
34. Weekly regression：9/9 PASS；Growth 44/44、History 9/9、Home 18/18、version 1/1、Passport 12/12 也通过。
35. 是否正式建立长期 Growth Story：是；Daily 回答今天、Weekly 回答本周、Passport 回答一段时间的变化，Player State / Today Plan / Goal 回答下一步。

## 发布与验证

- 实现提交：`af68c95 0.73.0 增加长期成长档案`
- 标准生产构建、服务切换和本地/外网健康检查：PASS
- 线上版本：0.73.0
- 浏览器矩阵报告：`/var/tmp/growth-passport/browser-matrix.json`
- 线上烟测报告：`/var/tmp/growth-passport/production-smoke.json`
- 百度 URL 推送达到当日配额，HTTP 400 `over quota`；部署脚本按设计将其视为非阻断项。
- `nuxi typecheck` 仍受仓库既有类型基线影响；生产构建通过，新增 Passport 运行文件未出现独立类型错误。

## 完成块

```text
0.70.2 SKILL PASSPORT COMPLETE

LONGITUDINAL PLAYER STATE EXPERIENCE ESTABLISHED
MEASUREMENT VERSION SEGMENTATION ACCEPTED
CURRENT-SEGMENT ABILITY CHANGE ACCEPTED
FOCUS TRAJECTORY ESTABLISHED
RECENT GROWTH MILESTONES ESTABLISHED
MEASUREMENT / FACT COVERAGE BOUNDARY PRESERVED
NO HISTORICAL BACKFILL FABRICATION
NO KPI DASHBOARD REGRESSION
0.70.1 WEEKLY RECAP REGRESSION ACCEPTED
0.69.x GOAL LOOP REGRESSION ACCEPTED

0.70.x GROWTH STORY FOUNDATION COMPLETE
```

## 0.79.2 呈现修补（2026-10-07）

范围请求审计未复现“始终取 90 天”：原版 30/90/180/365 点击各产生一次对应请求，响应 requestedDays 与选中状态正确；短测量历史会使四档返回同样的点。本次按全生命周期的上海日历跨度收敛曲线控件，distinct measurementDays 继续作为实际记录天数。少于 30 天隐藏；42 天显示 30/全部（请求 90）；120 天显示 30/90/全部（请求 180）；250 天显示 30/90/180/全部（请求 365）；365 天起保留四档。曲线始终使用返回点的实际范围，切换保留内容，失败不自动重试。

“最近的节点”属于独立的最近 90 天事实投影。sigaer 只读审计发现最新事实日期为 2026-10-06，但旧投影在按日期展示之前先按意义/幅度截取八项，最新可见节点只到 2026-09-12。本次先选最新日期，同一天内再按意义/幅度选取，仍最多八项。上海日历日用于 observation-only Goal 的排序，Goal 的 day 仍保持 null，不伪造游玩归因。90 天读取边界保留在“记录范围”披露中，曲线控制的 accessible name 为“趋势范围”。

主叙事改用最近记录、实际变化和关注方向；记录方式更新只作可展开的二级说明。Current segment 的可比规则、历史事实、measurements、Weekly、Goal Evaluation 与推荐算法不变，无迁移。

账号与语言页面各自使用缓存 key；离开档案后清理自身缓存，并在账号变化时立即清空。避免中日文子页共用 key 时，旧页卸载会清空新页数据。范围不进入 key，切换仍只有一次 watch 刷新。浏览器验收包含返回“我的太鼓”并重新打开，以及中日文切换保留当前趋势范围。

“我的太鼓”使用标准嵌套页面：父页保留 NuxtPage，原索引内容移至 my/index.vue，页面地址和内容不变。避免本次账号缓存清理与依赖延后 route 的子页条件挂载冲突，连续验收覆盖带 range 查询的档案返回父页和重新进入。

PersonalGrowthLayout 不进入全站 KeepAlive 缓存，避免语言切换后重新激活旧父页时仍保留旧的子页路由。其他页面继续使用原有缓存行为。

可重复验证入口：`tests/growthExperience.test.ts`、`scripts/verify_growth_experience_browser.mjs`、`scripts/benchmark_growth_experience.mjs`、`scripts/run_growth_experience_production_smoke.mjs`。本次验收与性能产物独立保存在 `/var/tmp/growth-experience-0792`，线上烟测仅在对应版本发布后通过显式开关运行，并清理一次性账号、绑定、Goal、measurement、Recent cursor 和合成 userdata。

## 0.79.3 线上向前修复（2026-10-07）

0.79.2 线上直接访问已登录 Home 的烟测发现 SSR 与客户端各启动一次 Growth compute。两个 composable 的本地 ref 不进入 SSR payload，故服务端只保留一致的 pending 状态，Growth Overview 和 Recent 首次加载统一在客户端发生；刷新、账号/绑定切换与证据提取规则保持原有行为。修正验收的 journal 计数，仅匹配 overview timing / replay / compose 完整消息，避免 measurement upsert 的单行日志被算作 History replay。失败轮次的一次性账号和合成 userdata 均已清理。

## 0.79.4 手机长昵称修补（2026-10-07）

真实手机截图复核发现连续英文昵称会形成过大的 min-content 宽度，撑宽整段成长内容。为成长容器补充 min-width: 0，并允许问候标题在长昵称内换行。加入 --critical --long-name 浏览器回归入口和真实线上 Home 宽度检查。线上验收用独立的第二页，在选择新 Goal 前检查已完成 Goal 与 Recent/Daily 的同一事实；原页完成与下一目标保持无需重新加载。最多同时两页，结束后全部关闭和清理。
