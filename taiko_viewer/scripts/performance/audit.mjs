#!/usr/bin/env node

import { chromium } from "playwright-core";

const valueOf = (name, fallback) => {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || fallback;
};

const baseUrl = valueOf("base-url", "http://127.0.0.1:3100").replace(/\/$/, "");
const runs = Math.max(1, Number(valueOf("runs", "5")) || 5);
const settleMs = Math.max(1000, Number(valueOf("settle-ms", "5000")) || 5000);
const assertTargets = process.argv.includes("--assert");
const routeOverride = valueOf("routes", "");
const routes = routeOverride ? routeOverride.split(",").filter(Boolean) : [
  "/",
  "/songs/available",
  "/songs/removed",
  "/songs/1",
  "/songs/v2-constants",
  "/titles",
  "/guide/4/10",
  "/grade",
  "/forum",
  "/alias-log",
  "/tools",
  "/account/login",
  "/account",
  "/account/version-summary"
];

const p75 = (values) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.ceil(sorted.length * 0.75) - 1] : null;
};

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-background-networking"]
});

const results = [];
for (const route of routes) {
  for (let run = 1; run <= runs; run += 1) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      serviceWorkers: "block"
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__viewerPerf = { lcp: 0, lcpElement: "", cls: 0, inp: 0 };
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries.at(-1);
        window.__viewerPerf.lcp = last?.startTime || window.__viewerPerf.lcp;
        window.__viewerPerf.lcpElement = last?.element
          ? `${last.element.tagName.toLowerCase()}${last.element.id ? `#${last.element.id}` : ""}${last.element.className ? `.${String(last.element.className).trim().replace(/\s+/g, ".")}` : ""}`.slice(0, 180)
          : window.__viewerPerf.lcpElement;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__viewerPerf.cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__viewerPerf.inp = Math.max(window.__viewerPerf.inp, entry.duration || 0);
          }
        }).observe({ type: "event", buffered: true, durationThreshold: 40 });
      } catch {}
    });

    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 80,
      downloadThroughput: 625000,
      uploadThroughput: 625000,
      connectionType: "cellular4g"
    });
    let transferredBytes = 0;
    const requestKinds = new Map();
    const covers = new Set();
    let fontRequests = 0;
    cdp.on("Network.responseReceived", ({ requestId, response, type }) => {
      requestKinds.set(requestId, type);
      if (/\/cover\/(?:thumb\/\d+\/)?\d+\.(?:webp|png)/.test(response.url)) covers.add(response.url);
      if (type === "Font") fontRequests += 1;
    });
    cdp.on("Network.loadingFinished", ({ encodedDataLength }) => {
      transferredBytes += Number(encodedDataLength || 0);
    });

    const started = Date.now();
    let status = 0;
    let navigationError = "";
    try {
      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      status = response?.status() || 0;
      await page.waitForTimeout(settleMs);
    } catch (error) {
      navigationError = String(error?.message || error);
    }
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0];
      const paint = Object.fromEntries(performance.getEntriesByType("paint").map((entry) => [entry.name, entry.startTime]));
      return {
        ttfb: navigation?.responseStart || 0,
        fcp: paint["first-contentful-paint"] || 0,
        ...window.__viewerPerf
      };
    }).catch(() => ({ ttfb: 0, fcp: 0, lcp: 0, cls: 0, inp: 0 }));
    results.push({
      route,
      run,
      status,
      elapsedMs: Date.now() - started,
      transferKb: Math.round(transferredBytes / 1024),
      coverRequests: covers.size,
      fontRequests,
      navigationError,
      ...metrics
    });
    process.stdout.write(`${route} run ${run}/${runs}: ${JSON.stringify(results.at(-1))}\n`);
    await context.close();
  }
}
await browser.close();

const summary = routes.map((route) => {
  const samples = results.filter((item) => item.route === route);
  return {
    route,
    status: samples.map((item) => item.status),
    p75: {
      ttfb: p75(samples.map((item) => item.ttfb)),
      fcp: p75(samples.map((item) => item.fcp)),
      lcp: p75(samples.map((item) => item.lcp)),
      cls: p75(samples.map((item) => item.cls)),
      inp: p75(samples.map((item) => item.inp)),
      transferKb: p75(samples.map((item) => item.transferKb)),
      coverRequests: p75(samples.map((item) => item.coverRequests)),
      fontRequests: p75(samples.map((item) => item.fontRequests))
    }
  };
});
process.stdout.write(`SUMMARY ${JSON.stringify({ baseUrl, profile: "390x844-5Mbps-80ms", runs, summary }, null, 2)}\n`);

if (assertTargets) {
  const failures = summary.filter((item) =>
    item.status.some((status) => status < 200 || status >= 400) ||
    Number(item.p75.fcp || 0) > 1800 ||
    Number(item.p75.lcp || 0) > 2500 ||
    Number(item.p75.cls || 0) > 0.1 ||
    Number(item.p75.transferKb || 0) > (item.route.includes("annual") || item.route.includes("version-summary") ? 2048 : 1536)
  );
  if (failures.length) {
    process.stderr.write(`Performance targets failed: ${failures.map((item) => item.route).join(", ")}\n`);
    process.exitCode = 1;
  }
}
