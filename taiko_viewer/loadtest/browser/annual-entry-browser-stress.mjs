import { chromium, devices } from "playwright-core";

const base = (process.env.BASE || "http://127.0.0.1:3100").replace(/\/$/, "");
const concurrency = Math.min(2, Math.max(1, Number(process.env.CONCURRENCY || 1)));
const cookie = String(process.env.COOKIE || "").trim();
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined;
const viewports = [[390, 844], [414, 896], [430, 932]];

async function run(worker) {
  const browser = await chromium.launch({ executablePath });
  const results = [];
  for (const [width, height] of viewports) {
    const context = await browser.newContext({ ...devices["iPhone 12"], viewport: { width, height } });
    if (cookie) {
      const session = cookie.match(/(?:^|;\s*)stv_session=([^;]+)/)?.[1];
      if (session) await context.addCookies([{ name: "stv_session", value: session, url: base, httpOnly: true, sameSite: "Lax" }]);
    }
    const page = await context.newPage();
    const started = Date.now();
    const resources = new Map();
    const pending = new Map();
    let totalRequests = 0;
    const requestStartedAt = new Map();
    const requestDurations = [];
    const externalFailures = [];
    const apiStatuses = {};
    const errors = [];
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("request", (request) => { totalRequests += 1; const item = { started: Date.now(), url: request.url(), method: request.method(), type: request.resourceType() }; requestStartedAt.set(request, item); pending.set(request, item); });
    page.on("requestfailed", (request) => { const message = `requestfailed: ${request.url()}`; if (/google-analytics\.com|googletagmanager\.com/i.test(request.url())) externalFailures.push(message); else errors.push(message); pending.delete(request); requestStartedAt.delete(request); });
    page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
    page.on("response", async (response) => {
      const request = response.request();
      const startedRequest = requestStartedAt.get(request);
      const durationMs = startedRequest ? Date.now() - startedRequest.started : 0;
      const headers = response.headers();
      const length = Number(headers["content-length"] || 0);
      const responsePath = new URL(response.url()).pathname;
      if (responsePath === "/api/account/auth/me" || responsePath.startsWith("/api/account/annual-summaries/")) apiStatuses[responsePath] = response.status();
      requestDurations.push({ url: response.url(), durationMs, status: response.status(), type: request.resourceType(), bytes: length });
      if (request.resourceType() === "image" && response.status() === 404) errors.push(`image 404: ${response.url()}`);
      if (response.status() >= 500) errors.push(`5xx: ${response.status()} ${response.url()}`);
      resources.set(`${response.url()}#${totalRequests}`, { url: response.url(), status: response.status(), type: request.resourceType(), bytes: length, cache: headers["cache-control"] || "", durationMs: startedRequest ? Date.now() - startedRequest.started : 0 });
      pending.delete(request);
      requestStartedAt.delete(request);
    });
    const gotoObserved = async (url, selector) => {
      const navStarted = Date.now();
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 }).catch((error) => { errors.push(`navigation domcontentloaded: ${error.message}`); return null; });
      const domContentLoadedMs = Date.now() - navStarted;
      const loadPromise = page.waitForLoadState("load", { timeout: 5_000 }).then(() => true).catch(() => false);
      const loadSucceeded = await loadPromise;
      const loadMs = Date.now() - navStarted;
      const containerFound = await page.locator(selector).first().waitFor({ state: "attached", timeout: 5_000 }).then(() => true).catch(() => false);
      const idlePromise = page.waitForLoadState("networkidle", { timeout: 5_000 }).then(() => true).catch(() => false);
      const networkIdle = await idlePromise;
      return { response, domContentLoadedMs, loadMs, loadSucceeded, containerFound, networkIdle, networkIdleMs: Date.now() - navStarted };
    };
    const homepage = await gotoObserved(`${base}/`, "#__nuxt");
    const entry = await gotoObserved(`${base}/account/version-summary`, ".annual-page, main, #__nuxt");
    const slowRequests = [...requestDurations, ...[...pending.values()].map((item) => ({ ...item, durationMs: Date.now() - item.started, pending: true }))]
      .sort((left, right) => right.durationMs - left.durationMs)
      .slice(0, 10)
      .map((item) => ({ url: item.url, durationMs: item.durationMs, status: item.status || 0, type: item.type, pending: Boolean(item.pending) }));
    const values = [...resources.values()];
    results.push({ worker, viewport: `${width}x${height}`, homepageStatus: homepage.response?.status() || 0, entryStatus: entry.response?.status() || 0, finalUrl: page.url(), authenticationRedirect: /\/account\/login/.test(page.url()), authMeStatus: apiStatuses["/api/account/auth/me"] || null, annualSummaryStatus: apiStatuses["/api/account/annual-summaries/annual_2026"] || null, domcontentloadedMs: entry.domContentLoadedMs, loadMs: entry.loadMs, loadSucceeded: entry.loadSucceeded, networkIdle: entry.networkIdle, networkIdleMs: entry.networkIdleMs, containerFound: entry.containerFound, totalRequests, pendingOver10s: [...pending.values()].filter((item) => Date.now() - item.started >= 10_000).length, failedRequests: errors.filter((error) => error.startsWith("requestfailed")).length, externalFailures, notFound: values.filter((item) => item.status === 404).length, serverErrors: values.filter((item) => item.status >= 500).length, images: values.filter((item) => item.type === "image").length, bytes: values.reduce((sum, item) => sum + item.bytes, 0), noStore: values.filter((item) => /no-store/i.test(item.cache)).length, resourceUrls: values.filter((item) => ["script", "stylesheet", "image", "font"].includes(item.type)).map((item) => ({ url: item.url, type: item.type, status: item.status, bytes: item.bytes, cache: item.cache })), slowest10: slowRequests, errors });
    await context.close();
  }
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
  if (results.some((result) => result.errors.length)) throw new Error(`worker ${worker} observed browser errors`);
}

await Promise.all(Array.from({ length: concurrency }, (_, index) => run(index + 1)));
