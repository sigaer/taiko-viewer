## Execution Policy Override — 2026-09-10

Latest user instruction overrides historical execution/testing/deployment restrictions below; product definitions and Phase boundaries remain unchanged.

- Real business behavior first. Phase B-0 = PASS; DB Isolation = PASS; BLOCKED_PENDING_DB_ISOLATION = RESOLVED. Do not restart B-0 or require REFERENCES/fixtures/full staging.
- Continue existing Phase B code in the feature worktree. Verify real authenticated POST/GET, nonce retries, sanitize, rate limit, hidden, Poster immediate append/reload and moving barrage; Forum thread delta must remain zero.
- Each Phase may release independently after its product Gate is ready. For Phase B: audit changes, bump minor version, create release commit, integrate into main, then use only scripts/deploy_forum_web.sh with the HEAD subject. No manual push, output replacement or restart; stop if the script fails.
- Before release, mutations use the isolated test DB with SELECT DATABASE() and explicit mutation opt-in. After release, authorized real online smoke verifies the product; ordinary bugs are fixed forward. Final Gate B PASS follows online smoke.
- Only the final integration agent deploys. No Phase C/D work during Phase B. Existing historical no-deploy/feature-only/exhaustive-test rules do not override this policy.

# Annual Poster Community — Execution Status

Current Phase:
Complete — final closeout

Status:
COMPLETE

Phase A–F:
A PASS · B PASS (+ `0.54.1` hotfix VERIFIED ONLINE) · C PASS · D PASS · E PASS · F PASS

Production:
`0.57.1` (see the final closeout record at the end of this file)

Gate A:
PASS

Next allowed phase:
None — the plan's phases A–F are finished.

Gate A passed after user manual multi-viewport visual acceptance.

Gate B:
PASS

Phase B is complete. Local real-product acceptance and the authorized production account smoke both passed. The post-release profile-card hotfix `0.54.1` is VERIFIED ONLINE.

Gate C:
PASS

Phase C is complete: `general` = 闲聊杂谈 and `creative` = 同名二创 are live in `0.54.2`.

Gate D:
PASS

Phase D is complete: the Poster reaction sync creates a general/discussion thread, live in `0.55.0`.

Gate E:
PASS

Gate F:
PASS

## Current Phase B recovery — 2026-09-10

- Released version: `0.54.0` / `bed1bd9` (minor: authenticated reaction publishing and live barrage). Standard deployment succeeded with exit 0; local 3100 and online viewer both report appVersion 0.54.0.
- Backend: nonce lookup before rate limiting; same-user in-flight requests serialized; duplicate-key race re-reads the existing row. GET LIMIT is a bounded integer. Empty/overlong/non-text input rejected; whitespace normalized.
- Real API evidence: POST 200, GET 200, concurrent same nonce 200/200 with the same ID and exactly one DB row, new nonce within the window 429, fresh nonce after the window 200, hidden omitted, Forum thread delta 0.
- Actual Nuxt Poster: missing useViewerApiFetch initialization fixed; click POST 200, immediate append, 36.4px leftward displacement in 0.7s, reload read-back verified. A 30-second multi-item run had continuous visible motion, no lane collisions and no page errors.
- Product code: separate measured-width barrage component, 52px/s (22px/s reduced motion), 72px lane gap, low-data visual copies, active/visibility pause, 20-second refresh, persistent nonce on failed sends, in-flight GET/POST merge, admin hide/publish endpoint using existing admin authentication and action log.
- Cleanup: security.ts unchanged; forum-db.ts restored; account-db.ts contains only formal reaction DDL. No test FK stripping or security bypass remains in application code. Existing test guard and worktree schema-path resolution retained.
- External local QA files and credentials stay outside Git. Test dev uses `/tmp/annual-test-runtime.cjs` (checks SELECT DATABASE and mutation opt-in) and `/tmp/annual-phase-b-layer` (Element Plus dev cache), with isolated test cache paths.
- Local product acceptance: PASS. Single-row feed has continuous visible motion for 30 seconds without extra rows; inactive pause/resume PASS; background hidden refresh and zero-only empty state PASS; five viewport checks PASS (414×896, 390×844, 430×932, 390×760, 414×800). Short screens reserve at least 64px for three non-overlapping lanes. No browser page errors.
- Admin route rejects unauthenticated PATCH with 401. Hidden feed behavior verified against the actual test DB.
- Gate B: PASS. Final isolated worktree build PASS (exit 0), annual contract PASS, diff audit PASS, standard deployment PASS, authorized production account smoke PASS.
- Authorized online acceptance account: sigaer, drum ID 2258735. Actual Poster sent “今年也要开心打鼓！”; POST/GET 200, same nonce retry 200 with the same ID, exactly one production reaction row, sync skipped, no Forum thread. Immediate append/reload and continuous 30-second motion PASS; page errors 0. Both global and account-specific Forum thread deltas are 0.
- Online evidence: /tmp/annual-phase-b-online-final.json, /tmp/annual-phase-b-online-report.json, /tmp/annual-phase-b-online-sent.png. Reaction ID: 5e4b7bc5-1dcb-43c1-8ad2-e4f70168d3de. No secrets are stored in these project documents.
- Original main title_song_relations.json and poster.zip were preserved with matching pre/post hashes. Existing main documentation additions were incorporated. No Phase C/D implementation was performed.

## Phase B-0 test database isolation bootstrap

- Gate B-0: `PASS`. The dedicated non-production `_test` database and credentials are verified with guarded mutation smoke tests.
- Production DB configuration audit (names only): `/etc/taiko-viewer.env` uses `TAIKO_DB_HOST=127.0.0.1`, `TAIKO_DB_PORT=3306`, `TAIKO_DB_USER=taiko_viewer`, `TAIKO_DB_NAME=taiko`; the password is not recorded.
- Application connection path: `taiko_viewer/server/utils/account-db.ts` reads runtime config first, then `TAIKO_DB_*`, creates the MySQL pool in `getAccountDb()`, and schema helpers use that pool through `ensureAccountSchema()`.
- The earlier production-only probe reported `SELECT DATABASE()` as `NULL` and `CURRENT_USER()` as `taiko_viewer@127.0.0.1`; that result is historical production evidence, not test evidence.
- Production database defaults are `utf8mb4` / `utf8mb4_general_ci`; these are the required defaults for the isolated test database.
- Administrator-side setup created `taiko_annual_poster_test` and `taiko_viewer_test@127.0.0.1`; application-layer test connection verification passes.
- `BLOCKED_PENDING_DB_ISOLATION` is resolved. The test account intentionally has no `REFERENCES` privilege; the old in-source FK stripping workaround has been removed. The isolated dev process uses an external guarded preload; production DDL is unchanged apart from the formal reaction table.
- No production DB mutation was executed. Production DB, service, `.output`, port 3100 and online runtime remain untouched.

### Administrator-only SQL template (not executed)

```sql
CREATE DATABASE `taiko_annual_poster_test`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
CREATE USER `taiko_viewer_test`@`127.0.0.1` IDENTIFIED BY '<GENERATE_UNIQUE_TEST_PASSWORD_OUTSIDE_SHELL_HISTORY>';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP
  ON `taiko_annual_poster_test`.* TO `taiko_viewer_test`@`127.0.0.1`;
FLUSH PRIVILEGES;
```

After execution, the test operator must verify with the test credentials:

```sql
SELECT DATABASE(), CURRENT_USER();
SHOW GRANTS;
```

Expected: database `taiko_annual_poster_test`; grants reference only ``taiko_annual_poster_test`.*`` and contain no `taiko`.* / `*.*` grant, `SUPER`, `FILE`, `PROCESS`, `CREATE USER` or `GRANT OPTION`.

### Historical references privilege finding (resolved without privilege expansion)

- Application-layer connection and grants verification passed using the test-only env; the test database and account identity are correct.
- Synthetic fixture setup stopped at the first foreign-key definition with MySQL `ER_TABLEACCESS_DENIED_ERROR (1142)`: `REFERENCES command denied` for `taiko_annual_poster_test.annual_phase_b_test_users`.
- Guarded cleanup removed all attempted fixture tables; the test database is empty afterwards.
- No privilege expansion was performed. The abandoned synthetic FK fixture is not part of the Phase B path:

```sql
GRANT REFERENCES ON `taiko_annual_poster_test`.*
  TO `taiko_viewer_test`@`127.0.0.1`;
FLUSH PRIVILEGES;
```

- Gate B-0 is `PASS`; no production data was copied and no production write occurred.

## Phase A release stabilization

- Phase A: COMPLETE; Gate A: PASS.
- Deployed version: `0.53.34`.
- Deployed commit: `bb72232 0.53.34 年度Poster完成静态四格与分享入口重构`.
- `runtime mixed-version incident resolved by standard deployment.`
- Standard `scripts/deploy_forum_web.sh` completed with exit code 0 and pushed `bb72232` to `origin/main`.
- Read-only canary passed: local and online appVersion `0.53.34`; `taiko-viewer.service` active; representative JS/CSS, build metadata and `/titles` SSR returned HTTP 200; both Poster PNGs returned HTTP 200.
- No production write requests were made. Phase B has not started.

Phase B is in progress in the isolated feature worktree. The current Gate A decision remains PASS.

## Baseline

- baseline version: `0.53.33`
- baseline commit: `736dc0d 0.53.33 修复年度时段坐标与阴影层级`
- baseline source: `taiko_viewer/package.json` and repository HEAD at task start

## Locked Decisions

- `docs/annual-poster-community-plan.md` is the sole implementation spec.
- Phase A is static-only; no community write path or backend work.
- New four-grid UI is a separate `AnnualShareGrid`/Poster-specific presentation component; legacy share/poster remains a secondary entry.
- Forum sync controls are present but non-writing in Phase A; both community-sync checkboxes default checked.
- Only the Coordinator may change Gate A to PASS.
- Production writes and deployment are forbidden in this phase.

## Phase A allowed modifications

- `PosterSlide` static rebuild
- `AnnualShareGrid` and Poster-specific display components
- `background_22`, `square_bg`, four-grid real-data mapping
- six fields, static danmaku area, input, two checked community-sync checkboxes
- save-image button and legacy share secondary entry
- independent visual QA scripts/tests that do not implement business behavior

## Phase A forbidden modifications

- reaction DB/API, Forum auto-posting or Forum section changes
- share-card renderer, Playwright share-card, OSS image sync, Forum integration
- `server/*` feature additions, database schema, production writes, deployment
- entering Phase B–F

## Phase A checklist

- [x] Corrected 414×896 mosaic approved by human review
- [x] `background_22` correct
- [x] `square_bg` geometry correct
- [x] four grids map to real summary semantics
- [x] six fields complete
- [x] static danmaku/input visible
- [x] both community-sync checkboxes checked by default
- [x] save-image button and legacy share secondary entry visible
- [x] no overlap, clipping, or bottom navigation collision
- [x] Corrected five viewport QA complete (after master human review)
- [x] no Phase B–F backend implementation
- [x] Coordinator reviews corrected evidence and human approval before Gate A

## Known unrelated workspace modifications

- `taiko_viewer/assets/data/title_song_relations.json` is modified at baseline and is unrelated to this task. Preserve it and do not overwrite or include it in Phase A changes.

## Phase A closeout audit

- `background_22.png` is the supplied 414×896 artwork and `square_bg.png` is the supplied 363×554 geometry asset.
- `AnnualShareGrid` is mounted by `PosterSlide`; the three song positions resolve to distinct real covers for favorite, pound top song and high score song.
- Profile and song media tiles are equal squares in a centered 2×2 mosaic with `gap: 0`.
- The six fields are present and mapped to the annual summary contract; both community-sync checkboxes default to checked.
- Save/send controls remain non-writing static controls; the legacy 30-day share flow is a secondary entry.
- No Phase B–F implementation was added. No server, database or Forum code was modified by Phase A.
- `npm run test:annual` PASS; `POSTER_QA_ALL_VIEWPORTS=1 CHOKIDAR_USEPOLLING=1 node scripts/verify_annual_poster_static.mjs` PASS; `npm run build` PASS.

Gate A passed after user manual multi-viewport visual acceptance.

## Safe next action

Phase B is complete. Do not begin Phase C as part of this task. Final acceptance documentation is committed locally; no manual main push is performed.

## Historical Phase A working version

- Working package/package-lock version: `0.53.34` (compatible static UX rebuild).
- Baseline remains `0.53.33` / `736dc0d`; HEAD has not changed and this work is uncommitted.
- No homepage/version fallback contains the old baseline string; no fallback change was necessary.

## Runtime consistency audit (read-only)

- Git HEAD at audit: `736dc0d 0.53.33 修复年度时段坐标与阴影层级`.
- Working `taiko_viewer/package.json` and lockfile version: `0.53.34`.
- `127.0.0.1:3100` HTML appVersion: `0.53.33`.
- `https://viewer.sakura-bot.cn` HTML appVersion: `0.53.33`.
- `taiko-viewer.service`: active since `2026-09-09 11:09:41 CST`, MainPID `1194224`, running `.output/server/index.mjs`.
- The shared `.output` was rebuilt locally during this audit and now contains `0.53.34`; the still-running service process has not been restarted and therefore does not correspond to that latest output.
- Browser/HTTP checks reproduced JS chunk failures: multiple `/_nuxt/*.js` requests returned HTTP 500, plus the Nuxt build metadata JSON returned HTTP 500. The home-page browser session did not request Poster assets; direct probes for the new `background_22.png` and `square_bg.png` returned HTTP 404 from both local and online 0.53.33 instances. No CSS, song-cover, API or SSR route failure was observed in these checks.
- The failure is evidence of a mixed/stale build state: the 0.53.33 process serves HTML/manifest references while the shared `.output` directory has been replaced by a fresh 0.53.34 build. No deployment, restart, production write, copy or rsync was performed.

## Previous execution evidence (retained history; visual PASS superseded by human review)

- Original artwork restored from root `poster.zip`; both PNG files match archive bytes exactly. The archive is not part of the implementation changes.
- Main Agent was the only UI writer. Data Contract Audit then Visual QA ran serially, read-only; both PASS. A subsequent Japanese layout fix was re-reviewed by Visual QA: PASS.
- Master grid at 414×896: x=25.5, y=226.03, width=362.98, height=553.97. Original background and square geometry retained.
- `AnnualShareGrid.vue` is pure presentation, with summary/locale/exportMode props. Four quadrants: favoriteSong; pound.topSong + pound.speed; profileCard (title fallback finalTitle.title); highScore.song + highScore.score.
- Six metrics: overview.playCount; overview.uniqueSongs; overview.currentClearCharts; period.activeDays; timeOfDay.topLabel + matching topPeriod range (fallback favoriteHourLabel); ratingRank.rankLabel + rating.
- Missing images use AnnualArtworkFallback. Missing songs/speed show the empty state; missing values show —. Four quadrants and six fields stay present; zero remains zero, and pound counts never substitute for speed.
- Static danmaku area uses an honest empty state; input is editable, both independent sync checkboxes default checked. Send/save are visibly present but disabled with unavailable titles; no new business behavior is connected.
- Legacy 30-day sharing is a secondary dialog entry, mounted on first open. `LegacyPosterShare.vue` preserves the old PosterSlide byte-for-byte; no legacy API was changed or invoked for this acceptance run.
- `npm run test:annual`: PASS, 21 pages, schema v4, zh/ja. Existing legacy assertions now inspect the relocated legacy component.
- `node scripts/verify_annual_poster_static.mjs`: PASS, all five viewports plus long-text, missing-data, input, checkbox and non-writing-action checks.
- Japanese master: `POSTER_QA_MASTER_ONLY=1 POSTER_QA_LANG=ja POSTER_QA_OUT=/tmp/annual-poster-phase-a/ja node scripts/verify_annual_poster_static.mjs`: PASS after correcting send-button wrapping.
- `npm run build`: PASS, exit code 0. Build-time public-asset URL warnings remain runtime URLs; the new assets return successfully in local QA.
- `git diff --check`: PASS. Unrelated baseline changes preserved.

## Visual evidence

Directory: `/tmp/annual-poster-phase-a/evidence/`

- `414x896.png` (master, completed first)
- `390x844.png`
- `430x932.png`
- `390x760.png`
- `414x800.png`
- `414x896-reference.png`
- `414x896-side-by-side.png` (reference left, implementation right)
- `five-viewports.png`, `long-text.png`, `missing.png`, `report.json`
- Japanese master and report: `/tmp/annual-poster-phase-a/ja/`

All five viewport reports: console/page errors 0; HTTP >=400/404 0; measured overflow 0; navigation collisions 0; body horizontal overflow false; attempted write requests 0; both sync checkboxes true.

Evidence scope: isolated Vite harness renders the actual PosterSlide, AnnualShareGrid and StoryPlayer with synthetic summary data and local placeholder artwork. BGM is stubbed; external requests and writes are blocked. This does not certify complete Nuxt routing, live user artwork, mobile soft keyboard, legacy API writes, sending, export or production behavior. QA uses screenshots only, not a share-card renderer.

## Scope and safety

- Phase B–F implementation: NO.
- Server features/schema/reaction/Forum/share-card renderer/OSS changes: NO.
- Production writes: NO.
- Deployment: NO. No deploy script, push, service restart or output copying was performed.

## Historical record: Gate reopen after human visual review

Gate A reopened after user visual review.

Reason: AnnualShareGrid media layout did not match reference: three song slots used generic vinyl/disc presentation instead of real square song covers, and the four media tiles did not form the required centered 2×2 square mosaic.

The earlier Data Contract Audit remains valid; earlier visual evidence does not establish acceptance of the corrected mosaic. Keep baseline 736dc0d / 0.53.33 and working version 0.53.34, uncommitted.

## Historical record: corrected mosaic — 414×896 before human approval

- Changed implementation only in `AnnualShareGrid.vue`; changed QA fixture/geometry assertions in `scripts/verify_annual_poster_static.mjs`. PosterSlide, original PNGs, six-metric template/data/CSS, surrounding controls and package version were not changed in this correction.
- DOM now separates top labels, media-mosaic, bottom labels and stats. Four adjacent equal square media tiles use two grid columns/two rows and gap 0; labels and song/speed/score text are outside the media geometry.
- Root cause distinguished: AnnualShareGrid already read `cell.song.coverUrl` with a normal img; the earlier synthetic fixture explicitly supplied `/annual/highScore/record-player.png` for all three fields. It was not a failed-cover fallback. The independent-small-image layout was also wrong. Both fixture and DOM/CSS are corrected.
- Existing cover contract verified read-only: FavoriteSongSlide → favoriteSong.coverUrl; PoundSlide → pound.topSong.coverUrl; HighScoreSlide → highScore.song.coverUrl. `utils/annualSummary.ts` maps each song through `buildSongCoverThumbnailUrl(songNo, 400)` in `utils/songCover.ts`; backend enrichment also uses the existing getSongCoverUrl. No resolver/schema/server change.
- QA now calls the existing resolver for song IDs 816 (星屑ストラック), 463 (幽玄ノ乱), 243 (万戈イム－一ノ十). URLs are `https://static.sakura-bot.cn/cover/thumb/400/{id}.webp`. Three anonymous public GETs return distinct 400×400 real artworks, verified by distinct SHA-256 hashes. Browser interception supplies those exact bytes; no generic record asset or circular cover crop. Numeric/user summary remains synthetic, not a real account export.
- Actual master mosaic: x=89.93, y≈324.03, 234.11×234.11; each tile ≈117.05×117.05, including profile, gap=0. Width is 64.5% of square_bg. Position follows the supplied raster's actual media boundary and quadrant seam rather than the approximate y=356 estimate in feedback.
- Profile tile fills its square with a light background, large MyDon/fallback and nickname/title. Optional danName remains below the bottom label. No three song placeholders or vinyl masks.
- 414×896 local QA PASS: all three expected resolved URLs loaded; square/equal/adjacent/centered geometry checked; zero console errors/HTTP >=400/overflow/navigation collision/write attempts; missing and long text stay within geometry. Annual contract PASS (21 pages, schema v4, zh/ja).
- Master grid rectangle, navigation rectangle, six-stat text and checkbox states exactly match the prior accepted master report. No claim of new five-viewport regression: other four sizes intentionally not run until human review of this master.
- New evidence: `/tmp/annual-poster-phase-a/mosaic-review/414x896-reference.png`, `414x896.png`, `414x896-side-by-side.png` (reference left), `report.json`, `cover-sources.json`, `long-text.png`, `missing.png`, `qa.log`.
- At that checkpoint Gate A remained PENDING pending human confirmation; this was superseded by the closeout recorded above.
- Version 0.53.34 unchanged; baseline 736dc0d / 0.53.33 unchanged. No commit, push, build/deploy, production write or Phase B–F work in this correction. Public artwork GETs only.
## 2026-09-10 / Phase B post-release visual regression hotfix

- Regression: profile-card tile unexpectedly fell back to the placeholder artwork on the Poster page after the `0.54.0` release.
- Root cause: `AnnualShareGrid.vue` still received the real `profileCard` fields, but its owner snapshot `myDonUrl` could fail; the existing image error handler immediately selected `AnnualArtworkFallback`.
- Fix-forward: when the owner snapshot URL fails, retry the authenticated `/api/account/my-don` resource before allowing the generic fallback. Mosaic geometry and all Phase B barrage/reaction code remain unchanged.
- Scope guard: the retry applies only to snapshots served from the owner-authenticated asset path `/api/account/annual-summaries/*/my-don`. Public share (`/api/annual/shares/*/my-don`) and internal poster-export (`/api/internal/annual-posters/*/my-don`) snapshots keep their previous single-source behaviour, so legacy public share and poster export are unaffected.
- Local verification (real browser, real component module, no production access): the owner snapshot is requested first and the live resource second; the live resource renders with no placeholder; public-share and internal-poster snapshot shapes never issue the owner-only request; the four mosaic tiles remain equal 133.5px squares with gap 0. The unpatched baseline reproduces the original defect in the same harness (snapshot only, then placeholder).
- The authenticated full-page dev smoke is not reproducible in this environment: the isolated test DB user lacks the `REFERENCES` privilege, so account schema DDL fails for any fresh dev process. This is the known pre-existing test-infrastructure limitation and was not repaired.
- Fixed in `0.54.1` locally; pending deploy. Online acceptance follows the standard deployment script.
- Release commit `6d810ea 0.54.1 修复年度Poster称号展示资料卡资源回退` on main. Standard `bash scripts/deploy_forum_web.sh "0.54.1 修复年度Poster称号展示资料卡资源回退"` succeeded with exit 0; the script pushed main, built in its isolated archive directory, switched output and passed service/local/online health checks. Optional Baidu push reported `over quota` (non-blocking, as before).
- Deployed appVersion is `0.54.1` at 127.0.0.1:3100 and `https://viewer.sakura-bot.cn`.
- Online acceptance (read-only GET, authenticated authorized account, no production write): the annual snapshot `GET /api/account/annual-summaries/annual_8357acbcad4494b16903122a/my-don` returned 404 and the owner-only fallback `GET /api/account/my-don` returned 200; the 称号展示 tile rendered that live resource (`naturalWidth` 944) with **no** `AnnualArtworkFallback`. The three song covers loaded, the four mosaic tiles stayed equal 117.05px squares with gap 0, the barrage bubbles moved, the reaction textarea and send control were present, and browser page errors were 0. Annual jobs, reactions, summary updates and share creations written during the window were all 0.
- Hotfix = VERIFIED ONLINE. Phase B remains COMPLETE / PASS. This is a post-release corrective hotfix; Phase C has not started.
## 2026-09-10 / Phase C — Forum Taxonomy

- Product scope is exactly two taxonomy changes, with no new taxonomy framework: add section `general` (闲聊杂谈) and rename the display name of the existing `creative` section from 二创杂谈 to 同名二创 with `sortOrder` 80 → 90. `creative` keeps its slug, row identity, route and API identity; no thread is migrated.
- Implementation reuses the existing bootstrap only: `FORUM_SECTION_SEEDS` in `taiko_viewer/types/forum.ts` plus `seedSections()` inside `ensureForumSchema()` (`taiko_viewer/server/utils/forum-db.ts`), which upserts on the unique `slug` key. `GET /api/forum/sections` reads from `forum_sections`, and the web UI resolves names through `forum.sections.<slug>.name` in `taiko_viewer/utils/forum.ts`, so both the seed and `locales/zh.json` / `locales/ja.json` carry the new names.
- Seed values: `general` = 闲聊杂谈, description 日常闲聊、曲目感想、年度回顾与社区杂谈。, `icon: "spark"` (an existing icon name; the field is not rendered by any current web or Flutter surface), `accentColor: "#3f97d1"` (reused design-system colour), `sortOrder: 80`. `creative` = 同名二创, description 绘画、视频、音乐、同人创作与其它二次创作。, `sortOrder: 90`.
- Seed idempotency was verified by running the exact `seedSections()` SQL twice against the isolated `_test` database with `SELECT DATABASE()` confirmed as `taiko_annual_poster_test` and explicit mutation opt-in: the second run kept identical row ids and produced no duplicate slug, ending at 9 rows with `general=闲聊杂谈(80)` and `creative=同名二创(90)`; `creative` kept its original row id, so its existing threads stay in place.
- The authenticated/local dev API and page smoke remain impossible for the known pre-existing reason recorded under the hotfix above (test DB user lacks `REFERENCES`, so `ensureAccountSchema()` fails for any fresh dev process). No test infrastructure was built to work around it; `GET /api/forum/sections` is verified against production after deployment instead.
- Flutter needs no change: `taiko_forum_app/lib/services/api_client.dart` reads `/api/forum/sections` and `ForumSection` consumes the server `name`; no hardcoded section names exist in the app.
- `node --test tests/forumI18n.test.mjs` passes (6/6) for both locales.
- Version `0.54.2`; pending deploy. Phase D is not started.
- Release commit `a533a5b 0.54.2 社区新增闲聊杂谈并调整二创分区名称` on main. Standard `bash scripts/deploy_forum_web.sh "0.54.2 社区新增闲聊杂谈并调整二创分区名称"` succeeded with exit 0 (push, isolated archive build, output switch, service restart and health checks all by the script; optional Baidu push reported `over quota`, non-blocking). Deployed appVersion is `0.54.2` at 127.0.0.1:3100 and `https://viewer.sakura-bot.cn`.
- Online `GET /api/forum/sections` returns 9 sections with unique slugs: `general` = 闲聊杂谈 (`sortOrder` 80, `threadCount` 0 at smoke time) and `creative` = 同名二创 (`sortOrder` 90, `threadCount` 1). No duplicate row and no duplicate option.
- Online web smoke (authorized account): the composer section select at `/forum/new` lists all nine labels with 闲聊杂谈 and 同名二创 exactly once each; `/forum/section/creative` renders 同名二创 as its heading with its original description and still lists the pre-existing thread `/forum/thread/28` (红茶店「雨天」（印象故事）), which opens normally and still links to `/forum/section/creative`; `/forum/section/general` renders 闲聊杂谈 and lists the new thread. Browser page errors were 0.
- Real posting check: one ordinary discussion was created through the actual UI in 闲聊杂谈 — `POST /api/forum/threads` returned 200, the browser landed on `/forum/thread/50`, the thread page labels its section 闲聊杂谈 and the section lists it. This is the only thread created in the window, so no reaction-driven Forum thread was produced (Phase D not implemented).
- Phase B non-regression: no Phase B file was modified (see the release diff), and the Poster page still renders four 117.05px mosaic tiles with the real profile card (`/api/account/my-don`, loaded, no fallback), a moving barrage and the reaction input. Annual reaction/share writes in the window were 0.
- Note for the next agent: the Forum home chip row renders only `home.sections.slice(0, 4)` in `pages/forum/index.vue` (pre-existing behaviour, deliberately not changed here), so on the Forum home the two new names appear only from the fifth section onward. Both names are reachable and visible in the composer select and on their section pages.
- Gate C: PASS. Phase C = COMPLETE. Phase D not started.
## 2026-09-10 / Phase D — Reaction → Forum

- Scope is exactly the Poster reaction sync: `syncCommunity=false` stores only the reaction; `syncCommunity=true` stores the reaction and additionally creates one `general` / `discussion` thread whose title and body are the reaction text. No Phase E/F work, and the client still cannot choose a section or a thread type.
- `taiko_viewer/server/utils/forum/threads.ts`: `createForumThread` was split into a reusable `createForumThreadCore({ actorUserId, actorUsername, payload, titlePolicy })` plus a thin normal entry that resolves the session user and returns the thread detail. The core still runs the full ordinary pipeline — forum schema bootstrap, forum-profile provisioning, section lookup, thread-type validation, `official` role gate, content-block sanitisation, tag normalisation, song-binding validation, insert and mention notifications. Only the title minimum is policy-driven: `normal` keeps 4 characters for the public composer, `integration` allows 1 so a short reaction can become a thread. The public posting rule itself was not changed.
- New `taiko_viewer/server/services/account/annual-summary/forum-sync.ts` owns the integration: it hardcodes `sectionSlug: "general"`, `threadType: "discussion"`, `title`/`summary`/paragraph `text` = reaction content, tags 年度报告 / 年度感想, and never binds a song. It applies its own server-side rate limit, stricter than the reaction limit: at most one sync per 30 seconds and 10 per day for the same user. A limited sync returns `status: "skipped"`, `reason: "rate-limited"` and never fails the reaction.
- `taiko_viewer/server/services/account/annual-summary/reactions.ts`: the reaction insert is unchanged and remains the primary operation. The Forum side effect runs only for the request that actually inserted the reaction, so a same-nonce retry can never create a second thread; retries return the stored outcome. Success persists `community_sync_status = 'synced'` with `forum_thread_id`, a Forum error persists `'failed'` and still returns the published reaction, and a marker-write failure is logged without failing the send. Responses now carry `communitySync: { requested, status, reason, threadId, message }`.
- `taiko_viewer/components/account/version-summary/slides/PosterSlide.vue`: the notice after sending now reflects the real server outcome instead of the checkbox — synced, `failed` (感想已发送，社区同步失败。), rate-limited (感想已发送；社区同步过于频繁，本次仅显示弹幕。) or not requested, with Japanese equivalents. The send button still reports only the reaction result, so a Forum failure never looks like a whole-send failure.
- No Flutter change: the app has no annual reaction posting path.
- Version `0.55.0` (minor, backward-compatible feature per the AGENTS release policy); pending deploy. Phase E is not started.
- Release commit `b23f325 0.55.0 年度感想支持同步到闲聊杂谈`. Standard `bash scripts/deploy_forum_web.sh "0.55.0 年度感想支持同步到闲聊杂谈"` exited 0 and performed the push, isolated build, output switch, restart and health checks; the deployed artifact at 127.0.0.1:3100 contains the new sync strings, and appVersion is `0.55.0` locally and on `https://viewer.sakura-bot.cn`.
- Gate D online smoke with the authorized account, against the real deployment (all requests authenticated, all verification read-only):
  - Case 1 `syncCommunity=false`: POST 200, `communitySync.status=skipped`, `reason=not-requested`, `threadId=null`; the `general` thread count stayed 1, so no Forum thread was created.
  - Case 2 `syncCommunity=true`: POST 200, `communitySync.status=synced`, `threadId=51`; the `general` count went 1 → 2. `GET /api/forum/threads/51` reports `section.slug=general`, `threadType=discussion`, `title` = the reaction, exactly one paragraph block whose text is the reaction, `songId=null`, tags 年度报告 / 年度感想.
  - Case 3 same-nonce replay of Case 2: POST 200, identical reaction id `215aae42…`, identical `threadId=51`, and the `general` count stayed 2 — no duplicate reaction row and no duplicate thread.
  - Case 4 second `syncCommunity=true` inside the 30-second sync window: POST 200 with the reaction created (`764b2396…`), `communitySync.status=skipped`, `reason=rate-limited`, no thread (count stayed 2). The reaction was not lost and the response was not an error.
  - Case 5 real Poster UI: the community checkbox is enabled by default; sending through the actual page returned `status=synced`, `threadId=52`, the visible notice read 感想已发送，已同步到社区, the new reaction appeared in the barrage, and `/forum/thread/52` renders under 闲聊杂谈 with the reaction as title and body. Browser page errors were 0.
- DB confirmation: four nonces produced exactly four reaction rows — `skipped`/`not-requested` (no thread), `synced` + `forum_thread_id=51`, `skipped`/`rate-limited` (no thread) and `synced` + `forum_thread_id=52`.
- The Forum-failure branch (`community_sync_status='failed'`, reaction preserved) is guaranteed structurally rather than induced in production: the reaction INSERT commits before the sync runs, and the sync call is fully wrapped so it downgrades only the sync status. Inducing a real Forum failure on the live site was deliberately not performed.
- Gate D: PASS. Phase D = COMPLETE. Phase E not started.
## 2026-09-10 / Phase E — Share Card Export

- Goal: the Poster's existing 保存分享图片 button now exports a real server-rendered image, and the only visual subject is `AnnualShareGrid.vue` — not the poster page, barrage, reaction input or buttons.
- Preview and export share one implementation: the new internal render page `/account/annual-share-card/:summaryId` mounts the same `AnnualShareGrid.vue` the Poster shows, with the same normalized owner view model (`getInternalAnnualShareCardPayload` reuses the owner asset enrichment). There is no second template, canvas redraw or duplicate component.
- Rendering reuses the existing Playwright/Chromium renderer: `renderAnnualPoster` and the new `renderAnnualShareCard` now share one `screenshotAnnualPage` helper (same launch flags, same fonts/images wait, same reduced motion). The share card renders at 1080×1648 — the square_bg 363×554 ratio, not the legacy 1080×1440 poster frame — waits for the `__ANNUAL_SHARE_CARD_READY__` marker, then screenshots the exact viewport clip. The page pins the card to 1080×1648 (`aspect-ratio:auto`) so nothing is cropped.
- Profile/MyDon: the internal render route `/api/internal/annual-share-cards/:summaryId/my-don` keeps the owner-page order — stored snapshot first, then the owner's live MyDon rendered server-side through the existing `getMyDonImageBuffer`. It never calls the browser-session `/api/account/my-don`, so the export cannot fall back to the round placeholder for a bound owner.
- Export API follows the plan's naming: `POST /api/account/annual-summaries/:key/share-card` (owner-only, returns `{ shareCard: { id, imageUrl, width, height }, cached }`) and the owner-only image route `GET /api/account/annual-share-cards/:id/image`. Results are cached by fingerprint (`sha256` of the summary input fingerprint, locale, size and a renderer revision) in the additive `web_annual_share_cards` table, with files stored under the existing annual cache directory. Re-saving hits the cache instead of re-rendering.
- Deliberate deviation from the plan sketch: no job/polling layer. The plan prefers extending the annual job queue, but a share-card render is a single synchronous pass, and the user instruction for this phase asked for the render chain to return the image directly. The plan's `forum_image_url` / `forum_thread_id` columns are declared but unused; Phase F owns them.
- Decoupling is explicit: saving the share card creates no 30-day public share, no public URL and no Forum thread, and the 同步分享到社区 checkbox next to the save button stays inert for now (Phase F). The legacy 更多分享方式 dialog is untouched.
- Root-cause fix found while wiring this phase: `server/api/account/annual-summaries/[summaryId]/reactions.post.ts` (added in `bed1bd9`) put a second param name at the same route position as the existing `[key]/` directory. Nitro resolves only one of the two param subtrees, so every `[key]/*` route — `my-don`, `shares`, `posters`, `build` — returned the router's "Page not found" in production, while `/api/account/annual-summaries/:key` and `:summaryId/reactions` kept working. That is the real reason the annual snapshot my-don URL failed and the profile tile fell back in `0.54.0`; the Phase B hotfix had masked the symptom with the live MyDon fallback. All annual-summaries child routes are now consolidated under `[key]`, verified locally by route resolution before release (HEAD reproduces the router 404; the patched tree resolves all seven routes).
- Version `0.56.0` (minor, backward-compatible feature per the AGENTS release policy); pending deploy. Phase F is not started.
- Release commit `f281826 0.56.0 年度总结四格分享图支持服务端导出`. Standard `bash scripts/deploy_forum_web.sh "0.56.0 年度总结四格分享图支持服务端导出"` exited 0 with push, isolated build, output switch, restart and health checks; appVersion `0.56.0` is live locally and on `https://viewer.sakura-bot.cn`.
- Gate E online smoke with the authorized account: the real Poster page rendered four 133.5px tiles (profile image `naturalWidth` 944, three covers 400) and six stats; the real 保存图片 button returned POST 200 with `shareCard { id, imageUrl, width: 1080, height: 1648 }`, and the browser downloaded `taiko-annual-annual_8357acbcad4494b16903122a.png` (957,241 bytes) with the notice 分享图片已保存. The saved file is a real **1080×1648** PNG (ratio 0.6553 vs the design 0.6552), and visual review confirms it contains only the share card: the three real covers, the real MyDon profile card with nickname and title, and the six statistics — no barrage, no reaction input, no buttons and no poster background, with no cropping and crisp text.
- Preview/export consistency: the on-page grid (414×632 element capture, ratio 0.6551) and the exported 1080×1648 image have the same tile order, covers, profile card, caption, six stats, proportions and spacing; only scale differs. Both are the same `AnnualShareGrid.vue`.
- Fingerprint cache: a second save returned POST 200 with `cached: true`, the same `shareCard.id`, and a byte-identical PNG (`b15372fe…`), so no re-render and no extra row.
- Decoupling verified by database counts: `web_annual_shares` for the user stayed 0, `forum_threads` stayed 11, and `web_annual_share_cards` went 0 → 1.
- Owner-only image: `GET /api/account/annual-share-cards/:id/image` returned 200 `image/png` for the owner and 401 for an anonymous context.
- Route fix verified in production: all annual-summaries children now answer with handler errors instead of the router's "Page not found" — `shares`, `posters`, `build`, `my-don`, `reactions` and the new `share-card`. The previously broken owner snapshot route now returns 200 with the 580,551-byte PNG, byte-identical to the live MyDon (`07c8ebea…`), and the Poster page's profile tile is served by the snapshot again with the Phase B fallback left unused.
- Phase D non-regression: the reaction textarea, send control and a moving barrage of 7 bubbles were present on the same page, and the reactions endpoint still resolves. Browser page errors were 0.
- Gate E: PASS. Phase E = COMPLETE. Phase F not started.
## 2026-09-10 / Phase F — Share Card → Forum

- Goal: the 同步分享到社区 checkbox beside 保存分享图片 now really works. `syncCommunity=false` only saves the image; `syncCommunity=true` saves the same Phase E image, uploads it through the Forum image pipeline and creates one `general` / `discussion` thread whose body is exactly that one image.
- No second renderer: the sync reuses the Phase E artifact. The share-card row is the source of truth — the stored PNG is read back from the annual cache and handed to the image pipeline, so nothing is re-rendered, no AnnualShareGrid copy exists, and the Forum source image is the four-tile share card.
- Forum image pipeline reuse: `uploadForumImageBuffer` was extracted from `uploadForumImage` in `server/utils/forum/media.ts`, so the browser upload endpoint and the share-card sync share one implementation (size/mime/format validation, `sharp` rotate + 1600px inside + WebP q84, OSS put, metadata). The browser endpoint keeps its identical behaviour and the share-card sync never calls a browser API.
- Thread contract, fixed server-side and not client-controlled: `section = general`, `threadType = discussion`, title exactly 快来看看我的年度报告吧～, body exactly one `image` block built from the uploaded URL. No paragraph block, no summary link, no 30-day public share URL, no QR code and no second image. The thread summary column mirrors the mandated title instead of the generic image-only placeholder sentence; the existing core also derives the thread cover from that image block.
- Primary/secondary split: the share card is saved first and always returned. A Forum failure, a rate-limit skip, or a lock timeout only downgrades `communitySync` and cannot roll back the image or block the download. The response carries `communitySync: { requested, status, reason, threadId, imageUrl, message }`.
- Idempotency without a new framework: the share-card row is the anchor. A card that already has `forum_thread_id` returns the stored result immediately — no re-upload, no second thread. Otherwise the sync runs inside the existing `withAnnualFileLock` keyed by the card id and re-reads the row inside the lock, and `markAnnualShareCardForumSync` only writes when `forum_thread_id IS NULL`, so repeated or concurrent saves of the same card cannot post twice.
- Rate limiting reuses Phase D: `claimForumSyncBudget` is the extracted helper behind the existing 30-second / 10-per-day Forum-sync limiters, now shared by the reaction sync and the share-card sync. Phase D's reaction outcomes and messages are unchanged, and both features keep their own persisted records (reaction row versus share-card row).
- Still decoupled from the legacy flow: saving with sync on creates no `web_annual_shares` row and no public URL, and the legacy 更多分享方式 dialog is untouched. The client sends the current checkbox value and shows three distinct outcomes (saved only, saved + synced, saved but sync failed or rate-limited) without navigating to the Forum.
- Version `0.57.0` (minor, backward-compatible feature per the AGENTS release policy); pending deploy.
- Release commits `140feb3 0.57.0 年度分享图片支持同步到社区`, `04ccec7 0.57.0 修正分享图片社区同步状态语义`, `15d287f 0.57.0 修正分享图片卡片并发写入的 id 覆盖` (same version, no second bump). The standard `scripts/deploy_forum_web.sh` run for the final subject exited 0 with push, isolated build, output switch, restart and health checks; appVersion `0.57.0` is live locally and on `https://viewer.sakura-bot.cn`. The unrelated `title_song_relations.json` was stashed and restored with a matching SHA-256 on every run.
- Two defects were found by the real smoke and fixed forward before acceptance: (1) saving with the community checkbox **off** on a card that an earlier save had already synced reported `synced`, so the notice contradicted the checkbox — the not-requested branch now always reports `skipped` / `not-requested` while still exposing the stored thread; (2) two **concurrent first saves** of the same fingerprint raced in `insertAnnualShareCard`, whose `ON DUPLICATE KEY UPDATE id = VALUES(id)` let the loser steal the row id, so the winner's `forum_thread_id` write matched no row and the linkage was lost. The upsert no longer touches `id`, which keeps the row identity stable.
- Gate F online smoke with the authorized account: `sync OFF` (on an already synced card) returned `requested=false`, `status=skipped`, `reason=not-requested`, notice 分享图片已保存, a 957,241-byte download and no new thread; `sync ON` for a fresh card with **two concurrent** requests created exactly one thread (`55`), both responses reporting that thread and the same uploaded image, and the card row persisted `forum_thread_id=55` plus its `forum_image_url`.
- Thread contract verified through the real API and the rendered page for thread `55`: `section=general`, `sectionName=闲聊杂谈`, `threadType=discussion`, `title=快来看看我的年度报告吧～`, and `contentBlocks` is exactly one `image` block pointing at the uploaded share card; the page renders that image (1049px wide, `image/webp`, 131,642 bytes) with no paragraph body text.
- The uploaded Forum image is the Phase E share card: 1049×1600 WebP from the 1080×1648 PNG, showing the three real covers, the real MyDon profile card with nickname/title, and the six statistics, with no barrage, no reaction input, no buttons, no poster background and no `AnnualArtworkFallback`.
- Retry and idempotency: repeating the save for the already synced `zh` card returned the stored thread `53` and the stored image without re-uploading or creating a thread; a concurrent repeat pair for the `ja` card returned thread `55` twice with the thread count unchanged; a following sequential retry also reused `55`.
- Decoupling: `web_annual_shares` for the user stayed 0 through every case, no public URL was created, and the legacy dialog was never invoked.
- No regression: the Poster still shows four tiles with the loaded profile card, a moving barrage of 5 bubbles, the reaction input and the 保存图片 button; the annual reactions route still resolves; browser page errors were 0.
- Test artifacts left in 闲聊杂谈 by this acceptance: threads `53` (zh card), `55` (ja card, linked) and `54`, an unlinked ja thread created by the pre-fix concurrency race. All three can be hidden or deleted by a moderator.
- Gate F: PASS. Phase F = COMPLETE. This was the final phase of the plan.
## 2026-09-10 / Final closeout — known issues and polish audit

- Scope of this round was audit and closeout only: no new product scope, no re-acceptance of Phases A–F, no new test infrastructure. One real product bug (admin preview MyDon) was found to still exist and was fixed as a single patch release.
- **Known Issue A — admin preview MyDon (fixed in `0.57.1`).** Confirmed by code audit: admin previews are served by `withOwnerAssets`, which emits the owner-scoped `/api/account/annual-summaries/:summaryId/my-don`. An operator is not that summary's owner, so the request fails and the client-side Phase B fallback retried `/api/account/my-don`, which — when the operator also has a viewer session — returned the **operator's own** MyDon. Admin payloads (`getAdminAnnualSummaryById`, and the cached branch of `queueAdminAnnualSummaryBuild`) now go through a new `withAdminAssets`, which points `profileCard.myDonUrl` at the operator-gated `GET /api/admin/annual-summaries/:summaryId/my-don`. That route reuses the same resolution order as the internal renderer (stored snapshot, then the owner's live MyDon rendered server-side) and always serves the **summary owner's** asset. Because the URL is no longer prefixed with `/api/account/annual-summaries/`, the owner fallback cannot fire for an operator. Owner page, public share, internal export, Phase E/F rendering and AnnualShareGrid geometry are untouched. The operator-side visual confirmation still requires an `ichika`/`maru` admin login, which this session does not hold; the unauthenticated route is verified to be guarded. Residual, deliberately unchanged: the taiko-ID-only admin preview (`buildAdminAnnualPreview`, for targets with no persisted summary) has no `profileCard.myDonUrl` at all and therefore shows the generic placeholder rather than any wrong user's card.
- **Known Issue B — Forum home section chips (`slice(0, 4)`): decision is to keep the current behaviour.** The nine sections are ordered official(10), events(20), beginner-help(30), score-guides(40), dojo(50), achievements(60), arcade(70), general(80), creative(90), so the home row shows the first four and 闲聊杂谈 / 同名二创 are 8th and 9th. The container is a single `display:flex` row with `overflow-x:auto` and hidden scrollbars, shared by four filter buttons, a separator and the section chips; with nine chips the row exceeds the 1040px container and still scrolls, so removing the slice would not break the layout — but the two new sections would sit off-screen at the far right, i.e. no real discoverability gain, while the primary filter controls would share an even longer hidden-scrollbar row. Both sections are already reachable and visible in the composer section select and on their own section pages. Recommendation: leave as-is; if home-page discovery of all sections becomes a requirement, treat it as a dedicated UI task (for example a 全部版块 entry point) rather than removing the slice.
- **Known Issue C — acceptance threads.** All three share-card threads are `published`, `view_count` 2, `like_count` 0, `replies` 0 and not featured. `53` (zh card) and `55` (ja card) are referenced by their share-card rows and are valid acceptance posts to keep. `54` is referenced by no share-card row and was created by the pre-fix concurrency race, so it is a pure test artifact with no real interaction and is suitable for hiding or deletion — not performed here, since production deletion requires explicit approval.
- **Phase E job/polling deviation: accepted as intentional.** The master plan sketched a job queue plus polling; `0.56.0+` renders the share card synchronously through Playwright, and thirteen days of real production use show stable generation with no timeout evidence. No queue, worker, polling layer or job table will be added.
- Already-fixed items remain recorded above and are unchanged by this round: the Nitro `[summaryId]`/`[key]` route collision that shadowed `my-don`, `shares`, `posters` and `build` (fixed in `0.56.0`), and the Phase F concurrent-upsert id clobbering that lost the `forum_thread_id` linkage (fixed in `0.57.0`).
- Version `0.57.1` (patch: admin preview asset fix). `scripts/deploy_forum_web.sh` with the release subject exited 0. No further phases, features or polish are planned.
