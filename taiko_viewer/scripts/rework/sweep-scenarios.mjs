// Slice G: the whole-site sweep. Opens every reworked page (pages/ outside admin, annual and version-summary) with the
// data level its slice used — real server data where the page is file-backed (scripts/rework/pages-data.mjs and
// detail-data.mjs), the slice's own intercepted fixtures where it needs the database or a signed-in user — and
//   - colour:  before / after screenshots of seven pages × 1440 / 390 × light / dark (the token tuning evidence)
//   - pages:   one screenshot per page at 1440 light and 390 dark, plus measurements that are compared across pages
//              (h1 size and position, content edge and width, tab label = h1, buttons, panels, state blocks, focus
//              ring, the old red primary button) and the no-horizontal-scroll check at 360 in zh and ja.
// Environment independent (like the slices' scenario modules); the Windows runner is sweep-selfcheck.mjs.
// Every intercepted page is labelled `intercepted` in its record and file name; `real` pages are server-rendered.
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { openContext as scoresContext } from "./scores-scenarios.mjs";
import { openContext as todayContext } from "./today-scenarios.mjs";
import { openContext as communityContext } from "./community-scenarios.mjs";
import { openContext as accountContext } from "./account-scenarios.mjs";
import { openContext as account2Context } from "./account2-scenarios.mjs";
import { openContext as detailContext } from "./detail-scenarios.mjs";
import { openContext as pagesContext } from "./pages-scenarios.mjs";
import { fixtureUser as scoresUser } from "./scores-fixtures.ts";
import { fixtureUser as todayUser } from "./today-fixtures.ts";
import { fixtureUser as communityUser } from "./community-fixtures.ts";
import { fixtureUser as detailUser } from "./detail-fixtures.ts";

const CONTEXTS = {
  scores: (browser, o) => scoresContext(browser, { ...o, signedIn: o.signedIn }),
  today: (browser, o) => todayContext(browser, o),
  community: (browser, o) => communityContext(browser, o),
  account: (browser, o) => accountContext(browser, o),
  account2: (browser, o) => account2Context(browser, o),
  detail: (browser, o) => detailContext(browser, o),
  pages: (browser, o) => pagesContext(browser, o)
};
const USERS = { scores: scoresUser, today: todayUser, community: communityUser, detail: detailUser };

/**
 * Every reworked page. `mod` picks the slice whose interception answers the page; `signedIn` pages are entered the
 * way the slices do it (server render of a guest page, the fixture user written into the app's account state, then
 * client navigation). Redirect-only pages (/account, /grade, /grade/2025, /grade/2026, /tools) are not listed.
 */
export const ROUTES = [
  { name: "home", path: "/", mod: "today", signedIn: true, ready: ".growth-surface" },
  { name: "home-guest", path: "/", mod: "today", ready: "#viewer-main h1" },
  { name: "songs", path: "/songs", mod: "pages", ready: ".lib-results .rows li.row:not(.skeleton)" },
  { name: "songs-1", path: "/songs/1", mod: "detail", ready: "#viewer-main h1" },
  { name: "songs-constants", path: "/songs/constants", mod: "pages", ready: "#viewer-main table, #viewer-main h1" },
  { name: "grade-2026", path: "/grade/2026/%E4%B9%9D%E6%AE%B5", mod: "pages", ready: ".dan-songs" },
  { name: "grade-2025", path: "/grade/2025/%E4%BA%94%E7%B4%9A", mod: "pages", ready: ".dan-songs" },
  { name: "grade-2024", path: "/grade/2024", mod: "pages", ready: ".dan-songs" },
  { name: "grade-2023", path: "/grade/2023", mod: "pages", ready: ".dan-songs" },
  { name: "guide", path: "/guide", mod: "pages", ready: ".gi-rows" },
  { name: "guide-4-10", path: "/guide/4/10", mod: "pages", ready: ".gl-tags" },
  { name: "titles", path: "/titles", mod: "pages", ready: ".tl-table" },
  { name: "account-songs", path: "/account/songs", mod: "scores", signedIn: true, ready: ".sl-table tr.sr" },
  { name: "tools-b30", path: "/tools/b30", mod: "scores", signedIn: true, ready: "#viewer-main h1" },
  { name: "tools-trend", path: "/tools/trend", mod: "scores", signedIn: true, ready: "#viewer-main h1" },
  { name: "tools-progress", path: "/tools/progress", mod: "scores", signedIn: true, ready: "#viewer-main h1" },
  { name: "tools-recommend", path: "/tools/recommend", mod: "scores", signedIn: true, ready: "#viewer-main h1" },
  { name: "my", path: "/my", mod: "scores", signedIn: true, ready: "#viewer-main h1" },
  { name: "my-growth", path: "/my/growth", mod: "today", signedIn: true, ready: "#viewer-main h1" },
  { name: "my-weekly", path: "/my/weekly", mod: "today", signedIn: true, ready: "#viewer-main h1" },
  { name: "forum", path: "/forum", mod: "community", signedIn: true, ready: "#viewer-main h1" },
  { name: "forum-section", path: "/forum/section/dojo", mod: "community", signedIn: true, ready: "#viewer-main h1" },
  { name: "forum-discussions", path: "/forum/discussions", mod: "community", signedIn: true, ready: "#viewer-main h1" },
  { name: "forum-thread", path: "/forum/thread/5001", mod: "community", signedIn: true, ready: "#viewer-main h1" },
  { name: "forum-new", path: "/forum/new", mod: "community", signedIn: true, ready: "#viewer-main h1, .composer, form" },
  { name: "forum-me", path: "/forum/me", mod: "community", signedIn: true, ready: "#viewer-main h1" },
  { name: "forum-notifications", path: "/forum/notifications", mod: "community", signedIn: true, ready: "#viewer-main h1" },
  { name: "account-login", path: "/account/login", mod: "account", ready: "#viewer-main h1" },
  { name: "account-register", path: "/account/register", mod: "account", ready: "#viewer-main h1" },
  { name: "account-forgot-password", path: "/account/forgot-password", mod: "account", ready: "#viewer-main h1" },
  { name: "account-profile", path: "/account/profile", mod: "account", signedIn: true, ready: "#viewer-main h1" },
  { name: "settings", path: "/settings", mod: "account", ready: "#viewer-main h1" },
  { name: "account-sync", path: "/account/sync", mod: "account2", signedIn: true, ready: "#viewer-main h1" },
  { name: "account-developer", path: "/account/developer", mod: "account2", signedIn: true, ready: "#viewer-main h1" },
  { name: "account-developer-grants", path: "/account/developer/grants", mod: "account2", signedIn: true, ready: "#viewer-main h1" },
  { name: "account-developer-review", path: "/account/developer/review", mod: "account2", signedIn: true, ready: "#viewer-main h1" },
  { name: "docs-score-token", path: "/docs/score-token", mod: "account2", ready: "#viewer-main h1" },
  { name: "support", path: "/support", mod: "account2", signedIn: true, ready: "#viewer-main h1" },
  { name: "account-support-review", path: "/account/support/review", mod: "account2", signedIn: true, ready: "#viewer-main h1" },
  { name: "tools-chart-config", path: "/tools/chart-config", mod: "pages", ready: "#viewer-main form" },
  { name: "tools-note-count", path: "/tools/note-count", mod: "pages", ready: "#viewer-main form" },
  { name: "tools-rt-calculator", path: "/tools/rt-calculator?songId=1&level=4", mod: "pages", ready: "#rt-good" },
  { name: "tools-tja-constants", path: "/tools/tja-constants", mod: "pages", ready: ".drop-zone" },
  { name: "tools-word-cloud", path: "/tools/word-cloud", mod: "pages", signedIn: true, ready: "#viewer-main h1" },
  { name: "more", path: "/more", mod: "pages", ready: ".more-hub" },
  { name: "about", path: "/about", mod: "pages", ready: ".ab" },
  { name: "alias-log", path: "/alias-log", mod: "pages", ready: ".at-table" },
  { name: "ourtaikoview", path: "/ourtaikoview/1/4", mod: "pages", ready: ".practice-controls" }
];

/** The colour evidence: an asset-rich signed-in page, the signed-in home, the library, the song detail, three asset-poor pages. */
export const COLOUR_ROUTES = ["account-songs", "home", "songs", "songs-1", "account-login", "account-sync", "support"];
export const COLOUR_VARIANTS = [
  { width: 1440, theme: "light" },
  { width: 1440, theme: "dark" },
  { width: 390, theme: "light" },
  { width: 390, theme: "dark" }
];

const prefix = (lang) => (lang === "ja" ? "/ja" : "");
const push = (page, to) => page.evaluate((x) => document.getElementById("__nuxt").__vue_app__.config.globalProperties.$router.push(x), to);
const injectSignedIn = (page, user) =>
  page.evaluate((u) => {
    const nuxt = document.getElementById("__nuxt").__vue_app__.config.globalProperties.$nuxt;
    nuxt.payload.state["$saccount-user"] = u;
    nuxt.payload.state["$saccount-user-loaded"] = true;
  }, user);

async function open(browser, base, route, { width, theme, lang }, prepared) {
  const ctx = await CONTEXTS[route.mod](browser, { base, width, theme, lang, signedIn: Boolean(route.signedIn), data: prepared?.data });
  const { page, state } = ctx;
  const target = `${prefix(lang)}${route.path}`;
  if (route.signedIn) {
    await page.goto(`${base}${prefix(lang)}/about`, { waitUntil: "networkidle", timeout: 180000 });
    if (state) state.signedIn = true;
    await injectSignedIn(page, state?.user || USERS[route.mod]);
    await push(page, target);
    const bare = decodeURI(target.split(/[?#]/)[0]);
    await page.waitForURL((u) => decodeURI(u.pathname) === bare, { timeout: 60000 });
  } else {
    await page.goto(base + target, { waitUntil: "networkidle", timeout: 180000 });
  }
  await page.locator(route.ready).first().waitFor({ timeout: 60000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  await settle(page);
  return ctx;
}

/** Scroll through (lazy covers), wait for images, hide the dev overlay, stop animations. */
async function settle(page) {
  await page.evaluate(async () => {
    const step = Math.max(200, innerHeight - 100);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
    scrollTo(0, 0);
    const settled = (img) => (img.complete ? Promise.resolve() : new Promise((r) => (img.addEventListener("load", r, { once: true }), img.addEventListener("error", r, { once: true }))));
    await Promise.race([Promise.all([...document.images].map(settled)), new Promise((r) => setTimeout(r, 8000))]);
  });
  await page.addStyleTag({ content: "#nuxt-devtools-container,#nuxt-devtools-anchor{display:none!important}*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}" });
  await page.waitForTimeout(300);
}

/** Measurements compared across pages (run in the page). */
function measure() {
  const visible = (el) => el && el.getClientRects().length && getComputedStyle(el).visibility !== "hidden";
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: Math.round(r.left), top: Math.round(r.top + scrollY), width: Math.round(r.width), height: Math.round(r.height) };
  };
  const css = (el, props) => (el ? Object.fromEntries(props.map((p) => [p, getComputedStyle(el).getPropertyValue(p)])) : null);
  const main = document.querySelector("#viewer-main");
  const h1s = [...main.querySelectorAll("h1")].filter(visible);
  const h1 = h1s[0];
  const body = main.querySelector(".page-body");
  const first = body ? [...body.children].find((c) => visible(c) && !c.classList.contains("page-loading")) : null;
  const firstBlock = first ? [...first.querySelectorAll(":scope > *")].find(visible) || first : null;
  const currentTab = [...document.querySelectorAll(".rework-tabs [aria-current='page'], .rework-side .side-sublink[aria-current='page']")].find(visible);
  const buttons = [...main.querySelectorAll(".rw-btn, .el-button")].filter(visible).map((b) => ({
    kind: b.classList.contains("rw-btn--primary") || b.classList.contains("el-button--primary") ? "primary" : b.classList.contains("rw-btn--danger") || b.classList.contains("el-button--danger") ? "danger" : b.classList.contains("rw-btn--ghost") ? "ghost" : "secondary",
    lib: b.classList.contains("el-button") ? "el" : "rw",
    text: b.textContent.trim().slice(0, 24),
    ...css(b, ["height", "border-radius", "font-size", "font-weight", "background-color", "color", "border-top-color"]),
    disabled: b.matches(":disabled,[aria-disabled=true],.is-disabled")
  }));
  const panels = [...main.querySelectorAll(".rw-panel:not(.is-plain)")].filter(visible).map((p) => css(p, ["border-radius", "background-color", "border-top-color", "padding-top", "padding-left"]));
  const states = [...main.querySelectorAll(".rw-state, .rw-gate")].filter(visible).map((s) => ({ cls: s.className.split(" ").slice(0, 3).join(" "), ...css(s, ["border-radius", "background-color", "border-top-style", "padding-top", "text-align"]) }));
  const tables = [...main.querySelectorAll("table")].filter(visible).length;
  return {
    url: location.pathname + location.search,
    htmlClass: document.documentElement.className,
    group: document.querySelector(".rework-side .side-group.is-current span")?.textContent.trim() || document.querySelector(".rework-side .side-link[aria-current='page']")?.getAttribute("href") || null,
    tab: currentTab ? currentTab.textContent.trim() : null,
    h1Count: h1s.length,
    h1: h1 ? { text: h1.textContent.replace(/\s+/g, " ").trim().slice(0, 80), box: box(h1), ...css(h1, ["font-size", "font-weight", "line-height", "font-family"]) } : null,
    content: box(main.querySelector(".viewer-content")),
    contentClass: main.querySelector(".viewer-content")?.className || null,
    first: firstBlock ? { tag: firstBlock.tagName, cls: String(firstBlock.className).slice(0, 60), box: box(firstBlock) } : null,
    buttons,
    panels,
    states,
    tables,
    overflow: document.documentElement.scrollWidth > innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    redPrimary: [...document.querySelectorAll(".el-button--primary")].filter(visible).map((b) => getComputedStyle(b).backgroundColor).filter((c) => {
      const m = c.match(/\d+/g)?.map(Number);
      return m && m[0] > 150 && m[1] < 120 && m[2] < 120;
    })
  };
}

/** Keyboard focus ring on the first focusable control of the main area (outline colour, width, offset). */
async function focusRing(page) {
  return page.evaluate(() => {
    const el = [...document.querySelectorAll("#viewer-main a[href], #viewer-main button:not(:disabled), #viewer-main input:not([type=hidden])")].find((e) => e.getClientRects().length);
    return el ? { tag: el.tagName, cls: String(el.className).slice(0, 40) } : null;
  }).then(async (target) => {
    if (!target) return null;
    await page.evaluate(() => document.activeElement?.blur());
    await page.locator("#viewer-main").focus().catch(() => {});
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      const r = await page.evaluate(() => {
        const a = document.activeElement;
        if (!a || !a.closest("#viewer-main") || a.id === "viewer-main") return null;
        const s = getComputedStyle(a);
        return { tag: a.tagName, cls: String(a.className).slice(0, 40), outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`, offset: s.outlineOffset, shadow: s.boxShadow === "none" ? null : s.boxShadow.slice(0, 80) };
      });
      if (r) return r;
    }
    return null;
  });
}

export async function runColour({ browser, base, out, variant, prepared, routes = COLOUR_ROUTES }) {
  const dir = resolve(out, variant);
  await mkdir(dir, { recursive: true });
  const results = [];
  for (const name of routes) {
    const route = ROUTES.find((r) => r.name === name);
    for (const v of COLOUR_VARIANTS) {
      const label = `${name}-${dataLevel(route)}-${v.width}-${v.theme}`;
      let ctx;
      try {
        ctx = await open(browser, base, route, { ...v, lang: "zh" }, prepared);
        await ctx.page.screenshot({ path: resolve(dir, `${label}.png`), fullPage: true });
        results.push({ name, ...v, file: `${label}.png`, pass: true, faults: ctx.faults?.length || 0 });
      } catch (error) {
        results.push({ name, ...v, pass: false, error: String(error).slice(0, 300) });
        if (ctx?.page) await ctx.page.screenshot({ path: resolve(dir, `FAILED-${label}.png`) }).catch(() => {});
      } finally {
        await ctx?.context.close().catch(() => {});
      }
    }
  }
  await writeFile(resolve(dir, "colour.json"), JSON.stringify(results, null, 1));
  return { total: results.length, passed: results.filter((r) => r.pass).length, results };
}

const dataLevel = (route) => (route.signedIn ? "intercepted" : "real");

export async function runSweep({ browser, base, out, prepared, only = "" }) {
  const shots = resolve(out, "pages");
  await mkdir(shots, { recursive: true });
  const filter = only ? only.split(",") : null;
  const results = [];
  // 1440 light zh (screenshot, measurements, focus ring) then the same page at 360; 390 dark zh (screenshot);
  // 1440 light ja (wrapping of tabs, buttons, headers) then the same page at 360 (no horizontal scroll in ja).
  const variants = [
    { width: 1440, theme: "light", lang: "zh", shot: true, measure: true, narrow: 360 },
    { width: 390, theme: "dark", lang: "zh", shot: true, measure: true },
    { width: 1440, theme: "light", lang: "ja", measure: true, narrow: 360 }
  ];
  for (const route of ROUTES.filter((r) => !filter || filter.some((f) => r.name.startsWith(f)))) {
    for (const v of variants) {
      let ctx;
      const record = { name: route.name, path: route.path, data: dataLevel(route), width: v.width, theme: v.theme, lang: v.lang };
      try {
        ctx = await open(browser, base, route, v, prepared);
        record.m = await ctx.page.evaluate(measure);
        if (v.measure && v.width === 1440 && v.lang === "zh") record.focus = await focusRing(ctx.page);
        if (v.shot) {
          await ctx.page.evaluate(() => scrollTo(0, 0));
          await ctx.page.screenshot({ path: resolve(shots, `${route.name}__${v.width}-${v.theme}__${record.data}.png`), fullPage: true });
        }
        if (v.narrow) {
          await ctx.page.setViewportSize({ width: v.narrow, height: 800 });
          await ctx.page.waitForTimeout(400);
          record.narrow = await ctx.page.evaluate((w) => ({ width: w, overflow: document.documentElement.scrollWidth > innerWidth, scrollWidth: document.documentElement.scrollWidth, wide: [...document.querySelectorAll("#viewer-main *")].filter((el) => { const r = el.getBoundingClientRect(); return r.right > innerWidth + 1 && getComputedStyle(el).position !== "fixed" && !el.closest("[style*=overflow], .rw-scroll, table, pre, .ct-wrap"); }).slice(0, 5).map((el) => String(el.className).slice(0, 50)) }), v.narrow);
        }
        record.faults = ctx.faults || [];
        record.pass = !record.m.overflow && !record.narrow?.overflow && record.m.h1Count === 1 && !record.m.redPrimary.length && !record.faults.length;
      } catch (error) {
        record.pass = false;
        record.error = String(error).slice(0, 300);
        if (ctx?.page) await ctx.page.screenshot({ path: resolve(shots, `FAILED-${route.name}-${v.width}-${v.lang}.png`) }).catch(() => {});
      } finally {
        await ctx?.context.close().catch(() => {});
      }
      results.push(record);
    }
  }
  await writeFile(resolve(out, "sweep.json"), JSON.stringify(results, null, 1));
  return { total: results.length, passed: results.filter((r) => r.pass).length, results };
}
