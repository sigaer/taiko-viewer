# O1 operational evidence — 2026-10-16

Overall status: **BLOCKED**, owner acceptance is pending. No production configuration,
private credentials, user records, production SQL or services were accessed in this
round. The closeout work order explicitly requires separate authorization for live
configuration inspection. Repository templates remain design evidence only.

The owner has now defined the [formal acceptance targets](o1-acceptance-targets.json)
for 0.82 through 0.95 RC: RPO ≤15 minutes, core RTO ≤120 minutes, explicit per-product
P95/P99 and hard deadlines, concurrency/sample rules and ≥99.5% supported-load
success with zero OOM. Status is **TARGET_DEFINED / EVIDENCE_PENDING**, not PASS.
Restored grants must not revive revoked access; when revocation continuity cannot
be established, affected tokens must be invalidated and reauthorized.

## Observed locally

- `evidence/final-closeout-baseline-20261016.json` captures actual Git HEAD/tree/branch
  and dirty status without changing any main tree, and verifies 186 role wheel paths
  against the existing 94-distribution locks. Role-specific Core versions and prior
  isolated module-origin proofs remain in the linked runtime manifest.
- A fresh private-socket MySQL instance ran the existing `manualRecoverySql` suite
  with the exact installed center environment: **21 PASS, 0 FAIL, 0 SKIP**. The runner
  checked actual datadir and `SELECT DATABASE() = viewer1_security_test`, required
  mutation opt-in, and terminated its daemon. Synthetic fixtures only.
- These tests cover C/H/daily and SQL owner/binding/measurement/Goal/cursor restoration,
  unchanged field/byte hashes, restored receipt idempotency, conflicting recovery
  inputs, lost COMMIT acknowledgement and four process-death boundaries. A private
  backup restores to a new file root without the original canonical object store.
- The initial invocation stopped at interpreter configuration validation before SQL
  provisioning; retry explicitly passed the non-secret interpreter path through the
  memory wrapper. Both logs are retained in the evidence record.

This is manual-source recovery acceptance within an empty test database. It is not
a full database point-in-time restore, backup of all users, published Annual artifact
restore, proof of all Writer projections, or an off-host disaster recovery exercise.
Test duration is not a product latency benchmark and is not an RTO claim.

## Outstanding acceptance inputs and bounded next actions

| Boundary | Status | Required next action |
| --- | --- | --- |
| Actual deployed commit, interpreter and wheel identity | UNKNOWN | Separately authorize sanitized read-only service/manifest inspection; capture paths and digests, never environment secret values |
| Nginx/listeners/socket owner and mode/network ACL | UNKNOWN | Inspect active configuration and service/socket metadata without requests to private endpoints or service changes |
| Consistent DB + file recovery point | TARGET_DEFINED / PARTIAL EVIDENCE | Meet ≤15 min RPO and ≤120 min core RTO; restore a coherent synthetic DB/file backup into a second empty database and verify mismatch refusal across all authorities |
| Twelve quarantined resources | BLOCKED | Owner specifies approved encrypted off-host destination and key custody; review rights and verify remote restore hashes without publishing private paths |
| Annual/Goal/measurement immutable history | PARTIAL | Include published Annual artifacts and all archive/measurement authorities in joint restore; existing manual-source roundtrip is narrower |
| Product cold/warm performance | TARGET_DEFINED / EVIDENCE_PENDING | Apply the owner's sample/concurrency and latency matrix to same-input old/new request/task lifecycles, with bounded CPU/RSS/I/O/cache/replay sampling |
| Release/rollback | BLOCKED | Obtain actual deployed identity and coherent restore point before writing executable production cutover/rollback commands |

Defined targets are not achieved measurements. Deployment identity and off-host
backup completion remain unverified. `memory.peak` unavailable in prior runs stays UNAVAILABLE. Local
`/var/tmp` artifacts are reproducible QA evidence, not durable off-host backups.
