# Local 0.14.2 candidate validation — 2026-10-16

This is the owner-approved **local** Taiko 0.14.2 candidate with Viewer 0.82.1.
Overall 0.82 remains **BLOCKED**. No production inspection, deployment, restart,
push, main integration or 0.83 Contract Freeze occurred.

## Artifact and environment

The wheel is built from Taiko `a632913dfbdbec1d465f8eaccc0bb80c35e25745`,
including the credential authorization and observation reappearance fixes.
SHA-256: `0963350629b261fb5002bf6ef96c6019c22ca5c9515b73279f3c578d8e6725c8`.
The build audit rejects runtime data and bundled tests. Its only non-code package
data are the existing Growth compatibility checkpoint, Annual schema and title
reference. The original checkpoint was not regenerated to hide revision changes.

[Exact role locks](runtime-role-locks-0142.json) replace only taiko-bot; the other
93 distributions per role are unchanged. Both roles were rebuilt offline into new
venvs, verified with pip check and actual isolated module paths. Core remains
0.1.1 for center and 0.1.2 for client. Old environments are unchanged.

## Validation and retained failures

See [candidate evidence](evidence/candidate-0142-closeout-20261016.json) for the
final counts, log hashes, interpreter paths and individual outcomes.

- The original three source-switch reproductions return zero play deltas. The
  unchanged 28-case fact matrix passes against installed modules.
- Installed credential tests cover the actual handler and signing CLI: 11 PASS.
  These use synthetic secrets, loopback HTTP and writer spies. Unrelated public
  score imports are stubbed; no live ingress or upstream signature claim follows.
- Both installed roles pass their 46 representative lifecycle cases. Actual
  Viewer compute/Growth/Annual/Publication consumers pass their scoped tests.
- Four worker SQL suites pass 119/119 with zero skips and OOM; the isolated
  daemon exited. Five image families pass all 12 frozen PNG hashes (190.231 s).
  These are correctness checks, not the O1 latency load campaign.
- The first candidate batch remains FAIL: its fact harness omitted compute-only
  mode and its credential harness had a cleanup syntax error. Both are repaired
  in test-only changes and rerun separately. The product wheel is unchanged.
- Initial build failures remain recorded: an old builder rejected SPDX metadata;
  the modern builder produced a wheel containing plugin tests, caught by the
  artifact audit. Source packaging now excludes test packages.

The earlier full combined source suite remains 300 PASS / 7 private-fixture SKIP /
1 retained strict identity FAIL. This is **not** an installed full-suite result.
The intentional Annual revision changes only summary/poster identity, algorithm
version and input fingerprint in the separate preservation test. Viewer product
replay remains 117 PASS / 2 retained FAIL: an old source-layout assertion and a
legacy Passport oracle that emits now-rejected low-trust attendance. Neither
oracle was weakened or converted to xfail. These still require explicit review.

## Annual continuity

Viewer now declares `annual-observation-v4.5.4`, matching the wheel. Reading a
saved report is separated from selecting a cache for a new build: valid v4.5.2
and v4.5.3 artifacts remain readable under their original identities, while a new
v4.5.4 build cannot reuse them as its current algorithm result. Existing binding,
report-period and manual-correction checks remain enforced. The actual extracted
saved-report reader is tested with synthetic old/new files and unchanged bytes.
This is not proof of every existing production report or share artifact.

Implementation commit: `166897d`. The [current local runtime manifest](runtime-manifest.json)
records the fixed wheel source and subsequent test-only Taiko commits separately.
Final scoped TypeScript checks and audit freshness (28 routes / 39 dependencies)
passed; see `evidence/final-checks-0142-20261016.json`.

## Remaining acceptance

[O1 targets](o1-acceptance-targets.json) are TARGET_DEFINED / EVIDENCE_PENDING:
RPO ≤15 min, core RTO ≤120 min, product-specific P95/P99, supported-load success
≥99.5% and OOM zero. The 21-test manual recovery proof is scoped to synthetic
SQL/C/H/daily/measurement/Goal restoration, not complete PITR or off-host recovery.
Full performance campaigns, 12-resource encrypted off-host backup, restoration
of authorization continuity and actual production manifest/ingress/ACL remain
unproven. The work order requires separate authorization for live configuration
inspection. Owner signoff is required before 0.82 PASS or starting 0.83.
