// P0-19 DsDiff: icon in a square box, ★star, constant or "—", ura mark, full accessible name.
import test from "node:test";
import assert from "node:assert/strict";
import { attrs, loadDs, render, t } from "./dsHarness.mjs";

const { diffStar, diffConstant, DS_DIFF_ICON_PX } = await loadDs("Diff");

test("diff: star reuses utils/difficulty.ts normalisation; constant has two decimals", () => {
  assert.equal(diffStar(4, 10), 10);
  assert.equal(diffStar(4, "9"), 9);
  assert.equal(diffStar(4, "8.7"), 8);
  assert.equal(diffStar(4, null), null);
  assert.equal(diffStar(4, ""), null);
  assert.equal(diffStar(4, 0), null);
  assert.equal(diffConstant(10.42), "10.42");
  assert.equal(diffConstant("8.1"), "8.10");
  assert.equal(diffConstant(null), null);
  assert.equal(diffConstant(""), null);
  assert.equal(diffConstant("x"), null);
});

test("diff SSR: 5 difficulties × 2 sizes × with / without constant", async () => {
  for (const locale of ["zh", "ja"]) {
    for (let d = 1; d <= 5; d++) {
      for (const [size, px] of Object.entries(DS_DIFF_ICON_PX)) {
        const name = t(locale, `difficulty.${d}`);
        const html = await render("Diff", { difficulty: d, star: 8, constant: 9.5, size }, { locale });
        const root = attrs(html, "span")[0];
        assert.equal(root.role, "img");
        assert.equal(
          root["aria-label"],
          `${name} ${t(locale, "ds.diff.star").replace("{n}", "8")} ${t(locale, "ds.diff.constant").replace("{value}", "9.50")}`
        );
        const [img] = attrs(html, "img");
        assert.deepEqual([img.src, img.width, img.height], [`/icons/diff/${d}.png`, String(px), String(px)]);
        assert.equal(html.includes(`ds-diff__ura" data-v-ds-diff>${t(locale, "ds.diff.ura")}<`), d === 5);
        assert.doesNotMatch(html, /icons\/difficulty\//);

        const missing = await render("Diff", { difficulty: String(d), star: null, size }, { locale });
        assert.equal(attrs(missing, "span")[0]["aria-label"], `${name} ${t(locale, "ds.diff.noConstant")}`);
        assert.match(missing, /ds-diff__constant is-missing"[^>]*>—</);
        assert.doesNotMatch(missing, /★/);
      }
    }
  }
});

test("diff SSR: an invalid difficulty renders nothing", async () => {
  for (const difficulty of [0, 6, "x", ""]) assert.equal(await render("Diff", { difficulty }), "<!---->");
});
