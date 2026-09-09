# Annual Poster Community — Execution Status

Current Phase:
Phase A — Poster Static Rebuild

Status:
COMPLETED

Gate A:
PASS

Next allowed phase:
Phase B — Danmaku Core (not started; requires a new user instruction).

Gate A passed after user manual multi-viewport visual acceptance.

Phase B remains forbidden until a new user instruction. The reopened-master review below is historical; the current Gate A decision is PASS.

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

Stop at Phase A and await a new Phase B instruction. Do not deploy or push this checkpoint automatically.

## Current working version

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
