// Stage 5 slice F: dan courses, guides, titles, tools, /more, /about, /alias-log, the practice view, shell tabs.
// Pure helpers and source contracts; the browser checks are scripts/rework/pages-scenarios.mjs.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  DAN_YEARS,
  danCourse,
  danDifficulty,
  danRichHtml,
  danSongLocation,
  danSongTitles,
  expandGrid,
  matchCatalogSong,
  readConditions,
  readNeighbours,
  readSongTable,
  readTable
} from "../utils/rework/dan.ts";
import { legacyGradePage } from "../utils/gradeDojoLegacy.ts";
import { MORE_GROUPS, SONGS_TABS, TOOLS_TABS, activeDestination, tabCurrent } from "../utils/rework/navigation.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8").then((s) => s.replace(/\r\n/g, "\n"));
const json = async (path) => JSON.parse(await read(path));
const get = (obj, key) => key.split(".").reduce((o, k) => o?.[k], obj);
const scriptOf = (sfc) => sfc.slice(sfc.indexOf('<script setup lang="ts">') + '<script setup lang="ts">'.length, sfc.indexOf("</script>"));
/** Lines of `original` that are not in `current` (trimmed, counted), except those matching an allowed change. */
function missingLines(original, current, allowed = []) {
  const have = new Map();
  for (const line of current.split("\n").map((l) => l.trim())) have.set(line, (have.get(line) || 0) + 1);
  const missing = [];
  for (const line of original.split("\n").map((l) => l.trim()).filter(Boolean)) {
    if (have.get(line)) have.set(line, have.get(line) - 1);
    else if (!allowed.some((re) => re.test(line))) missing.push(line);
  }
  return missing;
}

test("dan: every course of the 2025 / 2026 files reads as songs + conditions; nothing is dropped", async () => {
  for (const year of ["2025", "2026"]) {
    const data = await json(`assets/data/grade_dojo_nijiiro_${year}.json`);
    assert.equal(data.grades.length, 19);
    for (const page of data.grades) {
      const course = danCourse(page);
      assert.ok(course.songs, `${year} ${page.slug}: songs`);
      assert.equal(course.songs.songs.length, 3, `${year} ${page.slug}: three songs`);
      for (const song of course.songs.songs) {
        assert.ok(song.difficulty >= 1 && song.difficulty <= 5, `${year} ${page.slug} ${song.title}: difficulty`);
        assert.ok(song.star >= 1 && song.star <= 10, `${year} ${page.slug} ${song.title}: star`);
        assert.ok(song.combo && song.bpm, `${year} ${page.slug}: combo / BPM`);
      }
      assert.ok(course.songs.totalCombo, `${year} ${page.slug}: total`);
      assert.ok(course.conditions, `${year} ${page.slug}: conditions`);
      assert.deepEqual(course.conditions.tiers.map((t) => t.kind), ["pass", "gold"], `${year} ${page.slug}: red then gold`);
      for (const tier of course.conditions.tiers) assert.equal(tier.values.length, course.conditions.columns.length);
      // every fragment of the first section is either read or kept as written
      assert.equal(course.details.length + 2, page.sections[0].blocks.length, `${year} ${page.slug}: remaining fragments kept`);
      const near = readNeighbours(page.navigationHtml);
      assert.ok(near.prevGrade || near.nextGrade, `${year} ${page.slug}: neighbours`);
    }
  }
});

test("dan: the inner-oni suffix makes difficulty 5; both languages' difficulty words", () => {
  assert.deepEqual(danDifficulty("おに★×10", "Nivalis*Anima(裏譜面)"), { difficulty: 5, star: 10 });
  assert.deepEqual(danDifficulty("鬼★×9", "GO GET'EM!（裏譜面）"), { difficulty: 5, star: 9 });
  assert.deepEqual(danDifficulty("おに★×9", "闇の魔法少女"), { difficulty: 4, star: 9 });
  assert.deepEqual(danDifficulty("难★×7"), { difficulty: 3, star: 7 });
  assert.deepEqual(danDifficulty("むずかしい★×5"), { difficulty: 3, star: 5 });
  assert.deepEqual(danDifficulty("普通★×4"), { difficulty: 2, star: 4 });
  assert.deepEqual(danDifficulty("ふつう★×3"), { difficulty: 2, star: 3 });
  assert.deepEqual(danDifficulty("?"), { difficulty: null, star: null });
});

test("dan: 2026 九段 conditions list the per-song roll counts in song order", async () => {
  const data = await json("assets/data/grade_dojo_nijiiro_2026.json");
  const nine = data.grades.find((g) => g.slug === "九段");
  const course = danCourse(nine);
  assert.deepEqual(course.songs.songs.map((s) => s.matchTitle), ["闇の魔法少女", "雲の彼方の大地の風", "タベルナ2000"]);
  assert.deepEqual(course.conditions.columns, ["条件1", "条件2", "条件3", "条件4"]);
  assert.deepEqual(course.conditions.tiers[0].values, [["魂ゲージ100%"], ["可120未満"], ["不可10未満"], ["連打数23打以上", "連打数162打以上", "連打数0打以上"]]);
  assert.deepEqual(course.conditions.tiers[1].values[3], ["連打数24打以上", "連打数191打以上", "連打数0打以上"]);
  assert.deepEqual(readNeighbours(nine.navigationHtml), {
    prevGrade: { label: "八段", to: "/grade/2026/八段" },
    nextGrade: { label: "十段", to: "/grade/2026/十段" },
    prevYear: { label: "ニジイロ2025", to: "/grade/2025/九段" },
    nextYear: null
  });
});

test("dan: 2023 / 2024 keep their content through the shared component; only the year row differs", () => {
  const a = legacyGradePage("2023");
  const b = legacyGradePage("2024");
  for (const page of [a, b]) {
    const course = danCourse(page);
    assert.deepEqual(course.songs.songs.map((s) => [s.order, s.title, s.difficulty, s.star, s.combo, s.bpm, s.href]), [
      ["1曲目", "GO GET'EM!(裏譜面)", 5, 9, "648", "146", null],
      ["2曲目", "RIDGE RACER STEPS", 4, 9, "536", "240", null],
      ["3曲目", "よーいドン！", 4, 10, "777", "6.06-194", null]
    ]);
    assert.equal(course.songs.totalCombo, "1961");
    assert.deepEqual(course.conditions.tiers.map((t) => t.kind), ["pass"]);
    assert.deepEqual(course.conditions.tiers[0].values[3], ["連打数0打", "連打数77打以上", "連打数24打以上"]);
    assert.deepEqual(page.sections.map((s) => s.title), ["详细", "攻略", "対策・合格の目安", "その他"]);
    assert.deepEqual(page.sections[1].tabs.map((t) => t.title), ["1曲目", "2曲目", "3曲目"]);
    assert.equal(readNeighbours(page.navigationHtml).prevGrade.to, null, '"#" placeholders stay text');
  }
  assert.equal(readNeighbours(a.navigationHtml).prevYear.label, "ニジイロ2022");
  assert.equal(readNeighbours(b.navigationHtml).prevYear.label, "ニジイロ2023");
  assert.deepEqual(danSongTitles(a), ["GO GET'EM!", "RIDGE RACER STEPS", "よーいドン！"]);
  assert.deepEqual({ ...a, title: "", navigationHtml: "" }, { ...b, title: "", navigationHtml: "" });
  assert.deepEqual(DAN_YEARS, ["2026", "2025", "2024", "2023"]);
});

test("dan: rowspans expand; fragments keep their text, inline colours become tone attributes", () => {
  const table = readTable('<table><tbody><tr><td rowspan="2">a</td><td>b</td></tr><tr><td>c</td></tr></tbody></table>');
  const grid = expandGrid(table.body);
  assert.equal(grid[1][0], grid[0][0]);
  assert.equal(grid[1][1].text, "c");
  const html = '<td style="background-color:#e42112; color:black; text-align:center;">x</td><td style="background-color:#f6d011">y</td><span style="color:red">z</span><td style="text-align:center;">w</td><a href="#" class="rel-wiki-page">八段</a><p style="display: none">h</p>';
  assert.equal(
    danRichHtml(html),
    '<td data-dan-tone="pass">x</td><td data-dan-tone="gold">y</td><span data-dan-tone="mark">z</span><td>w</td><span>八段</span><p hidden="">h</p>'
  );
  assert.equal(readSongTable("<ul><li>補足<table><tbody><tr><td>x</td></tr></tbody></table></li></ul>"), null, "not a song table");
  assert.equal(readConditions("<p>none</p>"), null);
});

test("dan: a song links only on an exact, unique catalogue title", () => {
  const songs = [
    { id: 1, song_name: "暗之魔法少女", song_name_jp: "闇の魔法少女" },
    { id: 2, song_name: "闇の魔法少女 (Remix)", song_name_jp: "闇の魔法少女 -Remix-" },
    { id: 3, song_name: "预备咚！", song_name_jp: "よーいドン！" },
    { id: 4, song_name: "预备咚！2", song_name_jp: "よーいドン！" }
  ];
  assert.equal(matchCatalogSong("闇の魔法少女", songs)?.id, 1);
  assert.equal(matchCatalogSong("ＧＯ", [{ id: 9, song_name: "GO" }])?.id, 9, "NFKC width");
  assert.equal(matchCatalogSong("よーいドン！", songs), null, "two songs share the title");
  assert.equal(matchCatalogSong("闇の魔法", songs), null, "no substring match");
  assert.equal(danSongLocation(904, 5), "/songs/904?difficulty=5");
});

test("shell tabs: the library and tools groups cover the slice pages; labels are the pages' titles", async () => {
  const zh = await json("locales/zh.json");
  const ja = await json("locales/ja.json");
  assert.deepEqual(SONGS_TABS.map((t) => t.to), ["/songs", "/songs/constants", "/grade", "/guide", "/titles"]);
  assert.deepEqual(SONGS_TABS.map((t) => get(zh, t.labelKey)), ["歌曲列表", "定数表", "段位", "攻略", "称号"]);
  assert.ok(tabCurrent(SONGS_TABS[2], "/grade/2026/九段") && tabCurrent(SONGS_TABS[2], "/grade/2023"));
  assert.ok(tabCurrent(SONGS_TABS[3], "/guide/4/10") && !tabCurrent(SONGS_TABS[4], "/titles/x"));
  assert.ok(!tabCurrent(SONGS_TABS[0], "/songs/1"), "song detail is not the list");
  for (const path of ["/grade/2026/九段", "/guide/1/5", "/titles"]) assert.equal(activeDestination(path), "songs");
  for (const tab of TOOLS_TABS) assert.equal(activeDestination(tab.to), "tools", tab.to);
  for (const tab of [...SONGS_TABS, ...TOOLS_TABS]) for (const m of [zh, ja]) assert.equal(typeof get(m, tab.labelKey), "string", tab.labelKey);
  // each page's <h1> uses its tab's label key
  const h1 = {
    "/grade": ["pages/grade/2023.vue", "pages/grade/2024.vue", "pages/grade/2025/[grade].vue", "pages/grade/2026/[grade].vue"],
    "/guide": ["pages/guide/index.vue"],
    "/titles": ["pages/titles.vue"],
    "/tools/rt-calculator": ["pages/tools/rt-calculator.vue"],
    "/tools/chart-config": ["pages/tools/chart-config.vue"],
    "/tools/note-count": ["pages/tools/note-count.vue"],
    "/tools/word-cloud": ["pages/tools/word-cloud.vue"],
    "/more": ["pages/more.vue"],
    "/about": ["pages/about.vue"]
  };
  for (const tab of [...SONGS_TABS, ...TOOLS_TABS]) {
    for (const file of h1[tab.to] || []) assert.match(await read(file), new RegExp(`<ReworkPageHeader :title="t\\('${tab.labelKey.replace(/\./g, "\\.")}'\\)"`), `${file}: h1 = ${tab.labelKey}`);
  }
  assert.match(await read("pages/tools/tja-constants.vue"), /<ReworkPageHeader :title="copy\.title" \/>/);
  assert.equal(get(zh, "tools.tjaConstants"), (await read("utils/tjaCalculatorCopy.ts")).match(/title: '([^']+)'/)[1], "TJA tab = page title");
});

test("/more: grouped as the shell groups them, each entry named by its destination's title", async () => {
  const zh = await json("locales/zh.json");
  assert.deepEqual(MORE_GROUPS.map((g) => g.key), ["songs", "tools", "account", "support"]);
  assert.deepEqual(MORE_GROUPS[1].items.map((i) => i.path), TOOLS_TABS.slice(1).map((t) => t.to), "tools group = the 工具 tabs");
  assert.deepEqual(MORE_GROUPS[0].items.map((i) => i.path), SONGS_TABS.slice(2).map((t) => t.to));
  const titleKeyOf = {
    "/account/sync": [/<ReworkPageHeader :title="t\('account\.sync'\)"/, "pages/account/sync.vue"],
    "/docs/score-token": [/<ReworkPageHeader :title="copy\.title">/, "pages/docs/score-token.vue"],
    "/account/developer": [/<ReworkPageHeader :title="copy\.title">/, "pages/account/developer/index.vue"],
    "/support": [/<ReworkPageHeader :title="copy\.introTitle">/, "pages/support.vue"],
    "/alias-log": [/<ReworkPageHeader :title="t\('nav\.aliasLog'\)">/, "pages/alias-log.vue"],
    "/settings": [/<ReworkPageHeader :title="t\('nav\.settings'\)" \/>/, "components/rework/account/Settings.vue"]
  };
  for (const group of MORE_GROUPS) {
    assert.equal(typeof get(zh, group.titleKey), "string");
    for (const item of group.items) {
      assert.equal(typeof get(zh, item.labelKey), "string", item.labelKey);
      if (titleKeyOf[item.path]) assert.match(await read(titleKeyOf[item.path][1]), titleKeyOf[item.path][0], item.path);
    }
  }
  const page = await read("pages/more.vue");
  assert.doesNotMatch(page, /"\/tools"/, "no link to the /tools redirect");
  assert.match(await read("pages/tools/index.vue"), /navigateTo\(localePath\("\/more"\), \{ redirectCode: 302 \}\)/, "/tools still 302 → /more");
});

test("copy moved to the locale files word for word (rt calculator, word cloud, about, alias log, practice)", async () => {
  const original = await json("tests/fixtures/slice-f-copy-original.json");
  for (const lang of ["zh", "ja"]) {
    const m = await json(`locales/${lang}.json`);
    const rt = get(m, "rework.toolPages.rt");
    for (const [k, v] of Object.entries(original.rt[lang])) {
      if (Array.isArray(v)) assert.deepEqual(v.map((_, i) => rt[k][i]), v, `rt.${k}`);
      else assert.equal(rt[k], v, `rt.${k}`);
    }
    assert.deepEqual(get(m, "rework.toolPages.wordCloud"), original.wordCloud[lang]);
    const about = get(m, "rework.aboutPage");
    for (const [k, v] of Object.entries(original.about[lang])) assert.equal(about[k], v, `about.${k}`);
    assert.deepEqual(original.about.team[lang].map((x) => x.role), ["maru", "sigaer", "sutari", "baili"].map((k) => about.roles[k]));
    const alias = get(m, "rework.aliasLogPage");
    for (const [k, v] of Object.entries(original.aliasLog[lang])) assert.equal(alias[k], v, `aliasLog.${k}`);
    assert.deepEqual(Object.fromEntries(Object.keys(original.practice[lang]).map((k) => [k, get(m, `rework.practice.${k}`)])), original.practice[lang]);
  }
  const about = await read("pages/about.vue");
  for (const name of ["马路", "sigaer", "Sparklizm/星川sutari", "Hyperionml/百里莫凌", "/avatar/maru.jpg", "/avatar/sutari.png", "Springdoc OpenAPI", "JWT (jjwt)"]) assert.ok(about.includes(name), name);
  assert.match(await read("components/rework/info/About.vue"), /href="https:\/\/www\.ourtaiko\.org\/" target="_blank" rel="noopener noreferrer">Ourtaiko</);
});

test("tools: computation and request code unchanged; only copy, meta and presentation lines changed", async () => {
  const original = await json("tests/fixtures/slice-f-scripts-original.json");
  const copyBlock = [/^(song|good|invalid|failed|loading|v2|accuracy|title|loadingBundle|bundleFailed|playerFailed|playerDownloadFailed|playerBootFailed|chartFailed|failed|retry|finished):/, /^\} : \{$/, /^\}\);$/, /^const copy = computed\(\(\) => locale\.value === ["']ja["'] \? \{$/];
  const cases = [
    ["rtCalculator", "pages/tools/rt-calculator.vue", [...copyBlock, /^definePageMeta\(\{ pageTitleKey: 'tools\.rtCalculator'/, /^const \{ locale, t \} = useI18n\(\);$/]],
    ["tjaConstants", "pages/tools/tja-constants.vue", [/^definePageMeta\(\{ pageTitleKey: 'tools\.tjaConstants'/]],
    ["chartConfig", "pages/tools/chart-config.vue", [/^errorMessage\.value = await resolveViewerError\(error, t\("errors\.queryFailed"\)\);$/]],
    ["noteCount", "pages/tools/note-count.vue", [/^errorMessage\.value = await resolveViewerError\(error, t\("errors\.queryFailed"\)\);$/, /^const submit = async \(\) => \{$/]],
    ["guideLevel", "pages/guide/[difficulty]/[level].vue", [/summaryRows|colorMap|headerCellClassName|getRowToneClass|hasTagLoadError|getTagItems/, /^const \{ data: guideContent, pending, error \} = await useGuideContent/, /^if \(row\.rowIndex === 1/, /^return colorMap|^return "";|^return `guide-tag-row|^if \(rowId < 1/, /^\};$/, /^\}$/]],
    ["practice", "pages/ourtaikoview/[id]/[difficulty].vue", [...copyBlock, /^const \{ locale, t \} = useI18n\(\);$/]]
  ];
  for (const [key, file, allowed] of cases) {
    const current = scriptOf(await read(file));
    assert.deepEqual(missingLines(original[key], current, allowed), [], `${file}: every original line kept`);
  }
  // the one bug fixed forward: the error message of both lookups (resolveViewerError gets the setup-time t)
  for (const file of ["pages/tools/chart-config.vue", "pages/tools/note-count.vue"]) assert.match(await read(file), /resolveViewerError\(error, t\("errors\.queryFailed"\), t\)/, file);
  // the chart image tool moved: script identical but for the copy table selection
  const moved = scriptOf(await read("components/rework/tools/TjaImage.vue"));
  assert.deepEqual(missingLines(original.tjaImage, moved, [/^const copy = computed\(\(\) => tjaCalculatorCopy\[locale\.value === 'ja' \? 'ja' : 'zh'\]\);$/]), []);
  assert.match(moved, /tjaCalculatorCopy\[\(locale\.value in tjaCalculatorCopy \? locale\.value : 'zh'\)/);
  // file rules: accept=".tja", one file, 1 B – 512 KB
  const tja = await read("pages/tools/tja-constants.vue");
  assert.match(tja, /if \(!candidate\.size \|\| candidate\.size > 512 \* 1024\) \{ errorCode\.value = 'file_size'; return; \}/);
  assert.match(await read("components/rework/tools/TjaConstants.vue"), /<input :ref="inputRef" hidden type="file" accept="\.tja"/);
  assert.match(await read("utils/rtCalculator.ts"), /export function calculateV2/, "computation module untouched (no diff in this slice)");
});

test("word cloud: ReworkGate; nothing imports AccountToolGate any more (the file stays for slice G)", async () => {
  const source = await read("pages/tools/word-cloud.vue");
  assert.match(source, /<ReworkGate :need="accountUser \? null : 'login'">/);
  assert.match(source, /await loadChart\("\/api\/account\/charts\/word-cloud"\)/, "same endpoint");
  const { readdir } = await import("node:fs/promises");
  const walk = async (dir) => (await readdir(new URL(`../${dir}`, import.meta.url), { withFileTypes: true })).flatMap((e) => (e.isDirectory() ? [] : [`${dir}/${e.name}`]));
  const files = [];
  for (const dir of ["pages", "pages/tools", "pages/grade", "pages/account", "components", "components/rework", "components/tools", "layouts"]) files.push(...(await walk(dir)));
  for (const file of files.filter((f) => f.endsWith(".vue") && !f.endsWith("AccountToolGate.vue"))) assert.doesNotMatch(await read(file), /<AccountToolGate|import AccountToolGate/, file);
  await read("components/tools/AccountToolGate.vue");
});

test("slice pages: own <h1>, the Element Plus mapping (except /about, kept as the unmapped reference page)", async () => {
  const pages = [
    "pages/grade/2023.vue", "pages/grade/2024.vue", "pages/grade/2025/[grade].vue", "pages/grade/2026/[grade].vue",
    "pages/guide/index.vue", "pages/guide/[difficulty]/[level].vue", "pages/titles.vue",
    "pages/tools/chart-config.vue", "pages/tools/note-count.vue", "pages/tools/rt-calculator.vue", "pages/tools/tja-constants.vue", "pages/tools/word-cloud.vue",
    "pages/more.vue", "pages/alias-log.vue", "pages/ourtaikoview/[id]/[difficulty].vue"
  ];
  for (const page of pages) {
    const source = await read(page);
    assert.match(source, /hidePageHeader: true/, page);
    assert.match(source, /reworkElementPlus: true/, page);
    // copy tables come from the locale files (the calculator still picks the song title's language: data, not copy)
    assert.doesNotMatch(source, /const copy = computed\(\(\) =>\s*locale\.value === ["']ja["']/, page + ": no inline bilingual copy");
    assert.doesNotMatch(source, /locale\.value === "ja"\s*\?\s*"[^"]*[぀-ヿ一-鿿]/u, page + ": no inline bilingual strings");
  }
  const about = await read("pages/about.vue");
  assert.match(about, /hidePageHeader: true/);
  assert.doesNotMatch(about, /reworkElementPlus/);
  assert.doesNotMatch(await read("pages/ourtaikoview/[id]/[difficulty].vue"), /<main\b/, "no nested <main>");
  assert.match(await read("pages/more.vue"), /v\{\{ appVersion \}\}/);
});
