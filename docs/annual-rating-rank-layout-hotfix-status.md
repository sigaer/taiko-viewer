# RatingRank Mobile Layout Hotfix

## Scope

Viewer `0.73.2` fixes a real-device compatibility risk in the Annual RatingRank scene. This is a viewport/layout patch only: `AnnualRatingWaterfallChart` viewBox, paths and layers; rating data; the Annual algorithm; StoryPlayer navigation; and every other slide UI remain unchanged.

## Root cause and fix

- `AnnualRatingRankScene.vue` previously ended its height fallback chain at its own `100dvh`, instead of consuming the hardened StoryPlayer `--annual-stage-height` contract.
- Its paper and content initially shared absolute positioning, but the content rule later overrode that with `position: relative`. The grid therefore lacked a definite containing height while its middle row and chart depended on `minmax(0, 1fr)` and `height: 100%`.
- The scene now uses `height: var(--annual-stage-height, 100dvh)`, `min-height: 0` and hidden overflow. Paper and content are both absolute, inset 0, 100% wide/high, `min-height: 0` and border-box. The conflicting relative positioning was removed.

## Anomaly telemetry

- `annual_rating_rank_layout_anomaly` is accepted by the existing Annual beta event pipeline.
- Checks run only when account Annual beta tracking is enabled, the report has started, the document is visible and RatingRank is the active slide. Admin previews and adjacent pre-mounted slides do not emit it.
- No event is sent for a matching layout. A mismatch emits at most once per mounted player and is also session-deduplicated server-side.
- The allowlisted payload contains only viewport/layout diagnostics: inner height; visual viewport height, offset and scale; Annual stage height; scene/content/chart rectangles; scroll Y; and the browser user agent. It contains no summary, rating, title, song, account, binding or invitation data.
- The check is rescheduled through the existing Annual viewport lifecycle for viewport resize, visual viewport changes, orientation changes, `pageshow` and visibility restoration, plus RatingRank entry.

## Validation

- `npm run test:annual`: **20 PASS**, including the new stage contract, active-only telemetry and unchanged waterfall-geometry guards.
- Isolated Nuxt production build: **PASS**. Prerender logged the existing unauthenticated account-database warning because the ad-hoc build intentionally had no application DB credentials; build exit was 0.
- `scripts/verify_annual_rating_rank_layout.mjs`: **PASS**, 18 Chromium-emulation cases across 360×780, 390×844 and 430×932.
  - Initial, 120px visual-height contraction, restored height, `pageshow`, reload on page 08 and next→back→08 all passed with reduced motion.
  - In every case scene/stage height equaled `--annual-stage-height`; scene top/bottom stayed inside the active stage; content filled the scene; chart, header/title and summary stayed inside; the next slide was not visible; and the document did not vertically overflow or scroll.
  - Contracted simulated heights were 660, 724 and 812px respectively, and recovered to 780, 844 and 932px.
- Evidence: `/var/tmp/annual-rating-rank-layout/report.json` and viewport screenshots in the same directory.

## Evidence limit

This environment does not provide a real Android Edge device. The browser result is **Chromium emulation PASS** for structural verification only; it is not an Android Edge PASS. Real-device feedback remains the production acceptance signal after release.

## Release

- Released Viewer: `0.73.2` (patch), commit `f4fba5e 0.73.2 修复年度RatingRank移动端高度错位`.
- The memory build wrapper invoked `scripts/deploy_forum_web.sh` with the exact HEAD subject and exited 0. Push, install, build, output switch, service reload and local/online health checks all completed through the standard script. The optional Baidu push reached the daily quota and remained non-blocking.
- Online homepage reports `0.73.2`; Viewer and sync-receiver services are active, with Viewer `NRestarts=0` after deployment.

## Production acceptance

- Authenticated account Annual smoke repeated the same 18 cases at 360×780, 390×844 and 430×932, using Chromium mobile emulation with an Android Edge UA and reduced motion.
- Initial RatingRank, 120px toolbar-height contraction, restored height, `pageshow`, reload directly on page 08 and next→back→08 all PASS.
- Every case had exact stage/scene height equality, scene top 0 and bottom equal to the active stage, content filling the scene, positive chart height, header/title and summary inside the scene, next slide invisible, document vertical overflow false and document scroll Y 0.
- Browser page errors: 0. Captured normal Annual report/slide events; captured `annual_rating_rank_layout_anomaly` events: **0**, confirming the healthy layout does not false-positive.
- Production evidence: `/var/tmp/annual-rating-rank-layout/production-report.json` and `production-390x844.png`.

This remains Chromium emulation, not a real Android Edge PASS. The deployed anomaly event and ongoing user feedback provide the real-device follow-up path.

**RATINGRANK MOBILE LAYOUT HOTFIX — COMPLETE**
