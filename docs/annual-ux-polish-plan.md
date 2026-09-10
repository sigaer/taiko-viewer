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

## 6. UX-2 / UX-3 预留（本轮不执行）

仅登记方向，**不得在 Round 1 实现**：

- UX-2（内容与叙事打磨）：文案层级、章节节奏、空态与降级表现。
- UX-3（视觉与动效打磨）：跨端视口一致性、动效预算、可访问性回归。

进入任一后续 Round 必须满足：UX-1 Gate 已 `PASS`，且用户显式指令开始。

---

## 7. Round 1 结果（2026-09-11 收尾）

Round 1 的六项均已交付并随 `0.57.2` 发布上线；逐项证据、根因与遗留项见
`docs/annual-ux-polish-status.md` 的「UX-1 完成记录」与「Release 记录」。

| ID | 结果 | 类型 |
| --- | --- | --- |
| UX-1.1 | 已删除好友年度报告入口、i18n key 与资源预载 | 代码 |
| UX-1.2 | 直达结果页已改为真实控件并直达 story 末页 | 代码 |
| UX-1.3 | XXX 天已改为「最早实际游玩日 → 今天」 | 代码 + 测试 |
| UX-1.4 | 根因定位到上游窗口定义；viewer 侧两处防御修复 | 调查 + 代码 |
| UX-1.5 | 六维链路核实；radar max 改固定量程 15.5；补全 ja 文案 | 核实 + 代码 |
| UX-1.6 | 定位 0.3s 抽屉门控与串行 await 并修复 | 调查 + 代码 |

**Gate UX-1 = CONDITIONAL**：契约脚本、单元测试、构建、隔离预览、产物核对、
标准部署与线上产物 smoke 全部通过；唯一未闭环项是**登录态下的年度回顾真实渲染复核**
（需要一个具备 `annualSummaryAccess` 的账号；`ANNUAL_PUBLIC_OPEN_AT = 2026-10-02`
之前普通用户不可访问，本会话未绕过鉴权）。因此不宣告 PASS，也不进入 UX-2。

### 本轮的两项跨仓库结论（需要用户决策，不在本仓库修复范围）

1. **favoriteShift 消失**是上游窗口定义的后果：生成器把「旧爱」区间固定在赛季开始附近
   （`plugins/utils/annual_summary/aggregates.py:319-321`、`snapshots.py:318`），
   而不是按账号自身观测覆盖推导。让这些账号重新拿到「新欢旧爱」必须改上游。
2. **Period 天数**的上游值同样是赛季窗口长度；本轮只在 Viewer 消费侧重锚定，
   未修改年度算法与 schema（遵循 Locked Decisions）。
