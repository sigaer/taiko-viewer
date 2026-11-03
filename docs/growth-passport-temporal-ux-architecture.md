# Growth Passport Temporal UX — 性能 Gate 后的替代设计

日期：2026-10-07。状态：**设计，未实现/未验收**。基线 `0.80.0`，审计见 [数据流与成本](growth-passport-temporal-ux-audit.md)。

## 先消除成本来源，再扩展档案

当前被挡住的是完整 365-day 管线的成本。轻量周期 endpoint 无法消除同一 loader/replay 的成本；新事实表也不是本次已授权的捷径。

优先路线仍为 Architecture A：一次 bounded history load、一遍 canonical replay、一个 current Growth、一个 measurement SQL、四个内存 period views。先验证以下两步，再开始 Temporal UI：

1. **日期格式化成本修复与等价性审计。** 保留 `growthCalendarDay` 原有本地字符串快路径、invalid 行为和 timezone 语义；ISO/Date 分支复用固定的 Asia/Shanghai formatter。非默认 timezone 可以不缓存；若缓存，必须是有限 LRU，不能按任意字符串无限扩张。不能把所有 ISO 文本直接截前十字符，UTC 日期不等于上海业务日。验证跨 UTC/上海午夜、闰日、offset、invalid、Date 与 string、其他 timezone、同日 representative 和 Goal observation/play day。跑完整 Daily/Weekly/History/Recent/measurement 回归。现有 10,000 次独立实验只证明复用可能降低成本，不证明所有事实等价。
2. **复测完整 2,000-file 管线。** 原样使用 ISO/full、local/full、真实 readonly history、full/delta 混合、缺 baseline、invalid files、截断 fixtures。每个 stage 完成就写入小型 checkpoint；使用受限子进程，记录 load、replay、projection、curation、serialization、max RSS、cgroup pressure/events、response bytes。不能重现 8 分钟高压后才判断失败。中断时留下最后完成的 stage；指标未知就记未知。

日期优化后，如果全量物料化/IO 仍使初载过慢，提交进一步 streaming 或 cache 审计，而不直接上线 365 扩展。首次只有一种 timestamp 表示的 benchmark 不足以放行。

## 如需降低物料化峰值

这是后续候选架构，不是当前批准的新实现：

```text
bounded ordered file metadata
  → sequential payload reader
  → canonical replay accumulator
  → facts in one <=365-day window
  → period views + selected milestone dictionary
```

沿用最新 2,000 文件约束与真实 full/delta 次序；不能按目录遍历顺序直接消费。明确保留 baseline、source、counter regression、invalid、same-day merge、bestScores、current attendance-only、fact key 和 observation attribution。一次只保留当前 payload、canonical state、必要 bestScores 与小型 facts/indices，不同时保留全部 raw payload 和多份重建状态。

要求先有 current 与 streaming replay 的 fixture 等价结果，再评估替代共享服务的范围。Home/Recent 的 observation exclusion 是另一条语义链，不能在 Passport 优化中顺手改写。限制文件数不等于限制 bytes，应在审计中明确 worst-case chart count 和单文件大小。超限返回诚实的 coverage/state，不能丢弃 facts 后声称完整。

## 单次 corpus 与 DTO

内部专用 `getGrowthHistoryForPassport` 明确校验天数 <=365；public `/api/account/growth/history` 继续使用原 <=90 validator。保持身份认证、private/no-store、初始/结束 binding 检查和 owner joins。

```ts
type TemporalPassport = {
  profileId: string
  current: CurrentState | null
  activeGoal: PlayerGoal | null
  recentCompletedGoal: PlayerGoal | null
  currentNextAction: CurrentNextAction | null
  availableRanges: [30, 90, 180, 365]
  defaultRange: 90
  measurementCoverage: MeasurementCoverage
  historicalCoverage: HistoricalCoverage
  measurementSeries: DailyPoint[]
  milestoneDictionary: Record<string, Milestone>
  periodViews: Record<30 | 90 | 180 | 365, {
    days: number
    from: string
    to: string
    recordedDays: number
    currentSegmentChange: SegmentChangeReferences
    focusTimeline: FocusRun[]
    milestoneIds: string[]
    milestoneCoverage: HistoricalCoverage
  }>
}
```

DailyPoint 的 display values 只保存一次。point 使用 opaque segmentId；版本 key 留在服务端分段处理中。SegmentChange 可引用 point id，不复制整段 points。milestone dictionary 只包含四档选中的并集，最高理论并集 6+8+10+12=36，不发送整个 canonical fact corpus。四档连续 focus runs 可引用共享 run/index，避免极端每日变 focus 时复制过多元数据。

单次 measurement SQL 在 owner/binding 作用域中，同时读取 coverage aggregate 与 <=365 天每日代表。若使用 `ROW_NUMBER`，日分组为上海日期，最后一条按 captured_at、数值 id 排序，与当前采样规则一致。空窗口仍返回 coverage 元数据；不能为凑「一个 query」丢失 profile isolation 或读取所有 historical measurements。当前代码两条 measurement SELECT 需要明确收口。

先完成 current compute（可能捕获 measurement），再读取该 corpus。current 仍是现在的值；不能由 selected range 的平均值或最后旧点替代已取得的 current。

## 周期状态与页面

唯一状态源是 route query：合法 30/90/180/365，默认/非法值为 90。首次请求与 requested range 解耦，始终加载同一个 365 corpus；`useAsyncData` 不 watch range。watch user/binding 且旧 profile cache 必须失效；不能因避免 refetch 混用另一账号的数据。range click 只改 query 和本地引用，0 network、0 Python、0 replay；back/forward 恢复同一 period。

四档始终展示。period.from/to 共用于 summary、Rating 图、六维图、focus、节点、coverage。4 天记录选择 365 时：`过去 365 天 · 实际记录 4 天`，横轴仍为 365 天。now Rating、current six dimensions、current focus、active Goal、Today Plan 不随周期变化。

沿用 Viewer 字体、颜色和卡片风格，布局次序：现在 → 周期 → Rating → 六维 → 关注方向 → 精选节点 → 接下来。周期控制是次级，数值和真实变化是主内容。不同 section 不再解释实现架构。

## 分段图与 focus

- Rating 单独一张图。同段 >=2 个有效点画实线，单点保留点；missing 值不能被无意连过。A→B→A 不重新拼成一个段。只连接真实采样，不插值补记录。
- 六维使用共同 0–15 标度。先验证六条线的 mobile 截图；默认全可见，selected dimension 以线宽/可见标记和 aria-pressed 高亮，其他曲线仍可见。若 390px 过密，改成共享轴/标度的 2×3 small multiples，并在人工截图复核中记录最终选择。
- break 的竖向标记落在前段尾与后段首之间；对应日期旁有可键盘展开的说明「为什么这里断开？」。内容解释前后计算方式不同、不会直接比较，不展示版本 ID。不能只用另一种颜色表达 break。
- Tooltip 仅日期、指标名、数值。hover、focus、tap point 可打开；tap outside/Escape 关闭。不要自动常驻 focus 描述，不用 focus 作为 Rating aria-label 的附加语义。
- focus 用现有 run compression，segment 边界保留断点。label 是关注方向，不是退步；变化只说方向变化，不说旧方向被解决。末 run 的 current 标记须确实代表当前已知测量状态，不能让早于现在的 period 子窗口冒充实时状态。
- Summary 在最新兼容段内才比较，stable 用真实数值，少点用「记录还在积累，先看看已经留下的变化」。model update 不再当孤立大标题。

## Milestone curation

canonical facts 不改。先全 corpus 去重，同 chart+play day 聚合，保留 supporting facts。Goal 用既有 revision/goal-type 匹配：匹配成功链接 score play day；失败为 observation-only。completedAt 不能成为游玩日。

各 period 对真实 attributed/observed day 过滤候选，再进行周期内选取：

1. importance 层级：DF、FC、首次 clear、rank、Goal-linked completion、周期内相对较大 PB/NG、combo、普通 PB。不设绝对分数阈值；relative magnitude 排名在该 period 内计算。canonical played 不用于填满有意义节点。
2. same chart/day 合并，最高 crown 做主标题，PB/NG/combo 可做 support；事实 key 仍独立。rank 需要格式化为现有评价名称。
3. 约束：同日 <=2、同 chart <=1、同主类型默认 <=3；只有该 period 真实候选全部同类型才放宽类型约束。不能因 cap 限制推导不存在的成就。
4. 时间 bucket：30/90/180 各三等份，365 四等份。为每个非空 bucket 优先选最高质量且符合约束的代表；冲突时允许 bucket 空缺，coverage 说明以事实为准，禁止复制同 chart 以凑齐。
5. 再按 importance、类型多样性和稳定 tie-break 补 slots。上限 6/8/10/12，不凑满。最终按日期展示，但选取不能是 latest N。输入排序变化不应改变结果。
6. matched Goal 的观察日期如果在 period 内而 play day 在外，不强塞入窗口；unmatched Goal 显示「确认到」语义。存在较早保留/坏文件等问题时披露 partial/truncated，不能把 absent 候选当不存在成就。

完整合并、所有 period 的 bucket/constraint 选取、共同日期轴投影目标 <30ms。dict 去重后再计量 bytes/serialization；不能只测最后 `.slice` 的耗时。

## 下一次放行证据

所有性能 Gate 通过后才实施/发布页面。需补齐：

- 原样 ISO/full 2,000-file case 完整结束，未产生持续 MemoryHigh/PSI 高压；记录真实 process max RSS 与 cgroup events。initial visible-time 必须包含 Growth Python。
- 一次初载实测 API/Python/history replay 各 <=1；四次 click 实测各增量 0；同 payload 派生四档，measurement query <=1。
- 单/双/多 segment、缺点、limited、同日 representative、stable/up/down、缺 dimension、focus break 与 tooltip 脱离 focus 的单元与浏览器验证。
- 核心 PB flood fixture：同日 8 PB、9 月 FC、8 月 Goal、7 月 rank；再加季度事件，真实区分 180/365。每条选中事件能追溯 canonical factKeys。
- zh/ja，390px/1440px，light/dark；固定 selector、全年轴的 4 日记录、移动六维密度、断点、keyboard/tap、milestone 时间与类型分布的人工截图复核。
- public History90、Goal create/evaluate/no-reload next、Daily/Weekly/Recent、refresh/recommendation、measurement/profile isolation、voice/version 回归。
- 仅发布后使用可清理 synthetic account 做真实线上 smoke，覆盖旧/新 PB、FC、DF/clear、rank、Goal、多段 focus。清理 account/binding/session/Goal/measurement/cursor/files，并记录 orphan=0。

当前尚不满足这些放行条件。保持生产 `0.80.0`，未创建新表，未更改公开 History 契约。
