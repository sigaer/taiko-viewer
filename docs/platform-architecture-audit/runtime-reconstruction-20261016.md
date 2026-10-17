# Persistent candidate reconstruction — 2026-10-16

Status: `PASS_LOCKED_SOURCE_REBUILD`, **not release acceptance**. Viewer 0.82 remains BLOCKED. Missing historical external evidence is not recreated by these new runs.

All commands used the persistent, bounded QA wrapper, sequentially. No production config/SQL, deployment, service restart, push or merge was performed.

## Artifacts and provenance

- Original immutable role lock: `runtime-role-locks-0142.json`; each role contains 94 distributions.
- Exact cache recovery found 90 of 96 unique requested artifacts (95 role artifacts plus the builder). The four remaining public wheels downloaded successfully with their original hashes; no third-party version/hash changed. Catalog: `/home/sigaer/taiko/qa-vault/wheel-recovery-1792122295916650988.json`, errors `[]`.
- Shared-memory source `63be19a5c35ba98831b3eeec1746f36fed049a7e` and setuptools 84.0.0 reproduced the original wheel SHA `1e6197b0c4298808e70038cc5de3fff8c2f6517888514c996648a140091f9724` exactly. Evidence: `/home/sigaer/taiko/qa-vault/memory-rebuild-evidence.json`.
- Taiko source `a632913dfbdbec1d465f8eaccc0bb80c35e25745` rebuilt version 0.14.2 using the fixed builder and source commit timestamp. All 387 implementation/data members match that source byte-for-byte; six generated distribution metadata members bring the total to 393. The wheel is 1,020,012 bytes, matching the historical size.
- **New Taiko SHA:** `398d23000ebde8a9696b8586fc7fff6cf566e49eb6efe970ceba2e5ecf488c0a`.
- **Historical Taiko SHA:** `0963350629b261fb5002bf6ef96c6019c22ca5c9515b73279f3c578d8e6725c8`.
- The historical ZIP and per-member hash manifest are unavailable. Therefore the cause of the archive SHA difference is **undetermined**; neither ZIP-only differences nor historical content equivalence are claimed. The authorized new local candidate is identified by its new SHA. Source parity evidence: `/home/sigaer/taiko/qa-vault/taiko-rebuild-gevcqabl/build-evidence.json`.
- Derived lock and proof: `/home/sigaer/taiko/qa-vault/locks-1792122755686743218/{runtime-role-locks.json,artifact-catalog.json,derivation-evidence.json}`. Only the local Taiko wheel hash changed; the memory rebuild retained its original hash. Original lock and requirements remain unchanged.

## Installed roles

Both roles passed offline hash-enforced installation, `pip check`, isolated `-I` module-origin checks and exact 94-distribution inventory comparison against the **derived** lock.

| Role | Interpreter | Evidence |
| --- | --- | --- |
| center | `/home/sigaer/taiko/qa-vault/role-center-wf9putbr/venv/bin/python` | `/home/sigaer/taiko/qa-vault/center-rebuild-evidence.json` |
| client | Recorded in client evidence and manifest | `/home/sigaer/taiko/qa-vault/client-rebuild-evidence.json` |

Runtime manifest: `/home/sigaer/taiko/qa-vault/artifacts/runtime-manifest.json`. Initial corrected SHA: `3deb54853bc08181476869bb2cb16f9cc34eb0a6c3e02877a4a1c3f817075353`; later synthetic-assets addition must retain the preceding manifest and record its new hash. `baseline` is explicitly null: no reconstructed 0.14.1 installed baseline exists. Initial `assetsRoot` is null pending independent synthetic asset creation.

The fallback publication directory is a new empty 0700 directory under the vault. Callers override it with each run's `QA_RUN_TMPDIR`; a code worktree must never act as a runtime/config fallback. The initial pre-correction manifest is preserved separately and was not used for runtime tests.

## Durable run evidence

All IDs below refer to `/home/sigaer/taiko/qa-vault/runs/<id>/evidence`; wrapper logs, cgroup and cleanup evidence are retained.

| Stage | Run |
| --- | --- |
| Cache scan | `qa-5aa4ab66be34` |
| Exact public dependency download | `qa-e03bf7220360` |
| Taiko build | `qa-7f4bbdf4b2d0` |
| Shared-memory build | `qa-410d186b9f56` |
| Derived lock / full artifact digest check | `qa-aa71adc5c032` |
| Center role | `qa-4e55ec86df2b` |
| Client role | `qa-4f234bebebae` |
| Initial manifest (superseded, never consumed) | `qa-43ad0bd10813` |
| Corrected runtime-root manifest | `qa-7165edd6a5b4` |

Remaining: targeted business gates on the new installed candidate, independent tooling/assets recovery, O1 performance cohorts and recovery acceptance. Reconstruction alone does not close any of those gates or authorize 0.83 Freeze.

## Subsequent synthetic asset attachment

Performance-agent run `qa-e5969b4d06a8` created 14 synthetic asset files at `/home/sigaer/taiko/qa-vault/sources/o1-assets-v1`. Assets manifest SHA: `f8fe563fa8e90a36917e6e5949513635f7cd7281b31d3082b3181184772f5391`. Updated runtime manifest SHA: `ec60d1cb4d734936ae6223654678bb4481cd98a3da4cb6e1823c064c9a9a4a48`. The preceding version is retained as `runtime-manifest-before-assets.json`; role provenance fields are unchanged. Independent pytest 8.4.2 tooling has also been recovered outside the 94-package roles. These support the next targeted gate run and do not imply that gate passed.
