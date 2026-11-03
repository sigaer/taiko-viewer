# Growth Passport Temporal UX — 开工审计

日期：2026-10-07，Asia/Shanghai。代码基线：`85859c4`，Viewer `0.80.0`。

**审计结论：性能 Gate 未通过；暂停 365 天节点扩展与 UI 实现，不发布 0.80.1。**

主控文档 `Sakura_Taiko_Viewer_0.80.1_Growth_Passport_Temporal_UX_Closure.md` §41 明确要求：

> 如果 benchmark 证明 wall time / RSS / IO / payload 不可接受：停止实施 365 milestone expansion，提交审计结果和替代架构设计。

真实样本支持一次 365 天回放；但 2,000 个全量快照、ISO 时间戳的合成样本在运行至少 508 秒后仍未完成，出现严重内存压力。不能只凭真实小样本放行，也不能用未经测量的 payload 估计替代 Gate。替代方案见 [架构设计](growth-passport-temporal-ux-architecture.md)。本次没有修改 Viewer、版本、算法、事实规则或数据库，也没有部署。

## 版本核对

`taiko_viewer/package.json` 与 lockfile 根版本为 `0.80.0`。`nuxt.config.ts` 将 npm/package 版本注入 `runtimeConfig.public.appVersion`；`pages/more.vue` 使用该值，空值 fallback 为 `dev`。通过隔离 QA 读取生产 `/more`，徽标为 `v0.80.0`。没有降级或提前 bump。

## 十五项数据流审计

| # | 问题 | 当前实现与结论 |
|---:|---|---|
| 1 | 路由、组件、composable、endpoint 链路 | `pages/my/growth.vue` 用 `useAccountState`、`useViewerApiFetch`、`useAsyncData` 请求认证、private/no-store 的 `/api/account/growth/passport`；endpoint 经 `resolveSkillPassportRange` → `getSkillPassport` → 当前 Overview、持久化 measurements、canonical Growth History → `buildSkillPassport`。不是独立 chart composable。 |
| 2 | range 状态保存在哪里 | `route.query.range` 经 `requestedRange` computed 解析；API response 的 `range.requestedDays` 再参与 active selector；`useAsyncData` watch range，切换时 `navigateTo` 更新 query。dimension 是本地 ref，与 range 的请求行为不同。 |
| 3 | 为什么 selector 消失 | `passportRangeChoices(passportCoverageSpan(...))` 在 span <30 时返回空数组；30–364 天只保留到首个超过 span 的档位，并把最后一档称作「全部记录」。模板只在 choices 非空时渲染。用户观察窗口与实际记录跨度被混为一谈。 |
| 4 | trend 实际返回窗口 | measurements SQL 使用请求档位的 `fromUtc` / `toExclusiveUtc`；采样为每日最后一条真实测量。数据最多覆盖请求窗口，未补点；但页面 x 轴使用实际点的 min/max，缩成记录跨度。默认 90。 |
| 5 | milestone 为何固定 90 天 | `passportHistoryRange` 总使用 `recentFrom=to−89d`、`days=90`，独立于 requestedDays。composer 和 UI coverage 同样使用这份 90 天 history。 |
| 6 | 是否 latest N | 是。`buildSkillPassportMilestones` 先按同谱同日合并，再按日期倒序、当天 importance/magnitude 排序，最后 `.slice(0,8)`。没有周期 bucket、每日上限、跨日同谱上限或类型上限。 |
| 7 | focus 为何进入 point tooltip | 页面 circle aria-label 的 `passport.trend.pointLabel` 参数包含 focus；`.passport-chart-detail` 第二行直接渲染 `focusLabel(selectedPoint.focus)`。这是模板和 locale 的显式选择，不是 Rating 算法输出中的附属指标。 |
| 8 | 现有 segment 结构 | `SkillPassportSegment` 包含 id、measurementVersion、algorithmVersion、modelRevision、from/to、points。三个版本字段组成兼容 key；只有连续相同 key 才在同段，即 A→B→A 仍为三段。focus run 也按 segmentId 断开。现有 path 已逐段绘制，但单点段没有可连的线；limited 当前状态又会隐藏历史图。 |
| 9 | public History 为何上限 90 | `growth-history/range.ts` 的 public query validator 固定 `GROWTH_HISTORY_MAX_DAYS=90`；已有 foundation 审计依据读取/回放成本限制公共消费者，不开放 all-time。`getGrowthHistory` 本身接收已经解析的 range，没有独立 365 上限校验。不能修改 public validator 来绕过契约。 |
| 10 | 独立读取 180/365 canonical facts 是否可行 | 技术上可行：同一 `deriveProgressForRange` 支持日期窗口，`projectScoreFacts` 不依赖 90 天。应新增仅内部可调用、明确校验 <=365 的 Passport wrapper，复用 canonical facts、Goal projection 和 owner/binding joins；公开 endpoint 仍通过原 90 天 validator。当前性能 Gate 不允许直接上线该路径。 |
| 11 | 365 真实/合成上限成本 | 见下方实测。真实 1,045 文件：load 967.16 ms、365 replay+fact projection 277.72 ms、进程 max RSS 201.46 MiB。2,000 full ISO 样本至少 508 秒未完成，RSS 采样 2,124.64 MiB；完整 max RSS、分阶段时间和最终 payload 均未取得，不能填为 PASS。 |
| 12 | switch 重复 Python 吗 | 会重复调用 `getPlayerGrowthOverview`。route range 被 watch，每次 click 重新请求；service 每次调用一次 Overview，正常非 manual binding 再进入 Growth Python。没有跨 range 的 corpus cache。代码证明重复调用路径；本次未创建生产账号实测请求次数。 |
| 13 | switch 重复 replay 吗 | 会。每次 `getSkillPassport` 都调用一次 `getGrowthHistory(...90d...)`，再次 canonical replay。evidence 的 in-flight promise 只去重并发读取，不缓存已经完成的 replay。 |
| 14 | 一次 365 replay 能派生四档吗 | 能。先生成一个 bounded corpus，再按共同截止业务日派生四个 window。共用 measurement series、精选 milestone dictionary 和引用 IDs，range query 仅驱动客户端 projection。当前成本证据支持这个方向，但未实现、未验收最终序列化或客户端内存。 |
| 15 | 2,000 文件 bound 的真实影响 | `loadGrowthScoreEvidence` 对排序后的全部历史名字取最新 2,000，保留 full/delta 顺序；它限制的是文件数，既不保证 365 天也不保证字节数。频繁同步可让 2,000 文件只覆盖短时间；全量快照可以使同一文件数占用大量对象内存。`totalFiles > filesRead` 必须标记 truncated，不能因 UI 选择 365 就宣称完整。合成测试生成 2,001、实读 2,000，truncated=true。 |

## Benchmark 方法与隔离

全部 QA 使用 `scripts/memory/run_qa.sh`，不与 build 并行。Node v24.13.0，heap 1,536 MiB，cgroup MemoryHigh 2 GiB / Max 3 GiB / SwapMax 256 MiB。

真实样本：只读扫描本机 userdata，选择历史文件数最多的目录；调用真实 evidence loader、真实 canonical replay 和 fact projection。没有 DB 连接、没有账号写入，没有复制真实历史或输出用户 ID/曲名/成绩。只保留聚合成本数据。四个范围的 replay 是离线成本比较，绝不意味着产品初载要做四次 replay。

合成上限：2,001 个 full snapshots，每个 500 个 chart，283,107,982 bytes（约 270 MiB）的 JSON 输入，时间跨 365 天，每次只更新一个 chart。分值/计数使用合成数据，fixture 位于 `/var/tmp/growth-temporal-0801/synthetic`。实际 loader 始终只读最新 2,000。

ISO case 在 cgroup 高压下由本次任务停止自己的 QA service，没有扩大限制，也没有绕开隔离重跑。最后一次持久化前的工具采样显示 elapsed=08:28、RSS=2,175,628 KiB、MemoryHigh events=266,584、memory PSI full avg10=45.28%、OOM/oom_kill=0。**RSS 是采样值，不是峰值；该 case 没有完成，不能归因成单纯的 365 replay 时长。** 原脚本仅在整个管线结束后输出结果，没有保留各阶段，所以 load/replay 分阶段数据未知。

对照 case 在已经载入的合成对象中，将 ISO 事件时间转换为语义相同的上海本地时间字符串；保留原文件顺序和 raw revision，再用原有 replay 测 30/90/180/365。这只是隔离日期表示的诊断变量，没有修改原始文件或生产函数；结果不能代替 ISO Gate。

## 成本结果

### 真实只读样本

1,045 available/read/valid snapshots，未截断。load=967.16 ms。进程 max RSS=201.46 MiB（包含四档离线比较与序列化，不能视作单次 endpoint 峰值）。

| 窗口 | canonical replay + fact projection | facts | 原始 facts JSON bytes | 序列化 |
|---:|---:|---:|---:|---:|
| 30 | 190.09 ms | 408 | 256,214 | 0.94 ms |
| 90 | 204.32 ms | 1,493 | 941,915 | 3.57 ms |
| 180 | 227.43 ms | 1,990 | 1,255,179 | 4.84 ms |
| 365 | 277.72 ms | 2,541 | 1,595,770 | 9.98 ms |

原始 facts 只在服务端参与选取，Architecture A 不应把这些完整事实发给浏览器。最终 Passport DTO bytes、measurement rows、period projection、curation、client memory 尚未测量。

### 2,000 full snapshots 对照样本

2,001 available、2,000 loaded/valid、truncated=true。load=7,724.64 ms。进程 max RSS=577.64 MiB。事件日期在内存中转成上海本地表示；ISO 原样 case 仍然失败。

| 窗口 | canonical replay + fact projection | facts | 原始 facts JSON bytes | 序列化 |
|---:|---:|---:|---:|---:|
| 30 | 1,695.39 ms | 161 | 102,872 | 0.37 ms |
| 90 | 2,591.20 ms | 490 | 312,751 | 2.45 ms |
| 180 | 3,748.44 ms | 983 | 627,374 | 3.17 ms |
| 365 | 6,057.59 ms | 1,997 | 1,274,380 | 9.69 ms |

即使日期表示对照能完成，单次 load+365 replay 仍约 13.78 秒，尚未计入 Growth Python。不能称为 initial visible-time 验收通过。

### 日期格式化诊断

`utils/playerGrowth.ts:78` 的 `growthCalendarDay`：本地日期字符串走正则快路径；ISO/Date 走每次新建 `Intl.DateTimeFormat` 的路径。loader 的 observation/day 推导及 replay 的逐 song 时间读取都调用它。百万 chart visits 可反复创建格式化器。

独立进程各跑 10,000 次，输入表示同一上海业务日，结果均为 `2026-10-07`：

| 诊断 | wall time | process max RSS |
|---|---:|---:|
| 原函数，ISO 输入 | 873.21 ms | 334.43 MiB |
| 原函数，本地时间字符串 | 8.28 ms | 63.17 MiB |
| 实验中复用一个 formatter，ISO 输入 | 20.19 ms | 71.60 MiB |

这是具体的优化候选证据，**不是完整 replay 等价性证明或生产修复验收**。snapshot 物料化和 full snapshot IO 仍是独立成本，不能假设 formatter 复用会解决全部问题。

## Architecture A / B 决策

| 维度 | A：单次 365 corpus | B：轻量周期请求 |
|---|---|---|
| 初载 compute | 目标 <=1 | 目标 <=1 |
| measurement | 目标单次 SQL，含每日代表与 coverage | 共用 current/measurement，禁止每次重算 |
| history | 单次 <=365 replay | 请求可做一次 bounded projection，仍须通过对应成本 Gate |
| range click | 0 network / 0 Python / 0 replay | 1 network / 0 Python，须有严格 bounded history |
| payload | 共用 points + dictionary，待实测 | 单周期较小，不能解决 loader/ISO 格式化问题 |
| 当前结论 | 首选方向；性能未通过，未实施 | 不选。没有证据证明最终去重 payload 明显过大；B 同样可能触发 365 的成本失败，不能作为绕过 Gate 的方案 |

选定的是**待验证的 A 优化路线**，不是已经验收的最终架构。先修复有证据的格式化成本，再重新审计 one-pass load/replay；仍超预算才评估轻量索引或增量 cache。未经新审计不建事实表。

## 已完成与未完成

完成：版本链核对、十五项源码审计、四档真实成本比较、2,000-file loader 截断验证、ISO/full 上限失败记录、日期表示对照、格式化热点实验、A/B 对比及可复核替代设计。

未完成：Temporal DTO/页面、四档固定 selector、分段 Rating/六维图、独立 focus、周期节点 curation、composition <30ms、browser matrix、生产账号 smoke、42 项产品验收 PASS。本阶段不能关闭 Temporal UX Closure。

未创建用户、binding、session、Goal、measurement 或 cursor，无新增 DB orphan 类型；未运行生产 mutation。自建 benchmark 进程退出，合成 history 文件已清理，聚合 JSON/日志与可复跑脚本保留在磁盘 `/var/tmp/growth-temporal-0801`。现有用户未跟踪文档保持不变。

## 审计产物

- `/var/tmp/growth-temporal-0801/audit-real.json`
- `/var/tmp/growth-temporal-0801/audit-synthetic-full-bound.json`
- `/var/tmp/growth-temporal-0801/audit-naive-bound.json`
- `/var/tmp/growth-temporal-0801/calendar-{iso,naive,reuse}.json`
- `/var/tmp/growth-temporal-0801/baseline-more.html`
- `/var/tmp/growth-temporal-0801/audit-benchmark.mjs`、`audit-naive-bound.mjs`、`calendar-cost.mjs`
- `/var/tmp/growth-temporal-0801/release-report.md`：42 项回答，明确区分现状、设计与未验收。
