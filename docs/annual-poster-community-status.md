## Execution Policy Override — 2026-09-10

Latest user instruction overrides historical execution/testing/deployment restrictions below; product definitions and Phase boundaries remain unchanged.

- Real business behavior first. Phase B-0 = PASS; DB Isolation = PASS; BLOCKED_PENDING_DB_ISOLATION = RESOLVED. Do not restart B-0 or require REFERENCES/fixtures/full staging.
- Continue existing Phase B code in the feature worktree. Verify real authenticated POST/GET, nonce retries, sanitize, rate limit, hidden, Poster immediate append/reload and moving barrage; Forum thread delta must remain zero.
- Each Phase may release independently after its product Gate is ready. For Phase B: audit changes, bump minor version, create release commit, integrate into main, then use only scripts/deploy_forum_web.sh with the HEAD subject. No manual push, output replacement or restart; stop if the script fails.
- Before release, mutations use the isolated test DB with SELECT DATABASE() and explicit mutation opt-in. After release, authorized real online smoke verifies the product; ordinary bugs are fixed forward. Final Gate B PASS follows online smoke.
- Only the final integration agent deploys. No Phase C/D work during Phase B. Existing historical no-deploy/feature-only/exhaustive-test rules do not override this policy.

# Annual Poster Community — Execution Status

Current Phase:
Phase C — Forum Taxonomy

Status:
RELEASED — online smoke pending at commit time

Gate A:
PASS

Next allowed phase:
Phase D — reaction → Forum sync (not started; this task ends at Phase C).

Gate A passed after user manual multi-viewport visual acceptance.

Gate B:
PASS

Phase B is complete. Local real-product acceptance and the authorized production account smoke both passed. The post-release profile-card hotfix `0.54.1` is VERIFIED ONLINE.

Gate C:
PENDING — set to PASS by the online smoke record appended after deployment of `0.54.2`.

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
