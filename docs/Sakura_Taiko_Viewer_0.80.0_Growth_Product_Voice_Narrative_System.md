# Sakura Taiko Viewer 0.80.0
# Growth Product Voice & Narrative System
# Standalone Codex Brief for a New Conversation

> Start this task **after 0.79.2 Growth Experience Closure is complete**.
> Open a **new Codex conversation** and use this document as the primary brief.
> Do not rely on previous chat context.

## 0. Version position

Known state when this brief was written:

- current production baseline before the ongoing patch: `0.79.1`
- `0.79.2 Growth Experience Closure`: in progress

This task is broader than a copy patch. It spans recommendation, Goal, Recent, Daily, Weekly and Passport, so if `0.79.2` is the final canonical baseline when work begins, prefer:

`0.80.0`

Before touching code, verify:

`package.json → nuxt.config.ts → runtimeConfig.public.appVersion → /more`

Never downgrade if canonical has moved further.

## 1. Why this work exists

The Growth system is already technically strong, but it still often sounds like software explaining analytics.

Typical problem patterns:

- “最近可以从精度入手”
- “可以试试这三首”
- “当前计算口径下还需要更多记录才能比较变化”
- repeated “刷新最好成绩”
- technical notes such as model/revision boundaries shown too prominently

The desired experience is not “better copy” in isolated spots.

The goal is:

> make the entire Growth system speak as one coherent product.

The user should feel that Viewer:

- remembers what they chose to practice
- notices what actually happened
- knows when evidence is weak
- says less when there is less to say
- invites rather than commands
- avoids implementation language
- avoids fake encouragement
- avoids random chatbot-like phrasing

Target feeling:

> a calm personal Taiko growth log

Not:

- analytics dashboard
- AI coach
- task/mission system


## 2. Scope

Audit and improve user-facing Growth language across:

1. Home Hero / Player State
2. Today Plan / Recommendation
3. Goal active state
4. Goal completion
5. Goal inconclusive / refresh states
6. Recent Growth
7. Daily Progress presentation
8. Weekly Growth Recap
9. Skill Passport / 成长档案
10. empty / limited / balanced / error states

Do not change underlying data semantics or algorithms unless a real bug is discovered and separately reported.

Default:

- NO DB migration
- NO new table
- NO recommendation algorithm change
- NO six-dimension algorithm change
- NO Rating algorithm change
- NO Daily extraction change
- NO Goal evidence-model change
- NO Recent evidence-rule change

This task is presentation/narrative architecture.

## 3. Phase 1 — Growth Voice Audit

Do not start by editing strings.

First create:

`docs/growth-product-voice-audit.md`

Scan:

- zh locale files
- ja locale files
- Vue templates/components
- fallback strings
- aria labels
- tooltips
- empty/error states
- server-returned label keys that surface in UI

Classify every relevant string using one or more labels:

- GOOD
- SYSTEM-LIKE
- COMMANDING
- PROMPT-LIKE
- OVER-TECHNICAL
- REPETITIVE
- TOO-GENERIC
- TOO-CAUTIOUS
- FAKE-ENCOURAGEMENT
- INCONSISTENT-TERM
- DUPLICATED-MEANING
- MISSING-CONTEXT

Examples:

SYSTEM-LIKE:
- 当前优先提升项
- 最近可以从精度入手

PROMPT-LIKE:
- 当前计算口径下还需要更多记录才能比较变化

COMMANDING:
- 接下来先练精度

REPETITIVE:
- 刷新最好成绩
- 刷新最好成绩
- 刷新最好成绩

FAKE-ENCOURAGEMENT:
- 继续加油
- 突破自己

Audit output must contain a matrix:

| Surface | Current copy | Classification | Evidence/state | Narrative role | Required change |
|---|---|---|---|---|---|

Do not implement until this audit is complete.


## 4. Shared Growth voice principles

### 4.1 Speak from observation, not authority

Prefer:

“最近几次打下来，精度这边还有一点空间。”

Avoid:

“系统判断你的精度是当前短板。”

### 4.2 Invite, do not command

Prefer:

“今天想磨磨手的话，可以看看这几首。”

Avoid:

“下一步练精度。”

### 4.3 Be concrete when evidence is strong

Prefer:

“HIMAWARI HAPPY 的不可从 1 压到了 0。”

Avoid:

“你的精度明显提升了。”

unless the broader claim is actually supported.

### 4.4 Say less when evidence is weak

Prefer:

“现在留下的记录还不多，暂时还看不出特别明显的方向。”

Avoid:

“当前数据不足，无法形成稳定结论。”

### 4.5 Do not expose implementation vocabulary as primary copy

Keep these out of primary narrative:

- modelRevision
- algorithmVersion
- measurement segment
- compatibility
- evaluation
- source completeness
- revision
- schema
- calculation boundary

Translate them into user meaning.

### 4.6 No empty emotional filler

Avoid:

- 太棒了
- 加油
- 冲冲冲
- 突破自己
- 继续保持

unless a future brand system deliberately adopts that tone.

### 4.7 No fake intimacy

Avoid:

- 我帮你挑了
- 我觉得你应该
- 我为你推荐

Viewer should not pretend to be a person.


## 5. Shared narrative grammar

Most Growth surfaces should follow:

`Observation → Meaning → Invitation`

Not every surface needs all three.

Observation:
“最近几次打下来，精度这边还有一点空间。”

Meaning:
“几首谱的不可都在往下走，手感正在变稳。”
Only when facts support it.

Invitation:
“想再磨一磨的话，可以从这里挑一首。”

## 6. Confidence-aware wording

Strong evidence:
“最近几首都打得更干净了。”

Moderate evidence:
“最近几次记录里，精度看起来稳了一些。”

Limited evidence:
“现在留下的记录还不多，暂时还看不出特别明显的方向。”

Wording certainty must follow evidence strength.

## 7. Shared user-facing vocabulary

Build a documented vocabulary guide.

Suggested direction:

| System/internal term | Preferred user language |
|---|---|
| current focus | 最近可以多留意 / 最近更适合从…入手 |
| recommendation | 可以试试 / 可以看看 |
| Goal | 这次想练 |
| Goal completed | 这次练成了 |
| inconclusive | 暂时还确认不了 |
| limited data | 记录还不够多 |
| balanced | 最近各方面挺匀 |
| model revision | 记录方式更新过 |
| measurement | 记录 / 能力记录 |
| refresh | 更新一下 |
| recent facts | 最近同步的变化 |
| no play | 还没有新的游玩记录 |

Do not mechanically replace strings. Preserve context.


## 8. Recommendation Copy Palette

Recommendation is the most important place to add life.

Current pattern:

“最近可以从精度入手”
“可以试试这三首”

is too static.

Create manually reviewed copy palettes for:

- six dimensions
- balanced
- limited
- quiet period
- active Goal
- recently completed Goal

Each of the six dimensions should have at least 4–8 zh variants, with equivalent natural ja variants.

Example directions:

### 大歌力
- 最近可以碰几首稍微顶一点的谱。
- 想试试上限的话，这几首可以看看。
- 手感不错的话，可以往难一点的地方探一探。

### 体力
- 最近可以找几首把手热起来的。
- 想多撑一会儿的话，可以从这几首里挑。
- 今天想打得痛快一点，这几首挺合适。

### 高速处理
- 最近可以多碰一点快东西。
- 手感顺的时候，可以拿这几首试试速度。
- 想让高速再舒服一点，可以从这里开始。

### 精度力
- 最近可以多磨磨精度。
- 想把手再收稳一点，可以看看这几首。
- 最近整体挺稳，精度这边还有一点可以慢慢磨。

### 节奏处理
- 最近可以换点节奏有意思的谱。
- 想练练拍点和手感，这几首挺合适。
- 今天想换换脑子，可以试试这些节奏型谱面。

### 复合处理
- 最近可以多碰一点手顺复杂的东西。
- 想让复合再顺一点，可以从这里挑。
- 手感不错的话，这几首挺适合拿来理顺复合。

These are examples, not mandatory final strings.


## 9. Balanced / Limited / Quiet copy

Balanced should not always be:

“最近状态挺均衡”

Possible direction:

- 最近各方面都挺匀，没有特别需要补的一块。
- 最近打得比较均衡，今天想练什么可以随心一点。
- 现在没有特别突出的短板，按喜欢的来就挺好。

Limited should not always be:

“再积累一些成绩，推荐会更贴合”

Possible direction:

- 现在留下的成绩还不算多，先按喜欢的多打几首也挺好。
- 暂时还看不出特别明显的方向，先找顺手的谱玩起来。
- 再多留下一些成绩，后面会慢慢看得更清楚。

Quiet period, only when real activity state supports it:

- 有阵子没留下新成绩了，想找找手感的话可以从这里开始。
- 最近比较安静，今天想重新开手的话可以看看这几首。

Recently completed Goal:

- 刚把这首磨下来，手感正热。想继续的话，可以换个方向看看。
- 这首已经拿下了。还想继续的话，下面还有几首可以挑。

Keep this restrained.


## 10. Deterministic copy variation

Do not randomize on every refresh.

Use stable context, conceptually:

`profile + businessDate + focus + readiness + goalState + recentActivityState`

Then map deterministically into a copy pool.

Requirements:

- same user + same state + same business day → same wording
- state change may change wording
- next business day may change wording
- refresh must not flicker copy

Implementation can use a stable hash.

Do not build one universal text generator.

Preferred architecture:

- shared state semantics
- shared voice rules
- surface-specific composers

Examples:

- composeRecommendationCopy()
- composeGoalCopy()
- composeRecentGrowthCopy()
- composeDailyNarrative()
- composeWeeklyNarrative()
- composePassportNarrative()


## 11. Surface-specific requirements

### Home Hero

Keep light.

Example structure:

“晚上好，sigaer”
“Rating 10.28”
“最近几次打下来，精度这边还有一点空间。”

Avoid labels such as:
- 下一步
- 当前重点
- 系统建议

### Recommendation section

Do not use one fixed title forever.

Possible stable variants:

- 今天想练的话，可以看看这几首
- 不知道打什么的话，从这里挑一首
- 想换换手感，可以试试这些
- 今天可以从这里开始
- 有空的话，挑一首试试

### Goal active

Prefer:
“这次想练”

Avoid:
- 当前任务
- 训练目标
- 任务进行中

### Goal completion

Prefer:
“这次练成了”

Then concrete evidence.

Example:
“HIMAWARI HAPPY”
“不可 1 → 0”
“最好成绩也到了 995,440。”

No generic praise.

### Goal inconclusive

Prefer:
“暂时还确认不了这次进展。”
“更新成绩后可以再试一次。”

Avoid:
“无法评估目标状态。”


### Recent Growth

Preferred title:
“最近同步的变化”

Possible narrative:
- 刚同步回来，几首谱有了新变化。
- 最近一次更新里，有几件事值得记一下。

Do not imply a real Session:
- no 这一轮
- no 这次游玩
- no 刚刚打了 N 首

### Daily Progress

Transform repeated metric headings into a day log.

Instead of:
“刷新最好成绩 / Song A / ...”
repeated several times,

prefer something like:

“今天有几首留下了明显变化”

“Turquoise Tachometer”
“分数到了 977,000，连击也到了 717。”

“HIMAWARI HAPPY”
“不可压到了 0。”

“VIVIVID”
“最好成绩又往前走了 9,850。”

“今天一共碰了 28 张谱。”

Do not change Daily extraction; only presentation.

Quiet day:
“今天主要是在熟悉谱面，还没有出现特别明显的突破。”

No play:
“今天还没有新的游玩记录。”


### Weekly Growth Recap

Audit every theme string.

Prefer:
“这一周最明显的是打得更稳了。”

Avoid:
“本周主要成长主题：稳定性”

Quiet:
“这周比较安静，主要是在熟悉谱面。”
or
“这周还没有特别集中的变化。”

Limited:
use natural coverage-aware wording, not analytics terminology.

### Skill Passport / 成长档案

Primary copy should explain what the user sees, not implementation.

Stable Rating:
“最近几次记录里，Rating 基本保持在 10.28。”

Insufficient trend:
“记录还在积累，再多几次同步后趋势会更清楚。”

Model break primary:
“记录方式更新过”

Secondary disclosure:
“更新前后的数值不直接比较。”

Do not expose raw SHA, modelRevision, algorithmVersion in normal UI.

Focus transition:
“最近更值得关注的方向，从精度转到了高速。”

Do not claim the old focus was “solved”.


## 12. Technical disclosure layer

Technical accuracy still matters.

Use secondary UI:

- info disclosure
- small caption
- “了解更多”
- accessible tooltip/details

Example:

Primary:
“记录方式更新过”

Secondary:
“更新前后的能力值使用了不同计算版本，因此不会直接比较。”

Primary narrative stays natural.

## 13. Copy length rules

Mobile-first.

Recommended maximum:

- Hero observation: 1 sentence
- Recommendation intro: 1–2 sentences
- Daily intro: 1 sentence
- Weekly main theme: 1–2 sentences
- Passport trend explanation: 1–2 sentences

Do not turn pages into essays.

## 14. zh / ja parity

Japanese must be authored naturally.

Do not require literal sentence parity.

Require semantic parity:

- same evidence strength
- same certainty
- same action pressure
- same emotional restraint


## 15. Error-state voice

Avoid:
“Growth Overview refresh failed.”

Prefer:
“这次更新没有成功，稍后再试一次就好。”

Keep actionable details where needed.

## 16. Performance gate

This is a presentation task.

Therefore expected:

- extra Python compute = 0
- extra history replay = 0
- extra DB writes = 0

Copy selection must be pure/O(1).

No server request solely to choose wording.

## 17. No new persistence

Default:

- NO DB table
- NO copy-history table
- NO user tone profile
- NO recommendation exposure table

This round does not expand causality; it changes presentation.


## 18. Tests

Snapshot/golden coverage at minimum:

### Recommendation
- six dimensions
- balanced
- limited
- quiet
- recently completed Goal

### Goal
- active
- completed
- inconclusive

### Recent
- rich
- no meaningful change
- first-use
- boundary-lost

### Daily
- rich
- quiet
- no play

### Weekly
- PB
- NG
- crown
- Goal
- quiet
- limited

### Passport
- stable
- trend
- model break
- limited
- new user

Add anti-regression checks for problematic patterns such as:

- 当前计算口径
- 根据数据分析
- 系统建议
- 当前优先提升项
- 下一步先练
- 任务完成
- 成长指数
- 超过 X% 玩家

Allow explicit reviewed exceptions only in secondary technical disclosures.


## 19. Browser / human review gate

Tests alone are not enough.

Review screenshots for:

- Home
- recommendation
- Goal
- Recent
- Daily
- Weekly
- Passport

At minimum:

- zh mobile
- ja mobile
- zh desktop
- representative dark mode

Questions:

1. Does this sound like the user reflecting on their own play?
2. Does it sound like software reporting?
3. Is any line commanding?
4. Is implementation detail too prominent?
5. Is the same sentence repeated too often?
6. Does certainty match evidence?
7. Is the next action inviting rather than directive?

Critical browser states:

1. recommendation accuracy focus
2. balanced
3. limited
4. Goal active
5. Goal completed
6. Recent rich
7. Daily rich
8. quiet day
9. Weekly rich
10. Weekly limited
11. Passport stable
12. Passport model break
13. Passport limited
14. zh/ja
15. mobile/desktop
16. light/dark

Use justified pairwise coverage if a full cross-product is excessive.


## 20. Production smoke

Use existing isolated production-test patterns.

Must verify at least:

- recommendation natural copy
- Goal completion copy
- Recent copy
- Daily rich copy
- Weekly copy
- Passport stable/limited/model-break copy

No raw locale keys.
No fallback English in zh.
No literal Chinese in ja.

## 21. Existing regression gates

Preserve:

- Goal create/evaluate
- Growth refresh
- no-reload next Goal
- Recent Growth
- Daily Progress
- Weekly Recap
- Skill Passport data semantics
- Growth History
- measurement capture
- Recommendation ranking
- six-dimensional output
- performance budgets
- profile isolation


## 22. Completion blockers

Do not close if any remain:

- recommendation still sounds like a system instruction
- every focus has only one fixed sentence
- copy changes randomly on refresh
- Goal completion uses generic praise
- Recent implies Session
- Daily remains repetitive metric-heading cards
- Weekly sounds like BI reporting
- Passport still leads with implementation language
- technical terms remain in primary narrative
- balanced/limited are framed as failure
- zh/ja tone diverges materially
- performance adds compute/replay
- screenshots still feel like dashboard copy

## 23. Final report — required answers

1. start/final version?
2. audit file path?
3. number of Growth strings audited?
4. classification counts?
5. vocabulary guide?
6. voice principles?
7. narrative grammar?
8. recommendation palette coverage?
9. six dimensions covered?
10. balanced variants?
11. limited variants?
12. quiet variants?
13. deterministic selection method?
14. same-day stability?
15. Goal active copy?
16. Goal completed copy?
17. inconclusive copy?
18. Recent copy?
19. Daily rich copy?
20. Daily quiet/no-play?
21. Weekly theme copy?
22. Weekly quiet/limited?
23. Passport stable/trend/model-break?
24. technical disclosure layer?
25. anti-regression banned phrases?
26. zh review?
27. ja review?
28. mobile screenshots?
29. desktop screenshots?
30. dark screenshots?
31. extra Python?
32. extra history replay?
33. DB/schema changes?
34. algorithm changes?
35. production smoke?
36. human review result?
37. remaining awkward copy?
38. final conclusion?


## 24. Completion state

Only after all gates pass:

```text
0.80.0 GROWTH PRODUCT VOICE SYSTEM COMPLETE

GROWTH VOICE AUDIT COMPLETE
SHARED GROWTH VOCABULARY ESTABLISHED
OBSERVATION → MEANING → INVITATION GRAMMAR ESTABLISHED
CONFIDENCE-AWARE WORDING ACCEPTED

RECOMMENDATION COPY PALETTE ESTABLISHED
GOAL VOICE ACCEPTED
RECENT GROWTH VOICE ACCEPTED
DAILY NARRATIVE VOICE ACCEPTED
WEEKLY NARRATIVE VOICE ACCEPTED
SKILL PASSPORT VOICE ACCEPTED

DETERMINISTIC COPY VARIATION ACCEPTED
NO RANDOM COPY FLICKER
NO SYSTEM-LIKE PRIMARY NARRATIVE
NO PROMPT-LIKE PRIMARY NARRATIVE
NO COMMANDING GROWTH COPY
NO EMPTY ENCOURAGEMENT

ZH / JA PRODUCT VOICE ACCEPTED
NO PERFORMANCE REGRESSION
NO DATA / ALGORITHM SEMANTIC REGRESSION

GROWTH EXPERIENCE NOW SPEAKS AS ONE PRODUCT
```

## 25. Product standard after this work

The Growth system should no longer sound like:

“I analyzed you. Here is the result. Here is what you should do.”

It should feel like:

“These are the things that happened.
This is what seems worth noticing.
If you want to keep going, here is a natural place to start.”

That is the intended Sakura Viewer Growth voice.
