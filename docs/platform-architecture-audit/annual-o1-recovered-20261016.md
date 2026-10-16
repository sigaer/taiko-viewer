# Annual O1 — recovered installed candidate

Status: `FAIL_RESOURCE_STOP` for formal cold; formal warm remains `PASS_SCOPED`. Viewer remains 0.82.1 / 0.82 BLOCKED. No deployment or production access.

The harness uses authenticated HTTP routes, isolated SQL job rows, persistent Annual admission and the installed Taiko generator in a bounded systemd worker. Generator capacity remains 2 and renderer capacity 1. The 22 GiB Annual disk boundary, memory pressure checks, worker deadlines and network/filesystem restrictions are unchanged. Test-only worker units bind to their owning QA unit so scratch cleanup follows worker shutdown.

Paths are per-run vault scratch/evidence, and the interpreter must match the protected artifact manifest. Each result records manifest SHA, candidate identity, Viewer HEAD/version, harness hash, synthetic input hash, queue lifecycle wall time, request outcomes and 200 ms resource samples. Polling can miss brief worker peaks; wrapper cgroup evidence remains part of review.

## Retained preparation failures

- `qa-87c1a800ccdb`: SQL bootstrap rejected the new vault datadir because its old `/var/tmp` allowlist remained. No Annual request or worker was executed. Fixed in `e7bcf30`, retaining actual `SELECT DATABASE()`, datadir and mutation opt-in guards.
- `qa-703cdec083df`: actual Annual POST returned HTTP 500 because the shared source-write fixture incorrectly required a source writer lease for Annual queue SQL. The Annual-only fixture now asserts the existing `none` lease mode; source-write tests keep their original assertions. This failed request remains recorded in `annual-o1-k2T5dJ/evidence.json` and is not counted in the later formal warm cohort.

These are setup/fixture failures, not successful latency samples. Original logs and manifests remain under `/home/sigaer/taiko/qa-vault/runs/<run>/evidence/`.

## Smoke

`qa-61192ba89124`: PASS, `annual-o1-1cFdOD/evidence.json`.

- Actual authenticated queued cold job completed in 3621.116 ms, including POST and polling.
- Fresh algorithm `annual-observation-v4.5.4` report served at 1/s, 3/s and 5/s, three requests each, all successful. These nine requests are smoke only.
- Worker admission completed; no resource alarm was observed. The synthetic my-don snapshot was unavailable and exercised the existing fallback; this does not establish poster rendering readiness.
- The smoke cold sample and cold jobs used to prepare warm reports are excluded from the formal 30-user cold distribution.

## Formal cohorts

Warm: **PASS**, `qa-287cb26197ae/evidence/annual-o1-WUpDqP/evidence.json`. The cached report used 3 synthetic snapshots ×16 charts. Each rate completed 200/200 successful requests, with zero failures, timeouts, 429 or drops. P95/P99: 1/s **88.448/98.610 ms**, 3/s **80.515/93.016 ms**, 5/s **75.089/84.222 ms**. Resource alarm was null; wrapper and SQL daemon exited and owned scratch was removed. Measured Viewer HEAD `680a749f2e851fb94e16634f242d8efa24f8feea`, harness SHA `442a27654ca4fb0e3c1b2448d2686e190c52c044c145f85838948ba9f68682d9`. Structured evidence pins all source, manifest and candidate hashes in `evidence/annual-o1-recovered-20261016.json`. A stage must satisfy success ≥99.5%, P95 ≤800 ms and P99 ≤2000 ms before advancing. All failures, timeouts, 429 and dropped arrivals are recorded.

Cold: **FAIL_RESOURCE_STOP**, `qa-5593936cff4c/evidence/annual-o1-A3cg7j/evidence.json`. First high-scale queued task stopped at 52.654 s when host memory PSI full avg10 crossed 2%; observed maximum 5.99%. **0 completed / 1 failed submitted / 29 not executed**, out of 30 planned. Low/mid files were cancelled before submission. No further cold or poster load was launched. Worker sampled memory.current reached 1,073,774,592 bytes, swap 128 MiB, memory.high 387 events, OOM/oom_kill 0; memory.peak/io.stat were unavailable. Host-wide PSI plus worker reclaim is correlated evidence, not exclusive causal attribution or a migration-regression conclusion. Full raw PSI and worker/QA counters, inactive-unit proof and immutable artifact hashes are in `evidence/annual-o1-cold-resource-stop-20261016.json`.

The owning QA unit was explicitly stopped after the resource alarm. Its original wrapper manifest reports exit 0 because systemd stop succeeded; **this is not a task PASS**. The explicit Annual FAIL and abort record take precedence; original evidence was not edited. Worker/QA units are inactive and owned scratch was removed. The cold launcher has been adjusted to run each scale as a separate SQL child and stop immediately on failure; this adjustment is prepared, not revalidated after the pressure stop.

Original cold plan: ten isolated three-user rounds (low: 3 snapshots ×16 charts; mid:40×100; high:200×500). Each test file has its own process because Annual admission caches its root at module initialization. At least 30 distinct users, including ten per scale, are required. API task wall time includes queueing; target P95 ≤30 s / P99 ≤90 s, maximum180 s. These cohorts do not raise generator capacity or claim generator-concurrency saturation.

Poster cached/new rendering: `NOT_TESTED_AFTER_RESOURCE_STOP`; do not infer it from report GET or generator success. A synthetic-HTML renderer + authenticated cache API test is prepared but was not run. Local Chromium and public background assets exist; a local Nuxt page build is absent, so even that partial test would not establish real Vue-page first-render SLO.

Commands run only through `scripts/memory/run_qa.sh`:

```sh
/usr/bin/python3 taiko_viewer/scripts/performance/run-annual-o1.py smoke
/usr/bin/python3 taiko_viewer/scripts/performance/run-annual-o1.py warm
/usr/bin/python3 taiko_viewer/scripts/performance/run-annual-o1.py cold
```

The cold command runs one bounded three-user round. The summary tool requires explicit `--warm=<evidence.json>` and `--cold=<evidence.json>` inputs; never include smoke in the formal input list. It rejects mixed runtime manifests/harness revisions and retains all submitted attempts. Individual cohorts are not an O1 or Freeze signoff.
