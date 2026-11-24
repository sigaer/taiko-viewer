# B2.1 Consumer migration ledger

Owner: Lead. Native agents failed tool preflight and executed no reads or writes.
All changes are isolated from the retained Batch 2 candidates. No production activation.

Shared interface review (Lead, 2026-11-24): schema 1, policy `wahlap-cn-1`.
Only `taiko_bot/catalog/policies.py` evaluates the five policies. Python/Core/Node
adapters query stored decisions. The official list contains song-level membership
and difficulty metadata, without an independent chart-release field. A positive
official difficulty is the operational offered-difficulty contract, not proof of
cabinet availability or entitlement. Raw/parser failures never determine CN status.

| Batch | Modules | Planned migration | Verification |
|---|---|---|---|
| M0 | Official fetcher / Builder / immutable storage | Validate every page, terminal page, total and duplicate identity; precompute decisions | Incomplete/duplicate-conflict/LKG/hash/atomic rollback fault cases |
| M1 | Search / Detail / content / public API | Read snapshot song projection; expose revision and policy | Python/Node same bytes and decisions; pagination and aliases |
| M2 | Core / Center / Client / Application | One Core artifact with both host profiles; central eligibility inputs | 12 contracts, preserved numerical golden, 27 bridges |
| M3 | Ordinary / Target / Today Plan / Growth / Goal | Same central policy projection; fixed request generation | Empty/unknown authority, retired alias, per-chart capability failure |
| M4 | Bot resources / cache / progress / annual / Community / UGC | Central read port; distinguish historical association from current offering | Historical data retained; no raw/shelf fallback |
| M5 | Offline producers / synchronization / Chart Intelligence | Metadata cannot write CN authority; separate feature coverage | Seven conflicts, 1387-chart capability report, failed-chart isolation |

The original 494 references are the audit universe, not 494 independent policy
implementations. A row is complete only when its actual producer/consumer edge is
verified or documented as metadata, historical input, test, documentation or retired
entry. Final machine-readable ledger records each original reference and evidence.

Runtime gates: same-request revision pinning, cache keys include revision and policy,
complete authority required for new activation, failed fetch preserves last-known-good
and reports stale/incomplete. With no verified snapshot, CN decisions are unavailable;
there is no fallback to raw, merged, rating, scoreline, ESE or OurTaiko.
