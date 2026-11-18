#!/usr/bin/env node
// P0-01 / P0-34: "existing pages unchanged" evidence.
//
//   node scripts/ds/existing-pages.mjs capture --base http://127.0.0.1:<port> --out <dir> [--pages <file|list>] [--widths 1440,390]
//   node scripts/ds/existing-pages.mjs compare <baseline-dir> <current-dir>
//
// capture: for every page × width × theme — a full-page screenshot, a computed-style snapshot of key elements, the
// list of font and image requests, console errors, and the final URL. Requests to other hosts are blocked in both
// runs (no production traffic, deterministic). The page list defaults to the public pages that render without a
// database (DEFAULT_PAGES); pages that need a login or the test database are listed in NEEDS_DATABASE and must be
// captured on the Linux host with the test database (AGENTS.md rules: SELECT DATABASE() ending in _test, read-only).
// compare: DOM, geometry, computed styles, resource identities and errors are hard gates.
// Pixel differences are diagnostic by default; --strict-pixels additionally makes raster equality a gate.
// Bounds: one browser, one page at a time, total time limit; read-only, no form submissions.
// DS_USER_AGENT (slice G): capture with that user agent, e.g. a phone, for /annual (it only renders on phones and
// otherwise redirects to the home page: middleware/annual-mobile.global.ts).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { CAPTURE_TIME, resourceIdentity, snapshotContract, compareContracts } from "./page-contract.mjs";

const args = process.argv.slice(2);
const mode = args[0];
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);

export const DEFAULT_PAGES = [
  "/",
  "/songs",
  "/songs/available",
  "/songs/1",
  "/songs/v2-constants",
  "/titles",
  "/guide",
  "/guide/4/10",
  "/grade",
  "/tools",
  "/forum",
  "/settings",
  "/about",
  "/more",
  "/ja",
  "/ja/songs",
  "/ja/settings",
  "/ja/about"
];
export const NEEDS_DATABASE = ["/account", "/account/songs", "/account/sync", "/my", "/my/growth", "/my/weekly", "/forum/me", "/forum/notifications", "/admin/taiko"];

/** Key elements: first match of each selector. */
export const SELECTORS = [
  "html",
  "body",
  ".app-shell",
  ".app-sidebar",
  ".app-sidebar .el-menu-item.is-active",
  ".app-content",
  ".page-header h1",
  "h1",
  "h2",
  "a",
  "p",
  ".panel-card",
  ".el-button--primary",
  ".el-button",
  ".el-input__wrapper",
  ".el-select__wrapper",
  ".el-switch",
  ".el-table",
  ".el-tag",
  ".el-card"
];
/**
 * Masked in screenshots. Image pixels are not stable between two captures of the same tree on this machine (Chrome
 * rasterizes downscaled photos slightly differently run to run: home banners, About avatars, the sidebar logo), so
 * every <img> is painted as a solid box. Its position and size still show in the screenshot, and which image files
 * load is compared through the request list.
 */
export const MASK = ["img"];
const PROPS = ["color", "background-color", "border-top-color", "border-top-width", "font-family", "font-size", "font-weight", "line-height", "letter-spacing", "width", "height", "padding-top", "padding-left", "margin-top", "border-radius", "box-shadow", "outline-color", "display", "color-scheme"];

const SNAP = ([selectors, props]) => {
  const out = {};
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const s = getComputedStyle(el);
    out[sel] = Object.fromEntries(props.map((p) => [p, s.getPropertyValue(p).trim()]));
  }
  out["html@attrs"] = { class: document.documentElement.className, theme: document.documentElement.dataset.theme || "", lang: document.documentElement.lang };
  out["@fonts"] = [...document.fonts].filter((f) => f.status === "loaded").map((f) => `${f.family}|${f.weight}|${f.style}`).sort();
  return out;
};

const normalizeUrl = (u, base) => u.replace(base, "").replace(/\/_nuxt\/(?:[\w-]+\/)*([\w-]+?)\.[\w-]{8}\.(\w+)(\?.*)?$/, "/_nuxt/$1.$2").replace(/\/_nuxt\/[\w-]{8}\.(\w+)$/, "/_nuxt/<hash>.$1");
const fileName = (page, width, theme) => `${(page === "/" ? "root" : page.replace(/^\//, "").replace(/[\/?=&]/g, "_"))}__${width}__${theme}`;

async function capture() {
  const { chromium } = await import("playwright-core");
  const beforeCapture = process.env.DS_CAPTURE_SETUP ? (await import(pathToFileURL(resolve(process.env.DS_CAPTURE_SETUP)).href)).beforeCapture : async () => {};
  const BASE = opt("--base", "http://127.0.0.1:3517").replace(/\/$/, "");
  const OUT = resolve(opt("--out", "existing-pages"));
  const pagesArg = opt("--pages", null);
  const pages = pagesArg ? (existsSync(pagesArg) ? readFileSync(pagesArg, "utf8").split(/\s+/).filter(Boolean) : pagesArg.split(",")) : DEFAULT_PAGES;
  const widths = opt("--widths", "1440,390").split(",").map(Number);
  mkdirSync(OUT, { recursive: true });
  const host = new URL(BASE).host;
  const records = [];
  const timer = setTimeout(() => {
    console.log("FAIL  time limit exceeded");
    process.exit(2);
  }, 1_800_000);
  const browser = await chromium.launch(process.env.DS_BROWSER ? { headless: true, executablePath: process.env.DS_BROWSER } : { headless: true, channel: "chrome" });
  try {
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", ignoreHTTPSErrors: Boolean(process.env.DS_STORAGE_STATE), ...(process.env.DS_STORAGE_STATE ? { storageState: process.env.DS_STORAGE_STATE } : {}), ...(process.env.DS_USER_AGENT ? { userAgent: process.env.DS_USER_AGENT } : {}) });
      // Freeze wall-clock content/cache keys without freezing network or timers.
      await context.addInitScript((time) => { const RealDate=Date; globalThis.Date=new Proxy(RealDate,{construct:(target,args,newTarget)=>Reflect.construct(target,args.length?args:[time],newTarget),apply:()=>new RealDate(time).toString(),get:(target,key)=>key==='now'?()=>new RealDate(time).getTime():Reflect.get(target,key)}); }, CAPTURE_TIME);
      await context.addCookies([{ name: "taiko_theme", value: theme, url: BASE }, { name: "viewer_locale", value: "zh", url: BASE }]);
      await context.route("**/*", (route) => (new URL(route.request().url()).host === host ? route.continue() : route.abort()));
      const page = await context.newPage();
      try {
        for (const width of widths) {
          await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
          for (const path of pages) {
            const requests = [];
            const errors = [];
            const onReq = (r) => {
              if (["font", "image"].includes(r.resourceType())) requests.push(`${r.resourceType()} ${resourceIdentity(r.url(), BASE)}`);
            };
            const onCon = (m) => m.type() === "error" && errors.push(m.text().slice(0, 200));
            const onError = (error) => errors.push("PAGEERROR " + String(error.message).slice(0,200));
            page.on("pageerror", onError);
            page.on("request", onReq);
            page.on("console", onCon);
            let status = null;
            try {
              await beforeCapture({ path, width, theme });
              const resp = await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 120_000 });
              status = resp?.status() ?? null;
              await page.evaluate(() => document.fonts.ready);
              await page.waitForTimeout(500);

              const name = fileName(path, width, theme);
              // Lazy images would start loading while a full-page screenshot enlarges the viewport: scroll through the
              // page first, then wait until every image has loaded and decoded, so both runs photograph the same state.
              await page.evaluate(async () => {
                const step = Math.max(200, innerHeight - 100);
                for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
                  scrollTo(0, y);
                  await new Promise((r) => setTimeout(r, 60));
                }
                scrollTo(0, 0);
                const settled = (img) =>
                  img.complete
                    ? Promise.resolve()
                    : new Promise((r) => {
                        img.addEventListener("load", r, { once: true });
                        img.addEventListener("error", r, { once: true });
                      });
                const all = Promise.all([...document.images].map((img) => settled(img).then(() => img.decode().catch(() => {}))));
                await Promise.race([all, new Promise((r) => setTimeout(r, 10_000))]);
              });
              await page.waitForLoadState("networkidle");
              await page.waitForTimeout(400);
              // Dev-only overlay (Nuxt DevTools button with a live timer) is hidden; elements listed in MASK are masked.
              await page.addStyleTag({ content: "#nuxt-devtools-container,#nuxt-devtools-anchor{display:none!important}" });
              await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'});
              await page.evaluate(() => document.fonts.ready);
              const snap = await page.evaluate(SNAP, [SELECTORS, PROPS]);
              const contract = await page.evaluate(snapshotContract);
              for (const img of contract.images) img.src=resourceIdentity(img.src,BASE);
              let loadOrder = null;
              if (process.env.DS_LOAD_ORDER_PROBE === '1') {
                const css = await page.evaluate(async () => {
                  const response=await fetch('/_ds/element-plus');
                  if(!response.ok) throw Error('sample CSS probe unavailable');
                  const doc=new DOMParser().parseFromString(await response.text(),'text/html');
                  const existing=new Set([...document.querySelectorAll('link[rel="stylesheet"]')].map(el=>el.href));
                  const urls=[...doc.querySelectorAll('link[rel="stylesheet"]')].map(el=>new URL(el.getAttribute('href'),location.href).href).filter(url=>!existing.has(url));
                  if(!urls.length) throw Error('sample CSS probe did not add any stylesheet');
                  for(const href of urls.reverse()) await new Promise((resolve,reject)=>{const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.onload=resolve;link.onerror=reject;document.head.append(link);});
                  return urls.map(url=>new URL(url).pathname);
                });
                const after=await page.evaluate(snapshotContract);
                for(const img of after.images) img.src=resourceIdentity(img.src,BASE);
                const changed=compareContracts(contract,after);
                if(changed.length) throw Error('sample CSS load-order regression: '+changed.join(', '));
                loadOrder={stylesheets:css,unchanged:true};
              }
              await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true, animations: "disabled", caret: "hide", mask: MASK.map((m) => page.locator(m)), maskColor: "#ff00ff" });
              records.push({ path, width, theme, name, status, finalUrl: page.url().replace(BASE, ""), snap, contract, loadOrder, requests: [...new Set(requests)].sort(), errors });
              console.log(`captured ${name} (${status})`);
            } catch (e) {
              records.push({ path, width, theme, name: fileName(path, width, theme), error: String(e.message || e).slice(0, 200) });
              console.log(`ERROR ${path} ${width} ${theme}: ${String(e.message || e).slice(0, 120)}`);
            } finally {
              page.off("pageerror", onError);
              page.off("request", onReq);
              page.off("console", onCon);
            }
          }
        }
      } finally {
        await page.close();
        await context.close();
      }
    }
  } finally {
    await browser.close();
    clearTimeout(timer);
    writeFileSync(join(OUT, "capture.json"), JSON.stringify({ base: BASE, pages, widths, records }, null, 1));
  }
}

async function pixelDiff(a, b) {
  const [ia, ib] = await Promise.all([sharp(a).ensureAlpha().raw().toBuffer({ resolveWithObject: true }), sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true })]);
  if (ia.info.width !== ib.info.width || ia.info.height !== ib.info.height) return { sizeDiffers: `${ia.info.width}x${ia.info.height} vs ${ib.info.width}x${ib.info.height}`, pixels: null };
  let pixels = 0;
  let minY = Infinity;
  let maxY = -1;
  const w = ia.info.width;
  for (let i = 0; i < ia.data.length; i += 4) {
    if (ia.data[i] !== ib.data[i] || ia.data[i + 1] !== ib.data[i + 1] || ia.data[i + 2] !== ib.data[i + 2] || ia.data[i + 3] !== ib.data[i + 3]) {
      pixels++;
      const y = Math.floor(i / 4 / w);
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { pixels, rows: pixels ? `${minY}–${maxY}` : null };
}

async function compare() {
  const [dirA, dirB] = [resolve(args[1]), resolve(args[2])];
  const A = JSON.parse(readFileSync(join(dirA, "capture.json"), "utf8"));
  const B = JSON.parse(readFileSync(join(dirB, "capture.json"), "utf8"));
  const byName = new Map(B.records.map((r) => [r.name, r]));
  const lines = [];
  let problems = 0;
  if (!A.records.length || A.records.length !== B.records.length ||
      new Set(A.records.map(r => r.name)).size !== A.records.length || byName.size !== B.records.length) {
    lines.push("FAIL capture state sets are empty, unequal, or contain duplicates");
    problems++;
  }
  for (const a of A.records) {
    const b = byName.get(a.name);
    if (!b) {
      lines.push(`FAIL  ${a.name}: missing in current capture`);
      problems++;
      continue;
    }
    if (a.error || b.error) {
      lines.push(`FAIL  ${a.name}: capture error (baseline: ${a.error || "ok"}; current: ${b.error || "ok"})`);
      problems++;
      continue;
    }
    const issues = [];
    if (a.status !== b.status || a.finalUrl !== b.finalUrl) issues.push(`status/url ${a.status} ${a.finalUrl} → ${b.status} ${b.finalUrl}`);
    const sa = JSON.stringify(a.snap);
    const sb = JSON.stringify(b.snap);
    if (sa !== sb) {
      const diff = [];
      for (const k of new Set([...Object.keys(a.snap), ...Object.keys(b.snap)])) if (JSON.stringify(a.snap[k]) !== JSON.stringify(b.snap[k])) diff.push(k);
      issues.push(`computed style differs: ${diff.join(", ")}`);
    }
    if (JSON.stringify(a.requests) !== JSON.stringify(b.requests)) {
      const onlyB = b.requests.filter((r) => !a.requests.includes(r));
      const onlyA = a.requests.filter((r) => !b.requests.includes(r));
      issues.push(`font/image requests differ: +[${onlyB.join(", ")}] -[${onlyA.join(", ")}]`);
    }
    issues.push(...compareContracts(a.contract,b.contract));
    if (JSON.stringify([...a.errors].sort())!==JSON.stringify([...b.errors].sort())) issues.push("console/page errors differ");
    const px = await pixelDiff(join(dirA, `${a.name}.png`), join(dirB, `${b.name}.png`));
    if (px.sizeDiffers) issues.push(`screenshot dimensions differ: ${px.sizeDiffers}`);
    else if (px.pixels) {
      const diagnostic=`raster difference: ${px.pixels} px in rows ${px.rows}`;
      if (args.includes('--strict-pixels')) issues.push(diagnostic);
      else console.log(`DIAGNOSTIC ${a.name}: ${diagnostic}; DOM/layout/style/resource gates still required`);
    }
    if (issues.length) problems++;
    lines.push(`${issues.length ? "FAIL" : "ok  "}  ${a.name} (${a.status}, ${a.requests.length} font/image requests, ${Object.keys(a.snap).length - 2} elements)${issues.length ? "  — " + issues.join("; ") : ""}`);
  }
  for (const l of lines) console.log(l);
  console.log(problems ? `\n${problems} page state(s) differ` : `\nall ${A.records.length} page states identical (DOM, layout, computed styles, font/image requests; raster differences diagnostic)`);
  process.exitCode = problems ? 1 : 0;
}

if (mode === "capture") await capture();
else if (mode === "compare") await compare();
else {
  console.log("usage: existing-pages.mjs capture --base <url> --out <dir> | compare <baseline-dir> <current-dir>");
  process.exitCode = 2;
}
