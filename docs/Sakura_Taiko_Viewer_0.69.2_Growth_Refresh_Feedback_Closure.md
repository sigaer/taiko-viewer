# Sakura Taiko Viewer 0.69.2
# Growth Refresh & Feedback Closure
# Evaluation Success → Fresh Overview → Current State → Next Choice

## 0. 审计结论

当前 `0.69.1` 已确认：

```text
POST /api/account/growth/goal/evaluate
→ 只更新 Goal 区域
```

不会自动刷新：

- Player State
- six dimensions
- current focus
- Today Plan
- Daily Progress
- Overview scoreRevision

因此当前可能出现：

```text
目标已经 completed
但首页仍显示 baseline-era 的六维 / focus / 推荐
```

更直接的问题是：

```text
旧 Overview.scoreRevision
↓
用户不 reload 就直接“再选一首”
↓
create Goal
↓
服务端可能 stale-plan 409
```

生产此前“完成后创建下一 Goal” smoke 包含 reload，因此不能证明当前页面无刷新也能闭环。

本轮正式修复：

> **Evaluation 完成后，用一次 authoritative Growth Overview refresh，把 Goal completion 与当前 Growth state 接上。**

---

# 1. 0.69.2 范围

本版只做：

1. evaluation mutation 后刷新 Growth Overview
2. 保证新的 scoreRevision 进入前端
3. Player State / focus / Today Plan 使用当前 authoritative score 重算
4. Goal 区域与 fresh Overview 合并
5. 修复“完成后立即再选一首”的 stale-plan 问题
6. 最小 Feedback / Daily presentation 去重
7. 完整闭环验收

不做：

- Recommendation ranking 改造
- 六维算法改造
- Goal 新类型
- 自动选择下一 Goal
- 自动 Evaluation
- streak / XP
- Weekly recap
- Daily Progress extraction 改造

---

# 2. 刷新策略

采用：

## `POST evaluate → one explicit Growth Overview refresh`

而不是让 POST 返回整份 Growth。

原因：

- 现有 Overview 已是 authoritative Growth 统一入口
- 每次 GET 已会调用 `runGrowthPythonJson()` 重新读取 userdata
- 避免在 Goal Evaluation service 中重复实现 Growth composition
- 不让 mutation route 同时承担 Evaluation + 完整 Growth 计算
- 保持 GET Overview 为唯一 Growth read model

流程：

```text
POST /goal/evaluate
↓
evaluation result
↓
if identity/generation still current
↓
refresh Growth Overview once
↓
replace full growth state
↓
render completed Goal + current Player State + current Today Plan
```

---

# 3. 不允许双重计算

POST evaluate 本身不要新增完整 Growth compute。

必须避免：

```text
POST evaluate
→ runGrowthPythonJson
→ client GET Overview
→ runGrowthPythonJson again
```

正式策略：

```text
POST = Goal Evaluation only
GET Overview = Growth recompute only
```

---

# 4. 哪些 outcome 需要 refresh

### completed

必须 refresh。

原因：

- scoreRevision 已变化
- Goal 状态变化
- Player State / Today Plan 可能变化
- 下一 Goal 必须使用 fresh revision

### active

如果 evaluate 已确认读取到了一个**新的 authoritative observation revision**，也应 refresh。

因为：

> 即使 Goal 没完成，成绩本身也可能改变 Player State / 推荐。

例如：

```text
Goal = FC
新成绩 PB，但仍未 FC
```

Goal outcome = active，
但 Growth state 已经可能变化。

### inconclusive

按 Evaluation 返回信息判断。

若 current score revision 与 Overview revision 已发生变化：

应 refresh。

若没有任何新 authoritative state：

可以不刷新。

实现时不要单纯按 outcome 判断，优先依据：

```text
evaluation response 是否能证明 current score revision 已变化
```

如果当前 response 不带足够 revision 信息，可以扩展返回最小字段：

```ts
{
  ...
  observedScoreRevision?: string
  shouldRefreshGrowth: boolean
}
```

不要返回整份 Overview。

---

# 5. 最简单安全方案

如果扩展 revision contract 成本较高：

V1 可直接：

> 每次用户主动点击“确认进展”并成功收到 2xx 后，执行一次 Growth refresh。

这是可接受的，因为：

- 用户主动操作，低频
- 当前 Overview GET 单次约 0.5s 量级
- 能消除 stale state
- 不引入后台轮询

但必须确保：

```text
最多一次 GET
```

---

# 6. usePlayerGrowth 必须成为刷新入口

父组件应实际取得：

```text
refresh()
```

Evaluation 成功后调用统一 refresh。

不要：

- 在 PlayerGrowthSurface 自己 fetch `/overview`
- 新建第二套 Growth store
- 局部拼接 six dimensions / Today Plan

Growth state 仍以：

```text
usePlayerGrowth
```

为单一来源。

---

# 7. Identity / Generation Guard

当前 Goal mutation 已有 profile/generation guard。

Refresh 必须继续同样保护：

```text
evaluate started on profile A
↓
用户切到 B
↓
A evaluation returns
↓
不得 refresh 后把 A Overview 写进 B 页面
```

要求：

- capture request generation/profile
- POST 返回后先确认仍是当前 profile
- refresh response 也必须经过 generation guard
- stale response 丢弃

---

# 8. Refresh 成功后的状态来源

刷新完成后：

以下全部来自 fresh Overview：

- `activeGoal`
- `recentCompletedGoal`
- `playerState`
- six dimensions
- focus
- Today Plan
- Daily Progress
- `scoreRevision`

不要继续保留 POST response 作为长期 UI source。

POST response 可用于：

- 即时 busy/feedback
- 判断 evaluation outcome

最终页面状态必须由 refreshed Overview 收敛。

---

# 9. Refresh 失败语义

如果：

```text
Goal 已成功 completed
但 Overview refresh 失败
```

不得回滚 Goal。

UI：

```text
Goal completion 已保存
成长状态刷新失败
```

可保留 POST 返回的 completed Goal 作为临时局部状态，
并提供：

```text
重新刷新
```

或下一次普通页面 refresh 自愈。

不要把 Goal 恢复 active。

---

# 10. “再选一首”必须依赖 fresh Overview

当 recentCompletedGoal 显示：

```text
再选一首
```

按钮可用前必须确保：

```text
Growth Overview 已成功 refresh
```

因为下一 Goal create 需要：

```text
fresh scoreRevision
fresh Today Plan
```

如果 refresh 尚未完成：

- 显示 loading
- 暂时 disable “再选一首”

不要让用户立即触发 stale-plan 409。

---

# 11. stale-plan 409 仍保留服务端保护

即使前端刷新后：

服务端仍继续保留：

```text
sourceRevision / scoreRevision / Today Plan revalidation
```

因为同步仍可能在：

```text
Overview refresh
→ 点击选歌
```

之间发生。

前端 refresh 是 UX 修复，不替代服务端 freshness contract。

---

# 12. Home 完成后状态

Evaluation completed + refresh 成功：

```text
这次练成了
Fallen Angel
不可 8 → 4

[当前最新 Hero / 六维 / focus]

可以试试这三首
[new current recommendations]

今天
[current Daily Progress]
```

顺序按现有 Home 结构调整，
不要强制把 Goal feedback 放在 Hero 之上。

---

# 13. Player State 变化必须真实

如果 refresh 后：

```text
focus 仍然是精度
```

就继续显示精度。

不要因为 Goal 完成：

```text
自动切到第二短板
```

同理六维没有明显变化时也正常。

---

# 14. Today Plan 变化也不强制

fresh Today Plan 可能：

- 完全变化
- 部分变化
- 不变化

全部合法。

禁止：

- shuffle
- 排除刚完成歌曲
- 人工换推荐
- 增加“避免重复”特殊规则

除非现有推荐算法本身如此。

---

# 15. Daily Progress 保持独立

Growth refresh 会重新得到当前 Daily Progress。

但：

> 不修改 `deriveDailyProgress()`。

Goal completion 和 Daily event 仍是两个独立事实来源。

---

# 16. Feedback / Daily 去重

本版可以补 presentation-level 去重，但必须非常保守。

只在：

```text
same song
same difficulty
same fact type
same before
same after
```

时认为 Goal feedback 与 Daily fact 重复。

例如：

```text
Goal completed:
NG 8 → 4

Daily:
same chart
NG 8 → 4
```

Home 不重复展示两次完整事实。

---

# 17. 不修改 Daily 原始数据

去重只能发生在 presentation composition：

```text
raw daily events
→ compose home presentation
```

不能从 Daily Progress DTO 或历史数据中删除事件。

---

# 18. Higher Crown 去重

兼容：

```text
Goal clear
completedBy FC
Daily FC
```

Daily FC 已包含更高状态，
Home 不再重复：

```text
Goal: 通关
Daily: 新全连
```

为两个大型事实块。

可以：

```text
这次练成了
新全连
```

并保留 Goal 的目标语义为 secondary copy。

同理：

```text
DF subsumes FC + Clear
FC subsumes Clear
```

---

# 19. 非重复事实必须保留

例如：

```text
Goal = FC
Daily:
FC
PB +7130
NG 8 → 0
```

Goal feedback 可突出 FC。

Daily 仍应保留：

```text
PB +7130
NG 8 → 0
```

不能因为同一 song 就整条删除。

---

# 20. 纯函数

建议新增：

```text
composeGrowthFeedback(...)
```

或等价 helper。

输入：

- recentCompletedGoal
- Daily Progress
- activeGoal
- player state / presentation context

输出：

- goal feedback presentation
- deduped Daily presentation

不要把这些判断散落在 Vue template。

---

# 21. 旧 Goal inconclusive 不变

0.69.0 缺 provenance 的旧 Goal：

- 仍 active
- inconclusive
- 更新成绩后取消并重新选择

0.69.2 不补造证据。

---

# 22. Browser UX

确认进展后的期望：

```text
tap
→ evaluate busy
→ evaluation success
→ Growth refresh indicator
→ fresh Overview
→ layout stays stable
```

禁止：

- full-page reload
- scroll top
- entire Home skeleton
- duplicate loading overlays

---

# 23. Loading 表达

Goal 区域可以显示：

```text
正在更新状态…
```

但不要把整页变成 loading。

如果现有 refresh API 会把全页状态清空，
需要改 composable：

> preserve previous data while refreshing.

---

# 24. usePlayerGrowth Refresh 语义

检查：

- refresh 是否当前会清空 growth
- 是否保留 stale data until response
- error 是否会摧毁 previous state

推荐：

```text
isRefreshing = true
growth 保留
↓
fresh response
↓
atomic replace
```

---

# 25. Tests — Refresh

至少覆盖：

1. completed → exactly one Overview refresh
2. active outcome → refresh
3. inconclusive → 按定义 refresh
4. refresh returns latest scoreRevision
5. six dimensions replaced
6. focus replaced
7. Today Plan replaced
8. Daily Progress replaced
9. POST response 不长期覆盖 Overview
10. refresh failure 不回滚 completed

---

# 26. Tests — Stale Plan Closure

重点场景：

```text
Overview R1
→ Goal baseline R1
→ future score R2
→ evaluate completed
→ refresh Overview R2
→ “再选一首”
→ create Goal
```

必须：

```text
no stale-plan 409
```

正常创建。

---

# 27. Tests — Profile Switch Race

```text
A evaluate
→ before response user switches B
→ A response arrives
→ no B contamination
```

以及：

```text
A refresh in flight
→ switch B
→ A refresh arrives
→ discarded
```

---

# 28. Tests — Dedup

至少：

- PB exact duplicate
- NG exact duplicate
- rank exact duplicate
- Clear completed by FC + Daily FC
- FC completed by DF + Daily DF
- same song PB + FC, only FC duplicate
- conflicting before/after → no dedup
- unrelated song → no dedup

---

# 29. 浏览器矩阵

至少：

1. PB completed → refresh → new plan
2. NG completed → refresh
3. Clear completed
4. FC completed
5. DF completed
6. Rank completed
7. no-change recommendation
8. changed recommendation
9. dedup Daily fact
10. same song extra Daily facts
11. refresh failure
12. completed → immediate new Goal
13. A/B profile switch
14. reload/relogin

覆盖：

- zh / ja
- mobile / desktop
- light / dark 若 runner 成本可接受

---

# 30. Production Smoke

隔离账号：

```text
load Overview R1
→ create Goal
→ modify authoritative fixture to R2
→ POST evaluate
→ confirm completed
→ verify exactly one Overview refresh
→ verify Overview scoreRevision = R2
→ verify Player State / Today Plan from R2
→ click “再选一首”
→ create next Goal without reload
→ verify no stale-plan
→ cleanup
```

这一步是本版最关键的线上证明。

---

# 31. Daily Attribution Smoke

另外验证：

### A. Goal fact 与 Daily fact 精确匹配
Home 不重复。

### B. Goal completed，但 Daily 无法证明 today
仍显示：

```text
这次练成了
```

但不写：

```text
今天完成
```

---

# 32. 性能

记录：

- POST evaluate latency
- subsequent Overview TTFB/total
- evaluate tap → fresh Growth visible
- Python process count

必须确认：

```text
一次用户确认
=
1 evaluation POST
+
1 Growth GET
+
1 Growth Python compute
```

不得出现 2 次以上完整 Growth compute。

---

# 33. 不需要 DB migration

本版原则：

```text
NO SCHEMA CHANGE
```

若实现中认为必须改 schema：

停止并报告。

---

# 34. 回归范围

保持：

- 0.68.9 Daily Progress replay
- 0.69.0 Goal Foundation
- 0.69.1 Goal Evaluation
- recommendation regression
- account lifecycle
- binding switch
- zh/ja
- version/build

---

# 35. Completion Blockers

任一存在不得关闭：

- evaluation 后不刷新 Overview
- fresh scoreRevision 未进入页面
- “再选一首”仍可稳定触发 stale-plan
- refresh 导致 scroll top / full skeleton
- profile switch 被旧 response 污染
- refresh failure 回滚 completed Goal
- 前端自行计算六维/推荐
- Goal 完成后强制换短板
- 修改 Daily Progress extraction
- fact-level dedup 删除非重复事实
- duplicate full Growth compute
- production no-reload next-goal smoke 未通过

---

# 36. 最终报告必须回答

1. 实施开始/最终版本？
2. POST evaluate 后是否 exactly one Overview refresh？
3. active / inconclusive 是否也 refresh？
4. 是否扩展 evaluation response revision 字段？
5. usePlayerGrowth refresh 如何接入？
6. refresh 是否保留旧 UI 到 fresh response？
7. profile generation guard？
8. fresh scoreRevision 是否更新？
9. fresh Player State 是否更新？
10. fresh focus 是否更新？
11. fresh Today Plan 是否更新？
12. fresh Daily Progress 是否更新？
13. completed 后无需 reload 能否创建下一 Goal？
14. stale-plan 是否关闭？
15. Recommendation ranking 是否改变？
16. 是否强制 rotate target dimension？
17. Daily Progress extractor 是否改变？
18. dedup 规则？
19. higher crown dedup？
20. nonduplicate Daily facts 是否保留？
21. browser matrix？
22. production no-reload smoke？
23. evaluate→fresh UI latency？
24. Python compute 次数？
25. cleanup/orphan？
26. 是否完整保留 0.69.0/1 回归？
27. 是否可以正式关闭 0.69.x Goal Feedback Loop？

---

# 37. 完成状态

全部 PASS 后记录：

```text
0.69.2 GROWTH FEEDBACK LOOP CLOSURE COMPLETE

EVALUATION → FRESH GROWTH OVERVIEW ESTABLISHED
CURRENT SCORE REVISION PROPAGATED TO HOME
PLAYER STATE REFRESHED FROM AUTHORITATIVE SCORE
TODAY PLAN REFRESHED AFTER EVALUATION
NO-RELOAD NEXT GOAL FLOW ACCEPTED
PROFILE-SAFE GROWTH REFRESH ACCEPTED
GOAL / DAILY PRESENTATION DEDUP ACCEPTED
DAILY PROGRESS EXTRACTION UNCHANGED
RECOMMENDATION RANKING UNCHANGED

0.69.x GOAL FEEDBACK LOOP COMPLETE
```

完整闭环：

```text
Recommendation
→ User Choice
→ Frozen Baseline
→ Authoritative Result
→ Confirm Progress
→ Goal Evaluation
→ Fresh Growth Overview
→ Current Player State
→ Current Today Plan
→ Next User Choice
```
