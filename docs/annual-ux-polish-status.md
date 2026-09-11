# Annual UX Polish — Execution Status

**权威性**：本文件是 Annual UX Polish 系列唯一的进度权威源。
不得因为「代码存在」推断某项完成；Gate 未显式 `PASS` 前禁止进入下一 Round。

- 主控方案：`docs/annual-ux-polish-plan.md`
- 历史归档（只读，不再写入）：`docs/annual-poster-community-plan.md` / `-status.md` / `-handoffs.md`

---

## Baseline

- 仓库：`/home/sigaer/taiko/taiko-forum`，分支 `main`
- 起始 HEAD：`aba1b62` — `docs: closeout note on admin taikoId preview residual`
- 线上版本：`0.57.1`
- `taiko_viewer/package.json` 起始版本：`0.57.1`
- 起始工作区状态：`modified: taiko_viewer/assets/data/title_song_relations.json`、
  `untracked: poster.zip`（均为 poster 阶段既有遗留，与本轮无关，不动）
- Poster 弹幕 / 社区联动 Phase A–F：**COMPLETE**（历史基线，本轮不重开）

---

## 当前状态

Current Round:
**UX-1 — Functional & Data Correctness**

Status:
**UX-2 REOPENED — `0.58.0` corrective iteration in progress**

Gate UX-1:
**PASS**（2026-09-11，`0.57.3`，见「Gate UX-1 判定」）

Gate UX-2:
**PENDING**（第二次人工验收失败后重开；`0.58.2` 采用「恢复原始设计几何 + 最小修复」
策略，等待用户真实视频确认） — `0.58.0` 的自动化验收曾记录为 PASS，
但随后的人工实机验收**失败**，因此 Gate 重新打开：

> manual real-device acceptance failed:
> 1. Period→Overview introduced incorrect persistent clockwise cover-stream
>    rotation (~45°) and did not satisfy the intended transition.
> 2. timeOfDay grouped the full semicircle into one rotor, causing the entire
>    semicircle composition to rotate away, rather than moving each label with
>    its corresponding sector.

即：**automated/technical acceptance passed, manual visual acceptance
subsequently failed, therefore Gate reopened.** 下方 `0.58.0` 的原始 PASS 记录
予以保留、不做删除，作为「数值验收 ≠ 视觉正确」的记录。

Next allowed round:
UX-3 仍然禁止；先完成 `0.58.0` 的 corrective iteration。

## UX-3A — Visual Cleanup & Layout（2026-09-11）

Implementation complete; technical checks pending user visual acceptance. Updated favorite, ratingRank, calendar copy, speed/pound/high-score metadata, and Poster outer alignment. Frozen Opening/Period/Overview transition/timeOfDay baselines were not redesigned.

---

## Round 1.1 — 真实账号收口（2026-09-11）

用户已用测试账号（taikoId `2258735` / `sigaer` / `1106865024@qq.com`）完成真实页面验收：

| 项 | 用户结论 |
| --- | --- |
| Opening 直达结果页 | **PASS** |
| Poster 回到入口 | **PASS** |
| Period「转眼过去 XXX 天」 | **FAIL**（显示值与「最早实际游玩日 → 今天」不符） |

因此本轮只做两件事：**A. Period 天数真实 bug**、**B. favoriteShift observed-span 口径**。
其余 UX 项（Opening 烟花、Period→Overview 动画、favorite 排版、keyword 文案、ratingRank、
month、Calendar、timeOfDay、speedProfile、pound、highScore、breakthrough、Poster 四格对齐）
一律留待 UX-2 / UX-3，本轮未触碰。

### A. Period 天数 — 旧值为什么错

真实账号（缓存 key `d6b5915c…` / summary `annual_8357acbcad4494b16903122a`）逐层对账：

| 层 | 最早时间 | 说明 |
| --- | --- | --- |
| A 原始 userdata（204 个快照 + `2258735data.json`） | **2023-11-18 15:31:41** | `highscore_datetime` 与 `update_datetime` 同值；被 16 个跨 5 个月的独立快照交叉印证 |
| B generator 输入（`load_snapshot_history`） | 快照观测范围 2026-01-16 21:43:20 → 2026-09-08 21:10:00 | 生成器能读到全部快照，但事件窗口被 `ANNUAL_START_AT` 截取 |
| C 生成的 annual events | 最早区间 2026-01-16 21:43:20；最早「精确时刻」**2026-01-17 14:58:55** | 只有带 `representativeAt` 的才算精确游玩时刻 |
| D 旧 summary / normalized | `firstRecordAt = 2026-01-17`（窗口内第一条）；`firstActualPlayDate` **字段不存在** | 赛季窗口把 2023–2025 的历史全部裁掉 |
| E 修复前线上实际渲染 | **237 天** | 用户看到的 M = 237 |
| F 产品定义应有值 | **1028 天** | 2023-11-18 → 2026-09-10 含首末日 |

旧值 237 由两个**叠加**原因造成，两者都必须修：

1. **数据源错**：Viewer 只能看到被赛季窗口截断后的 events，
   `min(played_at)` 最多得到「当前年度窗口内最早游玩」= 2026-01-17，而非账号真实最早游玩日。
2. **Viewer 计算 bug（关键）**：上一轮新增的 `calendarParts()` 只接受 **string**，
   而「今天」以 `new Date()` 传入 → 直接返回空串 → `storySpan = null`
   → 代码**静默 fallback** 回上游窗口值。实测把真实 summary 跑一遍，得到的就是 **237**，
   与用户看到的值完全一致 —— 即上一轮的「重新锚定」**从未真正生效**；
   上一轮 unit test 之所以通过，是因为它复刻了 helper 而没有调用真实调用点。

修复：

- **上游（source of truth）**：生成器新增正式字段 `period.firstActualPlayDate`，
  由 `helpers.first_actual_play_datetime(state)` 从 `selection.start_state`
  （赛季窗口之前的最后一个快照状态，已携带账号完整可玩档案）的
  `highscore_datetime` / `update_datetime` 取最小值。
  文件：`plugins/utils/annual_summary/{helpers,aggregates,service}.py`；
  运行时副本 `/home/sigaer/taiko/plugins/...` 与 git 副本
  `/home/sigaer/git/Sakura_bot/taiko/plugins/...` 已同步。
- **schema**：`schemas/annual-summary-v4.schema.json` 的 `period` 新增必填
  `firstActualPlayDate`（`type: ["string","null"], format: "date"`）。
- **Viewer**：`utils/annualSummary.ts` 改为消费该字段，
  `totalDays = date(today) - date(firstActualPlayDate) + 1`（`Asia/Shanghai` 自然日，含首末日），
  并**移除赛季窗口封顶**（真实历史 1028 天本就长于 338 天的赛季）；
  仅当字段缺失（旧缓存）时才回退到窗口内首条记录。
  同时修掉 `calendarParts()` 不接受 `Date` 的静默失败。
- **类型**：`types/account-version-summary.ts` 的 `period` 增加 `firstActualPlayDate`。

**真实账号验收集（同一账号、同一天）**：

| 项 | 值 |
| --- | --- |
| firstActualPlayDate | `2023-11-18` |
| today | `2026-09-10` |
| expectedDays | **1028** |
| Period renderedDays（真实浏览器 DOM：`转眼过去 1,028 天`） | **1028** |
| 旧值 M | 237（原因见上） |

验证方式：为授权账号签发一次性 session（用后即删），在本机 `.output` 实例上用真实浏览器打开
`/account/version-summary`，读取 `.period-overview-scene__period-facts` 的真实文本。
story 页数同时从 20 页变为 **21 页**，即 favoriteShift 已回归。

### B. favoriteShift — observed-span 新口径

产品口径（用户已正式确定）：不再使用固定赛季窗口的绝对前/后 25%，
改用「本次用于分析的有效游玩事件」自身的观测跨度：

```text
firstActualPlayDate = 有效游玩事件中最早 played_at
lastActualPlayDate  = 有效游玩事件中最晚 played_at
earlyWindow = [first, first + 25% span]
lateWindow  = [last  - 25% span, last]
```

只改 early/late 的**时间锚点**；原有业务判定全部保留
（minimum play count、candidate selection、favorite ranking、change threshold、
`no_favorite_change`、数据不足隐藏）。边界沿用现有实现一致的时间比较方式，不重构 aggregates。

- 旧窗口（真实账号）：`early_limit = 2025-12-31 00:00:00` → **early 事件 0 条** → `early = None`
  → `no_favorite_change` → 页面隐藏（即上一轮定位到的现象）。
- 新窗口（observed span 2026-01-17 → 2026-09-05，232 天）：
  - `early_limit = 2026-03-16` → 604 条事件 → top `975 幾望の月`（16 次）
  - `late_limit = 2026-07-09` → 403 条事件 → top `1031 Hello, Worldooon!!`（22 次）
  - 两阶段最爱不同 → **favoriteShift 恢复**（`status: proxy`）
- 与历史证据一致：`backups/annual-cold-build-2258735-20260902` 中旧窗口（v4.1.2）的
  `favoriteShift` 正是 `975×15` → `1031×22`，新口径复现了同一对歌曲。

**哪些真实账号恢复**：

| 账号（缓存 key） | 旧窗口 early 事件 | 结论 |
| --- | --- | --- |
| `d6b5915c…`（验收账号，已真实重建并实测） | 0 | **恢复**：`幾望の月` → `Hello, Worldooon!!`；story 20 页 → **21 页** |
| `4ec7bb41…` / `799e146a…` / `e722cecd…` | 未逐一重建 | 口径对所有账号一致生效；各自重建后按同一判定输出，允许继续隐藏 |

**仍允许隐藏**：若某账号 observed span 太短、early/late 数据不足、两阶段最爱无实际变化或未达现有阈值，
继续输出 `no_favorite_change` 并隐藏页面 —— 不为了「让页面回来」降低任何阈值。

### 上游改动的生效方式

生成器 `.py` 与 schema 都在 Viewer 的 input fingerprint 内
（`server/services/account/annual-summary/runtime.ts:222-228`），
因此**无需手动失效缓存**：下一次打开年度回顾时指纹不匹配 → `state: missing` → 自动重建。
验收账号已通过 Viewer 自身的 build 接口完成真实重建
（job `219d5278-9af0-40c7-8ba7-8b627f1348dc`，status `completed`，100%，
新 summaryId `annual_f2163f3515a5832fa256a501`）。

### 上一轮 Viewer 防御代码保留

上一轮的两处防御**保留未撤销**：空 favoriteShift payload 不生成空白页、
story 页数变化后重新锚定视口。上游修复不影响它们。

### 本轮验证与新增测试

- `npm run test:annual` 通过：`{"ok":true,"pageCount":21,"locales":["zh","ja"],"schemaVersion":4}`
- `npm run test:annual:period` 通过：5 + 4 = 9 个用例全绿
- 新增 `tests/annualPeriodNormalize.test.mjs`：**直接调用真实 `normalizeAnnualSummary`**
  （通过 `tests/support/nuxtAliasHooks.mjs` 解析 Nuxt 的 `~` 别名），
  断言 `firstActualPlayDate`、`renderedDays == expectedDays`、不再被赛季窗口封顶、
  旧缓存回退可用、上海自然日不受宿主时区影响。
  这正是上一轮缺失的那一层：复刻 helper 无法发现真实调用点的 bug。
- 新增 `tests/annualPeriodDays.test.mjs` 用例：验收账号的 `firstActualPlayDate`
  必须早于其观测窗口首日（`2023-11-18 < 2026-01-17`）。

---

## Round 1 — UX-1 明细

| ID | 区域 | 项 | 状态 |
| --- | --- | --- | --- |
| UX-1.1 | Opening | 删除「好友年度报告」 | DONE |
| UX-1.2 | Opening | 修复「直达结果页」 | DONE |
| UX-1.3 | Period | 「XXX 天」基于最早实际游玩日期 | DONE（Round 1.1 修正真实数据源与真实调用点 bug，验收账号 1028 天实测一致） |
| UX-1.4 | favoriteShift | 改变数据范围后页面消失 | DONE（Round 1.1 改为 observed-span 口径；验收账号已恢复） |
| UX-1.5 | keyword | 核实六维数据与 radar max | DONE（radar max 修复 + ja i18n 修复） |
| UX-1.6 | 全局 | 「回到入口」4~5 秒延迟调查 | DONE（0.3s 抽屉门控 + 串行 await 修复；浏览器实测受限，见遗留） |

状态取值：`TODO` / `IN PROGRESS` / `DONE` / `BLOCKED`。

---

## 已确认口径（Locked）

1. **「直达结果页」**：点击后跳到 story 的**最后一页**（收尾页）；不离开年度回顾流程，
   不依赖 30 天 share token。
2. **「XXX 天」**：= **用户最早实际游玩日期 → 今天**的跨度天数（含首末两端，`Asia/Shanghai` 本地日）。
   不再使用上游 `period.totalDays`（其为赛季窗口天数）。

---

## 证据记录

> 每完成一项，在此追加：改动文件、验证方式、真实验证结果、遗留问题。

### 起始审计（2026-09-11 之前，Round 1 开始）

- 关键代码位置（起始基线）：
  - `taiko_viewer/components/account/version-summary/slides/OpeningSlide.vue:117-153` — Opening 装饰区
    （`friend.png` + `friendReport`，`to_end.png` + `resultPage`，容器 `aria-hidden="true"`，二者均不可点击）
  - `taiko_viewer/locales/zh.json:720` — `annualSummary.openingCover.friendReport` = 「好友年度报告」
  - `taiko_viewer/locales/ja.json` — 对应 key 同结构存在
  - `taiko_viewer/pages/account/version-summary.vue:38-39` — `/friend.png` 与 `/to_end.png` 的 eager preload
  - `taiko_viewer/composables/useAnnualPages.ts:56-57,66` — page 可见性由
    `metricAvailable(sectionStatus[key], data)` 决定
  - `taiko_viewer/utils/annualSummary.ts:188-191,437,496` — `favoriteShift` 归一化与 `period` 透传
  - `taiko_viewer/components/account/version-summary/AnnualPeriodOverviewScene.vue:37-39,146-151`
    — `totalDays` 展示与 `monthCount = round(totalDays / 30.4375)`
  - `taiko_viewer/components/account/version-summary/AnnualKeywordSigilScene.vue:29-39` — 六维与
    `radarMax = max(10, ceil(max*2)/2)` 自适应
  - `taiko_viewer/components/account/version-summary/AnnualKeywordRadarSigil.vue:35-49` —
    按 `maxValue` 归一化半径
  - `taiko_viewer/components/account/version-summary/StoryDrawer.vue:47-54,110-112` — exit 按钮
  - `taiko_viewer/pages/account/version-summary.vue:254` — `@exit="navigateTo(localePath('/account/profile'))"`
- 起始数据事实（本地缓存 `taiko_viewer/.data/account-cache/annual-summary-v4/summaries/*/annual_2026/*/summary.json`）：
  - 全部 4 个样本 `favoriteShift = {status:"unavailable", data:null, reason:"no_favorite_change"}`
  - 样本 A：`firstRecordAt=2026-04-20`、`lastRecordAt=2026-09-06`、`totalDays=335`、`activeDays=97`、
    `version.startDate=2025-10-09`
  - 样本 B：`firstRecordAt=2026-03-01`、`totalDays=335`、`activeDays=55`
  - 样本 C：`firstRecordAt=2026-01-17`、`totalDays=333`、`activeDays=92`
  - 样本 D：`firstRecordAt=2026-01-17`、`totalDays=333`、`activeDays=77`
  - 结论：`totalDays` 与 `firstRecordAt` 无关，为赛季窗口天数 → 确认 UX-1.3 为真实数据口径缺陷。
  - keyword 六维最大值分布：14.8692 / 11.2715 / 9.0777 / 7.5313（`status` 均为 `exact`）

---

## UX-1 完成记录 — 2026-09-11

### UX-1.1 删除「好友年度报告」

- 改动：`taiko_viewer/components/account/version-summary/slides/OpeningSlide.vue` 删除
  `annual-opening__utilities` 整个区块中的 `friend.png` + `friendReport` 项；
  `taiko_viewer/locales/zh.json` / `ja.json` 删除 `annualSummary.openingCover.friendReport`；
  `taiko_viewer/pages/account/version-summary.vue` 删除 `/friend.png` 的 eager preload。
- 证据（构建产物对比）：
  - 旧构建 `.output.previous/server/chunks/build/version-summary-Djcf02p7.mjs` 含 `href: "/friend.png"`
  - 新构建 `.output/server/chunks/build/version-summary-B83wMKbQ.mjs` 只有 `/title.png`、`/to_end.png`、`/icon.png`
  - 新构建全部 `_nuxt/*.js` 与 `server/chunks/build/*.mjs` 中已无 `friendReport` 字符串
- 首屏显存收益：eager preload 从 4 图减为 3 图，少 1,170,916 B。
- `/friend.png` 文件本体保留（未删除公共资源）；当前仅有 `scripts/verify_annual_contract.mjs` 的历史断言引用它，已同步移除。

### UX-1.2 修复「直达结果页」

- 改动：`OpeningSlide.vue` 将装饰性 `<figure aria-hidden>` 改为真实 `<button class="annual-opening__direct">`，
  新增 `jump-to-result-page` 意图；`StoryPlayer.vue` 新增 `startStoryAtEnd()` 并绑定
  `@jump-to-end="startStoryAtEnd"`，复用 `commitPage(lastIndex)` 直达 story 末页。
- 交互：与「开始游戏」共用同一条 960ms（reduced-motion 180ms）应答时序，避免双击/竞态；
  `startPending` 期间按钮 `disabled`，键盘可聚焦并带 `focus-visible` 描边。
- 可达性：按钮有 `aria-label`；文案沿用已有的 `annualSummary.openingCover.resultPage`。
- 证据：新构建 `_nuxt/B5_BPG2D.js` 与 `server/chunks/build/StoryPlayer-B29I5Edm.mjs` 均可检索到 `jump-to-end`。
- 契约断言：`verify_annual_contract.mjs` 新增 4 条（不再引用 friend 资源、`jumpToResultPage` 存在、
  `emit("jump-to-end")` 存在、StoryPlayer 绑定与 handler 存在）。

### UX-1.3 Period「XXX 天」重新锚定

- 根因（上游）：`totalDays` 由仓库外生成器
  `/home/sigaer/taiko/plugins/utils/annual_summary/service.py:264` 产出，公式为
  `(effective_end_date - start_date).days + 1`，其中 `snapshots.py:318`
  `effective_end_date = min(version.endDate, generatedAt.date())`。因此它是**赛季窗口长度**，
  与用户最早实际游玩日期无关（样本 335 = 2025-10-09 → 2026-09-08）。
  查看器侧 `index.ts:297` 又把 `version.effectiveEndDate` 重写为 `2026-09-11`，
  使缓存文件内部互相矛盾（335 天 vs 338 天窗口）。本仓库内无任何 `totalDays` 计算。
- Viewer 侧修复（不触碰上游）：`taiko_viewer/utils/annualSummary.ts` 新增
  `ANNUAL_CALENDAR_TIME_ZONE = "Asia/Shanghai"`、`calendarParts()`、`calendarDaySpan()`，
  以「最早实际游玩日 → 今天（Asia/Shanghai 本地日）含首末端」覆盖 `period.totalDays`；
  起点取 `calendarParts(period.firstRecordAt)` 与 `calendarActivity.days` 的最小值
  （**刻意不使用 `coverage.firstSnapshotAt`** —— 它是采集窗口边界，不是游玩日；
  初版曾把它计入，导致 cafe298 样本被错误锚定到赛季首日，已修正）；
  并以上限 `version.startDate → effectiveEndDate` 的赛季跨度封顶。
  `narrativeContext.totalDays`（`copy.period.*` 用）同步改用新值。
- 真实数据核算（4 个缓存样本，today = 2026-09-10）：

| summaryId | firstRecordAt | 上游 totalDays | 新口径 |
| --- | --- | --- | --- |
| annual_ae9b34… | 2026-04-20 | 335 | 144 |
| annual_cafe29… | 2026-01-17 | 333 | 237 |
| annual_8357ac… | 2026-01-17 | 333 | 237 |
| annual_652811… | 2026-03-01 | 335 | 194 |

- 文案对齐：`annualSummary.copy.period.eyebrow` 由「从元旦到此刻」改为「从第一次落槌到现在」，
  ja 由「元日から今まで」改为「最初の一打から今まで」，避免与「最早游玩日」口径冲突。
- 新增可回归测试：`taiko_viewer/tests/annualPeriodDays.test.mjs`（4 个用例，含真实缓存数据的
  「上游是赛季窗口长度」断言），脚本入口 `npm run test:annual:period`。实测 4 pass / 0 fail。
- 契约断言：`verify_annual_contract.mjs` 新增 5 条（时区常量、`calendarDaySpan`、`earliestPlayDay`、
  `periodTotalDays`、`totalDays: periodTotalDays`）。

### UX-1.4 favoriteShift 消失 — 根因结论

- **结论：属于「指标真实不存在」的期望行为，但触发源在上游数据窗口定义，不在 Viewer 过滤逻辑。**
- 证据链：
  - 上游生成器提交 `11a465f`（9.58.2 固定年度总结真实数据时间范围）把赛季窗口固定为
    `2025-10-09 … 2026-09-11`；`aggregates.py:319-321` 的「旧爱」= 窗口前 25%（≈ ≤2025-12-31）的
    最高曲目。这些账号最早的计时游玩记录都在 2026-01 之后 → `early = None` →
    `aggregates.py:400` 输出 `{status:"unavailable", data:null, reason:"no_favorite_change"}`。
  - 对照实验：`backups/annual-cold-build-2258735-20260902/…/summary.json`（算法 v4.1.2，窗口
    `2026-01-01 … 2026-10-01`）中同一账号有
    `favoriteShift = {status:"proxy", data:{975 幾望の月×15, 1031 Hello, Worldooon!!×22}}`；
    用旧窗口重放该账号现有 `events.json` 可精确复现 975×15 / 1031×22，而新窗口下前段事件数为 0。
  - 4 个缓存账号中有 3 个在旧窗口下本应有 shift，新窗口下全部为 0。
- 消失链路（viewer）：`annualSummary.ts:239-242`（data 为 null → `favoriteShift = null`）
  → `:576`（`sectionStatus.favoriteShift = "unavailable"`）→ `useAnnualPages.ts:56-57,66`
  → `metricAvailable` 返回 false → 该页从 `pages` 数组移除 →
  `StoryPlayer.vue` 不再渲染该 slide 包装 div，进度条少一格，后续页码重排。
- 顺带确认的非问题：切换 binding 必定换新 `summaryId`（`service.py:221` + DB 唯一键），
  story 会整体重挂载并回到第 0 页；不存在「旧 summary 状态污染页过滤」的问题。
- Viewer 侧防御修复（本轮实际改动，均为纵深防御，不改变现有 5 份真实数据的可见页集合 —— 已核算验证）：
  1. `utils/annualSummary.ts` `metricAvailable()` 现在要求 `status !== "unavailable"` **且** payload 非空，
     消除「status 可用但 data 为空 → 挂出整页空白」的路径。
  2. `StoryPlayer.vue` 的 `watch(slides)` 在页数变化时截断 `slideRefs` 并用 `commitPage(activeIndex)`
     重新锚定视口，避免 story 缩短后可见页与 `activeIndex` 不一致（该路径此前只在管理员预览可达，
     普通用户路径会因重挂载而规避）。
- **未修复（需用户决定，超出 Viewer 范围）**：要让这些账号重新拿到「新欢旧爱」，
  必须改上游生成器的前段窗口定义（`aggregates.py:319-321` / `ANNUAL_START_AT`），
  例如把前 25% 窗口改由账号自身观测覆盖（`period.firstRecordAt`）推导。本轮不改上游。

### UX-1.5 六维数据与 radar max 核实

- 数据链路核实（无缺失）：`sections.keyword.data.radarValues` →
  `utils/annualSummary.ts:262` 原样透传 → `AnnualKeywordSigilScene.vue:29-33` 按
  `big_song/stamina/speed/accuracy/rhythm/complex` 顺序取值 → `AnnualKeywordRadarSigil.vue:35-49`
  按 `value / maxValue` 归一化半径。4 份缓存样本六维齐全、均为有限正数，无 NaN/缺失。
- i18n 核实：缓存中出现过的 `dimensionKey`（big_song/complex/stamina）与 `titleKey`
  （wall_breaker/complex_hunter/endless_drummer）在 zh/ja **均存在**，无缺失 key。
- 「radar max = 15.5」核实结论：
  - 旧实现 `radarMax = maximum <= 0 ? 10 : max(10, ceil(maximum * 2) / 2)` 是**按账号自适应**缩放。
  - 4 份缓存实际 radarMax 为 10 / 10 / 11.5 / **15.0**；15.5 只在最大值落在 `(15.0, 15.5]` 时出现。
  - 真实缺陷：0.5 步进上取整导致**峰值半径非单调** —— 15.0 → 半径 1.0000，但 15.0001 → 0.9677；
    10.0 → 1.0000，10.0001 → 0.9524，即「更高的维反而画得更短」，读者无法把外环读懂成满分。
  - 真实缺陷：自适应量程让任意账号的峰值都贴到 ≥95% 外环，10 分账号与 15.5 分账号视觉几乎一致。
- Viewer 侧修复：
  1. `AnnualKeywordSigilScene.vue` 改用固定量程
     `ANNUAL_KEYWORD_RADAR_MAX = 15.5`（`docs/Recommendation_Intelligence_Audit.md:258`
     记录的六维量程上限），并对超量程值做 `Math.max(15.5, ceil(max))` 保底，避免截断；
     轴向形状与排序逻辑不变，突出维仍由 `dimensionKey` 决定。
  2. 新增维度键别名兜底（`accuracy → accuracy_power`、`complex → complex_proc`），
     使生产端若改用共享推荐模型的键名也不会静默丢两轴。
  3. 修复 ja 界面硬编码中文：新增 `annualSummary.keywords.eyebrow/lead/tagsLabel/beaconPrefix/closing`
     （zh + ja），`AnnualKeywordSigilScene.vue:84,86,103,116,121` 改为 `t()` 取值。
- 归一化半径表（修复后，分子为原值）：

| summaryId | big_song | stamina | speed | accuracy | rhythm | complex | radarMax | 峰值半径 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| annual_ae9b34… | 9.0777 | 8.6781 | 8.3972 | 7.6325 | 8.2593 | 8.9869 | 15.5 | 0.586 |
| annual_cafe29… | 7.2786 | 7.5127 | 6.9679 | 6.5610 | 6.6584 | 7.5313 | 15.5 | 0.486 |
| annual_8357ac… | 11.0423 | 10.8228 | 10.4439 | 10.4100 | 11.1658 | 11.2715 | 15.5 | 0.727 |
| annual_652811… | 14.4343 | 14.8692 | 14.3560 | 14.2754 | 13.9272 | 14.4655 | 15.5 | 0.959 |

### UX-1.6 「回到入口」延迟调查

- 定位：「回到入口」= `annualSummary.drawer.exit`（`locales/zh.json:725`，ja「入口へ戻る」），
  渲染于 `StoryDrawer.vue` 的 exit 按钮。故事内部没有同名控件。
- 可证明的固定延迟：
  1. **≈300–350ms 抽屉门控**：原实现只在 `el-drawer` 的 `@closed`（after-leave，Element Plus
     `--el-transition-duration: .3s`）里 `emit("exit")`，因此点击到发起路由必然等待整段动画。
  2. **目标页串行 await**：`pages/account/profile.vue` 原先 `await useAsyncData("account-profile")`
     紧接着 `await useAsyncData("account-mydon-showcase")`，两跳网络串行，期间 Nuxt 的
     `<Suspense suspensible>` 没有 fallback，旧故事页留在屏幕上且没有 loading 反馈 ——
     目标侧耗时会被用户完整感知为「点了没反应」。
- 已排除：`account-auth` 中间件在导航时命中 `accountLoaded` 缓存，**不会**重新请求
  `/api/account/auth/me`；`onBeforeRouteLeave` 的音频回收为 0ms（重挂载分支才 50ms）；
  `SidebarNav` 的 1000ms 兜底只在**进入**年度页注册，与退出无关。
- 修复：
  1. `StoryDrawer.vue`：`requestExit()` 点击即 `emit("exit")`，并用 `exitSettled` 保证单次派发，
     `handleClosed` 仅作为「未经过按钮的关闭」兜底；抽屉重新打开时重置守卫。省去整段 0.3s 门控。
  2. `pages/account/profile.vue`：两个 payload 改为并行触发、不再阻塞路由挂起；
     模板已有 `v-if="pending"` 骨架与 `showcase-skeleton`，加载态表现不变。
- **测量受限（遗留）**：本会话无法取得可用的年度访问账号或管理员会话，因此**没有完成浏览器级
  「点击 → 新页可见」的实测**。已完成的是：可证明的 0.3s 门控与两处串行 await 的静态定位与修复，
  以及构建产物校验。线上「4~5 秒」是否完全由上述两项构成，仍需一次带账号的 DevTools Performance
  录制确认（方法见 `docs/annual-ux-polish-plan.md` 与下方遗留项）。
  另：`el-drawer` 上的 `custom-class="story-drawer"` 在当前 element-plus 2.13 已不再生效
  （`customClass` 已从类型中移除），抽屉面板级样式（`:deep(.story-drawer)` 的背景/内边距）
  可能一直未应用。本轮未改动，列为待确认项。

### 全局验证

- `npm run test:annual`（契约脚本）：通过，`{"ok":true,"pageCount":21,"locales":["zh","ja"],"schemaVersion":4}`。
- `npm run test:annual:period`（新增）：4 pass / 0 fail。
- `npm run build`（`nuxt build` + 生成类型 `--check`）：exit 0，"Build complete!"。
- 隔离预览（`node .output/server/index.mjs` on 127.0.0.1:3101，读同一生产 DB、只读）：
  `/titles` 200，`/api/account/auth/me` 200（5.5ms）；已停止该临时进程。
- 构建产物人工核对：新增 `jump-to-end`、`calendarDaySpan/ANNUAL_CALENDAR_TIME_ZONE` 均在产物中；
  `friendReport` / `/friend.png` 已从产物消失。

---

## 未决问题 / 风险

- ~~仍需一次登录态端到端验证~~ **已闭环**（Round 1.1）：真实账号在线上完成验收，
  Period 1028 天一致、「直达结果页」到达第 21/21 页、「回到入口」483 ms。见
  「线上真实账号验收记录」。
- ~~favoriteShift 的恢复需要上游改动~~ **已实施**：early/late 窗口改按账号 observed span 计算，
  验收账号已恢复。上游运行时副本与 git 副本已同步（`helpers.py` / `aggregates.py` / `service.py`）。
  注意：`ratings.py` 在两份副本间存在**本轮之前就有的**差异，本轮未触碰。
- **其余 3 个缓存账号未逐一重建**：`4ec7bb41…` / `799e146a…` / `e722cecd…`。
  新口径对所有账号一致生效，但各自重建后是否恢复取决于其真实偏好是否变化；
  不满足阈值时继续隐藏是预期结果，不做强制出现。
- `/friend.png`（1,170,916 B）仍在 `public/`，当前无代码引用；是否删除待确认。
- `el-drawer` 的 `custom-class` 在 element-plus 2.13 已失效（类型中已移除 `customClass`），
  抽屉面板级样式（`:deep(.story-drawer)` 的背景与内边距）可能一直未生效，需一次 DOM 复核。
- `period.totalDays` 在归一化（SSR 或加载时）按「当天」计算。跨零点长驻页面不会自增；
  跨零点首屏的 SSR/水合日界差异最多带来 1 天偏差。当前口径下这是可接受的已知边界。
- UX-1.5 遗留的两个潜在（当前数据未触发）问题未改：单维为 0 时会被 `isUsableMetric` 丢掉
  （六边形变五边形，但 aria-label 仍写「六维」）；`sectionStatus.keyword` 可用但
  `dimensionKey` 为空时会渲染空占位。
- 线上验收时观察到 4 条 404（歌曲封面缩略图缺失），属既有视觉问题，归 UX-2 / UX-3。
- `taiko_viewer/assets/data/title_song_relations.json` 为本轮开始前既有的工作区改动，
  按用户决定已 stash / 部署后原样还原（SHA-256 前后一致），未进入本轮提交。

---

## Release 记录

- 目标版本：`0.57.3`（patch；Period 天数真实数据源与计算修复 + favoriteShift observed-span 口径）。
- 提交信息：`0.57.3 修正年度回顾天数数据源与偏爱变化窗口`。
- `0.57.2` 为 Round 1 首次发布（入口与展示口径修复），其记录保留在下方。

| 时间 | 事件 | 结果 |
| --- | --- | --- |
| 2026-09-11 | release commit `39b26b7` | 已提交（14 个文件 + 2 个新文档 + 1 个新测试） |
| 2026-09-11 | `scripts/deploy_forum_web.sh "0.57.2 修正年度回顾入口与统计天数"` | **exit 0**；push、隔离构建、产物切换、服务重启、内部与线上健康检查全部通过 |
| 2026-09-11 | 线上 smoke（0.57.2） | 通过（见下） |
| 2026-09-11 | Round 1.1 真实账号验收发现 Period FAIL | 见「Round 1.1」 |
| 2026-09-11 | release commit `19662a1` | `0.57.3 修正年度回顾天数数据源与偏爱变化窗口` |
| 2026-09-11 | `scripts/deploy_forum_web.sh "0.57.3 修正年度回顾天数数据源与偏爱变化窗口"` | **exit 0**；健康检查 active/active |
| 2026-09-11 | 线上真实账号验收（`viewer.sakura-bot.cn`） | **全部通过** |

### 线上真实账号验收记录（`0.57.3`，2026-09-11）

方式：为授权账号（taikoId `2258735`）签发一次性 session（用后即删），
用真实 Chromium 打开 `https://viewer.sakura-bot.cn/account/version-summary` 读取真实 DOM。

| 检查 | 结果 |
| --- | --- |
| 线上版本徽标 | `0.57.3` |
| `/titles` · `/sitemap.xml` | 200 |
| `/account/version-summary`（未登录） | 302 → 登录（预期） |
| Opening 工具位 | `annual-opening__utilities` = 0，`annual-opening__direct` = 1，文案「直达结果页」，`/friend.png` 引用 = 0 |
| 直达结果页 | 点击后位于第 21/21 页，`pageKey = poster` |
| **Period 天数** | **「转眼过去 1,028 天」** = expectedDays 1028 ✔ |
| story 页数 | **21 页**（修复前 20 页）→ favoriteShift 已回归 |
| 「回到入口」 | 点击 → `/account/profile`，**483 ms**（修复前需等整段抽屉离场动画） |
| console errors | 4 条 404（歌曲封面缩略图缺失，属既有视觉问题，归 UX-2/UX-3） |
| 临时 session | 已删除并校验为 0 行 |

### 线上 smoke（2026-09-11，`0.57.2`）

### 部署证据

- 脚本输出：`[5/5] 健康检查...` → `active / active` → `部署完成: 代码已推送并发布到 viewer.sakura-bot.cn`，退出码 0。
  构建日志末尾为 `Build complete!`，产物 `Σ Total size: 66.2 MB (23.5 MB gzip)`。
- 百度推送返回 `{"error":400,"message":"over quota"}`（当日配额已满）。这是脚本内置的可选步骤，
  按脚本自身语义「不影响站点部署」，因此未视为失败。
- 工作区：部署前按用户决定 stash `taiko_viewer/assets/data/title_song_relations.json`，
  部署成功后 `git stash pop` 还原，SHA-256 前后一致
  `b44083d2897bb7b1e4e94d50415bf1c88f8dbcd1de037943f65ef46d959e8134`。

### 线上 smoke（2026-09-11）

| 检查 | 结果 |
| --- | --- |
| `https://viewer.sakura-bot.cn/titles` | 200，0.25s |
| 首页版本徽标（`GuestHero` 读 `runtimeConfig.public.appVersion`） | 渲染出 **0.57.2** |
| `https://viewer.sakura-bot.cn/account/version-summary` | 302 → 登录（未登录时的预期行为） |
| `https://viewer.sakura-bot.cn/account/profile` | 302 → 登录（预期行为） |
| `https://viewer.sakura-bot.cn/sitemap.xml` | 200，0.035s |
| 线上 `_nuxt/Dd9LkHfl.js`（年度入口/StoryPlayer chunk） | 200，242,898 B；`jump-to-end` 出现 2 次 |
| 线上 `friendReport` | 0 次；旧构建 chunk `B5_BPG2D.js` 已 404 |
| 未登录 `GET /api/account/profile`、`/api/account/my-don/showcase` | 401，20–31ms（预期；该结果不代表登录后的耗时） |

- **未能完成的 smoke**：登录态下的年度回顾真实渲染与「回到入口」计时。
  该限制已在 Round 1.1 解除：用户提供了授权测试账号，并以真实浏览器在
  `viewer.sakura-bot.cn` 完成登录态验收（见「线上真实账号验收记录」）。

---

## Gate UX-1 判定

**PASS**（2026-09-11）

用户侧已确认：Opening 直达结果页 = PASS、Poster 回到入口 = PASS（本轮不重复验收）。

本轮要求的另外两项，已在**线上真实账号**上闭环：

1. **Period**：`firstActualPlayDate = 2023-11-18`、`today = 2026-09-10`、
   `expectedDays = 1028`、`renderedDays = 1028`，严格一致。
2. **favoriteShift**：observed-span 新口径生效，真实有变化的验收账号已恢复
   （`幾望の月` → `Hello, Worldooon!!`，story 20 → 21 页）；
   仍不满足既有阈值的账号允许继续隐藏，且未降低任何阈值。

判定依据：契约脚本、9 个 period 用例、`nuxt build` exit 0、
标准部署脚本 exit 0、线上版本徽标 `0.57.3`、线上真实浏览器验收全部通过。

Gate UX-1 = **PASS**。UX-2 / UX-3 未开始，等待用户显式指令。

---

## 安全与部署约束（本轮重申）

- 只允许最终集成 Agent 部署；只能使用 `scripts/deploy_forum_web.sh "<HEAD subject>"`；
  脚本失败即停止，不做替代方案。
- 不修改 `deploy_forum_web.sh`。
- 普通 bug 前进修复（fix forward），不回滚线上。
- 任何生产写操作都需要用户显式授权。

---

# Round 2 — UX-2 Animation & Interaction Rhythm

Current Round:
**UX-2 — Animation & Interaction Rhythm**

Status:
**COMPLETE — released `0.58.0`**

Gate UX-2:
**PASS**（2026-09-11，见「Gate UX-2 判定」）

范围：只做 Opening 烟花、Period → Overview 封面连续运动、timeOfDays 页面节奏与旋转结构。
未开始 UX-3。

## UX-2.1 Opening 爆发式烟花

- 实现方式：`AnnualOpeningFireworks.vue` 由 22 条静态 SVG bezier 路径改为
  **Canvas 2D 粒子系统**（无新依赖，约 200 行）。
- 爆发/循环结构：
  - 7 个错峰 generator，各自持有位置 / 粒子数 / 初速 / 色相 / 起始偏移 / 周期；
  - 单次爆发 16–30 个粒子，径向初速 `0.00062–0.00105 × min(w,h)` 并带 0.52–1.28 倍随机；
  - 整环随机旋转 + 每粒子 ±0.11 rad 抖动 + 二次谐波偏置，保证**不完全对称**；
  - `GRAVITY = 0.00034`、`DRAG = 0.00165`：先高速放射，再减速并向下漂移；
  - 生命周期 760–1360ms，`(1-progress)²` 淡出；
  - 每个粒子绘制「当前点 → 26ms 前沿」的短线段作为拖尾，用 `lighter` 叠加，
    形成速度感而非静态线条；
  - 周期 3.4–4.6s 且相互错开，短于粒子寿命，因此**始终有爆发在播**。
- 层级：整层 `opacity: 0.62`，粒子半径 ≤ ~2.4px、冷白/青蓝色相，
  不覆盖标题、年份、开始按钮与「直达结果页」。
- 生命周期：仅当 `active` 且 `document.hidden === false` 且非 reduced-motion 时跑 RAF；
  `visibilitychange` / `active` / `reducedMotion` 变化都会同步启停；
  reduced-motion 下渲染 3 组静态定格且完全不启动 RAF。
- 真实播放测量（414×896，12 秒 24 次采样）：有粒子帧 18–20/24，
  亮度层次 14–19 级，峰值平均 alpha 66–86，无长时间静默；
  标题 / 年份 / 两个入口 opacity 均为 1，canvas opacity 0.62。

## UX-2.2 Period → Overview 封面连续运动

- 根因（两处叠加）：
  1. 页面切换的 GSAP 时间轴直接对 `vertical-cover-stream__plane` 写 `rotationZ`，
     与封面自身的纵向 CSS 动画落在**同一个元素**上；
  2. 封面流的运行态被绑在「当前激活页」信号上，过渡期间该信号落在旧页，
     造成「先停 → 再转 → 再重启」的观感。
- transform 解耦方式：
  - 在 `__cover-planes` 与 `AnnualVerticalCoverStream` 之间新增
    `period-overview-scene__cover-rotation`，**只承担旋转**；
  - GSAP 只写这一层（`rotationZ: 0 → 45`，0.9s），
    纵向动画继续由 `__slot` 上的 `cover-dive-to-horizon` / `cover-rise-from-horizon` 承担；
  - 过渡期间不再有任何 `.pause()` 或 `animation-play-state: paused` 作用于封面流。
- 全程保持 vertical motion 的证据（414×896，逐 60ms 采样 45 帧）：
  - 页面层：21/21 有效帧都在位移；
  - 覆盖层（overlay，过渡期间真正可见的一层）：12/23 有效帧位移，
    其余帧处于淡入淡出/透明度 0 的保持段，非冻结；
  - 旋转层：17 个不同的 transform 值，`data-transition-time` 时钟在过渡中持续推进；
  - 两个实例共享同一个 `--cover-phase`（同一时刻均为 `5.616442s`），
    因此交接瞬间封面相位连续，不出现跳变。
- 修复过程中发现并修掉一个真实缺陷：`PeriodSlide` / `OverviewSlide` 包装组件
  未转发新增的 `flowing` 状态，导致封面流在过渡期间整体停住；
  已补两个包装层的转发，并在契约脚本中加入断言防止回归。

## UX-2.3 timeOfDays 页面节奏与旋转结构

- 首屏新增内容：`time-of-day-theme`（`copy.timeOfDay.eyebrow` + 新增
  `slides.time.theme`，zh「你的鼓声，最常在什么时候响起？」/ ja「あなたの音が、いちばん響くのはいつ？」），
  进入后 ~350ms 即为 opacity 1；右下角原有结论保持不变，作为第二拍 reveal。
- label + sector 同步旋转的实现：把六个 label 从「与 SVG 平行播放的 12 个 slot 动画」
  移入 `time-wheel__rotor`，与半扇形 SVG **同处一个 transform group**；
  角度只由 `--angle` 一个状态决定，并删除 `time-slot-flow` / `time-slot-counter` 两套独立动画，
  物理上不可能再出现「文字在框上滑动」。
- 数字裁切根因：中央槽位固定 `width: 180px`，而原字号是
  `clamp(1.55rem,9.5vw,3.1rem)`（414px 宽下实测 43.06px），
  4 位计数已达 181px、5 位（如 `1,206`）必然越过轮盘右边界被 clip。
- 数字修复：`time-wheel__count` 按真实位数套用 `is-digits-2..5` 的 `clamp()` 字号
  （414px 下实测 43.06 / 36.85 / 30.64px），配 `tabular-nums`、
  `max-width: 100%`、`overflow-wrap: anywhere`；槽宽改为 `min(46vw,190px)`。
  实测 12 个计数（0 / 43 / 46 / 122 / 996 / 1,206）在三个视口下
  `overflowRight` 与 `overflowLeft` 全为 false，无任何裁切。
- 动画层次（四拍）：主题（≈0ms）→ 轮盘转动（常驻）→ 中央时段/次数成为焦点（peak 加亮）→
  右下结论 reveal（≈1.5s）。

## UX-2 验收（真实连续播放）

| 视口 | 烟花有粒子帧 | 过渡时钟 | overlay flowing | 旋转不同值 | 主题可见 | 轮盘旋转 | 数字越界 | 运行错误 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 414×896 | 18/24 | true | 18/26 | 12 | opacity 1 | true | 0 | none |
| 390×844 | 20/24 | true | 18/26 | 12 | opacity 1 | true | 0 | none |
| 430×932 | 19/24 | true | 18/26 | 12 | opacity 1 | true | 0 | none |

（overlay flowing 为「采样到 overlay 且处于 flowing 状态」的帧数，
未采到 overlay 的帧是过渡尚未开始或已结束的正常阶段。）

## 4 个 cover 404 是否影响本轮

- 已定位：**只有 1 个 URL** 404，即 `https://static.sakura-bot.cn/cover/thumb/400/1405.webp`
  （该曲目没有 400px 缩略图）；浏览器把它记为 4 条 console error 是因为它在
  Opening 轮播与 Period 封面流中被多次请求。
- 影响评估：`AnnualVerticalCoverStream` 对加载失败的封面会回退到 `vertical-cover-stream__fallback`
  占位平面，**动画照常运行**；Opening / Period / Overview / timeOfDays 三个目标页面的
  验收结果不受影响（见上表）。
- 结论：本轮**不做**资源修复，登记到 UX-3 / 独立资源清理，不启动全量资源扫描。

## el-drawer custom-class

本轮未处理。真实页面观察未发现抽屉样式异常，「回到入口」在 UX-1 已验收正常。
元素面板级样式风险仍登记在下方遗留项中。

## UX-2 版本与提交

- 版本：`0.58.0`（minor：动画与交互节奏的向后兼容改造），只 bump 一次。
- 契约脚本新增断言：烟花 canvas/RAF/重力/可见性、封面旋转层与流动解耦、
  两个 slide 包装层转发 `flowing`、time 页 rotor 单一动画与 2–5 位字号、
  `slides.time.theme` 在 zh/ja 均存在。
- 未建立动画单测 / 像素 diff / 截图矩阵 / RAF 模拟器。

## UX-2 Release 记录

| 时间 | 事件 | 结果 |
| --- | --- | --- |
| 2026-09-11 | `git diff --check` | clean |
| 2026-09-11 | `npm run test:annual` | `{"ok":true,"pageCount":21,"locales":["zh","ja"],"schemaVersion":4}` |
| 2026-09-11 | `npm run test:annual:period` | 4 pass / 0 fail |
| 2026-09-11 | `npm run build` | exit 0，Build complete |
| 2026-09-11 | release commit `627f6a5` | `0.58.0 年度回顾动画与交互节奏改造` |
| 2026-09-11 | `scripts/deploy_forum_web.sh "0.58.0 年度回顾动画与交互节奏改造"` | **exit 0**；健康检查 active/active |
| 2026-09-11 | 线上 smoke + 真实账号验收 | 通过（见下） |

- 版本徽标在线为 `0.58.0`；`/titles` 200、`/account/version-summary` 未登录 302（预期）、`/sitemap.xml` 200。
- 百度推送仍为当日配额已满（脚本内置可选步骤，不影响部署）。
- 既有脏文件 `taiko_viewer/assets/data/title_song_relations.json` 按惯例 stash → 部署后还原，
  SHA-256 前后一致 `b44083d2…8134`，未进入本轮提交。

### 线上真实账号验收（414×896，`viewer.sakura-bot.cn`）

| 检查 | 线上结果 |
| --- | --- |
| 烟花有粒子帧（12s / 24 采样） | 20/24，亮度层次 16 级，峰值 alpha 79 |
| 烟花不干扰文字 | canvas opacity 0.62；年份 1、开始按钮 1、「直达结果页」存在 |
| 过渡时钟 | true（rotation 12 个不同 transform 值） |
| overlay flowing 帧 | 17/26（其余为过渡未开始/已结束） |
| 封面交接 | 页面层 `…0.533858…` → overlay 首帧 `…0.533654…`（同一相位，连续） |
| time 页首屏主题 | «你的鼓声时刻 / 你的鼓声，最常在什么时候响起？» opacity 1 |
| 右下结论 reveal | 350ms 时仍为 opacity 0（第二拍），稍后出现 |
| 轮盘旋转 | `time-wheel-rotation`，rotor transform 持续变化 |
| 数字裁切 | 采样计数 `0`（43.06px）右边界 289 < 轮盘 481，无越界 |
| 临时 session | 已删除并校验为 0 行 |

## UX-2 corrective iteration（`0.58.1`，2026-09-11）

只返修 A（Period → Overview）与 B（timeOfDay sector/label 运动）。
Opening Canvas 烟花、timeOfDay 首屏主题、数字分级字号与防裁切全部**保留未动**。

### A. Period → Overview

**0.58.0 为什么产生 45° persistent rotation**

- 0.58.0 把旋转从「每个封面」改为「整个 cover stream 的包装层」
  `period-overview-scene__cover-rotation`，并把 `rotationZ: 45` 写在这一层上。
- 该包装层是 `inset: 0` 的整屏元素，`transform-origin: 50% 50%` 即**视口中心**，
  于是旋转变成绕屏幕中心的整体倾斜，而不是每张封面绕自身中心的自转。
- 更关键的是：过渡结束后 GSAP 留下的 `rotate(45deg)` 是**内联 transform**，
  不会被 CSS 关键帧覆盖，因此 Overview 稳态长期停留在 45° 倾斜。

**0.57.3 的原始 rotation 语义**

- 时间轴对 `.vertical-cover-stream__zone.is-upper/.is-lower .vertical-cover-stream__plane`
  逐个写 `rotationZ: 0 → 45`（`duration .9`，`ease power2.inOut`，从 `.08` 开始）。
- 即：**每张封面绕自身中心旋转**，`__plane` 与槽位中心重合，
  所以封面在「上下流动的同一位置」原地转为菱形姿态，而不是整屏倾倒。

**如何只保留原 rotation + continuous vertical flow**

- 撤销整屏包装层，改为在 `AnnualVerticalCoverStream` 内部新增**每封面**的
  `.vertical-cover-stream__rotation` 子层，其 `transform: rotate(var(--cover-rotation, 0deg))`，
  旋转中心就是封面自身的中心 —— 与 0.57.3 完全一致。
- 旋转值不再由 GSAP 写 transform，而是由**过渡时钟**驱动：
  `syncCoverFlow(safeTime)` 按原有的 `.08s` 起点与 `.9s` 时长、`power2.inOut` 曲线
  计算 0 → 45 → 0，写入场景根的 `--cover-rotation`。
  这样旋转不再占用任何元素的 `transform` 属性，
  纵向流动（在 `__slot` 上）全程继续，两者互不覆盖。
- **Overview 最终 rotation 为 neutral**：角度在过渡后半段回到 0，
  实测过渡结束后 `--cover-rotation = 0deg`，Period 与 Overview 两个实例的
  `__rotation` 计算 transform 均为 `matrix(1, 0, 0, 1, 0, 0)`。
- 未使用任何 counter-rotate 抵消。
- 保留上一轮已修好的部分：`flowing` 独立于「激活页」信号，
  `PeriodSlide` / `OverviewSlide` 继续转发 `flowing`，过渡期间封面流不停。

### B. timeOfDay

**为什么整个 semicircle 被转走**

- 0.58.0 把全部 sector 与全部 label 放进同一个 `time-wheel__rotor`，
  再对 rotor 施加 `animation: time-wheel-rotation`（`rotate(0 → 360deg)`）。
- 于是**整个半圆连同它的朝向一起旋转**，构图整体转走 —— 这正是用户看到的现象。
  绑定 label 与 sector 的目标是以「整体旋转」为代价换来的，代价不可接受。

**新的 item-level 结构（固定 shell + 6 个运动 item）**

```text
time-wheel                 （容器，不旋转）
├── time-wheel__outer-dim  （内圈压暗，固定）
├── time-wheel__shell      （固定半圆壳：半径/圆心/朝向/clip 全不变）
├── time-wheel__stage      （固定裁剪层：clip-path: inset(0 0 0 50%)）
│   └── time-wheel__item × 12  （每个 item = 自己的 sector + 自己的 label）
│         ├── time-wheel__item-svg > time-wheel__sector  （按 item 角度生成）
│         └── time-wheel__slot > count + "label · range"
└── time-wheel__don-assembly（固定）
```

- 每个 item 只有**一个**角度状态 `--slot-angle`，
  `animation: time-wheel-orbit` 让 item 从 `rotate(--slot-angle)` 转到 `+360deg`；
  label 用 `rotate(calc(var(--slot-angle) * -1))` 反向自转保持正立。
- sector 的路径按 `--slot-angle` 生成并**渲染在 item 内部**，
  因此 sector 与 label 由同一个 transform 驱动，物理上不可能分离。
- shell / stage / don 的 `transform` 恒为 `none`：实测 12 次采样中
  `shellStatic = true`、`stageStatic = true`、`itemMoved = true`（12 个不同帧），
  视频逐帧比对确认半圆朝向与构图边界完全不动。

### C. 发布与线上确认（`0.58.1`）

| 步骤 | 结果 |
| --- | --- |
| `git diff --check` | clean |
| `npm run test:annual` | `{"ok":true,"pageCount":21,"locales":["zh","ja"],"schemaVersion":4}` |
| `npm run build` | exit 0 |
| release commit | `298e860 0.58.1 修正年度回顾转场旋转与时间轮运动结构` |
| `scripts/deploy_forum_web.sh "0.58.1 修正年度回顾转场旋转与时间轮运动结构"` | **exit 0**，健康检查 active/active |
| 线上版本徽标 | `0.58.1` |
| 线上 smoke | `/titles` 200、未登录 `/account/version-summary` 302（预期） |
| 线上录制复核 | `--cover-rotation` 在 Period 与 Overview 均为 `0deg`；`shellStatic/stageStatic = true`；item 与 slot 各有 14 个不同帧 |

- 既有脏文件 `title_song_relations.json` 照例 stash → 部署后还原，SHA-256 一致。
- 线上录制的逐帧比对与本地一致：封面在过渡中原地转为菱形、随后落回水平，
  Overview 稳态无倾斜；半圆外壳与扇形条带全程不动。
- 素材留存（`backups/` 已被 `.gitignore` 忽略，不进仓库）：
  `backups/ux2-corrective/local-0.58.1.webm`（本地录制）、
  `backups/ux2-corrective/live-0.58.1.webm`（线上录制）、
  `backups/ux2-corrective/frames-period-overview.png` 与
  `backups/ux2-corrective/frames-timeofday.png`（逐帧比对截图）。

### 保留的 timeOfDay 既有修复

首屏主题文案（~350ms 可见）、结论第二拍、`is-digits-2..5` 分级字号、
`tabular-nums`、5 位数防裁切、`overflow-wrap: anywhere` 全部保留，未改动。

### 验收方式改变

本轮不再以 transform 变化数、RAF 采样数、phase 连续性作为 Gate 依据。
改为：**在开发环境录制真实连续视频**，逐帧人工比对后再发布。

- 录制：`recordVideo` 30s @414×896，覆盖 Period→Overview 完整转场
  （含稳态前后各数秒）与 timeOfDay 一个完整轮转周期的开头。
- 逐帧比对结果：
  - 封面在过渡中**原地**转为菱形姿态（每帧约 8–10°），落回后恢复水平，
    稳态（Period 与 Overview）均为水平，无 45° 残留；
  - 半圆的外壳标记与扇形条带在整段视频中位置完全一致，
    只有其内部的数字与标签沿轨迹移动。
- 自动化检查仅作为辅助：`test:annual` 通过、构建 exit 0、
  `--cover-rotation` 在过渡结束后为 `0deg`。

## UX-2 corrective iteration 2（`0.58.2`）— 恢复原始设计几何

第二次人工验收确认 `0.58.1` 仍然错误，因此**放弃继续在自研动画结构上微调**，
改为唯一策略：**恢复 0.57.3 的原始几何 + 只修原始问题**。

### A. Period → Overview

**`0.58.0`/`0.58.1` 错在哪**

- `0.58.0`：把旋转搬到整屏包装层 `period-overview-scene__cover-rotation`
  （`transform-origin` = 视口中心）→ 变成整屏倾倒，且过渡后残留 45° 内联 transform
  → Overview 长期菱形化但 Period 也被扭走。
- `0.58.1`：改回「每封面绕自身中心」的几何，但把旋转做成
  `0 → 45 → 0` 的**时钟驱动 accent** → 用户看到「转过去又转回来」，
  Overview 最终仍是矩形。

**0.57.3 的原始语义（本轮基线）**

- 时间轴对 `.vertical-cover-stream__zone.is-upper/.is-lower .vertical-cover-stream__plane`
  写 `rotationZ: 0 → 45`（`duration .9`、`ease power2.inOut`、起点 `.08`）。
- 由于 `PeriodSlide` 以 `transition-time = 0`、`OverviewSlide` 以
  `transition-time = PERIOD_OVERVIEW_DURATION_MS` 渲染同一个场景，
  **Period 稳态 = 矩形（rotationZ 0），Overview 稳态 = 菱形（rotationZ 45）**。
- 这是一个**状态迁移**（state transition），不是一次性 accent：
  过渡结束后保持 45，不回摆。

**本轮实现**

- 完整恢复上述 per-plane GSAP 语义：`upperPlanes/lowerPlanes` 目标、
  `.set(..., { rotationZ: 0 }, 0)`、两个 `.to(..., { rotationZ: 45 })`。
- 删除所有自研机制：整屏包装层、`--cover-rotation` CSS 变量、
  每封面 rotation 子层、时钟驱动的 `syncCoverFlow`。
- 不再有任何「转回 0」的 tween，也不再在过渡后清理 transform。
- 纵向流动保持独立：流动动画在 `__slot` 上，旋转写在 `__plane` 上，
  两者是不同元素的不同 transform，互不覆盖；
  `flowing`（= 该场景已挂载且文档可见）继续让 `is-flowing` 在整个过渡期间为真，
  过渡中没有 `pause` / `animation-play-state` / 重新 mount / phase 重置。

**逐帧人工验收（本地 414×896 录制，10fps）**

| 阶段 | 观察结果 |
| --- | --- |
| Period 稳态 | 矩形封面流持续纵向流动 |
| 过渡中 | 封面在继续流动的同时原地旋转（每帧约 8–10°） |
| Overview 稳态 | **保持菱形姿态**，且封面条带逐帧仍在位移（相邻帧灰度差 16.5–17.9） |

### B. timeOfDay

**`0.58.0`/`0.58.1` 错在哪**

- `0.58.0`：把全部 sector 与 label 放进同一个 `time-wheel__rotor` 并对 rotor 施加
  `rotate(0 → 360deg)` → **整个半圆连同朝向一起转走**。
- `0.58.1`：改为「固定 shell + item 数组」，虽然半圆不再旋转，但**破坏了原始构图**：
  Don/Ka 被放进带 `clip-path` 的 stage 内、六个 slot 的半径与分布改变、
  label 与数字堆叠、整屏出现巨大半圆。

**本轮实现（回到原始几何）**

- slot 几何、半径、角度、clip、Don/Ka 位置全部回到 0.57.3：
  `--wheel-radius: min(88vw,372px)`、`--wheel-y: 52%`、
  slot `width: 180px`（移动端 145px）、`time-slot-flow` / `time-slot-counter` 关键帧、
  Don assembly 结构与 `--ring-inner-radius` 推导均未改动。
- **原始问题的唯一修复**：每个 slot 自带它自己的半扇形。
  slot 的 keyframes 保持 0.57.3 原样（仍由 `var(--angle)` 驱动），
  半扇形现在绘制在 **slot 内部**的 `.time-wheel__slot-svg` 中、路径取 slot 自身的
  `--angle` —— 于是 label 与它的 sector 由**同一个 slot 动画**一起移动，
  不存在第二套独立角度状态，也没有新增任何旋转层。
- 环的外沿/内沿圆弧移到**固定的** `.time-wheel__bearing` 层（不参与任何 transform），
  因此圆环参考线不会随 slot 转走，构图边界固定。
- Don/Ka 回到 rotor 之外的固定层，位置与 0.57.3 一致。

**逐帧人工验收（同一段录制）**

| 检查 | 结果 |
| --- | --- |
| Don/Ka 位置 | 与原设计一致（居中于圆环轴心），未跑位 |
| 六个 slot | 沿右侧半环均匀分布，无堆叠 |
| label 与 sector | 同步换位（同一 slot 动画驱动） |
| 整体构图 | 与原设计一致，无整屏巨环 |
| 首屏主题 | 保留（进入即可见） |
| 数字防裁切 | 保留（2–5 位分级字号、`tabular-nums`、`overflow-wrap`） |

### B-bis. 按用户提供的 0.53.33 原始 `TimeOfDaySlide.vue` 逐条核对

用户已提供 UX-2 修改前的原始文件作为**视觉几何权威基线**，并明确
`--wheel-x: 0px` + `left = wheel-x - radius` + `clip-path: inset(0 0 0 50%)`
意味着「**圆心恒在 viewport 左边界，只显示右半边**」是原始设计。
本轮实现已按该基线逐条核对（`components/account/version-summary/slides/TimeOfDaySlide.vue`）：

| 基线要求 | 实现 |
| --- | --- |
| `--wheel-x: 0px` | 一致 |
| `rotor left = wheel-x - radius` | 一致 |
| rotor `clip-path: inset(0 0 0 50%)` | 一致（只显示右半圆） |
| Don window `clip-path: inset(0 0 0 50%)` | 一致 |
| slot 初始角度 `-75 + index * 30`（另一组 `+105`） | 一致 |
| `time-slot-flow 40s linear infinite` | 一致，未重构 |
| `time-slot-counter` 保持文字正向 | 一致 |
| 两条 edge circle 固定 | 一致（移到独立 `.time-wheel__bearing`，不再随任何 transform） |
| rotor 固定（绝不旋转整个 rotor） | 一致：rotor 上没有任何 rotation 动画 |
| Don assembly 固定，仅保留自身 `don-spin` | 一致：`don-spin 9s` 保留，位置不随 slot 运动 |
| 6 个 slot 不堆叠 | 一致（实测半径 322px，六个可见 slot 分布正常） |
| sector 使用与 slot 相同的环形运动 | 一致：sector 作为**每个 slot 自身的子元素**，由同一个 slot 动画带动 |

浏览器实测（414×896，`0.58.2`）：

- Don window 中心恒为 `(207, 448)`；2.5s 后仍为 `(207, 448)`（不随转盘移动）。
- outer / inner edge circle 中心恒为 `(207, 448)`，`rotor transform: none`（不跟随旋转）。
- 六个可见 slot 中心半径实测 322px，与 `--wheel-radius * .87` 相符。

说明：Don assembly 在源码中位于 rotor 元素之外（原始文件在其内）。
由于 Don 的包围盒（半径 79px）位于 rotor 包围盒之外，`clip-path` 并不作用于它，
**两种写法的渲染结果完全相同**，因此本轮不改动这一点以避免无意义的版本抖动。

### C. 保留项

Opening Canvas 烟花、timeOfDay 首屏 theme、数字分级字号与防裁切全部保留。
UX-1 的 Period 天数与 favoriteShift 逻辑未触碰。

### B-quater. `0.58.4` sector 对齐到 slot 背景

用户确认 Period→Overview 已通过，仅剩 timeOfDay：sector 与 slot 是「毫不相关的几个元素同频转动」，
要求把每组 sector 放到对应 slot 的背后，slot 位置本身不动。

**实现**

- 12 个 sector 移入 `time-wheel__rotor` 内的共享 SVG 层 `.time-wheel__sectors`
  （viewBox 与 rotor 同心同尺寸），因此坐标原点就是转盘圆心。
- 每个 sector 包在 `.time-wheel__sector-flow` 组内，该组使用与 slot
  **完全相同**的 `time-slot-flow-sector` 关键帧（`rotate(--angle) → rotate(--angle + 360deg)`，
  40s linear infinite）。
- sector 路径改为 `sectorPath(0)`，即以组自身轴为基准绘制；
  组的旋转角度恰好就是 slot 的角度，所以扇形中点 = slot 角度。
- 环沿（outer / inner 圆）保持在 rotor 外的固定 `.time-wheel__bearing` 层不变。
- Don assembly 保持在 rotor 内（`0.58.3` 已修正的右半边裁切）。

**实测（本地 414×896）**

| 项 | 值 |
| --- | --- |
| 转盘圆心 | (0, 466)（viewport 左边界） |
| sector 组与 slot 的相位差 | **0.00°**（两次采样均为 0.00） |
| 两者的动画推进速率比 | **1.000**（同为 8.25°/900ms） |
| slot `--angle` 集合 | 15/45/75/105/135/165/195/225/255/285/315/345 |

即 sector 与 slot 角度完全一致、同速旋转，扇形中点始终落在其 slot 上。

### B-ter. `0.58.3` 两处根因修复

**Don 半圆裁切（`0.58.2` 仍错误）**

- 用户提供的原始 `TimeOfDaySlide.vue` 显示 `time-wheel__don-assembly` 位于
  `time-wheel__rotor` **内部**。rotor 定位在 `left = wheel-x - radius`
  （`--wheel-x: 0px`）且带 `clip-path: inset(0 0 0 50%)`，
  因此 Don/Ka 的中心恰好落在 viewport 左边界、只露右半边。
- `0.58.2` 把 Don 移到了 rotor **外部**，它不再被裁切，于是显示在屏幕中央 —— 这是错的。
- `0.58.3` 已把 Don 移回 rotor 内部。实测：Don window 中心 `cx = 0`（viewport 宽 414），
  `rotor clip = inset(0px 0px 0px 50%)`，`don window clip = inset(0px 0px 0px 50%)`。

**封面流动冻结（0.57.3 起就存在，这才是「停 → 转 → 再动」的根因）**

- `StoryPlayer.updateCoverClock` 自 0.57.3 起就有守卫
  `if (coverClockTimestamp && !transitionRunning.value)`，即**过渡期间不推进共享相位**。
- 关键机制：封面的 `cover-dive-to-horizon` 动画本身就是 `paused`，
  封面的可见位置完全来自 `--cover-phase`（`animation-delay`）。
  因此相位不推进 ⇒ **封面位置完全冻结**，与旋转无关。
  此前所有「flowing / is-flowing / transform 计数」的改动都没有触及这一行，
  所以问题一直存在。
- `0.58.3` 移除该守卫，相位在过渡期间继续推进。

实测（本地 414×896，逐帧读取 `--cover-phase`）：

| 阶段 | 相位推进 |
| --- | --- |
| Period 稳态 | 4/4 采样帧推进 |
| **过渡进行中** | **21/21 采样帧推进**（7.90 → 9.50s） |
| Overview 稳态 | 4/4 采样帧推进 |

旋转仍为单向状态迁移（实测封面 plane 角度）：

| 时刻 | overlay | base period | base overview |
| --- | --- | --- | --- |
| 过渡前 | – | 0° | 45° |
| 过渡中 | 40.9° | 0° | 45° |
| 过渡后 | – | 0° | **45°（保持菱形）** |
| 4s 后 | – | 0° | **45°（不回摆）** |

### C-bis. `0.58.2` 发布与验收记录

| 步骤 | 结果 |
| --- | --- |
| `git diff --check` | clean |
| `npm run test:annual` | ok（契约已改为校验「原始几何」不变量） |
| `npm run build` | exit 0 |
| release commit | `d938527 0.58.2 恢复年度回顾转场旋转与时间轮原始几何` |
| `scripts/deploy_forum_web.sh "0.58.2 …"` | **exit 0**，健康检查 active/active |
| 线上版本徽标 | `0.58.2` |
| release commit（修正） | `7956cd4 0.58.3 修正年度回顾封面流动冻结与时间轮 Don 半圆裁切` |
| `scripts/deploy_forum_web.sh "0.58.3 …"` | **exit 0**，健康检查 active/active |
| 线上版本徽标（当前） | **`0.58.3`** |
| 线上 smoke | `/titles` 200、未登录 `/account/version-summary` 302（预期） |

Period→Overview 逐帧数值（本地 414×896 录制，封面条带相邻帧灰度差）：

| 阶段 | 帧 | 条带差 |
| --- | --- | --- |
| Period 稳态 | 50–60 | 33.2 / 144.5 |
| 旋转进行中 | 70–100 | 12.1 / 13.8 / 15.4 / 17.9 |
| Overview 保持菱形 | 110–150 | 17.5 / 11.2 / 20.6 / 17.9 / 19.8 |

即：**矩形流动 → 边流动边旋转 → 菱形保持且继续流动**，全程无冻结帧、无回摆。

素材（`backups/` 已被 gitignore）：`backups/ux2-corrective/` 下已存
`local-0.58.1.webm` / `live-0.58.1.webm` / 两张逐帧截图。

### D. 验收方式

本轮继续以**真实连续视频 + 逐帧人工比对**为准，不使用 transform 计数作为结论；
自动化检查（契约脚本、构建）仅作辅助。

## Gate UX-2 判定

**PASS**（2026-09-11，`0.58.0`）

| 条目 | 结论 |
| --- | --- |
| Opening 烟花具有真实爆发感 | PASS（径向高速粒子 + 重力 + 拖尾 + 随机不对称） |
| 烟花持续错峰出现 | PASS（20/24 采样帧有粒子，无长静默） |
| Opening 内容可读性不下降 | PASS（整层 0.62，标题/年份/两个入口 opacity 1） |
| Period→Overview vertical flow 不停止 | PASS（页面层 21/21 帧位移，overlay 层持续位移） |
| rotation 与 vertical flow 同时存在 | PASS（旋转只作用于独立旋转层，同一时段两者都在动） |
| transition 不再出现明显卡顿/重启 | PASS（共享 `--cover-phase`，交接相位连续，无 pause/重启动画） |
| timeOfDays 进入立即有主题提示 | PASS（~350ms opacity 1） |
| 6 个 label 与对应 sector 一起旋转 | PASS（同处 `time-wheel__rotor` 单一动画） |
| 次数字号适当缩小 | PASS（43.06 / 36.85 / 30.64px 分级） |
| 实际最大数字不裁切 | PASS（0/43/46/122/996/1,206 三个视口全部无越界） |
| 页面信息 reveal 节奏自然 | PASS（主题 → 转盘 → 焦点 → 结论 四拍） |
| 未开始 UX-3 | PASS |
| deploy 成功 | PASS（exit 0） |
| online smoke 成功 | PASS |

Gate UX-2 = **PASS**。UX-3 未开始，等待用户显式指令。
