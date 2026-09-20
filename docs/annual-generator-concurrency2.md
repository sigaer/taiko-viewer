# Annual Generator Concurrency 2 — Capacity Certification

## Decision

**ANNUAL GENERATOR CONCURRENCY 2 — CERTIFIED**

Certified configuration:

- `MAX_CONCURRENT_ANNUAL_BUILDS = 2`
- `MAX_CONCURRENT_ANNUAL_RENDERS = 1`
- generator queue cap remains 20
- renderer queue cap remains 8
- queue TTL remains 10 minutes
- generator and renderer cgroup limits remain unchanged
- algorithm remains `annual-observation-v4.5.1`

This certification does not authorize concurrency 3 and does not begin Annual Streaming Phase 2.

## Method

- Runtime: production `/home/sigaer/taiko`, commit-equivalent Annual streaming package from canonical `1b54d3a`.
- Frozen input, song data and rating data: the private Phase 1 fixture under `/var/tmp/annual-streaming-phase1/fixture`.
- Every generator used a fresh private output and normalized-cache directory, the deployed `annual_python_worker.py`, and the exact production systemd properties: `MemoryHigh=1G`, `MemoryMax=1536M`, `MemorySwapMax=128M`, `TasksMax=256`, `CPUQuota=200%`, hard lifetime, `KillMode=control-group`, and `OOMPolicy=stop`.
- The production generator admission held one guard ticket during each scenario, preventing real production generator work from overlapping the certification. The renderer used the normal production renderer admission and launcher. No production summary, job, output, or normalized cache was written or deleted.
- Workers were sampled every 200 ms for RSS, PSS, cgroup current/swap and memory events. Host samples included MemAvailable, memory and IO PSI, swap paging, CPU, load and bounded local Viewer HTTP probes.
- No OS page cache or swap was cleared. All ad-hoc orchestration ran inside `scripts/memory/run_qa.sh` and launched only the explicitly owned transient worker units.

Single-generator comparison baselines from the completed Phase 1 production rollout were 15.788–15.902 s and approximately 186.6 MiB `ru_maxrss` for `91899919`. The fresh largest-input baseline was 52.611 s and 185.0 MiB `ru_maxrss`.

## Scenario results

| Scenario | Worker | Wall s | `ru_maxrss` MiB | Peak PSS MiB | Peak cgroup MiB | high/max/oom/kill |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| A: two large | `91899919` | 16.666 | 182.4 | 168.4 | 216.2 | 0/0/0/0 |
| A: two large | `34678613` | 14.570 | 192.4 | 158.0 | 201.5 | 0/0/0/0 |
| B: worst-known + large | fresh largest input | 54.601 | 182.8 | 172.2 | 413.0 | 0/0/0/0 |
| B: worst-known + large | `91899919` | 16.987 | 184.7 | 163.0 | 217.2 | 0/0/0/0 |
| C: 2 generators + renderer | `91899919` | 15.945 | 184.5 | 172.7 | 205.2 | 0/0/0/0 |
| C: 2 generators + renderer | `34678613` | 14.670 | 192.1 | 160.0 | 199.2 | 0/0/0/0 |
| C: 2 generators + renderer | canonical share-card | 2.394 render / 2.942 caller | n/a | 437.0 | 271.7 | 0/0/0/0 |

- Generator overlap was 14.121 s in A, 16.542 s in B and 14.231 s in C. Scenario C had 2.089 s of measured three-worker overlap.
- `91899919` wall-time regression versus the 15.788 s production-worker baseline was +5.6% in A, +7.6% in B and +1.0% in C. All are below the 25% gate and none approaches a 30-second class regression.
- The fresh largest input increased from 52.611 to 54.601 s (+3.8%). Its memory stayed in the same approximately 183 MiB process-RSS class rather than returning toward the old approximately 884 MiB peak.
- Every generator returned schema 4, `annual-observation-v4.5.1`, the expected event count and the exact frozen serialized SHA-256. There was no worker swap.
- The valid canonical renderer produced a 1080×1648 PNG in 2.394 s with four loaded images, zero broken images and loaded fonts. A preliminary attempt used a stale old summary fixture that independently timed out even with no generators; it was excluded after a current v4.5.1 summary with an existing successful share-card passed a 2.685 s single-render baseline.

## Host pressure

| Metric | Scenario A | Scenario B | Scenario C |
| --- | ---: | ---: | ---: |
| Minimum MemAvailable MiB | 14,987.8 | 14,920.4 | 14,538.8 |
| Admission threshold MiB | 12,475.0 | 12,475.0 | 12,475.0 |
| Memory PSI full avg10 max | 0.36% | 0.18% | 0.00% |
| IO PSI full avg10 max | 3.25% | 2.96% | 4.77% |
| CPU busy average / max | 33.7% / 85.7% | 29.1% / 85.2% | 38.9% / 74.3% |
| Load1 max | 1.16 | 2.09 | 1.71 |
| Swap used change | 0 | 0 | 0 |
| Swap in/out pages | 25 / 0 | 44 / 0 | 4 / 2 |
| Host OOM delta | 0 | 0 | 0 |
| Viewer HTTP failures | 0 / 16 | 0 / 52 | 0 / 15 |
| Viewer HTTP max latency | 46.3 ms | 51.0 ms | 44.0 ms |

The short cold-cache writes caused transient IO PSI, but memory PSI remained well below 2%, swap allocation did not grow, Viewer probes stayed successful and low-latency, and no production service restart or failure accompanied the scenarios. MemAvailable remained at least approximately 2.0 GiB above the existing admission threshold.

## Admission change

The host-global ledger now permits two generator rows in `running` while keeping renderer at one. The same headroom function is evaluated inside the locked transition for every slot; setting a limit of two does not force a second launch. When headroom is false, the second generator remains queued until pressure recovers or the unchanged queue TTL expires.

Focused admission tests verify:

- two distinct generators may overlap and a third waits;
- renderer concurrency stays one;
- headroom is rechecked before the second generator starts;
- queue caps remain generator 20 / renderer 8;
- deduplication, FIFO readiness, TTL, cancellation, shared failure and cross-process flock behavior remain intact.

## Production rollout

Pending standard Viewer deployment and the required 30-minute production observation window.

Private certification evidence is retained under `/var/tmp/annual-concurrency2-20260920/`. It is not committed and contains no production summary/job/cache mutation.
