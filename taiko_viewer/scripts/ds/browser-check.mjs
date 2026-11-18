#!/usr/bin/env node
// Browser check for the design-system scope (P0-26 constraint 1, P0-08 constraint 2, P0-28 root-attribute example).
//
//   node scripts/ds/browser-check.mjs --base http://127.0.0.1:<port> [--out <dir>] [--browser <chrome path>]
//
// It does not start a server: point it at a dev server or a TAIKO_DS_SAMPLES=1 build. On the Linux host run it
// through `bash scripts/memory/run_qa.sh` (acceptance); anywhere else it is only a development self-check.
// Bounds: one browser, one context, at most two pages, 240 s total, everything closed in finally.
// Read-only: it never logs in, never submits forms and calls no API itself.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { computed as cssComputed, parseColor } from "./lib/css-tokens.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..", "..");
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const BASE = opt("--base", "http://127.0.0.1:3517").replace(/\/$/, "");
const OUT = opt("--out", null);
const BROWSER = opt("--browser", process.env.DS_BROWSER || undefined);
const TOTAL_MS = 240_000;
const EXISTING_PAGE = opt("--existing", "/settings");

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

/** Expected rgb() strings for ds tokens, resolved from assets/css/ds/tokens.css. */
function expected(theme) {
  const files = [{ name: "tokens", css: readFileSync(join(ROOT, "assets", "css", "ds", "tokens.css"), "utf8") }];
  const r = cssComputed(files, { classes: ["ds-preview"], attrs: { "data-theme": theme }, lang: "zh" }).root;
  const rgb = (token) => {
    const [cr, cg, cb] = parseColor(r[token]);
    return `rgb(${Math.round(cr)}, ${Math.round(cg)}, ${Math.round(cb)})`;
  };
  return { primary: rgb("--action-bg"), brand: rgb("--brand-primary"), overlay: rgb("--overlay-bg"), sunk: rgb("--bg-sunk"), surface: rgb("--surface"), ink: rgb("--ink") };
}

/** Computed styles of <html>, <body> and of probe elements with Element Plus classes appended to <body>. */
const SNAPSHOT = () => {
  const html = document.documentElement;
  const cs = (el, props) => {
    const s = getComputedStyle(el);
    return Object.fromEntries(props.map((p) => [p, s.getPropertyValue(p).trim()]));
  };
  const probe = (html) => {
    const host = document.createElement("div");
    host.setAttribute("data-ds-check-probe", "");
    host.innerHTML = html;
    document.body.appendChild(host);
    return host;
  };
  const host = probe(
    '<button class="el-button el-button--primary" id="p-btn"><span>x</span></button>' +
      '<div class="el-popper is-dark" id="p-tip">x</div>' +
      '<div class="el-message el-message--success" id="p-msg">x</div>' +
      '<ul class="el-select-dropdown__list"><li class="el-select-dropdown__item is-selected" id="p-sel">x</li></ul>' +
      '<div class="el-dialog" id="p-dlg">x</div>'
  );
  const vars = ["--el-color-primary", "--el-color-info", "--el-bg-color-overlay", "--el-text-color-primary", "--el-border-color", "--brand-primary", "--bg", "--accent", "--ink"];
  const snap = {
    htmlClass: html.className,
    htmlLang: html.lang,
    theme: html.dataset.theme || "",
    htmlVars: cs(html, vars),
    html: cs(html, ["color-scheme", "background-color", "outline-style", "border-top-color"]),
    body: cs(document.body, ["background-color", "color", "font-family", "font-size", "line-height"]),
    button: cs(document.getElementById("p-btn"), ["background-color", "border-top-color", "color", "font-family", "min-height", "border-top-left-radius"]),
    tooltip: cs(document.getElementById("p-tip"), ["background-color", "color", "border-top-color"]),
    message: cs(document.getElementById("p-msg"), ["background-color", "color", "border-top-color"]),
    selected: cs(document.getElementById("p-sel"), ["background-color", "color"]),
    dialog: cs(document.getElementById("p-dlg"), ["background-color", "color"])
  };
  host.remove();
  return snap;
};

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Production's own Element Plus value for the success-message probe, from assets/css/tokens.css
 * (--el-color-success-light-9 = --viewer-success-surface).
 */
function productionMessageBg(theme) {
  const css = readFileSync(join(ROOT, "assets", "css", "tokens.css"), "utf8");
  const r = cssComputed([{ name: "prod", css }], { attrs: { "data-theme": theme }, lang: "zh" }).root;
  const [cr, cg, cb] = parseColor(r["--viewer-success-surface"]);
  return `rgb(${Math.round(cr)}, ${Math.round(cg)}, ${Math.round(cb)})`;
}

/**
 * "Back to baseline" for an existing page. Element Plus loads each component's own stylesheet the first time the
 * component is used anywhere in the session (el-message.css when a sample page shows a message). If the existing
 * page never used ElMessage, its message probe is unstyled before the visit and styled afterwards — by production's
 * mapping, not the ds one. That one case is accepted only when the probe then shows production's value exactly.
 */
function sameAsBaseline(before, after, theme) {
  const { message: m0, ...rest0 } = before;
  const { message: m1, ...rest1 } = after;
  if (!sameJson(rest0, rest1)) return false;
  if (sameJson(m0, m1)) return true;
  return m0["background-color"] === "rgba(0, 0, 0, 0)" && m1["background-color"] === productionMessageBg(theme);
}
const diffKeys = (a, b, prefix = "") =>
  Object.keys({ ...a, ...b }).flatMap((k) =>
    a?.[k] && typeof a[k] === "object" ? diffKeys(a[k], b?.[k], `${prefix}${k}.`) : a?.[k] === b?.[k] ? [] : [`${prefix}${k}: ${JSON.stringify(a?.[k])} → ${JSON.stringify(b?.[k])}`]
  );

/** Client-side navigation through the app's own router; fails the check if the document was reloaded instead. */
const hardNavigations = [];
async function routerPush(page, path) {
  await page.evaluate(() => (window.__dsCheckDoc = window.__dsCheckDoc || Math.random()));
  const doc = await page.evaluate(() => window.__dsCheckDoc);
  await page.evaluate((p) => {
    const app = document.querySelector("#__nuxt").__vue_app__;
    window.__dsCheckPush = app.config.globalProperties.$router.push(p).then(
      () => "ok",
      (e) => `error ${String(e).slice(0, 200)}`
    );
  }, path);
  await page.waitForFunction((p) => location.pathname === p, path, { timeout: 30_000 });
  await page.waitForTimeout(500); // head updates are flushed after the page transition
  const same = await page.evaluate((d) => window.__dsCheckDoc === d, doc);
  if (!same) hardNavigations.push(path);
  const result = same ? await page.evaluate(() => window.__dsCheckPush) : "document reloaded";
  if (result !== "ok") hardNavigations.push(`${path}: ${result}`);
}

async function popups(page) {
  const out = {};
  const style = (sel, prop) => page.$eval(sel, (el, p) => getComputedStyle(el).getPropertyValue(p).trim(), prop);
  await page.click('[data-testid="ds-ep-select"]');
  await page.waitForSelector(".ds-ep-select-popper .el-select-dropdown__item.is-selected", { state: "visible", timeout: 15_000 });
  out.selectDropdownBg = await style(".ds-ep-select-popper", "background-color");
  out.selectSelectedBg = await style(".ds-ep-select-popper .el-select-dropdown__item.is-selected", "background-color");
  await page.keyboard.press("Escape");
  await page.hover('[data-testid="ds-ep-tooltip-trigger"]');
  await page.waitForSelector(".ds-ep-tooltip", { state: "visible", timeout: 15_000 });
  out.tooltipBg = await style(".ds-ep-tooltip", "background-color");
  await page.mouse.move(0, 0);
  await page.click('[data-testid="ds-ep-dropdown-trigger"]');
  await page.waitForSelector(".ds-ep-dropdown .el-dropdown-menu", { state: "visible", timeout: 15_000 });
  out.dropdownBg = await style(".ds-ep-dropdown .el-dropdown-menu", "background-color");
  await page.keyboard.press("Escape");
  await page.click('[data-testid="ds-ep-message"]');
  await page.waitForSelector(".el-message", { state: "visible", timeout: 15_000 });
  out.messageBg = await style(".el-message", "background-color");
  await page.click('[data-testid="ds-ep-open-dialog"]');
  await page.waitForSelector(".ds-ep-dialog", { state: "visible", timeout: 15_000 });
  out.dialogBg = await style(".ds-ep-dialog", "background-color");
  out.dialogPrimaryBg = await style(".ds-ep-dialog .el-button--primary", "background-color");
  out.inPagePrimaryBg = await style('[data-testid="ds-btn-primary"], .ds-ep-dialog .el-button--primary', "background-color");
  out.teleportedUnderBody = await page.$eval(".ds-ep-dialog", (el) => !document.querySelector("#__nuxt").contains(el));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  return out;
}

async function run() {
  const browser = await chromium.launch({ headless: true, executablePath: BROWSER, channel: BROWSER ? undefined : "chrome" });
  let context;
  try {
    // DS_USER_AGENT (slice G): since every reworked page has the mapping, the existing page without it is /annual,
    // which only renders for phones (middleware/annual-mobile.global.ts): run with --existing /annual and a phone UA.
    context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...(process.env.DS_USER_AGENT ? { userAgent: process.env.DS_USER_AGENT } : {}) });
    const consoleErrors = [];
    for (const theme of ["light", "dark"]) {
      await context.clearCookies();
      await context.addCookies([{ name: "taiko_theme", value: theme, url: BASE }]);
      const exp = expected(theme);
      const page = await context.newPage();
      page.on("console", (m) => m.type() === "error" && consoleErrors.push({ url: page.url(), text: `${theme}: ${m.text().slice(0, 200)}` }));
      if (process.env.DS_CHECK_DEBUG) page.on("console", (m) => ["error", "warning"].includes(m.type()) && console.log(`console ${m.type()} ${m.text().slice(0, 300)}`));
      if (process.env.DS_CHECK_DEBUG) page.on("pageerror", (e) => console.log(`pageerror ${String(e.stack || e).slice(0, 600)}`));
      if (process.env.DS_CHECK_DEBUG) page.on("load", () => console.log(`LOAD  ${Date.now() % 100000} ${page.url()}`));
      if (process.env.DS_CHECK_DEBUG) page.on("framenavigated", (f) => f === page.mainFrame() && console.log(`nav   ${f.url()}`));
      page.on("pageerror", (e) => consoleErrors.push({ url: page.url(), text: `${theme}: pageerror ${String(e).slice(0, 200)}` }));
      try {
        // 1. existing page before any sample page (SSR)
        await page.goto(BASE + EXISTING_PAGE, { waitUntil: "networkidle", timeout: 90_000 });
        const s0 = await page.evaluate(SNAPSHOT);
        check(`[${theme}] existing page has no ds-preview before visiting samples`, !s0.htmlClass.split(/\s+/).includes("ds-preview"), `class="${s0.htmlClass}"`);
        check(`[${theme}] existing page primary is the production colour`, s0.button["background-color"] !== exp.primary, s0.button["background-color"]);

        // 2. client navigation into the samples
        await routerPush(page, "/_ds/element-plus");
        const s1 = await page.evaluate(SNAPSHOT);
        check(`[${theme}] enter (client nav): html has ds-preview`, s1.htmlClass.split(/\s+/).includes("ds-preview"), `class="${s1.htmlClass}"`);
        check(`[${theme}] enter: theme attribute kept`, s1.theme === theme, s1.theme);
        check(`[${theme}] inside: probe primary button = --action-bg`, s1.button["background-color"] === exp.primary, `${s1.button["background-color"]} vs ${exp.primary}`);
        check(`[${theme}] inside: --el-color-primary is brand`, s1.htmlVars["--el-color-primary"] !== s0.htmlVars["--el-color-primary"], `${s0.htmlVars["--el-color-primary"]} → ${s1.htmlVars["--el-color-primary"]}`);
        const pop = process.env.DS_CHECK_SKIP_POPUPS ? {} : await popups(page);
        check(`[${theme}] teleported dialog is under <body>, outside #__nuxt`, pop.teleportedUnderBody);
        check(`[${theme}] teleported dialog bg = --overlay-bg`, pop.dialogBg === exp.overlay, `${pop.dialogBg} vs ${exp.overlay}`);
        check(`[${theme}] teleported dialog primary button = --action-bg`, pop.dialogPrimaryBg === exp.primary, pop.dialogPrimaryBg);
        check(`[${theme}] teleported select dropdown bg = --overlay-bg`, pop.selectDropdownBg === exp.overlay, pop.selectDropdownBg);
        check(`[${theme}] teleported select selected row = --bg-sunk`, pop.selectSelectedBg === exp.sunk, pop.selectSelectedBg);
        check(`[${theme}] teleported tooltip bg = --overlay-bg`, pop.tooltipBg === exp.overlay, pop.tooltipBg);
        check(`[${theme}] teleported dropdown bg = --overlay-bg`, pop.dropdownBg === exp.overlay, pop.dropdownBg);
        check(`[${theme}] teleported message bg = --toast-surface (= --overlay-bg)`, pop.messageBg === exp.overlay, pop.messageBg);

        // 3. leave (the sample page stays cached by keepalive)
        await routerPush(page, EXISTING_PAGE);
        await page.waitForTimeout(4500); // let the sample message expire
        const s2 = await page.evaluate(SNAPSHOT);
        check(`[${theme}] leave (keepalive deactivate): ds-preview removed`, !s2.htmlClass.split(/\s+/).includes("ds-preview"), `class="${s2.htmlClass}"`);
        check(`[${theme}] after leaving: html/body/probe computed styles identical to before`, sameAsBaseline(s0, s2, theme), diffKeys(s0, s2).slice(0, 6).join("; "));
        const leftover = await page.$$eval(".ds-ep-tooltip, .ds-ep-select-popper, .ds-ep-dropdown", (els) =>
          els.map((el) => ({ bg: getComputedStyle(el).backgroundColor, visible: !!(el.offsetWidth || el.offsetHeight) }))
        );
        check(`[${theme}] leftover teleported poppers (if any) no longer use the ds mapping`, leftover.every((l) => l.bg !== exp.overlay || exp.overlay === s0.dialog["background-color"]), JSON.stringify(leftover).slice(0, 200));

        // 4. keepalive round trip: back to the cached sample page, then away again
        await page.evaluate(() => (window.__dsCheckMark = 1));
        await routerPush(page, "/_ds/element-plus");
        await page.waitForLoadState("networkidle");
        const s3 = await page.evaluate(SNAPSHOT);
        check(`[${theme}] re-activate happened without a full page reload`, await page.evaluate(() => window.__dsCheckMark === 1));
        check(`[${theme}] re-activate (keepalive): ds-preview restored`, s3.htmlClass.split(/\s+/).includes("ds-preview"));
        check(`[${theme}] re-activate: same ds values as first visit`, sameJson(s1.button, s3.button) && sameJson(s1.htmlVars, s3.htmlVars));
        await routerPush(page, "/_ds/tokens");
        const s3b = await page.evaluate(SNAPSHOT);
        check(`[${theme}] sample → sample: ds-preview kept`, s3b.htmlClass.split(/\s+/).includes("ds-preview"));
        await routerPush(page, EXISTING_PAGE);
        const s4 = await page.evaluate(SNAPSHOT);
        check(`[${theme}] second leave: ds-preview removed and styles identical`, !s4.htmlClass.includes("ds-preview") && sameAsBaseline(s0, s4, theme), diffKeys(s0, s4).slice(0, 6).join("; "));

        // 5. SSR entry into a sample page, then client navigation out
        await page.goto(BASE + "/_ds/tokens", { waitUntil: "networkidle", timeout: 90_000 });
        const s5 = await page.evaluate(SNAPSHOT);
        const robots = await page.$eval('meta[name="robots"]', (m) => m.content).catch(() => null);
        check(`[${theme}] SSR entry: ds-preview present`, s5.htmlClass.split(/\s+/).includes("ds-preview"));
        check(`[${theme}] SSR entry: robots noindex`, robots === "noindex,nofollow", String(robots));
        await routerPush(page, EXISTING_PAGE);
        const s6 = await page.evaluate(SNAPSHOT);
        check(`[${theme}] SSR entry then leave: ds-preview removed and styles identical`, !s6.htmlClass.includes("ds-preview") && sameAsBaseline(s0, s6, theme), diffKeys(s0, s6).slice(0, 6).join("; "));
        const robotsAfter = await page.$('meta[name="robots"][content="noindex,nofollow"]');
        check(`[${theme}] after leaving: sample noindex meta removed`, !robotsAfter);
        // 5b. leaving from asset and chart sections (component popups, lane buttons, SVG charts) back to the existing page
        for (const sample of ["/_ds/cover", "/_ds/diff-tabs", "/_ds/title-plate", "/_ds/lane", "/_ds/line-chart", "/_ds/radar", "/_ds/note-judge"]) {
          await routerPush(page, sample);
          const inside = await page.evaluate(SNAPSHOT);
          await routerPush(page, EXISTING_PAGE);
          const out = await page.evaluate(SNAPSHOT);
          check(`[${theme}] ${sample} → ${EXISTING_PAGE}: scope set inside, removed after, styles identical`, inside.htmlClass.includes("ds-preview") && !out.htmlClass.includes("ds-preview") && sameAsBaseline(s0, out, theme), diffKeys(s0, out).slice(0, 4).join("; "));
        }
        if (OUT && theme === "light") await page.screenshot({ path: join(OUT, "existing-after-samples.png") });
      } finally {
        await page.close();
      }
    }

    // 6. Japanese route and root-attribute example (P0-28)
    const page = await context.newPage();
    try {
      await context.clearCookies();
      await page.goto(BASE + "/ja/_ds/root-attribute", { waitUntil: "networkidle", timeout: 90_000 });
      const lang = await page.evaluate(() => [document.documentElement.lang, document.documentElement.className]);
      check("/ja/_ds: html lang is Japanese and ds-preview is set", /^ja/.test(lang[0]) && lang[1].includes("ds-preview"), lang.join(" | "));
      const probe = () =>
        page.evaluate(() => {
          const el = document.querySelector('[data-testid="ds-probe"]');
          const s = getComputedStyle(el);
          const h = getComputedStyle(document.documentElement);
          return { outline: s.outlineStyle, outlineColor: s.outlineColor, border: s.borderTopColor, htmlOutline: h.outlineStyle, attr: document.documentElement.hasAttribute("data-ds-probe") };
        });
      const before = await probe();
      await page.click('[data-testid="ds-probe-toggle"]');
      const after = await probe();
      const theme = await page.evaluate(() => document.documentElement.dataset.theme || "light");
      // slice G: the sample rule reads --brand-primary; --action-bg is one step lower in dark since the colour tuning
      const brand = expected(theme).brand;
      check("root attribute off: probe has no outline", before.outline === "none" && !before.attr, JSON.stringify(before));
      check("root attribute on: rule lands on the scoped element (outline = --brand-primary)", after.attr && after.outline === "solid" && after.outlineColor === brand, JSON.stringify(after));
      check("root attribute on: rule does not land on <html>", after.htmlOutline === "none", after.htmlOutline);
      if (OUT) await page.screenshot({ path: join(OUT, "root-attribute.png") });
    } finally {
      await page.close();
    }
    check("every navigation stayed client-side (no document reload, router.push resolved)", hardNavigations.length === 0, hardNavigations.join(" || "));
    const onSamples = consoleErrors.filter((e) => new URL(e.url).pathname.replace(/^\/ja(?=\/)/, "").startsWith("/_ds"));
    const elsewhere = consoleErrors.filter((e) => !onSamples.includes(e));
    check("no console errors or page errors while on sample pages", onSamples.length === 0, onSamples.slice(0, 5).map((e) => `${e.url} ${e.text}`).join(" || "));
    if (elsewhere.length) console.log(`note  console errors on the existing page (${EXISTING_PAGE}), not caused by the samples: ${[...new Set(elsewhere.map((e) => e.text))].slice(0, 3).join(" || ")}`);
  } finally {
    if (context) await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

const timer = setTimeout(() => {
  console.log(`FAIL  total time limit ${TOTAL_MS} ms exceeded`);
  process.exit(2);
}, TOTAL_MS);
try {
  if (OUT) mkdirSync(OUT, { recursive: true });
  await run();
} catch (error) {
  check("browser check ran to completion", false, String(error?.message || error).slice(0, 300));
  if (process.env.DS_CHECK_DEBUG) console.log(String(error?.stack).slice(0, 1500));
} finally {
  clearTimeout(timer);
  if (OUT) writeFileSync(join(OUT, "browser-check.json"), JSON.stringify({ base: BASE, results }, null, 1));
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed ? `\n${failed} of ${results.length} checks failed` : `\nall ${results.length} checks passed`);
  process.exitCode = failed ? 1 : 0;
}
