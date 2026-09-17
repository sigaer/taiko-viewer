# Annual First-Run Closed Beta release

## Current gate

**READY FOR WAVE 1 — invite uniqueness confirmed — 2026-09-16 23:10 CST.** Viewer 0.68.3 production uniqueness smoke and audit PASS. The earlier malu/anchor sign-off remains intact; no unresolved invite allocation blocker. Continue manual Wave 1 distribution from the unchanged batch, without further internal expansion.

Viewer **0.68.3** deployed. Algorithm remains annual-observation-v4.5.0. Generator semantic model, 45-key titles, Dan V4/gate/24 buckets, scene and Poster design unchanged.

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

Five separate smoke invites (four redeemed, one deliberately disabled) are not part of those 44 distributable codes. At 0.68.1, smoke accounts 767/768/769/770 were marked T3, which excluded self-service activation but still polluted general funnel counts. 0.68.2 corrects default formal analysis as documented below; raw operational events remain available. Private evidence: `/var/tmp/annual-first-run-beta/production-*.json` and screenshots.

Historical 0.68.1 gate: held pending refreshed admin authentication for anchors 66792598 / 47279977 / 84813650. The newly reported malu incident and final disposition are documented below; that investigation supersedes the earlier assessment.

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

Final status: **READY FOR WAVE 1**. The confirmed **P1 CASE D** was fixed and closed on production 0.68.2. The following investigation supersedes the earlier assessment. No full-corpus rerun; Annual core and algorithm remain frozen.

### Admin auth

Refreshed session verified at **2026-09-16 21:52:50 CST**, production `/api/admin/annual-beta` HTTP 200. Operator authentication uses the existing trusted backend. Supplied Viewer owner session belongs to user 1, not malu; investigation uses authorized operator routes, never owner impersonation. Credentials are private, excluded from Git/report/log output.

### Remaining anchors

Pre-patch production 0.68.1 and final production **0.68.2**: all three **PASS**, real browser/API checks in zh and ja.

| Taiko ID | Standing key | zh evidence | zh Finale = Poster | ja Finale = Poster |
| --- | --- | --- | --- | --- |
| 66792598 | standing_12_gold_rainbow | 七段 · 金虹合格 | 初虹 | 初虹 |
| 47279977 | standing_15_gold | 十段 · 金合格 | 天衡破阵 | 天衡破陣 |
| 84813650 | standing_16_gold_rainbow | 玄人 · 金虹合格 | 玄钢无瑕 | 玄鋼無瑕 |

ja evidence resolved from Japanese dictionaries; generator/API finalTitle equality passed. Previously completed 40500773/49557999 were not rerun before the patch. All five also passed the requested post-patch regression below.

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

Private evidence: `/var/tmp/annual-beta-final-signoff/` (auth excluded from reports). Fix commit/deploy and final production results are recorded below.

### Email smoke

**N/A for this execution — optional live delivery not completed.** Production registration requires email verification, so this is not a claim that email is unnecessary. Earlier synthetic verification fixtures did not prove actual email receipt. No authorized readable smoke mailbox was supplied; requested separately. This optional item is not a root-cause or sign-off prerequisite under the requested gate.

### Dashboard isolation

**PASS on production 0.68.2.** Formal analysis defaults to excluding explicitly marked internal/smoke participants and existing pre-Beta internal grants. Raw events remain available with the operator toggle. Four known production smoke accounts and four anonymous viewport QA participants have been classified; T3 hint alone is not relied on to filter general funnel counts.

### Patch deployment and production closure

- Release commit **`8f617f9`**, Viewer **0.68.2**. Standard `bash scripts/deploy_forum_web.sh "<HEAD subject>"` exited **0**, production health checks passed around **2026-09-16 22:16 CST**. No manual deployment action. Optional Baidu submission reported daily quota, not a deployment failure.
- Algorithm remains **annual-observation-v4.5.0**. Title-relations canonical tracked SHA remains `52a02e6d9d6e2f10ae58fe4d701291ca3894af1c858ff97fb53e6edfe748cf47`; no special restore/stash rules.
- At 22:16:15.395, authorized operator state GET returned **HTTP 200 / missing / buildJob null** for user 31, current binding 552/99408699. This invokes the real owner-envelope service without impersonation; the legacy failed job was correctly no longer terminal.
- Normal operator build POST **force=false** created **`bb21363c-ad36-4133-97c9-517d1891dfe8`**, started 22:16:15, completed 22:16:21, error null. End-to-end observed cold completion **6.373s**. Job parameters now record algorithm and input revision.
- Real summary API returned **HTTP 200**, schema 4 / algorithm v4.5.0, summary **`annual_73c77d3717c14be70cca3873`**, ordinary `final_exploration_endurance`, strongDan false / standing null, matching isolated runtime output.
- Three subsequent state reads: **ready**, no buildJob, same summary ID, **51 / 63 / 50 ms**. Another normal force=false POST reused cached summary in **58 ms**; the existing queue creates a completed cache-reuse receipt, not another generator run.
- Read-only comparison: all six historical user-31 jobs, including all four failed jobs, remain byte-for-byte unchanged in selected DB fields. Latest-failed-build population is now **0**. Production telemetry records the normal recovery build start/success; no job-status manipulation.
- Dashboard **PASS**: operator action marked four known smoke accounts (767/768/769/770) and four known anonymous viewport QA participants. Same existing entitlement permissions; no event deletion. Formal analysis has **44 available invites** (Wave 1 12 / Wave 2 32); raw operational view retains **49** including the five smoke invites. Raw funnel/timing/feedback counts unchanged by exclusion.
- One newly arriving non-smoke visitor remains in formal analysis intentionally; it was not one of our QA accounts and has no internal grant. Invalid invitation attempts are retained as real funnel behavior. Do not “clean” real users to force zero baseline metrics.

### Final production browser regression

**12 / 12 PASS**: five required anchors plus malu, each zh and ja. Actual production summary API → opening → Poster → Finale. Generator/API finalTitle exact equality, v4.5 algorithm, localized evidence, and Finale/Poster title equality all passed. No full-corpus rerun. Malu used legitimate operator rendering and the real owner-envelope service; no claim of logging in as malu or of malu personally revisiting the page.

| UID | Ordinary semantic titleKey | Standing key | zh title (Finale = Poster) | ja title (Finale = Poster) |
| --- | --- | --- | --- | --- |
| 40500773 | final_growth | standing_19_gold_rainbow | 天极回响 | 天極の響 |
| 49557999 | final_speed_precision | standing_16_gold | 玄之静谧 | 玄の静謐 |
| 66792598 | final_endurance_precision | standing_12_gold_rainbow | 初虹 | 初虹 |
| 47279977 | final_growth | standing_15_gold | 天衡破阵 | 天衡破陣 |
| 84813650 | final_growth | standing_16_gold_rainbow | 玄钢无瑕 | 玄鋼無瑕 |
| 99408699 | final_exploration_endurance | null; strongDan false | 远行而不息 | 旅は止まらない |

Remaining-anchor ja evidence: **七段 · 金合格全良**, **十段 · 金合格**, **玄人 · 金合格全良**. Malu's evidence: **665 首曲目 · 753 张谱面** / **665 曲・753 譜面**. No generic failed branch when rendering its completed report.

One automation attempt clicked admin search before locale/hydration settled, sending an empty search and receiving 400. Screenshot showed the empty input. Fixed only the private script's readiness wait, retained the five already-passed zh cases, and completed the missing cases; no product patch or hidden retry of a generator failure. Evidence: `e2e-results-postpatch.json`, `e2e-postpatch/*`.

### Production stability

Observed **22:16:00–22:22:26 CST**. Annual API responses: **125 × 200**, **2 × 400** (invalid invite / empty admin search), **0 × 5xx**. Generator/schema exception matches 0; service active throughout, NRestarts 0. No repeated generator execution on ready reloads.

11 scheduled service samples plus final sample: memory 869.8 MiB at start, sampled peak **3451.4 MiB**, end **2361.2 MiB**. Memory rose under build/browser work then fell; prior v4.5 production validation saw a 4191.5 MiB peak under E2E. This is bounded release observation, not a same-load benchmark or a long-term no-leak claim. No clear severe performance regression established; Performance P2 remains unopened. Real generator duration telemetry **5432 ms**, end-to-end polling completion **6373 ms**, cached read **50–63 ms**.

### Final gate and Wave 1 handoff

| Required gate | Result |
| --- | --- |
| 66792598 / 47279977 / 84813650 on latest production, zh + ja | PASS |
| malu 99408699 incident explained, recovered through normal build, closed | PASS — CASE D |
| Unresolved P0/P1 | None |
| 0.68.2 production API/browser/stability smoke | PASS |
| Default Beta analysis excludes smoke/internal accounts; raw retained | PASS |

**READY FOR WAVE 1.** Recommend continuing production Viewer **0.68.2** with frozen **annual-observation-v4.5.0**. No further internal expansion.

User clarified that invitations are distributed manually from the pre-generated batch. Existing Wave 1 12-code batch split into **10 ready for manual distribution + 2 reserve**, no extra codes created, all files mode **0600**:

- Ready: `/var/tmp/annual-beta-invites-20260916-wave1-ready.csv`.
- Reserve: `/var/tmp/annual-beta-invites-20260916-wave1-reserve.csv` (replacement / recruitment / recovery).

Hand off the ready file for the user to distribute 8–10 invitations. Codes are not printed in this report or committed to Git. No claim that recipients have already received/redeemed them. Wave 2 remains untouched. Optional actual email delivery remains unverified as noted above; no synthetic email success claim.

## Invite uniqueness final check

2026-09-16: requested bearer-code contract review. Production **0.68.2** audited before implementation changes. Final uniqueness sign-off: **READY FOR WAVE 1 — invite uniqueness confirmed**; no formal invite used for testing.

### Production audit before changes

Read-only transaction at **22:55:48 CST**. No raw codes, tokens or sessions in audit output.

| Scope | Invites | Consumed | Users consuming >1 invite | Invites with >1 owner | Attribution anomalies | used_count / grant mismatch | Redeemed pending on unused invite |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Formal | 44 | 0 | 0 | 0 | 0 | 0 | 0 |
| Including internal/smoke | 49 | 4 | 0 | 0 | 0 | 0 | 0 |

Audit correlates retained redeemed pending rows, grant ownership and successful redemption events, checks participant attribution against grants/event history, and checks used_count against actual grant owners. No historical data correction is required; no records deleted or silently rewritten.

Formal files were matched privately by code hash to DB rows: **Wave 1 ready 10/10 unused**, **reserve 2/2 unused**, **Wave 2 32/32 unused**. Snapshot includes IDs, counters/status and private file SHA-256 for post-release comparison; raw codes are not exported to the report.

### Existing contract and minimal correction

0.68.2 already locked the user row before checking/inserting its grant, so the existing transaction prevented a second actual consumption in the reviewed path. No production duplicate consumption was found. It did **not** fully meet the requested result/attribution/event contract:

- It locked and validated pending/invite before checking the user's grant, so an already-entitled user could get an invite validity error instead of an idempotent result.
- It marked a different, unused invite's pending row as redeemed even when an existing grant skipped consumption.
- The HTTP route attempted another `beta_invite_redeemed` event on reuse; session-scoped dedup could not prevent another session's false success event.
- An HTTP retry after clearing the pending cookie returned a pending error rather than already entitled.

0.68.3 changes only invitation redemption/ownership and related operational counts. Annual algorithm, FinalTitle/strongDan, Hero/onboarding, Binding/Sync, funnel stages and 24-bucket copy are untouched. No formal code regenerated or replaced.

Transaction order:

1. BEGIN; `SELECT web_user_accounts ... FOR UPDATE` serializes all redeem attempts for that user, including when no entitlement row exists.
2. The first consistent read after this lock checks the existing `web_annual_summary_access` grant. Enabled `annual_first_run_beta` returns HTTP 200 **ALREADY_ENTITLED**, `reused=true`, original invite ID (null for internal grants), before touching the submitted pending/invite. Disabled grants remain denied and cannot consume replacement codes.
3. Otherwise lock session-bound pending, then invite; recheck expiry/disable and unused single-use capacity.
4. Atomically increment from `used_count=0`, insert grant, set participant attribution only when previously null, and mark that pending redeemed. Any attribution conflict rolls back the entire consumption.
5. COMMIT; HTTP 200 **REDEEMED**, `reused=false`.

Using an existing user row as the mutex avoids locking a missing entitlement index gap; different users competing for one invite therefore do not introduce a gap-lock/insert deadlock. The grant read occurs after acquiring the user lock and sees the previous same-user transaction's commit. Anonymous validate remains unchanged: it creates expiring session-bound pending only, never reserves, consumes or assigns an owner.

DB constraints:

- Existing `web_annual_summary_access.PRIMARY KEY(user_id)` is retained: one grant per user, stronger than user+feature uniqueness for this existing table.
- Add nullable **UNIQUE `uniq_annual_beta_invite_owner(invite_id)`** on that same entitlement table: at most one grant owner per invite; multiple null internal grants remain valid. No parallel entitlement table.
- Existing participant UNIQUE(user_id), invite PRIMARY(id)/UNIQUE(code_hash), pending PRIMARY(token_hash) remain intact.
- Invite row lock plus `used_count=0` conditional update enforce single consumption independently of entitlement insertion; grant uniqueness is an additional safeguard, not the only guard.

### Telemetry and Dashboard

Only first consumption emits `beta_invite_redeemed`. Reuse emits server-only `beta_invite_redeem_skipped`, reason **already_entitled**, retaining original attribution and no raw code. No second redeemed event, including a second browser session.

Dashboard Redeemed counts distinct consumed invite rows (`used_count>0`), including codes subsequently disabled/expired. Entitled users counts distinct historical invited grant owners, not retry events; internal grants have no invite and are excluded. This is cumulative invite allocation, not a count of currently enabled access. Existing formal/internal exclusion remains in effect; raw operational events retained.

### Required tests

Real isolated database, actual `SELECT DATABASE()` ending `_test`, explicit mutation opt-in; no production data copied. New test users/participants and retained fixture invites are internal; fixture invites disabled on completion. Tests do not access any of the 44 formal codes.

| Test | Result |
| --- | --- |
| T1 first authenticated redeem consumes once, grants entitlement | PASS |
| T2 same user/same invite retry; also after pending cookie cleared | PASS; ALREADY_ENTITLED, used_count unchanged |
| T3 same user/fresh invite | PASS; unused and pending unclaimed, original participant attribution retained |
| T4 same user/two different invites concurrently | PASS; one REDEEMED, one ALREADY_ENTITLED, exactly one consumed |
| T5 two users/one invite concurrently | PASS; one winner, one used_invite rejection |
| T6 existing internal enabled entitlement/fresh invite | PASS; invite unused, returned original null attribution |
| T7 six concurrent anonymous validations | PASS; zero usage/owner |
| T8 pending A resumes after successful qualification via B | PASS; A unused/unclaimed, B remains original attribution |

Additional checks: disabled submitted invite cannot defeat existing entitlement; disabled entitlement cannot allocate replacement; unique index rejects a second invite owner; participant conflict cannot overwrite attribution and rolls back consumption. `npm run test:annual:beta`: **14 tests PASS**, including the existing race/expiry/session regression. Same-user race is held behind a real user-row lock before releasing both attempts.

Real authenticated isolated HTTP: first redeem, cookie-cleared retry, second-session fresh invite, simultaneous same-user two-session redemption, one successful redeemed event per user, skipped telemetry, and Dashboard consumption surviving later disable: **PASS**. Annual regression **9 PASS**, admin trust-boundary regression **PASS**. No full corpus, anchors, Binding/Sync or broader first-run retest.

Private evidence: `/var/tmp/annual-beta-invite-uniqueness/`. Deployment and final production audit follow below.

### Deployment and final verification

Release **`2e2d359`**, Viewer **0.68.3**, standard `bash scripts/deploy_forum_web.sh "<HEAD subject>"` exited **0** at approximately **23:09 CST**. Production homepage/version and normal health checks passed, service active / NRestarts 0. Optional Baidu daily quota response did not affect deployment. Algorithm remains **annual-observation-v4.5.0**. No manual push, restart, output replacement or formal batch regeneration.

Production smoke at **23:09:37 CST** used exactly one newly created, immediately internal-marked invite (`b92fb782-480b-46a4-89d3-7218f4d79282`), separate from the 44 formal codes. Existing internal user 1 and previously invited smoke user 767 each authenticated, validated that new code and called redeem twice (including after pending cookie deletion). All four redeems returned **HTTP 200 / ALREADY_ENTITLED / reused=true**.

- New smoke invite usage remained **0**; no pending record was falsely marked redeemed.
- Both users' entitlement and participant/invite attribution were unchanged.
- Additional `beta_invite_redeemed` events **0**; skipped events **2**, reason `already_entitled` (one per session).
- New invite was disabled at completion and remains analysis_excluded. No historical invite/job/event deletion or correction.
- Production unique owner index confirmed present and unique.
- Dashboard formal consumed invites / invited users = **0 / 0**; operational including prior smoke = **4 / 4**. New smoke and internal events remain excluded from formal analysis.

Final read-only audit at **23:09:47 CST**:

| Audit | Formal | Including internal/smoke |
| --- | ---: | ---: |
| Duplicate-consumption users | **0** | **0** |
| Multi-owner invites | **0** | **0** |
| Participant attribution anomalies | **0** | **0** |
| used_count vs actual grant mismatch | **0** | **0** |
| Redeemed pending linked to unused invite | **0** | **0** |

The only invite-count change is the one new disabled internal smoke code: operational 49 → 50, formal remains **44**. Exact before/after comparison of the formal IDs, used_count, max_uses, expiry, disabled/internal flags and private CSV SHA-256 passed. **10 ready + 2 reserve + 32 Wave 2 remain entirely unused**, unchanged and unreplaced.

| Contract | Final result |
| --- | --- |
| 1 invite → ≤1 authenticated owner | PASS — row lock, single-use conditional update, unique invite owner index |
| 1 user → ≤1 consumed invite | PASS — user serialization before invite consumption, retained unique user grant |
| Existing enabled entitlement → no fresh invite consumption | PASS — invited and internal grants |
| Same-user retry idempotent | PASS — including cleared pending cookie, no generic error |
| Same-user / two-invite race | PASS — isolated MySQL and real authenticated two-session HTTP |
| Two-user / one-invite race | PASS — existing and added isolated MySQL regressions |

**READY FOR WAVE 1 — invite uniqueness confirmed.** Keep production **0.68.3**. No further internal testing added; existing Wave 1 ready/reserve files remain the manual-distribution handoff.

## Eight-character invite update

2026-09-17: user requested eight-character random invitations and 40 available codes. Viewer **0.68.4** changes only newly generated bearer codes; internal UUID record IDs, entitlement uniqueness, redemption transaction and Annual algorithm remain unchanged.

New codes use cryptographically random eight-character uppercase strings from 32 symbols (`A–Z` excluding I/O, `2–9`), with no required separators. Input is case-insensitive and accepts an optional separator. Existing 32-hex-character codes remain compatible unless an individual unused code is explicitly retired as part of the batch handoff. SHA-256-only DB storage, current expiry/rate limits and single-user consumption guards remain unchanged. Unique-hash collision retries are bounded at five attempts.

Before mutation, all existing formal codes were confirmed unused: ready 10, reserve 2, Wave 2 32. Inventory scope/old-ready retirement is being clarified; no existing formal code has been changed during implementation.

`test:annual:beta`: **17 PASS**, including short-code input, legacy normalization and real DB lookup, collision handling, T1–T8 and both concurrency contracts. Deployment and final inventory are recorded after production verification below. Private evidence remains outside Git.
