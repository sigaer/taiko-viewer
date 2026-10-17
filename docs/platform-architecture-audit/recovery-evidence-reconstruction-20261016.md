# Minimal recovery evidence reconstruction

The lost recovery evidence has been replaced by **1 isolated MySQL recovery PASS and 14 checkpoint-admission unit PASS**, using the new installed Taiko 0.14.2 candidate. These results retain the original scoped assertions and do not close the formal O1 recovery gate.

- Admission: `/home/sigaer/taiko/qa-vault/runs/qa-9b37dfa703ce/evidence`, 14/14. Exact SQL/publication/file identity binding, cross-generation rejection, in-flight writer, missing projection, combined faults, trusted-manifest digest and unknown revocation continuity remain checked by the standalone admission helper.
- Independent MySQL restore: `/home/sigaer/taiko/qa-vault/runs/qa-518bbc2e2069/evidence/recovery-tnnAr7/evidence.json`, `PASS_SCOPED_SYNTHETIC_RESTORE`.
- Its controlled checkpoint age (scoped RPO) was **145 ms**; incident-to-service-graph readiness (scoped RTO) was **8401.570853 ms**. Readiness includes authorization, current/history and a new core write with increasing publication generation. This first replacement run has no HTTP readiness claim.
- SQL tables, C/H, daily archive/measurement/Goal and synthetic historical Annual identity bytes were restored into an independent MySQL instance and filesystem. Revoked tokens/grants and expired grants remained denied; unknown continuity invalidated restored developer capabilities. Original and restored MySQL exit evidence is retained.
- Actual publication trees and MySQL datadirs live in per-run scratch. Checkpoint originals, independent post-recovery copies, file hashes and logs live in durable evidence. Active publication hardlinks never enter the durable archive. The wrapper removed scratch after all child processes exited.
- The test now binds its evidence to the protected manifest, wheel/origin-evidence hashes, actual installed interpreter and test-source SHA. It preserves the prior business assertions. The original 119/21 suites were not rerun.

Still pending: operational PITR and backup scheduling; authorized off-host recovery destination; deployment restore orchestration and representative full-scale restoration. The admission helper is not a production restore orchestrator. A small quiesced checkpoint cannot establish a continuous 15-minute production RPO. Viewer 0.82 stays BLOCKED; no 0.83 Freeze is declared.

## Independent real HTTP recovery scenario

New test `httpRecoveryCheckpointSql.test.mjs` passed on the rebuilt installed candidate: `/home/sigaer/taiko/qa-vault/runs/qa-010859c89224/evidence/http-restore-IQQ5VK/evidence.json`, status `PASS_SCOPED_HTTP_RESTORE`. This is a new test; it does not alter the signed-off service-graph scenario.

- A real loopback profile request returned **500** after the application DB connection graph was deliberately disconnected.
- A second owned MySQL instance restored the quiesced checkpoint and filesystem. Actual login/session/profile, private current and nonempty history requests then succeeded. Before/after response hashes and publication identity headers matched strictly.
- Actual manual-score POST returned **200**; publication generation increased **3 → 4**, and subsequent current GET returned changed content.
- Revoked developer token returned **401**; revoked and expired grants returned **403**. When revocation continuity was treated as unknown, invalidating restored developer credentials and account sessions made both HTTP rereads return **401**.
- Observed checkpoint age: **141 ms**. Wall-clock incident-to-HTTP-core-ready time: **7864.9828 ms**, including the failed HTTP probe, replacement initialization, import, new login, authenticated reads, core POST and follow-up GET.
- Requests execute the actual route handlers and services. A test-local module resolver supplies the real auth/manual exports missing from the existing fixture barrel; it does not stub handler behavior. The usual synthetic catalog/SQLite-free SQL configuration remains explicit.
- `web_user_sessions.session_token` contains raw session credentials. Consequently, the restorable SQL checkpoint existed only in owned scratch, which was removed after both MySQL daemons exited. Durable evidence contains the original checkpoint SHA and a clearly marked **non-restorable redacted SQL archive**. Its one session row is SHA-redacted. Response bodies, cookies and raw developer tokens are not archived.

This closes the missing **synthetic HTTP readiness evidence**, not the production recovery gate. There is still no production PITR, ongoing backup schedule, full-scale outage exercise, authorized off-host destination or production restore orchestrator claim. The standalone 14-case admission helper remains a separate synthetic validation boundary.
