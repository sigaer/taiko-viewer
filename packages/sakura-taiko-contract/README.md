# sakura-taiko-contract / Contract v1.0

Language-neutral value protocol for the Phase 1 freeze. `schema/contract-v1.json` is the type source; Python and TypeScript bindings are generated with `tools/generate_bindings.py`. Python package remains 0.1.0; the additive JS read adapter is 0.1.1. Existing center/client Git pins keep their original 0.1.0 install.

- User, Binding, ExternalIdentity and DeveloperIdentity keep separate namespaces. A developer identity/scopes is not a resource grant. Credentials and authorization remain host infrastructure.
- `Chart.difficulty` is legacy score level 1–5; `Chart.level` is the catalog star level. TJA COURSE 0–4 uses an explicit parser mapping. Song/chart identities preserve source IDs; duplicate-version collapse is an algorithm policy, not a rewrite of identity.
- Score `good` maps to `good_cnt` (良 / calculator GREAT), `ok` to `ok_cnt` (可 / calculator GOOD), `ng` to `ng_cnt`. Crown flags do not replace cumulative counts, rank, roll or stage. Missing values remain null rather than zero. Type stays unknown until a catalog proves single/double.
- `capturedAt` is explicitly supplied observation time, never guessed from an upstream best-score/update timestamp or wall clock. `highscoreAt` and `updatedAt` preserve source text, including its original timezone ambiguity. Fact temporal fields keep occurred/observed/confirmed separate; Asia/Shanghai attribution stays the existing Viewer product rule.
- `legacy` preserves one bounded, credential-free score record for read parity (including options, source-specific crown and raw timestamp/count types). `toLegacyScore` accepts unchanged evidence only. Publishing edits is a Writer operation, not an implicit roundtrip. This compatibility field can be removed only in a new contract version after all readers migrate.
- Raw Score → GrowthObservation → CanonicalFact → GrowthProjection is a provenance pipeline, not a claim that every observation is a play. Exclusion reasons mirror current source filtering. CanonicalFact freezes the existing Viewer GrowthFact output shape and keys; Goal completion remains distinct from score history.
- CalculationProfile pins algorithm, model, catalog, availability and TopN. `v2-center-20261010` and `v2-client-20261010` intentionally retain the audited split. No formula changes are authorized by contract validation.

Golden samples contain only synthetic values, modeled on source fields. Contract tests verify exact legacy roundtrip, Python/JS interoperability, schema conformance, malformed counts and credential rejection, unknown preservation, clock/type behavior and existing Viewer fact projection. They do not access business APIs, databases, production users or caches.

## Viewer read compatibility (JS 0.1.1)

`legacyScoreReader`, `legacyScoreValue`, `legacyCrown`, `legacyJudgmentTotal`, `legacyScoreInstant` and `hasLegacyScoreEvidence` decode existing read evidence. Bind `legacyScoreReader(profile)` once before replaying large histories. They have no IO, cache, credentials or clock. They preserve the audited Viewer differences explicitly:

| Profile | Numeric values | Timestamp behavior |
| --- | --- | --- |
| viewer-daily-v1 | missing stays null; finite nonnegative legacy coercion | trimmed source string; local seconds interpreted at +08:00 |
| viewer-goal-v1 | missing/bool/fraction/unsafe integer stays null | string only; local seconds at +08:00 |
| viewer-evidence-v1 | missing stays null; signed finite values for regression checks | also accepts fractional local seconds at +08:00 |
| viewer-overview-v1 | legacy finite coercion, display fallback 0 | no timestamp API |
| viewer-display-v1 | legacy floor and nonnegative fallback 0 | no timestamp API |

Compatibility values are not canonical Score validation. The frozen strict `fromLegacyScore` still rejects malformed counters and credentials. The legacy date policies intentionally retain native parsing for unsupported source strings; UTC and Asia/Shanghai Goldens demonstrate unchanged behavior, including their old timezone ambiguity. No profile invents observed time from play/update time. Growth/Goal product decisions remain host owned.

The `@sakura-taiko/contract/score-read` type subpath owns `ScoreReadPort`, its exact-byte snapshot envelope and the explicitly named legacy evidence types. This is an internal read protocol, not an HTTP resource grant or a public raw-userdata API. Viewer implements filesystem infrastructure behind the port; product services retain the compatibility evidence required by their frozen provenance/replay policy. Opaque history version strings do not expose paths. Canonical Fact and strict canonical Score still use the unchanged JSON Schema.

`tools/generate_viewer_read_goldens.mjs` extracts original decoders from Viewer `060dc05`; the fixtures record source hashes. Rollback for Viewer consumption is documented in the Phase 5 execution archive. The schema and existing Python mapper stay byte identical to Phase 1.
