# QA harness — Design V1.1 real-browser acceptance (doc 07 §Q)

Drives the system Chrome (fallback: Edge) through `playwright-core` against the **production build**
(`vite build` → `vite preview` on port 4311). No bundled browsers are downloaded. One browser, at most
2 pages in parallel, a hard time cap, and the preview server + browser are always closed in `finally`.

## Run

```bash
npm run qa              # full matrix, all suites (365 cases, ≈16 min)
npm run qa:quick        # 28 cases + quick flows + perf
node qa/run.mjs --suite checks --only songs-615          # one suite, filtered cases
node qa/run.mjs --suite flows --flows palette,sync       # selected flows
node qa/run.mjs --base http://localhost:4310/ --quick    # against an existing server (no build)
node qa/curate.mjs      # copy key screenshots to qa/screenshots + gallery index.html
```

Options: `--suite visual|checks|flows|perf|all` (comma list ok), `--quick`, `--only <substr>`,
`--base URL`, `--max-minutes 25`, `--no-build`, `--build-retries 3`, `--build-wait 60` (s),
`--flows a,b`, `--concurrency 1|2`. If the build keeps failing the run falls back to the dev server on
4310 and says so in the summary (perf budgets are then not meaningful).

Outputs (git-ignored): `qa/out/results.json`, `qa/out/summary.md`, `qa/out/run.log` (capped 2 MB),
`qa/out/shots/<route>__<viewport>__<theme>__<locale>__<auth>__<dataset>.jpg` (+ `__full.jpg` for core
pages, capped at 6,000 px), `qa/out/flows/*.jpg`. Committed: `qa/screenshots/` (≤ 70 files, ≤ 12 MB).

Prototype state is seeded into `localStorage['tv-design-v1']` before the first script runs:
`theme, locale, auth, dataset, syncOutcome, motion`.

## Matrix (`qa/matrix.mjs`)

Pages come from `src/views/review/screens.js` + `src/router.js` + `/review*`, `/states` and a bogus
route. Every page × 5 viewports (light/zh/ready/full; login = guest, bind = unbound); core pages ×
{1440, 390} in dark and in ja; 7 pages × 4 auth states × {1440, 390}; data pages × `demo`; edge-state song pages × {1440, 390}.

## Suites

| suite | what it does |
|---|---|
| visual | viewport screenshot (CSS pixels, JPEG) per case; full-page for core pages |
| checks | per case: console/pageerror/failed requests; horizontal overflow + origin elements; occlusion of ≤ 60 interactive elements; undeclared truncation; tap targets (phones); contrast (≤ 400 text nodes); 20-stop Tab focus walk (1440 & 390); a11y basics. Once per run: theme flash at DOMContentLoaded; infinite animations under reduced motion |
| flows | `qa/flows/*.mjs`: palette (desktop keyboard + phone full-screen), sync (auth × outcome, desktop + phone), overlays (Sheet placement, focus trap, Esc/scrim, focus restore, account menu), route state (URL filters, Back restores filters + scroll, R1 params kept, R5), rapid navigation (60 routes / 6 s), theme/locale toggles, forms (login, compose, bind) |
| perf | M6 budgets at 1440×900, `full` data: data generation (`window.__TV__.datasetInfo.generatedMs`), palette keystroke p95, /songs filter & sort p95, route switch p95, mounted rows / lamp cells, DOM nodes, JS heap, long tasks during rapid nav |

A flow step that hits a missing feature fails with a message; it never crashes the run.

## Check refinements made during the V1.1 acceptance (false positives, with reasons)

- **Occlusion / tap targets skip elements that are detached after `scrollIntoView`.** `VirtualList`
  recycles rows when the window scrolls; the old row is removed, its rect collapses to 0×0 at the
  top-left, and `elementFromPoint` then hit the rail — 111 bogus "covered by nav.rail" errors on `/songs`.
- **Focus walk freezes CSS transitions** while it runs. Snapshots were taken 40 ms after Tab, mid-
  transition, so focused and blurred styles compared equal on inputs with a 120 ms ring transition.
  The snapshot also includes the parent and grandparent (rings drawn with `:focus-within`) and the
  bottom/left border colours (underline-style fields such as the compose title).
- **The Tab walk starts at the top of `<body>`** (a temporary `tabindex=-1` anchor is focused first).
  Chrome keeps the sequential-navigation starting point where earlier checks left it, so the walk
  had started deep in `/play/progress` and reported a group button «out of viewport».
- **Inline text buttons (`button.link`) inside a sentence are exempt from the tap-target check** like
  inline links (D7: 正文里的行内文字链接).
- **An input's `<label>` counts as its hit area** (clicking a label activates the control).
- **Contrast inside `.mocks` on `/review/directions` is reported as info**: those are the B/C direction
  concept mocks with their own palettes, explicitly exempt from D1/D11.
- **Palette query センボンザクラ expects 千本[桜樱]**: the zh title is 千本樱 and an alias hit shows
  「别名：せんぼんざくら」 per P2, so the ja title 千本桜 is not on the row.
- **Rapid navigation (R6) uses product routes only** (`/review*` are design-review pages, «不属于产品本身»
  in `router.js`). `/review/system` alone produces a 300–600 ms first render; it is reported in
  `docs/09-v1.1-qa-report.md`, not hidden.
- **Perf sort latency clicks header `<button>`s only** (it previously clicked the `<th>` itself, which
  does nothing, and timed out at 1.5 s); samples with no DOM change are excluded and counted in a note.

## Checks added for ruling C (screenshot review)

- **text-collision (C14)**: for every visible text node, its line boxes (`Range.getClientRects`) are
  clipped to every clipping ancestor (overflow ≠ visible, line clamp — so ellipsized text only counts
  where it paints) and inset 12 % top / bottom (content area → approximate glyph ink). Boxes of
  different, non-nested elements that intersect by > 2 px in both axes are reported, unless they sit in
  different fixed / sticky layers, one of them is a badge / count / tooltip, or `elementFromPoint` at the
  intersection hits neither (covered or clipped). Text inside an off-screen `content-visibility: auto`
  subtree is skipped (its layout is a placeholder size until rendered). SVG text is NOT covered — the
  growth time-stack labels were found by eye.
- **char-wrap (C14)**: a text node with ≥ 3 CJK characters whose range is < 1.5 em wide and spans
  ≥ 3 line boxes (one character per line).
- **Inline links (C10)**: superseded by F2 below.
- **Skip link (C11)**: only expected on pages that have a `nav`.

## V1.2 changes to the checks (docs/10)

- **Tap targets (F2).** On phone viewports every interactive element must be ≥ 44×44 (probe ± 21.5px),
  reported as an **error** on product pages (info on `/review*`). The only exemption is an *inline
  text link*: an `a` / `button.link` that is not styled as a control (`.btn`, `.chip`, tab, segment,
  row link …), not inside a heading / bar / tab bar, narrower than 80 % of its parent, carries only
  small decorations (a section dot, a ≤ 28px avatar), and sits inside a list row (`li`, `tr`,
  `article`, floor, fact …). Such a link must satisfy all three F2 conditions, else it is an
  `inline-link` error: hit height ≥ 24px; its row ≥ 44px tall; ≥ 8px from any adjacent independent
  target (same line or stacked; boxes include the C10 padding extension). Links in a sentence that are
  not inside a row (e.g. a caption under a card) are NOT exempt and get a transparent 44×44 extension.
- **Overflow hints (F4.3).** `scrollWidth > clientWidth` also fires for transparent `::after` hit
  areas and positioned children. The check now measures the element's own text (text nodes, not
  nested controls) against its content box and classifies every hit: `hit-area` (text fits — the
  extra width is a pseudo-element / positioned child), `metrics` (text passes the box by ≤ 3px: font
  side bearings, e.g. full-width brackets), `digits` (same, numeric text), `real` (> 3px or clipped
  without an ellipsis). Only `real` is reported (warn); the classification of every case is kept in
  `results.json` (`cases[].overflowClasses`). Ellipsized elements are still checked for a `title`.
- **Palette perf (F3).** First keystroke after each open and warm keystrokes are measured separately
  over 20 opens per run (`paletteFirstP95` budget 100 ms, `paletteWarmP95` budget 50 ms); the old
  single 20-keystroke sample and the C12 pre-mount are gone.
- **Flows.** `detail-nav-phone` (F1) — see `qa/flows/detailnav.mjs`; `rapid-nav` adds 36 phone
  list ↔ detail changes and then checks that the tab bar, `data-tabbar`, `--dock-h` and the shell
  padding agree on four routes. The short viewports 390×480 / 360×420 are a *layout proxy* for an open
  soft keyboard: they prove the reply box, the header and a band of content fit at that height; they
  do not exercise `visualViewport` (no real keyboard is opened in headless Chrome).
- **Before / after (F6).** `node qa/compare.mjs capture before|after` and `node qa/compare.mjs combine`
  write `qa/screenshots/compare/`; `qa/curate.mjs` keeps that folder and links it from the gallery.

## Ruling checks (flows in `qa/flows/rulings.mjs`)

thread paging / 只看楼主 / jump-to-floor (V7), growth range switch + row alignment of the time stack
(V3), deep scroll restore in the 1,520-row list (R3), first-screen folds (V1 at 1280×800, V2 at
1440×900), `/me` ≤ 2.5 screens without a sync button (V9 / S5), list density (V11), and palette
showcase screenshots. Edge-state song pages (`EDGE.longJa/special/noConstant/noChartImage/oniOnly/
unlisted`) are matrix cases at 1440 and 390 (tag `edge`).

## Limits of the automated checks

- **Contrast** walks DOM ancestors and composites background colours. It cannot see text over
  gradients or images (reported as `contrast-unknown-bg`), absolutely positioned text over siblings,
  placeholders, SVG/canvas text, or text-shadow. Ancestor opacity is applied to the text colour only.
- **Tap targets** probe `elementFromPoint` at ±21.5 px from the centre to approximate hit-area
  extensions (`::before/::after`). It cannot tell a transparent extension from an unrelated overlay
  that happens to be a descendant; inline text links in paragraphs are exempt.
- **Occlusion** samples ≤ 60 elements, scrolled to centre; covering by the prototype control is
  reported as info. Elements inside horizontal scrollers that stay off-screen are skipped.
- **Focus visibility** compares computed outline/box-shadow/background of the element, its pseudo-
  elements and first descendants focused vs. blurred. A ring drawn by a far ancestor is missed.
- **Truncation** inspects elements with direct text; inline elements are skipped.
- **Perf** numbers come from a headless desktop machine; they show regressions, not field data.
- Not automated at all: visual quality, hierarchy, CJK glyph choice, soft keyboard (visualViewport),
  IME, real touch scrolling, screen-reader output. Review screenshots by eye.

**Results on mock data are not a production acceptance.**
