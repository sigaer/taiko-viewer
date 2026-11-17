// P0-23 DsDiffTabs: tablist, aria-selected, roving tabindex, keyboard, short names; P0-24 DsSongCell.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { attrs, loadDs, render, t } from "./dsHarness.mjs";

const { diffTabItems, nextTabIndex } = await loadDs("DiffTabs");
const { textLang } = await loadDs("SongCell");
const FIVE = [1, 2, 3, 4, 5].map((d) => ({ difficulty: d, star: d + 4, constant: d > 2 ? d * 2 + 0.5 : null }));

test("diff tabs: items keep the given order, drop invalid and duplicate difficulties", () => {
  const items = diffTabItems([{ difficulty: "4", star: "10" }, { difficulty: 9 }, { difficulty: 4 }, { difficulty: 3, constant: 6.85 }]);
  assert.deepEqual(items.map((i) => [i.difficulty, i.star, i.constant, i.icon]), [
    [4, 10, null, "/icons/diff/4.png"],
    [3, null, "6.85", "/icons/diff/3.png"]
  ]);
  assert.deepEqual(diffTabItems(null), []);
});

test("diff tabs: keyboard moves wrap; Home / End; other keys do nothing", () => {
  assert.equal(nextTabIndex("ArrowRight", 3, 4), 0);
  assert.equal(nextTabIndex("ArrowLeft", 0, 4), 3);
  assert.equal(nextTabIndex("Home", 2, 5), 0);
  assert.equal(nextTabIndex("End", 0, 5), 4);
  assert.equal(nextTabIndex("Enter", 1, 5), -1);
  assert.equal(nextTabIndex("ArrowRight", 0, 0), -1);
});

test("diff tabs SSR: one tablist, one selected tab in the tab order, names for screen readers", async () => {
  for (const locale of ["zh", "ja"]) {
    const html = await render("DiffTabs", { charts: FIVE, modelValue: 5 }, { locale });
    const [list] = attrs(html, "div").filter((a) => a.role === "tablist");
    assert.equal(list["aria-label"], t(locale, "ds.diff.tabs"));
    const tabs = attrs(html, "button");
    assert.equal(tabs.length, 5);
    assert.deepEqual(tabs.map((b) => b["aria-selected"]), ["false", "false", "false", "false", "true"]);
    assert.deepEqual(tabs.map((b) => b.tabindex), ["-1", "-1", "-1", "-1", "0"]);
    assert.ok(tabs.every((b) => b.role === "tab" && b.type === "button"));
    for (let d = 1; d <= 5; d++) {
      assert.ok(html.includes(`>${t(locale, `ds.diff.short.${d}`)}<`), `short name ${d}`);
      assert.ok(html.includes(`ds-difftab__sr" data-v-ds-difftabs>${t(locale, `difficulty.${d}`)} `), `full name ${d}`);
    }
  }
  const none = attrs(await render("DiffTabs", { charts: FIVE.slice(0, 4), modelValue: null }), "button");
  assert.deepEqual(none.map((b) => b.tabindex), ["0", "-1", "-1", "-1"], "without a selection the first tab is focusable");
});

test("diff tabs: emits the difficulty only; no router or URL access", () => {
  const source = readFileSync(new URL("../components/ds/DiffTabs.vue", import.meta.url), "utf8");
  assert.doesNotMatch(source, /useRoute|useRouter|navigateTo|location\.|history\.|searchParams|\$route/);
  assert.match(source, /"update:modelValue"/);
});

test("song cell: lang only when the title's language differs from the page", async () => {
  assert.equal(textLang("ja", "zh"), "ja");
  assert.equal(textLang("ja", "ja"), undefined);
  assert.equal(textLang("zh-CN", "zh"), undefined);
  assert.equal(textLang("zh-CN", "ja"), "zh-CN");
  assert.equal(textLang(undefined, "zh"), undefined);
  const components = { DsCover: "Cover", DsDiff: "Diff" };
  const zh = await render("SongCell", { songId: 851, title: "a", titleLang: "ja", subtitle: "b", subtitleLang: "zh-CN", difficulty: 4, star: 10 }, { locale: "zh", components });
  assert.match(zh, /ds-songcell__title" lang="ja" title="a"/);
  assert.match(zh, /ds-songcell__sub" title="b"/);
  assert.match(zh, /ds-diff ds-diff--md/);
  assert.match(zh, /ds-cover ds-cover--md/);
  const same = await render("SongCell", { songId: 410, title: "c", subtitle: "c" }, { locale: "ja", components });
  assert.doesNotMatch(same, /ds-songcell__sub/, "the same name in both languages is shown once");
  assert.doesNotMatch(same, /ds-diff/);
});
