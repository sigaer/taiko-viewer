# Annual Reporting Window Migration

Status: **ANNUAL REPORTING WINDOW MIGRATION — READY**

This audit changes only the report-window contract and its direct consumers. The Annual algorithm remains `annual-observation-v4.5.1`; FinalTitle scoring, StrongDan formulas, Dan marks, recommendations, ratings, routes, and poster/share architecture are unchanged. No production runtime was synchronized and no Viewer deployment was performed.

## Canonical window

| Contract | Before | Final |
|---|---|---|
| Viewer metadata | `2025-10-09` through `2026-09-11` | `2025-10-09` through `2026-09-30` |
| Generator effective bounds | `2025-10-09 06:00:00` through `2026-09-11 04:00:00` (inclusive comparison) | `[2025-10-09 00:00:00, 2026-10-01 00:00:00)` |
| Display | mixed locale/date formatting | `2025.10.09 – 2026.09.30` |
| Calendar length | 338 date labels, with conflicting time bounds | 357 calendar days |
| Time zone | Asia/Shanghai | Asia/Shanghai (unchanged) |

The only production canonical definition is `taiko_viewer/utils/annualPeriod.ts::ANNUAL_REPORTING_WINDOW`. Server metadata, CLI input, presentation fallbacks, fingerprints, and cache checks import or receive that contract. The Python generator deliberately has no fallback dates; build/events/shadow CLI calls require the Viewer-supplied JSON contract. Tests contain explicit fixture dates, but they are not runtime definitions.

The report revision is `annual-report-2026-r2-final-window`. It is combined with the unchanged algorithm version as the producer revision. This is a data/report revision rather than an algorithm-version change because title, scoring, aggregation, and event semantics remain frozen. Viewer package version moves from `0.73.3` to `0.73.4` as a compatible user-visible correction.

## Timestamp semantics

Annual calendar boundaries use Asia/Shanghai. Naive `update_datetime`, `highscore_datetime`, and snapshot filename timestamps are interpreted as Shanghai wall-clock values. Offset-aware timestamps are converted to Asia/Shanghai and then compared as local wall-clock datetimes. `played_at` is not an input field in the current Annual generator.

Snapshot time comes from `_meta.observed_at` / `_meta.observedAt` / `_meta.synced_at`, then the filename timestamp, then file mtime only as a last fallback. The local date `2025-10-09` therefore begins at `2025-10-09T00:00:00+08:00`. This migration does not alter that policy.

## All date-window call sites

| File / symbol | Use | Canonical? |
|---|---|---|
| `taiko_viewer/utils/annualPeriod.ts::ANNUAL_REPORTING_WINDOW` | Dates, exclusive end, 357 days, timezone, report revision | Yes |
| `server/.../annual-summary/constants.ts::getAnnualVersion/getAnnualGeneratorVersion` | Public version metadata and full generator contract | Reference |
| `server/.../annual-summary/runtime.ts::getAnnualInputFingerprint` | Hashes producer revision and the complete reporting window; passes it to Python | Reference |
| `server/.../annual-summary/index.ts::safeReadSummary` | Rejects stored summaries whose version range/timezone differs | Reference |
| `server/.../annual-summary/build-recovery.ts` | Invalidates durable failure/build state with revision v2 | Reference |
| `pages/account/version-summary.vue` and `utils/annualSummary.ts` | Missing-data fallbacks import the canonical range | Reference |
| `OpeningSlide.vue`, `StoryDrawer.vue`, poster view model | Stable range display from summary metadata | Reference |
| `reporting_window.py::resolve_reporting_window` | Validates the Viewer contract and derives naive Shanghai half-open bounds | Consumer |
| `service.py::build_annual_result` | Selection, event aggregation, FinalTitle input, metadata, fingerprint | Consumer |
| `snapshots.py::select_window` | `start <= observed_at < endExclusive`; selects in-window end state and preceding baseline | Consumer |
| `events.py::build_observation_events` | Applies the same half-open bounds to observed transitions and representative times | Consumer |
| `dan_events.py::mark_events` | Half-open Dan mark filtering | Consumer |
| `shadow.py::build_shadow_report` | Uses the same validated contract for corpus shadow runs | Consumer |
| `audit_annual_reporting_window.py` | Full-corpus old/new diff and invariants | Validation |

Two-pass snapshot loading builds one ordered metadata plan and replays that same plan. Window selection happens once on the reconstructed sequence. The last pre-window snapshot may be retained as `baseline/start_state`, but it is not present in `window_snapshots`, does not become the report end state, and is not counted as activity. A boundary transition may reference the baseline in `observedBetween.from`; if its source time is outside the report, it remains an interval event with no out-of-window `representativeAt`.

Explicit all-time/cumulative allowlist:

- `profileCard` and current clear/FC/AJ/极 counts are cumulative state as of the last in-window snapshot, not state after the window.
- `period.firstActualPlayDate/firstRecordAt` is the first snapshot ever observed by this service. It drives the established “your recorded story” Period-page duration only; it is not the first annual play and is not used for inclusion, event totals, calendar activity, or FinalTitle time evidence.
- pre-window baseline state and provenance source range may refer outside the window solely to establish an in-window transition and reproducibility.

All other first/last dates, event extrema, favorites, active days, streaks, monthly data, achievements, and title evidence derive from selected in-window snapshots/events.

## 23-page dependency matrix (authoritative 21-page contract)

The checked-in frozen scene registry contains **21 pages, not 23**: 5 always-present pages plus 16 optional metric pages. `verify_annual_contract.mjs` and `useAnnualPages.ts` agree on 21. `ProfileSlide` is intentionally not registered and breakthrough is evidence feeding growth/final content rather than a standalone scene. Adding two scenes to match stale “23-page” wording would violate the frozen scene contract, so this migration audits the authoritative 21-page contract.

| Page | sceneType | Primary source | Window/boundary behavior | Empty or sparse behavior |
|---|---|---|---|---|
| opening | hero | `version` | Displays canonical range | Always present |
| period | pattern | `period`, version | Report range plus established observed-story anchor | Always present; honest observed/archive copy |
| overview | impact-number | `overview` | Totals from selected events/end state | Always present; zero/observed state is valid |
| favorite | song-memory | `favoriteSong` | In-window play deltas | Omitted when unavailable; no fabricated favorite |
| obsession | song-memory | `obsessionSong` | In-window active/play evidence | Omitted when unavailable |
| favoriteShift | pattern | `favoriteShift` | First/late observed play span | Omitted without two defensible periods |
| keyword | pattern | `keyword` | Frozen rating/dimension model on permitted state | Omitted when unavailable |
| ratingRank | pattern | `ratingRank` | Frozen rating model; range does not alter formula | Omitted when unavailable |
| monthly | song-memory | `monthlyFavorites` | Sorted `YYYY-MM` event groups across 2025→2026 | Omitted without timed data |
| weekday | pattern | `weekdayActivity` | Shanghai event dates | Omitted without eligible timed data |
| calendar | pattern | `calendarActivity` | Per-day activity, streak, peak day within range | Omitted without eligible timed data |
| timeOfDay | pattern | `timeOfDay` | Shanghai local event hour | Omitted without eligible timed data |
| lateNight | pattern | `lateNight` | Existing 05:00 night-day rule on in-window events | Omitted without eligible timed data |
| speedProfile | pattern | `speedProfile` | Frozen eligible-chart model at in-window end state | Omitted when unavailable |
| nearDondaful | song-memory | `nearDondaful` | In-window end-state candidate | Omitted when unavailable |
| challenge | song-memory | `challenge` | In-window observed play deltas | Omitted when unavailable |
| pound | impact-number | `pound` | In-window event/state source, frozen formula | Omitted when unavailable |
| highScore | song-memory | `highScore` | Source time must be inside half-open window or remain interval-only | Omitted when unavailable |
| milestones | award | `milestones`, breakthrough evidence | Only transitions observed in-window | Omitted when unavailable; no false achievement |
| final | award | `finalTitle` and evidence | Frozen 45-key/StrongDan selection using permitted candidate inputs | Always present with non-empty evidence |
| poster | award | canonical summary view model | Reuses range, totals, favorite and final title; no recalculation | Always present |

Page-to-summary consistency is structural: pages consume the normalized canonical summary and `sectionStatus`; they do not independently query or re-filter history. Optional pages use the same `metricAvailable` predicate as the registry. The cover, drawer, and poster reuse summary version metadata and the common date formatter.

## Boundary tests

`test_version_summary.py` now covers:

- `2025-10-08 23:59:59` excluded;
- `2025-10-09 00:00:00` and daytime included;
- `2026-09-30 23:59:59` and `23:59:59.999999` included;
- `2026-10-01 00:00:00` excluded;
- the preceding snapshot is baseline-only and the end state is the final in-window snapshot;
- start-only and end-only sparse histories;
- both boundaries in one history;
- outside-only histories return controlled no-data;
- a pre-window trusted source time cannot escape into `representativeAt`;
- the baseline→start transition remains an interval event, preserving existing event semantics.

## Month/cross-year tests

Month tests use chronological `YYYY-MM` keys and prove `2025-10, 2026-01, 2026-09` ordering. October 2025 is naturally partial because only events on/after October 9 are eligible. No calculation subtracts bare month numbers. The Viewer calendar derives 12 cross-year year/month groups and grays dates before October 9.

No Annual business calculation uses fixed 365/366 days, 52 weeks, or a natural-year month subtraction as the reporting denominator. Backend `period.totalDays` now uses the validated 357-day contract. The Period page’s separately named observed-story duration remains anchored to the account’s first service record by established product semantics and is explicitly not a reporting-window coverage denominator.

Focused boundary/month/45-title-key/CLI/shadow result: **12 passed**. Full generator result: **38 passed, 1 known pre-existing failure**. The failure is the previously documented deleted/re-added chart cross-epoch assertion and is unrelated to dates; the frozen algorithm was not changed to mask it.

## Full corpus diff

The comparison used the exact pre-migration commit’s `annual-observation-v4.5.1` generator for the old side, the migration candidate for the new side, the same current read-only corpus, `generatedAt=2026-10-01T00:00:00+08:00`, isolated normalized caches, and two bounded workers. Account identifiers in audit artifacts are SHA-256 prefixes. No DB, production cache, job, summary, poster, or service state was written.

Private evidence: `/var/tmp/annual-window-old-v451-full.json`, `/var/tmp/annual-window-v451-diff-final.json`, and `/var/tmp/annual-window-v451-diff-final.records.jsonl`.

| Metric | Old window | New window |
|---|---:|---:|
| corpus scanned | 1,654 | 1,654 |
| successful summaries | 1,612 | 1,646 |
| controlled zero-data | 42 | 8 |
| exceptions/crashes | 0 | 0 |
| accounts omitting at least one optional page | 1,380 | 1,406 |
| accounts with all 21 pages | 232 | 240 |

Final candidate page-count distribution is: 6:9, 7:55, 8:41, 9:213, 10:169, 11:125, 12:51, 13:26, 14:4, 15:6, 16:15, 17:55, 18:137, 19:224, 20:276, 21:240. Omission is expected availability behavior, not a render failure.

| Diff class | Count | Meaning |
|---|---:|---|
| `EXPECTED_BOUNDARY_DIFF` | 1,146 | Same observed snapshot coverage; report identity/357-day metadata and boundary-derived fields changed |
| `EXPECTED_WINDOW_DIFF` | 466 | Additional September snapshots/events legitimately changed inputs |
| `EXPECTED_CORPUS_ADDITION` | 34 | Previously no-data account became eligible in the extended window |
| `UNCHANGED_NO_DATA` | 8 | No eligible snapshot in either window |
| `SUSPICIOUS` | 0 | None after field review |
| `BUG` | 0 | None |

Across successful old summaries, the changed-field counts were: version/period/summaryId 1,612 each; coverage 466; section hashes 462; overview 459; event count 455; event last 441; calendar 436; FinalTitle 314; monthly keys 135; page count 71; mode 18; event first 17. These are consistent with a longer end window plus the new report identity.

Invariant failures were all zero: invalid JSON/NaN, negative or `>357` active days, streak greater than active days, calendar range/order, month order, duplicate event IDs, out-of-range representative/observed-to timestamps, empty/missing FinalTitle evidence, and page count outside 5–21. In particular, neither boundary-excluded date appears as report activity.

## Bugs found and fixed

1. **Two conflicting production windows.** Viewer metadata ended September 11 while Python used hard-coded 06:00/04:00 bounds. Fix: one Viewer-owned contract and a strict Python consumer.
2. **Inclusive datetime end.** Snapshot and Dan filters could rely on `<=`/`>` semantics. Fix: a true exclusive `2026-10-01T00:00:00` boundary, including microseconds safely.
3. **Source timestamps could escape the report range.** A trusted update/high-score timestamp inside an observation interval but outside the report could become a representative date. Fix: keep the frozen interval event/delta, but publish no out-of-window representative time and attach an explicit warning.
4. **Window changes did not fully identify cached work.** Algorithm version alone did not distinguish report windows. Fix: report revision plus complete window identity in Viewer input fingerprints, job/failure keys, Python input fingerprints, and stored-summary acceptance checks.
5. **Date display depended on locale parsing.** Fix: a plain calendar-date formatter renders the specified stable range without browser timezone conversion.

No FinalTitle formula, event delta, recommendation, rating, or scene-availability rule was changed.

## Cache/fingerprint validation

- Viewer input fingerprints hash algorithm, schema, version key, producer revision, and the complete reporting-window object.
- Python input fingerprints include start, inclusive/exclusive end, 357 days, timezone, and revision; summary IDs therefore change.
- durable job keys, build input revisions, and reusable failure records use the producer revision;
- build recovery state is `annual-build-state-v2-report-window`;
- stored summaries are rejected unless start, end, effective end, and timezone equal the current canonical version;
- poster/share sources remain keyed to the resulting new summary ID, so old summary-derived artwork cannot masquerade as current output;
- normalized snapshot parsing cache remains reusable because it contains date-independent parsed snapshots; window selection/result artifacts are not reused across revisions.

This is deterministic invalidation; no manual cache deletion is required.

## FinalTitle/events validation

The FinalTitle implementation and all 45 ordinary keys are unchanged, as are StrongDan overlays and mark semantics. Every one of 1,646 generated summaries had a title key plus non-empty evidence. 314 title/evidence outputs changed because their permitted inputs changed; these are expected product changes rather than compatibility regressions.

Events retain existing interval semantics. Representative timestamps are monotonic when sorted, lie inside the half-open window, and are optional for interval-only evidence. `observedBetween.from` may identify the explicit pre-window baseline; `observedBetween.to`, report attribution, and all representative dates are in-window. The corpus found zero duplicate IDs and zero invalid timestamps.

## Representative account diffs

| Cohort | Expected old → new result |
|---|---|
| small/sparse | Snapshot/event/overview/title/page inputs unchanged; `totalDays` 338→357 and report identity changed; 11 pages |
| median | snapshots 25→26; plays 1,384→1,544; active days 46→54; last event June 16→September 11; months gain September; title unchanged; 20 pages |
| `91899919` | snapshots 207→211; plays 2,617→2,807; active days 49→53; events 2,672→2,874; last event September 9→21; FinalTitle moves from devotion-song evidence to endurance-volume evidence; 20 pages |
| largest input | Same 303 in-window snapshots, 6,322 plays, zero timed events, archive title, and 9 pages; only report identity/338→357 metadata changes |

The `91899919` title change is an expected window result: the frozen selector receives 190 more observed plays and four more active days. No compatibility hook was added to preserve the old title.

## Performance

Historical 9.61.13 medians and the migration samples use the same frozen fixture and private normalized caches. Current-host samples were also alternated with the exact old-window v4.5.1 source because the host did not reproduce the old benchmark class during the first pass. The final evidence records wall, user/sys CPU, ru_maxrss, event count, and output hash; swap stayed zero and no raw-payload accumulation or memory staircase appeared.

Private paired measurements are under `/var/tmp/annual-window-perf-control/`; the historical manifest is `/var/tmp/annual-performance-phase4/final-alternating5/manifest.json`.

| Cohort | 9.61.13 median wall / user / sys / RSS | Same-host old → new wall | Same-host user/sys old → new | Same-host RSS old → new | Events old → new |
|---|---|---|---:|---:|---:|
| small | 0.510s / 0.317s / 0.053s / 48.5 MiB | 2.143s → 1.958s (-8.6%) | 1.775/0.322s → 1.644/0.308s | 164.3 → 164.8 MiB (+0.3%) | 92 → 92 |
| median | 0.758s / 0.587s / 0.064s / 52.7 MiB | 2.517s → 2.520s (+0.1%) | 2.142/0.346s → 2.220/0.336s | 168.5 → 168.7 MiB (+0.1%) | 1,402 → 1,483 |
| `91899919` | 6.022s / 5.604s / 0.268s / 74.4 MiB | 14.354s → 13.521s (-5.8%) | 12.637/0.871s → 12.032/0.669s | 183.4 → 186.4 MiB (+1.6%) | 2,672 → 2,825 |
| largest | 18.269s / 17.447s / 0.728s / 63.5 MiB | 46.015s → 47.537s (+3.3%) | 40.628/1.655s → 41.805/1.764s | 179.6 → 180.1 MiB (+0.3%) | 0 → 0 |

The host-wide slowdown affects the exact old source too (for example, the unchanged small control is 2.143s now versus the archived 0.510s). It is therefore not attributed to this migration. In the paired control, wall/CPU movement stays within -8.6% to +3.6%, migration RSS movement is at most +1.6%, and swap is zero.

The longer window legitimately increases event output for the median and `91899919`; the small and largest inputs have unchanged snapshot/event coverage and serve as controls. Performance interpretation uses the alternating same-host control, not a misleading direct comparison across different host conditions.

## Human semantic review

After corpus invariants passed, the authoritative 21-page registry was reviewed page by page against the normalized summary fields above. Cohorts covered high activity (`91899919`), sparse data (small), exact start/end/microsecond fixtures, a cross-year active account (median/`91899919`), and the largest archive/current-state case.

Checks covered displayed range, October partial month, year/month order, first/last labels, timeline/event dates, totals, optional-page omission, FinalTitle/evidence, and poster/drawer reuse. No page performs a hidden second date filter or fixed-year normalization. The only date outside the report displayed as a metric is the explicitly allowlisted all-time observed-story anchor on Period; it is not presented as an annual first play.

The real Viewer normalizer was run on the representative candidate outputs. It produced 11 visible pages for sparse, 20 for median, 20 for high activity, and 9 for the largest archive case; every one displayed `2025.10.09 – 2026.09.30`, preserved chronological month/day inputs, and exposed a non-empty FinalTitle/evidence pair. The missing optional pages matched unavailable section status rather than a render or date-filter error.

The user request says 23 pages, but the product’s frozen executable contract is 21. All 21 were reviewed; no scenes were added or removed. This was a data-semantic review, not a new UI redesign or production smoke.

Final Viewer validation: Annual contract/tests **23/23 passed** and the bounded production build completed. The build required a 4 GiB Node heap under the 5 GiB build-cgroup limit after the default ~2 GiB heap exhausted during the final Nitro bundle. Unauthenticated prerender emitted the existing missing-DB-credentials warnings but the client, SSR bundle, prerender, PWA assets, and Nitro server all completed.

## Gate

**ANNUAL REPORTING WINDOW MIGRATION — READY**

The code and offline evidence are ready for a separately authorized release. This task did not deploy, synchronize the production generator runtime, mutate a database, or run an online production smoke.
