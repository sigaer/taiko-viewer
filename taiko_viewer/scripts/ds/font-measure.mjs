#!/usr/bin/env node
// P0-10: font option A vs B on /_ds/fonts (zh) and /ja/_ds/fonts (ja).
//
//   node scripts/ds/font-measure.mjs --base http://127.0.0.1:<port> --fontsource <dir> [--rounds 3] [--out <dir>]
//
// <dir> holds an installed @fontsource-variable/noto-sans-sc and noto-sans-jp (for example another checkout's
// node_modules/@fontsource-variable). Their files are served to the page through request interception at
// /_ds-fonts-a/…; nothing is copied into this repository or any build. Option B needs nothing extra.
// Each round uses a fresh browser context (cold cache). Profiles: "none" (no throttling) and "slow" (CDP
// emulation: 150 ms latency, 1.6 Mbit/s down). One browser, one page at a time, bounded total time.
// Results are a measurement of the machine it runs on (dev server or test build), not a field measurement.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const BASE = opt("--base", "http://127.0.0.1:3517").replace(/\/$/, "");
const FONTSOURCE = opt("--fontsource", null);
const ROUNDS = Number(opt("--rounds", 3));
const OUT = opt("--out", null);
const TOTAL_MS = 900_000;
if (!FONTSOURCE || !existsSync(join(FONTSOURCE, "noto-sans-sc", "index.css"))) {
  console.error("--fontsource <dir with noto-sans-sc and noto-sans-jp> is required");
  process.exit(2);
}

function cjkCss() {
  return ["noto-sans-sc", "noto-sans-jp"]
    .map((pkg) => readFileSync(join(FONTSOURCE, pkg, "index.css"), "utf8").replace(/url\(\.\/files\//g, `url(/_ds-fonts-a/${pkg}/files/`))
    .join("\n");
}

const PROFILES = {
  none: null,
  slow: { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 }
};

async function measure(browser, { option, lang, profile }) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const fonts = [];
  try {
    // Re-target /_ds-fonts-a/* to the local file server below. route.continue keeps the request on the real network
    // stack, so CDP throttling applies to option A exactly as it does to the app's own files (route.fulfill would not).
    await page.route("**/_ds-fonts-a/**", (route) => {
      const path = new URL(route.request().url()).pathname.replace(/^\/_ds-fonts-a\//, "");
      return route.continue({ url: `${STATIC}/${path}` });
    });
    page.on("requestfinished", async (req) => {
      if (/\.woff2?(\?|$)/.test(req.url())) {
        const sizes = await req.sizes().catch(() => null);
        fonts.push({ url: req.url().replace(BASE, ""), bytes: sizes ? sizes.responseBodySize + sizes.responseHeadersSize : 0 });
      }
    });
    if (PROFILES[profile]) {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
      await cdp.send("Network.emulateNetworkConditions", PROFILES[profile]);
    }
    const url = `${BASE}${lang === "ja" ? "/ja" : ""}/_ds/fonts?fonts=${option}`;
    await page.goto(url, { waitUntil: "load", timeout: 240_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForLoadState("networkidle", { timeout: 240_000 });
    const timing = await page.evaluate(() => {
      const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null;
      const fontEntries = performance.getEntriesByType("resource").filter((e) => /\.woff2?(\?|$)/.test(e.name));
      const arrival = fontEntries.length ? Math.max(...fontEntries.map((e) => e.responseEnd)) : null;
      const loaded = [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/"/g, ""));
      return { fcp, arrival, loadedFamilies: [...new Set(loaded)] };
    });
    const bytes = fonts.reduce((s, f) => s + f.bytes, 0);
    return {
      option,
      lang,
      profile,
      requests: fonts.length,
      bytes,
      fcpMs: timing.fcp == null ? null : Math.round(timing.fcp),
      fontArrivalMs: timing.arrival == null ? null : Math.round(timing.arrival),
      foutMs: timing.fcp == null || timing.arrival == null ? 0 : Math.max(0, Math.round(timing.arrival - timing.fcp)),
      families: timing.loadedFamilies
    };
  } finally {
    await page.close();
    await context.close();
  }
}

const timer = setTimeout(() => {
  console.log("FAIL  time limit exceeded");
  process.exit(2);
}, TOTAL_MS);
const rows = [];
// Local, read-only file server for option A (127.0.0.1, ephemeral port, closed at the end).
const css = cjkCss();
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\//, "");
  const headers = { "access-control-allow-origin": "*", "cache-control": "no-store" };
  if (path === "fonts-cjk.css") {
    res.writeHead(200, { ...headers, "content-type": "text/css" });
    return res.end(css);
  }
  const file = resolve(FONTSOURCE, path);
  if (!file.startsWith(resolve(FONTSOURCE)) || !/\.woff2$/.test(file) || !existsSync(file)) {
    res.writeHead(404, headers);
    return res.end();
  }
  const body = readFileSync(file);
  res.writeHead(200, { ...headers, "content-type": "font/woff2", "content-length": body.length });
  res.end(body);
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const STATIC = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch(process.env.DS_BROWSER ? { headless: true, executablePath: process.env.DS_BROWSER } : { headless: true, channel: "chrome" });
try {
  for (const profile of Object.keys(PROFILES))
    for (const lang of ["zh", "ja"])
      for (const option of ["b", "a"])
        for (let round = 1; round <= ROUNDS; round++) {
          const r = { ...(await measure(browser, { option, lang, profile })), round };
          rows.push(r);
          console.log(`${profile.padEnd(5)} ${lang} option ${option} #${round}: ${r.requests} req, ${(r.bytes / 1024).toFixed(1)} KiB, FCP ${r.fcpMs} ms, fonts ${r.fontArrivalMs} ms, FOUT ${r.foutMs} ms  [${r.families.join(", ")}]`);
        }
} finally {
  await browser.close();
  await new Promise((ok) => server.close(ok));
  clearTimeout(timer);
}
const range = (xs) => (xs.some((x) => x == null) ? "—" : `${Math.min(...xs)}–${Math.max(...xs)}`);
const summary = [];
for (const profile of Object.keys(PROFILES))
  for (const lang of ["zh", "ja"])
    for (const option of ["b", "a"]) {
      const rs = rows.filter((r) => r.profile === profile && r.lang === lang && r.option === option);
      summary.push({ profile, lang, option, requests: range(rs.map((r) => r.requests)), kib: range(rs.map((r) => Math.round(r.bytes / 1024))), fontArrivalMs: range(rs.map((r) => r.fontArrivalMs)), foutMs: range(rs.map((r) => r.foutMs)) });
    }
console.log("\nprofile lang option requests  KiB         font arrival ms  FOUT ms");
for (const s of summary) console.log(`${s.profile.padEnd(7)} ${s.lang.padEnd(4)} ${s.option.padEnd(6)} ${s.requests.padEnd(9)} ${s.kib.padEnd(11)} ${s.fontArrivalMs.padEnd(16)} ${s.foutMs}`);
if (OUT) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "font-measure.json"), JSON.stringify({ base: BASE, rounds: ROUNDS, profiles: PROFILES, rows, summary }, null, 1));
}
