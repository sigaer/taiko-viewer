# Annual Performance & Throughput Optimization — Phase 2

Status: **ANNUAL PERFORMANCE PHASE 2 — READY**

Date: 2026-09-20 (Asia/Shanghai)

Algorithm remains `annual-observation-v4.5.1`. Annual semantics, snapshot ordering and
lineage, event semantics, FinalTitle/strongDan, schema, renderer concurrency, queue
limits/TTL, admission headroom and worker cgroup limits were not changed.

## Production state verified before testing

- Deployed Viewer commit: `e4ca8d2`
- Deployed Viewer version: `0.71.0`
- Generator concurrency: 2
- Renderer concurrency: 1
- Generator / renderer queue caps: 20 / 8
- Queue TTL: 600 seconds
- Viewer service active, `NRestarts=0`, local and public HTTP probes returned 200
- Canonical Annual commit before optimization: `1b54d3a` (`9.61.11`)
- Canonical and runtime Annual package contents were identical before testing

All benchmarks used the Phase 1 frozen fixture, private outputs and private normalized
caches. They ran through the bounded QA or existing Annual worker launchers. OS page
cache and swap were not cleared, and production summaries, jobs and caches were not
modified.

## Startup memory attribution

The process was sampled at import boundaries. Values are sampled PSS / anonymous RSS;
time is cumulative process startup time.

| Boundary | PSS MiB | RssAnon MiB | Time s |
|---|---:|---:|---:|
| `python -S` | 2.8 | 2.3 | — |
| normal Python | 7.3 | 6.8 | — |
| probe script ready | 7.6 | — | — |
| import `plugins` | 25.6 | — | 0.163 |
| import `plugins.utils` | 135.6 | 108.1 | 1.296 |
| import Annual package | 136.1 | — | 1.311 |
| current CLI ready | 136.1 | — | 1.321 |
| `TAIKO_COMPUTE_ONLY=1` CLI ready | 89.4 | — | 0.883 |
| lightweight namespace + Annual CLI ready | 22.7 | — | 0.116 |

Import-time profiling attributes the dominant fixed base to the parent
`plugins.utils.__init__` import graph, not Annual itself. The current import graph pulls
in `score_calculator`, Matplotlib, pandas, NumPy, Pillow, drawing helpers and global song
indices before Annual work starts. Annual itself adds only about 0.5 MiB PSS after that
parent initialization.

### Fixed-base breakdown

- Confirmed: approximately 113 MiB PSS is avoidable parent-package initialization
  (`plugins.utils` boundary minus the lightweight Annual-ready boundary).
- Confirmed: `score_calculator` and plotting/data-analysis imports dominate import time.
- Inferred: shared-file pages and allocator behavior explain part of the RSS/PSS gap;
  they are not retained Annual snapshot state.
- Unknown/residual: roughly 23 MiB PSS remains for Python, the Annual module graph and
  its actual static data. This is small enough that further startup work is not the next
  priority.

## Single-job baseline

Each account ran three times at concurrency 1. Values below are medians.

| Account class | Wall s | User s | Sys s | ru_maxrss MiB | PSS MiB | RssAnon MiB |
|---|---:|---:|---:|---:|---:|---:|
| small (`1322664`) | 2.028 | 1.678 | 0.387 | 167.7 | 152.8 | 124.9 |
| median (`27214979`) | 2.250 | 1.964 | 0.338 | 172.0 | 163.1 | 135.4 |
| `91899919` | 9.108 | 8.584 | 0.567 | 185.2 | 172.8 | 145.1 |
| fresh largest-input | 26.675 | 25.700 | 1.044 | 183.5 | 168.9 | 141.3 |

The shared QA cgroup contains page-cache charges accumulated across runs, so its
aggregate `memory.current` is not treated as a per-job peak. Per-process PSS, anonymous
RSS and rusage are the comparable memory measurements. Process swap remained zero.

## CPU profile

### 91899919

- Profiled total: 13.36 s
- snapshot history: 8.45 s; event construction: 4.06 s
- pass 1 / ordering / replay / events / summary / serialization:
  2.51 / 0.02 / 5.91 / 4.06 / 0.84 / 0.07 s
- JSON decode self time: 2.49 s
- canonical JSON/signature work: 2.70 s cumulative
- file hashing: 0.41 s across 239 calls

### Fresh largest-input

- Profiled total: 38.76 s
- snapshot history: 29.87 s; event construction: 8.54 s
- pass 1 / ordering / replay / events / summary / serialization:
  9.51 / 0.02 / 20.31 / 8.55 / 0.33 / 0.02 s
- JSON decode self time: 9.03 s
- canonical JSON/signature work: 9.45 s cumulative
- file hashing: 1.58 s across 936 calls

Sorting is negligible. After fixed startup is removed, replay, JSON decode, canonical
signature work and event construction remain the dominant CPU costs.

## I/O profile

The normalized cache correctly disabled writes because filesystem free space was just
below its 20 GiB safety floor. The safety floor was not reduced.

| Fixture | Plan reads/parses | Replay reads/parses | Hash calls | Source bytes for hash + pass 1 |
|---|---:|---:|---:|---:|
| `91899919` | 237 | 236 | 239 | 262,552,352 |
| fresh largest-input | 934 | 929 | 936 | 1,084,375,676 |

With cache writes disabled, a cold source file is hashed, parsed during planning and
parsed again during replay. A single-read hash+parse candidate removed one source read,
but its repeated benchmark did not show a stable wall-time benefit, so it was rejected
from the final patch. SnapshotPlan metadata persistence was also not introduced: the
profile shows replay/signatures/events as the larger remaining costs, and adding a new
cache contract was not justified by this phase's evidence.

## Optimization retained

Canonical commit `17ba810` (`9.61.12`) adds a dedicated lightweight Annual CLI entry.
It constructs only the `plugins` and `plugins.utils` namespace paths required by the
Annual package, then runs the unchanged canonical CLI. This avoids executing the
general-purpose parent initializer while keeping the existing interpreter, JSON parser,
CLI and algorithm modules.

Three-run medians, frozen input and private cold output/cache:

| Account class | Baseline wall s | Optimized wall s | Change | Baseline ru_maxrss MiB | Optimized ru_maxrss MiB |
|---|---:|---:|---:|---:|---:|
| small | 2.028 | 0.532 | -73.8% | 167.7 | 48.5 |
| median | 2.250 | 0.767 | -65.9% | 172.0 | 52.7 |
| `91899919` | 9.108 | 7.472 | -18.0% | 185.2 | 78.0 |
| fresh largest-input | 26.675 | 25.626 | -3.9% | 183.5 | 63.1 |

The rejected single-read candidate produced median walls of 0.496, 0.819, 8.147 and
25.836 s respectively. It regressed `91899919` by about 9% versus the lightweight-entry
baseline and was effectively neutral for the largest input, so it was reverted.

## Equivalence

- 24/24 frozen accounts completed successfully.
- The original 23-account corpus matched its Phase 1 serialized SHA-256 values exactly.
- The fresh largest-input output matched its established SHA-256 exactly.
- All 24 outputs passed checks for schema 4, `annual-observation-v4.5.1`, events,
  FinalTitle `titleKey`, `strongDan`, evidence and provenance.
- Normalized-cache low-space and non-fatal I/O tests passed.
- Normalized-cache hit, stale-source, corrupt-file rebuild and concurrent-write tests
  passed on the existing disk-backed `/data/disk` test mount, whose capacity-based free
  floor was satisfied. No cache was cleared and no threshold was changed.
- The focused Annual suite passed 28 tests with the one known unrelated regression
  explicitly deselected.
- One pre-existing deleted/re-added chart test remains failing and is unrelated to the
  standalone entry; the final serialized corpus remained exact.

The canonical package was synchronized as a whole to production runtime. All 23 Python
files match exactly; the path-independent aggregate Python hash is
`be30938ff7dc3ed99ff49ab55ce94bbd11946a1b52dda8655db36e5041dcce38`.
A bounded runtime-path smoke for `91899919` completed in 7.102 s with 79.8 MiB
`ru_maxrss`, zero process swap and the expected serialized SHA-256
`fc18feff4cf9fc66611ca790e5f0f5cb758e7ffaadff324d051c2071816bde1a`.

## Scaling

Scaling used distinct accounts, existing cgroup settings and a guard occupying the real
production generator admission slots so test workers could not overlap real production
generators. HTTP health probes ran throughout.

| Workload | N | Aggregate s | Jobs/min | Speedup vs N=1 | Efficiency | Max job s | CPU avg | MemAvailable min GiB | memory PSI full avg10 max | HTTP |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A: four large | 1 | 31.456 | 7.630 | 1.00x | 100% | 10.146 | 27.5% | 14.56 | 4.40% transient | 30/30 |
| A: four large | 2 | 15.439 | 15.545 | 2.04x | 101.9% | 9.874 | 36.7% | 14.34 | 0.50% | 15/15 |
| A: four large | 3 | 14.362 | 16.710 | 2.19x | 73.0% | 11.588 | 46.9% | 14.26 | 0.00% | 14/14 |
| B: largest + mixed | 1 | 46.528 | 5.158 | 1.00x | 100% | 27.627 | 24.7% | 14.47 | 0.55% | 45/45 |
| B: largest + mixed | 2 | 28.513 | 8.417 | 1.63x | 81.6% | 28.311 | 35.3% | 14.51 | 0.06% | 27/27 |
| C: generators + renderer | 1 | 10.000 | 6.000 | 1.00x | 100% | 9.775 | 29.2% | 14.25 | 0.36% | 10/10 |
| C: generators + renderer | 2 | 10.392 | 11.547 | 1.92x | 96.2% | 10.190 | 47.5% | 14.28 | 0.00% | 10/10 |

All tested workers and both renderers completed. Worker cgroup `high`, `max`, `oom` and
`oom_kill` deltas were zero; host OOM-kill delta was zero. There was no sustained memory
PSI full above 2%, no worker swap, no material swap allocation growth and no HTTP
failure. The N=1 Workload A PSI maximum was a transient pre-existing host interval and
fell to 1.25% before completion; later higher-concurrency scenarios did not reproduce it.

N=3 failed the progression gate: throughput improved only 7.5% over N=2, below the 10%
marginal threshold, while account `52215131` increased from 6.987 s at N=1 to 9.624 s
(+37.7%), above the 25% wall-time regression threshold. Therefore Workloads B/C at N=3
and all N=4 scenarios were intentionally not run.

## Recommendation

`RECOMMENDED_GENERATOR_CONCURRENCY = 2`

`MAX_CERTIFIED_GENERATOR_CONCURRENCY = 2`

Renderer concurrency remains 1. Dynamic admission/headroom remains mandatory; a maximum
of 2 does not force two workers to start under pressure. No concurrency setting, queue
cap, TTL or cgroup limit is changed by this phase.

The Viewer integration candidate switches only the bounded Python worker's CLI path and
bumps the Viewer candidate version to `0.71.1`. Annual contract, admission/capacity and
version projection tests pass. Per rollout policy, it is not automatically deployed;
production remains Viewer `0.71.0` / `e4ca8d2` pending final review and standard deploy.

Further startup/base work is low priority after the retained optimization. The remaining
dominant bottleneck is per-snapshot replay plus JSON/canonical-signature/event CPU. That
work overlaps the explicitly excluded history-compaction/online-aggregation scope and is
left as a future candidate. Phase 2 stops here; concurrency 3 and the next algorithmic
phase are not started.
