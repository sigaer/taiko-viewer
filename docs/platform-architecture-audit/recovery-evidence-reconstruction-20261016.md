# Minimal recovery evidence reconstruction

The lost recovery evidence has been replaced by **1 isolated MySQL recovery PASS and 14 checkpoint-admission unit PASS**, using the new installed Taiko 0.14.2 candidate. These results retain the original scoped assertions and do not close the formal O1 recovery gate.

- Admission: `/home/sigaer/taiko/qa-vault/runs/qa-9b37dfa703ce/evidence`, 14/14. Exact SQL/publication/file identity binding, cross-generation rejection, in-flight writer, missing projection, combined faults, trusted-manifest digest and unknown revocation continuity remain checked by the standalone admission helper.
- Independent MySQL restore: `/home/sigaer/taiko/qa-vault/runs/qa-518bbc2e2069/evidence/recovery-tnnAr7/evidence.json`, `PASS_SCOPED_SYNTHETIC_RESTORE`.
- Its controlled checkpoint age (scoped RPO) was **145 ms**; incident-to-service-graph readiness (scoped RTO) was **8401.570853 ms**. Readiness includes authorization, current/history and a new core write with increasing publication generation. This first replacement run has no HTTP readiness claim.
- SQL tables, C/H, daily archive/measurement/Goal and synthetic historical Annual identity bytes were restored into an independent MySQL instance and filesystem. Revoked tokens/grants and expired grants remained denied; unknown continuity invalidated restored developer capabilities. Original and restored MySQL exit evidence is retained.
- Actual publication trees and MySQL datadirs live in per-run scratch. Checkpoint originals, independent post-recovery copies, file hashes and logs live in durable evidence. Active publication hardlinks never enter the durable archive. The wrapper removed scratch after all child processes exited.
- The test now binds its evidence to the protected manifest, wheel/origin-evidence hashes, actual installed interpreter and test-source SHA. It preserves the prior business assertions. The original 119/21 suites were not rerun.

Still pending: an independent real HTTP failure/recovery readiness scenario; operational PITR and backup scheduling; authorized off-host recovery destination; deployment restore orchestration and representative full-scale restoration. The admission helper is not a production restore orchestrator. A small quiesced checkpoint cannot establish a continuous 15-minute production RPO. Viewer 0.82 stays BLOCKED; no 0.83 Freeze is declared.
