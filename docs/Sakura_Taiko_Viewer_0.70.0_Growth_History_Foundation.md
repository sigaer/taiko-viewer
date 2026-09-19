# Sakura Taiko Viewer 0.70.0
# Growth History Foundation
# Canonical Evidence → Durable Growth Timeline → Longitudinal State

## 0. 阶段定位

当前生产基线：

- Viewer：`0.69.3`
- `0.69.x Goal Feedback Loop`：COMPLETE
- Recommendation → Goal → Baseline → Evaluation → fresh Growth → Next Goal 已闭环
- Daily Progress 已有可靠日归因与历史重放
- Goal History 已有持久化的 active / cancelled / completed 行及 completion evidence
- Player State / 六维 / Rating 当前可实时计算
- Today Plan 当前可实时生成
- 当前缺少统一、长期、可追溯的“成长历史”数据层

下一阶段不先做漂亮周报，也不先做 Skill Passport UI。

先建立：

> **统一 Growth History：哪些成长事实已经发生、证据来自哪里、发生在什么时候、哪些状态是当时测量值。**

目标：

```text
Daily Progress evidence
+
Goal completion evidence
+
Player State measurements
+
Rating / six-dimension measurements
        ↓
Canonical Growth History
        ↓
0.70.1 Weekly Growth Recap
        ↓
0.70.2 Skill Passport
```

---

## 1. 产品问题

当前 Viewer 已能回答：

```text
我现在怎么样？
今天发生了什么？
这次想练什么？
这次有没有练成？
```

但还不能稳定回答：

```text
这周我主要进步了什么？
最近一个月哪些能力在变化？
我什么时候开始从“高速短板”转成“精度短板”？
哪些 PB / FC / DF / Goal 是重要里程碑？
我的六维长期趋势是什么？
```

0.70.0 只建立这些问题所需的数据基础。

---

## 2. 版本

实施开始前读取 canonical version：

```text
package.json
→ nuxt.config.ts
→ runtimeConfig.public.appVersion
→ /more
```

若生产仍为 `0.69.3`：

目标版本：

`0.70.0`

若已有新 patch：

不得回退，按真实版本确定。

---

## 3. 0.70.0 不做什么

本版默认不做：

- Weekly Recap 正式 UI
- Skill Passport 正式 UI
- 新推荐算法
- 新六维算法
- streak / XP
- 排名 / 排行榜
- 社交挑战
- 自动总结文案
- AI 评价“你变强了多少”
- Goal 新类型
- Daily Progress 算法改写
- 重写历史 score 文件

本版核心是：

```text
audit
→ canonical model
→ timeline service
→ longitudinal snapshots
→ idempotent persistence/projection
→ API / tests
```

---

## 4. 开工前必须做 Growth History Evidence Audit

先审计现有数据源，不先建表。

至少检查：

### A. Score History

- full / delta snapshot 结构
- `_meta.full`
- `_meta.ts`
- `highscore_datetime`
- `update_datetime`
- history 文件命名时间
- 当前 `deriveDailyProgress`
- 当前历史 replay harness
- 是否能跨多日重放
- 是否有 history retention / truncation
- 是否有 import / repair / backfill 路径

### B. Goal History

- `web_player_goals`
- cancelled / completed rows
- baseline evidence
- completion evidence
- source revision
- completed_at
- created_at
- evidence observationCapturedAt
- causal boundary

### C. Player State

- Rating
- 六维
- focus
- current recommendation basis
- Python compute input / algorithm version
- 是否能对历史 score revision 精确重算
- catalog / rating_structured /算法变动是否会导致“今天重算旧数据”与“当时结果”不同

### D. Account / Profile

- Web user
- binding identity
- rebind semantics
- unbind cleanup
- multiple profiles
- manual source
- Wahlap / Hiroba source
- data deletion lifecycle

最终必须输出：

`growth-history-evidence-audit.md`

---

## 5. 必须先区分两类历史数据

### Type A — Historical Facts

已经发生、可由 authoritative evidence 证明：

```text
played
score PB
NG reduced
combo improved
clear
FC
DF
rank upgrade
Goal completed
Goal cancelled（产品行为，不是成长成绩）
```

这些是：

> **fact**

可以从既有历史 / Goal evidence 重建。

### Type B — Historical Measurements

某个时间点对玩家整体状态的测量：

```text
Rating = 10.28
大歌力 = ...
体力 = ...
高速处理 = ...
精度力 = ...
节奏处理 = ...
复合处理 = ...
focus = accuracy_power
```

这些是：

> **snapshot / measurement**

不是单曲成长事件。

必须单独建模。

---

## 6. 不要把 Snapshot 当 Event

错误：

```text
2026-09-19
精度力事件 +0.12
```

如果系统没有两个可比较 measurement。

正确：

```text
Measurement A
2026-09-18
accuracyPower = 10.41

Measurement B
2026-09-19
accuracyPower = 10.53
```

“+0.12”是后续 recap / presentation 的派生结果。

---

## 7. 不要把所有 Score 变化都永久复制一遍

现有 score history 已经是 authoritative raw evidence。

不要直接做：

```text
每个历史 snapshot
→ 再复制一套完整 score JSON 到 Growth DB
```

Growth History 应保存：

- canonical derived facts
或
- 可重算的 projection identity / evidence refs

避免第二套 raw score source of truth。

---

## 8. Canonical Growth Fact Model

先设计纯类型。

概念：

```ts
type GrowthFact = {
  id: string

  ownerId: string
  bindingId: string

  type:
    | 'played'
    | 'score-pb'
    | 'ng-reduced'
    | 'combo-improved'
    | 'clear'
    | 'fc'
    | 'df'
    | 'rank-upgrade'
    | 'goal-completed'

  songId?: number
  difficultyType?: number

  before?: unknown
  after?: unknown
  delta?: number | null

  goalId?: string | null

  evidence: {
    source: 'score-history' | 'goal'
    sourceRevision?: string
    evidenceVersion: number
    provenance?: unknown
  }

  temporal: {
    attributedDay?: string | null
    occurredAt?: string | null
    observedAt?: string | null
    confirmedAt?: string | null
    precision: 'instant' | 'day' | 'observation' | 'unknown'
  }
}
```

实际字段按项目规范实现。

---

## 9. Growth Fact 必须有 Stable Identity

同一事实重复 replay 不得产生两个事件。

必须定义稳定：

```text
factKey
```

例如概念：

```text
binding
+
song
+
difficulty
+
fact type
+
before/after
+
source evidence revision/window
```

或更可靠的 source-specific identity。

要求：

```text
same authoritative evidence
→ same factKey
```

---

## 10. 不要用随机 UUID 作为去重依据

可以有 DB row id。

但 canonical dedup 必须依赖：

```text
stable fact key
```

而不是：

```text
每次 derive → random uuid
```

否则 Weekly Recap 每次 rebuild 都可能重复。

---

## 11. Temporal Semantics 必须严格

至少区分：

### `occurredAt`
只有有足够 evidence 能证明具体时间时使用。

### `attributedDay`
像 Daily Progress 已能可靠归属到 Asia/Shanghai 某一天。

### `observedAt`
系统观察到该状态的时间。

### `confirmedAt`
例如 Goal `completed_at`，表示 Viewer 确认 Goal 完成的时间。

不能把 `confirmedAt` 当 `occurredAt`。

---

## 12. Timeline 可以接受 Day Precision

不是所有事实都需要伪造具体秒。

如果只能证明：

```text
2026-09-19
拿到全连
```

则：

```text
precision = day
```

不要伪造 14:32:17。

---

## 13. Goal Completed 的时间语义

Goal completion 已有：

```text
completedAt
observationCapturedAt
completion evidence
```

Growth History 必须保留：

> completedAt = Viewer confirmation。

若无法证明实际游玩日：

不要把 Goal fact 强塞进某天的 Score Timeline。

后续 Weekly Recap 只纳入满足时间归因规则的事实。

---

## 14. Daily Progress 继续是日归因规则权威

不要重写 Daily Progress 的历史事件识别。

优先复用现有：

```text
deriveDailyProgress / replay
```

如果当前函数只接受“today”，允许重构为：

```text
deriveProgressForDay(day, history)
```

但要求：

- today 行为 golden unchanged
- 17 类 replay 继续 PASS
- 不改变事件含义 / priority / evidence rule

---

## 15. Multi-day Derivation

0.70.0 需要支持：

```text
fromDay
toDay
```

但不应每一天从头 replay。

目标：

```text
one history load
→ one ordered replay
→ emit per-day canonical facts
```

复杂度目标：

```text
O(history)
```

而不是：

```text
O(days × history)
```

---

## 16. Fact Priority 不等于 Timeline Filtering

Daily Progress 为 Home 只显示 top facts。

Growth History 不能只保留 Home top 3。

例如同一天同谱：

```text
FC
PB
NG reduced
```

Weekly Recap 可能都需要。

---

## 17. 同谱 Facts 在数据层不提前合并

Canonical layer：

```text
FC fact
PB fact
NG fact
```

分别存在。

Presentation 层以后再组合。

不要把 UI card 结构写进 history model。

---

## 18. Goal Fact 与 Score Fact 不重复定义

如果 Goal completed 是 FC，同时 score history 也有 FC：

- score fact = 成绩事实
- goal fact = 玩家选择的目标被确认达成

两者都可保留 canonical record。

后续 presentation 可以建立 relation / composition。

---

## 19. Historical Measurement Model

概念：

```ts
type GrowthMeasurement = {
  ownerId: string
  bindingId: string

  capturedAt: string
  scoreRevision: string

  measurementVersion: number
  algorithmVersion: string
  modelRevision?: string | null

  rating: number | null

  dimensions: {
    daigouryoku: number | null
    stamina: number | null
    speed: number | null
    accuracyPower: number | null
    rhythm: number | null
    complex: number | null
  }

  focus: string
  sampleCount: number
  availabilityState: string
}
```

实际字段依当前 DTO。

---

## 20. Measurement 必须版本化

至少保存：

```text
measurementVersion
algorithmVersion
```

因为未来六维/Rating 模型可能变化。

否则无法区分：

> 玩家变化

和：

> 算法变化。

---

## 21. Catalog / Model Revision Audit

必须确认：

- rating_structured 是否有版本 / hash
- song catalog 是否有 revision
- six-dim code 是否有稳定标识
- package version 是否足够当 algorithmVersion

优先使用已有真实 revision。

如果没有：

允许定义显式：

```text
algorithmVersion = growth-v1
```

未来算法变更必须 bump。

---

## 22. Measurement 捕获策略必须先审计

候选：

### A. 新 scoreRevision 第一次 Growth compute 时保存

优点：

- 与用户真实看到的 Player State 一致
- 不依赖统一 sync hook

缺点：

- 用户不访问 Viewer 就不会产生 measurement

### B. authoritative sync 后 compute + snapshot

优点：
- 更完整

缺点：
- 当前 sync path 复杂
- Python compute 有成本

### C. 每日最多一条 on-demand snapshot

优点：
- 数据量小

缺点：
- 可能错过日内变化

开工前必须比较，不直接拍板。

---

## 23. 推荐 V1 Measurement 策略

除非审计发现更好的正式路径，优先：

> 当 authenticated Growth Overview 对新的 `scoreRevision` 成功完成 Player State compute 后，复用本次结果 upsert measurement。

概念唯一键：

```text
(binding_id, score_revision, algorithm_version)
```

这样：

- 同 revision 不重复
- 不新增 Python process
- 只保存真正计算过的状态
- 写入失败不影响 Overview

---

## 24. Measurement Persistence Failure 不得拖垮 Home

要求：

```text
Growth compute success
→ Overview 仍正常返回
```

measurement 写入失败：

- log
- 后续同 revision 可重试
- 不让首页 500
- 不无限后台轮询

---

## 25. Measurement 不保存 Today Plan / UI 文案

不要保存：

- 推荐三首歌
- “最近可以从精度入手”这类翻译文案

保存：

```text
focus = accuracy_power
```

展示时再 i18n。

Goal 已经保存用户真正选择了什么。

---

## 26. 是否需要 Growth Facts 持久化

必须先比较：

### Option A：Derived-on-read

```text
load score history
→ one replay
→ emit facts
→ merge Goal history
```

### Option B：Materialized projection

新增：

```text
web_growth_facts
```

要求：

- stable fact key
- idempotent rebuild
- raw history 永远是 source of truth
- projection 可全部重建

---

## 27. 决策标准

先实测：

- 7d replay
- 30d replay
- 90d replay
- full-history replay

记录：

- history 文件数
- snapshot 数
- wall time
- memory
- fact count

如果 derived-on-read 足够快：

> 不建 `web_growth_facts`。

只有性能确实需要时再 materialize。

---

## 28. Projection 必须可重建

若新增 `web_growth_facts`：

```text
delete projection
→ replay authoritative history
→ rebuild same canonical facts
```

它不是 source of truth。

---

## 29. No-REFERENCES 约定继续

若新增任何 Growth 表：

- 不使用 FOREIGN KEY / REFERENCES
- typed user/binding columns
- application-owned cleanup
- orphan audit
- owner mismatch audit
- explicit migration
- test DB first

不要重新引入 REFERENCES blocker。

---

## 30. Account Lifecycle

解绑：

```text
binding-specific measurements / projections 清理
```

重新绑定：

```text
不继承旧 binding 的 private Growth projection
```

Goal/history service 只能读当前 binding。

---

## 31. Growth History API

建议：

```text
GET /api/account/growth/history
```

参数可用：

```text
from=YYYY-MM-DD
to=YYYY-MM-DD
```

或 bounded `days=`。

要求：

- authenticated
- current binding server-resolved
- private, no-store
- bounded range
- 客户端不能指定任意 user/binding

---

## 32. API 不直接设计成 Weekly UI

概念：

```ts
{
  profileId,
  range,
  facts: GrowthFact[],
  measurements: GrowthMeasurement[],
  coverage: {
    scoreHistoryFrom,
    scoreHistoryTo,
    scoreHistoryState,
    measurementFrom,
    measurementTo,
    measurementState
  }
}
```

0.70.1 再组合 Weekly Recap。

---

## 33. Coverage 必须显式

支持：

```text
complete
partial
truncated
unknown
```

特别是：

- history retention
- 新账号
- 导入账号
- manual
- 老 binding
- measurement 从 0.70.0 才开始

不能假装拥有完整长期轨迹。

---

## 34. Backfill 原则

### Score Facts
raw history 足够时允许 deterministic replay/backfill。

### Goal Facts
从已有 Goal rows 读取。

### Player State Measurements
默认不回填过去“当时六维”。

除非能同时还原：

- 当时 score snapshot
- 当时 algorithm version
- 当时 model/catalog revision

否则 measurement 从 0.70.0 开始。

---

## 35. 不用当前算法回算过去然后称“当时”

如果未来确实做 historical recompute：

必须标：

```text
recomputed under algorithm X
```

不能称为当时真实 measurement。

V1 默认不做。

---

## 36. Rating 也要版本边界

measurement 保存 Rating model/version。

不同版本之间默认不直接计算成长 delta。

后续 UI 应有 recalibration/break，而不是伪连续曲线。

---

## 37. Focus History

Measurement 可以保存：

```text
focus
```

但必须保留：

- balanced
- limited
- insufficient data

不能把缺数据当短板。

---

## 38. Growth Milestone 暂不单独建系统

0.70.0 不新增 badge/milestone 表。

PB / FC / DF / Rank / Goal completion 足够作为基础事实。

“大 PB”阈值留给 0.70.1 presentation 再讨论。

---

## 39. Growth History Service 分层

建议：

```text
loadGrowthEvidence()
↓
deriveScoreFacts()
↓
loadGoalFacts()
↓
loadMeasurements()
↓
mergeCanonicalTimeline()
```

避免 Home / Weekly / Passport 各写一套。

---

## 40. Timeline 排序

时间精度不同。

建议稳定规则：

1. attributedDay
2. reliable occurredAt
3. observedAt / confirmedAt fallback
4. stable factKey tie-break

重复请求顺序必须稳定。

---

## 41. Timezone

Score / Daily fact 继续：

`Asia/Shanghai`

Measurement capturedAt 用 UTC 存储。

不要把设备所在地时区混进街机业务日。

---

## 42. Manual Source

必须明确 manual 的边界。

V1 建议：

> manual 不进入 date-attributed Growth Timeline。

如果展示，只能作为“记录更新”一类非日归因事实。

不要声称某日游玩/某日达成。

---

## 43. History API 性能 Gate

至少测：

- 7 days
- 30 days
- 90 days
- 最大允许范围

记录：

- TTFB
- total
- memory
- files read
- snapshots replayed
- facts emitted
- measurements returned

---

## 44. Range Bound / Pagination

不要开放无限 all-time 单次查询。

根据性能测试决定最大范围。

如果 facts 很多，优先按：

```text
day/window
```

分页。

不要做深 offset pagination。

---

## 45. Measurement Retention 与容量估算

至少估算：

```text
每用户每月 measurement 行数
```

并给：

- 1k users
- 10k users
- 100k users

大致 DB 增长。

长期可保留，但要有量级依据。

---

## 46. Privacy

Growth History 是 private account data。

必须：

- authenticated only
- no public endpoint
- profile isolation
- lifecycle cleanup
- no cross-user leakage

导出功能不是本版必做。

---

## 47. Tests — Score Facts

复用并扩展历史 replay：

- no play
- ordinary
- PB
- old PB restore
- NG
- combo
- clear
- FC
- DF
- rank
- same song multi-fact
- multiple songs
- duplicate sync
- midnight
- missing-before
- truncated
- crown ambiguity

Daily Progress golden 必须保持。

---

## 48. Tests — Multi-day

至少：

```text
Day 1 PB
Day 2 no play
Day 3 FC + PB
Day 4 duplicate
Day 5 rank
```

one replay 后：

- per-day facts 正确
- timeline 无重复
- stable order

---

## 49. Tests — Goal Merge

至少：

- completed Goal + matching score fact
- completed Goal without date-attributable score fact
- cancelled Goal
- active Goal
- multiple completed Goals
- profile isolation

Canonical layer 不误删 Goal fact。

---

## 50. Tests — Measurement

至少：

- first revision creates measurement
- same revision no duplicate
- new revision creates next measurement
- algorithmVersion boundary
- limited
- balanced
- missing dimensions
- persistence failure does not fail Overview
- profile isolation
- unbind cleanup

---

## 51. Real SQL

若新增表：

必须真实 SQL 验证：

- migration idempotency
- no REFERENCES
- uniqueness
- concurrent upsert
- lifecycle cleanup
- user/binding isolation
- orphan 0
- owner mismatch 0

---

## 52. Production Smoke

隔离生产账号：

1. 构造多日 authoritative history
2. 读取 Growth History API
3. 验证 score facts
4. 创建并完成 Goal
5. History API 合并 Goal fact
6. 触发新 Growth Overview measurement
7. 重复 Overview 不产生 duplicate measurement
8. new revision 产生下一 measurement
9. cleanup
10. orphan audit = 0

不等待真实一周。

---

## 53. Overview 性能不得回退

如果 measurement capture 挂在 Overview：

必须确认：

```text
same revision = fast no-op
```

并且：

```text
NO ADDITIONAL PYTHON COMPUTE
```

必须复用本次已经算出的 Rating / 六维 / focus。

---

## 54. Measurement 写失败测试

模拟 DB write failure：

期望：

- Overview 仍 200
- 当前 Growth 正常显示
- log error
- 后续同 revision 可重试

---

## 55. Observability

至少记录：

```text
history replay duration
snapshots read
facts emitted
measurement upsert hit/create
coverage state
```

不要记录完整私人 score payload。

---

## 56. Migration 策略

若新增表：

- explicit migration
- test DB first
- `SELECT DATABASE()`
- mutation opt-in
- no REFERENCES
- idempotent
- production preflight
- migration before deploy

---

## 57. 推荐新表边界

如果只需要 Measurement：

优先只新增：

```text
web_growth_measurements
```

不要预建很多“以后可能用”的表。

若 facts derived-on-read 足够：

不要建 `web_growth_facts`。

---

## 58. Measurement 表概念

```text
id
user_id
binding_id

score_revision
measurement_version
algorithm_version
model_revision

rating
dimensions_json
focus
sample_count
availability_state

captured_at
created_at
```

唯一性概念：

```text
(binding_id, score_revision, algorithm_version)
```

---

## 59. No FK / Cleanup

如新增 measurement table：

现有 lifecycle helper 必须扩展。

最终：

```text
measurement orphan = 0
owner mismatch = 0
```

---

## 60. 0.69.3 Goal Loop 必须完整回归

保持：

- create Goal
- evaluate Goal
- one POST + one Overview refresh
- no-reload next Goal
- Goal/Daily dedup
- profile guard
- stale-plan protection

0.70.0 不能破坏这些行为。

---

## 61. Daily Progress 不能被改坏

如果为了 multi-day 重构内部 derivation：

必须证明 today 语义保持不变。

历史 replay 全量回归继续 PASS。

---

## 62. Weekly Recap 的数据准备目标

0.70.0 完成后，0.70.1 应能直接读取并回答：

```text
本周打了多少不同谱面
刷新了哪些 PB
新增哪些 FC / DF
有哪些 Rank 提升
完成哪些 Goal
周初 → 周末 Rating / 六维如何变化
coverage 是否完整
```

而不是重新扫描并各自发明规则。

---

## 63. Skill Passport 的数据准备目标

0.70.2 应能读取：

- longitudinal measurements
- focus history
- important facts
- Goal completions
- coverage/version boundaries

而不需要每个页面重新实现历史推导。

---

## 64. Completion Blockers

任一存在不得关闭：

- 把 UI card 当数据模型
- 当前算法重算历史并伪装成“当时 measurement”
- completedAt 当实际游玩时间
- measurement 无 algorithmVersion
- same revision 重复 snapshot
- measurement capture 额外启动 Python
- Daily Progress 语义变化
- replay 退化为 O(days × history)
- projection 不能重建
- 新表重新使用 REFERENCES
- cleanup 留 orphan
- API 可访问其他 profile
- coverage 不显式
- production smoke 未通过

---

## 65. 最终报告必须回答

1. 实施开始 / 最终版本？
2. Evidence Audit 结论？
3. score history retention / coverage？
4. Canonical Fact types？
5. stable fact identity？
6. temporal precision？
7. Goal facts 如何进入 timeline？
8. Daily derivation 如何复用？
9. multi-day 是否 one-pass？
10. facts derived-on-read 还是 materialized？为什么？
11. 7/30/90d 性能？
12. 是否新增 `web_growth_facts`？
13. 是否新增 `web_growth_measurements`？
14. Measurement capture 策略？
15. 是否额外启动 Python？
16. algorithmVersion？
17. model/catalog revision？
18. 是否 backfill historical measurement？
19. Rating version boundary？
20. focus history？
21. same revision 去重？
22. measurement failure 是否影响 Overview？
23. History API contract？
24. range limit / pagination？
25. coverage 表达？
26. manual source？
27. user/binding cleanup？
28. orphan/mismatch？
29. multi-profile isolation？
30. Daily replay regression？
31. Goal loop regression？
32. production smoke？
33. DB growth estimate？
34. 是否 READY FOR 0.70.1？
35. 是否 READY FOR 0.70.2 data layer？

---

## 66. 完成状态

全部 Gate 通过后记录：

```text
0.70.0 GROWTH HISTORY FOUNDATION COMPLETE

CANONICAL GROWTH FACT MODEL ESTABLISHED
MULTI-DAY AUTHORITATIVE HISTORY REPLAY ACCEPTED
GOAL HISTORY MERGED INTO GROWTH TIMELINE
LONGITUDINAL PLAYER STATE MEASUREMENTS ESTABLISHED
MEASUREMENT VERSION BOUNDARY ESTABLISHED
HISTORY COVERAGE EXPLICIT
PRIVATE PROFILE ISOLATION ACCEPTED
DAILY PROGRESS SEMANTICS UNCHANGED
0.69.x GOAL LOOP REGRESSION ACCEPTED

READY FOR 0.70.1 WEEKLY GROWTH RECAP
READY FOR 0.70.2 SKILL PASSPORT DATA LAYER
```

---

## 67. 下一阶段

### 0.70.1 — Weekly Growth Recap

回答：

> “这一周，我主要发生了什么？”

核心是：

```text
1 个主变化
+
2–4 个重要事实
+
周初 → 周末 Player State 变化
+
自然的下一步
```

不是 KPI Grid。

### 0.70.2 — Skill Passport

回答：

> “长期来看，我是怎样变化的？”

基于：

- measurement timeline
- focus history
- PB / crown / rank facts
- Goal completions
- coverage/version boundaries

不要回到“六维雷达图 + 一堆统计卡片”的旧模式。
