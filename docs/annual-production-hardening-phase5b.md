# Annual Production Hardening — Phase 5B

## Decision

**ANNUAL PRODUCTION HARDENING — READY FOR LAUNCH**

The launch design uses real-time cold generation. **NO PRECOMPUTE REQUIRED.** The frozen Annual algorithm remains `annual-observation-v4.5.1`; generator concurrency remains 2, renderer concurrency remains 1, and the worker cgroup limits are unchanged.

Phase 5B replaces the generator's process-local pending array as the source of truth with a durable database queue. The host admission ledger remains in front of the actual bounded worker launch, where it continues to enforce cgroup isolation, memory/PSI headroom, release-build exclusion and the 2-generator limit. Renderer admission remains an independent concurrency-1 queue with cap 8 and TTL 600 seconds.

## Queue before and after

| Property | Before | Phase 5B |
| --- | --- | --- |
| Generator source of truth | Node process array plus host file reservation | `web_annual_summary_jobs` |
| Active states | queued/running/completed/failed | queued/running/completed/failed/expired/cancelled |
| Capacity | 20 queued items | 300 hard items **and** 270 queued worker-seconds |
| Claim | process-local shift | atomic DB claim under a cross-process named lock |
| Crash recovery | reset all running at startup | 45-second lease, 10-second heartbeat, at most 3 attempts |
| Duplicate request | local/file best effort | DB-enforced active-key single flight across tabs and Viewer processes |
| Capacity response | file queue rejection | 429/503 with `Retry-After`; no doomed job is inserted |
| Queue TTL | 600 seconds | 600 seconds, retained as an abnormal-backlog guard |

The durable record stores job/user/binding identity, algorithm version, full input fingerprint, source revision, estimated service seconds, timestamps, lease owner/expiry, heartbeat, attempts and a bounded failure code/message. It stores no raw userdata.

Completed valid summaries remain cache hits. Queued/running work with the same logical key joins the existing job. An unchanged terminal failure remains terminal until explicit retry. If a queued source changes, the queued revision is expired and replaced on the next admission; if a running source changes, publication revalidation prevents the stale result becoming current.

## Work-budget model

Phase 5A measured 102.88 jobs/min for the population mix and 41.56 jobs/min for a tail-heavy mix. Per-job estimates use the Phase 5A bucket P95 classes (A–F: 0.9, 1.4, 1.7, 2.5, 8.7 and 30.1 seconds) with a source-byte lower bound of `0.5 + bytes / 12 MiB`, capped at 60 seconds.

The queue budget is:

`2 workers × 180 seconds target window × 0.75 safety factor = 270 worker-seconds`

This deliberately targets a much shorter normal wait than the 600-second expiry guard. The 300-item ceiling protects the database from arbitrarily many tiny jobs, while the work ceiling prevents a small number of heavy F jobs from masquerading as a light queue. Oldest age, disk state and host headroom are checked independently; raising the count ceiling does not bypass them.

All current cold jobs are interactive FIFO work. The schema can add priority later, but Phase 5B adds no background or precompute scheduler.

## Durability and recovery

- Admission and claim serialize through a database named lock; `active_key` is unique while a job is queued/running.
- A claim atomically verifies the global running count is below 2 and assigns its lease.
- Heartbeats extend only the matching owner's live lease. Completion/failure is conditional on that owner.
- An expired lease is requeued; the third interrupted attempt becomes a terminal `ANNUAL_LEASE_EXHAUSTED` failure instead of looping.
- Viewer restart leaves queued rows intact. Running rows are reclaimed only after lease expiry; legacy rows without a lease are also recoverable.
- One failed or malformed account releases its dispatcher slot and cannot stop later FIFO jobs.
- The existing four-minute worker hard timeout, transient cgroup lifetime and `KillMode=control-group` remain authoritative, so a timed-out Python child cannot continue in the background.
- Poster jobs retain their separate queue and renderer-1 admission. Poster failure never changes a completed summary job.

The test-database integration covered queue expiry races, duplicate single flight, global N=2 claiming, heartbeat renewal, lease-expiry reclaim, second-attempt ownership and terminal failure preservation. The actual database was verified as `taiko_annual_poster_test` with `taiko_viewer_test@127.0.0.1` and explicit mutation opt-in before fixtures were created; fixture rows were removed afterward.

## Source and publication safety

The complete input fingerprint is captured at admission, checked before worker launch and checked again immediately before publication. A changed fingerprint produces `ANNUAL_INPUT_SUPERSEDED`; it never publishes the stale result.

Summary, events and optional MyDon files use private temporary files, file `fsync`, atomic rename and directory `fsync`. A new database row is inserted only after all essential files are complete. The old valid result is never deleted before a successful replacement. Storage retains the newest two unshared revisions; active shared revisions are protected. Cleanup failures after publication are fail-soft and cannot remove the newly committed result.

## Disk model

The production filesystem is 314.91 GiB total. Pre-rollout free space was 32.58 GiB; Phase 5A observed a temporary low of 18.50 GiB and a later recovery to approximately 32.9 GiB. The final summary/events projection for all 1,618 eligible accounts is 1.32 GiB, while normalized cache already consumes approximately 3.64 GiB allocated.

| State | Available space | Behavior |
| --- | ---: | --- |
| NORMAL | at least 28 GiB | normal cold admission and optional cache use |
| LOW | 22–28 GiB | final outputs remain allowed; normalized cache cleanup targets 28 GiB |
| CRITICAL | 20–22 GiB | reject new cold builds with retry semantics; cached summaries/site remain readable |
| EMERGENCY | below 20 GiB | same fail-soft read/degraded behavior; the established 20 GiB safety floor is not consumed |

The 22 GiB cold-build cutoff reserves 2 GiB above the existing safety floor for essential result/temp/log activity. The 28 GiB recovery target leaves operational margin for the projected complete summary set and unrelated service writes.

Normalized cache is optional. Its high-water quota is 6 GiB and cleanup target is 5 GiB, with a 30-day age policy. Invalid/old algorithm revisions are ordered before current-revision LRU candidates; content hashes referenced by retained canonical results are protected. Cache read/write failure remains non-fatal to final summary generation. Current summaries, userdata, databases and incident evidence are never cache-eviction targets.

Worker temp space remains disk-backed at `/var/tmp/taiko-annual-workers/<admission UUID>`. Normal success, failure and timeout paths remove it. The orphan janitor accepts only UUID-shaped Annual-owned directories older than 30 minutes, skips active admission-ledger entries and existing generator/renderer cgroups, and never scans or deletes unrelated `/var/tmp` entries.

## Failure isolation and circuit breaker

Three infrastructure failures within five minutes open a five-minute process-local cold-build circuit. Counted causes are worker OOM, launcher/admission failure, DB queue/heartbeat/lease failure and disk critical state. While open, cold admission returns 503 with `Retry-After`; cached Annual results and the rest of Viewer remain available. Successful generation clears the rolling failure series.

Capacity saturation returns 429 with `Retry-After: 30`. Disk/circuit degradation returns 503 with a bounded retry delay. Insufficient source history remains a distinct `INSUFFICIENT_DATA` terminal job. The UI recognizes queued, running, completed, failed, expired and cancelled states and polls for at most 15 minutes, covering the 10-minute queue guard plus the four-minute worker bound.

## Burst simulation

The deterministic verification uses the Phase 5A population shares and conservative bucket service estimates. It does not launch hundreds of real generators.

| Arrival | Accepted / rejected / expired | Max queue | P50 / P95 / max wait | Last completion |
| --- | ---: | ---: | --- | ---: |
| 50 in 10 s | 50 / 0 / 0 | 34 | 16.4 / 28.3 / 29.6 s | 41.0 s |
| 100 in 30 s | 100 / 0 / 0 | 59 | 22.0 / 62.5 / 64.7 s | 95.6 s |
| 200 in 60 s | 200 / 0 / 0 | 113 | 40.0 / 106.6 / 113.6 s | 178.2 s |
| 1,500 in 30 min | 1,500 / 0 / 0 | 21 | 0 / 14.1 / 24.8 s | 30.04 min |
| 2,000 in 30 min | 2,000 / 0 / 0 | 91 | 13.4 / 69.0 / 81.2 s | 31.11 min |
| 1,500 in 60 min | 1,500 / 0 / 0 | 6 | 0 / 0 / 13.3 s | 60.02 min |
| 2,000 in 60 min | 2,000 / 0 / 0 | 8 | 0 / 0.7 / 13.6 s | 60.02 min |

Instantaneous fixture admission also covered 50/100/200/500 jobs. With a uniform 3-second estimate, the 270-second budget accepts 90 and explicitly rejects the remainder; an all-heavy 30-second fixture accepts 9. No rejected fixture creates a database job. This is intentionally different from an unlimited queue.

## Operational visibility

`/var/lib/taiko/annual-admission/metrics.json` is refreshed every minute and contains:

- generator/renderer running counts, queue depth, queued work and oldest age;
- 24-hour completed/failed/expired counts, cold/cache-hit counts, mean cold duration and duration buckets;
- durable rejected/expired/OOM/launcher/DB-queue counters;
- disk state/free bytes, normalized cache/result/poster/temp bytes;
- MemAvailable, memory PSI full and IO PSI full;
- 24-hour sync count, sync-to-Annual correlation and average request lag.

Alerts are emitted for 80% work-budget use, eight-minute oldest age, any non-NORMAL disk state, memory PSI full at least 2%, normalized cache above 6 GiB, Annual temp above 512 MiB, recent worker OOM/launcher/DB failures, generator running above 2 or renderer running above 1. Existing Viewer HTTP/systemd and host OOM monitoring remains the authoritative site-level alert path.

## Verification and launch gate

- Annual contract/presentation/device tests: 13/13 passed.
- Host admission and hardening tests: 12/12 passed.
- Real MySQL durable-queue integration: passed.
- Phase 5B files introduced no new filtered Nuxt type diagnostics; the repository-wide typecheck still reports unrelated pre-existing baseline errors.
- Production Nuxt/Nitro build: passed in the standard 4 GiB V8 heap / 5 GiB bounded build profile.
- Algorithm, FinalTitle/strongDan semantics, generator/renderer limits and worker cgroup limits were not changed.

The launch gate is satisfied by finite work-budget admission, explicit retry responses, durable restart recovery, cross-process single flight, double source revalidation, atomic replacement, disk tiers, bounded workers, queue/host metrics and fail-soft behavior. Public arrivals following register/login/bind/sync need no bulk precompute under the measured Phase 5A distribution.

Do not enable concurrency 3 and do not start a precompute or new algorithm phase from this decision.
