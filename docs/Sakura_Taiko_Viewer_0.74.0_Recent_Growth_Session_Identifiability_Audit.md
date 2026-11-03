# Sakura Taiko Viewer 0.74.0
# Recent Growth / Session Identifiability Audit
# Sync Boundary ≠ Play Session

## 0. 阶段定位

当前生产基线：

- Viewer：`0.73.0`
- Daily Progress：已上线
- Weekly Growth Recap：已上线
- Skill Passport / 成长档案：已上线
- Goal Feedback Loop：已闭环
- Growth History Foundation：已建立
- Canonical score / Goal facts：已建立
- Longitudinal measurements：已建立
- History coverage / version boundary：已建立

当前 Viewer 已能回答：

```text
今天发生了什么？
这一周发生了什么？
最近一段时间我是怎么变化的？
现在接下来练什么？
```

下一步希望补：

> **“我刚刚这一轮打完，发生了什么？”**

但在产品上必须先回答一个更基础的问题：

> **现有数据能否可靠识别“一次真实机厅 Session”？**

因此 0.74.0 首先不是 UI 实现阶段，而是：

# `SESSION IDENTIFIABILITY AUDIT`

---

## 1. 必须严格区分三种概念

### A. Sync Batch

一次同步/写入动作：

```text
某个时点
Viewer / bot / importer
把一批成绩写入 userdata/history
```

这是数据系统边界。

### B. Score Observation Batch

一次 authoritative observation 中，
系统看到若干 chart state 发生变化。

这是证据边界。

### C. Arcade Play Session

玩家真实在机厅进行的一段连续游玩：

```text
到店
→ 连续打若干首
→ 离店
```

这是用户行为边界。

---

## 2. 核心警告

不能默认：

```text
1 次 sync
=
1 次 observation batch
=
1 次 arcade session
```

这三者可能完全不同。

例如：

```text
玩家打了 3 小时
↓
回家后一次性同步
```

可能是：

```text
1 sync
包含整个 session
```

但也可能：

```text
玩家一周没同步
↓
今天一次性导入历史
```

这时：

```text
1 sync
包含多个真实 session
```

还可能：

```text
自动同步每几分钟发生
```

导致：

```text
1 session
被拆成多个 sync
```

---

## 3. 产品方向必须根据证据强度决定

### 如果证据足够

可以做：

# Session Recap

用户语义：

```text
这次游玩
```

### 如果证据不足

退一步做：

# Recent Growth Moments

用户语义：

```text
刚刚同步的新变化
最近一次更新
```

而不是声称：

```text
这就是你刚才在机厅的一次完整 Session
```

---

## 4. 版本

实施开始前读取 canonical version：

```text
package.json
→ nuxt.config.ts
→ runtimeConfig.public.appVersion
→ /more
```

若生产仍为：

`0.73.0`

则本阶段目标版本建议：

`0.74.0`

但：

> **Audit 本身不要求立即 bump / 发布。**

只有进入用户可见实现后再决定版本。

---

# Part I — Evidence Audit

## 5. 审计现有 score history 写入链

必须完整列出：

- Wahlap 写入路径
- Hiroba 写入路径
- Kinoko import
- Kinoko history import
- manual score
- 网页编辑 / import
- `writeUserdataWithHistory`
- dispatcher / sync receiver
- Goal Evaluation 所使用的 writer envelope
- maintenance / repair / migration path

对每条路径回答：

1. 是否代表真实新游玩？
2. 是否可能批量回填旧成绩？
3. 是否可能同一真实 session 多次写入？
4. 是否可能多 session 一次写入？
5. 是否有 source-specific sequence / cursor / batch id？
6. 是否有 authoritative upstream event time？

---

## 6. 审计 history snapshot 元数据

至少检查：

```text
_meta.full
_meta.ts
source
observed_at
synced_at
schema_version
import marker
source account
content revision
```

对每个字段明确：

```text
它表示什么
它不能表示什么
```

尤其：

`_meta.ts`

只能表示：

> 本地 observation / history write boundary

除非有额外证据，不能表示：

> 玩家开始/结束真实游玩的时间

---

## 7. 审计 chart-level 时间字段

重点：

```text
highscore_datetime
update_datetime
```

回答：

- 每个 source 是否都可靠提供？
- 精度到秒还是更低？
- 是否可能沿用历史旧时间？
- PB / crown / rank 是否都同步更新？
- 多张谱的时间分布是否足够用于 session clustering？
- 是否存在时区不明值？
- import 是否保留原始业务时间？

---

## 8. 真实样本分布分析

必须在**去身份化**前提下分析真实生产样本：

至少统计：

- 每个 profile 每天 snapshot 数
- snapshot 间隔分布
- 同一 snapshot 中变化 chart 数
- chart-level update/highscore 时间跨度
- 一次 history write 内 chart event 的 min/max 时间差
- 同 source 的连续写入间隔
- 同一天出现多个明显 activity cluster 的比例

不要输出：

- taikoId
- username
- score payload
- private profile

---

## 9. Session Gap 候选阈值只做分析，不先定义

可以分析：

```text
10 min
20 min
30 min
45 min
60 min
90 min
```

不同 gap 下：

- cluster 数
- cluster 平均长度
- 被切碎比例
- 被合并比例

但 Audit 阶段不要拍脑袋宣布：

```text
30 分钟 = 一次 Session
```

---

## 10. Upstream Session ID Audit

必须确认是否任何 source 本身存在：

- play batch id
- session id
- arcade visit id
- transaction id
- login/play-cycle identifier

如果存在：

优先用 source-native session identity。

不要在已有 authoritative session id 时自己 heuristic clustering。

---

## 11. Play Count / Stage Count Audit

现有字段可能有：

```text
stage_cnt
play_count
```

必须确认：

- 是累计值还是单次值
- 是否 per-song / per-profile
- 是否能定位某次 session
- 是否在每次同步中单调增长
- 是否会 import/backfill

累计值只能帮助确认：

> 新游玩发生过

不能单独回答：

> 哪几首属于同一次 session

---

# Part II — Identifiability Levels

## 12. 定义 Session Evidence Level

建议至少四级：

### L0 — Unknown

无法确认这批变化是否来自最近真实游玩。

例如：

- manual
- import
- repair
- provenance 不完整

### L1 — Recent Observation

可以确认：

> 这是某次新的 authoritative observation 中出现的变化。

但不能确认是真实单次 session。

### L2 — Session Candidate

有较强证据：

- 同源
- 连续时间簇
- 无 import/backfill 标记
- chart event 时间集中
- observation sequence 连续

但仍是 inferred session。

### L3 — Authoritative Session

source 提供可信 session id / session boundary。

只有 L3 才能无保留称：

```text
一次真实 Session
```

---

## 13. 用户文案必须映射 Evidence Level

### L3

可以：

```text
这次游玩
本次 Session
```

### L2

更安全：

```text
这一轮
最近一轮记录
```

并可在说明中标：

```text
按连续游玩记录归并
```

### L1

只能：

```text
最近同步的变化
刚刚更新
```

### L0

不进入 Recent Growth Recap。

---

## 14. 不允许产品文案超越证据

禁止：

```text
你刚刚在机厅打了 12 首
```

如果系统其实只知道：

```text
一次 sync 中 12 张谱发生变化
```

必须改为：

```text
最近同步到 12 张谱有新变化
```

---

# Part III — Recent Growth Moments Fallback

## 15. 默认优先设计“最近变化”，而非强行 Session

如果 Audit 无法得到稳定 L2/L3：

V1 应实现：

# `Recent Growth`

语义：

```text
最近一次 authoritative update 之后
新增了哪些可证明变化
```

---

## 16. Recent Growth 的核心边界

需要一个：

```text
previous acknowledged observation boundary
→ current authoritative observation
```

而不是：

```text
今天 00:00
→ 现在
```

所以它和 Daily Progress 不同。

---

## 17. Recent Growth 不等于 Daily Progress

Daily：

```text
今天累计
```

Recent：

```text
上次看到 / 上次同步以后新增的变化
```

例如：

上午 PB：

```text
Daily 包含 PB
```

晚上又 FC：

```text
Recent 只突出新 FC
Daily 包含 PB + FC
```

---

## 18. Recent Growth Boundary Audit

必须确认是否已有稳定：

- scoreRevision
- history revision
- last seen revision
- last acknowledged revision
- user/session-local cursor

如果没有：

不要立刻新建 persistence。

先评估能否基于现有 Growth History / revision 建立。

---

## 19. Browser-local cursor 不等于 account cursor

如果只存：

```text
localStorage lastRevision
```

则：

- 换设备丢失
- 清缓存丢失
- profile switch 容易串

如果产品希望：

> 任意设备都知道“上次看过哪里”

则需要 server-side cursor。

Audit 阶段先明确产品语义。

---

# Part IV — Session / Recent Fact Model

## 20. 不重新定义 canonical facts

继续复用 0.70.0：

- played
- PB
- NG
- combo
- clear
- FC
- DF
- rank
- Goal completed

Session / Recent 只是：

```text
windowing + grouping + composition
```

不是第二套事实规则。

---

## 21. Candidate Session DTO

如果最终允许 L2+：

```ts
type GrowthSessionCandidate = {
  id: string
  evidenceLevel: 'candidate' | 'authoritative'
  source: string
  window: {
    from: string
    to: string
    precision: 'source-session' | 'event-cluster'
  }
  observationRevisions: string[]
  facts: GrowthFact[]
  stats: {
    distinctCharts: number
    meaningfulFacts: number
  }
  confidence?: {
    basis: string[]
  }
}
```

---

## 22. 不把 Session DTO 设计成 UI Card

数据层不保存：

```text
headline
subtitle
emoji
cardColor
```

这些留给 presentation composer。

---

## 23. Stable Session Candidate Identity

如果使用 heuristic candidate：

必须 stable。

不能：

```text
每次请求随机 id
```

可以基于：

```text
binding
source
window start/end
first/last revision
```

生成 stable key。

---

## 24. Heuristic Session 可重算

若 session 是 derived：

必须：

```text
same history
+
same algorithm version
→ same session candidates
```

并明确：

```text
sessionizationVersion
```

以后阈值变化时可区分。

---

# Part V — Sessionization Audit

## 25. 如果采用时间聚类

必须基于：

> chart-level authoritative event time

优先于：

> local history write time

只有在 chart event time 缺失时，
才考虑 observation boundary。

---

## 26. 混合来源不得默认同 Session

例如：

```text
Wahlap
Hiroba
Kinoko import
```

不要因为时间相近就合并。

默认：

```text
source continuity required
```

---

## 27. Import / repair 必须断 Session

任何：

- import marker
- repair marker
- manual
- content-edit source

默认：

```text
not sessionizable
```

最多 L1 observation。

---

## 28. Counter Regression 必须断证据

如果出现：

- best rank 回退
- crown counter 回退
- impossible score regression
- source topology discontinuity

不得继续 session clustering。

---

## 29. Midnight 不是必然 Session 边界

真实玩家可能跨午夜。

因此：

```text
00:00
```

不能自动切 session。

Daily Progress 的业务日和 Session boundary 是两套语义。

---

## 30. Source-native timezone 必须规范化

chart event time 需要转换为统一 offset-aware instant，
但用户展示时可使用：

`Asia/Shanghai`

不要把无时区字符串直接比较。

---

# Part VI — Product Decision Gate

## 31. Audit 必须给出最终产品结论之一

### Decision A

```text
AUTHORITATIVE SESSION AVAILABLE
```

可以实现 Session Recap。

### Decision B

```text
SESSION CANDIDATE RELIABLE ENOUGH
```

可以实现：

```text
这一轮
```

但 UI 必须说明推断性质。

### Decision C

```text
SESSION NOT RELIABLY IDENTIFIABLE
```

不做 Session Recap。

直接进入：

```text
Recent Growth / 最近同步的新变化
```

---

## 32. Decision 不按“想做什么”决定

必须依据：

- source semantics
- real production distributions
- replay fixtures
- false merge / false split cases

不能因为 Session Recap 产品感更强就强行选 A/B。

---

# Part VII — Audit Fixtures

## 33. 必测场景

至少构造：

- S1：单次同步，单一真实时间簇
- S2：一次真实 session，多次自动同步
- S3：两次真实 session，一次批量同步
- S4：跨午夜连续游玩
- S5：导入旧历史
- S6：manual 更新
- S7：同日两个明显 cluster
- S8：chart event time 缺失
- S9：source 切换
- S10：repair / backfill
- S11：同一谱多次提升
- S12：Goal completion 与 score fact 同步出现

---

## 34. Heuristic Evaluation Matrix

若做 sessionization heuristic：

每个 fixture 必须报告：

```text
Expected grouping
Actual grouping
False split?
False merge?
Evidence level
PASS / FAIL
```

---

## 35. Production Sample Analysis

使用去身份化真实样本分析：

- 30 天
- 多个活跃 profile
- 不复制用户 payload
- 只输出 aggregate distribution

报告：

```text
source distribution
event time availability
cluster gap distribution
candidate session count
ambiguous count
L0/L1/L2/L3 proportions
```

---

# Part VIII — Performance

## 36. 不重新逐天扫描

Session / Recent derivation 应基于：

```text
existing one-pass Growth History replay
```

不要：

```text
按 session 候选重复 replay raw history
```

---

## 37. 90 天性能

至少测试：

```text
Growth History
+
Session/Recent derivation
```

记录：

- snapshots
- facts
- candidates
- wall time
- memory

目标：

Session/Recent composition 相比 History API 增量应较小。

---

# Part IX — Persistence Decision

## 38. 默认不新建 Session 表

如果 Session / Recent 可 derived：

不要新建：

```text
web_sessions
web_growth_sessions
```

V1 优先 derived-on-read。

---

## 39. 只有 cursor 可能需要 persistence

如果最终选择 Recent Growth 且需要 account-level acknowledged boundary：

才考虑：

```text
web_growth_recent_cursor
```

但必须先明确：

- 什么时候 advance
- 哪个 profile
- 多设备语义
- unread / seen 语义

Audit 阶段不要先建。

---

## 40. Cursor 不等于 source of truth

即使有 cursor：

raw history / facts 仍是 authoritative。

cursor 只表示：

> 用户看到哪里。

---

# Part X — 与现有产品关系

## 41. Daily / Weekly / Passport 不改

0.74.0 Audit 不修改：

- Daily Progress
- Weekly Recap
- Skill Passport
- Goal Evaluation
- Recommendation

只做证据审计和 prototype derivation。

---

## 42. 未来产品位置

如果做 Session/Recent：

适合放在：

```text
Home Growth 区
```

因为它回答：

> 刚发生什么？

不是单独做复杂一级导航。

---

## 43. 与 Daily 的关系

Home 可能未来：

```text
刚刚
→ Recent / Session

今天
→ Daily Progress

这一周
→ Weekly

成长档案
→ Passport
```

但 Audit 阶段不做 UI。

---

# Part XI — 输出文档

## 44. 必须输出

`recent-growth-session-identifiability-audit.md`

至少包含：

1. write path audit
2. timestamp semantics
3. source matrix
4. production aggregate analysis
5. identifiability levels
6. heuristic fixture matrix
7. performance
8. persistence decision
9. final product decision
10. next implementation scope

---

# Part XII — Completion Blockers

## 45. 以下任一存在不得进入 Session Recap 实现

- 把 sync 当 session
- 把 `_meta.ts` 当 arcade session time
- import 被识别成真实游玩 session
- manual 进入 session
- source switch 被错误合并
- 午夜被硬切 session
- 无法估计 false merge / false split
- heuristic 无版本
- session candidate 无 stable identity
- 真实生产样本未分析
- performance 未测
- 产品文案超过 evidence level

---

# Part XIII — 最终报告必须回答

## 46. 40 项核心问题

1. 实施开始 Viewer 版本？
2. 哪些 production score write paths？
3. 哪些代表真实新游玩？
4. 哪些可能 backfill/import？
5. `_meta.ts` 语义？
6. `observed_at` 语义？
7. `synced_at` 语义？
8. `highscore_datetime` 可靠性？
9. `update_datetime` 可靠性？
10. 哪些 source 有 chart event time？
11. 哪些 source 有 session id？
12. stage/play counters 能否帮助 sessionization？
13. production snapshot interval 分布？
14. chart event time span 分布？
15. 一天多 cluster 比例？
16. 10/20/30/45/60/90min gap 各自结果？
17. 哪些情况 false split？
18. 哪些情况 false merge？
19. midnight 如何处理？
20. source switch 如何处理？
21. import 如何处理？
22. manual 如何处理？
23. repair 如何处理？
24. L0/L1/L2/L3 定义是否适配真实数据？
25. 各 evidence level 实际占比？
26. 是否可安全使用“这次游玩”？
27. 是否只能使用“这一轮”？
28. 是否应退为“最近同步的变化”？
29. stable session/candidate key？
30. sessionizationVersion？
31. derived-on-read 是否足够？
32. 是否需要新表？
33. 是否需要 recent cursor？
34. cursor 是 device-local 还是 account-level？
35. multi-device 语义？
36. 90 天性能？
37. 是否额外 replay raw history？
38. 是否修改 Daily/Weekly/Passport？
39. 最终产品决策 A/B/C？
40. 下一阶段建议版本与范围？

---

# Part XIV — 完成状态

## 47. 若最终结论为 A

```text
0.74.0 SESSION IDENTIFIABILITY AUDIT COMPLETE

AUTHORITATIVE SESSION BOUNDARY ACCEPTED
SESSION RECAP MAY PROCEED
```

## 48. 若最终结论为 B

```text
0.74.0 SESSION IDENTIFIABILITY AUDIT COMPLETE

SESSION CANDIDATE MODEL ACCEPTED
INFERRED "RECENT ROUND" PRODUCT MAY PROCEED
AUTHORITATIVE SESSION CLAIM PROHIBITED
```

## 49. 若最终结论为 C

```text
0.74.0 SESSION IDENTIFIABILITY AUDIT COMPLETE

ARCADE SESSION NOT RELIABLY IDENTIFIABLE
RECENT GROWTH OBSERVATION MODEL RECOMMENDED
SESSION CLAIM PROHIBITED
```

---

# Part XV — 下一阶段

## 50. 如果 A/B

下一阶段：

# `0.74.1 Session / Recent Round Recap`

实现：

```text
最近一轮
↓
打了哪些谱
↓
最值得记住的变化
↓
Goal 是否达成
↓
接下来
```

## 51. 如果 C

下一阶段：

# `0.74.1 Recent Growth`

实现：

```text
最近同步到的新变化
↓
PB / Crown / Goal / Rank
↓
与上次已查看 revision 的差异
↓
接下来
```

这仍然能提供强即时反馈，
同时不伪造“真实机厅 Session”。
