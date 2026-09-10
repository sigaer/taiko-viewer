# 太鼓年度总结 Annual UX Polish — 主控方案

> **任务性质**：年度回顾（`/account/version-summary`）体验与数据正确性打磨
> **目标仓库**：`/home/sigaer/taiko/taiko-forum`
> **Viewer 工程**：`taiko_viewer`
> **部署唯一入口**：`scripts/deploy_forum_web.sh "<commit_message>"`
> **本轮**：Round 1 — **UX-1 Functional & Data Correctness**
> **主控文档**：本文件（plan）+ `docs/annual-ux-polish-status.md`（status）

---

## 0. 文档用途与执行纪律

本文件是 Annual UX Polish 系列的**唯一主控方案**，`docs/annual-ux-polish-status.md` 是**唯一权威进度源**。

- Poster 弹幕 / 社区联动的 Phase A–F 已经 **COMPLETE**，其文档
  （`docs/annual-poster-community-plan.md`、`-status.md`、`-handoffs.md`）
  进入**只读历史归档**状态。新的 UX 工作**不得**再写入 poster-community 文档。
- status 文件对当前 Round / Item 具有权威性。不得因为「代码存在」推断某项完成。
- Gate 未显式 `PASS` 前，禁止进入下一 Round。
- 一个实现区域同一时间只允许一个写入 Agent；其余 Agent 默认只读审计/QA。
- 子 Agent 不得部署。只有最终集成 Agent 可以部署，且 Viewer 部署**只能**使用
  `scripts/deploy_forum_web.sh "<HEAD subject>"`；脚本失败即停止，不做任何替代方案。
- 普通 Viewer/UI 工作**不得**修改 `deploy_forum_web.sh`。

### Locked Decisions（未经用户批准不得变更）

1. 年度 summary 的 schema 与年度算法**不在本轮修改范围内**（沿用 poster plan §1.4 的决定）。
   本轮一切数据修正都在 **Viewer 消费侧**完成。
2. `summary.period.totalDays` 由**外部生成服务**提供；Viewer 只能读取，不能要求上游重算。
   因此「XXX 天」的口径修正必须在 `utils/annualSummary.ts` 归一化层实现。
3. 旧的 30 天公开 share / `pages/annual/share/[token].vue` 继续保留并作为次级入口存在。
4. 用户可见的 Web 改动必须在同一提交内 bump `taiko_viewer/package.json` 版本。
5. UI 文案遵守 `AGENTS.md` 的 **UI Copy and Specification Leakage** 规则：
   不把任务书、实现理由、阶段说明渲染到界面。

---

## 1. UX-1 范围（Round 1，只做这些）

| ID | 区域 | 问题 | 类型 |
| --- | --- | --- | --- |
| UX-1.1 | Opening | 删除「好友年度报告」 | 功能删除 |
| UX-1.2 | Opening | 修复「直达结果页」 | 功能缺陷 |
| UX-1.3 | Period | 「XXX 天」应基于用户最早实际游玩日期 | 数据正确性 |
| UX-1.4 | favoriteShift | 调查「改变数据范围后页面消失」原因 | 调查（必须给出根因） |
| UX-1.5 | keyword | 核实六维数据与 radar max | 数据核实 |
| UX-1.6 | 全局 | 调查「回到入口」4~5 秒延迟 | 性能调查 |

### 明确不做（本轮边界）

- 不做视觉重设计、不做新动效、不做新页面。
- 不改 annual summary schema、不改年度算法、不改上游生成服务。
- 不改 Poster 弹幕 / 社区同步 / 分享图导出（Phase A–F 已验收）。
- 不做 UX-2 / UX-3 的任何内容；UX-2 必须等用户显式指令。

---

## 2. 各项定义与验收口径

### UX-1.1 — 删除「好友年度报告」

**现状**：`OpeningSlide.vue` 的 `annual-opening__utilities` 中有两个 `<figure>`：

```text
friend.png   + t("annualSummary.openingCover.friendReport")  → 「好友年度报告」
to_end.png   + t("annualSummary.openingCover.resultPage")    → 「直达结果页」
```

二者都在 `aria-hidden="true"` 容器内，**都不可点击**，只是封面装饰。

**目标**：

- 移除「好友年度报告」这一个 `<figure>`（图标 + 文案）。
- 移除 `friendReport` i18n key（`zh.json` / `ja.json`）。
- 移除 `pages/account/version-summary.vue` 中对 `/friend.png` 的 `useHead` preload。
- `/friend.png` 资源文件本身按「不删除公共资源」原则保留（可能被海报渲染复用）；若确认无引用，
  在本轮记录中标注为「可后续清理」，不在本轮删除。

**验收**：Opening 首屏只保留「直达结果页」一个工具位；布局不出现空洞（`info-head` 仍左右对齐）；
无 404、无 console 报错；`friend.png` 不再被 eager preload。

### UX-1.2 — 修复「直达结果页」

**现状**：「直达结果页」是纯装饰（`aria-hidden` + 无 `@click`），点击无反应。

**目标**：变成真实可点击控件，**跳到 story 的最后一页**（点击后进入收尾页）。

- 使用 `StoryPlayer` 已有的 `goToPage(index)` 能力，通过 `@next` 之外的新事件或
  复用既有事件把「跳到末页」意图传上去。
- 必须复用现有过渡规则：末页与 period/overview 不在同一 transition pair，直接
  `commitPage(lastIndex, "smooth")`，reduced-motion 下退化为 `"auto"`。
- 必须保持可达性：真实 `<button>`，`aria-label` 明确，键盘可聚焦，`focus-visible` 样式。
- 必须尊重 `started` 语义：opening 页在 `started === false` 时 `.story-player__viewport`
  是 `overflow-y:hidden` 且 `touch-action:none`；点击后需要同时 `emit("start")`
  并跳转，否则视口被锁死。

**验收**：点击后确实到达 story 最后一页并显示末页内容；返回（←/滚轮/键盘）行为正常；
`started` 状态被正确置位；无 console 报错。

### UX-1.3 — Period「XXX 天」基于最早实际游玩日期

**现状与根因**：

- 样本缓存 `summary.json` 中 `period = { firstRecordAt: 2026-04-20, lastRecordAt: 2026-09-06, totalDays: 335, activeDays: 97 }`，
  而 `version.startDate = 2025-10-09`。
- `totalDays` 实际是**赛季窗口天数**（起点为赛季开始日），与用户最早实际游玩日期无关。
- Period 页同时展示两组数字：
  - `period-facts`：`转眼过去 {{ totalDays }} 天` + `已经快 {{ monthCount }} 个月`
    （`AnnualPeriodOverviewScene.vue`，`monthCount = round(totalDays / 30.4375)`）
  - `period-latest`：故事写到这里 · lastRecordAt

**用户确认口径**：`XXX 天` = **用户最早实际游玩日期 → 今天**的跨度（随访问日期增长）。

**目标**：

- 在 `utils/annualSummary.ts` 归一化层用本地计算覆盖 `period.totalDays`：
  起点 = 最早实际游玩日期（优先 `period.firstRecordAt`，缺失时回退到 calendar 最早记录日，
  再回退 `version.startDate`）；终点 = **今天**。
- 天数用「含首末两端」的自然日跨度，按 `Asia/Shanghai` 本地日计算，避免 UTC 偏移一天。
- `period.firstRecordAt` / `lastRecordAt` / `activeDays` 语义不变。
- 月份估算跟随修正后的天数重新计算（`monthCount` 已由组件派生，无需改动）。
- 不得让 `totalDays` 超过赛季窗口天数；不得出现 `0 天` 或负数。

**验收**：真实账号渲染的「XXX 天」等于「最早游玩日 → 今天」的含首末日跨度；
不同 locale 一致；cross-check 与同页「记录的日期 activeDays」不互相矛盾；
`test:annual` 契约脚本通过。

### UX-1.4 — favoriteShift 改变数据范围后消失

**现状（待根因确认）**：

- `useAnnualPages.ts:66` — `visible: has("favoriteShift")`
- `has()` → `metricAvailable(summary.sectionStatus.favoriteShift, summary.favoriteShift)`
- `utils/annualSummary.ts:188-191` — `favoriteShift = oldFavorite && newFavorite ? {...} : null`
- `FavoriteShiftSlide.vue:40` — 组件内还有一层 `v-if="favoriteShift"`
- 全部本地缓存样本都是 `favoriteShift.status = "unavailable"` + `reason: "no_favorite_change"`

**本轮要求**：**先给出根因报告**，区分两种情况：

1. **期望行为**：指标确实不存在（没有新欢旧爱）→ 隐藏该页，但必须保证
   story 索引 / 滚动位置 / 页码 / 进度条不因此错乱。
2. **缺陷**：数据存在但被误过滤（status 与 data 组合判断错误、页数组缩短导致
   视口跳页或空白页）→ 修复过滤条件或 StoryPlayer 的索引/滚动同步。

**验收**：根因结论文档化（含 `path:line` 证据）；若为缺陷则修复并有真实数据验证；
若为期望行为则确认 story 缩短后不存在空白页 / 错位。

### UX-1.5 — 六维数据与 radar max

**现状**：

- `AnnualKeywordSigilScene.vue:29-39` 从 `keywordProfile.radarValues` 取六维
  （`big_song / stamina / speed / accuracy / rhythm / complex`），
  `radarMax = max(10, ceil(max*2)/2)` —— **按每个账号自己的最大值自适应缩放**。
- `AnnualKeywordRadarSigil.vue:35-49` 用 `value / maxValue` 归一化到半径。
- 本地缓存观测到的六维最大值：14.8692 / 11.2715 / 9.0777 / 7.5313。

**本轮要求**：核实而非重写。必须回答：

1. 六维数据是否完整（六个维度都存在、无 NaN/undefined、无被 `isUsableMetric` 误删）。
2. `dimensionKey` / `titleKey` 是否都能在 `zh.json` 与 `ja.json` 找到对应文案。
3. radar max 的取值在 15.5 附近时雷达图表现是否正确（最高维是否贴到外环、是否被 clamp）。
4. 「自适应 max」是否会让不同账号之间失去可比性（低分账号被拉满外环）。
   给出结论与**是否需要**改成固定量程的判断依据；本轮**默认不改**，除非确认是缺陷。

**验收**：核实结论 + 数据表（每个缓存账号的六维值、radarMax、归一化半径）落档；
若发现缺失 i18n key 或数据通道断点，按最小改动修复。

### UX-1.6 — 「回到入口」4~5 秒延迟

**现状（待测量）**：`StoryDrawer` 的 exit 按钮 → `emit("exit")` →
`pages/account/version-summary.vue` 的 `navigateTo(localePath("/account/profile"))`。

**本轮要求**：

1. 明确「回到入口」指的是哪一个交互（drawer 的 exit，还是 story 内返回 opening 页），
   并对两条路径都给出时间预算分解。
2. 找出所有显式多秒级延迟/阻塞（`setTimeout`、`await` 链、middleware 重复鉴权、
   `disposeAudio(releaseDelay)`、`primeAnnualBgm` 的 1000ms 兜底等）。
3. 给出**可复现的测量**（本地或线上 Chrome Performance 面板 / Performance API），
   而不是猜测。
4. 给出最小修复方案；若延迟来自 `<el-drawer>` 关闭动画 + 路由 + 中间件鉴权叠加，
   优先考虑：提前发起导航、去掉重复 `fetchCurrentUser()`、drawer 关闭不阻塞导航。

**验收**：有量化测量数据；修复后「回到入口」在本地与线上均为亚秒级；
无路由竞态（不会出现「抽屉关了但没跳转」）。

---

## 3. Round 执行顺序

```text
1. 建立本文件 + status 文件（权威基线）
2. UX-1 六项实现/调查
3. 本地最小真实验证（契约脚本 + 真实渲染 + 逐项对照）
4. 更新 status（含每项证据）
5. release（bump taiko_viewer/package.json，按 release policy 推断级别）
6. scripts/deploy_forum_web.sh "<HEAD subject>"（脚本失败即停止）
7. 线上 smoke（真实域名 + 真实账号）
8. 停止；**不自动开始 UX-2**
```

---

## 4. 验证矩阵（最小真实验证）

| 项 | 验证方式 | 通过标准 |
| --- | --- | --- |
| UX-1.1 | 真实渲染 Opening 首屏 | 只剩「直达结果页」；无 404；无 console error |
| UX-1.2 | 真实点击「直达结果页」 | 到达 story 末页；可继续前后导航 |
| UX-1.3 | 真实账号读取渲染后的天数 + 契约脚本 | 等于「最早游玩日→今天」含首末日跨度 |
| UX-1.4 | 根因报告 + 真实切换数据范围 | story 页码/滚动/进度条一致，无空白页 |
| UX-1.5 | 六维数据表 + 真实雷达渲染 | 六维齐全、radarMax 与归一化半径符合表格 |
| UX-1.6 | Performance 测量（本地 + 线上） | 延迟量化并下降到亚秒级 |
| 全局 | `npm run test:annual` 等契约脚本 | 全部 exit 0 |
| 全局 | 构建 | `nuxt build` exit 0 |
| 全局 | 线上 smoke | viewer 域名 appVersion = 新版本，年度回顾可正常打开 |

---

## 5. 版本与提交策略

- 按 `AGENTS.md` Release Policy 推断 bump：
  - 删除一个装饰入口 + 修复一个死控件 + 修正一个展示口径 + 性能修复
    → **patch**（bug fix / compatible UX correction）。
- 一个 release commit，提交信息前缀为版本号，例如：`0.57.2 修正年度回顾入口与统计天数`。
- Viewer 部署只允许 `scripts/deploy_forum_web.sh "<HEAD subject>"`。

---

## 6. UX-2 — Animation & Interaction Rhythm（Round 2）

**触发**：Gate UX-1 = PASS（生产 `0.57.3`）后，用户指定的第二轮。
**范围（只做这三项）**：

| ID | 区域 | 目标 |
| --- | --- | --- |
| UX-2.1 | Opening | 重做为真正的爆发式烟花：中心爆发、径向高速粒子、轻微重力与拖尾、错峰多组、持续循环 |
| UX-2.2 | Period → Overview | 纵向基础运动全程不停；旋转只作为**叠加**自由度，不再与纵向位移争用同一个 transform |
| UX-2.3 | timeOfDays | 首屏第一拍即给出主题；六个 label 与其半扇形同属一个旋转组；中央次数字号适配 2–5 位且不裁切 |

**明确不做（留给 UX-3）**：Opening 烟花以外的视觉、Period→Overview 以外的动画、
favorite / keyword / ratingRank / month / Calendar / speedProfile / pound / highScore /
breakthrough / Poster 四格对齐，以及 `el-drawer` 的 `custom-class` 问题（UX-1 已真实验收「回到入口」正常）。

### 6.1 UX-2.1 Opening 烟花

- 实现：`AnnualOpeningFireworks.vue` 改为 **Canvas 2D 粒子系统**（不引入新依赖）。
- 结构：7 个错峰 generator（各自位置 / 数量 / 初速 / 色相 / 起始偏移 / 周期），
  每次爆发从 0 开始按帧累积，粒子数 12–30、速度与拖尾长度带随机抖动、
  方向整体旋转 + 环向抖动以保证不完全对称、`GRAVITY` 向下漂移 + `DRAG` 速度衰减、
  `lighter` 叠加混合 + 短拖尾线表现速度感。
- 层级：属于 ambient 层，整层 `opacity: 0.62`，粒子半径小、颜色偏冷白，
  不抢标题、开始按钮与「直达结果页」的焦点。
- 生命周期：`active` 且页面可见且非 reduced-motion 时才跑 `requestAnimationFrame`；
  `visibilitychange`、`active`、`reducedMotion` 变化都会同步启停；
  reduced-motion 渲染 3 组静态定格。
- 契约新增：必须有 canvas、`requestAnimationFrame`、`GRAVITY`、`visibilitychange`、`GENERATORS`。

### 6.2 UX-2.2 Period → Overview transform 解耦

- 根因：页面切换的 GSAP 时间轴直接对每个封面 `vertical-cover-stream__plane` 写 `rotationZ`，
  与封面自身的纵向 CSS 动画落在同一个元素上；同时封面流的运行态被绑在「当前激活页」上。
- 修复：
  1. 新增**只负责旋转**的 DOM 层 `period-overview-scene__cover-rotation`（`__cover-planes` 与
     `AnnualVerticalCoverStream` 之间），GSAP 只写这一层，纵向动画仍在 `__slot` 上，两个自由度彻底分离。
  2. 封面流新增独立的 `flowing` 状态：只要 period/overview 这一对仍是当前页（含过渡进行中）就持续流动，
     不再依赖「激活页」信号；`PeriodSlide` / `OverviewSlide` 两个包装组件都必须转发该状态。
  3. 页面切换过程中不再有任何 `.pause()` 或 `animation-play-state: paused` 作用于封面流。

### 6.3 UX-2.3 timeOfDays 页面节奏

- 首屏第一拍：新增 `time-of-day-theme`（复用 `copy.timeOfDay.eyebrow` + 新增
  `slides.time.theme`），进入即 100% 可见；右下角原有结论保留为第二拍（reveal ≈1.5s）。
- 旋转结构：六个 label 从原来的「与 SVG 平行播放的 12 个 slot 动画」改为
  **与半扇形同处一个 rotor 组**（`time-wheel__rotor` 内同时含 svg sector 与 slot），
  角度只由 `--angle` 一个状态决定，物理上不可能与扇形错位。
- 数字：`time-wheel__count` 按真实位数选择 `is-digits-2..5` 的 `clamp()` 字号，
  配 `tabular-nums`、`max-width: 100%`、`overflow-wrap: anywhere`，
  中央轮盘槽宽 `min(46vw,190px)`；不再对单个数字写死字号。

### 6.4 UX-2 验收（真实播放，非静态截图）

主视口 414×896，另快速确认 390×844 / 430×932。判定依据一律为**真实浏览器连续播放**：

| 检查 | 方法 | 通过标准 |
| --- | --- | --- |
| 烟花爆发感 | Canvas 采样亮度能量 12s | 有连续错峰粒子、亮度层次多、无长静默 |
| 烟花可读性 | 逐元素透明度与层级 | 标题/年份/两个入口均 100% 可见，烟花整层 0.62 |
| 纵向流动不停 | 逐帧比对 slot transform + bounding rect | 过渡全程持续位移，无冻结帧 |
| 旋转叠加 | 逐帧比对 rotation 层 transform + transition clock | 旋转进行且与流动同时存在，交接前后封面位置一致 |
| 首屏主题 | 进入后 ~350ms 读 DOM | theme 文案已可见，结论仍为后续 reveal |
| label 与扇形同步 | DOM/契约双重检查 | 二者同属一个 rotor 组，无独立动画 |
| 数字适配 | 读取每个 count 的 rect 与轮盘边界 | 2–5 位均不越界，无左右裁切 |

**不建立**：动画单测、像素 diff、截图矩阵、RAF 模拟器、timeline 测试框架。
沿用已有低成本契约脚本（`npm run test:annual`）并补充结构性断言。

### 6.5 UX-2 结果（2026-09-11）

三项均已交付并随 `0.58.0` 上线，Gate UX-2 = **PASS**。逐项证据见
`docs/annual-ux-polish-status.md` 的「Round 2 — UX-2」章节。

### 6.6 UX-3 预留（本轮不执行）

进入 UX-3 必须满足：Gate UX-2 已 `PASS`，且用户显式指令开始。
登记方向不变：favorite 排版、keyword 文案、ratingRank 位置、month 叶片、Calendar 文案、
speedProfile / pound / highScore 唱片与标题、breakthrough 卡片、Poster 2×2 对齐、
4 个歌曲封面 404 的资源清理、`el-drawer` 面板级样式。

---

## 7. Round 1 结果（2026-09-11 收尾）

Round 1 的六项均已交付并随 `0.57.2` / `0.57.3` 发布上线；逐项证据、根因与遗留项见
`docs/annual-ux-polish-status.md` 的「UX-1 完成记录」「Round 1.1」「Release 记录」。

| ID | 结果 | 类型 |
| --- | --- | --- |
| UX-1.1 | 已删除好友年度报告入口、i18n key 与资源预载 | 代码 |
| UX-1.2 | 直达结果页已改为真实控件并直达 story 末页 | 代码 |
| UX-1.3 | XXX 天改为消费上游 `firstActualPlayDate`，并修掉真实调用点 bug | 数据源 + 代码 + 测试 |
| UX-1.4 | favoriteShift 改按账号 observed span 的 25% 取 early/late | 上游 + 代码 |
| UX-1.5 | 六维链路核实；radar max 改固定量程 15.5；补全 ja 文案 | 核实 + 代码 |
| UX-1.6 | 定位 0.3s 抽屉门控与串行 await 并修复（线上实测 483 ms） | 调查 + 代码 |

**Gate UX-1 = PASS**（2026-09-11，`0.57.3`）：契约脚本、period 用例、构建、
标准部署与**线上真实账号浏览器验收**全部通过。验收数据：
`firstActualPlayDate = 2023-11-18`、`today = 2026-09-10`、`expectedDays = 1028`、
`renderedDays = 1028`；favoriteShift 按 observed-span 口径恢复（story 20 → 21 页）；
「回到入口」483 ms。UX-2 / UX-3 未开始，等待用户显式指令。

### Round 1.1 补充（2026-09-11）

用户真实验收发现 Period 天数仍不正确，据此追加两项；其余 UX 项（Opening 烟花、
Period→Overview 动画、favorite 排版、keyword 文案、ratingRank、month、Calendar、
timeOfDay、speedProfile、pound、highScore、breakthrough、Poster 四格对齐）
一律留给 UX-2 / UX-3，本轮未触碰。

1. **Period 天数真实 bug**：正确来源是**账号可玩数据中最早的真实游玩时刻**，
   由生成器新增字段 `period.firstActualPlayDate` 提供（赛季窗口会把 2023–2025 的历史裁掉，
   Viewer 无法自行得知）；同时 Viewer 侧 `calendarParts()` 只接受字符串，
   导致「今天」解析失败并**静默回退**到窗口值 —— 这是上一轮该项实际未生效的原因。
2. **favoriteShift observed-span 口径**：early/late 窗口由固定赛季窗口的绝对 25%
   改为账号自身观测跨度的 25%，只换锚点；全部业务阈值与 `no_favorite_change` 保持原样。

因此 **Locked Decision 1 的边界被用户显式修订**：本轮确实修改了上游生成器与
`schemas/annual-summary-v4.schema.json`（新增必填 `period.firstActualPlayDate`），
但仍**未改动**年度算法本身，也未改动其他 section 的判定逻辑。
