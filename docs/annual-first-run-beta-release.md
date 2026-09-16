# Annual First-Run Closed Beta release

## Current gate

Implementation and production first-run smoke PASS. Remaining verification: three anchor accounts need a refreshed administrator session. Do not claim the complete five-anchor gate yet.

Viewer **0.68.1** deployed. Algorithm remains annual-observation-v4.5.0. Generator semantic model, 45-key titles, Dan V4/gate/24 buckets, scene and Poster design unchanged.

## Repository and title relations

- `df8ecf3`: canonical title-relations decision and full semantic audit.
- `b298389`: reduced-motion fix and minor version bump.
- `0943414`: atomic invitation/entitlement and lightweight event storage.
- `0ebf784`: Hero, entry and first-run lifecycle.
- `df342de`: feedback, operations Dashboard and runbook (0.68.0 release).
- `e996a89`: replacement-invite recovery and 0.68.1 patch release.

Found exact 34291… backup `/var/tmp/annual-v45-unrelated-before-fix.json`. Compared against actual tracked HEAD: 71 added / 20 removed / 67 changed, not formatting/sort-only; duplicate references 0; title names unresolved 0; song names unresolved 19 HEAD / 24 candidate. The file has names rather than numeric IDs. Candidate incorrectly turns generic play conditions/series into song references. Rejected candidate; restored exact tracked HEAD. See [full semantic audit](annual-beta-title-relations-audit.md).

Final canonical SHA: `52a02e6d9d6e2f10ae58fe4d701291ca3894af1c858ff97fb53e6edfe748cf47`. File tracked and clean. Historical 4cc9… preservation and stash/restore deploy exceptions are retired; deployment script unchanged.

## Opening and Hero

Reduced Motion had no motionScope, but navigation completion depended on it. Navigation now completes immediately without a fake scope/timer. Normal motion preserved. Existing admin rendering harness: 9 cases PASS, including mobile/desktop × reduce/normal direct navigation and subsequent Finale navigation.

`AnnualHero.vue` is the first homepage business area, public to anonymous and authenticated users. Uses existing `/hero.png` (612×121), full proportional image, accessible whole link to `/annual`. No extra CTA or crop. Isolated browser screenshots at 360/390/430/1440: first viewport, no overlap/overflow, keyboard Enter PASS. Evidence `/var/tmp/annual-first-run-beta/hero-<width>.png`.

## Invite and entitlement

Additive web_beta_invites/participants/sessions/pending/events/feedback tables. Existing `web_annual_summary_access` extended with enabled/invite_id/feature; no parallel entitlement system. Existing internal grants retained; admin uses existing trusted backend authentication plus annual operator policy.

Invites use 128-bit crypto randomness, SHA-256 hash storage, expiry/disable and default single use. Anonymous validate does not consume. A 256-bit opaque HttpOnly/SameSite pending cookie expires after 30 minutes and binds to a browser beta session. Auth completion revalidates and atomically locks pending/invite/user before consuming and granting. Idempotent same-user retry supported. Codes never go in URLs.

All private annual result/build/assets/jobs/shares/reaction routes retain server entitlement and owner guards. Anonymous/direct non-entitled denial verified. Origin validation and session/IP rate limiting applied to beta writes.

Browser discovered a real auth-return blocker caused by global KeepAlive; fixed `/annual` to re-evaluate on activation. Anonymous validate → existing login → automatic redeem → binding CTA now PASS without refresh.

## Tracking, onboarding and unavailable

Minimal server event table records participant/user/invite/session, timestamp, app/algorithm version, locale/device/route and allowlisted metadata. Business success events originate server-side. No raw codes, credentials, full userdata or querystrings stored. Hero impression requires viewport >=50%, unique once/session. Slide events debounce 350ms, verify active visible viewport, unique session+slide key. Direct Poster skip does not claim report completion.

Auth, binding pending/unchanged failure/changed success, all three existing sync transports, asynchronous builds, report/slides/Poster/share and feedback hooks included. Binding instruction impression uses actual viewport observation; existing pending confirmation DOM order preserved.

Insufficient data maps to friendly terminal state and annual_unavailable/insufficient_data, separate from build failure. Latest failed build is returned across reloads, preventing automatic rebuild loops; explicit retry is available after sync. No fake summary. Two repeated envelope reads reused the same terminal failed job in isolated testing.

## Feedback and operations

Low-interference data issue button plus Poster survey; seven issue categories separate subjective copy from data errors. Ownership verified server-side; automatic context uses owner summary, algorithm, actual userdata file mtime, slide, locale, app version and safe title keys when applicable. Survey has seven short answers plus 1–5 rating.

`/admin/taiko/annual-beta`: funnel, invitation states, step conversion, seven durations/p50, participant states/timeline/feedback, T1–T3 and invite disable. Authenticated Dashboard/timeline/hint mutation passed against isolated database. Anonymous admin denied. Runbook: [wave operations](annual-first-run-beta-plan.md).

## Verification

- Annual contract/schema/types and presentation regression PASS; period regression 6 PASS.
- Homepage state regression 18 PASS.
- Admin trust-boundary regression PASS; updated the regression runner to require actual isolated DB identity, explicit opt-in and temporary signing keys rather than production environment.
- Invitation DB tests: valid/invalid/expired/disabled/used, no consume on validate, session-bound pending, expiry/disable recheck, concurrent two-user single winner, idempotency PASS.
- Real isolated HTTP registration/login (synthetic email-verification fixture), pending/redeem, private API denial, feedback ownership, event dedup/secret filtering PASS.
- Real isolated browser anonymous-to-auth continuation PASS.
- Real isolated HTTP binding unchanged/changed and sync success PASS; external upstream simulated only in private preload, no production bypass added.
- Real runtime generator with synthetic no-history data → INSUFFICIENT_DATA, telemetry and terminal reload reuse PASS.
- Real runtime generator with entirely synthetic, sufficient snapshot fixture → completed cold build, annual_build_success event, valid v4.5 summary and cached ready envelope PASS. No production data copied into test DB.
- Vue SFC compilation and git diff whitespace check PASS.

All pre-release mutation tests used actual SELECT DATABASE() `_test` and explicit opt-in. Test credentials/evidence stay private in `/var/tmp/annual-first-run-beta/`. Production account/binding smoke will use user-authorized test creation and ID 2258735, expected-state validation only; no title change or binding transfer.

## Production deployment, anchors and invitations

Standard deploy for `df342de` exited 0 on 2026-09-16 around 21:18 CST; production version 0.68.0, health active. Optional Baidu push reached daily quota; not a release error. No manual push/output replacement/restart or title-file exceptions.

Production results:

- Homepage/image HTTP 200; 360/390/430/1440 viewport Hero/keyboard PASS.
- Anonymous Hero → Gate → validation → real existing login → automatic redeem → binding UI PASS in browser.
- Two additional dedicated accounts exercised existing real registration/login APIs. Synthetic email verification records were explicitly provisioned; this does **not** validate email delivery. Credentials remain 0600 private files.
- Anonymous and logged-in redeem PASS; unentitled build 403; invalid code 400; used code 409; feedback success; Dashboard authenticated 200.
- Authorized test ID 2258735: already-owned prepare rejected 409; confirmation without proof 400; no title change or binding transfer. Successful changed-title binding was exercised only in isolated DB with fixture upstream, per user clarification.
- Existing owner 2258735: report → Poster → Finale, reduced-motion skip 134ms; both issue/survey submitted; real data sync HTTP 200/success.
- Anchors 40500773 and 49557999: generator/API final title equality, Finale/Poster and standing evidence PASS. At 66792598 the admin build API returned 401 when the provided session expired at 21:19 CST; 47279977/84813650 not yet run. This is an authentication prerequisite, not evidence of a report crash. Prior v4.5 full validation remains unchanged.
- Initial five-minute soak: unexpected annual 5xx 0, error/job-exception log lines 0, service restarts 0; memory declined from ~1.78 GB to ~1.21 GB. No smoke invitation found in access/journal logs.

One additional recovery issue found during review: a code consumed/disabled during auth left no direct way to enter a replacement. 0.68.1 adds that recovery action without changing invite/generator semantics. Lightweight real-component fixture verifies error → new code → redeem → binding. Standard deployment of `e996a89` exited 0; production homepage and image 200, version 0.68.1, service active/NRestarts=0. A fourth dedicated production test account then passed the real disabled-during-auth → re-enter → replacement-code redeem → binding flow.

Invite batch (all unused, single-use, 0600 verified):

- Wave 1: 12, `/var/tmp/annual-beta-invites-20260916-wave1.csv`.
- Wave 2: 32, `/var/tmp/annual-beta-invites-20260916-wave2.csv`.

Five separate smoke invites (four redeemed, one deliberately disabled) are not part of those 44 distributable codes. Smoke accounts 767/768/769 and the replacement-flow account (ID in private recovery evidence) are marked T3 to exclude them from self-service activation; raw funnel counts retain their test events as the operational baseline. Private evidence: `/var/tmp/annual-first-run-beta/production-*.json` and screenshots.

Final gate pending refreshed admin authentication for anchors 66792598 / 47279977 / 84813650. 0.68.1 deployment verification is complete. Recommendation: keep the deployed production release; hold Wave 1 sign-off until these three requested checks are finished. No unresolved product P0/P1 established; READY is not asserted while required verification remains incomplete.

## Changed files

- `docs/annual-beta-title-relations-audit.md`
- `docs/annual-first-run-beta-plan.md`
- `docs/annual-first-run-beta-release.md`
- `taiko_viewer/components/AnnualBetaContinue.vue`
- `taiko_viewer/components/AnnualBetaFeedback.vue`
- `taiko_viewer/components/AnnualHero.vue`
- `taiko_viewer/components/account/version-summary/StoryPlayer.vue`
- `taiko_viewer/components/account/version-summary/slides/OpeningSlide.vue`
- `taiko_viewer/components/account/version-summary/slides/PosterSlide.vue`
- `taiko_viewer/components/admin/AdminShellNav.vue`
- `taiko_viewer/composables/useAnnualBeta.ts`
- `taiko_viewer/middleware/annual-summary-access.ts`
- `taiko_viewer/package-lock.json`
- `taiko_viewer/package.json`
- `taiko_viewer/pages/account/login.vue`
- `taiko_viewer/pages/account/profile.vue`
- `taiko_viewer/pages/account/register.vue`
- `taiko_viewer/pages/account/sync.vue`
- `taiko_viewer/pages/account/version-summary.vue`
- `taiko_viewer/pages/admin/taiko/annual-beta.vue`
- `taiko_viewer/pages/annual.vue`
- `taiko_viewer/pages/index.vue`
- `taiko_viewer/public/hero.png`
- `taiko_viewer/scripts/create_annual_beta_invites.mjs`
- `taiko_viewer/scripts/verify_admin_annual_report.mjs`
- `taiko_viewer/scripts/verify_annual_beta_http.mjs`
- `taiko_viewer/server/api/account/auth/login.post.ts`
- `taiko_viewer/server/api/account/auth/register.post.ts`
- `taiko_viewer/server/api/account/bindings/confirm.post.ts`
- `taiko_viewer/server/api/account/bindings/prepare.post.ts`
- `taiko_viewer/server/api/account/sync.post.ts`
- `taiko_viewer/server/api/account/sync/kinoko-history-import.post.ts`
- `taiko_viewer/server/api/account/sync/kinoko-import.post.ts`
- `taiko_viewer/server/api/admin/annual-beta/index.get.ts`
- `taiko_viewer/server/api/admin/annual-beta/manage.post.ts`
- `taiko_viewer/server/api/admin/annual-beta/participant.get.ts`
- `taiko_viewer/server/api/annual-beta/events.post.ts`
- `taiko_viewer/server/api/annual-beta/feedback.post.ts`
- `taiko_viewer/server/api/annual-beta/redeem.post.ts`
- `taiko_viewer/server/api/annual-beta/status.get.ts`
- `taiko_viewer/server/api/annual-beta/validate.post.ts`
- `taiko_viewer/server/services/account/annual-summary/access.ts`
- `taiko_viewer/server/services/account/annual-summary/index.ts`
- `taiko_viewer/server/services/account/annual-summary/repository.ts`
- `taiko_viewer/server/services/account/annual-summary/runtime.ts`
- `taiko_viewer/server/services/annual-beta/admin.ts`
- `taiko_viewer/server/services/annual-beta/core.ts`
- `taiko_viewer/server/services/annual-beta/events.ts`
- `taiko_viewer/server/services/annual-beta/schema.ts`
- `taiko_viewer/server/utils/account-db.ts`
- `taiko_viewer/tests/adminAuthTrustBoundary.test.mjs`
- `taiko_viewer/tests/annualBeta.integration.test.mjs`
