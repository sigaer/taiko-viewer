# Memory engineering guidelines

Applies to Viewer, Annual runtime, local development and QA. Annual semantics, output schema, title/standing rules and algorithm version do not change for memory work without an independently reviewed equivalence test.

## Admission and isolation

- Run new ad-hoc Node/Python/browser validation through `bash scripts/memory/run_qa.sh <absolute-command> [args...]`. This Linux host has cgroup v2/systemd; fail closed if isolation is unavailable. Do not silently fall back to an unlimited shell.
- The runner serializes QA using a host lock, gives the entire process tree MemoryHigh 2 GiB / MemoryMax 3 GiB / MemorySwapMax 256 MiB, TasksMax 256, two CPU cores and 15-minute lifetime. Node heap is 1536 MiB; native memory and browser children are covered by the cgroup, not the heap flag.
- Memory isolation is not database isolation. Mutating tests still require the existing test-DB guard, an actual `SELECT DATABASE()` ending in `_test`, and explicit mutation opt-in; private configuration stays outside Git.
- These are initial **ad-hoc QA** limits, not production budgets or a limit on MySQL. Heavier work needs a recorded peak and a separately budgeted scope. Never increase limits just to make a test pass. Existing editor sessions are not retroactively isolated by this runner.
- Do not overlap QA, cold profiling and deployment builds on this shared host. Production traffic is not test load. Preserve the standard deploy script's existing flock, heap limit and release procedure; do not start a second build or manually replace output.
- New dev servers need a named bounded scope, disk-backed TMPDIR, owner/task ID and cleanup in `finally`/shell trap. At task end verify the listener and descendants exited. Inspect PID start time, cwd, parents, connections and ownership before stopping old sessions; never `pkill node/python/chrome`.
- Leave 25–30% RAM safety reserve plus explicit kernel/cache and admin reserves. Swap usage alone is not a reason to kill services, swapoff or drop caches. Admission also uses MemAvailable, PSI and swap IO.

## JS / Node

- Streams before whole-file `readFile` for large objects. To hash, `createReadStream` → incremental `hash.update`; do not load, copy or stringify binary for hashing.
- **Never `assert.deepEqual(Buffer...)` or `assert.deepStrictEqual(Buffer...)`**, including buffers returned by file reads/screenshots or arrays of binary bytes. Failure formatting can dwarf the input. For already resident bounded buffers, `assert.ok(a.equals(b), 'binary mismatch')`; for files, compare streamed hashes. Report only size/hash/result and private artifact paths.
- Do not stringify huge assertion operands or an entire error object and then `.slice()`: allocation already happened. Bound entries/fields before serialization.
- No unbounded `Promise.all` over accounts, jobs, snapshots, filesystem trees or remote images. A genuinely fixed small card image set may run concurrently, with decode/load deadlines. Use a bounded pool for variable collections.
- Avoid large base64/data URLs: encoded text expands bytes and often creates additional JS/native copies. A small bounded QR code is a documented exception, not permission to encode Poster PNGs.
- Avoid full deep clones and chained copy/sort/filter passes over large datasets. Retain one authoritative object, compact indices or read-only shared structures. Do not mutate shared data accidentally.
- Bound caches by count/bytes/TTL and explicitly release per-job references. Promise closures, error buffers and logs can retain large objects after visible work finishes. File write paths need size/time bounds and atomic publication.
- Global worker admission must cover **all entry points**, including admin preview and synchronous share-card requests. Per-user locks are not a global resource budget. In-process counters do not protect multiple Node replicas.

## Python

- Prefer generators/iterators and incremental parsing when inputs are large. Keep only necessary previous/current state and compact metadata where semantics permit.
- Maintain bounded workers. Release per-user data at job end; a short-lived child process provides reliable reclamation across Python allocator fragmentation.
- Preserve Annual changed_keys, copy-on-write chart sharing and canonical signatures. Do not replace COW with repeated full-state deep copies.
- Before streaming snapshot history, prove ordering, deduplication, lineage inference, boundary/baseline state, input fingerprint and observed-event semantics remain equivalent. Use a two-pass metadata index if needed; do not stream in arbitrary filesystem order.
- Avoid retaining all raw payloads beside all reconstructed states. Full snapshot inputs, canonical JSON strings/bytes and output serialization can overlap at peak. Optimize one lifetime at a time with measured RSS/PSS and unchanged results.

## Images

- Keep one canonical file/Blob representation where possible. Account for at least width × height × 4 raw bytes per decoded surface. 1080 × 1648 RGBA is ~6.79 MiB; deviceScaleFactor 3 makes raw pixels nine times larger.
- Avoid full-frame canvas → ImageData → base64 → Buffer copies. Browser capture may internally return a Buffer even with a path; ignore the return value unless required and do not retain successive results.
- Screenshot to a file; use bounded decode/font waits. Never `display:none` a capture root to reduce memory. Keep the existing fallback/readiness behavior.
- Download via Blob/object URL where supported, revoke URLs, remove temporary nodes and close contexts. The accepted server PNG may briefly coexist with a single write buffer; this alone is not proof of a leak.

## Validation

- One browser and one active page by default; close each page in `finally`, then context and browser in outer `finally`. Bound the entire job, including evaluate/fonts/browser.close, not only navigation.
- Save screenshots via `path`; keep diagnostics small and stream hashes. Never replay the historical runaway deep-assertion failure on the production host.
- Record cgroup, per-process tree peaks, duration, exit status and OOM events. Polling misses sub-second peaks; pair it with OS maximum-RSS accounting when possible.
- On timeout/failure, terminate only the owned cgroup and verify no child Chromium/listener remains. The runner's transient service uses `KillMode=control-group` and `OOMPolicy=stop`.
- Temporary artifacts go to `/var/tmp` or another disk mount, not `/tmp` on this host. Heap snapshots need an explicit disk quota and retention plan; never auto-dump gigabytes into tmpfs during an OOM.

## Monitoring and interpretation

`taiko-memory-monitor.service` samples every 15 seconds into `/var/log/taiko-memory`, with top-15 PSS once/minute, 14-day retention and 32 MiB/day cap (~448 MiB maximum plus one record). Daily filenames rotate in UTC. It records MemAvailable/swap, cumulative paging counters, memory/IO/CPU PSI, load/CPU/disk counters and selected cgroup current/swap/events. Derive si/so and utilization from counter deltas; do not interpret cumulative totals as rates. PID names are captured, not arguments, environment or credentials.

Collector budget: MemoryHigh 64 MiB / Max 128 MiB / SwapMax 0 / TasksMax 16 / CPUQuota 10%. At the daily cap it stops appending until the next day; monitor file age/size and service health externally. This is telemetry storage, **not an installed paging/notification integration**. Alert suggestions: MemAvailable < 6 GiB for 60s (warning), < 3 GiB (critical), sustained memory PSI full > 2%, swap IO with IO PSI growth, or any new oom_kill event. Tune from a week of normal traffic.

PSS apportions shared resident pages; RSS sum double-counts shared pages. Per-process VmSwap does not account for all tmpfs swap. Report resident production, swapped production pages, tmpfs and headroom separately. `MemoryHigh` causes pressure/reclaim and is not a hard boundary; `MemoryMax` is the last-resort boundary. Existing page-cache charges and shared pages mean cgroup usage and process PSS need not match. [Kernel cgroup v2 documentation](https://docs.kernel.org/admin-guide/cgroup-v2.html), [PSI documentation](https://docs.kernel.org/accounting/psi.html).
