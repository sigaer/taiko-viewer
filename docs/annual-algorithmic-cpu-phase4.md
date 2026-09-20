# Annual Algorithmic CPU Optimization — Phase 4

Status: **ANNUAL ALGORITHMIC CPU PHASE 4 — READY**

- Canonical baseline: `17ba810` (`9.61.12`)
- Canonical final: `c6d1cb7` (`9.61.13`)
- Algorithm: `annual-observation-v4.5.1`（未变）
- Production runtime: 未同步；仍保持 Phase 4 前版本
- Viewer: 无源码变更、无版本升级、无部署
- Evidence root: `/var/tmp/annual-performance-phase4/`

## Baseline

Phase 4 使用 Phase 1/2 的 frozen fixture、独立 normalized cache、轻量 Annual CLI；不清 page cache 或 swap。主要账号各串行运行 5 次，median 如下。

| Account | Wall | User CPU | Sys CPU | ru_maxrss | PSS | RssAnon | Major faults | SHA-256 |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| small `1322664` | 0.497s | 0.296s | 0.040s | 48.5 MiB | 45.4 MiB | 44.3 MiB | 0 | `36551f…` |
| median `27214979` | 0.760s | 0.601s | 0.072s | 52.7 MiB | 46.2 MiB | 46.8 MiB | 0 | `4f0058…` |
| `91899919` | 7.473s | 7.029s | 0.248s | 77.9 MiB | 65.8 MiB | 65.0 MiB | 0 | `fc18fe…` |
| fresh largest-input | 25.970s | 25.043s | 0.748s | 63.2 MiB | 60.4 MiB | 59.6 MiB | 0 | `7f298e…` |

Baseline manifest: `/var/tmp/annual-performance-phase2/phase4-baseline5/manifest.json`.

## CPU call graph

Baseline `cProfile` 的主要业务热点如下；self/cumulative 单位均为秒。完整 pstats 位于 `profile-baseline/*/profile.pstats`。

| Account | Function | Calls | Self | Cumulative |
|---|---|---:|---:|---:|
| 918 | `load_snapshot_history` | 1 | 0.552 | 7.827 |
| 918 | `build_observation_events` | 1 | 0.438 | 3.845 |
| 918 | `canonical_json_bytes` | 195,294 | 0.184 | 2.560 |
| 918 | `load_json` | 473 | 0.004 | 2.498 |
| 918 | JSON `raw_decode` | 477 | 2.296 | 2.296 |
| 918 | `_song_values` | 279,046 | 0.197 | 2.328 |
| 918 | `_song_values` dict comprehension | 279,046 | 1.296 | 2.131 |
| 918 | JSON `iterencode` | 195,310 | 1.655 | 1.655 |
| 918 | `song_key` | 689,674 | 0.676 | 1.121 |
| 918 | `safe_int` | 4,285,724 | 0.758 | 0.758 |
| largest | `load_snapshot_history` | 1 | 2.215 | 29.233 |
| largest | `canonical_json_bytes` | 762,562 | 0.732 | 10.121 |
| largest | `load_json` | 1,863 | 0.014 | 9.863 |
| largest | `build_observation_events` | 1 | 1.199 | 9.084 |
| largest | JSON `raw_decode` | 1,867 | 8.829 | 8.829 |
| largest | `_song_values` | 787,566 | 0.545 | 6.626 |
| largest | JSON `iterencode` | 762,578 | 6.290 | 6.290 |
| largest | `_song_values` dict comprehension | 787,566 | 3.687 | 6.081 |
| largest | `song_key` | 1,934,005 | 1.932 | 3.114 |
| largest | `safe_int` | 11,787,830 | 2.065 | 2.065 |

结论：优化目标应是 snapshot signature 和 transition value materialization；JSON decode 仍是主要固定成本，但按 scope 不更换 parser，也不新增 persistent metadata contract。

## Signature

保留的实现使用 `marshal` 生成 process-local、equality-only token。token 相等时可安全复用已有 canonical bytes；token 不同时仍执行原 canonical JSON 比较，因此 mapping order、对象共享方式、数字类型及特殊浮点不会导致假相等。该 token 不持久化、不作为业务 fingerprint、也不进入输出。

短历史复用率不足，额外 fast serialization 反而可能抵消收益，因此仅在去重后的 plan 至少 50 个 snapshot 时启用；small/median 保持原 canonical 路径。阈值只选择 equality strategy，不改变 replay 语义。

| Account | Canonical calls old → new | Canonical bytes old → new | Signature CPU old → new | Reduction |
|---|---:|---:|---:|---:|
| `91899919` | 192,620 → 3,585 | 64,559,240 → 1,205,779 | 1.667s → 0.534s | 68.0% |
| largest | 762,560 → 4,602 | 260,562,028 → 1,356,913 | 7.248s → 2.187s | 69.8% |

New signature CPU 包含 fast token 与 canonical fallback；两个账号均超过 30% gate。JSON parse 次数保持 477/477 与 1,867/1,867。

## Replay

Full snapshot 循环已经记录新增和修改 chart，旧代码随后又对 previous/current key union 做全图 Python 比较，仅为了补齐删除项。最终实现将末尾工作缩减为 `previous.keys() - current.keys()`，只补删除 key。

- 24-account serialized equivalence: 24/24。
- 相对 signature-only 候选，5-run median user CPU：918 再降约 6.1%，largest 再降约 5.9%。
- `deepcopy` 次数不变：918 为 259,235，largest 为 266,478；没有通过复制换 CPU。
- retained history、snapshot ordering、lineage、full/delta、dedup 与 `changed_keys` 语义不变。

## Events

Event builder 原本已经是一次 history traversal，不存在多个 detector 分别扫描 history 的结构，因此 history scan 保持 1 → 1。优化点是同一 transition 内共享派生值：

1. 不可比较的 source/lineage transition 只读取 stage/score 以重置 counter epoch。
2. 正常 transition 先计算 stage/score counter delta。
3. 只有 manual change 或确实生成 anomaly/play/high-score event 时，才物化完整 fixed-order tuple 和 `before`/`after` dict。

| Account | Event CPU old → new | Reduction | Full value extraction old → new | Counter-delta calls |
|---|---:|---:|---:|---:|
| `91899919` | 3.770s → 3.015s | 20.0% | 279,046 dicts → 152,509 tuples + 3,573 dicts | 3,420 → 3,420 |
| largest | 8.833s → 2.350s | 73.4% | 787,566 dicts → 0 tuples / 0 dicts | 0 → 0 |

Event order、timestamp、first-record、same-day order、observed/inferred distinction、highscore/update time、delete/re-add 与 breakthrough evidence 均未修改。

## Stage benchmark

下表为相同 bounded lightweight runner 的一次 stage attribution；单位为秒。Pass 1 对应 source discovery + raw snapshot load，ordering 单列；replay、events、summary 与 serialization 来自 profile stage marker。

| Account | Stage | Baseline | Final | Change |
|---|---|---:|---:|---:|
| 918 | Pass 1 | 2.005 | 1.835 | -8.5% |
| 918 | ordering | 0.017 | 0.017 | neutral |
| 918 | replay | 3.943 | 2.265 | -42.6% |
| 918 | events | 1.114 | 0.707 | -36.5% |
| 918 | summary | 0.366 | 0.373 | neutral |
| 918 | serialization | 0.077 | 0.090 | noise |
| largest | Pass 1 | 8.081 | 7.733 | -4.3% |
| largest | ordering | 0.018 | 0.017 | neutral |
| largest | replay | 15.378 | 9.783 | -36.4% |
| largest | events | 2.686 | 0.666 | -75.2% |
| largest | summary | 0.202 | 0.201 | neutral |
| largest | serialization | 0.021 | 0.021 | neutral |

## Work accounting

| Work | 918 old → new | Largest old → new |
|---|---:|---:|
| Raw payload peak alive | 1 → 1 | 1 → 1 |
| JSON parses | 477 → 477 | 1,867 → 1,867 |
| Signature candidates | 192,620 → 192,620 | 762,560 → 762,560 |
| Canonical recomputations | 192,620 → 3,585 | 762,560 → 4,602 |
| Signature reuses | 0 → 189,035 | 0 → 757,958 |
| History scans | 1 → 1 | 1 → 1 |
| `build_song_map` calls | 213 → 213 | 312 → 312 |
| Counter transition comparisons | 3,420 → 3,420 | 0 → 0 |
| Deepcopy calls | 259,235 → 259,235 | 266,478 → 266,478 |
| Retained history peak | 210 → 210 | 866 → 866 |

Replay did not introduce full raw payload retention, history compaction, new persistent cache metadata, or probabilistic equality.

## Equivalence

- Frozen 24-account corpus: **24/24 serialized SHA-256 identical**.
- Main performance accounts: all baseline/final runs identical; hashes are `36551f…`, `4f0058…`, `fc18fe…`, `7f298e…`.
- Synthetic baseline/final history+event hash: `90a969b6ec6adb19c48bb68674041ee402e1290b986a85f8e6644eee525a9c9d`.
- Synthetic cases: delete/re-add, source switching, same-time full/delta, lineage change, first-record, annual boundary, large integer, Unicode, and a 52-snapshot fast-path edge case covering key order, int/float distinction and `-0.0`.
- Focused suite parity: final and `17ba810` both produced 64 pass / 4 pre-existing failures / 1 deselected. Existing failures are the Phase 1 cache-hit expectation and three hand-built event fixtures that omit `changed_keys`; the separately recorded deleted/re-added expectation remains deselected. No test was changed to obtain parity.
- Syntax: `py_compile`, `compileall`, and `git diff --check` passed.

## Performance

Final comparison used five baseline/final runs per account, alternating variant order. Manifest: `/var/tmp/annual-performance-phase4/final-alternating5/manifest.json`.

| Account | Wall baseline → final | Wall change | User baseline → final | User change | Sys baseline → final |
|---|---:|---:|---:|---:|---:|
| small | 0.520s → 0.510s | -1.8% | 0.309s → 0.317s | +2.5% / noise | 0.048s → 0.053s |
| median | 0.757s → 0.758s | +0.1% / neutral | 0.585s → 0.587s | +0.3% / neutral | 0.072s → 0.064s |
| `91899919` | 7.896s → 6.022s | **-23.7%** | 7.563s → 5.604s | **-25.9%** | 0.280s → 0.268s |
| largest | 25.809s → 18.269s | **-29.2%** | 24.889s → 17.447s | **-29.9%** | 0.768s → 0.728s |

918 达到 `<6.5s` 参考目标，largest 达到 `<22s` 参考目标；主要 CPU workload 的整体 user CPU 改善超过 15%。

## Memory

交替 benchmark median：

| Account | ru_maxrss baseline → final | PSS baseline → final | RssAnon baseline → final |
|---|---:|---:|---:|
| small | 48.5 → 48.5 MiB | 43.5 → 45.5 MiB | 42.3 → 44.3 MiB |
| median | 52.6 → 52.7 MiB | 47.9 → 47.3 MiB | 47.0 → 46.2 MiB |
| `91899919` | 83.5 → 74.4 MiB | 76.9 → 69.6 MiB | 76.1 → 68.6 MiB |
| largest | 63.0 → 63.5 MiB | 54.5 → 59.3 MiB | 53.5 → 58.3 MiB |

Largest PSS/RssAnon 增加约 8.9%，低于 15% soft gate；ru_maxrss 仅 +0.8%。918 的三项 memory 指标均下降。所有运行 swap peak 为 0，raw payload peak alive 保持 1。

## Concurrency 2

只重测 N=2，没有测试 N=3：

- Accounts: `91899919` + fresh largest-input。
- Max active: 2；overlap sample ratio 39.4%。
- Aggregate: 20.76s；throughput 5.78 jobs/min；max job wall 20.55s。
- Worker hashes、schema v4、algorithm `annual-observation-v4.5.1`: 2/2 valid。
- Worker `memory.high/max/oom/oom_kill`: 全部 0。
- Host MemAvailable minimum: 15,601,196 KiB；memory PSI full avg10 max 0%；OOM kill delta 0。
- Viewer HTTP: 20/20 success；average 31.5ms，max 52.2ms。

最终并发建议不变：generator 2、renderer 1；不提高到 3。

## Rejected candidates

纯 Python 递归 exact deep equality 曾作为第一个 signature prototype：canonical calls/bytes 降低超过 98%，但递归 equality 在 918 profile 中累计 5.45s。五次 benchmark 显示 918 wall/user 分别回退约 3.4%/5.3%，只有 largest 改善约 5.8%/5.5%，不满足 stable CPU gate，因此已完整撤回。

未实施：stdlib JSON parser replacement、persistent pass-1 metadata contract、history compaction、Rust/native production integration、sorted-key metadata、online-only event aggregation。这些要么超出 Phase 4 scope，要么没有 profiler 证据支持复杂度。

## Decision

**ANNUAL ALGORITHMIC CPU PHASE 4 — READY**

依据：exact equivalence、signature CPU gate、event CPU gate、overall CPU target、memory guard、raw payload streaming invariant 与 N=2 bounded retest 全部通过。Canonical 已提交并推送；production runtime 未同步，等待独立 rollout review。Phase 2 history compaction、native integration 与 concurrency 3 均未开始。
