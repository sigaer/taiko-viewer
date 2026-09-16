# Annual First-Run Closed Beta release

## Current gate

Pre-release implementation and isolated verification complete. Production deployment/smoke pending; do not distribute wave invitations until the final gate below is updated.

Viewer 0.68.0. Algorithm remains annual-observation-v4.5.0. Generator semantic model, 45-key titles, Dan V4/gate/24 buckets, scene and Poster design unchanged.

## Repository and title relations

- `df8ecf3`: canonical title-relations decision and full semantic audit.
- `b298389`: reduced-motion fix and minor version bump.
- Feature commits recorded below after integration.

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
- Invitation DB tests: valid/invalid/expired/disabled/used, no consume on validate, session-bound pending, expiry/disable recheck, concurrent two-user single winner, idempotency PASS.
- Real isolated HTTP registration/login (synthetic email-verification fixture), pending/redeem, private API denial, feedback ownership, event dedup/secret filtering PASS.
- Real isolated browser anonymous-to-auth continuation PASS.
- Real isolated HTTP binding unchanged/changed and sync success PASS; external upstream simulated only in private preload, no production bypass added.
- Real runtime generator with synthetic no-history data → INSUFFICIENT_DATA, telemetry and terminal reload reuse PASS.
- Vue SFC compilation and git diff whitespace check PASS.

All pre-release mutation tests used actual SELECT DATABASE() `_test` and explicit opt-in. Test credentials/evidence stay private in `/var/tmp/annual-first-run-beta/`. Production account/binding smoke will use user-authorized test creation and ID 2258735, expected-state validation only; no title change or binding transfer.

## Production deployment, anchors and invitations

Pending standard deployment, five-anchor smoke, production version/health, invite batch creation and final gate. No claim of READY yet.
