# Sakura Taiko Viewer 0.70.1
# Weekly Growth Recap
# Growth History → Weekly Narrative → Meaningful Change

## 0. 阶段定位

当前生产基线：

- Viewer：`0.70.0`
- Growth History Foundation：COMPLETE
- Canonical Growth Facts：已建立
- Multi-day authoritative replay：已建立
- Goal History：已合入 Growth Timeline
- `web_growth_measurements`：已上线
- Measurement version boundary：已建立
- History coverage：显式返回
- Daily Progress 语义保持不变
- 0.69.x Goal Feedback Loop：回归通过

0.70.1 的目标：

> **把“过去一周发生了什么”整理成一个自然、可信、可读的成长回顾。**

不是 KPI Dashboard。

不是：

```text
本周游玩 37 次
PB 12
FC 4
Goal 3
Rating +0.14
```

而是：

```text
这周最明显的是精度更稳了

你在 4 张谱上刷新了最好成绩，
其中 2 张同时把不可压低。

Fallen Angel
不可 8 → 4

本周还新增了 1 个全连，
完成了 2 次自己选下的练习目标。

六维从周初到现在，
精度力 10.41 → 10.53
但整体 focus 仍然是精度。

下周可以继续从这里入手。
```

---

## 1. 产品问题

0.70.0 已经能稳定提供：

- score facts
- Goal facts
- longitudinal measurements
- coverage
- algorithm/model version

0.70.1 要回答：

> **“这一周，对我来说最值得记住的变化是什么？”**

而不是：

> “这一周有多少个字段发生了变化？”

---

## 2. 版本

实施开始前读取 canonical version。

若生产仍为 `0.70.0`：

目标版本：

`0.70.1`

不得回退版本。

---

## 3. Weekly Window 定义

默认采用：

> **Asia/Shanghai 自然周，周一 00:00 起。**

当前周：

```text
本周
=
本周一 00:00
→
当前时间
```

历史完整周：

```text
周一 00:00
→
下周一 00:00
```

不要使用设备当前所在地时区改变业务周边界。

---

## 4. 当前周必须明确是 partial week

如果今天是周三：

页面不要暗示这是完整一周。

显示：

```text
本周 · 截至今天
```

而不是：

```text
本周总结
```

直到周日结束后才是完整周。

---

## 5. 不默认做“上周对比”

第一版不强制：

```text
比上周多打 23%
比上周进步 18%
```

因为：

- coverage 可能不同
- measurement 可能缺失
- score activity 不等于成长
- percent 容易制造虚假精确感

如果后续需要 week-over-week，单独设计。

---

## 6. Weekly Recap 数据源

只能使用 0.70.0 已建立的数据层：

```text
GET /api/account/growth/history
+
current Growth Overview（如需要当前 next action）
```

不要：

- 再扫描一套 userdata
- 在前端重新推导 PB / FC / Goal
- 再写一套 Weekly 专用历史规则

---

## 7. Weekly Recap 不新增第二套事实定义

Canonical facts 继续是：

- played
- score-pb
- ng-reduced
- combo-improved
- clear
- fc
- df
- rank-upgrade
- goal-completed

Weekly 只做：

```text
selection
ranking
composition
narrative
```

不重新定义事实。

---

## 8. Weekly Recap 的四层结构

建议固定为：

### Layer 1 — 主变化

这一周最值得说的一件事。

### Layer 2 — 2–4 个重要事实

具体谱面 / Goal / Crown / PB。

### Layer 3 — 周初 → 周末 Player State

只有 measurement 足够且版本兼容时展示。

### Layer 4 — 自然的下一步

复用当前 Growth Overview 的 focus / Today Plan。

---

## 9. 主变化不是固定 KPI

主变化必须由事实推导。

候选类型：

```text
accuracy/stability
score breakthrough
new crown
rank breakthrough
goal follow-through
broad activity
balanced/no dominant change
limited coverage
```

不要第一版就用生成式 AI 写主结论。

优先 deterministic rule-based composer。

---

## 10. 主变化选择原则

优先级不是固定“FC > PB > Goal”。

需要考虑：

- fact count
- magnitude
- distinct charts
- Goal relation
- repeated pattern
- measurement support

例如：

```text
5 张谱 NG 均下降
```

可能比：

```text
1 张谱 +500 分 PB
```

更适合作为：

> “这周打得更稳了。”

---

## 11. 不要把 activity 当 progress

例如：

```text
本周打了 42 张谱
```

只能表达：

> “这周打得不少。”

不能直接写：

> “这周进步很明显。”

成长结论必须由：

- PB
- NG
- crown
- rank
- Goal
- compatible measurement delta

支持。

---

## 12. 主变化需要 Evidence Bundle

建议 composer 先产生：

```ts
WeeklyThemeCandidate {
  theme
  score
  supportingFactKeys[]
  supportingMeasurementIds[]
  confidence
}
```

最终 narrative 只能引用 bundle 内的证据。

避免：

```text
先写文案
→ 再去找理由
```

---

## 13. 不做“AI Coach”式口吻

避免：

```text
你本周表现非常优秀！
你成功突破自我！
继续保持！
```

优先：

```text
这周最明显的是精度更稳了。
```

或：

```text
这周没有特别集中的变化，但打过的谱面更广了。
```

---

## 14. Weekly Facts Priority

Weekly 事实排序建议综合：

### A. 强事实

- DF
- FC
- clear
- rank upgrade
- Goal completed

### B. 大量重复趋势

- 多张谱 NG reduced
- 多张谱 PB

### C. magnitude

PB delta 较大、
NG reduction 较明显。

但本版不要先定义任意：

```text
+10,000 = 大 PB
```

可使用相对排序，而不是绝对阈值。

---

## 15. PB 重要性按“本周相对排序”

例如本周 PB：

```text
+7130
+2200
+1840
+310
```

可以选 top 1–2。

不要马上定义全局“大 PB”阈值。

---

## 16. NG 变化同理

本周：

```text
8→4
14→7
3→2
```

可以优先展示：

- absolute reduction
- reduction ratio
- 是否伴随 PB / crown

但不要写百分比进步。

---

## 17. Crown Facts

优先展示：

```text
新 DF
新 FC
首次 Clear
```

如果同谱：

```text
Clear → FC → DF
```

在周级 presentation 可以收敛成最高状态：

```text
这周在 ○○○ 拿到全良
```

canonical facts 不删除。

---

## 18. Rank Facts

展示：

```text
评价 6 → 7
```

使用现有 rank label mapping。

不要叫：

```text
段位提升
```

---

## 19. Goal Completed

Goal fact 的价值是：

> 玩家自己选下的练习目标，后来确实完成了。

Weekly 可以表达：

```text
这周完成了 2 次自己选下的练习目标
```

并可选一个具体例子：

```text
Fallen Angel
不可 8 → 4
```

但不能把 Goal `completedAt` 当游玩日。

---

## 20. Goal Fact 是否进入某自然周

只有当 Goal fact 有足够：

```text
attributedDay
```

或匹配到同周 score fact 时，才能归入：

> “本周完成”

否则：

- 可以在“最近确认的 Goal”中出现
- 但不要硬塞进周 score timeline

0.70.0 已明确 Goal fact 默认 precision=observation。

---

## 21. Weekly Goal Attribution Bridge

建议建立纯函数：

```text
matchGoalFactToScoreFact()
```

匹配：

- same binding
- same song
- same difficulty
- compatible fact type
- compatible before/after
- score fact attributedDay 在 weekly window

匹配成功：

Goal 可以安全归入该周。

匹配失败：

不做周归因。

---

## 22. Measurement 只比较兼容版本

周初 / 周末 measurement 只有在：

```text
same algorithmVersion
same modelRevision
```

时，才允许直接计算：

```text
rating delta
dimension delta
focus change
```

---

## 23. 跨 modelRevision 不直接画连续变化

如果：

```text
周三 modelRevision 改了
```

不要输出：

```text
精度力 +0.12
```

因为可能是模型/常量变化。

显示：

```text
本周测量口径发生更新，
能力趋势暂不做直接比较。
```

或隐藏 delta。

---

## 24. Measurement Coverage 门槛

至少需要：

```text
start measurement
end measurement
```

且两者版本兼容。

否则：

```text
这周还没有足够的连续能力记录
```

不要使用当前算法回算周初。

---

## 25. Measurement 选择

周初 measurement：

> window 内最早有效 measurement。

周末/current：

> window 内最新有效 measurement。

如果当前周尚未结束：

称：

```text
周初 → 现在
```

不是：

```text
周初 → 周末
```

---

## 26. 六维不全部展示 delta

不要做报表式：

```text
大歌 +0.01
体力 -0.02
高速 +0.03
精度 +0.12
节奏 +0.01
复合 -0.01
```

优先只呈现：

- 最大可信变化
- focus 是否变化
- Rating 总体变化（如有意义）

完整六维可作为次级 visual。

---

## 27. 负变化不要自动解释成“退步”

第一版避免：

> “你退步了。”

可以表达为：

```text
某项测量略有回落
```

但必须基于兼容 measurement。

---

## 28. Focus Change

如果：

```text
周初 focus = accuracy
周末 focus = rhythm
```

可以写：

```text
当前更值得关注的方向从精度转到了节奏。
```

这是 state change，不是宣称“精度练好了”。

---

## 29. Balanced / Limited

### Balanced

```text
这周整体比较均衡，没有特别突出的短板变化。
```

### Limited

```text
这周的成绩记录还不足以形成稳定的能力趋势。
```

不要强行生成 theme。

---

## 30. Coverage 优先于漂亮文案

如果：

```text
coverage.scoreHistoryState = truncated / partial / unknown
```

Weekly 必须明确降级。

例如：

```text
这周记录不完整，下面只展示能确认的变化。
```

不要输出带全量暗示的统计语气。

---

## 31. Coverage UI 要轻

不要红色 Warning Card。

可以小字：

```text
部分历史记录不可用
```

---

## 32. Weekly Recap API

优先服务端 compose：

```text
buildWeeklyGrowthRecap(...)
```

建议：

```text
GET /api/account/growth/weekly
```

服务端负责业务排序与证据组合；前端只做呈现和 i18n。

---

## 33. Weekly API 概念输出

```ts
{
  profileId,

  week: {
    from,
    to,
    isCompleteWeek
  },

  coverage,

  theme: {
    type,
    evidenceFactKeys
  } | null,

  highlights: [...],

  measurementChange: {
    start,
    end,
    compatible,
    ratingDelta?,
    dimensionDeltas?,
    focusFrom?,
    focusTo?
  } | null,

  totals: {
    distinctCharts,
    pb,
    fc,
    df,
    rankUpgrade,
    completedGoals
  },

  currentNextAction: {
    focus,
    todayPlan
  }
}
```

Totals 是 supporting metadata，不是页面主角。

---

## 34. 不保存 Weekly Recap

第一版 Weekly Recap derived-on-read。

不要新建：

```text
web_weekly_recaps
```

因为 facts/measurements 已经是底层数据。

---

## 35. Weekly Page

建议路由：

```text
/my/weekly
```

或当前 IA 下等价的 Growth 子页面。

它属于：

> 我的太鼓 / 我的成长

不放进 `/tools`。

---

## 36. Home Entry

首页只增加轻入口：

```text
看看这周
```

或：

```text
这一周
```

不要把整个 Weekly Recap 塞回 Home。

---

## 37. Mobile 页面结构

推荐：

```text
本周 · 截至今天

[一句主变化]

[1 个最重要事实]
[2–3 个次要事实]

[能力变化]
周初 → 现在

[这周完成的 Goal]

[接下来]
当前 focus + Today Plan entry
```

不是 KPI Grid。

---

## 38. Desktop 不做 Dashboard 化

保持：

- 单列主叙事
- 辅助 visual
- 有节奏留白

不要因为空间大就铺 3×3 Card Grid。

---

## 39. 六维 Visual

如果使用：

优先做：

```text
week start vs now
```

的小型对比。

不要把雷达图作为唯一主角。

版本不兼容时不画 delta overlay。

---

## 40. Song Highlight

最多 3–4 张。

每张只突出一个 meaningful fact。

例如：

```text
Fallen Angel
魔王 9★
不可 8 → 4
```

---

## 41. Quiet Week

没有明显成长 facts 时：

不要显示 0 KPI。

可用：

```text
这周还比较安静
```

若有普通游玩：

```text
这周主要是在熟悉谱面，
还没有出现特别明显的突破。
```

完全无游玩：

```text
这周还没有新的游玩记录。
```

---

## 42. Limited Coverage Empty State

如果无事实来自 coverage 不完整：

不要写“这周没有进步”。

写：

```text
这周可确认的记录还不够完整。
```

---

## 43. Next Action

周报底部复用当前 Growth：

```text
最近仍可以从精度入手
```

或：

```text
现在可以试试这几首
```

不计算第二套 weekly recommendations。

---

## 44. 分享功能暂缓

0.70.1 不做 share poster。

先验证 recap 内容质量。

---

## 45. i18n

zh / ja 独立自然化。

不要机械翻译 “Weekly Growth Recap”。

中文优先：

```text
这一周
```

---

## 46. Tests — Theme Selection

至少：

- PB dominant
- NG dominant
- crown dominant
- Goal dominant
- broad mixed growth
- quiet week
- no play
- limited coverage
- balanced measurement
- focus change

---

## 47. Tests — Highlights

至少：

- same song multi-fact
- highest PB delta
- multiple FC/DF
- Goal + matching score fact
- duplicate facts
- stable ordering
- max highlight count

---

## 48. Tests — Measurement

至少：

- compatible start/end
- no start
- one measurement only
- algorithm mismatch
- modelRevision mismatch
- balanced → focus
- focus → balanced
- limited

---

## 49. Tests — Coverage

至少：

- complete
- partial
- truncated
- unknown
- manual

文案与 totals 行为必须符合 coverage。

---

## 50. Browser Matrix

至少：

1. rich week
2. PB-dominant
3. crown-dominant
4. Goal-dominant
5. measurement focus change
6. quiet week
7. no play
8. partial coverage
9. truncated
10. limited
11. balanced
12. model revision break

覆盖：

- zh / ja
- mobile / desktop
- light / dark（如果现有 runner 成本可接受）

---

## 51. Browser 验收重点

- 无 KPI Grid
- 主变化只有一个主焦点
- highlight ≤ 4
- coverage 提示轻量
- no raw key
- no overflow
- no hydration error
- mobile 不像报告卡片堆叠
- desktop 不变 Dashboard
- Today Plan 能自然进入下一步

---

## 52. Production Smoke

隔离生产账号构造：

### Scenario A — rich week

- PB
- NG
- FC
- Goal completed
- start/end compatible measurements

验证：

- theme
- highlights
- measurement change
- next action

### Scenario B — incomplete coverage

验证：

- 降级文案
- 不做全量断言

最终清理全部临时数据。

---

## 53. Performance

记录：

- History API
- Weekly compose
- total weekly endpoint
- measurement reads
- fact count

Weekly endpoint 不应重新跑一遍历史事实规则。

如果为了 current focus / Today Plan 需要 Growth compute：

> 单次 Weekly 页面最多 1 次 Growth Python compute。

---

## 54. No New DB Table

本版原则：

```text
NO WEEKLY TABLE
NO NEW FACT TABLE
```

若发现必须持久化 recap，先停下说明原因。

---

## 55. Privacy

Weekly endpoint：

- authenticated
- current binding only
- private/no-store
- no arbitrary profile selector

---

## 56. Existing Loop Regression

必须保持：

- Goal create
- evaluate
- Growth refresh
- no-reload next Goal
- Daily Progress
- History API
- measurement capture

全部回归。

---

## 57. Completion Blockers

任一存在不得关闭：

- Weekly 重新发明 canonical fact 规则
- 用 completedAt 伪装 Goal 游玩日
- measurement 跨版本直接算 delta
- coverage 不完整却使用全量统计语气
- activity 被写成 progress
- 页面退化成 KPI Dashboard
- Weekly 触发多次 Python compute
- 前端自行推导 canonical facts
- 新建不必要 weekly persistence
- production smoke 未通过
- Goal / Daily / History regression

---

## 58. 最终报告必须回答

1. 实施开始 / 最终版本？
2. weekly window？
3. partial week 如何标识？
4. Weekly API contract？
5. theme selection rule？
6. evidence bundle？
7. highlights selection？
8. totals 是否主展示？
9. Goal 如何归入 week？
10. completedAt 是否用于周归因？
11. measurement start/end？
12. algorithm/model mismatch？
13. Rating / dimension delta？
14. focus change？
15. quiet week？
16. no play？
17. partial/truncated coverage？
18. manual？
19. 页面路由？
20. Home entry？
21. mobile layout？
22. desktop layout？
23. 是否 KPI Grid？
24. Weekly endpoint Python 次数？
25. endpoint 性能？
26. browser matrix？
27. production smoke？
28. cleanup/orphan？
29. Goal loop regression？
30. History Foundation regression？
31. 是否 READY FOR 0.70.2 Skill Passport？

---

## 59. 完成状态

全部 Gate 通过后记录：

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

---

## 60. 0.70.2 预留

Skill Passport 不再回答：

> “这一周发生了什么？”

而是：

> **“过去一段时间，我的能力结构是怎么变化的？”**

它将基于：

- longitudinal measurements
- focus transitions
- important facts
- Goal completions
- version boundaries
- coverage

形成真正的长期成长账户。
