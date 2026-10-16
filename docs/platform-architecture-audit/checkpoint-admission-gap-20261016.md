# Checkpoint admission gap review

The independent-instance recovery evidence remains valid **only for its quiesced synthetic checkpoint**. Its SQL and file hashes were verified separately after copying a single known snapshot. It did not deliberately mix SQL generation N+1 with filesystem generation N, lose a current projection during an in-flight write, or reject their combination. Neither its scoped RPO/RTO nor the separately accepted lifecycle fault tests close this gap.

A new offline recovery-tool helper, `scripts/readiness/checkpoint-admission.mjs`, accepts an externally pinned committed manifest digest and observed checkpoint inventory. It binds SQL bytes, the SQL collector's claimed publication identity, the filesystem publication identity (source/sequence/commitId), and exact current/history/daily/Annual inventories. Unknown revocation continuity rejects admission with an instruction to invalidate before reopening access. This helper performs no filesystem, SQL or runtime mutation and is not wired into production restoration.

Pure synthetic tests add rejected SQL swaps, SQL/publication generation disagreement, commit disagreement, missing/replaced current/history/daily/Annual files, in-flight observations, uncommitted manifests, an older whole-manifest substitution, and a combined in-flight + generation mismatch + missing projection. All mismatch reasons survive combined failure; no partial admission is possible.

## What this does not prove

The trusted digest must come from an independent committed checkpoint ledger, not be freshly calculated from an arbitrary supplied manifest. The `sqlPublication` and writer-state fields are collector-supplied assertions: matching them does not establish that the collector actually acquired a cross-store atomic snapshot or recovered an interrupted commit. This tool detects inconsistent supplied artifacts; it cannot detect a collector that labels a self-consistent but stale artifact incorrectly. It does not prove a production ledger exists, has an authenticated chain, excludes rollback or covers revoked credentials after the checkpoint.

The shortest remaining implementation/validation step is a real restore coordinator and checkpoint collector that atomically records SQL transaction/publication/archive identities, handles in-flight operations, verifies lost-projection recovery, and replays or invalidates authorization continuity before reopening the full service. Then inject all three faults against actual SQL/publication services in the independent-instance exercise. The existing passing test and its archived source hash remain unchanged; no accepted suite is rerun for this tool-only addition.

Production admission audit, authorized encrypted off-host storage/12-resource provenance and full-service representative RPO/RTO remain separate blockers. **Overall 0.82 BLOCKED.**

New helper validation: **14 PASS / 0 FAIL / 0 SKIP**, under the existing QA wrapper. Evidence: [checkpoint-admission-20261016.json](evidence/checkpoint-admission-20261016.json). This status applies to the pure synthetic recovery-tool verifier, not a production restore coordinator or fault-injected cross-store transaction.
