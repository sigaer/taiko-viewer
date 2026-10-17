# Fast-track synthetic checkpoint recovery

Baseline: clean Viewer `6e7f35b`, version 0.82.1, installed Taiko 0.14.2 center role. Reuse the accepted 21 restoration and 119 worker tests; this change adds one independent-instance checkpoint exercise and does not rerun those suites.

`fastRecoveryCheckpointSql.test.mjs` runs only inside the existing owned SQL runner and memory cgroup. The runner creates its own empty source database; the test creates a separate `--no-defaults --skip-networking` MySQL process and private datadir for restoration. Both prove actual `SELECT DATABASE()` suffix `_test`, actual datadir and explicit mutation opt-in before business writes. It uses the existing real manual account/publication fixture with synthetic catalog/configuration. Files and SQL contain synthetic data only.

The single-writer fixture quiesces writes, records a recoverable checkpoint, serializes actual table DDL/data and copies synthetic current/history/daily and historical Annual JSON. Restoration reads the disk checkpoint into the independent daemon and directory, checks full SQL/file parity, uses installed publication readers and actual source authorization, verifies revoked tokens and revoked/expired grants are denied, and performs a real manual score write with an increasing publication sequence. The original service graph is disconnected before initializing the replacement server. Wall time therefore includes replacement database initialization/import and core-service verification, rather than counting import alone.

An additional fail-closed procedure invalidates every restored developer token/grant if the post-checkpoint revocation journal cannot be proved continuous. This procedure is exercised only in the restored synthetic database. It is not an installed automatic recovery mechanism. Corrupt checkpoint hash mismatch is recorded, without claiming a production restore orchestrator exists.

Limits: this is a cold, quiesced, small synthetic checkpoint exercise, not online PITR, large-scale restoration, complete HTTP/session readiness, encrypted off-host storage or production recovery certification. Existing source fixture catalog/model hooks remain synthetic. Historic Goal/measurement/Annual identities and publication continuity are checked; no algorithm recomputation or compatibility-checkpoint regeneration is used. Full O1 recovery stays BLOCKED until the unproved parts and owner signoff are closed.

See `production-readonly-admission-protocol-20261016.md` for the prepared but unexecuted permission-gated work and twelve-resource backup blocker.

## Observed result

**PASS_SCOPED_SYNTHETIC_RESTORE**, one additional test, zero skips. Evidence: [fast-recovery-20261016.json](evidence/fast-recovery-20261016.json). Actual wheel SHA-256 was checked: `0963350629b261fb5002bf6ef96c6019c22ca5c9515b73279f3c578d8e6725c8`.

Recoverable checkpoint `2026-10-16T02:48:38.219Z`; controlled incident `02:48:38.358Z`; restored core service graph ready `02:48:46.965Z`. Observed checkpoint age **139 ms**, incident-to-ready **8,606.97 ms**. These scoped measurements meet 15-minute / 120-minute thresholds for this small fixture; they do not establish the full O1 disaster-recovery gate. Publication generation stayed at sequence **3** through restore and advanced to **4** only after the new owner write. Historic Annual v4.5.3 report and revoked share, Growth measurement/model identity, Goal, daily archive and SQL/C/H were retained. Revoked token, revoked grant and expired grant were denied by actual authorization functions. Both owned MySQL daemons exited, cgroup OOM/OOM-kill = 0.

Two harness failures remain recorded, with logs and hashes in the evidence: (1) MySQL rejected insertion into the Goal generated column; (2) complete row parity detected timestamp changes after the harness incorrectly classified DEFAULT_GENERATED columns. The final importer excludes only VIRTUAL/STORED GENERATED fields, lets MySQL derive those fields, and still compares every restored row including derived values. No product logic or assertion was weakened.

Minimal recovery blockers: online/representative full-service restore and checkpoint policy; approved encrypted off-host backup plus rights/provenance clearance for all twelve resources; production-only admission/runtime audit and owner signoff. The live audit remains **PENDING_AUTHORIZATION**. Viewer **0.82 BLOCKED**, no 0.83 Freeze.
