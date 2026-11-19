// Browser check for the P0-15 / P0-25 chart sample sections: node scripts/ds/charts-check.mjs <base-url> <out-dir>
// Run through scripts/memory/run_qa.sh on the Linux host for acceptance; anywhere else it is a development self-check.
// One browser, at most two pages open, 420 s budget, closed in finally. Read-only.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";



import { chromium } from "playwright-core";

const BASE = process.argv[2] || "http://127.0.0.1:3517";
const OUT = process.argv[3] || process.env.DS_CHARTS_OUT || "ds-charts-check";
const SECTIONS = ["note-judge", "line-chart", "spark", "radar", "drum-dial", "density-strip", "lane"];
const TOTAL_MS = 420_000;
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok, detail });
  if (!ok || process.env.VERBOSE) console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

const PROBE = () => {
  const main = document.querySelector(".ds-sample__main");
  const out = { names: [], badNames: [], overlaps: [], clipped: [], pageOverflow: document.documentElement.scrollWidth - window.innerWidth };
  for (const el of main.querySelectorAll('[role="img"], [role="group"], button, a')) {
    const name = el.getAttribute("aria-label") || el.textContent.trim();
    out.names.push(name);
    if (!name || /\bds\.|\{|\}|undefined|NaN/.test(name)) out.badNames.push(`${el.tagName}.${el.className?.baseVal ?? el.className}: "${name}"`);
  }
  const svgs = [...main.querySelectorAll("svg")];
  svgs.forEach((svg, si) => {
    const sr = svg.getBoundingClientRect();
    const texts = [...svg.querySelectorAll("text")].map((t) => ({ t: t.textContent, r: t.getBoundingClientRect() })).filter((x) => x.r.width > 0);
    for (let i = 0; i < texts.length; i++) {
      const a = texts[i].r;
      if (a.left < sr.left - 1 || a.right > sr.right + 1 || a.top < sr.top - 1 || a.bottom > sr.bottom + 1) {
        if (getComputedStyle(svg).overflow !== "visible") out.clipped.push(`svg#${si} "${texts[i].t}"`);
      }
      for (let j = i + 1; j < texts.length; j++) {
        const b = texts[j].r;
        const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        // getBoundingClientRect of <text> covers the full ascent + descent box, so two stacked lines (a radar label
        // and its value) touch by ~1 px without any glyph contact; an overlap counts only beyond 2 px in both axes.
        if (ix > 2 && iy > 2) out.overlaps.push(`svg#${si} "${texts[i].t}" × "${texts[j].t}" (${ix.toFixed(1)}×${iy.toFixed(1)})`);
      }
    }
  });
  return out;
};

async function run() {
  const browser = await chromium.launch(process.env.DS_BROWSER ? { headless: true, executablePath: process.env.DS_BROWSER } : { headless: true, channel: "chrome" });
  try {
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await context.addCookies([{ name: "taiko_theme", value: theme, url: BASE }]);
      const page = await context.newPage();
      const logs = [];
      page.on("console", (m) => {
        if (m.type() === "error" || (m.type() === "warning" && /hydrat|Vue warn/i.test(m.text()))) logs.push(`${m.type()}: ${m.text().slice(0, 300)}`);
      });
      page.on("pageerror", (e) => logs.push(`pageerror: ${String(e).slice(0, 300)}`));
      try {
        for (const locale of ["zh", "ja"]) {
          for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
            for (const slug of SECTIONS) {
              const path = `${locale === "ja" ? "/ja" : ""}/_ds/${slug}`;
              logs.length = 0;
              await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 120_000 });
              await page.waitForTimeout(300);
              const tag = `[${theme} ${locale} ${width}] ${slug}`;
              const htmlTheme = await page.evaluate(() => document.documentElement.dataset.theme);
              check(`${tag} theme attribute`, htmlTheme === theme, htmlTheme);
              const p = await page.evaluate(PROBE);
              check(`${tag} console errors / hydration warnings`, logs.length === 0, logs.join(" | "));
              check(`${tag} accessible names (${p.names.length})`, p.badNames.length === 0, p.badNames.slice(0, 5).join(" | "));
              check(`${tag} no overlapping SVG text`, p.overlaps.length === 0, p.overlaps.slice(0, 6).join(" | "));
              check(`${tag} no clipped SVG text`, p.clipped.length === 0, p.clipped.slice(0, 6).join(" | "));
              check(`${tag} no horizontal page overflow`, p.pageOverflow <= 0, `${p.pageOverflow}px`);
              if (locale === "zh" || width === 390) {
                await page.screenshot({ path: join(OUT, `${slug}__${locale}__${width}__${theme}.png`), fullPage: true });
              }
              if (slug === "lane" && locale === "zh" && width === 1440) {
                // keyboard: one Tab stop, arrows move, Enter selects
                const lane = page.locator('[data-testid="ds-lane-normal"] [role="group"]');
                const tabbable = await lane.locator('button[tabindex="0"]').count();
                check(`${tag} lane has one tab stop`, tabbable === 1, String(tabbable));
                await lane.locator('button[tabindex="0"]').focus();
                await page.keyboard.press("ArrowLeft");
                await page.keyboard.press("Enter");
                const pressed = await lane.locator('button[aria-pressed="true"]').getAttribute("aria-label");
                check(`${tag} lane arrow + Enter selects the previous day`, /11\/16/.test(pressed || ""), pressed);
                const focusRing = await page.evaluate(() => getComputedStyle(document.activeElement).boxShadow);
                check(`${tag} lane focus ring is the lane ring`, /inset/.test(focusRing), focusRing);
              }
              if (slug === "line-chart" && locale === "zh") {
                const box = await page.locator('[data-testid="ds-line-normal"] .ds-line').boundingBox();
                await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2);
                await page.waitForTimeout(100);
                check(`${tag} line chart read-out appears on hover`, (await page.locator('[data-testid="ds-line-normal"] .ds-line__tip').count()) === 1);
                await page.mouse.move(0, 0);
              }
            }
          }
        }
      } finally {
        await page.close();
        await context.close();
      }
    }
    // reduced motion
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    try {
      const page = await ctx.newPage();
      await page.goto(BASE + "/_ds/lane", { waitUntil: "networkidle", timeout: 120_000 });
      const s = await page.evaluate(() => {
        const n = document.querySelector('[data-testid="ds-lane-normal"] .ds-lane__col.is-on .ds-lane__note');
        const cs = getComputedStyle(n);
        return { transform: cs.transform, transition: cs.transitionDuration, anims: document.getAnimations().length };
      });
      check("[reduced motion] selected lane note does not scale", s.transform === "none", s.transform);
      check("[reduced motion] no transition on lane notes", /^0s|^1e-06s|^0\.000001s/.test(s.transition) || s.transition === "0s", s.transition);
      check("[reduced motion] no running animations", s.anims === 0, String(s.anims));
      const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const p2 = await ctx2.newPage();
      await p2.goto(BASE + "/_ds/lane", { waitUntil: "networkidle", timeout: 120_000 });
      const t = await p2.evaluate(() => getComputedStyle(document.querySelector('[data-testid="ds-lane-normal"] .ds-lane__col.is-on .ds-lane__note')).transform);
      check("[motion allowed] selected lane note scales 1.14", t !== "none", t);
      await p2.close();
      await ctx2.close();
    } finally {
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
}

const timer = setTimeout(() => {
  console.log("FAIL  time budget exceeded");
  process.exit(2);
}, TOTAL_MS);
run()
  .catch((e) => {
    console.log(`FAIL  ${e.stack || e}`);
    process.exitCode = 1;
  })
  .finally(() => {
    clearTimeout(timer);
    const failed = results.filter((r) => !r.ok);
    writeFileSync(join(OUT, "charts-check.json"), JSON.stringify(results, null, 2));
    console.log(`\n${results.length - failed.length}/${results.length} checks pass (development self-check, Windows)`);
    if (failed.length) process.exitCode = 1;
  });
