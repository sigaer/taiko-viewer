# Growth History Read Model：成本、资源及容量账本

日期：2026-10-08（Asia/Shanghai）。**Phase 1 提前 BLOCKED；没有 read-model benchmark。以下严格区分本轮诊断实测、既有 P0 实测、未来架构假设。**

[审计](growth-history-read-model-audit.md) / [架构](growth-history-read-model-architecture.md) / [决策](growth-history-read-model-decision.md)。

## 1. 原 Gate 与旧管线实测

已批准配置仍为 [growth-benchmark-budget.json](../taiko_viewer/scripts/performance/growth-benchmark-budget.json)：history pipeline≤3,000ms；完整 Passport（含 Python）≤5,000ms；composition<30ms；worker max RSS≤512MiB；QA peak≤1GiB；冷读≤300MiB；新增 high/oom/oom_kill=0；memory/IO PSI full avg10≥2% 连续10s中止；单案例 watchdog60s。**没有放宽或改配置。**

下表全部引用 [P0 report](growth-passport-365-performance-remediation.md) / [P0 results](growth-passport-365-performance-results.json)，不是本轮重新测得的索引成本。Cold 指 fresh process，未 drop OS page cache。

| P0 阶段 / 资源 | 真实只读 1,045 文件 | ISO/full 2,000×500 | local/full 对照 |
|---|---:|---:|---:|
| enumerate/sort/limit ms | 24.80 | 20.76 | 18.61 |
| loader total ms | 556.24 | 4,579.06 | 4,407.14 |
| canonical cold replay ms | 290.47 | 8,213.08 | 5,679.60 |
| projection + 事实摘要 ms | 16.71 | 19.56 | 26.09 |
| 四档旧 curation ms | 12.58 | 11.13 | 19.45 |
| selected DTO serialization ms | 0.08 | 0.08 | 0.10 |
| cold pipeline ms | 889.53 | **12,834.76** | **10,151.76** |
| selected input bytes | 4,217,804 | 282,969,992 | 273,964,000 |
| parse 次数 / valid snapshots | 1,045 | 2,000 | 2,000 |
| chart row visits | 5,539 | 1,000,000 | 1,000,000 |
| emitted facts / coverage | 2,541 / complete | 1,997 / truncated | 1,997 / truncated |
| facts JSON bytes | 1,607,679 | 1,284,791 | 1,284,791 |
| score-only selected DTO bytes | 5,688 | 4,919 | 4,919 |
| process OS max RSS MiB | 200.11 | 416.69 | 414.80 |
| cgroup current 最大采样 MiB（不是 peak） | 170.19 | 677.76 | 669.22 |
| cgroup kernel peak / physical io.stat | unknown | unknown | unknown |
| high/oom/oom_kill delta | 0/0/0 | 0/0/0 | 0/0/0 |

旧 streaming 原型 `75177fa`：ISO/full约13,240ms、RSS约203MiB，仅是内存收益，不是3秒 Gate PASS。也不是本轮 read-model prototype。

P0 score-only DTO 使用空 measurement/无真实 Goal SQL/旧 latest-8 composer；不能当完整新 Passport payload 或 time-bucket curation 的承诺。

## 2. 本轮 writer-gate 诊断

执行（cwd=仓库根）：

```bash
bash scripts/memory/run_qa.sh /usr/bin/timeout --signal=TERM --kill-after=5s 60s \
  /www/server/nvm/versions/node/v24.13.0/bin/node --experimental-strip-types \
  --test --test-concurrency=1 taiko_viewer/tests/growthReadModelPreflight.test.mjs
```

最终 12/12 PASS，无 skipped/失败；Node runner 总时长 1,556.58ms，诊断模块内 1,022.54ms。OS process max RSS=219,041,792 bytes（208.89MiB），末尾 heapUsed=81,560,672、external=2,994,441、arrayBuffers=478,579 bytes。每案例只用 1–3 个 tiny 合成 JSON，serial，目录在 finally 删除。这里只复现 source 中间边界，**没有新的 fact store、增量 writer 或生产请求**。

| 诊断 | 案例 ms（含 TS adapter / 文件准备，非 API 延迟） | 结论 |
|---|---:|---|
| full-field golden + repeated replay | 258.29 | 全字段 digest `99097cddf469163a033a862c8e6c921927e10d1fec01bb9fce51f86021efb40e` |
| partial overwrite | 87.43 | 写中 invalid=1，写完=0 |
| C publication / H gap | 96.82 | JSON 有效仍缺 PB，current 单独无法恢复 |
| same-size + mtime overwrite | 70.14 | stat 不变，revision 及完整 facts 变 |
| destructive batch gap | 61.70 | 空/partial 目录均可 parse，但事实丢失 |
| mutation / successor bestScores | 78.31 | 后续 full 不能截断影响 |
| current revision overlay | 60.10 | H 完全相同，完整 facts 仍变 |
| 0 成绩变化的 full observation | 60.21 | factKey/数量不变，observedAt 和全字段仍变 |
| catalog input | 52.08 | factKey 同，title 不同 |
| filename / observation ordering | 51.81 | 两套顺序不能互换 |
| no-baseline / import | 42.91 | 不制造 PB，不升级 L1 |
| 30/90/180/365 canonical filtering | 58.57 | 仅 tiny 样本，非 read-model parity |

pre/post cgroup current=88,424,448 / 185,663,488 bytes；memory.events high/oom/oom_kill 增量=0；pre/post memory/IO full avg10 均 0。full total 增量 memory=610µs、IO=726µs。**只有 pre/post 两次采样，不声称连续压力监测或 peak 合格**。memory.peak/io.stat 不可读，均 unknown。数据在 `/var/tmp/taiko-bounded-qa/growth-read-model-preflight.json`（0600）。

另外原有 Growth semantic/API/golden 回归 **242/242 PASS**（21 个文件、serial、60s timeout、同 QA wrapper），耗时 10,704.33ms。覆盖 Daily/replay/calendar/pipeline/History/measurement/Weekly/Passport/Recent/session/voice/experience/refresh/loading；没有 SQL integration 或生产 DB。此前 P0 的 275 项与本轮 242 项集合不同，不把它们合并成新的 275 项结论。

## 3. 本轮被动生产基线

复用已有 `growth-resource-baseline.mjs`，经 QA wrapper/60s timeout 执行；2026-10-08 12:01（Asia/Shanghai）。只匿名 HTML 请求与最多 4,000 行既有 journal 的**内存内聚合**，没有认证 Growth GET（其可能写 measurement）、DB 连接或 userdata 读取。

- 首页和 `/more` 都确认 **v0.80.0**；三次各 HTTP 200。首页 wall=158.49/48.42/54.47ms；`/my/growth` 匿名壳=33.96/31.48/31.48ms；`/more`=38.64/28.02/35.08ms。这些不代表认证产品初载。
- 单 Node 生产服务仍 active，MemoryHigh=1.5GiB、MemoryMax=2GiB；memory.current=1,608,986,624 bytes。历史 high 累计 102,254，oom/oom_kill=0；累计 high 不能当本轮新增事件。
- 被动 Home logs N=56，total p50/p95/max=552/1,468/1,911ms；Python p95=544ms。
- 被动 Passport logs N=16，total p50/p95/max=617/2,089/2,338ms；history p95=805ms、measurementQuery p95=2ms；payload p50=9,644、max=15,340 bytes。
- 日志样本可能含过去 synthetic smoke，不是独立用户统计；当前产品的 90d score history 也不代表未来 365d index 成本。
- production kernel peak 仍 unknown，未采连续 PSI；只作本轮资源背景，不是新 Gate 证据。

聚合 artifact：`/var/tmp/growth-read-model-p1-baseline/resource-baseline.json`，无原始 journal/身份信息写盘。

## 4. P1 四条路径成本状态

| 路径 | 文件/stat/open/read、bytes、parse、CPU | p50/p95/max / RSS / peak / PSI | ready 或 dirty 时长 | 结论 |
|---|---|---|---|---|
| read-model full rebuild | unknown；P0 的 282.97MB/2,000 parse/1m visits 仅是原 canonical 成本参考 | unknown；新 fact 写入/hash/checkpoint 未测 | unknown | 未运行：Phase 1 source Gate blocked |
| append 0/1/5/50/500 charts | 全部 unknown；0 变化也可能改 source/provenance/current revision | 全部 unknown | unknown | 不能用 O(Δ) 模型冒充实测 |
| clean indexed 30/90/180/365 query | unknown；假设日桶 O(K)，全 JSON 则 O(F) | cold/warm/p50/p95/payload 全 unknown | unknown | 没有 index，不报告命中延迟 |
| dirty/rebuild/query race | 诊断证明现 source 中间状态；没有 index race 结果 | unknown | unknown | 未实现 generation/status/lease，不宣称 PASS |

read-model 多 binding 并发初始化、worker single-flight、数据库锁成本、索引 bytes/fact、网络/Python/Goal/measurement 总成本，全部 unknown。按 §36 提前停止是未跑这些的原因，不能写“跳过 ISO 上限后完成 P1”。

## 5. 容量与写放大模型（全是假设）

P0 平均 facts JSON 约 633–643 bytes/fact；容量草案取 **700 bytes/fact** 留有限结构余量，这不是新 schema 实测。chart state/checkpoint 基础取 0.5MiB，manifest 16KiB；另给未 finalize 的日/谱面 accumulator 预留约一份 fact bytes（checkpoint 必须保留，不能只存已 finalize facts）。这些是敏感性系数，必须实测替换。

三类 binding 假设：低频 104 observations/年、200 facts/年；常规 730/年、2,000 facts/年；高频 7,300/年、20,000 facts/年。并非由一个真实 profile 推广出的分布；历史同日合并及其他 fact 数会改变系数。

`单 generation≈2×F×700 + 524,288 + 16,384 bytes`；以下十进制 GB/TB。

| 活跃度 | 单代 MB | 1k bindings | 10k | 100k | 每 binding fact+accumulator 月增量 MB |
|---|---:|---:|---:|---:|---:|
| 低频 | 0.821 | 0.821GB | 8.21GB | 82.1GB | 0.0233 |
| 常规 | 3.341 | 3.34GB | 33.4GB | 334GB | 0.2333 |
| 高频 | 28.541 | 28.5GB | 285GB | 2.85TB | 2.3333 |

保留 current+last verified 为约 2 倍，正在构建第三代临时空间约 3 倍；备份不含在表内。manifest/current hash/source journal/invalid 输入/文件系统 inode 额外占用 unknown。月增长只算前期新增 facts，365d 滚动删除是另一个 GC/来源合同，不能自行默认淘汰。

**若 A 朴素整文件代重写**：即使一次只改 1 fact 也需写 F+S。按上述期末代大小、均匀同步估算，每 binding 每月写入低频约 7.1MB、常规 203MB、高频 17.4GB；100k 高频约 1.74PB/月逻辑写入，不含临时/备份/fsync 放大。必须测试日桶/分块 checkpoint 等写放大策略；当前没有数据支持直接选择 A 整文件方案。

DB 候选若每 fact 取 700 bytes 再假设 2 倍 row + index overhead，事实部分约 280KB/2.8MB/28MB 每 binding，再加 checkpoint 和 generation。**2 倍是情景系数，非 MySQL 实测**；redo/binlog、事务冲突、旧代保留与 idempotent upsert 全部待测。DB 不能自动修复 source 原子性。

队列：仅用 P0 12.83476s 估算一个 worker 全员首建，1k≈3.57h、10k≈35.65h、100k≈14.86d；不含新的 index IO/Python/排队/限流/压力中止，故不构成吞吐承诺。普通同步复用 index 后可减少重建，但 admission 依然必须跨进程，不能把 13 秒×N 塞入 Web worker。

规划起点：一个隔离 builder、binding/source 去重、有界队列、逐任务 headroom 检查、超时退避；不得因队列长而提高资源并发。排队上限与最长 building 时长尚待工作量分布实测，见预算提案。

## 6. 后续 benchmark 必须采集

Source Gate 解除后才能继续原计划：冻结全字段 golden，24 类 topology/mutation/identity/crash fixtures，实际 ISO/full 2,000×500（相同 282.97MB 级输入）、local/full、真实只读 aggregate、full/delta、四档 clean query、0/1/5/50/500 append、多 worker 及多用户。

复用 P0 parent watchdog 与 checkpoint，另外计 source verification、read 次数/bytes/parse、canonical visits、checkpoint/fact store 写入 bytes/时间、commit validation、curation/serialization、payload、cold/warm/p50/p95/max、first ready/dirty 时长、worker RSS/heap/external/arrayBuffers、cgroup kernel peak/events/IO/连续 PSI。不能用采样 current 冒充 peak；权限不足为 unknown 且 Gate 未验收。所有大文件放磁盘 `/var/tmp`，全部 finally cleanup，无 build/deploy 重叠。
