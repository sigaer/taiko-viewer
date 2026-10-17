# O1 Fast Track: isolated request lifecycle evidence

Status: `EVIDENCE_PENDING`; 0.82 remains `BLOCKED`. These measurements do not repeat the accepted lifecycle, worker SQL, credential or PNG suites.

Baseline: local Viewer 0.82.1 / `6e7f35b`, exact center 94-package installed interpreter `/var/tmp/taiko-role-rebuild-hlmgfkq0/venv/bin/python`, Taiko 0.14.2 repack wheel SHA-256 `0963350629b261fb5002bf6ef96c6019c22ca5c9515b73279f3c578d8e6725c8`. The old top-level wheel is a distinct retained build and is not selected. Role lock SHA-256 `dceff2e96b9a115fb61c3b77421f1fcb81844543689d478a2589752d5dab16ab`; pre-existing installed-origin evidence is pinned by SHA in every run.

## Measurement boundary

`taiko_viewer/tests/o1RequestPerformance.test.mjs` starts the actual HTTP routes with the existing fixture's real account/session/developer/grant SQL. Each invocation uses an independently initialized MySQL data directory, actual `SELECT DATABASE()` ending `_test`, explicit mutation opt-in, loopback-only listeners and installed Publication workers. No production config or production SQL is read. SQL fixture schemas intentionally omit FKs in the same way as the already accepted authority fixtures; this is not evidence of production migration timing.

Private current/history requests use a real developer token and explicit per-source service grant. Owner binding is removed before the timed reads so owner access cannot conceal absent grant validation. Unauthorized requests are checked before load. Growth routes use a real session and account binding. Synthetic catalogue transport remains injected; Growth Overview/Passport select actual installed Python and actual model fingerprint. No function-only duration is treated as request SLO.

Wall time starts at HTTP send and ends after response body consumption (and JSON parsing for JSON routes). This includes loopback overhead, SQL authorization, source lock/subprocess startup, reading/replay and serialization. The load model is closed-loop concurrency 1/3/5, not an arrival-rate or production-capacity claim. Queue wait is not separately exposed for read routes; SQL/socket/publication wait remains included in total wall time. B30 is uncached real API generation including PNG-to-JPEG; no cache-hit claim.

Each full cohort requests **200 per scale** (600 total): 32 charts/3 snapshots, 100/30 and 500/90. Scale rows include input digest, fixed fixture epoch, synthetic identity and publication revision for future exact-input comparison. Dates are fixed at `2026-10-16T04:00:00Z`. The harness records all outcomes, per-scale distributions, 429, timeout, dropped and potentially unfinished request counts. First/cold requests are included. No disk cache clearing occurs.

Every scenario gets its own unchanged 15-minute `run_qa.sh` scope, not an expanded limit. Resource samples occur every 200 ms: cgroup memory/current/peak/swap/events/PSI/IO and host available memory; Node RSS/PSS is explicitly process-only. Missing metrics are unavailable, never fake zero. Memory PSI full >=2%, new OOM/OOM-kill or insufficient 30%+3GiB reserve stops scheduling; remaining requests count as dropped. Existing fixture HTTP deadlines are 12s, with a separate 30s B30 deadline; private history's 10s hard cap is scored independently. Aborted requests remain potentially unfinished until cgroup teardown, never silently omitted.

## Reproduce

From the isolated worktree, after coordinator grants the shared host QA slot:

```sh
bash scripts/readiness/run-o1-cohorts.sh /var/tmp/viewer082-o1-cohorts-UNIQUE
```

This runs current/history/Growth History at concurrency 1/3/5, each in its own wrapper/DB. For compute smoke, use the same `run-isolated-sql.mjs --o1=OPERATION:1:3` entry point, choosing `growth-overview`, `growth-passport` or `b30`. `:3` means three samples **per scale**, deliberately insufficient for SLO acceptance. A harness TAP PASS means execution completed; use the `o1-performance.json` status to assess the performance target.

## Remaining scope

- Same-input, same-environment old-artifact comparisons remain `EVIDENCE_PENDING`; a latency miss must not be labelled a new regression until compared.
- Private merged read remains `NOT_TESTED`, separate from single-source history.
- Growth Passport 2000-file extreme remains `NOT_TESTED`, separate from ordinary cohorts.
- Annual warm report read and cold queued lifecycle remain `NOT_TESTED`. Next harness must provision isolated Annual job/summary/beta-policy SQL, mount actual authenticated GET/build/job-poll handlers, create 30 unique cold identities across three history scales, use persistent admission (`generator=2`, `renderer=1`) and actual isolated worker launchers, and measure enqueue-to-complete wall time. Warm rates must be sequential 1/s → 3/s → 5/s with prerequisite checks. Existing generator-only or PNG parity timings are not substitutes. The generic `verify_annual_e2e.mjs` additionally expects a built server and explicit private environment; it must not be pointed at production output/config.
- Empty historical measurement/Goal rows are queried by the real service; this cohort does not claim a large populated SQL-history distribution.

No deployment, restart, push, merge or Freeze is authorized by these results.

## Initial smoke observations (retained)

- Private current initial harness: 3/3 success; P50 80.28 ms / P95 81.76 ms. Raw `/var/tmp/viewer1-sql-58eIiw/o1-performance.json`. This predates the per-scale 200 target and is not a cohort PASS.
- Growth Overview with installed compute: 9/9; P50 399.69 ms / P95 624.04 ms. `/var/tmp/viewer1-sql-GzKN3H/o1-performance.json`.
- Growth Passport with installed compute: 9/9; P50 437.93 ms / P95 1470.75 ms. `/var/tmp/viewer1-sql-uZDrEh/o1-performance.json`.
- B30 first real API fixture: **0/9 success, nine HTTP 500**. `/var/tmp/viewer1-sql-5LZCKV/o1-performance.json`. Missing synthetic dress layers caused `FileNotFoundError`; original failure retained.
- B30 fixture correction creates four synthetic 160×160 dress layers in its owned directory (same class of input as the frozen renderer fixture), with no renderer stub and no public resource mutation. Retry 9/9; P50 4169.56 ms / P95 7050.19 ms. `/var/tmp/viewer1-sql-JoHLDz/o1-performance.json`. Input revisions differ intentionally from the incomplete initial fixture and must be pinned for any old-artifact comparison.

All successful smoke sets have zero timeout/429/OOM, but **remain insufficient samples**. Large B30 cohorts must be split using `--o1-scale=small|medium|large` and `:50` chunks under separate unchanged QA wrappers; four independently recorded chunks yield 200 samples for a given size/load. Aggregate raw samples, never average chunk percentiles. Passport's separate extreme entry is `--o1=growth-passport:1:1 --o1-scale=extreme` (500 charts × 2000 files; 15s single-call bound, no ordinary-percentile mixing). Neither this entry's availability nor the harness code proves that it was run.
