// P0-06, P0-13, P0-14, D0-7: design-system utilities.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DS_BREAKPOINTS, DS_LAYOUT, DS_MEDIA, dsViewportRange } from "../utils/ds/breakpoints.ts";
import { DS_CROWN_STATES, crownAssetName, crownFromCounts, crownLabelKey, isDsCrownState } from "../utils/ds/crown.ts";
import {
  DS_CUSTOM_PLATES,
  DS_PLATE_IDS,
  DS_SMALL_SIZES,
  crownIconSrc,
  customTitlePlate,
  customTitlePlateForStyle,
  diffIconSrc,
  isUraDifficulty,
  normalizeRankValue,
  rankAssetName,
  rankName,
  smallSrc,
  titlePlateAsset,
  titlePlateForUsage
} from "../utils/ds/gameAssets.ts";
import { DS_DEFAULT_AVATAR_SRC, SERVER_DEFAULT_AVATAR_URL, hasUserAvatar, isServerDefaultAvatar, resolveAvatarSrc } from "../utils/ds/avatar.ts";
import { SCORE_RANK_DEFINITIONS } from "../utils/scoreRank.ts";
import { computed as cssComputed } from "../scripts/ds/lib/css-tokens.mjs";

const root = new URL("../", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), "utf8");

/* ---------------- P0-06 breakpoints and bottom space ---------------- */

test("breakpoints are 767 / 1099 / 1239 and ranges split on them", () => {
  assert.deepEqual({ ...DS_BREAKPOINTS }, { mobile: 767, tablet: 1099, desktop: 1239 });
  assert.equal(dsViewportRange(360), "mobile");
  assert.equal(dsViewportRange(767), "mobile");
  assert.equal(dsViewportRange(768), "tablet");
  assert.equal(dsViewportRange(1099), "tablet");
  assert.equal(dsViewportRange(1100), "desktop");
  assert.equal(dsViewportRange(1239), "desktop");
  assert.equal(dsViewportRange(1240), "wide");
  assert.equal(dsViewportRange(Number.NaN), "mobile");
  assert.equal(DS_MEDIA.mobile, "(max-width: 767px)");
  assert.equal(DS_MEDIA.wide, "(min-width: 1240px)");
});

test("layout constants match assets/css/ds/tokens.css", () => {
  const files = [{ name: "tokens", css: read("assets/css/ds/tokens.css") }];
  const desktop = cssComputed(files, { classes: ["ds-preview"], attrs: { "data-theme": "light" }, lang: "zh" }).root;
  const phone = cssComputed(files, { classes: ["ds-preview"], attrs: { "data-theme": "light" }, lang: "zh", media: (q: string) => /max-width:\s*767px/.test(q) }).root;
  assert.equal(desktop["--tab-h"], `${DS_LAYOUT.tabBarHeight}px`);
  assert.equal(desktop["--bar-h"], `${DS_LAYOUT.barHeight}px`);
  assert.equal(desktop["--bar-h-m"], `${DS_LAYOUT.barHeightMobile}px`);
  assert.equal(desktop["--subtab-h-m"], `${DS_LAYOUT.subtabHeightMobile}px`);
  assert.equal(desktop["--rail-w"], `${DS_LAYOUT.railWidth}px`);
  assert.equal(desktop["--content-max"], `${DS_LAYOUT.contentMax}px`);
  assert.equal(desktop["--gutter"], `${DS_LAYOUT.gutter}px`);
  assert.equal(phone["--gutter"], `${DS_LAYOUT.gutterMobile}px`);
  assert.equal(desktop["--hit"], `${DS_LAYOUT.hit}px`);
  assert.equal(desktop["--shell-bottom"], "env(safe-area-inset-bottom, 0px)");
  assert.equal(desktop["--dock-h"], "0px");
  assert.equal(desktop["--kb-h"], "0px");
});

/* ---------------- P0-13 crown conversion ---------------- */

test("crown: priority all-perfect > full combo > clear > played; no record → none", () => {
  assert.equal(crownFromCounts({ dondafulComboCnt: 1, fullComboCnt: 3, clearCnt: 9 }), "dondaful");
  assert.equal(crownFromCounts({ dondafulComboCnt: 0, fullComboCnt: 2, clearCnt: 5 }), "full");
  assert.equal(crownFromCounts({ clearCnt: 1 }), "clear");
  assert.equal(crownFromCounts({ clearCnt: 0, fullComboCnt: 0, dondafulComboCnt: 0 }), "played");
  assert.equal(crownFromCounts({}), "played");
  assert.equal(crownFromCounts(null), "none");
  assert.equal(crownFromCounts(undefined), "none");
});

test("crown: every combination of the three counts (0 / >0) and string / invalid counts", () => {
  for (const d of [0, 1]) for (const f of [0, 1]) for (const c of [0, 1]) {
    const expected = d ? "dondaful" : f ? "full" : c ? "clear" : "played";
    assert.equal(crownFromCounts({ dondafulComboCnt: d, fullComboCnt: f, clearCnt: c }), expected, `${d}${f}${c}`);
    assert.equal(crownFromCounts({ dondafulComboCnt: String(d), fullComboCnt: String(f * 7), clearCnt: String(c * 2) }), expected);
  }
  assert.equal(crownFromCounts({ dondafulComboCnt: -1, fullComboCnt: "x", clearCnt: null }), "played");
  assert.equal(crownFromCounts({ dondafulComboCnt: Number.NaN, fullComboCnt: Infinity }), "played");
});

test("crown: same order as AccountSongScores.vue crownLabel for records that exist", () => {
  const source = read("components/account/AccountSongScores.vue");
  const body = source.slice(source.indexOf("const crownLabel"), source.indexOf("};", source.indexOf("const crownLabel")));
  const order = [...body.matchAll(/item\.(\w+) > 0\) return copy\.value\.(\w+)/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(order, [
    ["dondafulComboCnt", "dondaful"],
    ["fullComboCnt", "fullCombo"],
    ["clearCnt", "clear"]
  ]);
  assert.match(body, /return copy\.value\.played;/);
  // Replay the existing function's decision on every combination and compare.
  const legacy = (item: { dondafulComboCnt: number; fullComboCnt: number; clearCnt: number }) =>
    item.dondafulComboCnt > 0 ? "dondaful" : item.fullComboCnt > 0 ? "full" : item.clearCnt > 0 ? "clear" : "played";
  for (const d of [0, 2]) for (const f of [0, 3]) for (const c of [0, 4]) {
    const item = { dondafulComboCnt: d, fullComboCnt: f, clearCnt: c };
    assert.equal(crownFromCounts(item), legacy(item));
  }
});

test("crown: state → asset name and locale key", () => {
  assert.equal(crownAssetName("dondaful"), "dondaful");
  assert.equal(crownAssetName("full"), "full");
  assert.equal(crownAssetName("clear"), "clear");
  assert.equal(crownAssetName("played"), null);
  assert.equal(crownAssetName("none"), null);
  const zh = JSON.parse(read("locales/zh.json"));
  const ja = JSON.parse(read("locales/ja.json"));
  for (const state of DS_CROWN_STATES) {
    const key = crownLabelKey(state);
    const get = (obj: any) => key.split(".").reduce((o, k) => o?.[k], obj);
    assert.equal(typeof get(zh), "string", key);
    assert.equal(typeof get(ja), "string", key);
  }
  assert.ok(isDsCrownState("full"));
  assert.ok(!isDsCrownState("fc"));
});

/* ---------------- P0-14 asset selection ---------------- */

test("difficulty 1–5 → /icons/diff/{n}.png; strings accepted; others null; never the legacy path", () => {
  for (let d = 1; d <= 5; d++) {
    assert.equal(diffIconSrc(d), `/icons/diff/${d}.png`);
    assert.equal(diffIconSrc(String(d)), `/icons/diff/${d}.png`);
  }
  for (const bad of [0, 6, -1, 1.5, "", " ", "oni", null, undefined, true, {}]) assert.equal(diffIconSrc(bad), null, String(bad));
  assert.ok(isUraDifficulty(5) && isUraDifficulty("5") && !isUraDifficulty(4));
  assert.doesNotMatch(read("utils/ds/gameAssets.ts").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, ""), /icons\/difficulty/);
});

test("rank: 2–8 have images, 0 / 1 do not; names come from utils/scoreRank.ts", () => {
  assert.equal(rankAssetName(0), null);
  assert.equal(rankAssetName(1), null);
  for (let r = 2; r <= 8; r++) {
    assert.equal(rankAssetName(r), String(r));
    assert.equal(rankAssetName(String(r)), String(r));
  }
  for (const bad of [9, -1, 2.5, "", null, undefined, false, "x"]) {
    assert.equal(rankAssetName(bad), null, String(bad));
    assert.equal(normalizeRankValue(bad), null, String(bad));
  }
  for (const def of SCORE_RANK_DEFINITIONS) {
    assert.equal(rankName(def.value, "zh"), def.zhName);
    assert.equal(rankName(def.value, "ja-JP"), def.jaName);
  }
  assert.equal(rankName(42, "zh"), null);
});

test("crown icons", () => {
  assert.equal(crownIconSrc("dondaful"), "/icons/crown/dondaful.png");
  assert.equal(crownIconSrc("played"), null);
  assert.equal(crownIconSrc("none"), null);
});

test("smallSrc picks the smallest size ≥ draw for 1× and ≥ 2×draw for 2× (04 §7.2)", () => {
  assert.deepEqual(DS_SMALL_SIZES, { rank: [56, 80], crown: [36, 60, 96] });
  assert.deepEqual(smallSrc("rank", "5", 28), {
    webp: "/icons/rank/56/5.webp 1x, /icons/rank/56/5.webp 2x",
    png: "/icons/rank/56/5.png 1x, /icons/rank/56/5.png 2x",
    src: "/icons/rank/56/5.png"
  });
  assert.equal(smallSrc("rank", "5", 40).webp, "/icons/rank/56/5.webp 1x, /icons/rank/80/5.webp 2x");
  assert.equal(smallSrc("rank", "5", 24).png, "/icons/rank/56/5.png 1x, /icons/rank/56/5.png 2x");
  assert.equal(smallSrc("crown", "full", 18).webp, "/icons/crown/36/full.webp 1x, /icons/crown/36/full.webp 2x");
  assert.equal(smallSrc("crown", "full", 30).webp, "/icons/crown/36/full.webp 1x, /icons/crown/60/full.webp 2x");
  assert.equal(smallSrc("crown", "full", 48).webp, "/icons/crown/60/full.webp 1x, /icons/crown/96/full.webp 2x");
  assert.equal(smallSrc("crown", "full", 16).src, "/icons/crown/36/full.png");
  assert.equal(smallSrc("crown", "full", 120).src, "/icons/crown/96/full.png");
});

test("title plates: manifest ids and custom plates map to files; anything else → null (D13)", () => {
  const manifest = JSON.parse(read("public/assets/my-don/title-plate-slices/manifest.json"));
  assert.deepEqual([...DS_PLATE_IDS].sort((a, b) => a - b), manifest.items.map((i: any) => i.plateId).sort((a: number, b: number) => a - b));
  for (const item of manifest.items) {
    const asset = titlePlateAsset(item.plateId);
    assert.ok(asset);
    assert.equal(asset.src, item.outputFile);
    assert.equal(asset.width, item.width);
    assert.equal(asset.height, item.height);
    assert.deepEqual(titlePlateForUsage(item.usage.requirementType, item.usage.difficultyScope), asset);
    assert.deepEqual(titlePlateAsset(String(item.plateId)), asset);
  }
  for (const bad of [3, 40, 62, -1, "custom", null, undefined, 1.5]) assert.equal(titlePlateAsset(bad), null, String(bad));
  assert.equal(titlePlateForUsage("full_combo", "easy"), null);
  assert.deepEqual(DS_CUSTOM_PLATES, ["custom_sliver", "custom_gold", "custom_rainbow"]);
  assert.equal(customTitlePlate("clear")?.src, "/assets/my-don/custom-title/name_plate_custom_sliver.png");
  assert.equal(customTitlePlate("full_combo")?.src, "/assets/my-don/custom-title/name_plate_custom_gold.png");
  assert.equal(customTitlePlate("all_perfect")?.src, "/assets/my-don/custom-title/name_plate_custom_rainbow.png");
  assert.equal(customTitlePlateForStyle("silver")?.key, "custom_sliver");
  assert.equal(customTitlePlateForStyle("bronze"), null);
  assert.equal(titlePlateAsset("custom_gold")?.height, 90);
});

/* ---------------- D0-7 avatar ---------------- */

test("server default avatar constant equals the server's DEFAULT_AVATAR", () => {
  for (const file of ["server/internal/account/shared.ts", "server/internal/forum/shared.ts"]) {
    const m = read(file).match(/DEFAULT_AVATAR = "([^"]+)"/);
    assert.equal(m?.[1], SERVER_DEFAULT_AVATAR_URL, file);
  }
});

test("server default avatar counts as no avatar; real avatars pass through", () => {
  assert.equal(DS_DEFAULT_AVATAR_SRC, "/default-avatar.svg");
  for (const url of [SERVER_DEFAULT_AVATAR_URL, " https://viewer.sakura-bot.cn/miku.png ", "http://VIEWER.sakura-bot.cn/miku.png", "https://forum.sakura-bot.cn/miku.png"]) {
    assert.ok(isServerDefaultAvatar(url), url);
    assert.ok(!hasUserAvatar(url), url);
    assert.equal(resolveAvatarSrc(url), DS_DEFAULT_AVATAR_SRC);
  }
  for (const empty of ["", "  ", null, undefined, 3]) assert.equal(resolveAvatarSrc(empty), DS_DEFAULT_AVATAR_SRC);
  for (const url of ["https://viewer.sakura-bot.cn/miku.png?v=2", "https://viewer.sakura-bot.cn/avatars/miku.png", "https://example.com/miku.png", "/miku.png", "https://oss.example.com/avatar/u1.webp"]) {
    assert.ok(!isServerDefaultAvatar(url), url);
  }
  assert.equal(resolveAvatarSrc("https://oss.example.com/avatar/u1.webp"), "https://oss.example.com/avatar/u1.webp");
});
