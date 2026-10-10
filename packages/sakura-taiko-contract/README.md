# sakura-taiko-contract 0.1.0 / Contract v1.0

Language-neutral value protocol for the Phase 1 freeze. `schema/contract-v1.json` is the type source; Python and TypeScript bindings are generated with `tools/generate_bindings.py`. No production consumer switches in this phase.

- User, Binding, ExternalIdentity and DeveloperIdentity keep separate namespaces. A developer identity/scopes is not a resource grant. Credentials and authorization remain host infrastructure.
- `Chart.difficulty` is legacy score level 1–5; `Chart.level` is the catalog star level. TJA COURSE 0–4 uses an explicit parser mapping. Song/chart identities preserve source IDs; duplicate-version collapse is an algorithm policy, not a rewrite of identity.
- Score `good` maps to `good_cnt` (良 / calculator GREAT), `ok` to `ok_cnt` (可 / calculator GOOD), `ng` to `ng_cnt`. Crown flags do not replace cumulative counts, rank, roll or stage. Missing values remain null rather than zero. Type stays unknown until a catalog proves single/double.
- `capturedAt` is explicitly supplied observation time, never guessed from an upstream best-score/update timestamp or wall clock. `highscoreAt` and `updatedAt` preserve source text, including its original timezone ambiguity. Fact temporal fields keep occurred/observed/confirmed separate; Asia/Shanghai attribution stays the existing Viewer product rule.
- `legacy` preserves one bounded, credential-free score record for read parity (including options, source-specific crown and raw timestamp/count types). `toLegacyScore` accepts unchanged evidence only. Publishing edits is a Writer operation, not an implicit roundtrip. This compatibility field can be removed only in a new contract version after all readers migrate.
- Raw Score → GrowthObservation → CanonicalFact → GrowthProjection is a provenance pipeline, not a claim that every observation is a play. Exclusion reasons mirror current source filtering. CanonicalFact freezes the existing Viewer GrowthFact output shape and keys; Goal completion remains distinct from score history.
- CalculationProfile pins algorithm, model, catalog, availability and TopN. `v2-center-20261010` and `v2-client-20261010` intentionally retain the audited split. No formula changes are authorized by contract validation.

Golden samples contain only synthetic values, modeled on source fields. Contract tests verify exact legacy roundtrip, Python/JS interoperability, schema conformance, malformed counts and credential rejection, unknown preservation, clock/type behavior and existing Viewer fact projection. They do not access business APIs, databases, production users or caches.

Rollback: remove this unconsumed package or return to the Phase 0 commit. Runtime paths and deployed package version are untouched.
