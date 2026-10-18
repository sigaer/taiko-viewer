# sakura-taiko-contract / Contract v1.1

Language-neutral value protocol for the Developer API 1.1 candidate. Song field shape intentionally changed before broad adoption; no v1.0 Song compatibility is provided. `schema/contract-v1.json` is the type source; Python and TypeScript bindings are generated with `tools/generate_bindings.py`. Python package remains 0.1.0; the additive JS read adapter is 0.1.1. Existing center/client Git pins keep their original 0.1.0 install.

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

The `@sakura-taiko/contract/score-read` type subpath owns `ScoreReadPort`, its exact-byte snapshot envelope and the explicitly named legacy evidence types. This is an internal read protocol, not an HTTP resource grant or a public raw-userdata API. Viewer implements filesystem infrastructure behind the port; product services retain the compatibility evidence required by their frozen provenance/replay policy. Opaque history version strings do not expose paths. Canonical Fact and strict canonical Score are validated against the single current JSON Schema.

`tools/generate_viewer_read_goldens.mjs` extracts original decoders from Viewer `060dc05`; the fixtures record source hashes. Rollback for Viewer consumption is documented in the Phase 5 execution archive. The schema and Python/TypeScript mappings are regenerated together for Contract 1.1; historical v1.0 evidence remains in Git history only.

## Contract 1.1 catalog change

`Song.title` is removed. The canonical Song fields are `songId`, `song_name`, `song_name_jp`, `aliases`, `catalogRevision` and optional `availability`. `song_name` is the original Chinese/display name, `song_name_jp` is the original Japanese name (using the alias catalog only when the main catalog omits it), and `aliases` is joined by numeric song ID. Missing names remain null; aliases default to an empty array. The catalog revision covers both source files. Contract version is 1.1 and generated TypeScript/Python bindings are derived from the same schema. The internal ScoreRead transport remains version 1.0 and is deliberately independent from the public DTO version. ResourceGrant's history/growth scopes are design-only and are rejected by the current API consent policy. `./catalog` and Python `catalog.py` are pure adapters to these same definitions, with no storage or new domain authority. Shelf 0 means active, 1 removed, other/missing unknown; region and single/double are explicit source fields, otherwise UNKNOWN/unknown. Duplicate IDs are refused, never merged by title. Difficulty 1–5 maps to TJA course 0–4; star level is separate.

The original `growth.json` Golden is retained. `growth-chart-continuity-v3.json` is its strict successor with only the already-approved 0.82 `factPolicyRevision=observation-chart-continuity-v3` provenance addition. The test verifies exact predecessor equality after removing that one marker, and then exact current DTO equality; input, facts, values and times are unchanged. No frozen Passport expectation is changed.

## Unified account consent (Viewer 0.84.8)

New consent uses `viewer-account-consent-v2`, grants `account:read` and returns `expiresAt: null` (valid until revoked). The owner POST contains only bindingId, clientId, consent=true, consentVersion and audience. Profile and scores use this same permission; the profile additionally exposes taikoId, title and source-reported equipped/highest passed dan, without new calculations. Secret credentials and web account details are never part of account data. `unavailableScopes` in meta still identifies unimplemented history/Growth reads.

Existing `viewer-resource-consent-v1` grants and owner requests remain supported with their original scopes and expiry. They are never silently broadened or extended. The explicit nullable-expiry SQL migration changes metadata storage only, preserving existing rows; it is not run by request handlers. API read authorization still verifies owner binding, approved application, active client/token and revocation before and after the Publication read.

Before activating Viewer 0.84.8 on an existing deployment, run the explicit operator command from the repository root, under `scripts/memory/run_qa.sh`:

```sh
bash scripts/memory/run_qa.sh /absolute/path/to/node --env-file=/etc/taiko-viewer.env taiko_viewer/scripts/migrate_developer_account_consent.mjs --database=taiko --apply --allow-production-schema-change
```

Omit both apply flags for a read-only readiness check (exit 2 if migration is needed). The command verifies `SELECT DATABASE()`, column type, and the result of the migration; it is idempotent and changes no grant values or score tables. Isolated test writes additionally require `TAIKO_ALLOW_TEST_DB_MUTATION=1` and the QA-owned MySQL datadir. The standard Viewer deployment script remains unchanged; deployment must not proceed when the pre-activation command fails.

## Complete song catalog

`GET /api/v1/taiko/catalog/songs` returns `CatalogSongsResponse` by default, without query parameters. Top-level `CatalogVersions` contains only contractVersion, schemaRevision and catalogRevision. Every CatalogSong has songId, source song_name/song_name_jp (nullable), aliases, status and charts. Each CatalogChart contains only difficulty (1–5, matching legacy score level) and level (star level). Use the parent songId to join scores. Missing difficulties are absent. Status is song shelf metadata, not regional per-chart implementation information.

This intentionally replaces the rc.7 catalog DTO. Update strict catalog clients and generated bindings. Internal canonical Song, Chart and ApiReadVersions remain unchanged for other responses. The adapter selects fields from the existing projection after one read, without new chart identification or data sources. The standalone charts endpoint and SDK charts() remain removed. The response cap stays 8 MiB; Contract 1.1 remains FREEZE_CANDIDATE.
