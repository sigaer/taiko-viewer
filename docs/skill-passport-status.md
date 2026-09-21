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
