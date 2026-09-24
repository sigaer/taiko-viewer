# Annual motion continuity — 0.75.6

## Implementation

- StoryPlayer owns one persistent Period/Overview stage across two logical page anchors. The stage follows adjacent scrolling, preserves cover/particle identity during the 1.6s transition, pauses outside the pair, and is destroyed with the report.
- GSAP annual timelines skip empty optional targets without changing remaining explicit positions. Independent scenes validate required targets. Obsession and FavoriteShift backgrounds no longer fade from transparent on activation.
- Distant navigation mounts and decodes at most 16 destination images (1.2s deadline) before committing an immediate scroll; outgoing content remains mounted until the handoff. Pair input is locked during transitions. GIF geometry is reserved.
- Client-only Three.js background: one renderer, at most 12 planes, shared geometry, deduplicated source-resolution textures, four concurrent loads, six-second request deadline, eight-MiB response limit and DPR follows the device up to 3. Runtime downscaling was removed in 0.75.6 after mobile blur reports. MSAA is requested; a one-fragment silhouette coverage ramp also works without it. Trilinear mipmaps and up to 16x supported anisotropy preserve foreshortened texture detail. Invisible planes are not drawn, and unlit artwork retains its original display-RGB values without lighting/gamma round trips. One GSAP ticker advances the non-reactive cover clock. Covers wrap only while invisible.
- The CDN cover endpoint has no CORS header. GET `/api/content/covers/:id/texture` streams the existing trusted local cover file; it does not accept arbitrary URLs or follow redirects. Existing fallback cover IDs are retained.
- Static artwork remains available for reduced motion, failed initialization and context loss. Old renderer resources and pending requests are disposed on rebuild/unmount. Context loss disables recreation until a new report session.

## Validation

All browser checks use bounded `scripts/memory/run_qa.sh`; outputs are under `/var/tmp/annual-motion/`. The harness renders the real StoryPlayer and all scene components, stubbing only Nuxt app services/read-only API responses. Existing sample data is supplemented with a synthetic late-night section to exercise all 21 pages. No account/database mutations are performed.

- Annual contract + 30 unit/regression tests: PASS.
- Standalone Three.js renderer TypeScript check: PASS.
- Matched-browser 21-page baseline: GSAP warnings reached the bounded 100-entry log limit; 87 samples with explicitly faded scene backgrounds, 0 unmounted blank-stage frames. Period and Overview each ran for 72s; both had frame-interval P95 16.7ms, with one 73ms / 85ms long task respectively.
- System Chromium cannot create WebGL on this host; static fallback traversal passed. Full WebGL checks use Playwright's matching Chromium 149 with SwiftShader, not real mobile hardware.
- Navigation-inclusive baseline reproduced 21 blank-stage frames and 133 faded-background samples. Final implementation: 0 blank-stage frames, 0 faded-background samples, 0 GSAP target warnings and 0 page exceptions across all 21 pages and distant chapter jumps.
- Final 72-second steady-state samples: Period P95 16.7ms, maximum 33.3ms, no long tasks; Overview P95 16.8ms, maximum 100ms, one 61ms long task (attribution unresolved). Adaptive background pixel ratio settled at 0.5625 on SwiftShader; HTML remained at native resolution. This is not evidence that all frames or real devices meet the performance target.
- Ten reverse and ten forward transitions retain identical canvas and particle nodes. Repeated input, five viewport sizes, pagehide/pageshow, reduced motion, context loss, missing optional blocks, empty covers, injected HTTP 503 and unavailable WebGL checks passed. Warnings remaining in the log are screenshot ReadPixels diagnostics and deliberately injected 503 responses.
- Three report mount/unmount cycles each returned to one baseline GSAP listener and zero live WebGL contexts. Browser and temporary Vite server are closed in finally.
- Artifacts: `/var/tmp/annual-motion/after/after.json`, screenshots alongside it; baseline navigation evidence in `/var/tmp/annual-motion/before-navigation/`. Release version is 0.75.2, using the repository build wrapper and standard deployment script.

Real Android/iOS rendering and the real-device 60Hz performance gate remain unverified; software-renderer frame timing must not be reported as a phone benchmark.

## 0.75.6 clarity correction

The 0.75.2 performance adaptation reduced mobile canvas density (initial cap 1.5, floor 0.5), and MSAA was disabled. Strong foreshortening without anisotropic filtering further blurred artwork. 0.75.6 removes that adaptation and forced 400x400 bitmap resizing. The existing same-origin endpoint already returns original PNG bytes; no lossy WebP conversion is needed. Cover dimensions, spacing, paths and local rotation remain unchanged from 0.75.3.

`verify_annual_cover_clarity.mjs` compares the old and new renderer at DPR 1 and 3, including a browser with MSAA deliberately denied. The 390x844 CSS stage now retains a 1170x2532 drawing buffer at DPR 3 (previously 585x1266 before any adaptive reduction). An 800x800 fixture uploads at 800x800 instead of 400x400. Chromium/SwiftShader reports four MSAA samples and anisotropy 16 when available, with no shader/page errors in either MSAA branch. A sampled white-plane silhouette had no intermediate alpha levels before the fix and 216 intermediate levels at DPR 3 with MSAA denied afterwards, verifying the edge-only fallback at the pixel level. Artifacts: `/var/tmp/annual-cover-clarity/{before,after}`. The browser/server close in finally.

Annual contract and 29 remaining tests pass (the obsolete resolution-degradation test was removed); renderer TypeScript check passes. The real two-page quick browser regression has no GSAP target warnings or page errors. Its isolated software-renderer P95 was 33.3ms with one 57ms long task; native-resolution AA costs more than the previous blurred output. This is a visual-quality correction, not a claim of passing the real-phone 60Hz gate. Android/iOS GPU visual/performance acceptance remains outstanding.
