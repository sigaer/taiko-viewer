# Representative installed lifecycle reconstruction

The recovered 0.14.2 center and client roles each pass all **46 original lifecycle parity events** (92 total). Business assertions, event classification, expected messages and SQL/API effect comparison remain unchanged. This is the representative lifecycle scope, not the full historical lifecycle suite or release acceptance.

- Center: `/home/sigaer/taiko/qa-vault/runs/qa-7f73d15bcbff/evidence/`.
- Client: `/home/sigaer/taiko/qa-vault/runs/qa-abc55d05f04b/evidence/`.
- Each directory retains `lifecycle-<role>-parity.json`, `lifecycle-<role>-launcher.json`, wrapper logs and cleanup evidence.
- The launcher requires the exact role interpreter under `-I`, rechecks wheel/lock/origin-evidence hashes, and checks loaded product module origins before and after the harness.
- Only test helpers and fixtures are copied to per-run scratch. The legacy blanket `/home` audit rejection is adapted to exact scratch/evidence, installed-role and synthetic-asset roots. Network, SQLite confinement and application-time IO restrictions remain intact. All original `Assert` ASTs are compared before execution and must be identical.
- Assets are explicitly `o1-synthetic-assets-v1-20261016`; no historical PNG restoration or original pixel evidence is claimed.

## Retained setup failure and corrected baseline identity

The first center attempt (`qa-51b6bb3a1feb`) failed with the old handler's missing `_SETTINGS`. Investigation found that initial source restoration had reversed host labels, rather than a product regression:

| Actual role | Frozen source | SHA256 | Role evidence |
| --- | --- | --- | --- |
| center | Sakura `3b08986f21e54e4f6a84a105987174b55546dd42:taiko/plugins/taiko.py` | `81909fde7fd1eaa9c45dbaf2a7f69987307f363029c6a83169ad35a113807c83` | Native QR and center API calls without client settings |
| client | Taiko `e37e07e9f66825fb8860655ee146112e4ca1797d:plugins/taiko.py` | `3b55ebb67e983d7f8c52015e6fe0ffbc9be237671b1cdb6c751a883ebf1110bb` | `_SETTINGS` and `fetch_center_*` proxy calls |

Both originally restored files and the failed run remain unchanged. The successful reruns select their actual source role; the final launcher pins selection to the two exact source hashes, independent of directory labels. No fake `_SETTINGS` value was injected and no business comparison was removed. The subsequent strict digest-selection hardening does not change the selected files or any harness assertion.

The new evidence applies to Taiko wheel SHA `398d23000ebde8a9696b8586fc7fff6cf566e49eb6efe970ceba2e5ecf488c0a`, not to the lost historical wheel bytes. Viewer 0.82 remains BLOCKED by outstanding gates.
