# RatingRank Waterfall X-Axis Regression Hotfix

## Scope

Viewer `0.73.3` is a chart-internal bottom-safe-area patch for the Annual RatingRank waterfall. The `0.73.2` `--annual-stage-height` and visualViewport contract remains unchanged. Rating data, the 19-rank data contract, Annual calculation, StoryPlayer navigation, summary UI and every other slide are unchanged.

## Root cause and fix

- The waterfall used a 1700-unit viewBox with `chartBottom = 1600`, `axisY = 1630`, labels at `axisY + 34`, and a plot-wide `translate(0 -55)`. That left the bottom geometry dependent on a magic transform instead of an explicit safe area.
- At short visual heights, the SVG replaced element could also retain its intrinsic 1200×1700 aspect-ratio height even though its chart wrapper had already shrunk to the correct grid row. The visual container correctly hid the excess, exposing the axis clipping.
- The plot transform is removed. Formal coordinates now place the 19 layers at `chartBottom = 1550` with a 74-unit layer gap, the axis at 1590, and the label baseline at 1624. A declared 56-unit axis-label bottom safe area remains inside the 1700-unit viewBox.
- The SVG is absolutely inset into the chart wrapper's definite box. The scene and visual overflow rules are unchanged; the fix does not rely on `overflow: visible` to reveal the axis.

## Anomaly telemetry

- The existing `annual_rating_rank_layout_anomaly` remains active-only, anomaly-only and session-deduplicated.
- It now also compares the rendered axis-label group rectangle with the visual rectangle. The required pixel margin is derived from the SVG's declared 56-unit safe area and current rendered scale.
- New allowlisted diagnostics are visual rectangle, axis-label rectangle and computed axis safe margin. No account, rating, summary, song or other user data is sent.

## Local validation

- `npm run test:annual`: **20 PASS**, including the retained stage-height contract, active-only telemetry and the new 19-layer/bottom-safe-area contract.
- `scripts/verify_annual_rating_rank_layout.mjs`: **PASS**, 18 Android Edge-style Chromium mobile-emulation cases across 360×780, 390×844 and 430×932.
  - Initial, 120px bottom-toolbar contraction, restored height, `pageshow`, page-08 reload and next→back→08 all pass with reduced motion.
  - Every case contains all 19 layers, all 19 rank labels, the marker, and axis labels `0 / 4 / 8 / 12 / 16`.
  - The rendered axis-label bbox stays above the visual bottom by at least the scale-adjusted 56-unit margin. The narrowest case is 360×660: 17.35px actual clearance versus 14.26px required.
  - Scene/stage/content/header/summary/next-slide/document-overflow invariants from `0.73.2` remain passing.
- Representative screenshots at 360×660, 390×844 and 430×932 were inspected manually: the lowest rank, full axis line, all five labels and marker are visible without entering the summary.
- Evidence: `/var/tmp/annual-rating-rank-axis/report.json` and screenshots in the same directory.
- The isolated production build is pending a retry because the repository memory guard rejected the first attempt before starting due to insufficient headroom. It was not bypassed.

## Evidence limit

This environment does not provide a physical Android Edge device. Chromium mobile emulation is structural evidence only and must not be reported as a real Android Edge PASS. Production telemetry and real-user feedback remain the real-device signal after release.

## Release

- Target Viewer version: `0.73.3` (patch).
- Release and authenticated production acceptance are pending.
