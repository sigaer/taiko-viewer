# Sakura Taiko Viewer 0.79.2
# Growth Experience Closure
# Standalone Codex Brief for a New Conversation

> This document is intentionally self-contained.
> Start a **new Codex conversation** and use this document as the primary task brief.
> Do not rely on prior chat context.

## 0. Current Product Baseline

Current canonical Viewer version reported by the user:

`0.79.1`

Before changing any files, independently verify:

`package.json → nuxt.config.ts → runtimeConfig.public.appVersion → /more`

If the repository has already moved beyond `0.79.1`, do not downgrade.

If canonical is still `0.79.1`, target this closure as `0.79.2`.

This is a UX/product-closure patch, not a new product capability.

## 1. Existing Capabilities — Do Not Rebuild

Already shipped:

- Player State / Rating / six dimensions
- Today Plan recommendations
- user-selected Goal
- frozen Goal baseline
- Goal Evaluation
- Goal completion evidence
- Growth refresh after evaluation
- no-reload next Goal
- Daily Progress
- Weekly Growth Recap
- Skill Passport / 成长档案
- Growth History
- Recent Growth / 最近同步的变化
- profile isolation
- zh / ja
- mobile / desktop
- dark mode

Do not redesign these underlying algorithms.

## 2. Why This Patch Exists

### Problem A — Home feedback still feels like a data report

Observed production behavior:

A user follows the Viewer’s recommendation / selected practice Goal and gets a meaningful result, but the Home “今天” section still prioritizes unrelated PB facts from other songs.

The data is correct, but the product does not prioritize what the user intentionally chose to practice.

Current behavior is too close to:

`Which facts are numerically most notable?`

Desired behavior:

`What did the user choose to work on, and what happened?`

### Problem B — Skill Passport exposes implementation/specification language

Current user-facing copy includes ideas similar to:

- 不同计算口径之间不直接连线
- 当前计算口径下还需要更多记录才能比较变化
- 计算口径曾更新

These are technically correct, but read like developer notes or prompt/spec text.

The user should not need to understand modelRevision / segmentation / compatibility internals.

### Problem C — Passport range selector is confusing and may contain a real wiring bug

UI exposes:

`30 天 / 90 天 / 180 天 / 365 天`

User reports different ranges appear to keep showing the 90-day view.

Distinguish:

1. actual request/state bug;
2. request is correct, but only a few days of measurements exist, so all ranges show the same data.

Do not guess from screenshots.

## 3. Product Principle

Target experience:

> 我的太鼓生活

not:

> technically correct analytics dashboard

Hierarchy:

`What I intentionally practiced → What was newly synchronized → What happened today overall → What changed over time`

Do not remove factual rigor. Translate it into natural product language.

## 4. Scope

May change:

- Home Growth presentation
- Home fact prioritization / composition
- Goal-linked Home narrative
- Skill Passport range behavior
- Skill Passport selector visibility
- Skill Passport explanatory copy
- Skill Passport presentation hierarchy
- zh / ja copy
- browser tests
- production smoke / acceptance scripts

Should not change:

- Daily Progress extraction semantics
- canonical Growth facts
- Goal Evaluation rules
- Goal evidence model
- Recommendation ranking
- six-dimension algorithm
- Rating algorithm
- Recent Growth evidence rules
- Weekly attribution rules
- measurement capture frequency
- schemas

Default expectation:

`NO DB MIGRATION / NO NEW TABLE / NO ALGORITHM CHANGE`

## 5. Performance Architecture Gate — Before UI Work

This repository has repeatedly suffered from:

`feature complete → performance issue → large architectural rework`

Do not repeat it.

### Home cost budget

Target:

- existing Growth Overview request
- existing Python Growth compute count unchanged
- existing history replay count unchanged
- presentation composition only
- extra Python = 0

### Passport range switch cost budget

One click should produce:

- at most one Passport API request
- at most one current Growth compute
- no hidden retry
- no duplicate Overview request
- no duplicate historical replay

### Explicit anti-patterns

- NO duplicated Python compute
- NO duplicated Growth Overview request
- NO implicit retry
- NO O(range × history) replay
- NO client-side six-dimension recompute
- NO second source of truth
- NO full page reload for range change
- NO whole-page skeleton on range switch

## 6. Workstream A — Intent-aware Home Feedback

### 6.1 Keep Daily Progress extraction unchanged

Daily Progress remains authoritative for “今天”.

Do not alter its evidence rules, historical replay or canonical facts.

Change only Home narrative composition / presentation.

### 6.2 User intent gets highest presentation priority

When the user explicitly selected a Goal and it completed:

`Goal-linked completion`

must outrank unrelated Daily PBs.

Recommended hierarchy:

1. Goal-linked result / “这次练成了”
2. Recent Growth / “最近同步的变化”
3. Daily Progress / “今天”

Do not delete Daily facts; change narrative priority.

### 6.3 Causality boundary

Case A — explicit selected Goal:

`recommendation → user selected → Goal → baseline → completion evidence`

Strong enough to present as user-intent result.

Case B — song merely appeared in Today Plan but user never selected it:

Do not claim recommendation causality unless a persisted exposure/snapshot proves it.

For this patch, only explicit Goal intent gets intent-aware priority.

Do not add recommendation-exposure persistence.

### 6.4 Suggested Goal-completed state

Example:

```text
这次练成了

HIMAWARI HAPPY
魔王

不可 1 → 0
最好成绩也到了 995,440
```

Then Daily can say:

`今天另外还有两首刷新了最好成绩`

instead of repeating three full PB cards.

### 6.5 No Goal

Normal flow:

`Recent Growth + 今天`

No artificial Goal section.

## 7. Workstream A — Make “今天” read like a life log

Repeated metric headings should not dominate.

Better direction:

```text
今天有几首留下了明显变化

Turquoise Tachometer
977,000，连击也到了 717

HIMAWARI HAPPY
不可压到了 0

VIVIVID
最好成绩又往前走了 9,850

今天打了 28 张谱
```

Principle:

`fact-first, natural sentence, less repeated metric-heading chrome`

## 8. Workstream A — Presentation Priority

For Home presentation only:

- Goal-completion linked fact
- Goal-relevant recent fact
- DF
- FC
- rank upgrade
- meaningful PB / NG
- other PB / combo
- played summary

Do not mutate canonical priority globally.

## 9. Workstream A — Dedup Goal / Recent / Daily

If the same fact appears in Goal completion, Recent Growth and Daily Progress, do not render three copies.

Use presentation-level composition only.

Preserve raw DTOs.

## 10. Workstream B — Passport Range Wiring Audit

Trace:

`range button → local state / route query → request key → Passport API → range param → requestedDays response → projection → chart`

### Mandatory request assertions

- click 30 → request range=30 → response requestedDays=30
- click 90 → range=90
- click 180 → range=180
- click 365 → range=365

Selected-button state must match active range.

### If a real bug exists

Investigate:

- stale useAsyncData/useFetch key
- non-reactive route query
- hard-coded 90 state
- API default overriding query
- request key not including range
- chart cache keyed by dimension only
- response reused across transitions

Fix request contract first, not a visual workaround.

## 11. Workstream B — Coverage-aware Range Selector

Even if wiring is correct, showing four ranges with only four days of data is misleading.

Suggested behavior:

### <30 days
Hide selector.
Show: `已记录 4 天`

### 30–89 days
`30 天 / 全部记录`

### 90–179 days
`30 天 / 90 天 / 全部记录`

### 180–364 days
`30 天 / 90 天 / 180 天 / 全部记录`

### ≥365 days
`30 天 / 90 天 / 180 天 / 365 天`

If selected range exceeds actual measurement history, show actual recorded span honestly; do not render a huge empty axis.

## 12. Workstream C — Remove Specification-like Copy

Remove technical language from primary narrative.

### Not enough compatible history

Instead of:
`当前计算口径下还需要更多记录才能比较变化。`

Use:
`记录还在积累，再多几次同步后趋势会更清楚。`

### Stable Rating

Use:
`最近几次记录里，Rating 基本保持在 10.28。`

### Model revision break

Primary:
`记录方式更新过`

Secondary disclosure:
`更新前后的数值不直接比较。`

Do not expose modelRevision, SHA, algorithmVersion or “measurement segment” in normal UI copy.

## 13. Workstream C — Passport Narrative Hierarchy

Recommended:

- 成长档案
- 记录自…
- 现在的我
- Rating / focus / current six dimensions
- 这段时间
- natural summary
- trend visual
- 关注方向
- recent milestones
- 接下来

Avoid presenting controls and implementation explanations before the story.

## 14. Workstream C — Controls Should Not Dominate

The two dense rows of range + dimension pills currently make the page feel like a query tool.

Reduce visual weight:

- range selector only when useful
- dimension selector secondary
- selected state clear but restrained
- story before control panel

## 15. Life-like Copy Rules

Prefer:

- 最近几次记录里，Rating 基本没变。
- 精度仍然是现在最值得关注的方向。
- 记录还在积累，趋势会慢慢清楚起来。

Avoid:

- 根据当前数据分析…
- 当前计算口径…
- 系统检测到…
- 建议你…
- 下一步必须…

No empty encouragement.

## 16. Visual Direction

Keep Viewer visual language.

Do not introduce:

- 3D
- mission UI
- neon analytics dashboard
- enterprise chart density
- giant celebratory cards

Target: calm personal growth log.

## 17. Mobile Acceptance — Home

At 390×844 verify:

- Goal-linked result visible without excessive scroll
- “今天” is not three repetitive heading-heavy cards
- Recent / Goal / Daily hierarchy understandable
- bottom nav no overlap
- no horizontal overflow
- no scroll jump

## 18. Mobile Acceptance — Passport

At 390×844 verify:

- short history hides/reduces range selector
- controls do not consume first screen
- chart readable
- selected range visibly changes
- technical copy is secondary
- focus timeline does not collide with bottom nav
- no overflow

## 19. Desktop Acceptance

At 1440×900:

- no analytics-dashboard regression
- Passport remains narrative-first
- controls secondary
- chart uses width without dominating whole page

## 20. zh / ja

Manual review required.

Key strings:

Home:
- 这次练成了
- 这首有新进展
- 最近同步的变化
- 今天另外还有…
- 今天打了 N 张谱

Passport:
- 成长档案
- 已记录 N 天
- 这段时间
- 记录还在积累
- 最近几次记录里…
- 记录方式更新过
- 更新前后的数值不直接比较

Japanese must be naturally rewritten, not literal translation.

## 21. Accessibility

Range and dimension selectors:

- keyboard reachable
- semantic selected state
- not hover-only

Disclosure:

- keyboard accessible
- screen-reader understandable

Preserve chart text summary / aria behavior.

## 22. Performance Tests

### Home
Record:
- Growth Overview request count
- Python process count
- history replay count
- Recent composition cost
- Home visible latency

Expected:
- extra Python due to patch = 0
- extra full history replay = 0

### Passport initial load
Record:
- Passport API count
- Growth compute count
- History replay count
- measurement query
- browser visible

Expected:
- Python <=1

### Passport range switch
For 30/90/180/365 record:
- request count
- requestedDays
- response actual range
- Python count
- UI latency

Expected:
`one click → one bounded refresh`

## 23. Home Tests

At minimum:

1. completed Goal + unrelated Daily PBs
2. completed Goal + matching Recent
3. completed Goal + matching Daily
4. Goal fact appears once in Home presentation
5. no Goal
6. active Goal
7. Recent only
8. Daily only
9. same-song multi-fact
10. profile switch

## 24. Passport Tests

At minimum:

1. 4 days → selector hidden/reduced
2. 42 days → 30 + all
3. 120 days → 30/90 + all
4. 250 days → 30/90/180 + all
5. ≥365 → 30/90/180/365
6. selected 30 sends 30
7. selected 90 sends 90
8. selected 180 sends 180
9. selected 365 sends 365
10. short actual coverage
11. model break
12. one compatible point
13. stable Rating
14. focus transition
15. limited state

## 25. Browser Matrix

Minimum scenarios:

Home:
1. Goal completed dominates
2. Goal + unrelated Daily
3. Recent + Daily
4. no Goal
5. rich Daily
6. quiet Daily

Passport:
7. 4-day history
8. 42-day history
9. 120-day history
10. 250-day history
11. 365+ history
12. model break
13. limited
14. stable Rating
15. focus change

Coverage:
`zh / ja × 390×844 / 1440×900 × light/dark`

If the full cross-product is too large, use a justified pairwise matrix plus critical mobile/dark full coverage.

## 26. Production Smoke — Home

Use isolated account / synthetic authoritative fixture:

`Today Plan → select Goal → baseline → future score → evaluate completed → Growth refresh → Home`

Verify:

- Goal-linked feedback is primary story
- unrelated Daily PB does not steal primary focus
- matching Goal/Recent/Daily fact not triplicated
- no reload required

## 27. Production Smoke — Passport

Verify request contract:

- 30 → requestedDays=30
- 90 → 90
- 180 → 180
- 365 → 365

Also verify:

- short coverage hides/reduces ranges
- actual measurement span honest
- model break copy natural
- no raw revision/model identifiers

## 28. No New Product Surface

Do not add:

- another top-level Growth page
- another Home card family
- another navigation tab

Simplify the current experience.

## 29. No New Persistence

Default:

- NO DB MIGRATION
- NO NEW TABLE
- NO NEW CURSOR
- NO RECOMMENDATION SNAPSHOT TABLE

If a blocker genuinely requires persistence, stop and report first.

## 30. Existing Regression Gates

Preserve:

- Goal create / evaluate
- Growth refresh
- no-reload next Goal
- Recent Growth
- Daily Progress replay
- Weekly Recap
- Skill Passport data semantics
- Growth History
- measurement capture
- Recommendation ranking
- profile isolation
- zh / ja
- version projection

## 31. Completion Blockers

Do not close if any remain:

- unrelated Daily PBs visually outrank completed user Goal
- Goal/Recent/Daily duplicate same fact
- Daily extractor changed to solve presentation
- recommendation causality inferred without Goal evidence
- 30/90/180/365 request contract wrong
- selected range state wrong
- selector shows meaningless unavailable periods
- Passport still leads with spec-like copy
- raw model/revision language remains primary
- Home adds extra Python
- Home adds duplicate history replay
- range change triggers duplicate request/compute
- mobile overflow
- profile leak
- production smoke not passed

## 32. Final Report — Required Answers

1. Implementation start version?
2. Final version?
3. Canonical `0.79.1 → 0.79.2` or changed?
4. Home presentation composer location?
5. Daily extractor changed?
6. Goal-linked priority rule?
7. Recommendation causality boundary?
8. Goal / Recent / Daily dedup rule?
9. Home rich Daily presentation change?
10. Home extra request count?
11. Home extra Python count?
12. Home extra history replay count?
13. Passport range bug found?
14. Root cause?
15. 30 request evidence?
16. 90 request evidence?
17. 180 request evidence?
18. 365 request evidence?
19. Coverage-aware selector rule?
20. 4-day UI?
21. 42-day UI?
22. 120-day UI?
23. 250-day UI?
24. 365+ UI?
25. Spec-like copy removed?
26. Model-break user copy?
27. zh/ja review?
28. browser matrix?
29. performance report?
30. production Home smoke?
31. production Passport smoke?
32. All closure blockers closed?

## 33. Completion State

Only after all gates pass:

```text
0.79.2 GROWTH EXPERIENCE CLOSURE COMPLETE

HOME INTENT-AWARE FEEDBACK ESTABLISHED
USER-SELECTED GOAL RESULT PRIORITIZED
GOAL / RECENT / DAILY PRESENTATION DEDUP ACCEPTED
DAILY PROGRESS EXTRACTION UNCHANGED

SKILL PASSPORT RANGE CONTRACT ACCEPTED
COVERAGE-AWARE RANGE UX ESTABLISHED
SPECIFICATION-LIKE COPY REMOVED
MODEL-REVISION DETAIL DEMOTED TO SECONDARY EXPLANATION

NO ADDITIONAL PYTHON COMPUTE
NO DUPLICATED HISTORY REPLAY
MOBILE / DESKTOP / ZH / JA ACCEPTED

GROWTH EXPERIENCE NOW READS AS A PERSONAL TAIKO LOG,
NOT A DATA DASHBOARD
```

## 34. Product State After Closure

```text
最近同步的变化 → Recent Growth
今天 → Daily Progress
这一周 → Weekly Growth Recap
成长档案 → Longitudinal Growth
这次想练 / 这次练成了 → Goal
接下来 → Player State + Today Plan
```

The product change in this patch is not more data.

It is:

> **the system finally understands which facts matter most to the user, and explains them naturally.**
