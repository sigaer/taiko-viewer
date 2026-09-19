# Sakura Taiko Viewer 0.70.1 Weekly Growth Recap — 实施与验收状态

日期：2026-09-20  
状态：`PASS / COMPLETE`

## 结论

0.70.1 已把 0.70.0 的 canonical growth facts、Goal facts、longitudinal measurements 与 coverage 组合为可解释的每周成长叙事。周报是 derived-on-read，不新增周报表或第二套事实规则；页面保持单列叙事，没有 KPI Grid。

## 规格要求逐项回答

1. **实施开始 / 最终版本**：从生产基线 `0.70.0` 开始，最终 Viewer 版本为 `0.70.1`。
2. **Weekly window**：固定使用 `Asia/Shanghai` 自然周。当前周为周一 00:00 至今天，历史周为周一至周日；API 内部使用左闭右开的 UTC 查询边界。
3. **Partial week 标识**：当前周返回 `isCompleteWeek: false`，页面显示“本周 · 截至今天”；只有已经结束的历史周才为完整周。
4. **Weekly API contract**：`GET /api/account/growth/weekly?week=YYYY-MM-DD`，返回 `profileId`、`week`、`coverage`、`theme`、`highlights`、`measurementChange`、`totals` 与 `currentNextAction`。接口必须登录，只读取 current binding，拒绝任意 profile selector，并设置 `Cache-Control: private, no-store`、`Vary: Cookie`。
5. **Theme selection rule**：确定性 composer 按事实数量、变化幅度、皇冠等级、Goal 跟进与兼容 measurement 证据评分；混合、安静、无游玩、focus change、balanced、limited coverage 均有显式分支，不使用生成式文案，也不把 activity 自动当 progress。
6. **Evidence bundle**：theme 只携带实际入选的 `evidenceFactKeys`、兼容的 start/end `evidenceMeasurementIds` 和 `confidence`；叙事只能引用该 bundle 内证据。
7. **Highlights selection**：canonical facts 先按谱面聚合并去重，同谱多事实折叠为一项；皇冠取最高状态，其余按 theme 命中、事实优先级和相对 magnitude 稳定排序，最多 4 项；关联 Goal 作为同一谱面的补充证据。
8. **Totals 是否主展示**：否。totals 仅作为 API supporting metadata，页面不渲染 KPI 数字网格。
9. **Goal 如何归入 week**：优先使用 Goal fact 已有的 authoritative `attributedDay`；否则仅在同 binding、同曲、同难度、兼容 goal type，且 source revision 相同或 before/after 相同的本周 score fact 上建立归因桥。
10. **completedAt 是否用于周归因**：否，绝不以 Goal `completedAt` 冒充游玩日期。
11. **Measurement start/end**：取窗口内按 `capturedAt`、`id` 稳定排序后的最早与最晚 measurement；只有一条时返回 `insufficient`，不计算变化。
12. **algorithm/model mismatch**：measurementVersion、algorithmVersion 或 modelRevision 任一不一致即不计算连续 delta，并分别返回明确 reason。
13. **Rating / dimension delta**：仅兼容且 ready 的 start/end 才计算；零变化不展示，六维只选绝对变化最大的 `primaryDimension` 作为主要表达，避免把全部 delta 堆到页面。
14. **Focus change**：返回 `focusFrom` / `focusTo`；无强成长事实但 focus 改变时可成为确定性主变化，balanced 与 focus 的双向变化均覆盖测试。
15. **Quiet week**：coverage 完整、有少量普通游玩但无强事实时显示安静周叙事，不显示一排 0。
16. **No play**：coverage 完整且没有本周谱面活动时显示“这周还没有新的游玩记录”。
17. **Partial / truncated coverage**：显式保留 History coverage；不完整时降级为 limited-coverage，低 confidence，不用全量统计语气。partial 与 truncated 均纳入测试和浏览器矩阵。
18. **Manual**：手动绑定无法建立可信历史范围时返回 unknown/limited coverage、空 highlights 与保守文案，不断言“没有进步”。
19. **页面路由**：`/my/weekly`，归属“我的太鼓 / 我的成长”；`/my` 支持 Nuxt 子路由渲染。
20. **Home entry**：首页增加轻入口“看看这周”，同时在我的页面与侧栏提供入口；没有把完整周报塞回首页。
21. **Mobile layout**：单列阅读流依次呈现本周标题、一个主变化、2–4 个重点、周初到现在的能力变化、Goal 关联与下一步；390×844 线上验证无横向溢出。
22. **Desktop layout**：仍为单列主叙事、辅助节拍线和有节奏留白，没有利用宽屏铺卡片矩阵。
23. **是否 KPI Grid**：否；静态检查、96 组合浏览器矩阵与真实线上页面均确认 `.weekly-metric` 为 0。
24. **Weekly endpoint Python 次数**：最多 1 次 current Growth Overview compute；History 读取 1 次，composer 不重跑历史事实规则，前端不推导 canonical facts。
25. **Endpoint 性能**：代表性线上服务日志中 rich week：Overview `596ms`、compose `0ms`、endpoint `715ms`，8 facts / 2 measurements / 2 highlights；limited：Overview `2ms`、compose `0ms`、endpoint `4ms`。加入真实浏览器验收后的外部 API 观测为 rich `810ms`、limited `17ms`。
26. **Browser matrix**：12 个场景 × zh/ja × mobile/desktop × light/dark，共 `96/96 PASS`；检查单一主焦点、highlight ≤ 4、无 KPI Grid、无 raw key、无 overflow、无 hydration error、Today Plan、coverage 与 model mismatch 降级。深色主题对比度经视觉复核后修正。
27. **Production smoke**：`PASS`。rich week 实际走登录、Growth Overview、Goal create/evaluate 与 Weekly API，得到 `score-breakthrough`、2 个 highlights、4 PB、1 FC、1 completed Goal、2 个兼容 measurements 和 current next action；incomplete/manual 得到 `limited-coverage`、unknown coverage、0 highlights。中文移动端两个状态的真实生产页面均通过。
28. **Cleanup / orphan**：生产 smoke 后 users、bindings、sessions、goals、measurements 残留均为 `0`；Goal 与 measurement 的 user/binding orphan、owner mismatch 均为 `0`；临时文件残留为 `0`。
29. **Goal loop regression**：`46/46 PASS`，并由生产 smoke 验证真实 Goal create、evaluate 与周归因。Growth refresh `8/8 PASS`，页面继续复用 current Today Plan。
30. **History Foundation regression**：Growth History `9/9 PASS`；Daily/Growth `44/44 PASS`；Home state `18/18 PASS`；version `1/1 PASS`。没有新建 DB 表、fact 表或 weekly persistence。
31. **是否 READY FOR 0.70.2 Skill Passport**：是。所有 0.70.1 blocker 已关闭，`READY FOR 0.70.2 SKILL PASSPORT`。

## 验证记录

- Weekly unit/static：`9/9 PASS`
- Browser matrix：`96/96 PASS`
- Goal regression：`46/46 PASS`
- Growth refresh regression：`8/8 PASS`
- Daily/Growth regression：`44/44 PASS`
- Growth History regression：`9/9 PASS`
- Home state regression：`18/18 PASS`
- Version：`1/1 PASS`
- Viewer production build、service reload、Nginx config test 与 health checks：`PASS`
- TypeScript 全仓检查仍包含既有 baseline 错误；本次引入的错误已修复，权威生产 build 通过。

## 完成状态

```text
0.70.1 WEEKLY GROWTH RECAP COMPLETE

WEEKLY GROWTH THEME ESTABLISHED
CANONICAL FACTS REUSED WITHOUT REDEFINITION
GOAL / SCORE WEEK ATTRIBUTION BOUNDARY ACCEPTED
VERSION-COMPATIBLE PLAYER STATE CHANGE ACCEPTED
HISTORY COVERAGE-AWARE NARRATIVE ACCEPTED
QUIET / LIMITED WEEK STATES ACCEPTED
NEXT ACTION CONNECTED TO CURRENT GROWTH STATE
NO KPI DASHBOARD REGRESSION
0.70.0 HISTORY FOUNDATION REGRESSION ACCEPTED

READY FOR 0.70.2 SKILL PASSPORT
```
