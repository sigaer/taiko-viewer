# Sakura Taiko Viewer 0.68.9

# Daily Progress Narrative & Growth Copy Tone Closure

# 首页「今天」事件化反馈 × Growth 文案生活化收口

## 0. 当前基线

当前公开生产版本：

- Viewer：`0.68.8`
- Player Growth 首页已经具备：
  - Greeting
  - Rating
  - 六维
  - 当前推荐方向
  - 推荐歌曲
  - Daily Progress
- Growth compute / recommendation / history 基础能力已经存在
- Daily Progress 已能基于 authoritative history 判断当天是否游玩，并能在有证据时计算部分变化

当前主要问题已经不再是“有没有数据”，而是：

> **首页把成长反馈压缩成了 KPI，而没有把玩家今天真正发生的事情说出来。**

当前典型表现：

```text
今天

2        0        0
涉及谱面  刷新最高分  段位变化
```

这种表达存在明显问题：

- `涉及谱面` 是系统统计术语，不是玩家语言
- 两个 `0` 占据主要视觉空间
- “没有刷新最高分”被误当成“没有进步”
- 推荐歌曲上发生的真实改善没有被具体表达
- 首页缺少“今天发生了什么”的反馈感
- Growth Hero 仍有部分命令式、任务式文案，例如：
  - `下一步`
  - `接下来先练精度`
  - `练这三首`
- 整体仍带有少量“系统给玩家下训练指令”的感觉

因此本阶段定义为：

`0.67.2 DAILY PROGRESS NARRATIVE & GROWTH COPY TONE CLOSURE`

---

# 1. 本阶段目标

本阶段只解决两件事：

## A. Daily Progress 从 KPI Grid 改成 Event Narrative

从：

```text
2 涉及谱面
0 刷新最高分
0 段位变化
```

改成：

```text
今天

打了 2 张谱

Fallen Angel
不可 7 → 4
打得更稳了
```

或在有更强事件时：

```text
今天

刷新最好成绩

Fallen Angel
998,360 → 1,005,490
+7,130
```

核心原则：

> **具体事件优先于统计数字。**

## B. Growth 文案从“命令式”改成“观察式 / 建议式”

从：

```text
下一步
接下来先练精度
```

调整为更自然、生活化、非命令式的表达，例如：

```text
最近可以从精度入手
```

或：

```text
最近可以多练练精度
```

Today Plan 从：

```text
练这三首
围绕精度力挑选的谱面
```

调整为更自然的：

```text
可以试试这三首
```

必要时不再重复副标题。

---

# 2. 本轮严格范围

允许修改：

- 首页 Hero Growth copy
- Today Plan section copy
- Daily Progress 数据 presentation
- Daily Progress event extraction / ranking
- Daily Progress DTO 中必要的事件化字段
- zh / ja 文案
- 轻量 UI hierarchy / spacing
- 必要的 event helper

禁止：

- 修改 Rating 算法
- 修改六维算法
- 修改 recommendation ranking
- 修改推荐候选逻辑
- 修改 Goal 业务
- 新增 Goal persistence
- 新增 recommendation persistence
- 新增 Schema，除非审计证明现有历史无法实现最低要求，并必须先停下报告
- 修改 Community
- 修改 Forum
- 大改首页整体布局
- 新增 streak / 打卡 / XP
- 新增 AI 概率
- 新增训练任务系统

本轮仍属于：

> **Player Growth Presentation Closure**

不是：

> **Goal Feedback Loop**

---

# 3. 开始前必须先做 Daily Progress Capability Audit

不要先改 UI。

先审计现有数据链：

- current score snapshot
- full snapshots
- delta snapshots
- `high_score`
- `good_cnt`
- `ok_cnt`
- `ng_cnt`
- `combo_cnt`
- crown / clear / full combo / dondaful
- `best_score_rank`
- Rating history
- six-dimension history
- `played_at`
- `highscoretime`
- `updatetime`
- stage count
- 当前 Calendar Day 逻辑
- `Asia/Shanghai`

输出：

## A. 当天可以证明的事实

明确哪些可以可靠判断：

```text
今天打过哪些谱
今天首次出现哪些谱
今天哪些谱 score 提升
今天哪些谱 NG 下降
今天哪些谱 accuracy 提升
今天哪些谱 crown 提升
今天哪些谱 rank/评价提升
今天 Rating 是否变化
今天六维是否变化
```

每项标记：

- `PROVABLE`
- `PARTIALLY_PROVABLE`
- `NOT_PROVABLE`

---

# 4. 核心数据原则

继续严格遵守：

> **无法从 authoritative history 证明 before → after 的变化，不展示。**

不得：

```text
current NG = 4
baseline NG = unknown
→ 猜测今天 NG 有进步
```

不得：

```text
当前是 FC
→ 假设今天刚拿到 FC
```

必须能够证明：

```text
previous state
→ current state
```

且变化发生在当前 Calendar Day。

---

# 5. Daily Progress 不再固定三个 KPI

删除固定：

```text
涉及谱面
刷新最高分
段位变化
```

三栏结构。

特别是：

> **0 不应该占据大面积首页空间。**

如果某类事件为 0：

默认不展示该事件。

---

# 6. Daily Progress Event Model

建议内部增加 presentation-level event model，例如：

```ts
type DailyProgressEvent = {
  type:
    | "played"
    | "first-play"
    | "score-pb"
    | "accuracy-improved"
    | "ng-reduced"
    | "combo-improved"
    | "clear-upgrade"
    | "fc"
    | "df"
    | "rank-upgrade"
    | "rating-change"
    | "dimension-change";

  songId?: number;
  difficultyType?: number;

  before?: number | string | null;
  after?: number | string | null;
  delta?: number | null;

  occurredAt?: string | null;

  evidence: "history" | "delta-snapshot" | "full-snapshot";

  importance: number;
};
```

字段命名按当前项目风格调整。

重点不是 schema，而是：

> **首页消费具体事件，而不是只消费 count。**

---

# 7. 不新增数据库 Event Table

本轮默认：

`0 Schema Migration`

Daily Progress Event 应从现有 authoritative history 派生。

只有如果当前 history 完全无法支撑必要事件，才停下报告：

- 缺什么
- 为什么缺
- 最小历史模型是什么

禁止自动创建：

```text
growth_events
daily_events
daily_sessions
```

这些属于后续阶段。

---

# 8. Event 类型：Score PB

如果存在真实 previous best：

```text
before = 998360
after = 1005490
```

首页可展示：

```text
刷新最好成绩

Fallen Angel
998,360 → 1,005,490
+7,130
```

不要只展示：

```text
刷新最高分 1
```

---

# 9. Event 类型：NG / 不可下降

如果历史能证明：

```text
NG 7 → 4
```

允许展示：

```text
Fallen Angel
不可 7 → 4
打得更稳了
```

“打得更稳了”属于对具体事实的轻量自然语言表达。

但必须有 before / after 支撑。

---

# 10. Event 类型：Accuracy Improvement

若 accuracy 可稳定复算：

```text
96.31% → 97.08%
```

可展示：

```text
精度更好了

Fallen Angel
96.31% → 97.08%
```

如果 accuracy 口径存在多套算法：

必须沿用当前 Growth / Rating authoritative 算法。

不得为 Daily Progress 单独定义一套。

---

# 11. Event 类型：Crown Upgrade

如果可证明：

```text
No Crown → Clear
Clear → FC
FC → DF
```

优先展示具体结果：

```text
新全连
RAGING FIRE
```

或：

```text
拿到全良
○○○
```

不要统一叫：

```text
段位变化
```

---

# 12. `段位变化` 文案必须审计

必须确认当前 UI 中“段位变化”到底对应什么字段。

如果实际是：

- crown
- score rank
- evaluation

则必须改成对应真实语义。

太鼓玩家通常会把“段位”理解为：

> 段位道场

因此除非真的是段位道场变化：

不得使用：

`段位变化`

---

# 13. Rank / 评价提升

如果 `best_score_rank` 或现有评价体系能可靠证明：

```text
普通 → 紫雅
紫雅 → 极
```

可展示：

```text
评价提升
HAPPY SYNTHESIZER
紫雅
```

具体术语必须复用项目当前 authoritative 映射。

---

# 14. First Play / 普通游玩

如果今天确实游玩，但没有任何 stronger event：

不要显示空白 KPI。

展示：

```text
今天打了 2 张谱
```

若能可靠拿到谱面：

可以再列 1～2 首：

```text
Fallen Angel
KAHATAREDOKI NO YUUWAKU
```

---

# 15. No-play State

保持自然：

```text
今天还没开打
```

不要：

```text
今日游玩数 0
刷新最高分 0
成就变化 0
```

---

# 16. 首页 Daily Progress 最大信息量

首页不是日报。

最多建议：

- 1 个 primary event
- 1～2 个 secondary event
- 1 行 aggregate summary

例如：

```text
今天

Fallen Angel
不可 7 → 4
打得更稳了

另外打了 1 张谱
```

不要把所有变化全部塞首页。

---

# 17. Event Ranking

建议优先级：

```text
Goal Completed            （后续 Goal Loop）
↓
DF / FC / Crown Upgrade
↓
明显评价提升
↓
Score PB
↓
NG / Accuracy / Combo Improvement
↓
Rating / Dimension Change
↓
First Play
↓
Ordinary Play
```

本轮 `Goal Completed` 只预留类型。

不要实现。

---

# 18. 同一谱多事件去重

一张谱如果同时：

```text
Score PB
NG下降
Accuracy提高
FC
```

不要首页显示四条。

应合并为一个 richer event，例如：

```text
新全连

Fallen Angel
最好成绩 +7,130
不可 7 → 0
```

一张谱最多形成一个 primary narrative block。

---

# 19. Primary Event Selection

优先选择：

- 稀有程度更高
- 成长意义更强
- 玩家更容易理解
- before/after 更明确

不要只按数据库更新时间排序。

---

# 20. 推荐歌曲上的进步：当前阶段禁止夸大因果

用户现实中可能确实：

```text
看了 Today Plan
→ 去打推荐曲
→ 取得进步
```

但当前如果没有持久化：

- recommendation snapshot
- selected goal
- recommendation baseline

就不能仅凭“这首歌现在也出现在推荐列表”断言：

```text
你完成了推荐训练
```

或者：

```text
推荐曲进步了
```

因为 recommendation 可能已经因新成绩而变化。

---

# 21. Recommendation Attribution 只有在可证明时才允许

审计当前系统是否存在可靠证据：

```text
该 song/difficulty
在玩家游玩前
明确属于当日 recommendation
```

如果没有：

Daily Progress 只写：

```text
Fallen Angel
不可 7 → 4
```

不写：

```text
推荐歌曲 Fallen Angel 有进步
```

真正的 Recommendation → Result 因果闭环留给：

`Goal Feedback Loop`

---

# 22. Hero 文案：去命令式

当前：

```text
下一步
接下来先练精度
```

属于偏任务式 / 训话式表达。

本轮删除：

`下一步`

作为 eyebrow。

---

# 23. Hero Ready 状态文案

首选方向：

```text
最近可以从精度入手
```

或：

```text
最近可以多练练精度
```

Codex 应结合当前整体视觉选择更自然的一句。

原则：

- 建议式
- 非命令式
- 不拟人
- 不“AI 建议”
- 不“你需要”
- 不“必须”
- 不“应该”

---

# 24. Hero 文案不要过度推断

如果算法仅证明：

```text
精度是六维最低值
```

则可以：

```text
最近可以从精度入手
```

不应该：

```text
最近精度明显退步了
```

除非历史真的证明它下降。

---

# 25. Balanced 状态

如果现有 Player State 判断较均衡：

不要强行：

```text
最近可以从精度入手
```

推荐：

```text
最近状态挺均衡
```

或项目自然等价文案。

Today Plan 可以继续综合推荐。

---

# 26. Limited 状态

Limited：

推荐：

```text
再积累一些成绩，推荐会更贴合
```

或更短自然版本。

不要：

```text
当前数据不足，无法准确判断能力短板
```

这种系统报告口吻。

---

# 27. Hero 与 Today Plan 的连续语气

例如：

```text
早上好，sigaer

Rating 10.28

最近可以从精度入手
[六维]

可以试试这三首

[Song]
[Song]
[Song]
```

这比：

```text
下一步
接下来先练精度

练这三首
围绕精度力挑选的谱面
```

自然。

---

# 28. Today Plan 标题

从：

```text
练这三首
```

优先调整为：

```text
可以试试这三首
```

或者其他自然、非命令式表达。

---

# 29. Today Plan 副标题

当前类似：

```text
围绕精度力挑选的谱面
```

若 Hero 已明确：

```text
最近可以从精度入手
```

则副标题可直接删除。

避免同一信息说两次。

---

# 30. Song Card 不加解释性长文案

歌曲卡继续简洁：

```text
Fallen Angel
魔王 · 9星
998,360
```

不要为了“生活感”新增：

```text
这首歌非常适合锻炼你的精度能力
```

---

# 31. 文案 Tone Guide

统一避免：

### 命令式

```text
接下来先练
你需要
你应该
完成以下
```

### AI 报告式

```text
根据当前数据分析
系统建议
你的当前优先提升项是
```

### 过度鼓励

```text
继续加油！
今天也要努力！
突破自己！
```

推荐：

### 观察式

```text
最近状态挺均衡
今天打了 3 张谱
Fallen Angel 打得更稳了
```

### 建议式

```text
最近可以从精度入手
可以试试这三首
```

### 连续式

```text
昨天这首有进步
今天还没开打
```

---

# 32. Daily Progress Layout

删除固定 3-column KPI card。

建议改成：

```text
今天

[Primary Event]

[Secondary Event]

[Optional aggregate line]
```

---

# 33. Event Card 不要重新变 Dashboard

可以是：

- plain content row
- light surface
- small media row

不要每个 event 都：

```text
icon card
大数字
标题
副标题
badge
```

---

# 34. 推荐视觉

例如：

```text
今天

打得更稳了
Fallen Angel
不可 7 → 4

另外打了 1 张谱
```

关键内容是：

```text
Fallen Angel
不可 7 → 4
```

不是 icon。

---

# 35. Cover 使用

若 event 对应具体歌曲：

允许显示小封面。

但不要因为 Daily Progress 又形成一套和 Today Plan 一样重的大 Song Card。

建议：

- 40–56px small cover
- title
- concise before → after

---

# 36. “今天打了 N 张谱”

必须明确 N 的语义。

审计：

- unique chart count
  还是
- play/session count

当前如果只能可靠证明：

`unique charts updated today`

则文案不能写：

```text
今天打了 8 次
```

应写：

```text
今天打了 2 张谱
```

或更精确等价表达。

---

# 37. “刷新最好成绩”定义

只有：

```text
current high_score > previous high_score
```

且时间属于当前 Calendar Day，

才算。

不得根据 `updatetime` 单独猜测。

---

# 38. Daily Progress 完整详情入口

本轮不强制新增独立 Daily Summary 页面。

如果已有适合入口：

可增加轻量：

```text
查看今天的战绩
```

如果没有：

不要为了本轮新增 route。

首页事件化优先。

---

# 39. 未来 Goal Loop 接口预留

未来 Goal 建立后：

Daily Progress 可以自然增加：

```text
目标完成
Fallen Angel
不可 7 → 4
```

因此本轮 event presentation 不要写死成：

```text
PB-only
```

结构应能承载未来 Goal Event。

---

# 40. Performance

本轮 event extraction 不得重新：

- 启动额外 Python process
- 全量重算 Rating 多次
- 全量 replay history 多次

复用现有：

- history load
- current state
- Daily Progress compute

如需事件化：

优先在已有一次遍历中派生。

---

# 41. Request Count

首页不得因 Daily Progress narrative：

新增多个 browser API。

继续复用 Growth Overview 聚合接口或当前等价结构。

---

# 42. HTTP Privacy

保持：

```text
private, no-store
```

如果当前 Growth endpoint 仍如此。

不做 shared cache。

---

# 43. zh 文案验收

人工检查：

- Ready focus
- Balanced
- Limited
- no play
- ordinary play
- score PB
- NG improvement
- FC / DF
- evaluation upgrade

必须像自然产品文案。

---

# 44. ja 文案验收

日文不能机械翻译中文。

尤其：

```text
最近可以从精度入手
可以试试这三首
打得更稳了
```

应按日语游戏 / 成绩产品习惯自然表达。

---

# 45. Tests — Event Correctness

至少 fixture：

1. no play
2. played but no change
3. score PB
4. NG reduced
5. accuracy improved
6. crown Clear
7. crown FC
8. crown DF
9. rank/evaluation upgrade
10. multiple events same song
11. multiple songs
12. midnight boundary
13. duplicate sync
14. incomplete history
15. missing previous state

---

# 46. Tests — Event Dedup

同一张谱：

```text
PB + NG ↓ + FC
```

首页 event selection 不得重复成 3 张大卡。

---

# 47. Tests — Copy

确保不再出现：

```text
下一步
接下来先练
涉及谱面
段位变化
```

除非 `段位变化` 真的是 authoritative 段位道场语义。

同时确保：

- Ready 有自然建议
- Balanced 不制造短板
- Limited 不下结论
- Today 不展示无意义 0 KPI

---

# 48. Browser Acceptance — User A

使用有完整历史的 Ready 用户。

验证：

Hero：

```text
早上好，xxx
Rating
最近可以从精度入手
```

或最终同义自然文案。

Today Plan：

```text
可以试试这三首
```

Daily Progress：

必须展示真实当天事件。

---

# 49. Browser Acceptance — 真实“推荐后有进步”的用户

使用这次已经实际发生过：

```text
看推荐
→ 游玩推荐候选之一
→ 成绩改善
```

的真实用户。

但必须分清：

### 如果系统不能证明游玩前 recommendation snapshot

只能展示：

```text
这张谱今天有进步
```

不能展示：

```text
你在推荐歌曲上取得进步
```

---

# 50. Browser Acceptance — No Improvement

玩家今天打了推荐曲，但没有可证明突破。

首页：

```text
今天打了 N 张谱
```

即可。

不要：

```text
0 次进步
```

---

# 51. Browser Acceptance — No Play

保持：

```text
今天还没开打
```

不出现 0 / 0 / 0 KPI。

---

# 52. Mobile 390×844

检查：

- Hero 文案不训话
- Today Plan 不重复
- Daily Progress 不是 KPI dashboard
- primary event 一眼可懂
- 内容不挤
- 不生成巨大 Card

---

# 53. Desktop 1440×900

检查：

- Daily Progress 不因宽屏重新变三栏 KPI
- event narrative 仍是主角
- 不出现大片空白

---

# 54. Dark Mode

检查：

- event hierarchy
- before → after
- positive change
- muted summary

不要仅靠绿色表示 improvement。

---

# 55. Accessibility

before / after：

不能只靠颜色。

例如：

```text
不可 7 → 4
```

文本本身已经有语义。

Event song row：

如果可点击，需正常 focus。

---

# 56. 版本

当前公开生产版本基线：

`Viewer 0.68.8`

本阶段完成目标：

`Viewer 0.68.9`

如果实际仓库在实施时已经高于 `0.68.8`：

必须先读取 canonical version source：

```text
package.json
→ nuxt.config
→ runtimeConfig.public.appVersion
```

然后按真实当前版本顺延 patch。

禁止沿用历史 `0.51.x` 版本号。

---

# 57. Build / Tests

运行仓库实际存在的：

- growth
- home-state
- recommendation
- history
- i18n
- version
- forum/community regression
- admin-auth

新增 Daily Progress Narrative tests。

然后：

```bash
npm run build
git diff --check
```

最好使用`/home/sigaer/taiko/taiko-forum/scripts/deploy_forum_web.sh`标准脚本部署

# 58. Production Browser Acceptance

至少：

### Ready + today improvement

### Ready + today play/no improvement

### Ready + no play

### Balanced

### Limited

Locale：

- zh
- ja

Theme：

- light
- dark

Size：

- 390×844
- 1440×900

---

# 59. Completion Blockers

以下任一存在不得关闭：

- 首页仍固定显示三个 KPI
- `0` 事件仍占大面积视觉
- `涉及谱面` 仍作为主要用户文案
- 非段位道场数据仍叫“段位变化”
- 明明有 score/NG/crown 变化却只显示 count
- 无历史证据却生成 improvement 文案
- 无 recommendation snapshot 却宣称“推荐曲完成/推荐有效”
- Hero 仍使用明显命令式“接下来先练”
- Today Plan 仍明显像任务指令
- Balanced 用户仍被强行指定训练项
- Limited 用户仍被下能力结论
- zh / ja 明显 AI / 翻译腔
- 性能明显回归
- 新增不必要 Schema / API

---

# 60. 最终报告必须回答

1. 当前实际 Viewer 基线版本是多少？
2. 最终 Viewer 版本是多少？
3. 固定 KPI Grid 是否完全移除？
4. `涉及谱面` 最终改成什么？
5. `段位变化` 原本实际对应什么字段？
6. Daily Progress 当前支持哪些 provable event？
7. 哪些 event 仍无法可靠计算？
8. Score PB 如何判断？
9. NG improvement 如何判断？
10. Accuracy improvement 如何判断？
11. Crown upgrade 如何判断？
12. Rank / evaluation upgrade 如何判断？
13. 同一谱多事件如何合并？
14. Primary event 如何排序？
15. 无事件但有游玩如何显示？
16. no-play 如何显示？
17. Hero Ready 最终文案？
18. Balanced 最终文案？
19. Limited 最终文案？
20. Today Plan 最终标题？
21. 是否删除重复副标题？
22. 是否存在 recommendation attribution？
23. 如果存在，证据是什么？
24. 如果没有 recommendation snapshot，是否正确避免因果宣称？
25. Daily Progress 是否新增 API？
26. 是否新增 Schema？
27. Growth API 性能是否保持？
28. zh 是否通过？
29. ja 是否通过？
30. 390×844 是否通过？
31. 1440×900 是否通过？
32. 是否仍有明显 KPI / Dashboard 感？
33. 是否可以正式进入 Goal Feedback Loop？

---

# 61. 完成后的正式状态

全部通过后记录：

`DAILY PROGRESS NARRATIVE CLOSURE COMPLETE`

`FIXED KPI GRID REMOVED`

`PROVABLE GROWTH EVENTS ESTABLISHED`

`ZERO-VALUE DASHBOARD METRICS REMOVED`

`GROWTH HERO TONE SOFTENED`

`TODAY PLAN COPY SOFTENED`

`PLAYER HOME DAILY FEEDBACK ACCEPTED`

`READY FOR GOAL FEEDBACK LOOP`

---

# 62. 下一阶段

下一阶段开始真正建立：

```text
Recommendation
↓
User chooses
↓
Goal baseline persisted
↓
Play
↓
New authoritative score
↓
Goal evaluation
↓
Growth event
↓
Next recommendation
```

只有那时才允许产品明确表达：

```text
你完成了今天的练习目标
```

或：

```text
这张推荐谱今天有进步
```

并把 Recommendation → Result 建立为真正可证明的闭环。
