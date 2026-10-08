# Growth Passport 365 天 P0 性能整改

日期：2026-10-08（Asia/Shanghai）。开工基线：`85859c4`，canonical Viewer / 生产均为 **0.80.0**。

**最终结论：BLOCKED。日期热点已修复并通过语义等价；原样 ISO/full 用例完整结束，但 12,834.76 ms 超出预先批准的 3,000 ms 历史管线预算。不能恢复 Temporal UX。**

本轮没有 UI、版本、公开 History 上限、数据库、事实规则、Rating/六维/推荐算法或部署修改。隔离分支的 streaming 原型没有替换任何线上共享链路。开工时已有的业务 JSON 和未跟踪文档均保留。

## 预先批准的资源与延迟预算

用户在完整 benchmark 之前明确回复「批准上述预算」。配置保存在 [`growth-benchmark-budget.json`](../taiko_viewer/scripts/performance/growth-benchmark-budget.json)。标准没有根据结果放宽。

| 项目 | 已批准上限 |
|---|---:|
| 365 天 load + replay + projection + selected DTO serialization | 3,000 ms |
| 完整 Passport 初载，包含 Growth Python | 5,000 ms |
| period projection + curation | <30 ms |
| worker process max RSS | 512 MiB |
| 隔离 QA cgroup peak | 1 GiB |
| 一次冷管线选中文件读入量 | 300 MiB |
| 新增 high / oom / oom_kill | 全部 0 |
| memory / IO PSI full avg10 | 不持续 ≥2%；连续 10 秒触发中止 |
| 单用例 watchdog | 60 秒；诊断自测单独收紧至 2 秒 |

线上只读资源基线：物理内存 32,865,886,208 bytes（30.61 GiB），8 CPU，磁盘上的 `/var/tmp`；Viewer MemoryHigh=1.5 GiB、MemoryMax=2 GiB，采集时 memory.current=1,482,448,896 bytes。生产既有 high 累计 78,848，oom/oom_kill=0；**既有累计值不当作本轮增量**。

被动读取近 7 天、最多 4,000 行生产日志，仅保存聚合值，没有账号身份或原始日志内容：

| 当前生产服务 | 样本数 | p50 | p95 | max |
|---|---:|---:|---:|---:|
| Home Growth Overview | 54 | 552 ms | 1,468 ms | 1,911 ms |
| Passport service total | 18 | 602 ms | 2,089 ms | 2,338 ms |

Home Python p95=555 ms；Passport Overview p95=1,254 ms、History p95=805 ms。日志样本可能包括既有 synthetic smoke，不能宣称是独立用户分布或浏览器 visible-time。

匿名线上 `/` 三次 wall=156.61 / 46.91 / 47.85 ms；`/my/growth`=58.24 / 38.08 / 57.39 ms；`/more`=50.96 / 56.27 / 37.51 ms，全部 HTTP 200，首页和 `/more` 确认 v0.80.0。匿名 Passport 页面只测壳，不当作认证后 compute/初载验收。未创建生产账号、未读写生产 DB、未请求会捕获 measurement 的认证 Growth endpoint。

## 根因与最小修复

原 `utils/playerGrowth.ts` 的 `growthCalendarDay` 最后一行，在每次 ISO/Date 调用时执行 `new Intl.DateTimeFormat("en-CA", { timeZone: timezone, ... }).format(date)`。canonical replay 每个 chart 的 highscore/update day，以及部分 before/observation day，都走这条路径；full 压力样本会访问 1,000,000 个 chart rows。

修复只为固定 `Asia/Shanghai` 懒初始化并复用一个 formatter。任意非默认 timezone 仍每次构造，**无任意 timezone cache**。原字符串快路径、String coercion、invalid date 返回、invalid timezone 抛错和 offset-aware instant 的上海跨日语义全部保留。旧函数甚至会原样规范化 `2026-99-99` 这类本地文本；本轮不顺便纠正它。

10,000 次独立 ISO 微基准：旧函数 1,032.91 ms、process max RSS 329.33 MiB；修复后 41.46 ms、67.86 MiB，输出全部正确。约 24.9 倍是**独立热点**结果，不能外推全链路。

修改前已运行 capture，保存 43 个日期输出 golden 和 17 组 Daily/range/score fact 完整结构 SHA-256 摘要，来源固定为 `85859c4`；修改后没有调整期望值。冻结旧函数保存在测试 fixture 中，不参与生产。

## 语义验收

- 修改前原有回归+新 golden：268/268；最终包含 pipeline parity 与 formatter 构造验证：**275/275**。
- 日期覆盖上海午夜前后、毫秒、Z、+08:00、其他 offset、本地 datetime、仅日期、Date、invalid/空/缺失/数字/非法类型、闰日、跨月/年、UTC/Tokyo/London/New York DST。
- 额外跨闰年/DST 对照 1,200 次旧/新调用；宿主 `TZ=UTC`、`TZ=America/New_York` 各 62/62 测试通过。
- 构造计数证明默认 timezone 100 次只构造 1 次，非默认 UTC 10 次新增 10 次；invalid 和本地快路径不构造。
- 五个**实际磁盘 loader** fixture 分别比较旧/新 evidence、chronology、provenance、coverage 元数据、days、Daily、完整事实及 factKey、Goal 匹配、daily measurement representative、segment/focus、Recent boundary 的完整对象摘要：mixed / no-baseline / invalid / boundary / truncated 全同。
- same Shanghai day 最后 measurement 与数值 ID tie-break 保持；Goal observedAt、confirmedAt、attributed play day 分开，未匹配 Goal 不制造游玩日。
- 现有 Goal、Daily、Weekly、History、Recent、Passport、measurement、voice、experience/session golden 回归通过。没有实际数据库测试或新 schema。

## Benchmark 实现与计量口径

[`benchmark-growth-passport.mjs`](../taiko_viewer/scripts/performance/benchmark-growth-passport.mjs) 的每个用例使用独立 worker。父进程每 100 ms 读资源，在 worker 同步 replay 卡住时仍可超时/压力中止；只终止本轮拥有的进程组，必要时升级 SIGKILL，等待退出，清理自己生成的 fixture。

worker 使用真实 evidence loader / canonical replay / projector / 现有 milestone composer。离线 adapter 只注入 userdata 根路径、冻结旧 calendar 或插入计时 hook；anchor 不匹配即失败，不复制业务规则。按阶段 `append + fsync` JSONL，包含运行/完成状态、计数、字节、process OS max RSS、cgroup current/peak/high、pressure、事件增量和 IO 信息。loader 的 read/parse 与 provenance 按文件交错，报告独占累计时间，**不假装是两个先后执行的加载阶段**。

`eligibleFiles` 明确定义为现有 loader 的 Recent L1 observation 数量；它不控制 canonical replay。真实样本为 0 L1，仍按原规则 replay 全部 1,045 valid snapshots。

全部通过 `scripts/memory/run_qa.sh`，High 2 GiB / Max 3 GiB / heap 1,536 MiB，未增大任何 guard、未与 build/deploy 重叠。watchdog 诊断 worker 写 checkpoint 后同步阻塞，父进程约 2 秒以 SIGTERM 中止；最后完成的 `watchdog-probe-checkpoint` 可读，未完成进程的最终 max RSS 正确为 `unknown`，仅保留 OS VmHWM **截至采样时**值。

「cold」指新进程单次 load；没有清除操作系统 page cache，**不声称磁盘冷缓存**。warm replay 只在已加载 evidence 上再 replay 一次，是独立离线诊断，排除在 cold pipeline 时间外；不是产品初载重复 replay。process max RSS 是 OS high-water mark，涵盖 adapter/fixture preparation/cold/warm 整个 worker 截至 finish，不能冒充 endpoint 单次增量。

## 完整成本表

主矩阵窗口截至各自 evidence.toDay；1,045 个真实文件只读，无复制；ISO/full 与 local/full 都生成 2,001 文件，按实际 loader 顺序只读最新 2,000。full 压力输入每文件 500 charts，原始 ISO fixture 与上轮失败生成方法相同。local 对照只改变 song 日期表示，保留同一 instant；它不能替代 ISO Gate。

| 阶段（ms） | 真实 1,045 | ISO/full 2,000 | local/full 2,000 |
|---|---:|---:|---:|
| enumeration / sort / limit | 24.80 | 20.76 | 18.61 |
| 文件读取 / parse / materialization | 283.44 | 2,319.47 | 2,222.60 |
| provenance / chronology / calendar（含 checkpoint 开销） | 248.00 | 2,238.84 | 2,165.93 |
| loader total | 556.24 | 4,579.06 | 4,407.14 |
| canonical replay cold | 290.47 | 8,213.08 | 5,679.60 |
| score projection + 完整事实摘要诊断 | 16.71 | 19.56 | 26.09 |
| 离线四档 projection / 现有 curation | 12.58 | 11.13 | 19.45 |
| selected DTO serialization | 0.08 | 0.08 | 0.10 |
| cold pipeline（含阶段 checkpoint） | **889.53** | **12,834.76** | **10,151.76** |
| raw facts bytes 诊断 serialization，排除 cold 时间 | 5.88 | 4.60 | 8.35 |
| warm canonical replay，无再 load | 255.12 | 8,564.77 | 5,412.32 |

| 输入 / 输出 / 资源 | 真实 | ISO/full | local/full |
|---|---:|---:|---:|
| available / loaded / invalid | 1045 / 1045 / 0 | 2001 / 2000 / 0 | 2001 / 2000 / 0 |
| 选中文件实际读入 bytes | 4,217,804 | 282,969,992 | 273,964,000 |
| chart row visits | 5,539 | 1,000,000 | 1,000,000 |
| facts | 2,541 | 1,997 | 1,997 |
| coverage | complete | truncated | truncated |
| raw facts JSON bytes，未发给前端 | 1,607,679 | 1,284,791 | 1,284,791 |
| 离线 selected DTO bytes | 5,688 | 4,919 | 4,919 |
| OS process max RSS MiB | 200.11 | 416.69 | 414.80 |
| cgroup memory.current 最大采样 MiB，非 peak | 170.19 | 677.76 | 669.22 |
| cgroup kernel memory.peak | unknown | unknown | unknown |
| high / oom / oom_kill 增量 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| memory PSI full avg10 最大采样 % | 0 | 0 | 0 |
| IO PSI full avg10 最大采样 % | 0 | 0 | 0 |
| memory PSI full total 增量 µs | 0 | 21 | 0 |
| IO PSI full total 增量 µs | 14,537 | 19,514 | 17,756 |
| 最后完成 stage | finish | finish | finish |

本机 `memory.peak` 与 `io.stat` 不可读取，逐阶段和聚合均记 `unknown`。**不能以采样最大 current 替代 1 GiB kernel peak 证明，不能以逻辑读入 bytes 冒充物理磁盘 IO bytes**。进程 fsRead/fsWrite operation 另有记录，其中包含 fixture 写入与 checkpoint IO；输入 fixture 的 270 MiB 文件页缓存也可能计入 cgroup。这些可观测性缺口属于最终 Gate 尚未满足的条件。

真实样本按 before/after 交错跑各三次：before=863.46 / 866.48 / 884.79 ms，after=905.33 / 868.78 / 840.78 ms；中位数 866.48 → 868.78 ms（+0.27%），完整 canonical facts 摘要六次相同。未见明显回退，首次主矩阵 1,347.71 ms 的较慢读取保存在原始 artifacts，未删除以挑选结果。

| 小型拓扑 fixture | valid / invalid | coverage | cold pipeline ms | process max RSS MiB |
|---|---:|---|---:|---:|
| full + delta mixed | 40 / 0 | complete | 81.94 | 154.54 |
| 无 full baseline | 40 / 0 | partial | 92.34 | 157.26 |
| invalid JSON / songs=null | 38 / 2 | partial | 64.31 | 158.81 |
| 同日 revisions / UTC 跨日 / regression / manual barrier | 12 / 0 | complete | 51.27 | 157.39 |
| 2001 小文件 / latest-2000 | 2000 / 0 | truncated | 690.99 | 161.10 |

全部完整结束，无新增 high/oom/oom_kill；warm replay 事实摘要相同。完整逐阶段聚合、基线、重复真实样本、诊断和 prototype 比较保存在 [`growth-passport-365-performance-results.json`](growth-passport-365-performance-results.json)。

## Selected DTO 的边界

本轮仅离线试算：一个共享 milestone dictionary + 四档 milestone IDs / boundaries / coverage，使用**原有 latest-8 composer**。没有改变线上或实现新的 importance/diversity/time-bucket 规则；`measurementSeries=[]`，没有生产 Goal SQL、实际 measurement/current/focus/next action，title 使用固定 redacted 文本。

所以 4,919 / 5,688 bytes 是**score milestone 试算结构**的实测大小，绝不是完整 Temporal Passport DTO 的承诺。raw facts 不入 DTO，四档不复制 raw facts/series，dictionary 按 ID 去重。现有生产 Passport 18 个日志样本 bytes 为 635–15,340、p50=9,603；这是旧产品，不是新 365 corpus。

最终 365 Passport response bytes、measurement/Goal 真实查询成本、包含 Python 的改造后初载和浏览器 visible-time仍为 **unknown / 未验收**。不能把当前 empty series 的小 payload 或 <30 ms 旧 curation 当作新设计 PASS。

## Streaming 隔离原型与等价成本

分支：`perf/growth-passport-streaming-prototype`，原型提交 `75177fa`。工作树：`/var/tmp/taiko-growth-streaming-prototype`。只有最终集成者有部署权；本原型不部署、不 merge 到共享服务。

原型对实际 evidence loader 做 test-only source transformation：仍按 fileOrder 排序、latest-2000、逐文件 JSON 读取、原 provenance/state/regression/source barrier；每次 yield 当前 snapshot，并只保留空 songs 的小 metadata / observations。将实际 canonical replay 转成 async 单一 accumulator，保留原 visit、bestScores、observed-before、same-day merge、factKey、current attendance-only 和最后 day projection。请求范围由调用者在 load 前明确给定，**不使用目录遍历顺序或运行时时区冒充事件时间**。

五种磁盘 fixture + 17 组冻结 Daily fixtures 的 streaming 等价测试全部通过。完整真实/ISO/local 三组再与 ordinary loader/replay 比较**完整 score facts（包含 revision/provenance/归因）SHA-256 完全相同**，selected DTO byte count 也相同。

成本对照统一使用显式请求窗口 `2025-10-09..2026-10-08`，因此与主矩阵的 evidence.toDay 窗口相差一天，不能混用 facts 数量：此对照真实 facts=2,480，full facts=1,992。

| 同窗口成本 | ordinary cold ms | streaming cold ms | ordinary RSS MiB | streaming RSS MiB | ordinary / streaming 逻辑读入 bytes |
|---|---:|---:|---:|---:|---:|
| 真实 | 861.17 | 1,017.56 | 202.03 | 200.51 | 4,217,804 / 4,217,804 |
| ISO/full | 13,707.45 | 13,240.47 | 417.03 | 202.51 | 282,969,992 / 282,969,992 |
| local/full | 10,440.27 | 9,972.56 | 413.34 | 198.04 | 273,964,000 / 273,964,000 |

streaming 的 ISO/full cgroup current 最大采样 454.48 MiB（ordinary 678.57 MiB），三个对照均无 high/oom/oom_kill 增量，无持续 PSI 超限；peak/物理 IO 仍 unknown。streaming replay 是 interleaved residual cost，包括 observations/finalization/checkpoint 开销；不能将其当作纯 replay CPU 的精确剖析。warm replay 无法仅从驻留 raw snapshots 重跑，因为原型已释放它们；重新读取的成本不能伪称 zero-load warm。

**Streaming 有充分内存收益证据，但没有延迟 PASS 证据。**仍须遍历百万 full chart rows，日期转换与 canonical visit 成本未消失；现 loader 全量持有约百万 song objects，现 replay 又扫描它们，streaming 降低持有量而不能自动省掉读取/解析/visit。不能把“streaming”当作 3 秒修复的结论。

## 下一步审计范围与诚实的降级设计

保持 Architecture A 为待验证方向，不改选 B，不建事实表。

1. 单独归因 sequential read/JSON parse、provenance fields、每 chart calendar conversion/epoch/visit、range 最后 days×charts projection；量化 CPU、物料化次数、IO。优先确认重复 full chart 的日期规范化/不变状态比较成本。任何 per-request bounded memoization 或 changed-row skip 必须验证旧逻辑仍会更新 revision/observation、bestScores、same-day attribution，不能仅凭 score 相同跳过。
2. streaming 若作为生产候选，新增 owner/binding lifecycle、input fingerprint/并发文件变更、异常关闭/abort、malformed-row 和 file-size/admission 限制审计。当前原型是静态输入 benchmark，不具备生产 snapshot isolation / cancellation 接口；async accumulator 也不是同步 `deriveDailyProgress` 的接口替代，仅 `streamGrowth` 是原型调用入口，不能直接替换 Daily/Weekly/Recent/History。
3. 审计“一 corpus 派生 Daily + Passport”的服务收口。当前 Passport 顺序调用 Overview（内部已有 Daily replay）再调用 History（另一次 replay），旧 evidence 的 in-flight 去重不缓存已结束的加载，正常非 manual 路径会两次 load / replay。当前 Python 源码调用至多一次；raw replay 的目标 <=1 尚未实现。必须经独立范围批准后解决，不能在本轮改共享业务链路。
4. 如讨论 index/cache，另行审计 fingerprint、容量、失效、schema/生命周期与 facts 等价，明确授权后再实现；没有隐式持久化 cache。

拟交付 coverage/state 设计，**尚未线上实现或获得设计验收**：有可靠 full baseline、无坏文件/截断才 complete；无 baseline/坏文件为 partial；latest-2000 抛弃较早文件则 truncated 优先，不保证天数；超 byte/time/memory budget 或中断为 unavailable，不返回空 milestones 冒充 complete，不沿用旧数据声称全年完整。产品上线前必须批准这些状态以及用户可理解的披露。当前 fixture 保持原 canonical coverage，不制造新事实。

## 主控文档十二项回答

| # | 结论 |
|---:|---|
| 1 | 原 `growthCalendarDay` 最后一行每次 `new Intl.DateTimeFormat` 是热点。 |
| 2 | 非默认 timezone 不缓存；invalid/coercion/fast path 严格保留，golden/legacy 对照通过。 |
| 3 | 原样 ISO/full 2,000 最后完成 stage=finish；13 秒级，仍超预算。 |
| 4 | 真实/ISO/local 分阶段 wall、真实 OS max RSS、cgroup events 增量和 PSI 如上及原始聚合 JSON；peak/物理 IO unknown。 |
| 5 | ISO replay 8,213 ms > loader 4,579 ms；全量物料化与百万 chart visits仍存在。 |
| 6 | frozen golden、五组 loader 前后 parity、Goal 时间语义/measurement/coverage均通过；完整 prototype 三组事实摘要亦同。 |
| 7 | 离线 selected DTO=5,688 / 4,919 bytes，仅 dictionary/period IDs，无重复 raw facts/series；完整 365 前端 DTO未知。 |
| 8 | 历史管线 3 秒，含 Python 初载 5 秒，512 MiB worker / 1 GiB cgroup；其余批准预算见配置。 |
| 9 | 不能：ISO/full 12.83 秒、local/full 10.15 秒；完整 Passport/Python/DTO 与 kernel peak未验收。 |
| 10 | streaming 可降低 full memory约一半，但 ISO仍13.24秒。需要继续 replay/normalization/index 架构审计，不能声称 streaming本身能放行。 |
| 11 | public History <=90 保持，无新表、无 UI、无发布。365仅本轮离线内部试算，没有新增线上365路径。 |
| 12 | **BLOCKED；不是 READY FOR 0.80.1 TEMPORAL UX。** |

## 可复跑与产物

在仓库根目录，使用 Node v24.13.0：

```bash
bash scripts/memory/run_qa.sh /www/server/nvm/versions/node/v24.13.0/bin/node \
  taiko_viewer/scripts/performance/benchmark-growth-passport.mjs \
  /var/tmp/growth-p0-rerun real iso-full local-full mixed no-baseline invalid boundary truncated
```

超预算时工具保存全部结果并以 2 退出；并非部署失败，更不能 fallback 绕过 runner。复跑输出目录应新建，JSONL 使用 exclusive creation 防止覆盖或拼接旧结果。`--before real` 只用于真实样本的冻结旧函数对照；不重启旧的 ISO/full 高压失败测试。`--watchdog-probe` 仅测中止协议。

在 prototype 工作树同样通过它的 `scripts/memory/run_qa.sh` 执行相同命令，加 `--streaming`；不加该参数是同固定窗口 ordinary 对照。安装依赖按仓库惯例，本机用已有 node_modules symlink，不纳入 Git。

原始聚合/checkpoint/回归日志在磁盘 `/var/tmp/growth-p0-0800`，包括 `matrix-v1`、`matrix-final`、`real-{before,after}-{1,2,3}`、`stream-v1`、`prototype-ordinary-final`、`watchdog-final`。合成大输入已清理，真实历史未复制/修改。无自建 dev server/browser/build；QA service 与 worker 已退出。

```text
0.80.1 P0 PERFORMANCE REMEDIATION GATE BLOCKED
DATE NORMALIZATION SEMANTIC PARITY ACCEPTED
ORIGINAL ISO/FULL STRESS CASE COMPLETED — LATENCY NOT ACCEPTED
PRODUCTION REMAINS 0.80.0
NO TEMPORAL UX IMPLEMENTATION
NO 365-DAY MILESTONE RELEASE
NEXT STEP: REPLAY / NORMALIZATION / STREAMING / INDEX ARCHITECTURE AUDIT
```
