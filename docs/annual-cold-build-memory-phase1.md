# Annual Cold Build Memory Phase 1

## Decision

**ANNUAL STREAMING PHASE 1 — COMPLETE**

The two-pass snapshot plan removes the retained raw-payload set without changing Annual output. On the required large numeric account (`91899919`), median generator max RSS fell from **333.2 MiB** to **182.6 MiB** (45.2%), while median wall time moved from **14.06 s** to **14.89 s** (+5.9%). The largest input directory found by the fresh stat-only scan fell from **883.7 MiB** to **182.3 MiB** (79.4%), with wall time moving from **48.85 s** to **51.70 s** (+5.8%). Both are below the 250 MiB target and below the 15% runtime regression gate.

The request described the current algorithm as `annual-observation-v4.5.0`. Canonical repository HEAD was already `annual-observation-v4.5.1` before this work because commit `18893a7` had shipped a lineage correctness fix. This phase preserves the actual current algorithm and version; it does not downgrade to v4.5.0 or introduce a new algorithm version.

The measurements below were completed before rollout. Production runtime was synchronized and accepted on 2026-09-20 as recorded in [Production Rollout](#production-rollout). The rollout did not modify Viewer source, publish a Viewer release, change the Annual algorithm, or start Phase 2.

Canonical source commit: `1b54d3a` (`9.61.11 年度快照改为两遍流式回放降低峰值内存`), pushed to `origin/main`.

## Architecture Before

```text
snapshot files
  -> _read_snapshot_input(path)
  -> SnapshotInput(path, ordering/lineage metadata, full payload)
  -> candidates[] retains every payload
  -> lineage normalization + stable sort + hash dedup
  -> replay all candidates into COW rebuilt states
  -> SnapshotHistory[RebuiltSnapshot]
  -> WindowSelection (references history entries)
  -> event extraction
  -> summary + events
  -> atomic serialization
```

The important lifetime overlap was:

- `RAW_PAYLOAD`: created by `_read_snapshot_input`; owned by every `SnapshotInput` in `candidates`; remained alive through all replay. A separate current-file input could also remain referenced for lineage inference.
- `REBUILT_STATE`: created during replay; retained by each `RebuiltSnapshot` in the history.
- `HISTORY_ENTRY`: appended for every retained changed state; retained through event extraction, summary construction and FinalTitle.
- `EVENT`: created by `build_observation_events`; retained in the returned result through serialization.
- `SIGNATURE`: current branch/chart canonical bytes; retained through replay only. These preserve existing semantics and were not changed.
- `SELECTION`: reference-only lists/slices of rebuilt history entries; no state deep copy, retained through summary construction.

The peak therefore included the full raw object graph and rebuilt history at the same time. On the fresh largest-input account, the old profiler observed 933 retained raw payloads representing 541,164,405 source bytes before reconstruction.

## Architecture After

```text
Pass 1
snapshot file
  -> hash + parse one payload
  -> validate + extract ordering/lineage/full/warnings metadata
  -> normalized-cache publication when needed
  -> SnapshotPlanEntry (no payload field)
  -> release payload

SnapshotPlanEntry[]
  -> lineage normalization
  -> stable sort with unchanged key
  -> content-hash dedup with unchanged warning semantics
  -> final SnapshotPlan

Pass 2
for each planned entry in final order:
  -> load one payload
  -> apply full/delta replay using existing COW and canonical signatures
  -> append rebuilt history entry when state/identity changed
  -> release payload explicitly

SnapshotHistory
  -> unchanged selection, events, summary and atomic serialization
```

`SnapshotPlanEntry` retains only path, observed time, full/delta flag, source identity, topology, content hash, source byte size and warnings. Stable ordering remains `(observed_at, full-before-delta, filename, content_hash)`. Source precedence, lineage inference and hash dedup are unchanged.

The cold path may parse a file once in metadata planning and once again from the newly written private normalized cache during replay. This is intentional: bounded RAM takes priority over avoiding the second sequential read. No payload is retained to bridge the passes.

The existing changed-key/COW replay remains intact. No full-song-state deepcopy was introduced, and canonical signature bytes retain their old meaning.

### Consumer and lifetime audit

| Object | Creator | Holder | Last use | Must cross stages? |
| --- | --- | --- | --- | --- |
| snapshot path list | `_candidate_paths` | `raw_candidates` | end of Pass 1 | no |
| `SnapshotPlanEntry` | `_read_snapshot_plan_entry` | `candidates`, then `plan` | end of history replay / input fingerprint references | yes, metadata only |
| `RAW_PAYLOAD` | `_read_snapshot_plan_entry` / `_load_snapshot_payload` | one local variable | metadata extraction or one replay iteration | no; measured peak alive = 1 |
| lineage/dedup maps | `load_snapshot_history` | local sets/lists | plan finalization | no |
| current replay state | `load_snapshot_history` | profile/achievement/dojo/song maps | end of replay | yes during replay only |
| `SIGNATURE` | replay | current branch/chart signature variables | end of replay | no; semantics unchanged |
| `REBUILT_STATE` | replay | `RebuiltSnapshot.state` | summary/FinalTitle completion | yes |
| `HISTORY_ENTRY` | replay | `SnapshotHistory.snapshots` | summary/FinalTitle completion | yes |
| `SELECTION` | `select_window` | `WindowSelection` | summary completion | yes; references history |
| `EVENT` | `build_observation_events` | result events list | serialization | yes |

## Baseline and profiling method

- Runner: `scripts/memory/run_qa.sh`; MemoryHigh 2 GiB, MemoryMax 3 GiB, MemorySwapMax 256 MiB, CPU quota 200%, 15-minute limit.
- One generator at a time; every trial used a new private normalized cache and private atomic output.
- Inputs were copied once to a private 0700 disk-backed fixture so old/new results could not drift as live snapshots or song/rating metadata changed. Production files remained read-only and no DB was accessed.
- Process RSS maximum comes from `wait4().ru_maxrss`. PSS/RssAnon and cgroup current were sampled every 100 ms; this kernel does not expose `memory.peak`, so the report labels the value as sampled cgroup peak. Major faults come from `wait4().ru_majflt`.
- The real RSS trials did not enable tracemalloc. A separate one-frame tracemalloc attribution run was performed and is not mixed into the normal peak figures.
- Raw-payload estimated bytes are source file bytes, not a claim about Python object-graph size.

The separate old large-account tracemalloc run reached 586.0 MiB sampled tree RSS and 75.6 s. At the raw/replay boundary, traced live allocations were about 159.3 MiB and the traced peak later reached about 171.1 MiB. This profiler-inflated run is attribution evidence only.

## Memory Curve

Values are stage-marker process MiB, not the independently sampled maximum. Elapsed is seconds from profiler initialization. Swap was 0 at every stage and is omitted from the tables.

### Small (`1322664`)

| Stage | Old elapsed | Old RSS | Old PSS | Old anon | New elapsed | New RSS | New PSS | New anon |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| process_start | 0.002 | 149.4 | 133.3 | 107.9 | 0.003 | 151.8 | 135.6 | 109.9 |
| imports_ready | 0.031 | 149.9 | 133.8 | 108.4 | 0.030 | 152.3 | 136.1 | 110.4 |
| source_discovery_complete | 0.049 | 149.9 | 133.8 | 108.4 | 0.048 | 152.3 | 136.2 | 110.4 |
| raw_snapshot_load_complete | 0.085 | 150.2 | 134.2 | 108.7 | 0.087 | 152.6 | 136.4 | 110.7 |
| ordering_dedup_lineage_complete | 0.114 | 150.5 | 134.5 | 108.9 | 0.116 | 152.6 | 136.5 | 110.7 |
| history_rebuild_complete | 0.137 | 150.7 | 134.7 | 109.2 | 0.142 | 152.8 | 136.7 | 110.9 |
| selection_complete | 0.151 | 150.7 | 134.7 | 109.2 | 0.158 | 152.8 | 136.7 | 110.9 |
| event_build_complete | 0.169 | 151.0 | 134.8 | 109.4 | 0.177 | 152.8 | 136.8 | 110.9 |
| summary_complete | 0.298 | 159.8 | 143.8 | 118.3 | 0.308 | 162.4 | 146.3 | 120.5 |
| serialization_complete | 0.321 | 159.1 | 142.9 | 117.5 | 0.332 | 162.4 | 146.3 | 120.5 |
| process_exit | 0.335 | 159.1 | 142.9 | 117.5 | 0.347 | 162.4 | 146.3 | 120.5 |

### Median-like (`27214979`)

| Stage | Old elapsed | Old RSS | Old PSS | Old anon | New elapsed | New RSS | New PSS | New anon |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| process_start | 0.004 | 149.4 | 133.4 | 107.9 | 0.003 | 151.5 | 135.5 | 109.9 |
| imports_ready | 0.034 | 150.0 | 133.9 | 108.4 | 0.032 | 152.0 | 136.0 | 110.4 |
| source_discovery_complete | 0.053 | 150.0 | 134.0 | 108.4 | 0.050 | 152.0 | 136.1 | 110.4 |
| raw_snapshot_load_complete | 0.218 | 151.2 | 135.3 | 109.7 | 0.223 | 152.3 | 136.4 | 110.7 |
| ordering_dedup_lineage_complete | 0.255 | 151.8 | 135.8 | 110.2 | 0.259 | 152.6 | 136.7 | 110.9 |
| history_rebuild_complete | 0.329 | 152.8 | 136.9 | 111.2 | 0.331 | 153.8 | 137.9 | 112.2 |
| selection_complete | 0.348 | 152.8 | 136.9 | 111.2 | 0.346 | 153.8 | 137.9 | 112.2 |
| event_build_complete | 0.501 | 155.1 | 139.1 | 113.6 | 0.442 | 156.9 | 141.1 | 115.3 |
| summary_complete | 0.874 | 164.3 | 148.4 | 122.7 | 0.767 | 166.4 | 150.5 | 124.7 |
| serialization_complete | 0.928 | 167.9 | 151.9 | 126.3 | 0.824 | 170.0 | 154.0 | 128.3 |
| process_exit | 0.943 | 167.9 | 151.9 | 126.3 | 0.841 | 170.0 | 154.0 | 128.3 |

### Large (`91899919`, 236 snapshots, 124.24 MiB)

| Stage | Old elapsed | Old RSS | Old PSS | Old anon | New elapsed | New RSS | New PSS | New anon |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| process_start | 0.003 | 150.1 | 134.0 | 107.9 | 0.003 | 151.8 | 135.6 | 109.9 |
| imports_ready | 0.033 | 150.6 | 134.5 | 108.4 | 0.029 | 152.3 | 136.1 | 110.4 |
| source_discovery_complete | 0.053 | 150.6 | 134.7 | 108.4 | 0.049 | 152.3 | 136.2 | 110.4 |
| raw_snapshot_load_complete | 8.933 | 325.1 | 309.3 | 282.9 | 8.369 | 155.9 | 139.8 | 114.0 |
| ordering_dedup_lineage_complete | 9.024 | 327.5 | 311.4 | 285.3 | 8.441 | 155.9 | 139.8 | 114.0 |
| history_rebuild_complete | 11.202 | 331.8 | 316.0 | 289.6 | 12.021 | 162.1 | 146.0 | 120.2 |
| selection_complete | 11.277 | 327.3 | 311.2 | 285.1 | 12.037 | 162.1 | 146.0 | 120.2 |
| event_build_complete | 12.393 | 327.3 | 311.2 | 285.1 | 13.332 | 167.3 | 151.2 | 125.4 |
| summary_complete | 12.783 | 326.7 | 310.6 | 284.5 | 13.736 | 178.2 | 161.9 | 136.3 |
| serialization_complete | 12.872 | 325.6 | 309.5 | 283.4 | 13.829 | 182.3 | 166.0 | 140.4 |
| process_exit | 12.890 | 325.6 | 309.5 | 283.4 | 13.845 | 182.3 | 166.0 | 140.4 |

### Fresh largest-input account

The current all-directory stat scan found a larger valid snapshot directory than the earlier numeric corpus: 933 snapshots, 516.09 MiB total, 0.98 MiB largest file. It is redacted here because its key is an external account identifier.

| Stage | Old RSS MiB | Old PSS MiB | New RSS MiB | New PSS MiB |
| --- | ---: | ---: | ---: | ---: |
| raw_snapshot_load_complete | 857.2 | 841.3 | 154.3 | 138.3 |
| history_rebuild_complete | 877.5 | 861.5 | 166.4 | 150.5 |
| summary_complete | 863.3 | 847.2 | 175.2 | 159.1 |
| serialization_complete | 441.1 | 423.9 | 175.2 | 159.1 |

The old plan retained 933 payloads / 541,164,405 estimated source bytes. The new plan retained at most one payload / 1,023,433 estimated source bytes. Its output SHA was identical old/new.

## Equivalence

Result: **PASS, 24 accounts**.

- Required IDs: `40500773`, `49557999`, `66792598`, `47279977`, `84813650`, `99408699`, small, median-like and `91899919`.
- Numeric corpus coverage: snapshot-count Top 5, input-byte Top 5, three minimum-snapshot accounts and five median-scale accounts, deduplicated with the required set.
- Fresh global largest-input account: one additional redacted account.
- Every successful old/new output was compared by exact serialized SHA-256, not only selected fields. All 24 hashes match, so schema, algorithm version, summary payload, events, observed dates, counts, selection-derived fields, FinalTitle/strongDan/evidence, provenance, normalized fingerprints and deterministic byte ordering are equal.
- Repeated new large runs produced the same hash.
- Existing synthetic coverage exercises full and delta snapshots, sparse COW, same-time full-before-delta ordering, metadata reorder warnings, source switching, lineage inference/account switches, boundary selection, first-record behavior, high-score/update times, cache miss/hit/corruption/concurrency and insufficient/current-archive data.
- `30 passed, 1 deselected` in the focused Annual suite. The deselected deleted/re-added assertion also fails on pristine pre-change HEAD with the same first-record event; it is a pre-existing expectation conflict and was not “fixed” by changing business semantics. Exact old/new corpus hashes remain the equivalence authority for this phase.

No differing field was found.

## Performance

Three fresh-private-cache runs per implementation were alternated old/new on the same machine and frozen inputs. Values are medians. RSS is generator `ru_maxrss`; PSS/RssAnon and cgroup current are 100 ms sampled peaks. MiB uses 1024² bytes.

| Account | Impl | Wall s | User s | Sys s | Max RSS MiB | PSS MiB | RssAnon MiB | Sampled cgroup MiB | Major faults | Swap MiB |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| small | old | 1.961 | 1.647 | 0.305 | 168.1 | 151.7 | 125.9 | 136.7 | 0 | 0 |
| small | streaming | 1.889 | 1.614 | 0.332 | 167.5 | 151.6 | 125.6 | 136.2 | 0 | 0 |
| median-like | old | 2.396 | 2.018 | 0.378 | 171.9 | 160.4 | 134.4 | 146.6 | 0 | 0 |
| median-like | streaming | 2.487 | 2.078 | 0.347 | 171.8 | 161.2 | 135.4 | 146.5 | 0 | 0 |
| `91899919` | old | 14.063 | 12.496 | 0.679 | 333.2 | 323.4 | 297.2 | 372.9 | 0 | 0 |
| `91899919` | streaming | 14.893 | 13.396 | 0.668 | 182.6 | 169.2 | 143.7 | 223.9 | 0 | 0 |

For `91899919`, max RSS improves 45.2%, PSS improves 47.7%, and sampled cgroup current improves 40.0%; wall time increases 5.9%. Small and median memory stay flat because the approximately 150 MiB import/base footprint dominates their small input.

The separately measured largest-input account completed old/new in 48.85/51.70 s (+5.8%), with generator max RSS 883.7/182.3 MiB (-79.4%), sampled PSS 868.9/171.8 MiB and sampled cgroup current 1068.9/424.1 MiB. Cgroup current includes newly populated private-cache file pages, so it is intentionally higher than process PSS.

## JSON loader benchmark

On the 236-file / 124.24 MiB large corpus, three sequential parse passes produced:

| Parser | Median parse s | Process max RSS MiB | Song-count check |
| --- | ---: | ---: | --- |
| stdlib `json` | 1.140 | 43.8 | 192,140 each pass |
| installed `orjson` | 0.395 | 23.3 | 192,140 each pass |

All 236 current corpus values compared equal. However, `orjson` converted `18446744073709551616` to a float while stdlib preserved the exact Python integer, so exact integer/error semantics are not equivalent. `msgspec` is not installed. No production dependency or parser change was made; stdlib `json` remains the implementation.

## Complexity

Before:

- raw snapshot payloads: `O(total input object graph)`
- plan/candidate metadata: `O(snapshot count)` but embedded beside payloads
- rebuilt history: unchanged data-dependent size, reduced by existing COW
- current signatures: `O(current chart count)`
- events and serialized result: data-dependent

After:

- raw snapshot payloads: `O(max single snapshot object graph)`
- plan metadata: `O(snapshot count)`
- rebuilt history, current signatures, events and output: unchanged complexity and semantics

This phase does **not** claim the whole algorithm is O(1). History, events, selection references and final serialization still scale with retained observations and output size.

## Remaining Peak

- Fixed import/base is approximately 150 MiB RSS on this process path and dominates small accounts.
- The replay current state and retained COW history remain data-dependent. The large account retained 210 history entries; the largest-input account retained 866.
- Events remain retained through result serialization (`2672` for `91899919`).
- Canonical signatures remain intentionally unchanged. The large account peaked at 1,475 signature entries / 495,700 bytes; the largest-input account at 1,520 / 507,800 bytes.
- Summary/event construction raises the large stage RSS from 162.1 to 178.2 MiB.
- Serialization is the largest recorded post-streaming stage for `91899919` at 182.3 MiB RSS / 166.0 MiB PSS. The independently sampled generator maximum was 182.6 MiB, so no hidden >250 MiB phase remains.
- Private normalized-cache page charges explain why cgroup current remains above process PSS for very large inputs; they are file-backed/reclaimable and do not represent retained Python payloads.

Phase 2 history compaction or online aggregation may still be useful for lowering the fixed/history/event/serialization remainder, but it is not required to pass Phase 1.

## Production Rollout

Final status: **ANNUAL STREAMING PHASE 1 — COMPLETE**.

### Source synchronization

- Rollout began at 2026-09-20 10:50 CST. Canonical `HEAD` and `origin/main` both resolved to `1b54d3a41bb8fd660ae6f39be459b00f06269f6d`; the commit contains version `9.61.11` and only the expected Annual streaming/profiling implementation plus its focused test.
- The pre-rollout production `snapshots.py` SHA-256 was `046536453b32d41b5ee98872955490602c34f8a7ef952bd23ff43147418d27df`; `profiling.py` was absent. A recoverable whole-package backup was created at `/home/sigaer/annual-streaming-runtime-backup-20260920-1050`.
- The entire canonical `taiko/plugins/utils/annual_summary/` package was synchronized with the existing safe `rsync -a --delete` procedure while excluding generated `__pycache__`, rather than selecting files manually.
- All 23 non-generated package files, including all 22 Python files, compare byte-for-byte equal after synchronization. The deterministic aggregate SHA-256 manifest for the Python files is `26456c25c6adb0b298c4ce9dc87054b08e35f8760a36d0a1119edd08dd54328e` on both sides. Final `rsync --dry-run` output was empty. Representative post-rollout hashes are `be1223b5ded4a26fbde7ccd74c56353a52085be010c2dab8d29fded797aa9093` for `snapshots.py` and `aa2dca3a04039138234f0713f3c2493c72a38df1644f93174ad1f5e00d47b161` for `profiling.py`.
- Runtime compile/import checks passed and reported `annual-observation-v4.5.1`. The focused production-path suite passed `30` tests. The canonical commit's updated normalized-cache test was then run separately while forcing imports from the production runtime and also passed. Only the deleted/re-added first-record assertion remains excluded as the already documented pre-existing conflict.

### Frozen-input smoke and equivalence

All runs were serial (`concurrency = 1`) through the bounded QA launcher, with separate 0700 output and cold normalized-cache directories under `/var/tmp/annual-streaming-phase1/rollout-20260920/`. No production summary, job, or normalized cache was written or deleted.

| Frozen input | Runtime wall s | Runtime `ru_maxrss` MiB | Sampled process-tree RSS MiB | Serialized SHA-256 |
| --- | ---: | ---: | ---: | --- |
| small (`1322664`) | 2.253 | 167.0 | 173.0 | `36551f548285cc6f2538f0b239498517048db2ed956f05edbbc8a15827b325ea` |
| median-like (`27214979`) | 2.320 | 174.0 | 183.5 | `4f0058f81556381a8fb9b638354a7ea41003358eec0110aaa45910e7bd1b09a0` |
| `91899919` | 15.902 | 186.6 | 194.1 | `fc18feff4cf9fc66611ca790e5f0f5cb758e7ffaadff324d051c2071816bde1a` |
| fresh largest input | 52.611 | 185.0 | 197.2 | `7f298ef1df934eb2f6ca7a1efa50bc90aedcd65e9fcdf222bdc4d930e48e8093` |
| anchor `40500773` | 2.098 | 170.4 | 177.2 | `8626c7f5b9da16e204868f1efdefaa2b0d3d827bca5eaa7fa9d4b038cf6de4fc` |
| anchor `49557999` | 2.033 | 170.1 | 176.4 | `3a85720654f212a0bcd7aa455b3cf7a5e309cedfa52bf26a114373605d7e3d85` |

Each runtime output was compared with a fresh canonical build from the same frozen input and generated timestamp. All six serialized hashes match exactly. Schema version `4`, algorithm version `annual-observation-v4.5.1`, event count/provenance count, `titleKey`, `strongDan`, `evidenceKey`/`evidenceValue`, and provenance structure were also checked explicitly. `91899919` remains in the expected 15-second and 180–200 MiB process-RSS class; the largest input remains far below the former approximately 884 MiB peak. No run used swap or timed out.

### Production worker integration

- A private `91899919` smoke traversed the deployed host-global generator admission and Viewer worker launcher. Admission moved one ticket through `queued -> running -> completed`; the real transient unit was `taiko-annual-generator-931f1ce3-d63b-4f55-a4c5-ca62071d2b0e.service`.
- The unit used the unchanged production bounds: generator `MemoryHigh=1G`, `MemoryMax=1536M`, `MemorySwapMax=128M`, `TasksMax=256`, `CPUQuota=200%`, hard runtime deadline, `KillMode=control-group`, and `OOMPolicy=stop`. It completed in 15.788 s, sampled cgroup current peaked at 217,362,432 bytes (207.3 MiB), and `memory.events` ended with `high=0`, `max=0`, `oom=0`, and `oom_kill=0`. Systemd recorded successful deactivation and 14.897 s CPU time.
- The output hash was the same `fc18fe...de1a`, with schema `4`, algorithm `annual-observation-v4.5.1`, and 2,672 events. Output and normalized cache were private `/var/tmp` paths; the production Annual cache root content mtime remained 2026-09-09.
- Generator admission remains host-global with one running generator and queue capacity 20; renderer admission and its queue were untouched. The input fingerprint continues to include every Annual Python source file, so the synchronized source participates in source/cache invalidation. Cache root/revision semantics, build-state revision, job schema, and API schema were not changed.
- The production NoneBot screen was restarted after synchronization so long-lived imports could not retain old code. Old PIDs `829841/829877` exited and new PIDs `866266/866299` started; OneBot/QQ WebSocket adapters reconnected and resumed event handling. Viewer stayed on PID `566152` with `NRestarts=0` because no Viewer source changed and no Viewer release was warranted.

### 30-minute observation

The post-rollout window ran from 2026-09-20 11:00:06 to 11:30:08 CST (1,801.655 s, 61 samples at 30-second intervals):

- MemAvailable ranged from 15,067.3 to 15,477.2 MiB.
- Memory PSI full reached at most `avg10=0.13` and `avg60=0.05`, well below the admission threshold, and returned to zero.
- The host `oom_kill` counter remained `56 -> 56`; kernel and Annual-worker journals contain no new OOM, timeout, failure, or kill entry.
- Viewer remained active on the same PID with zero restarts. Both new NoneBot PIDs remained alive for every sample.
- No Annual unit was left running, and admission observed no queued, running, or failed ticket during the observation window. The completed smoke ticket remained healthy.

The required gates are therefore closed: canonical/runtime sources are exact, production smoke succeeded, frozen outputs are exact-equivalent, the bounded worker and cgroup are healthy, and no new OOM occurred.

The remaining approximately 150 MiB fixed import/base cost plus history/events/serialization retention is recorded only as a **Phase 2 candidate**. Phase 2 was not started.

## Validation artifacts

Private evidence is retained under `/var/tmp/annual-streaming-phase1/` (0700 inputs/caches/outputs, stage JSONL, 100 ms samples, rollout monitor and manifests). It is not committed. Canonical `/home/sigaer/git/Sakura_bot/taiko/plugins/utils/annual_summary/` and production `/home/sigaer/taiko/plugins/utils/annual_summary/` are now exact matches for this rollout.
