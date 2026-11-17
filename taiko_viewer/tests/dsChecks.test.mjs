// P0-03/04/05/07/28/29/30 and P0-26: the design-system checks catch what they are meant to catch,
// and pass on the committed tree.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { checkScopedCss, textAfterGlobal, scan as scanScoped } from "../scripts/ds/check-scoped-css.mjs";
import { checkFile as usageCheck, run as usageRun } from "../scripts/ds/check-ds-usage.mjs";
import { checkFile as copyCheck, localeFindings, run as copyRun } from "../scripts/ds/check-ds-copy.mjs";
import { readsInFile, run as collisionRun } from "../scripts/ds/check-token-collisions.mjs";
import { run as contrastRun } from "../scripts/ds/contrast-check.mjs";
import { structureProblems, resolveContexts, productionFiles, PROD_CONTEXTS, diffResolved, SNAPSHOT } from "../scripts/ds/check-tokens.mjs";
import { build as mappingBuild } from "../scripts/ds/token-mapping.mjs";
import { compareReports, normalizeManifestKey, normalizePrecacheUrl } from "../scripts/ds/build-report.mjs";
import { dsSamplePages, dsSamplesEnabled, sectionOrder, sectionSlug } from "../ds-samples/routes.ts";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const tokensCss = read("assets/css/ds/tokens.css");

/* ---------------- P0-28 scoped CSS ---------------- */

test("scoped CSS: the four cases from the task list (two wrong, two right)", () => {
  const wrong1 = checkScopedCss(":global(:root[data-kb]) .composer{bottom:0}");
  const wrong2 = checkScopedCss(":global(body.theme-dark) .ugc-admin-panel{background:red}");
  const right1 = checkScopedCss(":global(body.theme-dark .x){color:red}");
  const right2 = checkScopedCss(":root[data-kb] .composer{bottom:0}");
  assert.equal(wrong1.length, 1);
  assert.equal(wrong1[0].dropped, true);
  assert.equal(wrong1[0].compiled, ":root[data-kb]");
  assert.equal(wrong2[0].dropped, true);
  assert.equal(wrong2[0].compiled, "body.theme-dark");
  assert.deepEqual(right1, []); // whole selector inside :global → nothing after it
  assert.deepEqual(right2, []); // no :global at all
  assert.equal(textAfterGlobal(":global(body.theme-dark) .x .y"), ".x .y");
  assert.equal(textAfterGlobal(":global(.a)"), null);
});

test("scoped CSS: nested in @media and selector lists are covered", () => {
  const f = checkScopedCss("@media (max-width:767px){ .ok, :global(html[data-kb]) .composer { bottom: 0 } }");
  assert.equal(f.length, 1);
  assert.equal(f[0].dropped, true);
});

test("scoped CSS: design-system dirs clean; the known chart-ugc.vue occurrence is reported, not fixed", () => {
  const results = scanScoped();
  assert.deepEqual(results.filter((r) => r.strict && r.dropped), []);
  const known = results.filter((r) => r.file === "pages/admin/taiko/chart-ugc.vue" && r.dropped);
  assert.ok(known.length >= 1);
  assert.ok(known.every((r) => r.line === 212));
});

/* ---------------- P0-29 usage ---------------- */

test("usage: hex, primitive, family and asset-filter violations are reported", () => {
  const vue = `<template><img class="crown-img" src="/icons/difficulty/1.png" style="filter: grayscale(1)"></template>
<style scoped>
.a { color: #ff0000; background: var(--ai-500); }
.b { color: var(--don); border-color: var(--rank-iki1); }
.crown-icon img { opacity: .5 }
</style>`;
  const rules = usageCheck("components/ds/Foo.vue", vue).map((f) => f.rule);
  for (const expected of ["hex colour", "primitive token", "--don* / --ka* / --roll* outside its components", "--rank-* outside its components", "filter/blend/mask/opacity on a game asset", "legacy icons/difficulty path"]) {
    assert.ok(rules.includes(expected), expected);
  }
  assert.deepEqual(usageCheck("components/ds/Rank.vue", "<style scoped>.r{color:var(--rank-iki1-ink)}</style>"), []);
  assert.deepEqual(usageCheck("components/ds/Note.vue", "<style scoped>.n{background:var(--don)}</style>"), []);
  assert.deepEqual(usageCheck("components/ds/Foo.vue", "<style scoped>.n{background:var(--lane-ka)}</style>").filter((f) => f.rule.startsWith("--don")), []);
  assert.deepEqual(usageCheck("ds-samples/_shared/useX.ts", 'import { useHead } from "#imports";'), []);
});

test("usage: the committed design-system code has no findings", () => {
  assert.deepEqual(usageRun(), []);
});

/* ---------------- P0-30 copy ---------------- */

test("copy: CJK literals, bilingual branches and missing keys are reported", () => {
  const locales = { zh: { ds: { a: "甲" } }, ja: { ds: { a: "甲" } } };
  const vue = `<script setup>
const label = locale.value === 'ja' ? 'x' : 'y';
const pair = { zh: '通关', ja: 'クリア' };
</script>
<template><span aria-label="王冠">{{ t('ds.missing') }}</span><b>全良</b><i data-ds-specimen>太鼓</i></template>`;
  const rules = copyCheck("components/ds/Foo.vue", vue, locales).map((f) => f.rule);
  for (const expected of ["CJK literal in attribute", "CJK text in template", "inline language branch", "inline bilingual literal", "CJK string literal in script", "locale key missing in zh.json", "locale key missing in ja.json"]) {
    assert.ok(rules.includes(expected), expected);
  }
  assert.ok(!copyCheck("ds-samples/sections/x.vue", "<template><i data-ds-specimen>太鼓</i></template>", locales).length);
  assert.equal(localeFindings({ ds: { a: "x", b: "y" } }, { ds: { a: "z" } }).length, 1);
  assert.equal(localeFindings({ ds: { a: "" } }, { ds: { a: "z" } }).length, 1);
});

test("copy: the committed code and locales have no findings", () => {
  assert.deepEqual(copyRun().findings, []);
});

/* ---------------- P0-04 collisions ---------------- */

test("collisions: a read without a nearby definition is reported; a local definition is not", () => {
  const names = new Set(["--accent", "--bg"]);
  assert.deepEqual(readsInFile(".x{color:var(--accent)}", names).map((r) => r.localDefinition), [false]);
  assert.deepEqual(readsInFile(".x{--accent:red;color:var(--accent)}", names).map((r) => r.localDefinition), [true]);
  assert.deepEqual(readsInFile(`<div :style="{ '--accent': c }"></div><style>.x{color:var(--accent)}</style>`, names).map((r) => r.localDefinition), [true]);
  assert.deepEqual(readsInFile(".x{color:var(--viewer-bg)}", names), []);
  const real = collisionRun();
  assert.deepEqual(real.reads.filter((r) => !r.localDefinition), []);
});

/* ---------------- P0-03 tokens ---------------- */

test("tokens: scoped structure only, and equal to the committed C+ snapshot", () => {
  assert.deepEqual(structureProblems(tokensCss), []);
  assert.ok(structureProblems(":root{--bg:#fff}").length > 0, "bare :root is rejected");
  assert.ok(structureProblems("html.ds-preview{color:red}").length > 0, "element styles are rejected");
  const snap = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
  assert.deepEqual(diffResolved(snap.contexts, resolveContexts(productionFiles(), PROD_CONTEXTS), "snapshot"), []);
});

/* ---------------- P0-07 contrast ---------------- */

test("contrast: all pairs pass; a broken value fails", () => {
  const rows = contrastRun(tokensCss);
  assert.ok(rows.length > 300);
  assert.deepEqual(rows.filter((r) => !r.pass).map((r) => `${r.theme} ${r.fg}/${r.bg}`), []);
  const broken = tokensCss.replace("--ink-3: #4d696c;", "--ink-3: #b0c4c6;");
  assert.ok(contrastRun(broken).some((r) => !r.pass && r.fg === "--ink-3"));
});

/* ---------------- P0-05 mapping ---------------- */

test("token mapping: complete and the committed document is current", () => {
  const { markdown, problems } = mappingBuild();
  assert.deepEqual(problems, []);
  assert.equal(read("docs/design-system/viewer-token-mapping.md").replace(/\r\n/g, "\n"), markdown);
});

/* ---------------- P0-26 sample routes ---------------- */

test("sample routes: only in dev or with TAIKO_DS_SAMPLES=1; sections auto-discovered", () => {
  assert.equal(dsSamplesEnabled({ NODE_ENV: "production" }), false);
  assert.equal(dsSamplesEnabled({}), false);
  assert.equal(dsSamplesEnabled({ NODE_ENV: "production", TAIKO_DS_SAMPLES: "1" }), true);
  assert.equal(dsSamplesEnabled({ NODE_ENV: "development" }), true);
  assert.equal(dsSamplesEnabled({ TAIKO_DS_SAMPLES: "true" }), false);
  assert.equal(sectionSlug("10-tokens.vue"), "tokens");
  assert.equal(sectionSlug("crown.vue"), "crown");
  assert.equal(sectionSlug("_helper.vue"), null);
  assert.equal(sectionSlug("Crown.vue"), null);
  const pages = dsSamplePages(fileURLToPath(root));
  assert.equal(pages[0].path, "/_ds");
  assert.ok(pages.every((p) => p.meta.layout === false && p.path.startsWith("/_ds")));
  assert.ok(pages.some((p) => p.path === "/_ds/tokens"));
  assert.ok(pages.some((p) => p.path === "/_ds/element-plus"));
  assert.equal(sectionOrder("70-cover.vue"), 70);
  assert.equal(sectionOrder("cover.vue"), 999);
  assert.ok(pages.slice(1).every((p) => Number.isInteger(p.meta.dsOrder) && p.meta.dsOrder > 0));
  // nuxt.config registers them only through the guarded hook
  const config = read("nuxt.config.ts");
  assert.match(config, /"pages:extend"\(pages\) \{\s*if \(dsSamplesEnabled\(\)\) pages\.push\(\.\.\.dsSamplePages\(/);
});

/* ---------------- build report ---------------- */

test("build report: hash normalisation and comparison verdicts", () => {
  assert.equal(normalizeManifestKey("_SongCoverImage.DNfKiH3S.js"), "_SongCoverImage.js");
  assert.equal(normalizeManifestKey("pages/songs/[id].vue"), "pages/songs/[id].vue");
  assert.equal(normalizePrecacheUrl("_nuxt/AbCdEf12.js"), "_nuxt/<hash>.js");
  assert.equal(normalizePrecacheUrl("_nuxt/builds/meta/37db7cb6-3218-4a42-8d8e-1f6544e467d8.json"), "_nuxt/builds/meta/<build-id>.json");
  const base = {
    serverRoutes: ["/  (index___zh)"],
    manifestSampleKeys: [],
    serverSampleHits: [],
    routes: { "pages/index.vue": { deps: ["pages/index.vue"], js: 1, jsBytes: 10, css: 1, cssBytes: 5 } },
    entries: [{ cssBytes: 100 }],
    precache: { urls: ["_nuxt/aaaaaaaa.js", "manifest.webmanifest"] },
    webManifest: { theme_color: "#eaf6f5" },
    themeColors: ["#eaf6f5"],
    viewerPageRoutePatterns: null,
    pageFiles: ["index.vue"],
    fonts: [],
    nuxt: { totalFiles: 1, totalBytes: 10 },
    locales: {},
    publicFileCount: 1,
    publicDsIcons: [],
    nitroServerBuilt: false
  };
  const same = { ...base, precache: { urls: ["_nuxt/bbbbbbbb.js", "manifest.webmanifest"] } };
  assert.equal(compareReports(base, same).ok, true);
  const leaked = { ...base, serverRoutes: [...base.serverRoutes, "/_ds  (ds-samples___zh)"], manifestSampleKeys: ["ds-samples/index.vue"] };
  assert.equal(compareReports(base, leaked).ok, false);
  assert.equal(compareReports(base, leaked, { expectSamples: true }).ok, true);
  const css = { ...base, entries: [{ cssBytes: 101 }] };
  assert.equal(compareReports(base, css).ok, false);
});
