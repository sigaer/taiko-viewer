# Sakura Taiko Viewer 0.70.2
# Skill Passport
# Longitudinal Measurements → Ability Trajectory → Personal Growth Record

## 0. 阶段定位

当前生产基线：

- Viewer：`0.70.1`
- `0.70.0 Growth History Foundation`：COMPLETE
- `0.70.1 Weekly Growth Recap`：COMPLETE
- Canonical score / Goal facts：已建立
- Longitudinal player-state measurements：已建立
- Weekly narrative：已上线
- History coverage / version boundary：已上线
- Goal Feedback Loop：保持闭环
- Daily Progress / Recommendation ranking：保持原语义

0.70.2 开始回答一个更长期的问题：

> **“过去一段时间，我的能力结构是怎么变化的？”**

这不是“另一个统计页”。

Skill Passport 的产品角色应当是：

> **我的太鼓成长档案。**

它记录：

- 现在的能力结构
- 从何时开始被可靠记录
- 兼容测量口径下的长期变化
- focus 的变化轨迹
- 最近值得记住的成长节点
- 当前仍可以从哪里继续

---

## 1. 产品名称与语气

用户可见中文优先使用：

```text
成长档案
```

而不是机械显示：

```text
Skill Passport
技能护照
```

内部阶段仍可称 `Skill Passport`。

日文按自然产品语气单独设计。

---

## 2. 版本

实施前读取 canonical version：

```text
package.json
→ nuxt.config.ts
→ runtimeConfig.public.appVersion
→ /more
```

若生产仍为 `0.70.1`：

目标版本：

`0.70.2`

不得回退。

---

## 3. Skill Passport 不回答“全部人生历史”

0.70.0 已明确：

- measurement 从 0.70.0 后开始真实捕获
- 不用当前模型回填过去“当时六维”
- score History API 当前范围最多 90 天

因此 V1 必须明确：

> **这是“从 Viewer 开始可靠记录以来”的成长档案。**

不要写：

```text
你的太鼓生涯
历史全部能力变化
从入坑以来
```

除非未来数据真的支持。

---

## 4. Measurement 是长期主轴

Skill Passport 的主时间轴应以：

```text
web_growth_measurements
```

为核心，而不是重新扫描所有 score history。

原因：

- measurement 是当时真实完成的 Player State compute
- 保存了 scoreRevision
- 保存了 algorithmVersion
- 保存了 modelRevision
- 能区分玩家变化和模型变化

Score facts / Goal facts 作为：

> **节点与解释层**

不是长期能力曲线的 source of truth。

---

## 5. 页面回答五个问题

### A. 现在的我是什么状态？

- 当前 Rating
- 当前六维
- 当前 focus / balanced / limited

### B. Viewer 从什么时候开始可靠记录我的能力？

- measurement firstCapturedAt
- coverage 说明

### C. 这段时间能力结构怎么变化？

- version-compatible measurement trajectory
- current compatible segment start → now

### D. 中间有哪些值得记住的节点？

- recent PB / crown / rank
- completed Goals
- focus transitions

### E. 现在可以继续做什么？

- current focus
- Today Plan / Goal entry

---

## 6. 不做“综合成长分”

禁止新增：

```text
成长值 87
成长指数 +12%
本月变强 23%
```

没有必要把六维、Rating、PB、Goal 再压成一个不可解释数字。

---

## 7. 不做能力排名

本版不做：

```text
超过 83% 玩家
全服前 10%
同 Rating 玩家对比
```

Skill Passport 是个人纵向成长，不是竞争页。

---

## 8. 不做 Persona 标签

避免：

```text
你是高速型玩家
你是技术流玩家
你是耐力型鼓手
```

除非以后有专门、稳定且可解释的分类模型。

当前只展示真实 measurements / focus。

---

## 9. 先做 Skill Passport Data Audit

编码前先审计：

- `web_growth_measurements` 实际 schema
- measurement 行数分布
- 同一天多 revision 的真实频率
- `algorithmVersion`
- `modelRevision`
- current Growth Overview
- Growth History API
- Goal completed facts
- Weekly composer
- current account / binding lifecycle
- measurement cleanup
- current `/my` IA

必须输出：

`skill-passport-data-audit.md`

---

## 10. Measurement Timeline 不直接返回全部原始行

同一天可能有多次 score revision。

Skill Passport visual 不需要每次同步一个点。

V1 推荐：

> **按 Asia/Shanghai 业务日取当天最后一个有效 measurement。**

得到：

```text
Daily Growth Measurement Series
```

原始 measurements 仍保留数据库。

---

## 11. Daily Representative 规则

对每个业务日：

1. 按 `capturedAt` 排序
2. 取当天最后一个 measurement
3. 保留该行的：
   - scoreRevision
   - rating
   - dimensions
   - focus
   - availability
   - version metadata

不要计算“日平均六维”。

---

## 12. Measurement Version Segment

时间线必须按以下组合切段：

```text
measurementVersion
+
algorithmVersion
+
modelRevision
```

定义：

```text
Measurement Segment
```

只有同一 segment 内才允许直接计算 delta / 连线比较。

---

## 13. Model Revision Break 必须可见

例如：

```text
09-01 — 09-12
growth-v1 / model A

09-13 起
growth-v1 / model B
```

UI 不能画成完全连续的一根趋势线并暗示 09-12→09-13 是玩家能力变化。

应：

- visual 断开
- 或标一个轻量“计算口径更新”

不要用 Error / Warning 风格。

---

## 14. 当前主 Segment

首页式核心变化只基于：

> **包含最新 measurement 的当前兼容 segment**

例如：

```text
本轮记录以来
精度力 10.41 → 10.53
```

不能跨 modelRevision 计算。

---

## 15. Range 设计

V1 建议提供：

```text
30 天
90 天
180 天
1 年
```

默认：

```text
90 天
```

实际最大范围先按 audit / SQL 性能验证。

不直接开放无限 all-time。

---

## 16. 如果实际记录不足 Range

例如选择 180 天，但 measurement 只有 42 天：

页面显示：

```text
已记录 42 天
```

不要生成 180 天空轴造成“缺失很多数据”的错觉。

---

## 17. Current Snapshot

页面顶部建议：

```text
成长档案

记录自 2026.09.19

Rating 10.28

最近可以从精度入手
```

六维 visual 位于其后。

不要顶部先铺 7 个数字卡。

---

## 18. 六维 Visual

六维可以成为 Skill Passport 的重要视觉，但不能退化成“只有雷达图”。

推荐：

- 当前六维 visual
- 当前 segment 起点 vs 当前的轻量对比
- 可选择维度看趋势

不要同时塞：

- 雷达
- 六条折线
- 六个 KPI 卡

---

## 19. 长期趋势 Visual

推荐一个主趋势区域。

默认可以展示：

```text
Rating
```

并允许切换：

```text
大歌力
体力
高速处理
精度力
节奏处理
复合处理
```

同一时间只展示一个主要序列。

---

## 20. 趋势图必须尊重 Segment

趋势图：

```text
segment A —— line
           gap
segment B —— line
```

不同 modelRevision 不连接。

tooltip 中可显示：

- 日期
- value
- focus
- measurement version/model revision（必要时简化）

---

## 21. 不解释微小波动

不要每个：

```text
+0.01 / -0.01
```

都变成成长文案。

趋势图可以诚实显示值。

叙事只挑：

- 当前 segment 首尾变化
- 明显主维度变化
- focus transition

---

## 22. 主变化维度

在当前 compatible segment：

计算六维：

```text
end - start
```

选择绝对变化最大的可比较维度作为：

```text
primaryDimensionChange
```

但如果所有变化都非常接近 0：

不要强行选。

可以：

```text
最近能力结构整体比较稳定
```

---

## 23. 负变化语气

不要写：

```text
退步了
能力下降
```

优先：

```text
近期测量略有回落
```

并避免给原因推断。

---

## 24. Focus Timeline

从 measurements 提取 focus。

先做 run-length compression：

```text
accuracy
accuracy
accuracy
rhythm
rhythm
balanced
```

→

```text
accuracy → rhythm → balanced
```

保存每段：

- startedAt
- endedAt / current
- focus type

---

## 25. Focus Transition 不等于“练成”

例如：

```text
accuracy → rhythm
```

只能表示：

> 当前优先关注方向发生变化。

不能解释成：

> 精度已经解决。

---

## 26. Limited / Insufficient Focus

如果 measurements 有：

```text
limited
insufficient-data
```

必须保留。

不要在 timeline 中偷偷跳过，然后制造连续短板轨迹。

---

## 27. 最近成长节点

Skill Passport V1 的事实节点建议限制为：

> **最近 90 天**

因为 canonical History API 当前明确支持 1–90 天。

节点类型：

- PB
- NG reduced
- clear
- FC
- DF
- rank upgrade
- Goal completed

不要为 Passport 单独突破 90 天 raw-history API。

---

## 28. “长期曲线 + 最近节点”是允许的

因此页面可以明确形成：

```text
长期能力记录
= measurement timeline

最近 90 天的节点
= canonical facts / Goal facts
```

这比假装拥有 all-time milestone history 更诚实。

---

## 29. 节点不做流水账

最近 90 天可能有很多 PB。

只选择有限数量：

```text
最多 6–8 个 meaningful nodes
```

使用：

- crown level
- rank
- PB relative magnitude
- NG magnitude
- Goal relation
- stable ordering

---

## 30. 不定义任意“大 PB”绝对阈值

继续沿用：

> 范围内相对排序。

不要突然规定：

```text
+10,000 才算里程碑
```

---

## 31. Goal 节点

Goal completed 是：

> 玩家主动选择并完成的成长节点。

如果匹配 score fact：

可以组合：

```text
完成练习目标
Fallen Angel
不可 8 → 4
```

如果无法归因具体游玩日：

使用 Goal 的 observation / confirmation 语义，

不要塞进假的 score 日期。

---

## 32. Passport Coverage

页面必须明确：

### Measurement coverage

例如：

```text
能力记录从 2026.09.19 开始
```

### Recent fact coverage

例如：

```text
最近 90 天记录完整
```

或：

```text
最近记录存在缺口
```

---

## 33. Coverage 不能做大 Warning Card

轻量说明即可。

例如：

```text
部分较早记录没有连续能力测量
```

---

## 34. Skill Passport API

推荐新增：

```text
GET /api/account/growth/passport
```

参数：

```text
range=30|90|180|365
dimension=rating|...
```

最终可按实现简化。

服务端：

- resolve current binding
- private/no-store
- 不接受 arbitrary user/profile

---

## 35. Passport API 数据来源

建议：

```text
measurements
↓
daily sampling
↓
version segmentation
↓
current segment summary

+

Growth History last <=90d
↓
meaningful recent facts

+

current Growth Overview
↓
current snapshot + next action
```

---

## 36. Passport API 不重新计算历史六维

不能：

```text
读取旧 score snapshot
→ 用今天 Python 算旧六维
```

历史能力曲线只能来自已经持久化的 measurements。

---

## 37. Current Growth 最多一次 Python Compute

Passport 页面需要：

- current Rating
- current focus
- Today Plan

允许最多一次当前 Growth Overview compute。

不要：

```text
passport service compute
+
前端再 GET overview
```

导致两次 Python。

---

## 38. 默认采用 Passport API 内调用 Current Growth

页面直达必须独立工作。

优先：

> Passport endpoint 自己组合 current Growth，最多 1 次 Python compute。

不要依赖“用户一定从 Home 带着 Growth state 进入”。

---

## 39. Measurement Capture 去重

如果 Passport API 内调用 Overview：

可能触发当前 scoreRevision measurement upsert。

这应继续：

```text
same revision → unique/no-op
```

不得产生重复 measurement。

---

## 40. API 概念 DTO

```ts
{
  profileId,

  coverage: {
    measurementFrom,
    measurementTo,
    measurementDays,
    recentFactsState
  },

  current: {
    rating,
    dimensions,
    focus,
    readiness
  },

  range: {
    requestedDays,
    actualFrom,
    actualTo
  },

  segments: [
    {
      algorithmVersion,
      modelRevision,
      from,
      to,
      points: [...]
    }
  ],

  currentSegmentChange: {
    start,
    end,
    ratingDelta,
    primaryDimensionChange,
    focusFrom,
    focusTo
  },

  focusTimeline: [...],

  milestones: [...],

  currentNextAction: {
    focus,
    todayPlan
  }
}
```

---

## 41. 不新增 Passport DB 表

V1 原则：

```text
NO web_skill_passport
NO passport snapshot table
NO milestone table
```

全部是现有 Measurements + canonical facts 的 projection。

如果实现认为必须持久化 Passport：

先停下说明。

---

## 42. 路由

建议：

```text
/my/growth
```

用户可见名称：

```text
成长档案
```

也可根据现有 IA 审计选择 `/my/passport`，但避免技术名暴露。

---

## 43. Weekly 与 Passport 的关系

Weekly：

> “这一周发生了什么？”

Passport：

> “长期能力结构怎么变化？”

Weekly 页面增加轻入口：

```text
查看成长档案
```

Passport 中也可以：

```text
看看这一周
```

两者互相连接，但不合并成一个大页面。

---

## 44. Home Entry

首页不再新增第三个大型 Growth 区块。

可以在现有 Growth 区域：

```text
这一周
成长档案
```

作为轻量二级入口。

避免 Home 越来越像菜单。

---

## 45. Mobile Layout

建议：

```text
成长档案
记录自 ...

[现在的我]
Rating + focus + 当前六维 visual

[这段时间]
一个主趋势图
维度切换

[关注方向]
focus timeline

[最近的节点]
最多 6–8 条

[接下来]
当前 focus / Today Plan
```

单列阅读流。

---

## 46. Desktop Layout

可以适度利用宽度：

- 主趋势区更宽
- 当前六维作为辅助 visual

但不要：

```text
左边 KPI 右边 KPI
下面 4 张图
再下面 8 张卡
```

仍然保持 narrative page。

---

## 47. Skill Passport 不做“证件卡”拟物

虽然内部叫 Passport，

不要设计成：

- 护照封皮
- 证件号码
- 国籍/签发日
- 等级徽章
- 游戏角色档案卡

产品更适合成长记录 / personal log。

---

## 48. Chart Interaction

趋势图至少支持：

- dimension selector
- hover/tap point
- segment break
- current range

移动端：

- 横向不要 overflow
- tooltip 可点击/触摸
- 不依赖 hover

---

## 49. Accessible Chart

必须有：

- textual summary
- aria label / semantic description
- 不只靠颜色区分 segment
- keyboard 可操作 selector

---

## 50. Empty State — 新用户

只有 1 个 measurement：

```text
成长记录刚刚开始

再积累一些成绩后，
这里会慢慢出现你的能力轨迹。
```

当前 snapshot 仍可展示。

---

## 51. Empty State — Limited

如果 current readiness limited：

```text
目前的成绩记录还不足以形成稳定的能力轨迹。
```

不要画假趋势。

---

## 52. Model Revision Break

如果范围内多个 segment：

页面可以显示：

```text
计算口径曾更新
```

用户点开可看到：

```text
不同阶段不直接比较变化量
```

不要暴露长 SHA-256。

---

## 53. Algorithm Version

UI 默认不展示：

```text
growth-v1
```

除非用户打开说明。

版本 metadata 主要用于正确计算。

---

## 54. Measurement 点过密时

API 已按日取 representative，

因此 365 天最多约 365 points / dimension。

不需要前端再做随机 downsample。

---

## 55. Focus Timeline 去抖

第一版不要引入人为“连续 3 天才算切换”的心理规则。

只做：

> consecutive identical focus run compression

保持事实。

---

## 56. Milestone Composer

建议纯函数：

```text
buildSkillPassportMilestones(facts, goals)
```

只做：

- selection
- ranking
- relation
- presentation DTO

不重定义 canonical facts。

---

## 57. Milestone 稳定排序

同样输入必须同样输出。

tie-break 使用：

- attributed time / observed time
- fact priority
- stable factKey

不要随机。

---

## 58. 当前 Goal

如果存在 active Goal：

Passport 底部可显示轻量：

```text
这次想练
...
```

如果 recent completed：

可显示：

```text
最近练成
...
```

但不要复制 Home 全套 Goal UI。

---

## 59. Today Plan

Passport 只显示：

- 当前 focus
- “可以试试这三首”入口或轻量列表

不要把整个 Home 再复制一遍。

---

## 60. i18n

zh / ja 独立自然化。

重点：

- 成长档案
- 记录自
- 这段时间
- 关注方向
- 最近的节点
- 计算口径更新
- 记录刚刚开始

---

## 61. Tests — Measurement Segmentation

至少：

- one segment
- two model revisions
- algorithm version break
- measurement version break
- one point only
- multiple points same day
- daily representative chooses last
- out-of-order rows stable sort

---

## 62. Tests — Current Segment Change

至少：

- positive primary dimension
- negative primary dimension
- all nearly unchanged
- focus same
- focus changed
- balanced
- limited
- missing dimension

---

## 63. Tests — Focus Timeline

至少：

```text
accuracy, accuracy, rhythm, rhythm, balanced
```

压缩正确。

还要：

- limited
- insufficient
- single state
- model break

---

## 64. Tests — Milestones

至少：

- PB-heavy
- crown-heavy
- rank
- Goal matched to score
- Goal observation-only
- duplicate facts
- stable ordering
- max 8
- partial coverage

---

## 65. Tests — Coverage

至少：

- measurement starts today
- 30/90/180/365 requested
- actual shorter than requested
- recent facts complete
- recent facts partial
- history truncated
- manual source

---

## 66. Browser Matrix

至少：

1. rich 90d
2. new user / one measurement
3. focus transition
4. balanced
5. limited
6. model revision break
7. 30d
8. 180d
9. 365d / shorter actual coverage
10. milestone-rich
11. no recent milestones
12. active Goal
13. recent completed Goal
14. profile switch

覆盖：

- zh / ja
- mobile / desktop
- light / dark（如果现有 runner 已成熟）

---

## 67. Browser 验收重点

- 无 KPI Grid
- 无 7 条线同时堆叠
- segment break 可理解
- current snapshot 不是卡片堆
- mobile 图表不 overflow
- tooltip/tap 正常
- no raw key
- no raw SHA
- no hydration error
- no Dashboard 化
- Weekly / Goal links 正常

---

## 68. Production Smoke

隔离生产账号构造：

- 多日 compatible measurements
- 一个 modelRevision break
- focus transition
- recent PB / FC / Goal milestone
- current active Goal / next action

验证：

- Passport API
- daily sampling
- segment break
- current segment change
- milestones
- current Growth
- profile isolation
- reload
- cleanup

---

## 69. Performance

记录：

- measurements query
- daily sampling
- segment build
- recent 90d history
- milestone composer
- current Overview
- total endpoint
- browser visible

目标：

> Passport 最多 1 次 Python compute。

---

## 70. 365 天查询性能

真实测试至少使用：

- 当前最大 measurement 样本
或
- synthetic realistic rows

确认：

- SQL query
- DTO size
- browser render

不因为当前生产 measurement 历史短就跳过容量测试。

---

## 71. Measurement DB Growth 不改变

0.70.2 不增加 measurement 频率。

仍然：

> 新 scoreRevision 首次成功 Growth compute 后 upsert。

Passport 只是读取。

---

## 72. No Schema Migration

本版原则：

```text
NO NEW TABLE
NO ALTER measurement table
```

若发现现有 measurement 缺少关键字段：

先停下审计。

---

## 73. Privacy

Passport：

- authenticated only
- current binding
- private/no-store
- no arbitrary profile selector
- no public share URL

分享以后单独设计。

---

## 74. Goal / Weekly / Daily Regression

必须完整保持：

- 0.69.x Goal loop
- 0.70.0 Growth History
- 0.70.1 Weekly Recap
- Daily Progress
- Home state

---

## 75. Completion Blockers

任一存在不得关闭：

- 当前算法回算过去并称为历史 measurement
- 跨 modelRevision 直接算 delta
- 伪造 all-time coverage
- Skill Passport 变成 KPI Dashboard
- 七条趋势线同时堆叠
- focus change 被解释成“练好了”
- milestone 重新定义事实规则
- Goal completedAt 冒充游玩时间
- Passport 触发 >1 Python compute
- 新增不必要 Passport persistence
- profile data 串线
- production smoke 未 PASS
- Weekly / Goal / History regression

---

## 76. 最终报告必须回答

1. 实施开始 / 最终版本？
2. 用户可见名称？
3. 页面路由？
4. Passport API contract？
5. range 支持？
6. daily representative 规则？
7. measurement segment key？
8. modelRevision break 如何展示？
9. 是否跨 segment 算 delta？
10. current segment 如何定义？
11. Rating trend？
12. dimension selector？
13. primary dimension change？
14. negative change wording？
15. focus timeline？
16. limited / balanced？
17. measurement coverage？
18. recent fact coverage？
19. milestones 范围？
20. milestone selection？
21. Goal milestone 时间语义？
22. 是否展示 all-time milestone？
23. current Growth 是否计算？
24. Python 次数？
25. active Goal / next action？
26. Weekly 入口联动？
27. 是否新建 DB 表？
28. 是否改 measurement capture？
29. 30/90/180/365 性能？
30. browser matrix？
31. production smoke？
32. cleanup/orphan？
33. Goal regression？
34. Weekly regression？
35. 是否正式建立长期 Growth Story？

---

## 77. 完成状态

全部 Gate 通过后记录：

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

---

## 78. 0.70.x 完成后的产品状态

完成 Weekly + Skill Passport 后，Viewer 应能连续回答：

```text
今天发生了什么？
→ Daily Progress

这周发生了什么？
→ Weekly Growth Recap

最近一段时间我是怎么变化的？
→ Skill Passport

现在接下来练什么？
→ Player State + Today Plan + Goal
```

这时“国服太鼓玩家的成长账户”才真正从单次推荐，扩展为具有时间连续性的个人成长记录。
