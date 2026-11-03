# Sakura Taiko Viewer 0.80.1
# Growth Passport Temporal UX Closure
# 成长档案时间语义 / 趋势图 / 关注方向 / 周期节点收口
# Standalone Codex Brief

> 建议在新的 Codex 对话中执行本阶段。本文是独立主控文档，不依赖此前聊天记录。
> 当前已知生产基线：Viewer `0.80.0`。开工前必须重新核对 canonical version；若仓库已经前进，不得降级。

---

# 0. 为什么需要这一阶段

0.80.0 已完成 Growth Product Voice System，解决了系统化、prompt-like、重复和技术泄漏型文案，但成长档案本身仍存在明显的**时间语义与信息架构问题**：

1. `30 / 90 / 180 / 365 天` 周期选择消失；
2. 趋势图名义上展示趋势，但大量情况下只出现散点；
3. Rating tooltip 同时混入 `focus`（例如“高速处理”），用户无法理解它和主指标的关系；
4. “记录方式更新过”脱离图表上下文后仍难以理解；
5. “最近的节点”退化为 `latest N`，例如 8 条全部来自同一天、全部是 PB；
6. Passport milestones 与 Recent Growth 职责开始重叠；
7. 成长档案失去“在一段时间内回看自己的变化”的档案感。

本阶段不是 Chart Polish，而是重新建立：

# `Growth Passport Temporal UX`

让成长档案真正回答：

> **在我选择的这段时间里，我的能力结构、关注方向和重要成长节点是怎么变化的？**

---

# 1. 产品职责重新锁定

```text
Recent Growth
→ 最近刚同步发生了什么？

Daily Progress
→ 今天发生了什么？

Weekly Growth Recap
→ 这一周发生了什么？

Growth Passport
→ 在我选择的这段时间里，
   能力结构、关注方向与重要节点如何变化？
```

Passport 禁止再次退化为 `Recent Growth 的长列表版`。

---

# 2. 版本

开工前核对：

```text
package.json
→ nuxt.config.ts
→ runtimeConfig.public.appVersion
→ /more
```

若 canonical 仍为 `0.80.0`，本阶段建议发布 `0.80.1`。

本阶段属于现有 Passport 的 UX / projection closure，不新增独立产品能力，因此 patch 合理。

---

# 3. 四个核心目标

```text
A. GLOBAL PERIOD SEMANTICS
   30 / 90 / 180 / 365 控制整个档案时间窗口

B. SEGMENTED TREND VISUALIZATION
   同计算段连线，跨计算段断开

C. FOCUS TRAJECTORY SEPARATION
   关注方向从数值 Tooltip 中拆出

D. PERIOD-AWARE MILESTONE CURATION
   从整个周期挑代表性节点，而不是 latest N
```

---

# 4. 明确不做什么

默认：

- NO new Growth algorithm
- NO Rating algorithm change
- NO six-dimension algorithm change
- NO recommendation ranking change
- NO Goal evidence change
- NO Daily/Weekly fact rule change
- NO historical six-dimension recompute
- NO fake cross-segment interpolation
- NO Session inference
- NO all-time claim
- NO new DB table by default
- NO materialized milestone table by default

---

# Part I — 开工前数据流 / 成本审计

## 5. 必须先输出审计文档

编码前创建：

`docs/growth-passport-temporal-ux-audit.md`

必须回答：

1. 当前 Passport route / component / composable / endpoint 链路；
2. 当前 range 状态在哪里保存；
3. 当前为什么没有 30/90/180/365 selector；
4. 当前 trend 数据到底返回多长窗口；
5. 当前 milestone 为什么固定最近 90 天；
6. milestone 当前是否 `latest N`；
7. current focus 为什么进入 point tooltip；
8. measurement segment 的现有结构；
9. public Growth History 为什么限制 90 天；
10. Passport 是否可以独立安全读取 180/365 天 canonical facts；
11. 365 天 replay 在真实/合成上限下的成本；
12. range switch 是否会重复 Growth Python compute；
13. range switch 是否会重复 history replay；
14. 是否可以一次 365 天 replay 派生 30/90/180/365 四个 projection；
15. 2,000 history files bound 对 180/365 天覆盖的真实影响。

审计没有完成前，不进入 UI 实现。

---

# 6. Performance / Cost Gate

至少比较两种架构。

## Architecture A — Single 365-day corpus

```text
initial Passport load
├─ current Growth compute       <=1
├─ measurement query            <=1
├─ raw/canonical history replay <=1, max 365d
├─ derive 30/90/180/365 windows in memory
└─ range switch                 0 network / 0 Python / 0 replay
```

优点：range switch 即时、不重复 Python、不重复 history replay、四个 period 来自同一 corpus。

必须评估：response bytes、serialization cost、client memory、365d history replay cost。

## Architecture B — Initial + lightweight period projection

```text
initial Passport
├─ current Growth compute <=1

range switch
├─ 1 lightweight range request
├─ Python = 0
├─ current Growth recompute = 0
└─ one bounded history projection
```

只有 Architecture A 的 payload / replay 明显过大，才考虑 B。

---

# 7. 架构选择原则

优先：

> **one bounded replay → many cheap projections**

禁止：

```text
30d replay
+ 90d replay
+ 180d replay
+ 365d replay
```

禁止：

```text
range click
→ Passport endpoint
→ 每次重新跑 Growth Python
```

---

# 8. 性能预算

### Initial Passport

```text
Python Growth compute <= 1
history replay <= 1
measurement query <= 1
no duplicate Overview request
```

### Range switch

优选：

```text
network = 0
Python = 0
history replay = 0
```

若采用 Architecture B：

```text
network = 1
Python = 0
history replay <= 1 bounded
```

### Composition

```text
period projection + milestone curation
目标 < 30 ms
```

超预算必须在最终报告解释。

---

# Part II — Global Period Semantics

## 9. 恢复固定四档周期选择

成长档案必须始终保留：

```text
30 天
90 天
180 天
365 天
```

不要再根据 measurement coverage 隐藏这些选项。

原因：

```text
用户想观察多大的时间窗口
≠
系统实际积累了多少记录
```

---

# 10. 默认周期 / Route Contract

默认：`90 天`

建议：

```text
/my/growth?range=90
```

允许：`30 / 90 / 180 / 365`。

非法值 fail closed 到 90；selected state 必须与实际 active range 一致。

---

# 11. Range 是全局档案上下文

选择 `180 天` 后，以下内容都必须使用同一个 180 天 window：

- period summary
- Rating trend
- six-dimension trend
- focus trajectory
- milestones
- period coverage text

例如：

```text
过去 180 天 · 实际记录 42 天
```

---

# 12. 当前状态不受 period 伪装

以下仍然表示“现在”：

- current Rating
- current six dimensions
- current focus
- active Goal
- next action / Today Plan

不要因为选择 365 天，就把 current state 伪装成 365 天平均值。

页面明确区分：

```text
现在的我
```

和：

```text
这段时间
```

---

# 13. Period axis 必须真实

即使用户只有 4 天 measurement：

选择 365 天时仍应表达：

```text
过去 365 天 · 实际记录 4 天
```

趋势图 x-axis 对应选中的完整窗口，不偷偷缩到 4 天数据范围，也不 fake extrapolation。

这样即使不同周期内的数据点相同，用户也能理解观察窗口发生了变化。

---

# 14. Range UI

建议：

```text
这段时间

[30 天] [90 天] [180 天] [365 天]

过去 90 天 · 实际记录 4 天
```

选中态清楚，但 selector 不得占据一整屏。

---

# Part III — Trend Visualization

## 15. Rating 与六维分开

不要直接把 `Rating + 六维` 做成七条同等彩线。

推荐信息架构：

```text
Rating 趋势
+
六维趋势总览
```

Rating 是综合量；六维共享同一 0–15 能力量纲。

---

# 16. Rating Trend

- 同 segment 内连续折线；
- segment 内只有 1 个点则显示点；
- 不跨 segment 连线；
- 不对缺失日期插值；
- tooltip 只显示日期 + Rating；
- 不在 tooltip 混入 focus。

示例：

```text
10月7日
Rating 10.28
```

---

# 17. Six-dimension Trend

必须展示多维度趋势，不再只靠单维 selector 才能理解能力结构。

优先实现：同图六维 contextual chart。

规则：

- 大歌 / 体力 / 高速 / 精度 / 节奏 / 复合；
- 共用 0–15 scale；
- 默认六条趋势存在；
- 当前点选维度高对比；
- 其余维度降低对比但保留上下文；
- legend 可点击 / 键盘选择 highlight；
- 不要求一次只剩一条线。

如果 390px 实际验收出现“彩线面条图”，允许改为 six small multiples：2×3 或 compact 单列 sparkline，共用相同 y scale。

最终形式必须由真实浏览器视觉验收决定。

---

# 18. 不跨 Segment 连线

继续使用现有 segment key：

```text
measurementVersion
+
algorithmVersion
+
modelRevision
```

严格保持：

```text
same segment → can connect
different segment → break
```

禁止为了好看跨 segment 插值或连线。

---

# 19. Segment Break 必须和图发生关系

不要再把：

```text
记录方式更新过
```

孤立成正文大标题。

在实际断线附近提供轻提示：

```text
计算方式在这里更新
```

或：

```text
这里之后使用新的计算方式
```

并提供：

```text
为什么断开？
```

展开：

> 更新前后的能力数值使用了不同计算方式，因此不会直接连线比较；每一段内部的变化仍然可以查看。

普通 UI 不出现 raw modelRevision / SHA。

---

# 20. Trend Summary

趋势图上方给一句用户可理解的 summary。

例如：

```text
最近几次记录里，Rating 基本保持在 10.28。
```

或在证据充分时：

```text
这段时间里，精度和高速处理的变化更明显。
```

如果没有可比 segment：

```text
记录还在积累，先看看已经留下的变化。
```

---

# Part IV — Focus Trajectory

## 21. Focus 不再进入数值 Tooltip

禁止：

```text
10月7日 · Rating 10.28
高速处理
```

主图 tooltip 只描述主图指标。

---

# 22. Focus 独立成“关注方向轨迹”

例如：

```text
关注方向

精度力 ─────────→ 高速处理
```

或：

```text
9月20日      9月28日      10月7日
精度力 ───── 精度力 ───── 高速处理
```

继续使用既有 run-length compression。

---

# 23. Focus Wording

用户可见：

- 关注方向
- 最近更值得留意的方向

不要默认称：

- 短板
- 弱项
- 退步

最低维不等于时间上退步，focus change 也不代表旧方向已经解决。

---

# 24. Focus 与 Segment Break

focus timeline 可以跨时间展示状态变化，但：

- measurement comparison 仍不能跨 segment；
- focus run 在 segment break 处保留视觉断点/标记；
- 不把 focus change 当作能力改善的因果结论。

---

# Part V — Period-aware Milestone Curation

## 25. “最近的节点”改成周期语义

建议标题：

```text
这段时间留下的节点
```

副说明：

```text
过去 90 天
```

不要以“最近 8 项”作为主要信息架构。

---

# 26. Candidate Facts 仍来自 Canonical Facts

继续使用：

- score-pb
- ng-reduced
- combo-improved
- clear
- fc
- df
- rank-upgrade
- goal-completed

不得另起第二套事实规则。

---

# 27. 禁止 latest N

禁止：

```text
sort by date desc
limit 8
```

截图里同一天 8 条 PB 全部占满 timeline，就是必须消除的回归样例。

---

# 28. 先按同谱同日合并

同一天同一 chart：

```text
PB
NG reduced
FC
```

合并成一个 milestone：

```text
HIMAWARI HAPPY
全连
不可 1 → 0 · 最好成绩 995,440
```

Canonical facts 仍然独立保留。

---

# 29. Milestone Selection 三个维度

必须同时考虑：

```text
importance
+
diversity
+
temporal coverage
```

不是单纯 recency。

---

# 30. Importance

建议 presentation selection priority：

```text
DF
FC
首次 clear
rank upgrade
Goal-linked completion
large relative PB
large relative NG reduction
combo
ordinary PB
played
```

注意：

- 不设武断绝对 PB threshold；
- PB/NG magnitude 使用周期内相对排序；
- selection score 只用于内部挑选，不显示给用户。

---

# 31. Diversity

默认约束：

```text
同一天最多 2 个代表节点
同一 chart 最多 1 个 milestone（同谱同日事实合并）
同一种主要类型默认不超过 3 个
优先保留不同事实类型
```

如果整个周期真实只有一种事实类型，可放宽类型限制，但不得为了“多样”制造不存在的类型。

---

# 32. Temporal Coverage

节点必须铺开到整个选中周期。

建议按 range 等分 bucket：

```text
30d  → 3 × 10d
90d  → 3 × 30d
180d → 3 × 60d
365d → 4 × ~quarter
```

选择流程：

1. 每个有候选事实的 bucket 优先保留至少 1 个高质量 milestone；
2. 再按全局 importance/diversity 填剩余 slots；
3. 同一天/同谱限制继续生效。

目标：365 天档案不能全部来自最后一周。

---

# 33. Milestone 数量

建议上限：

```text
30d  → 6
90d  → 8
180d → 10
365d → 12
```

不是必须凑满。只有 3 个真正有意义的节点，就显示 3 个，不用低价值事件填满。

---

# 34. Goal Milestone

Goal completed 可以作为高价值节点，但继续遵循既有时间语义：

- 能匹配 score fact → 使用对应 play day；
- 无法匹配 → observation-time milestone；
- 不用 completedAt 冒充真实游玩日。

---

# 35. Milestone 文案

继续遵守 0.80.0 Voice System，事实为主。

例如：

```text
10月6日

HIMAWARI HAPPY
全连
不可 1 → 0 · 最好成绩 995,440
```

不要加入“巨大突破”等无依据鼓励。

---

# Part VI — 180 / 365 天事实能力

## 36. 这是本阶段最重要的数据 Gate

当前公开 Growth History 有 90 天范围限制。

不能：

```text
365 天 Passport
+
最近 90 天 milestone
```

再让用户误以为节点覆盖 365 天。

---

# 37. 不自动扩大 Public History API

默认不要把：

```text
GET /api/account/growth/history
```

公共上限从 90 直接改到 365。

Passport 可以使用内部专用 projection path，以免改变已有 consumer/performance contract。

---

# 38. 优先数据方案

新增/扩展 internal service，例如：

```text
getGrowthHistoryForPassport(...)
```

或让底层 canonical replay service 支持 `maxDays=365`，但 public History endpoint 仍保持 90d。

Passport 只读使用。

---

# 39. One-pass 365 Replay

目标：

```text
load bounded history once
→ canonical replay once
→ facts for <=365d
→ derive 30/90/180/365 milestone candidates
```

不得每个 range replay 一次。

---

# 40. 2,000-file Bound

继续尊重现有 loader bound。

如果 365 天窗口因 `>2000 history files` 截断：

```text
coverage = truncated
```

用户侧 secondary disclosure：

> 这段时间较早的一部分记录没有保留下来，节点只显示能确认的部分。

不要声称完整 365 天。

---

# 41. 如果 365 天 Replay 不可接受

如果 benchmark 证明 wall time / RSS / IO / payload 不可接受：

停止实施 365 milestone expansion，提交审计结果和替代架构设计。

可以讨论：

- lightweight fact index
- incremental projection cache

但未经新审计不得直接新建表。

---

# Part VII — API / DTO

## 42. 推荐 Temporal Payload

概念：

```ts
type PassportTemporalPayload = {
  current: CurrentGrowthState
  availableRanges: [30, 90, 180, 365]
  defaultRange: 90
  measurementCoverage: {
    from: string | null
    to: string | null
    measurementDays: number
  }
  historicalCoverage: {
    state: 'complete' | 'partial' | 'truncated' | 'unknown'
    from: string | null
    to: string | null
  }
  measurementSeries: DailyMeasurementPoint[]
  periodViews: {
    30: PassportPeriodView
    90: PassportPeriodView
    180: PassportPeriodView
    365: PassportPeriodView
  }
}
```

---

# 43. Period View

概念：

```ts
type PassportPeriodView = {
  days: 30 | 90 | 180 | 365
  from: string
  to: string
  recordedDays: number
  trendSummary: unknown
  currentSegmentChange: unknown
  focusTimeline: unknown
  milestoneIds: string[]
  milestoneCoverage: unknown
}
```

字段命名可按现有代码，但核心约束是：

> 四个 range 来自同一 bounded corpus，不是四次独立重算。

---

# 44. Payload 去重

如果 Architecture A：

不要在四个 periodView 中复制完整 measurement points 四遍。

优先：

```text
shared measurementSeries
+
period boundaries
```

Milestone 可以使用：

```text
milestone dictionary
+
period milestoneIds
```

减少 payload。

---

# Part VIII — Page Information Architecture

## 45. 推荐最终页面顺序

```text
成长档案
记录自 2026.09.19

现在的我
Rating / current focus / 六维

────────────────

这段时间

[30天] [90天] [180天] [365天]
过去 90 天 · 实际记录 37 天

一句 period summary

Rating 趋势
[segmented line chart]

六维变化
[multi-dimensional trend]

────────────────

关注方向
[focus trajectory]

────────────────

这段时间留下的节点
[period-aware curated timeline]

────────────────

接下来
[current Goal / Today Plan / current focus]
```

---

# 46. 不让控件统治页面

Range selector 和 legend 是控制工具，不应比 period summary / chart / milestone 视觉权重更大。

继续保持：

> narrative-first, controls-secondary

---

# Part IX — 图表交互

## 47. Tooltip

Rating：

```text
10月7日
Rating 10.28
```

Dimension：

```text
10月7日
高速处理 9.64
```

不要显示 focus / modelRevision / algorithmVersion / raw segment key。

---

# 48. Segment Break Interaction

断线附近可显示：

```text
计算方式更新
```

点击/键盘：

```text
为什么这里断开？
```

展开：

> 前后的能力值使用了不同计算方式，因此不直接连线比较。

---

# 49. Touch / Keyboard

移动端：

- tap point → tooltip
- tap legend → highlight dimension
- tap outside → dismiss

桌面：

- hover + keyboard focus
- legend keyboard selectable

不得只靠颜色表达 segment break / selected dimension。

---

# Part X — Voice System Regression

## 50. 继续遵守 0.80.0 Growth Product Voice

保持：

- observation before interpretation
- weak evidence → weaker wording
- invitation not command
- no fake encouragement
- no raw technical IDs
- focus ≠ weakness regression
- no Session claim

---

# 51. “记录方式更新过”的修正

不再作为孤立 section headline。

改为图中断点原因说明。

推荐主文案：

```text
这里之后使用了新的计算方式
```

secondary：

```text
前后的能力数值不会直接比较。
```

需要最终 zh/ja 人工审阅。

---

# Part XI — Unit / Integration Tests

## 52. Range Contract

必须证明：

```text
30 → global period = 30
90 → global period = 90
180 → global period = 180
365 → global period = 365
```

并同时影响：summary / trend / focus / milestones / coverage copy。

---

# 53. Trend Tests

至少：

1. one segment, 1 point
2. one segment, 2 points → line
3. one segment, many points
4. two segments → physical gap
5. 3+ segments
6. out-of-order measurement input
7. same-day representative
8. stable Rating
9. positive change
10. negative change
11. limited
12. missing dimension
13. six-dimension chart
14. selected/highlighted dimension
15. tooltip has no focus

---

# 54. Focus Tests

至少：

1. same focus run
2. focus transition
3. balanced
4. limited
5. segment break
6. repeated same-day focus
7. no focus
8. focus not injected into numeric tooltip

---

# 55. Milestone Tests

至少：

1. 8 same-day PBs
2. same-song PB + NG + FC merge
3. DF + PB
4. Goal + score match
5. unmatched Goal
6. rank upgrade
7. 30d spread
8. 90d spread
9. 180d spread
10. 365d quarterly spread
11. single event type only
12. sparse period
13. truncated coverage
14. same-day max
15. same-chart max
16. stable deterministic ordering

核心 regression fixture：

```text
10月6日 8 个 PB
+
9月一个 FC
+
8月一个 Goal
+
7月一个 rank
```

365d / 180d 结果不得被 10月6日 8 个 PB 全部占满。

---

# Part XII — Browser Matrix

## 56. Minimum Scenarios

### Period

1. 4 recorded days, select 30
2. 4 recorded days, select 90
3. 4 recorded days, select 180
4. 4 recorded days, select 365
5. 120 recorded days
6. 365 recorded days

### Trend

7. single segment
8. model break
9. multiple breaks
10. six-dimension trend
11. dimension highlight
12. stable Rating

### Focus

13. same focus
14. focus change
15. balanced / limited

### Milestones

16. same-day PB flood
17. mixed milestones across period
18. sparse milestones
19. truncated 365d

覆盖：

- zh / ja
- 390px mobile
- 1440px desktop
- representative light/dark

不必机械做完整笛卡尔积，但关键 mobile 场景必须真实覆盖。

---

# 57. Screenshot Human Review

至少复核：

- 390px zh
- 390px ja
- 1440px zh
- dark representative

重点：

1. range selector 是否清楚；
2. 4 天数据选择 365 时是否仍能理解；
3. line 是否真的表达趋势；
4. segment break 是否自然；
5. tooltip 是否只说指标；
6. focus trajectory 是否能独立看懂；
7. six-dim chart 是否过密；
8. milestone 是否分布在周期中；
9. milestone 是否有类型多样性；
10. 页面是否仍像“最近更新列表”。

---

# Part XIII — Performance Tests

## 58. Real / Synthetic Benchmark

至少测试：

```text
30d
90d
180d
365d
2000-file synthetic bound
```

记录：

- files loaded
- snapshots
- facts
- measurement rows
- history load ms
- canonical replay ms
- period projection ms
- milestone curation ms
- serialization ms
- response bytes
- max RSS

---

# 59. Interaction Performance

记录：

### initial load

- API count
- Python count
- history replay count
- visible time

### switch 30→90→180→365

- network count
- Python count
- replay count
- interaction latency

目标：

```text
no full page reload
no duplicate Growth compute
no four-range replay
```

---

# Part XIV — Production Smoke

## 60. Isolated Synthetic Account

构造：

- measurement across multiple dates
- at least 2 model segments
- focus transition
- old + recent PB
- FC
- DF or clear
- rank upgrade
- completed Goal
- multiple PBs on same recent day
- enough historical dates for 30/90/180/365 differentiation

---

# 61. Production Verification

线上验证每个 period 的：

- selected state
- period label
- trend window
- milestone set
- focus window

以及：

- segment line break
- focus absent from metric tooltip
- old milestone appears in 180/365 when eligible
- latest same-day PB flood does not占满 timeline
- current state remains current
- no raw technical identifiers

---

# 62. Cleanup

生产 synthetic account 相关：

- user
- binding
- session
- Goal
- measurement
- cursor（若现有 lifecycle 关联）
- userdata/history files

全部清理。

Orphan audit：

```text
Goal = 0
measurement = 0
owner mismatch = 0
```

本阶段若无新 DB，不新增 orphan 类型。

---

# Part XV — Existing Regression

## 63. 必须保持

- Goal create/evaluate
- Growth refresh
- no-reload next Goal
- Recent Growth
- Daily Progress
- Weekly Recap
- Growth History 90d public contract
- recommendation ranking
- measurement capture
- 0.80.0 Voice System
- zh/ja
- profile isolation
- version projection

---

# 64. 特别禁止回归

- Passport internal 365 projection ≠ public History contract 自动变 365；
- focus 不等于短板事实；
- 不跨 segment 连线；
- 不把 365d milestone 伪造成完整覆盖；
- 不为了多样性制造不存在的成就。

---

# Part XVI — Completion Blockers

## 65. 任一存在不得发布

- 30/90/180/365 仍不可切换
- selector state 与实际 period 不一致
- milestone 仍固定 recent90
- milestone 仍直接 latest N
- 同一天 PB 可以占满全部 timeline
- 180/365 没有真实 period-aware fact coverage
- 365 fact replay 性能未测
- range switch 重跑 Growth Python
- 四个 period 分别 replay
- 同 segment 有足够点却仍不连线
- 跨 segment 被连线
- focus 仍混在 metric tooltip
- “记录方式更新过”仍孤立成用户无法理解的大标题
- six-dimension trend mobile 不可读
- 365 selected 但 UI 暗示只有最近 90 天
- truncated coverage 没有披露
- Passport 仍像 Recent Growth 长列表
- 0.80 Voice regression
- production smoke 未通过

---

# Part XVII — Final Report

## 66. 必须回答的 42 项

1. start/final version？
2. temporal audit path？
3. current Passport range root cause？
4. final range state source？
5. 30/90/180/365 是否始终可选？
6. default range？
7. route/query contract？
8. global period 哪些 section 共用？
9. current state 是否保持 current？
10. 4-day + 365 UI 如何表达？
11. chosen architecture A/B？
12. initial Python count？
13. initial history replay count？
14. range switch network count？
15. range switch Python count？
16. range switch replay count？
17. 365 replay wall time？
18. max RSS？
19. response bytes？
20. 2000-file bound 结果？
21. public History 90d contract 是否保持？
22. Passport 365 facts 如何取得？
23. Rating trend 是否同 segment 连线？
24. segment break 如何表现？
25. single-point segment 如何表现？
26. six-dimension trend 最终形式？
27. mobile six-dimension 可读性？
28. tooltip 是否移除 focus？
29. focus trajectory 最终形式？
30. focus change 文案？
31. milestone candidate facts？
32. same-song/day merge？
33. milestone importance rule？
34. milestone diversity rule？
35. temporal coverage rule？
36. 30/90/180/365 milestone limits？
37. Goal milestone time semantics？
38. truncated milestone coverage？
39. browser matrix？
40. production smoke？
41. cleanup/orphan？
42. 是否可以关闭 Temporal UX Closure？

---

# Part XVIII — Completion State

## 67. 全部 Gate 通过后

```text
0.80.1 GROWTH PASSPORT TEMPORAL UX CLOSURE COMPLETE

GLOBAL 30 / 90 / 180 / 365 PERIOD SEMANTICS ESTABLISHED
PERIOD STATE CONTROLS SUMMARY / TREND / FOCUS / MILESTONES

SEGMENTED RATING TREND ACCEPTED
MULTI-DIMENSION GROWTH TREND ACCEPTED
NO CROSS-SEGMENT CONNECTION
SEGMENT BREAK EXPLANATION ACCEPTED

FOCUS TRAJECTORY SEPARATED FROM METRIC TOOLTIP
FOCUS ≠ WEAKNESS REGRESSION PRESERVED

PERIOD-AWARE MILESTONE CURATION ESTABLISHED
IMPORTANCE + DIVERSITY + TEMPORAL COVERAGE ACCEPTED
LATEST-N MILESTONE REGRESSION REMOVED
RECENT GROWTH / PASSPORT RESPONSIBILITY BOUNDARY RESTORED

365-DAY PASSPORT FACT PROJECTION PERFORMANCE ACCEPTED
PUBLIC 90-DAY HISTORY CONTRACT PRESERVED
NO DUPLICATED PYTHON COMPUTE
NO FOUR-RANGE HISTORY REPLAY

0.80.0 GROWTH VOICE SYSTEM REGRESSION ACCEPTED
GOAL / RECENT / DAILY / WEEKLY REGRESSION ACCEPTED

GROWTH PASSPORT NOW READS AS A TIME-BASED PERSONAL ARCHIVE
```

---

# 68. 最终产品标准

成长档案不再回答：

```text
最近更新了什么？
```

而是回答：

```text
在我选中的这段时间里：

我的 Rating 怎么走？
六维能力怎么一起变化？
什么时候更值得关注哪个方向？
哪些事情真正值得留在档案里？
```

这才是“成长档案”的核心语义。
