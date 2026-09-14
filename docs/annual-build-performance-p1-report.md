# Annual Build Performance P1 Report

P1 目标：只优化 snapshot replay/state rebuild 与 observation event construction。FinalTitle、narrative、UI、polling、cache semantics、schema、Algorithm Version、Python worker 架构和部署流程均未修改。

代码提交（本地、未推送）：`fdaf28e 9.60.0 优化年度总结快照回放与事件构建性能`。运行中的 `/home/sigaer/taiko` 未改动，因此没有部署或服务重启。

## 1. 实施内容

修改文件（Sakura_bot/taiko）：

- `plugins/utils/annual_summary/snapshots.py`
- `plugins/utils/annual_summary/events.py`
- `plugins/utils/annual_summary/model.py`
- `tests/test_version_summary.py`（增加 `changed_keys` 内部提示的断言）

### 优化一：branch/chart signatures + copy-on-write

原实现对每个 retained snapshot 都执行完整 state 的 canonical JSON + SHA-256，并在 full snapshot 中复制全部谱面对象。现在：

- profile/achievement/dojo 使用 branch-level canonical signatures；
- song 使用 chart-level canonical signatures；
- unchanged detection 只比较受影响 branch/chart 的 signature；
- full snapshot 对 signature 未变的 chart 复用既有不可变对象；
- delta 对内容未变的 chart 不再 deepcopy；
- 原有 state 输出结构、对象内容、排序和 warning 语义不变。

这不是删除 deepcopy；后续 state 仍构造独立的 profile/achievement/dojo 分支，变化的 chart 仍复制。

### 优化二：replay change-set 复用

`RebuiltSnapshot` 新增仅供内部使用的 `changed_keys`。replay 在应用 full/delta 时记录相对前一 retained snapshot 改变的 chart key；events：

- comparable transition 只遍历 `changed_keys`；
- source/identity/manual transition 仍遍历完整 current map，以保留 epoch reset 语义；
- 相邻 transition 复用 previous song map，不再重复构造 previous map。

没有删除 first-seen、counter regression、source switch、manual adjustment 或 archive-only 分支。

## 2. 一次性 hot-path measurement（修改前，账号 2258735）

测量脚本为 `/tmp/annual_p1_hot_probe.py`，只在本地运行，未进入提交。每项的 wall time 包含该函数调用开销；高频 wrapper 会带来少量 instrumentation overhead，因此绝对总和不用于替代端到端 wall，只用于定位热点。

### State replay

| 项目 | calls | total wall | avg | max |
|---|---:|---:|---:|---:|
| full profile deepcopy | 15 | 0.41 ms | 0.027 ms | 0.039 ms |
| full achievement deepcopy | 15 | 0.15 ms | 0.010 ms | 0.016 ms |
| full dojo deepcopy | 15 | 2.73 ms | 0.182 ms | 0.483 ms |
| full song deepcopy | 19,178 | 236.98 ms | 0.012 ms | 1.864 ms |
| delta profile deepcopy | 19 | 0.52 ms | 0.027 ms | 0.047 ms |
| delta achievement deepcopy | 102 | 1.78 ms | 0.017 ms | 0.036 ms |
| delta dojo deepcopy | 6 | 1.92 ms | 0.320 ms | 0.342 ms |
| delta song deepcopy | 3,165 | 50.16 ms | 0.016 ms | 1.530 ms |
| retained profile deepcopy | 924 | 18.67 ms | 0.020 ms | 1.488 ms |
| retained achievement deepcopy | 924 | 7.23 ms | 0.008 ms | 0.050 ms |
| retained dojo deepcopy | 924 | 389.23 ms | 0.421 ms | 110.958 ms |
| retained song-list construction/sort | 924 | not isolated in first probe | — | — |
| complete state hash | 924 | **5,908 ms** | **6.394 ms** | **21.665 ms** |
| canonical serialization inside hash | 924 state-hash calls (serialization probe also saw event IDs) | ~5,194 ms state-hash subset | ~5.62 ms | ~19.583 ms |
| unchanged equality check | 923 | sub-ms | sub-µs | sub-ms |
| snapshot normalization (file hash/read/parse/cache lookup) | 927 | 722.37 ms | 0.779 ms | 95.692 ms |

The retained state is therefore not dominated by branch deepcopy itself; the full-state hash serialization was the dominant replay cost.

### Observation events

| 项目 | calls | total wall | avg | max |
|---|---:|---:|---:|---:|
| `build_song_map` (repeated derived lookup) | 687 | 494.15 ms | 0.719 ms | 2.053 ms |
| `_song_values` (per-chart extraction) | 761,280 | **2,173.03 ms** | 0.00285 ms | 0.347 ms |
| counter epoch update | 715,094 | 534.39 ms | 0.00075 ms | 0.170 ms |
| datetime bound parsing | 3,124 | 61.47 ms | 0.0197 ms | 0.327 ms |
| event object + event-id allocation | 3,124 | 195.51 ms | 0.0626 ms | 6.391 ms |
| equivalent final sort | 1 | 2.63 ms | 2.63 ms | 2.63 ms |
| dedupe pass | 0 | 0 | — | — |
| state-to-state diff residual | ~380,979 chart iterations | ~1,147 ms (residual after the rows above) | — | — |
| complete event function | 1 | 4,608 ms instrumented | — | — |

The important signal is the 761k `_song_values` calls and 687 full map builds, not the wrapper-inflated complete-function total.

## 3. Before/after hot path

The same probe after both changes (2258735) measured:

| 项目 | before | after | 变化 |
|---|---:|---:|---:|
| complete state hash | 5,908 ms / 924 calls | removed | — |
| signature canonical serialization | — | 272 ms total probe time (includes event-id serialization) | replaces full-state hashing |
| retained song sort | not isolated | 79.8 ms / 924 calls | retained for deterministic list order |
| event `build_song_map` | 687 calls / 494 ms | 345 calls / 196 ms | −50% calls |
| event `_song_values` | 761,280 calls / 2,173 ms | 50,080 calls / 121–132 ms | −93.4% calls |
| counter epoch update | 715,094 calls / 534 ms | 3,894 calls / 3.8 ms | −99.5% calls |
| event object allocation | 3,124 / 196 ms | 3,124 / 129 ms | same output count |
| complete event function | 4,608 ms instrumented | 583 ms instrumented | −87% (probe wall) |

The after probe's total wall was 2.70–3.04s depending on normalized-cache filesystem writes; the comparable cold benchmark below uses the same low-level cache condition for every run.

## 4. Real-account benchmark (3 cold runs, median)

Each run used a fresh `TAIKO_ANNUAL_CACHE_DIR`, fixed `generated_at=2026-09-14T09:30:00`, and real userdata. The normalized-cache free-space guard was consistent across before/after runs; no business cache or production data was changed. RSS was sampled from `/proc/<pid>/status`.

| 账号 | history raw | annual snapshots | events | before median wall | after median wall | wall change | before peak RSS | after peak RSS |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 20159783（少量） | 1 | 1 | 0 | 1,609.6 ms | 1,629.8 ms | +1.3% | 165,700 KiB | 165,784 KiB |
| 26960604（中等） | 8 | 6 | 38 | 1,596.1 ms | 1,598.0 ms | +0.1% | 161,988 KiB | 162,448 KiB |
| 63666714（291 raw） | 291 | 163 | 3,454 | 4,458.5 ms | 2,706.2 ms | **−39.3%** | 189,608 KiB | 190,616 KiB |
| 2258735（926 raw） | 926 | 343 | 3,124 | **12,968.4 ms** | **4,211.5 ms** | **−67.5%** | 223,920 KiB | **216,712 KiB** |
| 33587101（高 playCount） | 44 | 40 | 5,446 | 3,960.6 ms | 3,122.9 ms | **−21.2%** | 204,244 KiB | 203,444 KiB |

2258735 的 combined state replay + event construction 从审计基线约 9.46s 降至约 1.51s（after hot probe：history total 2.00s，其中 normalization 1.06s，replay residual 约 0.94s；events 0.57s）。整体 cold wall 已达到优选目标区间：约 4.21s，中位数显著低于 8–9s 的整体目标。

小账号均在允许的 10% 波动内，没有“小账号明显变慢”。2258735 peak RSS 从 223,920 KiB 降至 216,712 KiB（约 −3.2%）。

## 5. 输出等价验证

对 5 个真实账号，以相同固定 `generated_at` 生成 before/after envelope，并执行 semantic deep diff：

| 账号 | summary JSON | events JSON | summaryId | FinalTitle / breakthrough / period / rating / keyword / 21 page data |
|---|:---:|:---:|:---:|:---:|
| 20159783 | equal | equal | unchanged | unchanged |
| 26960604 | equal | equal | unchanged | unchanged |
| 63666714 | equal | equal | unchanged | unchanged |
| 2258735 | equal | equal | unchanged | unchanged |
| 33587101 | equal | equal | unchanged | unchanged |

此外，source switch、manual source、counter regression、first-seen chart、deleted/re-added chart等现有语义测试均未因本次修改新增失败。`changed_keys` 只存在于 Python 对象内部，不会进入 summary/events JSON、fingerprint 或 summaryId。

## 6. 测试结果

通过：

- `npm run test:annual`：PASS（pageCount 21，schemaVersion 4）
- `npm run test:annual:period`：PASS（5 + 6 tests）
- `npm run test:version`：PASS
- `TMPDIR=/home/sigaer/annual-p1-pytest-tmp python3 -m pytest -q taiko/tests/test_annual*.py`：2 passed
- `TMPDIR=/home/sigaer/annual-p1-pytest-tmp python3 -m pytest -q taiko/tests/test_version_summary.py`：25 passed, 1 failed

最后一个失败是基线已有的 `test_source_switch_and_deleted_readded_chart_never_create_cross_epoch_delta`；在未修改代码的 detached `HEAD d554940` worktree 中复跑同一测试也失败，故不是 P1 引入。其余 version-summary 测试在将 pytest 临时目录放到有足够空间的文件系统后全部通过。

## 7. 未采用的优化

- **并行 snapshot 文件读取 / mmap / 新文件缓存**：审计已显示 IO 不是主项，本轮不增加复杂度。
- **把完整 state 改成 minimal observation state**：下游 aggregates、Dan event、FinalTitle 和 shadow/test 仍需要完整 retained state；本轮采用内部 change-set 提示，保持完整 state contract。
- **增量 SHA-256 保持原 digest 数值**：原 digest 仅用于 unchanged detection，并不出现在业务输出；branch/chart canonical signatures 已保持原 JSON 区分规则并移除全量序列化。
- **worker/daemon、Python 进程复用、polling/UI 调整**：明确属于 P2 或禁区，本轮未做。
- **修复 baseline source-switch 测试**：该失败在 P1 前已存在，修复会改变业务语义范围，未纳入。

## 8. 维护性评价与下一步

实现增加了一个内部 `changed_keys` 字段和一组 branch/chart signature 更新逻辑；events 对 source/manual 分支保留完整遍历，避免隐式改变 epoch 行为。复杂度是局部的、可读的，且没有跨用户全局可变状态。

P1 已达到目标，建议先人工审阅后再考虑 P2。若继续优化，最值得评估的是 Python cold-start（约 1.5s 固定成本）；state replay 与 events 已不再是 20 秒问题。不要在 P2 前改变 Algorithm Version、缓存语义或前端等待行为。

## 审计状态

本报告提交后等待人工审阅。本轮未部署、未重启、未修改运行中的 `/home/sigaer/taiko`，临时 profiling 文件均在 `/tmp`，可直接删除。
