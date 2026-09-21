# Annual Poster Export Promo Footer

## Scope

Viewer `0.73.1` adds a promotional signature only to the canonical saved/community Annual share image. The Poster preview and its mobile page remain unchanged.

## Preview / export separation

- `PosterSlide.vue` still mounts `AnnualShareGrid.vue` directly. It does not import or render the export wrapper or promotional footer.
- The internal render page mounts `AnnualShareCardExport.vue`. That wrapper renders the existing `AnnualShareGrid` at exactly **1080 × 1648**, then appends `AnnualShareCardPromoFooter.vue` at **1080 × 224**.
- The resulting PNG is **1080 × 1872**. The original 1648px content is neither scaled, compressed nor reflowed.
- The save-image response and optional Forum community sync continue to use the same canonical `web_annual_share_cards` artifact. There is no third renderer and no preview screenshot/stitching path.

## Footer contract

- Brand: `Sakura Taiko`
- Chinese CTA: `生成你的太鼓年度报告`
- Japanese CTA: `あなたの太鼓年間レポートを作成`
- Domain: `viewer.sakura-bot.cn`
- QR target: `https://viewer.sakura-bot.cn/annual?from=poster`
- No user, summary, token, invitation or other private identifier is present.
- Layout tokens are centralized in the footer component: height 224px, horizontal padding 52px, vertical padding 34px, QR 136px, content gap 40px and line gap 8px.
- The footer is a quiet light signature area with left-aligned copy and a right-aligned QR. It has no card, banner, separator, gradient, pattern or watermark.

## Renderer and cache

- Canonical dimensions: `1080 × 1872`.
- Renderer revision: `share-card-v3-promo-footer`.
- The cache fingerprint continues to include dimensions and renderer revision, so `v2` 1080×1648 artifacts cannot collide with the new output.
- QR generation uses error correction H, a four-module quiet zone, an opaque white background and dark high-contrast modules. Server generation failure is an explicit render failure; image decode failure has a text/domain fallback and never leaves a broken image glyph.
- Existing font/image/background readiness and isolated Playwright worker timeouts remain in force; the QR image participates in the same readiness pass.

## Local validation

- `npm run test:annual`: PASS, including preview/export separation, dimensions, QR target, renderer revision, cache identity, QR failure handling, zh/ja copy and cover fallback.
- `scripts/verify_annual_share_card_promo.mjs`: PASS.
  - Preview footer DOM count: 0.
  - Export: 1080×1872; grid: 1080×1648; footer: 1080×224; QR: 136×136.
  - The standalone 1080×1648 content and the top 1648px of the new export have the same raw-pixel SHA-256: `4d10e4e6a10849df8a803646bd6f4d1b84c25531c54e93e334015a62b87287f3`.
  - Browser errors: 0; broken images: 0.
  - Missing-QR safe fallback: PASS.
- QR decode:
  - Original PNG: exact target PASS.
  - Full-resolution JPEG quality 55: exact target PASS.
- Manual inspection: Chinese and Japanese exports PASS; footer hierarchy, whitespace, alignment and long Japanese CTA are correct.
- Isolated `npm run build`: PASS with `NODE_OPTIONS=--max-old-space-size=4096` inside `scripts/memory/run_build.sh`. The first default-heap attempt reached Nitro finalization and stopped on Node heap OOM; the bounded retry completed without changing application or deploy scripts.

Evidence is stored outside Git at `/var/tmp/annual-export-promo/`, including `export-zh.png`, `export-ja.png`, `export-missing-qr.png`, compressed QR evidence and `report.json`.

## Release

- Released version: `0.73.1` (patch), commit `07ed51b 0.73.1 年度分享图增加传播落款`.
- `scripts/memory/run_build.sh` invoked the standard `scripts/deploy_forum_web.sh` with the HEAD subject and exited 0 on 2026-09-21. The script pushed the release, built and switched the output, reloaded the service and passed local/online health checks. The optional Baidu push reported the existing daily quota condition and remained non-blocking.
- Online homepage reports `0.73.1`; `taiko-viewer.service` and `taiko-sync-receiver.service` are active, and Viewer `NRestarts=0` after deployment.

## Production acceptance

- Authenticated mobile Poster at 390×844: preview grid width 370px, no horizontal overflow, promo-footer DOM count 0, all four artwork slots loaded, broken images 0 and browser exceptions 0.
- Authenticated Chinese export with `syncCommunity=false`: HTTP 200, `cached=false`, `communitySync.status=skipped`, real PNG 1080×1872. An immediate repeat returned `cached=true`, the same card id and byte-identical image.
- Authenticated Japanese export with `syncCommunity=false`: HTTP 200, `cached=false`, `communitySync.status=skipped`, real PNG 1080×1872.
- Chinese and Japanese production images were visually inspected. The appended footer has the intended hierarchy, spacing and localized CTA; it does not alter the live mobile preview.
- Production Chinese PNG, Japanese PNG and a full-resolution Chinese JPEG recompressed at quality 55 all decode to exactly `https://viewer.sakura-bot.cn/annual?from=poster`.
- Community synchronization was explicitly disabled in every production mutation; no Forum post path was invoked.
- The old production artifact and the new top 1648px are not byte-identical because the stored annual data/render environment has evolved since the historical artifact. Preservation of the content implementation is instead established by the pre-release same-runtime raw-pixel comparison above, which is byte-for-byte identical.

Production evidence is stored outside Git at `/var/tmp/annual-export-promo/production.json`, `production-preview.png`, `production-export-zh.png`, `production-export-ja.png` and `production-export-zh-q55.jpg`.

**POSTER EXPORT PROMO FOOTER — COMPLETE**
