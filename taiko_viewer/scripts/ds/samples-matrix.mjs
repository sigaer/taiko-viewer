#!/usr/bin/env node
// P0-27 / P0-31 / P0-32: every sample page in 1440 / 820 / 390 / 360 × light / dark × zh / ja.
//
//   node scripts/ds/samples-matrix.mjs --base http://127.0.0.1:<port> [--out <dir>] [--widths 1440,820,390,360]
//
// Per page load (SSR, direct): no console errors, no hydration warnings, no page errors, no horizontal overflow,
// <html lang> matches the route, the ds-preview class and theme are in the server HTML (no light flash on dark
// first paint), no raw `ds.` keys, and on /ja pages no ds.* string that exists only in Chinese.
// Then a client-navigation pass through every section (theme × locale at 1440): same console / overflow checks.
// One browser, one page at a time, bounded; read-only.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..", "..");
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const BASE = opt("--base", "http://127.0.0.1:3517").replace(/\/$/, "");
const OUT = opt("--out", null);
const WIDTHS = opt("--widths", "1440,820,390,360").split(",").map(Number);
const TOTAL_MS = 1_800_000;

const flat = (o, p = "") => Object.entries(o || {}).flatMap(([k, v]) => (v && typeof v === "object" ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
const zh = new Map(flat(JSON.parse(readFileSync(join(ROOT, "locales", "zh.json"), "utf8")).ds, "ds."));
const ja = new Map(flat(JSON.parse(readFileSync(join(ROOT, "locales", "ja.json"), "utf8")).ds, "ds."));
/** Chinese ds strings that differ from their Japanese counterpart and contain Han characters only Chinese uses here. */
const zhOnly = [...zh].filter(([k, v]) => typeof v === "string" && v !== ja.get(k) && v.length >= 2 && !String(ja.get(k) || "").includes(v)).map(([k, v]) => ({ key: k, text: v }));

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok, detail });
  if (!ok || process.env.VERBOSE) console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

async function sections(page) {
  await page.goto(`${BASE}/_ds`, { waitUntil: "networkidle", timeout: 120_000 });
  const slugs = await page.$$eval('[data-testid="ds-index"] a', (as) => as.map((a) => a.getAttribute("href").replace(/^.*\/_ds\//, "")));
  const groups = await page.$$eval('[data-testid="ds-index"] section', (ss) => ss.map((s) => `${s.querySelector("h2").textContent}: ${s.querySelectorAll("a").length}`));
  return { slugs, groups };
}

const PROBE = () => ({
  overflow: document.documentElement.scrollWidth - window.innerWidth,
  lang: document.documentElement.lang,
  cls: document.documentElement.className,
  theme: document.documentElement.dataset.theme,
  text: document.querySelector(".ds-sample__main")?.innerText || ""
});

async function run() {
  const browser = await chromium.launch(process.env.DS_BROWSER ? { headless: true, executablePath: process.env.DS_BROWSER } : { headless: true, channel: "chrome" });
  try {
    let list;
    {
      const ctx = await browser.newContext();
      const p = await ctx.newPage();
      list = await sections(p);
      await ctx.close();
    }
    check(`overview lists every registered section (${list.slugs.length}) in groups`, list.slugs.length > 0, list.groups.join(" | "));
    const paths = ["", ...list.slugs];
    for (const theme of ["light", "dark"]) {
      for (const locale of ["zh", "ja"]) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        await context.addCookies([{ name: "taiko_theme", value: theme, url: BASE }]);
        const page = await context.newPage();
        const logs = [];
        page.on("console", (m) => {
          const t = m.text();
          // The PlayerAvatar sample feeds a deliberately missing image (ds-samples/data/atoms.json "broken") to show the
          // fallback; the browser's own "Failed to load resource" line for that one URL is expected, nothing else is.
          if (m.type() === "error" && /Failed to load resource/.test(t) && /__ds-missing/.test(m.location()?.url || t)) return;
          if (m.type() === "error" || /hydrat/i.test(t) || (m.type() === "warning" && /\[Vue warn\]|\[intlify\]/.test(t))) logs.push(`${m.type()}: ${t.slice(0, 240)}`);
        });
        page.on("pageerror", (e) => logs.push(`pageerror: ${String(e).slice(0, 240)}`));
        try {
          for (const width of WIDTHS) {
            await page.setViewportSize({ width, height: width < 500 ? 780 : 900 });
            for (const slug of paths) {
              const path = `${locale === "ja" ? "/ja" : ""}/_ds${slug ? `/${slug}` : ""}`;
              const tag = `[${theme} ${locale} ${width}] ${path}`;
              logs.length = 0;
              // Server HTML: theme and scope present before any script runs
              const html = await page.request.get(BASE + path, { headers: { cookie: `taiko_theme=${theme}` } }).then((r) => r.text());
              const htmlTag = (html.match(/<html[^>]*>/) || [""])[0];
              await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 120_000 });
              await page.waitForTimeout(150);
              const p = await page.evaluate(PROBE);
              const expectedLang = locale === "ja" ? /^ja/ : /^zh/;
              const ok =
                logs.length === 0 &&
                p.overflow <= 0 &&
                expectedLang.test(p.lang) &&
                p.cls.split(/\s+/).includes("ds-preview") &&
                p.theme === theme &&
                htmlTag.includes(`data-theme="${theme}"`) &&
                /class="[^"]*ds-preview/.test(htmlTag) &&
                !/\bds\.[a-z]/.test(p.text);
              const missing = locale === "ja" ? zhOnly.filter((z) => p.text.includes(z.text)).map((z) => z.key) : [];
              check(
                `${tag}`,
                ok && missing.length === 0,
                [
                  logs.length ? `console: ${logs.slice(0, 3).join(" | ")}` : "",
                  p.overflow > 0 ? `overflow ${p.overflow}px` : "",
                  expectedLang.test(p.lang) ? "" : `lang=${p.lang}`,
                  htmlTag.includes(`data-theme="${theme}"`) ? "" : `server html: ${htmlTag}`,
                  /class="[^"]*ds-preview/.test(htmlTag) ? "" : "server html lacks ds-preview",
                  /\bds\.[a-z]/.test(p.text) ? "raw ds. key visible" : "",
                  missing.length ? `Chinese fallback: ${missing.join(", ")}` : ""
                ]
                  .filter(Boolean)
                  .join("; ")
              );
            }
          }
          // Client navigation through all sections
          await page.setViewportSize({ width: 1440, height: 900 });
          await page.goto(`${BASE}${locale === "ja" ? "/ja" : ""}/_ds`, { waitUntil: "networkidle", timeout: 120_000 });
          for (const slug of list.slugs) {
            logs.length = 0;
            const target = `${locale === "ja" ? "/ja" : ""}/_ds/${slug}`;
            await page.evaluate((t) => {
              window.__dsDoc = window.__dsDoc || Math.random();
              document.querySelector("#__nuxt").__vue_app__.config.globalProperties.$router.push(t);
            }, target);
            await page.waitForFunction((t) => location.pathname === t, target, { timeout: 30_000 });
            await page.waitForLoadState("networkidle");
            await page.waitForTimeout(250);
            const p = await page.evaluate(PROBE);
            check(`[${theme} ${locale} client-nav] ${target}`, logs.length === 0 && p.overflow <= 0 && p.cls.includes("ds-preview"), [logs.slice(0, 3).join(" | "), p.overflow > 0 ? `overflow ${p.overflow}` : ""].filter(Boolean).join("; "));
          }
        } finally {
          await page.close();
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
}

const timer = setTimeout(() => {
  console.log("FAIL  time limit exceeded");
  process.exit(2);
}, TOTAL_MS);
try {
  await run();
} catch (e) {
  check("matrix ran to completion", false, String(e?.stack || e).slice(0, 400));
} finally {
  clearTimeout(timer);
  if (OUT) {
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, "samples-matrix.json"), JSON.stringify({ base: BASE, widths: WIDTHS, results }, null, 1));
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed ? `\n${failed} of ${results.length} checks failed` : `\nall ${results.length} checks passed`);
  process.exitCode = failed ? 1 : 0;
}
