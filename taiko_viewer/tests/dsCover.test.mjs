// P0-16 DsCover: same-song chain thumbnail → original (?v= cache bypass) → placeholder; no other song's cover.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { attrs, loadDs, render, t } from "./dsHarness.mjs";

const { coverSources, coverRetryToken, isCoverSongId, DS_COVER_PX } = await loadDs("Cover");

test("cover: stage 0 is the same song's thumbnail srcset with sizes = display width", () => {
  const s = coverSources(851, 0, 44);
  assert.equal(s.src, "https://static.sakura-bot.cn/cover/thumb/200/851.webp?v=0841");
  assert.equal(s.srcset, "https://static.sakura-bot.cn/cover/thumb/200/851.webp?v=0841 200w, https://static.sakura-bot.cn/cover/thumb/400/851.webp?v=0841 400w");
  assert.equal(s.sizes, "44px");
  assert.equal(coverSources(851, 0, 167.6).sizes, "168px");
});

test("cover: stage 1 is the same song's original PNG with the cache-bypass token; stage 2 has no image", () => {
  assert.deepEqual(coverSources(851, 1, 44, "123"), { src: "https://static.sakura-bot.cn/cover/851.png?v=123" });
  assert.deepEqual(coverSources(851, 1, 44), { src: "https://static.sakura-bot.cn/cover/851.png" });
  assert.equal(coverSources(851, 2, 44), null);
  assert.equal(coverRetryToken(300000 * 7 + 5), "7");
});

test("cover: no stage ever points at another song (no fallbackSongId)", () => {
  for (const id of [1, 851, 1255, 1384]) {
    for (const stage of [0, 1]) {
      const s = coverSources(id, stage, 96, "9");
      for (const url of [s.src, ...(s.srcset ?? "").split(",").filter(Boolean)]) assert.match(url, new RegExp(`/${id}\\.(webp|png)`));
    }
  }
  const source = readFileSync(new URL("../components/ds/Cover.vue", import.meta.url), "utf8");
  assert.doesNotMatch(source.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, ""), /fallbackSongId|1384/);
});

test("cover: invalid ids render the placeholder without any request", () => {
  for (const id of [null, undefined, 0, -3, 1.5, Number.NaN]) {
    assert.equal(isCoverSongId(id), false);
    assert.equal(coverSources(id, 0, 44), null);
  }
});

test("cover SSR: no image URL before mount; fixed box per size; placeholder name from locales", async () => {
  for (const size of Object.keys(DS_COVER_PX)) {
    const html = await render("Cover", { songId: 851, size });
    assert.equal(attrs(html, "img").length, 0, "image URLs are set only after mount");
    assert.match(html, new RegExp(`ds-cover--${size}`));
    assert.match(html, /aria-hidden="true"/);
  }
  for (const locale of ["zh", "ja"]) {
    const html = await render("Cover", { songId: null }, { locale });
    const [root] = attrs(html, "span");
    assert.equal(root.role, "img");
    assert.equal(root["aria-label"], t(locale, "ds.cover.missing"));
  }
  const labelled = attrs(await render("Cover", { songId: 851, label: "x" }), "span")[0];
  assert.equal(labelled.role, "img");
  assert.equal(labelled["aria-label"], "x");
});
