# Sakura Taiko Viewer 0.69.0
# Goal Foundation
# Today Plan → User Choice → Persistent Baseline

## 0. 阶段定位

当前生产运行基线：

- Viewer：`0.68.12`
- `0.68.9 Daily Progress Narrative` 已完成最终历史重放闭环
- Authoritative History Replay：PASS
- Real Browser Fixture：PASS
- Production Authenticated Smoke：PASS
- 自然发生的真实用户改善不再作为 Closure Blocker
- Player Growth 当前已经能够回答：
  - 我现在大致是什么状态
  - 最近可以从哪个方向入手
  - 可以试试哪些谱面
  - 今天实际发生了哪些可证明的变化

现有闭环仍缺少关键一环：

```text
系统给出推荐
↓
用户真的决定练哪一张
↓
？
↓
后来发生了什么
```

当前 Today Plan 每次重新计算后可以变化，因此系统还不能稳定回答：

> “这张谱是不是玩家之前主动选下来的练习目标？”

也不能可靠建立：

```text
Recommendation
→ User Choice
→ Baseline
→ Later Result
```

的时间因果链。

因此下一阶段正式进入：

`0.69.x GOAL FEEDBACK LOOP`

第一阶段：

# `0.69.0 GOAL FOUNDATION`

本版只建立：

> **用户选择一张谱作为这次想练的目标，并冻结当时的 authoritative baseline。**

本版不负责最终完成判定。

---

## 1. 0.69.x 总路线

```text
0.69.0
Goal Foundation
选择 + 持久化 + Baseline

0.69.1
Goal Evaluation
未来 authoritative score → progress / completed

0.69.2
Growth Feedback Loop Closure
Goal result → Daily Progress / Home → Next Action
```

不要在 0.69.0 一次实现全部。

---

## 2. 0.69.0 的用户问题

本版只回答：

> **“我这次准备练哪张谱？”**

而不是：

> “系统今天布置给我什么任务？”

产品语言继续保持生活化、低命令感。

---

## 3. 产品核心原则

### 3.1 Goal 必须由用户主动选择

禁止系统自动把第一首推荐设为目标。

Today Plan 只是建议。

用户必须主动：

```text
选择一首
↓
确认想练什么
```

才能建立 Goal。

### 3.2 V1 同时只允许 0 或 1 个 Active Goal

不要第一版就实现：

- 多目标队列
- 每日任务列表
- 周计划
- 热身 / 主练 / 挑战三任务
- 连续打卡
- XP

V1：

```text
activeGoal = null | one goal
```

### 3.3 Goal 不强制当天完成

Goal 不应默认午夜失效。

Goal 可以跨日保持 `active`，直到：

- 用户取消
- 用户换一首
- 后续 0.69.1 判定完成

---

## 4. 编码前必须先做 Goal Evaluability Audit

不要先建表。

必须先审计当前：

- Account / Web User identity
- 当前成绩账号 / binding identity
- 多账号切换
- manual / Wahlap / Hiroba 等当前 score owner 表达
- Today Plan DTO
- current score record
- history snapshot
- authoritative score timestamp
- recommendation basis / mode
- 当前 DB migration 规范
- account deletion / cascade 规范

必须先回答：

> Goal 应绑定到哪个稳定身份？

目标语义必须是：

```text
Web User
+
Current Score Profile / Current Taiko Account
```

不能只绑定浏览器 session，也不能让客户端随意传任意 userId / taikoId 来创建 Goal。

---

## 5. 多账号语义

用户切换当前绑定账号后：

```text
账号 A
active goal = Fallen Angel

切换账号 B
active goal = null / B 自己的 goal

切回 A
active goal = Fallen Angel
```

不得跨玩家成绩账号串 Goal。

---

## 6. 只从 Today Plan 创建 Goal

0.69.0 V1：

Goal 入口只开放在当前 Today Plan 候选。

暂不支持：

- 任意 Song Detail “设目标”
- Forum Thread
- Search Result
- 手动输入 songId

这样可以建立最清楚的因果来源：

```text
Today Plan
→ User selected
→ Goal
```

---

## 7. 创建 Goal 时必须记录 Recommendation Source

Goal 不能只保存 songId / difficulty。

至少概念上保存：

```text
source = today-plan
sourceBasis = accuracy_power / stamina / ...
sourceMode = dimension | general-fallback
sourceRank = 1 | 2 | 3
sourceGeneratedAt / sourceRevision（按现有可用数据）
```

目的：

> 未来能够可靠说，这张谱确实是当时 Today Plan 中用户主动选下来的。

不需要保存整份推荐列表。

---

## 8. Recommendation Source 必须服务端验证

客户端不能提交：

```json
{
  "songId": 123,
  "source": "today-plan"
}
```

服务器就直接相信。

创建 Goal 时必须：

- 从当前 authenticated player state 得到 Today Plan
- 验证 songId + difficultyType 属于合法候选
- 服务端确定 sourceBasis / sourceMode / sourceRank

如果当前计划已经变化，按实际实现：

- 返回 conflict / stale plan
- 或使用当前仍合法的同一候选

但不得伪造 Today Plan attribution。

---

## 9. Goal Baseline 是本阶段最重要的数据

用户点击确认时，必须冻结当时的 authoritative chart state。

概念：

```ts
GoalBaseline {
  recordPresent: boolean

  highScore?: number

  goodCnt?: number
  okCnt?: number
  ngCnt?: number
  comboCnt?: number

  clearCnt?: number
  fullComboCnt?: number
  dondafulComboCnt?: number

  bestScoreRank?: number

  scoreObservedAt?: string
}
```

字段名按现有 authoritative score DTO 调整。

不得使用 UI display string 作为 baseline。

---

## 10. Baseline 版本化

Baseline 应带：

```text
baselineVersion = 1
```

这样以后 score schema / Goal types 扩展时可以兼容旧 Goal。

---

## 11. createdAt 与 observedAt 必须区分

至少保留：

```text
goal.createdAt
baseline.scoreObservedAt
```

以后 0.69.1 Goal Evaluation 必须能够判断：

> 新成绩是否发生在 Goal 创建之后。

这是 Goal Loop 的因果基础。

---

## 12. V1 Goal Type 原则

目标必须：

- 用户能理解
- 有明确 baseline
- 后续能由 authoritative score 判断
- 不依赖伪概率
- 不依赖模型预测

候选 V1：

```text
score-pb
ng-reduced
clear
fc
df
rank-upgrade
```

必须逐项确认 future evaluation 是否可可靠实现。

如果某项不可靠，0.69.0 不提供该选项。

---

## 13. 禁止 Accuracy Goal

默认：

`NO ACCURACY GOAL IN 0.69.0`

除非本阶段审计发现已有统一 authoritative calculator 可直接复用，并明确报告。

不要自行增加：

```text
良率达到 98%
精度提升到 xx%
```

---

## 14. 不做概率 Goal

禁止：

```text
FC 成功概率 68%
预计三次内完成
完成概率高
```

没有经过历史校准的预测模型。

---

## 15. 不要求用户输入任意目标数值

第一版不要做：

```text
目标分数：[输入框]
目标不可：[输入框]
```

优先提供少量语义明确的 Goal Type。

---

## 16. 推荐 Goal 文案

例如：

### Score PB

```text
刷新最好成绩
```

### NG Reduced

```text
把不可再压低一点
```

### Clear

```text
先拿到通关
```

### FC

```text
试试全连
```

### DF

```text
试试全良
```

### Rank

```text
把评价再提一级
```

最终 zh / ja 必须人工自然化。

---

## 17. Goal Type 不是 Recommendation Dimension

必须严格区分：

```text
为什么推荐这张谱
=
targetDimension

用户这次想做到什么
=
goalType
```

例如：

```text
推荐方向：精度
Goal：刷新最好成绩
```

完全合法。

不得强行推导：

```text
精度推荐
→ Goal 必须是 NG
```

---

## 18. Goal Option 由 Baseline 决定

Goal 创建面板只显示当前可用选项。

例如已有 Clear、未 FC：

```text
刷新最好成绩
把不可再压低一点（如可判定）
试试全连
评价再提一级（如适用）
```

已经 FC 就不再显示“通关 / 全连”。

---

## 19. 无当前成绩的推荐谱

必须审计 Today Plan 中未游玩谱的语义。

如果 baseline：

```text
recordPresent = false
```

可考虑提供：

```text
先打一次
```

或：

```text
试试通关
```

但必须明确 0.69.1 能根据：

```text
goal.createdAt
+
new authoritative record timestamp
```

证明它是在 Goal 之后发生。

如果做不到：

未游玩候选暂不允许创建 Goal，并给自然解释。

不要猜“首次游玩”。

---

## 20. Goal 创建交互

Today Plan 当前：

```text
可以试试这三首

[Song A]
[Song B]
[Song C]
```

每首增加一个轻量 action：

```text
选这首
```

不要使用：

```text
领取任务
开始训练
接受挑战
```

---

## 21. 点击「选这首」

弹出轻量 bottom sheet / dialog：

```text
这次想练到哪一步？

Fallen Angel
魔王 · 9星

○ 刷新最好成绩
○ 把不可再压低一点
○ 试试全连

[取消]        [就选这个]
```

用户明确选择 Goal Type。

---

## 22. Active Goal 的首页位置

Goal 不做第四张巨大 Dashboard Card。

建议放在：

```text
可以试试这三首
↓
这次想练
↓
今天
```

例如：

```text
这次想练

Fallen Angel
魔王 · 9星

刷新最好成绩
当前 998,360

换一首    取消
```

---

## 23. Active Goal 标题

优先：

```text
这次想练
```

避免：

```text
当前任务
当前目标
今日任务
训练任务
```

保持生活感。

---

## 24. Goal 不隐藏 Today Plan

存在 active Goal 时，Today Plan 仍保留。

当前 Goal 可以在对应 Song Card 上轻量标识：

```text
已选
```

不要大面积高亮。

---

## 25. 换一首

如果已有 active goal，点击其他候选必须明确确认：

```text
换成这首？
```

原 Goal：

```text
status = cancelled / superseded
```

新 Goal 创建。

不得静默覆盖历史记录。

---

## 26. 取消 Goal

取消后：

- 当前 active goal 消失
- Today Plan 正常保留
- 不删除历史数据库行
- status 变为 cancelled

不要用“失败”描述取消。

---

## 27. Goal 状态 V1

至少：

```text
active
cancelled
```

为后续预留：

```text
completed
```

0.69.0 不自动写 completed。

---

## 28. Conceptual Persistence Model

实际字段必须按当前数据库规范设计。

概念至少包含：

```text
id

owner user identity
score profile identity

songId
difficultyType

source
sourceBasis
sourceMode
sourceRank

goalType
targetData

baselineVersion
baselineData

status

createdAt
updatedAt
cancelledAt
completedAt (reserved)
```

---

## 29. Baseline JSON vs Typed Columns

编码前审计当前 DB conventions。

允许：

- 核心索引字段 typed
- baseline / target snapshot 使用 versioned JSON

但必须根据项目现有 MySQL 风格决定，不要无审计拍板。

---

## 30. Active Goal 唯一性

语义：

> 同一个 Web User 的同一个 score profile 同时最多一个 active goal。

必须防止：

- double click
- retry
- concurrent POST

产生两个 active goals。

---

## 31. 并发创建

测试：

```text
POST Goal A
POST Goal B
```

并发。

最终必须只有一个 active。

实现可以使用：

- transaction + lock
- DB constraint
- 项目现有等价方式

不要只依赖前端 disable button。

---

## 32. 重复点击同一 Goal

同一 song + difficulty + goalType 已经 active：

优先返回 existing goal 或明确 idempotent result。

不要重复创建两条。

---

## 33. Goal API

路径按当前 account API convention 决定。

概念：

```text
GET active goal
POST create / replace goal
DELETE / cancel active goal
```

可以设计为：

```text
/api/account/growth/goal
```

或项目现有等价规范。

不要为一个 Goal 拆很多 endpoint。

---

## 34. 浏览器请求数量

优先把：

```text
activeGoal
```

并入现有 Growth Overview。

这样 Home 不增加新的 GET waterfall。

Write mutation 单独调用。

---

## 35. HTTP Privacy

所有 Goal read/write 必须：

```text
private
no-store
authenticated
```

不得 public cache。

---

## 36. Authorization

服务器必须从 session 推导：

- Web User
- current score profile

客户端不得指定任意 ownerUserId / targetUserId 来读写别人的 Goal。

---

## 37. Profile Switch

切换 score account 后：

Growth Overview 必须读取对应 profile Goal。

不得显示上一账号 active goal。

---

## 38. Account Deletion / Privacy

Goal 属于用户私有数据。

必须审计：

- Web account 删除
- score profile 删除 / unbind
- privacy cleanup

至少保证 Web account 被删除时 Goal 不成为 orphan private data。

---

## 39. Unbind 行为

如果用户解绑一个仍有 active Goal 的 score profile，必须定义清楚。

不要产生：

> 首页看不到，但数据库永久 active

的悬挂状态。

实现前报告现有 account/binding 删除语义。

---

## 40. Chart Availability

如果 Goal 对应谱面后来：

- 下架
- inactive
- unavailable

不要自动换歌。

Goal 可以显示：

```text
这张谱目前不可用
```

并允许取消。

不要悄悄删除用户选择。

---

## 41. 0.69.0 不做 Goal Evaluation

本版禁止：

```text
active
→ completed
```

自动判定。

即使新成绩已经到达。

Goal Evaluation 留给：

`0.69.1`

---

## 42. 0.69.0 不修改 Daily Progress

当前 Daily Progress Narrative 已封板。

本版不得为了 Goal 改变 event ranking / historical interpretation。

---

## 43. 不在 Daily Progress 宣称 Goal 结果

0.69.0 即使 active Goal 对应今天发生 improvement，也不能展示：

```text
目标完成
```

最多继续按现有事实：

```text
不可 8 → 4
```

---

## 44. 不做 Daily Expiry

Goal 不因 00:00 自动取消。

不要出现：

```text
今天的目标已过期
```

这种任务系统语义。

---

## 45. Goal Option Server Authority

客户端 UI 可以展示 Goal options。

但 POST 时服务器必须再次验证：

- baseline state
- goalType still valid
- chart still valid

不能相信前端 option。

---

## 46. Goal Option DTO

可以考虑 Today Plan item 返回：

```ts
goalOptions: [
  {
    type: 'score-pb',
    labelKey: ...
  }
]
```

但不要把最终翻译文案从服务器返回。

i18n 留给 Viewer。

---

## 47. Suggested Goal

V1 默认不要强行推荐某一种 Goal Type。

让用户选择：

```text
这次想练到哪一步？
```

比：

```text
建议目标：不可 ≤ 5
```

更符合用户主动性，也避免 arbitrary target。

---

## 48. 目标数值 V1

V1 Goal Types 使用相对条件：

```text
score > baseline
NG < baseline
crown >= target
rank > baseline
```

不自动生成：

```text
998,360 → 1,010,000
NG 7 → 5
```

这种任意阈值。

---

## 49. Future Evaluation Compatibility

Baseline 必须足够让 0.69.1 判断：

### score-pb

```text
future.highScore > baseline.highScore
```

### ng-reduced

```text
future.ng < baseline.ng
```

并满足 future record 的完整性与时间证据。

### crown

```text
future crown >= target crown
```

### rank

```text
future rank > baseline rank
```

---

## 50. 时间因果硬规则预留

0.69.1 必须要求：

```text
future authoritative score time
>
goal causal boundary
```

因此 0.69.0 数据结构不能遗漏因果时间。

---

## 51. 历史重放验收方法继续沿用

不要等真实用户：

```text
选 Goal
→ 出门打鼓
→ 回来同步
```

0.69.0 验收使用：

```text
Goal creation fixture
+
page reload
+
account switch
+
browser fixture
+
production authenticated smoke
```

0.69.1 再加入 future snapshot replay。

---

## 52. Migration Audit

本版大概率需要数据库持久化。

编码前必须先报告：

- migration framework
- table naming
- FK convention
- timestamp convention
- JSON column convention
- account deletion behavior

确认后再 migration。

---

## 53. 版本规则

当前 runtime：

`Viewer 0.68.11`

Goal Foundation 是新增用户能力，采用 minor：

`Viewer 0.69.0`

如果实施开始时 canonical version 已高于 0.68.11：

必须先读取：

```text
package.json
→ nuxt.config
→ runtimeConfig.public.appVersion
```

并根据真实版本决定。

---

## 54. Tests — Persistence

至少：

1. create active goal
2. read after create
3. reload persists
4. logout/login persists
5. cancel
6. replace
7. same goal duplicate submit
8. concurrent creates
9. multiple users isolation
10. multiple score profiles isolation
11. profile switch
12. unbound
13. empty score
14. invalid chart
15. inactive chart
16. invalid goal type
17. already-achieved goal type
18. unauthorized

---

## 55. Tests — Baseline

至少：

- played chart baseline
- unplayed chart baseline
- high_score
- NG
- crown
- rank
- observedAt
- missing optional fields

baseline 必须与创建瞬间 authoritative current score 一致。

---

## 56. Tests — Recommendation Source

验证：

- goal source = today-plan
- basis 正确
- dimension/general fallback 正确
- source rank 正确
- forged non-plan song 被拒绝 / 按定义处理
- active Goal 不因 Today Plan 后续变化自动变化

---

## 57. Browser Fixture Matrix

至少：

### Ready + no goal
可以试试三首，每首可选。

### Ready + create goal
Goal 立即出现。

### Reload
Goal 保留。

### Cancel
Goal 消失，Today Plan 保留。

### Replace
旧 Goal 取消，新 Goal active。

### Balanced
general plan 也能选择。

### Limited
general fallback 也能选择。

### Profile switch
不同 account Goal 正确切换。

---

## 58. 390×844 UX

重点：

- `选这首` 不挤 Song Card
- Goal confirmation sheet 不占满屏
- `这次想练` 不做巨大 Card
- Today Plan 仍可见
- Daily Progress 仍自然
- 不恢复 Dashboard 感

---

## 59. 1440×900 UX

Goal 不应被拉成大横幅。

保持内容宽度和现有 Home rhythm。

---

## 60. zh / ja

人工检查：

- 选这首
- 这次想练
- 这次想练到哪一步？
- 刷新最好成绩
- 把不可再压低一点
- 通关
- 全连
- 全良
- 评价提升
- 换一首
- 取消

日文必须独立自然化。

---

## 61. Accessibility

Goal selector：

- keyboard reachable
- radio/options semantic
- focus visible
- dialog focus trap
- Esc close
- create loading
- duplicate submit blocked

Song Card 内 Goal action不能破坏原本整卡进入 Song Detail 的行为。

---

## 62. Mutation Feedback

Create：

```text
tap
→ button loading
→ success
→ active Goal appears
```

Cancel / Replace 同理。

不得：

- full page reload
- scroll top
- whole Home skeleton

---

## 63. Performance

Goal read 不应新增 browser GET waterfall。

优先并入 Growth Overview。

Goal write 是低频 mutation。

创建 Goal 如果需要服务端校验 Today Plan，记录实际耗时。

不要求和普通首页一样快，但不能 3–5 秒级无反馈。

---

## 64. Production Smoke

不需要等待真实游玩。

真实登录生产环境至少：

1. 从 Today Plan 选一首
2. 创建 Goal
3. refresh
4. Goal 仍存在
5. cancel
6. refresh
7. Goal 消失
8. 测试数据清理 / 恢复

如不允许污染正式个人账号，使用隔离生产测试账号。

---

## 65. Completion Blockers

以下任一存在不得关闭 0.69.0：

- Goal 自动创建而非用户选择
- 一个 profile 可出现两个 active Goals
- Goal 未绑定正确 score profile
- 切换账号出现串 Goal
- baseline 不是创建时 authoritative state
- 缺 createdAt / causal boundary
- source 伪装成 Today Plan
- 客户端可为任意 song forge Today Plan Goal
- 已达成目标仍可创建
- Goal reload 后消失
- cancel 静默 hard-delete
- Goal 替换静默覆盖
- Goal 因午夜自动过期
- 0.69.0 提前宣称 completed
- Daily Progress 提前宣称 Goal 完成
- 新增伪概率
- UI 重新变成 Task Dashboard
- zh / ja raw key
- cross-user private data leak

---

## 66. 最终报告必须回答

1. 实施开始时真实 Viewer 版本？
2. 最终 Viewer 版本？
3. Goal owner identity 是什么？
4. score profile identity 是什么？
5. 一个 profile 最多几个 active Goal？
6. 如何防并发双 Goal？
7. Goal 从哪里创建？
8. 服务端如何验证 Today Plan source？
9. 保存哪些 source metadata？
10. baseline 保存哪些字段？
11. baselineVersion？
12. createdAt / observedAt 如何处理？
13. V1 支持哪些 goalType？
14. 哪些候选 goalType 被审计后排除？
15. 是否支持未游玩谱？
16. 如果支持，目标是什么？
17. 是否存在 accuracy Goal？
18. 是否存在概率 Goal？
19. 是否自动生成任意目标数值？
20. active Goal 如何进入 Growth Overview？
21. 是否新增额外 Home GET？
22. create / cancel API？
23. replace 如何实现？
24. cancel 是否保留历史？
25. profile switch 是否通过？
26. account deletion / unbind 如何处理？
27. inactive chart 如何处理？
28. Ready browser fixture？
29. Balanced fixture？
30. Limited fixture？
31. 390×844？
32. 1440×900？
33. zh？
34. ja？
35. production create/reload/cancel smoke？
36. 是否实现任何 Goal Evaluation？
37. 是否改 Daily Progress？
38. 是否准备好进入 0.69.1？

---

## 67. 0.69.0 Completion State

全部通过后记录：

`0.69.0 GOAL FOUNDATION COMPLETE`

`USER-SELECTED PRACTICE GOAL ESTABLISHED`

`ONE ACTIVE GOAL PER SCORE PROFILE ESTABLISHED`

`TODAY PLAN → GOAL SOURCE ATTRIBUTION ESTABLISHED`

`AUTHORITATIVE GOAL BASELINE PERSISTED`

`GOAL CAUSAL TIME BOUNDARY ESTABLISHED`

`GOAL SURVIVES RELOAD / LOGIN / DEVICE`

`GOAL EVALUATION NOT YET ENABLED`

`READY FOR 0.69.1 GOAL EVALUATION`

---

## 68. 下一阶段：0.69.1

0.69.1 才开始：

```text
Active Goal
↓
Later Authoritative Score
↓
Verify event happened after Goal creation
↓
Compare against frozen baseline
↓
progressed / completed
```

继续采用：

```text
Goal baseline fixture
+
authoritative future snapshot replay
+
real browser fixture
+
production authenticated smoke
```

不要求等待真实用户自然完成目标。

---

## 69. 0.69.2 预览

0.69.2 再把结果接回 Home：

```text
今天

目标完成
Fallen Angel
不可 8 → 4
```

随后重新计算：

```text
Player State
→ Today Plan
→ Next Action
```

那一版才正式宣布：

`GOAL FEEDBACK LOOP ESTABLISHED`
