// P0-21 DsTitlePlate and P0-22 DsSiteTitle.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { attrs, loadDs, render, t, text } from "./dsHarness.mjs";
import { DS_PLATE_IDS, titlePlateAsset } from "../utils/ds/gameAssets.ts";

const { fitPlateText, plateTextScale, plateBand, plateLayout, resolveTitlePlate, DS_PLATE_WIDTH } = await loadDs("TitlePlate");

test("title plate: long text keeps the plate at 10px with bounded horizontal compression", () => {
  assert.equal(fitPlateText(() => true), 12);
  assert.equal(fitPlateText((px) => px <= 10), 10);
  assert.equal(fitPlateText(() => false), 10);
  assert.equal(plateTextScale(100, 156), 1);
  assert.equal(plateTextScale(200, 156), 0.78);
  assert.equal(plateTextScale(1000, 156), 0.156);
  for (const width of [0, -1, NaN, Infinity]) assert.equal(plateTextScale(width, 156), 1);
  assert.equal(plateTextScale(100, 0), 1);
});

test("title plate: explicit mapping only (plate id, custom key, My-Don style); nothing guessed", () => {
  for (const id of DS_PLATE_IDS) assert.equal(resolveTitlePlate(id, null).key, id);
  assert.equal(resolveTitlePlate("60", null).key, 60);
  assert.equal(resolveTitlePlate(null, "gold").key, "custom_gold");
  assert.equal(resolveTitlePlate(null, "silver").src, "/assets/my-don/custom-title/name_plate_custom_sliver.png");
  for (const plate of [null, 40, 62, 999, "rare", "custom_bronze"]) assert.equal(resolveTitlePlate(plate, null), null);
  assert.equal(resolveTitlePlate(null, "rare"), null);
  const source = readFileSync(new URL("../components/ds/TitlePlate.vue", import.meta.url), "utf8");
  assert.doesNotMatch(source.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, ""), /rare/i);
});

test("title plate: 220px wide at the plate's own ratio; the text band stays clear of the character art", () => {
  const slim = plateLayout(titlePlateAsset(0));
  assert.deepEqual([slim.width, Math.round(slim.height)], [DS_PLATE_WIDTH, 18]);
  assert.ok(Math.abs(slim.width / slim.height - 556 / 45) < 1e-9, "the ratio is exact");
  const tall = plateLayout(titlePlateAsset(42));
  assert.deepEqual([tall.width, Math.round(tall.height)], [220, 28]);
  const art = plateLayout(titlePlateAsset(60));
  assert.ok(art.text.right > tall.text.right, "59 / 60 / 61 leave room for the art on the right");
  const custom = plateLayout(titlePlateAsset("custom_rainbow"));
  assert.equal(Math.round(custom.height), 36);
  assert.deepEqual(plateBand(titlePlateAsset("custom_gold")), { top: 44, bottom: 86, art: null });
  for (const id of DS_PLATE_IDS) {
    const band = plateBand(titlePlateAsset(id));
    assert.ok(band.bottom <= titlePlateAsset(id).height && band.top >= 0);
    const layout = plateLayout(titlePlateAsset(id));
    assert.ok(layout.text.left + layout.text.right < layout.width);
    assert.ok(Math.abs(layout.width / layout.height - titlePlateAsset(id).width / titlePlateAsset(id).height) < 1e-9);
  }
});

test("title plate SSR: plate form, text form, no plate, no title", async () => {
  const plate = await render("TitlePlate", { name: "name", plate: 42, lang: "ja" });
  const [img] = attrs(plate, "img");
  assert.deepEqual([img.src, img.width, img.height, img.alt], ["/assets/my-don/title-plate-slices/name_plate_42_slice.png", "220", "28", ""]);
  assert.match(plate, /title="name"/);
  assert.match(plate, /ds-title__on-plate" lang="ja"/);

  const textForm = await render("TitlePlate", { name: "name", plate: 42, form: "text" });
  assert.equal(attrs(textForm, "img").length, 0);
  assert.match(textForm, /class="ds-title__text"/);

  const noPlate = await render("TitlePlate", { name: "name", plate: 999 });
  assert.equal(attrs(noPlate, "img").length, 0);
  assert.match(noPlate, /is-strong ds-title__text/);

  for (const name of [null, "", "  "]) assert.equal(await render("TitlePlate", { name, plate: 2 }), "<!---->");
});

test("site title SSR: a neutral tag with the name; nothing without a name", async () => {
  for (const locale of ["zh", "ja"]) {
    const html = await render("SiteTitle", { name: "n" }, { locale });
    assert.equal(text(html), "n");
    assert.equal(attrs(html, "span")[0].title, t(locale, "ds.siteTitle.kind"));
  }
  assert.equal(await render("SiteTitle", { name: null }), "<!---->");
});
