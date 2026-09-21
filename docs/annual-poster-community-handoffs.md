# Annual Poster Community — Agent Handoffs

## Coordinator / setup

- Agent / role: `/root` — Coordinator
- Phase: Phase A — Poster Static Rebuild (setup)
- 完成内容: Read and confirmed the sole implementation spec; established execution status and collaboration rules.
- 修改文件: `docs/annual-poster-community-plan.md`, `docs/annual-poster-community-status.md`, `docs/annual-poster-community-handoffs.md`, `AGENTS.md`
- 测试结果: Baseline read from `taiko_viewer/package.json` (`0.53.33`) and Git (`736dc0d`); unrelated worktree modification recorded.
- 未解决问题: Phase A static rebuild and audits not yet completed.
- Gate 状态: Gate A = PENDING
- Safe next action: Start isolated Agent A (writer), Agent B (data-contract read-only auditor), and Agent C (visual QA read-only).

## Agent C / Visual QA

- Agent / role: Agent C — Visual QA (read-only)
- Phase: Phase A — Poster Static Rebuild
- 完成内容: Audited current implementation against the Phase A scope. Poster remains the legacy 30-day share flow; required static rebuild elements and assets are absent.
- 修改文件: None
- 测试结果: No Nuxt/viewer process was running. Five viewport screenshots, console, 404, overflow, navigation overlap, clipping, and occlusion checks were not executable.
- 未解决问题: Agent A has not landed the static rebuild; Agent B audit was blocked by collaboration stream disconnect; no visual evidence exists.
- Gate 状态: Gate A = PENDING
- Safe next action: Retry Agent A implementation and Agent B contract audit; only then run visual QA against a running local viewer.

## Collaboration incident

- Agent / role: Coordinator
- Phase: Phase A — Poster Static Rebuild
- 完成内容: Retried isolated Agent A and Agent B assignments; both failed with collaboration stream disconnect before completion.
- 修改文件: None beyond the setup docs and AGENTS rule.
- 测试结果: Repository baseline remains version `0.53.33`, commit `736dc0d`; unrelated `title_song_relations.json` modification preserved.
- 未解决问题: Phase A implementation and data audit are not complete.
- Gate 状态: Gate A = PENDING
- Safe next action: Wait for the next instruction or retry agents when collaboration service is available; do not deploy or enter Phase B.

## 2026-09-09 / Main Agent recovery and material preflight

- Agent / role: `/root` — Coordinator / sole UI writer; read-only preflight performed serially by the main Agent.
- Phase: Phase A — Poster Static Rebuild.
- Baseline: HEAD `736dc0d 0.53.33 修复年度时段坐标与阴影层级`; package version `0.53.33`; status `IN_PROGRESS`; Gate A `PENDING`. No discrepancy from the user’s expected baseline.
- Completed: Read repository instructions, master plan, status and handoffs; inspected Git changes and source types; searched for the required artwork. Preserved all pre-existing changes.
- Modified files this turn: `docs/annual-poster-community-status.md`, `docs/annual-poster-community-handoffs.md` only.
- Data Contract preflight: all four-grid/six-metric fields exist. `pound.speed?: number | null` requires missing-state handling; counts are not speed. Mini profile uses profileCard, with finalTitle.title as title fallback. timeOfDay range must match topPeriod. No implementation audit PASS is claimed.
- Unresolved: original background_22.png (414×896), square_bg.png (363×554), and reference image are unavailable. No CSS redraw or fabricated reference was substituted. Restore poster.zip before master implementation.
- Visual QA: implementation missing; five requested viewport captures and 414×896 reference/implementation/side-by-side not produced. Console, 404, overflow and navigation occlusion are unverified, not zero.
- Tests: source/type inspection only; no UI change, build, runtime test or production operation.
- Gate evaluation: FAIL due to missing required artwork, implementation and evidence; Gate A remains PENDING.
- Safe next action: obtain original assets; main Agent writes 414×896 master, then remaining viewports; run Data Contract Audit and Visual QA serially read-only, with main-Agent fallback. Coordinator may set PASS only with all Gate A evidence. Stop after Phase A.
- Phase B–F touched: NO. Production writes: NO. Deployment: NO.

## 2026-09-09 / Phase A final integration — Gate A PASS

- Agent / role: `/root` — Coordinator / sole UI writer.
- Collaboration: Data Contract Audit `/root/data_contract_audit` completed read-only first (PASS); Visual QA `/root/visual_qa` then completed read-only (PASS), including a follow-up review of the Japanese compose fix. No child wrote UI or deployed.
- Baseline: version `0.53.33`, HEAD `736dc0d`; no mismatch with requested baseline. Current uncommitted working version `0.53.34`; package-lock matches. Patch reflects this static compatible UX correction, not completion of the planned community features.
- Materials: user supplied root `poster.zip`; original background_22.png and square_bg.png copied byte-for-byte into public/annual/poster. Reference extracted only for local evidence. Zip remains outside implementation changes.
- Phase A files:
  - `taiko_viewer/components/account/version-summary/slides/PosterSlide.vue`
  - `taiko_viewer/components/account/version-summary/slides/LegacyPosterShare.vue` (byte-identical to baseline PosterSlide)
  - `taiko_viewer/components/account/version-summary/AnnualShareGrid.vue`
  - `taiko_viewer/public/annual/poster/background_22.png`
  - `taiko_viewer/public/annual/poster/square_bg.png`
  - `taiko_viewer/locales/zh.json`, `taiko_viewer/locales/ja.json`
  - `taiko_viewer/package.json`, `taiko_viewer/package-lock.json`
  - `taiko_viewer/scripts/verify_annual_contract.mjs` (relocated legacy assertions)
  - `taiko_viewer/scripts/verify_annual_poster_static.mjs` (isolated static QA only)
  - `docs/annual-poster-community-plan.md` (Phase A checklist result only), `docs/annual-poster-community-status.md`, `docs/annual-poster-community-handoffs.md`
- Four-grid mapping: favoriteSong; pound.topSong + pound.speed; profileCard MyDon/nickname/title/danName with finalTitle.title fallback; highScore.song + score. Pound counts do not substitute for speed.
- Six fields: overview.playCount; overview.uniqueSongs; overview.currentClearCharts; period.activeDays; timeOfDay.topLabel and range matched by topPeriod, fallback favoriteHourLabel; ratingRank.rankLabel + rating. Missing fields preserve geometry and zero remains zero.
- Static controls: honest empty danmaku area, editable input, two independently toggleable default-checked sync checkboxes, disabled send/save buttons with unavailable state titles. No reaction feed, send, export, upload or community behavior. Legacy shares remain a secondary dialog, mounted on first open.
- Data Audit: PASS for source contract and phase boundary. No legacy production API writes were tested.
- Visual QA: PASS for the Gate A seven conditions. 414×896 master first, grid x25.5/y226.03/w362.98/h553.97; other four sizes checked afterwards. Long text and missing-data fixtures checked. Japanese compose overflow found and corrected; five sizes and Japanese master rerun, then visual re-review PASS.
- Commands and results (cwd taiko_viewer):
  - `npm run test:annual` — PASS; 21 pages, schema v4, zh/ja.
  - `POSTER_QA_MASTER_ONLY=1 node scripts/verify_annual_poster_static.mjs` — initial master PASS.
  - `node scripts/verify_annual_poster_static.mjs` — final five-viewports / long text / missing data / controls PASS.
  - `POSTER_QA_MASTER_ONLY=1 POSTER_QA_LANG=ja POSTER_QA_OUT=/tmp/annual-poster-phase-a/ja node scripts/verify_annual_poster_static.mjs` — final Japanese master PASS.
  - `npm run build` — final source build PASS, exit code 0; local validation only.
  - `git diff --check` — PASS.
- Evidence: `/tmp/annual-poster-phase-a/evidence/414x896.png`, `390x844.png`, `430x932.png`, `390x760.png`, `414x800.png`; `414x896-reference.png`; `414x896-side-by-side.png` (reference left); `five-viewports.png`, `long-text.png`, `missing.png`, `report.json`. Japanese master/report under `/tmp/annual-poster-phase-a/ja/`. Build/contract logs under `/tmp/annual-poster-phase-a/`.
- Console / 404 / overflow: all five normal viewport reports have zero console/page errors, zero HTTP >=400, zero measured element/body overflow, zero navigation collision, and zero attempted writes. Both checkbox defaults true.
- Evidence limitations: actual UI and StoryPlayer in isolated Vite harness, synthetic summary/local placeholder artwork, stubbed BGM, all external requests/writes blocked. No full Nuxt route/auth flow, live user artwork, soft keyboard, sending/export, or production validation is claimed. Screenshot QA is not a share-card renderer.
- Coordinator Gate A decision: PASS; status is COMPLETED, Phase remains A. Master plan Phase A row updated. No automatic Phase B entry.
- Existing unrelated AGENTS.md/title_song_relations.json changes preserved. No commit/push.
- Safe next action: stop and await user instruction; future work must restore status and respect the next phase's scope. Do not treat checked sync controls as implemented business behavior.
- Phase B–F touched: NO. Server feature/schema changes: NO. Production writes: NO. Deployment: NO.

## 2026-09-09 / Human visual review — Gate A reopened

- User requested Gate A PASS → PENDING; status IN_PROGRESS, Phase A continues without restarting. Earlier data audit remains valid; history retained.
- Feedback: song slots in QA show identical generic records; media form separate small cards instead of a centered, gapless 2×2 square mosaic. Profile media is undersized.
- Required correction: three real distinct song covers using existing summary coverUrl paths; equal profile tile; media width approximately 64.5% of square_bg, aspect 1, zero gaps; labels/values outside media.
- Preserve approved Poster background, danmaku/input/actions/checkboxes, square_bg position, six metrics, legacy entry and vertical layout.
- First produce only 414×896 reference/implementation/side-by-side. Wait for human confirmation before remaining four viewports; no automated Gate PASS.
- Working version remains 0.53.34; no commit, push, production write, deployment or Phase B–F work.

## 2026-09-09 / Media mosaic correction — master ready for human review

- Main Agent continued Phase A without restarting. Gate A remains PENDING / status IN_PROGRESS after human reopen. Earlier audit history preserved.
- This round changed AnnualShareGrid.vue, static QA fixture/script, status/handoff and the plan's current Phase A row/footer to reflect the reopen. No changes to PosterSlide, surrounding controls, six fields, original background/square PNGs, locales or 0.53.34 version.
- DOM: top labels / one centered gapless 2×2 media mosaic / bottom labels / existing stats. Three square `<img>` use existing song.coverUrl and object-fit:cover, radius:0. Profile is an equally sized square with large MyDon and nickname/title; text outside song images cannot resize the mosaic.
- Root cause: prior QA assigned one generic record-player.png to all three song.coverUrl fields. Grid itself had no vinyl component, but used four independently laid-out small images. Corrected both causes rather than only changing a border radius.
- Resolver read-only audit: FavoriteSongSlide, PoundSlide and HighScoreSlide consume the same three ViewModel song objects. makeSongMapper in utils/annualSummary.ts calls buildSongCoverThumbnailUrl(songNo,400); no new cover resolver or backend logic.
- Fixture: actual catalog IDs 816/463/243 (星屑ストラック / 幽玄ノ乱 / 万戈イム－一ノ十), each resolved through utils/songCover.ts. Anonymous public CDN GETs return three distinct real 400×400 WebP images. Sources/hashes recorded in cover-sources.json. Other summary values remain synthetic. No account data or writes used.
- Master geometry: square_bg unchanged at x25.5/y226.03/362.98×553.97; media x89.93/y324.03/234.11×234.11; four tiles approximately117.05×117.05; profile equal; gap0. Media aligned to actual supplied raster rather than its approximate coordinate estimate.
- Tests: `node scripts/verify_annual_poster_static.mjs` defaults to 414×896 only; master, three resolved cover URLs, dimensions/adjoining edges/center, missing data, long text and controls PASS. `npm run test:annual` PASS. `git diff --check` PASS. No new full build or five-viewport run claimed.
- Evidence under `/tmp/annual-poster-phase-a/mosaic-review/`: 414x896-reference.png, 414x896.png, 414x896-side-by-side.png (reference left), report.json, cover-sources.json, long-text.png, missing.png, qa.log. Prior evidence retained separately.
- Master console/404/overflow/occlusion/writes all zero. Background grid/nav geometry, six-stat text and checkbox states equal prior master report.
- Human checkpoint: wait for user confirmation of master before `POSTER_QA_ALL_VIEWPORTS=1 node scripts/verify_annual_poster_static.mjs`; do not treat automatic assertions as Gate PASS. Corrected five-viewports are NOT YET RUN.
- Gate A: PENDING. Baseline 736dc0d / 0.53.33; working version 0.53.34 unchanged and uncommitted. Commit NO, push NO, deployment NO, production writes NO, Phase B–F NO.

## 2026-09-09 / Phase A closeout and runtime consistency audit

- User manually accepted 414×896, 390×844, 430×932, 390×760 and 414×800; the corrected AnnualShareGrid 2×2 mosaic is accepted.
- Gate A passed after user manual multi-viewport visual acceptance.
- Closeout audit confirmed the supplied artwork, AnnualShareGrid mapping, three distinct real covers, equal gapless centered tiles, six fields, checked sync controls, secondary legacy entry, and no Phase B–F/server/DB/Forum implementation.
- Validation: `npm run test:annual` PASS; `POSTER_QA_ALL_VIEWPORTS=1 CHOKIDAR_USEPOLLING=1 node scripts/verify_annual_poster_static.mjs` PASS; `npm run build` PASS; `git diff --check` PASS.
- Checkpoint target is working version `0.53.34`; unrelated `title_song_relations.json`, `AGENTS.md` and `poster.zip` are excluded.
- Runtime audit: HEAD `736dc0d`; package version `0.53.34`; local 3100 and online viewer both report appVersion `0.53.33`; `taiko-viewer.service` active since `2026-09-09 11:09:41 CST`.
- The audit build refreshed shared `.output` to `0.53.34` while the service stayed on its existing 0.53.33 process. Browser checks reproduced multiple `/_nuxt/*.js` HTTP 500 responses and one build metadata JSON HTTP 500. Direct probes for the new Poster PNGs returned HTTP 404 locally and online; no CSS, song-cover, API or SSR-route failure was observed. This is mixed/stale build evidence; no repair was performed.
- No push, deployment, restart, production write, copy or rsync was performed. Stop at Phase A and await Phase B instruction.

## 2026-09-09 / Phase A release stabilization complete

- Standard deployment command `bash scripts/deploy_forum_web.sh "0.53.34 年度Poster完成静态四格与分享入口重构"` executed successfully with exit code 0.
- The script pushed `bb72232` to `origin/main`, built the isolated release artifact, passed Nginx validation, activated the viewer output and restarted the managed services. Optional Baidu push returned HTTP 400 `over quota` and did not block deployment.
- Unrelated files were isolated with a reversible stash and restored afterwards. SHA-256 values for `AGENTS.md`, `taiko_viewer/assets/data/title_song_relations.json` and `poster.zip` matched before and after deployment.
- Deployed version/commit: `0.53.34` / `bb72232`.
- Read-only canary passed: local and online appVersion `0.53.34`; service active; representative JS/CSS, build metadata and `/titles` SSR returned HTTP 200; both Poster PNGs returned HTTP 200. No mixed-version evidence remains.
- Production write: NO. Phase B started: NO. No follow-up Viewer deployment is needed for this documentation update.

## 2026-09-09 / Phase B start blocked on database isolation

- Feature worktree: `/home/sigaer/taiko/taiko-forum-worktrees/annual-poster-community`; branch `feature/annual-poster-community`; baseline `bb72232` / `0.53.34`.
- Phase B implementation has not started. Gate B is `PENDING`.
- Read-only DB audit found only database `taiko` on the configured MySQL instance; the available `taiko_viewer` account has privileges only on `taiko.*`. No dedicated `_test` database or test credentials are available.
- Existing DB integration and migration scripts can DELETE rows or mutate schema and several do not enforce a `_test` suffix. They must not be run with production credentials. Only the browser fixture/E2E paths currently enforce `_test`.
- STOP condition triggered: do not add the reaction table, run migrations, run DB integration tests, or issue reaction/Forum writes until an isolated database such as `taiko_annual_poster_test` with dedicated credentials is provisioned and verified with `SELECT DATABASE()` and grants.
- Production runtime remains unchanged: local and online appVersion `0.53.34`; `taiko-viewer.service` active; production `.output` fingerprint unchanged during this audit. No deployment, restart, production DB write, Forum write or push to `main` occurred.

## 2026-09-09 / Phase B-0 historical block before administrator setup

- Scope was limited to test database isolation bootstrap; reaction backend, schema migration, reaction POST, Forum write and integration mutation were not started.
- Production configuration uses `TAIKO_DB_HOST=127.0.0.1`, `TAIKO_DB_PORT=3306`, `TAIKO_DB_USER=taiko_viewer`, `TAIKO_DB_NAME=taiko`; secret values were not logged. `account-db.ts` is the pool/schema connection path.
- At that time, the production-only account showed only `taiko.*`, and local `root` admin login was denied; the test database had not yet been provisioned.
- This historical block was superseded by administrator-side setup recorded in the later B-0 entries.
- Required administrator action is captured in status.md as an unexecuted SQL template using production collation `utf8mb4_general_ci`, followed by `SELECT DATABASE(), CURRENT_USER()` and `SHOW GRANTS` verification.
- Gate B-0: `PENDING`; blocker remains `BLOCKED_PENDING_DB_ISOLATION`. Production appVersion remains `0.53.34`, service active, and production `.output` fingerprint unchanged. No push, deploy, production write or Phase B reaction implementation occurred.

## 2026-09-09 / Phase B-0 references privilege boundary found

- Test-only `.env.test.local` is ignored by `taiko_viewer/.gitignore`; application MySQL connection returned the expected test DB identity and grants.
- Guard tests passed for missing opt-in and wrong database, and the basic guarded CREATE/INSERT/SELECT/DELETE/DROP probe passed.
- Synthetic fixture setup stopped at the first foreign-key definition with MySQL `ER_TABLEACCESS_DENIED_ERROR` / `REFERENCES command denied` for `taiko_annual_poster_test.annual_phase_b_test_users`.
- No privilege was added. Guarded cleanup removed all attempted fixture tables; the test database is empty again.
- Only a minimal `REFERENCES` grant on `taiko_annual_poster_test` is suggested if FK-based fixtures are required. Gate B-0 remains `PENDING`; do not continue schema initialization or reaction implementation until the grant is approved and re-verified.

## 2026-09-09 / Phase B-0 application verification and REFERENCES stop

- Administrator supplied the test credential out of band. It was used only through the ignored `taiko_viewer/.env.test.local`; the secret is not recorded in Git, docs or reports.
- MySQL CLI and the Node/MySQL test path both verified `DATABASE() = taiko_annual_poster_test` and `CURRENT_USER() = taiko_viewer_test@127.0.0.1`. Grants are limited to the test database (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `DROP`, `INDEX`, `ALTER`) plus required `USAGE`; no production/global business grant, `SUPER`, `FILE`, `PROCESS`, `CREATE USER` or `GRANT OPTION`.
- Mutation guard tests passed: missing opt-in rejected, wrong-database mock rejected before mutation, and explicit opt-in CREATE/INSERT/SELECT/DELETE/DROP probe passed.
- Synthetic fixture setup was intentionally stopped at its first FK statement because MySQL returned `ER_TABLEACCESS_DENIED_ERROR` / `REFERENCES command denied`. The guard-cleanup pass removed all temporary tables; no fixture rows remain.
- No `REFERENCES` privilege was added. Gate B-0 remains `PENDING` until an administrator explicitly grants and verifies only that minimum privilege, if FK fixtures remain necessary.

## 2026-09-09 / Phase B real business path resumed

- Project execution strategy changed to real business vertical slice first. Gate B-0 is `PASS`; `BLOCKED_PENDING_DB_ISOLATION` is resolved.
- Dedicated test DB identity and guarded mutation were verified. No `REFERENCES` privilege was requested or added; the abandoned synthetic FK fixture is not a Phase B requirement.
- Formal `web_annual_poster_reactions` schema and authenticated GET/POST service/API were added in the feature worktree. `syncCommunity` is recorded as requested with `community_sync_status = skipped`; no Forum write path is called.
- Test-only schema bootstrap removes FK clauses when the selected database ends in `_test` and explicit mutation opt-in is present; production DDL behavior is unchanged.
- Remaining work: connect PosterSlide to GET/POST, implement barrage scheduler/immediate append/background refresh/lifecycle, run real test-DB user-path verification, then decide Gate B and create/push a feature checkpoint. Production checkout, port 3100, production `.output`, production DB and Forum remain untouched.

## Execution Policy Override — 2026-09-10

Latest user instruction overrides historical execution/testing/deployment restrictions below; product definitions and Phase boundaries remain unchanged.

- Real business behavior first. Phase B-0 = PASS; DB Isolation = PASS; BLOCKED_PENDING_DB_ISOLATION = RESOLVED. Do not restart B-0 or require REFERENCES/fixtures/full staging.
- Continue existing Phase B code in the feature worktree. Verify real authenticated POST/GET, nonce retries, sanitize, rate limit, hidden, Poster immediate append/reload and moving barrage; Forum thread delta must remain zero.
- Each Phase may release independently after its product Gate is ready. For Phase B: audit changes, bump minor version, create release commit, integrate into main, then use only scripts/deploy_forum_web.sh with the HEAD subject. No manual push, output replacement or restart; stop if the script fails.
- Before release, mutations use the isolated test DB with SELECT DATABASE() and explicit mutation opt-in. After release, authorized real online smoke verifies the product; ordinary bugs are fixed forward. Final Gate B PASS follows online smoke.
- Only the final integration agent deploys. No Phase C/D work during Phase B. Existing historical no-deploy/feature-only/exhaustive-test rules do not override this policy.

Recovery audit: nonce lookup precedes the limiter, but concurrent in-flight retries still needed serialization. security.ts is unchanged. Test FK stripping is removed from account/forum production helpers; reaction schema is retained. Port 3101 was not listening; 3100 remains untouched. Gate B remains PENDING.

## 2026-09-10 / Phase B product path verified locally

- Recovered the existing uncommitted Phase B implementation, retained reaction schema/API, and removed in-source account/forum FK stripping. security.ts was already restored. B-0 is PASS and not reopened.
- Completed same-nonce in-flight serialization plus duplicate-key recovery. Real POST/GET passed, concurrent retry returned the same ID with one DB row, fresh nonce within 3s returned 429 and after the window returned 200. Basic sanitize, hidden exclusion and Forum delta=0 passed.
- Fixed the missing useViewerApiFetch initialization in PosterSlide. Actual Nuxt UI click sent HTTP 200 and immediately displayed the result; measured 36.4px leftward movement in 0.7s, then reload returned the same reaction.
- Extracted AnnualPosterDanmaku with measured widths, 52px/s (22px/s reduced-motion), 72px lane gaps, low-data visual repeats, and active/document-visibility lifecycle. Added admin status endpoint using existing remote admin auth and audit logs.
- Thirty-second multi-item and single-item actual-page runs passed. Five viewport visual audit passed after reserving 64px for three lanes on short screens. Background hide refresh and zero-only empty state passed. Browser page errors: 0.
- Evidence remains outside Git: /tmp/annual-phase-b-api-report.json, /tmp/annual-phase-b-ui-report.json, /tmp/annual-phase-b-low-data-report.json, /tmp/annual-phase-b-visual.log, /tmp/annual-phase-b-{width}x{height}.png.
- Dev-only compatibility lives outside application source: /tmp/annual-test-runtime.cjs and /tmp/annual-phase-b-layer. Secrets remain in ignored env/session files. A build was interrupted with exit 143 during a user turn; final build is run with 3101 stopped to avoid shared .nuxt interference.
- Target release: 0.54.0. User authorized production acceptance with sigaer / drum ID 2258735. No production feature write, main push or deployment has occurred at this checkpoint. Next: finish isolated build, release audit/commit, integrate main, standard deploy, online smoke, then final Gate B PASS. No Phase C work.

- Final isolated build PASS (exit 0); annual contract PASS; git diff --check PASS. Local Gate B product requirements are ready for release; final Gate remains pending online acceptance.

## 2026-09-10 / Phase B released and online accepted — Gate B PASS

- Release commit: `bed1bd9 0.54.0 年度Poster接入感想弹幕与审核`; integrated into main with fast-forward.
- Standard `bash scripts/deploy_forum_web.sh "0.54.0 年度Poster接入感想弹幕与审核"` succeeded (exit 0). The script pushed main, built in its isolated archive directory, switched output, and passed service/local/online health checks. Optional Baidu push reached its daily quota; deployment succeeded.
- Production version: 0.54.0 at 127.0.0.1:3100 and viewer.sakura-bot.cn.
- User explicitly authorized sigaer / drum ID 2258735 for acceptance. Reused the account's existing authenticated session without exposing its token.
- Actual production Poster sent “今年也要开心打鼓！”. POST and GET both 200. Same-nonce immediate retry returned 200 and the identical reaction ID. Database count for that user+nonce is exactly 1; sync status skipped and forum_thread_id NULL.
- Production reaction: `5e4b7bc5-1dcb-43c1-8ad2-e4f70168d3de`. Immediate append, measured leftward motion, reload and 30 seconds of continuously visible moving barrage all PASS. Browser page errors 0. Global and account-specific Forum thread deltas both 0.
- Local sanitize, new-nonce rate limit, published/hidden, one-item loop, lifecycle, background hide/zero empty state and five-viewport acceptance remain PASS.
- Gate B: PASS. Phase C/D not started. Main's original title_song_relations.json and poster.zip were restored/preserved with identical hashes; prior main document additions were incorporated.
- Final acceptance docs are a local-only documentation checkpoint after the script's release push. Do not manually push main or redeploy unchanged web code solely to publish this record.
## 2026-09-10 / Phase B post-release visual regression hotfix

- Profile-card tile unexpectedly fell back to placeholder after `0.54.0`; diff audit confirmed no `AnnualShareGrid` or profile mapping change between `bb72232` and `bed1bd9`.
- Fixed `AnnualShareGrid.vue` data-resource fallback to authenticated `/api/account/my-don`; no poster layout, barrage, reaction API/schema, or Forum changes.
- Owner-only scope is enforced by the snapshot path prefix, so public share and internal poster-export snapshots never request the owner-only resource. Verified in a real browser against the actual component module, with the unpatched build reproducing the defect in the same harness.
- Unrelated working-tree changes (`taiko_viewer/assets/data/title_song_relations.json`, `poster.zip`) are preserved and excluded from this hotfix, per the standing instruction; they must be isolated reversibly for the deployment run because the deploy script refuses a dirty tree, then restored with matching hashes.
- Version `0.54.1`; pending deploy. Phase B remains COMPLETE / PASS; Phase C NO.

## 2026-09-10 / Phase B post-release hotfix deployed and verified online

- Release commit `6d810ea 0.54.1 修复年度Poster称号展示资料卡资源回退`, fast-forward state on main already contained it. Standard `bash scripts/deploy_forum_web.sh "0.54.1 修复年度Poster称号展示资料卡资源回退"` exited 0 and pushed main itself; no manual push, no manual build/output swap, no service restart by hand.
- Because that script refuses a dirty tree, the unrelated `taiko_viewer/assets/data/title_song_relations.json` was isolated with a reversible stash and restored immediately afterwards; its SHA-256 matched before and after (`b44083d2…`) and the stash is dropped. `poster.zip` remains untracked and untouched.
- Deployed appVersion `0.54.1` on 127.0.0.1:3100 and viewer.sakura-bot.cn. Production network trace: snapshot `/api/account/annual-summaries/annual_8357acbcad4494b16903122a/my-don` → 404, then owner-only `/api/account/my-don` → 200, and the tile displayed the live MyDon image with no `AnnualArtworkFallback`. Covers, 2×2 geometry (117.05px tiles, gap 0), moving barrage and the reaction input area were all normal; page errors 0.
- Acceptance used read-only authenticated GETs only: annual jobs, reactions, summary updates and share creations written during the window were all 0. The temporary production session and DB defaults files were deleted after use.
- Hotfix = VERIFIED ONLINE. Phase B remains COMPLETE / PASS; Phase C not started.
- This acceptance record is a local-only documentation checkpoint after the release push. Do not manually push main or redeploy unchanged web code solely to publish it.

## 2026-09-10 / Phase C — Forum Taxonomy (released, online smoke pending)

- Scope was exactly the two product changes: add `general` (闲聊杂谈) and rename the `creative` display name to 同名二创. No new taxonomy framework, no Phase D work, and no reaction-driven Forum thread creation.
- Touched files: `taiko_viewer/types/forum.ts` (seed list), `taiko_viewer/locales/zh.json`, `taiko_viewer/locales/ja.json`, `taiko_viewer/package.json`, `taiko_viewer/package-lock.json`. Nothing touched `PosterSlide`, `AnnualShareGrid`, the reaction API, barrage scheduling, idempotency or rate limiting.
- `general` reuses the existing bootstrap: it is a new entry in `FORUM_SECTION_SEEDS`, and `seedSections()` upserts it on the unique slug, so it is inserted once, is repeatable and cannot duplicate. `creative` is the same row as before (same id, slug, route, API identity) with only its name/description/`sort_order` updated; its existing threads are untouched.
- The web UI resolves section names from i18n with the API `name` as fallback, so both layers were updated together. Note for the next agent: the Forum home chip row renders only the first four sections (`slice(0, 4)` in `pages/forum/index.vue`, pre-existing behaviour that this phase deliberately did not change), so the two new names appear in the composer section select (`/forum/new`) and on the section pages rather than in that home chip row. Whether the home chip row should list all sections is an open UI decision, not part of Phase C.
- Known narrow boundary carried from the hotfix (recorded, deliberately not fixed here): admin preview of another user's annual report can resolve the owner-shaped `my-don` snapshot to the signed-in operator's own `/api/account/my-don`. It does not affect the owner page, public share or poster export, and it is not a Phase C blocker.
- Seed idempotency was proven against the isolated `_test` database (explicit mutation opt-in plus `SELECT DATABASE()` check) by running the production `seedSections()` SQL twice, and not by adding fixtures or a suite.
- Unrelated working-tree changes (`taiko_viewer/assets/data/title_song_relations.json`, `poster.zip`) remain preserved and excluded from the Phase C commit, and must again be isolated reversibly for the deployment run because the deploy script refuses a dirty tree.
- Version `0.54.2`; deploy with the standard script follows. Phase D not started.

## 2026-09-10 / Phase C deployed and accepted online — Gate C PASS

- Release commit `a533a5b 0.54.2 社区新增闲聊杂谈并调整二创分区名称`; the standard `bash scripts/deploy_forum_web.sh "0.54.2 社区新增闲聊杂谈并调整二创分区名称"` exited 0 and performed the push, isolated build, output switch, service restart and health checks itself. Deployed appVersion `0.54.2` locally and on viewer.sakura-bot.cn.
- The unrelated `taiko_viewer/assets/data/title_song_relations.json` was again isolated with a reversible stash for the run and restored immediately afterwards with a matching SHA-256 (`b44083d2…`); the stash is dropped. `poster.zip` stays untracked.
- Production `GET /api/forum/sections` returns 9 unique sections: `general`=闲聊杂谈(80) and `creative`=同名二创(90). The composer select lists both names once each. `/forum/section/creative` kept its pre-existing thread `/forum/thread/28` and now displays the 同名二创 heading; the thread still resolves to `section/creative`, confirming a display-name rename rather than an identity migration.
- One ordinary discussion was posted through the real UI into 闲聊杂谈: `POST /api/forum/threads` 200, thread `/forum/thread/50`, section label 闲聊杂谈. It was the only thread created in the window, which also demonstrates that no reaction-driven Forum thread exists yet (Phase D untouched).
- Poster non-regression: four 117.05px tiles, real profile card from `/api/account/my-don`, moving barrage, reaction input present, browser page errors 0; annual reaction and share writes in the window were 0.
- Phase C = COMPLETE, Gate C = PASS. Phase D not started. Optional: `/forum/thread/50` is a genuine test discussion and can be hidden or deleted by a moderator whenever it is no longer useful.
- This acceptance record is a local-only documentation commit after the release push. Do not push it manually or redeploy unchanged web code solely to publish it; the next release will carry it.

## 2026-09-10 / Phase D — Reaction → Forum (released, online smoke pending)

- Implemented only the Poster reaction sync. The client still sends just `syncCommunity: true/false`; the server fixes `general` + `discussion` and uses the reaction text as both title and body, with tags 年度报告 / 年度感想 and no song binding.
- `createForumThread` was split into `createForumThreadCore(...)` + a normal wrapper. The public composer keeps its 4-character title minimum through the `normal` policy; the annual integration uses the `integration` policy, so a short reaction can become a thread without loosening the ordinary posting rule. Everything else in the ordinary pipeline (schema bootstrap, profile provisioning, section/type validation, official role gate, sanitisation, tags, song binding, insert, mention notifications) is shared.
- Sync is idempotent by construction: only the request that inserted the reaction performs the Forum side effect, and the outcome is persisted on the reaction row (`synced` + `forum_thread_id`, or `failed`, or `skipped`). A same-nonce retry therefore returns the stored outcome and can never create a second thread.
- Failure semantics follow the plan: the reaction is primary. A Forum error persists `failed` and still returns the published reaction with HTTP 200; a sync-rate-limited request (one per 30s, 10 per day, server-side) returns `skipped` / `rate-limited`; a marker-write failure is logged and does not fail the send.
- The Poster notice now reflects the server status: synced, 社区同步失败, 社区同步过于频繁 (弹幕 only), or not requested, in both zh and ja.
- Verification for this release must cover the four Gate D cases against the real deployment (sync=false, sync=true, same-nonce retry, rate-limited), and must confirm that only the sync=true case creates a thread.
- Unrelated working-tree changes (`taiko_viewer/assets/data/title_song_relations.json`, `poster.zip`) stay preserved and excluded, and must again be isolated reversibly for the deploy run because the script refuses a dirty tree.
- Version `0.55.0` (minor). Phase E not started.

## 2026-09-10 / Phase D deployed and accepted online — Gate D PASS

- Release commit `b23f325 0.55.0 年度感想支持同步到闲聊杂谈`; the standard `bash scripts/deploy_forum_web.sh "0.55.0 年度感想支持同步到闲聊杂谈"` exited 0 and did the push, isolated build, output switch, restart and health checks itself. appVersion `0.55.0` is live locally and online, and the deployed server chunk contains the new sync strings. The unrelated `title_song_relations.json` was again isolated with a reversible stash and restored with a matching SHA-256 (`b44083d2…`).
- Gate D ran against production with the authorized account and read-only verification: `sync=false` created only a reaction; `sync=true` created the reaction plus one `general`/`discussion` thread whose title and body are the reaction (`/forum/thread/51`, tags 年度报告 / 年度感想, no song binding); a same-nonce replay returned the identical reaction id and the identical thread with no duplicates; a second `sync=true` inside the 30-second window still saved the reaction but returned `skipped` / `rate-limited` and created no thread; and a real Poster UI send returned `synced`, showed 感想已发送，已同步到社区, appended to the barrage and produced `/forum/thread/52`.
- Four nonces produced exactly four reaction rows, and the `general` thread count moved 1 → 2 → 2 → 2 → 3 exactly as expected. Browser page errors were 0.
- The Forum-failure branch was not induced on the live site; it is guaranteed by construction because the reaction insert commits first and the sync is fully wrapped so it can only downgrade the sync status.
- Phase D = COMPLETE, Gate D = PASS. Phase E not started. The smoke left two genuine threads in 闲聊杂谈 (`/forum/thread/51`, `/forum/thread/52`) that a moderator can hide or delete when they are no longer useful.
- This acceptance record is a local-only documentation commit after the release push. Do not push it manually or redeploy unchanged web code solely to publish it; the next release will carry it.

## 2026-09-10 / Phase E — Share Card Export (released, online smoke pending)

- The save button now performs a real server export of `AnnualShareGrid.vue` only. Preview and export mount the same component: the new internal render page `/account/annual-share-card/:summaryId` renders the shared grid with the same owner view model, so there is no second visual implementation to drift.
- Rendering reuses the project's Playwright/Chromium path. `renderAnnualPoster` and `renderAnnualShareCard` share one screenshot helper; the share card is 1080×1648 (square_bg ratio, not the 1080×1440 legacy poster), waits for a page ready marker plus fonts and images, and clips exactly to the viewport. The render page pins the card to the export size so nothing is cropped.
- MyDon handling: the internal share-card my-don route tries the stored snapshot and then the owner's live MyDon rendered server-side (`getMyDonImageBuffer`). It never depends on a browser session, so an owner export cannot silently become the round placeholder.
- New API: `POST /api/account/annual-summaries/:key/share-card` and `GET /api/account/annual-share-cards/:id/image` (owner-only). Artifacts are cached by fingerprint in the additive `web_annual_share_cards` table with files under the existing annual cache. Deliberately synchronous — no job/polling layer, since a render is one Playwright pass and the phase instruction asked the chain to return the image.
- Saving is fully decoupled: no 30-day public share, no public URL and no Forum thread. The 同步分享到社区 checkbox beside the save button remains inert for Phase F. The legacy 更多分享方式 dialog and the legacy poster/share code path were not modified.
- Important discovery and fix: the Phase B route file `server/api/account/annual-summaries/[summaryId]/reactions.post.ts` collided with the older `[key]/` param directory, so Nitro shadowed every `[key]/*` route — `my-don`, `shares`, `posters` and `build` all returned the router's "Page not found" in production. This, not a missing file, is why the annual snapshot my-don request 404'd and the profile tile fell back in `0.54.0`. All annual-summaries children are consolidated under `[key]`, which restores those four endpoints; route resolution was verified locally before release (HEAD reproduces the router 404, the patched tree resolves all seven routes).
- Unrelated working-tree changes (`taiko_viewer/assets/data/title_song_relations.json`, `poster.zip`) stay preserved and excluded, and must again be isolated reversibly for the deploy run because the script refuses a dirty tree.
- Version `0.56.0` (minor). Phase F not started.

## 2026-09-10 / Phase E deployed and accepted online — Gate E PASS

- Release commit `f281826 0.56.0 年度总结四格分享图支持服务端导出`; the standard deploy script exited 0 and performed push, isolated build, output switch, restart and health checks. appVersion `0.56.0` is live locally and online, and the unrelated `title_song_relations.json` was again stashed and restored with a matching SHA-256 (`b44083d2…`).
- The real Poster page saved a genuine image: POST 200 with `shareCard { id, imageUrl, width: 1080, height: 1648 }`, browser download `taiko-annual-annual_8357acbcad4494b16903122a.png`, 957,241 bytes. Visual review of the file confirms the four-tile share card only — three real covers, the real MyDon profile card with nickname/title, six statistics, no barrage, no reaction input, no buttons, no poster background, no cropping.
- Preview and export agree: the on-page grid at 414×632 and the exported 1080×1648 image share tile order, covers, profile, caption, six stats, spacing and ratio, and both come from the same `AnnualShareGrid.vue`.
- Cache and ownership behave as designed: a second save returned `cached: true` with the same id and a byte-identical PNG; the image route answers 200 for the owner and 401 anonymously.
- Decoupling confirmed: `web_annual_shares` stayed 0 and `forum_threads` stayed 11 while `web_annual_share_cards` went 0 → 1, so saving creates neither a public share nor a Forum thread. The 同步分享到社区 checkbox remains inert for Phase F.
- The route-table root cause is fixed and verified in production: shares/posters/build/my-don/reactions/share-card all resolve now, the owner snapshot my-don route returns 200 again (580,551 bytes, byte-identical to the live MyDon), and the Poster profile tile uses the snapshot first with the Phase B fallback unused. Phase D stayed intact (reaction UI plus a moving barrage of 7 bubbles, reactions route resolving, page errors 0).
- For the next agent: the share-card render is synchronous by design (no job table), `web_annual_share_cards.forum_image_url` and `forum_thread_id` exist but are unused, and the plan's fingerprint cache is implemented through the unique `(summary_id, locale, fingerprint)` key plus file reuse.
- Phase E = COMPLETE, Gate E = PASS. Phase F not started.
- This acceptance record is a local-only documentation commit after the release push. Do not push it manually or redeploy unchanged web code solely to publish it; the next release will carry it.

## 2026-09-10 / Phase F — Share Card → Forum (released, online smoke pending)

- The 同步分享到社区 checkbox beside 保存分享图片 is now live. `syncCommunity=false` saves the image only; `syncCommunity=true` saves the same image, uploads it through the Forum pipeline and creates one `general` / `discussion` thread.
- Reuse, not duplication: the Forum source image is the stored Phase E share-card PNG read back from the annual cache, and `server/utils/forum/media.ts` now exposes `uploadForumImageBuffer`, the extracted body of the existing browser upload endpoint (validation, `sharp` resize, WebP q84, OSS put). There is no second renderer, no AnnualShareGrid copy and no browser API round-trip.
- Contract fixed server-side: title 快来看看我的年度报告吧～, body exactly one `image` block, section `general`, type `discussion`, no paragraph, no link, no QR, no second image. The thread summary mirrors the mandated title rather than the generic image-only placeholder; the core derives the thread cover from the image block.
- Idempotency is anchored on the share-card row: an existing `forum_thread_id` returns the stored result without re-uploading or re-posting, and a new sync runs under the existing `withAnnualFileLock` keyed by card id with a re-read inside the lock plus a `forum_thread_id IS NULL` guarded write, so repeat or concurrent saves cannot create a second thread.
- Failure isolation matches Phase D: the image is primary. A Forum error, rate-limit skip or lock timeout is reported through `communitySync` and never blocks the saved image or the download. Rate limiting reuses the extracted `claimForumSyncBudget` helper (30s / 10 per day) shared with the reaction sync; each feature keeps its own persisted record.
- Legacy isolation intact: no `web_annual_shares` row and no public URL are created, and the legacy dialog is untouched.
- Unrelated working-tree changes (`taiko_viewer/assets/data/title_song_relations.json`, `poster.zip`) stay preserved and excluded, and must again be isolated reversibly for the deploy run.
- Version `0.57.0` (minor). This is the final phase of the plan.

## 2026-09-10 / Phase F deployed and accepted online — Gate F PASS

- Release commits: `140feb3 0.57.0 年度分享图片支持同步到社区`, then two forward fixes on the same version — `04ccec7 0.57.0 修正分享图片社区同步状态语义` and `15d287f 0.57.0 修正分享图片卡片并发写入的 id 覆盖`. All three deployed through the standard script (each exit 0, push/build/switch/restart/health checks by the script); appVersion `0.57.0` online and locally. The unrelated `title_song_relations.json` was stashed and restored with a matching hash each time.
- The real smoke caught two defects that unit-level reasoning had missed, both fixed forward before acceptance. First, saving with the community checkbox off on an already synced card reported `synced`, contradicting the checkbox; the not-requested branch now always reports `skipped` / `not-requested` while still returning the stored thread. Second, and more serious, two concurrent **first** saves of one fingerprint raced inside `insertAnnualShareCard`: the `ON DUPLICATE KEY UPDATE id = VALUES(id)` clause let the losing insert overwrite the row id, so the winner's `forum_thread_id` write matched no row and the linkage was silently lost — which would have produced a duplicate thread on the next save. The upsert now leaves `id` alone.
- Verified online with the authorized account: sync OFF saved the image only (no thread, no public share); sync ON with two concurrent requests created exactly one thread (`55`) and both responses reported it; the card row persisted `forum_thread_id=55` and `forum_image_url`; the thread is `general` / `discussion` with title 快来看看我的年度报告吧～ and exactly one image block; the rendered page loads the 1049×1600 WebP share card (three real covers, real MyDon card, six stats, no barrage/inputs/buttons/background) with no paragraph body.
- Retry paths: the already synced `zh` card returned stored thread `53` without re-uploading, a concurrent repeat pair for `ja` returned `55` twice with no new thread, and a later sequential retry reused `55`. `web_annual_shares` stayed 0 throughout.
- Leftovers in 闲聊杂谈 from this acceptance: threads `53`, `55` and the unlinked `54` (pre-fix race artifact); a moderator can hide or delete them.
- Phase F = COMPLETE, Gate F = PASS. The annual poster community plan's phases A–F are all complete. No further phase is planned; `/forum/thread/50`–`/forum/thread/55` are the real acceptance artifacts left in the community.
- This acceptance record is a local-only documentation commit after the release push. Do not push it manually or redeploy unchanged web code solely to publish it.

## 2026-09-10 / Final closeout — audit results and the `0.57.1` patch

- Closeout was audit-only apart from one genuine product bug. Phases A–F stay COMPLETE / PASS and were not re-accepted; no scope was added and no test infrastructure was built.
- Admin preview MyDon (the long-standing narrow boundary) **did still exist** and is now fixed. `withOwnerAssets` gave admin payloads the owner-scoped account my-don URL; an operator is not the owner, so the request failed and the client fallback could display the operator's own MyDon. Admin payloads now use `withAdminAssets`, which points at the new operator-gated `GET /api/admin/annual-summaries/:summaryId/my-don`; that route reuses the internal renderer's snapshot-then-live resolution for the **summary owner**. The new URL is outside the `/api/account/annual-summaries/` prefix, so the owner fallback can no longer fire for operators. Owner page, public share, internal export and the share grid are unchanged.
- Verification limit worth knowing: confirming the operator-visible result needs an `ichika` or `maru` admin login, which this session did not have. What was verified is that the new route resolves and is guarded (401 without an admin session), that the owner snapshot route still returns 200, and that the share-card save/sync flow is unaffected.
- Forum home `slice(0, 4)`: decision recorded as **keep**. The chip row already scrolls with hidden scrollbars and is shared with four filter buttons; with nine sections the two newest chips would simply sit off-screen, so removing the slice buys no real discoverability while lengthening the row that also carries the primary filters. Both sections remain reachable from the composer select and their own pages. Any home-page rework belongs to a separate UI task.
- Acceptance threads: `53` (zh) and `55` (ja) are referenced by share-card rows and stay. `54` is referenced by no row, has zero replies and zero likes, and is a pre-fix race artifact — suitable for hiding or deletion, but **not deleted here** because production deletion needs explicit approval.
- The synchronous Playwright renderer (no job/polling layer) is now formally accepted; the plan's job sketch will not be implemented, and no timeout problems have appeared in production.
- Release: `0.57.1` (patch) deployed with the standard script, exit 0. This closes the annual poster community work: A–F complete, production baseline `0.57.1`, no further phases planned.

## 2026-09-21 / Export promo footer handoff

- Treat this as a post-closeout `0.73.1` patch; do not reopen Annual Poster Community phases A–F.
- Preview remains `AnnualShareGrid` only. Export uses `AnnualShareCardExport` to append a 224px footer beneath the pixel-stable 1080×1648 grid.
- Canonical export dimensions are 1080×1872 and renderer identity is `share-card-v3-promo-footer`.
- QR URL is the public, identifier-free `https://viewer.sakura-bot.cn/annual?from=poster`. QR generation is high-contrast with a four-module quiet zone; server failure is explicit and the component has a no-broken-image fallback.
- Save and Forum sync reuse the same new artifact. Do not add a separate community renderer or stitch a screenshot onto the old PNG.
- Local evidence and commands are recorded in `docs/annual-poster-export-promo-footer-status.md`.
- Release `07ed51b` / Viewer `0.73.1` deployed through the standard script with exit 0. Authenticated production preview/export acceptance, repeat-cache identity, zh/ja visual inspection and PNG/JPEG QR decoding all PASS; community synchronization was disabled throughout. **POSTER EXPORT PROMO FOOTER — COMPLETE.**
