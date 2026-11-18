// P0-18 DsRank: 2–8 asset, 0 / 1 "—", names from utils/scoreRank.ts, variants and upgrade.
import test from "node:test";
import assert from "node:assert/strict";
import { attrs, loadDs, render, t, text } from "./dsHarness.mjs";
import { SCORE_RANK_DEFINITIONS } from "../utils/scoreRank.ts";

const { rankBox, rankMark, rankLabel } = await loadDs("Rank");
const nameOf = (value, locale) => {
  const def = SCORE_RANK_DEFINITIONS.find((d) => d.value === value);
  return locale === "ja" ? def.jaName : def.zhName;
};

test("rank: slot / draw sizes per variant; under 24 shows the name", () => {
  assert.deepEqual(rankBox("default"), { slot: 24, draw: 28 });
  assert.deepEqual(rankBox("table"), { slot: 24, draw: 28 });
  assert.deepEqual(rankBox("detail"), { slot: 36, draw: 40 });
  assert.deepEqual(rankBox("compact"), { slot: 20, draw: 24 });
  assert.deepEqual(rankBox("default", 30), { slot: 30, draw: 35 });
  assert.equal(rankMark(5, "default", 20).textOnly, true);
  assert.equal(rankMark(5, "default", 20).sources, null);
  assert.equal(rankMark(5, "compact").textOnly, false);
});

test("rank: 1× / 2× small assets; 0 and 1 never load an image", () => {
  assert.equal(rankMark(8, "default").sources.png, "/icons/rank/56/8.png 1x, /icons/rank/56/8.png 2x");
  assert.equal(rankMark(8, "detail").sources.webp, "/icons/rank/56/8.webp 1x, /icons/rank/80/8.webp 2x");
  assert.equal(rankMark(2, "compact").sources.src, "/icons/rank/56/2.png");
  assert.equal(rankMark(0, "default").sources, null);
  assert.equal(rankMark(1, "detail").sources, null);
  assert.equal(rankMark("1", "table").sources, null);
});

test("rank: names come from scoreRank.ts in both languages", () => {
  for (const def of SCORE_RANK_DEFINITIONS) {
    assert.equal(rankLabel(def.value, "zh"), def.zhName);
    assert.equal(rankLabel(String(def.value), "ja"), def.jaName);
  }
  assert.equal(rankLabel(9, "zh"), "未知");
  assert.equal(rankLabel("x", "ja"), "不明");
  assert.equal(rankLabel(null, "ja"), "未設定", "no value reads as not set");
});

test("rank SSR: default / detail — image or —, one accessible name each", async () => {
  for (const locale of ["zh", "ja"]) {
    for (let value = 0; value <= 8; value++) {
      for (const variant of ["default", "detail"]) {
        const html = await render("Rank", { value, variant }, { locale });
        const mark = attrs(html, "span")[1];
        assert.equal(mark.role, "img");
        assert.equal(mark["aria-label"], nameOf(value, locale));
        if (value < 2) {
          assert.equal(attrs(html, "img").length, 0);
          assert.equal(text(html), "—");
        } else {
          assert.equal(attrs(html, "img")[0].src, `/icons/rank/56/${value}.png`);
        }
      }
    }
  }
});

test("rank SSR: compact and table show the name as text and hide the image from screen readers", async () => {
  for (const locale of ["zh", "ja"]) {
    for (const variant of ["compact", "table"]) {
      for (let value = 2; value <= 8; value++) {
        const html = await render("Rank", { value, variant }, { locale });
        assert.equal(attrs(html, "span")[1]["aria-hidden"], "true");
        assert.match(html, new RegExp(`ds-rank__name"[^>]*>${nameOf(value, locale)}<`));
      }
      const none = await render("Rank", { value: 0, variant }, { locale });
      assert.equal(attrs(none, "span")[1]["aria-label"], nameOf(0, locale));
      assert.equal(text(none), "—");
    }
  }
});

test("rank SSR: named default / detail show the name beside the image, read once", async () => {
  for (const locale of ["zh", "ja"]) {
    for (const variant of ["default", "detail"]) {
      for (let value = 2; value <= 8; value++) {
        const html = await render("Rank", { value, variant, named: true }, { locale });
        assert.equal(attrs(html, "span")[1]["aria-hidden"], "true");
        assert.equal(attrs(html, "span")[1].role, undefined);
        assert.match(html, new RegExp(`ds-rank__name"[^>]*>${nameOf(value, locale)}<`));
      }
      const none = await render("Rank", { value: 1, variant, named: true }, { locale });
      assert.equal(attrs(none, "span")[1]["aria-label"], nameOf(1, locale), "no image: the name stays the accessible name");
      assert.equal(text(none), "—");
    }
  }
});

test("rank SSR: upgrade reads 'previous → new' once, previous 24 / new 30", async () => {
  for (const locale of ["zh", "ja"]) {
    const html = await render("Rank", { value: 7, previous: 3, variant: "upgrade" }, { locale });
    const root = attrs(html, "span")[0];
    assert.equal(root.role, "img");
    const expected = t(locale, "ds.rank.upgrade").replace("{from}", nameOf(3, locale)).replace("{to}", nameOf(7, locale));
    assert.equal(root["aria-label"], expected);
    const marks = attrs(html, "span").filter((a) => a.class?.includes("ds-rank__mark"));
    assert.equal(marks[0].style, "width:24px;height:24px;--ds-rank-draw:28px;");
    assert.equal(marks[1].style, "width:30px;height:30px;--ds-rank-draw:35px;");
  }
});
