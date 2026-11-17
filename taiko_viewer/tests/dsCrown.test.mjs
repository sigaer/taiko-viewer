// P0-17 DsCrown: five states × six sizes, small-asset srcset, visible-text modes (D0-6 interface).
import test from "node:test";
import assert from "node:assert/strict";
import { attrs, loadDs, render, t, text } from "./dsHarness.mjs";

const { crownSources, DS_CROWN_PX } = await loadDs("Crown");
const STATES = ["dondaful", "full", "clear", "played", "none"];

test("crown: sizes are chip 16 / table 18 / sm 18 / md 22 / lg 30 / xl 48", () => {
  assert.deepEqual({ ...DS_CROWN_PX }, { chip: 16, table: 18, sm: 18, md: 22, lg: 30, xl: 48 });
});

test("crown: 1× / 2× small assets follow the draw size", () => {
  assert.equal(crownSources("full", "md").webp, "/icons/crown/36/full.webp 1x, /icons/crown/60/full.webp 2x");
  assert.equal(crownSources("clear", "chip").png, "/icons/crown/36/clear.png 1x, /icons/crown/36/clear.png 2x");
  assert.equal(crownSources("dondaful", "lg").png, "/icons/crown/36/dondaful.png 1x, /icons/crown/60/dondaful.png 2x");
  assert.equal(crownSources("dondaful", "xl").src, "/icons/crown/60/dondaful.png");
  assert.equal(crownSources("dondaful", "xl").webp, "/icons/crown/60/dondaful.webp 1x, /icons/crown/96/dondaful.webp 2x");
  assert.equal(crownSources("played", "md"), null);
  assert.equal(crownSources("none", "md"), null);
});

test("crown SSR: every state × size has a fixed box and one accessible name", async () => {
  for (const locale of ["zh", "ja"]) {
    for (const state of STATES) {
      for (const [size, px] of Object.entries(DS_CROWN_PX)) {
        const html = await render("Crown", { state, size }, { locale });
        const mark = attrs(html, "span")[1];
        assert.equal(mark.style, `width:${px}px;height:${px}px;`);
        assert.equal(mark.role, "img");
        assert.equal(mark["aria-label"], t(locale, `ds.crown.${state}`));
        const img = attrs(html, "img");
        if (state === "played" || state === "none") assert.equal(img.length, 0);
        else assert.deepEqual([img[0].width, img[0].height, img[0].alt], [String(px), String(px), ""]);
      }
    }
  }
  assert.equal(text(await render("Crown", { state: "none" })), "—");
});

test("crown SSR: text modes — off by default; short / full beside the asset; the mark is then hidden", async () => {
  const off = await render("Crown", { state: "full" });
  assert.doesNotMatch(off, /ds-crown__text/);
  for (const locale of ["zh", "ja"]) {
    for (const state of STATES) {
      const full = await render("Crown", { state, text: "full" }, { locale });
      assert.equal(attrs(full, "span")[1]["aria-hidden"], "true");
      assert.equal(attrs(full, "span")[1].role, undefined);
      assert.match(full, new RegExp(`ds-crown__text"[^>]*>${t(locale, `ds.crown.${state}`)}<`));

      const short = await render("Crown", { state, text: "short" }, { locale });
      const shortName = t(locale, `ds.crown.short.${state}`);
      const fullName = t(locale, `ds.crown.${state}`);
      assert.ok(shortName, `ds.crown.short.${state} exists in ${locale}`);
      assert.ok(short.includes(`>${shortName}<`));
      // read once: either the short name is the full name, or it is hidden and the full name is read instead
      if (shortName !== fullName) {
        assert.match(short, /ds-crown__text" aria-hidden="true"/);
        assert.ok(short.includes(`ds-crown__sr" data-v-ds-crown>${fullName}<`));
      }
    }
  }
});

test("crown: the asset carries no filter, blend, mask or opacity", async () => {
  const html = await render("Crown", { state: "dondaful", size: "xl" });
  assert.doesNotMatch(html, /filter|opacity|mix-blend|mask/);
});
