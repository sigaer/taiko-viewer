# R1 interpreter scope and reconstruction — 2026-10-16

The frozen combination is the current isolated Viewer readiness checkout plus
Taiko `15722e8` / wheel `0.14.1`. Sakura active `63be19a` is a read-only synthetic
fixture source, not an installed-worker cutover. Historical Viewer `6331aea` and
Sakura `38298af` supply migration evidence only. `conflict-ledger.json` records
all paths changed on either side of each merge base, their blob identities,
dirty worktrees, and retain/port/defer decisions. A deferred Sakura retirement
is not acceptance of a live host migration.

| Consumer | Candidate source selection | Required role / actual QA identity | Remaining evidence |
| --- | --- | --- | --- |
| Viewer Web host | Node service interpreter, not `TAIKO_PYTHON_EXECUTABLE` | Node host; production executable unknown | Actual deployment configuration null |
| Publication | `getPublicationPython` delegates to `getTaikoPython`; explicit override or `TAIKO_PYTHON_EXECUTABLE`, then `/usr/bin/python3`; absolute path, `-I` | center exact role lock; installed bridge verified | Other production Writers not implied |
| Account compute | `getTaikoPython`, installed `taiko_bot.offline.*`, `-I` | **center role only**; Core 0.1.1 enforced by offline domain adapter | Center consumer/merged/writer suite 10 PASS; client invocation correctly rejected by role guard |
| B30 / dimension / radar images | `getTaikoPython`, installed `taiko_bot.offline.viewer`, configured userdata root, bounded subprocess | center with shared memory support wheel; 94 distributions | Three real Viewer callsites match independent installed adapter PNG hashes; synthetic assets only, not frozen algorithm Golden |
| Progress / recommendation / trend / cloud / MyDon images | installed viewer/catalog/MyDon adapters, same absolute interpreter and explicit data roots | center with shared support artifact required | Callsite migration present; individual image and permission lifecycle acceptance still pending |
| Growth fingerprint | installed `taiko_bot.offline.fingerprint` via artifact adapter | center role | Real consumer and full frozen legacy hash continuity PASS on the synthetic combination; not all historical/production data acceptance |
| Annual generator / ratings | systemd admission starts selected absolute Python with `-I`; bootstrap reexecutes `sys.executable` | **center role only** | Annual retry 9 PASS: synthetic build/ratings, failed module/deadline, isolation and cleanup; not full Web lifecycle |
| Annual renderer | `process.execPath` runs Node render worker | Node; independent from Python selector | Renderer/resource acceptance separate |
| merged-read | installed `taiko_bot.cli.merged_read_cli`, `-I`, existing typed lease protocol | Viewer uses center role; isolated shared protocol also passed in client environment | Included in center consumer suite; not full client business acceptance |
| Sync dispatcher | candidate service template names `/opt/taiko-bot/bin/python`; no live config read | center role expected; actual production interpreter null | Service configuration and lifecycle acceptance pending |
| center host | exact Taiko 0.14.1 + Core 0.1.1 lock | Active supplemental 94-package role identity; exact offline reconstruction PASS | 18 public dispatch and 46 representative lifecycle cases PASS; synthetic/frozen oracle scope only |
| client host | exact Taiko 0.14.1 + Core 0.1.2 lock; `taiko_bot.runtime.player.entry` with `taiko_song_profile=client` | Separate active supplemental role identity; exact offline reconstruction PASS | 18 public dispatch and 46 representative lifecycle cases PASS through true client host APIs, not Viewer offline compute |
| Account sync compatibility worker | `sync-worker-runner.ts`: `python3 -m scripts.account_sync_cli`, cwd runtime source | PATH-resolved source worker; production interpreter unknown | Not migrated; installed compute/Annual does not cover its SQL/service authorization lifecycle |
| Source mutation compatibility worker | `source-mutation-worker-runner.ts`: `python3 -m scripts.source_mutation_cli` | Same explicit source boundary | Not migrated; preserve existing owner/grant and publication checks until separate installed-worker SQL acceptance |
| QQ migration compatibility worker | `qq-migration-worker-runner.ts`: `python3 -m scripts.qq_migration_cli` | Same explicit source boundary | Not migrated; identity transaction/rollback evidence required before cutover |
| Hiroba credential compatibility worker | `hiroba-credential-worker-runner.ts`: `python3 -m scripts.hiroba_credential_cli` | Same explicit source boundary | Not migrated; credential control-plane and service identity acceptance separate |

`/usr/bin/python3` is a fail-closed default, not proof the required distribution
is installed there. QA venv absolute paths are observations only. Production
interpreter paths, catalog revision, SQL restore point and deployed commit remain
explicitly null until separately inspected and approved. Role identity is the
SHA-256 of an exact requirements file, not a `/var/tmp` pathname.

`getTaikoPythonEnv` removes `PYTHONPATH` and `PYTHONHOME` and assigns configured
data roots. Each Python invocation must retain `-I`; data roots do not authorize
source imports. Worker startup, annual admission, API ownership rechecks and
Publication leases remain the active implementation's responsibility. Never
copy old `personal.ts` or revive removed credential-control code in
`taiko-center.ts` while porting module calls.

The four source-worker rows are real consumers still using the active legacy
runtime tree. Their compatibility boundary is deliberate and still **BLOCKED**
for an all-consumer installed cutover. They must retain current authorization,
sanitized pipe protocols and transaction semantics. No new source fallback was
added to the migrated consumers. The installed result must never be described
as covering every Python process or the complete credential control plane.

## Shared runtime support and the 94-distribution candidate

The first exact 93-distribution rebuild passed installation/import checks but
the real center image callsite exposed `ModuleNotFoundError: runtime_memory`.
This shared support dependency was documented separately in Taiko's migration
notes. It is not a missing Taiko implementation, and Taiko imports, algorithms,
version 0.14.1 and Core role pins remain unchanged.

`build-memory-support.py` exports the five shared modules from fixed Sakura
`63be19a`, records their Git blob/SHA-256 identities, and builds
`python-memory-runtime==1.1.0` in a separate temporary packaging tree. Wheel
content is byte-checked against those source objects. Owner remains Sakura
shared infrastructure. The pre-existing 1.1.0 artifact version is retained;
this is **local integration packaging, not an upstream package release**.
No implementation is copied into Taiko, and no `.pth` or source-root injection
is used to supply the module.

`runtime-role-locks-with-memory.json` and `*-with-memory.requirements.txt` define
the active **94-distribution** business-QA candidate. The original 93 locks and
their successful evidence remain unchanged as historical limited acceptance.
Rebuild new venvs using `rebuild-runtime-role.py --lock-manifest` with that
supplement manifest, then run the actual image/role consumers. The release
manifest distinguishes active role identities from historical identities and
records each supplemental rebuild result only when its evidence exists.

The new center 94-package candidate passed the bounded integration runner;
its exact executed consumers and per-command hashes are in
`evidence/r2-center-integration-94-20261016.json`. Image retry evidence
`evidence/installed-viewer-images-retry-20261016.json` records three real Viewer
image callsites (B30, dimension and radar) with synthetic assets and
PNG/JPEG hashes. The original missing-support failure remains in
`evidence/installed-viewer-images-20261016.json`. This resolves the diagnosed
runtime dependency omission for these consumers; it does not establish parity
with frozen historical algorithm outputs or complete production coverage.

Both role-specific public dispatch smoke tests passed 18 cases in the earlier
93-package environments (`/var/tmp/viewer0822-center-public.log` and
`/var/tmp/viewer0822-client-public.log`). Those are real installed client/center
entrypoints, but they remain narrower historical evidence. The 94-package client
public dispatch also passed in its initial integration run before lifecycle
test-helper discovery failed. That setup failure remains preserved.

The corrected readiness launcher loads only the exact whitelisted
`sqlite_fixture.py` and recommendation `freeze.py` test helpers, records their
hashes and those of the harness/fixture/frozen oracle, and runs the existing
test with `runpy`. It does not change old candidate tests. Product package and
loaded submodule origins are checked before/after against the selected venv.
Both true roles then passed **46 representative lifecycle cases** independently:
`evidence/r2-center-lifecycle-94-20261016.json` and
`evidence/r2-client-lifecycle-retry-94-20261016.json`. These tests use synthetic
SQLite and captured transport responses; they do not replace production MySQL,
network service activation, remote credentials or full browser acceptance.
The source-helper setup failure and the earlier correct client rejection of a
center-only API are retained, not relabeled as successful runs.

Overall R2/0.82 remains **BLOCKED**: four source compatibility workers, actual
service/ingress configuration, complete Writer cutover and recovery acceptance
are separate from the now-passing scoped runtime/role checks.

The initial attempt to run the Viewer compute consumer suite in the client
environment failed with `taiko_bot.offline.taiko_domain_adapter` expecting Core
0.1.1 and observing 0.1.2. This is evidence of the center-only capability guard,
not a demonstrated client-host business defect. Do not relax that guard or
change either role pin. The client host's `runtime.player.entry` independently
enforces Core 0.1.2 when its explicit profile is client. Its representative
acceptance entrypoints are `tests/runtime_ownership/delivery_smoke.py --host
client` (real installed public/player plugin dispatch on both transports) and
`tests/lifecycle/events.py --representative --host client` (synthetic identity,
update and rendering with the frozen baseline as a test oracle). Their tests
must run with the installed client interpreter under the memory wrapper and
retain network/production-file guards. Neither passing imports nor running a
center-only API is a substitute for those client lifecycle checks.

Annual evidence: `/var/tmp/viewer0822-annual-retry.log`; initial Node
`--experimental-strip-types` setup failure is retained separately. Annual TS
uses parameter properties and needs the existing `--experimental-transform-types`
test entrypoint. The role diagnostic log
`/var/tmp/viewer0822-consumers-client-diagnostic.log` records the cross-role
negative result only; it must not be relabeled as a client lifecycle PASS.

## Artifact generation and offline reconstruction

Run these serially through the existing memory wrapper. They do not download,
read production data, change the old venvs, or import from a source worktree.

```bash
bash scripts/memory/run_qa.sh /usr/bin/python3 scripts/readiness/freeze-runtime-combination.py
bash scripts/memory/run_qa.sh /usr/bin/python3 scripts/readiness/rebuild-runtime-role.py --role center --output docs/platform-architecture-audit/evidence/r1-rebuild-center-20261016.json
bash scripts/memory/run_qa.sh /usr/bin/python3 scripts/readiness/rebuild-runtime-role.py --role client --output docs/platform-architecture-audit/evidence/r1-rebuild-client-20261016.json
```

Use absolute script/output arguments when the wrapper's working directory is
not this checkout. Each rebuilt venv installs exact name/version/SHA-256 pins
with `--no-index --no-deps --require-hashes --only-binary=:all:`, followed by
`pip check` and `-I` origins plus an exact whole-environment distribution check.
The initial environment's setuptools 65.5.0 is included using the host's bundled
ensurepip wheel, so the lock does not silently omit a bootstrap distribution.
`runtime-role-locks.json` records each local wheel path and digest. These paths
are QA artifact locators; a release must provision the same digests into a
reviewed durable artifact store. No production environment is rebuilt here.

## Rollback boundary

No production release occurred. Keep active main and the old candidate artifacts
intact; remove or abandon only the independently created QA venv if desired.
Do not reset the active dirty worktrees. To reproduce the prior dependency
combination, use the previous recorded role lock and its matching immutable
wheel artifacts in a new venv, then verify exact inventory before selecting it
in a separately authorized service cutover. A production rollback command is
intentionally not guessed: deployed commit, interpreter, catalog revision and
DB recovery point remain null. Source rollback alone cannot restore data.
