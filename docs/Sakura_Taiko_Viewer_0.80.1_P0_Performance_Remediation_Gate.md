# Sakura Taiko Viewer — 0.80.1 P0 Performance Remediation Gate

**目标：先解除 365 天 Passport 的性能阻断，再恢复 Temporal UX 实现。** 这是供新一轮 Codex 对话使用的独立主控指令。

**实施状态：尚未开始。** 最新已知生产版本为 **0.80.0**；0.80.1 Temporal UX 尚未实施、未验收、未发布。先从代码核对实际 canonical 版本，禁止回退。

## 1. 决策与输入

请先完整阅读仓库中的：

- `docs/growth-passport-temporal-ux-audit.md`
- `docs/growth-passport-temporal-ux-architecture.md`
- 之前的 `Sakura_Taiko_Viewer_0.80.1_Growth_Passport_Temporal_UX_Closure.md`（仓库有该文件时）

审计已确定的证据：

- 真实只读 1,045 snapshots：load **967.16 ms**；365 天 replay + fact projection **277.72 ms**；RSS max **201.46 MiB**（该进程包括四档离线比较）。
- 2,000 full snapshots、local datetime 对照：load **7,724.64 ms**；365 天 replay + projection **6,057.59 ms**；RSS max **577.64 MiB**，**truncated=true**。
- 2,000 full snapshots、原始 ISO datetime：运行 **至少 508 秒**仍未完成，RSS 约 **2.1 GiB（采样，不是峰值）**；存在严重 MemoryHigh / PSI 压力，未取得阶段指标。
- `utils/playerGrowth.ts` 的 `growthCalendarDay`：每次 ISO/Date 调用都可能创建新的 `Intl.DateTimeFormat`。10,000 次 ISO 诊断中，原函数 **873.21 ms**，复用 formatter 实验 **20.19 ms**。实验还**不能**充当全链路等价性验收。
- 现有 2,000 文件边界限制的是**文件数，不是字节数或覆盖天数**。

**结论：保留 Architecture A 为待验证方案；不要为了绕过 Gate 改选 Architecture B，也不要立即建事实表。**

## 2. 本轮范围与绝对边界

本轮只允许进行：

1. 日期格式化热点修复；
2. 日期/业务日/事实语义等价性测试；
3. 可中断、逐阶段 checkpoint 的真实性能基准；
4. 在仍超预算时提交 streaming replay 原型与等价性/成本对比设计（未经 Gate 不替换线上共享链路）。

本轮**不做**：

- Passport UI、30/90/180/365 selector、趋势图和里程碑改动；
- 将公开 Growth History 的 90 天上限改为 365 天；
- 新表、Schema migration、事实物化、隐式持久化缓存；
- Rating/六维/推荐/Goal/Recent/Daily/Weekly 算法或事实规则调整；
- 因性能未达标而直接放宽 cgroup / memory guard；
- 未经授权的生产部署；
- 修改、删除与任务无关的工作区更改。

默认版本维持 **0.80.0**；优化代码是否作为独立维护发布，需在单独发布 Gate 获批后处理。本任务通过性能 Gate 才能继续原定 0.80.1 UX 施工。

## 3. 第一阶段：日期格式化器优化（先修有证据的热点）

### 3.1 允许的最小改动

在 `utils/playerGrowth.ts` 的 `growthCalendarDay` 或其直接依赖处：

- 保留已有上海本地日期字符串快速路径、合法性与 invalid 行为；
- ISO / `Date` 路径复用**固定 `Asia/Shanghai`** 的 `Intl.DateTimeFormat`；
- 非默认 timezone 若不缓存则沿用原语义，若缓存必须设严格有界容量；
- 保留 offset-aware instant → 上海业务日的转换语义；
- **禁止**对 ISO 字符串无条件 `.slice(0, 10)`，`Z` 日期和上海日期会跨日；
- **禁止**将首次调用的运行时 timezone、请求时钟或数据源时间错误地视为固定事件时间；
- **禁止**顺便改动 canonical Growth facts、source provenance、coverage 算法。

### 3.2 等价性 golden matrix

同一个原始输入，优化前/后 output 必须完全一致。至少覆盖：

- `2026-10-07T15:59:59Z`、`2026-10-07T16:00:00Z` 等上海跨日边界；
- `+08:00`、`Z`、其他合法 offset、带毫秒；
- 上海本地 datetime 文本、仅日期字符串、`Date` 实例；
- invalid date、缺失、空字符串、数字/非法类型（严格按旧行为）；
- 闰年 2 月 29 日、跨月/跨年；
- 非 `Asia/Shanghai` timezone（含 DST 变化的 timezone）；
- 同一上海业务日代表 measurement 的取样；
- Goal observation / confirmed / attributed play day 的分离；
- Daily、Weekly、Growth History、Recent、Passport 现有 golden / replay fixtures。

**先保存优化前 golden，再执行变更，不能为了让测试变绿直接更改期望值。**

## 4. 第二阶段：重建可定位瓶颈的基准工具

原 2,000 ISO/full case 超过 8 分钟但没有中间 checkpoint；本轮必须修正测试可观测性。

### 4.1 每个阶段完成即持久化一条小型记录

推荐 JSONL stage events 或按阶段原子写 JSON：

1. enumerating / sorting / applying latest-2,000-file limit；
2. history file loading / JSON parsing / object materialization；
3. provenance + chronology + calendar-day normalization；
4. canonical replay；
5. score / Goal facts projection；
6. period projection / milestone curation（仅纯离线试算，不实现 UI）；
7. payload serialization / byte count（只序列化拟交付的精选结构，而非传全量 raw facts）；
8. finish / early-termination reason。

每一阶段至少记录 wall time、完成状态、loaded/invalid/eligible 文件数、文件总字节数、chart/事实计数、是否 truncated。记录 process max RSS（真正 max，不以单次 RSS 采样冒充）及隔离 cgroup memory.current / memory.peak / high、oom / oom_kill 事件**增量**、PSI。无法观测的项明确 `unknown`。

不得记录真实用户身份、文件内容、曲名、成绩或私有 payload。中断后的最后一个 checkpoint 必须可读。基准必须有超时和高内存压力自动停止机制；只终止本轮自建测试子进程，不干扰生产服务。

### 4.2 输入矩阵

| Fixture | 作用 |
|---|---|
| 真实只读最长 history 样本 | 代表实际生产分布 |
| 2,001 files / latest 2,000 full / **ISO** | 原始失败复现与必须通过的压力用例 |
| 同语义 local datetime 对照 | 定位时间格式表示成本，不替代 ISO Gate |
| full + delta mixed | 保证实际历史拓扑 |
| 无可靠 baseline | 保持 coverage 语义 |
| bad/invalid files | fail-closed 行为 |
| file-count truncated | 不误报完整时间覆盖 |
| 同日多 revision、跨日边界 | 事实/归因稳定性 |

全部使用现有 `scripts/memory/run_qa.sh` 或等价的已批准隔离脚本，不能通过加大内存限制取得 PASS。

### 4.3 结果展示必须区分

- 单次冷载入与 warmed replay；
- 正常真实样本与病理压力样本；
- loader 成本与日期格式化成本；
- raw facts bytes 与最终精选 DTO bytes；
- 完整结束的 max RSS 与未结束的采样 RSS；
- 只完成独立热点测试与完整数据路径验收。

不得用 `0.8s` 的真实样本结论掩盖 `13s` 的 full 压力，也不能把 `formatter` 的微基准提速直接外推为端到端提速。

## 5. Gate 判定与预算

必须先记录实际线上服务器资源、首页/Passport 当前延迟基线，并给出**预先批准**的延迟、内存、IO/PSI 预算；不能看完结果后临时降低标准。至少满足：

- ISO/full 2,000 文件原样 case **完整结束**，不出现持续 PSI / MemoryHigh 高压或 OOM；
- `load + replay + projection` 各阶段性能量化，最终响应字节与序列化实测；
- 真实样本无明显性能回退；
- canonical facts、日期归因、coverage 在所有 golden fixtures 完全一致；
- 生产关键路径的 `current Growth <=1 Python`、`raw-history replay <=1`；
- 365 天上限仍是内部 Passport 路径，不修改 public History <=90 天 contract；
- 若病理数据在批准的预算内不能形成完整投影，必须有**诚实的 partial/truncated/unavailable 表达**及明确设计验收，不能静默丢掉早期事实再声称“365 天完整”。

**若完整 ISO/full case 仍未达到预算：保持 `BLOCKED`，不得靠只看真实样本宣布解封。**

## 6. 第三阶段：若仍太慢，再研究 streaming replay

只在第二阶段表明主瓶颈仍为全量 JSON 物料化/IO/巨大状态重复持有时开启，先在隔离分支制作原型：

```text
bounded ordered file metadata
  → sequential payload reader
  → canonical replay accumulator
  → one <=365-day canonical fact corpus
  → period views + selected milestone dictionary
```

不得按目录遍历顺序消费。必须验证 latest-2000 限制、full/delta、前置 baseline、bestScores、provenance、counter regression、invalid file、factKey、同日去重、Goal 时间语义、current attendance-only 等与现有一次 replay **完全等价**。

原型必须报告与修复后现有 loader 的对照：wall、peak RSS、IO、coverage、facts、响应大小。未经等价性与成本 Gate 批准，不直接替换 Growth History / Daily / Weekly / Recent 共用实现。

索引、增量 cache、物化表仅作为后续可选设计，需要单独审计和明确授权。

## 7. 验收交付

至少提交：

- `docs/growth-passport-365-performance-remediation.md`：根因、改变点、golden 等价、完整成本表、资源事件、最终 PASS/BLOCKED；
- 可重复运行的 benchmark 与逐阶段 checkpoint 脚本；
- 日期处理修复及最小范围的测试；
- 真实样本、ISO/full 2,000、local/full 对照、full+delta、truncated 的原始聚合结果；
- 若未通过：明确定义下一步 streaming / cache 审计范围，而不是发布 UI。

### 必须回答的问题

1. `growthCalendarDay` 具体哪条代码导致高频 formatter 构造？
2. 修复对非默认 timezone、invalid 的行为是否严格等价？
3. ISO/full 2,000 的最后完成 stage 是什么？
4. 真实/ISO/local 三组的各阶段 wall / process max RSS / cgroup 压力事件是什么？
5. loader 与 replay 哪个现在更贵？是否仍反复全量物料化？
6. replay 的 canonical factKey、Goal 时间归因、coverage 是否逐例相同？
7. 365 corpus 最终会传给前端多少字节？是否包含重复事实/series？
8. 初始 Passport 关键路径的 approved latency / memory budget 是什么？
9. 优化后是否能在该预算下完成？
10. 需要 streaming 吗？有没有足够的失败证据支持？
11. 是否保持 public History <=90 天、无新表、无 UI 改动？
12. 是否 `READY FOR 0.80.1 TEMPORAL UX`，还是 `BLOCKED`？

## 8. 阶段状态

**通过时：**

```text
0.80.1 P0 PERFORMANCE REMEDIATION GATE PASS
DATE NORMALIZATION SEMANTIC PARITY ACCEPTED
ORIGINAL ISO/FULL STRESS CASE ACCEPTED
BOUNDED LOAD + ONE-PASS REPLAY COST ACCEPTED
RESOURCE / PSI GATE ACCEPTED
HISTORY AND FACT EQUIVALENCE ACCEPTED
NO PUBLIC HISTORY CONTRACT REGRESSION
READY TO RESUME 0.80.1 TEMPORAL UX
```

**失败时：**

```text
0.80.1 P0 PERFORMANCE REMEDIATION GATE BLOCKED
PRODUCTION REMAINS 0.80.0
NO TEMPORAL UX IMPLEMENTATION
NO 365-DAY MILESTONE RELEASE
NEXT STEP: STREAMING / INDEX ARCHITECTURE AUDIT
```

此阶段通过性能 Gate 才允许接续已经批准的 Temporal UX 设计：四档全局周期、Rating/六维分段趋势、独立 Focus 轨迹、周期内 importance + diversity + time-bucket 成长节点。不要在性能修复轮顺手施工这些 UI。
