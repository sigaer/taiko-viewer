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

## Final Wave 1 Sign-off

Status during patch preparation: **HOLD — P1 failed-job recovery**. The following investigation supersedes the earlier “no unresolved product P0/P1” statement. No full-corpus rerun; Annual core and algorithm remain frozen.

### Admin auth

Refreshed session verified at **2026-09-16 21:52:50 CST**, production `/api/admin/annual-beta` HTTP 200. Operator authentication uses the existing trusted backend. Supplied Viewer owner session belongs to user 1, not malu; investigation uses authorized operator routes, never owner impersonation. Credentials are private, excluded from Git/report/log output.

### Remaining anchors

Pre-patch production 0.68.1: all three passed real browser/API checks in zh and ja. Latest-patch verification remains required below.

| Taiko ID | Standing key | zh evidence | zh Finale = Poster | ja Finale = Poster |
| --- | --- | --- | --- | --- |
| 66792598 | standing_12_gold_rainbow | 七段 · 金虹合格 | 初虹 | 初虹 |
| 47279977 | standing_15_gold | 十段 · 金合格 | 天衡破阵 | 天衡破陣 |
| 84813650 | standing_16_gold_rainbow | 玄人 · 金虹合格 | 玄钢无瑕 | 玄鋼無瑕 |

ja evidence resolved from Japanese dictionaries; generator/API finalTitle equality passed. Previously completed 40500773/49557999 were not rerun before the patch. All five will receive the requested post-patch regression.

### Real First-Run Incident

**Classification: CASE D — Failed-job terminal trap, P1.** Historical failures were Viewer schema validation errors. They were retained after that schema problem had been fixed, and 0.68.1 reused the last failed task indefinitely. Current data is sufficient and the production-source generator succeeds. This is not a new generator exception, insufficient-data condition, auth failure, ownership mix-up, or demonstrated sync race.

#### Identity / binding / entitlement

Viewer `malu` = internal user **31**, current binding **552**, Taiko **99408699**, source `wahlap`. Binding created 2026-09-14 22:58:53 CST and current by 23:00:58. The only current owner of 99408699 is user 31. An older manual binding belongs to the same user and is not current; its summary is correctly not served for binding 552. No cross-user data / P0.

Entitlement `annual_first_run_beta` enabled, existing internal grant from 2026-08-03, no invite required. Participant `b660f0f2-2c66-48ff-bcaa-4aea5814c940`, hint T0; no pending invite or entitlement mismatch established.

#### Lifecycle timeline

All times below are **CST (UTC+8)**. Missing pre-telemetry events are explicitly unknown, not reconstructed as synthetic success events.

| Time | Evidence / event |
| --- | --- |
| Sep 14 22:58:53–23:00:58 | Binding 552 created and made current; predates Beta binding telemetry |
| Sep 14 23:02:15–23:02:20 | Historical completed build for binding 552; no summary currently linked |
| Sep 15 13:51:48 | Existing authenticated session created; no new `auth_success` in today's entry |
| Sep 16 00:31:57–00:32:06 | Failed build #1, schema rejects v4.5 finalTitle fields |
| Sep 16 00:32:10–00:32:15 | Failed build #2, same validation failure |
| Sep 16 00:32:39 | Sync log 188 success, `sakura-bot`; current userdata/history updated |
| Sep 16 00:32:45–00:32:49 | Failed build #3, same validation failure despite completed sync |
| Sep 16 00:32:59–00:33:04 | Failed build #4; retained terminal task |
| Sep 16 21:35:34.753 | `home_view` |
| Sep 16 21:35:34.759 | `annual_entry_impression`, home_hero |
| Sep 16 21:36:07.304 | `annual_entry_click` |
| Sep 16 21:36:07.477 | `annual_entry_ready` |
| Sep 16 21:36:17.767 / 21:36:24.106 | Repeated entry clicks; no additional build jobs |

At today's click binding was already successful and last sync had completed ~21h 3m 28s earlier. No new invite validate/redeem, auth, binding start/pending/verify, data_sync_start/success/failure, annual_build_start/success/failure, annual_unavailable, or annual_report_open was recorded during this entry. Old failed task reuse explains the missing new build events.

Historical build starts were 42s and 29s before the last recorded sync success, then 6s and 20s after it. All had sufficient history and the same schema error. There were four serial attempts, no overlapping build intervals. Existing records do not establish which old attempts were user clicks versus old client retries; today's three clicks created zero jobs.

#### Sync and snapshots

- Current userdata exists; mtime **2026-09-16 00:32:39.396 CST**. Last successful sync log 188: 00:32:39, transport `sakura-bot`, 1519 songs, message confirms userdata/history refresh.
- Last sync duration/start timestamp was not recorded by this historical transport; no duration inferred from identical created/updated timestamps. No failure reason on that successful sync.
- History directory exists, not a symlink. 936 raw files; 881 reconstructed snapshots; ignored files 0, symlink snapshots 0, alias-named snapshots 0.
- Exact frozen Annual interval: **2025-10-09 06:00 → 2026-09-11 04:00 CST**. Raw filename timestamps inside interval: 366. Reconstructed observed snapshots in interval: **312**, plus one preceding baseline (313 selected).
- Earliest reconstructed timestamp 2023-10-27 22:18:47; latest 2026-09-16 00:32:39.351496. This account has substantial annual history, not current-only data.

#### Build jobs and cache

All four failed jobs belong to user 31 / binding 552 / annual_2026. Each has error `BUILD_FAILED`, safe message “年度总结生成失败，请稍后重试”, summary ID null, parameters `{}`. Historical jobs did not record algorithm version; do not invent that field. Their logs show generation reached 312 annual observations / 1802 changes, then Viewer schema validation rejected `/finalTitle` additional properties `strongDan` and `standingPresentation`.

| job_id | Created = started CST | Finished CST | State |
| --- | --- | --- | --- |
| 82b146c3-96a8-4d65-962e-d7ebf4fda42d | Sep 16 00:31:57 | 00:32:06 | failed |
| 69bd8e08-820e-43d5-9a18-20577c85334e | Sep 16 00:32:10 | 00:32:15 | failed |
| 3614ea01-077b-42e6-90f2-83ef5f1b235a | Sep 16 00:32:45 | 00:32:49 | failed |
| 1c504ae3-c719-4ef9-953c-44d8428246d8 | Sep 16 00:32:59 | 00:33:04 | failed; reused by 0.68.1 |

Binding 552 has no current summary row, hence no reusable/stale summary to serve. The old manual binding's completed summary is unrelated to current binding. No active job. Production admin job GET returned **HTTP 200 / business failed / BUILD_FAILED**; search correctly returned binding 552 and no summary. This was not 401/403.

0.68.1 envelope returned latest failed task whenever no payload/active job existed. Reload normalized it to `jobStatus=failed`, which prevented the automatic normal build POST. A direct old normal POST could have retried, but entry/reload never reached it. The new revision guard makes normal force=false behavior consistent on both envelope and queue.

#### Isolated production-source generator

`plugins.utils.annual_summary` CLI used real current userdata/history, current song/rating files, disabled normalized cache and Python bytecode writes, and wrote only a private `/var/tmp` output. No production DB/cache write.

**SUCCESS**: schema 4, algorithm `annual-observation-v4.5.0`, summary ID `annual_73c77d3717c14be70cca3873`, 17 sections / 1802 events, ordinary title `final_exploration_endurance`, strongDan false, standing presentation null. No Python exception. No input or generator changes.

#### API → UI contract

```text
0.68.1: no current summary + last failed task
  → envelope.buildJob.status=failed, error.code=BUILD_FAILED
  → version-summary.vue watcher sets jobStatus, skips automatic build
  → AnnualBuildPrelude failed branch
  → “生成报告失败” / “本次装订停留在了半路”

INSUFFICIENT_DATA
  → explicit earlier unavailable branch in version-summary.vue
  → “当前年度记录不足，暂时无法生成年度报告。”
  → annual_unavailable reason=insufficient_data
```

The insufficient-data branch already existed and is correct for its error code. The patch also suppresses the generic error toast after polling a legitimate insufficient-data result. No unused locale keys or Annual narrative changes.

#### Affected scope and minimal fix

Read-only production query: **1 account** whose latest build is failed (99408699); **0 accounts** with current userdata modified after that latest failed completion. Malu's problem is recovery after the Viewer schema contract was fixed, not a data update after its last failure. The previously measured 23 insufficient-history accounts are not the affected population for this incident.

0.68.2 records a source revision (current userdata + snapshot file metadata, algorithm, independent Viewer build-state revision) at job creation. Same revision + failed job remains terminal for normal requests, including repeated POSTs. Changed data revision permits a new normal build. Legacy jobs without a revision get one fresh attempt; its outcome records the revision, preventing a reload loop. Explicit retry remains available. Frozen algorithm version is unchanged.

Operator state endpoint reads the same owner envelope through the existing admin/operator boundary. Selected-binding forwarding in admin build now preserves the validated binding. No summary injection, cache clearing, job-status rewrite, failed-job deletion, snapshot fabrication, or special case for 99408699.

#### Predeployment regression

- `npm run test:annual` (including source-revision recovery test), annual period regression, admin trust-boundary regression: PASS.
- Real isolated DB identity `_test` + explicit mutation opt-in; real HTTP/generator with entirely synthetic userdata, no production data copied into test DB.
- No-history build → INSUFFICIENT_DATA; browser friendly unavailable, no generic failure / API 500; repeated reload/normal POST reuse the same failed task, total build count 1.
- Add synthetic annual observations → envelope no longer reuses failure → two concurrent normal POSTs deduplicate to one cold build → completed v4.5 summary. Telemetry unavailable + build_success, no build_failure.
- Dashboard default excludes marked participant across funnel/times/feedback/invites; raw operational counts unchanged. A real invited T3 tester remains in the funnel; T3 alone is not treated as internal. Anonymous operator state request returns 401.

Private evidence: `/var/tmp/annual-beta-final-signoff/` (auth excluded from reports). Fix commit/deploy and post-patch production results will be recorded after release.

### Email smoke

**N/A for this execution — optional live delivery not completed.** Production registration requires email verification, so this is not a claim that email is unnecessary. Earlier synthetic verification fixtures did not prove actual email receipt. No authorized readable smoke mailbox was supplied; requested separately. This optional item is not a root-cause or sign-off prerequisite under the requested gate.

### Dashboard isolation

Predeployment PASS. Formal analysis defaults to excluding explicitly marked internal/smoke participants and existing pre-Beta internal grants. Raw events remain available with the operator toggle. Postdeploy classification of the four known production smoke accounts and four anonymous viewport QA participants remains pending; T3 hint alone will no longer be relied on to filter general funnel counts.
