# Runtime closeout — 2026-10-15 incremental evidence

Status: **BLOCKED_NOT_RELEASE_READY**. This extends the existing architecture audit;
no production API/SQL, private credentials, runtime configuration, deploy, restart,
push or merge was performed. Local `main` refs are observations, not proof that
remote branches or deployed processes match. The master plan's original baseline
is stale; preserve current main changes when integrating ownership work.

## Baselines and integration risk

| Repository | Local main | Ownership candidate | Main-only / candidate-only | Relationship |
| --- | --- | --- | --- | --- |
| Taiko | `fa0983d` | `15722e8` | 0 / 28 | main is candidate ancestor |
| Sakura | `63be19a` | `38298af` | 3 / 29 | diverged at `390175e` |
| Viewer | `56aa05a` | `6331aea` | 39 / 2 | diverged at `9a77dbc` |

The Taiko candidate already incorporates the currently observed main; it is a
large accumulated feature branch, not a one-commit patch on the main listed in
the master plan. Sakura main contains newer 2026 dojo changes. Viewer main has
new publication/security/writer work absent in the old candidate. In particular,
`server/infrastructure/taiko-publication/client.ts` and
`server/services/account/python-compute.ts` exist in main but not in `6331aea`.
Copying candidate source wholesale would remove these current boundaries.

Working tree changes in the original Viewer (including title relations business
data and the removed domain-extraction status document) were observed only and
left untouched. The generated manifest records dirty paths; these are not an
allowlist to reset, stash or include in a release.

## Artifacts, interpreter and dependency evidence

`runtime-release-manifest.json` records full commits, merge bases, streamed
SHA-256 hashes of the existing 0.14.1 wheel, contract, compatibility checkpoint,
service templates, deploy script and historical failure logs. Installed package
metadata is enumerated without importing application code. Its inventory hash
is **not** a reproducible dependency wheel lock. The fresh-role experiment below
separates full dependency acceptance from the stdlib-only installed bridge.

The candidate declares Python `>=3.11,<4.0`, `taiko-application==0.8.0`, and
`sakura-taiko-contract==0.1.0`. Its center extra pins
`sakura-taiko-core[hiroba]==0.1.1`; client pins `==0.1.2`. These role-specific
versions must be validated separately. Installing both extras together is not
the intended deployment. Historical client lifecycle coverage used 0.14.0.

Candidate Viewer selects absolute `TAIKO_PYTHON_EXECUTABLE`, defaulting to
`/usr/bin/python3`, and invokes installed modules with `-I`. The service templates
instead identify `/opt/taiko-bot/bin/python` for public API/sync and
`/home/sigaer/taiko/.venv/bin/python` for song update; templates are not evidence
of live interpreter configuration. Reconcile and attest the actual interpreter
per role before cutover. Do not read secrets to fill a manifest placeholder.

Main's publication bridge still invokes `python3 -m taiko_store.bridge` with
`cwd: repoRoot`. Main's personal computation invokes legacy
`plugins.utils.recommendation_intelligence` and `growth_compute` with the same
source-tree resolution. Therefore the master plan's wheel-only runtime claim
applies to the old candidate, **not current main**.

A safe incremental integration should:

1. Preserve main's bridge protocol, locks, backup/restore and error sanitization.
2. Select a deployment-controlled absolute interpreter and `-I -m` for the
   bridge, verifying the installed wheel's ready/lease protocol using synthetic
   storage from an unrelated cwd; refuse missing package rather than falling
   back to source.
3. Migrate personal-compute module names to `taiko_bot.offline.*` and supply
   explicit runtime roots, preserving exit 75/503 and output/time limits.
4. Adapt existing tests that currently rely on source `repoRoot`; prove both
   installed success and missing-wheel fail-closed before switching defaults.
5. Reconcile annual/Growth fingerprint adapters independently against current
   main. Retain saved measurement/report identities and the known Source-switch
   failure until a reviewed fix proves otherwise.

The current local main still has the source-startup behavior described above.
This readiness candidate now selects an absolute interpreter and uses `-I` for
the bridge. The installed publication regression completed **52 PASS**
(client, scope, account/Kinoko, including source-shadowing and missing-wheel
coverage), using the fresh center venv. Evidence:
`/var/tmp/taiko-viewer1-installed-publication-qa.log`. This preserves main's
complete protocol rather than replacing it with the old ownership candidate.
Personal-compute and annual/Growth integration remain incomplete; bridge-only
acceptance cannot establish G-RUNTIME PASS.

## Fresh offline experiment

`evidence/fresh-runtime-20261015.json` records a new run through the bounded QA
wrapper. Two new venvs under `/var/tmp/taiko-runtime-fresh-n6qxnwr3` did not inherit
or copy an old environment. Center and client full-role dependency resolution
both failed at **no offline wheel for `aiomysql>=0.2.0`**. Resolution stopped
there; this is not proof that all remaining dependencies are available. Both
fresh `pip check` runs failed after explicit candidate-only installation.

Independently, non-editable installation of the pinned 0.14.1 wheel with
`--no-deps` proved the stdlib bridge in both venvs:

- `-I` imported `taiko_store.bridge` from each new venv's `site-packages`.
- Synthetic current and history objects committed under one transaction ID;
  a new read lease returned that committed view and the exact object bytes.
- A write attempted through the read lease failed with `PUBLICATION_FAILURE`.

The run exited **2 / BLOCKED_FULL_ROLE_INSTALL**, took **14.773 seconds**, and
recorded its own cgroup's memory events with zero OOM/OOM-kill events.
`memory.peak` was unavailable on this cgroup; no peak RSS or memory usage is
claimed. Logs and raw artifacts are synthetic. Unrelated cached wheel entries
were removed from the report after execution without changing outcomes.

The absent offline wheel is an environment constraint, not a user prohibition
on downloads. An independent `--online-third-party` experiment attempted to download
binary dependencies from `https://pypi.org/simple` into a new wheelhouse while
pinning Taiko, Application, Contract and role-specific Core to exact local wheel
paths and SHA-256 values. It records downloaded wheel hashes and installed
versions, rejects direct dependency references before installation, and keeps
the original offline failure evidence intact. Full installs still do not prove
authenticated lifecycle, SQL, fingerprints, annual parity or production cutover.

The online attempt also **failed**: its center dependency download reached the
fixed **240-second** deadline while the last logged artifact was
`cryptography-50.0.2` (4.8 MB). Total wrapper task duration was **244.248 seconds**,
exit **1 / FAIL_RUNTIME_VERIFICATION**. No full installation finished and the
client role was not started. The workspace was approximately 27 MB at review,
well below the 1.5 GiB cap; logs were small. No retry or budget expansion was
performed. Own-cgroup OOM events remained zero, with `memory.peak` unavailable.
This is a bounded download failure, not proof of a dependency version conflict.

Evidence: `evidence/fresh-runtime-pypi-20261015.json`, workspace
`/var/tmp/taiko-runtime-fresh-w7c4eaki`. Log SHA-256:

- QA `/var/tmp/taiko-viewer1-fresh-runtime-pypi-qa.log`:
  `7e679220f51088a3fa082ed7c14f3146a4927fce1cb9eba4b75dbb7bf1cbc386`.
- Resolver `center-resolve.log`:
  `de4f2532c4c5a87e905ae11a3f54b9d9dda44fc5440323238ffa5676406bbe41`.

The evidence contains an explicitly labeled post-run failure review; original
outcomes are retained. The launcher now reports time, disk and log limit reasons
separately for future runs. Full dependency acceptance and G-RUNTIME remain open.

## Existing failures and remaining gates

Historical offline result remains **271 PASS / 7 SKIP / 1 FAIL**. The failing
`test_source_switch_and_deleted_readded_chart_never_create_cross_epoch_delta`
asserts absence of cross-epoch `play_delta`; the frozen old source also failed
(1 failed, 36 deselected). This audit hashes the old logs; it does not represent
a new execution of that suite. Seven private-fixture skips remain unexecuted.
Twenty-seven historical test/helper files require individual owner adaptation;
critical authorization/writer tests cannot be accepted as permanently skipped.

The twelve quarantined resources have no verified off-host encrypted backup or
redistribution review in this audit. We did not open their contents. Public
inventory/history disclosure review remains open. No database schema hash,
production catalog hash, private backup path or live interpreter was guessed.
Authenticated synthetic SQL E2E, restore/RPO/RTO drill and staging/online smoke
remain separate, unexecuted gates.

## Hooks and release boundary

Tracked Viewer workflow `passport-request-audit.yml` triggers only pushes to
`codex/passport-history-request-audit-20261010`; its contents perform isolated
QA, not deployment. No tracked workflows were listed in the two other main
worktrees. Local active Git hook file hashes and `core.hooksPath` are recorded
without exposing hook contents. Hosted webhooks, rulesets, environment approvals,
external CI and repository settings remain **UNVERIFIED**.

Viewer `scripts/deploy_forum_web.sh` explicitly performs `git push` and service
operations (including Nginx reload and sync receiver restart). It is not a
read-only build command. No release command should be run while this package
remains blocked. The master plan requires separate explicit production approval
for a P0 release; a clean offline audit does not authorize one.

## Repeatable bounded audit

From the isolated Viewer worktree, serialize this with all other QA/build jobs:

```bash
bash scripts/memory/run_qa.sh /usr/bin/python3 \
  /var/tmp/taiko-viewer-1-readiness-20261015/scripts/readiness/audit-runtime.py \
  --output /var/tmp/taiko-viewer-1-readiness-20261015/docs/platform-architecture-audit/runtime-release-manifest.json
```

The script has per-command timeouts, bounded metadata reads and streaming file
hashes; wrapper admission supplies the process-tree memory/time limit. It reads
only local refs, tracked workflow source, hook hashes, existing wheel metadata
and previous logs. It does not fetch, import application modules, contact APIs,
install dependencies, inspect secrets or run SQL. A successful script means
**inventory produced**, never G-RUNTIME PASS.
