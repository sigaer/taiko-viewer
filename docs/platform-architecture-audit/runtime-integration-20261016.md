# Viewer 0.82 Runtime Integration — 2026-10-16

> 2026-10-16 最新隔离候选续行：用户已批准本地 Taiko 0.14.2 验证；详见 [本轮收尾](local-0142-closeout-20261016.md) 和 [Gate 矩阵](viewer082-gate.json)。原时点记录保留。O1 目标已明确、实测未签收；0.82 仍 BLOCKED，未进入 0.83。

**0.82 remains BLOCKED. No 0.83 Freeze, release, production access, merge or push.**
This implements the next work package in
`docs/Viewer_0822_Runtime_Integration_and_API_Readiness_20261016.md` on the isolated
`feat/viewer-1-readiness-20261015` branch. Viewer package version stays `0.82.1`;
the work-package name does not authorize a version bump or deployment.

## Combination and implementation

The Viewer base is `c08ec17`, preserving active `56aa05a` authorization and Writer
changes. Taiko stays at `15722e8`, wheel `0.14.1`; Sakura active `63be19a` is a
read-only source/fixture reference. No old ownership branch was merged.
[Conflict ledger](conflict-ledger.json) records retain/port/defer decisions for
240 Viewer, 775 Taiko and 458 Sakura paths. Deferred host retirement decisions
are not claims of semantic or deployed-process equivalence.

The shared absolute interpreter selector now covers Publication, account
compute, Growth fingerprints, Annual generator/ratings/bootstrap, merged-read
and migrated image callsites. Python business modules and the Annual bootstrap
use `-I`; `PYTHONPATH`/`PYTHONHOME` are removed from compute environments. Data
roots remain explicit. Personal binding checks, Publication leases, typed worker
protocols, public error mapping and Annual admission/cgroup limits are preserved.
Invalid Annual interpreter configuration is rejected before writing worker files.

The first real B30 run found missing `runtime_memory`. This was an omitted
**shared Sakura support artifact**, not permission to copy shared infrastructure
into Taiko. Fixed Git objects were packaged byte-for-byte into a local,
non-editable `python-memory-runtime 1.1.0` wheel. Its packaging metadata is new
integration metadata, not an upstream release. No source `.pth` or import-path
fallback was added, and no previously verified venv was modified.

[Original role locks](runtime-role-locks.json) retain the 93-distribution evidence.
[Supplemental role locks](runtime-role-locks-with-memory.json) define the active
94-distribution candidates. Both were reconstructed offline in new environments
with exact versions, SHA-256 checks, `pip check` and isolated module origins.
Core remains role-specific: center `0.1.1`, client `0.1.2`. Viewer offline compute
belongs to center; invoking it in client correctly trips the existing version
guard. That failed cross-role experiment is retained, not counted as client
lifecycle acceptance.

## New evidence and its limits

| Work | Observed result | Scope / evidence |
| --- | --- | --- |
| R1 exact reconstruction | Both 93-package and new 94-package roles PASS | `evidence/r1-rebuild-*-20261016.json`; no downloads or old site-packages copies |
| Shared support packaging | PASS, source byte parity | [Packaging evidence](evidence/runtime-memory-package-20261016.json) |
| center installed consumers | All five test commands PASS | [94-package integration](evidence/r2-center-integration-94-20261016.json): compute/merged, actual Growth revision, fingerprint fixture, Annual admission/worker, cross Writer |
| Viewer images | B30, precision dimension, radar PASS | [Image retry](evidence/installed-viewer-images-retry-20261016.json); real callsites, PNG hashes, Sharp JPEG, synthetic assets; not frozen legacy Golden |
| center/client Bot public commands | 18 per role PASS | Real installed matcher dispatch on synthetic OneBot/QQ transports; original 93-package logs, plus client 94-package delivery |
| center/client representative lifecycle | 46 per role PASS | [center](evidence/r2-center-lifecycle-94-20261016.json), [client retry](evidence/r2-client-lifecycle-retry-94-20261016.json); frozen test oracle, synthetic SQLite/transport/assets; not production MySQL lifecycle |
| merged SQL/HTTP | 16 PASS, 0 FAIL, 0 SKIP | [Fresh isolated MySQL](evidence/merged-sql-installed-20261016.json); real installed merged worker and owner/grant checks; actual DB proof, mutation opt-in, daemon exit |
| Internal service boundary | 7 PASS | Real handlers/guard with memory business ports; matrix records covered manual/annual-card routes |
| Growth continuity | Full legacy fingerprint and actual Viewer same-stat invalidation PASS | [History evidence](history-continuity-20261016.json); does not establish all measurement/report preservation |
| Source-switch/reappearance | **FAIL reproduced** | Two cases produce forbidden `play_delta=1`; direct-switch control produces 0 |
| Credential control plane | **FAIL reproduced offline** | Anonymous synthetic inputs reach writer spies in current Sakura `/api/token` and miku `/uploadTaikoLogin`; no actual writes or public-network probing |

The prior 92 SQL and 52 Publication results remain historical scoped evidence;
they were not recounted as this round's full-system acceptance. A changed shared
interpreter adapter additionally passed the 17-test consumer/Publication batch.
Scoped TypeScript checking and inventory freshness (28 routes, 39 dependencies)
passed. These checks do not constitute a release build.

Initial failures remain visible: missing shared support; Node strip-only handling
of parameter properties; a missing synthetic catalog during Source-switch setup;
client test-helper discovery under `-I`; and the cross-role compute experiment.
Fixture fixes changed neither product imports nor frozen oracles. The lifecycle
launcher explicitly loads only named test helpers and checks all loaded product
module origins against the installed environment.

All QA/build commands entered the existing memory wrappers serially. The final
integration evidence records command durations, bounded log hashes, process-group
exit and cgroup memory events. Annual tests assert worker cgroup/temp cleanup.
Recorded OOM counters are zero; `memory.peak` is unavailable on this host, so no
peak RSS or product p50/p95/p99 is inferred from test duration.

## Remaining Gate blockers

1. **Credential boundary:** the two reproduced source-level control-plane failures
   prohibit integrating/deploying those paths. Live ingress/ACL, caller identity
   and credential ownership still need separate evidence. The
   [ResourceGrant threat model](resource-grant-threat-model-draft.md) is a draft,
   not a frozen or implemented consent contract.
2. **History facts:** a chart deleted from a full snapshot and later reappearing
   is treated as first-seen play. Preserve the failing assertion and old reports;
   a seen/tombstone-aware repair and owner review of observation semantics are
   needed. No waiver or automatic recomputation was applied.
3. **Runtime cutover:** account-sync, source-mutation, QQ-migration and
   Hiroba-credential runners retain explicit source-controlled compatibility
   boundaries. Other image families, complete Web/renderer flows, all production
   Writers/readers and actual deployed interpreter identities remain unaccepted.
4. **Release/restore/performance:** production catalog identity, network ACL,
   off-host resource backup and restore/RPO/RTO, complete historical measurement
   preservation, and cold/warm product performance remain unverified.

R1 is reproducible as a local artifact combination. R2/R3/S/G have additional
scoped evidence; their joint Gate is not PASS. Do not propose entry to 0.83 yet.

## Rebuild and rollback boundary

Use [runtime-interpreter-scope.md](runtime-interpreter-scope.md) and the exact
manifest/lock digests. Build the shared support package with `run_build.sh`,
then use `rebuild-runtime-role.py --lock-manifest <supplemental lock>` through
`run_qa.sh` into a new venv. Use a new evidence filename for each run. QA absolute
paths locate artifacts only; durable production paths are deliberately unset.

No deployed state changed. A non-destructive source rollback/review is:

```bash
git -C /home/sigaer/taiko/taiko-forum worktree add --detach /var/tmp/viewer-readiness-before-runtime c08ec17
```

That command is a review recipe, not an executed deployment or reset. Reconstruct
the previous role from its original 93-package lock in a new environment when
comparing results; its missing image support remains a known limitation. Do not
reset dirty main worktrees or select the comparison environment for a service.
Production rollback commands require actual deployed commit/interpreter and DB
restore-point signoff; those manifest fields stay null rather than guessed.
