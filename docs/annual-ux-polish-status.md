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
**UX-1 CODE SHIPPED — Gate UX-1 pending logged-in acceptance**

Gate UX-1:
**CONDITIONAL** — 代码、契约、构建、发布与线上产物 smoke 全部通过；
但登录态下的年度回顾真实渲染（含「XXX 天」口径与「回到入口」计时）尚未复核，
因此**不宣告 PASS**，也不进入 UX-2。

Next allowed round:
None until Gate UX-1 is explicitly PASS.

---

## Round 1 — UX-1 明细

| ID | 区域 | 项 | 状态 |
| --- | --- | --- | --- |
| UX-1.1 | Opening | 删除「好友年度报告」 | DONE |
| UX-1.2 | Opening | 修复「直达结果页」 | DONE |
| UX-1.3 | Period | 「XXX 天」基于最早实际游玩日期 | DONE |
| UX-1.4 | favoriteShift | 改变数据范围后页面消失（根因调查） | DONE（根因在上游 + 两处 viewer 防御修复） |
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

- **仍需一次登录态端到端验证（Gate UX-1 唯一未闭环项）**：需要一个具备 `annualSummaryAccess`
  的账号，复核三件事：
  1. Period 页「XXX 天」是否等于「最早游玩日 → 今天」的含首末日跨度；
  2. Opening 只剩「直达结果页」一个入口，点击后到达 story 末页；
  3. 点击「回到入口」的端到端时间（DevTools Performance 录制），确认 0.3s 门控与串行 await
     消除后是否达到亚秒级；若仍有秒级残留，重点看 `/api/account/profile`、
     `/api/account/my-don/showcase` 的真实耗时，以及 `/api/account/my-don` 是否 cache miss
     触发 `python3 my_don_cli` 渲染。
- **favoriteShift 的恢复需要上游改动**：本仓库无法让这些账号重新得到「新欢旧爱」，
  因为生成器（`/home/sigaer/taiko/plugins/utils/annual_summary/aggregates.py:319-321`）的
  前段窗口固定在赛季开始附近。是否调整属于产品决策，本轮不动上游。
- `/friend.png`（1,170,916 B）仍在 `public/`，当前无代码引用；是否删除待确认。
- `el-drawer` 的 `custom-class` 在 element-plus 2.13 已失效（类型中已移除 `customClass`），
  抽屉面板级样式（`:deep(.story-drawer)` 的背景与内边距）可能一直未生效，需一次 DOM 复核。
- `period.totalDays` 在归一化（SSR 或加载时）按「当天」计算。跨零点长驻页面不会自增；
  跨零点首屏的 SSR/水合日界差异最多带来 1 天偏差。当前口径下这是可接受的已知边界。
- UX-1.5 遗留的两个潜在（当前数据未触发）问题未改：单维为 0 时会被 `isUsableMetric` 丢掉
  （六边形变五边形，但 aria-label 仍写「六维」）；`sectionStatus.keyword` 可用但
  `dimensionKey` 为空时会渲染空占位。
- `taiko_viewer/assets/data/title_song_relations.json` 为本轮开始前既有的工作区改动，
  按用户决定已 stash / 部署后原样还原，未进入 UX-1 提交。

---

## Release 记录

- 目标版本：`0.57.2`（patch；删除一个装饰入口、修复一个死控件、修正一个展示口径、
  两处性能/防御修复、keyword i18n 修复）。
- 提交信息：`0.57.2 修正年度回顾入口与统计天数`。

| 时间 | 事件 | 结果 |
| --- | --- | --- |
| 2026-09-11 | release commit `39b26b7` | 已提交（14 个文件 + 2 个新文档 + 1 个新测试） |
| 2026-09-11 | `scripts/deploy_forum_web.sh "0.57.2 修正年度回顾入口与统计天数"` | **exit 0**；push、隔离构建、产物切换、服务重启、内部与线上健康检查全部通过 |
| 2026-09-11 | 线上 smoke | 通过（见下） |

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

- **未能完成的 smoke**：登录态下的年度回顾真实渲染与「回到入口」计时。原因：本会话没有可用的
  年度访问账号（`ANNUAL_PUBLIC_OPEN_AT = 2026-10-02`，尚未对普通用户开放），也没有管理员会话；
  经授权的生产 DB 写入（创建会话/测试账号）本会话不可执行，因此没有以任何方式绕过鉴权。
  已用「线上 chunk 内容 + 版本徽标」这一层作为「发布产物正确」的证据，把登录态端到端验证
  列为 Gate UX-1 的待办（见下）。

---

## 安全与部署约束（本轮重申）

- 只允许最终集成 Agent 部署；只能使用 `scripts/deploy_forum_web.sh "<HEAD subject>"`；
  脚本失败即停止，不做替代方案。
- 不修改 `deploy_forum_web.sh`。
- 普通 bug 前进修复（fix forward），不回滚线上。
- 任何生产写操作都需要用户显式授权。
